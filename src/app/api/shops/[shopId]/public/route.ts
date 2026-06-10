// /api/shops/[shopId]/public — Public shop data (no auth required)
import { NextRequest, NextResponse } from 'next/server';
import { getShopById, toPublicShopData } from '@/lib/shops';

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

  const publicShop = toPublicShopData(shop);

  return NextResponse.json(
    { status: 'success', shop: publicShop },
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    }
  );
}
