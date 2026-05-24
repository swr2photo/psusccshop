// src/app/api/cron/route.ts
// Unified Cron Orchestrator to bypass Vercel Hobby tier limit (max 2 cron jobs)
// Runs:
// - cancel-expired: every run
// - update-tracking: every run
// - cleanup: once a day (UTC 00:00)

import { NextRequest, NextResponse } from 'next/server';
import { GET as cancelExpired } from './cancel-expired/route';
import { GET as cleanup } from './cleanup/route';
import { GET as updateTracking } from './update-tracking/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }

  const authHeader = req.headers.get('authorization');
  const isVercelCron = req.headers.get('x-vercel-cron') === '1';
  const isValidSecret =
    authHeader === `Bearer ${cronSecret}` ||
    req.nextUrl.searchParams.get('secret') === cronSecret;

  if (!isVercelCron && !isValidSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[Cron Orchestrator] Starting unified cron job execution...');

  const results: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
  };

  // 1. Run Cancel Expired Orders
  try {
    const res = await cancelExpired(req);
    results.cancelExpired = await res.json().catch(() => ({ status: 'unknown_response' }));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    results.cancelExpired = { status: 'error', error: message };
  }

  // 2. Run Update Tracking (Always)
  try {
    const res = await updateTracking(req);
    results.updateTracking = await res.json().catch(() => ({ status: 'unknown_response' }));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    results.updateTracking = { status: 'error', error: message };
  }

  // 3. Run Cleanup (Once a day - UTC 00:00)
  const hour = new Date().getUTCHours();
  if (hour === 0) {
    try {
      const res = await cleanup(req);
      results.cleanup = await res.json().catch(() => ({ status: 'unknown_response' }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      results.cleanup = { status: 'error', error: message };
    }
  } else {
    results.cleanup = {
      status: 'skipped',
      reason: `Runs only at UTC 00:00 (Current UTC: ${hour}:00)`,
    };
  }

  return NextResponse.json({
    success: true,
    results,
  });
}

// POST is also forwarded to GET
export async function POST(req: NextRequest) {
  return GET(req);
}
