import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { updateShopOpenStatus } from '@/lib/filebase';
import { secureJsonRequest, secureJsonResponse } from '@/lib/payload-crypto';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/toggle-shop
 * 
 * Secure endpoint to toggle shop open/closed status.
 * Requires admin authentication.
 */
export async function POST(req: NextRequest) {
  // Verify administrator permissions
  const authResult = await requireAdmin(req);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const body = await secureJsonRequest(req);
    const isOpen = body?.isOpen;

    if (isOpen === undefined || typeof isOpen !== 'boolean') {
      return await secureJsonResponse(
        { status: 'error', message: 'missing or invalid isOpen field' },
        { status: 400, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      );
    }

    // Update configuration in primary database/S3 and sync to Redis
    await updateShopOpenStatus(isOpen);

    return await secureJsonResponse(
      { status: 'success', data: { isOpen } },
      { headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  } catch (error: any) /* eslint-disable-line @typescript-eslint/no-explicit-any */ {
    console.error('[Toggle Shop API] Error:', error);
    return await secureJsonResponse(
      { status: 'error', message: error?.message || 'Failed to toggle shop status' },
      { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  }
}
