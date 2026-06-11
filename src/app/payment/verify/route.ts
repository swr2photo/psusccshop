import { NextResponse } from 'next/server';

/** Legacy route — use POST /api/payment/verify instead */
export async function POST() {
  return NextResponse.json(
    { status: 'error', message: 'This endpoint is retired. Use /api/payment/verify' },
    { status: 410 }
  );
}
