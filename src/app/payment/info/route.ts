import { NextResponse } from 'next/server';

/** Legacy route — use GET /api/payment-info?ref= instead */
export async function POST() {
  return NextResponse.json(
    { status: 'error', message: 'This endpoint is retired. Use /api/payment-info' },
    { status: 410 }
  );
}
