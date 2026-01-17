'use client';

import React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
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
  CheckCircle2,
  AlertCircle,
  Info,
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
  Edit,
  Check,
  MapPin,
  Clock,
  CheckCircle,
  XCircle,
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

const SIZE_ORDER = ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL', '7XL'] as const;
const SIZE_MEASUREMENTS: Record<(typeof SIZE_ORDER)[number], { chest: number; length: number }> = {
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
  id: string;
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

type OrderHistoryItem = {
  productId?: string;
  name?: string;
  productName?: string;
  size?: string;
  qty?: number;
  quantity?: number;
  customName?: string;
  isLongSleeve?: boolean;
  unitPrice?: number;
  subtotal?: number;
  options?: {
    customName?: string;
    isLongSleeve?: boolean;
    customNumber?: string;
  };
};

type OrderHistory = {
  ref: string;
  status: string;
  date: string;
  total?: number;
  items?: OrderHistoryItem[];
  cart?: OrderHistoryItem[]; // For backwards compatibility
};

type Interval = ReturnType<typeof setInterval>;

type LeanProduct = Pick<Product, 'id' | 'name' | 'description' | 'type' | 'images' | 'basePrice' | 'sizePricing' | 'isActive' | 'startDate' | 'endDate'>;
type LeanConfig = {
  isOpen: boolean;
  announcement?: ShopConfig['announcement'];
  products: LeanProduct[];
};

const clampQty = (value: number) => Math.min(99, Math.max(1, value));
const normalizeStatus = (status: string) => (status || '').trim().toUpperCase();

// Check if product is currently open based on startDate/endDate
const isProductCurrentlyOpen = (product: { isActive?: boolean; startDate?: string; endDate?: string }): boolean => {
  if (!product.isActive) return false;
  const now = new Date();
  const start = product.startDate ? new Date(product.startDate) : null;
  const end = product.endDate ? new Date(product.endDate) : null;
  // Not yet started
  if (start && now < start) return false;
  // Already ended
  if (end && now > end) return false;
  return true;
};
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
  const [editingCartItem, setEditingCartItem] = useState<CartItem | null>(null);

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

  const [toasts, setToasts] = useState<Toast[]>([]);
  const [inlineNotice, setInlineNotice] = useState<Toast | null>(null);
  const toastTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const ToastTransition = (props: any) => <Slide {...props} direction="down" />;

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
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <Box
        sx={{
          width: size,
          height: size,
          position: 'relative',
          borderRadius: '12px',
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        <Image
          src="/logo.png"
          alt="PSU SCC Shop Logo"
          fill
          style={{ objectFit: 'contain' }}
          priority
        />
      </Box>
      {showText && (
        <Typography
          variant="h6"
          sx={{
            fontWeight: 800,
            letterSpacing: 0.5,
            color: '#f1f5f9',
            textTransform: 'uppercase',
            fontSize: { xs: '1rem', sm: '1.25rem' },
          }}
        >
          SCC Shop
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
    const id = `${type}-${message}`;
    
    // ป้องกันการซ้ำซ้อน - ถ้ามี toast เดียวกันอยู่แล้วให้ข้าม
    setToasts((prev) => {
      if (prev.some((t) => t.id === id)) return prev;
      return [...prev, { id, type, message }].slice(-3); // เก็บแค่ 3 อันล่าสุด
    });
    
    // ลบ toast อัตโนมัติหลัง 3 วินาที
    if (toastTimeoutsRef.current.has(id)) {
      clearTimeout(toastTimeoutsRef.current.get(id)!);
    }
    toastTimeoutsRef.current.set(id, setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      toastTimeoutsRef.current.delete(id);
    }, 3000));
    
    if (productDialogOpen) {
      setInlineNotice({ id, type, message });
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
      startDate: p.startDate,
      endDate: p.endDate,
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

  const updateCartItem = (id: string, updates: Partial<CartItem>) => {
    const newCart = cart.map((item) => (item.id === id ? { ...item, ...updates } : item));
    saveCart(newCart);
    setEditingCartItem(null);
    showToast('success', 'อัปเดตสินค้าในตะกร้าแล้ว');
  };

  const openEditCartItem = (item: CartItem) => {
    setEditingCartItem(item);
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

  // Calculate current price for product dialog
  const getCurrentPrice = useCallback(() => {
    if (!selectedProduct) return 0;
    const basePrice = selectedProduct.sizePricing?.[productOptions.size] ?? selectedProduct.basePrice;
    const longSleeveFee = selectedProduct.options?.hasLongSleeve && productOptions.isLongSleeve ? 50 : 0;
    return (basePrice + longSleeveFee) * productOptions.quantity;
  }, [selectedProduct, productOptions]);

  const renderProductDialog = () => {
    if (!selectedProduct) return null;

    const productContent = (
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#0a0f1a', color: '#f1f5f9' }}>
        {/* Header */}
        <Box sx={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: 'linear-gradient(180deg, rgba(15,23,42,0.98) 0%, rgba(10,15,26,0.98) 100%)',
          backdropFilter: 'blur(20px)',
        }}>
          {isMobile && (
            <Box sx={{ width: 36, height: 4, bgcolor: 'rgba(255,255,255,0.2)', borderRadius: 2, mx: 'auto', mt: 1.5, mb: 1 }} />
          )}
          <Box sx={{ px: { xs: 2, sm: 3 }, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' }, fontWeight: 800, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedProduct.name}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                <Box sx={{
                  px: 1.2,
                  py: 0.3,
                  borderRadius: '6px',
                  bgcolor: 'rgba(99,102,241,0.15)',
                  border: '1px solid rgba(99,102,241,0.3)',
                }}>
                  <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: '#a5b4fc' }}>
                    {TYPE_LABELS[selectedProduct.type] || selectedProduct.type}
                  </Typography>
                </Box>
              </Box>
            </Box>
            <IconButton 
              onClick={() => setProductDialogOpen(false)} 
              sx={{ 
                color: '#94a3b8', 
                bgcolor: 'rgba(255,255,255,0.05)', 
                '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } 
              }}
            >
              <X size={20} />
            </IconButton>
          </Box>
        </Box>

        {/* Inline Toast */}
        {inlineNotice && (
          <Alert
            severity={inlineNotice.type}
            icon={false}
            sx={{
              position: 'fixed',
              top: { xs: 16, sm: 24 },
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 99999,
              borderRadius: '12px',
              bgcolor: 'rgba(30,30,30,0.95)',
              backdropFilter: 'blur(20px)',
              border: 'none',
              color: '#fff',
              py: 1.5,
              px: 3,
              fontSize: '0.95rem',
              fontWeight: 500,
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
              minWidth: { xs: 200, sm: 280 },
              textAlign: 'center',
            }}
          >
            {inlineNotice.message}
          </Alert>
        )}

        {/* Content */}
        <Box sx={{ flex: 1, overflow: 'auto', WebkitOverflowScrolling: 'touch', px: { xs: 2, sm: 3 }, py: 2.5 }}>
          {/* Image Gallery */}
          <Box sx={{ mb: 3 }}>
            {productImages.length > 0 ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {/* Main Image */}
                <Box sx={{ 
                  position: 'relative', 
                  borderRadius: '20px', 
                  overflow: 'hidden',
                  bgcolor: 'rgba(30,41,59,0.5)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}>
                  <Box
                    component="img"
                    src={productImages[activeImageIndex] || productImages[0]}
                    alt={`${selectedProduct.name} - รูปที่ ${activeImageIndex + 1}`}
                    loading="lazy"
                    sx={{ 
                      width: '100%', 
                      height: { xs: 280, sm: 360, md: 420 }, 
                      objectFit: 'cover', 
                      display: 'block',
                    }}
                  />
                  {totalImages > 1 && (
                    <>
                      <IconButton
                        onClick={() => setActiveImageIndex((prev) => (prev - 1 + totalImages) % totalImages)}
                        sx={{ 
                          position: 'absolute', 
                          top: '50%', 
                          left: 12, 
                          transform: 'translateY(-50%)',
                          bgcolor: 'rgba(0,0,0,0.5)', 
                          color: 'white', 
                          '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' },
                          width: 40,
                          height: 40,
                        }}
                      >
                        <ChevronLeft size={24} />
                      </IconButton>
                      <IconButton
                        onClick={() => setActiveImageIndex((prev) => (prev + 1) % totalImages)}
                        sx={{ 
                          position: 'absolute', 
                          top: '50%', 
                          right: 12, 
                          transform: 'translateY(-50%)',
                          bgcolor: 'rgba(0,0,0,0.5)', 
                          color: 'white', 
                          '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' },
                          width: 40,
                          height: 40,
                        }}
                      >
                        <ChevronRight size={24} />
                      </IconButton>
                      {/* Image Counter */}
                      <Box sx={{
                        position: 'absolute',
                        bottom: 12,
                        right: 12,
                        px: 1.5,
                        py: 0.5,
                        borderRadius: '20px',
                        bgcolor: 'rgba(0,0,0,0.6)',
                        backdropFilter: 'blur(10px)',
                      }}>
                        <Typography sx={{ fontSize: '0.75rem', color: 'white', fontWeight: 600 }}>
                          {activeImageIndex + 1} / {totalImages}
                        </Typography>
                      </Box>
                    </>
                  )}
                </Box>

                {/* Thumbnail Gallery */}
                {totalImages > 1 && (
                  <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', pb: 0.5, '&::-webkit-scrollbar': { display: 'none' } }}>
                    {productImages.map((img, idx) => (
                      <Box
                        key={idx}
                        onClick={() => setActiveImageIndex(idx)}
                        sx={{
                          width: 64,
                          height: 64,
                          borderRadius: '12px',
                          border: activeImageIndex === idx ? '2px solid #6366f1' : '1px solid rgba(255,255,255,0.1)',
                          overflow: 'hidden',
                          cursor: 'pointer',
                          opacity: activeImageIndex === idx ? 1 : 0.6,
                          transition: 'all 0.2s',
                          flexShrink: 0,
                          '&:hover': { opacity: 1 },
                        }}
                      >
                        <Box 
                          component="img" 
                          src={img} 
                          alt={`${selectedProduct.name}-${idx}`} 
                          loading="lazy" 
                          sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} 
                        />
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>
            ) : (
              <Box sx={{ 
                height: 200, 
                borderRadius: '20px', 
                bgcolor: 'rgba(30,41,59,0.5)',
                border: '1px dashed rgba(255,255,255,0.15)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                color: '#64748b' 
              }}>
                ไม่มีรูปภาพสินค้า
              </Box>
            )}
          </Box>

          {/* Description */}
          {selectedProduct.description && (
            <Box sx={{
              p: 2,
              mb: 3,
              borderRadius: '14px',
              bgcolor: 'rgba(30,41,59,0.3)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}>
              <Typography sx={{ fontSize: '0.9rem', color: '#94a3b8', lineHeight: 1.6 }}>
                {selectedProduct.description}
              </Typography>
            </Box>
          )}

          {/* Size Chart & Selection - Combined Modern Design */}
          <Box sx={{
            p: { xs: 2, sm: 2.5 },
            mb: 2,
            borderRadius: '18px',
            bgcolor: 'rgba(30,41,59,0.5)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}>
            {/* Size Chart Table - Now at Top */}
            <Box sx={{ 
              mb: 2.5, 
              p: 1.5, 
              borderRadius: '14px', 
              bgcolor: 'rgba(15,23,42,0.6)',
              border: '1px solid rgba(99,102,241,0.2)',
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <Ruler size={16} color="#a5b4fc" />
                <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: '#a5b4fc' }}>
                  ตารางไซส์ (นิ้ว)
                </Typography>
              </Box>
              <Box sx={{ 
                display: 'grid', 
                gridTemplateColumns: 'auto 1fr',
                gap: 0,
                fontSize: '0.72rem',
                '& > div': { 
                  p: 0.8, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                },
              }}>
                {/* Header Row */}
                <Box sx={{ bgcolor: 'rgba(99,102,241,0.15)', fontWeight: 700, color: '#a5b4fc', borderRadius: '6px 0 0 0' }}>ขนาด</Box>
                <Box sx={{ display: 'grid !important', gridTemplateColumns: `repeat(${displaySizes.length}, 1fr)`, bgcolor: 'rgba(99,102,241,0.08)' }}>
                  {displaySizes.map((size, idx) => (
                    <Box key={size} sx={{ 
                      fontWeight: 700, 
                      color: productOptions.size === size ? '#818cf8' : '#94a3b8',
                      borderRight: idx < displaySizes.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                      bgcolor: productOptions.size === size ? 'rgba(99,102,241,0.2)' : 'transparent',
                    }}>
                      {size}
                    </Box>
                  ))}
                </Box>
                {/* Chest Row */}
                <Box sx={{ bgcolor: 'rgba(255,255,255,0.03)', color: '#94a3b8', fontWeight: 600 }}>รอบอก</Box>
                <Box sx={{ display: 'grid !important', gridTemplateColumns: `repeat(${displaySizes.length}, 1fr)` }}>
                  {displaySizes.map((size, idx) => {
                    const sizeKey = size as keyof typeof SIZE_MEASUREMENTS;
                    const measurement = SIZE_MEASUREMENTS[sizeKey];
                    return (
                      <Box key={size} sx={{ 
                        color: productOptions.size === size ? '#e2e8f0' : '#64748b',
                        borderRight: idx < displaySizes.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                        bgcolor: productOptions.size === size ? 'rgba(99,102,241,0.1)' : 'transparent',
                      }}>
                        {measurement?.chest || '-'}
                      </Box>
                    );
                  })}
                </Box>
                {/* Length Row */}
                <Box sx={{ bgcolor: 'rgba(255,255,255,0.03)', color: '#94a3b8', fontWeight: 600, borderRadius: '0 0 0 6px', borderBottom: 'none !important' }}>ความยาว</Box>
                <Box sx={{ display: 'grid !important', gridTemplateColumns: `repeat(${displaySizes.length}, 1fr)`, borderBottom: 'none !important' }}>
                  {displaySizes.map((size, idx) => {
                    const sizeKey = size as keyof typeof SIZE_MEASUREMENTS;
                    const measurement = SIZE_MEASUREMENTS[sizeKey];
                    return (
                      <Box key={size} sx={{ 
                        color: productOptions.size === size ? '#e2e8f0' : '#64748b',
                        borderRight: idx < displaySizes.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                        bgcolor: productOptions.size === size ? 'rgba(99,102,241,0.1)' : 'transparent',
                        borderBottom: 'none !important',
                      }}>
                        {measurement?.length || '-'}
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            </Box>

            {/* Size Selection Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
              <Box sx={{
                width: 36,
                height: 36,
                borderRadius: '10px',
                bgcolor: 'rgba(99,102,241,0.15)',
                display: 'grid',
                placeItems: 'center',
              }}>
                <Tag size={18} color="#a5b4fc" />
              </Box>
              <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: '#e2e8f0' }}>
                เลือกขนาด
              </Typography>
            </Box>

            {/* Size Selection Cards */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {displaySizes.map((size) => {
                const basePrice = selectedProduct?.sizePricing?.[size] ?? selectedProduct?.basePrice ?? 0;
                const longSleeveFee = selectedProduct.options?.hasLongSleeve && productOptions.isLongSleeve ? 50 : 0;
                const price = basePrice + longSleeveFee;
                const active = productOptions.size === size;
                const sizeKey = size as keyof typeof SIZE_MEASUREMENTS;
                const measurement = SIZE_MEASUREMENTS[sizeKey];
                return (
                  <Box
                    key={size}
                    onClick={() => setProductOptions({ ...productOptions, size })}
                    sx={{
                      px: 2,
                      py: 1.2,
                      borderRadius: '12px',
                      border: active ? '2px solid #6366f1' : '1px solid rgba(255,255,255,0.1)',
                      bgcolor: active ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.03)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      minWidth: 75,
                      position: 'relative',
                      '&:hover': { 
                        borderColor: active ? '#6366f1' : 'rgba(99,102,241,0.5)',
                        bgcolor: active ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.08)',
                      },
                    }}
                  >
                    <Typography sx={{ fontSize: '1rem', fontWeight: 800, color: active ? '#a5b4fc' : '#e2e8f0' }}>
                      {size}
                    </Typography>
                    <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: active ? '#818cf8' : '#64748b', mb: 0.3 }}>
                      ฿{price.toLocaleString()}
                    </Typography>
                    {measurement && (
                      <Typography sx={{ fontSize: '0.6rem', color: active ? '#6ee7b7' : '#475569' }}>
                        {measurement.chest}" × {measurement.length}"
                      </Typography>
                    )}
                  </Box>
                );
              })}
            </Box>
          </Box>

          {/* Additional Options */}
          {(selectedProduct.options?.hasCustomName || selectedProduct.options?.hasCustomNumber || selectedProduct.options?.hasLongSleeve) && (
            <Box sx={{
              p: { xs: 2, sm: 2.5 },
              mb: 2,
              borderRadius: '18px',
              bgcolor: 'rgba(30,41,59,0.5)',
              border: '1px solid rgba(255,255,255,0.08)',
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
                  <Tag size={18} color="#6ee7b7" />
                </Box>
                <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: '#e2e8f0' }}>
                  ตัวเลือกเพิ่มเติม
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {selectedProduct.options?.hasCustomName && (
                  <TextField
                    label="ชื่อติดเสื้อ (ภาษาอังกฤษ สูงสุด 7 ตัว)"
                    fullWidth
                    value={productOptions.customName}
                    onChange={(e) => setProductOptions({ ...productOptions, customName: normalizeEngName(e.target.value) })}
                    inputProps={{ maxLength: 7 }}
                    placeholder="เช่น JOHN"
                    sx={{ 
                      '& .MuiOutlinedInput-root': { 
                        color: '#f1f5f9',
                        borderRadius: '12px',
                        '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' },
                        '&:hover fieldset': { borderColor: 'rgba(99,102,241,0.5)' },
                        '&.Mui-focused fieldset': { borderColor: '#6366f1' },
                      }, 
                      '& label': { color: '#64748b' },
                      '& label.Mui-focused': { color: '#a5b4fc' },
                    }}
                  />
                )}

                {selectedProduct.options?.hasCustomNumber && (
                  <TextField
                    label="หมายเลขเสื้อ (0-99) *จำเป็น"
                    fullWidth
                    value={productOptions.customNumber}
                    onChange={(e) => setProductOptions({ ...productOptions, customNumber: normalizeDigits99(e.target.value) })}
                    inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }}
                    placeholder="เช่น 10"
                    sx={{ 
                      '& .MuiOutlinedInput-root': { 
                        color: '#f1f5f9',
                        borderRadius: '12px',
                        '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' },
                        '&:hover fieldset': { borderColor: 'rgba(99,102,241,0.5)' },
                        '&.Mui-focused fieldset': { borderColor: '#6366f1' },
                      }, 
                      '& label': { color: '#64748b' },
                      '& label.Mui-focused': { color: '#a5b4fc' },
                    }}
                  />
                )}

                {selectedProduct.options?.hasLongSleeve && (
                  <Box 
                    onClick={() => setProductOptions({ ...productOptions, isLongSleeve: !productOptions.isLongSleeve })}
                    sx={{
                      p: 2,
                      borderRadius: '12px',
                      border: productOptions.isLongSleeve ? '2px solid #f59e0b' : '1px solid rgba(255,255,255,0.1)',
                      bgcolor: productOptions.isLongSleeve ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.02)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.2s ease',
                      '&:hover': { borderColor: productOptions.isLongSleeve ? '#f59e0b' : 'rgba(245,158,11,0.5)' },
                    }}
                  >
                    <Box>
                      <Typography sx={{ fontSize: '0.95rem', fontWeight: 600, color: '#e2e8f0' }}>
                        แขนยาว
                      </Typography>
                      <Typography sx={{ fontSize: '0.8rem', color: '#64748b' }}>
                        เพิ่ม ฿50 ต่อตัว
                      </Typography>
                    </Box>
                    <Switch
                      checked={productOptions.isLongSleeve}
                      color="warning"
                      sx={{ pointerEvents: 'none' }}
                    />
                  </Box>
                )}
              </Box>
            </Box>
          )}

          {/* Quantity */}
          <Box sx={{
            p: { xs: 2, sm: 2.5 },
            mb: 2,
            borderRadius: '18px',
            bgcolor: 'rgba(30,41,59,0.5)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: '#e2e8f0' }}>
                จำนวน
              </Typography>
              <Box sx={{
                display: 'flex',
                alignItems: 'center',
                bgcolor: 'rgba(255,255,255,0.05)',
                borderRadius: '14px',
                border: '1px solid rgba(255,255,255,0.1)',
              }}>
                <IconButton
                  onClick={() => setProductOptions({ ...productOptions, quantity: clampQty(productOptions.quantity - 1) })}
                  sx={{ color: '#94a3b8', p: 1.5, '&:hover': { color: '#f1f5f9' } }}
                >
                  <Minus size={20} />
                </IconButton>
                <Typography sx={{ 
                  color: '#f1f5f9', 
                  minWidth: 48, 
                  textAlign: 'center',
                  fontWeight: 800,
                  fontSize: '1.1rem',
                }}>
                  {productOptions.quantity}
                </Typography>
                <IconButton
                  onClick={() => setProductOptions({ ...productOptions, quantity: clampQty(productOptions.quantity + 1) })}
                  sx={{ color: '#94a3b8', p: 1.5, '&:hover': { color: '#f1f5f9' } }}
                >
                  <Plus size={20} />
                </IconButton>
              </Box>
            </Box>
          </Box>
        </Box>

        {/* Bottom Actions */}
        <Box sx={{
          px: { xs: 2, sm: 3 },
          py: 2,
          borderTop: '1px solid rgba(255,255,255,0.08)',
          background: 'linear-gradient(180deg, rgba(15,23,42,0.98) 0%, rgba(10,15,26,0.98) 100%)',
          backdropFilter: 'blur(20px)',
          paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
        }}>
          {/* Price Summary */}
          <Box sx={{
            p: 2,
            mb: 2,
            borderRadius: '14px',
            bgcolor: 'rgba(16,185,129,0.08)',
            border: '1px solid rgba(16,185,129,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <Box>
              <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>ราคารวม</Typography>
              <Typography sx={{ fontSize: '1.5rem', fontWeight: 900, color: '#10b981' }}>
                ฿{getCurrentPrice().toLocaleString()}
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'right' }}>
              <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>
                {productOptions.size} × {productOptions.quantity}
              </Typography>
              {productOptions.isLongSleeve && (
                <Typography sx={{ fontSize: '0.7rem', color: '#fbbf24' }}>+ แขนยาว</Typography>
              )}
            </Box>
          </Box>

          {/* Action Buttons */}
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <Button
              onClick={handleAddToCart}
              disabled={!isShopOpen}
              startIcon={<ShoppingCart size={18} />}
              sx={{
                flex: 1,
                py: 1.5,
                borderRadius: '14px',
                bgcolor: 'rgba(99,102,241,0.15)',
                border: '1px solid rgba(99,102,241,0.3)',
                color: isShopOpen ? '#a5b4fc' : '#64748b',
                fontSize: '0.9rem',
                fontWeight: 700,
                textTransform: 'none',
                '&:hover': { bgcolor: 'rgba(99,102,241,0.25)' },
                '&:disabled': { color: '#64748b', borderColor: 'rgba(100,116,139,0.3)' },
              }}
            >
              เพิ่มลงตะกร้า
            </Button>
            <Button
              onClick={handleBuyNow}
              disabled={!isShopOpen}
              startIcon={<Zap size={18} />}
              sx={{
                flex: 1.2,
                py: 1.5,
                borderRadius: '14px',
                background: isShopOpen 
                  ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                  : 'rgba(100,116,139,0.2)',
                color: isShopOpen ? 'white' : '#64748b',
                fontSize: '0.9rem',
                fontWeight: 700,
                textTransform: 'none',
                boxShadow: isShopOpen ? '0 4px 20px rgba(16,185,129,0.3)' : 'none',
                '&:hover': {
                  background: isShopOpen 
                    ? 'linear-gradient(135deg, #059669 0%, #047857 100%)'
                    : 'rgba(100,116,139,0.3)',
                },
                '&:disabled': { background: 'rgba(100,116,139,0.2)', color: '#64748b' },
              }}
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
              height: '92vh',
              maxHeight: '92vh',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              bgcolor: '#0a0f1a',
              overflow: 'hidden',
            },
          }}
          sx={{ zIndex: 8000 }}
        >
          {productContent}
        </Drawer>
      );
    }

    return (
      <Drawer
        anchor="right"
        open={productDialogOpen}
        onClose={() => setProductDialogOpen(false)}
        PaperProps={{
          sx: {
            width: '100%',
            maxWidth: 520,
            bgcolor: '#0a0f1a',
            overflow: 'hidden',
          },
        }}
        sx={{ zIndex: 8000 }}
      >
        {productContent}
      </Drawer>
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
        // Update local state immediately for instant UI feedback
        setOrderHistory((prev) =>
          prev.map((order) =>
            order.ref === ref ? { ...order, status: 'CANCELLED' } : order
          )
        );
        // Also refresh from server in background to ensure data consistency
        setTimeout(() => {
          loadOrderHistory();
        }, 500);
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
        
        // Add new order to history immediately with full item details
        if (res.ref) {
          const newOrder: OrderHistory = {
            ref: res.ref,
            status: 'PENDING',
            date: new Date().toISOString(),
            total: getTotalPrice(),
            items: cart.map((item) => ({
              productId: item.productId,
              name: item.productName,
              size: item.size,
              qty: item.quantity,
              customName: item.options.customName,
              isLongSleeve: item.options.isLongSleeve,
              unitPrice: item.unitPrice,
              subtotal: item.unitPrice * item.quantity,
            })),
          };
          setOrderHistory((prev) => [newOrder, ...prev]);
        }
        
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
        const rawHistory = res.data?.history || (res as any)?.history || [];
        const hasMore = Boolean(res.data?.hasMore);
        const nextCursor = res.data?.nextCursor || null;
        if (Array.isArray(rawHistory)) {
          // Normalize order data - calculate total from cart/items if not present
          const history = rawHistory.map((order: any) => {
            let total = order.total || order.totalAmount || order.amount || 0;
            
            // If total is 0 or missing, calculate from cart/items
            if (!total || total === 0) {
              const items = order.items || order.cart || [];
              if (Array.isArray(items) && items.length > 0) {
                total = items.reduce((sum: number, item: any) => {
                  const price = item.unitPrice || item.subtotal || item.price || 0;
                  const qty = item.qty || item.quantity || 1;
                  return sum + (item.subtotal || (price * qty));
                }, 0);
              }
            }
            
            return {
              ...order,
              total,
              items: order.items || order.cart || [],
            };
          });
          
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
      // Only load if history is empty (first time or needs refresh)
      if (orderHistory.length === 0) {
        setHistoryCursor(null);
        setHistoryHasMore(false);
        loadOrderHistory();
      }
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
    const items = (config?.products || []).filter((p) => isProductCurrentlyOpen(p));
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
            <Card 
              sx={{ 
                bgcolor: 'rgba(30, 41, 59, 0.8)', 
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(99, 102, 241, 0.2)', 
                borderRadius: '24px',
                p: { xs: 3, sm: 5 }, 
                textAlign: 'center',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(99, 102, 241, 0.1)',
              }}
            >
              {/* Web Logo */}
              <Box
                sx={{
                  width: 100,
                  height: 100,
                  position: 'relative',
                  borderRadius: '24px',
                  overflow: 'hidden',
                  margin: '0 auto 24px',
                  boxShadow: '0 10px 30px rgba(99, 102, 241, 0.3)',
                  border: '2px solid rgba(99, 102, 241, 0.3)',
                }}
              >
                <Image
                  src="/logo.png"
                  alt="PSU SCC Shop Logo"
                  fill
                  style={{ objectFit: 'contain' }}
                  priority
                />
              </Box>
              
              <Typography 
                variant="h4" 
                sx={{ 
                  fontWeight: 800, 
                  mb: 1, 
                  color: '#f1f5f9',
                  background: 'linear-gradient(135deg, #f1f5f9 0%, #c084fc 50%, #6366f1 100%)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                SCC Shop
              </Typography>
              <Typography sx={{ color: '#94a3b8', mb: 4, fontSize: '1rem' }}>
                ร้านค้าชุมนุมคอมพิวเตอร์ ม.อ.
              </Typography>
              
              <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', mb: 4 }} />
              
              <Typography sx={{ color: '#64748b', mb: 3, fontSize: '0.9rem' }}>
                เข้าสู่ระบบเพื่อเริ่มช้อปปิ้ง
              </Typography>
              
              <Button
                variant="contained"
                size="large"
                onClick={() => signIn('google', { redirect: true, callbackUrl: '/', prompt: 'select_account' })}
                sx={{
                  background: '#ffffff',
                  color: '#1f2937',
                  width: '100%',
                  py: 1.5,
                  borderRadius: '14px',
                  fontWeight: 600,
                  fontSize: '1rem',
                  textTransform: 'none',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 1.5,
                  '&:hover': {
                    background: '#f8fafc',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 8px 25px rgba(0,0,0,0.2)',
                  },
                  '&:active': {
                    transform: 'translateY(0)',
                  },
                }}
              >
                {/* Google Logo SVG */}
                <svg width="20" height="20" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                เข้าสู่ระบบด้วย Google
              </Button>
              
              <Typography sx={{ color: '#475569', mt: 4, fontSize: '0.75rem' }}>
                โดยการเข้าสู่ระบบ คุณยอมรับ<br/>ข้อกำหนดและเงื่อนไขการใช้งาน
              </Typography>
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
          <Box sx={{ px: { xs: 2, md: 3 }, pb: 2, pt: 1 }}>
            <Box sx={{
              p: 2,
              borderRadius: '16px',
              bgcolor: 'rgba(15,23,42,0.95)',
              border: '1px solid rgba(99,102,241,0.2)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            }}>
              <TextField
                autoFocus
                size="small"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="ค้นหาชื่อสินค้า, ประเภท..."
                inputProps={{ maxLength: 50 }}
                fullWidth
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#e2e8f0',
                    background: 'rgba(30,41,59,0.5)',
                    borderRadius: '12px',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                    '&:hover fieldset': { borderColor: 'rgba(99,102,241,0.5)' },
                    '&.Mui-focused fieldset': { borderColor: '#6366f1' },
                  },
                  '& .MuiInputBase-input::placeholder': { color: '#64748b', opacity: 1 },
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search size={18} color="#6366f1" />
                    </InputAdornment>
                  ),
                  endAdornment: productSearch && (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setProductSearch('')} sx={{ color: '#64748b' }}>
                        <X size={16} />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              
              {/* Quick Filters */}
              {productSearch && (
                <Box sx={{ mt: 1.5, display: 'flex', flexWrap: 'wrap', gap: 0.8 }}>
                  {Object.entries(TYPE_LABELS).slice(0, 4).map(([key, label]) => (
                    <Chip
                      key={key}
                      label={label}
                      size="small"
                      onClick={() => setProductSearch(label)}
                      sx={{
                        bgcolor: productSearch.includes(label) ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)',
                        color: productSearch.includes(label) ? '#a5b4fc' : '#94a3b8',
                        border: '1px solid',
                        borderColor: productSearch.includes(label) ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.1)',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'rgba(99,102,241,0.15)' },
                      }}
                    />
                  ))}
                </Box>
              )}

              {/* Search Results Count */}
              {productSearch && (
                <Typography sx={{ mt: 1.5, fontSize: '0.75rem', color: '#64748b' }}>
                  พบ {Object.values(filteredGroupedProducts).flat().length} รายการ
                </Typography>
              )}
            </Box>
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
              <Box sx={{ mb: 3 }}>
                {/* Modern Filter Bar */}
                <Box sx={{
                  p: 2,
                  mb: 2,
                  borderRadius: '18px',
                  bgcolor: 'rgba(15,23,42,0.8)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  backdropFilter: 'blur(10px)',
                }}>
                  {/* Search and Stats Row */}
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Box sx={{
                        width: 36,
                        height: 36,
                        borderRadius: '10px',
                        bgcolor: 'rgba(99,102,241,0.15)',
                        display: 'grid',
                        placeItems: 'center',
                      }}>
                        <Store size={18} color="#a5b4fc" />
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#e2e8f0' }}>
                          สินค้าทั้งหมด
                        </Typography>
                        <Typography sx={{ fontSize: '0.7rem', color: '#64748b' }}>
                          พบ {filteredProductCount} จาก {activeProductCount} รายการ
                        </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <IconButton 
                        onClick={() => setShowSearchBar(!showSearchBar)}
                        sx={{ 
                          color: showSearchBar ? '#6366f1' : '#94a3b8',
                          bgcolor: showSearchBar ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.05)',
                        }}
                      >
                        <Search size={18} />
                      </IconButton>
                    </Box>
                  </Box>

                  {/* Category Chips */}
                  <Box sx={{
                    display: 'flex',
                    gap: 0.8,
                    flexWrap: 'nowrap',
                    overflowX: 'auto',
                    pb: 0.5,
                    mx: -1,
                    px: 1,
                    '&::-webkit-scrollbar': { display: 'none' },
                  }}>
                    {categoryMeta.map((cat) => {
                      const active = categoryFilter === cat.key;
                      return (
                        <Box
                          key={cat.key}
                          onClick={() => setCategoryFilter(cat.key)}
                          sx={{
                            px: 1.8,
                            py: 0.8,
                            borderRadius: '12px',
                            bgcolor: active ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
                            border: active ? '1px solid rgba(99,102,241,0.5)' : '1px solid rgba(255,255,255,0.06)',
                            color: active ? '#a5b4fc' : '#94a3b8',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.8,
                            '&:hover': {
                              bgcolor: active ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.08)',
                              borderColor: active ? 'rgba(99,102,241,0.6)' : 'rgba(255,255,255,0.12)',
                            },
                          }}
                        >
                          {cat.label}
                          <Box sx={{
                            px: 0.7,
                            py: 0.1,
                            borderRadius: '6px',
                            bgcolor: active ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.08)',
                            fontSize: '0.65rem',
                            fontWeight: 700,
                          }}>
                            {cat.count}
                          </Box>
                        </Box>
                      );
                    })}
                  </Box>

                  {/* Price Range Filter */}
                  {priceBounds.max > 0 && priceBounds.max !== priceBounds.min && (
                    <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                        <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8' }}>
                          กรองตามราคา
                        </Typography>
                        <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#10b981' }}>
                          ฿{priceRange[0].toLocaleString()} - ฿{priceRange[1].toLocaleString()}
                        </Typography>
                      </Box>
                      <Slider
                        value={priceRange}
                        min={priceBounds.min}
                        max={priceBounds.max}
                        step={10}
                        onChange={(_, value) => setPriceRange(value as [number, number])}
                        valueLabelDisplay="off"
                        sx={{
                          color: '#6366f1',
                          height: 6,
                          '& .MuiSlider-track': { border: 'none', bgcolor: '#6366f1' },
                          '& .MuiSlider-rail': { bgcolor: 'rgba(255,255,255,0.1)' },
                          '& .MuiSlider-thumb': {
                            width: 18,
                            height: 18,
                            backgroundColor: '#fff',
                            border: '2px solid #6366f1',
                            '&:hover': { boxShadow: '0 0 0 8px rgba(99,102,241,0.16)' },
                          },
                        }}
                      />
                    </Box>
                  )}
                </Box>
              </Box>
            )}

            {config?.products && Object.keys(filteredGroupedProducts).length > 0 ? (
              Object.entries(filteredGroupedProducts).map(([type, items]) => (
                <Box key={type} sx={{ mb: 4 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
                    <Box sx={{
                      px: 1.5,
                      py: 0.6,
                      borderRadius: '10px',
                      background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                    }}>
                      <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: 'white' }}>
                        {TYPE_LABELS[type] || type || 'อื่นๆ'}
                      </Typography>
                    </Box>
                    <Typography sx={{ fontSize: '0.85rem', color: '#64748b' }}>
                      {items.length} รายการ
                    </Typography>
                  </Box>
                  <Grid container spacing={2}>
                    {items.map((product) => (
                      <Grid size={{ xs: 6, sm: 6, md: 4, lg: 3 }} key={product.id}>
                        <Box
                          onClick={() => {
                            if (!isShopOpen) {
                              showToast('warning', 'ร้านค้าปิดชั่วคราว ไม่สามารถสั่งซื้อได้');
                              return;
                            }
                            setSelectedProduct(product);
                            setProductDialogOpen(true);
                          }}
                          sx={{
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            cursor: 'pointer',
                            borderRadius: '20px',
                            overflow: 'hidden',
                            bgcolor: 'rgba(15,23,42,0.8)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            transition: 'all 0.25s ease',
                            '&:hover': {
                              transform: 'translateY(-4px)',
                              boxShadow: '0 20px 40px rgba(99,102,241,0.2)',
                              borderColor: 'rgba(99,102,241,0.4)',
                            },
                          }}
                        >
                          {/* Product Image */}
                          <Box sx={{
                            position: 'relative',
                            aspectRatio: '1 / 1',
                            bgcolor: '#0b1224',
                            backgroundImage: product.images?.[0] ? `url(${product.images[0]})` : undefined,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                          }}>
                            {!product.images?.[0] && (
                              <Box sx={{ 
                                position: 'absolute', 
                                inset: 0, 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                color: '#475569',
                                fontSize: '0.8rem',
                              }}>
                                ไม่มีรูป
                              </Box>
                            )}
                            {/* Overlay badges */}
                            <Box sx={{ 
                              position: 'absolute', 
                              top: 8, 
                              left: 8, 
                              display: 'flex', 
                              flexDirection: 'column', 
                              gap: 0.5 
                            }}>
                              {product.options?.hasLongSleeve && (
                                <Box sx={{
                                  px: 0.8,
                                  py: 0.3,
                                  borderRadius: '6px',
                                  bgcolor: 'rgba(245,158,11,0.9)',
                                  fontSize: '0.6rem',
                                  fontWeight: 700,
                                  color: 'white',
                                }}>
                                  แขนยาว
                                </Box>
                              )}
                              {product.options?.hasCustomName && (
                                <Box sx={{
                                  px: 0.8,
                                  py: 0.3,
                                  borderRadius: '6px',
                                  bgcolor: 'rgba(16,185,129,0.9)',
                                  fontSize: '0.6rem',
                                  fontWeight: 700,
                                  color: 'white',
                                }}>
                                  สกรีนชื่อ
                                </Box>
                              )}
                            </Box>
                            {/* Price badge */}
                            <Box sx={{
                              position: 'absolute',
                              bottom: 8,
                              right: 8,
                              px: 1.2,
                              py: 0.5,
                              borderRadius: '10px',
                              bgcolor: 'rgba(0,0,0,0.7)',
                              backdropFilter: 'blur(8px)',
                            }}>
                              <Typography sx={{ fontSize: '0.9rem', fontWeight: 800, color: '#10b981' }}>
                                ฿{product.basePrice.toLocaleString()}
                              </Typography>
                            </Box>
                          </Box>

                          {/* Product Info */}
                          <Box sx={{ p: 1.5, flex: 1, display: 'flex', flexDirection: 'column' }}>
                            <Typography sx={{ 
                              fontSize: { xs: '0.85rem', sm: '0.9rem' }, 
                              fontWeight: 700, 
                              color: '#f1f5f9',
                              mb: 0.5,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              lineHeight: 1.3,
                            }}>
                              {product.name}
                            </Typography>
                            <Typography sx={{ 
                              fontSize: '0.7rem', 
                              color: '#64748b',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              mb: 1,
                            }}>
                              {product.description || TYPE_LABELS[product.type] || product.type}
                            </Typography>
                            
                            {/* Quick Add Button */}
                            <Box sx={{ mt: 'auto' }}>
                              <Button
                                fullWidth
                                disabled={!isShopOpen}
                                sx={{
                                  py: 0.8,
                                  borderRadius: '10px',
                                  background: isShopOpen 
                                    ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' 
                                    : 'rgba(100,116,139,0.2)',
                                  color: isShopOpen ? 'white' : '#64748b',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  textTransform: 'none',
                                  '&:hover': {
                                    background: isShopOpen 
                                      ? 'linear-gradient(135deg, #5558e8 0%, #7c3aed 100%)' 
                                      : 'rgba(100,116,139,0.2)',
                                  },
                                }}
                              >
                                {isShopOpen ? 'ดูรายละเอียด' : 'ปิดบริการ'}
                              </Button>
                            </Box>
                          </Box>
                        </Box>
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
        onPaymentSuccess={(ref) => {
          // Update local state to reflect successful payment verification
          setOrderHistory((prev) => {
            const orderExists = prev.some((order) => order.ref === ref);
            if (orderExists) {
              return prev.map((order) =>
                order.ref === ref ? { ...order, status: 'PAID' } : order
              );
            }
            // If order doesn't exist in history yet, add it
            return [{ ref, status: 'PAID', date: new Date().toISOString(), total: 0 }, ...prev];
          });
          setActiveTab('history');
          showToast('success', 'ชำระเงินสำเร็จ!');
        }}
      />

      {showProfileModal && (
        <ProfileModal
          initialData={{ name: orderData.name, phone: orderData.phone, address: orderData.address, instagram: orderData.instagram }}
          onClose={() => { setShowProfileModal(false); setActiveTab('home'); }}
          onSave={handleSaveProfile}
        />
      )}

      {/* ===== Cart Drawer - Modern Design ===== */}
      <Drawer
        anchor="bottom"
        open={showCart}
        onClose={() => setShowCart(false)}
        PaperProps={{
          sx: {
            height: { xs: '90vh', sm: '80vh' },
            maxHeight: '90vh',
            borderTopLeftRadius: { xs: 20, sm: 24 },
            borderTopRightRadius: { xs: 20, sm: 24 },
            bgcolor: '#0a0f1a',
            overflow: 'hidden',
          },
        }}
      >
        {/* Header */}
        <Box sx={{
          px: { xs: 2, sm: 3 },
          py: { xs: 1.5, sm: 2 },
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: 'linear-gradient(180deg, rgba(15,23,42,0.98) 0%, rgba(10,15,26,0.98) 100%)',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}>
          {/* Drag Handle */}
          <Box sx={{ width: 36, height: 4, bgcolor: 'rgba(255,255,255,0.2)', borderRadius: 2, mx: 'auto', mb: 2 }} />
          
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{
                width: 44,
                height: 44,
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                display: 'grid',
                placeItems: 'center',
                boxShadow: '0 4px 14px rgba(99,102,241,0.3)',
              }}>
                <ShoppingCart size={22} color="white" />
              </Box>
              <Box>
                <Typography sx={{ fontSize: '1.15rem', fontWeight: 800, color: '#f1f5f9' }}>
                  ตะกร้าสินค้า
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>
                  {cart.length} รายการ · {cart.reduce((sum, item) => sum + item.quantity, 0)} ชิ้น
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {cart.length > 0 && (
                <Button
                  size="small"
                  onClick={() => {
                    if (confirm('ล้างตะกร้าทั้งหมด?')) {
                      saveCart([]);
                      showToast('success', 'ล้างตะกร้าแล้ว');
                    }
                  }}
                  sx={{ 
                    color: '#ef4444', 
                    fontSize: '0.75rem',
                    textTransform: 'none',
                    '&:hover': { bgcolor: 'rgba(239,68,68,0.1)' },
                  }}
                >
                  ล้างทั้งหมด
                </Button>
              )}
              <IconButton onClick={() => setShowCart(false)} sx={{ color: '#94a3b8', bgcolor: 'rgba(255,255,255,0.05)', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}>
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
                <ShoppingCart size={36} style={{ color: '#475569' }} />
              </Box>
              <Typography sx={{ color: '#64748b', fontSize: '1rem', fontWeight: 600 }}>ตะกร้าว่างเปล่า</Typography>
              <Typography sx={{ color: '#475569', fontSize: '0.85rem' }}>เลือกสินค้าที่ต้องการแล้วเพิ่มลงตะกร้า</Typography>
              <Button
                onClick={() => { setShowCart(false); setActiveTab('home'); }}
                sx={{
                  mt: 1,
                  px: 3,
                  py: 1,
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                  color: 'white',
                  fontWeight: 600,
                  textTransform: 'none',
                }}
              >
                เลือกซื้อสินค้า
              </Button>
            </Box>
          ) : (
            <Box sx={{ px: { xs: 2, sm: 3 }, py: 2 }}>
              {cart.map((item, idx) => {
                const product = config?.products?.find(p => p.id === item.productId);
                return (
                  <Box
                    key={item.id}
                    sx={{
                      p: 2,
                      mb: 1.5,
                      borderRadius: '16px',
                      bgcolor: 'rgba(30,41,59,0.5)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      transition: 'all 0.2s ease',
                      '&:hover': { bgcolor: 'rgba(30,41,59,0.7)' },
                    }}
                  >
                    <Box sx={{ display: 'flex', gap: 2 }}>
                      {/* Product Image Thumbnail */}
                      {product?.images?.[0] && (
                        <Box sx={{
                          width: 60,
                          height: 60,
                          borderRadius: '12px',
                          overflow: 'hidden',
                          flexShrink: 0,
                          border: '1px solid rgba(255,255,255,0.1)',
                        }}>
                          <Box
                            component="img"
                            src={product.images[0]}
                            alt={item.productName}
                            sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        </Box>
                      )}
                      
                      {/* Product Info */}
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: '#e2e8f0', mb: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.productName}
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6, mb: 1.5 }}>
                          <Box sx={{
                            px: 1,
                            py: 0.2,
                            borderRadius: '6px',
                            bgcolor: 'rgba(99,102,241,0.15)',
                            border: '1px solid rgba(99,102,241,0.3)',
                          }}>
                            <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: '#a5b4fc' }}>
                              {item.size}
                            </Typography>
                          </Box>
                          {item.options.isLongSleeve && (
                            <Box sx={{
                              px: 1,
                              py: 0.2,
                              borderRadius: '6px',
                              bgcolor: 'rgba(245,158,11,0.15)',
                              border: '1px solid rgba(245,158,11,0.3)',
                            }}>
                              <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: '#fbbf24' }}>
                                แขนยาว
                              </Typography>
                            </Box>
                          )}
                          {item.options.customName && (
                            <Box sx={{
                              px: 1,
                              py: 0.2,
                              borderRadius: '6px',
                              bgcolor: 'rgba(16,185,129,0.15)',
                              border: '1px solid rgba(16,185,129,0.3)',
                            }}>
                              <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: '#6ee7b7' }}>
                                {item.options.customName}
                              </Typography>
                            </Box>
                          )}
                          {item.options.customNumber && (
                            <Box sx={{
                              px: 1,
                              py: 0.2,
                              borderRadius: '6px',
                              bgcolor: 'rgba(6,182,212,0.15)',
                              border: '1px solid rgba(6,182,212,0.3)',
                            }}>
                              <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: '#67e8f9' }}>
                                #{item.options.customNumber}
                              </Typography>
                            </Box>
                          )}
                        </Box>

                        {/* Quantity & Actions Row */}
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{
                              display: 'flex',
                              alignItems: 'center',
                              bgcolor: 'rgba(255,255,255,0.05)',
                              borderRadius: '10px',
                              border: '1px solid rgba(255,255,255,0.1)',
                            }}>
                              <IconButton
                                size="small"
                                onClick={() => updateCartQuantity(item.id, item.quantity - 1)}
                                onMouseDown={() => startCartHold(item.id, -1)}
                                onMouseUp={() => stopCartHold(item.id)}
                                onMouseLeave={() => stopCartHold(item.id)}
                                onTouchStart={() => startCartHold(item.id, -1)}
                                onTouchEnd={() => stopCartHold(item.id)}
                                sx={{ color: '#94a3b8', p: 0.8, '&:hover': { color: '#f1f5f9' } }}
                              >
                                <Minus size={14} />
                              </IconButton>
                              <Typography sx={{ 
                                color: '#f1f5f9', 
                                minWidth: 28, 
                                textAlign: 'center',
                                fontWeight: 700,
                                fontSize: '0.85rem',
                              }}>
                                {item.quantity}
                              </Typography>
                              <IconButton
                                size="small"
                                onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
                                onMouseDown={() => startCartHold(item.id, 1)}
                                onMouseUp={() => stopCartHold(item.id)}
                                onMouseLeave={() => stopCartHold(item.id)}
                                onTouchStart={() => startCartHold(item.id, 1)}
                                onTouchEnd={() => stopCartHold(item.id)}
                                sx={{ color: '#94a3b8', p: 0.8, '&:hover': { color: '#f1f5f9' } }}
                              >
                                <Plus size={14} />
                              </IconButton>
                            </Box>
                            <Typography sx={{ fontSize: '0.7rem', color: '#64748b' }}>
                              × ฿{item.unitPrice.toLocaleString()}
                            </Typography>
                          </Box>

                          {/* Edit & Delete Buttons */}
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <IconButton
                              size="small"
                              onClick={() => openEditCartItem(item)}
                              sx={{
                                color: '#94a3b8',
                                p: 0.6,
                                '&:hover': { color: '#6366f1', bgcolor: 'rgba(99,102,241,0.1)' },
                              }}
                            >
                              <Edit size={14} />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => removeFromCart(item.id)}
                              sx={{
                                color: '#94a3b8',
                                p: 0.6,
                                '&:hover': { color: '#f87171', bgcolor: 'rgba(239,68,68,0.1)' },
                              }}
                            >
                              <X size={14} />
                            </IconButton>
                          </Box>
                        </Box>
                      </Box>

                      {/* Price */}
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center', minWidth: 70 }}>
                        <Typography sx={{ fontSize: '1rem', fontWeight: 800, color: '#10b981' }}>
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

        {/* Bottom Summary & Checkout */}
        {cart.length > 0 && (
          <Box sx={{
            px: { xs: 2, sm: 3 },
            py: 2,
            borderTop: '1px solid rgba(255,255,255,0.08)',
            background: 'linear-gradient(180deg, rgba(15,23,42,0.98) 0%, rgba(10,15,26,0.98) 100%)',
            backdropFilter: 'blur(20px)',
            paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
          }}>
            {/* Summary */}
            <Box sx={{
              p: 2,
              mb: 2,
              borderRadius: '14px',
              bgcolor: 'rgba(16,185,129,0.08)',
              border: '1px solid rgba(16,185,129,0.2)',
            }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mb: 0.3 }}>ยอดรวมทั้งหมด</Typography>
                  <Typography sx={{ fontSize: '1.6rem', fontWeight: 900, color: '#10b981' }}>
                    ฿{getTotalPrice().toLocaleString()}
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography sx={{ fontSize: '0.7rem', color: '#64748b' }}>{cart.length} รายการ</Typography>
                  <Typography sx={{ fontSize: '0.7rem', color: '#64748b' }}>
                    {cart.reduce((sum, item) => sum + item.quantity, 0)} ชิ้น
                  </Typography>
                </Box>
              </Box>
            </Box>

            {/* Checkout Button */}
            <Button
              fullWidth
              onClick={() => {
                if (!requireProfileBeforeCheckout()) return;
                setShowCart(false);
                setShowOrderDialog(true);
              }}
              disabled={!isShopOpen}
              sx={{
                py: 1.8,
                borderRadius: '14px',
                background: isShopOpen 
                  ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                  : 'rgba(100,116,139,0.2)',
                color: isShopOpen ? 'white' : '#64748b',
                fontSize: '1rem',
                fontWeight: 700,
                textTransform: 'none',
                boxShadow: isShopOpen ? '0 4px 20px rgba(16,185,129,0.3)' : 'none',
                '&:hover': {
                  background: isShopOpen 
                    ? 'linear-gradient(135deg, #059669 0%, #047857 100%)'
                    : 'rgba(100,116,139,0.3)',
                  boxShadow: isShopOpen ? '0 6px 24px rgba(16,185,129,0.4)' : 'none',
                },
                '&:disabled': {
                  background: 'rgba(100,116,139,0.2)',
                  color: '#64748b',
                },
              }}
            >
              {isShopOpen ? 'ยืนยันและดำเนินการสั่งซื้อ' : 'ร้านค้าปิดชั่วคราว'}
            </Button>
          </Box>
        )}
      </Drawer>

      {/* ===== Edit Cart Item Dialog ===== */}
      <Dialog
        open={!!editingCartItem}
        onClose={() => setEditingCartItem(null)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#0a0f1a',
            color: '#f1f5f9',
            borderRadius: '20px',
            border: '1px solid rgba(255,255,255,0.1)',
            mx: 2,
          },
        }}
      >
        {editingCartItem && (() => {
          const product = config?.products?.find(p => p.id === editingCartItem.productId);
          const availableSizes = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'];
          const displaySizes = product?.sizePricing ? Object.keys(product.sizePricing) : availableSizes;
          return (
            <>
              <DialogTitle sx={{ 
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Edit size={20} color="#6366f1" />
                  <Typography sx={{ fontWeight: 700 }}>แก้ไขสินค้า</Typography>
                </Box>
                <IconButton onClick={() => setEditingCartItem(null)} sx={{ color: '#94a3b8' }}>
                  <X size={20} />
                </IconButton>
              </DialogTitle>
              <DialogContent sx={{ pt: 3 }}>
                <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#e2e8f0', mb: 2 }}>
                  {editingCartItem.productName}
                </Typography>

                {/* Size Selection */}
                <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8', mb: 1 }}>ขนาด</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
                  {displaySizes.map((size) => {
                    const basePrice = product?.sizePricing?.[size] ?? product?.basePrice ?? editingCartItem.unitPrice;
                    const longSleeveFee = product?.options?.hasLongSleeve && editingCartItem.options.isLongSleeve ? 50 : 0;
                    const active = editingCartItem.size === size;
                    return (
                      <Box
                        key={size}
                        onClick={() => setEditingCartItem({ 
                          ...editingCartItem, 
                          size, 
                          unitPrice: basePrice + longSleeveFee 
                        })}
                        sx={{
                          px: 2,
                          py: 1,
                          borderRadius: '10px',
                          border: active ? '2px solid #6366f1' : '1px solid rgba(255,255,255,0.1)',
                          bgcolor: active ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.03)',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          '&:hover': { borderColor: '#6366f1' },
                        }}
                      >
                        <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, color: active ? '#a5b4fc' : '#e2e8f0' }}>
                          {size}
                        </Typography>
                      </Box>
                    );
                  })}
                </Box>

                {/* Custom Options */}
                {product?.options?.hasCustomName && (
                  <TextField
                    label="ชื่อติดเสื้อ"
                    fullWidth
                    value={editingCartItem.options.customName || ''}
                    onChange={(e) => setEditingCartItem({
                      ...editingCartItem,
                      options: { ...editingCartItem.options, customName: normalizeEngName(e.target.value) }
                    })}
                    inputProps={{ maxLength: 7 }}
                    sx={{ 
                      mb: 2,
                      '& .MuiOutlinedInput-root': { color: '#f1f5f9', borderRadius: '12px' },
                      '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' },
                      '& label': { color: '#64748b' },
                    }}
                  />
                )}

                {product?.options?.hasCustomNumber && (
                  <TextField
                    label="หมายเลขเสื้อ"
                    fullWidth
                    value={editingCartItem.options.customNumber || ''}
                    onChange={(e) => setEditingCartItem({
                      ...editingCartItem,
                      options: { ...editingCartItem.options, customNumber: normalizeDigits99(e.target.value) }
                    })}
                    inputProps={{ inputMode: 'numeric' }}
                    sx={{ 
                      mb: 2,
                      '& .MuiOutlinedInput-root': { color: '#f1f5f9', borderRadius: '12px' },
                      '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' },
                      '& label': { color: '#64748b' },
                    }}
                  />
                )}

                {product?.options?.hasLongSleeve && (
                  <Box 
                    onClick={() => {
                      const newIsLong = !editingCartItem.options.isLongSleeve;
                      const basePrice = product?.sizePricing?.[editingCartItem.size] ?? product?.basePrice ?? 0;
                      setEditingCartItem({
                        ...editingCartItem,
                        options: { ...editingCartItem.options, isLongSleeve: newIsLong },
                        unitPrice: basePrice + (newIsLong ? 50 : 0)
                      });
                    }}
                    sx={{
                      p: 2,
                      mb: 2,
                      borderRadius: '12px',
                      border: editingCartItem.options.isLongSleeve ? '2px solid #f59e0b' : '1px solid rgba(255,255,255,0.1)',
                      bgcolor: editingCartItem.options.isLongSleeve ? 'rgba(245,158,11,0.1)' : 'transparent',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Typography sx={{ color: '#e2e8f0', fontWeight: 600 }}>แขนยาว (+฿50)</Typography>
                    <Switch checked={editingCartItem.options.isLongSleeve} color="warning" sx={{ pointerEvents: 'none' }} />
                  </Box>
                )}

                {/* Quantity */}
                <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8', mb: 1 }}>จำนวน</Typography>
                <Box sx={{
                  display: 'flex',
                  alignItems: 'center',
                  bgcolor: 'rgba(255,255,255,0.05)',
                  borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  width: 'fit-content',
                }}>
                  <IconButton
                    onClick={() => setEditingCartItem({ ...editingCartItem, quantity: Math.max(1, editingCartItem.quantity - 1) })}
                    sx={{ color: '#94a3b8', p: 1.5 }}
                  >
                    <Minus size={18} />
                  </IconButton>
                  <Typography sx={{ color: '#f1f5f9', minWidth: 48, textAlign: 'center', fontWeight: 800, fontSize: '1.1rem' }}>
                    {editingCartItem.quantity}
                  </Typography>
                  <IconButton
                    onClick={() => setEditingCartItem({ ...editingCartItem, quantity: Math.min(99, editingCartItem.quantity + 1) })}
                    sx={{ color: '#94a3b8', p: 1.5 }}
                  >
                    <Plus size={18} />
                  </IconButton>
                </Box>
              </DialogContent>
              <DialogActions sx={{ p: 3, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <Button onClick={() => setEditingCartItem(null)} sx={{ color: '#94a3b8' }}>
                  ยกเลิก
                </Button>
                <Button
                  variant="contained"
                  onClick={() => updateCartItem(editingCartItem.id, editingCartItem)}
                  sx={{
                    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                    fontWeight: 700,
                    borderRadius: '12px',
                    px: 3,
                  }}
                >
                  บันทึกการแก้ไข
                </Button>
              </DialogActions>
            </>
          );
        })()}
      </Dialog>

      {renderProductDialog()}

      {/* ===== Size Chart Dialog - Modern Design ===== */}
      <Dialog
        open={showSizeChart}
        onClose={() => setShowSizeChart(false)}
        maxWidth="sm"
        fullWidth
        sx={{ zIndex: 1500 }}
        PaperProps={{
          sx: {
            bgcolor: '#0a0f1a',
            color: '#f1f5f9',
            borderRadius: '20px',
            border: '1px solid rgba(255,255,255,0.1)',
            mx: 2,
            my: 'auto',
            maxHeight: '85vh',
          },
        }}
        slotProps={{
          backdrop: {
            sx: { backdropFilter: 'blur(8px)', bgcolor: 'rgba(0,0,0,0.6)' },
          },
        }}
      >
        {/* Header */}
        <Box sx={{
          px: 2.5,
          py: 2,
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{
              width: 40,
              height: 40,
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              display: 'grid',
              placeItems: 'center',
            }}>
              <Ruler size={20} color="white" />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', color: '#f1f5f9' }}>ตารางไซส์</Typography>
              <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>สัดส่วนรอบอก/ความยาว (นิ้ว)</Typography>
            </Box>
          </Box>
          <IconButton onClick={() => setShowSizeChart(false)} sx={{ color: '#94a3b8' }}>
            <X size={22} />
          </IconButton>
        </Box>

        {/* Content */}
        <Box sx={{ px: 2.5, py: 2, overflow: 'auto' }}>
          {/* Info Badges */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8, mb: 2.5 }}>
            <Box sx={{
              px: 1.2,
              py: 0.4,
              borderRadius: '8px',
              bgcolor: 'rgba(99,102,241,0.15)',
              border: '1px solid rgba(99,102,241,0.3)',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: '#a5b4fc',
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
            }}>
              <Ruler size={14} /> อก / ความยาว (นิ้ว)
            </Box>
            <Box sx={{
              px: 1.2,
              py: 0.4,
              borderRadius: '8px',
              bgcolor: 'rgba(245,158,11,0.15)',
              border: '1px solid rgba(245,158,11,0.3)',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: '#fbbf24',
            }}>
              แขนยาว +50฿
            </Box>
          </Box>

          {/* Size Cards Grid */}
          <Box sx={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(2, 1fr)', 
            gap: 1.2,
          }}>
            {SIZE_ORDER.map((size) => {
              const measurements = SIZE_MEASUREMENTS[size];
              const row = sizeChartRows.find((r) => r.size === size);
              return (
                <Box 
                  key={size} 
                  sx={{ 
                    p: 1.5,
                    borderRadius: '14px',
                    bgcolor: 'rgba(30,41,59,0.6)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      bgcolor: 'rgba(30,41,59,0.8)',
                      borderColor: 'rgba(99,102,241,0.3)',
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Box sx={{
                      px: 1,
                      py: 0.3,
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      color: 'white',
                    }}>
                      {size}
                    </Box>
                    <Typography sx={{ fontSize: '0.95rem', fontWeight: 800, color: '#10b981' }}>
                      {row ? `฿${row.price.toLocaleString()}` : '—'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1.5 }}>
                    <Box>
                      <Typography sx={{ fontSize: '0.65rem', color: '#64748b', mb: 0.2 }}>รอบอก</Typography>
                      <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, color: '#e2e8f0' }}>
                        {measurements ? `${measurements.chest}"` : '—'}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: '0.65rem', color: '#64748b', mb: 0.2 }}>ความยาว</Typography>
                      <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, color: '#e2e8f0' }}>
                        {measurements ? `${measurements.length}"` : '—'}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>

        {/* Footer */}
        <Box sx={{ 
          px: 2.5, 
          py: 2, 
          borderTop: '1px solid rgba(255,255,255,0.08)',
        }}>
          <Button
            fullWidth
            onClick={() => setShowSizeChart(false)}
            sx={{
              py: 1.3,
              borderRadius: '12px',
              bgcolor: 'rgba(255,255,255,0.05)',
              color: '#94a3b8',
              fontSize: '0.9rem',
              fontWeight: 600,
              '&:hover': {
                bgcolor: 'rgba(255,255,255,0.1)',
              },
            }}
          >
            ปิด
          </Button>
        </Box>
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
            bgcolor: '#0a0f1a',
            color: '#f1f5f9',
            borderRadius: isMobile ? 0 : '20px',
            border: isMobile ? 'none' : '1px solid rgba(255,255,255,0.1)',
          },
        }}
      >
        <DialogTitle sx={{ 
          background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', 
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
        }}>
          <ShoppingCart size={22} />
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: '1.1rem' }}>ยืนยันการสั่งซื้อ</Typography>
            <Typography sx={{ fontSize: '0.75rem', opacity: 0.85 }}>{cart.length} รายการ</Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 3, bgcolor: '#0a0f1a' }}>
          {/* Order Summary with Product Images */}
          <Box sx={{ 
            p: 2, 
            borderRadius: '18px',
            bgcolor: 'rgba(30,41,59,0.6)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Package size={18} color="#94a3b8" />
              <Typography sx={{ fontWeight: 700, color: '#f1f5f9', fontSize: '0.95rem' }}>
                สรุปคำสั่งซื้อ
              </Typography>
            </Box>
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: 1.5,
              maxHeight: 280,
              overflow: 'auto',
            }}>
              {cart.map((item) => {
                const productInfo = config?.products?.find(p => p.id === item.productId);
                const productImage = productInfo?.images?.[0];
                
                return (
                  <Box key={item.id} sx={{ 
                    display: 'flex', 
                    gap: 1.5,
                    p: 1.5,
                    borderRadius: '14px',
                    bgcolor: 'rgba(15,23,42,0.6)',
                    border: '1px solid rgba(255,255,255,0.04)',
                  }}>
                    {/* Product Image */}
                    <Box sx={{
                      width: 60,
                      height: 60,
                      borderRadius: '12px',
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
                      {!productImage && (
                        <Package size={22} style={{ color: '#475569' }} />
                      )}
                    </Box>
                    {/* Product Details */}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ 
                        fontSize: '0.85rem', 
                        fontWeight: 600, 
                        color: '#e2e8f0',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        mb: 0.5,
                      }}>
                        {item.productName}
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 0.8 }}>
                        <Box sx={{
                          px: 0.7,
                          py: 0.15,
                          borderRadius: '5px',
                          bgcolor: 'rgba(99,102,241,0.15)',
                          fontSize: '0.68rem',
                          fontWeight: 600,
                          color: '#a5b4fc',
                        }}>
                          Size: {item.size}
                        </Box>
                        <Box sx={{
                          px: 0.7,
                          py: 0.15,
                          borderRadius: '5px',
                          bgcolor: 'rgba(255,255,255,0.08)',
                          fontSize: '0.68rem',
                          fontWeight: 600,
                          color: '#94a3b8',
                        }}>
                          x{item.quantity}
                        </Box>
                        {item.options.isLongSleeve && (
                          <Box sx={{
                            px: 0.7,
                            py: 0.15,
                            borderRadius: '5px',
                            bgcolor: 'rgba(245,158,11,0.15)',
                            fontSize: '0.68rem',
                            fontWeight: 600,
                            color: '#fbbf24',
                          }}>
                            แขนยาว
                          </Box>
                        )}
                        {item.options.customName && (
                          <Box sx={{
                            px: 0.7,
                            py: 0.15,
                            borderRadius: '5px',
                            bgcolor: 'rgba(16,185,129,0.15)',
                            fontSize: '0.68rem',
                            fontWeight: 600,
                            color: '#34d399',
                          }}>
                            {item.options.customName}
                          </Box>
                        )}
                        {item.options.customNumber && (
                          <Box sx={{
                            px: 0.7,
                            py: 0.15,
                            borderRadius: '5px',
                            bgcolor: 'rgba(168,85,247,0.15)',
                            fontSize: '0.68rem',
                            fontWeight: 600,
                            color: '#c084fc',
                          }}>
                            #{item.options.customNumber}
                          </Box>
                        )}
                      </Box>
                      <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: '#10b981' }}>
                        ฿{(item.unitPrice * item.quantity).toLocaleString()}
                      </Typography>
                    </Box>
                  </Box>
                );
              })}
            </Box>
            <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.08)' }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography sx={{ fontWeight: 700, color: '#f1f5f9', fontSize: '1rem' }}>ยอดรวมทั้งหมด</Typography>
              <Typography sx={{ fontWeight: 900, color: '#10b981', fontSize: '1.3rem' }}>
                ฿{getTotalPrice().toLocaleString()}
              </Typography>
            </Box>
          </Box>

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
                onClick={() => { setShowProfileModal(true); setPendingCheckout(true); }} 
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
            </Box>
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
          </Box>
        </DialogContent>
        <DialogActions sx={{ 
          p: 2, 
          gap: 1, 
          borderTop: '1px solid rgba(255,255,255,0.08)',
          bgcolor: '#0a0f1a',
        }}>
          <Button
            onClick={() => setShowOrderDialog(false)}
            sx={{ 
              flex: 1,
              py: 1.3,
              color: '#94a3b8', 
              borderRadius: '12px',
              fontSize: '0.9rem',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
            }}
          >
            ยกเลิก
          </Button>
          <Button
            onClick={submitOrder}
            variant="contained"
            disabled={!profileComplete || processing}
            sx={{
              flex: 1.5,
              py: 1.3,
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              fontWeight: 700,
              fontSize: '0.95rem',
              boxShadow: '0 8px 24px rgba(16, 185, 129, 0.35)',
              '&:hover': { 
                background: 'linear-gradient(135deg, #0ea472 0%, #047857 100%)', 
                boxShadow: '0 12px 30px rgba(16, 185, 129, 0.45)' 
              },
              '&:disabled': {
                background: 'rgba(100,116,139,0.3)',
                color: '#64748b',
              },
            }}
          >
            {processing ? 'กำลังดำเนินการ...' : 'ยืนยันการสั่งซื้อ'}
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

      {/* ===== Order History Dialog - Modern Design ===== */}
      <Drawer
        anchor="bottom"
        open={showHistoryDialog}
        onClose={() => setShowHistoryDialog(false)}
        PaperProps={{
          sx: {
            height: { xs: '92vh', sm: '85vh' },
            maxHeight: '92vh',
            borderTopLeftRadius: { xs: 20, sm: 24 },
            borderTopRightRadius: { xs: 20, sm: 24 },
            bgcolor: '#0a0f1a',
            overflow: 'hidden',
          },
        }}
      >
        {/* Header */}
        <Box sx={{
          px: { xs: 2, sm: 3 },
          py: { xs: 1.5, sm: 2 },
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: 'linear-gradient(180deg, rgba(15,23,42,0.98) 0%, rgba(10,15,26,0.98) 100%)',
          backdropFilter: 'blur(20px)',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}>
          {/* Drag Handle */}
          <Box sx={{ width: 36, height: 4, bgcolor: 'rgba(255,255,255,0.2)', borderRadius: 2, mx: 'auto', mb: 2 }} />
          
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{
                width: 40,
                height: 40,
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                display: 'grid',
                placeItems: 'center',
              }}>
                <Package size={20} color="white" />
              </Box>
              <Box>
                <Typography sx={{ fontSize: '1.1rem', fontWeight: 700, color: '#f1f5f9' }}>
                  คำสั่งซื้อของฉัน
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>
                  {orderHistory.length} รายการ
                </Typography>
              </Box>
            </Box>
            <IconButton onClick={() => setShowHistoryDialog(false)} sx={{ color: '#94a3b8' }}>
              <X size={22} />
            </IconButton>
          </Box>

          {/* Filter Tabs - Horizontal Scroll */}
          <Box sx={{
            display: 'flex',
            gap: 1,
            overflowX: 'auto',
            pb: 0.5,
            mx: -2,
            px: 2,
            '&::-webkit-scrollbar': { display: 'none' },
            scrollbarWidth: 'none',
          }}>
            {historyFilters.map((filter) => {
              const isActive = historyFilter === filter.key;
              const count = filterCounts[filter.key] ?? 0;
              return (
                <Box
                  key={filter.key}
                  onClick={() => setHistoryFilter(filter.key as any)}
                  sx={{
                    px: 2,
                    py: 0.8,
                    borderRadius: '20px',
                    bgcolor: isActive ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.04)',
                    border: isActive ? '1px solid rgba(99,102,241,0.4)' : '1px solid rgba(255,255,255,0.06)',
                    color: isActive ? '#a5b4fc' : '#94a3b8',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.8,
                    '&:hover': {
                      bgcolor: isActive ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.08)',
                    },
                  }}
                >
                  {filter.label}
                  <Box sx={{
                    px: 0.8,
                    py: 0.1,
                    borderRadius: '8px',
                    bgcolor: isActive ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.08)',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    minWidth: 20,
                    textAlign: 'center',
                  }}>
                    {count}
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>

        {/* Content */}
        <Box sx={{
          flex: 1,
          overflow: 'auto',
          px: { xs: 2, sm: 3 },
          py: 2,
          WebkitOverflowScrolling: 'touch',
        }}>
          {loadingHistory ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 8, gap: 2 }}>
              <CircularProgress size={36} sx={{ color: '#6366f1' }} />
              <Typography sx={{ color: '#64748b', fontSize: '0.9rem' }}>กำลังโหลดคำสั่งซื้อ...</Typography>
            </Box>
          ) : filteredOrders.length === 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 8, gap: 2 }}>
              <Box sx={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                bgcolor: 'rgba(100,116,139,0.1)',
                display: 'grid',
                placeItems: 'center',
              }}>
                <Package size={36} style={{ color: '#475569' }} />
              </Box>
              <Typography sx={{ color: '#64748b', fontSize: '0.95rem' }}>ไม่พบคำสั่งซื้อ</Typography>
              <Typography sx={{ color: '#475569', fontSize: '0.8rem' }}>
                {historyFilter === 'ALL' ? 'ยังไม่มีคำสั่งซื้อ' : 'ลองเปลี่ยนตัวกรองดู'}
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {filteredOrders.map((order, idx) => {
                const statusKey = normalizeStatus(order.status);
                const statusLabel = getStatusLabel(statusKey);
                const statusColor = getStatusColor(statusKey);
                const canCancel = CANCELABLE_STATUSES.includes(statusKey);
                const canPay = PAYABLE_STATUSES.includes(statusKey);
                const category = getStatusCategory(statusKey);

                // Status icon and color scheme
                const getStatusIcon = () => {
                  if (category === 'WAITING_PAYMENT') return <Clock size={14} />;
                  if (category === 'COMPLETED') return <CheckCircle size={14} />;
                  if (category === 'RECEIVED') return <Package size={14} />;
                  if (category === 'CANCELLED') return <XCircle size={14} />;
                  return <span>•</span>;
                };

                return (
                  <Box
                    key={idx}
                    sx={{
                      p: { xs: 2, sm: 2.5 },
                      borderRadius: '18px',
                      bgcolor: 'rgba(30,41,59,0.5)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        bgcolor: 'rgba(30,41,59,0.7)',
                        borderColor: 'rgba(255,255,255,0.1)',
                      },
                    }}
                  >
                    {/* Order Header */}
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
                      <Box>
                        <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.02em' }}>
                          #{order.ref}
                        </Typography>
                        <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.3 }}>
                          {new Date(order.date).toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short', year: '2-digit' })}
                          {' • '}
                          {new Date(order.date).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                        </Typography>
                      </Box>
                      <Box sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.6,
                        px: 1.2,
                        py: 0.4,
                        borderRadius: '8px',
                        bgcolor: `${statusColor}18`,
                        border: `1px solid ${statusColor}30`,
                      }}>
                        <Typography sx={{ fontSize: '0.7rem' }}>{getStatusIcon()}</Typography>
                        <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: statusColor }}>
                          {statusLabel}
                        </Typography>
                      </Box>
                    </Box>

                    {/* Product Items with Images */}
                    {(() => {
                      // Support both items and cart (backwards compatibility)
                      const orderItems = order.items || order.cart || [];
                      if (orderItems.length === 0) return null;
                      
                      return (
                        <Box sx={{ 
                          mb: 2, 
                          display: 'flex', 
                          flexDirection: 'column', 
                          gap: 1,
                        }}>
                          {orderItems.slice(0, 3).map((item, itemIdx) => {
                            const productInfo = config?.products?.find((p) => p.id === item.productId);
                            const productImage = productInfo?.images?.[0];
                            const itemName = item.name || item.productName || productInfo?.name || 'ไม่ทราบชื่อสินค้า';
                            const itemQty = item.qty || item.quantity || 1;
                            const itemIsLongSleeve = item.isLongSleeve || item.options?.isLongSleeve;
                            const itemCustomName = item.customName || item.options?.customName;
                            const itemSubtotal = item.subtotal || (item.unitPrice ? item.unitPrice * itemQty : 0);
                            
                            return (
                              <Box
                                key={itemIdx}
                                sx={{
                                  display: 'flex',
                                  gap: 1.5,
                                  p: 1.2,
                                  borderRadius: '12px',
                                  bgcolor: 'rgba(15,23,42,0.5)',
                                  border: '1px solid rgba(255,255,255,0.04)',
                                }}
                              >
                                {/* Product Image */}
                                <Box sx={{
                                  width: 56,
                                  height: 56,
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
                                  {!productImage && (
                                    <Package size={20} style={{ color: '#475569' }} />
                                  )}
                                </Box>
                                {/* Product Details */}
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                  <Typography sx={{
                                    fontSize: '0.82rem',
                                    fontWeight: 600,
                                    color: '#e2e8f0',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    mb: 0.3,
                                  }}>
                                    {itemName}
                                  </Typography>
                                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 0.5 }}>
                                    {item.size && (
                                      <Box sx={{
                                        px: 0.7,
                                        py: 0.15,
                                        borderRadius: '4px',
                                        bgcolor: 'rgba(99,102,241,0.15)',
                                        fontSize: '0.65rem',
                                        fontWeight: 600,
                                        color: '#a5b4fc',
                                      }}>
                                        Size: {item.size}
                                      </Box>
                                    )}
                                    {itemIsLongSleeve && (
                                      <Box sx={{
                                        px: 0.7,
                                        py: 0.15,
                                        borderRadius: '4px',
                                        bgcolor: 'rgba(245,158,11,0.15)',
                                        fontSize: '0.65rem',
                                        fontWeight: 600,
                                        color: '#fbbf24',
                                      }}>
                                        แขนยาว
                                      </Box>
                                    )}
                                    {itemCustomName && (
                                      <Box sx={{
                                        px: 0.7,
                                        py: 0.15,
                                        borderRadius: '4px',
                                        bgcolor: 'rgba(16,185,129,0.15)',
                                        fontSize: '0.65rem',
                                        fontWeight: 600,
                                        color: '#34d399',
                                      }}>
                                        {itemCustomName}
                                      </Box>
                                    )}
                                  </Box>
                                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <Typography sx={{ fontSize: '0.7rem', color: '#64748b' }}>
                                      x{itemQty}
                                    </Typography>
                                    <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: '#10b981' }}>
                                      ฿{itemSubtotal.toLocaleString()}
                                    </Typography>
                                  </Box>
                                </Box>
                              </Box>
                            );
                          })}
                          {orderItems.length > 3 && (
                            <Typography sx={{
                              fontSize: '0.75rem',
                              color: '#64748b',
                              textAlign: 'center',
                              py: 0.5,
                            }}>
                              +{orderItems.length - 3} รายการ
                            </Typography>
                          )}
                        </Box>
                      );
                    })()}

                    {/* Order Total & Actions */}
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pt: 1.5, borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                      <Box>
                        <Typography sx={{ fontSize: '0.7rem', color: '#64748b', mb: 0.2 }}>ยอดรวม</Typography>
                        <Typography sx={{ fontSize: '1.1rem', fontWeight: 800, color: '#10b981' }}>
                          ฿{order.total?.toLocaleString() || '0'}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        {canPay && (
                          <Button
                            size="small"
                            onClick={() => openPaymentFlow(order.ref)}
                            sx={{
                              px: 2,
                              py: 0.8,
                              borderRadius: '10px',
                              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                              color: 'white',
                              fontSize: '0.8rem',
                              fontWeight: 700,
                              textTransform: 'none',
                              boxShadow: '0 4px 14px rgba(16,185,129,0.3)',
                              '&:hover': {
                                background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                                boxShadow: '0 6px 20px rgba(16,185,129,0.4)',
                              },
                            }}
                          >
                            ชำระเงิน
                          </Button>
                        )}
                        {canCancel && (
                          <Button
                            size="small"
                            onClick={() => handleCancelOrder(order.ref)}
                            disabled={cancellingRef === order.ref}
                            sx={{
                              px: 2,
                              py: 0.8,
                              borderRadius: '10px',
                              bgcolor: 'rgba(239,68,68,0.1)',
                              border: '1px solid rgba(239,68,68,0.3)',
                              color: '#f87171',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              textTransform: 'none',
                              '&:hover': {
                                bgcolor: 'rgba(239,68,68,0.2)',
                                borderColor: 'rgba(239,68,68,0.5)',
                              },
                              '&:disabled': {
                                color: '#64748b',
                                borderColor: 'rgba(100,116,139,0.3)',
                              },
                            }}
                          >
                            {cancellingRef === order.ref ? 'กำลังยกเลิก...' : 'ยกเลิก'}
                          </Button>
                        )}
                      </Box>
                    </Box>
                  </Box>
                );
              })}

              {/* Load More */}
              {historyHasMore && (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                  <Button
                    onClick={() => loadOrderHistory({ append: true })}
                    disabled={loadingHistoryMore}
                    sx={{
                      px: 4,
                      py: 1,
                      borderRadius: '12px',
                      bgcolor: 'rgba(99,102,241,0.1)',
                      border: '1px solid rgba(99,102,241,0.3)',
                      color: '#a5b4fc',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      textTransform: 'none',
                      '&:hover': {
                        bgcolor: 'rgba(99,102,241,0.2)',
                      },
                      '&:disabled': {
                        color: '#64748b',
                      },
                    }}
                  >
                    {loadingHistoryMore ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CircularProgress size={16} sx={{ color: '#a5b4fc' }} />
                        กำลังโหลด...
                      </Box>
                    ) : (
                      'โหลดเพิ่มเติม'
                    )}
                  </Button>
                </Box>
              )}
            </Box>
          )}
        </Box>

        {/* Bottom Safe Area */}
        <Box sx={{
          px: { xs: 2, sm: 3 },
          py: 1.5,
          borderTop: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(10,15,26,0.98)',
          backdropFilter: 'blur(20px)',
          paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
        }}>
          <Button
            fullWidth
            onClick={() => setShowHistoryDialog(false)}
            sx={{
              py: 1.3,
              borderRadius: '12px',
              bgcolor: 'rgba(255,255,255,0.06)',
              color: '#94a3b8',
              fontSize: '0.9rem',
              fontWeight: 600,
              textTransform: 'none',
              '&:hover': {
                bgcolor: 'rgba(255,255,255,0.1)',
              },
            }}
          >
            ปิด
          </Button>
        </Box>
      </Drawer>

      <Box
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          bgcolor: 'rgba(15,23,42,0.95)',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.4)',
          display: { xs: 'flex', md: 'none' },
          justifyContent: 'space-around',
          py: 1,
          px: 1,
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
                gap: 0.3,
                color: isActive ? '#6366f1' : '#94a3b8',
                borderRadius: 0,
                px: 2.5,
                py: 0.5,
                background: 'transparent',
                border: 'none',
                boxShadow: 'none',
                transform: 'none',
                transition: 'color 0.2s ease',
                '&:hover': {
                  background: 'transparent',
                  color: isActive ? '#6366f1' : '#e2e8f0',
                },
                touchAction: 'manipulation',
              }}
            >
              {tab.icon}
              <Typography variant="caption" sx={{ fontSize: '0.65rem', fontWeight: isActive ? 700 : 500 }}>{tab.label}</Typography>
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

      {/* Enhanced Modern Toast Container */}
      {toasts.length > 0 && (
        <Box
          sx={{
            position: 'fixed',
            top: { xs: 16, sm: 24 },
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 99999,
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
            width: { xs: 'calc(100% - 32px)', sm: 'auto' },
            maxWidth: 420,
            pointerEvents: 'none',
          }}
        >
          {toasts.map((t) => {
            const colors = {
              success: { 
                bg: 'linear-gradient(135deg, rgba(16, 185, 129, 0.98) 0%, rgba(5, 150, 105, 0.98) 100%)', 
                icon: <CheckCircle2 size={18} />,
                shadow: '0 8px 32px rgba(16, 185, 129, 0.35)',
              },
              error: { 
                bg: 'linear-gradient(135deg, rgba(239, 68, 68, 0.98) 0%, rgba(220, 38, 38, 0.98) 100%)', 
                icon: <AlertCircle size={18} />,
                shadow: '0 8px 32px rgba(239, 68, 68, 0.35)',
              },
              warning: { 
                bg: 'linear-gradient(135deg, rgba(245, 158, 11, 0.98) 0%, rgba(234, 88, 12, 0.98) 100%)', 
                icon: <AlertTriangle size={18} />,
                shadow: '0 8px 32px rgba(245, 158, 11, 0.35)',
              },
              info: { 
                bg: 'linear-gradient(135deg, rgba(59, 130, 246, 0.98) 0%, rgba(37, 99, 235, 0.98) 100%)', 
                icon: <Info size={18} />,
                shadow: '0 8px 32px rgba(59, 130, 246, 0.35)',
              },
            };
            return (
              <Slide key={t.id} in direction="down" timeout={350}>
                <Box
                  sx={{
                    background: colors[t.type].bg,
                    backdropFilter: 'blur(16px)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '16px',
                    py: 1.5,
                    px: 2,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    boxShadow: colors[t.type].shadow,
                    cursor: 'pointer',
                    pointerEvents: 'auto',
                    animation: 'toastEnter 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
                    '@keyframes toastEnter': {
                      '0%': { opacity: 0, transform: 'translateY(-12px) scale(0.96)' },
                      '100%': { opacity: 1, transform: 'translateY(0) scale(1)' },
                    },
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      transform: 'scale(1.02)',
                      boxShadow: `${colors[t.type].shadow}, 0 0 0 2px rgba(255, 255, 255, 0.1)`,
                    },
                  }}
                  onClick={() => setToasts((prev) => prev.filter((toast) => toast.id !== t.id))}
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
                    {colors[t.type].icon}
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
                    {t.message}
                  </Typography>
                  <Box
                    sx={{
                      color: 'rgba(255,255,255,0.8)',
                      p: 0.5,
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      '&:hover': { 
                        color: '#fff',
                        bgcolor: 'rgba(255, 255, 255, 0.15)',
                      },
                    }}
                  >
                    <X size={16} />
                  </Box>
                </Box>
              </Slide>
            );
          })}
        </Box>
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
