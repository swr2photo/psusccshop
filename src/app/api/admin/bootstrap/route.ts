import { NextRequest, NextResponse } from 'next/server';
import { withBackendProxy } from '@/lib/backend-proxy';
import { requireAdmin } from '@/lib/auth';
import { assertShopAccess, resolveAdminSession } from '@/lib/admin-context';
import { getOrderStatusCounts } from '@/lib/filebase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Lightweight admin bootstrap — auth, role, order counts only. */
async function GETHandler(req: NextRequest) {
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;

  try {
    const session = await resolveAdminSession(authResult.email);
    const shopIdParam = new URL(req.url).searchParams.get('shopId')?.trim() || undefined;

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

    const orderStats = await getOrderStatusCounts(shopIds);

    return NextResponse.json(
      {
        status: 'success',
        data: {
          ...session,
          orderStats,
        },
      },
      { headers: { 'Content-Type': 'application/json; charset=utf-8' } },
    );
  } catch (error: any) {
    return NextResponse.json(
      { status: 'error', message: error?.message || 'bootstrap failed' },
      { status: 500 },
    );
  }
}

export const GET = withBackendProxy(GETHandler);
