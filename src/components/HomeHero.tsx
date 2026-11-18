'use client';

import Link from 'next/link';
import { Box, Button, Typography } from '@mui/material';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import ProductImage from '@/components/storefront/ProductImage';
import type { Product } from '@/lib/config';
import { getProductName } from '@/lib/config';
import { getBasePrice } from '@/lib/shop-constants';
import { FLAGSHIP_PRODUCTS, getFlagshipSlugForProduct } from '@/lib/flagship/config';
import { useTranslation } from '@/hooks/useTranslation';

const DEFAULT_FLAGSHIP_SLUG = 'scc-jersey-2026';

export type HomeHeroProps = {
  product?: Product | null;
  onBuy?: (product: Product) => void;
  /** Shop-level open flag (closed → CTA becomes "view details") */
  isOpen?: boolean;
  /** Order deadline shown under the price */
  closeDate?: string | null;
  /** Whether the 360° Flagship page is enabled in admin settings */
  flagshipEnabled?: boolean;
  /** Configured flagship slug override */
  flagshipSlug?: string;
};

function formatDeadline(iso: string | null | undefined, lang: 'th' | 'en'): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime()) || d.getTime() < Date.now()) return null;
  return d.toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Storefront opening — laid out like a printed merch-drop sheet:
 * club line, the actual product name, price + deadline, one action, a framed photo.
 * No gradients, glows or entrance animation.
 */
export default function HomeHero({
  product,
  onBuy,
  isOpen = true,
  closeDate,
  flagshipEnabled = true,
  flagshipSlug: flagshipSlugProp,
}: HomeHeroProps) {
  const { t, lang } = useTranslation();
  const en = lang === 'en';
  const flagshipSlug =
    flagshipSlugProp ||
    (product && getFlagshipSlugForProduct(product)) ||
    FLAGSHIP_PRODUCTS[DEFAULT_FLAGSHIP_SLUG]?.slug ||
    DEFAULT_FLAGSHIP_SLUG;
  const flagshipHref = `/flagship/${flagshipSlug}`;
  const productLabel = product ? getProductName(product, lang) : t.home.heroFallbackName;

  const price = product ? getBasePrice(product) : null;
  const hasPriceRange = Object.keys(product?.sizePricing || {}).length > 1;
  const deadline = formatDeadline(closeDate || product?.endDate, lang);
  const canBuy = Boolean(product && isOpen);

  const handlePrimary = () => {
    if (product && onBuy && (canBuy || !flagshipEnabled)) {
      onBuy(product);
      return;
    }
    if (flagshipEnabled && typeof window !== 'undefined') {
      window.location.href = flagshipHref;
      return;
    }
    if (typeof document !== 'undefined') {
      document.getElementById('product-grid')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <Box
      component="section"
      aria-label={t.home.heroAria}
      className="store-type"
      sx={{ width: '100%', bgcolor: 'var(--background)', borderBottom: '1px solid var(--border)' }}
    >
      <Box
        sx={{
          maxWidth: 1200,
          mx: 'auto',
          px: { xs: 2, sm: 3, md: 4 },
          pt: { xs: 2, md: 4 },
          pb: { xs: 3, md: 5 },
        }}
      >
        {/* Club line — reads like the header of a printed sheet */}
        <Box
          className="store-mono"
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 2,
            pb: 1.25,
            mb: { xs: 2, md: 4 },
            borderBottom: '1px solid var(--foreground)',
            fontSize: { xs: '0.68rem', sm: '0.72rem' },
            textTransform: 'uppercase',
            color: 'var(--foreground)',
          }}
        >
          <span>SCC Shop — {en ? 'PSU Science Computer Club' : 'ชุมนุมคอมพิวเตอร์ คณะวิทยาศาสตร์ ม.อ.'}</span>
          <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' }, color: 'var(--text-muted)' }}>
            {en ? 'Merch / 2026' : 'ของชุมนุม / 2026'}
          </Box>
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '5fr 7fr' },
            gap: { xs: 2.5, md: 6 },
            alignItems: 'end',
          }}
        >
          {/* Copy */}
          <Box
            sx={{
              order: { xs: 2, md: 1 },
              minWidth: 0,
              alignSelf: 'stretch',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: { md: 'space-between' },
              gap: { md: 4 },
            }}
          >
            <Typography
              className="store-mono"
              sx={{ fontSize: '0.72rem', color: 'var(--text-muted)', mb: 1, textTransform: 'uppercase' }}
            >
              {en ? 'No. 01 — New this season' : 'No. 01 — ของใหม่ประจำปี'}
            </Typography>
            <Box>
            <Typography
              component="h1"
              sx={{
                fontFamily: 'var(--font-store)',
                fontSize: { xs: '2rem', sm: '2.5rem', md: '3.1rem' },
                fontWeight: 700,
                lineHeight: 1.08,
                letterSpacing: '-0.01em',
                color: 'var(--foreground)',
                mb: 1.5,
                overflowWrap: 'anywhere',
              }}
            >
              {productLabel}
            </Typography>
            <Typography sx={{ fontFamily: 'inherit', fontSize: { xs: '0.95rem', md: '1rem' }, color: 'var(--text-muted)', maxWidth: 440, lineHeight: 1.6, mb: 3 }}>
              {t.home.heroSlogan}
            </Typography>

            {/* Price + deadline, set like a price list */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'auto 1fr',
                columnGap: 2,
                rowGap: 0.75,
                py: 1.5,
                mb: 2.5,
                borderTop: '1px solid var(--border)',
                borderBottom: '1px solid var(--border)',
                maxWidth: 440,
                alignItems: 'baseline',
              }}
            >
              <Typography className="store-mono" sx={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                {en ? 'Price' : 'ราคา'}
              </Typography>
              <Typography className="store-mono" sx={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--foreground)' }}>
                {price != null ? `${hasPriceRange ? (en ? 'from ' : 'เริ่ม ') : ''}฿${price.toLocaleString()}` : '—'}
              </Typography>
              <Typography className="store-mono" sx={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                {en ? 'Orders' : 'สั่งซื้อ'}
              </Typography>
              <Typography sx={{ fontFamily: 'inherit', fontSize: '0.9rem', color: isOpen ? 'var(--foreground)' : 'var(--text-muted)' }}>
                {!isOpen
                  ? en ? 'Closed for now' : 'ปิดรับชั่วคราว'
                  : deadline
                    ? en ? `Open until ${deadline}` : `เปิดจองถึง ${deadline}`
                    : en ? 'Open now' : 'เปิดจองอยู่'}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
              <Button
                onClick={handlePrimary}
                disableElevation
                variant="contained"
                endIcon={<ArrowRight size={16} />}
                sx={{
                  fontFamily: 'inherit',
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  px: 2.5,
                  py: 1.1,
                  borderRadius: '6px',
                  bgcolor: 'var(--primary)',
                  color: 'var(--primary-foreground)',
                  boxShadow: 'none',
                  '&:hover': { bgcolor: 'color-mix(in srgb, var(--primary) 88%, black)', boxShadow: 'none' },
                }}
              >
                {canBuy ? t.home.heroCtaBuy : t.home.heroCtaDetails}
              </Button>
              {flagshipEnabled && (
                <Button
                  component={Link}
                  href={flagshipHref}
                  endIcon={<ArrowUpRight size={16} />}
                  sx={{
                    fontFamily: 'inherit',
                    textTransform: 'none',
                    fontWeight: 500,
                    fontSize: '0.95rem',
                    px: 1.5,
                    py: 1.1,
                    borderRadius: '6px',
                    color: 'var(--foreground)',
                    textDecoration: 'underline',
                    textUnderlineOffset: '4px',
                    textDecorationColor: 'var(--border)',
                    '&:hover': { bgcolor: 'transparent', textDecorationColor: 'currentColor' },
                  }}
                >
                  {en ? 'Spin it 360°' : 'หมุนดูแบบ 360°'}
                </Button>
              )}
            </Box>
            </Box>
          </Box>

          {/* Framed photo with a caption, like a catalog plate */}
          <Box component="figure" sx={{ order: { xs: 1, md: 2 }, m: 0, minWidth: 0 }}>
            <Box
              sx={{
                position: 'relative',
                width: '100%',
                // Wider on tablets so the name + price still show above the fold
                aspectRatio: { xs: '4 / 3', sm: '16 / 10', md: '7 / 5' },
                borderRadius: '4px',
                overflow: 'hidden',
                bgcolor: 'var(--surface-2)',
                border: '1px solid var(--border)',
              }}
            >
              <ProductImage
                src={product?.coverImage}
                fallbackSrcs={product?.images}
                alt={productLabel}
                width="100%"
                height="100%"
                objectFit="cover"
                priority
                placeholder="skeleton"
                showLoadingIndicator={false}
                fallbackImage="/logo.png"
                style={{ position: 'absolute', inset: 0 }}
              />
            </Box>
            <Box
              component="figcaption"
              className="store-mono"
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 2,
                mt: 1,
                fontSize: '0.7rem',
                color: 'var(--text-muted)',
              }}
            >
              <Box component="span" sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {en ? 'Fig. 01' : 'ภาพ 01'} — {productLabel}
              </Box>
              <span>{t.home.heroHeadline}</span>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
