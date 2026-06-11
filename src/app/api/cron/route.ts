// src/app/api/cron/route.ts
// Unified Cron Orchestrator to bypass Vercel Hobby tier limit (max 2 cron jobs)
// Runs:
// - cancel-expired: every run
// - update-tracking: every run
// - cleanup: once a day (UTC 00:00)

import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { GET as cancelExpired } from './cancel-expired/route';
import { GET as cleanup } from './cleanup/route';
import { GET as updateTracking } from './update-tracking/route';
import { withCronMonitor } from '@/lib/sentry-cron';
import { recordCronRun } from '@/lib/sentry-metrics';
import { verifyCronAuth } from '@/lib/cron-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const authError = verifyCronAuth(req);
  if (authError) return authError;

  return withCronMonitor(
    {
      monitorSlug: 'vercel-unified-cron',
      schedule: '0 0 * * *',
      maxRuntime: 15,
    },
    async () => {
      console.log('[Cron Orchestrator] Starting unified cron job execution...');

      const results: Record<string, unknown> = {
        timestamp: new Date().toISOString(),
      };
      let hasError = false;

      // 1. Run Cancel Expired Orders
      try {
        const res = await cancelExpired(req);
        results.cancelExpired = await res.json().catch(() => ({ status: 'unknown_response' }));
      } catch (err: unknown) {
        hasError = true;
        const message = err instanceof Error ? err.message : String(err);
        results.cancelExpired = { status: 'error', error: message };
        Sentry.captureException(err);
      }

      // 2. Run Update Tracking (Always)
      try {
        const res = await updateTracking(req);
        results.updateTracking = await res.json().catch(() => ({ status: 'unknown_response' }));
      } catch (err: unknown) {
        hasError = true;
        const message = err instanceof Error ? err.message : String(err);
        results.updateTracking = { status: 'error', error: message };
        Sentry.captureException(err);
      }

      // 3. Run Cleanup
      try {
        const res = await cleanup(req);
        results.cleanup = await res.json().catch(() => ({ status: 'unknown_response' }));
      } catch (err: unknown) {
        hasError = true;
        const message = err instanceof Error ? err.message : String(err);
        results.cleanup = { status: 'error', error: message };
        Sentry.captureException(err);
      }

      if (hasError) {
        recordCronRun('vercel-unified-cron', 'failed');
        return NextResponse.json({ success: false, results }, { status: 500 });
      }

      recordCronRun('vercel-unified-cron', 'success');
      return NextResponse.json({
        success: true,
        results,
      });
    }
  );
}

// POST is also forwarded to GET
export async function POST(req: NextRequest) {
  return GET(req);
}
