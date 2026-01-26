// src/app/api/admin/support-chat/route.ts
// Admin: Get all chat sessions

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isAdminEmail } from '@/lib/auth';
import { 
  getAllChats,
  getPendingChats,
  getActiveChats,
  getChatStatistics,
  ChatStatus
} from '@/lib/support-chat';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET: Get chats for admin
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    if (!isAdminEmail(session.user.email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') as ChatStatus | 'all' | 'my' | null;
    
    let chats;
    
    switch (filter) {
      case 'pending':
        chats = await getPendingChats();
        break;
      case 'active':
        chats = await getActiveChats();
        break;
      case 'my':
        chats = await getActiveChats(session.user.email);
        break;
      case 'closed':
        chats = await getAllChats('closed', 50);
        break;
      default:
        // Get all non-closed chats by default
        const pending = await getPendingChats();
        const active = await getActiveChats();
        chats = [...pending, ...active];
    }
    
    // Get statistics
    const stats = await getChatStatistics();
    
    return NextResponse.json({ 
      chats,
      stats
    });
    
  } catch (error: any) {
    console.error('[admin/support-chat] GET error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
