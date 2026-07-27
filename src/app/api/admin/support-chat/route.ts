// src/app/api/admin/support-chat/route.ts
// Admin: Get all chat sessions — Drizzle ORM

import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session-from-request';
import { isAdminEmailAsync, listAssignableAdminEmails } from '@/lib/auth';
import { db } from '@/lib/db';
import { orders } from '@/db/schema';
import { and, eq, ne } from 'drizzle-orm';
import { 
  getAllChats,
  getPendingChats,
  getActiveChats,
  getChatStatistics,
  closeInactiveSupportChats,
  ChatStatus,
  ChatSession
} from '@/lib/support-chat';
import { getStoredSupportChatSettings } from '@/lib/support-chat-settings-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Get customer emails that have orders in a specific shop */
async function getShopCustomerEmails(shopId: string): Promise<Set<string>> {
  const data = await db.selectDistinct({
    customer_email: orders.customerEmail,
  })
  .from(orders)
  .where(
    and(
      eq(orders.shopId, shopId),
      ne(orders.customerEmail, '')
    )
  );
  return new Set(data.map((o: any) => (o.customer_email || '').toLowerCase()));
}

// GET: Get chats for admin
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    
    if (!session?.user?.email) {
      return NextResponse.json('Unauthorized', { status: 401 });
    }
    
    if (!(await isAdminEmailAsync(session.user.email))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    if (searchParams.get('action') === 'admins') {
      const emails = await listAssignableAdminEmails();
      const admins = emails.map((email) => ({
        email,
        name: email.split('@')[0] || email,
      }));
      return NextResponse.json({ admins });
    }

    try {
      const settings = await getStoredSupportChatSettings();
      if (settings.auto_close_enabled) {
        await closeInactiveSupportChats(settings.auto_close_hours);
      }
    } catch (e) {
      console.error('[admin/support-chat] auto-close failed:', e);
    }
    
    const filter = searchParams.get('filter') as ChatStatus | 'all' | 'my' | null;
    const shopId = searchParams.get('shopId');
    
    const includeStats = searchParams.get('stats') !== '0';
    let shopEmails: Set<string> | null = null;
    if (shopId) {
      try {
        shopEmails = await getShopCustomerEmails(shopId);
      } catch (e) {
        console.error('[admin/support-chat] shop email filter failed:', e);
      }
    }

    const filterByShop = (list: ChatSession[]) => {
      if (!shopId) return list;
      return list.filter(c => {
        if ((c as any).shop_id === shopId) return true;
        if (shopEmails && shopEmails.has((c.customer_email || '').toLowerCase())) return true;
        return false;
      });
    };
    
    let chats: ChatSession[] = [];
    
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
      default: {
        const [pending, active] = await Promise.all([getPendingChats(), getActiveChats()]);
        chats = filterByShop([...pending, ...active]);
      }
    }
    
    let stats = null;
    if (includeStats) {
      try {
        stats = await getChatStatistics();
      } catch (e) {
        console.error('[admin/support-chat] stats failed:', e);
      }
    }
    
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
