'use client';

import React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSession, signIn, signOut } from 'next-auth/react';
import {
  Alert,
  AppBar,
  Avatar,
  Backdrop,
  Badge,
  Box,
  Button,
  Card,
  CardContent,
  CardMedia,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  IconButton,
  InputAdornment,
  LinearProgress,
  Slider,
  Paper,
  Skeleton,
  Snackbar,
  Slide,
  TextField,
  Toolbar,
  FormControlLabel,
  Switch,
  Typography,
} from '@mui/material';
import useMediaQuery from '@mui/material/useMediaQuery';
import Grid from '@mui/material/Grid';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  History,
  Home,
  LogIn,
  LogOut,
  Menu,
  Minus,
  Package,
  Plus,
  Ruler,
  ShoppingCart,
  Store,
  Tag,
  User,
  X,
  Zap,
  Search,
} from 'lucide-react';
import PaymentFlow from '@/components/PaymentFlow';
import ProfileModal from '@/components/ProfileModal';
import Footer from '@/components/Footer';
import { Product, ShopConfig } from '@/lib/config';
import {
  cancelOrder,
  getCart,
  getHistory,
  getProfile,
  getPublicConfig,
  saveCart as saveCartApi,
  saveProfile as saveProfileApi,
  submitOrder as submitOrderApi,
} from '@/lib/api-client';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'รอดำเนินการ',
  PAID: 'ชำระแล้ว',
  READY: 'พร้อมรับ',
  SHIPPED: 'จัดส่งแล้ว',
  COMPLETED: 'สำเร็จ',
  CANCELLED: 'ยกเลิก',
  WAITING_PAYMENT: 'รอชำระเงิน',
  AWAITING_PAYMENT: 'รอชำระเงิน',
  UNPAID: 'ยังไม่ชำระ',
  DRAFT: 'ยังไม่ชำระ',
  VERIFYING: 'รอตรวจสลิป',
  WAITING_SLIP: 'รอตรวจสลิป',
  REJECTED: 'สลิปไม่ผ่าน',
  FAILED: 'สลิปไม่ผ่าน',
  REFUNDED: 'คืนเงินแล้ว',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#f59e0b',
  PAID: '#3b82f6',
  READY: '#10b981',
  SHIPPED: '#0ea5e9',
  COMPLETED: '#22c55e',
  CANCELLED: '#ef4444',
  WAITING_PAYMENT: '#f59e0b',
  AWAITING_PAYMENT: '#f59e0b',
  UNPAID: '#f59e0b',
  DRAFT: '#f59e0b',
  VERIFYING: '#06b6d4',
  WAITING_SLIP: '#06b6d4',
  REJECTED: '#ef4444',
  FAILED: '#ef4444',
  REFUNDED: '#8b5cf6',
};

const PAYABLE_STATUSES = ['PENDING', 'WAITING_PAYMENT', 'AWAITING_PAYMENT', 'UNPAID', 'DRAFT'];
const CANCELABLE_STATUSES = ['PENDING', 'WAITING_PAYMENT', 'AWAITING_PAYMENT', 'UNPAID', 'DRAFT'];
const getStatusCategory = (status: string): 'WAITING_PAYMENT' | 'COMPLETED' | 'RECEIVED' | 'CANCELLED' | 'OTHER' => {
  const key = normalizeStatus(status);
  if (['WAITING_PAYMENT', 'AWAITING_PAYMENT', 'UNPAID', 'DRAFT', 'PENDING'].includes(key)) return 'WAITING_PAYMENT';
  if (['PAID', 'VERIFYING', 'WAITING_SLIP'].includes(key)) return 'COMPLETED';
  if (['READY', 'SHIPPED', 'COMPLETED'].includes(key)) return 'RECEIVED';
  if (['CANCELLED', 'REFUNDED', 'REJECTED', 'FAILED'].includes(key)) return 'CANCELLED';
  return 'OTHER';
};

const TYPE_LABELS: Record<string, string> = {
  CREW: 'เสื้อ Crew',
  HOODIE: 'ฮู้ดดี้',
  SHIRT: 'เสื้อเชิ้ต',
  TSHIRT: 'เสื้อยืด',
  POLO: 'เสื้อโปโล',
  JACKET: 'แจ็กเก็ต',
  CAP: 'หมวก',
  ACCESSORY: 'ของที่ระลึก',
  OTHER: 'อื่นๆ',
};

const SIZE_ORDER = ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'] as const;
const SIZE_MEASUREMENTS: Record<(typeof SIZE_ORDER)[number], { chest: number; length: number }> = {
  S: { chest: 36, length: 25 },
  M: { chest: 38, length: 26 },
  L: { chest: 40, length: 27 },
  XL: { chest: 42, length: 28 },
  '2XL': { chest: 44, length: 29 },
  '3XL': { chest: 46, length: 30 },
  '4XL': { chest: 48, length: 31 },
};

const ANNOUNCEMENT_COLOR_MAP: Record<string, string> = {
  blue: '#3b82f6',
  red: '#ef4444',
  green: '#22c55e',
  orange: '#f97316',
};

const CONFIG_CACHE_KEY = 'shopConfigCache';
const CONFIG_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

type ToastSeverity = 'success' | 'error' | 'warning' | 'info';

type Toast = {
  type: ToastSeverity;
  message: string;
};

type ProductOptions = {
  size: string;
  quantity: number;
  customName: string;
  customNumber: string;
  isLongSleeve: boolean;
};

type CartItem = {
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
};

type OrderHistory = {
  ref: string;
  status: string;
  date: string;
  total?: number;
};

type Interval = ReturnType<typeof setInterval>;

type LeanProduct = Pick<Product, 'id' | 'name' | 'description' | 'type' | 'images' | 'basePrice' | 'sizePricing' | 'isActive'>;
type LeanConfig = {
  isOpen: boolean;
  announcement?: ShopConfig['announcement'];
  products: LeanProduct[];
};

const clampQty = (value: number) => Math.min(99, Math.max(1, value));
const normalizeStatus = (status: string) => (status || '').trim().toUpperCase();
const normalizeEngName = (value: string) => value.replace(/[^a-zA-Z\s]/g, '').toUpperCase().slice(0, 7).trim();
const normalizeDigits99 = (value: string) => {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  return String(Math.min(99, Number(digits)));
};
const isThaiText = (value: string) => /^[\u0E00-\u0E7F\s]+$/.test(value.trim());
const onlyDigitsPhone = (value: string) => value.replace(/\D/g, '').slice(0, 12);
const getBasePrice = (p: Product) => {
  const prices = Object.values(p.sizePricing || {});
  if (prices.length === 0) return p.basePrice;
  return Math.min(...prices);
};

export default function HomePage() {
  const { data: session, status } = useSession();
  const isMobile = useMediaQuery('(max-width:600px)');

  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const [config, setConfig] = useState<ShopConfig | null>(null);
  const [announcement, setAnnouncement] = useState<ShopConfig['announcement']>();
  const [isShopOpen, setIsShopOpen] = useState(true);
  const configFetchInFlight = useRef(false);
  const configPollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [showOrderDialog, setShowOrderDialog] = useState(false);
  const paymentOpenerRef = useRef<((ref: string) => void) | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'home' | 'cart' | 'history' | 'profile'>('home');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [productSearch, setProductSearch] = useState('');
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 0]);

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [productOptions, setProductOptions] = useState<ProductOptions>({
    size: '',
    quantity: 1,
    customName: '',
    customNumber: '',
    isLongSleeve: false,
  });
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const [cart, setCart] = useState<CartItem[]>([]);
  const cartRef = useRef<CartItem[]>([]);
  const productHoldTimer = useRef<Interval | null>(null);
  const cartHoldTimers = useRef<Record<string, Interval | null>>({});

  const [orderData, setOrderData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    instagram: '',
  });
  const [orderHistory, setOrderHistory] = useState<OrderHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingHistoryMore, setLoadingHistoryMore] = useState(false);
  const [historyCursor, setHistoryCursor] = useState<string | null>(null);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<'ALL' | 'WAITING_PAYMENT' | 'COMPLETED' | 'RECEIVED' | 'CANCELLED'>('ALL');
  const [cancellingRef, setCancellingRef] = useState<string | null>(null);
  const [confirmCancelRef, setConfirmCancelRef] = useState<string | null>(null);
  const [showSizeChart, setShowSizeChart] = useState(false);

  const openPaymentFlow = useCallback(
    (ref: string) => {
      setShowHistoryDialog(false);
      setShowProfileModal(false);
      setShowCart(false);
      setShowOrderDialog(false);
      paymentOpenerRef.current?.(ref);
    },
    []
  );
  const [savingProfile, setSavingProfile] = useState(false);
  const [pendingCheckout, setPendingCheckout] = useState(false);
  const [navHidden, setNavHidden] = useState(false);
  const lastScrollYRef = useRef(0);
  const scrollIdleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showRefreshDroplet, setShowRefreshDroplet] = useState(false);
  const hideNavBars = navHidden || productDialogOpen;

  const [toast, setToast] = useState<Toast | null>(null);
  const [inlineNotice, setInlineNotice] = useState<Toast | null>(null);
  const ToastTransition = (props: any) => <Slide {...props} direction="left" />;

  const bottomTabs = useMemo(
    () => [
      { key: 'home', label: 'หน้าแรก', icon: <Home size={22} /> },
      {
        key: 'cart',
        label: 'ตะกร้า',
        icon: (
          <Badge badgeContent={cart.length} color="error">
            <ShoppingCart size={22} />
          </Badge>
        ),
      },
      { key: 'history', label: 'ประวัติ', icon: <History size={22} /> },
      { key: 'profile', label: 'โปรไฟล์', icon: <User size={22} /> },
    ],
    [cart.length],
  );


  const BrandMark = ({ size = 36, showText = true }: { size?: number; showText?: boolean }) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Box
        sx={{
          width: size,
          height: size,
          borderRadius: '30%',
          background: 'radial-gradient(circle at 30% 30%, #22d3ee 0%, #6366f1 45%, #0ea5e9 70%, #0f172a 100%)',
          boxShadow: '0 10px 30px rgba(99,102,241,0.35)',
          display: 'grid',
          placeItems: 'center',
          border: '1px solid rgba(255,255,255,0.12)',
        }}
      >
        <Typography sx={{ fontWeight: 800, fontSize: size * 0.34, color: '#e0f2fe', letterSpacing: 0.6 }}>PSU</Typography>
      </Box>
      {showText && (
        <Typography
          variant="h6"
          sx={{
            fontWeight: 900,
            letterSpacing: 0.2,
            background: 'linear-gradient(120deg, #38bdf8 0%, #818cf8 50%, #c084fc 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            textTransform: 'uppercase',
          }}
        >
          PSUSCCSHOP
        </Typography>
      )}
    </Box>
  );

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onScroll = () => {
      const currentY = window.scrollY;
      const delta = Math.abs(currentY - lastScrollYRef.current);
      lastScrollYRef.current = currentY;

      if (delta < 2) return;

      setNavHidden(true);
      if (scrollIdleTimer.current) clearTimeout(scrollIdleTimer.current);
      scrollIdleTimer.current = setTimeout(() => setNavHidden(false), 220);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (scrollIdleTimer.current) clearTimeout(scrollIdleTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!showRefreshDroplet) return undefined;
    const timer = setTimeout(() => setShowRefreshDroplet(false), 1500);
    return () => clearTimeout(timer);
  }, [showRefreshDroplet]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const triggerDroplet = () => setShowRefreshDroplet(true);

    window.addEventListener('beforeunload', triggerDroplet);
    window.addEventListener('pagehide', triggerDroplet);

    return () => {
      window.removeEventListener('beforeunload', triggerDroplet);
      window.removeEventListener('pagehide', triggerDroplet);
    };
  }, []);

  useEffect(() => () => {
    if (productHoldTimer.current) clearInterval(productHoldTimer.current);
    Object.values(cartHoldTimers.current).forEach((t) => t && clearInterval(t));
  }, []);

  const refreshConfig = useCallback(async () => {
    if (configFetchInFlight.current) return;
    configFetchInFlight.current = true;
    try {
      const res = await getPublicConfig();
      if (res.status === 'success') {
        const cfg = (res.data as ShopConfig | undefined) ?? (res.config as ShopConfig | undefined);
        if (cfg) {
          const lean = sanitizeConfig(cfg);
          cacheConfig(lean);
          setConfig(cfg);
          setAnnouncement(cfg.announcement);
          setIsShopOpen(cfg.isOpen);
        } else {
          console.warn('No config returned from getPublicConfig');
        }
      } else {
        console.error('Failed to load config:', res.message || res.error);
      }
    } catch (error) {
      console.error('Failed to load config:', error);
    } finally {
      configFetchInFlight.current = false;
    }
  }, []);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const cached = loadCachedConfig();
        if (cached) {
          setConfig(cached as unknown as ShopConfig);
          setAnnouncement(cached.announcement);
          setIsShopOpen(cached.isOpen);
          // Keep loading while we refresh from GAS to avoid stale cache
        }

        await refreshConfig();
      } catch (error) {
        console.error('Failed to load config:', error);
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, [refreshConfig]);

  useEffect(() => {
    if (!session?.user?.email) return;

    setOrderData((prev) => ({
      ...prev,
      email: session.user?.email || prev.email,
      name: prev.name || session.user?.name || '',
    }));

    const loadProfile = async () => {
      const email = session.user?.email;
      if (!email) return;
      try {
        const res = await getProfile(email);
        const profile = (res.data as any)?.profile || (res as any)?.profile;
        if (res.status === 'success' && profile) {
          const sanitizedProfile = {
            name: typeof profile.name === 'string' ? profile.name.trim() : '',
            phone: typeof profile.phone === 'string' ? onlyDigitsPhone(profile.phone) : '',
            address: typeof profile.address === 'string' ? profile.address.trim() : '',
            instagram: typeof profile.instagram === 'string' ? profile.instagram.trim() : '',
          };
          setOrderData((prev) => ({ ...prev, ...sanitizedProfile, email: session.user?.email || prev.email }));

          const alreadyComplete = isThaiText(sanitizedProfile.name) && !!sanitizedProfile.phone && !!sanitizedProfile.instagram;
          if (!alreadyComplete) {
            setShowProfileModal(true);
          }
          }
      } catch (error) {
        console.error('Failed to load profile:', error);
      }
    };

    const loadCart = async () => {
      const email = session.user?.email;
      if (!email) return;
      try {
        const res = await getCart(email);
        const serverCart = (res.data as any)?.cart || (res as any)?.cart;
        if (res.status === 'success' && Array.isArray(serverCart)) {
          setCart(serverCart);
        }
      } catch (error) {
        console.error('Failed to load cart:', error);
      }
    };

    loadProfile();
    loadCart();
  }, [session]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = window.localStorage.getItem('orderData');
      if (saved) {
        const parsed = JSON.parse(saved);
        setOrderData((prev) => ({ ...prev, ...parsed }));
      }
    } catch (error) {
      console.error('Failed to load saved order data', error);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem('orderData', JSON.stringify(orderData));
    } catch (error) {
      console.error('Failed to persist order data', error);
    }
  }, [orderData]);

  useEffect(() => {
    if (selectedProduct) setActiveImageIndex(0);
  }, [selectedProduct]);

  // 🔄 Realtime-ish updates: background polling + visibility/focus refresh
  useEffect(() => {
    const intervalMs = 12000; // 12s polling for fresher catalog
    configPollTimer.current = setInterval(() => {
      refreshConfig();
    }, intervalMs);

    const handleVisibility = () => {
      if (!document.hidden) refreshConfig();
    };

    window.addEventListener('focus', handleVisibility);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (configPollTimer.current) clearInterval(configPollTimer.current);
      window.removeEventListener('focus', handleVisibility);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [refreshConfig]);

  useEffect(() => {
    if (!selectedProduct) return;
    const sizeKeys = Object.keys(selectedProduct.sizePricing || {});
    const defaultSize = sizeKeys.length > 0 ? sizeKeys[0] : 'ฟรีไซส์';
    setProductOptions((prev) => ({ ...prev, size: defaultSize }));
  }, [selectedProduct]);

  const showToast = (type: ToastSeverity, message: string) => {
    setToast({ type, message });
    if (productDialogOpen) {
      setInlineNotice({ type, message });
      setTimeout(() => setInlineNotice(null), 2000);
    }
  };

  const sanitizeConfig = (cfg: ShopConfig): LeanConfig => ({
    isOpen: cfg.isOpen,
    announcement: cfg.announcement,
    products: (cfg.products || []).map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      type: p.type,
      images: p.images,
      basePrice: p.basePrice,
      sizePricing: p.sizePricing,
      isActive: p.isActive,
    })),
  });

  const loadCachedConfig = (): LeanConfig | null => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.sessionStorage.getItem(CONFIG_CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed?.timestamp || Date.now() - parsed.timestamp > CONFIG_CACHE_TTL) return null;
      return parsed.config as LeanConfig;
    } catch (error) {
      console.error('Failed to read cached config', error);
      return null;
    }
  };

  const cacheConfig = (lean: LeanConfig) => {
    if (typeof window === 'undefined') return;
    try {
      window.sessionStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify({ timestamp: Date.now(), config: lean }));
    } catch (error) {
      console.error('Failed to cache config', error);
    }
  };

  const saveCart = async (newCart: CartItem[]) => {
    setCart(newCart);
    if (!session?.user?.email) return;
    try {
      await saveCartApi(session.user.email, newCart);
    } catch (error) {
      console.error('Failed to save cart:', error);
    }
  };

  const resetProductDialog = () => {
    setProductDialogOpen(false);
    setSelectedProduct(null);
    setProductOptions({ size: '', quantity: 1, customName: '', customNumber: '', isLongSleeve: false });
  };

  const buildCartItem = (): CartItem | null => {
    if (!selectedProduct || !productOptions.size) {
      showToast('warning', 'กรุณาเลือกขนาด');
      return null;
    }

    const normalizedCustomName = normalizeEngName(productOptions.customName);

    if (selectedProduct.options?.hasCustomName && !normalizedCustomName) {
      showToast('warning', 'กรอกชื่อที่ต้องการพิมพ์บนเสื้อ (สูงสุด 7 ตัวอักษร)');
      return null;
    }

    if (selectedProduct.options?.hasCustomNumber && !productOptions.customNumber) {
      showToast('warning', 'กรอกหมายเลขที่ต้องการพิมพ์บนเสื้อ (จำเป็นต้องกรอก)');
      return null;
    }

    const basePrice = selectedProduct.sizePricing?.[productOptions.size] ?? selectedProduct.basePrice;
    const longSleeveFee = selectedProduct.options?.hasLongSleeve && productOptions.isLongSleeve ? 50 : 0;
    const unitPrice = basePrice + longSleeveFee;
    const quantity = clampQty(productOptions.quantity);

    return {
      id: `${selectedProduct.id}-${Date.now()}`,
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      size: productOptions.size,
      quantity,
      unitPrice,
      options: {
        customName: normalizedCustomName,
        customNumber: productOptions.customNumber,
        isLongSleeve: productOptions.isLongSleeve,
      },
    };
  };

  const commitCartItem = (item: CartItem, options?: { goCheckout?: boolean }) => {
    const newCart = [...cart, item];
    saveCart(newCart);
    showToast('success', options?.goCheckout ? 'เพิ่มแล้ว ไปชำระเงิน' : 'เพิ่มสินค้าลงตะกร้าแล้ว');
    resetProductDialog();

    if (options?.goCheckout) {
      setShowCart(false);
      setShowOrderDialog(true);
      setActiveTab('cart');
    }
  };

  const handleAddToCart = () => {
    const newItem = buildCartItem();
    if (!newItem) return;
    commitCartItem(newItem);
  };

  const handleBuyNow = () => {
    const newItem = buildCartItem();
    if (!newItem) return;
    if (!requireProfileBeforeCheckout()) return;
    commitCartItem(newItem, { goCheckout: true });
  };

  const removeFromCart = (id: string) => {
    const newCart = cart.filter((item) => item.id !== id);
    saveCart(newCart);
    showToast('success', 'ลบสินค้าออกจากตะกร้าแล้ว');
  };

  const updateCartQuantity = (id: string, quantity: number) => {
    const clamped = clampQty(quantity);
    if (clamped <= 0) {
      removeFromCart(id);
      return;
    }
    const newCart = cart.map((item) => (item.id === id ? { ...item, quantity: clamped } : item));
    saveCart(newCart);
  };

  const stopProductHold = () => {
    if (productHoldTimer.current) {
      clearInterval(productHoldTimer.current);
      productHoldTimer.current = null;
    }
  };

  const startProductHold = (delta: number) => {
    stopProductHold();
    productHoldTimer.current = setInterval(() => {
      setProductOptions((prev) => ({ ...prev, quantity: clampQty(prev.quantity + delta) }));
    }, 120);
  };

  const stopCartHold = (id: string) => {
    const timer = cartHoldTimers.current[id];
    if (timer) {
      clearInterval(timer);
      cartHoldTimers.current[id] = null;
    }
  };

  const startCartHold = (id: string, delta: number) => {
    stopCartHold(id);
    cartHoldTimers.current[id] = setInterval(() => {
      const target = cartRef.current.find((item) => item.id === id);
      if (!target) {
        stopCartHold(id);
        return;
      }
      updateCartQuantity(id, target.quantity + delta);
    }, 140);
  };

  const getTotalPrice = useCallback(() => {
    return cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  }, [cart]);

  const getStatusLabel = (status: string): string => STATUS_LABELS[normalizeStatus(status)] || status;
  const getStatusColor = (status: string): string => STATUS_COLORS[normalizeStatus(status)] || '#475569';

  const renderProductDialog = () => {
    if (!selectedProduct) return null;

    const productContent = (
      <Box
        sx={{
          width: { xs: '100%', sm: '92%', md: 1040 },
          maxWidth: 'calc(100% - 24px)',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          mx: 'auto',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3, py: 2.5, borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)', color: 'white' }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.2 }}>
            <Typography variant="h6" sx={{ fontWeight: 900 }}>{selectedProduct.name}</Typography>
            <Typography variant="caption" sx={{ opacity: 0.88 }}>ปัดดูรายละเอียดและเลือกตัวเลือก</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
            <Chip label={selectedProduct.type} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.22)', color: 'white', fontWeight: 800 }} />
            <IconButton onClick={() => setProductDialogOpen(false)} sx={{ color: 'white', bgcolor: 'rgba(0,0,0,0.18)', '&:hover': { bgcolor: 'rgba(0,0,0,0.28)' } }}>
              <X />
            </IconButton>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 2, md: 3 }, alignItems: 'stretch', px: { xs: 1.5, md: 3 }, py: 3, overflow: 'auto', flex: 1, minHeight: 0, WebkitOverflowScrolling: 'touch' }}>
          {inlineNotice && (
            <Alert severity={inlineNotice.type} sx={{ borderRadius: 2, bgcolor: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', color: '#e2e8f0' }}>
              {inlineNotice.message}
            </Alert>
          )}
          <Box sx={{ p: { xs: 1.5, md: 2 }, borderRadius: 2, border: '1px solid rgba(255,255,255,0.08)', background: 'linear-gradient(145deg, rgba(6,12,26,0.9), rgba(8,18,36,0.9))', boxShadow: '0 18px 42px rgba(0,0,0,0.35)' }}>
            {productImages.length ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Box sx={{ position: 'relative', borderRadius: 2, overflow: 'hidden', background: 'linear-gradient(145deg, rgba(99,102,241,0.25), rgba(6,182,212,0.2))', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 18px 50px rgba(99,102,241,0.2)' }}>
                  <Box
                    component="img"
                    src={productImages[activeImageIndex] || productImages[0]}
                    alt={`${selectedProduct.name} - รูปที่ ${activeImageIndex + 1}`}
                    loading="lazy"
                    sx={{ width: '100%', height: { xs: 260, sm: 380, md: 520 }, objectFit: 'cover', display: 'block', backgroundColor: '#0b152c' }}
                  />
                  {totalImages > 1 && (
                    <>
                      <IconButton
                        onClick={() => setActiveImageIndex((prev) => (prev - 1 + totalImages) % totalImages)}
                        sx={{ position: 'absolute', top: '45%', left: 12, bgcolor: 'rgba(15,23,42,0.65)', color: 'white', '&:hover': { bgcolor: 'rgba(15,23,42,0.8)' } }}
                      >
                        <ChevronLeft />
                      </IconButton>
                      <IconButton
                        onClick={() => setActiveImageIndex((prev) => (prev + 1) % totalImages)}
                        sx={{ position: 'absolute', top: '45%', right: 12, bgcolor: 'rgba(15,23,42,0.65)', color: 'white', '&:hover': { bgcolor: 'rgba(15,23,42,0.8)' } }}
                      >
                        <ChevronRight />
                      </IconButton>
                    </>
                  )}
                </Box>

                {totalImages > 1 && (
                  <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', pb: 0.5 }}>
                    {productImages.map((img, idx) => (
                      <Box
                        key={idx}
                        onClick={() => setActiveImageIndex(idx)}
                        sx={{
                          width: 78,
                          height: 78,
                          borderRadius: 2,
                          border: activeImageIndex === idx ? '2px solid #6366f1' : '1px solid rgba(255,255,255,0.1)',
                          overflow: 'hidden',
                          cursor: 'pointer',
                          opacity: activeImageIndex === idx ? 1 : 0.78,
                          transition: 'all 0.2s',
                          flexShrink: 0,
                        }}
                      >
                        <Box component="img" src={img} alt={`${selectedProduct.name}-${idx}`} loading="lazy" sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', backgroundColor: '#0b152c' }} />
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>
            ) : (
              <Box sx={{ height: 220, borderRadius: 2, background: 'linear-gradient(145deg, rgba(99,102,241,0.25), rgba(6,182,212,0.2))', border: '1px dashed rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1' }}>
                ไม่มีรูปภาพสินค้า
              </Box>
            )}
          </Box>

          <Box sx={{ p: { xs: 1.5, md: 2 }, borderRadius: 2, border: '1px solid rgba(255,255,255,0.08)', background: 'linear-gradient(145deg, rgba(6,12,26,0.9), rgba(8,18,36,0.9))', boxShadow: '0 18px 42px rgba(0,0,0,0.35)', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="body2" sx={{ color: '#94a3b8' }}>
              {selectedProduct.description}
            </Typography>
            <Divider sx={{ borderColor: '#334155' }} />

            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1, color: '#f1f5f9' }}>
                เลือกขนาด
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mb: 1 }}>
                <Button size="small" variant="outlined" onClick={() => setShowSizeChart(true)} sx={{ borderColor: '#6366f1', color: '#e2e8f0', ml: 1 }}>
                  ตารางไซส์
                </Button>
              </Box>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: 'repeat(auto-fill, minmax(140px, 1fr))', sm: 'repeat(auto-fill, minmax(150px, 1fr))' },
                  gap: 1,
                  pb: 1,
                }}
              >
                {displaySizes.map((size) => {
                  const basePrice = selectedProduct?.sizePricing?.[size] ?? selectedProduct?.basePrice ?? 0;
                  const longSleeveFee = selectedProduct.options?.hasLongSleeve && productOptions.isLongSleeve ? 50 : 0;
                  const price = basePrice + longSleeveFee;
                  const active = productOptions.size === size;
                  return (
                    <Box
                      key={size}
                      component="button"
                      type="button"
                      onClick={() => setProductOptions({ ...productOptions, size })}
                      sx={{
                        all: 'unset',
                        cursor: 'pointer',
                        borderRadius: 1.5,
                        border: active ? '1px solid #6366f1' : '1px solid rgba(255,255,255,0.08)',
                        bgcolor: active ? 'rgba(99,102,241,0.16)' : 'rgba(255,255,255,0.03)',
                        boxShadow: active ? '0 0 0 1px rgba(99,102,241,0.18)' : 'none',
                        padding: '12px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        transition: 'all 0.15s ease',
                        '&:hover': { borderColor: '#6366f1', transform: 'translateY(-1px)' },
                      }}
                    >
                      <Box sx={{ width: 38, height: 38, borderRadius: 1.5, display: 'grid', placeItems: 'center', bgcolor: active ? 'rgba(99,102,241,0.22)' : 'rgba(255,255,255,0.05)', color: '#e2e8f0', fontWeight: 800 }}>
                        {size}
                      </Box>
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                        <Typography sx={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.2 }}>
                          {price.toLocaleString()}฿
                        </Typography>
                        {longSleeveFee > 0 && (
                          <Typography sx={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                            +50 แขนยาวรวมแล้ว
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  );
                })}
              </Box>
              <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                {selectedProduct.sizePricing && Object.keys(selectedProduct.sizePricing).length > 0 ? 'เลือกจากการ์ดหรือปัดในแถวเพื่อเห็นทุกไซส์' : 'ฟรีไซส์ · ใช้ราคาเริ่มต้น'}
              </Typography>
            </Box>

            {(selectedProduct.options?.hasCustomName || selectedProduct.options?.hasCustomNumber || selectedProduct.options?.hasLongSleeve) && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#f1f5f9' }}>
                  ตัวเลือกเพิ่มเติม
                </Typography>

                {selectedProduct.options?.hasCustomName && (
                  <TextField
                    label="ชื่อติดเสื้อ (สูงสุด 7 ตัวอักษร ภาษาอังกฤษเท่านั้น)"
                    fullWidth
                    value={productOptions.customName}
                    onChange={(e) => setProductOptions({ ...productOptions, customName: normalizeEngName(e.target.value) })}
                    inputProps={{ maxLength: 7 }}
                    helperText="ระบบจะแปลงเป็นตัวพิมพ์ใหญ่ และจำกัดไม่เกิน 7 ตัว"
                    sx={{ '& .MuiOutlinedInput-root': { color: '#f1f5f9' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: '#334155' }, '& label': { color: '#94a3b8' } }}
                  />
                )}

                {selectedProduct.options?.hasCustomNumber && (
                  <TextField
                    label="หมายเลขเสื้อ (0-99) *ต้องกรอก"
                    fullWidth
                    value={productOptions.customNumber}
                    onChange={(e) => setProductOptions({ ...productOptions, customNumber: normalizeDigits99(e.target.value) })}
                    inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }}
                    sx={{ '& .MuiOutlinedInput-root': { color: '#f1f5f9' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: '#334155' }, '& label': { color: '#94a3b8' } }}
                  />
                )}

                {selectedProduct.options?.hasLongSleeve && (
                  <FormControlLabel
                    control={
                      <Switch
                        checked={productOptions.isLongSleeve}
                        onChange={(e) => setProductOptions({ ...productOptions, isLongSleeve: e.target.checked })}
                        color="info"
                      />
                    }
                    label="เลือกแขนยาว (+50)"
                    sx={{ color: '#e2e8f0', ml: 0 }}
                  />
                )}

                {(productOptions.customName || productOptions.customNumber || productOptions.isLongSleeve) && (
                  <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                    ระบบจะบันทึกข้อมูลนี้ไปกับคำสั่งซื้อให้อัตโนมัติ{selectedProduct.options?.hasLongSleeve ? ' (+50 เมื่อเปิดแขนยาว)' : ''}
                  </Typography>
                )}
              </Box>
            )}

            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1, color: '#f1f5f9' }}>
                จำนวน
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <IconButton
                  size="small"
                  onClick={() => setProductOptions({ ...productOptions, quantity: clampQty(productOptions.quantity - 1) })}
                  sx={{ bgcolor: '#334155', color: '#f1f5f9' }}
                >
                  <Minus size={18} />
                </IconButton>
                <TextField
                  type="number"
                  size="small"
                  value={productOptions.quantity}
                  onChange={(e) => setProductOptions({ ...productOptions, quantity: clampQty(parseInt(e.target.value) || 1) })}
                  inputProps={{ min: 1, style: { textAlign: 'center', color: '#f1f5f9' } }}
                  sx={{ width: 90, '& .MuiOutlinedInput-notchedOutline': { borderColor: '#334155' } }}
                />
                <IconButton
                  size="small"
                  onClick={() => setProductOptions({ ...productOptions, quantity: clampQty(productOptions.quantity + 1) })}
                  sx={{ bgcolor: '#334155', color: '#f1f5f9' }}
                >
                  <Plus size={18} />
                </IconButton>
              </Box>
            </Box>
          </Box>

          <Box sx={{ p: 2.5, pt: 2, borderTop: '1px solid rgba(255,255,255,0.08)', background: 'rgba(11,17,32,0.9)', display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 1 }}>
            <Button
              onClick={() => setProductDialogOpen(false)}
              variant="outlined"
              sx={{ color: '#f1f5f9', borderColor: '#334155' }}
            >
              ยกเลิก
            </Button>
            <Button
              onClick={handleAddToCart}
              variant="contained"
              disabled={!isShopOpen}
              startIcon={<ShoppingCart size={18} />}
              sx={{ background: 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)', fontWeight: 800 }}
            >
              เพิ่มลงตะกร้า
            </Button>
            <Button
              onClick={handleBuyNow}
              variant="contained"
              disabled={!isShopOpen}
              startIcon={<Zap size={18} />}
              sx={{ background: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)', fontWeight: 800, boxShadow: '0 12px 32px rgba(16,185,129,0.35)' }}
            >
              ซื้อเลย
            </Button>
          </Box>
        </Box>
      </Box>
    );

    if (isMobile) {
      return (
        <Drawer
          anchor="bottom"
          open={productDialogOpen}
          onClose={() => setProductDialogOpen(false)}
          PaperProps={{
            sx: {
              width: '100%',
              maxWidth: '100%',
              display: 'flex',
              justifyContent: 'center',
              bgcolor: 'rgba(10,14,26,0.95)',
              color: '#f1f5f9',
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              borderRadius: 0,
              border: '1px solid rgba(255,255,255,0.12)',
              boxShadow: '-18px 0 60px rgba(0,0,0,0.45)',
              backdropFilter: 'blur(18px)',
              maxHeight: '88vh',
              overflowY: 'auto',
              overflowX: 'hidden',
              WebkitOverflowScrolling: 'touch',
              p: { xs: 0, md: 1.5 },
              zIndex: (theme) => theme.zIndex.modal + 40,
            },
          }}
        >
          {productContent}
        </Drawer>
      );
    }

    return (
      <Dialog
        open={productDialogOpen}
        onClose={() => setProductDialogOpen(false)}
        maxWidth="lg"
        fullWidth
        sx={{ '& .MuiDialog-container': { alignItems: 'center' } }}
        PaperProps={{
          sx: {
            bgcolor: 'rgba(10,14,26,0.95)',
            color: '#f1f5f9',
            borderRadius: 2,
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: '0 30px 80px rgba(0,0,0,0.6)',
            backdropFilter: 'blur(18px)',
            width: 'min(1100px, calc(100% - 48px))',
            mx: 'auto',
            my: { xs: 2, md: 4 },
            maxHeight: 'calc(100vh - 64px)',
            zIndex: (theme) => theme.zIndex.modal + 40,
          },
        }}
      >
        {productContent}
      </Dialog>
    );
  };
  const historyFilters = useMemo(
    () => [
      { key: 'ALL', label: 'ทั้งหมด', color: '#64748b' },
      { key: 'WAITING_PAYMENT', label: 'รอชำระ', color: '#f59e0b' },
      { key: 'COMPLETED', label: 'ซื้อสำเร็จ', color: '#22c55e' },
      { key: 'RECEIVED', label: 'รับสินค้าแล้ว', color: '#0ea5e9' },
      { key: 'CANCELLED', label: 'ยกเลิก', color: '#ef4444' },
    ],
    [],
  );

  const filterCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: orderHistory.length, WAITING_PAYMENT: 0, COMPLETED: 0, RECEIVED: 0, CANCELLED: 0 };
    orderHistory.forEach((order) => {
      const category = getStatusCategory(order.status);
      if (counts[category] !== undefined) counts[category] += 1;
    });
    return counts;
  }, [orderHistory]);

  const filteredOrders = useMemo(
    () =>
      orderHistory.filter((order) => {
        if (historyFilter === 'ALL') return true;
        return getStatusCategory(order.status) === historyFilter;
      }),
    [orderHistory, historyFilter],
  );

  const cancelOrderByRef = async (ref: string) => {
    try {
      setCancellingRef(ref);
      setProcessing(true);
      const res = await cancelOrder(ref);

      if (res.status === 'success') {
        showToast('success', 'ยกเลิกคำสั่งซื้อแล้ว');
        await loadOrderHistory();
      } else {
        showToast('error', res.message || 'ยกเลิกคำสั่งซื้อไม่สำเร็จ');
      }
    } catch (error: any) {
      showToast('error', error.message || 'ยกเลิกคำสั่งซื้อไม่สำเร็จ');
    } finally {
      setCancellingRef(null);
      setProcessing(false);
    }
  };

  const handleCancelOrder = (ref: string) => {
    setConfirmCancelRef(ref);
  };

  const profileComplete = useMemo(() => {
    return isThaiText(orderData.name) && !!orderData.phone && !!orderData.instagram;
  }, [orderData]);

  const requireProfileBeforeCheckout = () => {
    if (!profileComplete) {
      showToast('warning', 'กรุณาบันทึกโปรไฟล์ก่อนชำระเงิน');
      setShowProfileModal(true);
      setPendingCheckout(true);
      return false;
    }
    return true;
  };

  const submitOrder = async () => {
    if (!profileComplete) {
      showToast('warning', 'กรุณาบันทึกโปรไฟล์ให้ครบก่อนยืนยันคำสั่งซื้อ');
      setShowProfileModal(true);
      setPendingCheckout(true);
      return;
    }

    if (cart.length === 0) {
      showToast('warning', 'ตะกร้าสินค้าว่างเปล่า');
      return;
    }

    try {
      setProcessing(true);
      const res = await submitOrderApi({
        customerName: orderData.name,
        customerEmail: orderData.email,
        customerPhone: orderData.phone,
        customerAddress: orderData.address,
        customerInstagram: orderData.instagram,
        cart: cart,
        totalAmount: getTotalPrice(),
      });

      if (res.status === 'success') {
        showToast('success', `สั่งซื้อสำเร็จ หมายเลข: ${res.ref}`);
        setCart([]);
        if (session?.user?.email) {
          saveCartApi(session.user.email, []).catch((err) => console.error('Failed to clear saved cart', err));
        }
        setShowOrderDialog(false);

        await saveProfileApi(orderData.email, {
          name: orderData.name,
          phone: orderData.phone,
          address: orderData.address,
          instagram: orderData.instagram,
        });

        if (res.ref) openPaymentFlow(res.ref);
      } else {
        throw new Error(res.message || 'เกิดข้อผิดพลาด');
      }
    } catch (error: any) {
      showToast('error', error.message || 'เกิดข้อผิดพลาดในการสั่งซื้อ');
    } finally {
      setProcessing(false);
    }
  };

  const loadOrderHistory = async (opts?: { append?: boolean }) => {
    if (!session?.user?.email) return;
    const append = opts?.append;
    const pageSize = isMobile ? 20 : 50;
    append ? setLoadingHistoryMore(true) : setLoadingHistory(true);
    try {
      const res = await getHistory(session.user.email, append ? historyCursor || undefined : undefined, pageSize);

      if (res.status === 'success') {
        const history = res.data?.history || (res as any)?.history || [];
        const hasMore = Boolean(res.data?.hasMore);
        const nextCursor = res.data?.nextCursor || null;
        if (Array.isArray(history)) {
          setOrderHistory((prev) => (append ? [...prev, ...history] : history));
          setHistoryHasMore(hasMore);
          setHistoryCursor(nextCursor);
        } else {
          console.warn('History response missing array', { res });
          if (!append) setOrderHistory([]);
          setHistoryHasMore(false);
          setHistoryCursor(null);
        }
      }
    } catch (error) {
      console.error('Failed to load history:', error);
      showToast('error', 'ไม่สามารถโหลดประวัติได้');
    } finally {
      append ? setLoadingHistoryMore(false) : setLoadingHistory(false);
    }
  };

  const handleSaveProfile = async (data: Partial<typeof orderData>) => {
    if (!session?.user?.email) {
      showToast('error', 'กรุณาเข้าสู่ระบบ');
      return;
    }

    setSavingProfile(true);
    const sanitized = {
      name: data.name ? data.name.replace(/[^\u0E00-\u0E7F\s]/g, '').trim() : orderData.name,
      phone: data.phone ? onlyDigitsPhone(data.phone) : orderData.phone,
      address: data.address ? data.address.trim() : orderData.address,
      instagram: data.instagram ? data.instagram.trim() : orderData.instagram,
    };
    setOrderData((prev) => ({ ...prev, ...sanitized }));

    try {
      await saveProfileApi(session.user.email, {
        name: sanitized.name,
        phone: sanitized.phone,
        address: sanitized.address,
        instagram: sanitized.instagram,
      });

      showToast('success', 'บันทึกข้อมูลจัดส่งแล้ว');
      setShowProfileModal(false);
      if (pendingCheckout && isThaiText(sanitized.name) && sanitized.phone && sanitized.instagram) {
        setShowOrderDialog(true);
        setPendingCheckout(false);
      }
    } catch (error: any) {
      showToast('error', error.message || 'บันทึกข้อมูลไม่สำเร็จ');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab as any);
    if (tab === 'home') {
      setSidebarOpen(false);
      setShowCart(false);
      setShowHistoryDialog(false);
    } else if (tab === 'cart') {
      setShowCart(true);
      setShowHistoryDialog(false);
    } else if (tab === 'history') {
      setShowHistoryDialog(true);
      setShowCart(false);
      setHistoryCursor(null);
      setHistoryHasMore(false);
      loadOrderHistory();
    } else if (tab === 'profile') {
      setSidebarOpen(false);
      setShowProfileModal(true);
    }
  };


  const productImages = useMemo(() => (selectedProduct?.images || []).filter(Boolean), [selectedProduct]);
  const totalImages = productImages.length;
  const displaySizes = useMemo(() => {
    if (!selectedProduct) return [] as string[];
    const sizeKeys = Object.keys(selectedProduct.sizePricing || {});
    return sizeKeys.length > 0 ? sizeKeys : ['ฟรีไซส์'];
  }, [selectedProduct]);

  const sizeChartRows = useMemo(() => {
    if (!selectedProduct) return [] as { size: string; price: number }[];
    return displaySizes.map((size) => ({
      size,
      price: selectedProduct.sizePricing?.[size] ?? selectedProduct.basePrice,
    }));
  }, [displaySizes, selectedProduct]);

  const groupedProducts = useMemo(() => {
    const items = (config?.products || []).filter((p) => p.isActive);
    const map: Record<string, Product[]> = {};
    items.forEach((p) => {
      const key = p.type || 'OTHER';
      if (!map[key]) map[key] = [];
      map[key].push(p);
    });
    return map;
  }, [config?.products]);

  const activeProductCount = useMemo(() => Object.values(groupedProducts).reduce((acc, items) => acc + items.length, 0), [groupedProducts]);

  const priceBounds = useMemo(() => {
    const all = Object.values(groupedProducts).flat();
    if (all.length === 0) return { min: 0, max: 0 };
    const prices = all.map(getBasePrice);
    return { min: Math.min(...prices), max: Math.max(...prices) };
  }, [groupedProducts]);

  useEffect(() => {
    if (priceBounds.max === 0 && priceBounds.min === 0) return;
    setPriceRange([priceBounds.min, priceBounds.max]);
  }, [priceBounds.min, priceBounds.max]);

  const categoryMeta = useMemo(
    () => [
      { key: 'ALL', label: 'ทั้งหมด', count: activeProductCount },
      ...Object.entries(groupedProducts).map(([key, items]) => ({ key, label: TYPE_LABELS[key] || key || 'อื่นๆ', count: items.length })),
    ],
    [activeProductCount, groupedProducts]
  );

  const filteredGroupedProducts = useMemo(() => {
    const term = productSearch.trim().toLowerCase();
    const entries = Object.entries(groupedProducts)
      .filter(([key]) => categoryFilter === 'ALL' || key === categoryFilter)
      .map(([key, items]) => {
        const byName = term ? items.filter((p) => p.name?.toLowerCase().includes(term)) : items;
        const byPrice = byName.filter((p) => {
          const price = getBasePrice(p);
          return priceRange[0] <= price && price <= priceRange[1];
        });
        return [key, byPrice] as const;
      })
      .filter(([, items]) => items.length > 0);
    return Object.fromEntries(entries);
  }, [categoryFilter, groupedProducts, priceRange, productSearch]);

  const filteredProductCount = useMemo(
    () => Object.values(filteredGroupedProducts).reduce((acc, items) => acc + items.length, 0),
    [filteredGroupedProducts]
  );

  if (!mounted) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', bgcolor: '#0f172a' }}>
        <CircularProgress sx={{ color: '#6366f1' }} />
      </Box>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: '#0f172a' }}>
        <AppBar
          position="sticky"
          elevation={0}
          sx={{ bgcolor: 'rgba(15,23,42,0.65)', borderBottom: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(14px)' }}
        >
          <Toolbar>
            <BrandMark />
            <Box sx={{ flexGrow: 1 }} />
          </Toolbar>
        </AppBar>

        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
          <Container maxWidth="sm">
            <Card sx={{ bgcolor: '#1e293b', border: '1px solid #334155', p: 4, textAlign: 'center' }}>
              <LogIn size={64} style={{ color: '#6366f1', margin: '0 auto 24px', display: 'block' }} />
              <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 2, color: '#f1f5f9' }}>
                ต้องเข้าสู่ระบบ
              </Typography>
              <Typography sx={{ color: '#94a3b8', mb: 4 }}>
                กรุณาล็อกอินด้วย Google เพื่อเริ่มช้อปปิ้ง
              </Typography>
              <Button
                variant="contained"
                size="large"
                startIcon={<LogIn />}
                onClick={() => signIn('google')}
                sx={{
                  background: 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)',
                  width: '100%',
                }}
              >
                เข้าสู่ระบบด้วย Google
              </Button>
            </Card>
          </Container>
        </Box>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: '#0f172a' }}>
        <AppBar
          position="sticky"
          elevation={0}
          sx={{ bgcolor: 'rgba(15,23,42,0.65)', borderBottom: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(14px)' }}
        >
          <Toolbar>
            <BrandMark />
            <Box sx={{ flexGrow: 1 }} />
          </Toolbar>
          <LinearProgress sx={{ height: 3, bgcolor: 'rgba(255,255,255,0.04)', '& .MuiLinearProgress-bar': { background: 'linear-gradient(90deg, #38bdf8 0%, #6366f1 50%, #c084fc 100%)' } }} />
        </AppBar>
        <Container maxWidth="lg" sx={{ flex: 1, py: 4 }}>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 8 }}>
              <Box sx={{ mb: 3 }}>
                <Skeleton animation="wave" variant="text" width={220} height={42} sx={{ bgcolor: '#16213a' }} />
                <Skeleton animation="wave" variant="text" width={320} height={26} sx={{ bgcolor: '#16213a' }} />
              </Box>
              <Grid container spacing={2.5}>
                {Array.from({ length: 6 }).map((_, idx) => (
                  <Grid size={{ xs: 12, sm: 6, md: 4 }} key={idx}>
                    <Card sx={{ bgcolor: '#0f172a', border: '1px solid #1f2937', boxShadow: '0 18px 40px rgba(0,0,0,0.35)', overflow: 'hidden' }}>
                      <Skeleton animation="wave" variant="rectangular" height={160} sx={{ bgcolor: '#111827' }} />
                      <CardContent sx={{ pt: 2 }}>
                        <Skeleton animation="wave" variant="text" width="68%" height={24} sx={{ bgcolor: '#16213a' }} />
                        <Skeleton animation="wave" variant="text" width="88%" height={18} sx={{ bgcolor: '#16213a' }} />
                        <Skeleton animation="wave" variant="text" width="46%" height={22} sx={{ bgcolor: '#16213a' }} />
                      </CardContent>
                      <Box sx={{ p: 2, pt: 0 }}>
                        <Skeleton animation="wave" variant="rectangular" height={38} sx={{ borderRadius: 1.5, bgcolor: '#16213a' }} />
                      </Box>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Grid>

            <Grid size={{ xs: 12, md: 4 }}>
              <Card sx={{ bgcolor: '#0f172a', border: '1px solid #1f2937', boxShadow: '0 18px 40px rgba(0,0,0,0.35)' }}>
                <CardContent>
                  <Skeleton animation="wave" variant="text" width={180} height={26} sx={{ bgcolor: '#16213a', mb: 2 }} />
                  {Array.from({ length: 3 }).map((_, idx) => (
                    <Box key={idx} sx={{ mb: 2 }}>
                      <Skeleton animation="wave" variant="text" width="82%" height={18} sx={{ bgcolor: '#16213a' }} />
                      <Skeleton animation="wave" variant="text" width="52%" height={16} sx={{ bgcolor: '#16213a' }} />
                    </Box>
                  ))}
                  <Skeleton animation="wave" variant="rectangular" height={46} sx={{ borderRadius: 1.5, bgcolor: '#16213a', mt: 2 }} />
                </CardContent>
              </Card>

              <Box sx={{ mt: 3, p: 2, borderRadius: 2, bgcolor: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                  <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: '#1f2937' }} />
                  <Skeleton animation="wave" variant="text" width="60%" height={18} sx={{ bgcolor: '#16213a' }} />
                </Box>
                <Skeleton animation="wave" variant="text" width="90%" height={14} sx={{ bgcolor: '#16213a', mb: 0.5 }} />
                <Skeleton animation="wave" variant="text" width="80%" height={14} sx={{ bgcolor: '#16213a' }} />
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: '#0f172a', pb: { xs: 9, md: 0 } }}>
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          bgcolor: 'rgba(15,23,42,0.65)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          backdropFilter: 'blur(14px)',
          boxShadow: '0 18px 50px rgba(0,0,0,0.35)',
          transform: hideNavBars ? 'translateY(-110%)' : 'translateY(0)',
          opacity: hideNavBars ? 0 : 1,
          transition: 'transform 0.32s ease, opacity 0.28s ease',
          position: 'sticky',
          top: 0,
          zIndex: 1200,
        }}
      >
        <Toolbar>
          <BrandMark />
          <Box sx={{ flexGrow: 1 }} />
          <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 1, mr: 2 }}>
            <Button
              variant={showSearchBar ? 'contained' : 'outlined'}
              startIcon={<Search size={18} />}
              onClick={() => setShowSearchBar((v) => !v)}
              sx={{
                color: showSearchBar ? '#0b1120' : '#e2e8f0',
                borderColor: showSearchBar ? 'transparent' : 'rgba(255,255,255,0.18)',
                background: showSearchBar ? 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)' : 'rgba(15,23,42,0.4)',
                textTransform: 'none',
                fontWeight: 700,
                borderRadius: 1.5,
              }}
            >
              ค้นหา
            </Button>
          </Box>
          <IconButton
            onClick={() => setShowSearchBar((v) => !v)}
            sx={{ mr: 1, display: { xs: 'flex', md: 'none' }, color: '#f1f5f9', alignItems: 'center', gap: 0.5 }}
          >
            <Search size={22} />
          </IconButton>
          <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 1, mr: 2 }}>
            <Button
              variant="outlined"
              startIcon={<Home size={18} />}
              onClick={() => handleTabChange('home')}
              sx={{
                color: activeTab === 'home' ? '#6366f1' : '#e2e8f0',
                borderColor: activeTab === 'home' ? 'rgba(99,102,241,0.6)' : 'rgba(255,255,255,0.18)',
                backgroundColor: activeTab === 'home' ? 'rgba(99,102,241,0.12)' : 'transparent',
                textTransform: 'none',
                borderRadius: 2,
                px: 1.5,
                py: 0.5,
                height: 40,
                '&:hover': { borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,0.16)' },
              }}
            >
              หน้าแรก
            </Button>
            <Button
              variant="outlined"
              startIcon={<History size={18} />}
              onClick={() => handleTabChange('history')}
              sx={{
                color: activeTab === 'history' ? '#6366f1' : '#e2e8f0',
                borderColor: activeTab === 'history' ? 'rgba(99,102,241,0.6)' : 'rgba(255,255,255,0.18)',
                backgroundColor: activeTab === 'history' ? 'rgba(99,102,241,0.12)' : 'transparent',
                textTransform: 'none',
                borderRadius: 2,
                px: 1.5,
                py: 0.5,
                height: 40,
                '&:hover': { borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,0.16)' },
              }}
            >
              ประวัติ
            </Button>
            <Button
              variant="outlined"
              startIcon={<User size={18} />}
              onClick={() => handleTabChange('profile')}
              sx={{
                color: activeTab === 'profile' ? '#6366f1' : '#e2e8f0',
                borderColor: activeTab === 'profile' ? 'rgba(99,102,241,0.6)' : 'rgba(255,255,255,0.18)',
                backgroundColor: activeTab === 'profile' ? 'rgba(99,102,241,0.12)' : 'transparent',
                textTransform: 'none',
                borderRadius: 2,
                px: 1.5,
                py: 0.5,
                height: 40,
                '&:hover': { borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,0.16)' },
              }}
            >
              โปรไฟล์
            </Button>
            <Button
              variant="outlined"
              startIcon={(
                <Badge badgeContent={cart.length} color="error">
                  <ShoppingCart size={18} />
                </Badge>
              )}
              onClick={() => handleTabChange('cart')}
              sx={{
                color: activeTab === 'cart' ? '#6366f1' : '#e2e8f0',
                borderColor: activeTab === 'cart' ? 'rgba(99,102,241,0.6)' : 'rgba(255,255,255,0.18)',
                backgroundColor: activeTab === 'cart' ? 'rgba(99,102,241,0.12)' : 'transparent',
                textTransform: 'none',
                borderRadius: 2,
                px: 1.5,
                py: 0.5,
                height: 40,
                '&:hover': { borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,0.16)' },
              }}
            >
              ตะกร้า
            </Button>
          </Box>
          {session && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Avatar src={session?.user?.image || ''} sx={{ width: 32, height: 32, cursor: 'pointer' }} onClick={() => setSidebarOpen(true)} />
            </Box>
          )}
        </Toolbar>
        {showSearchBar && (
          <Box sx={{ px: { xs: 2, md: 3 }, pb: 1.5, pt: 0.5 }}>
            <TextField
              autoFocus
              size="small"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="ค้นหาชื่อสินค้า"
              inputProps={{ maxLength: 50 }}
              fullWidth
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: '#e2e8f0',
                  background: 'rgba(15,23,42,0.9)',
                  borderRadius: 1.5,
                },
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.12)' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#6366f1' },
                '& .MuiInputBase-input::placeholder': { color: '#94a3b8', opacity: 1 },
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={18} color="#94a3b8" />
                  </InputAdornment>
                ),
              }}
            />
          </Box>
        )}
      </AppBar>

      {!isShopOpen && (
        <Alert severity="warning" sx={{ borderRadius: 0 }}>
          <AlertTriangle style={{ marginRight: 8, display: 'inline' }} size={20} />
          ร้านค้าปิดให้บริการชั่วคราว
        </Alert>
      )}

      {announcement?.enabled && announcement?.message && (
        <Alert severity="info" sx={{ borderRadius: 0, bgcolor: ANNOUNCEMENT_COLOR_MAP[announcement.color] || '#3b82f6', color: 'white' }}>
          {announcement.message}
        </Alert>
      )}

      <Drawer
        anchor="right"
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        PaperProps={{
          sx: {
            bgcolor: 'rgba(10,14,26,0.9)',
            color: '#f1f5f9',
            width: 320,
            maxHeight: '100vh',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            backdropFilter: 'blur(24px)',
            borderLeft: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '-18px 0 60px rgba(0,0,0,0.45)',
            backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(99,102,241,0.18), transparent 42%), radial-gradient(circle at 80% 0%, rgba(14,165,233,0.16), transparent 38%)',
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>เมนู</Typography>
            <IconButton onClick={() => setSidebarOpen(false)}>
              <X style={{ color: '#f1f5f9' }} size={24} />
            </IconButton>
          </Box>
          <Divider sx={{ mb: 2, borderColor: '#334155' }} />

          {session && (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Avatar src={session?.user?.image || ''} sx={{ mr: 2, width: 40, height: 40 }} />
                <Box>
                  <Typography sx={{ fontWeight: 'bold', color: '#f1f5f9' }}>{session?.user?.name}</Typography>
                  <Typography variant="caption" sx={{ color: '#94a3b8' }}>{session?.user?.email}</Typography>
                </Box>
              </Box>
              <Divider sx={{ my: 2, borderColor: '#334155' }} />
              <Button
                fullWidth
                onClick={() => { setSidebarOpen(false); setShowProfileModal(true); setActiveTab('profile'); }}
                sx={{
                  textAlign: 'left',
                  mb: 1,
                  color: '#e2e8f0',
                  justifyContent: 'flex-start',
                  borderRadius: 2,
                  px: 1.5,
                  py: 1.1,
                  background: 'linear-gradient(120deg, rgba(99,102,241,0.18), rgba(14,165,233,0.12))',
                  border: '1px solid rgba(255,255,255,0.08)',
                  boxShadow: '0 12px 30px rgba(0,0,0,0.25)',
                  '&:hover': { borderColor: 'rgba(99,102,241,0.5)', background: 'linear-gradient(120deg, rgba(99,102,241,0.24), rgba(14,165,233,0.18))' },
                }}
                startIcon={<User size={20} />}
              >
                ข้อมูลจัดส่งของฉัน
              </Button>
              <Button
                fullWidth
                onClick={() => { setSidebarOpen(false); setShowHistoryDialog(true); loadOrderHistory(); }}
                sx={{
                  textAlign: 'left',
                  mb: 1,
                  color: '#e2e8f0',
                  justifyContent: 'flex-start',
                  borderRadius: 2,
                  px: 1.5,
                  py: 1.1,
                  background: 'linear-gradient(120deg, rgba(16,185,129,0.18), rgba(14,165,233,0.12))',
                  border: '1px solid rgba(255,255,255,0.08)',
                  boxShadow: '0 12px 30px rgba(0,0,0,0.25)',
                  '&:hover': { borderColor: 'rgba(16,185,129,0.5)', background: 'linear-gradient(120deg, rgba(16,185,129,0.22), rgba(14,165,233,0.16))' },
                }}
                startIcon={<History size={20} />}
              >
                ประวัติคำสั่งซื้อ
              </Button>
              <Button
                fullWidth
                onClick={() => signOut()}
                sx={{
                  textAlign: 'left',
                  color: '#fecdd3',
                  justifyContent: 'flex-start',
                  borderRadius: 2,
                  px: 1.5,
                  py: 1.1,
                  background: 'linear-gradient(120deg, rgba(239,68,68,0.12), rgba(239,68,68,0.06))',
                  border: '1px solid rgba(248,113,113,0.4)',
                  boxShadow: '0 12px 30px rgba(239,68,68,0.18)',
                  '&:hover': { borderColor: 'rgba(248,113,113,0.8)', background: 'linear-gradient(120deg, rgba(239,68,68,0.18), rgba(239,68,68,0.12))' },
                }}
                startIcon={<LogOut size={20} />}
              >
                ออกจากระบบ
              </Button>
            </>
          )}

          <Divider sx={{ my: 2, borderColor: '#334155' }} />
          <Button
            component={Link}
            href="/"
            fullWidth
            sx={{
              textAlign: 'left',
              color: '#e2e8f0',
              justifyContent: 'flex-start',
              borderRadius: 2,
              px: 1.5,
              py: 1.1,
              background: 'linear-gradient(120deg, rgba(99,102,241,0.16), rgba(30,41,59,0.6))',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 12px 30px rgba(0,0,0,0.22)',
              '&:hover': { borderColor: 'rgba(99,102,241,0.6)', background: 'linear-gradient(120deg, rgba(99,102,241,0.22), rgba(30,41,59,0.7))' },
            }}
            startIcon={<Home size={20} />}
          >
            หน้าแรก
          </Button>
        </Box>
      </Drawer>

      <Box sx={{ display: 'flex', flex: 1 }}>
        <Box sx={{ flex: 1, p: { xs: 2, md: 3 } }}>
          <Container maxWidth="lg">
            

            {activeProductCount > 0 && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 2 }}>
                <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1, alignItems: { xs: 'stretch', sm: 'center' } }}>
                  <Typography variant="body2" sx={{ color: '#94a3b8' }}>
                    พบสินค้า {filteredProductCount} / {activeProductCount}
                  </Typography>
                  <Box sx={{ flex: 1 }} />
                  {priceBounds.max > 0 && priceBounds.max !== priceBounds.min && (
                    <Box sx={{ minWidth: { xs: '100%', sm: 320 }, maxWidth: 420 }}>
                      <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                        กรองราคา: {priceRange[0].toLocaleString()}฿ - {priceRange[1].toLocaleString()}฿
                      </Typography>
                      <Slider
                        value={priceRange}
                        min={priceBounds.min}
                        max={priceBounds.max}
                        step={10}
                        onChange={(_, value) => setPriceRange(value as [number, number])}
                        valueLabelDisplay="off"
                        sx={{
                          color: '#6366f1',
                          '& .MuiSlider-track': { border: 'none' },
                          '& .MuiSlider-thumb': {
                            backgroundColor: '#e2e8f0',
                            border: '2px solid #6366f1',
                          },
                        }}
                      />
                    </Box>
                  )}
                </Box>
                <Box
                  sx={{
                    display: 'flex',
                    gap: 0.75,
                    flexWrap: 'nowrap',
                    overflowX: 'auto',
                    pb: 0.5,
                    maskImage: 'linear-gradient(to right, transparent, black 12px, black 90%, transparent)',
                    WebkitOverflowScrolling: 'touch',
                  }}
                >
                  {categoryMeta.map((cat) => {
                    const active = categoryFilter === cat.key;
                    return (
                      <Button
                        key={cat.key}
                        variant={active ? 'contained' : 'outlined'}
                        size="small"
                        onClick={() => setCategoryFilter(cat.key)}
                        sx={{
                          borderRadius: 1.2,
                          borderColor: active ? 'transparent' : 'rgba(99,102,241,0.35)',
                          background: active ? 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)' : 'rgba(15,23,42,0.65)',
                          color: active ? '#0b1120' : '#e2e8f0',
                          fontWeight: 700,
                          textTransform: 'none',
                          px: 1.3,
                          whiteSpace: 'nowrap',
                          minWidth: 'max-content',
                        }}
                      >
                        {cat.label} ({cat.count})
                      </Button>
                    );
                  })}
                </Box>
              </Box>
            )}

            {config?.products && Object.keys(filteredGroupedProducts).length > 0 ? (
              Object.entries(filteredGroupedProducts).map(([type, items]) => (
                <Box key={type} sx={{ mb: 4 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Chip label={TYPE_LABELS[type] || type || 'อื่นๆ'} color="primary" variant="outlined" sx={{ fontWeight: 700 }} />
                    <Typography variant="h6" sx={{ color: '#e2e8f0', fontWeight: 800 }}>{TYPE_LABELS[type] || type || 'อื่นๆ'}</Typography>
                    <Typography variant="body2" sx={{ color: '#94a3b8' }}>{items.length === 1 ? 'สินค้า 1 รายการ' : `สินค้า ${items.length} รายการ`}</Typography>
                  </Box>
                  <Grid container spacing={3}>
                    {items.map((product) => (
                      <Grid size={{ xs: 12, sm: 6, md: 4 }} key={product.id}>
                        <Card
                          onClick={() => {
                            setSelectedProduct(product);
                            setProductDialogOpen(true);
                          }}
                          sx={{
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            cursor: 'pointer',
                            background: 'linear-gradient(150deg, rgba(14,19,33,0.95), rgba(15,23,42,0.9))',
                            border: '1px solid rgba(99,102,241,0.18)',
                            borderRadius: 1.5,
                            overflow: 'hidden',
                            boxShadow: '0 14px 34px rgba(0,0,0,0.28)',
                            transition: 'transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease',
                            '&:hover': {
                              transform: 'translateY(-4px)',
                              boxShadow: '0 18px 38px rgba(99,102,241,0.24)',
                              borderColor: '#6366f1',
                            },
                          }}
                        >
                          <CardMedia
                            component="div"
                            sx={{
                              position: 'relative',
                              bgcolor: '#0b1224',
                              backgroundImage: product.images?.[0] ? `url(${product.images[0]})` : undefined,
                              backgroundSize: 'cover',
                              backgroundPosition: 'center',
                              aspectRatio: '4 / 3',
                              minHeight: 200,
                              borderBottom: '1px solid rgba(255,255,255,0.06)',
                            }}
                          >
                            {!product.images?.[0] && (
                              <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1', fontWeight: 700 }}>
                                ไม่มีภาพสินค้า
                              </Box>
                            )}
                            <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, p: 1.5, background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.75) 100%)', display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                              <Chip label={product.type || 'OTHER'} size="small" sx={{ bgcolor: '#0ea5e9', color: 'white', fontWeight: 700 }} />
                              {product.options?.hasLongSleeve && <Chip label="แขนยาว" size="small" sx={{ bgcolor: 'rgba(255,255,255,0.15)', color: '#e2e8f0' }} />}
                              {product.options?.hasCustomName && <Chip label="ชื่อบนเสื้อ" size="small" sx={{ bgcolor: 'rgba(255,255,255,0.15)', color: '#e2e8f0' }} />}
                            </Box>
                          </CardMedia>
                          <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                            <Typography variant="h6" sx={{ fontWeight: 800, color: '#f8fafc', letterSpacing: 0.1 }}>
                              {product.name}
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#cbd5e1', minHeight: 44 }}>
                              {product.description}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
                              <Typography variant="h6" sx={{ color: '#10b981', fontWeight: 900 }}>
                                {product.basePrice.toLocaleString()}฿
                              </Typography>
                            </Box>
                          </CardContent>
                          <Box sx={{ p: 2, pt: 0 }}>
                            <Button
                              variant="contained"
                              fullWidth
                              startIcon={<ShoppingCart size={18} />}
                              disabled={!isShopOpen}
                              sx={{
                                background: isShopOpen ? 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)' : 'linear-gradient(135deg, #475569 0%, #334155 100%)',
                                fontWeight: 800,
                                borderRadius: 1.5,
                                py: 1.1,
                                boxShadow: '0 10px 26px rgba(99, 102, 241, 0.28)',
                                '&:hover': {
                                  background: isShopOpen ? 'linear-gradient(135deg, #5458e9 0%, #05a2c2 100%)' : 'linear-gradient(135deg, #475569 0%, #334155 100%)',
                                  boxShadow: isShopOpen ? '0 12px 30px rgba(99, 102, 241, 0.36)' : '0 10px 24px rgba(51,65,85,0.32)',
                                },
                              }}
                            >
                              {isShopOpen ? 'สั่งซื้อ' : 'ปิดบริการ'}
                            </Button>
                          </Box>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              ))
            ) : (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <Store style={{ fontSize: 64, color: '#64748b', marginBottom: 16, display: 'block' }} />
                <Typography variant="h6" sx={{ color: '#94a3b8' }}>ยังไม่มีสินค้า</Typography>
              </Box>
            )}
          </Container>
        </Box>

        {cart.length > 0 && (
          <Box sx={{ display: { xs: 'none', md: 'block' }, width: 350, p: 2, bgcolor: '#0f172a', borderLeft: '1px solid #334155', overflow: 'auto', maxHeight: 'calc(100vh - 64px)' }}>
            <Card sx={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(16px)' }}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2, color: '#f1f5f9' }}>
                  สรุปคำสั่งซื้อ
                </Typography>
                {cart.map((item) => (
                  <Box key={item.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, pb: 2, borderBottom: '1px solid #334155' }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#f1f5f9' }}>
                        {item.productName}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                        {item.size} × {item.quantity}
                      </Typography>
                      {(item.options.customName || item.options.customNumber || item.options.isLongSleeve) && (
                        <Typography variant="caption" sx={{ color: '#cbd5e1', display: 'block' }}>
                          {item.options.customName && `ชื่อ: ${item.options.customName}`} {item.options.customNumber && `เบอร์: ${item.options.customNumber}`} {item.options.isLongSleeve && '(แขนยาว)'}
                        </Typography>
                      )}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                        <IconButton
                          size="small"
                          onClick={() => updateCartQuantity(item.id, item.quantity - 1)}
                          onMouseDown={() => startCartHold(item.id, -1)}
                          onMouseUp={() => stopCartHold(item.id)}
                          onMouseLeave={() => stopCartHold(item.id)}
                          onTouchStart={() => startCartHold(item.id, -1)}
                          onTouchEnd={() => stopCartHold(item.id)}
                          sx={{ bgcolor: '#334155', color: '#f1f5f9' }}
                        >
                          <Minus size={14} />
                        </IconButton>
                        <Typography sx={{ color: '#f1f5f9', minWidth: 20, textAlign: 'center' }}>{item.quantity}</Typography>
                        <IconButton
                          size="small"
                          onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
                          onMouseDown={() => startCartHold(item.id, 1)}
                          onMouseUp={() => stopCartHold(item.id)}
                          onMouseLeave={() => stopCartHold(item.id)}
                          onTouchStart={() => startCartHold(item.id, 1)}
                          onTouchEnd={() => stopCartHold(item.id)}
                          sx={{ bgcolor: '#334155', color: '#f1f5f9' }}
                        >
                          <Plus size={14} />
                        </IconButton>
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#10b981' }}>
                        {(item.unitPrice * item.quantity).toLocaleString()}฿
                      </Typography>
                      <IconButton size="small" onClick={() => removeFromCart(item.id)} sx={{ color: '#ef4444' }}>
                        <X size={14} />
                      </IconButton>
                    </Box>
                  </Box>
                ))}
                <Divider sx={{ my: 2, borderColor: '#334155' }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                  <Typography sx={{ fontWeight: 'bold', color: '#f1f5f9' }}>รวม:</Typography>
                  <Typography sx={{ fontWeight: 'bold', fontSize: 18, color: '#10b981' }}>
                    {getTotalPrice().toLocaleString()}฿
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  fullWidth
                  onClick={() => {
                    if (!requireProfileBeforeCheckout()) return;
                    setShowOrderDialog(true);
                  }}
                  disabled={!isShopOpen}
                  sx={{
                    background: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
                    fontWeight: 700,
                    borderRadius: 2,
                    py: 1,
                    boxShadow: '0 12px 30px rgba(16, 185, 129, 0.35)',
                    '&:hover': { background: 'linear-gradient(135deg, #0ea472 0%, #0591b5 100%)', boxShadow: '0 12px 34px rgba(16, 185, 129, 0.45)' },
                  }}
                >
                  ดำเนินการสั่งซื้อ
                </Button>
              </CardContent>
            </Card>
          </Box>
        )}
      </Box>

      <Footer />

      <PaymentFlow
        registerOpener={(opener) => {
          paymentOpenerRef.current = opener;
        }}
        onPaymentSuccess={() => {
          loadOrderHistory();
          setActiveTab('history');
          showToast('success', 'บันทึกการชำระเงินแล้ว');
        }}
      />

      {showProfileModal && (
        <ProfileModal
          initialData={{ name: orderData.name, phone: orderData.phone, address: orderData.address, instagram: orderData.instagram }}
          onClose={() => { setShowProfileModal(false); setActiveTab('home'); }}
          onSave={handleSaveProfile}
        />
      )}

      <Drawer
        anchor="bottom"
        open={showCart}
        onClose={() => setShowCart(false)}
        PaperProps={{
          sx: {
            bgcolor: 'rgba(15,23,42,0.92)',
            color: '#f1f5f9',
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            maxHeight: '80vh',
            display: 'block',
            backdropFilter: 'blur(18px)',
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
              <ShoppingCart size={24} />
              ตะกร้าสินค้า
            </Typography>
            <IconButton onClick={() => setShowCart(false)} sx={{ color: '#f1f5f9' }}>
              <X size={24} />
            </IconButton>
          </Box>
          <Divider sx={{ mb: 2, borderColor: '#334155' }} />

          {cart.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <ShoppingCart size={48} style={{ color: '#64748b', marginBottom: 16 }} />
              <Typography sx={{ color: '#94a3b8' }}>ตะกร้าว่างเปล่า</Typography>
            </Box>
          ) : (
            <>
              <Box sx={{ maxHeight: '40vh', overflow: 'auto', mb: 2 }}>
                {cart.map((item) => (
                  <Box key={item.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, pb: 2, borderBottom: '1px solid #334155' }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#f1f5f9' }}>
                        {item.productName}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                        {item.size} × {item.quantity}
                      </Typography>
                      {(item.options.customName || item.options.customNumber || item.options.isLongSleeve) && (
                        <Typography variant="caption" sx={{ color: '#cbd5e1', display: 'block' }}>
                          {item.options.customName && `ชื่อ: ${item.options.customName}`} {item.options.customNumber && `เบอร์: ${item.options.customNumber}`} {item.options.isLongSleeve && '(แขนยาว)'}
                        </Typography>
                      )}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                        <IconButton
                          size="small"
                          onClick={() => updateCartQuantity(item.id, item.quantity - 1)}
                          onMouseDown={() => startCartHold(item.id, -1)}
                          onMouseUp={() => stopCartHold(item.id)}
                          onMouseLeave={() => stopCartHold(item.id)}
                          onTouchStart={() => startCartHold(item.id, -1)}
                          onTouchEnd={() => stopCartHold(item.id)}
                          sx={{ bgcolor: '#334155', color: '#f1f5f9' }}
                        >
                          <Minus size={14} />
                        </IconButton>
                        <Typography sx={{ color: '#f1f5f9', minWidth: 20, textAlign: 'center' }}>{item.quantity}</Typography>
                        <IconButton
                          size="small"
                          onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
                          onMouseDown={() => startCartHold(item.id, 1)}
                          onMouseUp={() => stopCartHold(item.id)}
                          onMouseLeave={() => stopCartHold(item.id)}
                          onTouchStart={() => startCartHold(item.id, 1)}
                          onTouchEnd={() => stopCartHold(item.id)}
                          sx={{ bgcolor: '#334155', color: '#f1f5f9' }}
                        >
                          <Plus size={14} />
                        </IconButton>
                      </Box>
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#10b981' }}>
                        {(item.unitPrice * item.quantity).toLocaleString()}฿
                      </Typography>
                      <IconButton size="small" onClick={() => removeFromCart(item.id)} sx={{ color: '#ef4444', mt: 0.5 }}>
                        <X size={16} />
                      </IconButton>
                    </Box>
                  </Box>
                ))}
              </Box>
              <Divider sx={{ my: 2, borderColor: '#334155' }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Typography sx={{ fontWeight: 'bold', color: '#f1f5f9' }}>รวมทั้งหมด:</Typography>
                <Typography sx={{ fontWeight: 'bold', fontSize: 20, color: '#10b981' }}>
                  {getTotalPrice().toLocaleString()}฿
                </Typography>
              </Box>
              <Button
                variant="contained"
                fullWidth
                size="large"
                onClick={() => {
                  if (!requireProfileBeforeCheckout()) return;
                  setShowCart(false);
                  setShowOrderDialog(true);
                }}
                disabled={!isShopOpen}
                sx={{
                  background: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
                  fontWeight: 700,
                  borderRadius: 2,
                  py: 1.5,
                  boxShadow: '0 10px 26px rgba(16, 185, 129, 0.32)',
                  '&:hover': { background: 'linear-gradient(135deg, #0ea472 0%, #0591b5 100%)', boxShadow: '0 12px 30px rgba(16, 185, 129, 0.42)' },
                }}
              >
                ดำเนินการสั่งซื้อ
              </Button>
            </>
          )}
        </Box>
      </Drawer>

      {renderProductDialog()}

      <Dialog
        open={showSizeChart}
        onClose={() => setShowSizeChart(false)}
        maxWidth="md"
        fullWidth
        fullScreen={isMobile}
        PaperProps={{
          sx: {
            width: { xs: '100%', sm: '92%', md: '960px' },
            maxWidth: 'calc(100% - 24px)',
          },
        }}
      >
        <DialogTitle>ตารางไซส์</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="body2" sx={{ color: '#0f172a' }}>
            ตารางไซส์พร้อมสัดส่วนรอบอก/ความยาว (นิ้ว) ราคาต่อขนาด; เลือกแขนยาวจะบวกเพิ่ม 50฿/ตัว
          </Typography>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            <Chip size="small" label="อก / ความยาว (นิ้ว)" sx={{ bgcolor: '#e2e8f0', color: '#0f172a', borderRadius: 1 }} />
            <Chip size="small" label="ราคาอัปเดตตามสินค้า" sx={{ bgcolor: '#cbd5e1', color: '#0f172a', borderRadius: 1 }} />
            <Chip size="small" label="แขนยาว +50฿" sx={{ bgcolor: '#fde68a', color: '#0f172a', borderRadius: 1 }} />
          </Box>

          {isMobile ? (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(auto-fill, minmax(150px, 1fr))', sm: 'repeat(auto-fill, minmax(180px, 1fr))' }, gap: 1.5 }}>
              {SIZE_ORDER.map((size) => {
                const measurements = SIZE_MEASUREMENTS[size];
                const row = sizeChartRows.find((r) => r.size === size);
                return (
                  <Paper key={size} sx={{ bgcolor: '#0f172a', border: '1px solid #1f2937', borderRadius: 2, p: 1.5, boxShadow: '0 10px 26px rgba(0,0,0,0.18)' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                      <Chip label={size} size="small" sx={{ bgcolor: '#6366f1', color: 'white', fontWeight: 800 }} />
                      <Typography sx={{ color: '#10b981', fontWeight: 800 }}>{row ? `${row.price.toLocaleString()}฿` : '—'}</Typography>
                    </Box>
                    <Typography variant="body2" sx={{ color: '#e2e8f0', mb: 0.5 }}>
                      {measurements ? `อก ${measurements.chest}" · ยาว ${measurements.length}"` : 'ไม่มีข้อมูลสัดส่วน'}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#94a3b8' }}>แขนยาว +50฿</Typography>
                  </Paper>
                );
              })}
            </Box>
          ) : (
            <Box sx={{ overflowX: 'auto' }}>
              <Box
                component="table"
                sx={{
                  borderCollapse: 'separate',
                  borderSpacing: 0,
                  width: '100%',
                  minWidth: 520,
                  background: '#111827',
                  color: '#e5e7eb',
                  borderRadius: 6,
                  overflow: 'hidden',
                  boxShadow: '0 10px 26px rgba(0,0,0,0.24)',
                  fontSize: { xs: '0.86rem', sm: '0.92rem' },
                }}
              >
                <Box component="thead" sx={{ background: '#1f2937' }}>
                  <Box component="tr">
                    <Box component="th" sx={{ px: 1.2, py: 1, textAlign: 'left', fontWeight: 800, borderBottom: '1px solid #1f2937' }}>ขนาด</Box>
                    {SIZE_ORDER.map((size) => (
                      <Box component="th" key={size} sx={{ px: 1.1, py: 1, textAlign: 'center', fontWeight: 800, borderBottom: '1px solid #1f2937' }}>{size}</Box>
                    ))}
                  </Box>
                </Box>
                <Box component="tbody">
                  <Box component="tr" sx={{ background: 'rgba(255,255,255,0.02)' }}>
                    <Box component="td" sx={{ px: 1.2, py: 0.9, fontWeight: 700, borderBottom: '1px solid #1f2937' }}>รอบอก</Box>
                    {SIZE_ORDER.map((size) => {
                      const measurements = SIZE_MEASUREMENTS[size];
                      return (
                        <Box component="td" key={size} sx={{ textAlign: 'center', px: 1.1, py: 0.9, borderBottom: '1px solid #1f2937' }}>
                          {measurements ? `${measurements.chest}"` : '—'}
                        </Box>
                      );
                    })}
                  </Box>
                  <Box component="tr">
                    <Box component="td" sx={{ px: 1.2, py: 0.9, fontWeight: 700, borderBottom: '1px solid #1f2937', background: 'rgba(255,255,255,0.02)' }}>ความยาว</Box>
                    {SIZE_ORDER.map((size) => {
                      const measurements = SIZE_MEASUREMENTS[size];
                      return (
                        <Box component="td" key={size} sx={{ textAlign: 'center', px: 1.1, py: 0.9, borderBottom: '1px solid #1f2937', background: 'rgba(255,255,255,0.02)' }}>
                          {measurements ? `${measurements.length}"` : '—'}
                        </Box>
                      );
                    })}
                  </Box>
                  <Box component="tr">
                    <Box component="td" sx={{ px: 1.2, py: 0.95, fontWeight: 800, background: '#0f172a' }}>ราคา</Box>
                    {SIZE_ORDER.map((size) => {
                      const row = sizeChartRows.find((r) => r.size === size);
                      return (
                        <Box component="td" key={size} sx={{ textAlign: 'center', px: 1.1, py: 0.95, fontWeight: 700, background: '#111827' }}>
                          {row ? `${row.price.toLocaleString()}฿` : '—'}
                        </Box>
                      );
                    })}
                  </Box>
                </Box>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSizeChart(false)}>ปิด</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={showOrderDialog}
        onClose={() => setShowOrderDialog(false)}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
        PaperProps={{
          sx: {
            width: { xs: '100%', sm: '92%', md: '720px' },
            maxWidth: 'calc(100% - 24px)',
            bgcolor: '#1e293b',
            color: '#f1f5f9',
          },
        }}
      >
        <DialogTitle sx={{ background: 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)', color: 'white' }}>
          ยืนยันการสั่งซื้อ
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 3 }}>
          <Paper sx={{ p: 2, bgcolor: '#334155' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1, color: '#f1f5f9' }}>
              สรุปคำสั่งซื้อ
            </Typography>
            {cart.map((item) => {
              const optionText = [
                item.options.customName ? `ชื่อ: ${item.options.customName}` : '',
                item.options.customNumber ? `เบอร์: ${item.options.customNumber}` : '',
                item.options.isLongSleeve ? '(แขนยาว)' : '',
              ].filter(Boolean).join(' ');

              return (
                <Box key={item.id} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Box>
                    <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block' }}>
                      {item.productName} × {item.quantity}
                    </Typography>
                    {optionText && (
                      <Typography variant="caption" sx={{ color: '#cbd5e1', display: 'block' }}>
                        {optionText}
                      </Typography>
                    )}
                  </Box>
                  <Typography variant="caption" sx={{ fontWeight: 'bold', color: '#10b981' }}>
                    {(item.unitPrice * item.quantity).toLocaleString()}฿
                  </Typography>
                </Box>
              );
            })}
            <Divider sx={{ my: 1, borderColor: '#475569' }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography sx={{ fontWeight: 'bold', color: '#f1f5f9' }}>รวม:</Typography>
              <Typography sx={{ fontWeight: 'bold', color: '#10b981' }}>
                {getTotalPrice().toLocaleString()}฿
              </Typography>
            </Box>
          </Paper>
          <Paper sx={{ p: 2, bgcolor: '#0f172a', border: '1px solid #334155', borderRadius: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#f1f5f9' }}>ข้อมูลผู้รับสินค้า</Typography>
              <Button size="small" variant="outlined" onClick={() => { setShowProfileModal(true); setPendingCheckout(true); }} sx={{ borderColor: '#6366f1', color: '#cbd5e1' }}>
                แก้ไขโปรไฟล์
              </Button>
            </Box>
            <Typography variant="body2" sx={{ color: '#e2e8f0', mb: 0.5 }}>ชื่อ: {orderData.name || '—'}</Typography>
            <Typography variant="body2" sx={{ color: '#e2e8f0', mb: 0.5 }}>โทร: {orderData.phone || '—'}</Typography>
            <Typography variant="body2" sx={{ color: '#e2e8f0' }}>IG: {orderData.instagram || '—'}</Typography>
            {!profileComplete && (
              <Typography variant="caption" sx={{ color: '#f97316', display: 'block', mt: 1 }}>
                กรุณาบันทึกโปรไฟล์ (ชื่อไทย, เบอร์, IG) ก่อนยืนยัน
              </Typography>
            )}
          </Paper>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1, borderTop: '1px solid #334155' }}>
          <Button
            onClick={() => setShowOrderDialog(false)}
            variant="outlined"
            sx={{ color: '#f1f5f9', borderColor: '#334155' }}
          >
            ยกเลิก
          </Button>
          <Button
            onClick={submitOrder}
            variant="contained"
            disabled={!profileComplete || processing}
            sx={{
              background: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
              fontWeight: 700,
              borderRadius: 2,
              px: 3,
              boxShadow: '0 12px 30px rgba(16, 185, 129, 0.35)',
              '&:hover': { background: 'linear-gradient(135deg, #0ea472 0%, #0591b5 100%)', boxShadow: '0 12px 34px rgba(16, 185, 129, 0.45)' },
            }}
          >
            ยืนยันการสั่งซื้อ
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={!!confirmCancelRef}
        onClose={() => setConfirmCancelRef(null)}
        fullScreen={isMobile}
        PaperProps={{
          sx: {
            width: { xs: '100%', sm: 420 },
            maxWidth: 'calc(100% - 24px)',
            bgcolor: '#0b1120',
            color: '#e2e8f0',
            borderRadius: 2,
            p: 1,
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
          <AlertTriangle size={20} color="#fbbf24" />
          ยืนยันยกเลิกคำสั่งซื้อ
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: '#cbd5e1', mb: 1 }}>
            ต้องการยกเลิกคำสั่งซื้อหมายเลข {confirmCancelRef ? `#${confirmCancelRef}` : ''} หรือไม่?
          </Typography>
          <Typography variant="caption" sx={{ color: '#94a3b8' }}>
            การยกเลิกจะไม่สามารถย้อนกลับได้ และสถานะจะเปลี่ยนเป็น ยกเลิก
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button
            variant="outlined"
            onClick={() => setConfirmCancelRef(null)}
            sx={{ color: '#cbd5e1', borderColor: '#334155' }}
          >
            ไม่ยกเลิก
          </Button>
          <Button
            variant="contained"
            disabled={!confirmCancelRef || processing}
            onClick={async () => {
              if (!confirmCancelRef) return;
              const ref = confirmCancelRef;
              setConfirmCancelRef(null);
              await cancelOrderByRef(ref);
            }}
            sx={{
              background: '#ef4444',
              '&:hover': { background: '#dc2626' },
              fontWeight: 800,
              px: 2.5,
            }}
          >
            ยืนยันยกเลิก
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={showHistoryDialog}
        onClose={() => setShowHistoryDialog(false)}
        maxWidth="md"
        fullWidth
        fullScreen={isMobile}
        PaperProps={{
          sx: {
            width: { xs: '100%', sm: '94%', md: '960px' },
            maxWidth: 'calc(100% - 24px)',
            bgcolor: '#0f172a',
            color: '#f1f5f9',
          },
        }}
      >
        <DialogTitle sx={{ background: 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)', color: 'white', display: 'flex', alignItems: 'center', gap: 1 }}>
          <Package size={24} />
          ประวัติคำสั่งซื้อ
        </DialogTitle>
        <DialogContent sx={{ pt: 3, maxHeight: '70vh' }}>
          {loadingHistory ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress sx={{ color: '#6366f1' }} />
            </Box>
          ) : (
            <>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                {historyFilters.map((filter) => {
                  const isActive = historyFilter === filter.key;
                  return (
                    <Button
                      key={filter.key}
                      size="small"
                      variant={isActive ? 'contained' : 'outlined'}
                      onClick={() => setHistoryFilter(filter.key as any)}
                      sx={{
                        borderColor: filter.color,
                        color: isActive ? '#0f172a' : filter.color,
                        backgroundColor: isActive ? filter.color : 'transparent',
                        textTransform: 'none',
                        fontWeight: 700,
                        borderRadius: 999,
                        px: 1.5,
                        '&:hover': { borderColor: filter.color, backgroundColor: isActive ? filter.color : `${filter.color}20` },
                      }}
                    >
                      {filter.label} ({filterCounts[filter.key] ?? 0})
                    </Button>
                  );
                })}
              </Box>

              {filteredOrders.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Package size={48} style={{ color: '#64748b', marginBottom: 16 }} />
                  <Typography sx={{ color: '#94a3b8' }}>ไม่พบคำสั่งซื้อในตัวกรองนี้</Typography>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                  {filteredOrders.map((order, idx) => {
                    const statusKey = normalizeStatus(order.status);
                    const statusLabel = getStatusLabel(statusKey);
                    const statusColor = getStatusColor(statusKey);
                    const canCancel = CANCELABLE_STATUSES.includes(statusKey);
                    const canPay = PAYABLE_STATUSES.includes(statusKey);

                    const category = getStatusCategory(statusKey);
                    const roadmapLabel =
                      category === 'WAITING_PAYMENT'
                        ? 'ขั้นตอน: รอชำระ / รอตรวจสลิป'
                        : category === 'COMPLETED'
                          ? 'ขั้นตอน: จ่ายแล้ว / รอตรวจสอบ'
                          : category === 'RECEIVED'
                            ? 'ขั้นตอน: พร้อมรับ / จัดส่ง / สำเร็จ'
                            : category === 'CANCELLED'
                              ? 'ขั้นตอน: ถูกยกเลิก'
                              : 'ขั้นตอน: อื่นๆ';

                    return (
                      <Paper key={idx} sx={{ p: 2.5, bgcolor: '#1f2937', borderRadius: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#f1f5f9' }}>
                            #{order.ref}
                          </Typography>
                          <Chip
                            label={statusLabel}
                            size="small"
                            sx={{ bgcolor: statusColor, color: 'white' }}
                          />
                        </Box>
                        <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mb: 1 }}>
                          {new Date(order.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#cbd5e1', display: 'block', mb: 1 }}>{roadmapLabel}</Typography>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1.5, gap: 1 }}>
                          <Typography variant="body1" sx={{ color: '#10b981', fontWeight: 'bold' }}>
                            {order.total?.toLocaleString()}฿
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            {canPay && (
                              <Button
                                size="small"
                                variant="contained"
                                onClick={() => openPaymentFlow(order.ref)}
                                sx={{
                                  background: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
                                  color: 'white',
                                  fontWeight: 700,
                                  px: 1.5,
                                  '&:hover': { background: 'linear-gradient(135deg, #0ea472 0%, #0591b5 100%)' },
                                }}
                              >
                                ชำระเงิน
                              </Button>
                            )}
                            {canCancel && (
                              <Button
                                size="small"
                                variant="contained"
                                onClick={() => handleCancelOrder(order.ref)}
                                disabled={cancellingRef === order.ref}
                                sx={{
                                  background: '#ef4444',
                                  color: 'white',
                                  fontWeight: 700,
                                  px: 1.5,
                                  '&:hover': { background: '#dc2626' },
                                }}
                              >
                                {cancellingRef === order.ref ? 'กำลังยกเลิก...' : 'ยกเลิกคำสั่งซื้อ'}
                              </Button>
                            )}
                          </Box>
                        </Box>
                      </Paper>
                    );
                  })}
                  {historyHasMore && (
                    <Button
                      variant="outlined"
                      onClick={() => loadOrderHistory({ append: true })}
                      disabled={loadingHistoryMore}
                      sx={{ alignSelf: 'center', mt: 1, borderColor: '#6366f1', color: '#e2e8f0' }}
                    >
                      {loadingHistoryMore ? 'กำลังโหลด...' : 'โหลดเพิ่มเติม'}
                    </Button>
                  )}
                </Box>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid #334155' }}>
          <Button onClick={() => setShowHistoryDialog(false)} sx={{ color: '#f1f5f9' }}>
            ปิด
          </Button>
        </DialogActions>
      </Dialog>

      <Box
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          bgcolor: 'rgba(12,18,32,0.58)',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          backdropFilter: 'none',
          WebkitBackdropFilter: 'none',
          boxShadow: '0 -10px 28px rgba(0,0,0,0.32)',
          display: { xs: 'flex', md: 'none' },
          justifyContent: 'space-around',
          py: 1.1,
          px: 1.5,
          touchAction: 'pan-y',
          WebkitOverflowScrolling: 'touch',
          paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
          zIndex: 1100,
          transform: hideNavBars ? 'translateY(120%)' : 'translateY(0)',
          opacity: hideNavBars ? 0 : 1,
          transition: 'transform 0.32s ease, opacity 0.28s ease',
        }}
      >
        {bottomTabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <IconButton
              key={tab.key}
              data-tab-key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 0.35,
                color: isActive ? '#e0e7ff' : '#cbd5e1',
                borderRadius: 2.2,
                px: 2,
                py: 0.75,
                background: isActive ? 'rgba(99,102,241,0.16)' : 'transparent',
                border: '1px solid rgba(255,255,255,0.08)',
                boxShadow: isActive ? '0 10px 22px rgba(0,0,0,0.18)' : 'none',
                transform: isActive ? 'translateY(-1px)' : 'translateY(0)',
                transition: 'color 0.2s ease, background 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease',
                '&:hover': {
                  background: isActive ? 'rgba(99,102,241,0.18)' : 'rgba(255,255,255,0.04)',
                  borderColor: 'rgba(255,255,255,0.12)',
                },
                touchAction: 'manipulation',
              }}
            >
              {tab.icon}
              <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 600 }}>{tab.label}</Typography>
            </IconButton>
          );
        })}
      </Box>

      {showRefreshDroplet && (
        <Box className="refresh-droplet">
          <span className="droplet" />
          <span className="droplet-ripple" />
        </Box>
      )}

      {toast && !productDialogOpen && (
        <Snackbar
          open={!!toast}
          autoHideDuration={3500}
          onClose={() => setToast(null)}
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
          TransitionComponent={ToastTransition}
          sx={{
            mt: { xs: 1, sm: 2 },
            mr: { xs: 1, sm: 2.5 },
            zIndex: (theme) => theme.zIndex.modal + 300,
            '& .MuiPaper-root': {
              background: 'linear-gradient(135deg, rgba(99,102,241,0.9), rgba(6,182,212,0.9))',
              color: '#fff',
              boxShadow: '0 18px 42px rgba(0,0,0,0.35)',
              borderRadius: 12,
              minWidth: 260,
            },
          }}
        >
          <Alert severity={toast.type} sx={{ color: 'white' }}>
            {toast.message}
          </Alert>
        </Snackbar>
      )}

      <Backdrop
        open={processing || savingProfile}
        sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 10, backdropFilter: 'blur(2px)', bgcolor: 'rgba(15, 23, 42, 0.55)' }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
          <CircularProgress color="inherit" size={36} />
          <Typography variant="body2" sx={{ color: '#e2e8f0' }}>
            {savingProfile ? 'กำลังบันทึกข้อมูล...' : 'กำลังประมวลผล...'}
          </Typography>
        </Box>
      </Backdrop>
    </Box>
  );
}
