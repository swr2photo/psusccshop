import { NextRequest, NextResponse } from 'next/server';
import { requireAdminWithPermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { inventoryLogs } from '@/db/schema';
import { desc } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Requires admin permission
  const authResult = await requireAdminWithPermission('canManageProducts', req);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');

    const logs = await db.select()
      .from(inventoryLogs)
      .orderBy(desc(inventoryLogs.createdAt))
      .limit(limit);

    return NextResponse.json({
      status: 'success',
      data: logs,
    });
  } catch (error: any) {
    console.error('[Inventory Logs API] Error:', error);
    return NextResponse.json(
      { status: 'error', message: 'Failed to fetch inventory logs' },
      { status: 500 }
    );
  }
}
