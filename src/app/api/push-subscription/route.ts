// src/app/api/push-subscription/route.ts
// Manage push notification subscriptions — Prisma

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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

    if (action === 'unsubscribe') {
      await prisma.pushSubscription.deleteMany({
        where: {
          email: session.user.email,
          endpoint: subscription?.endpoint || '',
        },
      });
      return NextResponse.json({ success: true, action: 'unsubscribed' });
    }

    if (!subscription?.endpoint || !subscription?.keys) {
      return NextResponse.json({ error: 'Invalid subscription data' }, { status: 400 });
    }

    await prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      update: {
        email: session.user.email,
        keys_p256dh: subscription.keys.p256dh,
        keys_auth: subscription.keys.auth,
      },
      create: {
        email: session.user.email,
        endpoint: subscription.endpoint,
        keys_p256dh: subscription.keys.p256dh,
        keys_auth: subscription.keys.auth,
      },
    });

    return NextResponse.json({ success: true, action: 'subscribed' });
  } catch (error: any) {
    console.error('[push-subscription] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
