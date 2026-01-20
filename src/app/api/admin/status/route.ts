import { NextRequest, NextResponse } from 'next/server';
import { getJson, putJson, listKeys } from '@/lib/filebase';
import { requireAdmin } from '@/lib/auth';
import { triggerSheetSync } from '@/lib/sheet-sync';
import { sendOrderStatusEmail } from '@/lib/email';

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
      
      await putJson(targetKey, order);
      
      // Send email notification if status changed and email is enabled
      if (sendEmail && previousStatus !== status && (order.customerEmail || order.email)) {
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
