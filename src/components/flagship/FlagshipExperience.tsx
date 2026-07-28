'use client';

import { useCallback, useMemo, useState, useSyncExternalStore, type CSSProperties } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { ArrowLeft, Check } from 'lucide-react';
import type { Product, ShopConfig, ShirtNameConfig } from '@/lib/config';
import { getProductName } from '@/lib/config';
import type { CartItem } from '@/lib/shop-constants';
import {
  buildFrameUrls,
  type FlagshipProductConfig,
} from '@/lib/flagship/config';
import { queueFlagshipCartItems } from '@/lib/flagship/cart-bridge';
import { getCart, saveCart as saveCartApi } from '@/lib/api-client';
import { useTranslation } from '@/hooks/useTranslation';
import ScrollytellingHero from '@/components/flagship/ScrollytellingHero';
import FlagshipBuyBar from '@/components/flagship/FlagshipBuyBar';

type Props = {
  config: FlagshipProductConfig;
  product: Product | null;
  shirtNameConfig?: ShirtNameConfig;
  shopOpen?: boolean;
};

function prefersCoarseMobile(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(pointer: coarse)').matches ||
    window.matchMedia('(max-width: 768px)').matches
  );
}

function subscribeMobile(onChange: () => void) {
  const mqCoarse = window.matchMedia('(pointer: coarse)');
  const mqNarrow = window.matchMedia('(max-width: 768px)');
  mqCoarse.addEventListener('change', onChange);
  mqNarrow.addEventListener('change', onChange);
  return () => {
    mqCoarse.removeEventListener('change', onChange);
    mqNarrow.removeEventListener('change', onChange);
  };
}

export default function FlagshipExperience({
  config,
  product,
  shirtNameConfig,
  shopOpen = true,
}: Props) {
  const { t, lang } = useTranslation();
  const { data: session } = useSession();
  const [buyStage, setBuyStage] = useState(false);
  const [added, setAdded] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const mobile = useSyncExternalStore(subscribeMobile, prefersCoarseMobile, () => false);

  const stages = config.stages[lang] || config.stages.th;
  const brand = config.brandLabel?.[lang] || config.brandLabel?.th || 'SCC';

  const frames = useMemo(
    () => buildFrameUrls(config, { mobile }),
    [config, mobile],
  );

  const fallbackImages = useMemo(() => {
    if (!product) return [];
    const imgs = [
      ...(product.coverImage ? [product.coverImage] : []),
      ...(product.images || []),
    ];
    return Array.from(new Set(imgs)).slice(0, 3);
  }, [product]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2800);
  }, []);

  const handleAddToCart = useCallback(
    async (item: CartItem) => {
      if (!shopOpen) {
        showToast(t.checkout.shopClosedWarning);
        return;
      }

      const email = session?.user?.email;
      if (email) {
        try {
          const res = await getCart(email);
          const serverCart =
            (res.data as { cart?: CartItem[] } | undefined)?.cart ||
            (res as { cart?: CartItem[] }).cart ||
            [];
          const existing = Array.isArray(serverCart) ? serverCart : [];
          await saveCartApi(email, [...existing, item]);
        } catch (err) {
          console.error('Flagship saveCart failed', err);
          // Fall back to session queue so home can still pick it up
          queueFlagshipCartItems([item]);
        }
      } else {
        // Guest cart lives on the home page — queue until they return
        queueFlagshipCartItems([item]);
      }

      setAdded(true);
      showToast(t.cart.addedToCart);
      window.setTimeout(() => setAdded(false), 2000);
    },
    [session?.user?.email, shopOpen, showToast, t.cart.addedToCart, t.checkout.shopClosedWarning],
  );

  if (!product) {
    return (
      <main
        style={{
          minHeight: '100dvh',
          background: 'var(--background)',
          color: 'var(--foreground)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          padding: 24,
          textAlign: 'center',
        }}
      >
        <p style={{ margin: 0, color: 'var(--text-muted)', maxWidth: 360 }}>
          {lang === 'en'
            ? 'This flagship product is not in the catalog yet. Check productId in flagship config.'
            : 'ยังไม่พบสินค้า Flagship ในแคตตาล็อก ตรวจสอบ productId ใน config'}
        </p>
        <Link href="/" style={backLinkStyle}>
          <ArrowLeft size={16} />
          {lang === 'en' ? 'Back to shop' : 'กลับหน้าร้าน'}
        </Link>
      </main>
    );
  }

  return (
    <main style={{ background: 'var(--background)', color: 'var(--foreground)', minHeight: '100dvh' }}>
      <header
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          background: 'linear-gradient(to bottom, color-mix(in srgb, var(--background) 88%, transparent), transparent)',
          pointerEvents: 'none',
        }}
      >
        <Link
          href="/"
          style={{ ...backLinkStyle, pointerEvents: 'auto' }}
        >
          <ArrowLeft size={16} />
          {lang === 'en' ? 'Shop' : 'ร้านค้า'}
        </Link>
        <div style={{ pointerEvents: 'none', textAlign: 'right' }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'var(--secondary)',
            }}
          >
            {brand}
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.02em' }}>
            {getProductName(product, lang)}
          </div>
        </div>
      </header>

      <ScrollytellingHero
        frames={frames}
        fallbackImages={fallbackImages}
        stages={stages}
        onBuyStage={setBuyStage}
      />

      {/* Keep last stage clear of the sticky buy bar */}
      <div style={{ height: 120 }} aria-hidden />

      <FlagshipBuyBar
        product={product}
        shirtNameConfig={shirtNameConfig}
        highlighted={buyStage}
        disabled={!shopOpen}
        onAddToCart={handleAddToCart}
      />

      {toast && (
        <div
          role="status"
          style={{
            position: 'fixed',
            top: 72,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 60,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 16px',
            borderRadius: 12,
            background: 'var(--glass-strong)',
            border: '1px solid var(--glass-border)',
            boxShadow: 'var(--card-shadow)',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {added && <Check size={16} color="var(--success)" />}
          {toast}
          <Link href="/?cart=1" style={{ color: 'var(--primary)', marginLeft: 6, textDecoration: 'none' }}>
            {lang === 'en' ? 'View cart' : 'ดูตะกร้า'}
          </Link>
        </div>
      )}
    </main>
  );
}

const backLinkStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  color: 'var(--foreground)',
  textDecoration: 'none',
  fontSize: 13,
  fontWeight: 600,
  padding: '8px 12px',
  borderRadius: 999,
  background: 'var(--glass-bg)',
  border: '1px solid var(--glass-border)',
};

/** Resolve product from shop config using flagship rules */
export function resolveFlagshipProduct(
  flagship: FlagshipProductConfig,
  shop: ShopConfig | null | undefined,
): Product | null {
  const products = shop?.products || [];
  if (products.length === 0) return null;

  if (flagship.productId) {
    const byId = products.find((p) => p.id === flagship.productId);
    if (byId) return byId;
  }

  if (flagship.match?.slug) {
    const bySlug = products.find((p) => p.slug === flagship.match?.slug);
    if (bySlug) return bySlug;
  }

  if (flagship.match?.idIncludes?.length) {
    const hit = products.find((p) =>
      flagship.match!.idIncludes!.some((frag) =>
        p.id.toLowerCase().includes(frag.toLowerCase()),
      ),
    );
    if (hit) return hit;
  }

  if (flagship.match?.nameIncludes?.length) {
    const hit = products.find((p) => {
      const names = `${p.name} ${p.nameEn || ''}`.toLowerCase();
      return flagship.match!.nameIncludes!.some((frag) =>
        names.includes(frag.toLowerCase()),
      );
    });
    if (hit) return hit;
  }

  return null;
}
