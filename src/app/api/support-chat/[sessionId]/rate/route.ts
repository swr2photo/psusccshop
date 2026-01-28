// src/app/api/support-chat/[sessionId]/rate/route.ts
// Customer rates the chat after it's closed

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { 
  getChatSession,
  rateChatSession 
} from '@/lib/support-chat';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ sessionId: string }>;
}

// POST: Rate the chat session
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { sessionId } = await params;
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json('Unauthorized', { status: 401 });
    }
    
    const chat = await getChatSession(sessionId);
    
    if (!chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }
    
    // Only the customer can rate
    if (chat.customer_email !== session.user.email) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    // Can only rate closed chats
    if (chat.status !== 'closed') {
      return NextResponse.json(
        { error: 'สามารถให้คะแนนได้เมื่อการสนทนาสิ้นสุดแล้ว' },
        { status: 400 }
      );
    }
    
    // Check if already rated
    if (chat.rating) {
      return NextResponse.json(
        { error: 'คุณได้ให้คะแนนไปแล้ว' },
        { status: 400 }
      );
    }
    
    const body = await request.json();
    const { rating, comment } = body;
    
    if (!rating || typeof rating !== 'number' || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'กรุณาให้คะแนน 1-5' },
        { status: 400 }
      );
    }
    
    const ratedChat = await rateChatSession(sessionId, rating, comment);
    
    return NextResponse.json({ 
      chat: ratedChat,
      message: 'ขอบคุณสำหรับการให้คะแนน'
    });
    
  } catch (error: any) {
    console.error('[support-chat/rate] POST error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
