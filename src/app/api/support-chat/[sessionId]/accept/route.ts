// src/app/api/support-chat/[sessionId]/accept/route.ts
// Admin accepts a pending chat, or takes over an active chat from another assignee

import { NextRequest, NextResponse } from 'next/server';
import { isAdminEmailAsync, getSession } from '@/lib/auth';
import { secureJsonRequest, secureJsonResponse } from '@/lib/payload-crypto';
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
      return await secureJsonResponse(
        { error: 'การสนทนานี้ปิดแล้ว' },
        { status: 400 }
      );
    }

    const body = await secureJsonRequest(request).catch(() => ({} as { force?: boolean }));
    const adminEmail = (chat.admin_email || '').toLowerCase();
    const actorEmail = session.user.email.toLowerCase();
    const force =
      Boolean(body?.force) ||
      (chat.status === 'active' && Boolean(adminEmail) && adminEmail !== actorEmail);

    if (chat.status === 'active' && !force) {
      if (adminEmail && adminEmail === actorEmail) {
        return await secureJsonResponse({
          chat,
          message: 'คุณดูแลเคสนี้อยู่แล้ว',
        });
      }
      return await secureJsonResponse(
        { error: 'การสนทนานี้ถูกรับไปแล้ว' },
        { status: 400 }
      );
    }

    if (chat.status !== 'pending' && chat.status !== 'active') {
      return await secureJsonResponse(
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
    
    return await secureJsonResponse({ 
      chat: acceptedChat,
      message: force ? 'โอนเคสสำเร็จ' : 'รับเคสสำเร็จ'
    });
    
  } catch (error: any) /* eslint-disable-line @typescript-eslint/no-explicit-any */ {
    console.error('[support-chat/accept] POST error:', error);
    return await secureJsonResponse(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
