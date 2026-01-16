import { NextRequest, NextResponse } from 'next/server';
import { getJson, putJson, listKeys, deleteObject } from '@/lib/filebase';
import crypto from 'crypto';
import { requireAuth, requireAdmin, isAdminEmail, isResourceOwner, normalizeEmail as authNormalizeEmail } from '@/lib/auth';

const orderKey = (ref: string, date: Date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `orders/${yyyy}-${mm}/${ref}.json`;
};

const generateRef = () => `ORD-${Date.now()}`;

const normalizeEmail = (email?: string | null) => (email || '').trim().toLowerCase();

const emailIndexKey = (email: string) => {
  const normalized = normalizeEmail(email);
  const hash = crypto.createHash('sha256').update(normalized).digest('hex');
  return `orders/index/${hash}.json`;
};

const INDEX_CACHE_TTL_MS = 60_000;
const indexCache = new Map<string, { data: any[]; expires: number }>();

const getCachedIndex = (key: string) => {
  const cached = indexCache.get(key);
  if (!cached) return null;
  if (cached.expires < Date.now()) {
    indexCache.delete(key);
    return null;
  }
  return cached.data;
};

const setCachedIndex = (key: string, data: any[]) => {
  indexCache.set(key, { data, expires: Date.now() + INDEX_CACHE_TTL_MS });
};

const upsertIndexEntry = async (email: string, order: any) => {
  const normalized = normalizeEmail(email);
  if (!normalized) return;
  const key = emailIndexKey(normalized);
  indexCache.delete(key);
  const existing = (await getJson<any[]>(key)) || [];
  const filtered = existing.filter((o) => o?.ref !== order?.ref);
  const next = [order, ...filtered].slice(0, 500);
  await putJson(key, next);
};

const removeIndexEntry = async (email: string, ref: string) => {
  const normalized = normalizeEmail(email);
  if (!normalized) return;
  const key = emailIndexKey(normalized);
  indexCache.delete(key);
  const existing = (await getJson<any[]>(key)) || [];
  const filtered = existing.filter((o) => o?.ref !== ref);
  await putJson(key, filtered);
};

export async function GET(req: NextRequest) {
  // ต้องเข้าสู่ระบบก่อนถึงจะดู orders ได้
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  const currentUserEmail = authResult.email;
  const isAdmin = isAdminEmail(currentUserEmail);

  const email = req.nextUrl.searchParams.get('email');
  const cursor = req.nextUrl.searchParams.get('cursor');
  const limitParam = Number(req.nextUrl.searchParams.get('limit'));
  const limit = Number.isFinite(limitParam) ? Math.min(100, Math.max(10, limitParam)) : 50;

  // ถ้าไม่ใช่ admin ต้องดู orders ของตัวเองเท่านั้น
  const queryEmail = isAdmin && email ? email : currentUserEmail;

  try {
    const normalizedEmail = normalizeEmail(queryEmail);
    if (normalizedEmail) {
      const key = emailIndexKey(normalizedEmail);
      const cached = getCachedIndex(key);
      const indexed = cached || (await getJson<any[]>(key));
      if (indexed) {
        if (!cached) setCachedIndex(key, indexed);
        const startIdx = cursor ? Math.max(0, indexed.findIndex((o) => o?.ref === cursor) + 1) : 0;
        const slice = indexed.slice(startIdx, startIdx + limit);
        const hasMore = startIdx + limit < indexed.length;
        const nextCursor = hasMore ? indexed[startIdx + limit - 1]?.ref : null;
        return NextResponse.json({ status: 'success', data: { history: slice, hasMore, nextCursor } });
      }
    }

    const keys = await listKeys('orders/');
    const sorted = [...keys].sort().reverse();
    const startIndex = cursor ? sorted.findIndex((k) => k.endsWith(`${cursor}.json`)) + 1 : 0;
    const matches: any[] = [];
    const indexBucket: any[] = [];
    const targetEmail = normalizedEmail;

    for (let i = startIndex; i < sorted.length; i += 1) {
      const data = await getJson<any>(sorted[i]);
      if (!data) continue;
      if (normalizedEmail && normalizeEmail(data.customerEmail) !== targetEmail) {
        continue;
      }

      const enriched = { ...data, _key: sorted[i] };
      matches.push(enriched);
      if (normalizedEmail && indexBucket.length < 500) {
        indexBucket.push(enriched);
      }

      if (matches.length > limit && (!normalizedEmail || indexBucket.length >= 500)) break;
    }

    const hasMore = matches.length > limit;
    const history = hasMore ? matches.slice(0, limit) : matches;
    const nextCursor = hasMore ? matches[limit]?.ref ?? null : null;

    if (normalizedEmail && indexBucket.length > 0) {
      const key = emailIndexKey(normalizedEmail);
      await putJson(key, indexBucket);
      setCachedIndex(key, indexBucket);
    }

    return NextResponse.json({ status: 'success', data: { history, hasMore, nextCursor } });
  } catch (error: any) {
    return NextResponse.json({ status: 'error', message: error?.message || 'load failed' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const ref = body?.ref || generateRef();
    const now = new Date();
    const order = {
      ref,
      date: now.toISOString(),
      status: 'WAITING_PAYMENT',
      ...body,
    };
    const key = orderKey(ref, now);
    await putJson(key, order);
    if (order.customerEmail) {
      await upsertIndexEntry(order.customerEmail, order);
    }
    return NextResponse.json({ status: 'success', ref });
  } catch (error: any) {
    return NextResponse.json({ status: 'error', message: error?.message || 'submit failed' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  // ต้องเข้าสู่ระบบก่อน
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  const currentUserEmail = authResult.email;
  const isAdmin = isAdminEmail(currentUserEmail);

  try {
    const body = await req.json();
    const ref = body?.ref as string | undefined;
    const updates = body?.data as Record<string, any> | undefined;
    if (!ref || !updates) return NextResponse.json({ status: 'error', message: 'missing ref/data' }, { status: 400 });

    const keys = await listKeys('orders/');
    const targetKey = keys.find((k) => k.endsWith(`${ref}.json`));
    if (!targetKey) return NextResponse.json({ status: 'error', message: 'order not found' }, { status: 404 });

    const existing = (await getJson<any>(targetKey)) || {};

    // ตรวจสอบว่าเป็นเจ้าของ order หรือเป็น admin
    const orderEmail = existing.customerEmail || existing.email;
    if (!isResourceOwner(orderEmail, currentUserEmail) && !isAdmin) {
      return NextResponse.json({ status: 'error', message: 'ไม่มีสิทธิ์แก้ไข order นี้' }, { status: 403 });
    }

    // User ปกติแก้ไขได้เฉพาะบางฟิลด์
    const userAllowedFields = ['customerName', 'customerPhone', 'customerAddress', 'name', 'phone', 'address', 'notes'];
    // Admin แก้ไขได้มากกว่า
    const adminAllowedFields = ['customerName', 'customerEmail', 'customerPhone', 'customerAddress', 'name', 'email', 'phone', 'address', 'amount', 'totalAmount', 'status', 'date', 'notes'];
    const allowedFields = isAdmin ? adminAllowedFields : userAllowedFields;

    const sanitizedUpdates: Record<string, any> = {};
    Object.entries(updates).forEach(([key, value]) => {
      if (allowedFields.includes(key)) sanitizedUpdates[key] = value;
    });

    const next = { ...existing, ...sanitizedUpdates };
    await putJson(targetKey, next);
    if (next.customerEmail) {
      await upsertIndexEntry(next.customerEmail, next);
    }
    return NextResponse.json({ status: 'success', data: next });
  } catch (error: any) {
    return NextResponse.json({ status: 'error', message: error?.message || 'update failed' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  // ต้องเข้าสู่ระบบก่อน
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  const currentUserEmail = authResult.email;
  const isAdmin = isAdminEmail(currentUserEmail);

  const ref = req.nextUrl.searchParams.get('ref');
  const hard = req.nextUrl.searchParams.get('hard') === 'true';
  if (!ref) return NextResponse.json({ status: 'error', message: 'missing ref' }, { status: 400 });

  // Hard delete ทำได้เฉพาะ admin
  if (hard && !isAdmin) {
    return NextResponse.json({ status: 'error', message: 'เฉพาะ admin เท่านั้นที่ลบถาวรได้' }, { status: 403 });
  }

  try {
    const keys = await listKeys('orders/');
    const targetKey = keys.find((k) => k.endsWith(`${ref}.json`));
    if (!targetKey) return NextResponse.json({ status: 'error', message: 'order not found' }, { status: 404 });

    const existing = await getJson<any>(targetKey);
    const orderEmail = existing?.customerEmail || existing?.email;

    // ตรวจสอบสิทธิ์
    if (!isResourceOwner(orderEmail, currentUserEmail) && !isAdmin) {
      return NextResponse.json({ status: 'error', message: 'ไม่มีสิทธิ์ลบ order นี้' }, { status: 403 });
    }

    if (hard) {
      if (existing?.customerEmail) {
        await removeIndexEntry(existing.customerEmail, ref);
      }
      await deleteObject(targetKey);
      return NextResponse.json({ status: 'success', message: 'deleted' });
    }

    const order = await getJson<any>(targetKey);
    if (order) {
      order.status = 'CANCELLED';
      await putJson(targetKey, order);
      if (order.customerEmail) {
        await upsertIndexEntry(order.customerEmail, order);
      }
    }
    return NextResponse.json({ status: 'success', message: 'cancelled' });
  } catch (error: any) {
    return NextResponse.json({ status: 'error', message: error?.message || 'cancel failed' }, { status: 500 });
  }
}
