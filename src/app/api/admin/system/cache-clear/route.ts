import { NextRequest, NextResponse } from 'next/server';
import { requireAdminWithPermission } from '@/lib/auth';
import { invalidateAllCache } from '@/lib/server-cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const authResult = await requireAdminWithPermission('canManageShop', req);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    invalidateAllCache();
    
    return NextResponse.json({
      status: 'success',
      message: 'System caches cleared successfully.',
    });
  } catch (error: any) {
    console.error('[Cache Clear API] Error:', error);
    return NextResponse.json(
      { status: 'error', message: 'Failed to clear cache' },
      { status: 500 }
    );
  }
}
