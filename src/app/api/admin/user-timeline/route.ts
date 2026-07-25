// Unified per-user legal dossier for super-admins

import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth';
import { getUserTimeline } from '@/lib/audit';
import { RETENTION_DAYS } from '@/lib/retention';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const admin = await requireSuperAdmin(request);
  if (admin instanceof NextResponse) return admin;

  const email = new URL(request.url).searchParams.get('email')?.trim();
  if (!email) {
    return NextResponse.json({ error: 'email required' }, { status: 400 });
  }

  const limit = parseInt(new URL(request.url).searchParams.get('limit') || '200', 10);
  try {
    const { events, retentionDays } = await getUserTimeline(email, { limit });
    return NextResponse.json({
      success: true,
      email: email.trim().toLowerCase(),
      events,
      retentionDays,
      policy: {
        userActivityDays: RETENTION_DAYS.USER_ACTIVITY,
        auditTrailDays: RETENTION_DAYS.AUDIT_TRAIL,
        securityDays: RETENTION_DAYS.SECURITY,
        commerceDays: RETENTION_DAYS.COMMERCE,
      },
    });
  } catch (error: any) {
    console.error('[user-timeline]', error);
    return NextResponse.json({ error: error?.message || 'timeline failed' }, { status: 500 });
  }
}
