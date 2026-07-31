'use client';

import { apiFetch } from '@/lib/api-client';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Button,
  Typography,
  Divider,
  RadioGroup,
  Radio,
  FormControlLabel,
  CircularProgress,
  LinearProgress,
  Skeleton,
  TextField,
  InputAdornment,
  IconButton,
} from '@mui/material';
import {
  Package,
  Truck,
  CreditCard,
  MapPin,
  Clock,
  AlertCircle,
  Check,
  Banknote,
  Wallet,
  Store,
  Ticket,
  X,
  Tag,
  QrCode,
} from 'lucide-react';
import { ShippingConfig, ShippingOption } from '@/lib/shipping';
import { PaymentConfig, PaymentOption } from '@/lib/payment';
import TurnstileWidget from './TurnstileWidget';
import { useTranslation } from '@/hooks/useTranslation';
import { useNotification } from '@/components/NotificationContext';

// ==================== TYPES ====================

import { type SavedAddress } from './ProfileModal';

interface CartItem {
  id: string;
  productId: string;
  productName: string;
  size: string;
  quantity: number;
  unitPrice: number;
  options: {
    customName?: string;
    customNumber?: string;
    isLongSleeve?: boolean;
    pattern?: string;
  };
}

interface OrderData {
  name: string;
  email: string;
  phone: string;
  address: string;
  instagram: string;
}

interface Product {
  id: string;
  name: string;
  nameEn?: string;
  images?: string[];
  coverImage?: string;
}

interface CheckoutDialogProps {
  open: boolean;
  onClose: () => void;
  cart: CartItem[];
  orderData: OrderData;
  profileComplete: boolean;
  processing: boolean;
  turnstileToken: string;
  setTurnstileToken: (token: string) => void;
  onSubmitOrder: (options?: {
    shippingOptionId?: string;
    paymentOptionId?: string;
    shippingFee?: number;
    promoCode?: string;
    promoDiscount?: number;
  }) => void;
  onEditProfile: () => void;
  products?: Product[];
  isMobile?: boolean;
  savedAddresses?: SavedAddress[];
  onAddressChange?: (address: string) => void;
  /** Multi-shop: validate promo codes against this shop's config */
  shopId?: string;
  /** Promo already validated in the cart drawer — seed checkout coupon state */
  initialPromo?: { code: string; discount: number; description?: string } | null;
}

// ==================== ICONS ====================

const PAYMENT_ICONS: Record<string, React.ReactNode> = {
  bank_transfer: <Banknote size={20} />,
  credit_card: <CreditCard size={20} />,
  true_money: <Wallet size={20} />,
  rabbit_line_pay: <Wallet size={20} />,
  shopeepay: <Wallet size={20} />,
  cod: <Truck size={20} />,
  installment: <CreditCard size={20} />,
};

// ==================== COMPONENT ====================

export default function CheckoutDialog({
  open,
  onClose,
  cart,
  orderData,
  profileComplete,
  processing,
  turnstileToken,
  setTurnstileToken,
  onSubmitOrder,
  onEditProfile,
  products = [],
  isMobile = false,
  savedAddresses = [],
  onAddressChange,
  shopId,
  initialPromo = null,
}: CheckoutDialogProps) {
  const [shippingConfig, setShippingConfig] = useState<ShippingConfig | null>(null);
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);

  const [turnstileKey, setTurnstileKey] = useState(0);
  const prevTokenRef = useRef(turnstileToken);

  useEffect(() => {
    if (prevTokenRef.current && !turnstileToken && open) {
      setTurnstileKey(prev => prev + 1);
    }
    prevTokenRef.current = turnstileToken;
  }, [turnstileToken, open]);

  useEffect(() => {
    if (open) {
      setTurnstileKey(prev => prev + 1);
      setTimeout(() => {
        if (dialogScrollRef.current) {
          dialogScrollRef.current.scrollTop = 0;
        }
      }, 50);
    }
  }, [open]);

  const [selectedShipping, setSelectedShipping] = useState<string>('');
  const [selectedPayment, setSelectedPayment] = useState<string>('');

  const [promoCode, setPromoCode] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoResult, setPromoResult] = useState<{ valid: boolean; code: string; discount: number; description: string } | null>(null);
  const [promoError, setPromoError] = useState('');

  const { t, lang } = useTranslation();
  const { toasts, warning: toastWarning } = useNotification();
  const latestError = useMemo(() => {
    return [...toasts].reverse().find(toast => toast.type === 'error');
  }, [toasts]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);

  const checkoutAddresses = useMemo(() => {
    const seen = new Set<string>();
    const list: SavedAddress[] = [];
    for (const addr of savedAddresses) {
      const key = addr.address.trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      list.push(addr);
    }
    const fallback = orderData.address?.trim();
    if (fallback && !seen.has(fallback)) {
      list.push({
        id: '__profile__',
        label: t.checkout.profileAddressLabel,
        address: fallback,
        isDefault: false,
      });
    }
    return list;
  }, [savedAddresses, orderData.address, t.checkout.profileAddressLabel]);

  const showAddressPicker = checkoutAddresses.length >= 2;

  useEffect(() => {
    if (!open) {
      setSelectedAddressId(null);
      return;
    }
    if (checkoutAddresses.length === 0) return;

    const current = orderData.address?.trim();
    const matched = checkoutAddresses.find((a) => a.address.trim() === current);
    const pick = matched || checkoutAddresses.find((a) => a.isDefault) || checkoutAddresses[0];

    setSelectedAddressId(pick.id);
    if (!matched && pick.address.trim() !== current) {
      onAddressChange?.(pick.address.trim());
    }
  }, [open, checkoutAddresses, orderData.address, onAddressChange]);

  const handleSelectAddress = useCallback(
    (addr: SavedAddress) => {
      setSelectedAddressId(addr.id);
      onAddressChange?.(addr.address.trim());
    },
    [onAddressChange],
  );

  const getShippingName = (option: ShippingOption) => lang === 'en' && option.nameEn ? option.nameEn : option.name;
  const getPaymentName = (option: PaymentOption) => lang === 'en' ? option.name : (option.nameThai || option.name);
  const getPaymentDesc = (option: PaymentOption) => lang === 'en' ? option.description : (option.descriptionThai || option.description);

  const [dialogDragOffset, setDialogDragOffset] = useState(0);
  const [isDialogDragging, setIsDialogDragging] = useState(false);
  const dialogSwipeStartY = useRef(0);
  const dialogScrollRef = useRef<HTMLDivElement | null>(null);

  const handleDialogSwipeStart = useCallback((e: React.TouchEvent) => {
    if (!isMobile) return;
    if (dialogScrollRef.current && dialogScrollRef.current.scrollTop > 5) return;
    dialogSwipeStartY.current = e.touches[0].clientY;
    setIsDialogDragging(true);
  }, [isMobile]);

  const handleDialogSwipeMove = useCallback((e: React.TouchEvent) => {
    if (!isDialogDragging) return;
    const delta = e.touches[0].clientY - dialogSwipeStartY.current;
    if (delta < 0) { setDialogDragOffset(0); return; }
    setDialogDragOffset(delta > 80 ? 80 + (delta - 80) * 0.3 : delta);
  }, [isDialogDragging]);

  const handleDialogSwipeEnd = useCallback(() => {
    if (!isDialogDragging) return;
    setIsDialogDragging(false);
    if (dialogDragOffset >= 80) {
      setDialogDragOffset(window.innerHeight);
      setTimeout(() => { onClose(); setDialogDragOffset(0); }, 200);
    } else {
      setDialogDragOffset(0);
    }
  }, [isDialogDragging, dialogDragOffset, onClose]);

  useEffect(() => { if (!open) { setDialogDragOffset(0); setIsDialogDragging(false); } }, [open]);

  useEffect(() => {
    if (!open) {
      setPromoCode('');
      setPromoResult(null);
      setPromoError('');
      return;
    }
    if (initialPromo?.code) {
      setPromoCode(initialPromo.code);
      setPromoResult({
        valid: true,
        code: initialPromo.code,
        discount: initialPromo.discount,
        description: initialPromo.description || '',
      });
      setPromoError('');
    } else {
      setPromoCode('');
      setPromoResult(null);
      setPromoError('');
    }
  }, [open, initialPromo]);

  useEffect(() => {
    if (open) {
      fetchConfigs();
    }
  }, [open]);

  const fetchConfigs = async () => {
    setLoadingConfig(true);
    try {
      const [shippingRes, paymentRes] = await Promise.all([
        apiFetch('/api/shipping/options').then(r => r.json()),
        apiFetch('/api/payment/config').then(r => r.json()),
      ]);

      if (shippingRes.success && shippingRes.data) {
        setShippingConfig(shippingRes.data);
        const enabledOptions = shippingRes.data.options?.filter((o: ShippingOption) => o.enabled) || [];
        if (enabledOptions.length > 0) {
          const defaultOption = enabledOptions.find((o: ShippingOption) => o.id === shippingRes.data.defaultOptionId) || enabledOptions[0];
          setSelectedShipping(defaultOption.id);
        }
      }

      if (paymentRes.success && paymentRes.data) {
        setPaymentConfig(paymentRes.data);
        const enabledOptions = paymentRes.data.options?.filter((o: PaymentOption) => o.enabled) || [];
        if (enabledOptions.length > 0) {
          const defaultOption = enabledOptions.find((o: PaymentOption) => o.id === paymentRes.data.defaultMethodId) || enabledOptions[0];
          setSelectedPayment(defaultOption.id);
        }
      }
    } catch (error) {
      console.error('Failed to fetch checkout config:', error);
    } finally {
      setLoadingConfig(false);
    }
  };

  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  }, [cart]);

  const itemCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);

  const selectedShippingOption = useMemo(() => {
    return shippingConfig?.options?.find(o => o.id === selectedShipping);
  }, [shippingConfig, selectedShipping]);

  const shippingFee = useMemo(() => {
    if (!selectedShippingOption) return 0;

    const freeMin = shippingConfig?.globalFreeShippingMinimum || selectedShippingOption.freeShippingMinimum;
    if (freeMin && subtotal >= freeMin) return 0;

    let fee = selectedShippingOption.baseFee || 0;
    if (selectedShippingOption.perItemFee) {
      const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
      fee += (totalItems - 1) * selectedShippingOption.perItemFee;
    }
    return fee;
  }, [selectedShippingOption, shippingConfig, subtotal, cart]);

  const selectedPaymentOption = useMemo(() => {
    return paymentConfig?.options?.find(o => o.id === selectedPayment);
  }, [paymentConfig, selectedPayment]);

  const paymentFee = useMemo(() => {
    if (!selectedPaymentOption) return 0;
    if (selectedPaymentOption.feeType === 'fixed') {
      return selectedPaymentOption.feeAmount || 0;
    }
    if (selectedPaymentOption.feeType === 'percentage') {
      return Math.round((subtotal + shippingFee) * ((selectedPaymentOption.feeAmount || 0) / 100));
    }
    return 0;
  }, [selectedPaymentOption, subtotal, shippingFee]);

  const promoDiscount = promoResult?.valid ? promoResult.discount : 0;

  const total = useMemo(() => {
    return Math.max(0, subtotal + shippingFee + paymentFee - promoDiscount);
  }, [subtotal, shippingFee, paymentFee, promoDiscount]);

  const applyPromoCode = async () => {
    if (!promoCode.trim()) return;
    setPromoLoading(true);
    setPromoError('');
    setPromoResult(null);
    try {
      const res = await apiFetch('/api/promo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: promoCode.trim(), subtotal, ...(shopId ? { shopId } : {}) }),
      });
      const data = await res.json();
      if (res.ok && data.valid) {
        setPromoResult(data);
        setPromoError('');
      } else {
        setPromoError(data.error || t.checkout.invalidCode);
        setPromoResult(null);
      }
    } catch {
      setPromoError(t.checkout.cannotVerifyCode);
    } finally {
      setPromoLoading(false);
    }
  };

  const clearPromo = () => {
    setPromoCode('');
    setPromoResult(null);
    setPromoError('');
  };

  const enabledShippingOptions = useMemo(() => {
    return shippingConfig?.options?.filter(o => o.enabled) || [];
  }, [shippingConfig]);

  const pickupOptions = useMemo(
    () => enabledShippingOptions.filter(o => o.provider === 'pickup'),
    [enabledShippingOptions],
  );

  const deliveryOptions = useMemo(
    () => enabledShippingOptions.filter(o => o.provider !== 'pickup'),
    [enabledShippingOptions],
  );

  const hasPickup = pickupOptions.length > 0;
  const hasDelivery = deliveryOptions.length > 0;
  const shippingMode: 'pickup' | 'delivery' =
    selectedShippingOption?.provider === 'pickup' || (!selectedShippingOption && hasPickup && !hasDelivery)
      ? 'pickup'
      : 'delivery';

  const enabledPaymentOptions = useMemo(() => {
    return paymentConfig?.options?.filter(o => o.enabled) || [];
  }, [paymentConfig]);

  const requiresAddress = useMemo(() => {
    if (!selectedShippingOption) return false;
    return selectedShippingOption.provider !== 'pickup';
  }, [selectedShippingOption]);

  const addressMissing = useMemo(() => {
    return requiresAddress && !orderData.address?.trim();
  }, [requiresAddress, orderData.address]);

  const pickupLocationText = useMemo(() => {
    if (shippingConfig?.pickupLocation?.trim()) return shippingConfig.pickupLocation.trim();
    const pickupOpt = pickupOptions[0] || enabledShippingOptions.find(o => o.provider === 'pickup');
    if (pickupOpt) {
      const desc = (lang === 'en' && pickupOpt.descriptionEn) ? pickupOpt.descriptionEn : pickupOpt.description;
      if (desc?.trim()) return desc.trim();
    }
    return lang === 'en'
      ? 'Computer Club, Faculty of Science, PSU'
      : 'อาคารตึกคอมฯ คณะวิทย์';
  }, [shippingConfig, pickupOptions, enabledShippingOptions, lang]);

  const handleShippingChange = (value: string) => {
    setSelectedShipping(value);

    const selectedOption = shippingConfig?.options?.find(o => o.id === value);
    const requiresAddr = selectedOption && selectedOption.provider !== 'pickup';

    if (requiresAddr && !orderData.address?.trim()) {
      toastWarning(t.checkout.addressRequired || 'กรุณากรอกที่อยู่สำหรับจัดส่งสินค้า');
    }
  };

  const handleShippingModeChange = (mode: 'pickup' | 'delivery') => {
    if (mode === 'pickup') {
      const pickupId = pickupOptions[0]?.id || enabledShippingOptions.find(o => o.provider === 'pickup')?.id;
      if (pickupId) handleShippingChange(pickupId);
      return;
    }
    const preferred =
      (selectedShippingOption && selectedShippingOption.provider !== 'pickup'
        ? selectedShippingOption.id
        : null) || deliveryOptions[0]?.id;
    if (preferred) handleShippingChange(preferred);
  };

  const handleSubmit = () => {
    onSubmitOrder({
      shippingOptionId: selectedShipping || 'pickup',
      paymentOptionId: selectedPayment || 'bank_transfer',
      shippingFee,
      promoCode: promoResult?.valid ? promoResult.code : undefined,
      promoDiscount: promoResult?.valid ? promoResult.discount : undefined,
    });
  };

  const hasShippingSelection = Boolean(selectedShipping);
  const canSubmit = profileComplete && turnstileToken && cart.length > 0 && !processing && !addressMissing && hasShippingSelection && !loadingConfig;

  const payCtaLabel = processing
    ? t.checkout.processing
    : t.checkout.payScanQr.replace('{amount}', total?.toLocaleString());

  const sectionSx = {
    p: 2,
    borderRadius: '8px',
    bgcolor: 'var(--surface-2)',
    border: '1px solid color-mix(in srgb, var(--foreground) 10%, transparent)',
  } as const;

  const sectionLabelSx = {
    fontWeight: 700,
    color: 'var(--foreground)',
    fontSize: '0.72rem',
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      fullScreen={isMobile}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: '92%', md: '720px' },
          maxWidth: 'calc(100% - 24px)',
          bgcolor: 'var(--background)',
          color: 'var(--foreground)',
          borderRadius: isMobile ? 0 : '10px',
          border: isMobile ? 'none' : '1px solid color-mix(in srgb, var(--foreground) 12%, transparent)',
          maxHeight: isMobile ? '100vh' : '90vh',
          transform: dialogDragOffset > 0 ? `translateY(${dialogDragOffset}px) !important` : undefined,
          transition: isDialogDragging ? 'none !important' : 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1) !important',
        },
      }}
    >
      {isMobile && (
        <Box
          onTouchStart={handleDialogSwipeStart}
          onTouchMove={handleDialogSwipeMove}
          onTouchEnd={handleDialogSwipeEnd}
          sx={{ width: '100%', display: 'flex', justifyContent: 'center', pt: 1, pb: 0.5, cursor: 'grab', touchAction: 'none', bgcolor: 'var(--primary)' }}
        >
          <Box sx={{ width: isDialogDragging ? 48 : 36, height: 4, bgcolor: 'rgba(255,255,255,0.4)', borderRadius: 2, transition: 'all 0.2s ease' }} />
        </Box>
      )}

      {/* Header */}
      <DialogTitle sx={{
        bgcolor: 'var(--primary)',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 1.5,
        py: 1.6,
        pr: 1.25,
        borderBottom: '1px solid color-mix(in srgb, #000 12%, transparent)',
      }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{
            fontWeight: 700,
            fontSize: '0.78rem',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            lineHeight: 1.35,
          }}>
            {t.checkout.title}
          </Typography>
          <Typography sx={{ fontWeight: 500, opacity: 0.85, mt: 0.35, fontSize: '0.78rem' }}>
            {itemCount} {t.common.items}
          </Typography>
        </Box>
        <IconButton
          onClick={onClose}
          aria-label={t.common.close}
          sx={{ color: 'white', bgcolor: 'rgba(255,255,255,0.12)', borderRadius: '6px', '&:hover': { bgcolor: 'rgba(255,255,255,0.22)' } }}
        >
          <X size={20} />
        </IconButton>
      </DialogTitle>

      {processing && (
        <LinearProgress sx={{ height: 3, bgcolor: 'rgba(0,113,227,0.1)', '& .MuiLinearProgress-bar': { bgcolor: '#0071e3' } }} />
      )}

      {latestError && (
        <Box
          sx={{
            mx: 3,
            mt: 2,
            mb: -1,
            p: 1.5,
            borderRadius: '12px',
            bgcolor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            color: '#ff453a',
          }}
        >
          <AlertCircle size={20} style={{ flexShrink: 0 }} />
          <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, flex: 1 }}>
            {latestError.message || latestError.title}
          </Typography>
        </Box>
      )}

      <DialogContent
        ref={dialogScrollRef}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          pt: 3,
          bgcolor: 'var(--background)',
          pb: 2,
        }}
      >
        {/* Always-visible product mini cards */}
        <Box sx={sectionSx}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Package size={16} color="var(--text-muted)" strokeWidth={1.75} />
              <Typography sx={sectionLabelSx}>
                {t.checkout.summary}
              </Typography>
              <Typography sx={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                {itemCount} {t.common.pieces}
              </Typography>
            </Box>
            <Typography sx={{ fontWeight: 700, color: 'var(--foreground)', fontSize: '0.95rem' }}>
              ฿{subtotal?.toLocaleString()}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {cart.map((item, idx) => {
              const productInfo = products?.find(p => p.id === item.productId);
              const productImage = productInfo?.coverImage || productInfo?.images?.[0];
              const displayName = (lang === 'en' && productInfo?.nameEn) ? productInfo.nameEn : (productInfo?.name || item.productName);

              return (
                <Box key={`${item.id}-${idx}`} sx={{
                  display: 'flex',
                  gap: 1.5,
                  p: 1.25,
                  borderRadius: '6px',
                  bgcolor: 'var(--surface)',
                  border: '1px solid color-mix(in srgb, var(--foreground) 8%, transparent)',
                }}>
                  <Box sx={{
                    width: 56,
                    height: 56,
                    borderRadius: '4px',
                    bgcolor: 'var(--surface-2)',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid color-mix(in srgb, var(--foreground) 8%, transparent)',
                    overflow: 'hidden',
                  }}>
                    {productImage ? (
                      <img
                        src={productImage}
                        alt={displayName}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        loading="lazy"
                      />
                    ) : (
                      <Package size={20} style={{ color: 'var(--text-muted)' }} />
                    )}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: 'var(--foreground)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {displayName}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                      {item.size && item.size !== '-' && (
                        <Box sx={{ px: 0.6, py: 0.1, borderRadius: '4px', bgcolor: 'rgba(0,113,227,0.15)', fontSize: '0.65rem', color: 'var(--secondary)' }}>
                          {item.size}
                        </Box>
                      )}
                      <Box sx={{ px: 0.6, py: 0.1, borderRadius: '4px', bgcolor: 'var(--glass-bg)', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                        x{item.quantity}
                      </Box>
                      {item.options?.isLongSleeve && (
                        <Box sx={{ px: 0.6, py: 0.1, borderRadius: '4px', bgcolor: 'rgba(99,102,241,0.15)', fontSize: '0.65rem', color: '#818cf8' }}>
                          {t.common.longSleeve}
                        </Box>
                      )}
                      {item.options?.pattern && (
                        <Box sx={{ px: 0.6, py: 0.1, borderRadius: '4px', bgcolor: 'rgba(56,189,248,0.15)', fontSize: '0.65rem', color: '#38bdf8' }}>
                          {item.options.pattern}
                        </Box>
                      )}
                    </Box>
                    {(item.options?.customName || item.options?.customNumber) && (
                      <Typography sx={{ fontSize: '0.65rem', color: 'var(--text-muted)', mt: 0.3 }}>
                        {item.options?.customName ? `${t.common.name}: ${item.options.customName}` : ''}
                        {item.options?.customName && item.options?.customNumber ? ' · ' : ''}
                        {item.options?.customNumber ? `${t.payment.numberLabel}: ${item.options.customNumber}` : ''}
                      </Typography>
                    )}
                  </Box>
                  <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--foreground)', flexShrink: 0 }}>
                    ฿{(item.unitPrice * item.quantity)?.toLocaleString()}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </Box>

        {/* Shipping / pickup + recipient */}
        {loadingConfig ? (
          <Skeleton variant="rounded" height={160} sx={{ bgcolor: 'var(--skeleton-bg)' }} />
        ) : (
          <Box sx={sectionSx}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Truck size={16} color="var(--text-muted)" strokeWidth={1.75} />
                <Typography sx={sectionLabelSx}>
                  {t.checkout.shippingSection}
                </Typography>
              </Box>
              <Button
                size="small"
                onClick={onEditProfile}
                sx={{
                  borderRadius: '4px',
                  px: 1.5,
                  bgcolor: 'color-mix(in srgb, var(--foreground) 6%, transparent)',
                  color: 'var(--foreground)',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  '&:hover': { bgcolor: 'color-mix(in srgb, var(--foreground) 10%, transparent)' },
                }}
              >
                {t.common.edit}
              </Button>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.45, mb: 1.5 }}>
              <Typography sx={{ color: 'var(--foreground)', fontSize: '0.88rem' }}>
                <Box component="span" sx={{ color: 'var(--text-muted)', mr: 1 }}>{`${t.common.name}:`}</Box>
                {orderData.name || '—'}
              </Typography>
              <Typography sx={{ color: 'var(--foreground)', fontSize: '0.88rem' }}>
                <Box component="span" sx={{ color: 'var(--text-muted)', mr: 1 }}>{`${t.common.phone}:`}</Box>
                {orderData.phone || '—'}
              </Typography>
              <Typography sx={{ color: 'var(--foreground)', fontSize: '0.88rem' }}>
                <Box component="span" sx={{ color: 'var(--text-muted)', mr: 1 }}>IG:</Box>
                {orderData.instagram || '—'}
              </Typography>
            </Box>

            {/* Pickup vs delivery toggle */}
            {(hasPickup || hasDelivery) && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 1.25 }}>
                {hasPickup && (
                  <Box
                    role="button"
                    tabIndex={0}
                    onClick={() => handleShippingModeChange('pickup')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleShippingModeChange('pickup');
                      }
                    }}
                    sx={{
                      p: 1.25,
                      borderRadius: '12px',
                      cursor: 'pointer',
                      bgcolor: shippingMode === 'pickup' ? 'rgba(52,199,89,0.1)' : 'var(--surface)',
                      border: shippingMode === 'pickup' ? '2px solid rgba(52,199,89,0.45)' : '1px solid var(--glass-border)',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 1.25,
                      transition: 'border-color 0.15s ease, background 0.15s ease',
                    }}
                  >
                    <Radio
                      checked={shippingMode === 'pickup'}
                      size="small"
                      sx={{ p: 0.25, color: 'var(--text-muted)', '&.Mui-checked': { color: 'var(--success)' } }}
                      tabIndex={-1}
                    />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                          <Store size={16} color={shippingMode === 'pickup' ? '#34c759' : 'var(--text-muted)'} />
                          <Typography sx={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--foreground)' }}>
                            {t.checkout.pickupSelf}
                          </Typography>
                        </Box>
                        <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--success)' }}>
                          {t.checkout.pickupFree}
                        </Typography>
                      </Box>
                      {shippingMode === 'pickup' && (
                        <Box sx={{ mt: 0.85, display: 'flex', alignItems: 'flex-start', gap: 0.75 }}>
                          <MapPin size={14} color="var(--text-muted)" style={{ marginTop: 2, flexShrink: 0 }} />
                          <Box>
                            <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                              {t.checkout.pickupLocationLabel}
                            </Typography>
                            <Typography sx={{ fontSize: '0.8rem', color: 'var(--foreground)', lineHeight: 1.4 }}>
                              {pickupLocationText}
                            </Typography>
                          </Box>
                        </Box>
                      )}
                    </Box>
                  </Box>
                )}

                {hasDelivery && (
                  <Box
                    role="button"
                    tabIndex={0}
                    onClick={() => handleShippingModeChange('delivery')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleShippingModeChange('delivery');
                      }
                    }}
                    sx={{
                      p: 1.25,
                      borderRadius: '12px',
                      cursor: 'pointer',
                      bgcolor: shippingMode === 'delivery' ? 'rgba(0,113,227,0.08)' : 'var(--surface)',
                      border: shippingMode === 'delivery' ? '2px solid rgba(0,113,227,0.4)' : '1px solid var(--glass-border)',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 1.25,
                      transition: 'border-color 0.15s ease, background 0.15s ease',
                    }}
                  >
                    <Radio
                      checked={shippingMode === 'delivery'}
                      size="small"
                      sx={{ p: 0.25, color: 'var(--text-muted)', '&.Mui-checked': { color: '#0071e3' } }}
                      tabIndex={-1}
                    />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                          <Truck size={16} color={shippingMode === 'delivery' ? '#2997ff' : 'var(--text-muted)'} />
                          <Typography sx={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--foreground)' }}>
                            {t.checkout.deliveryParcel}
                          </Typography>
                        </Box>
                        <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--foreground)' }}>
                          {(() => {
                            const opt = deliveryOptions.find(o => o.id === selectedShipping) || deliveryOptions[0];
                            const fee = opt?.baseFee || 0;
                            const freeMin = shippingConfig?.globalFreeShippingMinimum || opt?.freeShippingMinimum;
                            if (freeMin && subtotal >= freeMin) return t.common.free;
                            return fee > 0 ? `+฿${fee?.toLocaleString()}` : t.common.free;
                          })()}
                        </Typography>
                      </Box>

                      {shippingMode === 'delivery' && deliveryOptions.length > 1 && (
                        <RadioGroup
                          value={selectedShipping}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleShippingChange(e.target.value);
                          }}
                          sx={{ mt: 1 }}
                        >
                          {deliveryOptions.map((option) => {
                            const isSelected = selectedShipping === option.id;
                            const isFreeShipping = option.freeShippingMinimum && subtotal >= option.freeShippingMinimum;
                            return (
                              <FormControlLabel
                                key={option.id}
                                value={option.id}
                                onClick={(e) => e.stopPropagation()}
                                control={<Radio size="small" sx={{ color: '#64d2ff', '&.Mui-checked': { color: '#64d2ff' } }} />}
                                label={
                                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 1 }}>
                                    <Box>
                                      <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--foreground)' }}>
                                        {getShippingName(option)}
                                      </Typography>
                                      {option.estimatedDays && (
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, mt: 0.2 }}>
                                          <Clock size={11} color="var(--text-muted)" />
                                          <Typography sx={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                                            {option.estimatedDays.min === option.estimatedDays.max
                                              ? `${option.estimatedDays.min} ${t.checkout.estimatedDays}`
                                              : `${option.estimatedDays.min}-${option.estimatedDays.max} ${t.checkout.estimatedDays}`}
                                          </Typography>
                                        </Box>
                                      )}
                                    </Box>
                                    <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: isFreeShipping ? 'var(--success)' : 'var(--foreground)' }}>
                                      {isFreeShipping ? t.common.free : `฿${(option.baseFee || 0)?.toLocaleString()}`}
                                    </Typography>
                                  </Box>
                                }
                                sx={{
                                  mx: 0,
                                  mb: 0.5,
                                  p: 0.75,
                                  borderRadius: '10px',
                                  bgcolor: isSelected ? 'rgba(0,113,227,0.08)' : 'transparent',
                                  border: `1px solid ${isSelected ? 'rgba(0,113,227,0.25)' : 'transparent'}`,
                                  '& .MuiFormControlLabel-label': { flex: 1 },
                                }}
                              />
                            );
                          })}
                        </RadioGroup>
                      )}

                      {shippingMode === 'delivery' && (
                        <Box sx={{ mt: 1 }} onClick={(e) => e.stopPropagation()}>
                          {showAddressPicker ? (
                            <Box>
                              <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.8rem', mb: 0.75 }}>
                                {t.checkout.selectAddress}
                                <Box component="span" sx={{ color: '#ff453a', ml: 0.3 }}>*</Box>
                              </Typography>
                              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                {checkoutAddresses.map((addr) => {
                                  const isSelected = selectedAddressId === addr.id;
                                  return (
                                    <Box
                                      key={addr.id}
                                      role="button"
                                      tabIndex={0}
                                      onClick={() => handleSelectAddress(addr)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                          e.preventDefault();
                                          handleSelectAddress(addr);
                                        }
                                      }}
                                      sx={{
                                        p: 1.1,
                                        borderRadius: '10px',
                                        cursor: 'pointer',
                                        bgcolor: isSelected ? 'rgba(0,113,227,0.08)' : 'var(--background)',
                                        border: isSelected ? '2px solid rgba(0,113,227,0.45)' : '1px solid var(--glass-border)',
                                      }}
                                    >
                                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 0.3 }}>
                                        <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: isSelected ? 'var(--primary)' : 'var(--text-muted)' }}>
                                          {addr.label}
                                        </Typography>
                                        {isSelected && <Check size={14} color="#0071e3" />}
                                      </Box>
                                      <Typography sx={{ fontSize: '0.8rem', color: 'var(--foreground)', lineHeight: 1.4 }}>
                                        {addr.address}
                                      </Typography>
                                    </Box>
                                  );
                                })}
                              </Box>
                            </Box>
                          ) : (
                            <Typography sx={{ color: 'var(--foreground)', fontSize: '0.85rem', display: 'flex', alignItems: 'flex-start' }}>
                              <Box component="span" sx={{ color: 'var(--text-muted)', mr: 1, flexShrink: 0 }}>
                                {`${t.common.address}:`}<Box component="span" sx={{ color: '#ff453a', ml: 0.3 }}>*</Box>
                              </Box>
                              <Box component="span" sx={{ color: orderData.address ? 'var(--foreground)' : 'var(--text-muted)' }}>
                                {orderData.address || t.checkout.addressEmpty}
                              </Box>
                            </Typography>
                          )}
                        </Box>
                      )}
                    </Box>
                  </Box>
                )}
              </Box>
            )}

            {!profileComplete && (
              <Box sx={{
                mt: 0.5,
                p: 1,
                borderRadius: '8px',
                bgcolor: 'rgba(249,115,22,0.1)',
                border: '1px solid rgba(249,115,22,0.3)',
              }}>
                <Typography sx={{ color: '#fb923c', fontSize: '0.8rem', fontWeight: 600 }}>
                  {t.checkout.profileWarning}
                </Typography>
              </Box>
            )}
            {addressMissing && profileComplete && (
              <Box sx={{
                mt: 0.5,
                p: 1.2,
                borderRadius: '10px',
                bgcolor: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}>
                <MapPin size={16} color="#f87171" />
                <Typography sx={{ color: '#f87171', fontSize: '0.8rem', fontWeight: 600 }}>
                  {t.checkout.addressRequired}
                </Typography>
              </Box>
            )}
          </Box>
        )}

        {/* Payment options — only when more than one method */}
        {!loadingConfig && enabledPaymentOptions.length > 1 && (
          <Box sx={sectionSx}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.25 }}>
              <CreditCard size={16} color="var(--text-muted)" strokeWidth={1.75} />
              <Typography sx={sectionLabelSx}>
                {t.checkout.paymentMethod}
              </Typography>
            </Box>
            <RadioGroup value={selectedPayment} onChange={(e) => setSelectedPayment(e.target.value)}>
              {enabledPaymentOptions.map((option) => {
                const isSelected = selectedPayment === option.id;
                return (
                  <FormControlLabel
                    key={option.id}
                    value={option.id}
                    control={<Radio sx={{ color: '#34c759', '&.Mui-checked': { color: '#34c759' } }} />}
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', py: 0.35 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                          <Box sx={{
                            width: 32,
                            height: 32,
                            borderRadius: '8px',
                            bgcolor: isSelected ? 'rgba(16,185,129,0.2)' : 'var(--surface)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: isSelected ? '#34c759' : 'var(--text-muted)',
                          }}>
                            {PAYMENT_ICONS[option.method] || <CreditCard size={16} />}
                          </Box>
                          <Box>
                            <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--foreground)' }}>
                              {getPaymentName(option)}
                            </Typography>
                            {option.description && (
                              <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                {getPaymentDesc(option)}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      </Box>
                    }
                    sx={{
                      mx: 0,
                      mb: 0.75,
                      p: 0.75,
                      borderRadius: '12px',
                      bgcolor: isSelected ? 'rgba(16,185,129,0.1)' : 'transparent',
                      border: `1px solid ${isSelected ? 'rgba(16,185,129,0.3)' : 'transparent'}`,
                      '& .MuiFormControlLabel-label': { flex: 1 },
                    }}
                  />
                );
              })}
            </RadioGroup>
          </Box>
        )}

        {/* Promo / coupon */}
        <Box sx={{
          ...sectionSx,
          border: promoResult?.valid ? '1px solid rgba(52,199,89,0.4)' : sectionSx.border,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.25 }}>
            <Ticket size={16} style={{ color: promoResult?.valid ? '#34c759' : 'var(--text-muted)' }} />
            <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--foreground)' }}>
              {t.checkout.promoCode}
            </Typography>
          </Box>
          {promoResult?.valid ? (
            <Box sx={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              p: 1.5, borderRadius: '12px',
              bgcolor: 'rgba(52,199,89,0.1)', border: '1px solid rgba(52,199,89,0.3)',
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Tag size={14} style={{ color: '#34c759' }} />
                <Box>
                  <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: '#34c759' }}>
                    {promoResult.code}
                  </Typography>
                  <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {promoResult.description}
                  </Typography>
                </Box>
              </Box>
              <Button size="small" onClick={clearPromo} sx={{
                minWidth: 'auto', p: 0.5, color: 'var(--text-muted)',
                '&:hover': { color: '#ef4444' },
              }}>
                <X size={16} />
              </Button>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                size="small"
                placeholder={t.checkout.promoPlaceholder}
                value={promoCode}
                onChange={(e) => { setPromoCode(e.target.value.toUpperCase()); setPromoError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && applyPromoCode()}
                error={!!promoError}
                helperText={promoError}
                fullWidth
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Ticket size={16} style={{ color: 'var(--text-muted)' }} />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '12px',
                    bgcolor: 'var(--glass-bg)',
                    fontSize: '0.85rem',
                    '& fieldset': { borderColor: 'var(--glass-border)' },
                    '&:hover fieldset': { borderColor: 'rgba(0,113,227,0.5)' },
                    '&.Mui-focused fieldset': { borderColor: '#0071e3' },
                  },
                  '& .MuiFormHelperText-root': { fontSize: '0.7rem' },
                }}
              />
              <Button
                onClick={applyPromoCode}
                disabled={!promoCode.trim() || promoLoading}
                sx={{
                  minWidth: 80,
                  borderRadius: '12px',
                  bgcolor: promoCode.trim() ? 'rgba(0,113,227,0.15)' : 'var(--glass-bg)',
                  color: promoCode.trim() ? '#2997ff' : 'var(--text-muted)',
                  border: '1px solid',
                  borderColor: promoCode.trim() ? 'rgba(0,113,227,0.3)' : 'var(--glass-border)',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  textTransform: 'none',
                  '&:hover': { bgcolor: 'rgba(0,113,227,0.25)' },
                }}
              >
                {promoLoading ? <CircularProgress size={16} /> : t.checkout.applyCode}
              </Button>
            </Box>
          )}
        </Box>

        {/* Next step: PromptPay QR */}
        <Box sx={{
          p: 1.75,
          borderRadius: '8px',
          bgcolor: 'color-mix(in srgb, var(--foreground) 4%, transparent)',
          border: '1px solid color-mix(in srgb, var(--foreground) 10%, transparent)',
          display: 'flex',
          gap: 1.25,
          alignItems: 'flex-start',
        }}>
          <Box sx={{
            width: 36,
            height: 36,
            borderRadius: '6px',
            bgcolor: 'color-mix(in srgb, var(--foreground) 6%, transparent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            color: 'var(--text-muted)',
          }}>
            <QrCode size={18} strokeWidth={1.75} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--foreground)', lineHeight: 1.35 }}>
              {t.checkout.nextStepQr}
            </Typography>
            <Typography sx={{ fontSize: '0.74rem', color: 'var(--text-muted)', mt: 0.35, lineHeight: 1.45 }}>
              {t.checkout.nextStepQrHint}
            </Typography>
          </Box>
        </Box>

        {/* Totals */}
        <Box sx={sectionSx}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t.checkout.productPrice}</Typography>
            <Typography sx={{ color: 'var(--foreground)', fontSize: '0.85rem' }}>฿{subtotal?.toLocaleString()}</Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t.checkout.shippingFee}</Typography>
            {shippingFee === 0 ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {selectedShippingOption && selectedShippingOption.baseFee > 0 && (
                  <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.8rem', textDecoration: 'line-through' }}>
                    ฿{selectedShippingOption.baseFee}
                  </Typography>
                )}
                <Typography sx={{ color: 'var(--foreground)', fontSize: '0.85rem', fontWeight: 600 }}>{t.common.free}</Typography>
              </Box>
            ) : (
              <Typography sx={{ color: 'var(--foreground)', fontSize: '0.85rem' }}>฿{shippingFee?.toLocaleString()}</Typography>
            )}
          </Box>
          {paymentFee > 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t.checkout.processingFee}</Typography>
              <Typography sx={{ color: 'var(--foreground)', fontSize: '0.85rem' }}>฿{paymentFee?.toLocaleString()}</Typography>
            </Box>
          )}
          {promoDiscount > 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>
                {t.checkout.discount} ({promoResult?.code})
              </Typography>
              <Typography sx={{ color: 'var(--foreground)', fontSize: '0.85rem', fontWeight: 700 }}>
                -฿{promoDiscount?.toLocaleString()}
              </Typography>
            </Box>
          )}
          <Divider sx={{ my: 1.5, borderColor: 'color-mix(in srgb, var(--foreground) 10%, transparent)' }} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Typography sx={{
              fontWeight: 700,
              color: 'var(--foreground)',
              fontSize: '0.78rem',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}>
              {t.checkout.grandTotal}
            </Typography>
            <Typography sx={{ fontWeight: 800, color: 'var(--foreground)', fontSize: '1.25rem' }}>
              ฿{total?.toLocaleString()}
            </Typography>
          </Box>
        </Box>

        <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1.45, px: 0.25 }}>
          {t.checkout.confirmHint}
        </Typography>

        {/* Turnstile — bottom-aligned, not a centered hero badge */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', pt: 0.5 }}>
          <TurnstileWidget
            key={turnstileKey}
            onSuccess={(token) => setTurnstileToken(token)}
            onExpire={() => setTurnstileToken('')}
            onError={() => setTurnstileToken('')}
            theme="dark"
            size="normal"
            action="order"
          />
        </Box>
      </DialogContent>

      {/* Footer: Cancel | Confirm CTA */}
      <DialogActions sx={{
        p: 2,
        gap: 1.25,
        flexDirection: 'column',
        alignItems: 'stretch',
        borderTop: '1px solid color-mix(in srgb, var(--foreground) 10%, transparent)',
        bgcolor: 'var(--background)',
      }}>
        <Box sx={{ display: 'flex', gap: 1.25, width: '100%', justifyContent: 'space-between' }}>
          <Button
            onClick={onClose}
            sx={{
              py: 1.35,
              px: 2,
              color: 'var(--text-muted)',
              borderRadius: '4px',
              fontSize: '0.8rem',
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              flexShrink: 0,
              '&:hover': { bgcolor: 'color-mix(in srgb, var(--foreground) 6%, transparent)' },
            }}
          >
            {t.common.cancel}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            startIcon={processing ? <CircularProgress size={18} color="inherit" /> : <Check size={18} strokeWidth={2.25} />}
            sx={{
              flex: 1,
              maxWidth: '78%',
              py: 1.45,
              minHeight: 48,
              borderRadius: '4px',
              fontSize: { xs: '0.72rem', sm: '0.78rem' },
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              bgcolor: canSubmit ? 'var(--primary)' : 'color-mix(in srgb, var(--foreground) 12%, transparent)',
              color: canSubmit ? '#fff' : 'var(--text-muted)',
              boxShadow: 'none',
              '&:hover': {
                bgcolor: canSubmit ? 'var(--primary)' : 'color-mix(in srgb, var(--foreground) 12%, transparent)',
                filter: canSubmit ? 'brightness(0.92)' : 'none',
                boxShadow: 'none',
              },
              '&.Mui-disabled': {
                color: 'var(--text-muted)',
              },
            }}
          >
            {payCtaLabel}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}
