import { NextResponse } from 'next/server';
import { secureJsonRequest, secureJsonResponse } from '@/lib/payload-crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Retired one-time migration endpoint. */
export async function POST() {
  return await secureJsonResponse(
    { status: 'error', message: 'This migration endpoint has been retired' },
    { status: 410 }
  );
}
