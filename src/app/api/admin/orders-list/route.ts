import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { getAllOrdersForAdminList } from '@/lib/filebase';
import { sanitizeOrdersForAdmin } from '@/lib/sanitize';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Paginated admin order list (slim payload). */
export async function GET(req: NextRequest) {
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;

  try {
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '100', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);
    const status = url.searchParams.get('status')?.split(',').filter(Boolean);
    const search = url.searchParams.get('search') || undefined;

    const { orders, total } = await getAllOrdersForAdminList({ limit, offset, status, search });
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
