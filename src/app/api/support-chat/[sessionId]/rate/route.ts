// src/app/api/support-chat/[sessionId]/rate/route.ts
// Customer rates the chat after it's closed

import { NextRequest, NextResponse } from 'next/server';
import { isResourceOwner, getSession } from '@/lib/auth';
import { secureJsonRequest, secureJsonResponse } from '@/lib/payload-crypto';
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
    const session = await getSession(request);
    
    if (!session?.user?.email) {
      return await secureJsonResponse('Unauthorized', { status: 401 });
    }
    
    const chat = await getChatSession(sessionId);
    
    if (!chat) {
      return await secureJsonResponse({ error: 'Chat not found' }, { status: 404 });
    }
    
    // Only the customer can rate
    if (!isResourceOwner(chat.customer_email, session.user.email)) {
      return await secureJsonResponse({ error: 'Forbidden' }, { status: 403 });
    }
    
    // Can only rate closed chats
    if (chat.status !== 'closed') {
      return await secureJsonResponse(
        { error: 'สามารถให้คะแนนได้เมื่อการสนทนาสิ้นสุดแล้ว' },
        { status: 400 }
      );
    }
    
    // Check if already rated
    if (chat.rating) {
      return await secureJsonResponse(
        { error: 'คุณได้ให้คะแนนไปแล้ว' },
        { status: 400 }
      );
    }
    
    const body = await secureJsonRequest(request);
    const { rating, comment } = body;
    
    if (!rating || typeof rating !== 'number' || rating < 1 || rating > 5) {
      return await secureJsonResponse(
        { error: 'กรุณาให้คะแนน 1-5' },
        { status: 400 }
      );
    }
    
    const ratedChat = await rateChatSession(sessionId, rating, comment);
    
    return await secureJsonResponse({ 
      chat: ratedChat,
      message: 'ขอบคุณสำหรับการให้คะแนน'
    });
    
  } catch (error: any) /* eslint-disable-line @typescript-eslint/no-explicit-any */ {
    console.error('[support-chat/rate] POST error:', error);
    return await secureJsonResponse(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
