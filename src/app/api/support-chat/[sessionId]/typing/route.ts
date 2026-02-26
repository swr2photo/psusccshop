// src/app/api/support-chat/[sessionId]/typing/route.ts
// Typing indicator API — Prisma

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isAdminEmail } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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
    
    const field = isAdmin ? 'admin_typing' : 'customer_typing';
    const fieldAt = isAdmin ? 'admin_typing_at' : 'customer_typing_at';
    
    await prisma.supportChat.update({
      where: { id: sessionId },
      data: {
        [field]: isTyping,
        [fieldAt]: isTyping ? new Date() : null,
      },
    });
    
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
    
    const data = await prisma.supportChat.findUnique({
      where: { id: sessionId },
    }) as any;
    
    if (!data) {
      return NextResponse.json({ isTyping: false });
    }
    
    const now = new Date().getTime();
    const isAdmin = isAdminEmail(session.user.email);
    
    let otherTyping = false;
    if (isAdmin) {
      if (data.customer_typing && data.customer_typing_at) {
        const typingTime = new Date(data.customer_typing_at).getTime();
        otherTyping = (now - typingTime) < 5000;
      }
    } else {
      if (data.admin_typing && data.admin_typing_at) {
        const typingTime = new Date(data.admin_typing_at).getTime();
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
