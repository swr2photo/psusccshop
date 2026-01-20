// src/app/api/cron/cancel-expired/route.ts
// Cron job to auto-cancel orders that haven't been paid within 24 hours

import { NextRequest, NextResponse } from 'next/server';
import { getJson, putJson, listKeys } from '@/lib/filebase';
import { sendOrderCancelledEmail } from '@/lib/email';
import { triggerSheetSync } from '@/lib/sheet-sync';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// สถานะที่ยังไม่ได้ชำระเงิน
const UNPAID_STATUSES = ['PENDING', 'WAITING_PAYMENT', 'AWAITING_PAYMENT', 'UNPAID', 'DRAFT'];

// เวลาหมดอายุ (24 ชั่วโมง ในมิลลิวินาที)
const EXPIRY_HOURS = 24;
const EXPIRY_MS = EXPIRY_HOURS * 60 * 60 * 1000;

// Secret key for cron authentication (ป้องกันไม่ให้ใครเรียกใช้ได้โดยตรง)
const CRON_SECRET = process.env.CRON_SECRET || 'psusccshop-cron-2026';

const normalizeEmail = (email?: string | null) => (email || '').trim().toLowerCase();

const emailIndexKey = (email: string) => {
  const normalized = normalizeEmail(email);
  const hash = crypto.createHash('sha256').update(normalized).digest('hex');
  return `orders/index/${hash}.json`;
};

/**
 * อัปเดต index ของ email เมื่อ order ถูกยกเลิก
 */
const updateEmailIndex = async (email: string, updatedOrder: any) => {
  const normalized = normalizeEmail(email);
  if (!normalized) return;
  
  const key = emailIndexKey(normalized);
  const existing = (await getJson<any[]>(key)) || [];
  
  // Update order ใน index
  const updated = existing.map(o => 
    o.ref === updatedOrder.ref ? updatedOrder : o
  );
  
  await putJson(key, updated);
};

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
    
    const now = Date.now();
    const keys = await listKeys('orders/');
    
    let checkedCount = 0;
    let cancelledCount = 0;
    let errorCount = 0;
    const cancelledOrders: string[] = [];
    
    for (const key of keys) {
      // Skip index files
      if (key.includes('/index/')) continue;
      if (!key.endsWith('.json')) continue;
      
      checkedCount++;
      
      try {
        const order = await getJson<any>(key);
        if (!order) continue;
        
        const status = (order.status || '').toUpperCase();
        const orderDate = new Date(order.date || order.createdAt);
        const orderAge = now - orderDate.getTime();
        
        // ตรวจสอบว่าเป็น order ที่ยังไม่ชำระเงินและเกิน 24 ชั่วโมง
        if (UNPAID_STATUSES.includes(status) && orderAge > EXPIRY_MS) {
          console.log(`[Cron] Cancelling expired order: ${order.ref} (age: ${Math.round(orderAge / 3600000)}h)`);
          
          // อัปเดตสถานะเป็น CANCELLED
          const updatedOrder = {
            ...order,
            status: 'CANCELLED',
            cancelReason: 'ยกเลิกอัตโนมัติ: ไม่ได้ชำระเงินภายใน 24 ชั่วโมง',
            cancelledAt: new Date().toISOString(),
            cancelledBy: 'SYSTEM_AUTO',
          };
          
          await putJson(key, updatedOrder);
          
          // อัปเดต email index
          const email = order.customerEmail || order.email;
          if (email) {
            await updateEmailIndex(email, updatedOrder);
          }
          
          // ส่ง email แจ้งลูกค้า
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
        }
      } catch (orderError) {
        console.error(`[Cron] Error processing order ${key}:`, orderError);
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
      message: `Processed ${checkedCount} orders, cancelled ${cancelledCount}`,
      details: {
        checked: checkedCount,
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
