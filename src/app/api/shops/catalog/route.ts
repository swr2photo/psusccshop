import { withBackendProxy } from '@/lib/backend-proxy';
import { supabase } from '@/lib/supabase';
import { getCached, invalidateCacheKey, CACHE_TTL } from '@/lib/server-cache';
import { API_CACHE, API_CDN_HEADERS } from '@/lib/api-helpers';
import { sanitizePublicProducts, hasExpiredLockedPreview, getReleaseAwareSmaxAge } from '@/lib/sanitize';
import { secureJsonResponse } from '@/lib/payload-crypto';
import type { Product } from '@/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CATALOG_CACHE_KEY = 'shops:public-catalog-v4';

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
  return rows
    .map((shop) => {
      const products = sanitizePublicProducts(shop.products, now, shop.settings?.openDate);
      return {
        id: shop.id,
        slug: shop.slug,
        name: shop.name,
        nameEn: shop.name_en,
        logoUrl: shop.logo_url,
        isOpen: shop.settings?.isOpen ?? true,
        openDate: shop.settings?.openDate,
        showOpenDate: shop.settings?.showOpenDate,
        closeDate: shop.settings?.closeDate,
        settings: shop.settings
          ? {
              isOpen: shop.settings.isOpen ?? true,
              openDate: shop.settings.openDate,
              showOpenDate: shop.settings.showOpenDate,
              closeDate: shop.settings.closeDate,
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
    })
    .filter((shop) => shop.products.length > 0);
}

async function GETHandler() {
  const now = new Date();
  let shops = await getCached(CATALOG_CACHE_KEY, CACHE_TTL.catalog, () => buildSanitizedCatalog(new Date()));

  if (shops.some((shop) => hasExpiredLockedPreview(shop.products, shop.openDate, now))) {
    invalidateCacheKey(CATALOG_CACHE_KEY);
    shops = await getCached(CATALOG_CACHE_KEY, CACHE_TTL.catalog, () => buildSanitizedCatalog(new Date()));
  }

  let minMaxAge = 120;
  for (const shop of shops) {
    minMaxAge = Math.min(minMaxAge, getReleaseAwareSmaxAge(shop.products, shop.openDate, 120, now));
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
