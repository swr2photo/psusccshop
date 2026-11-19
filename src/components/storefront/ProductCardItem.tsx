'use client';

import React from 'react';
import { Box, Typography, IconButton, Chip } from '@mui/material';
import { Heart, ShoppingCart } from 'lucide-react';
import { Product, getProductName, getProductDescription } from '@/lib/config';
import { getProductStatus, ShopStatusType, SHOP_STATUS_CONFIG } from '@/components/ShopStatusCard';
import { parseThailandDateTime } from '@/lib/shop-constants';
import { useWishlistStore } from '@/store/wishlistStore';
import { useTranslation } from '@/hooks/useTranslation';
import ProductImage from './ProductImage';

export interface ProductCardItemProps {
  product: Product;
  catalogContext: {
    shopId?: string;
    shopSlug?: string;
    isOpen: boolean;
    events?: unknown[];
  };
  now: Date;
  lang: 'th' | 'en';
  onSelectProduct: (product: Product, context: { shopId?: string; shopSlug?: string; isOpen: boolean }) => void;
  onQuickAddToCart?: (product: Product, context: { shopId?: string; shopSlug?: string; isOpen: boolean }) => void;
  onShowToast: (type: 'info' | 'warning' | 'success' | 'error', message: string) => void;
}

export function ProductCardItem({
  product,
  catalogContext,
  now,
  lang,
  onSelectProduct,
  onQuickAddToCart,
  onShowToast,
}: ProductCardItemProps) {
  const { t } = useTranslation();
  const wishlistStore = useWishlistStore();
  const isWishlisted = wishlistStore.isInWishlist(product.id);

  const productStatus = getProductStatus(product, now);
  const outOfStock = product.stock !== undefined && product.stock !== null && product.stock <= 0;
  const isLockedPreview = Boolean(product.isLockedPreview);
  const isComingSoon = productStatus !== 'OPEN' || !catalogContext.isOpen || isLockedPreview;
  const isProductAvailable = productStatus === 'OPEN' && !outOfStock && catalogContext.isOpen && !isLockedPreview;
  const handleClick = () => {
    if (!catalogContext.isOpen) {
      onShowToast('warning', t.checkout.shopClosedWarning);
      return;
    }
    if (productStatus !== 'OPEN' || isLockedPreview) {
      const effectiveStatus = isLockedPreview && productStatus === 'OPEN' ? 'COMING_SOON' : productStatus;
      const statusLabelsMap: Record<ShopStatusType, string> = {
        OPEN: t.shopStatus.open,
        COMING_SOON: t.shopStatus.comingSoon,
        ORDER_ENDED: t.shopStatus.closedEnded,
        TEMPORARILY_CLOSED: t.shopStatus.closed,
        WAITING_TO_OPEN: t.shopStatus.waitingToOpen,
      };
      onShowToast('info', `${getProductName(product, lang)} - ${statusLabelsMap[effectiveStatus]}`);
      return;
    }
    if (outOfStock) {
      onShowToast('info', `${getProductName(product, lang)} - ${t.product.soldOut}`);
      return;
    }
    onSelectProduct(product, {
      shopId: catalogContext.shopId,
      shopSlug: catalogContext.shopSlug,
      isOpen: catalogContext.isOpen,
    });
  };

  const handleToggleWishlist = (e: React.MouseEvent) => {
    e.stopPropagation();
    wishlistStore.toggleItem(product.id);
  };

  return (
    <Box
      onClick={handleClick}
      className={isProductAvailable ? 'product-card-hover' : ''}
      sx={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'var(--surface)',
        borderRadius: 4,
        overflow: 'hidden',
        border: '1px solid var(--border)',
        cursor: isProductAvailable ? 'pointer' : 'default',
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        position: 'relative',
        opacity: isProductAvailable ? 1 : 0.75,
      }}
    >
      {/* Product Image Box */}
      <Box sx={{ position: 'relative', pt: '100%', bgcolor: 'var(--surface-2)', overflow: 'hidden' }}>
        <ProductImage
          src={product.coverImage}
          fallbackSrcs={product.images}
          alt={getProductName(product, lang)}
          width="100%"
          height="100%"
          objectFit="cover"
          style={{
            position: 'absolute',
            inset: 0,
            ...(isComingSoon ? { filter: 'blur(8px)', transform: 'scale(1.12)' } : {}),
          }}
        />

        {/* Overlay if unavailable */}
        {!isProductAvailable && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              bgcolor: 'rgba(0,0,0,0.5)',
              backdropFilter: isComingSoon ? 'blur(6px)' : 'none',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0.75,
              zIndex: 2,
            }}
          >
            <Chip
              label={
                !catalogContext.isOpen
                  ? t.shopStatus.closed
                  : outOfStock && productStatus === 'OPEN' && !isLockedPreview
                  ? t.product.soldOut
                  : productStatus === 'OPEN' && isLockedPreview
                  ? t.shopStatus.comingSoon
                  : SHOP_STATUS_CONFIG[productStatus]?.label || t.shopStatus.closed
              }
              sx={{
                bgcolor: 'rgba(0, 0, 0, 0.75)',
                color: '#fff',
                fontWeight: 700,
                fontSize: '0.8rem',
              }}
            />
            {product.startDate && product.showStartDate !== false && productStatus === 'COMING_SOON' && catalogContext.isOpen && (
              <Typography
                sx={{
                  px: 1.1,
                  py: 0.25,
                  borderRadius: '999px',
                  bgcolor: 'rgba(24,24,27,0.78)',
                  color: 'rgba(255,255,255,0.9)',
                  fontSize: '0.68rem',
                  fontWeight: 600,
                }}
              >
                {t.product.opensOn} {parseThailandDateTime(product.startDate, false).toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US')}
              </Typography>
            )}
          </Box>
        )}

        {/* Wishlist Button */}
        <IconButton
          onClick={handleToggleWishlist}
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            bgcolor: 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(4px)',
            color: isWishlisted ? '#ef4444' : '#fff',
            '&:hover': { bgcolor: 'rgba(0,0,0,0.6)' },
            zIndex: 3,
          }}
        >
          <Heart size={18} fill={isWishlisted ? '#ef4444' : 'none'} />
        </IconButton>
      </Box>

      {/* Content */}
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: 'space-between' }}>
        <Box>
          <Typography
            sx={{
              fontWeight: 700,
              fontSize: '0.95rem',
              color: 'var(--foreground)',
              lineClamp: 2,
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              mb: 0.5,
            }}
          >
            {getProductName(product, lang)}
          </Typography>

          {!isComingSoon && (
            <Typography
              sx={{
                fontSize: '0.8rem',
                color: 'var(--text-muted)',
                lineClamp: 2,
                display: '-webkit-box',
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {getProductDescription(product, lang)}
            </Typography>
          )}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 2 }}>
          {!isComingSoon ? (
            <Typography sx={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--primary)' }}>
              ฿{(product.basePrice || 0)?.toLocaleString()}
            </Typography>
          ) : (
            <Box />
          )}

          {isProductAvailable && onQuickAddToCart && (
            <IconButton
              onClick={(e) => {
                e.stopPropagation();
                onQuickAddToCart(product, {
                  shopId: catalogContext.shopId,
                  shopSlug: catalogContext.shopSlug,
                  isOpen: catalogContext.isOpen,
                });
              }}
              sx={{
                bgcolor: 'var(--primary)',
                color: '#fff',
                '&:hover': { bgcolor: 'var(--primary-hover)' },
              }}
            >
              <ShoppingCart size={18} />
            </IconButton>
          )}
        </Box>
      </Box>
    </Box>
  );
}
