import { NextRequest, NextResponse } from 'next/server';
import { getJson, putJson, listKeys, getOrderByRef, getAllOrders, getSupabaseAdmin } from '@/lib/filebase';
import { requireAuth, requireAdmin, requireAdminWithPermission, isAdminEmail } from '@/lib/auth';
import { sanitizeUtf8Input } from '@/lib/sanitize';
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
    console.error('[Pickup] Failed to save user log:', e);
  }
};

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const orderKey = (ref: string, date: Date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `orders/${yyyy}-${mm}/${ref}.json`;
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

// GET - ดึงข้อมูล pickup status ของ order
export async function GET(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const ref = req.nextUrl.searchParams.get('ref');
  const search = req.nextUrl.searchParams.get('search');
  const isAdmin = isAdminEmail(authResult.email);

  try {
    // Admin search by ref/name/email - use Supabase directly for speed
    if (isAdmin && search) {
      const searchTerm = search.trim();
      const searchLower = searchTerm.toLowerCase();
      const results: any[] = [];
      
      // Try exact ref match first (fastest)
      const exactOrder = await getOrderByRef(searchTerm);
      if (exactOrder) {
        results.push({
          ref: exactOrder.ref,
          name: exactOrder.customerName || exactOrder.name,
          email: exactOrder.customerEmail || exactOrder.email,
          status: exactOrder.status,
          amount: exactOrder.totalAmount || exactOrder.amount,
          cart: exactOrder.cart || exactOrder.items || [],
          pickup: exactOrder.pickup,
          date: exactOrder.date,
        });
        return NextResponse.json({ status: 'success', data: results });
      }
      
      // If not exact match, search with Supabase ilike
      const db = getSupabaseAdmin();
      if (db) {
        const { data: orders, error } = await db
          .from('orders')
          .select('*')
          .or(`ref.ilike.%${searchTerm}%,customer_name.ilike.%${searchTerm}%,customer_email.ilike.%${searchTerm}%`)
          .limit(50);
        
        if (!error && orders) {
          for (const order of orders) {
            results.push({
              ref: order.ref,
              name: order.customer_name,
              email: order.customer_email,
              status: order.status,
              amount: order.total_amount,
              cart: order.cart || [],
              pickup: order.pickup,
              date: order.created_at,
            });
          }
        }
      }
      
      // Fallback to old method if no results
      if (results.length === 0) {
        const keys = await listKeys('orders/');
        for (const key of keys) {
          const order = await getJson<any>(key);
          if (!order) continue;
          
          const matchRef = order.ref?.toLowerCase().includes(searchLower);
          const matchName = order.customerName?.toLowerCase().includes(searchLower) ||
                           order.name?.toLowerCase().includes(searchLower);
          const matchEmail = order.customerEmail?.toLowerCase().includes(searchLower) ||
                            order.email?.toLowerCase().includes(searchLower);
          
          if (matchRef || matchName || matchEmail) {
            results.push({
              ref: order.ref,
              name: order.customerName || order.name,
              email: order.customerEmail || order.email,
              status: order.status,
              amount: order.totalAmount || order.amount,
              cart: order.cart || order.items || [],
              pickup: order.pickup,
              date: order.date,
            });
          }
          
          if (results.length >= 50) break;
        }
      }
      
      return NextResponse.json({ status: 'success', data: results });
    }

    // Get single order pickup status - use getOrderByRef for speed
    if (ref) {
      const order = await getOrderByRef(ref);
      
      if (!order) {
        return NextResponse.json(
          { status: 'error', message: 'Order not found' },
          { status: 404 }
        );
      }

      // Check ownership if not admin
      if (!isAdmin) {
        const ownerEmail = (order.customerEmail || order.email || '').toLowerCase();
        if (ownerEmail !== authResult.email.toLowerCase()) {
          return NextResponse.json(
            { status: 'error', message: 'Unauthorized' },
            { status: 403 }
          );
        }
      }

      return NextResponse.json({
        status: 'success',
        data: {
          ref: order.ref,
          name: order.customerName || order.name,
          email: order.customerEmail || order.email,
          status: order.status,
          amount: order.totalAmount || order.amount,
          cart: order.cart || order.items || [],
          pickup: order.pickup,
          date: order.date,
        },
      });
    }

    return NextResponse.json(
      { status: 'error', message: 'Missing ref or search parameter' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('[Pickup API] Error:', error);
    return NextResponse.json(
      { status: 'error', message: error?.message || 'Failed to get pickup info' },
      { status: 500 }
    );
  }
}

// POST - อัปเดต pickup status (admin only)
export async function POST(req: NextRequest) {
  const authResult = await requireAdminWithPermission('canManagePickup');
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const body = await req.json();
    const ref = sanitizeUtf8Input(body?.ref);
    const action = body?.action as 'pickup' | 'cancel';
    const notes = sanitizeUtf8Input(body?.notes);
    const condition = body?.condition as 'complete' | 'partial' | 'damaged' | undefined;

    if (!ref) {
      return NextResponse.json(
        { status: 'error', message: 'Missing order ref' },
        { status: 400 }
      );
    }

    const keys = await listKeys('orders/');
    const targetKey = keys.find(k => k.endsWith(`${ref}.json`));

    if (!targetKey) {
      return NextResponse.json(
        { status: 'error', message: 'Order not found' },
        { status: 404 }
      );
    }

    const order = await getJson<any>(targetKey);
    if (!order) {
      return NextResponse.json(
        { status: 'error', message: 'Order not found' },
        { status: 404 }
      );
    }

    // Check if order is eligible for pickup
    if (action === 'pickup') {
      if (!['READY', 'SHIPPED', 'PAID'].includes(order.status)) {
        return NextResponse.json(
          { status: 'error', message: 'Order is not ready for pickup. Status must be READY, SHIPPED, or PAID.' },
          { status: 400 }
        );
      }

      // Update order with pickup info
      const updatedOrder = {
        ...order,
        status: 'COMPLETED',
        pickup: {
          pickedUp: true,
          pickedUpAt: new Date().toISOString(),
          pickedUpBy: authResult.email,
          condition: condition || 'complete',
          notes: notes || '',
        },
      };

      await putJson(targetKey, updatedOrder);
      
      // Update user's index so they see the new status immediately
      const customerEmail = order.customerEmail || order.email;
      if (customerEmail) {
        await updateIndexEntry(customerEmail, updatedOrder);
      }

      // Log pickup action
      const userAgent = req.headers.get('user-agent') || undefined;
      const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 
                       req.headers.get('x-real-ip') || undefined;
      await saveUserLogServer({
        email: authResult.email,
        action: 'admin_pickup_confirm',
        details: `ยืนยันรับสินค้า ${ref} (${order.customerName || 'ไม่ระบุชื่อ'})`,
        metadata: {
          ref,
          customerEmail,
          customerName: order.customerName || order.name,
          condition: condition || 'complete',
          notes,
        },
        ip: clientIP,
        userAgent,
      });

      return NextResponse.json({
        status: 'success',
        message: 'Order marked as picked up',
        data: {
          ref: updatedOrder.ref,
          pickup: updatedOrder.pickup,
        },
      });
    }

    // Cancel pickup (revert)
    if (action === 'cancel') {
      const updatedOrder = {
        ...order,
        status: 'READY',
        pickup: {
          ...order.pickup,
          pickedUp: false,
          cancelledAt: new Date().toISOString(),
          cancelledBy: authResult.email,
        },
      };

      await putJson(targetKey, updatedOrder);

      // Log pickup cancel action
      const userAgent = req.headers.get('user-agent') || undefined;
      const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 
                       req.headers.get('x-real-ip') || undefined;
      await saveUserLogServer({
        email: authResult.email,
        action: 'admin_pickup_cancel',
        details: `ยกเลิกการรับสินค้า ${ref}`,
        metadata: { ref, customerEmail: order.customerEmail || order.email },
        ip: clientIP,
        userAgent,
      });

      return NextResponse.json({
        status: 'success',
        message: 'Pickup cancelled',
        data: {
          ref: updatedOrder.ref,
          pickup: updatedOrder.pickup,
        },
      });
    }

    return NextResponse.json(
      { status: 'error', message: 'Invalid action' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('[Pickup API] Error:', error);
    return NextResponse.json(
      { status: 'error', message: error?.message || 'Failed to update pickup' },
      { status: 500 }
    );
  }
}
