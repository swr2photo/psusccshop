// src/app/shop/[slug]/page.tsx
// Multi-shop individual storefront page
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getShopBySlug, toPublicShopData } from '@/lib/shops';
import ShopStorefrontClient from './ShopStorefrontClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Server-side: fetch full shop data (products, contact, config)
async function getShopData(slug: string) {
  try {
    const shop = await getShopBySlug(slug);
    if (!shop || !shop.isActive) return null;
    return toPublicShopData(shop);
  } catch {
    return null;
  }
}

// Dynamic metadata
export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const shop = await getShopData(slug);
  if (!shop) {
    return { title: 'ไม่พบร้านค้า' };
  }
  return {
    title: shop.name,
    description: shop.description || `ร้านค้า ${shop.name}`,
    openGraph: {
      title: shop.name,
      description: shop.description || `ร้านค้า ${shop.name}`,
      ...(shop.logoUrl ? { images: [{ url: shop.logoUrl }] } : {}),
    },
  };
}

export default async function ShopPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const shop = await getShopData(slug);
  if (!shop) {
    notFound();
  }
  return <ShopStorefrontClient shopSlug={slug} initialShop={shop} />;
}
