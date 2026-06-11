// /api/shops/[shopId]/admins — Manage shop admins
import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth';
import { listShopAdmins, addShopAdmin, updateShopAdmin, removeShopAdmin } from '@/lib/shops';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ shopId: string }> };

/** GET /api/shops/[shopId]/admins — List shop admins (Super Admin only) */
export async function GET(req: NextRequest, { params }: Params) {
  const { shopId } = await params;
  const authResult = await requireSuperAdmin();
  if (authResult instanceof NextResponse) return authResult;

  const admins = await listShopAdmins(shopId);
  return NextResponse.json({ status: 'success', admins });
}

/** POST /api/shops/[shopId]/admins — Add admin to shop (Super Admin only) */
export async function POST(req: NextRequest, { params }: Params) {
  const { shopId } = await params;
  const authResult = await requireSuperAdmin();
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await req.json();
    const { email, role, permissions } = body;

    if (!email) {
      return NextResponse.json({ status: 'error', message: 'กรุณาระบุอีเมล' }, { status: 400 });
    }

    const adminRole = role || 'admin';

    const admin = await addShopAdmin(shopId, email, adminRole, permissions, authResult.email);
    return NextResponse.json({ status: 'success', admin }, { status: 201 });
  } catch (error: any) {
    console.error('[shops/admins] POST error:', error?.message);
    const message = error?.message?.includes('shop_admins')
      ? 'ตาราง shop_admins ยังไม่ได้สร้างในฐานข้อมูล กรุณารัน migration scripts/supabase-multi-shop-schema.sql'
      : (error?.message || 'เพิ่มแอดมินไม่สำเร็จ');
    return NextResponse.json({ status: 'error', message }, { status: 500 });
  }
}

/** PUT /api/shops/[shopId]/admins — Update admin permissions (Super Admin only) */
export async function PUT(req: NextRequest, { params }: Params) {
  const { shopId } = await params;
  const authResult = await requireSuperAdmin();
  if (authResult instanceof NextResponse) return authResult;

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

/** DELETE /api/shops/[shopId]/admins — Remove admin from shop (Super Admin only) */
export async function DELETE(req: NextRequest, { params }: Params) {
  const { shopId } = await params;
  const authResult = await requireSuperAdmin();
  if (authResult instanceof NextResponse) return authResult;

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
