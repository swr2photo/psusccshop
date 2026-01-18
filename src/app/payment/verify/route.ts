import { NextRequest, NextResponse } from 'next/server';
import { listKeys, getJson, putJson } from '@/lib/filebase';
import { calculateOrderTotal } from '@/lib/payment-utils';
import { requireAuth, isResourceOwner, isAdminEmail } from '@/lib/auth';
import { sanitizeUtf8Input } from '@/lib/sanitize';
import { checkCombinedRateLimit, RATE_LIMITS, getRateLimitHeaders } from '@/lib/rate-limit';

const findOrderKey = async (ref: string): Promise<string | null> => {
  const keys = await listKeys('orders/');
  return keys.find((k) => k.endsWith(`${ref}.json`)) || null;
};

export async function POST(req: NextRequest) {
  // Rate limiting สำหรับ payment verification
  const rateLimitResult = checkCombinedRateLimit(req, RATE_LIMITS.payment);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { status: 'error', message: 'คุณส่งคำขอเร็วเกินไป กรุณารอสักครู่' },
      { 
        status: 429, 
        headers: { 
          'Content-Type': 'application/json; charset=utf-8',
          ...getRateLimitHeaders(rateLimitResult),
        } 
      }
    );
  }

  // ต้องเข้าสู่ระบบก่อนถึงจะ verify payment ได้
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  const currentUserEmail = authResult.email;
  
  try {
    const { ref, base64, mime, name } = await req.json();
    
    // Sanitize inputs
    const sanitizedRef = sanitizeUtf8Input(ref);
    const sanitizedName = sanitizeUtf8Input(name);
    
    if (!sanitizedRef || !base64) {
      return NextResponse.json(
        { status: 'error', message: 'missing ref/base64' },
        { status: 400, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      );
    }

    const key = await findOrderKey(sanitizedRef);
    if (!key) {
      return NextResponse.json(
        { status: 'error', message: 'order not found' },
        { status: 404, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      );
    }

    const order = await getJson<any>(key);
    if (!order) {
      return NextResponse.json(
        { status: 'error', message: 'order data missing' },
        { status: 404, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      );
    }

    // ตรวจสอบว่าเป็นเจ้าของ order หรือเป็น admin
    const orderEmail = order.customerEmail || order.email;
    if (!isResourceOwner(orderEmail, currentUserEmail) && !isAdminEmail(currentUserEmail)) {
      return NextResponse.json(
        { status: 'error', message: 'ไม่มีสิทธิ์อัปโหลดสลิปสำหรับ order นี้' },
        { status: 403, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      );
    }

    const expectedAmount = Number(order.totalAmount ?? order.amount ?? calculateOrderTotal(order.cart || [])) || 0;

    // Minimal verification: ensure there is some amount expected
    if (expectedAmount <= 0) {
      return NextResponse.json(
        { status: 'error', message: 'invalid amount for this order' },
        { status: 400, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      );
    }

    // Validate base64 format
    const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
    if (!/^[A-Za-z0-9+/=]+$/.test(base64Data)) {
      return NextResponse.json(
        { status: 'error', message: 'Invalid base64 data' },
        { status: 400, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      );
    }

    // Store slip metadata directly in the order record
    const slipInfo = {
      uploadedAt: new Date().toISOString(),
      mime: mime || 'image/png',
      fileName: sanitizedName || `SLIP_${sanitizedRef}.png`,
      base64,
      uploadedBy: currentUserEmail,
    };

    const updated = {
      ...order,
      status: 'PAID',
      slip: slipInfo,
      verifiedAt: new Date().toISOString(),
    };

    await putJson(key, updated);

    return NextResponse.json(
      { status: 'success', data: { ref: sanitizedRef, expectedAmount } },
      { headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );

  } catch (error: any) {
    console.error('[payment-verify] error', error);
    return NextResponse.json(
      { status: 'error', message: error.message || 'verify failed' },
      { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  }
}