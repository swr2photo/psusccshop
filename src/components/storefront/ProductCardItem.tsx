'use client';

import React from 'react';
import { Box, Typography, IconButton, Chip } from '@mui/material';
import { Heart, ShoppingCart } from 'lucide-react';
import Image from 'next/image';
import { Product, getProductName, getProductDescription } from '@/lib/config';
import { getProductStatus, ShopStatusType, SHOP_STATUS_CONFIG } from '@/components/ShopStatusCard';
import { useWishlistStore } from '@/store/wishlistStore';
import { useTranslation } from '@/hooks/useTranslation';

export interface ProductCardItemProps {
  product: Product;
  catalogContext: {
    shopId?: string;
    shopSlug?: string;
    isOpen: boolean;
    events?: any[];
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
  const isProductAvailable = productStatus === 'OPEN' && !outOfStock && catalogContext.isOpen;
  const productImage = product.coverImage || product.images?.[0] || '/placeholder.png';

  const handleClick = () => {
    if (!catalogContext.isOpen) {
      onShowToast('warning', t.checkout.shopClosedWarning);
      return;
    }
    if (productStatus !== 'OPEN') {
      const statusLabelsMap: Record<ShopStatusType, string> = {
        OPEN: t.shopStatus.open,
        COMING_SOON: t.shopStatus.comingSoon,
        ORDER_ENDED: t.shopStatus.closedEnded,
        TEMPORARILY_CLOSED: t.shopStatus.closed,
        WAITING_TO_OPEN: t.shopStatus.waitingToOpen,
      };
      onShowToast('info', `${getProductName(product, lang)} - ${statusLabelsMap[productStatus]}`);
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
        <Image
          src={productImage}
          alt={getProductName(product, lang)}
          fill
          sizes="(max-width: 600px) 100vw, (max-width: 900px) 50vw, 25vw"
          style={{ objectFit: 'cover' }}
        />

        {/* Overlay if unavailable */}
        {!isProductAvailable && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              bgcolor: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 2,
            }}
          >
            <Chip
              label={
                !catalogContext.isOpen
                  ? t.shopStatus.closed
                  : outOfStock
                  ? t.product.soldOut
                  : SHOP_STATUS_CONFIG[productStatus]?.label || t.shopStatus.closed
              }
              sx={{
                bgcolor: 'rgba(0, 0, 0, 0.75)',
                color: '#fff',
                fontWeight: 700,
                fontSize: '0.8rem',
              }}
            />
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
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 2 }}>
          <Typography sx={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--primary)' }}>
            ฿{(product.basePrice || 0).toLocaleString()}
          </Typography>

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
