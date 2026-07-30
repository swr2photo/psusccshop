/* eslint-disable */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getJson } from '@/lib/filebase';
import { generatePromptPayPayloadForId, calculateOrderTotal } from '@/lib/payment-utils';
import { requireAuth, isResourceOwner, isAdminEmailAsync } from '@/lib/auth';
import { sanitizeUtf8Input } from '@/lib/sanitize';
import { getShopById } from '@/lib/shops';
import { resolveOrderByRef } from '@/lib/order-lookup';
import { getStripePromptPayEnabled } from '@/lib/payment-server';
import { secureJsonRequest, secureJsonResponse } from '@/lib/payload-crypto';

const maskAccountNumber = (accountNumber: string): string => {
  if (!accountNumber) return '';
  const cleaned = accountNumber.replace(/\D/g, '');
  if (cleaned.length <= 4) return accountNumber;
  const lastFour = cleaned.slice(-4);
  return `${'*'.repeat(cleaned.length - 4)}${lastFour}`;
};

export async function GET(req: NextRequest) {
  // ต้องเข้าสู่ระบบก่อนถึงจะดูข้อมูลการชำระเงินได้
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  const currentUserEmail = authResult.email;
  
  try {
    const ref = req.nextUrl.searchParams.get('ref');
    const sanitizedRef = sanitizeUtf8Input(ref || '');
    
    if (!sanitizedRef) {
      return await secureJsonResponse(
        { status: 'error', message: 'missing ref' },
        { status: 400, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      );
    }

    const order = await resolveOrderByRef(sanitizedRef);
    if (!order) {
      return await secureJsonResponse(
        { status: 'error', message: 'order not found' },
        { status: 404, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      );
    }

    // ตรวจสอบว่าเป็นเจ้าของ order หรือเป็น admin
    const orderEmail = order.customerEmail || order.email;
    if (!isResourceOwner(orderEmail, currentUserEmail) && !(await isAdminEmailAsync(currentUserEmail))) {
      return await secureJsonResponse(
        { status: 'error', message: 'ไม่มีสิทธิ์ดูข้อมูลการชำระเงินของ order นี้' },
        { status: 403, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      );
    }

    // All orders (main + sub-shops) use the same PromptPay / bank account as the main shop
    const bankName = process.env.PAYMENT_BANK || 'พร้อมเพย์ (โอนได้ทุกธนาคาร)';
    const accountName = process.env.PAYMENT_ACCOUNT_NAME || '';
    const accountNumber = process.env.PAYMENT_ACCOUNT || '';
    const effectivePromptPayId = process.env.PROMPTPAY_ID || '';
    const taxId = process.env.PAYMENT_TAX_ID || process.env.TAX_ID || '';

    const orderShopId = order.shopId || order.shop_id;

    // ตรวจสอบสถานะระบบชำระเงิน — ใช้ config ร้านหลักสำหรับทุกออเดอร์
    const CONFIG_KEY = 'config/shop-settings.json';
    const shopConfig = await getJson<any>(CONFIG_KEY);
    const paymentEnabled = shopConfig?.paymentEnabled !== false;
    const paymentDisabledMessage =
      shopConfig?.paymentDisabledMessage || 'ระบบชำระเงินปิดให้บริการชั่วคราว';

    const baseAmount = Number(order.totalAmount ?? order.amount ?? calculateOrderTotal(order.cart || [])) || 0;
    const discount = Number(order.discount ?? 0);
    const finalAmount = Math.max(0, baseAmount - discount);
    // Generate QR payload — main shop PromptPay ID for all orders (client renders with qrcode.react)
    const qrPayload = finalAmount > 0 ? generatePromptPayPayloadForId(effectivePromptPayId, finalAmount) : null;

    // Fetch products list to get coverImage/imageUrl
    let productsList: any[] = [];
    if (orderShopId) {
      const shop = await getShopById(orderShopId);
      if (shop?.products) {
        productsList = shop.products;
      }
    } else if (shopConfig?.products) {
      productsList = shopConfig.products;
    }

    // ดึงข้อมูลสินค้าจาก order และ sanitize
    const cartItems = (order.cart || order.items || []).map((item: any) => {
      const productId = item.productId || item.id?.split('-')?.[0];
      const matchedProduct = productsList.find((p: any) => p.id === productId);
      const coverImage = matchedProduct?.coverImage || matchedProduct?.images?.[0] || '';

      return {
        productName: sanitizeUtf8Input(item.productName || item.name || 'สินค้า'),
        size: sanitizeUtf8Input(item.size || '-'),
        quantity: item.quantity || item.qty || 1,
        unitPrice: item.unitPrice || item.price || 0,
        customName: sanitizeUtf8Input(item.options?.customName || item.customName || ''),
        customNumber: sanitizeUtf8Input(item.options?.customNumber || item.customNumber || ''),
        isLongSleeve: item.options?.isLongSleeve || item.isLongSleeve || false,
        pattern: sanitizeUtf8Input(item.options?.pattern || item.pattern || ''),
        coverImage,
      };
    });

    const responseData = {
      status: 'success',
      data: {
        ref: sanitizedRef,
        bankName,
        accountName,
        // SECURITY: Mask account number - แสดงแค่ 4 ตัวท้าย
        accountNumber: maskAccountNumber(accountNumber),
        promptPayId: effectivePromptPayId,
        taxId: taxId || null,
        baseAmount,
        discount,
        finalAmount,
        qrPayload, // For client-side QR rendering with qrcode.react
        cart: cartItems,
        status: order.status || 'PENDING',
        // วันที่สั่งซื้อ สำหรับ countdown timer
        orderDate: order.date || order.createdAt || null,
        // ไม่ส่ง slip data ให้ frontend - เฉพาะ admin เท่านั้นที่เห็น slip
        hasSlip: !!(order.slip && order.slip.base64),
        // สถานะระบบชำระเงิน
        paymentEnabled,
        paymentDisabledMessage: paymentEnabled ? null : paymentDisabledMessage,
        // Stripe PromptPay (auto-verified QR) — respects admin enablePromptPay toggle
        stripePromptPayEnabled: await getStripePromptPayEnabled(finalAmount),
      },
    };

    return await secureJsonResponse(responseData, {
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  } catch (error: any) /* eslint-disable-line @typescript-eslint/no-explicit-any */ {
    console.error('[payment-info] error', error);
    return await secureJsonResponse({
      status: 'error',
      message: error?.message || 'load failed',
    }, { 
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }
}
