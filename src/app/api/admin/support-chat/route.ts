// src/app/api/admin/support-chat/route.ts
// Admin: Get all chat sessions — Prisma

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isAdminEmail } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
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
  const data = await prisma.order.findMany({
    where: { shop_id: shopId, customer_email: { not: '' } },
    select: { customer_email: true },
    distinct: ['customer_email'],
  });
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
    
    const shopEmails = shopId ? await getShopCustomerEmails(shopId) : null;
    const filterByShop = (list: ChatSession[]) => {
      if (!shopId) return list;
      return list.filter(c => {
        if ((c as any).shop_id === shopId) return true;
        if (shopEmails && shopEmails.has((c.customer_email || '').toLowerCase())) return true;
        return false;
      });
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
        const pending = await getPendingChats();
        const active = await getActiveChats();
        chats = filterByShop([...pending, ...active]);
    }
    
    const stats = await getChatStatistics();
    
    if (shopEmails && stats) {
      const filteredStats = {
        pendingCount: chats.filter(c => c.status === 'pending').length,
        activeCount: chats.filter(c => c.status === 'active').length,
        todayCount: chats.filter(c => {
          const created = new Date(c.created_at);
          const today = new Date();
          return created.toDateString() === today.toDateString();
        }).length,
        avgRating: stats.avgRating,
      };
      return NextResponse.json({ chats, stats: filteredStats });
    }
    
    return NextResponse.json({ chats, stats });
    
  } catch (error: any) {
    console.error('[admin/support-chat] GET error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
