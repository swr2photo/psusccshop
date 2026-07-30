// src/app/api/support-chat/[sessionId]/message/route.ts
// Send a message in a chat session

import { NextRequest, NextResponse } from 'next/server';
import { isAdminEmailAsync, ADMIN_EMAILS, isResourceOwner, getSession } from '@/lib/auth';
import { 
  getChatSession,
  addChatMessage 
} from '@/lib/support-chat';
import { sendChatReplyEmail } from '@/lib/email';
import { sendPushNotification } from '@/lib/push-notification';
import { getProfileName } from '@/lib/profile-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ sessionId: string }>;
}

// POST: Send a message
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { sessionId } = await params;
    const session = await getSession(request);
    
    if (!session?.user?.email) {
      return NextResponse.json('Unauthorized', { status: 401 });
    }
    
    const chat = await getChatSession(sessionId);
    
    if (!chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }
    
    // Check if chat is still open
    if (chat.status === 'closed') {
      return NextResponse.json(
        { error: 'การสนทนานี้ปิดแล้ว' },
        { status: 400 }
      );
    }
    
    // Check authorization
    const isAdminUser = await isAdminEmailAsync(session.user.email);
    const isOwner = isResourceOwner(chat.customer_email, session.user.email);
    
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
        return NextResponse.json(
          { error: 'คุณไม่ได้รับมอบหมายให้ดูแลการสนทนานี้' },
          { status: 403 }
        );
      }
      // Admin is assigned or chat is pending, continue to send message
    } else {
      // Not owner and not admin
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
    
    // Prefer names already on the session to avoid a profile DB round-trip on every send
    let displayName =
      (sender === 'customer' ? chat.customer_name : chat.admin_name) ||
      session.user.name ||
      (sender === 'admin' ? 'แอดมิน' : 'ลูกค้า');
    if (!chat.customer_name && !chat.admin_name && !session.user.name) {
      const profileName = await getProfileName(session.user.email);
      if (profileName) displayName = profileName;
    }
    
    const newMessage = await addChatMessage(
      sessionId,
      sender,
      session.user.email,
      displayName,
      message.trim(),
      session.user.image || undefined // Pass avatar URL
    );
    
    // Send email notification to customer when admin replies (fire-and-forget)
    if (sender === 'admin' && chat.customer_email) {
      sendChatReplyEmail({
        customerEmail: chat.customer_email,
        customerName: chat.customer_name || 'ลูกค้า',
        adminName: displayName,
        messagePreview: message.trim().substring(0, 500),
        chatId: sessionId,
      }).catch(err => console.error('[support-chat/message] Email notification failed:', err));
      
      // Send push notification to customer (fire-and-forget)
      sendPushNotification(chat.customer_email, {
        title: `${displayName} ตอบกลับ - SCC Shop`,
        body: message.trim().substring(0, 200),
        icon: '/favicon.png',
        url: '/',
        tag: `chat-${sessionId}`,
        chatId: sessionId,
      }).catch(err => console.error('[support-chat/message] Push notification failed:', err));
    }
    
    // Send push notification to admin when customer sends message
    if (sender === 'customer') {
      if (chat.admin_email) {
        // Chat is assigned — notify the assigned admin
        sendPushNotification(chat.admin_email, {
          title: `ข้อความใหม่จาก ${displayName}`,
          body: message.trim().substring(0, 200),
          icon: '/favicon.png',
          url: '/admin/support',
          tag: `chat-admin-${sessionId}`,
          chatId: sessionId,
        }).catch(err => console.error('[support-chat/message] Admin push failed:', err));
      } else {
        // Chat is unassigned (pending) — notify ALL admins
        for (const adminEmail of ADMIN_EMAILS) {
          sendPushNotification(adminEmail, {
            title: `แชทใหม่จาก ${displayName}`,
            body: message.trim().substring(0, 200),
            icon: '/favicon.png',
            url: '/admin/support',
            tag: `chat-new-${sessionId}`,
            chatId: sessionId,
          }).catch(err => console.error('[support-chat/message] Admin push (all) failed:', err));
        }
      }
    }
    
    return NextResponse.json({ 
      message: newMessage,
      success: true
    });
    
  } catch (error: unknown) {
    console.error('[support-chat/message] POST error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
