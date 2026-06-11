import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { resolveAdminSession } from '@/lib/admin-context';
import { getOrderStatusCounts } from '@/lib/filebase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Lightweight admin bootstrap — auth, role, order counts only. */
export async function GET() {
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;

  try {
    const session = await resolveAdminSession(authResult.email);
    const orderStats = await getOrderStatusCounts();

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
