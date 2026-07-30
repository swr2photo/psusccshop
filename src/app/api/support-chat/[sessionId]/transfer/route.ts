// src/app/api/support-chat/[sessionId]/transfer/route.ts
// Admin transfers a chat case to another admin

import { NextRequest, NextResponse } from 'next/server';
import { getSession, isAdminEmailAsync, normalizeEmail } from '@/lib/auth';
import { getChatSession, transferChatSession } from '@/lib/support-chat';
import { getProfileName } from '@/lib/profile-utils';

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
      return NextResponse.json('Unauthorized', { status: 401 });
    }

    if (!(await isAdminEmailAsync(session.user.email))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const chat = await getChatSession(sessionId);
    if (!chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }
    if (chat.status === 'closed') {
      return NextResponse.json({ error: 'การสนทนานี้ปิดแล้ว' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({} as { toEmail?: string; toName?: string }));
    const toEmailRaw = typeof body?.toEmail === 'string' ? body.toEmail.trim() : '';
    if (!toEmailRaw) {
      return NextResponse.json({ error: 'กรุณาเลือกแอดมินผู้รับ' }, { status: 400 });
    }

    const toEmail = normalizeEmail(toEmailRaw);
    if (!(await isAdminEmailAsync(toEmail))) {
      return NextResponse.json({ error: 'อีเมลนี้ไม่ใช่แอดมิน' }, { status: 400 });
    }

    const profileName = await getProfileName(toEmail);
    const toName =
      (typeof body?.toName === 'string' && body.toName.trim()) ||
      profileName ||
      toEmail.split('@')[0] ||
      'แอดมิน';

    const fromName = session.user.name || session.user.email.split('@')[0] || 'แอดมิน';

    const transferred = await transferChatSession(sessionId, toEmail, toName, fromName);

    return NextResponse.json({
      chat: transferred,
      message: `โอนเคสให้ ${toName} แล้ว`,
    });
  } catch (error: any) /* eslint-disable-line @typescript-eslint/no-explicit-any */ {
    console.error('[support-chat/transfer] POST error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
