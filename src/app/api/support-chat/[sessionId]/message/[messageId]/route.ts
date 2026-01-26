// src/app/api/support-chat/[sessionId]/message/[messageId]/route.ts
// Delete/Unsend a message (IG-style)

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { 
  getChatSession,
  unsendChatMessage
} from '@/lib/support-chat';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ sessionId: string; messageId: string }>;
}

// DELETE: Unsend/Delete a message
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { sessionId, messageId } = await params;
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const chat = await getChatSession(sessionId);
    
    if (!chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }
    
    // Check if chat is closed
    if (chat.status === 'closed') {
      return NextResponse.json(
        { error: 'ไม่สามารถยกเลิกข้อความได้เนื่องจากการสนทนาปิดแล้ว' },
        { status: 400 }
      );
    }
    
    // Only the message owner can unsend
    const isOwner = chat.customer_email === session.user.email;
    
    if (!isOwner) {
      return NextResponse.json(
        { error: 'คุณสามารถยกเลิกได้เฉพาะข้อความของตัวเองเท่านั้น' },
        { status: 403 }
      );
    }
    
    // Call the unsend function
    const result = await unsendChatMessage(sessionId, messageId, session.user.email);
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'ไม่สามารถยกเลิกข้อความได้' },
        { status: 400 }
      );
    }
    
    return NextResponse.json({ 
      success: true,
      message: 'ยกเลิกข้อความเรียบร้อยแล้ว'
    });
    
  } catch (error: any) {
    console.error('[support-chat/message/delete] error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
