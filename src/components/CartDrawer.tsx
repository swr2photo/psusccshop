'use client';

import React, { useCallback, useRef, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  IconButton,
  Switch,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material';
import {
  Edit,
  Minus,
  Palette,
  Plus,
  ShoppingCart,
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
  onCheckout: () => void;
  onStartHold: (itemId: string, direction: number) => void;
  onStopHold: (itemId: string) => void;
  onGoHome: () => void;
  getTotalPrice: () => number;
  // Edit dialog props
  editingCartItem: CartItem | null;
  onSetEditingCartItem: (item: CartItem | null) => void;
  onUpdateCartItem: (itemId: string, item: CartItem) => void;
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

  React.useEffect(() => { if (!open) { setDragOffset(0); setIsDragging(false); } }, [open]);

  // Get enabled shipping options info
  const enabledShippingOptions = shippingConfig?.options?.filter(o => o.enabled) || [];
  const lowestShippingFee = enabledShippingOptions.length > 0
    ? Math.min(...enabledShippingOptions.map(o => o.baseFee))
    : null;
  const freeShippingMinimum = shippingConfig?.globalFreeShippingMinimum 
    || (enabledShippingOptions.find(o => o.freeShippingMinimum)?.freeShippingMinimum);
  const cartTotal = getTotalPrice();
  const remainingForFreeShipping = freeShippingMinimum ? Math.max(0, freeShippingMinimum - cartTotal) : null;
  const hasFreeShipping = freeShippingMinimum && cartTotal >= freeShippingMinimum;

  return (
    <>
      <Drawer
        anchor={isMobile ? 'bottom' : 'right'}
        open={open}
        onClose={onClose}
        PaperProps={{
          sx: {
            height: isMobile ? { xs: '90vh', sm: '80vh' } : '100vh',
            maxHeight: isMobile ? '90vh' : '100vh',
            width: isMobile ? '100%' : '440px',
            borderTopLeftRadius: isMobile ? { xs: 20, sm: 24 } : { xs: 0, sm: 24 },
            borderTopRightRadius: isMobile ? { xs: 20, sm: 24 } : 0,
            borderBottomLeftRadius: isMobile ? 0 : { xs: 0, sm: 24 },
            bgcolor: 'var(--background)',
            color: 'var(--foreground)',
            overflow: 'hidden',
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
        }}>
          {/* Drag Handle - Swipe to dismiss */}
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
                background: 'linear-gradient(135deg, #0071e3 0%, #0077ED 100%)',
                display: 'grid',
                placeItems: 'center',
                boxShadow: '0 4px 14px rgba(0,113,227,0.3)',
              }}>
                <ShoppingCart size={22} color="white" />
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
            <Box sx={{ display: 'flex', gap: 1 }}>
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
                      onClearCart();
                    }
                  }}
                  sx={{ 
                    color: '#ff453a', 
                    fontSize: '0.75rem',
                    textTransform: 'none',
                    '&:hover': { bgcolor: 'rgba(239,68,68,0.1)' },
                  }}
                >
                  {t.cart.clearAll}
                </Button>
              )}
              <IconButton onClick={onClose} sx={{ color: 'var(--text-muted)', bgcolor: 'var(--glass-bg)', '&:hover': { bgcolor: 'var(--glass-bg)' } }}>
                <X size={20} />
              </IconButton>
            </Box>
          </Box>
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, overflow: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {cart.length === 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 10, gap: 2 }}>
              <Box sx={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                bgcolor: 'rgba(100,116,139,0.1)',
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
                  background: 'linear-gradient(135deg, #0071e3 0%, #0077ED 100%)',
                  color: 'white',
                  fontWeight: 600,
                  textTransform: 'none',
                }}
              >
                {t.cart.shopNow}
              </Button>
            </Box>
          ) : (
            <Box sx={{ px: { xs: 2, sm: 3 }, py: 2 }}>
              {cart.map((item) => {
                const product = config?.products?.find(p => p.id === item.productId);
                return (
                  <Box
                    key={item.id}
                    sx={{
                      p: 2,
                      mb: 1.5,
                      borderRadius: '16px',
                      bgcolor: 'var(--surface-2)',
                      border: '1px solid var(--glass-border)',
                      transition: 'background-color 0.2s ease, transform 0.2s ease',
                      '&:hover': { bgcolor: 'var(--surface-2)' },
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
                          <Box sx={{ px: 1, py: 0.2, borderRadius: '6px', bgcolor: 'rgba(0,113,227,0.15)', border: '1px solid rgba(0,113,227,0.3)' }}>
                            <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--secondary)' }}>{item.size}</Typography>
                          </Box>
                          {item.options?.isLongSleeve && (
                            <Box sx={{ px: 1, py: 0.2, borderRadius: '6px', bgcolor: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)' }}>
                              <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--warning)' }}>{t.common.longSleeve}</Typography>
                            </Box>
                          )}
                          {item.options?.customName && (
                            <Box sx={{ px: 1, py: 0.2, borderRadius: '6px', bgcolor: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)' }}>
                              <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--success)' }}>{item.options.customName}</Typography>
                            </Box>
                          )}
                          {item.options?.customNumber && (
                            <Box sx={{ px: 1, py: 0.2, borderRadius: '6px', bgcolor: 'rgba(6,182,212,0.15)', border: '1px solid rgba(6,182,212,0.3)' }}>
                              <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--secondary)' }}>#{item.options.customNumber}</Typography>
                            </Box>
                          )}
                          {item.options?.pattern && (
                            <Box sx={{ px: 1, py: 0.2, borderRadius: '6px', bgcolor: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.3)' }}>
                              <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: '#38bdf8' }}>{item.options.pattern}</Typography>
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
                              sx={{ color: 'var(--text-muted)', p: 0.6, '&:hover': { color: '#0071e3', bgcolor: 'rgba(0,113,227,0.1)' } }}
                            >
                              <Edit size={14} />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => onRemoveItem(item.id)}
                              sx={{ color: 'var(--text-muted)', p: 0.6, '&:hover': { color: '#f87171', bgcolor: 'rgba(239,68,68,0.1)' } }}
                            >
                              <X size={14} />
                            </IconButton>
                          </Box>
                        </Box>
                      </Box>

                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center', minWidth: 70 }}>
                        <Typography sx={{ fontSize: '1rem', fontWeight: 800, color: 'var(--success)' }}>
                          ฿{(item.unitPrice * item.quantity).toLocaleString()}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          )}
        </Box>

        {/* Bottom */}
        {cart.length > 0 && (
          <Box sx={{
            px: { xs: 2, sm: 3 },
            py: 2,
            borderTop: '1px solid var(--glass-border)',
            background: 'var(--glass-strong)',
            backdropFilter: 'blur(20px)',
            paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
          }}>
            {/* Shipping Info */}
            {enabledShippingOptions.length > 0 && (
              <Box sx={{
                p: 1.5,
                mb: 2,
                borderRadius: '12px',
                bgcolor: 'rgba(251,146,60,0.08)',
                border: '1px solid rgba(251,146,60,0.2)',
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Truck size={16} style={{ color: '#fb923c' }} />
                  <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: '#fb923c' }}>
                    {t.cart.shippingFee}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
                  {lowestShippingFee !== null && lowestShippingFee > 0 && (
                    <Typography sx={{ fontSize: '0.75rem', color: '#fb923c' }}>
                      {t.cart.shippingStart} ฿{lowestShippingFee.toLocaleString()}
                    </Typography>
                  )}
                  {hasFreeShipping ? (
                    <Box sx={{ 
                      px: 1, 
                      py: 0.2, 
                      borderRadius: '6px', 
                      bgcolor: 'rgba(34,197,94,0.15)', 
                      border: '1px solid rgba(34,197,94,0.3)' 
                    }}>
                      <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--success)' }}>
                        {t.cart.freeShipping}
                      </Typography>
                    </Box>
                  ) : remainingForFreeShipping && remainingForFreeShipping > 0 ? (
                    <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {t.cart.moreForFree} ฿{remainingForFreeShipping.toLocaleString()} {t.cart.moreForFreeSuffix}
                    </Typography>
                  ) : null}
                </Box>
              </Box>
            )}

            <Box sx={{
              p: 2,
              mb: 2,
              borderRadius: '14px',
              bgcolor: 'rgba(16,185,129,0.08)',
              border: '1px solid rgba(16,185,129,0.2)',
            }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography sx={{ fontSize: '0.75rem', color: 'var(--text-muted)', mb: 0.3 }}>{t.cart.subtotal}</Typography>
                  <Typography sx={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--success)' }}>
                    ฿{getTotalPrice().toLocaleString()}
                  </Typography>
                  {!hasFreeShipping && lowestShippingFee !== null && lowestShippingFee > 0 && (
                    <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {t.cart.shippingCalcNote}
                    </Typography>
                  )}
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{cart.length} {t.common.items}</Typography>
                  <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {cart.reduce((sum, item) => sum + item.quantity, 0)} {t.common.pieces}
                  </Typography>
                </Box>
              </Box>
            </Box>

            <Button
              fullWidth
              onClick={onCheckout}
              disabled={!isShopOpen}
              sx={{
                py: 1.8,
                borderRadius: '14px',
                background: isShopOpen 
                  ? 'linear-gradient(135deg, #34c759 0%, #34c759 100%)'
                  : 'rgba(100,116,139,0.2)',
                color: isShopOpen ? 'white' : 'var(--text-muted)',
                fontSize: '1rem',
                fontWeight: 700,
                textTransform: 'none',
                boxShadow: isShopOpen ? '0 4px 20px rgba(16,185,129,0.3)' : 'none',
                '&:hover': {
                  background: isShopOpen 
                    ? 'linear-gradient(135deg, #34c759 0%, #047857 100%)'
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

            <Button
              fullWidth
              onClick={onClose}
              startIcon={<X size={18} />}
              sx={{
                mt: 1,
                py: 1.2,
                borderRadius: '12px',
                bgcolor: 'rgba(100,116,139,0.15)',
                border: '1px solid rgba(100,116,139,0.3)',
                color: 'var(--text-muted)',
                fontSize: '0.85rem',
                fontWeight: 600,
                textTransform: 'none',
                '&:hover': { bgcolor: 'rgba(100,116,139,0.25)' },
              }}
            >
              {t.common.close}
            </Button>
          </Box>
        )}

        {cart.length === 0 && (
          <Box sx={{
            px: { xs: 2, sm: 3 },
            py: 2,
            borderTop: '1px solid var(--glass-border)',
            background: 'var(--glass-strong)',
            paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
          }}>
            <Button
              fullWidth
              onClick={onClose}
              startIcon={<X size={18} />}
              sx={{
                py: 1.2,
                borderRadius: '12px',
                bgcolor: 'rgba(100,116,139,0.15)',
                border: '1px solid rgba(100,116,139,0.3)',
                color: 'var(--text-muted)',
                fontSize: '0.85rem',
                fontWeight: 600,
                textTransform: 'none',
                '&:hover': { bgcolor: 'rgba(100,116,139,0.25)' },
              }}
            >
              {t.common.close}
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
          const product = config?.products?.find(p => p.id === editingCartItem.productId);
          const sizeKeys = product?.sizePricing ? Object.keys(product.sizePricing) : SIZES;
          // Sort sizes from small to large using SIZES order
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
                  <Edit size={20} color="#0071e3" />
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
                          unitPrice: basePrice + longSleeveFee 
                        })}
                        sx={{
                          px: 2,
                          py: 1,
                          borderRadius: '10px',
                          border: active ? '2px solid var(--primary)' : '1px solid var(--glass-border)',
                          bgcolor: active ? 'rgba(0,113,227,0.15)' : 'var(--surface-2)',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          '&:hover': { borderColor: 'var(--primary)' },
                        }}
                      >
                        <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, color: active ? 'var(--primary)' : 'var(--foreground)' }}>
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
                      options: { ...editingCartItem.options, customName: normalizeEngName(e.target.value) }
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
                      options: { ...editingCartItem.options, customNumber: normalizeDigits99(e.target.value) }
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
                      {/* Short Sleeve Button */}
                      <Box
                        onClick={() => {
                          const basePrice = product?.sizePricing?.[editingCartItem.size || ''] ?? product?.basePrice ?? editingCartItem.unitPrice;
                          onSetEditingCartItem({
                            ...editingCartItem,
                            options: { ...editingCartItem.options, isLongSleeve: false },
                            unitPrice: basePrice
                          });
                        }}
                        sx={{
                          flex: 1,
                          p: 1.5,
                          borderRadius: '10px',
                          border: !editingCartItem.options?.isLongSleeve ? '2px solid var(--primary)' : '1px solid var(--glass-border)',
                          bgcolor: !editingCartItem.options?.isLongSleeve ? 'rgba(0,113,227,0.15)' : 'var(--surface-2)',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.2s',
                          '&:hover': { borderColor: 'var(--primary)' },
                        }}
                      >
                        <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, color: !editingCartItem.options?.isLongSleeve ? 'var(--primary)' : 'var(--foreground)' }}>
                          {lang === 'en' ? 'Short Sleeve' : 'แขนสั้น'}
                        </Typography>
                        <Typography sx={{ fontSize: '0.7rem', color: !editingCartItem.options?.isLongSleeve ? '#0071e3' : 'var(--text-muted)', mt: 0.5 }}>
                          {lang === 'en' ? 'Free' : 'ไม่มีค่าบริการเพิ่ม'}
                        </Typography>
                      </Box>

                      {/* Long Sleeve Button */}
                      <Box
                        onClick={() => {
                          const basePrice = product?.sizePricing?.[editingCartItem.size || ''] ?? product?.basePrice ?? editingCartItem.unitPrice;
                          const sleeveFee = product?.options?.longSleevePrice ?? 50;
                          onSetEditingCartItem({
                            ...editingCartItem,
                            options: { ...editingCartItem.options, isLongSleeve: true },
                            unitPrice: basePrice + sleeveFee
                          });
                        }}
                        sx={{
                          flex: 1,
                          p: 1.5,
                          borderRadius: '10px',
                          border: editingCartItem.options?.isLongSleeve ? '2px solid var(--primary)' : '1px solid var(--glass-border)',
                          bgcolor: editingCartItem.options?.isLongSleeve ? 'rgba(0,113,227,0.15)' : 'var(--surface-2)',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.2s',
                          '&:hover': { borderColor: 'var(--primary)' },
                        }}
                      >
                        <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, color: editingCartItem.options?.isLongSleeve ? 'var(--primary)' : 'var(--foreground)' }}>
                          {lang === 'en' ? 'Long Sleeve' : 'แขนยาว'}
                        </Typography>
                        <Typography sx={{ fontSize: '0.7rem', color: editingCartItem.options?.isLongSleeve ? '#0071e3' : 'var(--text-muted)', mt: 0.5, fontWeight: 600 }}>
                          + ฿{product?.options?.longSleevePrice ?? 50}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                )}

                {product?.patterns && product.patterns.filter(p => p.isActive !== false).length > 0 && (
                  <Box sx={{ mb: 3 }}>
                    <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', mb: 1.5 }}>
                      {lang === 'en' ? 'Pattern/Design' : 'ลายสินค้า'}
                    </Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 1.2 }}>
                      {product.patterns
                        .filter(p => p.isActive !== false)
                        .map((pattern) => {
                          const active = editingCartItem.options?.pattern === pattern.name;
                          return (
                            <Box
                              key={pattern.id}
                              onClick={() => onSetEditingCartItem({
                                ...editingCartItem,
                                options: { ...editingCartItem.options, pattern: pattern.name }
                              })}
                              sx={{
                                p: 0.8,
                                borderRadius: '10px',
                                border: active ? '2px solid var(--primary)' : '1px solid var(--glass-border)',
                                bgcolor: active ? 'rgba(0,113,227,0.15)' : 'var(--surface-2)',
                                cursor: 'pointer',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: 0.5,
                                '&:hover': { borderColor: 'var(--primary)' },
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
                                color: active ? 'var(--primary)' : 'var(--foreground)',
                                textAlign: 'center', 
                                overflow: 'hidden', 
                                textOverflow: 'ellipsis', 
                                whiteSpace: 'nowrap', 
                                width: '100%' 
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
                    background: 'linear-gradient(135deg, #0071e3 0%, #0077ED 100%)',
                    fontWeight: 700,
                    borderRadius: '12px',
                    px: 3,
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
