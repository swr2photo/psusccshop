import { NextRequest, NextResponse } from 'next/server';
import { listKeys, getJson } from '@/lib/filebase';
import { generatePromptPayPayload, generatePromptPayPayloadForId, generatePromptPayQR, calculateOrderTotal } from '@/lib/payment-utils';
import { requireAuth, isResourceOwner, isAdminEmail } from '@/lib/auth';
import { maskPhone } from '@/lib/sanitize';
import { getShopById } from '@/lib/shops';

// Mask account number - แสดงแค่ 4 ตัวท้าย
const maskAccountNumber = (accountNumber: string): string => {
  if (!accountNumber) return '';
  const cleaned = accountNumber.replace(/\D/g, '');
  if (cleaned.length <= 4) return accountNumber;
  const lastFour = cleaned.slice(-4);
  return `${'*'.repeat(cleaned.length - 4)}${lastFour}`;
};
import { sanitizeUtf8Input, sanitizeObjectUtf8 } from '@/lib/sanitize';

const findOrderKey = async (ref: string): Promise<string | null> => {
  const keys = await listKeys('orders/');
  return keys.find((k) => k.endsWith(`${ref}.json`)) || null;
};

export async function GET(req: NextRequest) {
  // ต้องเข้าสู่ระบบก่อนถึงจะดูข้อมูลการชำระเงินได้
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  const currentUserEmail = authResult.email;
  
  try {
    const ref = req.nextUrl.searchParams.get('ref');
    const sanitizedRef = sanitizeUtf8Input(ref || '');
    
    if (!sanitizedRef) {
      return NextResponse.json(
        { status: 'error', message: 'missing ref' },
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
        { status: 'error', message: 'ไม่มีสิทธิ์ดูข้อมูลการชำระเงินของ order นี้' },
        { status: 403, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      );
    }

    const bankName = process.env.PAYMENT_BANK || 'พร้อมเพย์ (โอนได้ทุกธนาคาร)';
    const accountName = process.env.PAYMENT_ACCOUNT_NAME || '';
    const accountNumber = process.env.PAYMENT_ACCOUNT || '';

    // Check if order belongs to a shop — use shop-specific payment info
    const orderShopId = order.shopId || order.shop_id;
    let shopPaymentInfo: { bankName: string; accountName: string; accountNumber: string; promptPayId: string } | null = null;
    if (orderShopId) {
      const shop = await getShopById(orderShopId);
      if (shop?.paymentInfo) {
        const pi = shop.paymentInfo;
        if (pi.promptPayId || pi.bankName) {
          shopPaymentInfo = {
            bankName: pi.bankName || bankName,
            accountName: pi.accountName || accountName,
            accountNumber: pi.accountNumber || accountNumber,
            promptPayId: pi.promptPayId || process.env.PROMPTPAY_ID || '',
          };
        }
      }
    }

    const effectiveBankName = shopPaymentInfo?.bankName || bankName;
    const effectiveAccountName = shopPaymentInfo?.accountName || accountName;
    const effectiveAccountNumber = shopPaymentInfo?.accountNumber || accountNumber;
    const effectivePromptPayId = shopPaymentInfo?.promptPayId || process.env.PROMPTPAY_ID || '';

    // ตรวจสอบสถานะระบบชำระเงิน
    // For shop orders, check shop-specific settings first; fallback to global
    let paymentEnabled = true;
    let paymentDisabledMessage = 'ระบบชำระเงินปิดให้บริการชั่วคราว';
    if (orderShopId) {
      // Use shop-specific payment settings if available
      const shopData = await getShopById(orderShopId);
      if (shopData?.settings && typeof shopData.settings.paymentEnabled === 'boolean') {
        paymentEnabled = shopData.settings.paymentEnabled;
        paymentDisabledMessage = shopData.settings.paymentDisabledMessage || paymentDisabledMessage;
      }
    } else {
      // Global payment config for main shop
      const CONFIG_KEY = 'config/shop-settings.json';
      const shopConfig = await getJson<any>(CONFIG_KEY);
      paymentEnabled = shopConfig?.paymentEnabled !== false;
      paymentDisabledMessage = shopConfig?.paymentDisabledMessage || paymentDisabledMessage;
    }

    const baseAmount = Number(order.totalAmount ?? order.amount ?? calculateOrderTotal(order.cart || [])) || 0;
    const discount = Number(order.discount ?? 0);
    const finalAmount = Math.max(0, baseAmount - discount);
    // Generate QR payload — use shop-specific PromptPay ID if available
    const qrPayload = finalAmount > 0 ? generatePromptPayPayloadForId(effectivePromptPayId, finalAmount) : null;
    const qrUrl = finalAmount > 0 && qrPayload ? `https://quickchart.io/qr?size=300&text=${encodeURIComponent(qrPayload)}` : null;

    // ดึงข้อมูลสินค้าจาก order และ sanitize
    const cartItems = (order.cart || order.items || []).map((item: any) => ({
      productName: sanitizeUtf8Input(item.productName || item.name || 'สินค้า'),
      size: sanitizeUtf8Input(item.size || '-'),
      quantity: item.quantity || item.qty || 1,
      unitPrice: item.unitPrice || item.price || 0,
      customName: sanitizeUtf8Input(item.options?.customName || item.customName || ''),
      customNumber: sanitizeUtf8Input(item.options?.customNumber || item.customNumber || ''),
      isLongSleeve: item.options?.isLongSleeve || item.isLongSleeve || false,
    }));

    const responseData = {
      status: 'success',
      data: {
        ref: sanitizedRef,
        bankName: effectiveBankName,
        accountName: effectiveAccountName,
        // SECURITY: Mask account number - แสดงแค่ 4 ตัวท้าย
        accountNumber: maskAccountNumber(effectiveAccountNumber),
        baseAmount,
        discount,
        finalAmount,
        qrPayload, // For client-side QR rendering with qrcode.react
        qrUrl,     // Legacy URL fallback
        cart: cartItems,
        status: order.status || 'PENDING',
        // วันที่สั่งซื้อ สำหรับ countdown timer
        orderDate: order.date || order.createdAt || null,
        // ไม่ส่ง slip data ให้ frontend - เฉพาะ admin เท่านั้นที่เห็น slip
        hasSlip: !!(order.slip && order.slip.base64),
        // สถานะระบบชำระเงิน
        paymentEnabled,
        paymentDisabledMessage: paymentEnabled ? null : paymentDisabledMessage,
      },
    };

    return NextResponse.json(responseData, {
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  } catch (error: any) {
    console.error('[payment-info] error', error);
    return NextResponse.json({
      status: 'error',
      message: error?.message || 'load failed',
    }, { 
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }
}
