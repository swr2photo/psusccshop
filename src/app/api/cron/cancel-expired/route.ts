// src/app/api/cron/cancel-expired/route.ts
// Cron job to auto-cancel orders that haven't been paid within 24 hours

import { NextRequest, NextResponse } from 'next/server';
import { putJson, getExpiredUnpaidOrders } from '@/lib/filebase';
import { sendOrderCancelledEmail } from '@/lib/email';
import { triggerSheetSync } from '@/lib/sheet-sync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// เวลาหมดอายุ (24 ชั่วโมง)
const EXPIRY_HOURS = 24;

// Secret key for cron authentication (ป้องกันไม่ให้ใครเรียกใช้ได้โดยตรง)
const CRON_SECRET = process.env.CRON_SECRET || 'psusccshop-cron-2026';

export async function GET(req: NextRequest) {
  // ตรวจสอบ authorization
  const authHeader = req.headers.get('authorization');
  const cronSecretFromHeader = authHeader?.replace('Bearer ', '');
  
  // รองรับทั้ง Vercel Cron และ manual call ด้วย secret
  const isVercelCron = req.headers.get('x-vercel-cron') === '1';
  const isValidSecret = cronSecretFromHeader === CRON_SECRET;
  
  if (!isVercelCron && !isValidSecret) {
    return NextResponse.json(
      { status: 'error', message: 'Unauthorized' },
      { status: 401 }
    );
  }

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
    
  } catch (error: any) {
    console.error('[Cron] Fatal error:', error);
    return NextResponse.json(
      { status: 'error', message: error.message || 'Cron job failed' },
      { status: 500 }
    );
  }
}

// POST method สำหรับ manual trigger จาก admin
export async function POST(req: NextRequest) {
  // ต้องมี secret key
  const body = await req.json().catch(() => ({}));
  const secret = body.secret;
  
  if (secret !== CRON_SECRET) {
    return NextResponse.json(
      { status: 'error', message: 'Invalid secret' },
      { status: 401 }
    );
  }
  
  // Redirect to GET handler
  return GET(req);
}
