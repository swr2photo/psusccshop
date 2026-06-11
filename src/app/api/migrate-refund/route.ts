import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Retired one-time migration endpoint. */
export async function POST() {
  return NextResponse.json(
    { status: 'error', message: 'This migration endpoint has been retired' },
    { status: 410 }
  );
}
