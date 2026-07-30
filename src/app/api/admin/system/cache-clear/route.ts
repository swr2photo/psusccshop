import { NextRequest, NextResponse } from 'next/server';
import { requireAdminWithPermission } from '@/lib/auth';
import { invalidateAllCache } from '@/lib/server-cache';
import { secureJsonRequest, secureJsonResponse } from '@/lib/payload-crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const authResult = await requireAdminWithPermission('canManageShop', req);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    invalidateAllCache();
    
    return await secureJsonResponse({
      status: 'success',
      message: 'System caches cleared successfully.',
    });
  } catch (error: any) /* eslint-disable-line @typescript-eslint/no-explicit-any */ {
    console.error('[Cache Clear API] Error:', error);
    return await secureJsonResponse(
      { status: 'error', message: 'Failed to clear cache' },
      { status: 500 }
    );
  }
}
