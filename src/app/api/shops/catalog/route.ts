// GET /api/shops/catalog — Public sub-shop catalog for main storefront
import { NextRequest, NextResponse } from 'next/server';
import { withBackendProxy } from '@/lib/backend-proxy';
import { listActivePublicShopCatalog } from '@/lib/shops';
import { API_CACHE } from '@/lib/api-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function GETHandler(_req: NextRequest) {
  const shops = await listActivePublicShopCatalog();
  return NextResponse.json(
    { status: 'success', shops },
    {
      headers: {
        'Cache-Control': API_CACHE.medium,
      },
    }
  );
}

export const GET = withBackendProxy(GETHandler);
