/**
 * Server-side audit + user activity writers (immutable trail + activity log).
 * Never throw to callers — logging must not break business flows.
 */

import { and, desc, eq, or, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { auditTrail, emailLogs, orders, securityAuditLog, userLogs } from '@/db/schema';
import { createHash } from 'crypto';
import { toIsoString } from '@/lib/safe-date';

export type AuditEntityType =
  | 'order'
  | 'user'
  | 'config'
  | 'permissions'
  | 'refund'
  | 'product'
  | 'shipping'
  | 'payment'
  | 'system'
  | string;

export interface AuditChanges {
  before?: unknown;
  after?: unknown;
  meta?: Record<string, unknown>;
  /** Subject user this event is about (may differ from performedBy) */
  subjectEmail?: string;
  summary?: string;
}

function normalizeEmail(email?: string | null): string {
  return (email || '').trim().toLowerCase();
}

export function clientIpFromRequest(req?: Request | null): string | undefined {
  if (!req) return undefined;
  const forwarded = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');
  if (!forwarded) return undefined;
  return forwarded.split(',')[0].trim();
}

export function userAgentFromRequest(req?: Request | null): string | undefined {
  if (!req) return undefined;
  return (req.headers.get('user-agent') || '').substring(0, 500) || undefined;
}

function emailHash(email: string): string {
  return createHash('sha256').update(normalizeEmail(email)).digest('hex');
}

function toIso(value: Date | string | null | undefined): string {
  return toIsoString(value, new Date(0).toISOString());
}

/** Insert immutable audit_trail row (before/after diffs). */
export async function writeAuditTrail(params: {
  entityType: AuditEntityType;
  entityId: string;
  action: string;
  performedBy: string;
  changes?: AuditChanges;
  ipAddress?: string;
  request?: Request | null;
}): Promise<void> {
  try {
    const performedBy = normalizeEmail(params.performedBy) || 'system';
    const subjectEmail = params.changes?.subjectEmail
      ? normalizeEmail(params.changes.subjectEmail)
      : undefined;

    await db.insert(auditTrail).values({
      entityType: params.entityType,
      entityId: String(params.entityId),
      action: params.action,
      performedBy,
      ipAddress: params.ipAddress || clientIpFromRequest(params.request) || null,
      changes: {
        ...(params.changes || {}),
        ...(subjectEmail ? { subjectEmail } : {}),
        recordedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[audit] writeAuditTrail failed:', error);
  }
}

/** Insert user_logs activity row (full IP / UA / metadata for admin). */
export async function writeUserActivityLog(params: {
  email: string;
  name?: string;
  action: string;
  details?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  request?: Request | null;
}): Promise<void> {
  try {
    const email = normalizeEmail(params.email);
    if (!email || !params.action) return;

    await db.insert(userLogs).values({
      email,
      name: params.name || null,
      action: params.action,
      details: params.details || null,
      metadata: params.metadata || null,
      ip: params.ip || clientIpFromRequest(params.request) || null,
      userAgent: params.userAgent || userAgentFromRequest(params.request) || null,
    });
  } catch (error) {
    console.error('[audit] writeUserActivityLog failed:', error);
  }
}

/** Convenience: activity log + audit trail for admin mutations affecting a subject. */
export async function recordAdminAction(params: {
  adminEmail: string;
  action: string;
  details: string;
  entityType: AuditEntityType;
  entityId: string;
  subjectEmail?: string;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
  request?: Request | null;
}): Promise<void> {
  const subject = normalizeEmail(params.subjectEmail) || normalizeEmail(params.adminEmail);
  await Promise.all([
    writeUserActivityLog({
      email: subject,
      action: params.action,
      details: params.details,
      metadata: {
        ...(params.metadata || {}),
        adminEmail: normalizeEmail(params.adminEmail),
        entityType: params.entityType,
        entityId: params.entityId,
      },
      request: params.request,
    }),
    writeAuditTrail({
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      performedBy: params.adminEmail,
      changes: {
        before: params.before,
        after: params.after,
        subjectEmail: subject,
        summary: params.details,
        meta: params.metadata,
      },
      request: params.request,
    }),
  ]);
}

export type TimelineSource =
  | 'user_log'
  | 'audit_trail'
  | 'security'
  | 'email'
  | 'order';

export interface TimelineEvent {
  id: string;
  source: TimelineSource;
  at: string;
  action: string;
  summary?: string;
  actorEmail?: string;
  subjectEmail?: string;
  ip?: string | null;
  userAgent?: string | null;
  /** Full detail payload for admin expand view */
  detail: Record<string, unknown>;
}

/** Unified per-user legal dossier timeline (super-admin). */
export async function getUserTimeline(
  email: string,
  options: { limit?: number } = {},
): Promise<{ events: TimelineEvent[]; retentionDays: number }> {
  const target = normalizeEmail(email);
  const limit = Math.min(Math.max(options.limit || 200, 1), 500);
  if (!target) return { events: [], retentionDays: 730 };

  const hash = emailHash(target);
  const perSource = Math.ceil(limit / 3);

  const [activity, audits, security, emails, userOrders] = await Promise.all([
    db
      .select()
      .from(userLogs)
      .where(eq(userLogs.email, target))
      .orderBy(desc(userLogs.createdAt))
      .limit(perSource),
    db
      .select()
      .from(auditTrail)
      .where(
        or(
          eq(auditTrail.performedBy, target),
          and(eq(auditTrail.entityType, 'user'), eq(auditTrail.entityId, target)),
          sql`(${auditTrail.changes}->>'subjectEmail') = ${target}`,
        ),
      )
      .orderBy(desc(auditTrail.createdAt))
      .limit(perSource),
    db
      .select()
      .from(securityAuditLog)
      .where(
        or(
          eq(securityAuditLog.userEmail, target),
          sql`(${securityAuditLog.details}->>'emailHash') = ${hash}`,
        ),
      )
      .orderBy(desc(securityAuditLog.createdAt))
      .limit(Math.min(perSource, 100)),
    db
      .select()
      .from(emailLogs)
      .where(eq(emailLogs.toEmail, target))
      .orderBy(desc(emailLogs.createdAt))
      .limit(Math.min(perSource, 100)),
    db
      .select({
        id: orders.id,
        ref: orders.ref,
        status: orders.status,
        totalAmount: orders.totalAmount,
        paymentStatus: orders.paymentStatus,
        refundStatus: orders.refundStatus,
        createdAt: orders.createdAt,
        updatedAt: orders.updatedAt,
        shippingOption: orders.shippingOption,
        trackingNumber: orders.trackingNumber,
      })
      .from(orders)
      .where(eq(orders.customerEmail, target))
      .orderBy(desc(orders.createdAt))
      .limit(50),
  ]);

  const events: TimelineEvent[] = [];

  for (const row of activity) {
    events.push({
      id: `ul-${row.id}`,
      source: 'user_log',
      at: toIso(row.createdAt),
      action: row.action,
      summary: row.details || undefined,
      actorEmail: row.email,
      subjectEmail: row.email,
      ip: row.ip,
      userAgent: row.userAgent,
      detail: {
        name: row.name,
        details: row.details,
        metadata: row.metadata,
        ip: row.ip,
        userAgent: row.userAgent,
      },
    });
  }

  for (const row of audits) {
    const changes = (row.changes || {}) as AuditChanges & Record<string, unknown>;
    events.push({
      id: `at-${row.id}`,
      source: 'audit_trail',
      at: toIso(row.createdAt),
      action: row.action,
      summary: (changes.summary as string) || `${row.entityType}/${row.entityId}`,
      actorEmail: row.performedBy,
      subjectEmail: (changes.subjectEmail as string) || undefined,
      ip: row.ipAddress,
      detail: {
        entityType: row.entityType,
        entityId: row.entityId,
        performedBy: row.performedBy,
        ipAddress: row.ipAddress,
        changes,
      },
    });
  }

  for (const row of security) {
    events.push({
      id: `sec-${row.id}`,
      source: 'security',
      at: toIso(row.createdAt),
      action: row.eventType,
      summary: 'security event',
      actorEmail: row.userEmail || undefined,
      subjectEmail: target,
      ip: row.ipAddress,
      userAgent: row.userAgent,
      detail: {
        eventType: row.eventType,
        userEmail: row.userEmail,
        ipAddress: row.ipAddress,
        userAgent: row.userAgent,
        details: row.details,
      },
    });
  }

  for (const row of emails) {
    events.push({
      id: `em-${row.id}`,
      source: 'email',
      at: toIso(row.sentAt || row.createdAt),
      action: `email_${row.status || 'unknown'}`,
      summary: row.subject || undefined,
      subjectEmail: row.toEmail,
      detail: {
        toEmail: row.toEmail,
        fromEmail: row.fromEmail,
        subject: row.subject,
        emailType: row.emailType,
        status: row.status,
        orderRef: row.orderRef,
        error: row.error,
      },
    });
  }

  for (const row of userOrders) {
    events.push({
      id: `ord-${row.id}`,
      source: 'order',
      at: toIso(row.createdAt),
      action: `order_${row.status}`,
      summary: `${row.ref} · ฿${row.totalAmount ?? 0}`,
      subjectEmail: target,
      detail: {
        ref: row.ref,
        status: row.status,
        totalAmount: row.totalAmount,
        paymentStatus: row.paymentStatus,
        refundStatus: row.refundStatus,
        shippingOption: row.shippingOption,
        trackingNumber: row.trackingNumber,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
    });
  }

  events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return {
    events: events.slice(0, limit),
    retentionDays: 730,
  };
}
