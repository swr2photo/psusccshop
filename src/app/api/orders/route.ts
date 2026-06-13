import { NextRequest, NextResponse } from 'next/server';
import { getJson, putJson, listKeys, deleteObject, getOrdersByEmail, getAllOrders, getOrderByRef, updateOrderByRef } from '@/lib/filebase';
import { deleteOrderByRef } from '@/lib/order-lookup';
import crypto from 'crypto';
import { requireAuth, requireAdmin, isAdminEmailAsync, isResourceOwner, normalizeEmail as authNormalizeEmail } from '@/lib/auth';
import { triggerSheetSync } from '@/lib/sheet-sync';
import { sanitizeOrderForUser, sanitizeOrdersForUser, sanitizeObjectUtf8, sanitizeUtf8Input } from '@/lib/sanitize';
import { verifyTurnstileToken, getClientIP } from '@/lib/cloudflare';
import { checkCombinedRateLimit, RATE_LIMITS, getRateLimitHeaders } from '@/lib/rate-limit';
import { sendOrderConfirmationEmail } from '@/lib/email';
import { db } from '@/lib/db';
import { shops } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { recordOrderCreated } from '@/lib/sentry-metrics';
import { buildValidatedCart, clampShippingFee } from '@/lib/order-pricing';
import { computePromoDiscount } from '@/lib/promo';

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
    console.warn("[Orders API] Failed to save user log:", e);
  }
}

const orderKey = (ref: string, date: Date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `orders/${yyyy}-${mm}/${ref}.json`;
};

const generateRef = () => `ORD-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;

const normalizeEmail = (email?: string | null) => (email || '').trim().toLowerCase();

const emailIndexKey = (email: string) => {
  const normalized = normalizeEmail(email);
  const hash = crypto.createHash('sha256').update(normalized).digest('hex');
  return `orders/index/${hash}.json`;
};

// Index functions - now handled by Supabase automatically
// These are kept for backward compatibility but don't do anything
const upsertIndexEntry = async (email: string, order: any) => {
  // Supabase automatically maintains indexes via email_hash column
  // No manual index management needed
};

const removeIndexEntry = async (email: string, ref: string) => {
  // Supabase automatically handles this when order is deleted
};

export async function GET(req: NextRequest) {
  // ต้องเข้าสู่ระบบก่อนถึงจะดู orders ได้
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  const currentUserEmail = authResult.email;
  const isAdmin = await isAdminEmailAsync(currentUserEmail);

  const email = req.nextUrl.searchParams.get('email');
  const offsetParam = Number(req.nextUrl.searchParams.get('offset'));
  const offset = Number.isFinite(offsetParam) ? Math.max(0, offsetParam) : 0;
  const limitParam = Number(req.nextUrl.searchParams.get('limit'));
  const limit = Number.isFinite(limitParam) ? Math.min(100, Math.max(10, limitParam)) : 50;
  const shopSlug = req.nextUrl.searchParams.get('shopSlug') || undefined;

  // ถ้าไม่ใช่ admin ต้องดู orders ของตัวเองเท่านั้น
  const queryEmail = isAdmin && email ? email : currentUserEmail;

  try {
    const normalizedEmail = normalizeEmail(queryEmail);
    
    // Use optimized Supabase query (with optional shopSlug filter)
    const { orders, total } = await getOrdersByEmail(normalizedEmail, { limit, offset, shopSlug });
    
    const hasMore = offset + orders.length < total;
    
    // Sanitize: ลบ slip data และ sensitive fields ออกก่อนส่ง
    const sanitizedHistory = sanitizeOrdersForUser(orders);

    return NextResponse.json(
      { status: 'success', data: { history: sanitizedHistory, hasMore, total } },
      { headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Content-Type': 'application/json; charset=utf-8' } }
    );
  } catch (error: any) {
    return NextResponse.json(
      { status: 'error', message: error?.message || 'load failed' },
      { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  }
}

export async function POST(req: NextRequest) {
  const start = Date.now();
  // Rate limiting สำหรับ order submission
  const rateLimitResult = checkCombinedRateLimit(req, RATE_LIMITS.order);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { status: 'error', message: 'คุณส่งคำสั่งซื้อเร็วเกินไป กรุณารอสักครู่' },
      { 
        status: 429, 
        headers: { 
          'Content-Type': 'application/json; charset=utf-8',
          ...getRateLimitHeaders(rateLimitResult),
        } 
      }
    );
  }

  try {
    const body = await req.json();
    
    // ตรวจสอบ Turnstile token (ป้องกันบอท)
    const turnstileToken = body?.turnstileToken;
    const clientIP = getClientIP(req);
    const turnstileResult = await verifyTurnstileToken(turnstileToken, clientIP);
    
    if (!turnstileResult.success) {
      return NextResponse.json(
        { status: 'error', message: turnstileResult.error || 'กรุณายืนยันว่าคุณไม่ใช่บอท' },
        { status: 400, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      );
    }
    
    // Sanitize UTF-8 input ก่อนบันทึก (และลบ turnstileToken ออก)
    const { turnstileToken: _, ...bodyWithoutToken } = body;
    const sanitizedBody = sanitizeObjectUtf8(bodyWithoutToken);
    
    // Validate shop status and product status in database before order creation
    let products: any[] = [];
    let isShopOpen = true;

    if (sanitizedBody.shopId || sanitizedBody.shopSlug) {
      // Multi-shop validation
      const shopResult = await db.select()
        .from(shops)
        .where(
          sanitizedBody.shopId 
            ? eq(shops.id, sanitizedBody.shopId) 
            : eq(shops.slug, sanitizedBody.shopSlug)
        )
        .limit(1);
        
      if (shopResult.length > 0) {
        const s = shopResult[0];
        products = (s.products as any[]) || [];
        const settings = (s.settings as any) || {};
        isShopOpen = settings.isOpen !== false;
      } else {
        return NextResponse.json(
          { status: 'error', message: 'ไม่พบข้อมูลร้านค้า' },
          { status: 404, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
        );
      }
    } else {
      // Main shop validation
      const cfg = await getJson<{ products?: unknown[]; isOpen?: boolean }>('config/shop-settings.json');
      if (cfg) {
        products = (cfg.products as any[]) || [];
        isShopOpen = cfg.isOpen !== false;
      }
    }

    // 1. Validate if shop is open
    if (!isShopOpen) {
      return NextResponse.json(
        { status: 'error', message: 'ร้านค้าปิดให้บริการชั่วคราว ไม่สามารถสั่งซื้อได้' },
        { status: 400, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      );
    }

    // 2. Validate all products in the cart are still open and in stock
    const cartItems = sanitizedBody.cart || [];
    for (const item of cartItems) {
      const prod = products.find(p => p.id === item.productId);
      if (!prod) {
        return NextResponse.json(
          { status: 'error', message: `สินค้า "${item.productName || 'ไม่ระบุชื่อ'}" ไม่มีอยู่ในระบบแล้ว` },
          { status: 400, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
        );
      }
      
      // Check product status (active, start/end dates)
      const nowTime = new Date();
      const isActive = prod.isActive !== false;
      
      // Helper to check if a date string is valid
      const isValidDate = (dateString?: string): boolean => {
        if (!dateString || dateString.trim() === '') return false;
        const date = new Date(dateString);
        return !isNaN(date.getTime());
      };
      
      const start = isValidDate(prod.startDate) ? new Date(prod.startDate) : null;
      const end = isValidDate(prod.endDate) ? new Date(prod.endDate) : null;
      
      const isClosed = !isActive || (start && nowTime < start) || (end && nowTime > end);
      if (isClosed) {
        return NextResponse.json(
          { status: 'error', message: `สินค้า "${item.productName || prod.name}" ปิดการขายแล้ว` },
          { status: 400, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
        );
      }

      // Check stock
      const isOutOfStock = (
        (prod.stock !== null && prod.stock !== undefined && prod.stock <= 0) ||
        (prod.variants && prod.variants.length > 0 && prod.variants.every((v: any) => v.stock !== null && v.stock !== undefined && v.stock <= 0))
      );
      if (isOutOfStock) {
        return NextResponse.json(
          { status: 'error', message: `สินค้า "${item.productName || prod.name}" หมดชั่วคราว` },
          { status: 400, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
        );
      }
    }
    
    let validatedCart: Record<string, unknown>[];
    let subtotal: number;
    try {
      const built = buildValidatedCart(cartItems, products);
      validatedCart = built.cart;
      subtotal = built.subtotal;
    } catch (pricingError: any) {
      return NextResponse.json(
        { status: 'error', message: pricingError?.message || 'ไม่สามารถคำนวณราคาได้' },
        { status: 400, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      );
    }

    const shippingFee = clampShippingFee(sanitizedBody.shippingFee, subtotal);
    const { discount: promoDiscount, code: appliedPromoCode } = await computePromoDiscount({
      code: sanitizedBody.promoCode,
      subtotal,
      shopId: sanitizedBody.shopId,
    });
    const totalAmount = Math.max(0, subtotal + shippingFee - promoDiscount);

    const ref = sanitizedBody?.ref ? String(sanitizedBody.ref) : generateRef();
    const now = new Date();
    const customerEmail = normalizeEmail(sanitizedBody.customerEmail || sanitizedBody.email);
    const order = {
      ref,
      date: now.toISOString(),
      createdAt: now.toISOString(),
      status: 'WAITING_PAYMENT',
      customerEmail,
      customerName: sanitizedBody.customerName || sanitizedBody.name || '',
      customerPhone: sanitizedBody.customerPhone || sanitizedBody.phone || '',
      customerAddress: sanitizedBody.customerAddress || sanitizedBody.address || '',
      customerInstagram: sanitizedBody.customerInstagram || sanitizedBody.instagram || '',
      cart: validatedCart,
      subtotal,
      shippingFee,
      shippingOptionId: sanitizedBody.shippingOptionId,
      paymentOptionId: sanitizedBody.paymentOptionId,
      promoCode: appliedPromoCode,
      promoDiscount,
      discount: promoDiscount,
      totalAmount,
      amount: totalAmount,
      ...(sanitizedBody.shopId ? { shopId: sanitizedBody.shopId } : {}),
      ...(sanitizedBody.shopSlug ? { shopSlug: sanitizedBody.shopSlug } : {}),
    };
    
    const key = orderKey(ref, now);
    await putJson(key, order);
    if (order.customerEmail) {
      await upsertIndexEntry(order.customerEmail, order);
    }
    
    // Send order confirmation email
    if (order.customerEmail) {
      try {
        await sendOrderConfirmationEmail(order);
      } catch (emailError) {
        console.error('[Orders API] Failed to send confirmation email:', emailError);
        // Don't fail the request if email fails
      }
    }
    
    // Log user action
    if (order.customerEmail) {
      const userAgent = req.headers.get('user-agent') || undefined;
      await saveUserLogServer({
        email: order.customerEmail,
        name: order.customerName,
        action: 'place_order',
        details: `สั่งซื้อสินค้า: ${ref}`,
        metadata: { 
          ref, 
          totalAmount: order.totalAmount,
          itemCount: order.cart?.length || 0,
        },
        ip: clientIP,
        userAgent,
      });
    }
    
    // Auto sync to Google Sheets
    triggerSheetSync().catch(() => {});
    recordOrderCreated('success', Date.now() - start);
    return NextResponse.json(
      { status: 'success', ref },
      { headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  } catch (error: any) {
    recordOrderCreated('failed', Date.now() - start);
    return NextResponse.json(
      { status: 'error', message: error?.message || 'submit failed' },
      { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  }
}

export async function PUT(req: NextRequest) {
  // ต้องเข้าสู่ระบบก่อน
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  const currentUserEmail = authResult.email;
  const isAdmin = await isAdminEmailAsync(currentUserEmail);

  try {
    const body = await req.json();
    const ref = sanitizeUtf8Input(body?.ref) as string | undefined;
    const updates = body?.data as Record<string, any> | undefined;
    if (!ref || !updates) {
      return NextResponse.json(
        { status: 'error', message: 'missing ref/data' },
        { status: 400, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      );
    }

    const existing = (await getOrderByRef(ref)) || {};

    if (!existing || !(existing as { ref?: string }).ref) {
      return NextResponse.json(
        { status: 'error', message: 'order not found' },
        { status: 404, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      );
    }

    // ตรวจสอบว่าเป็นเจ้าของ order หรือเป็น admin
    const orderEmail = existing.customerEmail || existing.email;
    if (!isResourceOwner(orderEmail, currentUserEmail) && !isAdmin) {
      return NextResponse.json(
        { status: 'error', message: 'ไม่มีสิทธิ์แก้ไข order นี้' },
        { status: 403, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      );
    }

    // User ปกติแก้ไขได้เฉพาะบางฟิลด์
    const userAllowedFields = ['customerName', 'customerPhone', 'customerAddress', 'name', 'phone', 'address', 'notes'];
    // Admin แก้ไขได้มากกว่า รวมถึง cart items
    const adminAllowedFields = ['customerName', 'customerEmail', 'customerPhone', 'customerAddress', 'name', 'email', 'phone', 'address', 'amount', 'totalAmount', 'status', 'date', 'notes', 'cart'];
    const allowedFields = isAdmin ? adminAllowedFields : userAllowedFields;

    // Sanitize UTF-8 และกรอง fields
    const sanitizedUpdates: Record<string, any> = {};
    Object.entries(updates).forEach(([key, value]) => {
      if (allowedFields.includes(key)) {
        if (key === 'cart' && Array.isArray(value)) {
          // Sanitize cart items
          sanitizedUpdates[key] = value.map((item: any) => sanitizeObjectUtf8(item));
        } else {
          sanitizedUpdates[key] = typeof value === 'string' ? sanitizeUtf8Input(value) : value;
        }
      }
    });
    
    // Recalculate totalAmount if cart was updated
    if (sanitizedUpdates.cart && Array.isArray(sanitizedUpdates.cart)) {
      const cartTotal = sanitizedUpdates.cart.reduce((sum: number, item: any) => {
        const price = Number(item?.unitPrice ?? 0);
        const qty = Number(item?.quantity ?? 1);
        return sum + (price * qty);
      }, 0);
      // Preserve existing shippingFee and promoDiscount from the order
      const shippingFee = Number(existing.shippingFee ?? 0);
      const promoDiscount = Number(existing.promoDiscount ?? existing.discount ?? 0);
      const recalculated = Math.max(0, cartTotal + shippingFee - promoDiscount);
      sanitizedUpdates.subtotal = cartTotal;
      sanitizedUpdates.totalAmount = recalculated;
      sanitizedUpdates.amount = recalculated;
    }

    const next = { ...existing, ...sanitizedUpdates };
    await updateOrderByRef(ref, next);
    if (next.customerEmail) {
      await upsertIndexEntry(next.customerEmail, next);
    }
    // Auto sync to Google Sheets
    triggerSheetSync().catch(() => {});
    
    // Sanitize response - ไม่ส่ง slip data กลับ
    const sanitizedResponse = sanitizeOrderForUser(next);
    
    return NextResponse.json(
      { status: 'success', data: sanitizedResponse },
      { headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  } catch (error: any) {
    return NextResponse.json(
      { status: 'error', message: error?.message || 'update failed' },
      { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  }
}

export async function DELETE(req: NextRequest) {
  // ต้องเข้าสู่ระบบก่อน
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  const currentUserEmail = authResult.email;
  const isAdmin = await isAdminEmailAsync(currentUserEmail);

  const ref = sanitizeUtf8Input(req.nextUrl.searchParams.get('ref') || '');
  const hard = req.nextUrl.searchParams.get('hard') === 'true';
  
  if (!ref) {
    return NextResponse.json(
      { status: 'error', message: 'missing ref' },
      { status: 400, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  }

  // Hard delete ทำได้เฉพาะ admin
  if (hard && !isAdmin) {
    return NextResponse.json(
      { status: 'error', message: 'เฉพาะ admin เท่านั้นที่ลบถาวรได้' },
      { status: 403, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  }

  try {
    const existing = await getOrderByRef(ref);
    if (!existing) {
      return NextResponse.json(
        { status: 'error', message: 'order not found' },
        { status: 404, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      );
    }

    const orderEmail = existing.customerEmail || existing.email;

    // ตรวจสอบสิทธิ์
    if (!isResourceOwner(orderEmail, currentUserEmail) && !isAdmin) {
      return NextResponse.json(
        { status: 'error', message: 'ไม่มีสิทธิ์ลบ order นี้' },
        { status: 403, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      );
    }

    if (hard) {
      if (existing?.customerEmail) {
        await removeIndexEntry(existing.customerEmail, ref);
      }
      await deleteOrderByRef(ref);
      triggerSheetSync().catch(() => {});
      return NextResponse.json(
        { status: 'success', message: 'deleted' },
        { headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      );
    }

    const order = { ...existing, status: 'CANCELLED' };
    await updateOrderByRef(ref, order);
    if (order.customerEmail) {
      await upsertIndexEntry(order.customerEmail, order);
    }
    // Auto sync to Google Sheets
    triggerSheetSync().catch(() => {});
    return NextResponse.json(
      { status: 'success', message: 'cancelled' },
      { headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  } catch (error: any) {
    return NextResponse.json(
      { status: 'error', message: error?.message || 'cancel failed' },
      { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  }
}
