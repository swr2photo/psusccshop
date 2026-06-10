'use client';

import dynamic from 'next/dynamic';
import type { ShopStorefrontProps } from './ShopStorefront';
import ShopStorefrontLoader from './ShopStorefrontLoader';

const ShopStorefront = dynamic(() => import('./ShopStorefront'), {
  ssr: false,
  loading: () => <ShopStorefrontLoader />,
});

export default function ShopStorefrontClient(props: ShopStorefrontProps) {
  return <ShopStorefront {...props} />;
}
