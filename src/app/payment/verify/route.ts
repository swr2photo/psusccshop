import { NextResponse } from 'next/server';
import { listKeys, getJson, putJson } from '@/lib/filebase';
import { calculateOrderTotal } from '@/lib/payment-utils';

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

    // Minimal verification: ensure there is some amount expected
    if (expectedAmount <= 0) {
      return NextResponse.json({ status: 'error', message: 'invalid amount for this order' }, { status: 400 });
    }

    // Store slip metadata directly in the order record
    const slipInfo = {
      uploadedAt: new Date().toISOString(),
      mime: mime || 'image/png',
      fileName: name || `SLIP_${ref}.png`,
      base64,
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