// /api/shops/[shopId]/public — Public shop data (no auth required)
import { NextRequest } from 'next/server';
import { getShopById, toPublicShopData, updateShop } from '@/lib/shops';
import { API_CACHE } from '@/lib/api-helpers';
import { secureJsonResponse } from '@/lib/payload-crypto';
import { getReleaseAwareSmaxAge, getClosedProductIdsMissingBlur } from '@/lib/sanitize';
import { ensureProductsBlurredImages } from '@/lib/server-image-blur';

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
  const shopState = {
    isOpen: shop.settings?.isOpen ?? true,
    openDate: shop.settings?.openDate,
    closeDate: shop.settings?.closeDate,
  };

  const missingIds = getClosedProductIdsMissingBlur(shop.products, shopState, now);
  let effectiveShop = shop;
  if (missingIds.size > 0) {
    try {
      const ensured = await ensureProductsBlurredImages(shop.products || [], { onlyIds: missingIds });
      if (ensured.changed) {
        effectiveShop = { ...shop, products: ensured.products };
        updateShop(shop.id, { products: ensured.products }).catch(() => {});
      }
    } catch (blurErr) {
      console.warn('[shop-public] Blur backfill failed:', blurErr);
    }
  }

  const publicShop = toPublicShopData(effectiveShop);
  const maxAge = getReleaseAwareSmaxAge(publicShop.products, shopState, 120, now);
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
