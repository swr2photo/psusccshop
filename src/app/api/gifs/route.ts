import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TENOR_BASE = 'https://tenor.googleapis.com/v2';
const CLIENT_KEY = 'psusccshop';

function getApiKey(): string | null {
  const key =
    process.env.TENOR_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_TENOR_API_KEY?.trim() ||
    '';
  return key || null;
}

type TenorMedia = { url?: string };
type TenorResult = {
  id: string;
  title?: string;
  content_description?: string;
  media_formats?: Record<string, TenorMedia>;
};

function pickUrl(formats: Record<string, TenorMedia> | undefined, keys: string[]) {
  if (!formats) return null;
  for (const k of keys) {
    if (formats[k]?.url) return formats[k]!.url!;
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const key = getApiKey();
    if (!key) {
      return NextResponse.json({ configured: false, error: 'TENOR_API_KEY_MISSING', gifs: [] });
    }

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim().slice(0, 64);
    const limit = Math.min(40, Math.max(1, Number(searchParams.get('limit')) || 24));
    const pos = (searchParams.get('pos') || '').trim();

    const params = new URLSearchParams({
      key,
      client_key: CLIENT_KEY,
      limit: String(limit),
      media_filter: 'gif,tinygif,nanogif,mediumgif',
      contentfilter: 'medium',
    });
    if (pos) params.set('pos', pos);
    if (q) params.set('q', q);

    const path = q ? 'search' : 'featured';
    const res = await fetch(`${TENOR_BASE}/${path}?${params.toString()}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });

    if (!res.ok) {
      console.error('[api/gifs] Tenor error', res.status);
      return NextResponse.json(
        { configured: true, error: 'TENOR_FETCH_FAILED', gifs: [] },
        { status: 502 }
      );
    }

    const data = (await res.json()) as { results?: TenorResult[]; next?: string };
    const gifs = (data.results || [])
      .map((r) => {
        const previewUrl = pickUrl(r.media_formats, ['nanogif', 'tinygif', 'gif', 'mediumgif']);
        const url = pickUrl(r.media_formats, ['gif', 'mediumgif', 'tinygif', 'nanogif']);
        if (!url || !previewUrl) return null;
        return {
          id: r.id,
          title: r.title || r.content_description || 'GIF',
          previewUrl,
          url,
        };
      })
      .filter(Boolean);

    return NextResponse.json({ configured: true, gifs, next: data.next || null });
  } catch (error) {
    console.error('[api/gifs]', error);
    return NextResponse.json({ configured: true, error: 'INTERNAL', gifs: [] }, { status: 500 });
  }
}
