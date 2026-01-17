import { NextRequest, NextResponse } from 'next/server';
import { listKeys, getJson } from '@/lib/filebase';
import { generatePromptPayQR, calculateOrderTotal } from '@/lib/payment-utils';

const findOrderKey = async (ref: string): Promise<string | null> => {
  const keys = await listKeys('orders/');
  return keys.find((k) => k.endsWith(`${ref}.json`)) || null;
};

export async function GET(req: NextRequest) {
  try {
    const ref = req.nextUrl.searchParams.get('ref');
    if (!ref) return NextResponse.json({ status: 'error', message: 'missing ref' }, { status: 400 });

    const key = await findOrderKey(ref);
    if (!key) return NextResponse.json({ status: 'error', message: 'order not found' }, { status: 404 });

    const order = await getJson<any>(key);
    if (!order) return NextResponse.json({ status: 'error', message: 'order data missing' }, { status: 404 });

    const bankName = process.env.PAYMENT_BANK || 'SCB';
    const accountName = process.env.PAYMENT_ACCOUNT_NAME || 'PSUSCCSHOP';
    const accountNumber = process.env.PAYMENT_ACCOUNT || '000-000000-0';

    const baseAmount = Number(order.totalAmount ?? order.amount ?? calculateOrderTotal(order.cart || [])) || 0;
    const discount = Number(order.discount ?? 0);
    const finalAmount = Math.max(0, baseAmount - discount);
    const qrUrl = finalAmount > 0 ? generatePromptPayQR(finalAmount) : null;

    // ดึงข้อมูลสินค้าจาก order
    const cartItems = (order.cart || order.items || []).map((item: any) => ({
      productName: item.productName || item.name || 'สินค้า',
      size: item.size || '-',
      quantity: item.quantity || item.qty || 1,
      unitPrice: item.unitPrice || item.price || 0,
      customName: item.options?.customName || item.customName || '',
      customNumber: item.options?.customNumber || item.customNumber || '',
      isLongSleeve: item.options?.isLongSleeve || item.isLongSleeve || false,
    }));

    return NextResponse.json({
      status: 'success',
      data: {
        ref,
        bankName,
        accountName,
        accountNumber,
        baseAmount,
        discount,
        finalAmount,
        qrUrl,
        cart: cartItems,
        status: order.status || 'PENDING',
      },
    });
  } catch (error: any) {
    console.error('[payment-info] error', error);
    return NextResponse.json({
      status: 'error',
      message: error?.message || 'load failed',
      error: typeof error === 'object' ? error : { detail: String(error) },
    }, { status: 500 });
  }
}
