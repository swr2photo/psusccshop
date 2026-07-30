import { NextResponse } from 'next/server';
import { secureJsonRequest, secureJsonResponse } from '@/lib/payload-crypto';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET() {
  return await secureJsonResponse({ timestamp: new Date().toISOString() });
}
