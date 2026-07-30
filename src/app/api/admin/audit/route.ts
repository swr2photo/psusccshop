// Persist admin "system history" + list recent audit_trail (super-admin)

import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin, requireAdmin } from '@/lib/auth';
import { writeAuditTrail, writeUserActivityLog } from '@/lib/audit';
import { db } from '@/lib/db';
import { auditTrail } from '@/db/schema';
import { desc, eq } from 'drizzle-orm';
import { secureJsonRequest, secureJsonResponse } from '@/lib/payload-crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET recent audit trail (optional entityType filter) */
export async function GET(request: NextRequest) {
  const admin = await requireSuperAdmin(request);
  if (admin instanceof NextResponse) return admin;

  const { searchParams } = new URL(request.url);
  const entityType = searchParams.get('entityType') || undefined;
  const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 300);

  try {
    const rows = entityType
      ? await db
          .select()
          .from(auditTrail)
          .where(eq(auditTrail.entityType, entityType))
          .orderBy(desc(auditTrail.createdAt))
          .limit(limit)
      : await db.select().from(auditTrail).orderBy(desc(auditTrail.createdAt)).limit(limit);

    return await secureJsonResponse({
      success: true,
      logs: rows.map((r) => ({
        id: r.id,
        entityType: r.entityType,
        entityId: r.entityId,
        action: r.action,
        changes: r.changes,
        performedBy: r.performedBy,
        ipAddress: r.ipAddress,
        timestamp: r.createdAt,
      })),
    });
  } catch (error: any) /* eslint-disable-line @typescript-eslint/no-explicit-any */ {
    console.error('[admin/audit] GET', error);
    return await secureJsonResponse({ error: error?.message || 'failed' }, { status: 500 });
  }
}

/**
 * POST — durable admin system log (replaces localStorage-only ประวัติระบบ).
 * Body: { action, detail, entityType?, entityId?, subjectEmail?, before?, after?, metadata? }
 */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;

  try {
    const body = await secureJsonRequest(request);
    const action = String(body.action || '').trim();
    const detail = String(body.detail || body.details || '').trim();
    if (!action) {
      return await secureJsonResponse({ error: 'action required' }, { status: 400 });
    }

    const entityType = String(body.entityType || 'system');
    const entityId = String(body.entityId || action);
    const subjectEmail = body.subjectEmail ? String(body.subjectEmail) : admin.email;

    await writeAuditTrail({
      entityType,
      entityId,
      action,
      performedBy: admin.email,
      changes: {
        before: body.before,
        after: body.after,
        subjectEmail,
        summary: detail,
        meta: body.metadata,
      },
      request,
    });

    await writeUserActivityLog({
      email: subjectEmail,
      action: action.startsWith('admin_') ? action : `admin_${action.toLowerCase()}`,
      details: detail || action,
      metadata: {
        adminEmail: admin.email,
        entityType,
        entityId,
        ...(body.metadata || {}),
      },
      request,
    });

    return await secureJsonResponse({ success: true });
  } catch (error: any) /* eslint-disable-line @typescript-eslint/no-explicit-any */ {
    console.error('[admin/audit] POST', error);
    return await secureJsonResponse({ error: error?.message || 'failed' }, { status: 500 });
  }
}
