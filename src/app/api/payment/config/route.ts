// src/app/api/payment/config/route.ts
// Payment configuration API — Drizzle ORM

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isAdminEmailAsync } from '@/lib/auth';
import { db } from '@/lib/db';
import { config } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { PaymentConfig, DEFAULT_PAYMENT_CONFIG } from '@/lib/payment';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CONFIG_KEY = 'payment_config';

// GET - Retrieve payment config
export async function GET(request: NextRequest) {
  try {
    const rows = await db.select().from(config).where(eq(config.key, CONFIG_KEY)).limit(1);
    const data = rows[0];

    if (!data) {
      return NextResponse.json({ success: true, data: DEFAULT_PAYMENT_CONFIG });
    }

    const paymentCfg = data.value as unknown as PaymentConfig;
    const session = await getServerSession(authOptions);
    const isAdminUser = session?.user?.email ? await isAdminEmailAsync(session.user.email) : false;

    if (!isAdminUser) {
      const publicConfig: PaymentConfig = {
        ...paymentCfg,
        options: paymentCfg.options.filter(opt => opt.enabled),
        gateways: paymentCfg.gateways.map(gw => ({
          ...gw,
          webhookEndpoint: undefined,
        })),
      };
      return NextResponse.json({ success: true, data: publicConfig });
    }

    return NextResponse.json({ success: true, data: paymentCfg });
  } catch (error) {
    console.error('[API] Get payment config error:', error);
    return NextResponse.json({ success: false, error: 'Failed to get payment config' }, { status: 500 });
  }
}

// POST - Update payment config (admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email || !(await isAdminEmailAsync(session.user.email))) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const newConfig: PaymentConfig = body.config;

    if (!newConfig || !Array.isArray(newConfig.options)) {
      return NextResponse.json({ success: false, error: 'Invalid payment config' }, { status: 400 });
    }

    await db.insert(config)
      .values({ key: CONFIG_KEY, value: newConfig })
      .onConflictDoUpdate({
        target: config.key,
        set: { value: newConfig, updatedAt: new Date() },
      });

    return NextResponse.json({ success: true, message: 'Payment config updated successfully' });
  } catch (error) {
    console.error('[API] Update payment config error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update payment config' }, { status: 500 });
  }
}
