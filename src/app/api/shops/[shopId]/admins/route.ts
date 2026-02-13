// /api/shops/[shopId]/admins — Manage shop admins
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, isSuperAdminEmail } from '@/lib/auth';
import { listShopAdmins, addShopAdmin, updateShopAdmin, removeShopAdmin, getShopAdminRole } from '@/lib/shops';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ shopId: string }> };

/** GET /api/shops/[shopId]/admins — List shop admins */
export async function GET(req: NextRequest, { params }: Params) {
  const { shopId } = await params;
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;

  const isSuperAdmin = isSuperAdminEmail(authResult.email);
  if (!isSuperAdmin) {
    const role = await getShopAdminRole(shopId, authResult.email);
    if (!role) {
      return NextResponse.json({ status: 'error', message: 'ไม่มีสิทธิ์' }, { status: 403 });
    }
  }

  const admins = await listShopAdmins(shopId);
  return NextResponse.json({ status: 'success', admins });
}

/** POST /api/shops/[shopId]/admins — Add admin to shop */
export async function POST(req: NextRequest, { params }: Params) {
  const { shopId } = await params;
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;

  const isSuperAdmin = isSuperAdminEmail(authResult.email);
  if (!isSuperAdmin) {
    const role = await getShopAdminRole(shopId, authResult.email);
    if (!role || (!role.permissions.canAddAdmins && role.role !== 'owner')) {
      return NextResponse.json({ status: 'error', message: 'ไม่มีสิทธิ์เพิ่มแอดมิน' }, { status: 403 });
    }
  }

  try {
    const body = await req.json();
    const { email, role, permissions } = body;

    if (!email) {
      return NextResponse.json({ status: 'error', message: 'กรุณาระบุอีเมล' }, { status: 400 });
    }

    // Only SuperAdmin can set role to 'owner'
    const adminRole = (!isSuperAdmin && role === 'owner') ? 'admin' : (role || 'admin');

    const admin = await addShopAdmin(shopId, email, adminRole, permissions, authResult.email);
    if (!admin) {
      return NextResponse.json({ status: 'error', message: 'เพิ่มแอดมินไม่สำเร็จ' }, { status: 500 });
    }

    return NextResponse.json({ status: 'success', admin }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ status: 'error', message: error?.message || 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

/** PUT /api/shops/[shopId]/admins — Update admin permissions */
export async function PUT(req: NextRequest, { params }: Params) {
  const { shopId } = await params;
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;

  const isSuperAdmin = isSuperAdminEmail(authResult.email);
  if (!isSuperAdmin) {
    const role = await getShopAdminRole(shopId, authResult.email);
    if (!role || (!role.permissions.canAddAdmins && role.role !== 'owner')) {
      return NextResponse.json({ status: 'error', message: 'ไม่มีสิทธิ์แก้ไขสิทธิ์แอดมิน' }, { status: 403 });
    }
  }

  try {
    const body = await req.json();
    const { email, role, permissions } = body;

    if (!email) {
      return NextResponse.json({ status: 'error', message: 'กรุณาระบุอีเมล' }, { status: 400 });
    }

    const admin = await updateShopAdmin(shopId, email, { role, permissions });
    if (!admin) {
      return NextResponse.json({ status: 'error', message: 'อัปเดตไม่สำเร็จ' }, { status: 500 });
    }

    return NextResponse.json({ status: 'success', admin });
  } catch (error: any) {
    return NextResponse.json({ status: 'error', message: error?.message || 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

/** DELETE /api/shops/[shopId]/admins — Remove admin from shop */
export async function DELETE(req: NextRequest, { params }: Params) {
  const { shopId } = await params;
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;

  const isSuperAdmin = isSuperAdminEmail(authResult.email);
  if (!isSuperAdmin) {
    const role = await getShopAdminRole(shopId, authResult.email);
    if (!role || (!role.permissions.canAddAdmins && role.role !== 'owner')) {
      return NextResponse.json({ status: 'error', message: 'ไม่มีสิทธิ์ลบแอดมิน' }, { status: 403 });
    }
  }

  const url = new URL(req.url);
  const email = url.searchParams.get('email');
  if (!email) {
    return NextResponse.json({ status: 'error', message: 'กรุณาระบุอีเมล' }, { status: 400 });
  }

  // Prevent removing yourself if you're the only owner
  const admins = await listShopAdmins(shopId);
  const owners = admins.filter(a => a.role === 'owner');
  const targetAdmin = admins.find(a => a.email === email.toLowerCase().trim());
  if (targetAdmin?.role === 'owner' && owners.length <= 1) {
    return NextResponse.json({ status: 'error', message: 'ไม่สามารถลบเจ้าของร้านคนสุดท้ายได้' }, { status: 400 });
  }

  const ok = await removeShopAdmin(shopId, email);
  if (!ok) {
    return NextResponse.json({ status: 'error', message: 'ลบไม่สำเร็จ' }, { status: 500 });
  }
  return NextResponse.json({ status: 'success' });
}
