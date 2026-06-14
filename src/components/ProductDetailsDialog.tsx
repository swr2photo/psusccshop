'use client';

import React, { useMemo, useCallback, useRef, useEffect, useState } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Slide,
  Drawer,
  TextField,
  Button,
  Chip,
  Avatar,
  Dialog,
} from '@mui/material';
import {
  Heart,
  Share2,
  X,
  ChevronLeft,
  ChevronRight,
  Expand,
  Store,
  Tag,
  Package,
  Minus,
  Plus,
  ShoppingCart,
  Zap,
  Users,
  ChevronUp,
  ChevronDown,
  Star,
  Edit,
  Info,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Palette,
  Ruler,
  Image as ImageOutlinedIcon,
  Trash2,
} from 'lucide-react';

import {
  Product,
  ShopConfig,
  ShirtNameConfig,
  DEFAULT_SHIRT_NAME,
  getProductName,
  getProductDescription,
  getProductShirtNameConfig,
} from '@/lib/config';

import { useGalleryImagePreload, isGalleryImageInRange } from '@/hooks/useGalleryImagePreload';
import OptimizedImage from '@/components/OptimizedImage';
import { type ShopEvent } from '@/components/EventBanner';

const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL', '7XL', '8XL', '9XL', '10XL'] as const;
const SIZE_MEASUREMENTS: Record<(typeof SIZE_ORDER)[number], { chest: number; length: number }> = {
  XS: { chest: 34, length: 24 },
  S: { chest: 36, length: 25 },
  M: { chest: 38, length: 26 },
  L: { chest: 40, length: 27 },
  XL: { chest: 42, length: 28 },
  '2XL': { chest: 44, length: 29 },
  '3XL': { chest: 46, length: 30 },
  '4XL': { chest: 48, length: 31 },
  '5XL': { chest: 50, length: 32 },
  '6XL': { chest: 52, length: 33 },
  '7XL': { chest: 54, length: 34 },
  '8XL': { chest: 56, length: 35 },
  '9XL': { chest: 58, length: 36 },
  '10XL': { chest: 60, length: 37 },
};

const TAG_TRANSLATIONS_TH_TO_EN: Record<string, string> = {
  'ใหม่': 'New',
  'ขายดี': 'Best Seller',
  'ยอดนิยม': 'Popular',
  'ลดราคา': 'Sale',
  'แนะนำ': 'Recommended',
  'พรีออเดอร์': 'Pre-order',
  'พร้อมส่ง': 'Ready to Ship',
  'หมด': 'Out of Stock',
};

const clampQty = (value: number) => Math.min(99, Math.max(1, value));

function getEventDiscount(productId: string, events: ShopEvent[] | undefined): { discountedPrice: (original: number) => number; discountLabel: string; eventTitle: string; discountType?: 'percent' | 'fixed'; discountValue?: number } | null {
  if (!events?.length) return null;
  const now = new Date();
  const active = events.find(e => 
    e.enabled && 
    e.linkedProducts?.includes(productId) &&
    e.discountType && e.discountValue && e.discountValue > 0 &&
    (!e.startDate || new Date(e.startDate) <= now) &&
    (!e.endDate || new Date(e.endDate) > now)
  );
  if (!active) return null;
  return {
    discountedPrice: (original: number) => {
      if (active.discountType === 'percent') return Math.round(original * (1 - active.discountValue! / 100));
      return Math.max(0, original - active.discountValue!);
    },
    discountLabel: active.discountType === 'percent' ? `-${active.discountValue}%` : `-฿${active.discountValue}`,
    eventTitle: active.title,
    discountType: active.discountType,
    discountValue: active.discountValue,
  };
}

const productRequiresSize = (product: Product): boolean => {
  if (product.options?.requiresSize === false) return false;
  const getCategoryFromType = (type: string): string => {
    switch (type) {
      case 'JERSEY':
      case 'CREW':
      case 'HOODIE':
      case 'TSHIRT':
      case 'POLO':
      case 'JACKET':
      case 'CAP':
        return 'APPAREL';
      case 'STICKER':
      case 'KEYCHAIN':
      case 'MUG':
      case 'BADGE':
      case 'POSTER':
      case 'NOTEBOOK':
      case 'ACCESSORY':
        return 'MERCHANDISE';
      case 'CAMP_REGISTRATION':
        return 'CAMP_FEE';
      case 'EVENT_TICKET':
        return 'EVENT';
      default:
        return 'OTHER';
    }
  };
  const category = (product as any).category || getCategoryFromType(product.type);
  return category === 'APPAREL';
};

const normalizeShirtName = (value: string, cfg: ShirtNameConfig = DEFAULT_SHIRT_NAME): string => {
  const allowThai = cfg.allowThai !== false;
  const allowEnglish = cfg.allowEnglish !== false;
  const allowSpecial = cfg.allowSpecialChars === true;
  const specials = cfg.allowedSpecialChars || '';

  let res = '';
  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    const isThai = /^[ก-์]$/.test(char);
    const isEng = /^[a-zA-Z]$/.test(char);
    const isSpace = char === ' ';
    const isSpec = specials.includes(char);

    if (
      (allowThai && isThai) ||
      (allowEnglish && isEng) ||
      isSpace ||
      (allowSpecial && isSpec)
    ) {
      res += char;
    }
  }
  return res;
};

const normalizeDigits99 = (value: string) => {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  const num = parseInt(digits);
  return String(Math.min(99, Math.max(0, num)));
};

interface ProductDetailsDialogProps {
  selectedProduct: Product | null;
  productDialogOpen: boolean;
  isMobile: boolean;
  lang: 'th' | 'en';
  activeProductCatalog: {
    isOpen: boolean;
    events?: ShopEvent[];
  };
  t: any;
  wishlistStore: {
    items: string[];
    toggleItem: (id: string) => void;
    isInWishlist: (id: string) => boolean;
  };
  showToast: (type: any, message: string) => void;
  resetProductDialog: () => void;
  inlineNotice: any;
  setInlineNotice: (notice: any) => void;
  
  productReviews: Record<string, any[]>;
  productOptions: any;
  setProductOptions: any;
  handleAddToCart: () => void;
  handleBuyNow: () => void;
  openBulkOrder: () => void;
  handleShareProduct: (p: Product) => void;
  sizeSelectorRef: React.RefObject<HTMLDivElement | null>;
  customNameInputRef: React.RefObject<HTMLInputElement | null>;
  customNumberInputRef: React.RefObject<HTMLInputElement | null>;
  patternSelectorRef: React.RefObject<HTMLDivElement | null>;
  getCurrentPrice: () => number;
  bottomPanelCollapsed: boolean;
  setBottomPanelCollapsed: (val: boolean) => void;
  
  // Review triggers
  session: any;
  setReviewRating: (rating: number) => void;
  setReviewComment: (comment: string) => void;
  setReviewDialogOpen: (open: boolean) => void;
  editingReviewId?: string | null;
  setEditingReviewId?: (id: string | null) => void;
  onEditReview?: (review: any) => void;
  onDeleteReview?: (id: string) => void;
  config: ShopConfig;
}

export const ProductDetailsDialog = React.memo(function ProductDetailsDialog({
  selectedProduct,
  productDialogOpen,
  isMobile,
  lang,
  activeProductCatalog,
  t,
  wishlistStore,
  showToast,
  resetProductDialog,
  inlineNotice,
  setInlineNotice,
  productReviews,
  productOptions,
  setProductOptions,
  handleAddToCart,
  handleBuyNow,
  openBulkOrder,
  handleShareProduct,
  sizeSelectorRef,
  customNameInputRef,
  customNumberInputRef,
  patternSelectorRef,
  getCurrentPrice,
  bottomPanelCollapsed,
  setBottomPanelCollapsed,
  session,
  setReviewRating,
  setReviewComment,
  setReviewDialogOpen,
  editingReviewId,
  setEditingReviewId,
  onEditReview,
  onDeleteReview,
  config,
}: ProductDetailsDialogProps) {
  
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  
  const imageScrollRef = useRef<HTMLDivElement>(null);

  // Sync selected pattern to scroll to its corresponding image on the main page
  useEffect(() => {
    if (productOptions.pattern && selectedProduct?.patterns) {
      const patternObj = selectedProduct.patterns.find(p => p.name === productOptions.pattern);
      if (patternObj?.image) {
        const idx = productImages.indexOf(patternObj.image);
        if (idx !== -1) {
          const timer = setTimeout(() => {
            scrollToImage(idx);
          }, 100);
          return () => clearTimeout(timer);
        }
      }
    }
  }, [productOptions.pattern, selectedProduct]);

  // Handle ESC key or arrow keys for Lightbox
  useEffect(() => {
    if (!lightboxImage) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxImage(null);
        setLightboxImages([]);
      } else if (e.key === 'ArrowLeft') {
        setLightboxIndex((prev) => (prev - 1 + lightboxImages.length) % lightboxImages.length);
      } else if (e.key === 'ArrowRight') {
        setLightboxIndex((prev) => (prev + 1) % lightboxImages.length);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxImage, lightboxImages]);

  // Reset local state when dialog closes/opens
  useEffect(() => {
    if (productDialogOpen) {
      setActiveImageIndex(0);
    }
  }, [productDialogOpen]);

  const productImages = (() => {
    const imgs: string[] = [];
    if (!selectedProduct) return imgs;
    if (selectedProduct.coverImage) {
      imgs.push(selectedProduct.coverImage);
    }
    const images = (selectedProduct.images || []).filter(Boolean);
    images.forEach((img) => {
      if (img && !imgs.includes(img)) {
        imgs.push(img);
      }
    });
    if (selectedProduct.patterns && selectedProduct.patterns.length > 0) {
      selectedProduct.patterns.forEach((p: any) => {
        if (p.isActive !== false && p.image && !imgs.includes(p.image)) {
          imgs.push(p.image);
        }
      });
    }
    return imgs;
  })();

  const totalImages = productImages.length;
  
  useGalleryImagePreload(productImages, activeImageIndex);

  // Smooth scroll container to a specific image index
  const scrollToImage = (index: number) => {
    if (!imageScrollRef.current || productImages.length === 0) return;
    const container = imageScrollRef.current;
    const targetIndex = (index + productImages.length) % productImages.length;
    const itemWidth = container.clientWidth;
    container.scrollTo({
      left: targetIndex * itemWidth,
      behavior: 'smooth',
    });
    setActiveImageIndex(targetIndex);
  };

  // Handle native scroll/swipe index detection
  const handleImageScroll = () => {
    if (!imageScrollRef.current) return;
    const container = imageScrollRef.current;
    const scrollPosition = container.scrollLeft;
    const itemWidth = container.clientWidth;
    if (itemWidth > 0) {
      const roundedIndex = Math.round(scrollPosition / itemWidth);
      if (roundedIndex >= 0 && roundedIndex < productImages.length) {
        setActiveImageIndex(roundedIndex);
      }
    }
  };

  const isDialogShopOpen = activeProductCatalog.isOpen;

  // Determine if pattern must be selected first
  const needsPatternFirst = !!(
    selectedProduct?.patterns &&
    selectedProduct.patterns.filter((p: any) => p.isActive !== false).length > 0 &&
    !productOptions.pattern
  );

  const displaySizes = useMemo(() => {
    if (!selectedProduct) return [t.common.freeSize];
    const sizeKeys = Object.keys(selectedProduct.sizePricing || {});
    if (sizeKeys.length === 0) return [t.common.freeSize];
    return sizeKeys.sort((a, b) => {
      const indexA = SIZE_ORDER.indexOf(a as any);
      const indexB = SIZE_ORDER.indexOf(b as any);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [selectedProduct, t.common.freeSize]);

  if (!selectedProduct) return null;

  const productContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'var(--background)', color: 'var(--foreground)' }}>
      {/* Header - Enhanced Design */}
      <Box sx={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        borderBottom: '1px solid var(--glass-border)',
        background: (theme: any) => theme.palette.mode === 'dark' 
          ? 'rgba(0,0,0,0.85)' 
          : 'rgba(242,242,247,0.85)',
        backdropFilter: 'blur(30px) saturate(180%)',
        WebkitBackdropFilter: 'blur(30px) saturate(180%)',
      }}>
        {isMobile && (
          <Box sx={{ 
            width: 40, 
            height: 5, 
            bgcolor: 'var(--glass-bg)', 
            borderRadius: 3, 
            mx: 'auto', 
            mt: 1.5, 
            mb: 0.5,
            cursor: 'grab',
          }} />
        )}
        <Box sx={{ px: { xs: 2.5, sm: 3 }, py: { xs: 1.5, sm: 2 }, display: 'flex', alignItems: 'center', justifycontent: 'space-between', justifyContent: 'space-between' }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ 
              fontSize: { xs: '1.15rem', sm: '1.35rem' }, 
              fontWeight: 800, 
              color: 'var(--foreground)', 
              overflow: 'hidden', 
              textOverflow: 'ellipsis', 
              whiteSpace: 'nowrap',
              letterSpacing: '-0.02em',
            }}>
              {getProductName(selectedProduct, lang)}
            </Typography>
            {/* Custom Tags from config - only show if customTags is defined */}
            {selectedProduct.customTags && selectedProduct.customTags.length > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.75, flexWrap: 'wrap' }}>
                {selectedProduct.customTags.map((tag, idx) => (
                  <Box key={idx} sx={{
                    px: 1,
                    py: 0.3,
                    borderRadius: '6px',
                    bgcolor: (tag as any).bgColor || `${tag.color}20`,
                    border: `1px solid ${(tag as any).borderColor || `${tag.color}40`}`,
                  }}>
                    <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: tag.color }}>
                      {lang === 'en' 
                        ? ((tag as any).textEn || TAG_TRANSLATIONS_TH_TO_EN[tag.text] || tag.text)
                        : tag.text}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
          </Box>

          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
            {/* Wishlist button in dialog */}
            <IconButton 
              onClick={() => {
                const wasInWishlist = wishlistStore.items.includes(selectedProduct.id);
                wishlistStore.toggleItem(selectedProduct.id);
                showToast(
                  wasInWishlist ? 'info' : 'success',
                  wasInWishlist ? t.wishlist.removedFromWishlist : t.wishlist.addedToWishlist
                );
              }}
              sx={{ 
                color: wishlistStore.isInWishlist(selectedProduct.id) ? '#ff453a' : 'var(--text-muted)', 
                bgcolor: wishlistStore.isInWishlist(selectedProduct.id) ? 'rgba(255,69,58,0.1)' : 'var(--surface-2)', 
                border: 'none',
                width: 36,
                height: 36,
                '&:hover': { 
                  bgcolor: 'rgba(255,69,58,0.15)', 
                  color: '#ff453a',
                },
                transition: 'all 0.2s ease',
              }}
            >
              <Heart size={18} fill={wishlistStore.isInWishlist(selectedProduct.id) ? '#ff453a' : 'none'} />
            </IconButton>
            <IconButton 
              onClick={() => handleShareProduct(selectedProduct)}
              sx={{ 
                color: 'var(--text-muted)', 
                bgcolor: 'var(--surface-2)', 
                border: 'none',
                width: 36,
                height: 36,
                '&:hover': { 
                  bgcolor: 'rgba(0,122,255,0.12)', 
                  color: 'var(--primary)',
                },
                transition: 'all 0.2s ease',
              }}
            >
              <Share2 size={18} />
            </IconButton>
            <IconButton 
              onClick={resetProductDialog} 
              sx={{ 
                color: 'var(--text-muted)', 
                bgcolor: 'var(--surface-2)', 
                border: 'none',
                width: 36,
                height: 36,
                '&:hover': { 
                  bgcolor: 'rgba(239,68,68,0.12)', 
                  color: '#ff453a',
                },
                transition: 'all 0.2s ease',
              }}
            >
              <X size={20} />
            </IconButton>
          </Box>
        </Box>
      </Box>

      {/* Inline Toast - Enhanced Style */}
      {inlineNotice && (
        <Slide direction="up" in={true} mountOnEnter unmountOnExit>
          <Box
            sx={{
              position: 'fixed',
              bottom: { xs: 90, sm: 32 },
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 99999,
              background: (
                {
                  success: 'linear-gradient(135deg, rgba(16, 185, 129, 0.98) 0%, rgba(5, 150, 105, 0.98) 100%)',
                  error: 'linear-gradient(135deg, rgba(239, 68, 68, 0.98) 0%, rgba(220, 38, 38, 0.98) 100%)',
                  warning: 'linear-gradient(135deg, rgba(245, 158, 11, 0.98) 0%, rgba(234, 88, 12, 0.98) 100%)',
                  info: 'linear-gradient(135deg, rgba(0,113,227, 0.98) 0%, rgba(0,113,227, 0.98) 100%)',
                } as Record<string, string>
              )[inlineNotice.type],
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '16px',
              py: 1.5,
              px: 2,
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              boxShadow: (
                {
                  success: '0 8px 32px rgba(16, 185, 129, 0.35)',
                  error: '0 8px 32px rgba(239, 68, 68, 0.35)',
                  warning: '0 8px 32px rgba(245, 158, 11, 0.35)',
                  info: '0 8px 32px rgba(0,113,227, 0.35)',
                } as Record<string, string>
              )[inlineNotice.type],
              minWidth: { xs: 220, sm: 300 },
              animation: 'toastEnterBottom 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
              '@keyframes toastEnterBottom': {
                '0%': { opacity: 0, transform: 'translateX(-50%) translateY(12px) scale(0.96)' },
                '100%': { opacity: 1, transform: 'translateX(-50%) translateY(0) scale(1)' },
              },
            }}
            onClick={() => setInlineNotice(null)}
          >
            <Box 
              sx={{ 
                width: 32,
                height: 32,
                borderRadius: '10px',
                bgcolor: 'rgba(255, 255, 255, 0.2)',
                display: 'grid',
                placeItems: 'center',
                color: '#fff', 
                flexShrink: 0,
              }}
            >
              {inlineNotice.type === 'success' && <CheckCircle2 size={18} />}
              {inlineNotice.type === 'error' && <AlertCircle size={18} />}
              {inlineNotice.type === 'warning' && <AlertTriangle size={18} />}
              {inlineNotice.type === 'info' && <Info size={18} />}
            </Box>
            <Typography
              sx={{
                color: '#fff',
                fontSize: '0.9rem',
                fontWeight: 600,
                flex: 1,
                lineHeight: 1.4,
              }}
            >
              {inlineNotice.message}
            </Typography>
          </Box>
        </Slide>
      )}

      {/* Content */}
      <Box sx={{ flex: 1, overflow: 'auto', WebkitOverflowScrolling: 'touch', px: { xs: 2.5, sm: 3 }, py: 3 }}>
        <Box sx={{
          maxWidth: 1200,
          mx: 'auto',
          width: '100%',
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          gap: { xs: 3, md: 4 },
        }}>
          {/* Left Column - Pinned on desktop */}
          <Box sx={{ 
            flex: 1.2, 
            minWidth: 0, 
            display: 'flex', 
            flexDirection: 'column', 
            gap: 2.5,
            position: { md: 'sticky' },
            top: { md: 20 },
            alignSelf: { md: 'flex-start' },
            maxHeight: { md: 'calc(100dvh - 100px)' },
            overflowY: { md: 'auto' },
            '&::-webkit-scrollbar': { display: 'none' },
            msOverflowStyle: 'none',
            scrollbarWidth: 'none',
          }}>
            {/* Image Gallery - Enhanced */}
            <Box sx={{ mb: 3.5 }}>
              {productImages.length > 0 ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {/* Main Image Scroll Container (Swipeable) */}
                  <Box sx={{ 
                    position: 'relative', 
                    borderRadius: '24px', 
                    overflow: 'hidden',
                    bgcolor: 'var(--surface-2)',
                    border: '1px solid var(--glass-border)',
                    boxShadow: (theme: any) => theme.palette.mode === 'dark'
                      ? '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)'
                      : '0 8px 32px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.8)',
                    height: { xs: 300, sm: 380, md: 440 },
                  }}>
                    {/* Horizontal Scroll Area */}
                    <Box
                      ref={imageScrollRef}
                      onScroll={handleImageScroll}
                      sx={{
                        display: 'flex',
                        width: '100%',
                        height: '100%',
                        overflowX: 'auto',
                        scrollSnapType: 'x mandatory',
                        WebkitOverflowScrolling: 'touch',
                        '&::-webkit-scrollbar': { display: 'none' },
                        scrollbarWidth: 'none',
                      }}
                    >
                      {productImages.map((img, idx) => (
                        <Box
                          key={idx}
                          onClick={() => {
                            setLightboxImages(productImages);
                            setLightboxIndex(idx);
                            setLightboxImage(img);
                          }}
                          sx={{
                            minWidth: '100%',
                            height: '100%',
                            scrollSnapAlign: 'start',
                            position: 'relative',
                            cursor: 'pointer',
                          }}
                        >
                          {isGalleryImageInRange(idx, activeImageIndex) ? (
                            <OptimizedImage
                              src={img}
                              alt={`${selectedProduct.name} - รูปที่ ${idx + 1}`}
                              width="100%"
                              height="100%"
                              objectFit="cover"
                              priority={idx === activeImageIndex}
                              disableFade={idx !== activeImageIndex}
                              placeholder={idx === activeImageIndex ? 'shimmer' : 'none'}
                            />
                          ) : (
                            <Box sx={{ width: '100%', height: '100%', bgcolor: 'var(--surface-2)' }} />
                          )}
                        </Box>
                      ))}
                    </Box>

                    {/* Expand Icon Overlay */}
                    <Box
                      className="expand-icon"
                      sx={{
                        position: 'absolute',
                        top: 12,
                        left: 12,
                        width: 40,
                        height: 40,
                        borderRadius: '12px',
                        bgcolor: 'rgba(0,0,0,0.55)',
                        backdropFilter: 'blur(8px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: 0.85,
                        zIndex: 3,
                        border: '1px solid rgba(255,255,255,0.15)',
                        pointerEvents: 'none',
                      }}
                    >
                      <Expand size={18} color="white" />
                    </Box>

                    {/* Gradient overlay at bottom */}
                    <Box sx={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: 80,
                      background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.6) 100%)',
                      pointerEvents: 'none',
                      zIndex: 1,
                    }} />

                    {totalImages > 1 && (
                      <>
                        <IconButton
                          onClick={(e) => {
                            e.stopPropagation();
                            scrollToImage(activeImageIndex - 1);
                          }}
                          sx={{ 
                            position: 'absolute', 
                            top: '50%', 
                            left: 12, 
                            transform: 'translateY(-50%)',
                            bgcolor: 'rgba(0,0,0,0.6)', 
                            backdropFilter: 'blur(8px)',
                            color: 'white', 
                            border: '1px solid var(--glass-border)',
                            zIndex: 2,
                            '&:hover': { bgcolor: 'rgba(0,0,0,0.8)', transform: 'translateY(-50%) scale(1.05)' },
                            transition: 'all 0.2s ease',
                            width: 44,
                            height: 44,
                          }}
                        >
                          <ChevronLeft size={24} />
                        </IconButton>
                        <IconButton
                          onClick={(e) => {
                            e.stopPropagation();
                            scrollToImage(activeImageIndex + 1);
                          }}
                          sx={{ 
                            position: 'absolute', 
                            top: '50%', 
                            right: 12, 
                            transform: 'translateY(-50%)',
                            bgcolor: 'rgba(0,0,0,0.6)', 
                            backdropFilter: 'blur(8px)',
                            color: 'white', 
                            border: '1px solid var(--glass-border)',
                            zIndex: 2,
                            '&:hover': { bgcolor: 'rgba(0,0,0,0.8)', transform: 'translateY(-50%) scale(1.05)' },
                            transition: 'all 0.2s ease',
                            width: 44,
                            height: 44,
                          }}
                        >
                          <ChevronRight size={24} />
                        </IconButton>

                        {/* Dot indicators */}
                        <Box sx={{
                          position: 'absolute',
                          bottom: 16,
                          left: '50%',
                          transform: 'translateX(-50%)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.75,
                          zIndex: 2,
                        }}>
                          {productImages.map((_, idx) => {
                            const active = activeImageIndex === idx;
                            return (
                              <Box
                                key={idx}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  scrollToImage(idx);
                                }}
                                sx={{
                                  cursor: 'pointer',
                                  width: active ? 8 : 6,
                                  height: active ? 8 : 6,
                                  borderRadius: '50%',
                                  bgcolor: active ? '#0071e3' : 'rgba(255, 255, 255, 0.45)',
                                  transition: 'background-color 0.2s ease, transform 0.2s ease',
                                  flexShrink: 0,
                                  '&:hover': {
                                    bgcolor: active ? '#0071e3' : 'rgba(255, 255, 255, 0.75)',
                                  },
                                }}
                              />
                            );
                          })}
                        </Box>
                      </>
                    )}
                  </Box>

                  {/* Thumbnail Gallery - Enhanced */}
                  {totalImages > 1 && (
                    <Box sx={{ 
                      display: 'flex', 
                      gap: 1.5, 
                      overflowX: 'auto', 
                      pb: 1, 
                      px: 0.5,
                      '&::-webkit-scrollbar': { height: 4 },
                      '&::-webkit-scrollbar-track': { bgcolor: 'var(--glass-bg)', borderRadius: 2 },
                      '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(0,113,227,0.3)', borderRadius: 2 },
                    }}>
                      {productImages.map((img, idx) => (
                        <Box
                          key={idx}
                          onClick={() => scrollToImage(idx)}
                          sx={{
                            width: 72,
                            height: 72,
                            borderRadius: '14px',
                            border: activeImageIndex === idx ? '2px solid #0071e3' : '1px solid var(--glass-border)',
                            overflow: 'hidden',
                            cursor: 'pointer',
                            opacity: activeImageIndex === idx ? 1 : 0.55,
                            transform: activeImageIndex === idx ? 'scale(1.02)' : 'scale(1)',
                            transition: 'all 0.25s ease',
                            flexShrink: 0,
                            boxShadow: activeImageIndex === idx ? '0 4px 16px rgba(0,113,227,0.3)' : 'none',
                            '&:hover': { opacity: 1, borderColor: 'rgba(0,113,227,0.5)' },
                          }}
                        >
                          <OptimizedImage
                            src={img}
                            alt={`${selectedProduct.name}-${idx}`}
                            width="100%"
                            height="100%"
                            objectFit="cover"
                            disableFade
                            placeholder="none"
                            priority={activeImageIndex === idx}
                          />
                        </Box>
                      ))}
                    </Box>
                  )}
                </Box>
              ) : (
                <Box sx={{ 
                  height: 220, 
                  borderRadius: '24px', 
                  bgcolor: 'var(--surface-2)',
                  border: '2px dashed var(--glass-border)', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: 1,
                }}>
                  <Box sx={{ 
                    width: 56, 
                    height: 56, 
                    borderRadius: '16px', 
                    bgcolor: 'rgba(100,116,139,0.15)',
                    display: 'grid',
                    placeItems: 'center',
                  }}>
                    <Store size={28} color="#86868b" />
                  </Box>
                  <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 500 }}>
                    {t.product.noImages}
                  </Typography>
                </Box>
              )}
            </Box>

            {/* Description - Enhanced Premium Design */}
            {(getProductDescription(selectedProduct, lang) || selectedProduct.description) && (
              <Box sx={{
                p: 0,
                mb: 3,
                borderRadius: '20px',
                background: (theme: any) => theme.palette.mode === 'dark' 
                  ? 'linear-gradient(145deg, rgba(0,0,0,0.8) 0%, rgba(29,29,31,0.6) 100%)' 
                  : 'linear-gradient(145deg, rgba(255,255,255,0.9) 0%, rgba(245,245,247,0.8) 100%)',
                border: (theme: any) => theme.palette.mode === 'dark' ? '1px solid rgba(0,113,227,0.2)' : '1px solid rgba(0,113,227,0.15)',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: (theme: any) => theme.palette.mode === 'dark' ? '0 4px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)' : '0 4px 20px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.8)',
              }}>
                {/* Header */}
                <Box sx={{
                  px: 2.5,
                  py: 1.5,
                  background: 'linear-gradient(90deg, rgba(0,113,227,0.15) 0%, rgba(0,113,227,0.1) 100%)',
                  borderBottom: '1px solid rgba(0,113,227,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}>
                  <Box sx={{
                    width: 28,
                    height: 28,
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #0071e3 0%, #0077ED 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 8px rgba(0,113,227,0.4)',
                  }}>
                    <Info size={14} color="#fff" />
                  </Box>
                  <Typography sx={{ 
                    fontSize: '0.85rem', 
                    fontWeight: 700, 
                    color: 'var(--foreground)',
                    letterSpacing: '0.02em',
                  }}>
                    {t.product.description}
                  </Typography>
                </Box>
                
                {/* Content */}
                <Box sx={{ p: 2.5 }}>
                  <Typography sx={{ 
                    fontSize: '0.88rem', 
                    color: 'var(--foreground)', 
                    opacity: 0.85,
                    lineHeight: 1.7,
                    whiteSpace: 'pre-line' 
                  }}>
                    {getProductDescription(selectedProduct, lang) || selectedProduct.description}
                  </Typography>
                </Box>
                
                {/* Decorative corner */}
                <Box sx={{
                  position: 'absolute',
                  top: -30,
                  right: -30,
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(0,113,227,0.15) 0%, transparent 70%)',
                  pointerEvents: 'none',
                }} />
              </Box>
            )}

            {/* Camp Info - for camp registration products */}
            {(selectedProduct as any).campInfo && (
              <Box sx={{
                p: { xs: 2.5, sm: 3 },
                mb: 2.5,
                borderRadius: '20px',
                background: 'linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(245,158,11,0.05) 100%)',
                border: '1px solid rgba(245,158,11,0.3)',
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                  <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: 'var(--warning)' }}>
                    {t.product.campInfo}
                  </Typography>
                </Box>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
                  {(selectedProduct as any).campInfo.campName && (
                    <Box>
                      <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{t.product.campName}</Typography>
                      <Typography sx={{ fontSize: '0.9rem', color: 'var(--foreground)', fontWeight: 600 }}>
                        {(selectedProduct as any).campInfo.campName}
                      </Typography>
                    </Box>
                  )}
                  {(selectedProduct as any).campInfo.campDate && (
                    <Box>
                      <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{t.product.campDate}</Typography>
                      <Typography sx={{ fontSize: '0.9rem', color: 'var(--foreground)', fontWeight: 600 }}>
                        {new Date((selectedProduct as any).campInfo.campDate).toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US', { 
                          day: 'numeric', month: 'long', year: 'numeric' 
                        })}
                      </Typography>
                    </Box>
                  )}
                  {(selectedProduct as any).campInfo.location && (
                    <Box>
                      <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{t.product.campLocation}</Typography>
                      <Typography sx={{ fontSize: '0.9rem', color: 'var(--foreground)', fontWeight: 600 }}>
                        {(selectedProduct as any).campInfo.location}
                      </Typography>
                    </Box>
                  )}
                  {(selectedProduct as any).campInfo.organizer && (
                    <Box>
                      <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{t.product.campOrganizer}</Typography>
                      <Typography sx={{ fontSize: '0.9rem', color: 'var(--foreground)', fontWeight: 600 }}>
                        {(selectedProduct as any).campInfo.organizer}
                      </Typography>
                    </Box>
                  )}
                  {(selectedProduct as any).campInfo.maxParticipants > 0 && (
                    <Box sx={{ gridColumn: 'span 2' }}>
                      <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{t.product.campCapacity}</Typography>
                      <Typography sx={{ fontSize: '0.9rem', color: 'var(--foreground)', fontWeight: 600 }}>
                        {(selectedProduct as any).campInfo.currentParticipants || 0} / {(selectedProduct as any).campInfo.maxParticipants} {t.common.people}
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Box>
            )}

            {/* Event Info - for event ticket products */}
            {(selectedProduct as any).eventInfo && (
              <Box sx={{
                p: { xs: 2.5, sm: 3 },
                mb: 2.5,
                borderRadius: '20px',
                background: 'linear-gradient(135deg, rgba(236,72,153,0.15) 0%, rgba(236,72,153,0.05) 100%)',
                border: '1px solid rgba(236,72,153,0.3)',
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                  <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: 'var(--error)' }}>
                    {t.product.eventInfo}
                  </Typography>
                </Box>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
                  {(selectedProduct as any).eventInfo.eventName && (
                    <Box sx={{ gridColumn: 'span 2' }}>
                      <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{t.product.eventName}</Typography>
                      <Typography sx={{ fontSize: '0.9rem', color: 'var(--foreground)', fontWeight: 600 }}>
                        {(selectedProduct as any).eventInfo.eventName}
                      </Typography>
                    </Box>
                  )}
                  {(selectedProduct as any).eventInfo.eventDate && (
                    <Box>
                      <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{t.product.eventDate}</Typography>
                      <Typography sx={{ fontSize: '0.9rem', color: 'var(--foreground)', fontWeight: 600 }}>
                        {new Date((selectedProduct as any).eventInfo.eventDate).toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US', { 
                          day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                      </Typography>
                    </Box>
                  )}
                  {(selectedProduct as any).eventInfo.venue && (
                    <Box>
                      <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{t.product.eventLocation}</Typography>
                      <Typography sx={{ fontSize: '0.9rem', color: 'var(--foreground)', fontWeight: 600 }}>
                        {(selectedProduct as any).eventInfo.venue}
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Box>
            )}

            {/* Desktop Reviews Section */}
            {!isMobile && selectedProduct && (
              <Box sx={{
                p: 3,
                borderRadius: '20px',
                bgcolor: 'var(--surface-2)',
                border: '1px solid var(--glass-border)',
                mt: 3,
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Star size={18} color="#ff9f0a" fill="#ff9f0a" />
                    <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--foreground)' }}>
                      {t.reviews.title}
                    </Typography>
                    {(() => {
                      const reviewsList = productReviews[selectedProduct.id] || [];
                      if (reviewsList.length === 0) return null;
                      const avg = reviewsList.reduce((s, r) => s + r.rating, 0) / reviewsList.length;
                      return (
                        <Chip 
                          label={`${avg.toFixed(1)} (${reviewsList.length})`} 
                          size="small" 
                          sx={{ height: 22, fontSize: '0.7rem', fontWeight: 700, bgcolor: 'rgba(255,159,10,0.1)', color: '#ff9f0a' }} 
                        />
                      );
                    })()}
                  </Box>
                  <Button
                    size="small"
                    startIcon={<Edit size={14} />}
                    onClick={() => {
                      if (!session) {
                        showToast('warning', t.reviews.loginRequired);
                        return;
                      }
                      setReviewRating(0);
                      setReviewComment('');
                      setReviewDialogOpen(true);
                    }}
                    sx={{ fontSize: '0.78rem', fontWeight: 600, textTransform: 'none', color: '#0071e3' }}
                  >
                    {t.reviews.writeReview}
                  </Button>
                </Box>

                {/* Reviews list */}
                {(() => {
                  const reviewsList = productReviews[selectedProduct.id] || [];
                  if (reviewsList.length === 0) {
                    return (
                      <Box sx={{ textAlign: 'center', py: 3, borderRadius: '14px', bgcolor: 'var(--surface)', border: '1px solid var(--glass-border)' }}>
                        <Star size={32} strokeWidth={1} color="var(--text-muted)" />
                        <Typography sx={{ mt: 1, fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>{t.reviews.noReviews}</Typography>
                        <Typography sx={{ fontSize: '0.75rem', color: 'var(--text-muted)', opacity: 0.7 }}>{t.reviews.beFirst}</Typography>
                      </Box>
                    );
                  }
                  return (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      {reviewsList.map((review) => (
                        <Box key={review.id} sx={{ p: 2, borderRadius: '12px', bgcolor: 'var(--surface)', border: '1px solid var(--glass-border)' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <Avatar src={review.userImage} sx={{ width: 28, height: 28, fontSize: '0.75rem' }}>{review.userName[0]}</Avatar>
                            <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--foreground)', flex: 1 }}>{review.userName}</Typography>
                            {review.verified && (
                              <Chip label={t.reviews.verified} size="small" sx={{ height: 18, fontSize: '0.55rem', bgcolor: 'rgba(52,199,89,0.1)', color: '#34c759' }} />
                            )}
                            <Box sx={{ display: 'flex', gap: 0.2 }}>
                              {[1, 2, 3, 4, 5].map((s) => (
                                <Star key={s} size={12} color="#ff9f0a" fill={s <= review.rating ? '#ff9f0a' : 'none'} />
                              ))}
                            </Box>
                            {review.isOwner && (
                              <Box sx={{ display: 'flex', gap: 0.5, ml: 1 }}>
                                <IconButton size="small" onClick={() => onEditReview?.(review)} sx={{ p: 0.5 }}>
                                  <Edit size={14} color="var(--text-muted)" />
                                </IconButton>
                                <IconButton size="small" onClick={() => onDeleteReview?.(review.id)} sx={{ p: 0.5 }}>
                                  <Trash2 size={14} color="#ff453a" />
                                </IconButton>
                              </Box>
                            )}
                          </Box>
                          {review.comment && (
                            <Typography sx={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5, ml: 4.5 }}>{review.comment}</Typography>
                          )}
                        </Box>
                      ))}
                    </Box>
                  );
                })()}
              </Box>
            )}
          </Box>

          {/* Right Column - Options/Selection */}
          <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            {/* Pattern Selection - Moved to the Top */}
            {selectedProduct.patterns && selectedProduct.patterns.filter((p: any) => p.isActive !== false).length > 0 && (
              <Box
                ref={patternSelectorRef}
                sx={{
                  p: { xs: 2.5, sm: 3 },
                  mb: 2.5,
                  borderRadius: '20px',
                  background: 'linear-gradient(135deg, rgba(56,189,248,0.15) 0%, rgba(56,189,248,0.05) 100%)',
                  border: '1px solid rgba(56,189,248,0.3)',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                  <Box sx={{
                    width: 36,
                    height: 36,
                    borderRadius: '10px',
                    bgcolor: 'rgba(56,189,248,0.2)',
                    display: 'grid',
                    placeItems: 'center',
                  }}>
                    <Palette size={18} color="#38bdf8" />
                  </Box>
                  <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--foreground)', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                    <span>{lang === 'en' ? 'Select Design/Pattern' : 'เลือกลายสินค้า'}</span>
                    {needsPatternFirst && (
                      <Box component="span" sx={{ fontSize: '0.72rem', color: '#ff453a', fontWeight: 600, animation: 'pulse 1.5s infinite' }}>
                        ({lang === 'en' ? 'Please select a design first' : 'กรุณาเลือกลายสินค้าก่อน'})
                      </Box>
                    )}
                  </Typography>
                </Box>

                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 1.5 }}>
                  {selectedProduct.patterns
                    .filter((p: any) => p.isActive !== false)
                    .map((pattern: any) => {
                      const active = productOptions.pattern === pattern.name;
                      return (
                        <Box
                          key={pattern.id}
                          onClick={() => setProductOptions({ ...productOptions, pattern: pattern.name })}
                          sx={{
                            p: 1,
                            borderRadius: '12px',
                            border: active ? '2px solid #38bdf8' : '1px solid var(--glass-border)',
                            bgcolor: active ? 'rgba(56,189,248,0.08)' : 'var(--surface-2)',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 0.5,
                            '&:hover': { opacity: 0.9, borderColor: '#38bdf8' },
                            transition: 'all 0.2s ease',
                            position: 'relative',
                          }}
                        >
                          <Box sx={{
                            width: '100%',
                            height: 64,
                            borderRadius: '8px',
                            overflow: 'hidden',
                            bgcolor: 'var(--glass-bg)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '1px solid var(--glass-border)',
                          }}>
                            {pattern.image ? (
                              <img src={pattern.image} alt={pattern.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <ImageOutlinedIcon size={20} style={{ color: 'var(--text-muted)' }} />
                            )}
                          </Box>
                          <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: active ? 'var(--secondary)' : 'var(--foreground)', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
                            {pattern.name}
                          </Typography>
                        </Box>
                      );
                    })}
                </Box>
              </Box>
            )}

            <Box sx={{
              opacity: needsPatternFirst ? 0.45 : 1,
              pointerEvents: needsPatternFirst ? 'none' : 'auto',
              transition: 'all 0.3s ease',
              display: 'flex',
              flexDirection: 'column',
              gap: 2.5,
            }}>
              {/* Size Chart & Selection - Redesigned Interactive Vertical Table */}
              {productRequiresSize(selectedProduct) && (
                <Box sx={{
                  p: { xs: 2.5, sm: 3 },
                  mb: 2.5,
                  borderRadius: '20px',
                  background: (theme: any) => theme.palette.mode === 'dark' 
                    ? 'linear-gradient(135deg, rgba(29,29,31,0.6) 0%, rgba(29,29,31,0.3) 100%)' 
                    : 'linear-gradient(135deg, rgba(255,255,255,0.8) 0%, rgba(245,245,247,0.6) 100%)',
                  border: '1px solid var(--glass-border)',
                  boxShadow: (theme: any) => theme.palette.mode === 'dark' ? 'inset 0 1px 0 rgba(255,255,255,0.05)' : 'inset 0 1px 0 rgba(255,255,255,0.8)',
                }}>
                  <Box ref={sizeSelectorRef} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                    <Box sx={{
                      width: 36,
                      height: 36,
                      borderRadius: '10px',
                      bgcolor: 'rgba(0,113,227,0.15)',
                      display: 'grid',
                      placeItems: 'center',
                    }}>
                      <Ruler size={18} color="#2997ff" />
                    </Box>
                    <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--foreground)' }}>
                      {t.product.sizeChart} & {t.product.selectSize}
                    </Typography>
                  </Box>

                  <Box sx={{ 
                    mb: 1, 
                    borderRadius: '16px', 
                    bgcolor: 'var(--surface)',
                    border: '1px solid var(--glass-border)',
                    overflow: 'hidden',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
                  }}>
                    {/* Table Header */}
                    <Box sx={{ 
                      display: 'grid', 
                      gridTemplateColumns: '1.2fr 1fr 1.2fr 1fr', 
                      p: 1.5, 
                      bgcolor: 'rgba(0,113,227,0.08)',
                      borderBottom: '1px solid var(--glass-border)',
                      textAlign: 'center',
                    }}>
                      <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--primary)', textAlign: 'left', pl: 2 }}>
                        {lang === 'en' ? 'Size' : 'ขนาดไซส์'}
                      </Typography>
                      <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--primary)' }}>
                        {lang === 'en' ? 'Chest (in)' : 'รอบอก (นิ้ว)'}
                      </Typography>
                      <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--primary)' }}>
                        {lang === 'en' ? 'Length (in)' : 'ความยาว (นิ้ว)'}
                      </Typography>
                      <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--primary)', pr: 1 }}>
                        {lang === 'en' ? 'Price' : 'ราคา'}
                      </Typography>
                    </Box>

                    {/* Table Body */}
                    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                      {displaySizes.map((size) => {
                        const sizeKey = size as keyof typeof SIZE_MEASUREMENTS;
                        const measurement = SIZE_MEASUREMENTS[sizeKey];
                        const isSelected = productOptions.size === size;
                        
                        const basePrice = selectedProduct?.sizePricing?.[size] ?? selectedProduct?.basePrice ?? 0;
                        const longSleeveFee = selectedProduct.options?.hasLongSleeve && productOptions.isLongSleeve 
                          ? (selectedProduct.options?.longSleevePrice ?? 50) 
                          : 0;
                        const price = basePrice + longSleeveFee;

                        return (
                          <Box 
                            key={size}
                            onClick={() => setProductOptions({ ...productOptions, size })}
                            sx={{
                              display: 'grid',
                              gridTemplateColumns: '1.2fr 1fr 1.2fr 1fr',
                              p: 1.5,
                              alignItems: 'center',
                              textAlign: 'center',
                              cursor: 'pointer',
                              bgcolor: isSelected ? 'rgba(0,113,227,0.08)' : 'transparent',
                              borderBottom: '1px solid var(--glass-border)',
                              '&:last-child': { borderBottom: 'none' },
                              position: 'relative',
                              transition: 'all 0.2s ease',
                              '&:hover': {
                                bgcolor: isSelected ? 'rgba(0,113,227,0.12)' : 'var(--surface-2)',
                              },
                            }}
                          >
                            {/* Left indicator line for active row */}
                            {isSelected && (
                              <Box sx={{
                                position: 'absolute',
                                left: 0,
                                top: 0,
                                bottom: 0,
                                width: 4,
                                bgcolor: 'var(--primary)',
                                borderRadius: '0 4px 4px 0',
                              }} />
                            )}
                            
                            <Typography sx={{ 
                              fontSize: '0.85rem', 
                              fontWeight: 700, 
                              color: isSelected ? 'var(--primary)' : 'var(--foreground)',
                              textAlign: 'left',
                              pl: 2,
                            }}>
                              {size}
                            </Typography>
                            
                            <Typography sx={{ 
                              fontSize: '0.82rem', 
                              fontWeight: isSelected ? 600 : 500,
                              color: isSelected ? 'var(--foreground)' : 'var(--text-muted)',
                            }}>
                              {measurement?.chest ? `${measurement.chest}"` : '-'}
                            </Typography>
                            
                            <Typography sx={{ 
                              fontSize: '0.82rem', 
                              fontWeight: isSelected ? 600 : 500,
                              color: isSelected ? 'var(--foreground)' : 'var(--text-muted)',
                            }}>
                              {measurement?.length ? `${measurement.length}"` : '-'}
                            </Typography>

                            <Typography sx={{ 
                              fontSize: '0.82rem', 
                              fontWeight: 700, 
                              color: isSelected ? 'var(--success)' : 'var(--foreground)',
                              pr: 1,
                            }}>
                              ฿{price.toLocaleString()}
                            </Typography>
                          </Box>
                        );
                      })}
                    </Box>
                  </Box>
                </Box>
              )}

              {/* Variants Selection - for non-apparel products */}
              {!productRequiresSize(selectedProduct) && (selectedProduct as any).variants && (selectedProduct as any).variants.length > 0 && (
                <Box sx={{
                  p: { xs: 2.5, sm: 3 },
                  mb: 2.5,
                  borderRadius: '20px',
                  background: 'linear-gradient(135deg, rgba(0,113,227,0.15) 0%, rgba(0,113,227,0.05) 100%)',
                  border: '1px solid rgba(0,113,227,0.3)',
                }}>
                  <Box ref={sizeSelectorRef} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                    <Box sx={{
                      width: 36,
                      height: 36,
                      borderRadius: '10px',
                      bgcolor: 'rgba(0,113,227,0.2)',
                      display: 'grid',
                      placeItems: 'center',
                    }}>
                      <span style={{ fontSize: '1.1rem' }}></span>
                    </Box>
                    <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--secondary)' }}>
                      {t.product.selectOption}
                    </Typography>
                  </Box>

                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {((selectedProduct as any).variants || [])
                      .filter((v: any) => v.isActive !== false)
                      .map((variant: any) => {
                        const active = productOptions.size === variant.id;
                        const isOutOfStock = variant.stock !== null && variant.stock !== undefined && variant.stock <= 0;
                        return (
                          <Box
                            key={variant.id}
                            onClick={() => {
                              if (isOutOfStock) return;
                              setProductOptions({ ...productOptions, size: variant.id });
                            }}
                            sx={{
                              px: 2,
                              py: 1.5,
                              borderRadius: '12px',
                              border: active ? '2px solid var(--primary)' : '1px solid var(--glass-border)',
                              bgcolor: active ? 'rgba(0,122,255,0.08)' : isOutOfStock ? 'var(--surface)' : 'var(--surface-2)',
                              cursor: isOutOfStock ? 'not-allowed' : 'pointer',
                              opacity: isOutOfStock ? 0.5 : 1,
                              transition: 'all 0.2s ease',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              minWidth: 90,
                              position: 'relative',
                              '&:hover': !isOutOfStock ? { 
                                borderColor: active ? '#0077ED' : 'rgba(0,113,227,0.5)',
                                bgcolor: active ? 'rgba(0,113,227,0.2)' : 'rgba(0,113,227,0.08)',
                              } : {},
                            }}
                          >
                            {isOutOfStock && (
                              <Box sx={{
                                position: 'absolute',
                                top: -8,
                                right: -8,
                                px: 0.8,
                                py: 0.2,
                                bgcolor: '#ff453a',
                                borderRadius: '6px',
                                fontSize: '0.6rem',
                                fontWeight: 700,
                                color: 'white',
                              }}>
                                {t.common.outOfStock}
                              </Box>
                            )}
                            <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, color: active ? 'var(--secondary)' : 'var(--foreground)' }}>
                              {variant.name}
                            </Typography>
                            <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: active ? 'var(--secondary)' : 'var(--text-muted)' }}>
                              ฿{(variant.price || selectedProduct.basePrice).toLocaleString()}
                            </Typography>
                            {variant.stock !== null && variant.stock !== undefined && variant.stock > 0 && (
                              <Typography sx={{ fontSize: '0.6rem', color: 'var(--text-muted)', mt: 0.3 }}>
                                {t.common.remaining} {variant.stock}
                              </Typography>
                            )}
                          </Box>
                        );
                      })}
                  </Box>
                </Box>
              )}

              {/* Additional Options */}
              {(selectedProduct.options?.hasCustomName || selectedProduct.options?.hasCustomNumber || selectedProduct.options?.hasLongSleeve) && (
                <Box sx={{
                  p: { xs: 2, sm: 2.5 },
                  mb: 2,
                  borderRadius: '18px',
                  bgcolor: 'var(--surface-2)',
                  border: '1px solid var(--glass-border)',
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
                    <Box sx={{
                      width: 36,
                      height: 36,
                      borderRadius: '10px',
                      bgcolor: 'rgba(16,185,129,0.15)',
                      display: 'grid',
                      placeItems: 'center',
                    }}>
                      <Tag size={18} color="#30d158" />
                    </Box>
                    <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--foreground)' }}>
                      {t.product.additionalOptions}
                    </Typography>
                  </Box>

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {selectedProduct.options?.hasCustomName && (() => {
                      const sc = getProductShirtNameConfig(selectedProduct, config?.shirtNameConfig);
                      const langs: string[] = [];
                      if (sc.allowThai) langs.push(t.profile.langThai);
                      if (sc.allowEnglish) langs.push(t.profile.langEnglish);
                      const langLabel = langs.join('/');
                      const label = `${t.product.customNameLabel} (${langLabel}${sc.allowSpecialChars ? ` + ${sc.allowedSpecialChars}` : ''}, ${sc.minLength}-${sc.maxLength} ${t.profile.characters})`;
                      return (
                        <TextField
                          label={label}
                          fullWidth
                          value={productOptions.customName}
                          onChange={(e) => setProductOptions({ ...productOptions, customName: normalizeShirtName(e.target.value, sc) })}
                          inputProps={{ maxLength: sc.maxLength }}
                          inputRef={customNameInputRef}
                          placeholder={sc.allowThai ? t.product.customNameExample : t.product.customNameExampleEN}
                          helperText={`${productOptions.customName.length}/${sc.maxLength}`}
                          sx={{ 
                            '& .MuiOutlinedInput-root': { 
                              color: 'var(--foreground)',
                              borderRadius: '12px',
                              '& fieldset': { borderColor: 'var(--glass-border)' },
                              '&:hover fieldset': { borderColor: 'rgba(0,113,227,0.5)' },
                              '&.Mui-focused fieldset': { borderColor: '#0071e3' },
                            }, 
                            '& label': { color: 'var(--text-muted)' },
                            '& label.Mui-focused': { color: 'var(--secondary)' },
                          }}
                        />
                      );
                    })()}

                    {selectedProduct.options?.hasCustomNumber && (
                      <TextField
                        label={t.product.customNumberLabel}
                        fullWidth
                        value={productOptions.customNumber}
                        onChange={(e) => setProductOptions({ ...productOptions, customNumber: normalizeDigits99(e.target.value) })}
                        inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }}
                        inputRef={customNumberInputRef}
                        placeholder={t.product.customNumberExample}
                        sx={{ 
                          '& .MuiOutlinedInput-root': { 
                            color: 'var(--foreground)',
                            borderRadius: '12px',
                            '& fieldset': { borderColor: 'var(--glass-border)' },
                            '&:hover fieldset': { borderColor: 'rgba(0,113,227,0.5)' },
                            '&.Mui-focused fieldset': { borderColor: '#0071e3' },
                          }, 
                          '& label': { color: 'var(--text-muted)' },
                          '& label.Mui-focused': { color: 'var(--secondary)' },
                        }}
                      />
                    )}

                    {selectedProduct.options?.hasLongSleeve && (() => {
                      const sleevePrice = selectedProduct.options?.longSleevePrice ?? 50;
                      return (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                          <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--foreground)' }}>
                            {lang === 'en' ? 'Sleeve Type' : 'ประเภทแขนเสื้อ'}
                          </Typography>
                          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                            {/* Short Sleeve Card */}
                            <Box
                              onClick={() => setProductOptions({ ...productOptions, isLongSleeve: false })}
                              sx={{
                                p: 2.2,
                                borderRadius: '16px',
                                border: !productOptions.isLongSleeve ? '2px solid #ff9f0a' : '1px solid var(--glass-border)',
                                bgcolor: !productOptions.isLongSleeve ? 'rgba(255,159,10,0.08)' : 'var(--glass-bg)',
                                cursor: 'pointer',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                position: 'relative',
                                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                                boxShadow: !productOptions.isLongSleeve ? '0 8px 20px rgba(255,159,10,0.15)' : 'none',
                                '&:hover': {
                                  borderColor: '#ff9f0a',
                                  bgcolor: 'rgba(255,159,10,0.04)',
                                  transform: 'translateY(-2px)',
                                },
                              }}
                            >
                              {!productOptions.isLongSleeve && (
                                <Box sx={{
                                  position: 'absolute',
                                  top: 8,
                                  right: 8,
                                  color: '#ff9f0a',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}>
                                  <CheckCircle2 size={16} fill="rgba(255,159,10,0.2)" />
                                </Box>
                              )}
                              <Typography sx={{ fontSize: '0.92rem', fontWeight: 800, color: !productOptions.isLongSleeve ? '#ff9f0a' : 'var(--foreground)' }}>
                                {lang === 'en' ? 'Short Sleeve (แขนสั้น)' : 'แขนสั้น (Short Sleeve)'}
                              </Typography>
                              <Typography sx={{ fontSize: '0.78rem', color: 'var(--text-muted)', mt: 0.5, fontWeight: 600 }}>
                                +฿0
                              </Typography>
                            </Box>

                            {/* Long Sleeve Card */}
                            <Box
                              onClick={() => setProductOptions({ ...productOptions, isLongSleeve: true })}
                              sx={{
                                p: 2.2,
                                borderRadius: '16px',
                                border: productOptions.isLongSleeve ? '2px solid #ff9f0a' : '1px solid var(--glass-border)',
                                bgcolor: productOptions.isLongSleeve ? 'rgba(255,159,10,0.08)' : 'var(--glass-bg)',
                                cursor: 'pointer',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                position: 'relative',
                                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                                boxShadow: productOptions.isLongSleeve ? '0 8px 20px rgba(255,159,10,0.15)' : 'none',
                                '&:hover': {
                                  borderColor: '#ff9f0a',
                                  bgcolor: 'rgba(255,159,10,0.04)',
                                  transform: 'translateY(-2px)',
                                },
                              }}
                            >
                              {productOptions.isLongSleeve && (
                                <Box sx={{
                                  position: 'absolute',
                                  top: 8,
                                  right: 8,
                                  color: '#ff9f0a',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}>
                                  <CheckCircle2 size={16} fill="rgba(255,159,10,0.2)" />
                                </Box>
                              )}
                              <Typography sx={{ fontSize: '0.92rem', fontWeight: 800, color: productOptions.isLongSleeve ? '#ff9f0a' : 'var(--foreground)' }}>
                                {lang === 'en' ? 'Long Sleeve (แขนยาว)' : 'แขนยาว (Long Sleeve)'}
                              </Typography>
                              <Typography sx={{ fontSize: '0.78rem', color: productOptions.isLongSleeve ? '#ff9f0a' : 'var(--text-muted)', mt: 0.5, fontWeight: 700 }}>
                                +฿{sleevePrice}
                              </Typography>
                            </Box>
                          </Box>
                        </Box>
                      );
                    })()}
                  </Box>
                </Box>
              )}

              {/* Quantity - Enhanced */}
              <Box sx={{
                p: { xs: 2.5, sm: 3 },
                mb: 2.5,
                borderRadius: '20px',
                background: 'var(--surface-2)',
                border: 'none',
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box sx={{
                      width: 40,
                      height: 40,
                      borderRadius: '12px',
                      bgcolor: 'rgba(0,113,227,0.15)',
                      display: 'grid',
                      placeItems: 'center',
                    }}>
                      <Package size={20} color="#2997ff" />
                    </Box>
                    <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: 'var(--foreground)' }}>
                      {t.product.quantity}
                    </Typography>
                  </Box>
                  <Box sx={{
                    display: 'flex',
                    alignItems: 'center',
                    bgcolor: 'var(--glass-bg)',
                    borderRadius: '16px',
                    border: '1px solid var(--glass-border)',
                    overflow: 'hidden',
                  }}>
                    <IconButton
                      onClick={() => setProductOptions({ ...productOptions, quantity: clampQty(productOptions.quantity - 1) })}
                      sx={{ 
                        color: 'var(--text-muted)', 
                        p: 1.5, 
                        borderRadius: 0,
                        '&:hover': { color: '#f87171', bgcolor: 'rgba(239,68,68,0.1)' },
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <Minus size={20} />
                    </IconButton>
                    <Typography sx={{ 
                      color: 'var(--foreground)', 
                      minWidth: 56, 
                      textAlign: 'center',
                      fontWeight: 800,
                      fontSize: '1.2rem',
                      borderLeft: '1px solid var(--glass-border)',
                      borderRight: '1px solid var(--glass-border)',
                      py: 0.5,
                    }}>
                      {productOptions.quantity}
                    </Typography>
                    <IconButton
                      onClick={() => setProductOptions({ ...productOptions, quantity: clampQty(productOptions.quantity + 1) })}
                      sx={{ 
                        color: 'var(--text-muted)', 
                        p: 1.5, 
                        borderRadius: 0,
                        '&:hover': { color: 'var(--success)', bgcolor: 'rgba(16,185,129,0.1)' },
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <Plus size={20} />
                    </IconButton>
                  </Box>
                </Box>
              </Box>
            </Box>

            {/* Desktop Price Summary & Action Buttons */}
            {!isMobile && (
              <Box sx={{
                mt: 3,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                opacity: needsPatternFirst ? 0.5 : 1,
                pointerEvents: needsPatternFirst ? 'none' : 'auto',
                transition: 'all 0.3s ease',
              }}>
                {/* Price Summary Card */}
                <Box sx={{
                  p: 2.5,
                  borderRadius: '18px',
                  background: 'linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(16,185,129,0.05) 100%)',
                  border: '1px solid rgba(16,185,129,0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  position: 'relative',
                  overflow: 'hidden',
                }}>
                  <Box sx={{
                    position: 'absolute',
                    top: -20,
                    right: -20,
                    width: 100,
                    height: 100,
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(16,185,129,0.2) 0%, transparent 70%)',
                    pointerEvents: 'none',
                  }} />
                  <Box sx={{ position: 'relative', zIndex: 1 }}>
                    <Typography sx={{ fontSize: '0.78rem', color: 'var(--success)', fontWeight: 600, mb: 0.3 }}>{t.product.totalPrice}</Typography>
                    <Typography sx={{ 
                      fontSize: '1.75rem', 
                      fontWeight: 900, 
                      color: 'var(--success)',
                      lineHeight: 1,
                    }}>
                      ฿{getCurrentPrice().toLocaleString()}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right', position: 'relative', zIndex: 1 }}>
                    <Box sx={{
                      px: 1.5,
                      py: 0.5,
                      borderRadius: '10px',
                      bgcolor: 'var(--surface)',
                      border: '1px solid var(--glass-border)',
                      mb: 0.5,
                    }}>
                      <Typography sx={{ fontSize: '0.85rem', color: 'var(--foreground)', fontWeight: 700 }}>
                        {productOptions.size || '-'} × {productOptions.quantity}
                      </Typography>
                    </Box>
                    {productOptions.isLongSleeve && selectedProduct && (
                      <Typography sx={{ fontSize: '0.72rem', color: 'var(--warning)', fontWeight: 600 }}>+ {t.common.longSleeve} ฿{selectedProduct.options?.longSleevePrice ?? 50}</Typography>
                    )}
                  </Box>
                </Box>

                {/* Action Buttons */}
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                  <Button
                    onClick={handleAddToCart}
                    disabled={!isDialogShopOpen}
                    startIcon={<ShoppingCart size={20} />}
                    sx={{
                      flex: 1,
                      py: 1.6,
                      borderRadius: '16px',
                      background: isDialogShopOpen 
                        ? 'rgba(0,122,255,0.08)'
                        : 'var(--surface-2)',
                      border: 'none',
                      color: isDialogShopOpen ? 'var(--primary)' : '#86868b',
                      fontSize: '0.95rem',
                      fontWeight: 700,
                      textTransform: 'none',
                      boxShadow: 'none',
                      transition: 'all 0.25s ease',
                      '&:hover': { 
                        background: isDialogShopOpen ? 'rgba(0,122,255,0.12)' : 'var(--surface-2)',
                        transform: isDialogShopOpen ? 'scale(0.98)' : 'none',
                      },
                      '&:disabled': { color: 'var(--text-muted)' },
                    }}
                  >
                    {t.product.addToCart}
                  </Button>
                  <Button
                    onClick={handleBuyNow}
                    disabled={!isDialogShopOpen}
                    startIcon={<Zap size={20} />}
                    sx={{
                      flex: 1.3,
                      py: 1.6,
                      borderRadius: '16px',
                      background: isDialogShopOpen 
                        ? 'var(--primary)'
                        : 'var(--surface-2)',
                      color: isDialogShopOpen ? 'white' : '#86868b',
                      fontSize: '0.95rem',
                      fontWeight: 800,
                      textTransform: 'none',
                      boxShadow: 'none',
                      transition: 'all 0.25s ease',
                      '&:hover': {
                        background: isDialogShopOpen 
                          ? '#0062cc' 
                          : 'var(--surface-2)',
                        transform: isDialogShopOpen ? 'scale(0.98)' : 'none',
                      },
                      '&:disabled': { background: 'var(--surface-2)', color: 'var(--text-muted)' },
                    }}
                  >
                    {t.product.buyNow}
                  </Button>
                </Box>

                {/* Bulk Order Button */}
                {selectedProduct && productRequiresSize(selectedProduct) && selectedProduct.options?.hasCustomName && isDialogShopOpen && (
                  <Button
                    onClick={openBulkOrder}
                    startIcon={<Users size={18} />}
                    fullWidth
                    sx={{
                      py: 1.2,
                      borderRadius: '14px',
                      background: 'linear-gradient(135deg, rgba(168,85,247,0.15) 0%, rgba(139,92,246,0.1) 100%)',
                      border: '1px solid rgba(168,85,247,0.35)',
                      color: '#a855f7',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      textTransform: 'none',
                      transition: 'all 0.25s ease',
                      '&:hover': { 
                        background: 'linear-gradient(135deg, rgba(168,85,247,0.25) 0%, rgba(139,92,246,0.2) 100%)',
                        transform: 'translateY(-1px)',
                        boxShadow: '0 4px 20px rgba(168,85,247,0.2)',
                      },
                    }}
                  >
                    {t.bulkOrder.buttonLabel} — {t.bulkOrder.subtitle}
                  </Button>
                )}
              </Box>
            )}
          </Box>
        </Box>
      </Box>

      {/* Bottom Actions - Collapsible (Mobile Only) */}
      {isMobile && (
        <Box sx={{
          px: { xs: 2.5, sm: 3 },
          py: bottomPanelCollapsed ? 1.5 : 2.5,
          borderTop: '1px solid var(--glass-border)',
          background: (theme: any) => theme.palette.mode === 'dark' 
            ? 'linear-gradient(180deg, rgba(0,0,0,0.98) 0%, rgba(0,0,0,0.99) 100%)' 
            : 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.99) 100%)',
          backdropFilter: 'blur(24px)',
          paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
          transition: 'padding 0.3s ease',
        }}>
          {/* Collapse Toggle Handle */}
          <Box 
            onClick={() => setBottomPanelCollapsed(!bottomPanelCollapsed)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              mb: bottomPanelCollapsed ? 1 : 1.5,
              py: 0.3,
              mx: 'auto',
              userSelect: 'none',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              px: 2,
              py: 0.3,
              borderRadius: '12px',
              bgcolor: 'rgba(0,113,227,0.08)',
              border: '1px solid rgba(0,113,227,0.15)',
              transition: 'all 0.2s ease',
              '&:hover': { bgcolor: 'rgba(0,113,227,0.15)' },
            }}>
              {bottomPanelCollapsed ? <ChevronUp size={14} color="#2997ff" /> : <ChevronDown size={14} color="#2997ff" />}
              <Typography sx={{ fontSize: '0.65rem', color: '#2997ff', fontWeight: 600 }}>
                {bottomPanelCollapsed ? 'แสดงรายละเอียด' : 'ย่อลง'}
              </Typography>
            </Box>
          </Box>

          {/* Collapsed: Compact price row */}
          {bottomPanelCollapsed && (
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              mb: 1.5,
              px: 1,
            }}>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                <Typography sx={{ fontSize: '1.3rem', fontWeight: 900, color: 'var(--success)', lineHeight: 1 }}>
                  ฿{getCurrentPrice().toLocaleString()}
                </Typography>
                <Typography sx={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  {productOptions.size} × {productOptions.quantity}
                </Typography>
              </Box>
              {productOptions.isLongSleeve && selectedProduct && (
                <Typography sx={{ fontSize: '0.68rem', color: 'var(--warning)', fontWeight: 600 }}>+ {t.common.longSleeve}</Typography>
              )}
            </Box>
          )}

          {/* Expandable Section: Price Summary + Reviews + Stock */}
          <Box sx={{
            maxHeight: bottomPanelCollapsed ? 0 : 600,
            overflow: 'hidden',
            transition: 'max-height 0.35s ease, opacity 0.25s ease',
            opacity: bottomPanelCollapsed ? 0 : 1,
          }}>
            {/* Price Summary - Enhanced */}
            <Box sx={{
              p: 2.5,
              mb: 2.5,
              borderRadius: '18px',
              background: 'var(--surface-2)',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              position: 'relative',
              overflow: 'hidden',
            }}>
              <Box sx={{ position: 'relative', zIndex: 1 }}>
                <Typography sx={{ fontSize: '0.78rem', color: 'var(--success)', fontWeight: 600, mb: 0.3 }}>
                  {t.product.totalPrice}
                  {(() => {
                    const d = getEventDiscount(selectedProduct.id, activeProductCatalog.events);
                    return d ? <Typography component="span" sx={{ fontSize: '0.68rem', color: '#ff453a', fontWeight: 700, ml: 0.5 }}>({d.discountLabel} {d.eventTitle})</Typography> : null;
                  })()}
                </Typography>
                <Typography sx={{ 
                  fontSize: '1.75rem', 
                  fontWeight: 900, 
                  color: 'var(--success)',
                  lineHeight: 1,
                  textShadow: '0 2px 12px rgba(16,185,129,0.3)',
                }}>
                  ฿{getCurrentPrice().toLocaleString()}
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'right', position: 'relative', zIndex: 1 }}>
                <Box sx={{
                  px: 1.5,
                  py: 0.5,
                  borderRadius: '10px',
                  bgcolor: 'var(--glass-bg)',
                  border: '1px solid var(--glass-border)',
                  mb: 0.5,
                }}>
                  <Typography sx={{ fontSize: '0.85rem', color: 'var(--foreground)', fontWeight: 700 }}>
                    {productOptions.size} × {productOptions.quantity}
                  </Typography>
                </Box>
                {productOptions.isLongSleeve && selectedProduct && (
                  <Typography sx={{ fontSize: '0.72rem', color: 'var(--warning)', fontWeight: 600 }}>+ {t.common.longSleeve} ฿{selectedProduct.options?.longSleevePrice ?? 50}</Typography>
                )}
              </Box>
            </Box>

            {/* ===== Product Reviews Section ===== */}
            {selectedProduct && (
              <Box sx={{ mt: 2, mb: 0.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Star size={16} color="#ff9f0a" fill="#ff9f0a" />
                    <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--foreground)' }}>
                      {t.reviews.title}
                    </Typography>
                    {(() => {
                      const reviews = productReviews[selectedProduct.id] || [];
                      if (reviews.length === 0) return null;
                      const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
                      return (
                        <Chip
                          label={`${avg.toFixed(1)} (${reviews.length})`}
                          size="small"
                          sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700, bgcolor: 'rgba(255,159,10,0.1)', color: '#ff9f0a' }}
                        />
                      );
                    })()}
                  </Box>
                  <Button
                    size="small"
                    startIcon={<Edit size={14} />}
                    onClick={() => {
                      if (!session) {
                        showToast('warning', t.reviews.loginRequired);
                        return;
                      }
                      setReviewRating(0);
                      setReviewComment('');
                      setReviewDialogOpen(true);
                    }}
                    sx={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'none', color: '#0071e3' }}
                  >
                    {t.reviews.writeReview}
                  </Button>
                </Box>

                {/* Reviews list */}
                {(() => {
                  const reviews = productReviews[selectedProduct.id] || [];
                  if (reviews.length === 0) {
                    return (
                      <Box sx={{ textAlign: 'center', py: 3, borderRadius: '14px', bgcolor: 'var(--surface-2)', border: '1px solid var(--glass-border)' }}>
                        <Star size={32} strokeWidth={1} color="var(--text-muted)" />
                        <Typography sx={{ mt: 1, fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>{t.reviews.noReviews}</Typography>
                        <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)', opacity: 0.7 }}>{t.reviews.beFirst}</Typography>
                      </Box>
                    );
                  }
                  return (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {reviews.slice(0, 3).map((review) => (
                        <Box key={review.id} sx={{ p: 1.5, borderRadius: '12px', bgcolor: 'var(--surface-2)', border: '1px solid var(--glass-border)' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                            <Avatar src={review.userImage} sx={{ width: 24, height: 24, fontSize: '0.65rem' }}>{review.userName[0]}</Avatar>
                            <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--foreground)', flex: 1 }}>{review.userName}</Typography>
                            {review.verified && (
                              <Chip label={t.reviews.verified} size="small" sx={{ height: 18, fontSize: '0.55rem', bgcolor: 'rgba(52,199,89,0.1)', color: '#34c759' }} />
                            )}
                            <Box sx={{ display: 'flex', gap: 0.2 }}>
                              {[1, 2, 3, 4, 5].map((s) => (
                                <Star key={s} size={10} color="#ff9f0a" fill={s <= review.rating ? '#ff9f0a' : 'none'} />
                              ))}
                            </Box>
                            {review.isOwner && (
                              <Box sx={{ display: 'flex', gap: 0.5, ml: 0.5 }}>
                                <IconButton size="small" onClick={() => onEditReview?.(review)} sx={{ p: 0.5 }}>
                                  <Edit size={12} color="var(--text-muted)" />
                                </IconButton>
                                <IconButton size="small" onClick={() => onDeleteReview?.(review.id)} sx={{ p: 0.5 }}>
                                  <Trash2 size={12} color="#ff453a" />
                                </IconButton>
                              </Box>
                            )}
                          </Box>
                          {review.comment && (
                            <Typography sx={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.5, ml: 4.2 }}>{review.comment}</Typography>
                          )}
                        </Box>
                      ))}
                      {reviews.length > 3 && (
                        <Typography sx={{ fontSize: '0.7rem', color: '#0071e3', textAlign: 'center', fontWeight: 600, cursor: 'pointer' }}>
                          + {reviews.length - 3} {t.reviews.totalReviews}
                        </Typography>
                      )}
                    </Box>
                  );
                })()}
              </Box>
            )}

            {/* Stock / Inventory indicator */}
            {selectedProduct?.stock != null && (
              <Box sx={{ 
                mt: 1, mb: 1, px: 1.5, py: 0.8, 
                borderRadius: '12px', 
                bgcolor: selectedProduct.stock <= 0 ? 'rgba(255,69,58,0.08)' : selectedProduct.stock <= 5 ? 'rgba(255,159,10,0.08)' : 'rgba(52,199,89,0.08)',
                border: `1px solid ${selectedProduct.stock <= 0 ? 'rgba(255,69,58,0.2)' : selectedProduct.stock <= 5 ? 'rgba(255,159,10,0.2)' : 'rgba(52,199,89,0.2)'}`,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}>
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: selectedProduct.stock <= 0 ? '#ff453a' : selectedProduct.stock <= 5 ? '#ff9f0a' : '#34c759' }} />
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: selectedProduct.stock <= 0 ? '#ff453a' : selectedProduct.stock <= 5 ? '#ff9f0a' : '#34c759' }}>
                  {selectedProduct.stock <= 0 
                    ? t.inventory.outOfStock 
                    : selectedProduct.stock <= 5 
                      ? `${t.inventory.lowStock} — ${selectedProduct.stock} ${t.inventory.remaining}`
                      : `${t.inventory.inStock} — ${selectedProduct.stock} ${t.inventory.remaining}`
                  }
                </Typography>
              </Box>
            )}
          </Box>

          {/* Action Buttons - Enhanced */}
          <Box sx={{
            display: 'flex',
            gap: 1.5,
            opacity: needsPatternFirst ? 0.5 : 1,
            pointerEvents: needsPatternFirst ? 'none' : 'auto',
            transition: 'all 0.3s ease',
          }}>
            <Button
              onClick={handleAddToCart}
              disabled={!isDialogShopOpen}
              startIcon={<ShoppingCart size={20} />}
              sx={{
                flex: 1,
                py: 1.6,
                borderRadius: '16px',
                background: isDialogShopOpen 
                  ? 'rgba(0,122,255,0.08)'
                  : 'var(--surface-2)',
                border: 'none',
                color: isDialogShopOpen ? 'var(--primary)' : '#86868b',
                fontSize: '0.95rem',
                fontWeight: 700,
                textTransform: 'none',
                boxShadow: 'none',
                transition: 'all 0.25s ease',
                '&:hover': { 
                  background: isDialogShopOpen ? 'rgba(0,122,255,0.12)' : 'var(--surface-2)',
                  transform: isDialogShopOpen ? 'scale(0.98)' : 'none',
                },
                '&:disabled': { color: 'var(--text-muted)' },
              }}
            >
              {t.product.addToCart}
            </Button>
            <Button
              onClick={handleBuyNow}
              disabled={!isDialogShopOpen}
              startIcon={<Zap size={20} />}
              sx={{
                flex: 1.3,
                py: 1.6,
                borderRadius: '16px',
                background: isDialogShopOpen 
                  ? 'var(--primary)'
                  : 'var(--surface-2)',
                color: isDialogShopOpen ? 'white' : '#86868b',
                fontSize: '0.95rem',
                fontWeight: 800,
                textTransform: 'none',
                boxShadow: 'none',
                transition: 'all 0.25s ease',
                '&:hover': {
                  background: isDialogShopOpen 
                    ? '#0062cc' 
                    : 'var(--surface-2)',
                  transform: isDialogShopOpen ? 'scale(0.98)' : 'none',
                },
                '&:disabled': { background: 'var(--surface-2)', color: 'var(--text-muted)' },
              }}
            >
              {t.product.buyNow}
            </Button>
          </Box>

          {/* Bulk Order Button - only for apparel with sizes & custom names */}
          {selectedProduct && productRequiresSize(selectedProduct) && selectedProduct.options?.hasCustomName && isDialogShopOpen && (
            <Button
              onClick={openBulkOrder}
              startIcon={<Users size={18} />}
              fullWidth
              sx={{
                mt: 1,
                py: 1.2,
                borderRadius: '14px',
                background: 'linear-gradient(135deg, rgba(168,85,247,0.15) 0%, rgba(139,92,246,0.1) 100%)',
                border: '1px solid rgba(168,85,247,0.35)',
                color: '#a855f7',
                fontSize: '0.85rem',
                fontWeight: 700,
                textTransform: 'none',
                transition: 'all 0.25s ease',
                '&:hover': { 
                  background: 'linear-gradient(135deg, rgba(168,85,247,0.25) 0%, rgba(139,92,246,0.2) 100%)',
                  transform: 'translateY(-1px)',
                  boxShadow: '0 4px 20px rgba(168,85,247,0.2)',
                },
              }}
            >
              {t.bulkOrder.buttonLabel} — {t.bulkOrder.subtitle}
            </Button>
          )}
        </Box>
      )}
    </Box>
  );

  if (isMobile) {
    return (
      <>
        <Drawer
          anchor="bottom"
          open={productDialogOpen}
          onClose={resetProductDialog}
          PaperProps={{
            sx: {
              height: '95vh',
              maxHeight: '95vh',
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              bgcolor: 'var(--background)',
              overflow: 'hidden',
              boxShadow: (theme: any) => theme.palette.mode === 'dark' ? '0 -10px 60px rgba(0,0,0,0.5), 0 -4px 20px rgba(0,113,227,0.15)' : '0 -10px 60px rgba(0,0,0,0.1), 0 -4px 20px rgba(0,113,227,0.08)',
            },
          }}
          transitionDuration={{ enter: 350, exit: 250 }}
          sx={{ zIndex: 8000 }}
        >
          {productContent}
        </Drawer>

        {/* Lightbox Dialog (Mobile) */}
        <Dialog
          open={!!lightboxImage}
          onClose={() => { setLightboxImage(null); setLightboxImages([]); }}
          maxWidth={false}
          fullScreen
          PaperProps={{
            sx: {
              background: 'rgba(0,0,0,0.97)',
              boxShadow: 'none',
            }
          }}
          sx={{
            zIndex: 99999,
            '& .MuiDialog-container': {
              alignItems: 'center',
              justifyContent: 'center',
            },
          }}
        >
          <IconButton
            onClick={() => { setLightboxImage(null); setLightboxImages([]); }}
            sx={{
              position: 'absolute',
              top: 12,
              right: 12,
              color: 'white',
              bgcolor: 'rgba(255,255,255,0.12)',
              backdropFilter: 'blur(8px)',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' },
              zIndex: 10,
              width: 44,
              height: 44,
            }}
          >
            <X size={24} />
          </IconButton>
          {lightboxImage && (
            <Box sx={{ display: 'flex', alignItems: 'center', justifycontent: 'center', justifyContent: 'center', width: '100%', height: '100%', p: 2 }}>
              <Box
                component="img"
                src={lightboxImages.length > 1 ? lightboxImages[lightboxIndex] : lightboxImage}
                alt="Full size"
                sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '8px', userSelect: 'none' }}
              />
            </Box>
          )}
          {lightboxImages.length > 1 && (
            <Box sx={{
              position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
              display: 'flex', gap: 1, px: 2, py: 1, borderRadius: '16px',
              bgcolor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)',
              maxWidth: '90vw', overflowX: 'auto',
            }}>
              {lightboxImages.map((img, idx) => (
                <Box
                  key={idx}
                  onClick={() => setLightboxIndex(idx)}
                  sx={{
                    width: 48, height: 48, borderRadius: '10px',
                    border: lightboxIndex === idx ? '2px solid white' : '2px solid transparent',
                    overflow: 'hidden', cursor: 'pointer',
                    opacity: lightboxIndex === idx ? 1 : 0.5,
                    transition: 'all 0.2s ease', flexShrink: 0,
                    '&:hover': { opacity: 1 },
                  }}
                >
                  <Box component="img" src={img} alt={`Thumbnail ${idx + 1}`} sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </Box>
              ))}
            </Box>
          )}
        </Dialog>
      </>
    );
  }

  return (
    <>
      <Drawer
        anchor="right"
        open={productDialogOpen}
        onClose={resetProductDialog}
        PaperProps={{
          sx: {
            width: '100%',
            maxWidth: '100%',
            height: '100%',
            maxHeight: '100%',
            bgcolor: 'var(--background)',
            overflow: 'hidden',
            boxShadow: (theme: any) => theme.palette.mode === 'dark' ? '-10px 0 60px rgba(0,0,0,0.5), -4px 0 20px rgba(0,113,227,0.15)' : '-10px 0 60px rgba(0,0,0,0.1), -4px 0 20px rgba(0,113,227,0.08)',
          },
        }}
        transitionDuration={{ enter: 300, exit: 200 }}
        sx={{ zIndex: 8000 }}
      >
        {productContent}
      </Drawer>

      {/* Lightbox Dialog (Desktop) */}
      <Dialog
        open={!!lightboxImage}
        onClose={() => { setLightboxImage(null); setLightboxImages([]); }}
        maxWidth={false}
        fullScreen
        PaperProps={{
          sx: {
            background: 'rgba(0,0,0,0.97)',
            boxShadow: 'none',
          }
        }}
        sx={{
          zIndex: 99999,
          '& .MuiDialog-container': {
            alignItems: 'center',
            justifyContent: 'center',
          },
        }}
      >
        <IconButton
          onClick={() => { setLightboxImage(null); setLightboxImages([]); }}
          sx={{
            position: 'absolute',
            top: 16,
            right: 16,
            color: 'white',
            bgcolor: 'rgba(255,255,255,0.12)',
            backdropFilter: 'blur(8px)',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' },
            zIndex: 10,
            width: 44,
            height: 44,
          }}
        >
          <X size={24} />
        </IconButton>
        {lightboxImages.length > 1 && (
          <>
            <IconButton
              onClick={() => setLightboxIndex((prev) => (prev - 1 + lightboxImages.length) % lightboxImages.length)}
              sx={{
                position: 'absolute', top: '50%', left: 24,
                transform: 'translateY(-50%)',
                bgcolor: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)',
                color: 'white', zIndex: 10,
                width: 48, height: 48,
                '&:hover': { bgcolor: 'rgba(255,255,255,0.2)', transform: 'translateY(-50%) scale(1.05)' },
                transition: 'all 0.2s ease',
              }}
            >
              <ChevronLeft size={24} />
            </IconButton>
            <IconButton
              onClick={() => setLightboxIndex((prev) => (prev + 1) % lightboxImages.length)}
              sx={{
                position: 'absolute', top: '50%', right: 24,
                transform: 'translateY(-50%)',
                bgcolor: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)',
                color: 'white', zIndex: 10,
                width: 48, height: 48,
                '&:hover': { bgcolor: 'rgba(255,255,255,0.2)', transform: 'translateY(-50%) scale(1.05)' },
                transition: 'all 0.2s ease',
              }}
            >
              <ChevronRight size={24} />
            </IconButton>
          </>
        )}
        {lightboxImage && (
          <Box sx={{ display: 'flex', alignItems: 'center', justifycontent: 'center', justifyContent: 'center', width: '100%', height: '100%', p: 4 }}>
            <Box
              component="img"
              src={lightboxImages.length > 1 ? lightboxImages[lightboxIndex] : lightboxImage}
              alt="Full size"
              sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '8px', userSelect: 'none' }}
            />
          </Box>
        )}
        {lightboxImages.length > 1 && (
          <Box sx={{
            position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
            display: 'flex', gap: 1, px: 2, py: 1, borderRadius: '16px',
            bgcolor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)',
            maxWidth: '90vw', overflowX: 'auto',
          }}>
            {lightboxImages.map((img, idx) => (
              <Box
                key={idx}
                onClick={() => setLightboxIndex(idx)}
                sx={{
                  width: 48, height: 48, borderRadius: '10px',
                  border: lightboxIndex === idx ? '2px solid white' : '2px solid transparent',
                  overflow: 'hidden', cursor: 'pointer',
                  opacity: lightboxIndex === idx ? 1 : 0.5,
                  transition: 'all 0.2s ease', flexShrink: 0,
                  '&:hover': { opacity: 1 },
                }}
              >
                <Box component="img" src={img} alt={`Thumbnail ${idx + 1}`} sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </Box>
            ))}
          </Box>
        )}
      </Dialog>
    </>
  );
});
