// src/app/api/shipping/options/route.ts
// Shipping options configuration API — Drizzle ORM

import { NextRequest, NextResponse } from 'next/server';
import { isAdminEmailAsync } from '@/lib/auth';
import { formatDbError, getConfigValueCached, invalidateConfigCache } from '@/lib/config-db';
import { getSessionFromRequest } from '@/lib/session-from-request';
import { db } from '@/lib/db';
import { config } from '@/db/schema';
import { CACHE_TTL } from '@/lib/server-cache';
import { ShippingConfig, DEFAULT_SHIPPING_CONFIG, toPublicShippingConfig } from '@/lib/shipping';
import { secureJsonRequest, secureJsonResponse } from '@/lib/payload-crypto';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CONFIG_KEY = 'shipping_config';

async function publicJson(cfg: ShippingConfig, cacheControl: string, cdnMaxAge = 300) {
  return await secureJsonResponse(
    { success: true, data: toPublicShippingConfig(cfg) },
    {
      headers: {
        'Cache-Control': cacheControl,
        'CDN-Cache-Control': `public, max-age=${cdnMaxAge}`,
      },
    },
  );
}

// GET - Retrieve shipping options
export async function GET(request: NextRequest) {
  try {
    const shippingCfg = await getConfigValueCached<ShippingConfig>(
      CONFIG_KEY,
      CACHE_TTL.catalog,
    );

    const source = shippingCfg || DEFAULT_SHIPPING_CONFIG;

    let isAdminUser = false;
    const session = await getSessionFromRequest(request);
    if (session?.user?.email) {
      isAdminUser = await isAdminEmailAsync(session.user.email);
    }

    if (!isAdminUser) {
      return publicJson(source, 'public, s-maxage=300, stale-while-revalidate=600');
    }

    return await secureJsonResponse(
      { success: true, data: source },
      { headers: { 'Cache-Control': 'private, no-cache' } },
    );
  } catch (error) {
    console.error(
      '[API] Get shipping options error, falling back to default:',
      formatDbError(error),
    );
    // Never leak full default (disabled carriers / track123 codes) on error.
    return publicJson(DEFAULT_SHIPPING_CONFIG, 'no-store');
  }
}

// POST - Update shipping options (admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session?.user?.email || !(await isAdminEmailAsync(session.user.email))) {
      return await secureJsonResponse({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await secureJsonRequest(request);
    const newConfig: ShippingConfig = body.config;

    if (!newConfig || !Array.isArray(newConfig.options)) {
      return await secureJsonResponse({ success: false, error: 'Invalid shipping config' }, { status: 400 });
    }

    await db.insert(config)
      .values({ key: CONFIG_KEY, value: newConfig })
      .onConflictDoUpdate({
        target: config.key,
        set: { value: newConfig, updatedAt: new Date() },
      });

    invalidateConfigCache(CONFIG_KEY);

    return await secureJsonResponse({ success: true, message: 'Shipping config updated successfully' });
  } catch (error) {
    console.error('[API] Update shipping options error:', formatDbError(error));
    return await secureJsonResponse({ success: false, error: 'Failed to update shipping options' }, { status: 500 });
  }
}
