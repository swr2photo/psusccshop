// src/app/api/support-chat/[sessionId]/accept/route.ts
// Admin accepts a pending chat, or takes over an active chat from another assignee

import { NextRequest, NextResponse } from 'next/server';
import { isAdminEmailAsync, getSession } from '@/lib/auth';
import { 
  getChatSession,
  acceptChatSession 
} from '@/lib/support-chat';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ sessionId: string }>;
}

// POST: Accept or take over the chat session
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
      return NextResponse.json(
        { error: 'การสนทนานี้ปิดแล้ว' },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({} as { force?: boolean }));
    const adminEmail = (chat.admin_email || '').toLowerCase();
    const actorEmail = session.user.email.toLowerCase();
    const force =
      Boolean(body?.force) ||
      (chat.status === 'active' && Boolean(adminEmail) && adminEmail !== actorEmail);

    if (chat.status === 'active' && !force) {
      if (adminEmail && adminEmail === actorEmail) {
        return NextResponse.json({
          chat,
          message: 'คุณดูแลเคสนี้อยู่แล้ว',
        });
      }
      return NextResponse.json(
        { error: 'การสนทนานี้ถูกรับไปแล้ว' },
        { status: 400 }
      );
    }

    if (chat.status !== 'pending' && chat.status !== 'active') {
      return NextResponse.json(
        { error: 'ไม่สามารถรับเคสนี้ได้' },
        { status: 400 }
      );
    }
    
    const acceptedChat = await acceptChatSession(
      sessionId,
      session.user.email,
      session.user.name || 'แอดมิน',
      { force }
    );
    
    return NextResponse.json({ 
      chat: acceptedChat,
      message: force ? 'โอนเคสสำเร็จ' : 'รับเคสสำเร็จ'
    });
    
  } catch (error: any) /* eslint-disable-line @typescript-eslint/no-explicit-any */ {
    console.error('[support-chat/accept] POST error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
