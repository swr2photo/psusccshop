// GET /api/shops/catalog — Public sub-shop catalog for main storefront
import { NextRequest, NextResponse } from 'next/server';
import { withBackendProxy } from '@/lib/backend-proxy';
import { listActivePublicShopCatalog } from '@/lib/shops';
import { API_CACHE, API_CDN_HEADERS } from '@/lib/api-helpers';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

async function GETHandler(_req: NextRequest) {
  const shops = await listActivePublicShopCatalog();
  return NextResponse.json(
    { status: 'success', shops },
    {
      headers: {
        'Cache-Control': API_CACHE.medium,
        ...API_CDN_HEADERS.medium,
      },
    }
  );
}

export const GET = withBackendProxy(GETHandler);
