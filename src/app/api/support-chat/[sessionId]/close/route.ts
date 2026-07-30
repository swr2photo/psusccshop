// src/app/api/support-chat/[sessionId]/close/route.ts
// Close a chat session (Admin only)

import { NextRequest, NextResponse } from 'next/server';
import { isAdminEmailAsync, getSession } from '@/lib/auth';
import { secureJsonRequest, secureJsonResponse } from '@/lib/payload-crypto';
import { 
  getChatSession,
  closeChatSession 
} from '@/lib/support-chat';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ sessionId: string }>;
}

// POST: Close the chat session
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { sessionId } = await params;
    const session = await getSession(request);
    
    if (!session?.user?.email) {
      return await secureJsonResponse('Unauthorized', { status: 401 });
    }
    
    // Only admin can close chats
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
    
    const closedChat = await closeChatSession(sessionId);
    
    return await secureJsonResponse({ 
      chat: closedChat,
      message: 'ปิดการสนทนาสำเร็จ'
    });
    
  } catch (error: any) /* eslint-disable-line @typescript-eslint/no-explicit-any */ {
    console.error('[support-chat/close] POST error:', error);
    return await secureJsonResponse(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
