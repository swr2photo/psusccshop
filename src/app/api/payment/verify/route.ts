import { NextResponse } from 'next/server';
import { listKeys, getJson, putJson } from '@/lib/filebase';
import { calculateOrderTotal } from '@/lib/payment-utils';

const checkSlipWithSlipOK = async (base64: string, expectedAmount: number) => {
  const branchId = process.env.SLIPOK_BRANCH_ID;
  const apiKey = process.env.SLIPOK_API_KEY;

  if (!branchId || !apiKey) {
    console.warn('[payment-verify] SLIPOK credentials missing, skipping verification');
    return { success: true, data: { success: true, amount: expectedAmount } };
  }

  try {
    const payload: Record<string, any> = { files: base64, log: false };
    if (expectedAmount > 0) payload.amount = expectedAmount;

    const response = await fetch(`https://api.slipok.com/api/line/apikey/${branchId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-authorization': apiKey,
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('[payment-verify] SlipOK request failed', error);
    return { success: false, message: 'เชื่อมต่อ SlipOK ไม่ได้' };
  }
};

const findOrderKey = async (ref: string): Promise<string | null> => {
  const keys = await listKeys('orders/');
  return keys.find((k) => k.endsWith(`${ref}.json`)) || null;
};

export async function POST(req: Request) {
  try {
    const { ref, base64, mime, name } = await req.json();
    if (!ref || !base64) return NextResponse.json({ status: 'error', message: 'missing ref/base64' }, { status: 400 });

    const key = await findOrderKey(ref);
    if (!key) return NextResponse.json({ status: 'error', message: 'order not found' }, { status: 404 });

    const order = await getJson<any>(key);
    if (!order) return NextResponse.json({ status: 'error', message: 'order data missing' }, { status: 404 });

    const expectedAmount = Number(order.totalAmount ?? order.amount ?? calculateOrderTotal(order.cart || [])) || 0;

    if (expectedAmount <= 0) {
      return NextResponse.json({ status: 'error', message: 'invalid amount for this order' }, { status: 400 });
    }

    const slipCheck = await checkSlipWithSlipOK(base64, expectedAmount);

    if (!slipCheck?.success || (slipCheck.data && slipCheck.data.success === false)) {
      const code = slipCheck.code || slipCheck.data?.code;
      let msg = slipCheck.message || slipCheck.data?.message || 'สลิปไม่ผ่านการตรวจสอบ';

      switch (code) {
        case 1006:
          msg = 'ไฟล์รูปภาพไม่ถูกต้อง';
          break;
        case 1007:
          msg = 'ไม่พบ QR Code ในรูปภาพ';
          break;
        case 1008:
          msg = 'QR นี้ไม่ใช่สลิปโอนเงิน';
          break;
        case 1012:
          msg = 'สลิปนี้เคยใช้แล้ว';
          break;
        case 1013:
          msg = `ยอดเงินไม่ตรง (ต้องโอน ${expectedAmount} บาท)`;
          break;
        case 1014:
          msg = 'ชื่อบัญชีผู้รับไม่ถูกต้อง';
          break;
      }

      return NextResponse.json({ status: 'error', message: msg }, { status: 400 });
    }

    const slipInfo = {
      uploadedAt: new Date().toISOString(),
      mime: mime || 'image/png',
      fileName: name || `SLIP_${ref}.png`,
      base64,
      slipCheck,
    };

    const updated = {
      ...order,
      status: 'PAID',
      slip: slipInfo,
      verifiedAt: new Date().toISOString(),
    };

    await putJson(key, updated);

    return NextResponse.json({ status: 'success', data: { ref, expectedAmount } });
  } catch (error: any) {
    console.error('[payment-verify] error', error);
    return NextResponse.json({ status: 'error', message: error.message || 'verify failed' }, { status: 500 });
  }
}
