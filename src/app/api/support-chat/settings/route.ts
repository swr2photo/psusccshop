// src/app/api/support-chat/settings/route.ts
// Chat settings API (Admin only) — Drizzle ORM

import { NextRequest, NextResponse } from 'next/server';
import { isAdminEmailAsync, getSession } from '@/lib/auth';
import {
  getStoredSupportChatSettings,
  saveStoredSupportChatSettings,
} from '@/lib/support-chat-settings-db';
import { normalizeSupportChatSettings } from '@/lib/support-chat-settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET: Get chat settings
export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session?.user?.email || !(await isAdminEmailAsync(session.user.email))) {
      return NextResponse.json('Unauthorized', { status: 401 });
    }

    const settings = await getStoredSupportChatSettings();
    return NextResponse.json({ settings });
  } catch (error: any) {
    console.error('[support-chat/settings] GET error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST: Update chat settings
export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session?.user?.email || !(await isAdminEmailAsync(session.user.email))) {
      return NextResponse.json('Unauthorized', { status: 401 });
    }

    const body = await request.json();
    const settings = await saveStoredSupportChatSettings(normalizeSupportChatSettings(body));
    return NextResponse.json({ success: true, settings });
  } catch (error: any) {
    console.error('[support-chat/settings] POST error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
