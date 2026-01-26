// src/app/api/support-chat/[sessionId]/message/route.ts
// Send a message in a chat session

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isAdminEmail } from '@/lib/auth';
import { 
  getChatSession,
  addChatMessage 
} from '@/lib/support-chat';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ sessionId: string }>;
}

// POST: Send a message
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { sessionId } = await params;
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const chat = await getChatSession(sessionId);
    
    if (!chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }
    
    // Debug logging
    console.log('[support-chat/message] Debug:', {
      sessionId,
      userEmail: session.user.email,
      chatStatus: chat.status,
      chatOwner: chat.customer_email,
      chatAdmin: chat.admin_email,
    });
    
    // Check if chat is still open
    if (chat.status === 'closed') {
      return NextResponse.json(
        { error: 'การสนทนานี้ปิดแล้ว' },
        { status: 400 }
      );
    }
    
    // Check authorization
    const isAdminUser = isAdminEmail(session.user.email);
    const isOwner = chat.customer_email === session.user.email;
    
    console.log('[support-chat/message] Auth check:', { isAdminUser, isOwner });
    
    // Owner can always send messages (even if they are also admin)
    if (isOwner) {
      // Customer can only send messages if chat is pending or active
      if (chat.status !== 'pending' && chat.status !== 'active') {
        return NextResponse.json(
          { error: 'ไม่สามารถส่งข้อความได้ในขณะนี้' },
          { status: 403 }
        );
      }
      // Owner is allowed, continue to send message
    } else if (isAdminUser) {
      // Admin (not owner) - check if they are assigned to this chat
      if (chat.status === 'active' && chat.admin_email && chat.admin_email !== session.user.email) {
        console.log('[support-chat/message] Forbidden: admin not assigned');
        return NextResponse.json(
          { error: 'คุณไม่ได้รับมอบหมายให้ดูแลการสนทนานี้' },
          { status: 403 }
        );
      }
      // Admin is assigned or chat is pending, continue to send message
    } else {
      // Not owner and not admin
      console.log('[support-chat/message] Forbidden: not admin and not owner');
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    const body = await request.json();
    const { message } = body;
    
    if (!message?.trim()) {
      return NextResponse.json(
        { error: 'กรุณาระบุข้อความ' },
        { status: 400 }
      );
    }
    
    // Determine sender type - owner is always 'customer', even if they are also admin
    const sender = isOwner ? 'customer' : 'admin';
    
    const newMessage = await addChatMessage(
      sessionId,
      sender,
      session.user.email,
      session.user.name || (sender === 'admin' ? 'แอดมิน' : 'ลูกค้า'),
      message.trim(),
      session.user.image || undefined // Pass avatar URL
    );
    
    return NextResponse.json({ 
      message: newMessage,
      success: true
    });
    
  } catch (error: any) {
    console.error('[support-chat/message] POST error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
