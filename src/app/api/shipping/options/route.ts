// src/app/api/shipping/options/route.ts
// Shipping options configuration API — Prisma

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isAdminEmail } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ShippingConfig, DEFAULT_SHIPPING_CONFIG } from '@/lib/shipping';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CONFIG_KEY = 'shipping_config';

// GET - Retrieve shipping options
export async function GET(request: NextRequest) {
  try {
    const data = await prisma.config.findUnique({ where: { key: CONFIG_KEY } });

    if (!data) {
      return NextResponse.json({ success: true, data: DEFAULT_SHIPPING_CONFIG });
    }

    const config = data.value as unknown as ShippingConfig;
    const session = await getServerSession(authOptions);
    const isAdminUser = session?.user?.email ? isAdminEmail(session.user.email) : false;

    if (!isAdminUser) {
      const publicConfig: ShippingConfig = {
        ...config,
        options: config.options.filter(opt => opt.enabled),
      };
      return NextResponse.json(
        { success: true, data: publicConfig },
        { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } }
      );
    }

    return NextResponse.json(
      { success: true, data: config },
      { headers: { 'Cache-Control': 'private, no-cache' } }
    );
  } catch (error) {
    console.error('[API] Get shipping options error:', error);
    return NextResponse.json({ success: false, error: 'Failed to get shipping options' }, { status: 500 });
  }
}

// POST - Update shipping options (admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email || !isAdminEmail(session.user.email)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const newConfig: ShippingConfig = body.config;

    if (!newConfig || !Array.isArray(newConfig.options)) {
      return NextResponse.json({ success: false, error: 'Invalid shipping config' }, { status: 400 });
    }

    await prisma.config.upsert({
      where: { key: CONFIG_KEY },
      update: { value: newConfig as any },
      create: { key: CONFIG_KEY, value: newConfig as any },
    });

    return NextResponse.json({ success: true, message: 'Shipping config updated successfully' });
  } catch (error) {
    console.error('[API] Update shipping options error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update shipping options' }, { status: 500 });
  }
}
