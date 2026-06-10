import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';
import { listActiveShops } from '@/lib/shops';

export const dynamic = 'force-dynamic';
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${SITE_URL}/shop`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/terms`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.4,
    },
    {
      url: `${SITE_URL}/privacy`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.4,
    },
  ];

  let shopPages: MetadataRoute.Sitemap = [];
  try {
    const shops = await listActiveShops();
    shopPages = shops.map((shop) => ({
      url: `${SITE_URL}/shop/${shop.slug}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }));
  } catch (error) {
    console.error('[sitemap] failed to load shops:', error);
  }

  return [...staticPages, ...shopPages];
}
