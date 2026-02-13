// src/app/shop/page.tsx
// Shop directory page - lists all active shops
import { Metadata } from 'next';
import ShopDirectory from './ShopDirectory';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'ร้านค้าทั้งหมด',
  description: 'ดูร้านค้าทั้งหมดในระบบ SCC Shop',
};

export default function ShopListPage() {
  return <ShopDirectory />;
}
