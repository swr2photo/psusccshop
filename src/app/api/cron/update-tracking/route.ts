// src/app/api/cron/update-tracking/route.ts
// Cron job to auto-update order status based on tracking information — Prisma

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { trackShipment, TrackingStatus, ShippingProvider } from '@/lib/shipping';

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

function verifyCronSecret(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  const authHeader = request.headers.get('authorization');
  if (authHeader === `Bearer ${cronSecret}`) return true;
  const secretParam = request.nextUrl.searchParams.get('secret');
  if (secretParam === cronSecret) return true;
  return false;
}

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const orders = await prisma.order.findMany({
      where: {
        status: 'SHIPPED',
        tracking_number: { not: null },
      },
      select: {
        ref: true,
        status: true,
        tracking_number: true,
        shipping_provider: true,
        tracking_last_checked: true,
      },
      orderBy: { created_at: 'desc' },
      take: 50,
    });

    if (!orders.length) {
      return NextResponse.json({ success: true, message: 'No orders to check', processed: 0, updated: 0 });
    }

    const results = { processed: 0, updated: 0, delivered: 0, errors: [] as string[] };

    for (const order of orders) {
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
          tracking_last_checked: new Date(),
          tracking_status: trackingInfo?.status || 'unknown',
        };

        if (trackingInfo?.status) {
          const newOrderStatus = TRACKING_TO_ORDER_STATUS[trackingInfo.status];
          if (newOrderStatus && newOrderStatus !== order.status && newOrderStatus === 'RECEIVED') {
            updateData.status = 'RECEIVED';
            updateData.received_at = new Date();
            results.delivered++;
            results.updated++;
            console.log(`[Tracking] Order ${order.ref} auto-updated to RECEIVED`);
          }
        }

        await prisma.order.update({ where: { ref: order.ref }, data: updateData });
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (orderError: any) {
        results.errors.push(`${order.ref}: ${orderError.message}`);
        console.error(`[Tracking] Error processing ${order.ref}:`, orderError);
      }
    }

    console.log(`[Tracking Cron] Processed: ${results.processed}, Updated: ${results.updated}, Delivered: ${results.delivered}`);
    return NextResponse.json({ success: true, ...results });
  } catch (error: any) {
    console.error('[Tracking Cron] Error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Unknown error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
