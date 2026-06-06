// src/app/api/support-chat/[sessionId]/typing/route.ts
// Typing indicator API — Drizzle ORM

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isAdminEmail } from '@/lib/auth';
import { db } from '@/lib/db';
import { supportChats } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ sessionId: string }>;
}

// POST: Update typing status
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { sessionId } = await params;
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json('Unauthorized', { status: 401 });
    }
    
    const { isTyping } = await request.json();
    const isAdmin = isAdminEmail(session.user.email);
    
    const updateData: any = {
      updatedAt: new Date(),
    };
    if (isAdmin) {
      updateData.adminTyping = isTyping;
      updateData.adminTypingAt = isTyping ? new Date() : null;
    } else {
      updateData.customerTyping = isTyping;
      updateData.customerTypingAt = isTyping ? new Date() : null;
    }
    
    await db.update(supportChats)
      .set(updateData)
      .where(eq(supportChats.id, sessionId));
    
    return NextResponse.json({ success: true });
    
  } catch (error: any) {
    console.error('[support-chat/typing] POST error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET: Get typing status
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { sessionId } = await params;
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json('Unauthorized', { status: 401 });
    }
    
    const dataResults = await db.select({
      adminTyping: supportChats.adminTyping,
      adminTypingAt: supportChats.adminTypingAt,
      customerTyping: supportChats.customerTyping,
      customerTypingAt: supportChats.customerTypingAt,
    })
    .from(supportChats)
    .where(eq(supportChats.id, sessionId))
    .limit(1);
    
    const data = dataResults[0];
    
    if (!data) {
      return NextResponse.json({ isTyping: false });
    }
    
    const now = new Date().getTime();
    const isAdmin = isAdminEmail(session.user.email);
    
    let otherTyping = false;
    if (isAdmin) {
      if (data.customerTyping && data.customerTypingAt) {
        const typingTime = new Date(data.customerTypingAt).getTime();
        otherTyping = (now - typingTime) < 5000;
      }
    } else {
      if (data.adminTyping && data.adminTypingAt) {
        const typingTime = new Date(data.adminTypingAt).getTime();
        otherTyping = (now - typingTime) < 5000;
      }
    }
    
    return NextResponse.json({ isTyping: otherTyping });
    
  } catch (error: any) {
    console.error('[support-chat/typing] GET error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
