/**
 * Order reservation timeout — stock is hard-deducted on create (WAITING_PAYMENT).
 * When unpaid orders expire or are cancelled, stock must be restored exactly once.
 */

import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';

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
  const lines = cartLines(order);
  let restored = 0;
  let failed = 0;

  for (const item of lines) {
    const prodId = String(item.productId || item.id || '').trim();
    const size = String(item.size || 'FREE').trim() || 'FREE';
    const qty = Number(item.quantity ?? item.qty ?? 1);
    if (!prodId || !Number.isFinite(qty) || qty <= 0) continue;

    try {
      const restoreRes: any = await db.execute(
        sql`SELECT restore_stock(${prodId}, ${size}, ${qty}) as success`,
      );
      const rows = restoreRes.rows || restoreRes;
      const ok = Boolean(rows?.[0]?.success);
      if (!ok) {
        console.warn(`[reservation] restore_stock failed for ${prodId} size ${size} qty ${qty}`);
        failed += 1;
        continue;
      }
      restored += 1;
      try {
        await db.execute(sql`
          INSERT INTO inventory_logs (product_id, size, previous_quantity, new_quantity, change_type, order_ref, changed_by)
          VALUES (${prodId}, ${size}, 0, 0, 'ORDER_RESTORE', ${ref}, 'reservation-timeout')
        `);
      } catch (logErr) {
        console.warn('[reservation] inventory_logs insert failed:', logErr);
      }
    } catch (e) {
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
