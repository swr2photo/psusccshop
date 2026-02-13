// /api/shops/[shopId] — Get, Update, Delete shop
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, isSuperAdminEmail } from '@/lib/auth';
import { getShopById, updateShop, deleteShop, getShopAdminRole } from '@/lib/shops';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ shopId: string }> };

/** GET /api/shops/[shopId] — Get shop details */
export async function GET(req: NextRequest, { params }: Params) {
  const { shopId } = await params;
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;

  const isSuperAdmin = isSuperAdminEmail(authResult.email);

  // Check access
  if (!isSuperAdmin) {
    const role = await getShopAdminRole(shopId, authResult.email);
    if (!role) {
      return NextResponse.json({ status: 'error', message: 'ไม่มีสิทธิ์เข้าถึงร้านค้านี้' }, { status: 403 });
    }
  }

  const shop = await getShopById(shopId);
  if (!shop) {
    return NextResponse.json({ status: 'error', message: 'ไม่พบร้านค้า' }, { status: 404 });
  }

  return NextResponse.json({ status: 'success', shop });
}

/** PUT /api/shops/[shopId] — Update shop */
export async function PUT(req: NextRequest, { params }: Params) {
  const { shopId } = await params;
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;

  const isSuperAdmin = isSuperAdminEmail(authResult.email);

  // Check access - must be superadmin or shop admin with canManageShop
  if (!isSuperAdmin) {
    const role = await getShopAdminRole(shopId, authResult.email);
    if (!role || (!role.permissions.canManageShop && role.role !== 'owner')) {
      return NextResponse.json({ status: 'error', message: 'ไม่มีสิทธิ์แก้ไขร้านค้านี้' }, { status: 403 });
    }
  }

  try {
    const body = await req.json();
    const shop = await updateShop(shopId, body);
    if (!shop) {
      return NextResponse.json({ status: 'error', message: 'อัปเดตไม่สำเร็จ' }, { status: 500 });
    }
    return NextResponse.json({ status: 'success', shop });
  } catch (error: any) {
    return NextResponse.json({ status: 'error', message: error?.message || 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

/** DELETE /api/shops/[shopId] — Delete shop (SuperAdmin only) */
export async function DELETE(req: NextRequest, { params }: Params) {
  const { shopId } = await params;
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;

  if (!isSuperAdminEmail(authResult.email)) {
    return NextResponse.json({ status: 'error', message: 'เฉพาะ SuperAdmin เท่านั้น' }, { status: 403 });
  }

  const ok = await deleteShop(shopId);
  if (!ok) {
    return NextResponse.json({ status: 'error', message: 'ลบไม่สำเร็จ' }, { status: 500 });
  }
  return NextResponse.json({ status: 'success' });
}
