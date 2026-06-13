// src/app/api/shipping/options/route.ts
// Shipping options configuration API — Drizzle ORM

import { NextRequest, NextResponse } from 'next/server';
import { isAdminEmailAsync } from '@/lib/auth';
import { formatDbError, getConfigValueCached, invalidateConfigCache } from '@/lib/config-db';
import { getSessionFromRequest } from '@/lib/session-from-request';
import { db } from '@/lib/db';
import { config } from '@/db/schema';
import { CACHE_TTL } from '@/lib/server-cache';
import { ShippingConfig, DEFAULT_SHIPPING_CONFIG } from '@/lib/shipping';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CONFIG_KEY = 'shipping_config';

// GET - Retrieve shipping options
export async function GET(request: NextRequest) {
  try {
    const shippingCfg = await getConfigValueCached<ShippingConfig>(
      CONFIG_KEY,
      CACHE_TTL.catalog,
    );

    if (!shippingCfg) {
      return NextResponse.json({ success: true, data: DEFAULT_SHIPPING_CONFIG });
    }

    let isAdminUser = false;
    const session = await getSessionFromRequest(request);
    if (session?.user?.email) {
      isAdminUser = await isAdminEmailAsync(session.user.email);
    }

    if (!isAdminUser) {
      const publicConfig: ShippingConfig = {
        ...shippingCfg,
        options: shippingCfg.options.filter((opt) => opt.enabled),
      };
      return NextResponse.json(
        { success: true, data: publicConfig },
        { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } },
      );
    }

    return NextResponse.json(
      { success: true, data: shippingCfg },
      { headers: { 'Cache-Control': 'private, no-cache' } },
    );
  } catch (error) {
    console.error(
      '[API] Get shipping options error, falling back to default:',
      formatDbError(error),
    );
    return NextResponse.json(
      { success: true, data: DEFAULT_SHIPPING_CONFIG },
      { headers: { 'Cache-Control': 'no-store' } },
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

    invalidateConfigCache(CONFIG_KEY);

    return NextResponse.json({ success: true, message: 'Shipping config updated successfully' });
  } catch (error) {
    console.error('[API] Update shipping options error:', formatDbError(error));
    return NextResponse.json({ success: false, error: 'Failed to update shipping options' }, { status: 500 });
  }
}
