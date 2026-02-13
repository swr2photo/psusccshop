// /api/shops — List shops & Create shop
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, isSuperAdminEmail } from '@/lib/auth';
import { listAllShops, listActiveShops, createShop, getShopsForAdmin } from '@/lib/shops';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/shops — List shops */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const publicMode = url.searchParams.get('public') === '1';

  // Public mode: list active shops for storefront (no auth required)
  if (publicMode) {
    const shops = await listActiveShops();
    return NextResponse.json({ status: 'success', shops });
  }

  // Admin mode: requires auth
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;

  const isSuperAdmin = isSuperAdminEmail(authResult.email);

  if (isSuperAdmin) {
    // SuperAdmin sees all shops
    const shops = await listAllShops();
    return NextResponse.json({ status: 'success', shops, role: 'superadmin' });
  }

  // Regular admin sees only their assigned shops
  const shopRoles = await getShopsForAdmin(authResult.email);
  const shops = shopRoles.map(sr => ({ ...sr.shop, role: sr.role, permissions: sr.permissions }));
  return NextResponse.json({ status: 'success', shops, role: 'admin' });
}

/** POST /api/shops — Create a new shop (SuperAdmin only) */
export async function POST(req: NextRequest) {
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;

  if (!isSuperAdminEmail(authResult.email)) {
    return NextResponse.json({ status: 'error', message: 'เฉพาะ SuperAdmin เท่านั้น' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { name, nameEn, slug, description, descriptionEn, paymentInfo, logoUrl } = body;

    if (!name || !slug) {
      return NextResponse.json({ status: 'error', message: 'กรุณาระบุชื่อร้านและ slug' }, { status: 400 });
    }

    // Validate slug format
    const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    if (!cleanSlug || cleanSlug.length < 2) {
      return NextResponse.json({ status: 'error', message: 'slug ต้องมีอย่างน้อย 2 ตัวอักษร (a-z, 0-9, -)' }, { status: 400 });
    }

    const shop = await createShop({
      slug: cleanSlug,
      name,
      nameEn,
      description,
      descriptionEn,
      ownerEmail: authResult.email, // SuperAdmin is the owner
      paymentInfo,
      logoUrl,
    });

    if (!shop) {
      return NextResponse.json({ status: 'error', message: 'สร้างร้านค้าไม่สำเร็จ (slug ซ้ำ?)' }, { status: 409 });
    }

    return NextResponse.json({ status: 'success', shop }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ status: 'error', message: error?.message || 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
