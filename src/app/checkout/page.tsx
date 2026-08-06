/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Box,
  Container,
  Typography,
  Button,
  TextField,
  Paper,
  Divider,
  Radio,
  RadioGroup,
  FormControlLabel,
  Switch,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  Skeleton,
  Chip,
} from '@mui/material';
import {
  ArrowLeft,
  CheckCircle2,
  MapPin,
  ShieldCheck,
  CreditCard,
  QrCode,
  FileText,
  User,
  Tag,
  Truck,
  Store,
} from 'lucide-react';
import StorefrontNavbar from '@/components/StorefrontNavbar';
import MobileBottomNav from '@/components/MobileBottomNav';
import TurnstileWidget from '@/components/TurnstileWidget';
import { useCartStore } from '@/store/cartStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useSession } from 'next-auth/react';
import { apiFetch } from '@/lib/api-client';
import { ShippingConfig, ShippingOption } from '@/lib/shipping';

export default function StandaloneCheckoutPage() {
  const router = useRouter();
  const { lang } = useTranslation();
  const { data: session } = useSession();
  const cart = useCartStore((s) => s.cart);
  const clearCart = useCartStore((s) => s.clearCart);

  // Wait for Zustand persist hydration from localStorage
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [studentId, setStudentId] = useState('');

  // Dynamic Shipping & Payment Config from API
  const [shippingConfig, setShippingConfig] = useState<ShippingConfig | null>(null);
  const [selectedShippingId, setSelectedShippingId] = useState<string>('pickup');
  const [loadingConfig, setLoadingConfig] = useState(true);

  const [paymentGateway, setPaymentGateway] = useState<'promptpay' | 'credit_card' | 'manual'>('promptpay');
  const [stripePromptPayEnabled, setStripePromptPayEnabled] = useState(true);
  const [stripeCardEnabled, setStripeCardEnabled] = useState(true);
  const [manualEnabled, setManualEnabled] = useState(true);

  const [turnstileToken, setTurnstileToken] = useState('');
  const [wantReceipt, setWantReceipt] = useState(false);
  const [taxId, setTaxId] = useState('');
  const [orgName, setOrgName] = useState('');
  const [receiptAddress, setReceiptAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState('');
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoMsg, setPromoMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (session?.user) {
      if (session.user.name && !customerName) setCustomerName(session.user.name);
      if (session.user.email && !customerEmail) setCustomerEmail(session.user.email);
    }
  }, [session]);

  // Fetch Shipping & Payment Configuration
  useEffect(() => {
    let active = true;
    Promise.all([
      apiFetch('/api/shipping/options').then((r) => r.json()).catch(() => null),
      apiFetch('/api/payment/config').then((r) => r.json()).catch(() => null),
    ]).then(([shipData, payData]) => {
      if (!active) return;
      if (shipData?.success && shipData?.data) {
        setShippingConfig(shipData.data);
        const enabled = (shipData.data.options as ShippingOption[])?.filter((o) => o.enabled) || [];
        if (enabled.length > 0) {
          const defaultOpt = enabled.find((o) => o.id === shipData.data.defaultOptionId) || enabled[0];
          setSelectedShippingId(defaultOpt.id);
        }
      }

      if (payData?.success && payData?.data) {
        const pData = payData.data;
        const promptPayOk = typeof pData.stripePromptPayEnabled === 'boolean' ? pData.stripePromptPayEnabled : true;
        const cardOk = typeof pData.stripeCardEnabled === 'boolean' ? pData.stripeCardEnabled : true;
        const manualOpt = pData.options?.find((o: any) => o.method === 'bank_transfer' || o.id === 'bank_transfer');
        const manualOk = manualOpt ? manualOpt.enabled !== false : true;

        setStripePromptPayEnabled(promptPayOk);
        setStripeCardEnabled(cardOk);
        setManualEnabled(manualOk);

        if (promptPayOk) setPaymentGateway('promptpay');
        else if (cardOk) setPaymentGateway('credit_card');
        else if (manualOk) setPaymentGateway('manual');
      }
    }).finally(() => {
      if (active) setLoadingConfig(false);
    });

    return () => { active = false; };
  }, []);

  const getItemUnitPrice = (item: any) => Number(item.unitPrice ?? item.price ?? 0);
  const getItemQty = (item: any) => Number(item.quantity ?? item.qty ?? 1);
  const getItemTotal = (item: any) => {
    if (item.total != null && Number(item.total) > 0) return Number(item.total);
    if (item.subtotal != null && Number(item.subtotal) > 0) return Number(item.subtotal);
    return getItemUnitPrice(item) * getItemQty(item);
  };
  const getItemName = (item: any) => item.productName || item.name || 'สินค้า';

  const totalAmount = useMemo(
    () => cart.reduce((sum, item) => sum + getItemTotal(item), 0),
    [cart]
  );
  const totalItems = useMemo(
    () => cart.reduce((sum, item) => sum + getItemQty(item), 0),
    [cart]
  );

  const enabledShippingOptions = useMemo(() => {
    return shippingConfig?.options?.filter((o: ShippingOption) => o.enabled) || [];
  }, [shippingConfig]);

  const selectedShippingOption = useMemo(() => {
    return enabledShippingOptions.find((o) => o.id === selectedShippingId) || enabledShippingOptions[0];
  }, [enabledShippingOptions, selectedShippingId]);

  const isPickupSelected = useMemo(() => {
    if (!selectedShippingOption) return true;
    return selectedShippingOption.provider === 'pickup';
  }, [selectedShippingOption]);

  const shippingFee = useMemo(() => {
    if (!selectedShippingOption || isPickupSelected) return 0;

    const freeMin = shippingConfig?.globalFreeShippingMinimum || selectedShippingOption.freeShippingMinimum;
    if (freeMin && totalAmount >= freeMin) return 0;

    let fee = selectedShippingOption.baseFee || 0;
    if (selectedShippingOption.perItemFee && totalItems > 1) {
      fee += (totalItems - 1) * selectedShippingOption.perItemFee;
    }
    return fee;
  }, [selectedShippingOption, isPickupSelected, shippingConfig, totalAmount, totalItems]);

  const handleApplyPromo = async () => {
    if (!promoCode.trim()) return;
    setPromoLoading(true);
    setPromoMsg(null);
    try {
      const res = await apiFetch('/api/promo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: promoCode.trim(), amount: totalAmount }),
      });
      const data = await res.json();
      if (res.ok && data.valid) {
        setPromoDiscount(data.discount || 0);
        setPromoMsg({ type: 'success', text: `ใช้ส่วนลดสำเร็จ! ลด ฿${data.discount}` });
      } else {
        setPromoDiscount(0);
        setPromoMsg({ type: 'error', text: data.error || 'โค้ดส่วนลดไม่ถูกต้องหรือหมดอายุ' });
      }
    } catch {
      setPromoMsg({ type: 'error', text: 'ไม่สามารถตรวจสอบโค้ดส่วนลดได้' });
    } finally {
      setPromoLoading(false);
    }
  };

  const finalTotal = Math.max(0, totalAmount + shippingFee - promoDiscount);

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) {
      setErrorMsg('ไม่มีสินค้าในตะกร้า');
      return;
    }
    if (!customerName.trim() || !customerEmail.trim()) {
      setErrorMsg('กรุณากรอกชื่อ-นามสกุล และอีเมลให้ครบถ้วน');
      return;
    }
    if (!isPickupSelected && !address.trim()) {
      setErrorMsg('กรุณากรอกที่อยู่สำหรับจัดส่งพัสดุ');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    // Validate live stock before placing order
    try {
      const catRes = await apiFetch('/api/shops/catalog').then((r) => r.json()).catch(() => null);
      if (catRes?.shops || catRes?.data) {
        const shops = catRes.shops || catRes.data || [];
        const prodMap: Record<string, any> = {};
        for (const s of shops) {
          for (const p of s.products || []) {
            prodMap[p.id] = p;
          }
        }

        for (const item of cart) {
          const pId = item.productId || item.id?.split('-')[0];
          const prod = prodMap[pId];
          if (!prod) continue;

          let maxStock: number | null = prod.stock ?? null;
          const variantId = item.selectedVariant?.id || item.size;
          if (prod.variants && prod.variants.length > 0 && variantId) {
            const v = prod.variants.find((x: any) => x.id === variantId);
            if (v && typeof v.stock === 'number') maxStock = v.stock;
          }

          const qty = getItemQty(item);
          if (maxStock !== null && maxStock <= 0) {
            setLoading(false);
            setErrorMsg(`สินค้า "${getItemName(item)}" หมดแล้ว ไม่สามารถสั่งซื้อได้`);
            return;
          }
          if (maxStock !== null && qty > maxStock) {
            setLoading(false);
            setErrorMsg(`สินค้า "${getItemName(item)}" มีในสต็อกเพียง ${maxStock} ชิ้น (ในตะกร้ามี ${qty} ชิ้น)`);
            return;
          }
        }
      }
    } catch {
      /* continue order creation; backend will also validate */
    }

    try {
      const formattedCart = cart.map((item: any) => ({
        productId: item.productId || item.id || '',
        productName: getItemName(item),
        name: getItemName(item),
        size: item.size || '-',
        quantity: getItemQty(item),
        qty: getItemQty(item),
        unitPrice: getItemUnitPrice(item),
        price: getItemUnitPrice(item),
        total: getItemTotal(item),
        options: item.options || {
          customName: item.customName,
          customNumber: item.customNumber,
          isLongSleeve: item.sleeve === 'LONG',
          pattern: item.selectedPattern?.name || item.pattern,
        },
        pattern: item.selectedPattern?.name || item.pattern || item.options?.pattern,
        customName: item.customName || item.options?.customName,
        customNumber: item.customNumber || item.options?.customNumber,
        sleeve: item.sleeve || (item.options?.isLongSleeve ? 'LONG' : undefined),
      }));

      const payload = {
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim().toLowerCase(),
        phone: phone.trim(),
        customerAddress: !isPickupSelected ? address.trim() : (shippingConfig?.pickupLocation || 'รับที่ห้องชุมนุม SCC'),
        studentId: studentId.trim(),
        pickupLocation: !isPickupSelected ? 'DELIVERY' : 'SCC_CLUB',
        shippingOptionId: selectedShippingOption?.id || 'pickup',
        shippingFee,
        paymentMethod: paymentGateway,
        turnstileToken: turnstileToken || 'dev-bypass',
        cart: formattedCart,
        totalAmount: finalTotal,
        promoCode: promoDiscount > 0 ? promoCode.trim() : undefined,
        promoDiscount: promoDiscount > 0 ? promoDiscount : undefined,
        receiptRequest: wantReceipt
          ? {
              wanted: true,
              taxOrStudentId: taxId.trim(),
              orgName: orgName.trim(),
              address: receiptAddress.trim() || address.trim(),
            }
          : undefined,
      };

      const res = await apiFetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || data.status === 'error') {
        throw new Error(data.message || 'สร้างคำสั่งซื้อไม่สำเร็จ');
      }

      const orderRef = data.order?.ref || data.ref;
      if (orderRef) {
        try {
          const raw = localStorage.getItem('psu_scc_orders');
          const list = raw ? JSON.parse(raw) : [];
          if (!list.includes(orderRef)) {
            list.unshift(orderRef);
            localStorage.setItem('psu_scc_orders', JSON.stringify(list));
          }
        } catch { /* ignore */ }

        clearCart();
        router.push(`/payment/${encodeURIComponent(orderRef)}`);
      } else {
        throw new Error('ไม่ได้รับรหัสคำสั่งซื้อ');
      }
    } catch (err: any) {
      console.error('[Checkout] Error:', err);
      setErrorMsg(err?.message || 'เกิดข้อผิดพลาดในการสั่งซื้อ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: 'var(--background, #f8fafc)', pb: 10 }}>
        <StorefrontNavbar />
        <Container maxWidth="sm" sx={{ pt: 8, textAlign: 'center' }}>
          <CircularProgress size={36} sx={{ color: '#1e3a5f', mb: 2 }} />
          <Typography sx={{ color: '#64748b' }}>กำลังโหลดข้อมูลตะกร้าสินค้า...</Typography>
        </Container>
        <MobileBottomNav />
      </Box>
    );
  }

  if (cart.length === 0 && !loading) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: 'var(--background, #f8fafc)', pb: 10 }}>
        <StorefrontNavbar cartCount={0} />
        <Container maxWidth="sm" sx={{ pt: 8, textAlign: 'center' }}>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
            {lang === 'en' ? 'Your cart is empty' : 'ไม่มีสินค้าในตะกร้า'}
          </Typography>
          <Button component={Link} href="/shop" variant="contained" sx={{ bgcolor: 'var(--navy, #1e3a5f)', borderRadius: 3 }}>
            {lang === 'en' ? 'Back to Shop' : 'กลับไปยังหน้าร้านค้า'}
          </Button>
        </Container>
        <MobileBottomNav />
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'var(--background, #f8fafc)', color: 'var(--foreground, #0f172a)', pb: 10 }}>
      <StorefrontNavbar cartCount={totalItems} />

      <Container maxWidth="lg" sx={{ pt: { xs: 3, md: 5 }, pb: 6 }}>
        <Box sx={{ mb: 4 }}>
          <Button
            component={Link}
            href="/cart"
            startIcon={<ArrowLeft size={18} />}
            sx={{ textTransform: 'none', fontWeight: 600, color: 'var(--navy, #1e3a5f)', mb: 1 }}
          >
            {lang === 'en' ? 'Back to Cart' : 'ย้อนกลับไปหน้าตะกร้า'}
          </Button>
          <Typography variant="h4" sx={{ fontWeight: 800, color: 'var(--navy, #1e3a5f)', fontSize: { xs: '1.5rem', md: '2rem' } }}>
            {lang === 'en' ? 'Checkout' : 'ยืนยันการสั่งซื้อสินค้า'}
          </Typography>
        </Box>

        {errorMsg && (
          <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
            {errorMsg}
          </Alert>
        )}

        <form onSubmit={handlePlaceOrder}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 400px' }, gap: 3, alignItems: 'start' }}>
            {/* Left Form Column */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {/* Customer Contact Details */}
              <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
                  <User size={20} color="#1e3a5f" />
                  <Typography variant="h6" sx={{ fontWeight: 700, color: 'var(--navy, #1e3a5f)' }}>
                    ข้อมูลผู้สั่งซื้อ (Customer Information)
                  </Typography>
                </Box>

                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                  <TextField
                    label="ชื่อ-นามสกุล (Full Name)"
                    required
                    fullWidth
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                  <TextField
                    label="อีเมล (Email Address)"
                    type="email"
                    required
                    fullWidth
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    helperText="ใช้รับใบเสร็จ E-Receipt และการแจ้งเตือน"
                  />
                  <TextField
                    label="เบอร์โทรศัพท์ (Phone)"
                    fullWidth
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                  <TextField
                    label="รหัสนักศึกษา / บุคลากร (Option)"
                    fullWidth
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                  />
                </Box>
              </Paper>

              {/* Dynamic Shipping Options */}
              <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <MapPin size={20} color="#1e3a5f" />
                  <Typography variant="h6" sx={{ fontWeight: 700, color: 'var(--navy, #1e3a5f)' }}>
                    รูปแบบการรับสินค้า / จัดส่ง (Shipping & Pickup)
                  </Typography>
                </Box>

                {loadingConfig ? (
                  <Box sx={{ py: 2 }}>
                    <Skeleton variant="rounded" height={60} sx={{ mb: 1.5 }} />
                    <Skeleton variant="rounded" height={60} />
                  </Box>
                ) : (
                  <RadioGroup
                    value={selectedShippingId}
                    onChange={(e) => setSelectedShippingId(e.target.value)}
                  >
                    {enabledShippingOptions.map((option) => {
                      const isPickup = option.provider === 'pickup';
                      const optName = lang === 'en' && option.nameEn ? option.nameEn : option.name;
                      const optDesc = lang === 'en' && option.descriptionEn ? option.descriptionEn : option.description;
                      const isSelected = option.id === selectedShippingId;

                      let feeText = 'ฟรี';
                      if (!isPickup) {
                        const freeMin = shippingConfig?.globalFreeShippingMinimum || option.freeShippingMinimum;
                        if (freeMin && totalAmount >= freeMin) {
                          feeText = 'ฟรี (ครบเงื่อนไขส่งฟรี)';
                        } else {
                          feeText = `฿${option.baseFee}`;
                        }
                      }

                      return (
                        <Card
                          key={option.id}
                          variant="outlined"
                          sx={{
                            mb: 1.5,
                            borderColor: isSelected ? '#1e3a5f' : '#e2e8f0',
                            bgcolor: isSelected ? 'rgba(30, 58, 95, 0.02)' : '#ffffff',
                            borderRadius: 2,
                            transition: 'border-color 0.2s ease',
                          }}
                        >
                          <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                            <FormControlLabel
                              value={option.id}
                              control={<Radio size="small" />}
                              sx={{ width: '100%', margin: 0 }}
                              label={
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', ml: 1 }}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                                    {isPickup ? <Store size={20} color="#1e3a5f" /> : <Truck size={20} color="#1e3a5f" />}
                                    <Box>
                                      <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e3a5f' }}>
                                        {optName}
                                      </Typography>
                                      {optDesc && (
                                        <Typography sx={{ fontSize: '0.8rem', color: '#64748b' }}>
                                          {optDesc}
                                        </Typography>
                                      )}
                                      {option.estimatedDays && (
                                        <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>
                                          ระยะเวลาจัดส่งประมาณ {option.estimatedDays.min}-{option.estimatedDays.max} วัน
                                        </Typography>
                                      )}
                                    </Box>
                                  </Box>
                                  <Chip
                                    label={feeText}
                                    size="small"
                                    color={feeText.startsWith('ฟรี') ? 'success' : 'default'}
                                    variant={feeText.startsWith('ฟรี') ? 'filled' : 'outlined'}
                                    sx={{ fontWeight: 700, ml: 1 }}
                                  />
                                </Box>
                              }
                            />
                          </CardContent>
                        </Card>
                      );
                    })}
                  </RadioGroup>
                )}

                {!isPickupSelected && (
                  <Box sx={{ mt: 2.5 }}>
                    <TextField
                      label="ที่อยู่สำหรับจัดส่งพัสดุ (Delivery Address)"
                      required
                      multiline
                      rows={3}
                      fullWidth
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="บ้านเลขที่, หมู่บ้าน/อาคาร, ถนน, ตำบล/แขวง, อำเภอ/เขต, จังหวัด, รหัสไปรษณีย์"
                    />
                  </Box>
                )}
              </Paper>

              {/* Payment Method Selector */}
              <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <CreditCard size={20} color="#1e3a5f" />
                  <Typography variant="h6" sx={{ fontWeight: 700, color: 'var(--navy, #1e3a5f)' }}>
                    วิธีการชำระเงิน (Payment Method)
                  </Typography>
                </Box>

                {(!stripePromptPayEnabled && !stripeCardEnabled && !manualEnabled) ? (
                  <Alert severity="warning" sx={{ borderRadius: 2 }}>
                    ระบบชำระเงินปิดให้บริการชั่วคราว กรุณาติดต่อแอดมิน
                  </Alert>
                ) : (
                  <RadioGroup value={paymentGateway} onChange={(e) => setPaymentGateway(e.target.value as any)}>
                    {stripePromptPayEnabled && (
                      <Card variant="outlined" sx={{ mb: 1.5, borderColor: paymentGateway === 'promptpay' ? '#1a237e' : '#e2e8f0', borderRadius: 2 }}>
                        <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                          <FormControlLabel
                            value="promptpay"
                            control={<Radio size="small" />}
                            label={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <QrCode size={20} color="#1a237e" />
                                <Box>
                                  <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: '#1a237e' }}>
                                    Stripe PromptPay (สแกน QR อัตโนมัติ)
                                  </Typography>
                                  <Typography sx={{ fontSize: '0.8rem', color: '#64748b' }}>
                                    สแกนจ่ายผ่านแอปธนาคาร ระบบยืนยันยอดทันที 24 ชม.
                                  </Typography>
                                </Box>
                              </Box>
                            }
                          />
                        </CardContent>
                      </Card>
                    )}

                    {stripeCardEnabled && (
                      <Card variant="outlined" sx={{ mb: 1.5, borderColor: paymentGateway === 'credit_card' ? '#1d4ed8' : '#e2e8f0', borderRadius: 2 }}>
                        <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                          <FormControlLabel
                            value="credit_card"
                            control={<Radio size="small" />}
                            label={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <CreditCard size={20} color="#1d4ed8" />
                                <Box>
                                  <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: '#1d4ed8' }}>
                                    บัตรเครดิต / เดบิต (Credit/Debit Card)
                                  </Typography>
                                  <Typography sx={{ fontSize: '0.8rem', color: '#64748b' }}>
                                    ชำระด้วย Visa, Mastercard, JCB ปลอดภัย 256-bit SSL
                                  </Typography>
                                </Box>
                              </Box>
                            }
                          />
                        </CardContent>
                      </Card>
                    )}

                    {manualEnabled && (
                      <Card variant="outlined" sx={{ borderColor: paymentGateway === 'manual' ? '#1e3a5f' : '#e2e8f0', borderRadius: 2 }}>
                        <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                          <FormControlLabel
                            value="manual"
                            control={<Radio size="small" />}
                            label={
                              <Box>
                                <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
                                  โอนเงินผ่านบัญชีธนาคาร + แนบสลิป
                                </Typography>
                                <Typography sx={{ fontSize: '0.8rem', color: '#64748b' }}>
                                  โอนเงินเข้าบัญชีร้านค้า และอัปโหลดสลิปเพื่อให้ทีมงานตรวจสอบ
                                </Typography>
                              </Box>
                            }
                          />
                        </CardContent>
                      </Card>
                    )}
                  </RadioGroup>
                )}
              </Paper>

              {/* Full Tax Invoice / E-Receipt Options */}
              <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <FileText size={20} color="#1e3a5f" />
                    <Typography sx={{ fontWeight: 700, color: 'var(--navy, #1e3a5f)' }}>
                      ต้องการใบเสร็จรับเงิน / ใบกำกับภาษีเต็มรูปแบบ
                    </Typography>
                  </Box>
                  <Switch checked={wantReceipt} onChange={(e) => setWantReceipt(e.target.checked)} />
                </Box>

                {wantReceipt && (
                  <Box sx={{ mt: 2.5, display: 'grid', gridTemplateColumns: '1fr', gap: 2, pt: 2, borderTop: '1px solid #f1f5f9' }}>
                    <TextField
                      label="เลขประจำตัวผู้เสียภาษี / รหัสนักศึกษา"
                      fullWidth
                      value={taxId}
                      onChange={(e) => setTaxId(e.target.value)}
                    />
                    <TextField
                      label="ชื่อบริษัท / หน่วยงาน / คณะ"
                      fullWidth
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                    />
                    <TextField
                      label="ที่อยู่สำหรับออกใบเสร็จ"
                      multiline
                      rows={2}
                      fullWidth
                      value={receiptAddress}
                      onChange={(e) => setReceiptAddress(e.target.value)}
                    />
                  </Box>
                )}
              </Paper>
            </Box>

            {/* Right Summary Column */}
            <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#ffffff', position: 'sticky', top: 90 }}>
              <Typography variant="h6" sx={{ fontWeight: 800, color: 'var(--navy, #1e3a5f)', mb: 2 }}>
                รายการสั่งซื้อ ({totalItems} ชิ้น)
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, maxHeight: 260, overflowY: 'auto', pr: 0.5, mb: 2 }}>
                {cart.map((item: any, i: number) => {
                  const name = getItemName(item);
                  const qty = getItemQty(item);
                  const itemTotal = getItemTotal(item);
                  const details = [
                    item.size && item.size !== '-' ? `ไซส์ ${item.size}` : null,
                    item.customName || item.options?.customName ? `สกรีนชื่อ: ${item.customName || item.options?.customName}` : null,
                    item.customNumber || item.options?.customNumber ? `เบอร์: ${item.customNumber || item.options?.customNumber}` : null,
                  ].filter(Boolean).join(' | ');

                  return (
                    <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                      <Box sx={{ pr: 1 }}>
                        <Typography sx={{ fontWeight: 600, fontSize: '0.875rem' }}>{name}</Typography>
                        <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>
                          {details ? `${details} • ` : ''}x{qty}
                        </Typography>
                      </Box>
                      <Typography sx={{ fontWeight: 700 }}>฿{itemTotal.toLocaleString()}</Typography>
                    </Box>
                  );
                })}
              </Box>

              <Divider sx={{ my: 2 }} />

              {/* Promo Code Section */}
              <Box sx={{ mb: 2 }}>
                <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: '#1e3a5f', mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Tag size={16} /> โค้ดส่วนลด
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <TextField
                    size="small"
                    placeholder="ใส่โค้ดส่วนลด..."
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                    sx={{ flex: 1 }}
                  />
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={handleApplyPromo}
                    disabled={promoLoading || !promoCode.trim()}
                    sx={{ borderColor: '#1e3a5f', color: '#1e3a5f', fontWeight: 700, textTransform: 'none', minWidth: 80 }}
                  >
                    {promoLoading ? <CircularProgress size={16} /> : 'ใช้โค้ด'}
                  </Button>
                </Box>
                {promoMsg && (
                  <Alert severity={promoMsg.type} sx={{ mt: 1, py: 0, fontSize: '0.8rem', borderRadius: 1.5 }}>
                    {promoMsg.text}
                  </Alert>
                )}
              </Box>

              <Divider sx={{ my: 2 }} />

              {/* Price Breakdown */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, fontSize: '0.9rem', color: '#475569' }}>
                <span>ยอดรวมสินค้า</span>
                <span style={{ fontWeight: 600 }}>฿{totalAmount.toLocaleString()}</span>
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, fontSize: '0.9rem', color: '#475569' }}>
                <span>ค่าจัดส่ง ({selectedShippingOption ? (lang === 'en' && selectedShippingOption.nameEn ? selectedShippingOption.nameEn : selectedShippingOption.name) : 'จัดส่ง'})</span>
                <span style={{ fontWeight: 600 }}>{shippingFee === 0 ? 'ฟรี' : `฿${shippingFee.toLocaleString()}`}</span>
              </Box>

              {promoDiscount > 0 && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, fontSize: '0.9rem', color: '#16a34a' }}>
                  <span>ส่วนลดโปรโมชั่น</span>
                  <span style={{ fontWeight: 700 }}>-฿{promoDiscount.toLocaleString()}</span>
                </Box>
              )}

              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3, pt: 1, borderTop: '2px solid #e2e8f0' }}>
                <Typography sx={{ fontWeight: 800, fontSize: '1.1rem' }}>ยอดชำระทั้งหมด</Typography>
                <Typography sx={{ fontWeight: 800, fontSize: '1.3rem', color: 'var(--navy, #1e3a5f)' }}>
                  ฿{finalTotal.toLocaleString()}
                </Typography>
              </Box>

              <Box sx={{ my: 2, display: 'flex', justifyContent: 'center' }}>
                <TurnstileWidget onSuccess={setTurnstileToken} theme="light" size="normal" />
              </Box>

              <Button
                type="submit"
                variant="contained"
                fullWidth
                size="large"
                disabled={loading}
                startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <CheckCircle2 size={20} />}
                sx={{
                  bgcolor: 'var(--navy, #1e3a5f)',
                  '&:hover': { bgcolor: '#162d4a' },
                  borderRadius: 3,
                  py: 1.5,
                  fontWeight: 700,
                  fontSize: '1rem',
                  textTransform: 'none',
                }}
              >
                {loading ? 'กำลังสร้างคำสั่งซื้อ...' : 'ยืนยันและไปหน้าชำระเงิน'}
              </Button>

              <Box sx={{ mt: 2.5, display: 'flex', alignItems: 'center', gap: 1, color: '#64748b', fontSize: '0.75rem', justifyContent: 'center' }}>
                <ShieldCheck size={16} color="#16a34a" />
                <span>รับประกันความปลอดภัยและการจัดส่งโดย PSU SCC</span>
              </Box>
            </Paper>
          </Box>
        </form>
      </Container>

      <MobileBottomNav />
    </Box>
  );
}
