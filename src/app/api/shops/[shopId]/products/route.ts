// /api/shops/[shopId]/products — Get/Update shop products
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, isSuperAdminEmail } from '@/lib/auth';
import { getShopById, updateShop, getShopAdminRole } from '@/lib/shops';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ shopId: string }> };

/** GET /api/shops/[shopId]/products — Get shop products (public) */
export async function GET(req: NextRequest, { params }: Params) {
  const { shopId } = await params;
  const shop = await getShopById(shopId);
  if (!shop || !shop.isActive) {
    return NextResponse.json({ status: 'error', message: 'ไม่พบร้านค้า' }, { status: 404 });
  }

  // Return only active products for public
  const products = (shop.products || []).filter((p: any) => p.isActive !== false);
  return NextResponse.json({ status: 'success', products, shopName: shop.name });
}

/** PUT /api/shops/[shopId]/products — Update shop products (admin) */
export async function PUT(req: NextRequest, { params }: Params) {
  const { shopId } = await params;
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;

  const isSuperAdmin = isSuperAdminEmail(authResult.email);
  if (!isSuperAdmin) {
    const role = await getShopAdminRole(shopId, authResult.email);
    if (!role || !role.permissions.canManageProducts) {
      return NextResponse.json({ status: 'error', message: 'ไม่มีสิทธิ์จัดการสินค้า' }, { status: 403 });
    }
  }

  try {
    const body = await req.json();
    const { products } = body;

    if (!Array.isArray(products)) {
      return NextResponse.json({ status: 'error', message: 'products ต้องเป็น array' }, { status: 400 });
    }

    const shop = await updateShop(shopId, { products });
    if (!shop) {
      return NextResponse.json({ status: 'error', message: 'อัปเดตสินค้าไม่สำเร็จ' }, { status: 500 });
    }

    return NextResponse.json({ status: 'success', products: shop.products });
  } catch (error: any) {
    return NextResponse.json({ status: 'error', message: error?.message || 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
