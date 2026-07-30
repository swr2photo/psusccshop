// src/app/api/support-chat/[sessionId]/transfer/route.ts
// Admin transfers a chat case to another admin

import { NextRequest, NextResponse } from 'next/server';
import { getSession, isAdminEmailAsync, normalizeEmail } from '@/lib/auth';
import { getChatSession, transferChatSession } from '@/lib/support-chat';
import { getProfileName } from '@/lib/profile-utils';
import { secureJsonRequest, secureJsonResponse } from '@/lib/payload-crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ sessionId: string }>;
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { sessionId } = await params;
    const session = await getSession(request);

    if (!session?.user?.email) {
      return await secureJsonResponse('Unauthorized', { status: 401 });
    }

    if (!(await isAdminEmailAsync(session.user.email))) {
      return await secureJsonResponse({ error: 'Forbidden' }, { status: 403 });
    }

    const chat = await getChatSession(sessionId);
    if (!chat) {
      return await secureJsonResponse({ error: 'Chat not found' }, { status: 404 });
    }
    if (chat.status === 'closed') {
      return await secureJsonResponse({ error: 'การสนทนานี้ปิดแล้ว' }, { status: 400 });
    }

    const body = await secureJsonRequest(request).catch(() => ({} as { toEmail?: string; toName?: string }));
    const toEmailRaw = typeof body?.toEmail === 'string' ? body.toEmail.trim() : '';
    if (!toEmailRaw) {
      return await secureJsonResponse({ error: 'กรุณาเลือกแอดมินผู้รับ' }, { status: 400 });
    }

    const toEmail = normalizeEmail(toEmailRaw);
    if (!(await isAdminEmailAsync(toEmail))) {
      return await secureJsonResponse({ error: 'อีเมลนี้ไม่ใช่แอดมิน' }, { status: 400 });
    }

    const profileName = await getProfileName(toEmail);
    const toName =
      (typeof body?.toName === 'string' && body.toName.trim()) ||
      profileName ||
      toEmail.split('@')[0] ||
      'แอดมิน';

    const fromName = session.user.name || session.user.email.split('@')[0] || 'แอดมิน';

    const transferred = await transferChatSession(sessionId, toEmail, toName, fromName);

    return await secureJsonResponse({
      chat: transferred,
      message: `โอนเคสให้ ${toName} แล้ว`,
    });
  } catch (error: any) /* eslint-disable-line @typescript-eslint/no-explicit-any */ {
    console.error('[support-chat/transfer] POST error:', error);
    return await secureJsonResponse(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
