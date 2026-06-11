import { NextRequest, NextResponse } from 'next/server';
import { getShopConfig, getAllOrdersForAdminList } from '@/lib/filebase';
import { ShopConfig } from '@/lib/config';
import { requireAdmin } from '@/lib/auth';
import { sanitizeConfigForAdmin, sanitizeOrdersForAdmin } from '@/lib/sanitize';
import { mergeConfigAdminEmails, resolveAdminSession } from '@/lib/admin-context';

// Ensure Node runtime (uses Supabase client) and skip static caching
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // ตรวจสอบสิทธิ์ Admin (server-side: reads env vars at runtime)
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    // Get shop config using optimized Supabase query
    const cfg = (await getShopConfig()) || {
      isOpen: true,
      closeDate: '',
      announcement: { enabled: false, message: '', color: 'blue' },
      products: [],
      sheetId: '',
      sheetUrl: '',
      vendorSheetId: '',
      vendorSheetUrl: '',
    };
    
    const mergedCfg = mergeConfigAdminEmails(cfg as ShopConfig);
    const session = await resolveAdminSession(authResult.email);

    // Get pagination params
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const status = url.searchParams.get('status')?.split(',').filter(Boolean);
    const search = url.searchParams.get('search') || undefined;
    
    // Get orders using optimized Supabase query with pagination
    const { orders, total } = await getAllOrdersForAdminList({ limit, offset, status, search });
    
    const sanitizedConfig = sanitizeConfigForAdmin(mergedCfg as ShopConfig);
    const sanitizedOrders = sanitizeOrdersForAdmin(orders);
    
    return NextResponse.json(
      { 
        status: 'success', 
        data: { 
          config: sanitizedConfig, 
          orders: sanitizedOrders, 
          total,
          hasMore: offset + orders.length < total,
          logs: [],
          userRole: session.userRole,
          userEmail: session.userEmail,
          ...(session.shopAdminPermissions ? { shopAdminPermissions: session.shopAdminPermissions } : {}),
        } 
      },
      { headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  } catch (error: any) {
    return NextResponse.json({ status: 'error', message: error?.message || 'load failed' }, { status: 500 });
  }
}
