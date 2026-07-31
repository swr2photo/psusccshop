import { NextRequest, NextResponse } from 'next/server';
import { getRedisClient } from '@/lib/redis';
import { putJson, getJson } from '@/lib/filebase';
import { triggerSheetSync } from '@/lib/sheet-sync';
import { db } from '@/lib/db';
import { shops } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { invalidateCacheKey, PUBLIC_CONFIG_CACHE_KEY } from '@/lib/server-cache';
import type { Product, ShopConfig } from '@/lib/config';
// Security: In a real app, verify QStash signature here using @upstash/qstash Receiver.
// For now, we assume the POST comes from QStash or internal edge.

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const { order, ref, key } = payload;
    
    if (!order || !ref || !key) {
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

    await putJson(key, order);
    
    // Deduct stock in DB (shops JSON) to trigger real-time updates and update persistent state
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

          for (const item of order.cart || []) {
            const prodId = item.productId || item.id;
            const size = item.size || 'FREE';
            const qty = Number(item.quantity || item.qty || 1);

            const product = products.find(p => p.id === prodId);
            if (product) {
              if (product.variants && product.variants.length > 0) {
                const variant = product.variants.find(v => v.id === size || v.name === size);
                if (variant && typeof variant.stock === 'number') {
                  variant.stock = Math.max(0, variant.stock - qty);
                  updated = true;
                }
              } else if (typeof product.stock === 'number') {
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
          for (const item of order.cart || []) {
            const prodId = item.productId || item.id;
            const size = item.size || 'FREE';
            const qty = Number(item.quantity || item.qty || 1);

            const product = config.products.find(p => p.id === prodId);
            if (product) {
              if (product.variants && product.variants.length > 0) {
                const variant = product.variants.find(v => v.id === size || v.name === size);
                if (variant && typeof variant.stock === 'number') {
                  variant.stock = Math.max(0, variant.stock - qty);
                  updated = true;
                }
              } else if (typeof product.stock === 'number') {
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
    // Attempt sheet sync
    triggerSheetSync().catch(() => {});

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
