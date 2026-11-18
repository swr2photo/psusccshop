/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getJson, putJson } from '@/lib/filebase';
import { resolveOrderByRef, updateOrderByRef } from '@/lib/order-lookup';
import { calculateOrderTotal } from '@/lib/payment-utils';
import { requireAuth, isResourceOwner, isAdminEmailAsync, ADMIN_EMAILS } from '@/lib/auth';
import { triggerSheetSync } from '@/lib/sheet-sync';
import { sendPaymentReceivedEmail } from '@/lib/email';
import { sendPushNotification } from '@/lib/push-notification';
import { rateLimitOrNull } from '@/lib/api-helpers';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { dispatchNotification } from '@/lib/notifications';
import { db } from '@/lib/db';
import { orders } from '@/db/schema';
import { and, ne, sql } from 'drizzle-orm';
import crypto from 'crypto';
import { secureJsonRequest, secureJsonResponse } from '@/lib/payload-crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Helper to save user log server-side
async function saveUserLogServer(log: {
  email: string;
  name?: string;
  action: string;
  details?: string;
  metadata?: Record<string, any>;
  ip?: string;
  userAgent?: string;
}) {
  try {
    const id = `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const fullLog = {
      ...log,
      id,
      timestamp: new Date().toISOString(),
    };
    await putJson(`user-logs/${id}.json`, fullLog);
  } catch (e) {
    console.warn('[payment-verify] Failed to save user log:', e);
  }
}

// ============== EMAIL INDEX HELPER ==============

const normalizeEmail = (email?: string | null) => (email || '').trim().toLowerCase();

const emailIndexKey = (email: string) => {
  const normalized = normalizeEmail(email);
  const hash = crypto.createHash('sha256').update(normalized).digest('hex');
  return `orders/index/${hash}.json`;
};

const updateEmailIndex = async (email: string, updatedOrder: any) => {
  const normalized = normalizeEmail(email);
  if (!normalized) return;

  const key = emailIndexKey(normalized);
  try {
    const existing = (await getJson<any[]>(key)) || [];
    const orderRef = updatedOrder.ref;
    const idx = existing.findIndex((o) => o?.ref === orderRef);

    if (idx >= 0) {
      existing[idx] = { ...existing[idx], ...updatedOrder };
    } else {
      existing.unshift(updatedOrder);
    }

    const trimmed = existing.slice(0, 500);
    await putJson(key, trimmed);
    console.log(`[payment-verify] Index updated for ${normalized}, order ${orderRef}`);
  } catch (error) {
    console.error(`[payment-verify] Failed to update index for ${normalized}`, error);
  }
};

// ============== SLIP2GO TYPES ==============

interface Slip2GoResponseData {
  referenceId?: string;
  decode?: string;
  transRef?: string;
  dateTime?: string;
  transDate?: string;
  transTime?: string;
  amount?: number | string;
  ref1?: string | null;
  ref2?: string | null;
  ref3?: string | null;
  sender?: {
    displayName?: string;
    name?: string;
    account?: {
      name?: string;
      bank?: { id?: string; name?: string; account?: string };
      proxy?: { type?: string | null; account?: string | null };
      account?: { type?: string; value?: string };
    };
    bank?: { id?: string; name?: string };
    proxy?: { type?: string | null; value?: string | null };
  };
  receiver?: {
    displayName?: string;
    name?: string;
    account?: {
      name?: string;
      bank?: { id?: string; name?: string; account?: string };
      proxy?: { type?: string | null; account?: string | null };
      account?: { type?: string; value?: string };
    };
    bank?: { id?: string; name?: string };
    proxy?: { type?: string | null; value?: string | null };
  };
}

interface Slip2GoApiResponse {
  code?: string | number;
  message?: string;
  data?: Slip2GoResponseData;
}

interface NormalizedSlipData {
  referenceId?: string;
  transRef: string;
  dateTime: string;
  transDate: string;
  transTime: string;
  amount: number;
  senderName: string;
  senderDisplayName: string;
  senderAccount: string;
  senderBank: string;
  receiverName: string;
  receiverDisplayName: string;
  receiverAccount: string;
  receiverProxy: string;
  receiverBank: string;
}

interface SlipVerifyResult {
  success: boolean;
  verified: boolean;
  message: string;
  code?: number | string;
  slipData?: NormalizedSlipData;
}

const SLIP2GO_ERROR_MAP: Record<string, { compatCode: number; message: string }> = {
  '200401': { compatCode: 1014, message: 'บัญชีผู้รับเงินในสลิปไม่ตรงกับบัญชีร้านค้า' },
  '200402': { compatCode: 1013, message: 'ยอดเงินในสลิปไม่ตรงกับยอดที่ต้องชำระ' },
  '200403': { compatCode: 1007, message: 'วันที่หรือเวลาโอนเงินในสลิปไม่ตรงตามเงื่อนไข' },
  '200404': { compatCode: 1012, message: 'สลิปนี้เคยใช้แล้ว ไม่สามารถใช้ซ้ำได้' },
  '200500': { compatCode: 1007, message: 'ไม่พบ QR Code ในรูปภาพ หรือสลิปไม่ถูกต้อง' },
  '400001': { compatCode: 1006, message: 'ข้อมูลรูปสลิปไม่ถูกต้อง กรุณาอัปโหลดใหม่' },
  '400002': { compatCode: 1007, message: 'ไม่พบ QR Code ในรูปภาพ หรือไฟล์ไม่ใช่สลิปโอนเงิน' },
};

const DEFAULT_SLIP2GO_BASE_URL = 'https://connect.slip2go.com';

function resolveSlip2GoEndpoint(configuredUrl?: string): string {
  const raw = (configuredUrl || process.env.SLIP2GO_API_URL || DEFAULT_SLIP2GO_BASE_URL).trim();
  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.toLowerCase();
    // SSRF guard: strictly permit only HTTPS Slip2Go endpoints
    if (parsed.protocol === 'https:' && (host === 'slip2go.com' || host.endsWith('.slip2go.com'))) {
      const cleanPath = parsed.pathname.replace(/\/+$/, '');
      if (cleanPath.endsWith('/verify-slip/qr-image/info')) {
        return `${parsed.origin}${cleanPath}`;
      }
      return `${parsed.origin}/api/verify-slip/qr-image/info`;
    }
  } catch {
    // Fallback to official API Connect endpoint
  }
  return `${DEFAULT_SLIP2GO_BASE_URL}/api/verify-slip/qr-image/info`;
}

function sniffImageMime(buf: Buffer): { mime: string; ext: string } | null {
  if (buf.length < 12) return null;
  // PNG
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { mime: 'image/png', ext: 'png' };
  }
  // JPEG
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { mime: 'image/jpeg', ext: 'jpg' };
  }
  // WebP (RIFF....WEBP)
  if (
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { mime: 'image/webp', ext: 'webp' };
  }
  return null;
}

function formatBangkokDateAndTime(isoDateTime?: string, fallbackDate?: string, fallbackTime?: string): { transDate: string; transTime: string } {
  if (fallbackDate && fallbackTime) {
    return { transDate: fallbackDate, transTime: fallbackTime };
  }
  if (!isoDateTime) return { transDate: fallbackDate || '', transTime: fallbackTime || '' };
  const d = new Date(isoDateTime);
  if (Number.isNaN(d.getTime())) {
    return { transDate: fallbackDate || '', transTime: fallbackTime || '' };
  }
  const dateFmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
  const timeFmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(d);
  return { transDate: dateFmt, transTime: timeFmt };
}

function normalizeSlip2GoData(data: Slip2GoResponseData): NormalizedSlipData {
  const { transDate, transTime } = formatBangkokDateAndTime(data.dateTime, data.transDate, data.transTime);
  const senderName =
    data.sender?.account?.name ||
    data.sender?.name ||
    data.sender?.displayName ||
    '';
  const senderDisplayName = data.sender?.displayName || senderName;
  const senderAccount =
    data.sender?.account?.bank?.account ||
    data.sender?.account?.account?.value ||
    data.sender?.account?.proxy?.account ||
    data.sender?.proxy?.value ||
    '';
  const senderBank =
    data.sender?.bank?.name ||
    data.sender?.bank?.id ||
    '';

  const receiverName =
    data.receiver?.account?.name ||
    data.receiver?.name ||
    data.receiver?.displayName ||
    '';
  const receiverDisplayName = data.receiver?.displayName || receiverName;
  const receiverAccount =
    data.receiver?.account?.bank?.account ||
    data.receiver?.account?.account?.value ||
    '';
  const receiverProxy =
    data.receiver?.account?.proxy?.account ||
    data.receiver?.proxy?.value ||
    '';
  const receiverBank =
    data.receiver?.bank?.name ||
    data.receiver?.bank?.id ||
    '';

  return {
    referenceId: data.referenceId,
    transRef: String(data.transRef || data.referenceId || '').trim(),
    dateTime: String(data.dateTime || ''),
    transDate,
    transTime,
    amount: Number(data.amount),
    senderName: String(senderName).trim(),
    senderDisplayName: String(senderDisplayName).trim(),
    senderAccount: String(senderAccount).trim(),
    senderBank: String(senderBank).trim(),
    receiverName: String(receiverName).trim(),
    receiverDisplayName: String(receiverDisplayName).trim(),
    receiverAccount: String(receiverAccount).trim(),
    receiverProxy: String(receiverProxy).trim(),
    receiverBank: String(receiverBank).trim(),
  };
}

/** Match masked Thai bank/PromptPay strings (e.g., `xxx-x-x9866-x` or `081-xxx-1234`) against expected digits. */
function doesMaskedAccountMatch(maskedRaw: string, expectedDigits: string): boolean {
  const cleanedExpected = expectedDigits.replace(/\D/g, '');
  if (!cleanedExpected) return false;

  const pattern = maskedRaw.replace(/[^0-9xX*]/g, '').toLowerCase();
  if (!pattern) return false;

  // 1. Positional alignment when masked pattern length matches expected digits length
  if (pattern.length === cleanedExpected.length) {
    let visibleMatched = 0;
    for (let i = 0; i < pattern.length; i++) {
      const ch = pattern[i];
      if (ch >= '0' && ch <= '9') {
        if (cleanedExpected[i] !== ch) {
          return false;
        }
        visibleMatched++;
      }
    }
    if (visibleMatched >= 3) return true;
  }

  // 2. Fallback: require the longest contiguous visible digit sequence (>=3 digits) to appear in expected
  const digitRuns = pattern.match(/\d{3,}/g) || [];
  return digitRuns.some((run) => cleanedExpected.includes(run));
}

function normalizeAccountNameForMatch(name: string): string {
  return name
    .toLowerCase()
    .replace(/^(นาย|นางสาว|น\.ส\.|นาง|ด\.ช\.|ด\.ญ\.|บริษัท|หจก\.|บจก\.|mr\.|mrs\.|ms\.)\s*/i, '')
    .replace(/[^a-z0-9\u0E00-\u0E7F]/g, '')
    .trim();
}

function verifyReceiverMatchesShop(
  slip: NormalizedSlipData,
  shopConfig: Record<string, any> | null,
): boolean {
  const candidateAccounts = [
    process.env.PROMPTPAY_ID,
    process.env.PAYMENT_ACCOUNT,
    shopConfig?.bankAccount?.accountNumber,
  ]
    .map((v) => String(v || '').replace(/\D/g, ''))
    .filter((v) => v.length >= 4);

  const candidateNames = [
    process.env.PAYMENT_ACCOUNT_NAME,
    shopConfig?.bankAccount?.accountName,
  ]
    .map((v) => normalizeAccountNameForMatch(String(v || '')))
    .filter((v) => v.length >= 3);

  // If the shop has no configured expected accounts/names at all, rely on Slip2Go shop rules
  if (candidateAccounts.length === 0 && candidateNames.length === 0) {
    return true;
  }

  const slipAccountStrings = [slip.receiverAccount, slip.receiverProxy].filter(Boolean);
  const hasVisibleAccountDigits = slipAccountStrings.some((s) => (s.match(/\d/g) || []).length >= 3);

  if (hasVisibleAccountDigits && candidateAccounts.length > 0) {
    const matchedAcct = slipAccountStrings.some((slipAcc) =>
      candidateAccounts.some((expectedDigits) => doesMaskedAccountMatch(slipAcc, expectedDigits)),
    );
    if (matchedAcct) return true;
  }

  const normalizedSlipName = normalizeAccountNameForMatch(slip.receiverName || slip.receiverDisplayName || '');
  if (normalizedSlipName.length >= 3 && candidateNames.length > 0) {
    const matchedName = candidateNames.some(
      (expectedName) =>
        normalizedSlipName.includes(expectedName) || expectedName.includes(normalizedSlipName),
    );
    if (matchedName) return true;
  }

  // Only pass if bank response gave neither visible digits nor receiver name to compare
  if (!hasVisibleAccountDigits && normalizedSlipName.length < 3) {
    return true;
  }

  return false;
}

// ============== SLIP2GO VERIFICATION ==============

const checkSlipWithSlip2Go = async (
  rawBase64: string,
  expectedAmount: number,
  shopConfig: Record<string, any> | null,
  fileNameHint?: string,
): Promise<SlipVerifyResult> => {
  const secretKey = (
    shopConfig?.slipVerifyConfig?.secretKey ||
    process.env.SLIP2GO_SECRET_KEY ||
    ''
  ).trim();

  // Fail closed when Slip2Go Secret Key is missing
  if (!secretKey) {
    console.error('[payment-verify] SLIP2GO_SECRET_KEY missing; failing closed');
    return {
      success: false,
      verified: false,
      code: 'SLIP2GO_NOT_CONFIGURED',
      message: 'ระบบตรวจสอบสลิป Slip2Go ยังไม่พร้อมใช้งาน (ยังไม่ได้ตั้งค่า Secret Key) กรุณาติดต่อแอดมิน',
    };
  }

  const endpoint = resolveSlip2GoEndpoint(shopConfig?.slipVerifyConfig?.apiUrl);

  const cleanBase64 = rawBase64.includes(',') ? rawBase64.split(',')[1] : rawBase64;
  if (!cleanBase64 || !/^[A-Za-z0-9+/=\r\n]+$/.test(cleanBase64)) {
    return {
      success: false,
      verified: false,
      code: 1006,
      message: 'ไฟล์รูปภาพไม่ถูกต้อง กรุณาอัปโหลดใหม่',
    };
  }

  const imageBuffer = Buffer.from(cleanBase64, 'base64');
  const MAX_SLIP_BYTES = 5 * 1024 * 1024;
  if (imageBuffer.length === 0 || imageBuffer.length > MAX_SLIP_BYTES) {
    return {
      success: false,
      verified: false,
      code: 1006,
      message: 'ขนาดรูปสลิปไม่ถูกต้อง (ต้องไม่เกิน 5MB)',
    };
  }

  const sniffed = sniffImageMime(imageBuffer);
  if (!sniffed) {
    return {
      success: false,
      verified: false,
      code: 1006,
      message: 'รองรับเฉพาะไฟล์รูปภาพ PNG, JPG หรือ WebP เท่านั้น',
    };
  }

  try {
    const safeName = (fileNameHint || `slip.${sniffed.ext}`).replace(/[^a-zA-Z0-9._-]/g, '_');
    const formData = new FormData();
    formData.append('file', new Blob([imageBuffer], { type: sniffed.mime }), safeName);
    formData.append(
      'payload',
      JSON.stringify({
        checkCondition: {
          checkDuplicate: true,
        },
      }),
    );

    console.log(`[payment-verify] Checking slip with Slip2Go (${endpoint}), expected amount: ${expectedAmount}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15_000);
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secretKey}`,
        },
        body: formData,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (response.status === 401 || response.status === 403) {
      console.error(`[payment-verify] Slip2Go authentication failed: HTTP ${response.status}`);
      return {
        success: false,
        verified: false,
        code: 'SLIP2GO_AUTH_ERROR',
        message: 'การเชื่อมต่อ Slip2Go ไม่ได้รับอนุญาต กรุณาตรวจสอบ Secret Key / IP Whitelist',
      };
    }

    const result: Slip2GoApiResponse = await response.json().catch(() => ({}));
    const codeStr = String(result?.code ?? '');

    if (response.ok && (codeStr === '200000' || codeStr === '200200') && result.data) {
      const normalized = normalizeSlip2GoData(result.data);
      console.log(
        `[payment-verify] Slip2Go verified: code=${codeStr}, transRef=${normalized.transRef}, amount=${normalized.amount}`,
      );
      return {
        success: true,
        verified: true,
        code: codeStr,
        message: 'สลิปถูกต้อง',
        slipData: normalized,
      };
    }

    const mapped = SLIP2GO_ERROR_MAP[codeStr];
    const errorMessage = mapped?.message || result?.message || 'ไม่พบข้อมูลสลิปหรือสลิปไม่ผ่านการตรวจสอบ';
    const compatCode = mapped?.compatCode ?? (response.status === 400 ? 1007 : codeStr || 1007);

    console.warn(`[payment-verify] Slip2Go rejected: http=${response.status}, code=${codeStr}, message=${result?.message}`);

    return {
      success: false,
      verified: false,
      code: compatCode,
      message: errorMessage,
      slipData: result?.data ? normalizeSlip2GoData(result.data) : undefined,
    };
  } catch (error: any) {
    console.error('[payment-verify] Slip2Go request failed:', error?.message || error);
    return {
      success: false,
      verified: false,
      message: error?.name === 'AbortError'
        ? 'ระบบตรวจสอบสลิปหมดเวลาการเชื่อมต่อ กรุณาลองใหม่'
        : 'ไม่สามารถเชื่อมต่อระบบตรวจสอบสลิปได้ กรุณาลองใหม่',
    };
  }
};

const CONFIG_KEY = 'config/shop-settings.json';

export async function POST(req: NextRequest) {
  const rateLimited = await rateLimitOrNull(req, RATE_LIMITS.payment);
  if (rateLimited) return rateLimited;

  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  const currentUserEmail = authResult.email;
  const isAdmin = await isAdminEmailAsync(currentUserEmail);

  try {
    const shopConfig = await getJson<any>(CONFIG_KEY);

    // ตรวจสอบว่าระบบชำระเงินเปิดอยู่หรือไม่ (admin ข้ามได้)
    if (!isAdmin && shopConfig && shopConfig.paymentEnabled === false) {
      const message = shopConfig.paymentDisabledMessage || 'ระบบชำระเงินปิดให้บริการชั่วคราว กรุณารอการแจ้งเปิดจากแอดมิน';
      return await secureJsonResponse(
        { status: 'error', message, code: 'PAYMENT_DISABLED' },
        { status: 503, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      );
    }

    const { ref, base64, mime, name, receiptRequest } = await secureJsonRequest(req);
    if (!ref || !base64) {
      return await secureJsonResponse({ status: 'error', message: 'กรุณาอัพโหลดสลิปและระบุหมายเลขคำสั่งซื้อ' }, { status: 400 });
    }

    const order = await resolveOrderByRef(ref);
    if (!order) {
      return await secureJsonResponse({ status: 'error', message: 'ไม่พบคำสั่งซื้อนี้ในระบบ' }, { status: 404 });
    }

    const orderEmail = order.customerEmail || order.email;
    if (!isResourceOwner(orderEmail, currentUserEmail) && !isAdmin) {
      return await secureJsonResponse({ status: 'error', message: 'ไม่มีสิทธิ์อัพโหลดสลิปสำหรับคำสั่งซื้อนี้' }, { status: 403 });
    }

    const orderStatus = (order.status || '').toUpperCase();
    if (orderStatus === 'CANCELLED') {
      return await secureJsonResponse({ status: 'error', message: 'คำสั่งซื้อนี้ถูกยกเลิกแล้ว ไม่สามารถอัปโหลดสลิปได้' }, { status: 400 });
    }
    if (orderStatus === 'EXPIRED') {
      return await secureJsonResponse({ status: 'error', message: 'คำสั่งซื้อนี้หมดเวลาชำระเงินแล้ว ไม่สามารถอัปโหลดสลิปได้' }, { status: 400 });
    }
    if (['PAID', 'COMPLETED', 'SHIPPED', 'READY'].includes(orderStatus)) {
      return await secureJsonResponse({ status: 'error', message: 'คำสั่งซื้อนี้ได้รับการชำระเงินแล้ว' }, { status: 400 });
    }

    const expectedAmount = Number(order.totalAmount ?? order.amount ?? calculateOrderTotal(order.cart || [])) || 0;
    if (expectedAmount <= 0) {
      return await secureJsonResponse({ status: 'error', message: 'ยอดเงินไม่ถูกต้อง กรุณาติดต่อแอดมิน' }, { status: 400 });
    }

    // 1. Verify slip via Slip2Go API Connect
    const slipCheck = await checkSlipWithSlip2Go(base64, expectedAmount, shopConfig, name);
    if (!slipCheck.success || !slipCheck.slipData) {
      const errorCode = slipCheck.code;
      let userMessage = slipCheck.message;
      if (errorCode === 1013 && slipCheck.slipData?.amount) {
        userMessage = `ยอดเงินไม่ตรง! สลิปโอน ${slipCheck.slipData.amount} บาท แต่ต้องชำระ ${expectedAmount} บาท`;
      } else if (errorCode === 1012) {
        userMessage = 'สลิปนี้เคยใช้แล้ว กรุณาโอนเงินใหม่และอัพโหลดสลิปใหม่';
      }

      return await secureJsonResponse({
        status: 'error',
        code: errorCode,
        message: userMessage,
        slipInfo: slipCheck.slipData ? {
          amount: slipCheck.slipData.amount,
          sender: slipCheck.slipData.senderDisplayName,
          transRef: slipCheck.slipData.transRef,
        } : undefined,
      }, { status: 400 });
    }

    const verifiedData = slipCheck.slipData;

    // 2. Require valid transaction reference & check DB for duplicate transRef across other orders
    if (!verifiedData.transRef) {
      return await secureJsonResponse({
        status: 'error',
        code: 1007,
        message: 'ไม่พบรหัสอ้างอิงธุรกรรมในสลิป กรุณาลองใหม่อีกครั้ง',
      }, { status: 400 });
    }

    const existingWithSameTransRef = await db
      .select({ ref: orders.ref, status: orders.status })
      .from(orders)
      .where(
        and(
          ne(orders.ref, ref),
          sql`COALESCE(${orders.slipData}->'slipData'->>'transRef', '') = ${verifiedData.transRef}`,
        ),
      )
      .limit(1);

    if (
      existingWithSameTransRef.length > 0 &&
      !['CANCELLED', 'EXPIRED'].includes((existingWithSameTransRef[0].status || '').toUpperCase())
    ) {
      console.warn(`[payment-verify] DB duplicate transRef ${verifiedData.transRef} blocked for ${ref} (used by ${existingWithSameTransRef[0].ref})`);
      return await secureJsonResponse({
        status: 'error',
        code: 1012,
        message: 'สลิปนี้เคยถูกใช้กับคำสั่งซื้ออื่นแล้ว ไม่สามารถใช้ซ้ำได้',
        slipInfo: { transRef: verifiedData.transRef },
      }, { status: 400 });
    }

    // 3. Enforce exact transfer amount
    if (!Number.isFinite(verifiedData.amount) || Math.abs(verifiedData.amount - expectedAmount) > 0.01) {
      console.warn(`[payment-verify] Amount mismatch for ${ref}: slip=${verifiedData.amount}, expected=${expectedAmount}`);
      return await secureJsonResponse({
        status: 'error',
        code: 1013,
        message: `ยอดเงินไม่ตรง! สลิปโอน ${verifiedData.amount} บาท แต่ต้องชำระ ${expectedAmount} บาท`,
        slipInfo: {
          amount: verifiedData.amount,
          sender: verifiedData.senderDisplayName,
          transRef: verifiedData.transRef,
        },
      }, { status: 400 });
    }

    // 4. Enforce receiver account / PromptPay match
    if (!verifyReceiverMatchesShop(verifiedData, shopConfig)) {
      console.warn(
        `[payment-verify] Receiver mismatch for ${ref}: acct=${verifiedData.receiverAccount} proxy=${verifiedData.receiverProxy} name=${verifiedData.receiverName}`,
      );
      return await secureJsonResponse({
        status: 'error',
        code: 1014,
        message: 'บัญชีผู้รับเงินในสลิปไม่ตรงกับบัญชีของร้านค้า กรุณาตรวจสอบและโอนเข้าบัญชีที่ระบุ',
        slipInfo: {
          amount: verifiedData.amount,
          sender: verifiedData.senderDisplayName,
          transRef: verifiedData.transRef,
        },
      }, { status: 400 });
    }

    const senderFullName = verifiedData.senderName;
    const senderDisplayName = verifiedData.senderDisplayName || senderFullName;
    const senderName = senderFullName || senderDisplayName;

    const sanitizeReceiptField = (value: unknown, max = 200) =>
      String(value ?? '').trim().slice(0, max);
    const wantsFullReceipt = Boolean(
      receiptRequest &&
      (receiptRequest.wanted === true || receiptRequest.wanted === 'true' || receiptRequest.wanted === 1),
    );
    const normalizedReceiptRequest = wantsFullReceipt
      ? {
          wanted: true,
          taxOrStudentId: sanitizeReceiptField(receiptRequest.taxOrStudentId ?? receiptRequest.taxId, 64),
          orgName: sanitizeReceiptField(receiptRequest.orgName, 160),
          address: sanitizeReceiptField(receiptRequest.address, 400),
          requestedAt: new Date().toISOString(),
        }
      : null;

    const slipInfo: Record<string, any> = {
      provider: 'slip2go',
      uploadedAt: new Date().toISOString(),
      mime: mime || 'image/png',
      fileName: name || `SLIP_${ref}.png`,
      verified: true,
      base64,
      slipData: {
        referenceId: verifiedData.referenceId,
        transRef: verifiedData.transRef,
        dateTime: verifiedData.dateTime,
        transDate: verifiedData.transDate,
        transTime: verifiedData.transTime,
        amount: verifiedData.amount,
        senderName,
        senderFullName,
        senderDisplayName,
        senderAccount: verifiedData.senderAccount,
        senderBank: verifiedData.senderBank,
        receiverName: verifiedData.receiverName || verifiedData.receiverDisplayName,
        receiverDisplayName: verifiedData.receiverDisplayName,
        receiverAccount: verifiedData.receiverAccount || verifiedData.receiverProxy,
        receiverBank: verifiedData.receiverBank,
      },
      ...(normalizedReceiptRequest ? { receiptRequest: normalizedReceiptRequest } : {}),
    };

    const updated = {
      ...order,
      status: 'PAID',
      slip: slipInfo,
      slipData: slipInfo,
      verifiedAt: new Date().toISOString(),
      paidAmount: verifiedData.amount || expectedAmount,
    };

    await updateOrderByRef(ref, updated);

    const customerEmail = updated.customerEmail || updated.email;
    if (customerEmail) {
      await updateEmailIndex(customerEmail, updated);
    }

    console.log(`[payment-verify] Order ${ref} marked as PAID via Slip2Go`);

    if (customerEmail) {
      try {
        await sendPaymentReceivedEmail(updated);
      } catch (emailError) {
        console.error('[payment-verify] Failed to send payment email:', emailError);
      }

      const userAgent = req.headers.get('user-agent') || undefined;
      const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
                       req.headers.get('x-real-ip') || undefined;
      await saveUserLogServer({
        email: customerEmail,
        name: updated.customerName,
        action: 'verify_payment',
        details: `ชำระเงินสำเร็จ (Slip2Go): ${ref} (${verifiedData.amount || expectedAmount} บาท)`,
        metadata: {
          provider: 'slip2go',
          ref,
          amount: verifiedData.amount || expectedAmount,
          transRef: verifiedData.transRef,
          senderName: senderDisplayName,
          ...(normalizedReceiptRequest ? { receiptRequest: normalizedReceiptRequest } : {}),
        },
        ip: clientIP,
        userAgent,
      });
    }

    triggerSheetSync().catch(() => {});

    for (const adminEmail of ADMIN_EMAILS) {
      sendPushNotification(adminEmail, {
        title: 'มีการชำระเงินใหม่',
        body: `ออเดอร์ ${ref} ชำระ ${verifiedData.amount || expectedAmount} บาท`,
        icon: '/icon-192.png',
        url: '/admin/orders',
        tag: `payment-${ref}`,
      }).catch(() => {});
    }

    dispatchNotification({
      shopId: updated.shopId,
      type: 'PAYMENT_RECEIVED',
      title: 'Payment Verified (Slip2Go)',
      message: `Ref: ${ref}\nName: ${senderName}\nAmount: ฿${verifiedData.amount || expectedAmount}`,
      url: `/admin/orders?ref=${ref}`,
    }).catch(e => console.error('[payment-verify] Notification error:', e));

    return await secureJsonResponse({
      status: 'success',
      message: 'ชำระเงินสำเร็จ',
      data: {
        ref,
        expectedAmount,
        paidAmount: verifiedData.amount || expectedAmount,
        senderName,
        senderDisplayName,
        transRef: verifiedData.transRef,
      },
    });
  } catch (error: any) {
    console.error('[payment-verify] error', error);
    return await secureJsonResponse({
      status: 'error',
      message: error?.message || 'เกิดข้อผิดพลาดในการตรวจสอบสลิป กรุณาลองใหม่',
    }, { status: 500 });
  }
}
