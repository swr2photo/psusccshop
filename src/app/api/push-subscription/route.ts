// src/app/api/push-subscription/route.ts
// Manage push notification subscriptions

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST: Save or update push subscription
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { subscription, action } = body;

    const db = getSupabaseAdmin();
    if (!db) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }

    if (action === 'unsubscribe') {
      // Remove subscription
      await db
        .from('push_subscriptions')
        .delete()
        .eq('email', session.user.email)
        .eq('endpoint', subscription?.endpoint || '');

      return NextResponse.json({ success: true, action: 'unsubscribed' });
    }

    if (!subscription?.endpoint || !subscription?.keys) {
      return NextResponse.json({ error: 'Invalid subscription data' }, { status: 400 });
    }

    // Upsert subscription (one user can have multiple devices)
    const { error } = await db
      .from('push_subscriptions')
      .upsert({
        email: session.user.email,
        endpoint: subscription.endpoint,
        keys_p256dh: subscription.keys.p256dh,
        keys_auth: subscription.keys.auth,
        user_agent: request.headers.get('user-agent') || '',
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'endpoint',
      });

    if (error) {
      console.error('[push-subscription] Upsert error:', error);
      return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 });
    }

    return NextResponse.json({ success: true, action: 'subscribed' });
  } catch (error: any) {
    console.error('[push-subscription] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
