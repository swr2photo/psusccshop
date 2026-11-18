/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getRedisClient } from '@/lib/redis';
import { putJson, getJson } from '@/lib/filebase';
import { triggerSheetSync } from '@/lib/sheet-sync';
import { db } from '@/lib/db';
import { shops } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { invalidateCacheKey, PUBLIC_CONFIG_CACHE_KEY } from '@/lib/server-cache';
import { getOrderWorkerUrl, getQStashReceiver } from '@/lib/qstash';
import { sendOrderConfirmationEmail } from '@/lib/email';
import { dispatchNotification } from '@/lib/notifications';
import { recordOrderCreated } from '@/lib/sentry-metrics';
import type { Product, ShopConfig } from '@/lib/config';

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
    const id = `log-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    await putJson(`user-logs/${id}.json`, {
      ...log,
      id,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.warn('[Worker API] Failed to save user log:', e);
  }
}

const SAFE_ORDER_REF_RE = /^[A-Za-z0-9_-]{3,128}$/;
const ORDER_KEY_RE = /^orders\/\d{4}-(0[1-9]|1[0-2])\/([A-Za-z0-9_-]{3,128})\.json$/;

function isValidOrderTarget(ref: unknown, key: unknown, orderRef?: unknown): boolean {
  if (typeof ref !== 'string' || !SAFE_ORDER_REF_RE.test(ref)) {
    return false;
  }
  if (typeof key !== 'string') {
    return false;
  }
  const match = ORDER_KEY_RE.exec(key);
  if (!match || match[2] !== ref) {
    return false;
  }
  if (orderRef !== undefined && orderRef !== ref) {
    return false;
  }
  return true;
}

export async function POST(req: NextRequest) {
  try {
    const signature = req.headers.get('upstash-signature')?.trim();
    if (!signature) {
      return NextResponse.json({ error: 'Missing QStash signature' }, { status: 401 });
    }

    const receiver = getQStashReceiver();
    if (!receiver) {
      console.error('[Worker API] QStash signing keys are not configured; failing closed');
      return NextResponse.json({ error: 'QStash signature verification not configured' }, { status: 401 });
    }

    const rawBody = await req.text();
    try {
      const isValid = await receiver.verify({
        signature,
        body: rawBody,
        url: getOrderWorkerUrl(),
        upstashRegion: req.headers.get('upstash-region') ?? undefined,
      });
      if (!isValid) {
        return NextResponse.json({ error: 'Invalid QStash signature' }, { status: 401 });
      }
    } catch (verifyErr) {
      console.warn('[Worker API] Invalid QStash signature:', verifyErr);
      return NextResponse.json({ error: 'Invalid QStash signature' }, { status: 401 });
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const { order, ref, key, redisDeductedItems, clientIP, userAgent } = payload as {
      order?: Record<string, any>;
      ref?: string;
      key?: string;
      redisDeductedItems?: Array<{ prodId: string; size?: string; qty?: number }>;
      clientIP?: string;
      userAgent?: string;
    };

    if (
      !order ||
      typeof order !== 'object' ||
      Array.isArray(order) ||
      !ref ||
      !key ||
      !isValidOrderTarget(ref, key, order.ref)
    ) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const redis = getRedisClient();

    // Update stage → validating_stock
    if (redis) {
      try {
        const raw = await redis.get(`order_queue:${ref}`);
        const meta = typeof raw === 'string' ? JSON.parse(raw) : raw ?? {};
        meta.stage = 'validating_stock';
        await redis.set(`order_queue:${ref}`, JSON.stringify(meta), { ex: 300 }).catch(() => {});
      } catch (err) {
        console.warn('[Worker API] Failed to update Redis (validating_stock):', err);
      }
    }

    // Insert to DB / Filebase
    // Update stage → saving
    if (redis) {
      try {
        const raw = await redis.get(`order_queue:${ref}`);
        const meta = typeof raw === 'string' ? JSON.parse(raw) : raw ?? {};
        meta.stage = 'saving';
        await redis.set(`order_queue:${ref}`, JSON.stringify(meta), { ex: 300 }).catch(() => {});
      } catch (err) {
        console.warn('[Worker API] Failed to update Redis (saving):', err);
      }
    }

    const normalizedOrder: Record<string, any> = { ...order, ref };
    await putJson(key, normalizedOrder);

    // Deduct stock in DB (shops JSON) ONLY for items that were deducted in Redis
    // (Items that fell back to DB in /api/orders were already persisted there).
    const itemsToDeductInDb = Array.isArray(redisDeductedItems)
      ? redisDeductedItems.map((i) => ({
          productId: i.prodId,
          size: i.size || 'FREE',
          quantity: Number(i.qty || 1),
        }))
      : order.cart || [];

    if (itemsToDeductInDb.length > 0) {
      try {
        const targetShopId = order.shopId;
        const targetShopSlug = order.shopSlug;
        let shopCondition;
        if (targetShopId && targetShopId !== 'main') shopCondition = eq(shops.id, targetShopId);
        else if (targetShopSlug && targetShopSlug !== 'main') shopCondition = eq(shops.slug, targetShopSlug);

        if (shopCondition) {
          const shopRow = await db.select({ products: shops.products, id: shops.id }).from(shops).where(shopCondition).limit(1).execute();
          if (shopRow && shopRow.length > 0) {
            const products = (shopRow[0].products as Product[]) || [];
            let updated = false;

            for (const item of itemsToDeductInDb) {
              const prodId = item.productId || item.id;
              const size = item.size || 'FREE';
              const qty = Number(item.quantity || item.qty || 1);

              const product = products.find(p => p.id === prodId);
              if (product) {
                if (product.variants && product.variants.length > 0) {
                  const variant = product.variants.find(v => v.id === size || v.name === size);
                  if (variant && typeof variant.stock === 'number' && variant.stock >= 0) {
                    variant.stock = Math.max(0, variant.stock - qty);
                    updated = true;
                  }
                } else if (typeof product.stock === 'number' && product.stock >= 0) {
                  product.stock = Math.max(0, product.stock - qty);
                  updated = true;
                }
              }
            }

            if (updated) {
              await db.update(shops).set({ products, updatedAt: new Date() }).where(eq(shops.id, shopRow[0].id)).execute();
              invalidateCacheKey('shops:public-catalog-v2');
            }
          }
        } else {
          // Main shop deduction
          const config = await getJson<ShopConfig>('config/shop-settings.json');
          if (config && config.products) {
            let updated = false;
            for (const item of itemsToDeductInDb) {
              const prodId = item.productId || item.id;
              const size = item.size || 'FREE';
              const qty = Number(item.quantity || item.qty || 1);

              const product = config.products.find(p => p.id === prodId);
              if (product) {
                if (product.variants && product.variants.length > 0) {
                  const variant = product.variants.find(v => v.id === size || v.name === size);
                  if (variant && typeof variant.stock === 'number' && variant.stock >= 0) {
                    variant.stock = Math.max(0, variant.stock - qty);
                    updated = true;
                  }
                } else if (typeof product.stock === 'number' && product.stock >= 0) {
                  product.stock = Math.max(0, product.stock - qty);
                  updated = true;
                }
              }
            }
            if (updated) {
              await putJson('config/shop-settings.json', config);
              invalidateCacheKey(PUBLIC_CONFIG_CACHE_KEY);
            }
          }
        }
      } catch (err) {
        console.warn('[Worker API] Failed to update shops JSON for realtime stock:', err);
      }
    }

    // Dispatch LINE Notification for new order
    const totalAmount = Number(normalizedOrder.totalAmount ?? normalizedOrder.amount ?? 0);
    dispatchNotification({
      shopId: normalizedOrder.shopId,
      type: 'NEW_ORDER',
      title: '📦 New Order Received!',
      message: `Ref: ${ref}\nName: ${normalizedOrder.customerName || ''}\nAmount: ฿${totalAmount.toLocaleString()}`,
    }).catch((e) => console.error('[Worker API] Notification error:', e));

    // Send order confirmation email
    if (normalizedOrder.customerEmail) {
      try {
        await sendOrderConfirmationEmail(normalizedOrder);
      } catch (emailError) {
        console.error('[Worker API] Failed to send confirmation email:', emailError);
      }

      await saveUserLogServer({
        email: normalizedOrder.customerEmail,
        name: normalizedOrder.customerName,
        action: 'place_order',
        details: `สั่งซื้อสินค้า: ${ref}`,
        metadata: {
          ref,
          totalAmount: normalizedOrder.totalAmount,
          itemCount: normalizedOrder.cart?.length || 0,
        },
        ip: clientIP,
        userAgent,
      });
    }

    // Attempt sheet sync
    triggerSheetSync().catch(() => {});
    recordOrderCreated('success', 0);

    // ── Mark complete & cleanup queue tracking ──────────
    if (redis) {
      try {
        await Promise.all([
          redis.set(`order_status:${ref}`, 'ready_for_payment', { ex: 3600 }),
          redis.del(`order_queue:${ref}`),
          redis.decr('queue:active').catch(() => {}),
        ]);
      } catch (err) {
        console.warn('[Worker API] Failed to update Redis (cleanup):', err);
      }
    }

    return NextResponse.json({ success: true, ref });
  } catch (err: any) {
    console.error('[Worker API] Failed to process order:', err);
    return NextResponse.json({ error: 'DB Insert Failed' }, { status: 500 });
  }
}
