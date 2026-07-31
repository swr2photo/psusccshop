'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  IconButton,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material';
import {
  AlertTriangle,
  Edit,
  Minus,
  Palette,
  Plus,
  ShoppingBag,
  Tag,
  Ticket,
  Truck,
  X,
} from 'lucide-react';
import OptimizedImage from '@/components/OptimizedImage';
import { useTranslation } from '@/hooks/useTranslation';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import {
  normalizeEngName,
  normalizeDigits99,
  type CartItem,
  getAvailableStock,
} from '@/lib/shop-constants';
import { ShopConfig, Product, SIZES } from '@/lib/config';
import { ShippingConfig } from '@/lib/shipping';
import { evaluateReorderItem, type ReorderBlockReason } from '@/lib/reorder-availability';
import { apiFetch } from '@/lib/api-client';

export type CartPromoResult = {
  code: string;
  discount: number;
  description?: string;
};

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  cart: CartItem[];
  config: ShopConfig | null;
  shippingConfig?: ShippingConfig | null;
  isShopOpen: boolean;
  onClearCart: () => void;
  onUpdateQuantity: (itemId: string, quantity: number, maxLimit?: number | null) => void;
  onRemoveItem: (itemId: string) => void;
  onEditItem: (item: CartItem) => void;
  onCheckout: (promo?: CartPromoResult) => void;
  onStartHold: (itemId: string, direction: number, maxLimit?: number | null) => void;
  onStopHold: (itemId: string) => void;
  onGoHome: () => void;
  getTotalPrice: () => number;
  /** Resolve live product for a cart line (multi-shop / storefront). Falls back to config.products. */
  getProduct?: (item: CartItem) => Product | undefined;
  /** Multi-shop: validate promo codes against this shop's config */
  shopId?: string;
  // Edit dialog props
  editingCartItem: CartItem | null;
  onSetEditingCartItem: (item: CartItem | null) => void;
  onUpdateCartItem: (itemId: string, item: CartItem) => void;
  now: Date;
}

function lineIssueMessage(reason: ReorderBlockReason | undefined, lang: 'th' | 'en'): string {
  if (lang === 'en') {
    switch (reason) {
      case 'ended':
        return 'This product’s order window has ended. Please remove it to continue.';
      case 'out_of_stock':
        return 'This product is sold out. Please remove it to continue.';
      case 'upcoming':
        return 'This product is not on sale yet. Please remove it to continue.';
      case 'inactive':
      case 'missing':
      default:
        return 'This product is no longer available. Please remove it to continue.';
    }
  }
  switch (reason) {
    case 'ended':
      return 'สินค้านี้หมดเขตสั่งซื้อแล้ว กรุณาลบออกเพื่อดำเนินการต่อ';
    case 'out_of_stock':
      return 'สินค้านี้หมดสต็อกแล้ว กรุณาลบออกเพื่อดำเนินการต่อ';
    case 'upcoming':
      return 'สินค้านี้ยังไม่เปิดขาย กรุณาลบออกเพื่อดำเนินการต่อ';
    case 'inactive':
    case 'missing':
    default:
      return 'สินค้านี้ไม่พร้อมจำหน่ายแล้ว กรุณาลบออกเพื่อดำเนินการต่อ';
  }
}

export default function CartDrawer(props: CartDrawerProps) {
  const {
    open,
    onClose,
    cart,
    config,
    shippingConfig,
    isShopOpen,
    onClearCart,
    onUpdateQuantity,
    onRemoveItem,
    onEditItem,
    onCheckout,
    onStartHold,
    onStopHold,
    onGoHome,
    getTotalPrice,
    getProduct,
    shopId,
    editingCartItem,
    onSetEditingCartItem,
    onUpdateCartItem,
    now,
  } = props;

  const { t, lang } = useTranslation();
  const { confirm: showConfirm, ConfirmDialog } = useConfirmDialog();
  const isMobile = useMediaQuery('(max-width:640px)');

  // Swipe-to-dismiss state
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const swipeStartY = useRef(0);

  // Promo state
  const [promoInput, setPromoInput] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState('');
  const [promoResult, setPromoResult] = useState<CartPromoResult | null>(null);

  const resolveProduct = useCallback(
    (item: CartItem): Product | undefined => {
      if (getProduct) return getProduct(item);
      return config?.products?.find((p) => p.id === item.productId);
    },
    [getProduct, config?.products],
  );

  const lineIssues = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of cart) {
      const product = resolveProduct(item);
      const products = product ? [product] : (config?.products || []);
      const evalResult = evaluateReorderItem(
        {
          productId: item.productId,
          size: item.size,
          quantity: item.quantity,
          name: item.productName,
          productName: item.productName,
        },
        products,
        lang,
        now
      );
      if (!evalResult.ok) {
        map.set(item.id, lineIssueMessage(evalResult.reason, lang));
      }
    }
    return map;
  }, [cart, resolveProduct, config?.products, lang, now]);

  const hasInvalidLines = lineIssues.size > 0;
  const canCheckout = isShopOpen && !hasInvalidLines;

  const handleSwipeStart = useCallback((e: React.TouchEvent) => {
    swipeStartY.current = e.touches[0].clientY;
    setIsDragging(true);
  }, []);

  const handleSwipeMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;
    const delta = e.touches[0].clientY - swipeStartY.current;
    if (delta < 0) { setDragOffset(0); return; }
    setDragOffset(delta > 80 ? 80 + (delta - 80) * 0.3 : delta);
  }, [isDragging]);

  const handleSwipeEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    if (dragOffset >= 80) {
      setDragOffset(window.innerHeight);
      setTimeout(() => { onClose(); setDragOffset(0); }, 200);
    } else {
      setDragOffset(0);
    }
  }, [isDragging, dragOffset, onClose]);

  React.useEffect(() => {
    if (!open) {
      setDragOffset(0);
      setIsDragging(false);
    }
  }, [open]);

  const cartTotal = getTotalPrice();
  const appliedPromoCodeRef = useRef<string | null>(null);
  appliedPromoCodeRef.current = promoResult?.code ?? null;

  // Re-validate applied promo when cart subtotal changes
  React.useEffect(() => {
    const code = appliedPromoCodeRef.current;
    if (!code) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch('/api/promo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code,
            subtotal: cartTotal,
            ...(shopId ? { shopId } : {}),
          }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (res.ok && data.valid) {
          setPromoResult({
            code: data.code,
            discount: data.discount,
            description: data.description,
          });
          setPromoError('');
        } else {
          setPromoResult(null);
          setPromoError(data.error || t.checkout.invalidCode);
        }
      } catch {
        // Keep existing promo; checkout will re-validate
      }
    })();
    return () => { cancelled = true; };
  }, [cartTotal, shopId, t.checkout.invalidCode]);

  const applyPromoCode = async () => {
    if (!promoInput.trim()) return;
    setPromoLoading(true);
    setPromoError('');
    try {
      const res = await apiFetch('/api/promo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: promoInput.trim(),
          subtotal: cartTotal,
          ...(shopId ? { shopId } : {}),
        }),
      });
      const data = await res.json();
      if (res.ok && data.valid) {
        setPromoResult({
          code: data.code,
          discount: data.discount,
          description: data.description,
        });
        setPromoError('');
      } else {
        setPromoResult(null);
        setPromoError(data.error || t.checkout.invalidCode);
      }
    } catch {
      setPromoError(t.checkout.cannotVerifyCode);
      setPromoResult(null);
    } finally {
      setPromoLoading(false);
    }
  };

  const clearPromo = () => {
    setPromoInput('');
    setPromoResult(null);
    setPromoError('');
  };

  // Shipping / free-shipping progress
  const enabledShippingOptions = shippingConfig?.options?.filter((o) => o.enabled) || [];
  const freeShippingMinimum = shippingConfig?.globalFreeShippingMinimum
    || (enabledShippingOptions.find((o) => o.freeShippingMinimum)?.freeShippingMinimum);
  const remainingForFreeShipping = freeShippingMinimum ? Math.max(0, freeShippingMinimum - cartTotal) : null;
  const hasFreeShipping = Boolean(freeShippingMinimum && cartTotal >= freeShippingMinimum);
  const promoDiscount = promoResult?.discount || 0;
  const displayTotal = Math.max(0, cartTotal - promoDiscount);

  return (
    <>
      <Drawer
        anchor={isMobile ? 'bottom' : 'right'}
        open={open}
        onClose={onClose}
        PaperProps={{
          sx: {
            // Prefer dvh/svh so iPad Safari chrome + home indicator don't clip the CTA
            height: isMobile ? { xs: '90dvh', sm: '80dvh' } : '100dvh',
            maxHeight: isMobile ? '90dvh' : '100svh',
            '@supports not (height: 100dvh)': {
              height: isMobile ? { xs: '90vh', sm: '80vh' } : '100vh',
              maxHeight: isMobile ? '90vh' : '100vh',
            },
            width: isMobile ? '100%' : { xs: '100%', sm: '420px' },
            maxWidth: '100vw',
            boxSizing: 'border-box',
            borderTopLeftRadius: isMobile ? 12 : 0,
            borderTopRightRadius: isMobile ? 12 : 0,
            borderBottomLeftRadius: 0,
            bgcolor: 'var(--background)',
            color: 'var(--foreground)',
            boxShadow: isMobile ? '0 -4px 24px rgba(0,0,0,0.08)' : '-4px 0 24px rgba(0,0,0,0.08)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            transform: isMobile && dragOffset > 0 ? `translateY(${dragOffset}px) !important` : undefined,
            transition: isDragging ? 'none !important' : 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1) !important',
          },
        }}
      >
        {/* Header — PCD-style: uppercase title, thin close */}
        <Box sx={{
          px: { xs: 2.5, sm: 3 },
          pt: isMobile ? 0.5 : 2,
          pb: 1.75,
          borderBottom: '1px solid color-mix(in srgb, var(--foreground) 10%, transparent)',
          bgcolor: 'var(--background)',
          position: 'sticky',
          top: 0,
          zIndex: 10,
          flexShrink: 0,
        }}>
          {isMobile && (
            <Box
              onTouchStart={handleSwipeStart}
              onTouchMove={handleSwipeMove}
              onTouchEnd={handleSwipeEnd}
              sx={{ width: '100%', display: 'flex', justifyContent: 'center', py: 0.75, cursor: 'grab', touchAction: 'none' }}
            >
              <Box sx={{
                width: isDragging ? 48 : 36,
                height: 3,
                bgcolor: isDragging ? 'var(--text-muted)' : 'color-mix(in srgb, var(--foreground) 18%, transparent)',
                borderRadius: 2,
                transition: 'all 0.2s ease',
              }} />
            </Box>
          )}

          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
            <Box sx={{ minWidth: 0, pt: 0.25 }}>
              <Typography sx={{
                fontSize: '0.95rem',
                fontWeight: 700,
                color: 'var(--foreground)',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                lineHeight: 1.3,
              }}>
                {t.cart.title}
              </Typography>
              {cart.length > 0 && (
                <Typography sx={{
                  mt: 0.35,
                  fontSize: '0.72rem',
                  color: 'var(--text-muted)',
                  letterSpacing: '0.04em',
                }}>
                  {cart.length} {t.common.items} · {cart.reduce((sum, item) => sum + item.quantity, 0)} {t.common.pieces}
                </Typography>
              )}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, flexShrink: 0 }}>
              {cart.length > 0 && (
                <Button
                  size="small"
                  onClick={async () => {
                    const ok = await showConfirm({
                      title: t.cart.clearAllConfirm,
                      message: lang === 'en'
                        ? 'Are you sure you want to remove all items from your cart?'
                        : 'คุณแน่ใจหรือไม่ว่าต้องการนำสินค้าทั้งหมดออกจากตะกร้าของคุณ?',
                      variant: 'warning',
                      confirmText: t.cart.clearAll || (lang === 'en' ? 'Clear All' : 'ล้างทั้งหมด'),
                      cancelText: t.common.cancel || (lang === 'en' ? 'Cancel' : 'ยกเลิก'),
                      destructive: true,
                    });
                    if (ok) {
                      clearPromo();
                      onClearCart();
                    }
                  }}
                  sx={{
                    color: 'var(--text-muted)',
                    fontSize: '0.68rem',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    fontWeight: 600,
                    minWidth: 0,
                    px: 1,
                    '&:hover': { color: 'var(--foreground)', bgcolor: 'transparent' },
                  }}
                >
                  {t.cart.clearAll}
                </Button>
              )}
              <IconButton
                onClick={onClose}
                aria-label="Close cart"
                sx={{
                  color: 'var(--foreground)',
                  p: 0.75,
                  '&:hover': { bgcolor: 'transparent', opacity: 0.65 },
                }}
              >
                <X size={20} strokeWidth={1.5} />
              </IconButton>
            </Box>
          </Box>
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, overflow: 'auto', WebkitOverflowScrolling: 'touch', minHeight: 0 }}>
          {cart.length === 0 ? (
            <Box sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              px: 3,
              py: { xs: 8, sm: 10 },
              textAlign: 'center',
              minHeight: '100%',
            }}>
              <ShoppingBag
                size={72}
                strokeWidth={1}
                style={{ color: 'var(--foreground)', marginBottom: 20, opacity: 0.9 }}
              />
              <Typography sx={{
                color: 'var(--foreground)',
                fontSize: '1.05rem',
                fontWeight: 700,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                mb: 1.5,
              }}>
                {t.cart.empty}
              </Typography>
              <Typography sx={{
                color: 'var(--text-muted)',
                fontSize: '0.85rem',
                lineHeight: 1.65,
                maxWidth: 300,
                mb: 3,
              }}>
                {t.cart.emptyDesc}
              </Typography>
              <Button
                onClick={onGoHome}
                sx={{
                  px: 3.5,
                  py: 1.25,
                  minHeight: 44,
                  borderRadius: '4px',
                  bgcolor: 'var(--primary)',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  boxShadow: 'none',
                  '&:hover': { bgcolor: 'var(--primary)', filter: 'brightness(0.92)', boxShadow: 'none' },
                }}
              >
                {t.cart.returnToShop}
              </Button>
            </Box>
          ) : (
            <Box sx={{ px: { xs: 2.5, sm: 3 }, py: 0 }}>
              {cart.map((item) => {
                const product = resolveProduct(item);
                const issue = lineIssues.get(item.id);
                const variantId = item.options?.variantId || (item as any).selectedVariant?.id;
                const itemStockLimit = product ? getAvailableStock(product, variantId) : null;
                const atStockLimit = itemStockLimit !== null && item.quantity >= itemStockLimit;
                return (
                  <Box
                    key={item.id}
                    sx={{
                      py: 2.25,
                      borderBottom: '1px solid color-mix(in srgb, var(--foreground) 10%, transparent)',
                      opacity: issue ? 0.85 : 1,
                    }}
                  >
                    <Box sx={{ display: 'flex', gap: 2 }}>
                      {product?.images?.[0] && (
                        <Box sx={{
                          width: 88,
                          height: 88,
                          borderRadius: '2px',
                          overflow: 'hidden',
                          flexShrink: 0,
                          bgcolor: 'var(--surface)',
                          opacity: issue ? 0.65 : 1,
                        }}>
                          <OptimizedImage
                            src={product.images[0]}
                            alt={item.productName}
                            width={88}
                            height={88}
                            objectFit="cover"
                            placeholder="skeleton"
                          />
                        </Box>
                      )}

                      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, mb: 0.5 }}>
                          <Typography sx={{
                            fontSize: '0.9rem',
                            fontWeight: 600,
                            color: 'var(--foreground)',
                            lineHeight: 1.35,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                          }}>
                            {item.productName}
                          </Typography>
                          <Typography sx={{
                            fontSize: '0.9rem',
                            fontWeight: 700,
                            color: 'var(--foreground)',
                            flexShrink: 0,
                            whiteSpace: 'nowrap',
                          }}>
                            ฿{(item.unitPrice * item.quantity).toLocaleString()}
                          </Typography>
                        </Box>

                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1.25 }}>
                          <Typography sx={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {item.size}
                          </Typography>
                          {item.options?.isLongSleeve && (
                            <Typography sx={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              · {t.common.longSleeve}
                            </Typography>
                          )}
                          {item.options?.customName && (
                            <Typography sx={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              · {item.options.customName}
                            </Typography>
                          )}
                          {item.options?.customNumber && (
                            <Typography sx={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              · #{item.options.customNumber}
                            </Typography>
                          )}
                          {item.options?.pattern && (
                            <Typography sx={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              · {item.options.pattern}
                            </Typography>
                          )}
                        </Box>

                        <Typography sx={{ fontSize: '0.72rem', color: 'var(--text-muted)', mb: 1.25 }}>
                          ฿{item.unitPrice.toLocaleString()}
                        </Typography>

                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 'auto' }}>
                          <Box sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            border: '1px solid color-mix(in srgb, var(--foreground) 14%, transparent)',
                            borderRadius: '2px',
                          }}>
                            <IconButton
                              size="small"
                              onClick={() => onUpdateQuantity(item.id, item.quantity - 1, itemStockLimit)}
                              onMouseDown={() => onStartHold(item.id, -1, itemStockLimit)}
                              onMouseUp={() => onStopHold(item.id)}
                              onMouseLeave={() => onStopHold(item.id)}
                              onTouchStart={() => onStartHold(item.id, -1, itemStockLimit)}
                              onTouchEnd={() => onStopHold(item.id)}
                              sx={{ color: 'var(--foreground)', p: 0.7, borderRadius: 0, '&:hover': { bgcolor: 'var(--surface)' } }}
                            >
                              <Minus size={13} strokeWidth={2} />
                            </IconButton>
                            <Typography sx={{
                              color: 'var(--foreground)',
                              minWidth: 32,
                              textAlign: 'center',
                              fontWeight: 600,
                              fontSize: '0.85rem',
                              borderLeft: '1px solid color-mix(in srgb, var(--foreground) 14%, transparent)',
                              borderRight: '1px solid color-mix(in srgb, var(--foreground) 14%, transparent)',
                              py: 0.55,
                            }}>
                              {item.quantity}
                            </Typography>
                            <IconButton
                              size="small"
                              onClick={() => onUpdateQuantity(item.id, item.quantity + 1, itemStockLimit)}
                              onMouseDown={() => !atStockLimit && onStartHold(item.id, 1, itemStockLimit)}
                              onMouseUp={() => onStopHold(item.id)}
                              onMouseLeave={() => onStopHold(item.id)}
                              onTouchStart={() => !atStockLimit && onStartHold(item.id, 1, itemStockLimit)}
                              onTouchEnd={() => onStopHold(item.id)}
                              disabled={atStockLimit}
                              sx={{ 
                                color: 'var(--foreground)', 
                                p: 0.7, 
                                borderRadius: 0, 
                                '&:hover': { bgcolor: 'var(--surface)' },
                                '&.Mui-disabled': { color: 'var(--text-muted)' },
                              }}
                            >
                              <Plus size={13} strokeWidth={2} />
                            </IconButton>
                          </Box>

                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                            <IconButton
                              size="small"
                              onClick={() => onEditItem(item)}
                              aria-label="Edit item"
                              sx={{ color: 'var(--text-muted)', p: 0.6, '&:hover': { color: 'var(--foreground)', bgcolor: 'transparent' } }}
                            >
                              <Edit size={15} strokeWidth={1.75} />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => onRemoveItem(item.id)}
                              aria-label="Remove item"
                              sx={{ color: 'var(--text-muted)', p: 0.6, '&:hover': { color: 'var(--foreground)', bgcolor: 'transparent' } }}
                            >
                              <X size={15} strokeWidth={1.75} />
                            </IconButton>
                          </Box>
                        </Box>
                        {itemStockLimit !== null && (
                          <Typography sx={{ fontSize: '0.68rem', color: atStockLimit ? 'var(--warning, #ff9f0a)' : 'var(--text-muted)', mt: 0.5, textAlign: 'right' }}>
                            {lang === 'en' ? `Stock: ${itemStockLimit}` : `สต็อก: ${itemStockLimit} ชิ้น`}
                          </Typography>
                        )}
                      </Box>
                    </Box>

                    {issue && (
                      <Box sx={{
                        mt: 1.5,
                        display: 'flex',
                        gap: 1,
                        alignItems: 'flex-start',
                      }}>
                        <AlertTriangle size={14} style={{ color: 'var(--text-muted)', marginTop: 2, flexShrink: 0 }} />
                        <Typography sx={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.45, fontWeight: 500 }}>
                          {issue}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                );
              })}

              {/* Promo — flat, hairline bordered */}
              <Box sx={{
                py: 2.5,
                mb: 1,
                borderBottom: '1px solid color-mix(in srgb, var(--foreground) 10%, transparent)',
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.25 }}>
                  <Ticket size={14} strokeWidth={1.75} style={{ color: 'var(--text-muted)' }} />
                  <Typography sx={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: 'var(--foreground)',
                  }}>
                    {t.checkout.promoCode}
                  </Typography>
                </Box>
                {promoResult ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                      <Tag size={14} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--foreground)' }}>
                          {promoResult.code}
                        </Typography>
                        <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {promoResult.description || `-฿${promoResult.discount.toLocaleString()}`}
                        </Typography>
                      </Box>
                    </Box>
                    <IconButton size="small" onClick={clearPromo} sx={{ color: 'var(--text-muted)', '&:hover': { bgcolor: 'transparent', color: 'var(--foreground)' } }}>
                      <X size={16} strokeWidth={1.5} />
                    </IconButton>
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField
                      size="small"
                      fullWidth
                      placeholder={t.checkout.promoPlaceholder}
                      value={promoInput}
                      onChange={(e) => { setPromoInput(e.target.value); setPromoError(''); }}
                      onKeyDown={(e) => e.key === 'Enter' && applyPromoCode()}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          color: 'var(--foreground)',
                          borderRadius: '2px',
                          bgcolor: 'transparent',
                          fontSize: '0.85rem',
                          height: 40,
                        },
                        '& fieldset': { borderColor: 'color-mix(in srgb, var(--foreground) 14%, transparent)' },
                        '&:hover fieldset': { borderColor: 'color-mix(in srgb, var(--foreground) 28%, transparent) !important' },
                        '& .Mui-focused fieldset': { borderColor: 'var(--primary) !important', borderWidth: '1px !important' },
                      }}
                    />
                    <Button
                      onClick={applyPromoCode}
                      disabled={!promoInput.trim() || promoLoading}
                      sx={{
                        px: 2,
                        borderRadius: '2px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        fontWeight: 700,
                        fontSize: '0.72rem',
                        bgcolor: promoInput.trim() ? 'var(--primary)' : 'transparent',
                        border: promoInput.trim()
                          ? '1px solid var(--primary)'
                          : '1px solid color-mix(in srgb, var(--foreground) 14%, transparent)',
                        color: promoInput.trim() ? '#fff' : 'var(--text-muted)',
                        whiteSpace: 'nowrap',
                        minWidth: 80,
                        height: 40,
                        boxShadow: 'none',
                        '&:hover': {
                          bgcolor: promoInput.trim() ? 'var(--primary)' : 'transparent',
                          filter: promoInput.trim() ? 'brightness(0.92)' : 'none',
                          boxShadow: 'none',
                        },
                        '&:disabled': { color: 'var(--text-muted)' },
                      }}
                    >
                      {promoLoading ? <CircularProgress size={16} sx={{ color: 'inherit' }} /> : t.checkout.applyCode}
                    </Button>
                  </Box>
                )}
                {promoError && (
                  <Typography sx={{ mt: 0.8, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {promoError}
                  </Typography>
                )}
              </Box>
            </Box>
          )}
        </Box>

        {/* Sticky bottom: shipping progress + summary + checkout */}
        {cart.length > 0 && (
          <Box sx={{
            px: { xs: 2.5, sm: 3 },
            pt: 2,
            borderTop: '1px solid color-mix(in srgb, var(--foreground) 10%, transparent)',
            bgcolor: 'var(--background)',
            // Extra inset so the CTA stays tappable above iPad home indicator / Safari chrome
            paddingBottom: 'max(20px, calc(env(safe-area-inset-bottom, 0px) + 16px))',
            flexShrink: 0,
            position: 'sticky',
            bottom: 0,
            zIndex: 11,
          }}>
            {/* Shipping / free-shipping progress */}
            <Box sx={{ mb: 1.75 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.85, mb: 0.6 }}>
                <Truck size={14} strokeWidth={1.75} style={{ color: 'var(--text-muted)' }} />
                <Typography sx={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--foreground)',
                }}>
                  {t.cart.shippingFee}
                </Typography>
              </Box>
              {hasFreeShipping ? (
                <Typography sx={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                  {t.cart.freeShippingUnlocked}
                </Typography>
              ) : remainingForFreeShipping != null && remainingForFreeShipping > 0 ? (
                <>
                  <Typography sx={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.45, mb: 0.85 }}>
                    {t.cart.orderMoreForFree.replace('{amount}', remainingForFreeShipping.toLocaleString())}
                  </Typography>
                  <Box sx={{
                    height: 3,
                    borderRadius: 1,
                    bgcolor: 'color-mix(in srgb, var(--foreground) 10%, transparent)',
                    overflow: 'hidden',
                  }}>
                    <Box sx={{
                      height: '100%',
                      width: `${Math.min(100, (cartTotal / (freeShippingMinimum || 1)) * 100)}%`,
                      bgcolor: 'var(--primary)',
                      transition: 'width 0.3s ease',
                    }} />
                  </Box>
                </>
              ) : (
                <Typography sx={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                  {t.cart.shippingNextStep}
                </Typography>
              )}
            </Box>

            {/* Summary rows — flat, no nested cards */}
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.75 }}>
                <Typography sx={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t.cart.subtotal}</Typography>
                <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--foreground)' }}>
                  ฿{cartTotal.toLocaleString()}
                </Typography>
              </Box>
              {promoDiscount > 0 && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.75 }}>
                  <Typography sx={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {t.checkout.discount} ({promoResult?.code})
                  </Typography>
                  <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--foreground)' }}>
                    -฿{promoDiscount.toLocaleString()}
                  </Typography>
                </Box>
              )}
              <Box sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                pt: 1,
                borderTop: '1px solid color-mix(in srgb, var(--foreground) 10%, transparent)',
              }}>
                <Typography sx={{
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--foreground)',
                }}>
                  {t.cart.total}
                </Typography>
                <Typography sx={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--foreground)' }}>
                  ฿{displayTotal.toLocaleString()}
                </Typography>
              </Box>
              <Typography sx={{ fontSize: '0.68rem', color: 'var(--text-muted)', mt: 0.5 }}>
                {t.cart.shippingCalcNote}
              </Typography>
            </Box>

            {hasInvalidLines && (
              <Typography sx={{ fontSize: '0.72rem', color: 'var(--text-muted)', mb: 1.2, textAlign: 'center' }}>
                {t.cart.removeInvalidToCheckout}
              </Typography>
            )}

            <Button
              fullWidth
              onClick={() => onCheckout(promoResult || undefined)}
              disabled={!canCheckout}
              sx={{
                py: { xs: 1.45, sm: 1.55 },
                minHeight: 48,
                borderRadius: '4px',
                bgcolor: canCheckout ? 'var(--primary)' : 'color-mix(in srgb, var(--foreground) 12%, transparent)',
                color: canCheckout ? '#fff' : 'var(--text-muted)',
                fontSize: '0.8rem',
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                boxShadow: 'none',
                '&:hover': {
                  bgcolor: canCheckout ? 'var(--primary)' : 'color-mix(in srgb, var(--foreground) 12%, transparent)',
                  filter: canCheckout ? 'brightness(0.92)' : 'none',
                  boxShadow: 'none',
                },
                '&:disabled': {
                  bgcolor: 'color-mix(in srgb, var(--foreground) 12%, transparent)',
                  color: 'var(--text-muted)',
                },
              }}
            >
              {isShopOpen ? t.cart.checkout : t.cart.shopClosed}
            </Button>
          </Box>
        )}
      </Drawer>

      {/* Edit Cart Item Dialog */}
      <Dialog
        open={!!editingCartItem}
        onClose={() => onSetEditingCartItem(null)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: 'var(--background)',
            color: 'var(--foreground)',
            borderRadius: '20px',
            border: '1px solid var(--glass-border)',
            mx: 2,
          },
        }}
      >
        {editingCartItem && (() => {
          const product = resolveProduct(editingCartItem) || config?.products?.find((p) => p.id === editingCartItem.productId);
          const sizeKeys = product?.sizePricing ? Object.keys(product.sizePricing) : SIZES;
          const displaySizes = sizeKeys.sort((a, b) => {
            const indexA = SIZES.indexOf(a);
            const indexB = SIZES.indexOf(b);
            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;
            return a.localeCompare(b);
          });

          return (
            <>
              <DialogTitle sx={{
                borderBottom: '1px solid var(--glass-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Edit size={20} style={{ color: 'var(--text-muted)' }} />
                  <Typography sx={{ fontWeight: 700 }}>{t.cart.editItem}</Typography>
                </Box>
              </DialogTitle>
              <DialogContent sx={{ pt: 3 }}>
                <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: 'var(--foreground)', mb: 2 }}>
                  {editingCartItem.productName}
                </Typography>

                <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', mb: 1 }}>{t.cart.size}</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
                  {displaySizes.map((size) => {
                    const basePrice = product?.sizePricing?.[size] ?? product?.basePrice ?? editingCartItem.unitPrice;
                    const longSleeveFee = product?.options?.hasLongSleeve && editingCartItem.options?.isLongSleeve
                      ? (product?.options?.longSleevePrice ?? 50)
                      : 0;
                    const active = editingCartItem.size === size;
                    return (
                      <Box
                        key={size}
                        onClick={() => onSetEditingCartItem({
                          ...editingCartItem,
                          size,
                          unitPrice: basePrice + longSleeveFee,
                        })}
                        sx={{
                          px: 2,
                          py: 1,
                          borderRadius: '10px',
                          border: active ? '2px solid var(--foreground)' : '1px solid var(--glass-border)',
                          bgcolor: active ? 'var(--surface)' : 'var(--surface-2)',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          '&:hover': { borderColor: 'var(--foreground)' },
                        }}
                      >
                        <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--foreground)' }}>
                          {size}
                        </Typography>
                      </Box>
                    );
                  })}
                </Box>

                {product?.options?.hasCustomName && (
                  <TextField
                    label={t.cart.customName}
                    fullWidth
                    value={editingCartItem.options?.customName || ''}
                    onChange={(e) => onSetEditingCartItem({
                      ...editingCartItem,
                      options: { ...editingCartItem.options, customName: normalizeEngName(e.target.value) },
                    })}
                    inputProps={{ maxLength: 7 }}
                    sx={{
                      mb: 2,
                      '& .MuiOutlinedInput-root': { color: 'var(--foreground)', borderRadius: '12px' },
                      '& fieldset': { borderColor: 'var(--glass-border)' },
                      '& label': { color: 'var(--text-muted)' },
                    }}
                  />
                )}

                {product?.options?.hasCustomNumber && (
                  <TextField
                    label={t.cart.customNumber}
                    fullWidth
                    value={editingCartItem.options?.customNumber || ''}
                    onChange={(e) => onSetEditingCartItem({
                      ...editingCartItem,
                      options: { ...editingCartItem.options, customNumber: normalizeDigits99(e.target.value) },
                    })}
                    inputProps={{ inputMode: 'numeric' }}
                    sx={{
                      mb: 2,
                      '& .MuiOutlinedInput-root': { color: 'var(--foreground)', borderRadius: '12px' },
                      '& fieldset': { borderColor: 'var(--glass-border)' },
                      '& label': { color: 'var(--text-muted)' },
                    }}
                  />
                )}

                {product?.options?.hasLongSleeve && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 3 }}>
                    <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                      {lang === 'en' ? 'Sleeve Option' : 'ตัวเลือกความยาวแขนเสื้อ'}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                      <Box
                        onClick={() => {
                          const basePrice = product?.sizePricing?.[editingCartItem.size || ''] ?? product?.basePrice ?? editingCartItem.unitPrice;
                          onSetEditingCartItem({
                            ...editingCartItem,
                            options: { ...editingCartItem.options, isLongSleeve: false },
                            unitPrice: basePrice,
                          });
                        }}
                        sx={{
                          flex: 1,
                          p: 1.5,
                          borderRadius: '10px',
                          border: !editingCartItem.options?.isLongSleeve ? '2px solid var(--foreground)' : '1px solid var(--glass-border)',
                          bgcolor: !editingCartItem.options?.isLongSleeve ? 'var(--surface)' : 'var(--surface-2)',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.2s',
                        }}
                      >
                        <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--foreground)' }}>
                          {lang === 'en' ? 'Short Sleeve' : 'แขนสั้น'}
                        </Typography>
                        <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)', mt: 0.5 }}>
                          {lang === 'en' ? 'Free' : 'ไม่มีค่าบริการเพิ่ม'}
                        </Typography>
                      </Box>

                      <Box
                        onClick={() => {
                          const basePrice = product?.sizePricing?.[editingCartItem.size || ''] ?? product?.basePrice ?? editingCartItem.unitPrice;
                          const sleeveFee = product?.options?.longSleevePrice ?? 50;
                          onSetEditingCartItem({
                            ...editingCartItem,
                            options: { ...editingCartItem.options, isLongSleeve: true },
                            unitPrice: basePrice + sleeveFee,
                          });
                        }}
                        sx={{
                          flex: 1,
                          p: 1.5,
                          borderRadius: '10px',
                          border: editingCartItem.options?.isLongSleeve ? '2px solid var(--foreground)' : '1px solid var(--glass-border)',
                          bgcolor: editingCartItem.options?.isLongSleeve ? 'var(--surface)' : 'var(--surface-2)',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.2s',
                        }}
                      >
                        <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--foreground)' }}>
                          {lang === 'en' ? 'Long Sleeve' : 'แขนยาว'}
                        </Typography>
                        <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)', mt: 0.5, fontWeight: 600 }}>
                          + ฿{product?.options?.longSleevePrice ?? 50}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                )}

                {product?.patterns && product.patterns.filter((p) => p.isActive !== false).length > 0 && (
                  <Box sx={{ mb: 3 }}>
                    <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', mb: 1.5 }}>
                      {lang === 'en' ? 'Pattern/Design' : 'ลายสินค้า'}
                    </Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 1.2 }}>
                      {product.patterns
                        .filter((p) => p.isActive !== false)
                        .map((pattern) => {
                          const active = editingCartItem.options?.pattern === pattern.name;
                          return (
                            <Box
                              key={pattern.id}
                              onClick={() => onSetEditingCartItem({
                                ...editingCartItem,
                                options: { ...editingCartItem.options, pattern: pattern.name },
                              })}
                              sx={{
                                p: 0.8,
                                borderRadius: '10px',
                                border: active ? '2px solid var(--foreground)' : '1px solid var(--glass-border)',
                                bgcolor: active ? 'var(--surface)' : 'var(--surface-2)',
                                cursor: 'pointer',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: 0.5,
                                transition: 'all 0.2s',
                              }}
                            >
                              <Box sx={{
                                width: '100%',
                                height: 56,
                                borderRadius: '6px',
                                overflow: 'hidden',
                                bgcolor: 'var(--glass-bg)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: '1px solid var(--glass-border)',
                              }}>
                                {pattern.image ? (
                                  <Box component="img" src={pattern.image} alt={pattern.name} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                  <Palette size={18} style={{ color: 'var(--text-muted)' }} />
                                )}
                              </Box>
                              <Typography sx={{
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                color: 'var(--foreground)',
                                textAlign: 'center',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                width: '100%',
                              }}>
                                {pattern.name}
                              </Typography>
                            </Box>
                          );
                        })}
                    </Box>
                  </Box>
                )}
              </DialogContent>
              <DialogActions sx={{ p: 3, borderTop: '1px solid var(--glass-border)' }}>
                <Button onClick={() => onSetEditingCartItem(null)} sx={{ color: 'var(--text-muted)' }}>
                  {t.common.cancel}
                </Button>
                <Button
                  variant="contained"
                  onClick={() => onUpdateCartItem(editingCartItem.id, editingCartItem)}
                  sx={{
                    bgcolor: 'var(--foreground)',
                    color: 'var(--background)',
                    fontWeight: 700,
                    borderRadius: '12px',
                    px: 3,
                    '&:hover': { bgcolor: 'var(--foreground)', opacity: 0.9 },
                  }}
                >
                  {t.cart.saveEdit}
                </Button>
              </DialogActions>
            </>
          );
        })()}
      </Dialog>
      <ConfirmDialog />
    </>
  );
}
