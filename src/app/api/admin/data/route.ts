import { NextRequest, NextResponse } from 'next/server';
import { getShopConfig, getAllOrders } from '@/lib/filebase';
import { ShopConfig } from '@/lib/config';
import { requireAdmin, isSuperAdminEmail, ADMIN_EMAILS } from '@/lib/auth';
import { sanitizeConfigForAdmin, sanitizeOrdersForAdmin } from '@/lib/sanitize';

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
    // Determine user role (server-validated)
    const userRole = isSuperAdminEmail(authResult.email) ? 'superadmin' : 'admin';

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
    
    // Merge env-var admin emails into config's adminEmails for the client
    // This ensures the client knows about ALL admins (env vars + config JSON)
    const configAdminEmails = ((cfg as any).adminEmails || []).map((e: string) => e.trim().toLowerCase());
    const mergedAdminEmails = [...new Set([...ADMIN_EMAILS, ...configAdminEmails])].filter(Boolean);
    (cfg as any).adminEmails = mergedAdminEmails;
    
    // Get pagination params
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const status = url.searchParams.get('status')?.split(',').filter(Boolean);
    const search = url.searchParams.get('search') || undefined;
    
    // Get orders using optimized Supabase query with pagination
    const { orders, total } = await getAllOrders({ limit, offset, status, search });
    
    // Sanitize: Admin เห็นได้มากกว่า แต่ยังต้องซ่อน raw slip base64
    const sanitizedConfig = sanitizeConfigForAdmin(cfg as ShopConfig);
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
          // Server-validated role — client MUST trust this instead of re-checking env vars
          userRole,
          userEmail: authResult.email,
        } 
      },
      { headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  } catch (error: any) {
    return NextResponse.json({ status: 'error', message: error?.message || 'load failed' }, { status: 500 });
  }
}
