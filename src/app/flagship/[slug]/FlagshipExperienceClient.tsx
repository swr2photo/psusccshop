'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { getMergedFlagshipConfig } from '@/lib/flagship/config';
import FlagshipExperience, {
  resolveFlagshipProduct,
} from '@/components/flagship/FlagshipExperience';
import type { ShopConfig } from '@/lib/config';
import { getPublicConfig } from '@/lib/api-client';

type Props = {
  slug: string;
};

/**
 * Client loader: pulls live catalog so flagship productId / match rules
 * resolve against current shop config (incl. dev seed products on home).
 */
export default function FlagshipExperienceClient({ slug }: Props) {
  const [shop, setShop] = useState<ShopConfig | null>(null);
  const [loading, setLoading] = useState(true);

  const config = useMemo(() => {
    return getMergedFlagshipConfig(slug, shop);
  }, [slug, shop]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getPublicConfig();
        const data =
          (res.data as ShopConfig | undefined) ||
          (res as { config?: ShopConfig }).config ||
          null;
        if (!cancelled) setShop(data);
      } catch (err) {
        console.error('Flagship config load failed', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Dev seed jersey only exists on the home page client — synthesize a stub
  // so /flagship/scc-jersey-2026 works in development without waiting for admin data.
  const product = useMemo(() => {
    if (!config) return null;
    const resolved = resolveFlagshipProduct(config, shop);
    if (resolved) return resolved;

    if (
      process.env.NODE_ENV === 'development' &&
      config.productId === 'dev-jersey-1'
    ) {
      return {
        id: 'dev-jersey-1',
        name: '[DEV] เสื้อกีฬา SCC 2026',
        nameEn: '[DEV] SCC Jersey 2026',
        description: 'เสื้อกีฬารุ่นใหม่ล่าสุด\nเนื้อผ้า Cool Elite\nระบายอากาศดี',
        descriptionEn: 'Latest jersey model\nCool Elite fabric\nGreat breathability',
        category: 'APPAREL' as const,
        subType: 'JERSEY' as const,
        type: 'JERSEY' as const,
        basePrice: 350,
        sizePricing: { S: 350, M: 350, L: 350, XL: 370, '2XL': 390 },
        sizeChart: {
          S: { chest: 36, length: 25 },
          M: { chest: 38, length: 26 },
          L: { chest: 40, length: 27 },
          XL: { chest: 42, length: 28 },
          '2XL': { chest: 44, length: 29 },
          FREE: { chest: 42, length: 28 },
          'ฟรีไซส์': { chest: 42, length: 28 },
        },
        isActive: true,
        options: {
          hasCustomName: true,
          hasCustomNumber: true,
          hasLongSleeve: true,
          longSleevePrice: 50,
        },
        images: [
          'https://placehold.co/800x800/1c1c1e/f5f5f7?text=SCC+Jersey+Front',
          'https://placehold.co/800x800/2c2c2e/f5f5f7?text=SCC+Jersey+Detail',
          'https://placehold.co/800x800/3a3a3c/f5f5f7?text=SCC+Jersey+Back',
        ],
        coverImage: 'https://placehold.co/800x800/1c1c1e/f5f5f7?text=SCC+Jersey+Front',
      };
    }
    return null;
  }, [config, shop]);

  if (!config) return null;

  if (!loading && config.enabled === false) {
    return (
      <div
        style={{
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          padding: 24,
          textAlign: 'center',
          background: 'var(--background)',
          color: 'var(--foreground)',
        }}
      >
        <p style={{ fontSize: 12, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-muted)', margin: 0 }}>
          SCC Shop · Flagship
        </p>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
          หน้าแสดงสินค้า Flagship ปิดให้บริการชั่วคราว
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', maxWidth: 420, margin: 0, lineHeight: 1.6 }}>
          คุณยังสามารถเลือกชมและสั่งซื้อสินค้าทั้งหมดได้ที่หน้าร้านหลัก
        </p>
        <Link
          href="/"
          style={{
            marginTop: 8,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '10px 20px',
            borderRadius: 10,
            background: 'var(--primary)',
            color: 'var(--primary-foreground)',
            fontWeight: 600,
            fontSize: 14,
            textDecoration: 'none',
          }}
        >
          กลับสู่หน้าร้านหลัก
        </Link>
      </div>
    );
  }

  if (loading && !product) {
    return (
      <div
        style={{
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--background)',
          color: 'var(--text-muted)',
          fontSize: 14,
        }}
      >
        Loading…
      </div>
    );
  }

  return (
    <FlagshipExperience
      config={config}
      product={product}
      shirtNameConfig={shop?.shirtNameConfig}
      shopOpen={shop?.isOpen ?? true}
    />
  );
}
