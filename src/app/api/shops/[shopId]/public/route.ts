// /api/shops/[shopId]/public — Public shop data (no auth required)
import { NextRequest, NextResponse } from 'next/server';
import { getShopById } from '@/lib/shops';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ shopId: string }>;
}

/** GET /api/shops/[shopId]/public — Get public shop data (products, announcements, events, etc.) */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { shopId } = await params;

  const shop = await getShopById(shopId);
  if (!shop || !shop.isActive) {
    return NextResponse.json(
      { status: 'error', message: 'ไม่พบร้านค้า' },
      { status: 404 }
    );
  }

  // Filter to only active products
  const activeProducts = (shop.products || []).filter(
    (p: any) => p.isActive !== false
  );

  // Build public shop data (no sensitive info like payment details)
  const publicShop = {
    id: shop.id,
    slug: shop.slug,
    name: shop.name,
    nameEn: shop.nameEn,
    description: shop.description,
    descriptionEn: shop.descriptionEn,
    logoUrl: shop.logoUrl,
    bannerUrl: shop.bannerUrl,
    isOpen: shop.settings?.isOpen ?? true,
    closeDate: shop.settings?.closeDate || '',
    openDate: shop.settings?.openDate,
    closedMessage: shop.settings?.closedMessage,
    paymentEnabled: shop.settings?.paymentEnabled ?? true,
    paymentDisabledMessage: shop.settings?.paymentDisabledMessage,
    contactEmail: shop.contactEmail,
    contactPhone: shop.contactPhone,
    socialLinks: shop.socialLinks,
    // Products
    products: activeProducts,
    // Public config fields
    announcements: shop.config?.announcements || [],
    announcementHistory: shop.config?.announcementHistory || [],
    announcement: shop.config?.announcement,
    events: shop.config?.events || [],
    socialMediaNews: shop.config?.socialMediaNews || [],
    liveStream: shop.config?.liveStream,
    pickup: shop.config?.pickup,
    shippingOptions: (shop.config as any)?.shippingOptions || [],
    // Payment info (public-facing fields only)
    promptPayId: shop.paymentInfo?.promptPayId,
    bankAccount: shop.paymentInfo
      ? {
          bankName: shop.paymentInfo.bankName,
          accountName: shop.paymentInfo.accountName,
          accountNumber: shop.paymentInfo.accountNumber,
        }
      : undefined,
  };

  return NextResponse.json(
    { status: 'success', shop: publicShop },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      },
    }
  );
}
