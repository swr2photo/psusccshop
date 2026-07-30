// src/app/api/support-chat/route.ts
// Customer: Create new chat or get active chat

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { 
  createChatSession, 
  getCustomerActiveChat,
  getCustomerChats,
  getChatSessionWithMessages,
  markMessagesAsRead,
  addChatMessage,
} from '@/lib/support-chat';
import { getProfileName } from '@/lib/profile-utils';
import {
  getStoredSupportChatSettings,
} from '@/lib/support-chat-settings-db';
import { resolveAutoReplyMessage } from '@/lib/support-chat-settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET: Get customer's active chat or chat history
export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request);
    
    if (!session?.user?.email) {
      return NextResponse.json('Unauthorized', { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    
    if (action === 'history') {
      // Get customer's chat history
      const chats = await getCustomerChats(session.user.email);
      return NextResponse.json({ chats });
    }
    
    // Get active chat (pending or active)
    const activeChat = await getCustomerActiveChat(session.user.email);
    if (!activeChat) {
      return NextResponse.json({ chat: null });
    }

    const withMessages = searchParams.get('withMessages') === '1';
    const shouldMarkRead = searchParams.get('markRead') === 'true';

    if (withMessages) {
      if (shouldMarkRead) {
        await markMessagesAsRead(activeChat.id, 'customer');
      }
      const chat = await getChatSessionWithMessages(activeChat.id);
      if (!chat) {
        return NextResponse.json({ chat: null });
      }
      const { hasMore, ...chatPayload } = chat;
      return NextResponse.json({ chat: chatPayload, hasMore });
    }

    return NextResponse.json({ chat: activeChat });
    
  } catch (error: any) /* eslint-disable-line @typescript-eslint/no-explicit-any */ {
    console.error('[support-chat] GET error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST: Create a new chat session
export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request);
    
    if (!session?.user?.email) {
      return NextResponse.json('Unauthorized', { status: 401 });
    }
    
    // Check if customer already has an active chat
    const existingChat = await getCustomerActiveChat(session.user.email);
    if (existingChat) {
      const chat = await getChatSessionWithMessages(existingChat.id);
      if (chat) {
        const { hasMore: _hasMore, ...chatPayload } = chat;
        return NextResponse.json({ 
          chat: chatPayload,
          message: 'คุณมีการสนทนาที่กำลังดำเนินอยู่แล้ว'
        });
      }
      return NextResponse.json({ 
        chat: existingChat,
        message: 'คุณมีการสนทนาที่กำลังดำเนินอยู่แล้ว'
      });
    }
    
    const body = await request.json();
    const { subject, message, shopId, shopName } = body;
    
    if (!message?.trim()) {
      return NextResponse.json(
        { error: 'กรุณาระบุข้อความ' },
        { status: 400 }
      );
    }
    
    // Use profile Thai name if available, fallback to OAuth name
    const profileName = await getProfileName(session.user.email);
    const customerName = profileName || session.user.name || 'ลูกค้า';
    
    const created = await createChatSession(
      session.user.email,
      customerName,
      subject?.trim() || 'สอบถามข้อมูล',
      message.trim(),
      session.user.image || undefined,  // Pass customer avatar
      shopId || undefined,
      shopName || undefined
    );

    try {
      const settings = await getStoredSupportChatSettings();
      const autoReply = resolveAutoReplyMessage(settings);
      // Auto-reply is a system action only — never changes status or assignee.
      // Cases stay `pending` until a human admin presses Accept / Take over.
      if (autoReply) {
        await addChatMessage(
          created.id,
          'admin',
          undefined,
          settings.admin_display_name || 'ทีมงาน',
          autoReply
        );
      }
    } catch (e) {
      console.error('[support-chat] auto-reply failed:', e);
    }

    const withMessages = await getChatSessionWithMessages(created.id);
    const chat = withMessages
      ? (({ hasMore: _h, ...rest }) => rest)(withMessages)
      : created;
    
    return NextResponse.json({ 
      chat,
      message: 'เริ่มการสนทนาสำเร็จ รอแอดมินรับเคส'
    });
    
  } catch (error: any) /* eslint-disable-line @typescript-eslint/no-explicit-any */ {
    console.error('[support-chat] POST error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
