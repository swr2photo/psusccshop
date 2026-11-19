import { withBackendProxy } from '@/lib/backend-proxy';
import { supabase } from '@/lib/supabase';
import { updateShop } from '@/lib/shops';
import { getCached, invalidateCacheKey, CACHE_TTL } from '@/lib/server-cache';
import { API_CACHE, API_CDN_HEADERS } from '@/lib/api-helpers';
import {
  sanitizePublicProducts,
  hasExpiredLockedPreview,
  getReleaseAwareSmaxAge,
  getClosedProductIdsMissingBlur,
} from '@/lib/sanitize';
import { ensureProductsBlurredImages } from '@/lib/server-image-blur';
import { secureJsonResponse } from '@/lib/payload-crypto';
import type { Product } from '@/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CATALOG_CACHE_KEY = 'shops:public-catalog-v5';

type ShopCatalogRow = {
  id: string;
  slug: string;
  name: string;
  name_en: string | null;
  logo_url: string | null;
  settings: {
    isOpen?: boolean;
    openDate?: string;
    showOpenDate?: boolean;
    closeDate?: string;
  } | null;
  products: Product[] | null;
  config: {
    events?: unknown[];
    shirtNameConfig?: unknown;
    pickup?: unknown;
    promoCodes?: unknown[];
    nameValidation?: unknown;
    shippingOptions?: unknown[];
  } | null;
};

async function buildSanitizedCatalog(now: Date) {
  const { data, error } = await supabase
    .from('shops')
    .select('id, slug, name, name_en, logo_url, settings, products, config')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    console.error('[shops] Edge catalog error:', error.message);
    return [];
  }

  const rows = (data || []) as ShopCatalogRow[];
  const mapped = await Promise.all(
    rows.map(async (shop) => {
      const shopState = {
        isOpen: shop.settings?.isOpen ?? true,
        openDate: shop.settings?.openDate,
        closeDate: shop.settings?.closeDate,
      };
      let rawProducts = shop.products || [];
      const missingIds = getClosedProductIdsMissingBlur(rawProducts, shopState, now);
      if (missingIds.size > 0) {
        try {
          const ensured = await ensureProductsBlurredImages(rawProducts, { onlyIds: missingIds });
          if (ensured.changed) {
            rawProducts = ensured.products;
            updateShop(shop.id, { products: rawProducts }).catch(() => {});
          }
        } catch (blurErr) {
          console.warn(`[shops-catalog] Blur backfill failed for shop ${shop.id}:`, blurErr);
        }
      }

      const products = sanitizePublicProducts(rawProducts, now, shopState);
      return {
        id: shop.id,
        slug: shop.slug,
        name: shop.name,
        nameEn: shop.name_en,
        logoUrl: shop.logo_url,
        isOpen: shopState.isOpen,
        openDate: shopState.openDate,
        showOpenDate: shop.settings?.showOpenDate,
        closeDate: shopState.closeDate,
        settings: shop.settings
          ? {
              isOpen: shopState.isOpen,
              openDate: shopState.openDate,
              showOpenDate: shop.settings.showOpenDate,
              closeDate: shopState.closeDate,
            }
          : undefined,
        products,
        events: shop.config?.events || [],
        shirtNameConfig: shop.config?.shirtNameConfig,
        pickup: shop.config?.pickup,
        promoCodes: shop.config?.promoCodes || [],
        nameValidation: shop.config?.nameValidation,
        shippingOptions: shop.config?.shippingOptions || [],
      };
    }),
  );

  return mapped.filter((shop) => shop.products.length > 0);
}

async function GETHandler() {
  const now = new Date();
  let shops = await getCached(CATALOG_CACHE_KEY, CACHE_TTL.catalog, () => buildSanitizedCatalog(new Date()));

  if (
    shops.some((shop) =>
      hasExpiredLockedPreview(
        shop.products,
        { isOpen: shop.isOpen, openDate: shop.openDate, closeDate: shop.closeDate },
        now,
      ),
    )
  ) {
    invalidateCacheKey(CATALOG_CACHE_KEY);
    shops = await getCached(CATALOG_CACHE_KEY, CACHE_TTL.catalog, () => buildSanitizedCatalog(new Date()));
  }

  let minMaxAge = 120;
  for (const shop of shops) {
    minMaxAge = Math.min(
      minMaxAge,
      getReleaseAwareSmaxAge(
        shop.products,
        { isOpen: shop.isOpen, openDate: shop.openDate, closeDate: shop.closeDate },
        120,
        now,
      ),
    );
  }

  const headers: Record<string, string> =
    minMaxAge <= 2
      ? { 'Cache-Control': 'no-store' }
      : minMaxAge < 120
      ? {
          'Cache-Control': `public, max-age=0, s-maxage=${minMaxAge}`,
          'CDN-Cache-Control': `public, max-age=${minMaxAge}`,
        }
      : {
          'Cache-Control': API_CACHE.medium,
          ...API_CDN_HEADERS.medium,
        };

  return await secureJsonResponse({ status: 'success', shops }, { headers });
}

export const GET = withBackendProxy(GETHandler);
