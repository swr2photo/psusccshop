/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Order reservation timeout — stock is hard-deducted on create (WAITING_PAYMENT).
 * When unpaid orders expire or are cancelled, stock must be restored exactly once.
 */

import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { shops } from '@/db/schema';
import { getJson, putJson } from '@/lib/filebase';
import { restoreStockAtomic } from '@/lib/stock';
import { invalidateCacheKey, PUBLIC_CONFIG_CACHE_KEY } from '@/lib/server-cache';
import type { Product, ShopConfig } from '@/lib/config';

/** Default unpaid reservation window (hours). Override with ORDER_RESERVATION_HOURS. */
export const DEFAULT_RESERVATION_HOURS = 24;

const UNPAID_STATUSES = new Set([
  'PENDING',
  'WAITING_PAYMENT',
  'AWAITING_PAYMENT',
  'UNPAID',
  'DRAFT',
]);

/** Already fulfilled — do not put stock back on cancel. */
const FULFILLED_STATUSES = new Set([
  'SHIPPED',
  'COMPLETED',
  'READY',
  'PICKED_UP',
  'DELIVERED',
  'RECEIVED',
]);

export function getReservationHours(): number {
  const raw = Number(process.env.ORDER_RESERVATION_HOURS);
  if (Number.isFinite(raw) && raw > 0 && raw <= 168) return raw;
  return DEFAULT_RESERVATION_HOURS;
}

export function getReservationExpiryMs(hours = getReservationHours()): number {
  return hours * 60 * 60 * 1000;
}

export function getReservationDeadline(
  orderDate: string | Date,
  hours = getReservationHours(),
): Date {
  const created = new Date(orderDate).getTime();
  return new Date(created + getReservationExpiryMs(hours));
}

export function isReservationExpired(
  orderDate: string | Date,
  hours = getReservationHours(),
): boolean {
  return Date.now() >= getReservationDeadline(orderDate, hours).getTime();
}

export function buildReservationExpiresAt(from: Date = new Date()): string {
  return new Date(from.getTime() + getReservationExpiryMs()).toISOString();
}

export function reservationCancelReason(hours = getReservationHours()): string {
  return `ยกเลิกอัตโนมัติ: ไม่ได้ชำระเงินภายใน ${hours} ชั่วโมง (Reservation Timeout)`;
}

type CartLine = {
  productId?: string;
  id?: string;
  size?: string;
  quantity?: number;
  qty?: number;
};

function cartLines(order: any): CartLine[] {
  const cart = order?.cart || order?.items || [];
  return Array.isArray(cart) ? cart : [];
}

/**
 * Whether releasing reserved/deducted stock is appropriate for this cancel.
 */
export function shouldReleaseReservationStock(
  order: any,
  previousStatus?: string,
): boolean {
  if (order?.stockReleased === true || order?.reservationReleased === true) {
    return false;
  }
  const prior = String(previousStatus || order?.status || '').toUpperCase();
  if (FULFILLED_STATUSES.has(prior)) return false;
  // Unpaid waiting, or paid-but-not-fulfilled cancellations
  return UNPAID_STATUSES.has(prior) || prior === 'PAID' || prior === 'PROCESSING' || prior === 'VERIFYING' || !prior;
}

export type ReleaseStockResult = {
  restored: number;
  failed: number;
  skipped: boolean;
  reason?: string;
};

/**
 * Restore inventory for each cart line (idempotent via caller setting stockReleased).
 */
export async function releaseOrderStock(order: any): Promise<ReleaseStockResult> {
  if (!order) {
    return { restored: 0, failed: 0, skipped: true, reason: 'no-order' };
  }
  if (order.stockReleased === true || order.reservationReleased === true) {
    return { restored: 0, failed: 0, skipped: true, reason: 'already-released' };
  }

  const ref = String(order.ref || '');
  const targetShopId = typeof order.shopId === 'string' ? order.shopId.trim() : typeof order.shop_id === 'string' ? order.shop_id.trim() : '';
  const targetShopSlug = typeof order.shopSlug === 'string' ? order.shopSlug.trim() : typeof order.shop_slug === 'string' ? order.shop_slug.trim() : '';
  const redisShopKey = targetShopId || 'main';
  const lines = cartLines(order);
  let restored = 0;
  let failed = 0;

  const validLines: Array<{ prodId: string; size: string; qty: number }> = [];
  for (const item of lines) {
    const prodId = String(item.productId || item.id || '').trim();
    const size = String(item.size || 'FREE').trim() || 'FREE';
    const qty = Number(item.quantity ?? item.qty ?? 1);
    if (!prodId || !Number.isFinite(qty) || qty <= 0) continue;
    validLines.push({ prodId, size, qty });
  }

  if (validLines.length === 0) {
    return { restored: 0, failed: 0, skipped: false };
  }

  // 1. Restore Redis atomic stock counters (if present in Redis)
  for (const { prodId, size, qty } of validLines) {
    const stockKey = `stock:${redisShopKey}:${prodId}:${size}`;
    await restoreStockAtomic(stockKey, qty).catch((err) => {
      console.warn(`[reservation] Redis restoreStockAtomic skipped/failed for ${stockKey}:`, err);
    });
  }

  // 2. Restore persistent product stock in shops table (sub-shop) or config/shop-settings.json (main shop)
  const restoredInJson = new Set<string>();
  try {
    let shopCondition;
    if (targetShopId && targetShopId !== 'main') shopCondition = eq(shops.id, targetShopId);
    else if (targetShopSlug && targetShopSlug !== 'main') shopCondition = eq(shops.slug, targetShopSlug);

    if (shopCondition) {
      const shopRow = await db
        .select({ products: shops.products, id: shops.id })
        .from(shops)
        .where(shopCondition)
        .limit(1);
      if (shopRow && shopRow.length > 0) {
        const products = (shopRow[0].products as Product[]) || [];
        let updated = false;
        for (const { prodId, size, qty } of validLines) {
          const product = products.find((p) => p.id === prodId);
          if (!product) continue;
          if (product.variants && product.variants.length > 0) {
            const variant = product.variants.find((v) => v.id === size || v.name === size);
            if (variant && typeof variant.stock === 'number' && variant.stock >= 0) {
              variant.stock += qty;
              updated = true;
              restoredInJson.add(`${prodId}:${size}`);
            }
          } else if (typeof product.stock === 'number' && product.stock >= 0) {
            product.stock += qty;
            updated = true;
            restoredInJson.add(`${prodId}:${size}`);
          }
        }
        if (updated) {
          await db.update(shops).set({ products, updatedAt: new Date() }).where(eq(shops.id, shopRow[0].id));
          invalidateCacheKey('shops:public-catalog-v2');
        }
      }
    } else {
      const cfg = await getJson<ShopConfig>('config/shop-settings.json');
      if (cfg && Array.isArray(cfg.products)) {
        let updated = false;
        for (const { prodId, size, qty } of validLines) {
          const product = cfg.products.find((p) => p.id === prodId);
          if (!product) continue;
          if (product.variants && product.variants.length > 0) {
            const variant = product.variants.find((v) => v.id === size || v.name === size);
            if (variant && typeof variant.stock === 'number' && variant.stock >= 0) {
              variant.stock += qty;
              updated = true;
              restoredInJson.add(`${prodId}:${size}`);
            }
          } else if (typeof product.stock === 'number' && product.stock >= 0) {
            product.stock += qty;
            updated = true;
            restoredInJson.add(`${prodId}:${size}`);
          }
        }
        if (updated) {
          await putJson('config/shop-settings.json', cfg);
          invalidateCacheKey(PUBLIC_CONFIG_CACHE_KEY);
        }
      }
    }
  } catch (jsonErr) {
    console.warn('[reservation] Failed to restore stock in shop JSON config:', jsonErr);
  }

  // 3. Also attempt legacy SQL inventory table restore & audit logging
  for (const { prodId, size, qty } of validLines) {
    const lineKey = `${prodId}:${size}`;
    const alreadyRestoredJson = restoredInJson.has(lineKey);
    try {
      const restoreRes: any = await db.execute(
        sql`SELECT restore_stock(${prodId}, ${size}, ${qty}) as success`,
      );
      const rows = restoreRes.rows || restoreRes;
      const ok = Boolean(rows?.[0]?.success);
      if (ok || alreadyRestoredJson) {
        restored += 1;
      } else {
        console.warn(`[reservation] restore_stock failed for ${prodId} size ${size} qty ${qty}`);
        failed += 1;
        continue;
      }
      try {
        await db.execute(sql`
          INSERT INTO inventory_logs (product_id, size, previous_quantity, new_quantity, change_type, order_ref, changed_by)
          VALUES (${prodId}, ${size}, 0, 0, 'ORDER_RESTORE', ${ref}, 'reservation-timeout')
        `);
      } catch (logErr) {
        console.warn('[reservation] inventory_logs insert failed:', logErr);
      }
    } catch (e) {
      if (alreadyRestoredJson) {
        restored += 1;
        try {
          await db.execute(sql`
            INSERT INTO inventory_logs (product_id, size, previous_quantity, new_quantity, change_type, order_ref, changed_by)
            VALUES (${prodId}, ${size}, 0, 0, 'ORDER_RESTORE', ${ref}, 'reservation-timeout-json')
          `);
        } catch {
          /* ignore log failure */
        }
        continue;
      }
      // restore_stock may not exist yet — try inline UPDATE as fallback
      console.warn('[reservation] restore_stock RPC error, trying fallback UPDATE:', e);
      try {
        await db.execute(sql`
          UPDATE inventory
          SET quantity = quantity + ${qty}, updated_at = NOW()
          WHERE product_id = ${prodId}
            AND size = ${size}
        `);
        restored += 1;
        try {
          await db.execute(sql`
            INSERT INTO inventory_logs (product_id, size, previous_quantity, new_quantity, change_type, order_ref, changed_by)
            VALUES (${prodId}, ${size}, 0, 0, 'ORDER_RESTORE', ${ref}, 'reservation-timeout-fallback')
          `);
        } catch {
          /* ignore log failure */
        }
      } catch (fallbackErr) {
        console.error(`[reservation] stock restore failed for ${prodId}:`, fallbackErr);
        failed += 1;
      }
    }
  }

  return { restored, failed, skipped: false };
}

/**
 * Mark order fields after a successful (or attempted) stock release so we never double-restore.
 */
export function withStockReleasedFlag(order: any, extra?: Record<string, unknown>) {
  return {
    ...order,
    stockReleased: true,
    reservationReleased: true,
    stockReleasedAt: new Date().toISOString(),
    ...extra,
  };
}
