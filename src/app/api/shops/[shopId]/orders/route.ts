// /api/shops/[shopId]/orders — Get shop orders
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, isSuperAdminEmail } from '@/lib/auth';
import { getShopAdminRole, getShopOrders } from '@/lib/shops';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ shopId: string }> };

/** GET /api/shops/[shopId]/orders — List orders for this shop */
export async function GET(req: NextRequest, { params }: Params) {
  const { shopId } = await params;
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;

  const isSuperAdmin = isSuperAdminEmail(authResult.email);
  if (!isSuperAdmin) {
    const role = await getShopAdminRole(shopId, authResult.email);
    if (!role || !role.permissions.canManageOrders) {
      return NextResponse.json({ status: 'error', message: 'ไม่มีสิทธิ์ดูออเดอร์' }, { status: 403 });
    }
  }

  const url = new URL(req.url);
  const limit = parseInt(url.searchParams.get('limit') || '100');
  const offset = parseInt(url.searchParams.get('offset') || '0');
  const status = url.searchParams.get('status')?.split(',').filter(Boolean);
  const search = url.searchParams.get('search') || undefined;

  const { orders, total } = await getShopOrders(shopId, { limit, offset, status, search });

  return NextResponse.json({
    status: 'success',
    orders,
    total,
    hasMore: offset + orders.length < total,
  });
}
