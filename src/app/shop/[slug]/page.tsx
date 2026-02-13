// src/app/shop/[slug]/page.tsx
// Multi-shop individual storefront page
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ShopStorefront from './ShopStorefront';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Server-side: fetch shop data for metadata and SSR
async function getShopData(slug: string) {
  const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  try {
    // Fetch shop info via internal API
    const res = await fetch(`${baseUrl}/api/shops?public=1`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = await res.json();
    const shops = data.shops || [];
    return shops.find((s: any) => s.slug === slug) || null;
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
  return <ShopStorefront shopSlug={slug} initialShop={shop} />;
}
