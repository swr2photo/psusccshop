/* eslint-disable @typescript-eslint/no-explicit-any */
// /api/shops/[shopId]/products — Get/Update shop products
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, isSuperAdminEmail } from '@/lib/auth';
import { getShopById, updateShop, getShopAdminRole } from '@/lib/shops';
import { API_CACHE } from '@/lib/api-helpers';
import { secureJsonRequest, secureJsonResponse } from '@/lib/payload-crypto';
import {
  sanitizePublicProducts,
  getReleaseAwareSmaxAge,
  getClosedProductIdsMissingBlur,
} from '@/lib/sanitize';
import { ensureProductsBlurredImages } from '@/lib/server-image-blur';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ shopId: string }> };

/** GET /api/shops/[shopId]/products — Get shop products (public) */
export async function GET(req: NextRequest, { params }: Params) {
  const { shopId } = await params;
  const shop = await getShopById(shopId);
  if (!shop || !shop.isActive) {
    return await secureJsonResponse({ status: 'error', message: 'ไม่พบร้านค้า' }, { status: 404 });
  }

  const now = new Date();
  const shopState = {
    isOpen: shop.settings?.isOpen ?? true,
    openDate: shop.settings?.openDate,
    closeDate: shop.settings?.closeDate,
  };

  let allProducts = shop.products || [];
  const missingIds = getClosedProductIdsMissingBlur(allProducts, shopState, now);
  if (missingIds.size > 0) {
    try {
      const ensured = await ensureProductsBlurredImages(allProducts, { onlyIds: missingIds });
      if (ensured.changed) {
        allProducts = ensured.products;
        updateShop(shop.id, { products: allProducts }).catch(() => {});
      }
    } catch (blurErr) {
      console.warn('[shop-products] Blur backfill failed:', blurErr);
    }
  }

  const activeProducts = allProducts.filter((p: any) => p.isActive !== false);
  const products = sanitizePublicProducts(activeProducts, now, shopState);
  const maxAge = getReleaseAwareSmaxAge(products, shopState, 120, now);
  const cacheControl =
    maxAge <= 2
      ? 'no-store'
      : maxAge < 120
      ? `public, max-age=0, s-maxage=${maxAge}`
      : API_CACHE.medium;

  return await secureJsonResponse(
    { status: 'success', products, shopName: shop.name },
    { headers: { 'Cache-Control': cacheControl } },
  );
}

/** PUT /api/shops/[shopId]/products — Update shop products (admin) */
export async function PUT(req: NextRequest, { params }: Params) {
  const { shopId } = await params;
  const authResult = await requireAdmin(req);
  if (authResult instanceof NextResponse) return authResult;

  const isSuperAdmin = isSuperAdminEmail(authResult.email);
  if (!isSuperAdmin) {
    const role = await getShopAdminRole(shopId, authResult.email);
    if (!role || !role.permissions.canManageProducts) {
      return await secureJsonResponse({ status: 'error', message: 'ไม่มีสิทธิ์จัดการสินค้า' }, { status: 403 });
    }
  }

  try {
    const body = await secureJsonRequest(req);
    const { products } = body;

    if (!Array.isArray(products)) {
      return await secureJsonResponse({ status: 'error', message: 'products ต้องเป็น array' }, { status: 400 });
    }

    const existingShop = await getShopById(shopId);
    const ensured = await ensureProductsBlurredImages(products, {
      existingProducts: existingShop?.products,
    });

    const shop = await updateShop(shopId, { products: ensured.products });
    if (!shop) {
      return await secureJsonResponse({ status: 'error', message: 'อัปเดตสินค้าไม่สำเร็จ' }, { status: 500 });
    }

    return await secureJsonResponse({ status: 'success', products: shop.products });
  } catch (error: any) /* eslint-disable-line @typescript-eslint/no-explicit-any */ {
    return await secureJsonResponse({ status: 'error', message: error?.message || 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
