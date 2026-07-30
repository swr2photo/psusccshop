// src/app/api/support-chat/[sessionId]/read/route.ts
// Mark messages as read API

import { NextRequest, NextResponse } from 'next/server';
import { isAdminEmailAsync, isResourceOwner, getSession } from '@/lib/auth';
import { markMessagesAsRead, getChatSession } from '@/lib/support-chat';
import { secureJsonRequest, secureJsonResponse } from '@/lib/payload-crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ sessionId: string }>;
}

// POST: Mark messages as read
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { sessionId } = await params;
    const session = await getSession(request);
    
    if (!session?.user?.email) {
      return await secureJsonResponse('Unauthorized', { status: 401 });
    }
    
    // Get chat to check if user is the owner (customer)
    const chat = await getChatSession(sessionId);
    if (!chat) {
      return await secureJsonResponse({ error: 'Chat not found' }, { status: 404 });
    }
    
    // Determine reader type:
    // - If user is the chat owner (customer_email), they're reading as customer
    // - If user is admin AND not the owner, they're reading as admin
    const isOwner = isResourceOwner(chat.customer_email, session.user.email);
    const isAdmin = await isAdminEmailAsync(session.user.email);
    
    // Owner always reads as customer, even if they're also an admin
    const reader = isOwner ? 'customer' : (isAdmin ? 'admin' : 'customer');
    
    await markMessagesAsRead(sessionId, reader);
    
    return await secureJsonResponse({ 
      success: true,
      message: 'Messages marked as read',
      reader
    });
    
  } catch (error: any) /* eslint-disable-line @typescript-eslint/no-explicit-any */ {
    console.error('[support-chat/read] POST error:', error);
    return await secureJsonResponse(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
