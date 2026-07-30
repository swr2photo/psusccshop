import { NextRequest, NextResponse } from 'next/server';
import { withBackendProxy } from '@/lib/backend-proxy';
import { supabase } from '@/lib/supabase-client';
import { getCached, CACHE_TTL } from '@/lib/server-cache';
import { API_CACHE, API_CDN_HEADERS } from '@/lib/api-helpers';
import { secureJsonRequest, secureJsonResponse } from '@/lib/payload-crypto';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

async function GETHandler(_req: NextRequest) {
  const shops = await getCached('shops:public-catalog-v2', CACHE_TTL.catalog, async () => {
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
    return (data || [])
      .filter((shop: any) => (shop.products || []).some((p: any) => p.isActive !== false))
      .map((shop: any) => ({
        id: shop.id,
        slug: shop.slug,
        name: shop.name,
        nameEn: shop.name_en,
        logoUrl: shop.logo_url,
        isOpen: shop.settings?.isOpen ?? true,
        settings: shop.settings ? { isOpen: shop.settings.isOpen ?? true } : undefined,
        products: (shop.products || []).filter((p: any) => p.isActive !== false),
        events: shop.config?.events || [],
        shirtNameConfig: shop.config?.shirtNameConfig,
        pickup: shop.config?.pickup,
        promoCodes: shop.config?.promoCodes || [],
        nameValidation: shop.config?.nameValidation,
        shippingOptions: shop.config?.shippingOptions || [],
      }));
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
