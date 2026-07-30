// src/app/api/payment/config/route.ts
// Payment configuration API — Drizzle ORM

import { NextRequest, NextResponse } from 'next/server';
import { isAdminEmailAsync, getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { config } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { PaymentConfig, DEFAULT_PAYMENT_CONFIG } from '@/lib/payment';
import { invalidateConfigCache } from '@/lib/config-db';
import { secureJsonRequest, secureJsonResponse } from '@/lib/payload-crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CONFIG_KEY = 'payment_config';

// GET - Retrieve payment config
export async function GET(request: NextRequest) {
  try {
    const rows = await db.select().from(config).where(eq(config.key, CONFIG_KEY)).limit(1);
    const data = rows[0];

    if (!data) {
      return await secureJsonResponse({ success: true, data: DEFAULT_PAYMENT_CONFIG });
    }

    const paymentCfg = data.value as unknown as PaymentConfig;
    const session = await getSession(request);
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
      return await secureJsonResponse({ success: true, data: publicConfig });
    }

    return await secureJsonResponse({ success: true, data: paymentCfg });
  } catch (error) {
    console.error('[API] Get payment config error:', error);
    return await secureJsonResponse({ success: false, error: 'Failed to get payment config' }, { status: 500 });
  }
}

// POST - Update payment config (admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session?.user?.email || !(await isAdminEmailAsync(session.user.email))) {
      return await secureJsonResponse({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await secureJsonRequest(request);
    const newConfig: PaymentConfig = body.config;

    if (!newConfig || !Array.isArray(newConfig.options)) {
      return await secureJsonResponse({ success: false, error: 'Invalid payment config' }, { status: 400 });
    }

    await db.insert(config)
      .values({ key: CONFIG_KEY, value: newConfig })
      .onConflictDoUpdate({
        target: config.key,
        set: { value: newConfig, updatedAt: new Date() },
      });

    invalidateConfigCache(CONFIG_KEY);

    return await secureJsonResponse({ success: true, message: 'Payment config updated successfully' });
  } catch (error) {
    console.error('[API] Update payment config error:', error);
    return await secureJsonResponse({ success: false, error: 'Failed to update payment config' }, { status: 500 });
  }
}
