import { NextResponse } from 'next/server';
import { getJson, putJson } from '@/lib/filebase';
import { requireAdmin } from '@/lib/auth';
import type { ShopConfig } from '@/lib/config';
import type { LiveStreamData } from '@/lib/live-stream';
import {
  getCached,
  invalidateCacheKey,
  CACHE_TTL,
  LIVE_CACHE_KEY,
} from '@/lib/server-cache';

const CONFIG_KEY = 'config/shop-settings.json';

function buildPublicLivePayload(live: ShopConfig['liveStream']): LiveStreamData | null {
  if (!live?.enabled) return null;

  return {
    enabled: live.enabled,
    title: live.title,
    description: live.description,
    streamUrl: live.streamUrl,
    streamType: live.streamType,
    thumbnailUrl: live.thumbnailUrl,
    startedAt: live.startedAt,
    autoPopup: live.autoPopup,
    featuredProducts: live.featuredProducts,
  };
}

async function getLiveResponseBody(): Promise<{ live: LiveStreamData | null }> {
  return getCached(LIVE_CACHE_KEY, CACHE_TTL.live, async () => {
    const config = await getJson<ShopConfig>(CONFIG_KEY);
    return { live: buildPublicLivePayload(config?.liveStream) };
  });
}

const LIVE_CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=45',
};

// GET — Public: Get current live stream status
export async function GET() {
  try {
    const body = await getLiveResponseBody();
    return NextResponse.json(body, { headers: LIVE_CACHE_HEADERS });
  } catch (error) {
    console.error('[API/live] GET error, falling back to no-live state:', error);
    return NextResponse.json({ live: null }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}

// POST — Admin only: Update live stream settings
export async function POST(request: Request) {
  try {
    const auth = await requireAdmin(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { liveStream } = body;

    if (!liveStream || typeof liveStream !== 'object') {
      return NextResponse.json({ error: 'Invalid liveStream data' }, { status: 400 });
    }

    const config = await getJson<ShopConfig>(CONFIG_KEY) || {} as ShopConfig;

    config.liveStream = {
      enabled: Boolean(liveStream.enabled),
      title: String(liveStream.title || 'ไลฟ์สดขายของ').slice(0, 200),
      description: liveStream.description ? String(liveStream.description).slice(0, 500) : undefined,
      streamUrl: String(liveStream.streamUrl || '').slice(0, 1000),
      streamType: ['hls', 'youtube', 'facebook', 'custom'].includes(liveStream.streamType) 
        ? liveStream.streamType : 'youtube',
      thumbnailUrl: liveStream.thumbnailUrl ? String(liveStream.thumbnailUrl).slice(0, 1000) : undefined,
      startedAt: liveStream.enabled ? (config.liveStream?.startedAt || new Date().toISOString()) : undefined,
      endedAt: !liveStream.enabled && config.liveStream?.enabled ? new Date().toISOString() : undefined,
      autoPopup: Boolean(liveStream.autoPopup ?? true),
      featuredProducts: Array.isArray(liveStream.featuredProducts) 
        ? liveStream.featuredProducts.slice(0, 50).map(String) : undefined,
      updatedBy: auth.email,
      updatedAt: new Date().toISOString(),
    };

    await putJson(CONFIG_KEY, config);
    invalidateCacheKey(LIVE_CACHE_KEY);

    return NextResponse.json({ 
      success: true, 
      liveStream: config.liveStream,
    });
  } catch (error) {
    console.error('[API/live] POST error:', error);
    return NextResponse.json({ error: 'Failed to update live stream' }, { status: 500 });
  }
}
