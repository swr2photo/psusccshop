// /api/shops/[shopId]/public — Public shop data (no auth required)
import { NextRequest } from 'next/server';
import { getShopById, toPublicShopData } from '@/lib/shops';
import { API_CACHE } from '@/lib/api-helpers';
import { secureJsonResponse } from '@/lib/payload-crypto';
import { getReleaseAwareSmaxAge } from '@/lib/sanitize';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ shopId: string }>;
}

/** GET /api/shops/[shopId]/public — Get public shop data (products, announcements, events, etc.) */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { shopId } = await params;

  const shop = await getShopById(shopId);
  if (!shop || !shop.isActive) {
    return await secureJsonResponse(
      { status: 'error', message: 'ไม่พบร้านค้า' },
      { status: 404 }
    );
  }

  const now = new Date();
  const publicShop = toPublicShopData(shop);
  const maxAge = getReleaseAwareSmaxAge(publicShop.products, publicShop.openDate, 120, now);
  const cacheControl =
    maxAge <= 2
      ? 'no-store'
      : maxAge < 120
      ? `public, max-age=0, s-maxage=${maxAge}`
      : API_CACHE.medium;

  return await secureJsonResponse(
    { status: 'success', shop: publicShop },
    {
      headers: {
        'Cache-Control': cacheControl,
      },
    }
  );
}
