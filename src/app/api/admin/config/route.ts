import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { mergeConfigAdminEmails, resolveAdminSession } from '@/lib/admin-context';
import { getShopConfig, putJson } from '@/lib/filebase';
import { ShopConfig } from '@/lib/config';
import { sanitizeConfigForAdmin, sanitizeObjectUtf8 } from '@/lib/sanitize';
import { formatDbError } from '@/lib/db-query';
import { secureJsonRequest, secureJsonResponse } from '@/lib/payload-crypto';
import { invalidateCacheKey, PUBLIC_CONFIG_CACHE_KEY, LIVE_CACHE_KEY } from '@/lib/server-cache';

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
    return await secureJsonResponse(
      { status: 'error', message: 'แอดมินร้านย่อยใช้การตั้งค่าผ่านร้านที่ได้รับมอบหมายเท่านั้น' },
      { status: 403 },
    );
  }

  try {
    const cfg = (await getShopConfig()) || DEFAULT_ADMIN_CONFIG;

    const merged = mergeConfigAdminEmails(cfg as ShopConfig);
    const sanitizedConfig = sanitizeConfigForAdmin(merged as ShopConfig);

    return await secureJsonResponse(
      { status: 'success', data: { config: sanitizedConfig } },
      { headers: { 'Content-Type': 'application/json; charset=utf-8' } },
    );
  } catch (error: any) /* eslint-disable-line @typescript-eslint/no-explicit-any */ {
    console.error('[admin/config] failed:', formatDbError(error));
    const merged = mergeConfigAdminEmails(DEFAULT_ADMIN_CONFIG as ShopConfig);
    const sanitizedConfig = sanitizeConfigForAdmin(merged as ShopConfig);
    return await secureJsonResponse(
      { status: 'success', data: { config: sanitizedConfig, dbError: true } },
      { headers: { 'Content-Type': 'application/json; charset=utf-8' } },
    );
  }
}

/** Update shop config fields (such as flagshipConfig) and invalidate public cache. */
export async function POST(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if (authResult instanceof NextResponse) return authResult;

  const session = await resolveAdminSession(authResult.email);
  if (session.userRole === 'shopAdmin') {
    return await secureJsonResponse(
      { status: 'error', message: 'แอดมินร้านย่อยไม่สามารถแก้ไขการตั้งค่าร้านหลักได้' },
      { status: 403 },
    );
  }

  try {
    const body = await secureJsonRequest(req);
    const incoming = (body?.config && typeof body.config === 'object' ? body.config : body) as Partial<ShopConfig>;
    if (!incoming || typeof incoming !== 'object') {
      return await secureJsonResponse({ status: 'error', message: 'missing config' }, { status: 400 });
    }

    const currentConfig = ((await getShopConfig()) || DEFAULT_ADMIN_CONFIG) as ShopConfig;
    const nextConfig: ShopConfig = sanitizeObjectUtf8({
      ...currentConfig,
      ...(incoming.flagshipConfig !== undefined ? { flagshipConfig: incoming.flagshipConfig } : {}),
      ...(incoming.flagshipConfigs !== undefined ? { flagshipConfigs: incoming.flagshipConfigs } : {}),
    });

    await putJson('config/shop-settings.json', nextConfig);
    invalidateCacheKey(PUBLIC_CONFIG_CACHE_KEY);
    invalidateCacheKey(LIVE_CACHE_KEY);

    const merged = mergeConfigAdminEmails(nextConfig);
    const sanitizedConfig = sanitizeConfigForAdmin(merged);

    return await secureJsonResponse(
      { status: 'success', data: { config: sanitizedConfig } },
      { headers: { 'Content-Type': 'application/json; charset=utf-8' } },
    );
  } catch (error: any) /* eslint-disable-line @typescript-eslint/no-explicit-any */ {
    console.error('[admin/config] POST failed:', formatDbError(error));
    return await secureJsonResponse(
      { status: 'error', message: error?.message || 'save failed' },
      { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } },
    );
  }
}
