// src/app/api/cron/cancel-expired/route.ts
// Cron job to auto-cancel orders that haven't been paid within 24 hours

import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { putJson, getExpiredUnpaidOrders } from '@/lib/filebase';
import { withCronMonitor } from '@/lib/sentry-cron';
import { sendOrderCancelledEmail } from '@/lib/email';
import { triggerSheetSync } from '@/lib/sheet-sync';
import { verifyCronAuth } from '@/lib/cron-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// เวลาหมดอายุ (24 ชั่วโมง)
const EXPIRY_HOURS = 24;

// Secret key for cron authentication (ป้องกันไม่ให้ใครเรียกใช้ได้โดยตรง)
const CRON_SECRET = process.env.CRON_SECRET;

if (!CRON_SECRET) {
  console.error('[Cron] CRON_SECRET environment variable is required!');
}

export async function GET(req: NextRequest) {
  const authError = verifyCronAuth(req);
  if (authError) return authError;

  return withCronMonitor(
    { monitorSlug: 'cancel-expired', schedule: '*/30 * * * *', maxRuntime: 10 },
    async () => {
  try {
    console.log('[Cron] Starting auto-cancel expired orders...');
    
    // Use optimized Supabase query to get expired unpaid orders
    const expiredOrders = await getExpiredUnpaidOrders(EXPIRY_HOURS);
    
    let cancelledCount = 0;
    let errorCount = 0;
    const cancelledOrders: string[] = [];
    
    for (const order of expiredOrders) {
      try {
        console.log(`[Cron] Cancelling expired order: ${order.ref}`);
        
        // อัปเดตสถานะเป็น CANCELLED
        const updatedOrder = {
          ...order,
          status: 'CANCELLED',
          cancelReason: 'ยกเลิกอัตโนมัติ: ไม่ได้ชำระเงินภายใน 24 ชั่วโมง',
          cancelledAt: new Date().toISOString(),
          cancelledBy: 'SYSTEM_AUTO',
        };
        
        // Use orderKey pattern for putJson
        const date = new Date(order.date || order.createdAt);
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const key = `orders/${yyyy}-${mm}/${order.ref}.json`;
        
        await putJson(key, updatedOrder);
        
        // ส่ง email แจ้งลูกค้า
        const email = order.customerEmail || order.email;
        try {
          await sendOrderCancelledEmail({
            ref: order.ref,
            customerName: order.customerName || order.name,
            customerEmail: email,
            reason: 'ไม่ได้ชำระเงินภายใน 24 ชั่วโมง หากต้องการสั่งซื้อใหม่ สามารถทำรายการได้ที่เว็บไซต์',
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
    
    // Sync กับ Google Sheets ถ้ามีการยกเลิก
    if (cancelledCount > 0) {
      triggerSheetSync().catch((err) => {
        console.error('[Cron] Failed to sync sheets:', err);
      });
    }
    
    const result = {
      status: 'success',
      message: `Checked ${expiredOrders.length} expired orders, cancelled ${cancelledCount}`,
      details: {
        checked: expiredOrders.length,
        cancelled: cancelledCount,
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

// POST method สำหรับ manual trigger (ต้องส่ง Authorization: Bearer CRON_SECRET)
export async function POST(req: NextRequest) {
  const authError = verifyCronAuth(req);
  if (authError) return authError;
  return GET(req);
}
