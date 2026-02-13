import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin, requireAdmin } from '@/lib/auth';
import { 
  getAdminPermissionsFromDB, 
  getAllAdminPermissionsFromDB, 
  saveAdminPermissionsToDB,
  saveAllAdminPermissionsToDB,
  deleteAdminPermissionsFromDB 
} from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/permissions
 * ดึงสิทธิ์แอดมินทั้งหมด (super admin only) หรือสิทธิ์ตัวเอง (admin)
 */
export async function GET(req: NextRequest) {
  const adminResult = await requireAdmin();
  if (adminResult instanceof NextResponse) return adminResult;

  const { searchParams } = new URL(req.url);
  const email = searchParams.get('email');

  try {
    // If specific email requested, only super admin can view others' perms
    if (email && email.toLowerCase() !== adminResult.email.toLowerCase()) {
      const superCheck = await requireSuperAdmin();
      if (superCheck instanceof NextResponse) return superCheck;
    }

    if (email) {
      const perms = await getAdminPermissionsFromDB(email);
      return NextResponse.json({ status: 'success', data: perms });
    }

    // Get all - super admin only
    const superCheck = await requireSuperAdmin();
    if (superCheck instanceof NextResponse) {
      // Not super admin - return only own perms
      const perms = await getAdminPermissionsFromDB(adminResult.email);
      return NextResponse.json({ status: 'success', data: { [adminResult.email]: perms || {} } });
    }

    const allPerms = await getAllAdminPermissionsFromDB();
    return NextResponse.json({ status: 'success', data: allPerms });
  } catch (error: any) {
    console.error('[admin/permissions] GET error:', error);
    return NextResponse.json(
      { status: 'error', message: error?.message || 'Failed to get permissions' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/permissions
 * บันทึกสิทธิ์แอดมิน (super admin only)
 * Body: { permissions: Record<string, AdminPermissions> }
 *   or: { email: string, permissions: AdminPermissions }
 */
export async function POST(req: NextRequest) {
  const superCheck = await requireSuperAdmin();
  if (superCheck instanceof NextResponse) return superCheck;

  try {
    const body = await req.json();
    
    // Batch save: { permissions: { "email@example.com": { canManageOrders: true, ... } } }
    if (body.permissions && typeof body.permissions === 'object' && !body.email) {
      const ok = await saveAllAdminPermissionsToDB(body.permissions);
      if (!ok) throw new Error('Failed to save permissions to database');
      return NextResponse.json({ status: 'success', message: 'Permissions saved' });
    }

    // Single save: { email: "...", permissions: { ... } }
    if (body.email && body.permissions) {
      const ok = await saveAdminPermissionsToDB(body.email, body.permissions);
      if (!ok) throw new Error('Failed to save permissions to database');
      return NextResponse.json({ status: 'success', message: 'Permissions saved' });
    }

    return NextResponse.json(
      { status: 'error', message: 'Invalid request body' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('[admin/permissions] POST error:', error);
    return NextResponse.json(
      { status: 'error', message: error?.message || 'Failed to save permissions' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/permissions
 * ลบสิทธิ์แอดมิน (super admin only)
 * Body: { email: string }
 */
export async function DELETE(req: NextRequest) {
  const superCheck = await requireSuperAdmin();
  if (superCheck instanceof NextResponse) return superCheck;

  try {
    const body = await req.json();
    if (!body.email) {
      return NextResponse.json(
        { status: 'error', message: 'Missing email' },
        { status: 400 }
      );
    }

    const ok = await deleteAdminPermissionsFromDB(body.email);
    if (!ok) throw new Error('Failed to delete permissions from database');
    
    return NextResponse.json({ status: 'success', message: 'Permissions deleted' });
  } catch (error: any) {
    console.error('[admin/permissions] DELETE error:', error);
    return NextResponse.json(
      { status: 'error', message: error?.message || 'Failed to delete permissions' },
      { status: 500 }
    );
  }
}
