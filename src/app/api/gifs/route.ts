import { NextRequest, NextResponse } from 'next/server';
import { secureJsonRequest, secureJsonResponse } from '@/lib/payload-crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GIPHY_BASE = 'https://api.giphy.com/v1/gifs';

function getApiKey(): string | null {
  const key = process.env.GIPHY_API_KEY?.trim() || '';
  return key || null;
}

type GiphyImage = { url?: string; width?: string; height?: string };
type GiphyGif = {
  id: string;
  title?: string;
  images?: {
    fixed_width_small?: GiphyImage;
    preview_gif?: GiphyImage;
    fixed_height_small?: GiphyImage;
    fixed_width?: GiphyImage;
    downsized?: GiphyImage;
    downsized_medium?: GiphyImage;
    original?: GiphyImage;
  };
};

function pickUrl(...candidates: Array<GiphyImage | undefined>): string | null {
  for (const c of candidates) {
    const url = c?.url?.trim();
    if (url && /^https?:\/\//i.test(url)) return url;
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const key = getApiKey();
    if (!key) {
      return await secureJsonResponse({ configured: false, error: 'GIPHY_API_KEY_MISSING', gifs: [] });
    }

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim().slice(0, 64);
    const limit = Math.min(40, Math.max(1, Number(searchParams.get('limit')) || 24));
    // Client may pass `pos` (legacy Tenor) or `offset` — both map to Giphy offset
    const offsetRaw = searchParams.get('offset') || searchParams.get('pos') || '0';
    const offset = Math.max(0, Number.parseInt(offsetRaw, 10) || 0);

    const params = new URLSearchParams({
      api_key: key,
      limit: String(limit),
      offset: String(offset),
      rating: 'pg-13',
    });
    if (q) params.set('q', q);

    const path = q ? 'search' : 'trending';
    const res = await fetch(`${GIPHY_BASE}/${path}?${params.toString()}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });

    if (!res.ok) {
      console.error('[api/gifs] Giphy error', res.status);
      return await secureJsonResponse(
        { configured: true, error: 'GIPHY_FETCH_FAILED', gifs: [] },
        { status: 502 }
      );
    }

    const data = (await res.json()) as {
      data?: GiphyGif[];
      pagination?: { total_count?: number; count?: number; offset?: number };
    };

    const gifs = (data.data || [])
      .map((r) => {
        const imgs = r.images;
        const previewUrl = pickUrl(
          imgs?.fixed_width_small,
          imgs?.preview_gif,
          imgs?.fixed_height_small,
          imgs?.fixed_width
        );
        const url = pickUrl(
          imgs?.downsized,
          imgs?.downsized_medium,
          imgs?.fixed_width,
          imgs?.original,
          imgs?.fixed_width_small
        );
        if (!url || !previewUrl) return null;
        return {
          id: r.id,
          title: (r.title || 'GIF').trim() || 'GIF',
          previewUrl,
          url,
        };
      })
      .filter(Boolean);

    const nextOffset =
      data.pagination &&
      typeof data.pagination.offset === 'number' &&
      typeof data.pagination.count === 'number' &&
      typeof data.pagination.total_count === 'number' &&
      data.pagination.offset + data.pagination.count < data.pagination.total_count
        ? String(data.pagination.offset + data.pagination.count)
        : null;

    return await secureJsonResponse({ configured: true, gifs, next: nextOffset });
  } catch (error) {
    console.error('[api/gifs]', error);
    return await secureJsonResponse({ configured: true, error: 'INTERNAL', gifs: [] }, { status: 500 });
  }
}
