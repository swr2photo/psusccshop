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
  ShoppingCart,
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
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  onRemoveItem: (itemId: string) => void;
  onEditItem: (item: CartItem) => void;
  onCheckout: (promo?: CartPromoResult) => void;
  onStartHold: (itemId: string, direction: number) => void;
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
      );
      if (!evalResult.ok) {
        map.set(item.id, lineIssueMessage(evalResult.reason, lang));
      }
    }
    return map;
  }, [cart, resolveProduct, config?.products, lang]);

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

  const chipSx = {
    px: 1,
    py: 0.2,
    borderRadius: '6px',
    bgcolor: 'var(--surface)',
    border: '1px solid var(--glass-border)',
  } as const;

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
            width: isMobile ? '100%' : { xs: '100%', sm: '440px' },
            maxWidth: '100vw',
            boxSizing: 'border-box',
            borderTopLeftRadius: isMobile ? { xs: 20, sm: 24 } : { xs: 0, sm: 24 },
            borderTopRightRadius: isMobile ? { xs: 20, sm: 24 } : 0,
            borderBottomLeftRadius: isMobile ? 0 : { xs: 0, sm: 24 },
            bgcolor: 'var(--background)',
            color: 'var(--foreground)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            transform: isMobile && dragOffset > 0 ? `translateY(${dragOffset}px) !important` : undefined,
            transition: isDragging ? 'none !important' : 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1) !important',
          },
        }}
      >
        {/* Header */}
        <Box sx={{
          px: { xs: 2, sm: 3 },
          py: { xs: 1.5, sm: 2 },
          borderBottom: '1px solid var(--glass-border)',
          background: 'var(--glass-strong)',
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
              sx={{ width: '100%', display: 'flex', justifyContent: 'center', py: 0.5, cursor: 'grab', touchAction: 'none' }}
            >
              <Box sx={{ width: isDragging ? 48 : 36, height: 4, bgcolor: isDragging ? 'var(--text-muted)' : 'var(--glass-bg)', borderRadius: 2, transition: 'all 0.2s ease' }} />
            </Box>
          )}

          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{
                width: 44,
                height: 44,
                borderRadius: '14px',
                bgcolor: 'var(--surface-2)',
                border: '1px solid var(--glass-border)',
                display: 'grid',
                placeItems: 'center',
              }}>
                <ShoppingCart size={22} style={{ color: 'var(--foreground)' }} />
              </Box>
              <Box>
                <Typography sx={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--foreground)' }}>
                  {t.cart.title}
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {cart.length} {t.common.items} · {cart.reduce((sum, item) => sum + item.quantity, 0)} {t.common.pieces}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
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
                    fontSize: '0.75rem',
                    textTransform: 'none',
                    fontWeight: 500,
                    '&:hover': { color: 'var(--foreground)', bgcolor: 'var(--surface-2)' },
                  }}
                >
                  {t.cart.clearAll}
                </Button>
              )}
              <IconButton onClick={onClose} sx={{ color: 'var(--text-muted)', bgcolor: 'var(--glass-bg)', '&:hover': { bgcolor: 'var(--surface-2)' } }}>
                <X size={20} />
              </IconButton>
            </Box>
          </Box>
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, overflow: 'auto', WebkitOverflowScrolling: 'touch', minHeight: 0 }}>
          {cart.length === 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 10, gap: 2 }}>
              <Box sx={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                bgcolor: 'var(--surface-2)',
                display: 'grid',
                placeItems: 'center',
              }}>
                <ShoppingCart size={36} style={{ color: 'var(--text-muted)' }} />
              </Box>
              <Typography sx={{ color: 'var(--text-muted)', fontSize: '1rem', fontWeight: 600 }}>{t.cart.empty}</Typography>
              <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t.cart.emptyDesc}</Typography>
              <Button
                onClick={onGoHome}
                sx={{
                  mt: 1,
                  px: 3,
                  py: 1,
                  borderRadius: '12px',
                  bgcolor: 'var(--surface-2)',
                  border: '1px solid var(--glass-border)',
                  color: 'var(--foreground)',
                  fontWeight: 600,
                  textTransform: 'none',
                  '&:hover': { bgcolor: 'var(--surface)' },
                }}
              >
                {t.cart.shopNow}
              </Button>
            </Box>
          ) : (
            <Box sx={{ px: { xs: 2, sm: 3 }, py: 2 }}>
              {cart.map((item) => {
                const product = resolveProduct(item);
                const issue = lineIssues.get(item.id);
                return (
                  <Box
                    key={item.id}
                    sx={{
                      p: 2,
                      mb: 1.5,
                      borderRadius: '16px',
                      bgcolor: 'var(--surface-2)',
                      border: issue ? '1px solid rgba(148,163,184,0.45)' : '1px solid var(--glass-border)',
                      transition: 'background-color 0.2s ease, transform 0.2s ease',
                    }}
                  >
                    <Box sx={{ display: 'flex', gap: 2 }}>
                      {product?.images?.[0] && (
                        <Box sx={{
                          width: 60,
                          height: 60,
                          borderRadius: '12px',
                          overflow: 'hidden',
                          flexShrink: 0,
                          border: '1px solid var(--glass-border)',
                          opacity: issue ? 0.65 : 1,
                        }}>
                          <OptimizedImage
                            src={product.images[0]}
                            alt={item.productName}
                            width={60}
                            height={60}
                            objectFit="cover"
                            placeholder="skeleton"
                          />
                        </Box>
                      )}

                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--foreground)', mb: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.productName}
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6, mb: 1.5 }}>
                          <Box sx={chipSx}>
                            <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)' }}>{item.size}</Typography>
                          </Box>
                          {item.options?.isLongSleeve && (
                            <Box sx={chipSx}>
                              <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)' }}>{t.common.longSleeve}</Typography>
                            </Box>
                          )}
                          {item.options?.customName && (
                            <Box sx={chipSx}>
                              <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)' }}>{item.options.customName}</Typography>
                            </Box>
                          )}
                          {item.options?.customNumber && (
                            <Box sx={chipSx}>
                              <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)' }}>#{item.options.customNumber}</Typography>
                            </Box>
                          )}
                          {item.options?.pattern && (
                            <Box sx={chipSx}>
                              <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)' }}>{item.options.pattern}</Typography>
                            </Box>
                          )}
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{
                              display: 'flex',
                              alignItems: 'center',
                              bgcolor: 'var(--glass-bg)',
                              borderRadius: '10px',
                              border: '1px solid var(--glass-border)',
                            }}>
                              <IconButton
                                size="small"
                                onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                                onMouseDown={() => onStartHold(item.id, -1)}
                                onMouseUp={() => onStopHold(item.id)}
                                onMouseLeave={() => onStopHold(item.id)}
                                onTouchStart={() => onStartHold(item.id, -1)}
                                onTouchEnd={() => onStopHold(item.id)}
                                sx={{ color: 'var(--text-muted)', p: 0.8, '&:hover': { color: 'var(--foreground)' } }}
                              >
                                <Minus size={14} />
                              </IconButton>
                              <Typography sx={{ color: 'var(--foreground)', minWidth: 28, textAlign: 'center', fontWeight: 700, fontSize: '0.85rem' }}>
                                {item.quantity}
                              </Typography>
                              <IconButton
                                size="small"
                                onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                                onMouseDown={() => onStartHold(item.id, 1)}
                                onMouseUp={() => onStopHold(item.id)}
                                onMouseLeave={() => onStopHold(item.id)}
                                onTouchStart={() => onStartHold(item.id, 1)}
                                onTouchEnd={() => onStopHold(item.id)}
                                sx={{ color: 'var(--text-muted)', p: 0.8, '&:hover': { color: 'var(--foreground)' } }}
                              >
                                <Plus size={14} />
                              </IconButton>
                            </Box>
                            <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>× ฿{item.unitPrice.toLocaleString()}</Typography>
                          </Box>

                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <IconButton
                              size="small"
                              onClick={() => onEditItem(item)}
                              sx={{ color: 'var(--text-muted)', p: 0.6, '&:hover': { color: 'var(--foreground)', bgcolor: 'var(--surface)' } }}
                            >
                              <Edit size={14} />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => onRemoveItem(item.id)}
                              sx={{ color: 'var(--text-muted)', p: 0.6, '&:hover': { color: 'var(--foreground)', bgcolor: 'var(--surface)' } }}
                            >
                              <X size={14} />
                            </IconButton>
                          </Box>
                        </Box>
                      </Box>

                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center', minWidth: 70 }}>
                        <Typography sx={{ fontSize: '1rem', fontWeight: 800, color: 'var(--foreground)' }}>
                          ฿{(item.unitPrice * item.quantity).toLocaleString()}
                        </Typography>
                      </Box>
                    </Box>

                    {issue && (
                      <Box sx={{
                        mt: 1.5,
                        p: 1.2,
                        borderRadius: '10px',
                        bgcolor: 'var(--surface)',
                        border: '1px solid var(--glass-border)',
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

              {/* Coupon */}
              <Box sx={{
                p: 1.5,
                mb: 1,
                borderRadius: '14px',
                bgcolor: 'var(--surface-2)',
                border: '1px solid var(--glass-border)',
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Ticket size={15} style={{ color: 'var(--text-muted)' }} />
                  <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--foreground)' }}>
                    {t.checkout.promoCode}
                  </Typography>
                </Box>
                {promoResult ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                      <Tag size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--foreground)' }}>
                          {promoResult.code}
                        </Typography>
                        <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {promoResult.description || `-฿${promoResult.discount.toLocaleString()}`}
                        </Typography>
                      </Box>
                    </Box>
                    <IconButton size="small" onClick={clearPromo} sx={{ color: 'var(--text-muted)' }}>
                      <X size={16} />
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
                          borderRadius: '10px',
                          bgcolor: 'var(--surface)',
                          fontSize: '0.85rem',
                        },
                        '& fieldset': { borderColor: 'var(--glass-border)' },
                      }}
                    />
                    <Button
                      onClick={applyPromoCode}
                      disabled={!promoInput.trim() || promoLoading}
                      sx={{
                        px: 2,
                        borderRadius: '10px',
                        textTransform: 'none',
                        fontWeight: 600,
                        fontSize: '0.8rem',
                        bgcolor: 'var(--surface)',
                        border: '1px solid var(--glass-border)',
                        color: promoInput.trim() ? 'var(--foreground)' : 'var(--text-muted)',
                        whiteSpace: 'nowrap',
                        minWidth: 72,
                        '&:hover': { bgcolor: 'var(--glass-bg)' },
                        '&:disabled': { color: 'var(--text-muted)' },
                      }}
                    >
                      {promoLoading ? <CircularProgress size={16} sx={{ color: 'var(--text-muted)' }} /> : t.checkout.applyCode}
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

        {/* Sticky bottom: summary + primary CTA only */}
        {cart.length > 0 && (
          <Box sx={{
            px: { xs: 2, sm: 3 },
            pt: 2,
            borderTop: '1px solid var(--glass-border)',
            background: 'var(--glass-strong)',
            backdropFilter: 'blur(20px)',
            // Extra inset so the CTA stays tappable above iPad home indicator / Safari chrome
            paddingBottom: 'max(20px, calc(env(safe-area-inset-bottom, 0px) + 16px))',
            flexShrink: 0,
            position: 'sticky',
            bottom: 0,
            zIndex: 11,
          }}>
            {/* Shipping note / free-shipping progress */}
            <Box sx={{
              p: 1.5,
              mb: 1.5,
              borderRadius: '12px',
              bgcolor: 'var(--surface-2)',
              border: '1px solid var(--glass-border)',
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Truck size={15} style={{ color: 'var(--text-muted)' }} />
                <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--foreground)' }}>
                  {t.cart.shippingFee}
                </Typography>
              </Box>
              {hasFreeShipping ? (
                <Typography sx={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {t.cart.freeShippingUnlocked}
                </Typography>
              ) : remainingForFreeShipping != null && remainingForFreeShipping > 0 ? (
                <Typography sx={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {t.cart.orderMoreForFree.replace('{amount}', remainingForFreeShipping.toLocaleString())}
                </Typography>
              ) : (
                <Typography sx={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {t.cart.shippingNextStep}
                </Typography>
              )}
            </Box>

            {/* Summary */}
            <Box sx={{
              p: 2,
              mb: 2,
              borderRadius: '14px',
              bgcolor: 'var(--surface-2)',
              border: '1px solid var(--glass-border)',
            }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: promoDiscount > 0 ? 1 : 0 }}>
                <Typography sx={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.cart.subtotal}</Typography>
                <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--foreground)' }}>
                  ฿{cartTotal.toLocaleString()}
                </Typography>
              </Box>
              {promoDiscount > 0 && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography sx={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {t.checkout.discount} ({promoResult?.code})
                  </Typography>
                  <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--foreground)' }}>
                    -฿{promoDiscount.toLocaleString()}
                  </Typography>
                </Box>
              )}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pt: promoDiscount > 0 ? 1 : 0, borderTop: promoDiscount > 0 ? '1px solid var(--glass-border)' : 'none' }}>
                <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--foreground)' }}>
                  {t.cart.total}
                </Typography>
                <Typography sx={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--foreground)' }}>
                  ฿{displayTotal.toLocaleString()}
                </Typography>
              </Box>
              <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)', mt: 0.5 }}>
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
                py: { xs: 1.5, sm: 1.6 },
                minHeight: 48,
                borderRadius: '14px',
                background: canCheckout
                  ? 'linear-gradient(135deg, #34c759 0%, #30b350 100%)'
                  : 'rgba(100,116,139,0.2)',
                color: canCheckout ? 'white' : 'var(--text-muted)',
                fontSize: { xs: '0.95rem', sm: '1rem' },
                fontWeight: 700,
                textTransform: 'none',
                boxShadow: canCheckout ? '0 4px 20px rgba(52,199,89,0.28)' : 'none',
                '&:hover': {
                  background: canCheckout
                    ? 'linear-gradient(135deg, #30b350 0%, #28a745 100%)'
                    : 'rgba(100,116,139,0.3)',
                },
                '&:disabled': {
                  background: 'rgba(100,116,139,0.2)',
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

                <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', mb: 1 }}>{t.cart.quantity}</Typography>
                <Box sx={{
                  display: 'flex',
                  alignItems: 'center',
                  bgcolor: 'var(--glass-bg)',
                  borderRadius: '12px',
                  border: '1px solid var(--glass-border)',
                  width: 'fit-content',
                }}>
                  <IconButton
                    onClick={() => onSetEditingCartItem({ ...editingCartItem, quantity: Math.max(1, editingCartItem.quantity - 1) })}
                    sx={{ color: 'var(--text-muted)', p: 1.5 }}
                  >
                    <Minus size={18} />
                  </IconButton>
                  <Typography sx={{ color: 'var(--foreground)', minWidth: 48, textAlign: 'center', fontWeight: 800, fontSize: '1.1rem' }}>
                    {editingCartItem.quantity}
                  </Typography>
                  <IconButton
                    onClick={() => onSetEditingCartItem({ ...editingCartItem, quantity: Math.min(99, editingCartItem.quantity + 1) })}
                    sx={{ color: 'var(--text-muted)', p: 1.5 }}
                  >
                    <Plus size={18} />
                  </IconButton>
                </Box>
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
