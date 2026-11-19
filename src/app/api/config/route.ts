/* eslint-disable */
import { NextRequest, NextResponse } from 'next/server';
import { withBackendProxy } from '@/lib/backend-proxy';
import { getJson, putJson, syncShopOpenStatusToRedis } from '@/lib/filebase';
import { ShopConfig } from '@/lib/config';
import { requireAdmin, isSuperAdminEmail } from '@/lib/auth';
import { resolveAdminSession } from '@/lib/admin-context';
import {
  sanitizeConfigForAdmin,
  sanitizeConfigForPublic,
  sanitizeObjectUtf8,
  hasExpiredLockedPreview,
  getReleaseAwareSmaxAge,
  getClosedProductIdsMissingBlur,
} from '@/lib/sanitize';
import { ensureProductsBlurredImages } from '@/lib/server-image-blur';
import { saveAllAdminPermissionsToDB, getAllAdminPermissionsFromDB, deleteAdminPermissionsFromDB } from '@/lib/supabase';
import { secureJsonRequest, secureJsonResponse } from '@/lib/payload-crypto';
import { mergeRealtimeStock } from '@/lib/redis-stock-merge';
import {
  getCached,
  invalidateCacheKey,
  CACHE_TTL,
  PUBLIC_CONFIG_CACHE_KEY,
  LIVE_CACHE_KEY,
} from '@/lib/server-cache';

// Helper to save user log server-side
const userLogKey = (id: string) => `user-logs/${id}.json`;
interface LogEntry {
  id: string;
  email: string;
  name?: string;
  action: string;
  details?: string;
  metadata?: Record<string, any>;
  ip?: string;
  userAgent?: string;
  timestamp: string;
}
const saveUserLogServer = async (params: {
  email: string;
  name?: string;
  action: string;
  details?: string;
  metadata?: Record<string, any>;
  ip?: string;
  userAgent?: string;
}) => {
  try {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const entry: LogEntry = {
      id,
      email: params.email,
      name: params.name,
      action: params.action,
      details: params.details,
      metadata: params.metadata,
      ip: params.ip,
      userAgent: params.userAgent,
      timestamp: new Date().toISOString(),
    };
    await putJson(userLogKey(id), entry);
  } catch (e) {
    console.error('[Config] Failed to save user log:', e);
  }
};

const CONFIG_KEY = 'config/shop-settings.json';

const DEFAULT_CONFIG: ShopConfig = {
  isOpen: true,
  closeDate: '',
  openDate: '',
  closedMessage: '',
  paymentEnabled: true,
  paymentDisabledMessage: '',
  announcement: { enabled: false, message: '', color: 'blue' },
  products: [],
  sheetId: '',
  sheetUrl: '',
  // Keep factory sheet linkage in defaults so it never disappears when config is empty
  vendorSheetId: '',
  vendorSheetUrl: '',
  bankAccount: { bankName: '', accountName: '', accountNumber: '' },
};

function sanitizeSlip2GoApiUrl(raw?: string): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return 'https://connect.slip2go.com';
  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();
    if (parsed.protocol === 'https:' && (host === 'slip2go.com' || host.endsWith('.slip2go.com'))) {
      return `${parsed.origin}${parsed.pathname.replace(/\/+$/, '')}`;
    }
  } catch {
    // fallback below
  }
  return 'https://connect.slip2go.com';
}

async function loadPublicPayload(now: Date) {
  let cfg = DEFAULT_CONFIG;
  let loadedFromDb = false;
  try {
    const dbConfig = await getJson<ShopConfig>(CONFIG_KEY);
    if (dbConfig) {
      cfg = dbConfig;
      loadedFromDb = true;
    }
  } catch (error) {
    console.error('[Config API] Failed to load config from database, falling back to default:', error);
  }

  // Auto-generate & upload blurred images to Storage for any closed/unreleased products missing one
  const shopState = { isOpen: cfg.isOpen, openDate: cfg.openDate, closeDate: cfg.closeDate };
  const missingBlurIds = getClosedProductIdsMissingBlur(cfg.products, shopState, now);
  if (loadedFromDb && missingBlurIds.size > 0) {
    try {
      const ensured = await ensureProductsBlurredImages(cfg.products || [], { onlyIds: missingBlurIds });
      if (ensured.changed) {
        cfg = { ...cfg, products: ensured.products };
        await putJson(CONFIG_KEY, cfg).catch((persistErr) => {
          console.warn('[Config API] Failed to persist backfilled blurred images:', persistErr);
        });
      }
    } catch (blurErr) {
      console.warn('[Config API] Auto-backfill blurred images failed:', blurErr);
    }
  }

  const mergedCfg = await mergeRealtimeStock(cfg);
  const sanitizedConfig = sanitizeConfigForPublic(mergedCfg, now);
  return { status: 'success' as const, data: sanitizedConfig };
}

async function GETHandler() {
  const now = new Date();
  let payload = await getCached(PUBLIC_CONFIG_CACHE_KEY, CACHE_TTL.config, () => loadPublicPayload(new Date()));

  const cachedShopState = {
    isOpen: payload.data?.isOpen,
    openDate: payload.data?.openDate,
    closeDate: payload.data?.closeDate,
  };
  if (hasExpiredLockedPreview(payload.data?.products, cachedShopState, now)) {
    invalidateCacheKey(PUBLIC_CONFIG_CACHE_KEY);
    payload = await getCached(PUBLIC_CONFIG_CACHE_KEY, CACHE_TTL.config, () => loadPublicPayload(new Date()));
  }

  const finalShopState = {
    isOpen: payload.data?.isOpen,
    openDate: payload.data?.openDate,
    closeDate: payload.data?.closeDate,
  };
  const maxAge = getReleaseAwareSmaxAge(payload.data?.products, finalShopState, 10, now);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json; charset=utf-8',
    ...(maxAge <= 2
      ? { 'Cache-Control': 'no-store' }
      : {
          'Cache-Control': `public, max-age=0, s-maxage=${maxAge}, stale-while-revalidate=${maxAge < 10 ? 0 : 30}`,
          'CDN-Cache-Control': `public, max-age=${maxAge}`,
        }),
  };

  return await secureJsonResponse(payload, { headers });
}

async function POSTHandler(req: NextRequest) {
  // ตรวจสอบสิทธิ์ Admin - เฉพาะ global admin เท่านั้นที่แก้ config ร้านหลักได้
  const authResult = await requireAdmin(req);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const adminSession = await resolveAdminSession(authResult.email);
  if (adminSession.userRole === 'shopAdmin') {
    return await secureJsonResponse(
      { status: 'error', message: 'แอดมินร้านย่อยไม่สามารถแก้ไขการตั้งค่าร้านหลักได้' },
      { status: 403 }
    );
  }

  try {
    const body = await secureJsonRequest(req);
    const config = body?.config as ShopConfig | undefined;
    if (!config) return await secureJsonResponse({ status: 'error', message: 'missing config' }, { status: 400 });

    // ⚠️ Safety: prevent saving config with empty products if DB already has products
    // This prevents accidental data wipe from race conditions or stale client state
    const currentConfig = await getJson<ShopConfig>(CONFIG_KEY);
    // An admin deleting the last product(s) on purpose names them in deletedProductIds.
    // Allow the empty list only when those ids cover every product still stored.
    const deletedIds = new Set(
      Array.isArray(body?.deletedProductIds) ? body.deletedProductIds.map((id: unknown) => String(id)) : [],
    );
    const isIntentionalDeleteAll =
      deletedIds.size > 0 && (currentConfig?.products || []).every((p) => deletedIds.has(String(p.id)));
    if (
      currentConfig &&
      (currentConfig.products?.length ?? 0) > 0 &&
      (!config.products || config.products.length === 0) &&
      !isIntentionalDeleteAll
    ) {
      console.error(`[config] BLOCKED: attempted to save 0 products when DB has ${currentConfig.products?.length}. User: ${authResult.email}`);
      return await secureJsonResponse(
        { status: 'error', message: 'ไม่สามารถบันทึกได้: กรุณาโหลดข้อมูลสินค้าก่อนบันทึก (ป้องกันข้อมูลหาย)' },
        { status: 409 }
      );
    }

    // Protect admin management fields - only super admin can modify these
    if (!isSuperAdminEmail(authResult.email)) {
      if (currentConfig) {
        // Prevent non-super-admin from modifying adminEmails or adminPermissions
        config.adminEmails = currentConfig.adminEmails;
        config.adminPermissions = currentConfig.adminPermissions;
      }
    }

    // Preserve flagshipConfig / flagshipConfigs if omitted by another settings tab
    if (currentConfig) {
      if (config.flagshipConfig === undefined && currentConfig.flagshipConfig !== undefined) {
        config.flagshipConfig = currentConfig.flagshipConfig;
      }
      if (config.flagshipConfigs === undefined && currentConfig.flagshipConfigs !== undefined) {
        config.flagshipConfigs = currentConfig.flagshipConfigs;
      }
    }

    // Normalize Slip2Go verification config & preserve stored Secret Key unless explicitly replaced
    const existingSlipSecret = currentConfig?.slipVerifyConfig?.secretKey?.trim() || '';
    const incomingSlipCfg = config.slipVerifyConfig;
    const rawIncomingSecret = (incomingSlipCfg?.secretKey || '').trim();
    const isMaskedOrEmpty =
      !rawIncomingSecret ||
      rawIncomingSecret.startsWith('*') ||
      rawIncomingSecret.startsWith('•') ||
      rawIncomingSecret.startsWith('ENV ');
    config.slipVerifyConfig = {
      provider: 'slip2go',
      apiUrl: sanitizeSlip2GoApiUrl(incomingSlipCfg?.apiUrl || currentConfig?.slipVerifyConfig?.apiUrl),
      ...(isMaskedOrEmpty
        ? existingSlipSecret
          ? { secretKey: existingSlipSecret }
          : {}
        : { secretKey: rawIncomingSecret }),
    };

    // Ensure every product has its server-uploaded blurred cover image stored alongside the real image
    if (Array.isArray(config.products) && config.products.length > 0) {
      try {
        const ensured = await ensureProductsBlurredImages(config.products, {
          existingProducts: currentConfig?.products,
        });
        config.products = ensured.products;
      } catch (blurErr) {
        console.warn('[config] Blurred image generation warning on save:', blurErr);
      }
    }

    // Sanitize UTF-8 input ก่อนบันทึก
    const sanitizedConfig = sanitizeObjectUtf8(config);

    await putJson(CONFIG_KEY, sanitizedConfig);
    invalidateCacheKey(PUBLIC_CONFIG_CACHE_KEY);
    invalidateCacheKey(LIVE_CACHE_KEY);
    if (sanitizedConfig.isOpen !== undefined) {
      try {
        await syncShopOpenStatusToRedis(sanitizedConfig.isOpen);
      } catch (e) {
        console.error('[config] Failed to sync shop status to Redis cache:', e);
      }
    }

    // Sync admin permissions to DB (if present in config)
    if (config.adminPermissions && typeof config.adminPermissions === 'object') {
      try {
        await saveAllAdminPermissionsToDB(config.adminPermissions as Record<string, Record<string, boolean>>);

        const dbPerms = await getAllAdminPermissionsFromDB();
        const configEmails = new Set(Object.keys(config.adminPermissions).map(e => e.toLowerCase()));
        for (const dbEmail of Object.keys(dbPerms)) {
          if (!configEmails.has(dbEmail.toLowerCase())) {
            await deleteAdminPermissionsFromDB(dbEmail);
          }
        }
      } catch (e) {
        console.error('[config] Failed to sync admin permissions to DB:', e);
      }
    }

    // Log config change
    const userAgent = req.headers.get('user-agent') || undefined;
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
                     req.headers.get('x-real-ip') || undefined;

    const changes: string[] = [];
    if (config.isOpen !== undefined) changes.push(config.isOpen ? 'เปิดร้าน' : 'ปิดร้าน');
    if (config.products?.length) changes.push(`สินค้า ${config.products.length} รายการ`);
    if (config.announcement?.enabled) changes.push('ประกาศ');
    if (config.bankAccount?.accountNumber) changes.push('บัญชีธนาคาร');

    const configDetails = `แก้ไขการตั้งค่าร้าน${changes.length ? ': ' + changes.join(', ') : ''}`;
    await saveUserLogServer({
      email: authResult.email,
      name: undefined,
      action: 'admin_config_change',
      details: configDetails,
      metadata: {
        isOpen: config.isOpen,
        productCount: config.products?.length || 0,
        announcementEnabled: config.announcement?.enabled,
        paymentEnabled: config.paymentEnabled,
      },
      ip: clientIP,
      userAgent,
    });
    const { writeAuditTrail } = await import('@/lib/audit');
    await writeAuditTrail({
      entityType: 'config',
      entityId: 'shop-settings',
      action: 'admin_config_change',
      performedBy: authResult.email,
      changes: {
        summary: configDetails,
        after: {
          isOpen: config.isOpen,
          productCount: config.products?.length || 0,
          announcementEnabled: config.announcement?.enabled,
          paymentEnabled: config.paymentEnabled,
        },
      },
      request: req,
    });

    const responseConfig = sanitizeConfigForAdmin(sanitizedConfig);
    return await secureJsonResponse(
      { status: 'success', data: responseConfig },
      { headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  } catch (error: any) /* eslint-disable-line @typescript-eslint/no-explicit-any */ {
    return await secureJsonResponse({
      status: 'error',
      message: error?.message || 'save failed',
      error: typeof error === 'object' ? error : { detail: String(error) },
    }, { status: 500 });
  }
}

export const GET = withBackendProxy(GETHandler);
export const POST = POSTHandler;
