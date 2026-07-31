/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getJson, putJson, getOrdersByEmail, getOrderByRef, updateOrderByRef } from '@/lib/filebase';
import { deleteOrderByRef } from '@/lib/order-lookup';
import crypto from 'crypto';
import { requireAuth, isAdminEmailAsync, isResourceOwner, normalizeEmail as authNormalizeEmail } from '@/lib/auth';
import { triggerSheetSync } from '@/lib/sheet-sync';
import { sanitizeOrderForUser, sanitizeOrdersForUser, sanitizeObjectUtf8, sanitizeUtf8Input } from '@/lib/sanitize';
import { verifyTurnstileToken, getClientIP } from '@/lib/cloudflare-server';
import { checkCombinedRateLimitAsync, RATE_LIMITS, getRateLimitHeaders } from '@/lib/rate-limit';
import { sendOrderConfirmationEmail } from '@/lib/email';
import { db } from '@/lib/db';
import { shops, config } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { recordOrderCreated } from '@/lib/sentry-metrics';
import { buildValidatedCart, clampShippingFee } from '@/lib/order-pricing';
import { computePromoDiscount } from '@/lib/promo';
import { dispatchNotification } from '@/lib/notifications';
import { isValidTransition, dispatchWebhook, OrderStatus } from '@/lib/order-state-machine';
import { secureJsonRequest, secureJsonResponse } from '@/lib/payload-crypto';
import { getQStashClient } from '@/lib/qstash';
import { deductStockAtomic, restoreStockAtomic } from '@/lib/stock';
import { getRedisClient } from '@/lib/redis';
import { isProductCurrentlyOpen, isProductOutOfStock } from '@/lib/shop-constants';

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
const upsertIndexEntry = async (_email: string, _order: unknown) => {
  // Supabase automatically maintains indexes via email_hash column
  // No manual index management needed
};

const removeIndexEntry = async (_email: string, _ref: string) => {
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

    return await secureJsonResponse(
      { status: 'success', data: { history: sanitizedHistory, hasMore, total } },
      { headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Content-Type': 'application/json; charset=utf-8' } }
    );
  } catch (error: any) /* eslint-disable-line @typescript-eslint/no-explicit-any */ {
    console.error('[Orders API] GET failed:', error?.message || error);
    // Never mask failures as empty history — clients would wipe a previously loaded list
    return await secureJsonResponse(
      { status: 'error', message: 'Failed to load orders', data: { history: null } },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Content-Type': 'application/json; charset=utf-8',
        },
      },
    );
  }
}

const isValidDate = (dateString?: string): boolean => {
  if (!dateString || dateString.trim() === '') return false;
  try {
    const date = parseThailandDate(dateString, false);
    return !isNaN(date.getTime());
  } catch {
    return false;
  }
};

// Helper to parse date string in Thailand timezone (GMT+7)
const parseThailandDate = (dateString: string, isEnd: boolean): Date => {
  if (!dateString) return new Date();
  const trimmed = dateString.trim();
  if (trimmed.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(trimmed)) {
    return new Date(trimmed);
  }
  let normalized = trimmed.replace(' ', 'T');
  const hasTime = normalized.includes('T');
  if (!hasTime) {
    if (isEnd) {
      normalized += 'T23:59:59.999+07:00';
    } else {
      normalized += 'T00:00:00.000+07:00';
    }
  } else {
    normalized += '+07:00';
  }
  const date = new Date(normalized);
  if (isNaN(date.getTime())) {
    return new Date(dateString);
  }
  return date;
};

export async function POST(req: NextRequest) {
  const start = Date.now();
  try {
    const body = await secureJsonRequest(req);
    
    // ตรวจสอบ Secret พิเศษสำหรับการ Load Test
    const loadTestSecret = req.headers.get('x-load-test-secret');
    const isLoadTest = loadTestSecret === process.env.LOAD_TEST_SECRET && !!loadTestSecret;

    // Rate limiting สำหรับ order submission (เว้นแต่เป็นการ Load Test)
    if (!isLoadTest) {
      const rateLimitResult = await checkCombinedRateLimitAsync(req, RATE_LIMITS.order);
      if (!rateLimitResult.allowed) {
        return await secureJsonResponse(
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
    }
    
    // ตรวจสอบ Turnstile token (ป้องกันบอท) เว้นแต่จะมาจากการ Load Test
    const clientIP = getClientIP(req);
    if (!isLoadTest) {
      const turnstileToken = body?.turnstileToken;
      const turnstileResult = await verifyTurnstileToken(turnstileToken, clientIP);
      
      if (!turnstileResult.success) {
        return await secureJsonResponse(
          { status: 'error', message: turnstileResult.error || 'กรุณายืนยันว่าคุณไม่ใช่บอท' },
          { status: 400, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
        );
      }
    }
    
    // Sanitize UTF-8 input ก่อนบันทึก (และลบ turnstileToken ออก)
    const { turnstileToken: _, ...bodyWithoutToken } = body;
    const sanitizedBody = sanitizeObjectUtf8(bodyWithoutToken);
    
    // Validate shop status and product status in database before order creation
    let products: any[] = [];
    let isShopOpen = true;
    let shopCloseDate = '';
    let shopOpenDate = '';

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
        shopCloseDate = settings.closeDate ?? '';
        shopOpenDate = settings.openDate ?? '';
      } else {
        return await secureJsonResponse(
          { status: 'error', message: 'ไม่พบข้อมูลร้านค้า' },
          { status: 404, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
        );
      }
    } else {
      // Main shop validation
      const cfg = await getJson<{ products?: unknown[]; isOpen?: boolean; closeDate?: string; openDate?: string }>('config/shop-settings.json');
      if (cfg) {
        products = (cfg.products as any[]) || [];
        isShopOpen = cfg.isOpen !== false;
        shopCloseDate = cfg.closeDate ?? '';
        shopOpenDate = cfg.openDate ?? '';
      }
    }

    // 1. Validate if shop is open (matching frontend getShopStatus logic)
    const nowTime = new Date();
    let shopStatus = 'OPEN';
    if (!isShopOpen) {
      shopStatus = 'TEMPORARILY_CLOSED';
    } else if (isValidDate(shopOpenDate) && nowTime < parseThailandDate(shopOpenDate, false)) {
      shopStatus = 'WAITING_TO_OPEN';
    } else if (isValidDate(shopCloseDate) && nowTime > parseThailandDate(shopCloseDate, true)) {
      shopStatus = 'ORDER_ENDED';
    }

    if (shopStatus !== 'OPEN') {
      const message = shopStatus === 'ORDER_ENDED' 
        ? 'ร้านค้าปิดรับออเดอร์แล้ว ไม่สามารถสั่งซื้อได้' 
        : 'ร้านค้าปิดให้บริการชั่วคราว ไม่สามารถสั่งซื้อได้';
      return await secureJsonResponse(
        { status: 'error', message },
        { status: 400, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      );
    }

    // 2. Validate all products in the cart are still open and in stock
    const cartItems = sanitizedBody.cart || [];
    for (const item of cartItems) {
      const prod = products.find(p => p.id === item.productId);
      if (!prod) {
        return await secureJsonResponse(
          { status: 'error', message: `สินค้า "${item.productName || 'ไม่ระบุชื่อ'}" ไม่มีอยู่ในระบบแล้ว` },
          { status: 400, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
        );
      }
      
      if (!isProductCurrentlyOpen(prod, nowTime)) {
        return await secureJsonResponse(
          { status: 'error', message: `สินค้า "${item.productName || prod.name}" หมดอายุหรือปิดการขายแล้ว` },
          { status: 400, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
        );
      }

      if (isProductOutOfStock(prod)) {
        return await secureJsonResponse(
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
    } catch (pricingError: any) /* eslint-disable-line @typescript-eslint/no-explicit-any */ {
      return await secureJsonResponse(
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
    const { buildReservationExpiresAt, getReservationHours } = await import('@/lib/order-reservation');
    const customerEmail = normalizeEmail(sanitizedBody.customerEmail || sanitizedBody.email);
    const order = {
      ref,
      date: now.toISOString(),
      createdAt: now.toISOString(),
      status: 'WAITING_PAYMENT',
      /** Soft hold: stock deducted until paid or reservation expires */
      reservationExpiresAt: buildReservationExpiresAt(now),
      reservationHours: getReservationHours(),
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
      stockReleased: false,
      ...(sanitizedBody.shopId ? { shopId: sanitizedBody.shopId } : {}),
      ...(sanitizedBody.shopSlug ? { shopSlug: sanitizedBody.shopSlug } : {}),
    };
    const key = orderKey(ref, now);
    
    // Deduct stock before saving
    let allStockDeducted = true;
    let fallbackUsed = false;
    const deductedItems: { key: string, qty: number, isFallback?: boolean, prodId?: string, size?: string }[] = [];
    
    for (const item of cartItems) {
      const size = item.size || 'FREE';
      const qty = Number(item.quantity || item.qty || 1);
      const prodId = item.productId || item.id;
      if (prodId) {
        try {
          const stockKey = `stock:${sanitizedBody.shopId || 'main'}:${prodId}:${size}`;
          // Use Redis Deduct
          const redisDeduct = await deductStockAtomic(stockKey, qty).catch((e) => {
             console.warn('[Orders API] Redis deduct failed or not configured, fallback to SQL:', e);
             return -2;
          });
          
          if (redisDeduct === -1) {
            allStockDeducted = false;
            break; // Stop deducting, we will rollback
          } else if (redisDeduct >= 0) {
            deductedItems.push({ key: stockKey, qty });
          } else {
             // Fallback to JSON-based stock
             const prodIndex = products.findIndex(p => p.id === prodId);
             if (prodIndex >= 0) {
               const p = products[prodIndex];
               let currentStock: number | null | undefined = null;
               let variantToUpdate: any = null;

               if (p.variants && p.variants.length > 0) {
                 variantToUpdate = p.variants.find((v: any) => v.id === size || v.name === size);
                 if (variantToUpdate) {
                   currentStock = variantToUpdate.stock;
                 }
               } else {
                 currentStock = p.stock;
               }

               if (currentStock !== null && currentStock !== undefined) {
                 if (currentStock >= qty || currentStock < 0 /* unlimited */) {
                   if (currentStock >= 0) {
                     if (variantToUpdate) variantToUpdate.stock = currentStock - qty;
                     else p.stock = currentStock - qty;
                   }
                   fallbackUsed = true;
                   deductedItems.push({ key: stockKey, qty, isFallback: true, prodId, size });
                   // Log
                   await db.execute(sql`
                     INSERT INTO inventory_logs (product_id, size, previous_quantity, new_quantity, change_type, order_ref, changed_by)
                     VALUES (${prodId}, ${size}, ${currentStock}, ${currentStock - qty}, 'ORDER_DEDUCT', ${ref}, ${customerEmail})
                   `).catch(() => {});
                 } else {
                   allStockDeducted = false;
                   break;
                 }
               } else {
                 // unlimited (null stock)
                 fallbackUsed = true;
                 deductedItems.push({ key: stockKey, qty, isFallback: true, prodId, size });
               }
             } else {
               allStockDeducted = false;
               break;
             }
          }
        } catch (e) {
          console.error('[Orders API] Error deducting stock:', e);
        }
      }
    }
    
    if (!allStockDeducted) {
       // Rollback Redis stock
       for (const item of deductedItems) {
          if (item.isFallback && item.prodId && item.size) {
             const prodIndex = products.findIndex(p => p.id === item.prodId);
             if (prodIndex >= 0) {
                const p = products[prodIndex];
                if (p.variants && p.variants.length > 0) {
                   const variant = p.variants.find((v: any) => v.id === item.size || v.name === item.size);
                   if (variant && variant.stock !== null && variant.stock !== undefined) {
                     variant.stock += item.qty;
                   }
                } else if (p.stock !== null && p.stock !== undefined) {
                   p.stock += item.qty;
                }
             }
          } else {
             await restoreStockAtomic(item.key, item.qty).catch(() => {});
          }
       }
       return await secureJsonResponse(
          { status: 'error', message: 'สินค้าบางรายการสต็อกไม่เพียงพอ' },
          { status: 400, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
       );
    }

    if (fallbackUsed && allStockDeducted) {
      try {
        if (sanitizedBody.shopId || sanitizedBody.shopSlug) {
          const shopIdToUpdate = sanitizedBody.shopId || (await db.select().from(shops).where(eq(shops.slug, sanitizedBody.shopSlug)).limit(1))[0]?.id;
          if (shopIdToUpdate) {
            await db.update(shops).set({ products }).where(eq(shops.id, shopIdToUpdate));
          }
        } else {
           const cfg = await getJson<any>('config/shop-settings.json');
           if (cfg) {
             cfg.products = products;
             await putJson('config/shop-settings.json', cfg);
           }
        }
      } catch (err) {
        console.error('[Orders API] Failed to save fallback stock:', err);
      }
    }

    // --- REALTIME STOCK SIGNAL ---
    // Instantly trigger Supabase Realtime so clients fetch the new Redis stock
    try {
      await db.insert(config)
        .values({ key: 'config-version', value: { updatedAt: new Date().toISOString() } })
        .onConflictDoUpdate({
          target: config.key,
          set: { value: { updatedAt: new Date().toISOString() }, updatedAt: new Date() },
        });
    } catch (signalErr) {
      console.warn('[Orders API] Failed to trigger realtime signal:', signalErr);
    }

    const qstash = getQStashClient();
    if (qstash) {
      try {
        // Enqueue job to QStash
        const protocol = req.headers.get('x-forwarded-proto') || 'https';
        const host = req.headers.get('host') || 'sccshop.psuscc.club';
        await qstash.publishJSON({
          url: `${protocol}://${host}/api/workers/process-order`,
          body: { order, ref, key },
          retries: 3,
        });

        // ── Queue Tracking ─────────────────────────────────
        // Record queue position and metadata in Redis so the
        // status endpoint can return accurate ETA / position.
        const redis = getRedisClient();
        if (redis) {
          const position = await redis.incr('queue:counter').catch(() => 1);
          await redis.incr('queue:active').catch(() => {});
          const queueMeta = {
            position,
            queuedAt: new Date().toISOString(),
            estimatedProcessMs: 2000, // ~2s average worker time
            stage: 'queued',
          };
          await Promise.all([
            redis.set(`order_status:${ref}`, 'queued', { ex: 300 }),
            redis.set(`order_queue:${ref}`, JSON.stringify(queueMeta), { ex: 300 }),
          ]).catch(() => {});
        }

        // Dispatch LINE Notification early for queued order
        // dispatchNotification({
        //   shopId: sanitizedBody.shopId,
        //   type: 'NEW_ORDER',
        //   title: '📦 Order Queued!',
        //   message: `Ref: ${ref}\nName: ${order.customerName}\nAmount: ฿${totalAmount.toLocaleString()}`,
        // }).catch(e => console.error('[Orders API] Notification error:', e));

        return await secureJsonResponse(
          { status: 'success', ref, queued: true, queueId: `q-${ref}` },
          { status: 202, headers: { 'Content-Type': 'application/json; charset=utf-8' } } // HTTP 202 Accepted
        );
      } catch (err) {
        console.error('[Orders API] QStash publish failed:', err);
        // Fallthrough to synchronous save
      }
    }

    // Fallback: Synchronous save if QStash is not configured or failed
    await putJson(key, order);
    if (order.customerEmail) {
      await upsertIndexEntry(order.customerEmail, order);
    }
    
    // Dispatch LINE Notification for new order
    dispatchNotification({
      shopId: sanitizedBody.shopId,
      type: 'NEW_ORDER',
      title: '📦 New Order Received!',
      message: `Ref: ${ref}\nName: ${order.customerName}\nAmount: ฿${totalAmount.toLocaleString()}`,
    }).catch(e => console.error('[Orders API] Notification error:', e));
    
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
    return await secureJsonResponse(
      { status: 'success', ref },
      { headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  } catch (error: any) /* eslint-disable-line @typescript-eslint/no-explicit-any */ {
    recordOrderCreated('failed', Date.now() - start);
    return await secureJsonResponse(
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
    const body = await secureJsonRequest(req);
    const ref = sanitizeUtf8Input(body?.ref) as string | undefined;
    const updates = body?.data as Record<string, any> | undefined;
    if (!ref || !updates) {
      return await secureJsonResponse(
        { status: 'error', message: 'missing ref/data' },
        { status: 400, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      );
    }

    const existing = (await getOrderByRef(ref)) || {};

    if (!existing || !(existing as { ref?: string }).ref) {
      return await secureJsonResponse(
        { status: 'error', message: 'order not found' },
        { status: 404, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      );
    }

    // ตรวจสอบว่าเป็นเจ้าของ order หรือเป็น admin
    const orderEmail = existing.customerEmail || existing.email;
    if (!isResourceOwner(orderEmail, currentUserEmail) && !isAdmin) {
      return await secureJsonResponse(
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

    // Record receipt issued at when payment is verified
    if (sanitizedUpdates.paymentVerified === true && existing.paymentVerified !== true) {
      sanitizedUpdates.receiptIssuedAt = new Date().toISOString();
    }

    const next = { ...existing, ...sanitizedUpdates };

    // State machine check if status changed
    if (sanitizedUpdates.status && sanitizedUpdates.status !== existing.status) {
      if (!isValidTransition(existing.status as OrderStatus, sanitizedUpdates.status as OrderStatus, isAdmin)) {
        return await secureJsonResponse(
          { status: 'error', message: `Invalid status transition from ${existing.status} to ${sanitizedUpdates.status}` },
          { status: 400, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
        );
      }
    }

    await updateOrderByRef(ref, next);
    if (next.customerEmail) {
      await upsertIndexEntry(next.customerEmail, next);
    }

    // Webhook dispatch if status changed
    if (sanitizedUpdates.status && sanitizedUpdates.status !== existing.status) {
      dispatchWebhook('order.status_updated', {
        ref: next.ref,
        status: next.status,
        customerName: next.customerName,
        totalAmount: next.totalAmount,
      }, next.shopId).catch(() => {});
    }
    // Auto sync to Google Sheets
    triggerSheetSync().catch(() => {});
    
    // Sanitize response - ไม่ส่ง slip data กลับ
    const sanitizedResponse = sanitizeOrderForUser(next);
    
    return await secureJsonResponse(
      { status: 'success', data: sanitizedResponse },
      { headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  } catch (error: any) /* eslint-disable-line @typescript-eslint/no-explicit-any */ {
    return await secureJsonResponse(
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
    return await secureJsonResponse(
      { status: 'error', message: 'missing ref' },
      { status: 400, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  }

  // Hard delete ทำได้เฉพาะ admin
  if (hard && !isAdmin) {
    return await secureJsonResponse(
      { status: 'error', message: 'เฉพาะ admin เท่านั้นที่ลบถาวรได้' },
      { status: 403, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  }

  try {
    const existing = await getOrderByRef(ref);
    if (!existing) {
      return await secureJsonResponse(
        { status: 'error', message: 'order not found' },
        { status: 404, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      );
    }

    const orderEmail = existing.customerEmail || existing.email;

    // ตรวจสอบสิทธิ์
    if (!isResourceOwner(orderEmail, currentUserEmail) && !isAdmin) {
      return await secureJsonResponse(
        { status: 'error', message: 'ไม่มีสิทธิ์ลบ order นี้' },
        { status: 403, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      );
    }

    if (hard) {
      if (existing?.customerEmail) {
        await removeIndexEntry(existing.customerEmail, ref);
      }
      // Hard delete still releases stock if not already released
      try {
        const {
          releaseOrderStock,
          shouldReleaseReservationStock,
        } = await import('@/lib/order-reservation');
        if (shouldReleaseReservationStock(existing, existing.status)) {
          await releaseOrderStock(existing);
        }
      } catch (stockErr) {
        console.error('[Orders API] stock release on hard delete failed:', stockErr);
      }
      await deleteOrderByRef(ref);
      triggerSheetSync().catch(() => {});
      return await secureJsonResponse(
        { status: 'success', message: 'deleted' },
        { headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      );
    }

    const previousStatus = existing.status;
    let order = { ...existing, status: 'CANCELLED', cancelledAt: new Date().toISOString() };
    try {
      const {
        releaseOrderStock,
        shouldReleaseReservationStock,
        withStockReleasedFlag,
      } = await import('@/lib/order-reservation');
      if (shouldReleaseReservationStock(existing, previousStatus)) {
        const release = await releaseOrderStock(existing);
        order = withStockReleasedFlag(order, {
          stockRestoreRestored: release.restored,
          stockRestoreFailed: release.failed,
          cancelReason: existing.cancelReason || 'ยกเลิกโดยผู้ใช้/แอดมิน — คืนสต็อกแล้ว',
        });
      }
    } catch (stockErr) {
      console.error('[Orders API] stock release on cancel failed:', stockErr);
    }

    await updateOrderByRef(ref, order);
    if (order.customerEmail) {
      await upsertIndexEntry(order.customerEmail, order);
    }
    // Auto sync to Google Sheets
    triggerSheetSync().catch(() => {});
    return await secureJsonResponse(
      { status: 'success', message: 'cancelled' },
      { headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  } catch (error: any) /* eslint-disable-line @typescript-eslint/no-explicit-any */ {
    return await secureJsonResponse(
      { status: 'error', message: error?.message || 'cancel failed' },
      { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  }
}
