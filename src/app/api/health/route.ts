import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET() {
  const checks: Record<string, any> = {
    timestamp: new Date().toISOString(),
    status: 'healthy',
  };

  try {
    const start = Date.now();
    await db.execute(sql`SELECT 1`);
    checks.db = {
      status: 'up',
      latencyMs: Date.now() - start,
    };
  } catch (error: any) {
    checks.db = {
      status: 'down',
      error: error?.message || 'Database connection failed',
    };
    checks.status = 'unhealthy';
  }

  // Determine overall HTTP status
  const statusCode = checks.status === 'healthy' ? 200 : 503;
  return NextResponse.json(checks, { status: statusCode });
}
