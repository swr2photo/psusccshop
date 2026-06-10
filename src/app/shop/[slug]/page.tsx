// src/app/shop/[slug]/page.tsx
// Multi-shop individual storefront page
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getShopBySlug, toPublicShopData } from '@/lib/shops';
import { absoluteUrl } from '@/lib/site';
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
  const description = shop.description || shop.descriptionEn || `ร้านค้า ${shop.name} — SCC Shop`;
  const canonical = absoluteUrl(`/shop/${shop.slug}`);
  return {
    title: shop.name,
    description,
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: {
      title: shop.name,
      description,
      url: canonical,
      type: 'website',
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
  const shopUrl = absoluteUrl(`/shop/${slug}`);
  const storeJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Store',
    name: shop.name,
    description: shop.description || shop.descriptionEn,
    url: shopUrl,
    ...(shop.logoUrl ? { image: shop.logoUrl } : {}),
    parentOrganization: {
      '@type': 'Organization',
      name: 'SCC Shop',
      url: absoluteUrl('/'),
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(storeJsonLd) }}
      />
      <ShopStorefrontClient shopSlug={slug} initialShop={shop} />
    </>
  );
}
