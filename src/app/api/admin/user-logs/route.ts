// src/app/api/admin/user-logs/route.ts
// User activity logs API

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth';
import { getSessionFromRequest } from '@/lib/session-from-request';
import { putJson, getUserLogsPaginated } from '@/lib/filebase';

export interface UserLog {
  id: string;
  email: string;
  name?: string;
  action: UserAction;
  details?: string;
  metadata?: Record<string, any>;
  ip?: string;
  userAgent?: string;
  timestamp: string;
}

export type UserAction =
  | 'login'
  | 'logout'
  | 'view_product'
  | 'add_to_cart'
  | 'remove_from_cart'
  | 'place_order'
  | 'upload_slip'
  | 'verify_payment'
  | 'view_order'
  | 'profile_update'
  | 'page_view'
  | 'error';

const userLogKey = (id: string) => `user-logs/${id}.json`;

export async function saveUserLog(log: Omit<UserLog, 'id' | 'timestamp'>): Promise<void> {
  const id = `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const fullLog: UserLog = {
    ...log,
    id,
    timestamp: new Date().toISOString(),
  };
  await putJson(userLogKey(id), fullLog);

  const date = new Date();
  const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const indexKey = `user-logs/index/${dateKey}.json`;
  const { getJson } = await import('@/lib/filebase');
  const existing = (await getJson<string[]>(indexKey)) || [];
  await putJson(indexKey, [...existing, id]);
}

// GET: Retrieve user logs (single SQL query + pagination)
export async function GET(request: NextRequest) {
  try {
    const admin = await requireSuperAdmin(request);
    if (!admin || admin instanceof NextResponse) {
      return admin instanceof NextResponse ? admin : NextResponse.json('Unauthorized', { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email') || undefined;
    const action = searchParams.get('action') || undefined;
    const date = searchParams.get('date') || undefined;
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const { logs, total } = await getUserLogsPaginated({ email, action, date, limit, offset });

    const stats = {
      total,
      byAction: {} as Record<string, number>,
      uniqueUsers: new Set(logs.map((l) => l.email)).size,
      last24h: logs.filter((l) => {
        const ts = new Date(l.timestamp).getTime();
        return Date.now() - ts < 24 * 60 * 60 * 1000;
      }).length,
    };

    logs.forEach((log) => {
      stats.byAction[log.action] = (stats.byAction[log.action] || 0) + 1;
    });

    return NextResponse.json({ logs, stats });

  } catch (error: any) {
    console.error('[UserLogs API] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Log user action (requires authentication)
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, details, metadata } = body;

    const email = session.user.email;
    const name = session.user.name || undefined;

    if (!action) {
      return NextResponse.json({ error: 'Missing action' }, { status: 400 });
    }

    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    await saveUserLog({
      email,
      name,
      action,
      details,
      metadata,
      ip: ip.split(',')[0].trim(),
      userAgent: userAgent.substring(0, 200),
    });

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('[UserLogs API] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
