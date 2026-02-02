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
} from 'lucide-react';
import { ShippingConfig, ShippingOption } from '@/lib/shipping';
import { PaymentConfig, PaymentOption } from '@/lib/payment';
import TurnstileWidget from './TurnstileWidget';

// ==================== TYPES ====================

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
  }) => void;
  onEditProfile: () => void;
  products?: Product[];
  isMobile?: boolean;
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

  const total = useMemo(() => {
    return subtotal + shippingFee + paymentFee;
  }, [subtotal, shippingFee, paymentFee]);

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
      // Use empty string check: if empty string, use 'pickup' as default
      shippingOptionId: selectedShipping || 'pickup',
      paymentOptionId: selectedPayment || 'bank_transfer',
      shippingFee,
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
          bgcolor: '#0a0f1a',
          color: '#f1f5f9',
          borderRadius: isMobile ? 0 : '20px',
          border: isMobile ? 'none' : '1px solid rgba(255,255,255,0.1)',
          maxHeight: isMobile ? '100vh' : '90vh',
        },
      }}
    >
      {/* Header */}
      <DialogTitle sx={{ 
        background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', 
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
        bgcolor: '#0a0f1a',
        pb: 2,
      }}>
        {/* Order Summary */}
        <Box sx={{ 
          p: 2, 
          borderRadius: '18px',
          bgcolor: 'rgba(30,41,59,0.6)',
          border: '1px solid rgba(255,255,255,0.06)',
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
              <Package size={18} color="#94a3b8" />
              <Typography sx={{ fontWeight: 700, color: '#f1f5f9', fontSize: '0.95rem' }}>
                สรุปคำสั่งซื้อ
              </Typography>
              <Box sx={{
                px: 1,
                py: 0.2,
                borderRadius: '10px',
                bgcolor: 'rgba(99,102,241,0.2)',
                fontSize: '0.7rem',
                fontWeight: 600,
                color: '#a5b4fc',
              }}>
                {cart.reduce((sum, item) => sum + item.quantity, 0)} ชิ้น
              </Box>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography sx={{ fontWeight: 700, color: '#10b981', fontSize: '1rem' }}>
                ฿{subtotal.toLocaleString()}
              </Typography>
              {showCartDetails ? <ChevronUp size={18} color="#94a3b8" /> : <ChevronDown size={18} color="#94a3b8" />}
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
                    bgcolor: 'rgba(15,23,42,0.6)',
                    border: '1px solid rgba(255,255,255,0.04)',
                  }}>
                    <Box sx={{
                      width: 48,
                      height: 48,
                      borderRadius: '10px',
                      bgcolor: '#0b1224',
                      backgroundImage: productImage ? `url(${productImage})` : undefined,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid rgba(255,255,255,0.06)',
                    }}>
                      {!productImage && <Package size={18} style={{ color: '#475569' }} />}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ 
                        fontSize: '0.8rem', 
                        fontWeight: 600, 
                        color: '#e2e8f0',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {item.productName}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                        {item.size && item.size !== '-' && (
                          <Box sx={{ px: 0.6, py: 0.1, borderRadius: '4px', bgcolor: 'rgba(99,102,241,0.15)', fontSize: '0.65rem', color: '#a5b4fc' }}>
                            {item.size}
                          </Box>
                        )}
                        <Box sx={{ px: 0.6, py: 0.1, borderRadius: '4px', bgcolor: 'rgba(255,255,255,0.08)', fontSize: '0.65rem', color: '#94a3b8' }}>
                          x{item.quantity}
                        </Box>
                      </Box>
                    </Box>
                    <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#10b981' }}>
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
          <Skeleton variant="rounded" height={120} sx={{ bgcolor: 'rgba(255,255,255,0.05)' }} />
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
                <Truck size={18} color="#22d3ee" />
                <Typography sx={{ fontWeight: 700, color: '#f1f5f9', fontSize: '0.95rem' }}>
                  วิธีจัดส่ง
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {selectedShippingOption && (
                  <Typography sx={{ fontSize: '0.8rem', color: '#22d3ee' }}>
                    {selectedShippingOption.name}
                  </Typography>
                )}
                {showShippingOptions ? <ChevronUp size={18} color="#94a3b8" /> : <ChevronDown size={18} color="#94a3b8" />}
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
                      control={<Radio sx={{ color: '#22d3ee', '&.Mui-checked': { color: '#22d3ee' } }} />}
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
                              bgcolor: isSelected ? 'rgba(6,182,212,0.2)' : 'rgba(255,255,255,0.05)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: isSelected ? '#22d3ee' : '#64748b',
                            }}>
                              {SHIPPING_ICONS[option.provider] || <Truck size={18} />}
                            </Box>
                            <Box>
                              <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: '#e2e8f0' }}>
                                {option.name}
                              </Typography>
                              {option.estimatedDays && (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.3 }}>
                                  <Clock size={12} color="#64748b" />
                                  <Typography sx={{ fontSize: '0.7rem', color: '#64748b' }}>
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
                                <Typography sx={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 700 }}>
                                  ฟรี
                                </Typography>
                                <Box sx={{
                                  px: 0.8,
                                  py: 0.2,
                                  borderRadius: '6px',
                                  bgcolor: 'rgba(16,185,129,0.15)',
                                  fontSize: '0.6rem',
                                  color: '#34d399',
                                }}>
                                  ส่งฟรี
                                </Box>
                              </Box>
                            ) : (
                              <Typography sx={{ fontSize: '0.85rem', color: '#f1f5f9', fontWeight: 600 }}>
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
          <Skeleton variant="rounded" height={120} sx={{ bgcolor: 'rgba(255,255,255,0.05)' }} />
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
                <CreditCard size={18} color="#10b981" />
                <Typography sx={{ fontWeight: 700, color: '#f1f5f9', fontSize: '0.95rem' }}>
                  วิธีชำระเงิน
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {selectedPaymentOption && (
                  <Typography sx={{ fontSize: '0.8rem', color: '#10b981' }}>
                    {selectedPaymentOption.nameThai || selectedPaymentOption.name}
                  </Typography>
                )}
                {showPaymentOptions ? <ChevronUp size={18} color="#94a3b8" /> : <ChevronDown size={18} color="#94a3b8" />}
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
                      control={<Radio sx={{ color: '#10b981', '&.Mui-checked': { color: '#10b981' } }} />}
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
                              bgcolor: isSelected ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.05)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: isSelected ? '#10b981' : '#64748b',
                            }}>
                              {PAYMENT_ICONS[option.method] || <CreditCard size={18} />}
                            </Box>
                            <Box>
                              <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: '#e2e8f0' }}>
                                {option.nameThai || option.name}
                              </Typography>
                              {option.description && (
                                <Typography sx={{ fontSize: '0.7rem', color: '#64748b' }}>
                                  {option.description}
                                </Typography>
                              )}
                            </Box>
                          </Box>
                          {option.feeAmount && option.feeAmount > 0 && (
                            <Typography sx={{ fontSize: '0.75rem', color: '#f59e0b' }}>
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
          bgcolor: 'rgba(99,102,241,0.08)', 
          border: '1px solid rgba(99,102,241,0.2)',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <User size={18} color="#a5b4fc" />
              <Typography sx={{ fontWeight: 700, color: '#f1f5f9', fontSize: '0.95rem' }}>ข้อมูลผู้รับสินค้า</Typography>
            </Box>
            <Button 
              size="small" 
              onClick={onEditProfile}
              sx={{ 
                borderRadius: '8px',
                px: 1.5,
                bgcolor: 'rgba(99,102,241,0.15)',
                color: '#a5b4fc', 
                fontSize: '0.75rem',
                fontWeight: 600,
                '&:hover': { bgcolor: 'rgba(99,102,241,0.25)' },
              }}
            >
              แก้ไข
            </Button>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Typography sx={{ color: '#e2e8f0', fontSize: '0.9rem' }}>
              <Box component="span" sx={{ color: '#64748b', mr: 1 }}>ชื่อ:</Box>{orderData.name || '—'}
            </Typography>
            <Typography sx={{ color: '#e2e8f0', fontSize: '0.9rem' }}>
              <Box component="span" sx={{ color: '#64748b', mr: 1 }}>โทร:</Box>{orderData.phone || '—'}
            </Typography>
            <Typography sx={{ color: '#e2e8f0', fontSize: '0.9rem' }}>
              <Box component="span" sx={{ color: '#64748b', mr: 1 }}>IG:</Box>{orderData.instagram || '—'}
            </Typography>
            {/* Address - always show with required indicator for delivery */}
            <Typography sx={{ color: '#e2e8f0', fontSize: '0.9rem', display: 'flex', alignItems: 'flex-start' }}>
              <Box component="span" sx={{ color: '#64748b', mr: 1, flexShrink: 0 }}>
                ที่อยู่:{requiresAddress && <Box component="span" sx={{ color: '#ef4444', ml: 0.3 }}>*</Box>}
              </Box>
              <Box component="span" sx={{ color: orderData.address ? '#e2e8f0' : '#64748b' }}>
                {orderData.address || (requiresAddress ? 'กรุณากรอกที่อยู่จัดส่ง' : '—')}
              </Box>
            </Typography>
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

        {/* Price Summary */}
        <Box sx={{ 
          p: 2, 
          borderRadius: '18px',
          bgcolor: 'rgba(30,41,59,0.8)',
          border: '1px solid rgba(255,255,255,0.1)',
        }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography sx={{ color: '#94a3b8', fontSize: '0.85rem' }}>ราคาสินค้า</Typography>
            <Typography sx={{ color: '#e2e8f0', fontSize: '0.85rem' }}>฿{subtotal.toLocaleString()}</Typography>
          </Box>
          {shippingFee > 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography sx={{ color: '#94a3b8', fontSize: '0.85rem' }}>ค่าจัดส่ง</Typography>
              <Typography sx={{ color: '#e2e8f0', fontSize: '0.85rem' }}>฿{shippingFee.toLocaleString()}</Typography>
            </Box>
          )}
          {shippingFee === 0 && selectedShippingOption && selectedShippingOption.baseFee > 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography sx={{ color: '#94a3b8', fontSize: '0.85rem' }}>ค่าจัดส่ง</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Typography sx={{ color: '#64748b', fontSize: '0.8rem', textDecoration: 'line-through' }}>
                  ฿{selectedShippingOption.baseFee}
                </Typography>
                <Typography sx={{ color: '#10b981', fontSize: '0.85rem', fontWeight: 600 }}>ฟรี</Typography>
              </Box>
            </Box>
          )}
          {paymentFee > 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography sx={{ color: '#94a3b8', fontSize: '0.85rem' }}>ค่าธรรมเนียม</Typography>
              <Typography sx={{ color: '#f59e0b', fontSize: '0.85rem' }}>฿{paymentFee.toLocaleString()}</Typography>
            </Box>
          )}
          <Divider sx={{ my: 1.5, borderColor: 'rgba(255,255,255,0.1)' }} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography sx={{ fontWeight: 700, color: '#f1f5f9', fontSize: '1rem' }}>ยอดรวมทั้งหมด</Typography>
            <Typography sx={{ fontWeight: 900, color: '#10b981', fontSize: '1.4rem' }}>
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
        borderTop: '1px solid rgba(255,255,255,0.08)',
        bgcolor: '#0a0f1a',
      }}>
        <Button
          onClick={onClose}
          sx={{ 
            flex: 1,
            py: 1.3,
            color: '#94a3b8', 
            borderRadius: '14px',
            fontSize: '0.9rem',
            fontWeight: 600,
            '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
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
              ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
              : 'rgba(100,116,139,0.3)',
            color: canSubmit ? 'white' : '#64748b',
            boxShadow: canSubmit ? '0 4px 14px rgba(16,185,129,0.4)' : 'none',
            '&:hover': {
              background: canSubmit 
                ? 'linear-gradient(135deg, #059669 0%, #047857 100%)'
                : 'rgba(100,116,139,0.3)',
            },
            '&:disabled': {
              color: '#64748b',
            },
          }}
        >
          {processing ? 'กำลังดำเนินการ...' : `ยืนยันสั่งซื้อ ฿${total.toLocaleString()}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
