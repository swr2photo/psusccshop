// src/app/api/cron/update-tracking/route.ts
// Cron job to auto-update order status based on tracking information

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { trackShipment, TrackingStatus, ShippingProvider } from '@/lib/shipping';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Map tracking status to order status
const TRACKING_TO_ORDER_STATUS: Partial<Record<TrackingStatus, string>> = {
  delivered: 'RECEIVED',
  out_for_delivery: 'SHIPPED',
  in_transit: 'SHIPPED',
  picked_up: 'SHIPPED',
  returned: 'CANCELLED',
  failed: 'SHIPPED', // Keep as shipped, admin can handle
};

// Verify cron secret
function verifyCronSecret(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true; // Allow if not configured
  
  const authHeader = request.headers.get('authorization');
  if (authHeader === `Bearer ${cronSecret}`) return true;
  
  const secretParam = request.nextUrl.searchParams.get('secret');
  if (secretParam === cronSecret) return true;
  
  return false;
}

export async function GET(request: NextRequest) {
  // Verify cron secret
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getSupabaseAdmin();
  if (!db) {
    return NextResponse.json({ error: 'Database not available' }, { status: 500 });
  }

  try {
    // Get orders that are SHIPPED with tracking numbers but not yet RECEIVED
    const { data: orders, error } = await db
      .from('orders')
      .select('ref, status, tracking_number, shipping_provider, tracking_last_checked')
      .eq('status', 'SHIPPED')
      .not('tracking_number', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50); // Process 50 orders at a time

    if (error) throw error;

    if (!orders || orders.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No orders to check',
        processed: 0,
        updated: 0,
      });
    }

    const results = {
      processed: 0,
      updated: 0,
      delivered: 0,
      errors: [] as string[],
    };

    for (const order of orders) {
      results.processed++;
      
      try {
        // Skip if checked recently (within 1 hour)
        if (order.tracking_last_checked) {
          const lastChecked = new Date(order.tracking_last_checked);
          const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
          if (lastChecked > hourAgo) {
            continue;
          }
        }

        // Get tracking info
        const provider = (order.shipping_provider || 'custom') as ShippingProvider;
        const trackingInfo = await trackShipment(provider, order.tracking_number);

        // Update last checked time
        const updateData: Record<string, any> = {
          tracking_last_checked: new Date().toISOString(),
          tracking_status: trackingInfo?.status || 'unknown',
          updated_at: new Date().toISOString(),
        };

        // Check if status should be updated
        if (trackingInfo?.status) {
          const newOrderStatus = TRACKING_TO_ORDER_STATUS[trackingInfo.status];
          
          if (newOrderStatus && newOrderStatus !== order.status) {
            // Only auto-update to RECEIVED
            if (newOrderStatus === 'RECEIVED') {
              updateData.status = 'RECEIVED';
              updateData.received_at = new Date().toISOString();
              results.delivered++;
              results.updated++;
              console.log(`[Tracking] Order ${order.ref} auto-updated to RECEIVED`);
            }
          }
        }

        // Update order
        await db
          .from('orders')
          .update(updateData)
          .eq('ref', order.ref);

        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (orderError: any) {
        results.errors.push(`${order.ref}: ${orderError.message}`);
        console.error(`[Tracking] Error processing ${order.ref}:`, orderError);
      }
    }

    console.log(`[Tracking Cron] Processed: ${results.processed}, Updated: ${results.updated}, Delivered: ${results.delivered}`);

    return NextResponse.json({
      success: true,
      ...results,
    });

  } catch (error: any) {
    console.error('[Tracking Cron] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

// Also support POST for manual trigger
export async function POST(request: NextRequest) {
  return GET(request);
}
