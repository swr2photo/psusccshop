import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { mergeConfigAdminEmails, resolveAdminSession } from '@/lib/admin-context';
import { getShopConfig } from '@/lib/filebase';
import { ShopConfig } from '@/lib/config';
import { sanitizeConfigForAdmin } from '@/lib/sanitize';
import { formatDbError } from '@/lib/db-query';

const DEFAULT_ADMIN_CONFIG = {
  isOpen: true,
  closeDate: '',
  announcement: { enabled: false, message: '', color: 'blue' },
  products: [],
  sheetId: '',
  sheetUrl: '',
  vendorSheetId: '',
  vendorSheetUrl: '',
};

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Shop config only — for admin settings/products tabs. */
export async function GET(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if (authResult instanceof NextResponse) return authResult;

  const session = await resolveAdminSession(authResult.email);
  if (session.userRole === 'shopAdmin') {
    return NextResponse.json(
      { status: 'error', message: 'แอดมินร้านย่อยใช้การตั้งค่าผ่านร้านที่ได้รับมอบหมายเท่านั้น' },
      { status: 403 },
    );
  }

  try {
    const cfg = (await getShopConfig()) || DEFAULT_ADMIN_CONFIG;

    const merged = mergeConfigAdminEmails(cfg as ShopConfig);
    const sanitizedConfig = sanitizeConfigForAdmin(merged as ShopConfig);

    return NextResponse.json(
      { status: 'success', data: { config: sanitizedConfig } },
      { headers: { 'Content-Type': 'application/json; charset=utf-8' } },
    );
  } catch (error: unknown) {
    console.error('[admin/config] failed:', formatDbError(error));
    const merged = mergeConfigAdminEmails(DEFAULT_ADMIN_CONFIG as ShopConfig);
    const sanitizedConfig = sanitizeConfigForAdmin(merged as ShopConfig);
    return NextResponse.json(
      { status: 'success', data: { config: sanitizedConfig, dbError: true } },
      { headers: { 'Content-Type': 'application/json; charset=utf-8' } },
    );
  }
}
