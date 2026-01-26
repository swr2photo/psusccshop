// src/app/api/support-chat/[sessionId]/accept/route.ts
// Admin accepts a chat session

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isAdminEmail } from '@/lib/auth';
import { 
  getChatSession,
  acceptChatSession 
} from '@/lib/support-chat';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ sessionId: string }>;
}

// POST: Accept the chat session
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { sessionId } = await params;
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Only admin can accept chats
    if (!isAdminEmail(session.user.email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    const chat = await getChatSession(sessionId);
    
    if (!chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }
    
    if (chat.status !== 'pending') {
      return NextResponse.json(
        { error: 'การสนทนานี้ถูกรับไปแล้ว' },
        { status: 400 }
      );
    }
    
    const acceptedChat = await acceptChatSession(
      sessionId,
      session.user.email,
      session.user.name || 'แอดมิน'
    );
    
    return NextResponse.json({ 
      chat: acceptedChat,
      message: 'รับเคสสำเร็จ'
    });
    
  } catch (error: any) {
    console.error('[support-chat/accept] POST error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
