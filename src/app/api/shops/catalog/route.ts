import { withBackendProxy } from '@/lib/backend-proxy';
import { supabase } from '@/lib/supabase-client';
import { getCached, CACHE_TTL } from '@/lib/server-cache';
import { API_CACHE, API_CDN_HEADERS } from '@/lib/api-helpers';
import { secureJsonResponse } from '@/lib/payload-crypto';
import { sanitizePublicProducts } from '@/lib/sanitize';
import type { Product } from '@/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ShopCatalogRow = {
  id: string;
  slug: string;
  name: string;
  name_en: string | null;
  logo_url: string | null;
  settings: {
    isOpen?: boolean;
    openDate?: string;
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

async function GETHandler() {
  const shops = await getCached('shops:public-catalog-v4', CACHE_TTL.catalog, async () => {
    // Fetch directly using Supabase JS (Edge Compatible, uses fetch under the hood)
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

    // Format to match the previous response (toPublicShopCatalogEntry equivalent)
    const rows = (data || []) as ShopCatalogRow[];
    return rows
      .map((shop) => {
        const products = sanitizePublicProducts(shop.products);
        return {
          id: shop.id,
          slug: shop.slug,
          name: shop.name,
          nameEn: shop.name_en,
          logoUrl: shop.logo_url,
          isOpen: shop.settings?.isOpen ?? true,
          openDate: shop.settings?.openDate,
          closeDate: shop.settings?.closeDate,
          settings: shop.settings ? { 
            isOpen: shop.settings.isOpen ?? true,
            openDate: shop.settings.openDate,
            closeDate: shop.settings.closeDate
          } : undefined,
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
  });

  return await secureJsonResponse(
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
