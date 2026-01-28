// src/app/api/support-chat/[sessionId]/close/route.ts
// Close a chat session (Admin only)

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isAdminEmail } from '@/lib/auth';
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
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json('Unauthorized', { status: 401 });
    }
    
    // Only admin can close chats
    if (!isAdminEmail(session.user.email)) {
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
    
    const closedChat = await closeChatSession(sessionId);
    
    return NextResponse.json({ 
      chat: closedChat,
      message: 'ปิดการสนทนาสำเร็จ'
    });
    
  } catch (error: any) {
    console.error('[support-chat/close] POST error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
