import { NextRequest, NextResponse } from 'next/server';
import { listKeys, getJson, putJson } from '@/lib/filebase';
import { calculateOrderTotal } from '@/lib/payment-utils';
import { requireAuth, isResourceOwner, isAdminEmail } from '@/lib/auth';
import { triggerSheetSync } from '@/lib/sheet-sync';
import { sendPaymentReceivedEmail } from '@/lib/email';
import crypto from 'crypto';

// ============== EMAIL INDEX HELPER ==============

const normalizeEmail = (email?: string | null) => (email || '').trim().toLowerCase();

const emailIndexKey = (email: string) => {
  const normalized = normalizeEmail(email);
  const hash = crypto.createHash('sha256').update(normalized).digest('hex');
  return `orders/index/${hash}.json`;
};

/**
 * อัปเดต index ของ email เมื่อ order มีการเปลี่ยนแปลง
 */
const updateEmailIndex = async (email: string, updatedOrder: any) => {
  const normalized = normalizeEmail(email);
  if (!normalized) return;

  const key = emailIndexKey(normalized);
  try {
    const existing = (await getJson<any[]>(key)) || [];
    // หา order ที่มี ref ตรงกันและอัปเดต
    const orderRef = updatedOrder.ref;
    const idx = existing.findIndex((o) => o?.ref === orderRef);

    if (idx >= 0) {
      // อัปเดต order ที่มีอยู่แล้ว
      existing[idx] = { ...existing[idx], ...updatedOrder };
    } else {
      // เพิ่ม order ใหม่ที่หัว
      existing.unshift(updatedOrder);
    }

    // จำกัดไว้ที่ 500 รายการ
    const trimmed = existing.slice(0, 500);
    await putJson(key, trimmed);
    console.log(`[payment-verify] Index updated for ${normalized}, order ${orderRef}`);
  } catch (error) {
    console.error(`[payment-verify] Failed to update index for ${normalized}`, error);
    // ไม่ throw เพื่อให้ payment ยังสำเร็จ
  }
};

// ============== SLIPOK TYPES ==============

interface SlipOKResponse {
  success?: boolean;
  code?: number;
  message?: string;
  data?: {
    success: boolean;
    message: string;
    transRef: string;
    transDate: string;
    transTime: string;
    sender: {
      displayName: string;
      name: string;
      proxy: { type: string | null; value: string | null };
      account: { type: string; value: string };
    };
    receiver: {
      displayName: string;
      name: string;
      proxy: { type: string; value: string };
      account: { type: string; value: string };
    };
    amount: number;
    sendingBank: string;
    receivingBank: string;
  };
}

interface SlipVerifyResult {
  success: boolean;
  verified: boolean;
  message: string;
  code?: number;
  slipData?: SlipOKResponse['data'];
}

// ============== ERROR CODE MESSAGES ==============

const SLIPOK_ERROR_MESSAGES: Record<number, string> = {
  1000: 'กรุณาอัพโหลดรูปสลิปที่มี QR Code',
  1002: 'API Key ไม่ถูกต้อง',
  1006: 'ไฟล์รูปภาพไม่ถูกต้อง กรุณาอัพโหลดใหม่',
  1007: 'ไม่พบ QR Code ในรูปภาพ หรือสลิปหมดอายุ',
  1008: 'QR นี้ไม่ใช่สลิปโอนเงิน กรุณาอัพโหลดสลิปจริง',
  1010: 'กรุณารอสักครู่แล้วลองใหม่ (ธนาคารกำลังประมวลผล)',
  1012: 'สลิปนี้เคยใช้แล้ว ไม่สามารถใช้ซ้ำได้',
  1013: 'ยอดเงินในสลิปไม่ตรงกับยอดที่ต้องชำระ',
  1014: 'บัญชีผู้รับไม่ตรงกับบัญชีร้านค้า',
};

// ============== SLIPOK VERIFICATION ==============

const checkSlipWithSlipOK = async (
  base64: string,
  expectedAmount: number
): Promise<SlipVerifyResult> => {
  const branchId = process.env.SLIPOK_BRANCH_ID;
  const apiKey = process.env.SLIPOK_API_KEY;

  // ถ้าไม่มี credentials ให้ข้าม verification (dev mode)
  if (!branchId || !apiKey) {
    console.warn('[payment-verify] SLIPOK credentials missing, skipping verification');
    return {
      success: true,
      verified: false,
      message: 'ข้ามการตรวจสอบ (dev mode)',
    };
  }

  try {
    // เปิด log: true เพื่อเช็คสลิปซ้ำและบัญชีผู้รับ
    const payload: Record<string, any> = {
      files: base64,
      log: true, // ✅ เปิดเพื่อเช็คสลิปซ้ำ + บัญชีผู้รับ
    };

    // เพิ่มยอดเงินเพื่อเช็คความถูกต้อง
    if (expectedAmount > 0) {
      payload.amount = expectedAmount;
    }

    console.log(`[payment-verify] Checking slip with SlipOK, amount: ${expectedAmount}`);

    const response = await fetch(`https://api.slipok.com/api/line/apikey/${branchId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-authorization': apiKey,
      },
      body: JSON.stringify(payload),
    });

    const result: SlipOKResponse = await response.json();

    // ✅ Success case
    if (response.ok && result.success && result.data?.success) {
      const slipAmount = result.data.amount;
      const senderName = result.data.sender?.displayName || result.data.sender?.name || 'ไม่ทราบ';
      const receiverName = result.data.receiver?.displayName || result.data.receiver?.name || 'ไม่ทราบ';

      console.log(`[payment-verify] ✅ Slip verified: ${slipAmount} THB from ${senderName} to ${receiverName}`);

      return {
        success: true,
        verified: true,
        message: 'สลิปถูกต้อง',
        slipData: result.data,
      };
    }

    // ❌ Error case - get error code
    const errorCode = result.code || 0;
    const errorMessage = SLIPOK_ERROR_MESSAGES[errorCode] || result.message || 'สลิปไม่ผ่านการตรวจสอบ';

    // Special handling for specific error codes
    if (errorCode === 1012) {
      console.warn(`[payment-verify] ⚠️ Duplicate slip detected!`);
    } else if (errorCode === 1013) {
      const actualAmount = result.data?.amount;
      console.warn(`[payment-verify] ⚠️ Amount mismatch: expected ${expectedAmount}, got ${actualAmount}`);
    } else if (errorCode === 1014) {
      console.warn(`[payment-verify] ⚠️ Wrong receiver account!`);
    }

    console.log(`[payment-verify] ❌ Slip rejected: code=${errorCode}, message=${errorMessage}`);

    return {
      success: false,
      verified: false,
      message: errorMessage,
      code: errorCode,
      slipData: result.data, // ยังส่ง slip data กลับเพื่อ debug (แม้ error)
    };
  } catch (error) {
    console.error('[payment-verify] SlipOK request failed', error);
    return {
      success: false,
      verified: false,
      message: 'ไม่สามารถเชื่อมต่อระบบตรวจสอบสลิปได้ กรุณาลองใหม่',
    };
  }
};

const findOrderKey = async (ref: string): Promise<string | null> => {
  const keys = await listKeys('orders/');
  return keys.find((k) => k.endsWith(`${ref}.json`)) || null;
};

const CONFIG_KEY = 'config/shop-settings.json';

export async function POST(req: NextRequest) {
  // ต้องเข้าสู่ระบบก่อน
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  const currentUserEmail = authResult.email;
  const isAdmin = isAdminEmail(currentUserEmail);

  try {
    // ตรวจสอบว่าระบบชำระเงินเปิดอยู่หรือไม่ (admin ข้ามได้)
    if (!isAdmin) {
      const config = await getJson<any>(CONFIG_KEY);
      if (config && config.paymentEnabled === false) {
        const message = config.paymentDisabledMessage || 'ระบบชำระเงินปิดให้บริการชั่วคราว กรุณารอการแจ้งเปิดจากแอดมิน';
        return NextResponse.json(
          { status: 'error', message, code: 'PAYMENT_DISABLED' },
          { status: 503, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
        );
      }
    }

    const { ref, base64, mime, name } = await req.json();
    if (!ref || !base64) {
      return NextResponse.json({ status: 'error', message: 'กรุณาอัพโหลดสลิปและระบุหมายเลขคำสั่งซื้อ' }, { status: 400 });
    }

    const key = await findOrderKey(ref);
    if (!key) {
      return NextResponse.json({ status: 'error', message: 'ไม่พบคำสั่งซื้อนี้ในระบบ' }, { status: 404 });
    }

    const order = await getJson<any>(key);
    if (!order) {
      return NextResponse.json({ status: 'error', message: 'ข้อมูลคำสั่งซื้อไม่ถูกต้อง' }, { status: 404 });
    }

    // ตรวจสอบว่าเป็นเจ้าของ order หรือเป็น admin
    const orderEmail = order.customerEmail || order.email;
    if (!isResourceOwner(orderEmail, currentUserEmail) && !isAdmin) {
      return NextResponse.json({ status: 'error', message: 'ไม่มีสิทธิ์อัพโหลดสลิปสำหรับคำสั่งซื้อนี้' }, { status: 403 });
    }

    // ตรวจสอบสถานะ order
    const orderStatus = (order.status || '').toUpperCase();
    if (['PAID', 'COMPLETED', 'SHIPPED', 'READY'].includes(orderStatus)) {
      return NextResponse.json({ status: 'error', message: 'คำสั่งซื้อนี้ได้รับการชำระเงินแล้ว' }, { status: 400 });
    }

    // คำนวณยอดเงินที่ต้องชำระ
    const expectedAmount = Number(order.totalAmount ?? order.amount ?? calculateOrderTotal(order.cart || [])) || 0;

    if (expectedAmount <= 0) {
      return NextResponse.json({ status: 'error', message: 'ยอดเงินไม่ถูกต้อง กรุณาติดต่อแอดมิน' }, { status: 400 });
    }

    // ✅ เรียก SlipOK API พร้อมเช็คสลิปซ้ำ + ยอดเงิน + บัญชีผู้รับ
    const slipCheck = await checkSlipWithSlipOK(base64, expectedAmount);

    // ❌ ถ้าสลิปไม่ผ่าน
    if (!slipCheck.success) {
      const errorCode = slipCheck.code;
      let userMessage = slipCheck.message;

      // เพิ่มรายละเอียดสำหรับบาง error
      if (errorCode === 1013 && slipCheck.slipData?.amount) {
        userMessage = `ยอดเงินไม่ตรง! สลิปโอน ${slipCheck.slipData.amount} บาท แต่ต้องชำระ ${expectedAmount} บาท`;
      } else if (errorCode === 1012) {
        userMessage = 'สลิปนี้เคยใช้แล้ว กรุณาโอนเงินใหม่และอัพโหลดสลิปใหม่';
      }

      return NextResponse.json({
        status: 'error',
        code: errorCode,
        message: userMessage,
        // ส่งข้อมูลสลิปกลับเพื่อ debug (เฉพาะบาง fields)
        slipInfo: slipCheck.slipData ? {
          amount: slipCheck.slipData.amount,
          sender: slipCheck.slipData.sender?.displayName,
          transRef: slipCheck.slipData.transRef,
        } : undefined,
      }, { status: 400 });
    }

    // ✅ สลิปผ่าน - บันทึกข้อมูล
    const slipInfo = {
      uploadedAt: new Date().toISOString(),
      mime: mime || 'image/png',
      fileName: name || `SLIP_${ref}.png`,
      base64,
      verified: slipCheck.verified,
      // เก็บข้อมูลจาก SlipOK
      slipData: slipCheck.slipData ? {
        transRef: slipCheck.slipData.transRef,
        transDate: slipCheck.slipData.transDate,
        transTime: slipCheck.slipData.transTime,
        amount: slipCheck.slipData.amount,
        senderName: slipCheck.slipData.sender?.displayName || slipCheck.slipData.sender?.name,
        senderAccount: slipCheck.slipData.sender?.account?.value,
        senderBank: slipCheck.slipData.sendingBank,
        receiverName: slipCheck.slipData.receiver?.displayName || slipCheck.slipData.receiver?.name,
        receiverAccount: slipCheck.slipData.receiver?.account?.value,
        receiverBank: slipCheck.slipData.receivingBank,
      } : null,
    };

    const updated = {
      ...order,
      status: 'PAID',
      slip: slipInfo,
      verifiedAt: new Date().toISOString(),
      paidAmount: slipCheck.slipData?.amount || expectedAmount,
    };

    // ✅ บันทึก order ที่อัปเดตแล้ว
    await putJson(key, updated);

    // ✅ อัปเดต index สำหรับ user เพื่อให้ history เห็นสถานะใหม่ทันที
    const customerEmail = updated.customerEmail || updated.email;
    if (customerEmail) {
      await updateEmailIndex(customerEmail, updated);
    }

    console.log(`[payment-verify] ✅ Order ${ref} marked as PAID and index updated`);

    // ✅ Send payment received email
    if (customerEmail) {
      try {
        await sendPaymentReceivedEmail(updated);
      } catch (emailError) {
        console.error('[payment-verify] Failed to send payment email:', emailError);
        // Don't fail if email fails
      }
    }

    // ✅ Auto sync to Google Sheets
    triggerSheetSync().catch(() => {});

    // ส่งข้อมูลกลับ
    return NextResponse.json({
      status: 'success',
      message: 'ชำระเงินสำเร็จ',
      data: {
        ref,
        expectedAmount,
        paidAmount: slipCheck.slipData?.amount || expectedAmount,
        senderName: slipCheck.slipData?.sender?.displayName,
        transRef: slipCheck.slipData?.transRef,
      },
    });
  } catch (error: any) {
    console.error('[payment-verify] error', error);
    return NextResponse.json({
      status: 'error',
      message: error?.message || 'เกิดข้อผิดพลาดในการตรวจสอบสลิป กรุณาลองใหม่',
    }, { status: 500 });
  }
}
