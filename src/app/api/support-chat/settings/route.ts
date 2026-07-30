// src/app/api/support-chat/settings/route.ts
// Chat settings API (Admin only) — Drizzle ORM

import { NextRequest, NextResponse } from 'next/server';
import { isAdminEmailAsync, getSession } from '@/lib/auth';
import {
  getStoredSupportChatSettings,
  saveStoredSupportChatSettings,
} from '@/lib/support-chat-settings-db';
import { normalizeSupportChatSettings } from '@/lib/support-chat-settings';
import { secureJsonRequest, secureJsonResponse } from '@/lib/payload-crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET: Get chat settings
export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session?.user?.email || !(await isAdminEmailAsync(session.user.email))) {
      return await secureJsonResponse('Unauthorized', { status: 401 });
    }

    const settings = await getStoredSupportChatSettings();
    return await secureJsonResponse({ settings });
  } catch (error: any) /* eslint-disable-line @typescript-eslint/no-explicit-any */ {
    console.error('[support-chat/settings] GET error:', error);
    return await secureJsonResponse(
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
      return await secureJsonResponse('Unauthorized', { status: 401 });
    }

    const body = await secureJsonRequest(request);
    const settings = await saveStoredSupportChatSettings(normalizeSupportChatSettings(body));
    return await secureJsonResponse({ success: true, settings });
  } catch (error: any) /* eslint-disable-line @typescript-eslint/no-explicit-any */ {
    console.error('[support-chat/settings] POST error:', error);
    return await secureJsonResponse(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
