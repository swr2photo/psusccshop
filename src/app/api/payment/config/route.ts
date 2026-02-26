// src/app/api/payment/config/route.ts
// Payment configuration API — Prisma

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isAdminEmail } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PaymentConfig, DEFAULT_PAYMENT_CONFIG } from '@/lib/payment';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CONFIG_KEY = 'payment_config';

// GET - Retrieve payment config
export async function GET(request: NextRequest) {
  try {
    const data = await prisma.config.findUnique({ where: { key: CONFIG_KEY } });

    if (!data) {
      return NextResponse.json({ success: true, data: DEFAULT_PAYMENT_CONFIG });
    }

    const config = data.value as unknown as PaymentConfig;
    const session = await getServerSession(authOptions);
    const isAdminUser = session?.user?.email ? isAdminEmail(session.user.email) : false;

    if (!isAdminUser) {
      const publicConfig: PaymentConfig = {
        ...config,
        options: config.options.filter(opt => opt.enabled),
        gateways: config.gateways.map(gw => ({
          ...gw,
          webhookEndpoint: undefined,
        })),
      };
      return NextResponse.json({ success: true, data: publicConfig });
    }

    return NextResponse.json({ success: true, data: config });
  } catch (error) {
    console.error('[API] Get payment config error:', error);
    return NextResponse.json({ success: false, error: 'Failed to get payment config' }, { status: 500 });
  }
}

// POST - Update payment config (admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email || !isAdminEmail(session.user.email)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const newConfig: PaymentConfig = body.config;

    if (!newConfig || !Array.isArray(newConfig.options)) {
      return NextResponse.json({ success: false, error: 'Invalid payment config' }, { status: 400 });
    }

    await prisma.config.upsert({
      where: { key: CONFIG_KEY },
      update: { value: newConfig as any },
      create: { key: CONFIG_KEY, value: newConfig as any },
    });

    return NextResponse.json({ success: true, message: 'Payment config updated successfully' });
  } catch (error) {
    console.error('[API] Update payment config error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update payment config' }, { status: 500 });
  }
}
