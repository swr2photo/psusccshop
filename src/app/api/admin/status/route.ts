import { NextRequest, NextResponse } from 'next/server';
import { getJson, putJson, listKeys } from '@/lib/filebase';
import { requireAdminWithPermission } from '@/lib/auth';
import { triggerSheetSync } from '@/lib/sheet-sync';
import { sendOrderStatusEmail } from '@/lib/email';
import { ShopConfig } from '@/lib/config';
import crypto from 'crypto';

// Helper to save user log server-side
const userLogKey = (id: string) => `user-logs/${id}.json`;
interface LogEntry {
  id: string;
  email: string;
  name?: string;
  action: string;
  details?: string;
  metadata?: Record<string, any>;
  ip?: string;
  userAgent?: string;
  timestamp: string;
}
const saveUserLogServer = async (params: {
  email: string;
  name?: string;
  action: string;
  details?: string;
  metadata?: Record<string, any>;
  ip?: string;
  userAgent?: string;
}) => {
  try {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const entry: LogEntry = {
      id,
      email: params.email,
      name: params.name,
      action: params.action,
      details: params.details,
      metadata: params.metadata,
      ip: params.ip,
      userAgent: params.userAgent,
      timestamp: new Date().toISOString(),
    };
    await putJson(userLogKey(id), entry);
  } catch (e) {
    console.error('[Admin Status] Failed to save user log:', e);
  }
};

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
  // ตรวจสอบสิทธิ์ Admin + permission canManageOrders
  const authResult = await requireAdminWithPermission('canManageOrders');
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
          // For READY status, get pickup location from product settings
          let pickupOptions: { pickupLocation?: string; pickupNotes?: string } = {};
          if (status.toUpperCase() === 'READY') {
            const config = await getJson<ShopConfig>('config/shop-settings.json');
            if (config?.products) {
              const items = order.cart || order.items || [];
              const productIds = items.map((item: any) => item.productId || item.id).filter(Boolean);
              
              // Find products with pickup enabled that are in this order
              const productsWithPickup = config.products.filter(p => 
                p.pickup?.enabled && productIds.includes(p.id)
              );
              
              if (productsWithPickup.length > 0) {
                // Use first product's pickup location (or combine if multiple)
                const locations = [...new Set(productsWithPickup.map(p => p.pickup?.location).filter(Boolean))];
                const notes = [...new Set(productsWithPickup.map(p => p.pickup?.notes).filter(Boolean))];
                pickupOptions = {
                  pickupLocation: locations.join(' / '),
                  pickupNotes: notes.join(' / '),
                };
              }
            }
          }
          await sendOrderStatusEmail(order, status, pickupOptions);
        } catch (emailError) {
          console.error('[Status API] Failed to send email:', emailError);
          // Don't fail the request if email fails
        }
      }
      
      // Log admin action
      const userAgent = req.headers.get('user-agent') || undefined;
      const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 
                       req.headers.get('x-real-ip') || undefined;
      const statusLabels: Record<string, string> = {
        'PENDING': 'รอดำเนินการ',
        'PAID': 'ชำระเงินแล้ว',
        'PROCESSING': 'กำลังดำเนินการ',
        'READY': 'พร้อมรับสินค้า',
        'SHIPPED': 'จัดส่งแล้ว',
        'COMPLETED': 'เสร็จสิ้น',
        'CANCELLED': 'ยกเลิก',
      };
      await saveUserLogServer({
        email: authResult.email,
        action: 'admin_change_status',
        details: `เปลี่ยนสถานะ ${ref}: ${previousStatus} → ${status} (${statusLabels[status] || status})`,
        metadata: {
          ref,
          previousStatus,
          newStatus: status,
          cancelReason: body.cancelReason,
          trackingNumber: body.trackingNumber,
          sendEmail,
        },
        ip: clientIP,
        userAgent,
      });
    }
    // Auto sync to Google Sheets
    triggerSheetSync().catch(() => {});
    
    return NextResponse.json({ status: 'success' });
  } catch (error: any) {
    return NextResponse.json({ status: 'error', message: error?.message || 'update failed' }, { status: 500 });
  }
}
