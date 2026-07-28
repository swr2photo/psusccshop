'use client';

import Link from 'next/link';
import { Box, Button, Typography } from '@mui/material';
import { ArrowRight, ShoppingBag } from 'lucide-react';
import OptimizedImage from '@/components/OptimizedImage';
import type { Product } from '@/lib/config';
import { getProductName } from '@/lib/config';
import { FLAGSHIP_PRODUCTS, getFlagshipSlugForProduct } from '@/lib/flagship/config';
import { useTranslation } from '@/hooks/useTranslation';

const DEFAULT_FLAGSHIP_SLUG = 'scc-jersey-2026';

export type HomeHeroProps = {
  product?: Product | null;
  onBuy?: (product: Product) => void;
};

/**
 * Full-bleed storefront hero promoting the SCC 2026 flagship jersey.
 * Lean first viewport: brand · headline · one line · CTAs · product visual.
 */
export default function HomeHero({ product, onBuy }: HomeHeroProps) {
  const { t, lang } = useTranslation();
  const flagshipSlug =
    (product && getFlagshipSlugForProduct(product)) ||
    FLAGSHIP_PRODUCTS[DEFAULT_FLAGSHIP_SLUG]?.slug ||
    DEFAULT_FLAGSHIP_SLUG;
  const flagshipHref = `/flagship/${flagshipSlug}`;
  const imageSrc =
    product?.coverImage ||
    product?.images?.[0] ||
    '/favicon.png';
  const brand = 'SCC Shop';
  const productLabel = product ? getProductName(product, lang) : t.home.heroFallbackName;

  const handlePrimary = () => {
    if (product && onBuy) {
      onBuy(product);
      return;
    }
    if (typeof window !== 'undefined') {
      window.location.href = flagshipHref;
    }
  };

  return (
    <Box
      component="section"
      aria-label={t.home.heroAria}
      sx={{
        position: 'relative',
        width: '100%',
        overflow: 'hidden',
        minHeight: { xs: 340, sm: 380, md: 440 },
        display: 'flex',
        alignItems: 'stretch',
        bgcolor: 'var(--surface-2)',
        borderBottom: '1px solid var(--glass-border)',
        animation: 'homeHeroFade 0.7s cubic-bezier(0.22, 1, 0.36, 1) both',
        '@keyframes homeHeroFade': {
          from: { opacity: 0, transform: 'translateY(10px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
      }}
    >
      {/* Atmosphere — soft brand wash, not flat / not purple */}
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          inset: 0,
          background: (theme) =>
            theme.palette.mode === 'dark'
              ? `
                radial-gradient(ellipse 80% 70% at 85% 40%, color-mix(in srgb, var(--primary) 28%, transparent) 0%, transparent 55%),
                radial-gradient(ellipse 60% 50% at 10% 90%, color-mix(in srgb, var(--secondary) 14%, transparent) 0%, transparent 50%),
                linear-gradient(180deg, color-mix(in srgb, var(--background) 40%, transparent) 0%, var(--background) 100%)
              `
              : `
                radial-gradient(ellipse 80% 70% at 90% 30%, color-mix(in srgb, var(--primary) 18%, transparent) 0%, transparent 55%),
                radial-gradient(ellipse 50% 40% at 5% 95%, color-mix(in srgb, var(--secondary) 10%, transparent) 0%, transparent 50%),
                linear-gradient(180deg, #f8fafc 0%, var(--background) 100%)
              `,
          pointerEvents: 'none',
        }}
      />

      <Box
        sx={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          maxWidth: 1200,
          mx: 'auto',
          px: { xs: 2.5, sm: 4, md: 5 },
          py: { xs: 3.5, sm: 4, md: 5 },
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1.05fr 0.95fr' },
          gap: { xs: 3, md: 4 },
          alignItems: 'center',
        }}
      >
        <Box
          sx={{
            animation: 'homeHeroCopy 0.85s cubic-bezier(0.22, 1, 0.36, 1) 0.08s both',
            '@keyframes homeHeroCopy': {
              from: { opacity: 0, transform: 'translateX(-12px)' },
              to: { opacity: 1, transform: 'translateX(0)' },
            },
          }}
        >
          <Typography
            component="p"
            sx={{
              fontSize: { xs: '1.65rem', sm: '2rem', md: '2.35rem' },
              fontWeight: 800,
              letterSpacing: '-0.04em',
              lineHeight: 1.05,
              color: 'var(--foreground)',
              mb: 0.75,
            }}
          >
            {brand}
          </Typography>

          <Typography
            component="h1"
            sx={{
              fontSize: { xs: '1.15rem', sm: '1.35rem', md: '1.5rem' },
              fontWeight: 700,
              letterSpacing: '-0.025em',
              lineHeight: 1.25,
              color: 'var(--foreground)',
              mb: 1,
            }}
          >
            {t.home.heroHeadline}
          </Typography>

          <Typography
            sx={{
              fontSize: { xs: '0.9rem', sm: '0.95rem' },
              color: 'var(--text-muted)',
              maxWidth: 420,
              lineHeight: 1.5,
              mb: 2.25,
            }}
          >
            {t.home.heroSlogan}
          </Typography>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25, alignItems: 'center' }}>
            <Button
              onClick={handlePrimary}
              variant="contained"
              startIcon={<ShoppingBag size={16} />}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                fontSize: '0.9rem',
                px: 2.25,
                py: 1.1,
                borderRadius: '12px',
                bgcolor: 'var(--primary)',
                color: 'var(--primary-foreground)',
                boxShadow: '0 6px 20px color-mix(in srgb, var(--primary) 35%, transparent)',
                '&:hover': {
                  bgcolor: 'var(--primary)',
                  filter: 'brightness(1.08)',
                },
              }}
            >
              {t.home.heroCtaBuy}
            </Button>
            <Button
              component={Link}
              href={flagshipHref}
              variant="outlined"
              endIcon={<ArrowRight size={16} />}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.88rem',
                px: 2,
                py: 1.05,
                borderRadius: '12px',
                borderColor: 'var(--glass-border)',
                color: 'var(--foreground)',
                bgcolor: 'color-mix(in srgb, var(--surface) 70%, transparent)',
                backdropFilter: 'blur(8px)',
                '&:hover': {
                  borderColor: 'color-mix(in srgb, var(--primary) 40%, var(--glass-border))',
                  bgcolor: 'var(--surface)',
                },
              }}
            >
              {t.home.heroCtaDetails}
            </Button>
          </Box>

          <Typography
            sx={{
              mt: 1.75,
              fontSize: '0.72rem',
              fontWeight: 600,
              color: 'var(--text-muted)',
              letterSpacing: '0.02em',
            }}
          >
            {productLabel}
          </Typography>
        </Box>

        {/* Dominant product visual */}
        <Box
          sx={{
            position: 'relative',
            width: '100%',
            aspectRatio: { xs: '5 / 4', md: '1 / 1' },
            maxHeight: { xs: 280, md: 400 },
            justifySelf: { md: 'end' },
            animation: 'homeHeroVisual 0.9s cubic-bezier(0.22, 1, 0.36, 1) 0.12s both',
            '@keyframes homeHeroVisual': {
              from: { opacity: 0, transform: 'translateX(16px) scale(0.98)' },
              to: { opacity: 1, transform: 'translateX(0) scale(1)' },
            },
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              borderRadius: { xs: '20px', md: '24px' },
              overflow: 'hidden',
              bgcolor: 'var(--surface)',
              border: '1px solid var(--glass-border)',
              boxShadow: (theme) =>
                theme.palette.mode === 'dark'
                  ? '0 24px 60px rgba(0,0,0,0.45)'
                  : '0 20px 50px rgba(0,0,0,0.08)',
            }}
          >
            <OptimizedImage
              src={imageSrc}
              alt={productLabel}
              width="100%"
              height="100%"
              objectFit="cover"
              priority
              placeholder="skeleton"
              showLoadingIndicator={false}
              style={{ position: 'absolute', inset: 0 }}
            />
            <Box
              aria-hidden
              sx={{
                position: 'absolute',
                inset: 0,
                background:
                  'linear-gradient(to top, color-mix(in srgb, var(--background) 35%, transparent) 0%, transparent 42%)',
                pointerEvents: 'none',
              }}
            />
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
