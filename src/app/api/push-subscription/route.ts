// src/app/api/push-subscription/route.ts
// Manage push notification subscriptions — Drizzle ORM

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { pushSubscriptions } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { secureJsonRequest, secureJsonResponse } from '@/lib/payload-crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST: Save or update push subscription
export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session?.user?.email) {
      return await secureJsonResponse({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await secureJsonRequest(request);
    const { subscription, action } = body;

    if (action === 'unsubscribe') {
      await db.delete(pushSubscriptions)
        .where(
          and(
            eq(pushSubscriptions.email, session.user.email),
            eq(pushSubscriptions.endpoint, subscription?.endpoint || '')
          )
        );
      return await secureJsonResponse({ success: true, action: 'unsubscribed' });
    }

    if (!subscription?.endpoint || !subscription?.keys) {
      return await secureJsonResponse({ error: 'Invalid subscription data' }, { status: 400 });
    }

    await db.insert(pushSubscriptions)
      .values({
        email: session.user.email,
        endpoint: subscription.endpoint,
        keysP256dh: subscription.keys.p256dh,
        keysAuth: subscription.keys.auth,
      })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: {
          email: session.user.email,
          keysP256dh: subscription.keys.p256dh,
          keysAuth: subscription.keys.auth,
        },
      });

    return await secureJsonResponse({ success: true, action: 'subscribed' });
  } catch (error: any) /* eslint-disable-line @typescript-eslint/no-explicit-any */ {
    console.error('[push-subscription] Error:', error);
    return await secureJsonResponse({ error: error.message }, { status: 500 });
  }
}
