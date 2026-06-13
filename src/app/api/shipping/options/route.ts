// src/app/api/shipping/options/route.ts
// Shipping options configuration API — Drizzle ORM

import { NextRequest, NextResponse } from 'next/server';
import { isAdminEmailAsync } from '@/lib/auth';
import { getSessionFromRequest } from '@/lib/session-from-request';
import { db } from '@/lib/db';
import { withDbTimeout } from '@/lib/db-timeout';
import { config } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { ShippingConfig, DEFAULT_SHIPPING_CONFIG } from '@/lib/shipping';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CONFIG_KEY = 'shipping_config';

// GET - Retrieve shipping options
export async function GET(request: NextRequest) {
  try {
    const rows = await withDbTimeout(
      db.select().from(config).where(eq(config.key, CONFIG_KEY)).limit(1),
      8_000,
      'shipping options query',
    );
    const data = rows[0];

    if (!data) {
      return NextResponse.json({ success: true, data: DEFAULT_SHIPPING_CONFIG });
    }

    const shippingCfg = data.value as unknown as ShippingConfig;

    let isAdminUser = false;
    const session = await getSessionFromRequest(request);
    if (session?.user?.email) {
      isAdminUser = await isAdminEmailAsync(session.user.email);
    }

    if (!isAdminUser) {
      const publicConfig: ShippingConfig = {
        ...shippingCfg,
        options: shippingCfg.options.filter(opt => opt.enabled),
      };
      return NextResponse.json(
        { success: true, data: publicConfig },
        { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } }
      );
    }

    return NextResponse.json(
      { success: true, data: shippingCfg },
      { headers: { 'Cache-Control': 'private, no-cache' } }
    );
  } catch (error) {
    console.error('[API] Get shipping options error, falling back to default:', error);
    return NextResponse.json(
      { success: true, data: DEFAULT_SHIPPING_CONFIG },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

// POST - Update shipping options (admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session?.user?.email || !(await isAdminEmailAsync(session.user.email))) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const newConfig: ShippingConfig = body.config;

    if (!newConfig || !Array.isArray(newConfig.options)) {
      return NextResponse.json({ success: false, error: 'Invalid shipping config' }, { status: 400 });
    }

    await db.insert(config)
      .values({ key: CONFIG_KEY, value: newConfig })
      .onConflictDoUpdate({
        target: config.key,
        set: { value: newConfig, updatedAt: new Date() },
      });

    return NextResponse.json({ success: true, message: 'Shipping config updated successfully' });
  } catch (error) {
    console.error('[API] Update shipping options error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update shipping options' }, { status: 500 });
  }
}
