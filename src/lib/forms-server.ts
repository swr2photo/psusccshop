// src/lib/forms-server.ts
// Server-only storage for forms (surveys / votes / sign-up sheets).
// Uses the existing key_value_store table so no schema migration is needed:
//   form:def:{formId}                  -> FormDefinition
//   form:resp:{formId}:{emailHash}     -> FormResponse   (UNIQUE key = one response per account)

import { createHash, randomBytes } from 'crypto';
import type { NextRequest, NextResponse } from 'next/server';
import { and, eq, inArray, like, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { keyValueStore } from '@/db/schema';
import { getCached, invalidateCachePrefix } from '@/lib/server-cache';
import {
  ANON_PREFIX,
  CHOICE_QUESTION_TYPES,
  describeAccess,
  formHasOptionQuotas,
  getFormAccess,
  getFormPdpa,
  isFormAcceptingResponses,
  validateFormAnswers,
  type FormDefinition,
  type FormListItem,
  type FormPdpaConsentRecord,
  type FormResponse,
} from '@/lib/forms';
import type { FormAiAnalysis } from '@/lib/form-ai-types';

const DEF_PREFIX = 'form:def:';
const RESP_PREFIX = 'form:resp:';
const AI_PREFIX = 'form:ai:';
const LIST_CACHE_KEY = 'forms:defs';
const LIST_TTL_MS = 15_000;

const safeId = (id: string) => String(id || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
const defKey = (formId: string) => `${DEF_PREFIX}${safeId(formId)}`;
const respPrefix = (formId: string) => `${RESP_PREFIX}${safeId(formId)}:`;
const aiKey = (formId: string) => `${AI_PREFIX}${safeId(formId)}`;

export function hashRespondent(email: string): string {
  return createHash('sha256').update(email.toLowerCase().trim()).digest('hex').slice(0, 32);
}

export function hashClientIp(ip: string | null | undefined): string | null {
  const s = String(ip || '').trim();
  if (!s) return null;
  return createHash('sha256').update(s).digest('hex').slice(0, 24);
}

const respKey = (formId: string, email: string) => `${respPrefix(formId)}${hashRespondent(email)}`;

async function loadAllDefinitions(): Promise<FormDefinition[]> {
  const rows = await db
    .select({ value: keyValueStore.value })
    .from(keyValueStore)
    .where(like(keyValueStore.key, `${DEF_PREFIX}%`));
  return rows
    .map((r) => r.value as unknown as FormDefinition)
    .filter((f) => f && f.id)
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

/** All form definitions (cached briefly; pass `{ fresh: true }` on admin reads). */
export async function listFormDefinitions(opts?: { fresh?: boolean }): Promise<FormDefinition[]> {
  if (opts?.fresh) return loadAllDefinitions();
  return getCached(LIST_CACHE_KEY, LIST_TTL_MS, loadAllDefinitions);
}

export async function getFormDefinition(formId: string): Promise<FormDefinition | null> {
  const id = safeId(formId);
  if (!id) return null;
  const rows = await db
    .select({ value: keyValueStore.value })
    .from(keyValueStore)
    .where(eq(keyValueStore.key, defKey(id)))
    .limit(1);
  return (rows[0]?.value as unknown as FormDefinition) || null;
}

export async function saveFormDefinition(form: FormDefinition): Promise<void> {
  await db
    .insert(keyValueStore)
    .values({ key: defKey(form.id), value: form as unknown as Record<string, unknown> })
    .onConflictDoUpdate({
      target: keyValueStore.key,
      set: { value: form as unknown as Record<string, unknown>, updatedAt: new Date() },
    });
  invalidateCachePrefix('forms:');
}

/** Deletes the form and all of its responses. */
export async function deleteFormDefinition(formId: string): Promise<void> {
  const id = safeId(formId);
  if (!id) return;
  await db.delete(keyValueStore).where(like(keyValueStore.key, `${respPrefix(id)}%`));
  await db.delete(keyValueStore).where(eq(keyValueStore.key, aiKey(id)));
  await db.delete(keyValueStore).where(eq(keyValueStore.key, defKey(id)));
  invalidateCachePrefix('forms:');
}

export async function getFormAiAnalysis(formId: string): Promise<FormAiAnalysis | null> {
  const id = safeId(formId);
  if (!id) return null;
  const rows = await db
    .select({ value: keyValueStore.value })
    .from(keyValueStore)
    .where(eq(keyValueStore.key, aiKey(id)))
    .limit(1);
  return (rows[0]?.value as unknown as FormAiAnalysis) || null;
}

export async function saveFormAiAnalysis(formId: string, analysis: FormAiAnalysis): Promise<void> {
  const id = safeId(formId);
  if (!id) return;
  await db
    .insert(keyValueStore)
    .values({ key: aiKey(id), value: analysis as unknown as Record<string, unknown> })
    .onConflictDoUpdate({
      target: keyValueStore.key,
      set: { value: analysis as unknown as Record<string, unknown>, updatedAt: new Date() },
    });
}

/** Response counts for every form in one query. */
export async function countResponsesByForm(): Promise<Record<string, number>> {
  const rows = await db.execute(sql`
    select split_part(${keyValueStore.key}, ':', 3) as form_id, count(*)::int as n
    from ${keyValueStore}
    where ${keyValueStore.key} like ${`${RESP_PREFIX}%`}
    group by 1
  `);
  const list = (Array.isArray(rows) ? rows : (rows as { rows?: unknown[] }).rows || []) as Array<{ form_id: string; n: number }>;
  return Object.fromEntries(list.map((r) => [String(r.form_id), Number(r.n) || 0]));
}

/** Form ids this account has already answered. */
export async function getRespondedFormIds(email: string): Promise<Set<string>> {
  const suffix = `:${hashRespondent(email)}`;
  const rows = await db
    .select({ key: keyValueStore.key })
    .from(keyValueStore)
    .where(and(like(keyValueStore.key, `${RESP_PREFIX}%`), like(keyValueStore.key, `%${suffix}`)));
  return new Set(rows.map((r) => r.key.slice(RESP_PREFIX.length).split(':')[0]));
}

export async function getUserResponse(formId: string, email: string): Promise<FormResponse | null> {
  const rows = await db
    .select({ value: keyValueStore.value })
    .from(keyValueStore)
    .where(eq(keyValueStore.key, respKey(formId, email)))
    .limit(1);
  return (rows[0]?.value as unknown as FormResponse) || null;
}

export async function listResponses(formId: string): Promise<FormResponse[]> {
  const rows = await db
    .select({ value: keyValueStore.value })
    .from(keyValueStore)
    .where(like(keyValueStore.key, `${respPrefix(formId)}%`));
  return rows
    .map((r) => r.value as unknown as FormResponse)
    .filter(Boolean)
    .sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt)));
}

/**
 * Compute option usage counts ONLY for options that define `maxChoices`, so normal poll tallies
 * are never leaked. Excludes `excludeEmail` (when editing an existing response).
 */
export function computeQuotaOptionCounts(
  form: FormDefinition,
  responses: FormResponse[],
  excludeEmail?: string | null,
): Record<string, Record<string, number>> {
  const quotaOptsByQ = new Map<string, Set<string>>();
  for (const q of form.questions) {
    if (!CHOICE_QUESTION_TYPES.includes(q.type)) continue;
    const ids = (q.options || []).filter((o) => Boolean(o.maxChoices && o.maxChoices > 0)).map((o) => o.id);
    if (ids.length > 0) quotaOptsByQ.set(q.id, new Set(ids));
  }
  if (quotaOptsByQ.size === 0) return {};

  const counts: Record<string, Record<string, number>> = {};
  for (const [qid, ids] of quotaOptsByQ.entries()) {
    counts[qid] = Object.fromEntries(Array.from(ids).map((id) => [id, 0]));
  }

  const excludeHash = excludeEmail ? hashRespondent(excludeEmail) : null;
  for (const r of responses) {
    if (excludeHash && hashRespondent(r.email) === excludeHash) continue;
    for (const [qid, trackedIds] of quotaOptsByQ.entries()) {
      const v = r.answers?.[qid];
      if (v === undefined || v === null || v === '') continue;
      for (const id of Array.isArray(v) ? v : [String(v)]) {
        if (trackedIds.has(String(id))) {
          counts[qid][String(id)] += 1;
        }
      }
    }
  }
  return counts;
}

/**
 * Store a response. When `allowUpdate` is false the insert is atomic "first wins"
 * (unique key), so double-clicks / parallel requests can never create two votes.
 * Returns 'created' | 'updated' | 'duplicate'.
 */
export async function submitResponse(
  response: FormResponse,
  allowUpdate: boolean,
): Promise<'created' | 'updated' | 'duplicate'> {
  const key = respKey(response.formId, response.email);
  const value = response as unknown as Record<string, unknown>;

  if (!allowUpdate) {
    const inserted = await db
      .insert(keyValueStore)
      .values({ key, value })
      .onConflictDoNothing({ target: keyValueStore.key })
      .returning({ id: keyValueStore.id });
    return inserted.length > 0 ? 'created' : 'duplicate';
  }

  const existing = await getUserResponse(response.formId, response.email);
  const merged: FormResponse = existing
    ? { ...response, submittedAt: existing.submittedAt, updatedAt: new Date().toISOString() }
    : response;
  await db
    .insert(keyValueStore)
    .values({ key, value: merged as unknown as Record<string, unknown> })
    .onConflictDoUpdate({
      target: keyValueStore.key,
      set: { value: merged as unknown as Record<string, unknown>, updatedAt: new Date() },
    });
  return existing ? 'updated' : 'created';
}

/**
 * Validate answers (including live option quotas under a per-form advisory transaction lock
 * when quotas exist) and persist the response atomically.
 */
export async function validateAndSubmitResponse(params: {
  form: FormDefinition;
  respondentEmail: string;
  respondentName: string | null;
  rawAnswers: unknown;
  pdpaConsent: FormPdpaConsentRecord | null;
}): Promise<
  | { ok: true; outcome: 'created' | 'updated' }
  | { ok: false; status: 400 | 409; error: string; questionId?: string }
> {
  const { form, respondentEmail, respondentName, rawAnswers, pdpaConsent } = params;
  const now = new Date().toISOString();

  if (!formHasOptionQuotas(form)) {
    const validated = validateFormAnswers(form, rawAnswers);
    if (!validated.ok) return { ok: false, status: 400, error: validated.error, questionId: validated.questionId };
    const response: FormResponse = {
      formId: form.id,
      email: respondentEmail,
      name: respondentName,
      answers: validated.answers,
      pdpaConsent,
      submittedAt: now,
      updatedAt: now,
    };
    const outcome = await submitResponse(response, form.allowEditResponse);
    if (outcome === 'duplicate') {
      return { ok: false, status: 409, error: 'คุณตอบแบบฟอร์มนี้ไปแล้ว' };
    }
    return { ok: true, outcome };
  }

  // Serialise concurrent submissions on the same form when option quotas are configured
  return await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`form:${form.id}`}))`);

    const rows = await tx
      .select({ value: keyValueStore.value })
      .from(keyValueStore)
      .where(like(keyValueStore.key, `${respPrefix(form.id)}%`));
    const allResponses = rows.map((r) => r.value as unknown as FormResponse).filter(Boolean);

    const key = respKey(form.id, respondentEmail);
    const existingRow = await tx
      .select({ value: keyValueStore.value })
      .from(keyValueStore)
      .where(eq(keyValueStore.key, key))
      .limit(1);
    const existing = (existingRow[0]?.value as unknown as FormResponse) || null;

    if (existing && !form.allowEditResponse) {
      return { ok: false, status: 409, error: 'คุณตอบแบบฟอร์มนี้ไปแล้ว' };
    }

    const optionCounts = computeQuotaOptionCounts(form, allResponses, existing ? respondentEmail : null);
    const validated = validateFormAnswers(form, rawAnswers, { optionCounts });
    if (!validated.ok) {
      return {
        ok: false,
        status: validated.error.includes('เต็มจำนวนแล้ว') ? 409 : 400,
        error: validated.error,
        questionId: validated.questionId,
      };
    }

    const merged: FormResponse = {
      formId: form.id,
      email: respondentEmail,
      name: respondentName,
      answers: validated.answers,
      pdpaConsent,
      submittedAt: existing?.submittedAt || now,
      updatedAt: now,
    };

    await tx
      .insert(keyValueStore)
      .values({ key, value: merged as unknown as Record<string, unknown> })
      .onConflictDoUpdate({
        target: keyValueStore.key,
        set: { value: merged as unknown as Record<string, unknown>, updatedAt: new Date() },
      });

    return { ok: true, outcome: existing ? 'updated' : 'created' };
  });
}

export async function deleteResponse(formId: string, emailHash: string): Promise<boolean> {
  const h = String(emailHash || '').replace(/[^a-f0-9]/g, '');
  if (!h) return false;
  const deleted = await db
    .delete(keyValueStore)
    .where(eq(keyValueStore.key, `${respPrefix(formId)}${h}`))
    .returning({ id: keyValueStore.id });
  return deleted.length > 0;
}

/** Delete form responses whose PDPA retention period (`pdpaConsent.expiresAt`) has passed. */
export async function cleanupExpiredFormResponses(): Promise<{ deletedResponses: number }> {
  const rows = await db
    .select({ key: keyValueStore.key, expiresAt: sql<string>`${keyValueStore.value}->'pdpaConsent'->>'expiresAt'` })
    .from(keyValueStore)
    .where(and(like(keyValueStore.key, `${RESP_PREFIX}%`), sql`${keyValueStore.value}->'pdpaConsent'->>'expiresAt' is not null`));

  const now = Date.now();
  const expiredKeys: string[] = [];
  for (const r of rows) {
    if (!r.expiresAt) continue;
    const t = Date.parse(r.expiresAt);
    if (Number.isFinite(t) && t < now) {
      expiredKeys.push(r.key);
    }
  }

  let deletedResponses = 0;
  for (let i = 0; i < expiredKeys.length; i += 100) {
    const chunk = expiredKeys.slice(i, i + 100);
    const res = await db
      .delete(keyValueStore)
      .where(inArray(keyValueStore.key, chunk))
      .returning({ id: keyValueStore.id });
    deletedResponses += res.length;
  }

  return { deletedResponses };
}

export function toListItem(
  form: FormDefinition,
  counts: Record<string, number>,
  responded?: Set<string>,
): FormListItem {
  return {
    id: form.id,
    title: form.title,
    description: form.description,
    banner: form.banner ?? null,
    accessMode: getFormAccess(form).mode,
    accessNote: describeAccess(getFormAccess(form)),
    pdpaEnabled: getFormPdpa(form).enabled,
    status: form.status,
    isAcceptingResponses: isFormAcceptingResponses(form),
    questionCount: form.questions.length,
    responseCount: counts[form.id] || 0,
    closesAt: form.closesAt,
    hasResponded: responded ? responded.has(form.id) : undefined,
    updatedAt: form.updatedAt,
  };
}

// ───────────── Anonymous respondents (public forms) ─────────────
// A random id in an httpOnly cookie stands in for the account, so a browser answers once.
// Clearing cookies / another browser can answer again — admins are told this in the editor.

export const ANON_COOKIE = 'scc_form_rid';

export function readAnonId(request: NextRequest): string | null {
  const v = request.cookies.get(ANON_COOKIE)?.value || '';
  return /^[a-f0-9]{32}$/.test(v) ? v : null;
}

export function newAnonId(): string {
  return randomBytes(16).toString('hex');
}

export function setAnonCookie(response: NextResponse, id: string): void {
  response.cookies.set(ANON_COOKIE, id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
}

export const anonRespondentKey = (id: string) => `${ANON_PREFIX}${id}`;
