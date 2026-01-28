// src/app/api/support-chat/[sessionId]/route.ts
// Get chat session details and messages

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isAdminEmail } from '@/lib/auth';
import { 
  getChatSessionWithMessages,
  markMessagesAsRead 
} from '@/lib/support-chat';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ sessionId: string }>;
}

// GET: Get chat session with messages
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { sessionId } = await params;
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json('Unauthorized', { status: 401 });
    }
    
    const chat = await getChatSessionWithMessages(sessionId);
    
    if (!chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }
    
    // Check authorization
    const isAdminUser = isAdminEmail(session.user.email);
    const isOwner = chat.customer_email === session.user.email;
    
    if (!isAdminUser && !isOwner) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    // Only mark as read if explicitly requested via query param or if it's the first fetch (not polling)
    const { searchParams } = new URL(request.url);
    const shouldMarkRead = searchParams.get('markRead') === 'true';
    
    if (shouldMarkRead) {
      // Owner always reads as customer (even if they're also an admin)
      // Non-owner admin reads as admin
      const reader = isOwner ? 'customer' : 'admin';
      await markMessagesAsRead(sessionId, reader);
    }
    
    return NextResponse.json({ chat });
    
  } catch (error: any) {
    console.error('[support-chat/sessionId] GET error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
