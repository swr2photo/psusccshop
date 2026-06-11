// src/app/api/cron/update-tracking/route.ts
// Cron job to auto-update order status based on tracking information — Drizzle ORM

import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { db } from '@/lib/db';
import { withCronMonitor } from '@/lib/sentry-cron';
import { orders } from '@/db/schema';
import { eq, and, desc, isNotNull } from 'drizzle-orm';
import { trackShipment, TrackingStatus, ShippingProvider } from '@/lib/shipping';
import { verifyCronAuth } from '@/lib/cron-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TRACKING_TO_ORDER_STATUS: Partial<Record<TrackingStatus, string>> = {
  delivered: 'RECEIVED',
  out_for_delivery: 'SHIPPED',
  in_transit: 'SHIPPED',
  picked_up: 'SHIPPED',
  returned: 'CANCELLED',
  failed: 'SHIPPED',
};

export async function GET(request: NextRequest) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  return withCronMonitor(
    { monitorSlug: 'update-tracking', schedule: '0 */2 * * *', maxRuntime: 15 },
    async () => {
  try {
    const fetchedOrders = await db.select({
      ref: orders.ref,
      status: orders.status,
      tracking_number: orders.trackingNumber,
      shipping_provider: orders.shippingProvider,
      tracking_last_checked: orders.trackingLastChecked,
    })
    .from(orders)
    .where(
      and(
        eq(orders.status, 'SHIPPED'),
        isNotNull(orders.trackingNumber)
      )
    )
    .orderBy(desc(orders.createdAt))
    .limit(50);

    if (!fetchedOrders.length) {
      return NextResponse.json({ success: true, message: 'No orders to check', processed: 0, updated: 0 });
    }

    const results = { processed: 0, updated: 0, delivered: 0, errors: [] as string[] };

    for (const order of fetchedOrders) {
      results.processed++;
      try {
        if (order.tracking_last_checked) {
          const lastChecked = new Date(order.tracking_last_checked);
          const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
          if (lastChecked > hourAgo) continue;
        }

        const provider = (order.shipping_provider || 'custom') as ShippingProvider;
        const trackingInfo = await trackShipment(provider, order.tracking_number!);

        const updateData: any = {
          trackingLastChecked: new Date().toISOString(),
          trackingStatus: trackingInfo?.status || 'unknown',
        };

        if (trackingInfo?.status) {
          const newOrderStatus = TRACKING_TO_ORDER_STATUS[trackingInfo.status];
          if (newOrderStatus && newOrderStatus !== order.status && newOrderStatus === 'RECEIVED') {
            updateData.status = 'RECEIVED';
            updateData.receivedAt = new Date().toISOString();
            results.delivered++;
            results.updated++;
            console.log(`[Tracking] Order ${order.ref} auto-updated to RECEIVED`);
          }
        }

        await db.update(orders)
          .set(updateData)
          .where(eq(orders.ref, order.ref));
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (orderError: any) {
        results.errors.push(`${order.ref}: ${orderError.message}`);
        console.error(`[Tracking] Error processing ${order.ref}:`, orderError);
      }
    }

    console.log(`[Tracking Cron] Processed: ${results.processed}, Updated: ${results.updated}, Delivered: ${results.delivered}`);
    return NextResponse.json({ success: true, ...results });
  } catch (error: unknown) {
    console.error('[Tracking Cron] Error:', error);
    Sentry.captureException(error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
  });
}

export async function POST(request: NextRequest) {
  return GET(request);
}
