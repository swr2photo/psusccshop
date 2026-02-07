'use client';

import { useState, useEffect, useMemo } from 'react';
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
  Collapse,
  CircularProgress,
  Skeleton,
  TextField,
  InputAdornment,
} from '@mui/material';
import {
  ShoppingCart,
  Package,
  User,
  Truck,
  CreditCard,
  MapPin,
  Clock,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Check,
  Banknote,
  Wallet,
  Store,
  Ticket,
  X,
  Tag,
} from 'lucide-react';
import { ShippingConfig, ShippingOption } from '@/lib/shipping';
import { PaymentConfig, PaymentOption } from '@/lib/payment';
import TurnstileWidget from './TurnstileWidget';

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
  images?: string[];
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

const SHIPPING_ICONS: Record<string, React.ReactNode> = {
  thailand_post: <Truck size={20} />,
  kerry: <Truck size={20} />,
  jandt: <Truck size={20} />,
  flash: <Truck size={20} />,
  pickup: <Store size={20} />,
  custom: <Truck size={20} />,
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
}: CheckoutDialogProps) {
  // Config states
  const [shippingConfig, setShippingConfig] = useState<ShippingConfig | null>(null);
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);

  // Selection states
  const [selectedShipping, setSelectedShipping] = useState<string>('');
  const [selectedPayment, setSelectedPayment] = useState<string>('');

  // UI states
  const [showShippingOptions, setShowShippingOptions] = useState(true);
  const [showPaymentOptions, setShowPaymentOptions] = useState(true);
  const [showCartDetails, setShowCartDetails] = useState(false);

  // Promo code states
  const [promoCode, setPromoCode] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoResult, setPromoResult] = useState<{ valid: boolean; code: string; discount: number; description: string } | null>(null);
  const [promoError, setPromoError] = useState('');

  // Reset promo when dialog closes
  useEffect(() => {
    if (!open) {
      setPromoCode('');
      setPromoResult(null);
      setPromoError('');
    }
  }, [open]);

  // Fetch configs when dialog opens
  useEffect(() => {
    if (open) {
      fetchConfigs();
    }
  }, [open]);

  const fetchConfigs = async () => {
    setLoadingConfig(true);
    try {
      const [shippingRes, paymentRes] = await Promise.all([
        fetch('/api/shipping/options').then(r => r.json()),
        fetch('/api/payment/config').then(r => r.json()),
      ]);

      if (shippingRes.success && shippingRes.data) {
        setShippingConfig(shippingRes.data);
        // Set default shipping option
        const enabledOptions = shippingRes.data.options?.filter((o: ShippingOption) => o.enabled) || [];
        if (enabledOptions.length > 0) {
          const defaultOption = enabledOptions.find((o: ShippingOption) => o.id === shippingRes.data.defaultOptionId) || enabledOptions[0];
          setSelectedShipping(defaultOption.id);
        }
      }

      if (paymentRes.success && paymentRes.data) {
        setPaymentConfig(paymentRes.data);
        // Set default payment option
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

  // Calculate totals
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  }, [cart]);

  const selectedShippingOption = useMemo(() => {
    return shippingConfig?.options?.find(o => o.id === selectedShipping);
  }, [shippingConfig, selectedShipping]);

  const shippingFee = useMemo(() => {
    if (!selectedShippingOption) return 0;
    
    // Check free shipping
    const freeMin = shippingConfig?.globalFreeShippingMinimum || selectedShippingOption.freeShippingMinimum;
    if (freeMin && subtotal >= freeMin) return 0;

    // Calculate fee
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

  // Promo code handlers
  const applyPromoCode = async () => {
    if (!promoCode.trim()) return;
    setPromoLoading(true);
    setPromoError('');
    setPromoResult(null);
    try {
      const res = await fetch('/api/promo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: promoCode.trim(), subtotal }),
      });
      const data = await res.json();
      if (res.ok && data.valid) {
        setPromoResult(data);
        setPromoError('');
      } else {
        setPromoError(data.error || 'รหัสไม่ถูกต้อง');
        setPromoResult(null);
      }
    } catch {
      setPromoError('ไม่สามารถตรวจสอบรหัสได้');
    } finally {
      setPromoLoading(false);
    }
  };

  const clearPromo = () => {
    setPromoCode('');
    setPromoResult(null);
    setPromoError('');
  };

  // Get enabled options
  const enabledShippingOptions = useMemo(() => {
    return shippingConfig?.options?.filter(o => o.enabled) || [];
  }, [shippingConfig]);

  const enabledPaymentOptions = useMemo(() => {
    return paymentConfig?.options?.filter(o => o.enabled) || [];
  }, [paymentConfig]);

  // Check if selected shipping requires address (not pickup)
  const requiresAddress = useMemo(() => {
    if (!selectedShippingOption) return false;
    return selectedShippingOption.provider !== 'pickup';
  }, [selectedShippingOption]);

  // Check if address is missing when required
  const addressMissing = useMemo(() => {
    return requiresAddress && !orderData.address?.trim();
  }, [requiresAddress, orderData.address]);

  const handleSubmit = () => {
    onSubmitOrder({
      shippingOptionId: selectedShipping || 'pickup',
      paymentOptionId: selectedPayment || 'bank_transfer',
      shippingFee,
      promoCode: promoResult?.valid ? promoResult.code : undefined,
      promoDiscount: promoResult?.valid ? promoResult.discount : undefined,
    });
  };

  // Require shipping selection for submit
  const hasShippingSelection = Boolean(selectedShipping);
  const canSubmit = profileComplete && turnstileToken && cart.length > 0 && !processing && !addressMissing && hasShippingSelection && !loadingConfig;

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
          borderRadius: isMobile ? 0 : '20px',
          border: isMobile ? 'none' : '1px solid var(--glass-border)',
          maxHeight: isMobile ? '100vh' : '90vh',
        },
      }}
    >
      {/* Header */}
      <DialogTitle sx={{ 
        background: 'linear-gradient(135deg, #0071e3 0%, #0077ED 100%)', 
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        py: 2,
      }}>
        <ShoppingCart size={22} />
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: '1.1rem' }}>ยืนยันการสั่งซื้อ</Typography>
          <Typography sx={{ fontSize: '0.75rem', opacity: 0.85 }}>{cart.length} รายการ</Typography>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: 2, 
        pt: 3, 
        bgcolor: 'var(--background)',
        pb: 2,
      }}>
        {/* Order Summary */}
        <Box sx={{ 
          p: 2, 
          borderRadius: '18px',
          bgcolor: 'var(--surface-2)',
          border: '1px solid var(--glass-border)',
        }}>
          <Box 
            sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              cursor: 'pointer',
            }}
            onClick={() => setShowCartDetails(!showCartDetails)}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Package size={18} color="var(--text-muted)" />
              <Typography sx={{ fontWeight: 700, color: 'var(--foreground)', fontSize: '0.95rem' }}>
                สรุปคำสั่งซื้อ
              </Typography>
              <Box sx={{
                px: 1,
                py: 0.2,
                borderRadius: '10px',
                bgcolor: 'rgba(0,113,227,0.2)',
                fontSize: '0.7rem',
                fontWeight: 600,
                color: 'var(--secondary)',
              }}>
                {cart.reduce((sum, item) => sum + item.quantity, 0)} ชิ้น
              </Box>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography sx={{ fontWeight: 700, color: '#34c759', fontSize: '1rem' }}>
                ฿{subtotal.toLocaleString()}
              </Typography>
                {showCartDetails ? <ChevronUp size={18} color="var(--text-muted)" /> : <ChevronDown size={18} color="var(--text-muted)" />}
            </Box>
          </Box>

          <Collapse in={showCartDetails}>
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: 1,
              mt: 2,
              maxHeight: 200,
              overflow: 'auto',
            }}>
              {cart.map((item) => {
                const productInfo = products?.find(p => p.id === item.productId);
                const productImage = productInfo?.images?.[0];
                
                return (
                  <Box key={item.id} sx={{ 
                    display: 'flex', 
                    gap: 1.5,
                    p: 1.5,
                    borderRadius: '12px',
                    bgcolor: 'var(--surface)',
                    border: '1px solid var(--glass-border)',
                  }}>
                    <Box sx={{
                      width: 48,
                      height: 48,
                      borderRadius: '10px',
                      bgcolor: 'var(--surface-2)',
                      backgroundImage: productImage ? `url(${productImage})` : undefined,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid var(--glass-border)',
                    }}>
                      {!productImage && <Package size={18} style={{ color: 'var(--text-muted)' }} />}
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
                        {item.productName}
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
                      </Box>
                    </Box>
                    <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#34c759' }}>
                      ฿{(item.unitPrice * item.quantity).toLocaleString()}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          </Collapse>
        </Box>

        {/* Shipping Options */}
        {loadingConfig ? (
          <Skeleton variant="rounded" height={120} sx={{ bgcolor: 'var(--glass-bg)' }} />
        ) : enabledShippingOptions.length > 0 && shippingConfig?.showOptions && (
          <Box sx={{ 
            p: 2, 
            borderRadius: '18px',
            bgcolor: 'rgba(6,182,212,0.08)',
            border: '1px solid rgba(6,182,212,0.2)',
          }}>
            <Box 
              sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                cursor: 'pointer',
                mb: showShippingOptions ? 1.5 : 0,
              }}
              onClick={() => setShowShippingOptions(!showShippingOptions)}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Truck size={18} color="#64d2ff" />
                <Typography sx={{ fontWeight: 700, color: 'var(--foreground)', fontSize: '0.95rem' }}>
                  วิธีจัดส่ง
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {selectedShippingOption && (
                  <Typography sx={{ fontSize: '0.8rem', color: '#64d2ff' }}>
                    {selectedShippingOption.name}
                  </Typography>
                )}
                {showShippingOptions ? <ChevronUp size={18} color="var(--text-muted)" /> : <ChevronDown size={18} color="var(--text-muted)" />}
              </Box>
            </Box>

            <Collapse in={showShippingOptions}>
              <RadioGroup
                value={selectedShipping}
                onChange={(e) => setSelectedShipping(e.target.value)}
              >
                {enabledShippingOptions.map((option) => {
                  const isSelected = selectedShipping === option.id;
                  const isFreeShipping = option.freeShippingMinimum && subtotal >= option.freeShippingMinimum;
                  
                  return (
                    <FormControlLabel
                      key={option.id}
                      value={option.id}
                      control={<Radio sx={{ color: '#64d2ff', '&.Mui-checked': { color: '#64d2ff' } }} />}
                      label={
                        <Box sx={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'space-between',
                          width: '100%',
                          py: 0.5,
                        }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Box sx={{
                              width: 36,
                              height: 36,
                              borderRadius: '10px',
                              bgcolor: isSelected ? 'rgba(6,182,212,0.2)' : 'var(--surface-2)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: isSelected ? '#64d2ff' : 'var(--text-muted)',
                            }}>
                              {SHIPPING_ICONS[option.provider] || <Truck size={18} />}
                            </Box>
                            <Box>
                              <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--foreground)' }}>
                                {option.name}
                              </Typography>
                              {option.estimatedDays && (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.3 }}>
                                  <Clock size={12} color="var(--text-muted)" />
                                  <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                    {option.estimatedDays.min === option.estimatedDays.max 
                                      ? `${option.estimatedDays.min} วัน`
                                      : `${option.estimatedDays.min}-${option.estimatedDays.max} วัน`
                                    }
                                  </Typography>
                                </Box>
                              )}
                            </Box>
                          </Box>
                          <Box sx={{ textAlign: 'right' }}>
                            {isFreeShipping ? (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Typography sx={{ fontSize: '0.8rem', color: '#34c759', fontWeight: 700 }}>
                                  ฟรี
                                </Typography>
                                <Box sx={{
                                  px: 0.8,
                                  py: 0.2,
                                  borderRadius: '6px',
                                  bgcolor: 'rgba(16,185,129,0.15)',
                                  fontSize: '0.6rem',
                                  color: '#30d158',
                                }}>
                                  ส่งฟรี
                                </Box>
                              </Box>
                            ) : (
                              <Typography sx={{ fontSize: '0.85rem', color: 'var(--foreground)', fontWeight: 600 }}>
                                ฿{(option.baseFee || 0).toLocaleString()}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      }
                      sx={{
                        mx: 0,
                        mb: 1,
                        p: 1,
                        borderRadius: '12px',
                        bgcolor: isSelected ? 'rgba(6,182,212,0.1)' : 'transparent',
                        border: `1px solid ${isSelected ? 'rgba(6,182,212,0.3)' : 'transparent'}`,
                        '&:hover': { bgcolor: 'rgba(6,182,212,0.05)' },
                        '& .MuiFormControlLabel-label': { flex: 1 },
                      }}
                    />
                  );
                })}
              </RadioGroup>
            </Collapse>
          </Box>
        )}

        {/* Payment Options */}
        {loadingConfig ? (
          <Skeleton variant="rounded" height={120} sx={{ bgcolor: 'var(--glass-bg)' }} />
        ) : enabledPaymentOptions.length > 0 && (
          <Box sx={{ 
            p: 2, 
            borderRadius: '18px',
            bgcolor: 'rgba(16,185,129,0.08)',
            border: '1px solid rgba(16,185,129,0.2)',
          }}>
            <Box 
              sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                cursor: 'pointer',
                mb: showPaymentOptions ? 1.5 : 0,
              }}
              onClick={() => setShowPaymentOptions(!showPaymentOptions)}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CreditCard size={18} color="#34c759" />
                <Typography sx={{ fontWeight: 700, color: 'var(--foreground)', fontSize: '0.95rem' }}>
                  วิธีชำระเงิน
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {selectedPaymentOption && (
                  <Typography sx={{ fontSize: '0.8rem', color: '#34c759' }}>
                    {selectedPaymentOption.nameThai || selectedPaymentOption.name}
                  </Typography>
                )}
                {showPaymentOptions ? <ChevronUp size={18} color="var(--text-muted)" /> : <ChevronDown size={18} color="var(--text-muted)" />}
              </Box>
            </Box>

            <Collapse in={showPaymentOptions}>
              <RadioGroup
                value={selectedPayment}
                onChange={(e) => setSelectedPayment(e.target.value)}
              >
                {enabledPaymentOptions.map((option) => {
                  const isSelected = selectedPayment === option.id;
                  
                  return (
                    <FormControlLabel
                      key={option.id}
                      value={option.id}
                      control={<Radio sx={{ color: '#34c759', '&.Mui-checked': { color: '#34c759' } }} />}
                      label={
                        <Box sx={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'space-between',
                          width: '100%',
                          py: 0.5,
                        }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Box sx={{
                              width: 36,
                              height: 36,
                              borderRadius: '10px',
                              bgcolor: isSelected ? 'rgba(16,185,129,0.2)' : 'var(--surface-2)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: isSelected ? '#34c759' : 'var(--text-muted)',
                            }}>
                              {PAYMENT_ICONS[option.method] || <CreditCard size={18} />}
                            </Box>
                            <Box>
                              <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--foreground)' }}>
                                {option.nameThai || option.name}
                              </Typography>
                              {option.description && (
                                <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                  {option.description}
                                </Typography>
                              )}
                            </Box>
                          </Box>
                          {option.feeAmount && option.feeAmount > 0 && (
                            <Typography sx={{ fontSize: '0.75rem', color: '#ff9f0a' }}>
                              +{option.feeType === 'percentage' ? `${option.feeAmount}%` : `฿${option.feeAmount}`}
                            </Typography>
                          )}
                        </Box>
                      }
                      sx={{
                        mx: 0,
                        mb: 1,
                        p: 1,
                        borderRadius: '12px',
                        bgcolor: isSelected ? 'rgba(16,185,129,0.1)' : 'transparent',
                        border: `1px solid ${isSelected ? 'rgba(16,185,129,0.3)' : 'transparent'}`,
                        '&:hover': { bgcolor: 'rgba(16,185,129,0.05)' },
                        '& .MuiFormControlLabel-label': { flex: 1 },
                      }}
                    />
                  );
                })}
              </RadioGroup>
            </Collapse>
          </Box>
        )}

        {/* Recipient Info */}
        <Box sx={{ 
          p: 2, 
          borderRadius: '18px',
          bgcolor: 'rgba(0,113,227,0.08)', 
          border: '1px solid rgba(0,113,227,0.2)',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <User size={18} color="#2997ff" />
              <Typography sx={{ fontWeight: 700, color: 'var(--foreground)', fontSize: '0.95rem' }}>ข้อมูลผู้รับสินค้า</Typography>
            </Box>
            <Button 
              size="small" 
              onClick={onEditProfile}
              sx={{ 
                borderRadius: '8px',
                px: 1.5,
                bgcolor: 'rgba(0,113,227,0.15)',
                color: 'var(--secondary)', 
                fontSize: '0.75rem',
                fontWeight: 600,
                '&:hover': { bgcolor: 'rgba(0,113,227,0.25)' },
              }}
            >
              แก้ไข
            </Button>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Typography sx={{ color: 'var(--foreground)', fontSize: '0.9rem' }}>
              <Box component="span" sx={{ color: 'var(--text-muted)', mr: 1 }}>ชื่อ:</Box>{orderData.name || '—'}
            </Typography>
            <Typography sx={{ color: 'var(--foreground)', fontSize: '0.9rem' }}>
              <Box component="span" sx={{ color: 'var(--text-muted)', mr: 1 }}>โทร:</Box>{orderData.phone || '—'}
            </Typography>
            <Typography sx={{ color: 'var(--foreground)', fontSize: '0.9rem' }}>
              <Box component="span" sx={{ color: 'var(--text-muted)', mr: 1 }}>IG:</Box>{orderData.instagram || '—'}
            </Typography>
            {/* Address - always show with required indicator for delivery */}
            {savedAddresses.length > 1 && requiresAddress ? (
              <Box sx={{ mt: 0.5 }}>
                <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.85rem', mb: 0.5 }}>
                  ที่อยู่จัดส่ง:<Box component="span" sx={{ color: '#ff453a', ml: 0.3 }}>*</Box>
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  {savedAddresses.map((addr) => (
                    <Box
                      key={addr.id}
                      onClick={() => onAddressChange?.(addr.address)}
                      sx={{
                        p: 1,
                        borderRadius: '10px',
                        cursor: 'pointer',
                        bgcolor: orderData.address === addr.address ? 'rgba(0,113,227,0.08)' : 'var(--surface)',
                        border: orderData.address === addr.address ? '2px solid rgba(0,113,227,0.4)' : '1px solid var(--glass-border)',
                        transition: 'all 0.2s ease',
                        '&:hover': { borderColor: 'rgba(0,113,227,0.3)' },
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.3 }}>
                        <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: orderData.address === addr.address ? 'var(--primary)' : 'var(--text-muted)' }}>
                          {addr.label}
                        </Typography>
                        {addr.isDefault && (
                          <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--success)', bgcolor: 'rgba(16,185,129,0.1)', px: 0.5, borderRadius: '4px' }}>
                            หลัก
                          </Typography>
                        )}
                      </Box>
                      <Typography sx={{ fontSize: '0.8rem', color: 'var(--foreground)', lineHeight: 1.4 }}>
                        {addr.address}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            ) : (
              <Typography sx={{ color: 'var(--foreground)', fontSize: '0.9rem', display: 'flex', alignItems: 'flex-start' }}>
                <Box component="span" sx={{ color: 'var(--text-muted)', mr: 1, flexShrink: 0 }}>
                  ที่อยู่:{requiresAddress && <Box component="span" sx={{ color: '#ff453a', ml: 0.3 }}>*</Box>}
                </Box>
                <Box component="span" sx={{ color: orderData.address ? 'var(--foreground)' : 'var(--text-muted)' }}>
                  {orderData.address || (requiresAddress ? 'กรุณากรอกที่อยู่จัดส่ง' : '—')}
                </Box>
              </Typography>
            )}
          </Box>
          {/* Profile incomplete warning */}
          {!profileComplete && (
            <Box sx={{ 
              mt: 1.5, 
              p: 1, 
              borderRadius: '8px',
              bgcolor: 'rgba(249,115,22,0.1)',
              border: '1px solid rgba(249,115,22,0.3)',
            }}>
              <Typography sx={{ color: '#fb923c', fontSize: '0.8rem', fontWeight: 600 }}>
                กรุณาบันทึกโปรไฟล์ (ชื่อไทย, เบอร์, IG) ก่อนยืนยัน
              </Typography>
            </Box>
          )}
          {/* Address required warning for delivery */}
          {addressMissing && profileComplete && (
            <Box sx={{ 
              mt: 1.5, 
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
                กรุณากรอกที่อยู่สำหรับจัดส่งสินค้า
              </Typography>
            </Box>
          )}
        </Box>

        {/* Promo Code */}
        <Box sx={{ 
          p: 2, 
          borderRadius: '18px',
          bgcolor: 'var(--surface-2)',
          border: promoResult?.valid ? '1px solid rgba(52,199,89,0.4)' : '1px solid var(--glass-border)',
          transition: 'border-color 0.3s ease',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <Ticket size={16} style={{ color: promoResult?.valid ? '#34c759' : 'var(--text-muted)' }} />
            <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--foreground)' }}>
              รหัสส่วนลด
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
                '&:hover': { color: '#ef4444' } 
              }}>
                <X size={16} />
              </Button>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                size="small"
                placeholder="กรอกรหัสส่วนลด"
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
                {promoLoading ? <CircularProgress size={16} /> : 'ใช้โค้ด'}
              </Button>
            </Box>
          )}
        </Box>

        {/* Price Summary */}
        <Box sx={{ 
          p: 2, 
          borderRadius: '18px',
          bgcolor: 'var(--surface-2)',
          border: '1px solid var(--glass-border)',
        }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>ราคาสินค้า</Typography>
            <Typography sx={{ color: 'var(--foreground)', fontSize: '0.85rem' }}>฿{subtotal.toLocaleString()}</Typography>
          </Box>
          {shippingFee > 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>ค่าจัดส่ง</Typography>
              <Typography sx={{ color: 'var(--foreground)', fontSize: '0.85rem' }}>฿{shippingFee.toLocaleString()}</Typography>
            </Box>
          )}
          {shippingFee === 0 && selectedShippingOption && selectedShippingOption.baseFee > 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>ค่าจัดส่ง</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.8rem', textDecoration: 'line-through' }}>
                  ฿{selectedShippingOption.baseFee}
                </Typography>
                <Typography sx={{ color: '#34c759', fontSize: '0.85rem', fontWeight: 600 }}>ฟรี</Typography>
              </Box>
            </Box>
          )}
          {paymentFee > 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>ค่าธรรมเนียม</Typography>
              <Typography sx={{ color: '#ff9f0a', fontSize: '0.85rem' }}>฿{paymentFee.toLocaleString()}</Typography>
            </Box>
          )}
          {promoDiscount > 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography sx={{ color: '#34c759', fontSize: '0.85rem', fontWeight: 600 }}>
                ส่วนลด ({promoResult?.code})
              </Typography>
              <Typography sx={{ color: '#34c759', fontSize: '0.85rem', fontWeight: 700 }}>
                -฿{promoDiscount.toLocaleString()}
              </Typography>
            </Box>
          )}
          <Divider sx={{ my: 1.5, borderColor: 'var(--glass-border)' }} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography sx={{ fontWeight: 700, color: 'var(--foreground)', fontSize: '1rem' }}>ยอดรวมทั้งหมด</Typography>
            <Typography sx={{ fontWeight: 900, color: '#34c759', fontSize: '1.4rem' }}>
              ฿{total.toLocaleString()}
            </Typography>
          </Box>
        </Box>

        {/* Turnstile */}
        <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1 }}>
          <TurnstileWidget
            onSuccess={(token) => setTurnstileToken(token)}
            onExpire={() => setTurnstileToken('')}
            onError={() => setTurnstileToken('')}
            theme="dark"
            size="normal"
            action="order"
          />
        </Box>
      </DialogContent>

      {/* Actions */}
      <DialogActions sx={{ 
        p: 2, 
        gap: 1, 
        borderTop: '1px solid var(--glass-border)',
        bgcolor: 'var(--background)',
      }}>
        <Button
          onClick={onClose}
          sx={{ 
            flex: 1,
            py: 1.3,
            color: 'var(--text-muted)', 
            borderRadius: '14px',
            fontSize: '0.9rem',
            fontWeight: 600,
            '&:hover': { bgcolor: 'var(--glass-bg)' },
          }}
        >
          ยกเลิก
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!canSubmit}
          startIcon={processing ? <CircularProgress size={18} color="inherit" /> : <Check size={18} />}
          sx={{ 
            flex: 2,
            py: 1.3,
            borderRadius: '14px',
            fontSize: '0.9rem',
            fontWeight: 700,
            background: canSubmit 
              ? 'linear-gradient(135deg, #34c759 0%, #34c759 100%)'
              : 'rgba(100,116,139,0.3)',
            color: canSubmit ? 'white' : 'var(--text-muted)',
            boxShadow: canSubmit ? '0 4px 14px rgba(16,185,129,0.4)' : 'none',
            '&:hover': {
              background: canSubmit 
                ? 'linear-gradient(135deg, #34c759 0%, #047857 100%)'
                : 'rgba(100,116,139,0.3)',
            },
            '&:disabled': {
              color: 'var(--text-muted)',
            },
          }}
        >
          {processing ? 'กำลังดำเนินการ...' : `ยืนยันสั่งซื้อ ฿${total.toLocaleString()}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
