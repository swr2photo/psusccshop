// /api/shops/[shopId]/config — Get & Update shop-specific config
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, isSuperAdminEmail } from '@/lib/auth';
import { getShopById, updateShop, getShopAdminRole } from '@/lib/shops';
import type { ShopLocalConfig } from '@/lib/shops';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ shopId: string }>;
}

/** GET /api/shops/[shopId]/config — Get shop config */
export async function GET(req: NextRequest, { params }: RouteParams) {
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

  // Return a ShopConfig-compatible object from shop data
  const shopConfig = {
    // Shop settings as ShopConfig fields
    isOpen: shop.settings.isOpen ?? true,
    closeDate: shop.settings.closeDate || '',
    openDate: shop.settings.openDate,
    closedMessage: shop.settings.closedMessage,
    paymentEnabled: shop.settings.paymentEnabled,
    paymentDisabledMessage: shop.settings.paymentDisabledMessage,
    // Products
    products: shop.products || [],
    // Payment info
    bankAccount: shop.paymentInfo ? {
      bankName: shop.paymentInfo.bankName,
      accountName: shop.paymentInfo.accountName,
      accountNumber: shop.paymentInfo.accountNumber,
    } : undefined,
    promptPayId: shop.paymentInfo?.promptPayId,
    // Config blob fields
    announcements: shop.config?.announcements || [],
    announcementHistory: shop.config?.announcementHistory || [],
    announcement: shop.config?.announcement,
    events: shop.config?.events || [],
    promoCodes: shop.config?.promoCodes || [],
    liveStream: shop.config?.liveStream,
    pickup: shop.config?.pickup,
    nameValidation: shop.config?.nameValidation,
    shirtNameConfig: shop.config?.shirtNameConfig,
    socialMediaNews: shop.config?.socialMediaNews || [],
    shippingOptions: (shop.config as any)?.shippingOptions || [],
    // Shop metadata
    shopId: shop.id,
    shopSlug: shop.slug,
    shopName: shop.name,
  };

  return NextResponse.json({ status: 'success', config: shopConfig });
}

/** PUT /api/shops/[shopId]/config — Update shop config */
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const { shopId } = await params;
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;

  const isSuperAdmin = isSuperAdminEmail(authResult.email);

  // Check access and permission
  if (!isSuperAdmin) {
    const role = await getShopAdminRole(shopId, authResult.email);
    if (!role) {
      return NextResponse.json({ status: 'error', message: 'ไม่มีสิทธิ์เข้าถึงร้านค้านี้' }, { status: 403 });
    }
  }

  try {
    const body = await req.json();
    const updates: any = {};

    // Extract settings fields
    if (body.isOpen !== undefined || body.closeDate !== undefined || body.closedMessage !== undefined || 
        body.paymentEnabled !== undefined || body.openDate !== undefined) {
      const shop = await getShopById(shopId);
      updates.settings = {
        ...(shop?.settings || {}),
        ...(body.isOpen !== undefined ? { isOpen: body.isOpen } : {}),
        ...(body.closeDate !== undefined ? { closeDate: body.closeDate } : {}),
        ...(body.openDate !== undefined ? { openDate: body.openDate } : {}),
        ...(body.closedMessage !== undefined ? { closedMessage: body.closedMessage } : {}),
        ...(body.paymentEnabled !== undefined ? { paymentEnabled: body.paymentEnabled } : {}),
        ...(body.paymentDisabledMessage !== undefined ? { paymentDisabledMessage: body.paymentDisabledMessage } : {}),
      };
    }

    // Extract products
    if (body.products !== undefined) {
      updates.products = body.products;
    }

    // Extract payment info
    if (body.bankAccount !== undefined || body.promptPayId !== undefined) {
      const shop = await getShopById(shopId);
      updates.paymentInfo = {
        ...(shop?.paymentInfo || {}),
        ...(body.bankAccount ? {
          bankName: body.bankAccount.bankName,
          accountName: body.bankAccount.accountName,
          accountNumber: body.bankAccount.accountNumber,
        } : {}),
        ...(body.promptPayId !== undefined ? { promptPayId: body.promptPayId } : {}),
      };
    }

    // Extract config blob fields
    const configFields: (keyof ShopLocalConfig)[] = [
      'announcements', 'announcementHistory', 'announcement',
      'events', 'promoCodes', 'liveStream',
      'pickup', 'nameValidation', 'shirtNameConfig',
      'socialMediaNews', 'shippingOptions',
    ];
    
    const hasConfigUpdates = configFields.some(key => body[key] !== undefined);
    if (hasConfigUpdates) {
      const shop = await getShopById(shopId);
      const currentConfig = shop?.config || {};
      const newConfig: any = { ...currentConfig };
      for (const key of configFields) {
        if (body[key] !== undefined) {
          newConfig[key] = body[key];
        }
      }
      updates.config = newConfig;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ status: 'error', message: 'ไม่มีข้อมูลที่ต้องอัพเดท' }, { status: 400 });
    }

    const updated = await updateShop(shopId, updates);
    if (!updated) {
      return NextResponse.json({ status: 'error', message: 'อัพเดทไม่สำเร็จ' }, { status: 500 });
    }

    return NextResponse.json({ status: 'success', message: 'อัพเดทสำเร็จ' });
  } catch (error: any) {
    console.error('[shop-config] PUT error:', error);
    return NextResponse.json({ status: 'error', message: error?.message || 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
