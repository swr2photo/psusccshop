// src/app/api/admin/support-chat/route.ts
// Admin: Get all chat sessions

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isAdminEmail } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { 
  getAllChats,
  getPendingChats,
  getActiveChats,
  getChatStatistics,
  ChatStatus,
  ChatSession
} from '@/lib/support-chat';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Get customer emails that have orders in a specific shop */
async function getShopCustomerEmails(shopId: string): Promise<Set<string>> {
  const db = getSupabaseAdmin();
  if (!db) return new Set();
  const { data } = await db
    .from('orders')
    .select('customer_email')
    .eq('shop_id', shopId)
    .not('customer_email', 'is', null);
  if (!data) return new Set();
  return new Set(data.map((o: any) => (o.customer_email || '').toLowerCase()));
}

// GET: Get chats for admin
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json('Unauthorized', { status: 401 });
    }
    
    if (!isAdminEmail(session.user.email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') as ChatStatus | 'all' | 'my' | null;
    const shopId = searchParams.get('shopId');
    
    // If filtering by shop, get customer emails belonging to this shop
    const shopEmails = shopId ? await getShopCustomerEmails(shopId) : null;
    const filterByShop = (list: ChatSession[]) => {
      if (!shopEmails) return list;
      return list.filter(c => shopEmails.has((c.customer_email || '').toLowerCase()));
    };
    
    let chats;
    
    switch (filter) {
      case 'pending':
        chats = filterByShop(await getPendingChats());
        break;
      case 'active':
        chats = filterByShop(await getActiveChats());
        break;
      case 'my':
        chats = filterByShop(await getActiveChats(session.user.email));
        break;
      case 'closed':
        chats = filterByShop(await getAllChats('closed', 50));
        break;
      default:
        // Get all non-closed chats by default
        const pending = await getPendingChats();
        const active = await getActiveChats();
        chats = filterByShop([...pending, ...active]);
    }
    
    // Get statistics (global or filtered)
    const stats = await getChatStatistics();
    
    // If filtering by shop, adjust stats based on filtered chats
    if (shopEmails && stats) {
      const filteredStats = {
        pendingCount: chats.filter(c => c.status === 'pending').length,
        activeCount: chats.filter(c => c.status === 'active').length,
        todayCount: chats.filter(c => {
          const created = new Date(c.created_at);
          const today = new Date();
          return created.toDateString() === today.toDateString();
        }).length,
        avgRating: stats.avgRating, // Keep global average
      };
      return NextResponse.json({ chats, stats: filteredStats });
    }
    
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
