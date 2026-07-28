// src/app/api/cron/cancel-expired/route.ts
// Cron: auto-cancel unpaid orders past reservation timeout and restore stock

import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { putJson, getExpiredUnpaidOrders, updateOrderByRef } from '@/lib/filebase';
import { withCronMonitor } from '@/lib/sentry-cron';
import { sendOrderCancelledEmail } from '@/lib/email';
import { triggerSheetSync } from '@/lib/sheet-sync';
import { verifyCronAuth } from '@/lib/cron-auth';
import {
  getReservationHours,
  releaseOrderStock,
  reservationCancelReason,
  shouldReleaseReservationStock,
  withStockReleasedFlag,
} from '@/lib/order-reservation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const authError = verifyCronAuth(req);
  if (authError) return authError;

  const expiryHours = getReservationHours();

  return withCronMonitor(
    { monitorSlug: 'cancel-expired', schedule: '*/30 * * * *', maxRuntime: 10 },
    async () => {
  try {
    console.log(`[Cron] Starting reservation timeout cancel (expiry=${expiryHours}h)...`);
    
    const expiredOrders = await getExpiredUnpaidOrders(expiryHours);
    
    let cancelledCount = 0;
    let stockRestoredCount = 0;
    let errorCount = 0;
    const cancelledOrders: string[] = [];
    
    for (const order of expiredOrders) {
      try {
        console.log(`[Cron] Cancelling expired reservation: ${order.ref}`);

        let updatedOrder: any = {
          ...order,
          status: 'CANCELLED',
          cancelReason: reservationCancelReason(expiryHours),
          cancelledAt: new Date().toISOString(),
          cancelledBy: 'SYSTEM_AUTO',
          reservationTimedOut: true,
        };

        if (shouldReleaseReservationStock(order, order.status)) {
          const release = await releaseOrderStock(order);
          stockRestoredCount += release.restored;
          updatedOrder = withStockReleasedFlag(updatedOrder, {
            stockRestoreRestored: release.restored,
            stockRestoreFailed: release.failed,
          });
          console.log(`[Cron] Stock release for ${order.ref}:`, release);
        }
        
        // Prefer DB update; also write legacy key for sheet/compat paths
        try {
          await updateOrderByRef(order.ref, updatedOrder);
        } catch (dbErr) {
          console.warn(`[Cron] updateOrderByRef failed for ${order.ref}, falling back to putJson:`, dbErr);
          const date = new Date(order.date || order.createdAt);
          const yyyy = date.getFullYear();
          const mm = String(date.getMonth() + 1).padStart(2, '0');
          const key = `orders/${yyyy}-${mm}/${order.ref}.json`;
          await putJson(key, updatedOrder);
        }
        
        const email = order.customerEmail || order.email;
        try {
          await sendOrderCancelledEmail({
            ref: order.ref,
            customerName: order.customerName || order.name,
            customerEmail: email,
            reason: `ไม่ได้ชำระเงินภายใน ${expiryHours} ชั่วโมง สต็อกถูกคืนเข้าระบบแล้ว หากต้องการสั่งซื้อใหม่ สามารถทำรายการได้ที่เว็บไซต์`,
          });
        } catch (emailError) {
          console.error(`[Cron] Failed to send cancellation email for ${order.ref}:`, emailError);
        }
        
        cancelledOrders.push(order.ref);
        cancelledCount++;
      } catch (orderError) {
        console.error(`[Cron] Error processing order ${order.ref}:`, orderError);
        errorCount++;
      }
    }
    
    if (cancelledCount > 0) {
      triggerSheetSync().catch((err) => {
        console.error('[Cron] Failed to sync sheets:', err);
      });
    }
    
    const result = {
      status: 'success',
      message: `Reservation timeout: checked ${expiredOrders.length}, cancelled ${cancelledCount}, stock lines restored ${stockRestoredCount}`,
      details: {
        expiryHours,
        checked: expiredOrders.length,
        cancelled: cancelledCount,
        stockLinesRestored: stockRestoredCount,
        errors: errorCount,
        cancelledOrders,
      },
      timestamp: new Date().toISOString(),
    };
    
    console.log('[Cron] Complete:', result);
    
    return NextResponse.json(result);
    
  } catch (error: unknown) {
    console.error('[Cron] Fatal error:', error);
    Sentry.captureException(error);
    const message = error instanceof Error ? error.message : 'Cron job failed';
    return NextResponse.json(
      { status: 'error', message },
      { status: 500 }
    );
  }
  });
}

export async function POST(req: NextRequest) {
  const authError = verifyCronAuth(req);
  if (authError) return authError;
  return GET(req);
}
