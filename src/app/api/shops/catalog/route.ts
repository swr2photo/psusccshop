// GET /api/shops/catalog — Public sub-shop catalog for main storefront
import { NextResponse } from 'next/server';
import { listActivePublicShopCatalog } from '@/lib/shops';
import { API_CACHE } from '@/lib/api-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
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
