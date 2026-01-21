import { NextRequest, NextResponse } from 'next/server';
import { getJson, putJson, listKeys } from '@/lib/filebase';
import { requireAdmin } from '@/lib/auth';
import { triggerSheetSync } from '@/lib/sheet-sync';
import { sendOrderStatusEmail } from '@/lib/email';
import crypto from 'crypto';

// Helper to generate email index key
const normalizeEmail = (email?: string | null) => (email || '').trim().toLowerCase();
const emailIndexKey = (email: string) => {
  const normalized = normalizeEmail(email);
  const hash = crypto.createHash('sha256').update(normalized).digest('hex');
  return `orders/index/${hash}.json`;
};

// Update order in user's index
const updateIndexEntry = async (email: string, order: any) => {
  const normalized = normalizeEmail(email);
  if (!normalized) return;
  const key = emailIndexKey(normalized);
  const existing = (await getJson<any[]>(key)) || [];
  // Replace existing entry with updated order
  const filtered = existing.filter((o) => o?.ref !== order?.ref);
  const next = [order, ...filtered].slice(0, 500);
  await putJson(key, next);
};

export async function POST(req: NextRequest) {
  // ตรวจสอบสิทธิ์ Admin
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const body = await req.json();
    const ref = body?.ref as string | undefined;
    const status = body?.status as string | undefined;
    const sendEmail = body?.sendEmail !== false; // Default to true
    
    if (!ref || !status) return NextResponse.json({ status: 'error', message: 'missing ref/status' }, { status: 400 });
    const keys = await listKeys('orders/');
    const targetKey = keys.find((k) => k.endsWith(`${ref}.json`));
    if (!targetKey) return NextResponse.json({ status: 'error', message: 'order not found' }, { status: 404 });
    const order = await getJson<any>(targetKey);
    if (order) {
      const previousStatus = order.status;
      order.status = status;
      
      // Add cancellation reason if provided
      if (body.cancelReason) {
        order.cancelReason = body.cancelReason;
      }
      
      // Add tracking info if provided
      if (body.trackingNumber) {
        order.trackingNumber = body.trackingNumber;
        order.shippingProvider = body.shippingProvider || '';
      }
      
      // Save order file
      await putJson(targetKey, order);
      
      // Update user's index so they see the new status immediately
      const customerEmail = order.customerEmail || order.email;
      if (customerEmail) {
        await updateIndexEntry(customerEmail, order);
      }
      
      // Send email notification if status changed and email is enabled
      if (sendEmail && previousStatus !== status && customerEmail) {
        try {
          await sendOrderStatusEmail(order, status);
        } catch (emailError) {
          console.error('[Status API] Failed to send email:', emailError);
          // Don't fail the request if email fails
        }
      }
    }
    // Auto sync to Google Sheets
    triggerSheetSync().catch(() => {});
    return NextResponse.json({ status: 'success' });
  } catch (error: any) {
    return NextResponse.json({ status: 'error', message: error?.message || 'update failed' }, { status: 500 });
  }
}
