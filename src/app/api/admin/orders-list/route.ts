import { NextRequest, NextResponse } from 'next/server';
import { withBackendProxy } from '@/lib/backend-proxy';
import { requireAdmin } from '@/lib/auth';
import { assertShopAccess, resolveAdminSession } from '@/lib/admin-context';
import { getAllOrdersForAdminList } from '@/lib/filebase';
import { sanitizeOrdersForAdmin } from '@/lib/sanitize';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Paginated admin order list (slim payload). */
async function GETHandler(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const session = await resolveAdminSession(authResult.email);
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '100', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);
    const status = url.searchParams.get('status')?.split(',').filter(Boolean);
    const search = url.searchParams.get('search') || undefined;
    const shopIdParam = url.searchParams.get('shopId')?.trim() || undefined;

    let shopIds: string[] | undefined;

    if (session.userRole === 'shopAdmin') {
      if (session.assignedShopIds.length === 0) {
        return NextResponse.json(
          { status: 'error', message: 'ไม่มีร้านค้าที่ได้รับมอบหมาย' },
          { status: 403 },
        );
      }
      if (shopIdParam) {
        if (!assertShopAccess(session, shopIdParam)) {
          return NextResponse.json({ status: 'error', message: 'ไม่มีสิทธิ์เข้าถึงร้านค้านี้' }, { status: 403 });
        }
        shopIds = [shopIdParam];
      } else {
        shopIds = session.assignedShopIds;
      }
    } else if (shopIdParam) {
      shopIds = [shopIdParam];
    }

    const { orders, total } = await getAllOrdersForAdminList({ limit, offset, status, search, shopIds });
    const sanitizedOrders = sanitizeOrdersForAdmin(orders);

    return NextResponse.json(
      {
        status: 'success',
        data: {
          orders: sanitizedOrders,
          total,
          hasMore: offset + orders.length < total,
        },
      },
      { headers: { 'Content-Type': 'application/json; charset=utf-8' } },
    );
  } catch (error: any) {
    return NextResponse.json(
      { status: 'error', message: error?.message || 'orders load failed' },
      { status: 500 },
    );
  }
}

export const GET = withBackendProxy(GETHandler);
