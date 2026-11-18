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
  Alert,
  CircularProgress,
  Card,
  CardContent,
  Skeleton,
  Chip,
} from '@mui/material';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  MapPin,
  ShieldCheck,
  CreditCard,
  Package,
  QrCode,
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
import { apiFetch, getCart, getProfile, getPublicConfig, saveCart as saveCartApi, saveProfile as saveProfileApi } from '@/lib/api-client';
import { flushFlagshipCartQueue } from '@/lib/flagship/cart-bridge';
import { ensureUniqueCartLineIds } from '@/lib/shop-constants';
import { ShippingConfig, ShippingOption } from '@/lib/shipping';
import { usePageShipping, usePagePaymentConfig } from '@/hooks/usePageData';
import { useHydrated } from '@/hooks/useHydrated';
import { formatFriendlyError } from '@/utils/error';
import type { SavedAddress } from '@/components/ProfileModal';

export default function StandaloneCheckoutPage() {
  const router = useRouter();
  const { t, lang } = useTranslation();
  const { data: session, status: sessionStatus } = useSession();
  const cart = useCartStore((s) => s.cart);
  const setCart = useCartStore((s) => s.setCart);
  const clearCart = useCartStore((s) => s.clearCart);
  const shouldLoadCheckoutData = cart.length > 0;

  // Wait for Zustand persist hydration from localStorage
  const mounted = useHydrated();
  const [syncingServerCart, setSyncingServerCart] = useState(true);

  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [instagram, setInstagram] = useState('');
  const [address, setAddress] = useState('');
  const [studentId, setStudentId] = useState('');
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [catalogMap, setCatalogMap] = useState<Record<string, any>>({});

  // Hydrate cached contact fields from localStorage ('orderData') immediately
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem('orderData');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        if (parsed.name) setCustomerName((prev) => prev || String(parsed.name));
        if (parsed.email) setCustomerEmail((prev) => prev || String(parsed.email));
        if (parsed.phone) setPhone((prev) => prev || String(parsed.phone));
        if (parsed.instagram) setInstagram((prev) => prev || String(parsed.instagram));
        if (parsed.address) setAddress((prev) => prev || String(parsed.address));
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Fetch main & sub-shop product catalogs so Order Summary sidebar displays thumbnails & full product info
  useEffect(() => {
    let active = true;
    const map: Record<string, any> = {};
    Promise.allSettled([
      getPublicConfig(),
      apiFetch('/api/shops').then((r) => (r.ok ? r.json() : null)),
    ]).then(([mainRes, shopsRes]) => {
      if (!active) return;
      if (mainRes.status === 'fulfilled') {
        const cfg = (mainRes.value.data as any) ?? (mainRes.value as any).config;
        if (Array.isArray(cfg?.products)) {
          for (const p of cfg.products) {
            if (p?.id) map[p.id] = p;
          }
        }
      }
      if (shopsRes.status === 'fulfilled' && Array.isArray(shopsRes.value?.shops)) {
        for (const s of shopsRes.value.shops) {
          if (Array.isArray(s?.products)) {
            for (const p of s.products) {
              if (p?.id) map[p.id] = p;
            }
          }
        }
      }
      setCatalogMap(map);
    });
    return () => {
      active = false;
    };
  }, []);

  // Flush any queued items added from the Flagship 360° page into the cart store
  useEffect(() => {
    if (!mounted) return;
    const queued = flushFlagshipCartQueue(true);
    if (queued.length > 0) {
      const current = useCartStore.getState().cart;
      const merged = ensureUniqueCartLineIds([...current, ...(queued as any)]);
      setCart(merged as any);
      if (session?.user?.email) {
        void saveCartApi(session.user.email, merged as any);
      }
    }
  }, [mounted, session?.user?.email, setCart]);

  // Sync server cart & saved profile for logged-in user
  useEffect(() => {
    if (!mounted) return;
    if (sessionStatus === 'loading') return;
    const email = session?.user?.email;
    if (!email) {
      setSyncingServerCart(false);
      return;
    }

    let cancelled = false;
    setSyncingServerCart(true);
    void Promise.allSettled([getCart(email), getProfile(email)]).then(([cartRes, profRes]) => {
      if (cancelled) return;
      if (cartRes.status === 'fulfilled') {
        const res = cartRes.value;
        const serverCart = (res.data as { cart?: any[] } | undefined)?.cart ?? (res as any).cart;
        if (Array.isArray(serverCart) && serverCart.length > 0) {
          const localCart = useCartStore.getState().cart;
          if (localCart.length === 0) {
            setCart(ensureUniqueCartLineIds(serverCart) as any);
          } else {
            const localIds = new Set(localCart.map((c: any) => c.id));
            const missingFromLocal = serverCart.filter((s: any) => s?.id && !localIds.has(s.id));
            if (missingFromLocal.length > 0) {
              setCart(ensureUniqueCartLineIds([...localCart, ...missingFromLocal]) as any);
            }
          }
        } else if (Array.isArray(serverCart) && serverCart.length === 0) {
          const localCart = useCartStore.getState().cart;
          if (localCart.length > 0) {
            void saveCartApi(email, localCart as any);
          }
        }
      }
      if (profRes.status === 'fulfilled') {
        const pRes = profRes.value;
        const prof = (pRes.data as any)?.profile ?? (pRes.data as any) ?? (pRes as any).profile;
        if (prof && typeof prof === 'object') {
          // Saved profile name takes priority over Google OAuth display name
          if (typeof prof.name === 'string' && prof.name.trim()) {
            setCustomerName(prof.name.trim());
          }
          if (typeof prof.phone === 'string' && prof.phone.trim()) {
            setPhone(prof.phone.replace(/\D/g, ''));
          }
          if (typeof prof.instagram === 'string' && prof.instagram.trim()) {
            setInstagram(prof.instagram.trim());
          }
          if (typeof prof.studentId === 'string' && prof.studentId.trim()) {
            setStudentId(prof.studentId.trim());
          }
          const addrList: SavedAddress[] = Array.isArray(prof.savedAddresses) ? prof.savedAddresses : [];
          if (addrList.length > 0) {
            setSavedAddresses(addrList);
          }
          const defaultSaved = addrList.find((a) => a?.isDefault)?.address || addrList[0]?.address || '';
          const resolvedAddress = (typeof prof.address === 'string' && prof.address.trim())
            ? prof.address.trim()
            : (typeof defaultSaved === 'string' ? defaultSaved.trim() : '');
          if (resolvedAddress) {
            setAddress((prev) => prev || resolvedAddress);
          }
        }
      }
    }).finally(() => {
      if (!cancelled) setSyncingServerCart(false);
    });

    return () => {
      cancelled = true;
    };
  }, [mounted, session?.user?.email, sessionStatus, setCart]);

  // Dynamic Shipping & Payment Config from API
  const { shippingConfig: swrShippingConfig, isLoading: shipLoading } = usePageShipping(shouldLoadCheckoutData);
  const { paymentConfig: swrPaymentConfig, isLoading: payLoading } = usePagePaymentConfig(shouldLoadCheckoutData);
  const loadingConfig = shipLoading || payLoading;

  const [shippingConfig, setShippingConfig] = useState<ShippingConfig | null>(null);
  const [selectedShippingId, setSelectedShippingId] = useState<string>('pickup');

  const [paymentGateway, setPaymentGateway] = useState<'promptpay' | 'credit_card' | 'manual'>('promptpay');
  const [stripePromptPayEnabled, setStripePromptPayEnabled] = useState(true);
  const [stripeCardEnabled, setStripeCardEnabled] = useState(true);
  const [manualEnabled, setManualEnabled] = useState(true);

  const [turnstileToken, setTurnstileToken] = useState('');
  const wantReceipt = false;
  const taxId = '';
  const orgName = '';
  const receiptAddress = '';
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

  // Sync SWR data to state
  useEffect(() => {
    if (swrShippingConfig) {
      setShippingConfig(swrShippingConfig);
      const enabled = swrShippingConfig.options?.filter((o: ShippingOption) => o.enabled) || [];
      if (enabled.length > 0) {
        setSelectedShippingId((current) => (
          enabled.some((option) => option.id === current)
            ? current
            : (enabled.find((option) => option.id === swrShippingConfig.defaultOptionId) || enabled[0]).id
        ));
      }
    }
  }, [swrShippingConfig]);

  useEffect(() => {
    if (swrPaymentConfig) {
      const promptPayOk = typeof swrPaymentConfig.stripePromptPayEnabled === 'boolean' ? swrPaymentConfig.stripePromptPayEnabled : true;
      const cardOk = typeof swrPaymentConfig.stripeCardEnabled === 'boolean' ? swrPaymentConfig.stripeCardEnabled : true;
      const manualOpt = swrPaymentConfig.options?.find((o: any) => o.method === 'bank_transfer' || o.id === 'bank_transfer');
      const manualOk = manualOpt ? manualOpt.enabled !== false : true;

      setStripePromptPayEnabled(promptPayOk);
      setStripeCardEnabled(cardOk);
      setManualEnabled(manualOk);

      setPaymentGateway((current) => {
        if (current === 'promptpay' && promptPayOk) return current;
        if (current === 'credit_card' && cardOk) return current;
        if (current === 'manual' && manualOk) return current;
        if (promptPayOk) return 'promptpay';
        if (cardOk) return 'credit_card';
        return 'manual';
      });
    }
  }, [swrPaymentConfig]);

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
        const promoError = typeof data.error === 'string' ? data.error : t.checkout.invalidCode;
        setPromoMsg({ type: 'error', text: formatFriendlyError(promoError) });
      }
    } catch {
      setPromoMsg({ type: 'error', text: t.checkout.cannotVerifyCode });
    } finally {
      setPromoLoading(false);
    }
  };

  const finalTotal = Math.max(0, totalAmount + shippingFee - promoDiscount);

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) {
      setErrorMsg(t.cart.emptyWarning);
      return;
    }
    if (!customerName.trim() || !customerEmail.trim()) {
      setErrorMsg(t.checkout.profileRequired);
      return;
    }
    if (!isPickupSelected && !address.trim()) {
      setErrorMsg(t.checkout.addressRequired);
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    // The order API validates the live catalog and stock atomically.
    // Avoid a second full-catalog request here so confirmation is not delayed.
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
        customerPhone: phone.trim(),
        customerInstagram: instagram.trim(),
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

      // Sync updated contact info back to localStorage and user profile so sidebar & profile stay consistent
      try {
        const prevOrderDataRaw = localStorage.getItem('orderData');
        const prevOrderData = prevOrderDataRaw ? JSON.parse(prevOrderDataRaw) : {};
        localStorage.setItem(
          'orderData',
          JSON.stringify({
            ...prevOrderData,
            name: customerName.trim(),
            email: customerEmail.trim().toLowerCase(),
            phone: phone.trim(),
            instagram: instagram.trim() || prevOrderData?.instagram || '',
            address: address.trim() || prevOrderData?.address || '',
          }),
        );
      } catch {
        /* ignore */
      }
      if (session?.user?.email) {
        void saveProfileApi(session.user.email, {
          name: customerName.trim(),
          phone: phone.trim(),
          instagram: instagram.trim(),
          ...(address.trim() ? { address: address.trim() } : {}),
        }).catch(() => undefined);
      }

      const res = await apiFetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || data.status === 'error') {
        const orderError = typeof data.message === 'string' ? data.message : t.checkout.orderError;
        throw new Error(orderError);
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
        if (session?.user?.email) {
          void saveCartApi(session.user.email, []);
        }
        router.push(`/payment/${encodeURIComponent(orderRef)}`);
      } else {
        throw new Error(t.checkout.orderError);
      }
    } catch (err: any) {
      console.error('[Checkout] Error:', err);
      const rawMessage = typeof err?.message === 'string' ? err.message : '';
      setErrorMsg(formatFriendlyError(rawMessage || t.checkout.orderError));
    } finally {
      setLoading(false);
    }
  };

  if (!mounted || (cart.length === 0 && syncingServerCart)) {
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
          <Button component={Link} href="/" variant="contained" sx={{ bgcolor: 'var(--navy, #1e3a5f)', borderRadius: 3 }}>
            {lang === 'en' ? 'Back to Home' : 'กลับไปยังหน้าร้านค้า'}
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
              <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid var(--glass-border, #e2e8f0)', bgcolor: 'var(--surface, #ffffff)' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
                  <User size={20} color="#1e3a5f" />
                  <Typography variant="h6" sx={{ fontWeight: 700, color: 'var(--foreground, #1e3a5f)' }}>
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
                    required
                    fullWidth
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/[^\d-]/g, ''))}
                    placeholder="08X-XXX-XXXX"
                  />
                  <TextField
                    label="Instagram (IG) / ช่องทางติดต่อสำรอง"
                    fullWidth
                    value={instagram}
                    onChange={(e) => setInstagram(e.target.value)}
                    placeholder="@username"
                  />
                </Box>
              </Paper>

              {/* Dynamic Shipping Options */}
              <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid var(--glass-border, #e2e8f0)', bgcolor: 'var(--surface, #ffffff)' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <MapPin size={20} color="#1e3a5f" />
                  <Typography variant="h6" sx={{ fontWeight: 700, color: 'var(--foreground, #1e3a5f)' }}>
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
                      const descAlreadyHasDays = Boolean(optDesc && /(วัน|day)/i.test(optDesc));

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
                            borderColor: isSelected ? '#0071e3' : 'var(--glass-border, #e2e8f0)',
                            bgcolor: isSelected ? 'rgba(0, 113, 227, 0.05)' : 'var(--surface, #ffffff)',
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
                                      <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--foreground, #1e3a5f)' }}>
                                        {optName}
                                      </Typography>
                                      {optDesc && (
                                        <Typography sx={{ fontSize: '0.8rem', color: 'var(--text-muted, #64748b)' }}>
                                          {optDesc}
                                        </Typography>
                                      )}
                                      {option.estimatedDays && !descAlreadyHasDays && (
                                        <Typography sx={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748b)', mt: 0.25 }}>
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
                  <Box sx={{ mt: 2.5, display: 'flex', flexDirection: 'column', gap: 1.75 }}>
                    {savedAddresses.length > 0 && (
                      <Box>
                        <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--foreground)', mb: 1 }}>
                          {lang === 'en' ? 'Saved Addresses' : 'เลือกจากสมุดที่อยู่ที่บันทึกไว้'}
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          {savedAddresses.map((addr) => {
                            const isAddrSelected = address.trim() === addr.address.trim();
                            return (
                              <Box
                                key={addr.id}
                                onClick={() => setAddress(addr.address)}
                                sx={{
                                  p: 1.5,
                                  borderRadius: 2,
                                  cursor: 'pointer',
                                  border: isAddrSelected ? '1.5px solid #0071e3' : '1px solid var(--glass-border, #e2e8f0)',
                                  bgcolor: isAddrSelected ? 'rgba(0, 113, 227, 0.06)' : 'var(--surface-2, #f8fafc)',
                                  display: 'flex',
                                  alignItems: 'flex-start',
                                  justifyContent: 'space-between',
                                  gap: 1.5,
                                }}
                              >
                                <Box sx={{ minWidth: 0 }}>
                                  <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: isAddrSelected ? '#0071e3' : 'var(--foreground)' }}>
                                    {addr.label} {addr.isDefault ? (lang === 'en' ? '(Default)' : '(ค่าเริ่มต้น)') : ''}
                                  </Typography>
                                  <Typography sx={{ fontSize: '0.8rem', color: 'var(--text-muted, #64748b)', mt: 0.25, lineHeight: 1.45 }}>
                                    {addr.address}
                                  </Typography>
                                </Box>
                                {isAddrSelected && <Check size={16} color="#0071e3" style={{ flexShrink: 0, marginTop: 2 }} />}
                              </Box>
                            );
                          })}
                        </Box>
                      </Box>
                    )}

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
              <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid var(--glass-border, #e2e8f0)', bgcolor: 'var(--surface, #ffffff)' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <CreditCard size={20} color="#1e3a5f" />
                  <Typography variant="h6" sx={{ fontWeight: 700, color: 'var(--foreground, #1e3a5f)' }}>
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
                      <Card variant="outlined" sx={{ mb: 1.5, borderColor: paymentGateway === 'promptpay' ? '#1a237e' : 'var(--glass-border, #e2e8f0)', bgcolor: 'var(--surface, #ffffff)', borderRadius: 2 }}>
                        <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                          <FormControlLabel
                            value="promptpay"
                            control={<Radio size="small" />}
                            label={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <QrCode size={20} color="#1a237e" />
                                <Box>
                                  <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--foreground, #1a237e)' }}>
                                    Stripe PromptPay (สแกน QR อัตโนมัติ)
                                  </Typography>
                                  <Typography sx={{ fontSize: '0.8rem', color: 'var(--text-muted, #64748b)' }}>
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
                      <Card variant="outlined" sx={{ mb: 1.5, borderColor: paymentGateway === 'credit_card' ? '#1d4ed8' : 'var(--glass-border, #e2e8f0)', bgcolor: 'var(--surface, #ffffff)', borderRadius: 2 }}>
                        <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                          <FormControlLabel
                            value="credit_card"
                            control={<Radio size="small" />}
                            label={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <CreditCard size={20} color="#1d4ed8" />
                                <Box>
                                  <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--foreground, #1d4ed8)' }}>
                                    บัตรเครดิต / เดบิต (Credit/Debit Card)
                                  </Typography>
                                  <Typography sx={{ fontSize: '0.8rem', color: 'var(--text-muted, #64748b)' }}>
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
                      <Card variant="outlined" sx={{ borderColor: paymentGateway === 'manual' ? '#0071e3' : 'var(--glass-border, #e2e8f0)', bgcolor: 'var(--surface, #ffffff)', borderRadius: 2 }}>
                        <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                          <FormControlLabel
                            value="manual"
                            control={<Radio size="small" />}
                            label={
                              <Box>
                                <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--foreground)' }}>
                                  โอนเงินผ่านบัญชีธนาคาร + แนบสลิป
                                </Typography>
                                <Typography sx={{ fontSize: '0.8rem', color: 'var(--text-muted, #64748b)' }}>
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
            </Box>

            {/* Right Summary Column */}
            <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid var(--glass-border, #e2e8f0)', bgcolor: 'var(--surface, #ffffff)', position: 'sticky', top: 90 }}>
              <Typography variant="h6" sx={{ fontWeight: 800, color: 'var(--foreground, #1e3a5f)', mb: 2 }}>
                รายการสั่งซื้อ ({totalItems} ชิ้น)
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, maxHeight: 320, overflowY: 'auto', pr: 0.5, mb: 2 }}>
                {cart.map((item: any, i: number) => {
                  const pId = item.productId || item.id?.split('-')[0];
                  const catProd = catalogMap[pId];
                  const img =
                    item.image ||
                    item.coverImage ||
                    (Array.isArray(item.images) ? item.images[0] : null) ||
                    catProd?.coverImage ||
                    (Array.isArray(catProd?.images) ? catProd.images[0] : null);
                  const name = (lang === 'en' && catProd?.nameEn) ? catProd.nameEn : (catProd?.name || getItemName(item));
                  const qty = getItemQty(item);
                  const itemTotal = getItemTotal(item);
                  const isLongSleeve = item.sleeve === 'LONG' || item.options?.isLongSleeve;
                  const isShortSleeve = item.sleeve === 'SHORT' || (item.options?.isLongSleeve === false && catProd?.options?.hasLongSleeve);
                  const patternName = item.selectedPattern?.name || item.pattern || item.options?.pattern;
                  const customNameVal = item.customName || item.options?.customName;
                  const customNumberVal = item.customNumber || item.options?.customNumber;

                  return (
                    <Box
                      key={item.id || i}
                      sx={{
                        display: 'flex',
                        gap: 1.5,
                        p: 1.25,
                        borderRadius: 2,
                        bgcolor: 'var(--surface-2, #f8fafc)',
                        border: '1px solid var(--glass-border, #e2e8f0)',
                      }}
                    >
                      <Box
                        sx={{
                          width: 56,
                          height: 56,
                          borderRadius: 1.5,
                          bgcolor: 'var(--surface, #ffffff)',
                          border: '1px solid var(--glass-border, #e2e8f0)',
                          overflow: 'hidden',
                          flexShrink: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {img ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={img} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                        ) : (
                          <Package size={20} style={{ color: '#64748b' }} />
                        )}
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 700, fontSize: '0.86rem', color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {name}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.4 }}>
                          {item.size && item.size !== '-' && (
                            <Box sx={{ px: 0.7, py: 0.1, borderRadius: '4px', bgcolor: 'rgba(0,113,227,0.12)', fontSize: '0.68rem', fontWeight: 600, color: '#0071e3' }}>
                              {item.size}
                            </Box>
                          )}
                          <Box sx={{ px: 0.7, py: 0.1, borderRadius: '4px', bgcolor: 'rgba(100,116,139,0.12)', fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted, #64748b)' }}>
                            x{qty}
                          </Box>
                          {isLongSleeve && (
                            <Box sx={{ px: 0.7, py: 0.1, borderRadius: '4px', bgcolor: 'rgba(99,102,241,0.12)', fontSize: '0.68rem', fontWeight: 600, color: '#6366f1' }}>
                              {t.common.longSleeve}
                            </Box>
                          )}
                          {isShortSleeve && (
                            <Box sx={{ px: 0.7, py: 0.1, borderRadius: '4px', bgcolor: 'rgba(100,116,139,0.12)', fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted, #64748b)' }}>
                              {lang === 'en' ? 'Short Sleeve' : 'แขนสั้น'}
                            </Box>
                          )}
                          {patternName && (
                            <Box sx={{ px: 0.7, py: 0.1, borderRadius: '4px', bgcolor: 'rgba(14,165,233,0.12)', fontSize: '0.68rem', fontWeight: 600, color: '#0284c7' }}>
                              {patternName}
                            </Box>
                          )}
                        </Box>
                        {(customNameVal || customNumberVal) && (
                          <Typography sx={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', mt: 0.35 }}>
                            {customNameVal ? `สกรีนชื่อ: ${customNameVal}` : ''}
                            {customNameVal && customNumberVal ? ' · ' : ''}
                            {customNumberVal ? `เบอร์: ${customNumberVal}` : ''}
                          </Typography>
                        )}
                      </Box>
                      <Typography sx={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--foreground)', flexShrink: 0 }}>
                        ฿{itemTotal.toLocaleString()}
                      </Typography>
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
