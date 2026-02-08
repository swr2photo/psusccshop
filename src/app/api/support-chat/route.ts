// src/app/api/support-chat/route.ts
// Customer: Create new chat or get active chat

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { 
  createChatSession, 
  getCustomerActiveChat,
  getCustomerChats
} from '@/lib/support-chat';
import { getProfileName } from '@/lib/profile-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET: Get customer's active chat or chat history
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
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
    return NextResponse.json({ chat: activeChat });
    
  } catch (error: any) {
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
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json('Unauthorized', { status: 401 });
    }
    
    // Check if customer already has an active chat
    const existingChat = await getCustomerActiveChat(session.user.email);
    if (existingChat) {
      return NextResponse.json({ 
        chat: existingChat,
        message: 'คุณมีการสนทนาที่กำลังดำเนินอยู่แล้ว'
      });
    }
    
    const body = await request.json();
    const { subject, message } = body;
    
    if (!message?.trim()) {
      return NextResponse.json(
        { error: 'กรุณาระบุข้อความ' },
        { status: 400 }
      );
    }
    
    // Use profile Thai name if available, fallback to OAuth name
    const profileName = await getProfileName(session.user.email);
    const customerName = profileName || session.user.name || 'ลูกค้า';
    
    const chat = await createChatSession(
      session.user.email,
      customerName,
      subject?.trim() || 'สอบถามข้อมูล',
      message.trim(),
      session.user.image || undefined  // Pass customer avatar
    );
    
    return NextResponse.json({ 
      chat,
      message: 'เริ่มการสนทนาสำเร็จ รอแอดมินรับเคส'
    });
    
  } catch (error: any) {
    console.error('[support-chat] POST error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
