// src/app/api/support-chat/[sessionId]/typing/route.ts
// Typing indicator API

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isAdminEmail } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';

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
    
    const db = getSupabaseAdmin();
    
    // Update typing status in database
    const field = isAdmin ? 'admin_typing' : 'customer_typing';
    const { error } = await db
      .from('support_chats')
      .update({
        [field]: isTyping,
        [`${field}_at`]: isTyping ? new Date().toISOString() : null,
      })
      .eq('id', sessionId);
    
    if (error) throw error;
    
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
    
    const db = getSupabaseAdmin();
    
    const { data, error } = await db
      .from('support_chats')
      .select('admin_typing, admin_typing_at, customer_typing, customer_typing_at')
      .eq('id', sessionId)
      .single();
    
    if (error) throw error;
    
    // Check if typing status is still valid (within 5 seconds)
    const now = new Date().getTime();
    const isAdmin = isAdminEmail(session.user.email);
    
    let otherTyping = false;
    if (isAdmin) {
      // Admin sees customer typing
      if (data.customer_typing && data.customer_typing_at) {
        const typingTime = new Date(data.customer_typing_at).getTime();
        otherTyping = (now - typingTime) < 5000;
      }
    } else {
      // Customer sees admin typing
      if (data.admin_typing && data.admin_typing_at) {
        const typingTime = new Date(data.admin_typing_at).getTime();
        otherTyping = (now - typingTime) < 5000;
      }
    }
    
    return NextResponse.json({ 
      isTyping: otherTyping,
    });
    
  } catch (error: any) {
    console.error('[support-chat/typing] GET error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
