'use client';

import dynamic from 'next/dynamic';
import ShopStorefrontLoader from './ShopStorefrontLoader';

const ShopStorefront = dynamic(() => import('./ShopStorefront'), {
  ssr: false,
  loading: () => <ShopStorefrontLoader />,
});

interface ShopStorefrontClientProps {
  shopSlug: string;
  // Passed from server-fetched shop record; full shape validated in ShopStorefront
  initialShop: Record<string, unknown>;
}

export default function ShopStorefrontClient(props: ShopStorefrontClientProps) {
  return <ShopStorefront {...props} />;
}
