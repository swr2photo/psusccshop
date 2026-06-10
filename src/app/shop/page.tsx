// src/app/shop/page.tsx
// Shop directory page - lists all active shops
import { Metadata } from 'next';
import { absoluteUrl } from '@/lib/site';
import ShopDirectory from './ShopDirectory';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'ร้านค้าทั้งหมด',
  description: 'ดูร้านค้าย่อยทั้งหมดใน SCC Shop — ชุมนุม สโมสร และร้านค้าในเครือข่ายมหาวิทยาลัยสงขลานครินทร์',
  alternates: { canonical: absoluteUrl('/shop') },
  robots: { index: true, follow: true },
  openGraph: {
    title: 'ร้านค้าทั้งหมด | SCC Shop',
    description: 'ดูร้านค้าย่อยทั้งหมดใน SCC Shop',
    url: absoluteUrl('/shop'),
    type: 'website',
  },
};

export default function ShopListPage() {
  return <ShopDirectory />;
}
