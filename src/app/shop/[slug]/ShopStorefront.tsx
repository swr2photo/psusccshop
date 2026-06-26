// src/app/shop/[slug]/ShopStorefront.tsx
// Client-side storefront for individual shops — matches main store design
'use client';

import { apiFetch, getCart, saveCart as saveCartApi } from '@/lib/api-client';
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Box, Typography, Button, Chip, Avatar, IconButton, Badge,
  Dialog, DialogContent, DialogActions, TextField,
  useMediaQuery, Skeleton,
  CircularProgress, Tooltip, Drawer,
} from '@mui/material';
import {
  Store, ShoppingCart, Plus, Minus, X, ArrowLeft, Search,
  Share2, Heart, Package, Clock, Tag,
  History, MapPin, User, Phone, Mail, Instagram, Facebook, Palette, Image as ImageOutlinedIcon,
  CheckCircle2, ChevronLeft, ChevronRight, Zap, Ruler,
} from 'lucide-react';
import { useSession, signIn } from 'next-auth/react';
import dynamic from 'next/dynamic';
const TurnstileWidget = dynamic(() => import('@/components/TurnstileWidget'), { ssr: false });
const OrderHistoryDrawer = dynamic(() => import('@/components/OrderHistoryDrawer'), { ssr: false });
const CheckoutDialog = dynamic(() => import('@/components/CheckoutDialog'), { ssr: false });
const ProfileModal = dynamic(() => import('@/components/ProfileModal'), { ssr: false });
const CartDrawer = dynamic(() => import('@/components/CartDrawer'), { ssr: false });
const PaymentFlow = dynamic(() => import('@/components/PaymentFlow'), { ssr: false });
function TogglePlaceholder() {
  return <div style={{ display: 'inline-block', width: 40, height: 40, flexShrink: 0 }} aria-hidden />;
}
const ThemeToggle = dynamic(() => import('@/components/ThemeToggle'), { ssr: false, loading: TogglePlaceholder });
const LanguageToggle = dynamic(() => import('@/components/LanguageToggle'), { ssr: false, loading: TogglePlaceholder });
import { type SavedAddress } from '@/components/ProfileModal';
import Link from 'next/link';
import { useCartStore } from '@/store/cartStore';
import { useWishlistStore } from '@/store/wishlistStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { usePublicShopQuery, queryKeys } from '@/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase-client';
import OptimizedImage from '@/components/OptimizedImage';
import { useGalleryImagePreload, isGalleryImageInRange } from '@/hooks/useGalleryImagePreload';
import AnnouncementBar from '@/components/AnnouncementBar';
import EventBanner, { type ShopEvent } from '@/components/EventBanner';
import Footer from '@/components/Footer';
import SupportChatWidget from '@/components/SupportChatWidget';
import { useNotification } from '@/components/NotificationContext';
import {
  getProductStatus, getShopStatus, SHOP_STATUS_CONFIG, ShopStatusBanner, type ShopStatusType,
} from '@/components/ShopStatusCard';
import type { Product, ShopConfig } from '@/lib/config';
import type { ShippingConfig } from '@/lib/shipping';
import type { CartItem as DrawerCartItem } from '@/lib/shop-constants';
import { zustandCartToDrawerCart, drawerCartToZustandItem } from '@/lib/cart-mapper';
import { useRealtimeOrdersByEmail } from '@/hooks/useRealtimeOrders';
import {
  getProductName, getProductDescription,
  getCategoryLabel, getCategoryIcon,
  sortProductsNewestFirst,
  DEFAULT_SHIRT_NAME, getProductShirtNameConfig, type ShirtNameConfig,
  DEFAULT_NAME_VALIDATION,
} from '@/lib/config';
import { submitOrder as submitOrderApi, getHistory, cancelOrder as cancelOrderApi, saveProfile as saveProfileApi, getProfile } from '@/lib/api-client';
import type { OrderHistory } from '@/lib/shop-constants';
import {
  isValidCustomerName, sanitizeCustomerName, onlyDigitsPhone, resolveProfileAddress,
  getStatusCategory, normalizeStatus,
  productRequiresSize, getDisplaySizes, SIZE_MEASUREMENTS, resolveProductUnitPrice,
  resolveShopOpenFields, applyRealtimeShopRow,
} from '@/lib/shop-constants';

// ==================== TYPES ====================
interface ShopInfo {
  id: string;
  slug: string;
  name: string;
  nameEn?: string;
  description?: string;
  descriptionEn?: string;
  logoUrl?: string;
  bannerUrl?: string;
  isActive: boolean;
  settings?: {
    isOpen?: boolean;
    closeDate?: string;
    openDate?: string;
    closedMessage?: string;
  };
  paymentInfo?: {
    promptPayId?: string;
    bankName?: string;
    accountName?: string;
    accountNumber?: string;
  };
  contactEmail?: string;
  contactPhone?: string;
  socialLinks?: Record<string, string>;
  products?: Product[];
  productCount?: number;
}

const SOCIAL_LINK_LABELS: Record<string, { th: string; en: string }> = {
  facebook: { th: 'Facebook', en: 'Facebook' },
  instagram: { th: 'Instagram', en: 'Instagram' },
  line: { th: 'LINE', en: 'LINE' },
  tiktok: { th: 'TikTok', en: 'TikTok' },
  twitter: { th: 'X (Twitter)', en: 'X (Twitter)' },
  website: { th: 'เว็บไซต์', en: 'Website' },
};

function isLikelyUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length < 4) return false;
  if (/^https?:\/\//i.test(trimmed)) return true;
  if (/^www\./i.test(trimmed)) return true;
  if (/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(trimmed)) return true;
  return /^(line\.me|facebook\.com|instagram\.com|tiktok\.com)/i.test(trimmed);
}

function normalizeSocialUrl(url: string): string {
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function getSocialLinkEntries(links?: Record<string, string>) {
  if (!links || typeof links !== 'object' || Array.isArray(links)) return [];
  return Object.entries(links)
    .filter(([, url]) => typeof url === 'string' && isLikelyUrl(url))
    .map(([key, url]) => ({ key: key.toLowerCase(), url: url.trim() }));
}

export interface ShopStorefrontProps {
  shopSlug: string;
  initialShop: ShopInfo;
}

// ==================== HELPERS ====================
const TAG_TRANSLATIONS_TH_TO_EN: Record<string, string> = {
  'ขายดี': 'Best Seller',
  'สินค้าใหม่': 'New',
  'แนะนำ': 'Recommended',
  'ลดราคา': 'On Sale',
  'หมดแล้ว': 'Sold Out',
  'พรีออเดอร์': 'Pre-order',
  'จำนวนจำกัด': 'Limited Edition',
  'สั่งผลิต': 'Made to Order',
  'สินค้าพิเศษ': 'Special',
  'ของใหม่': 'New Arrival',
};

function getEventDiscount(productId: string, events: ShopEvent[] | undefined): {
  discountedPrice: (original: number) => number;
  discountLabel: string;
  eventTitle: string;
} | null {
  if (!events?.length) return null;
  const now = new Date();
  const active = events.find(e =>
    e.enabled &&
    e.linkedProducts?.includes(productId) &&
    e.discountType && e.discountValue && e.discountValue > 0 &&
    (!e.startDate || new Date(e.startDate) <= now) &&
    (!e.endDate || new Date(e.endDate) > now)
  );
  if (!active) return null;
  return {
    discountedPrice: (original: number) => {
      if (active.discountType === 'percent') return Math.round(original * (1 - active.discountValue! / 100));
      return Math.max(0, original - active.discountValue!);
    },
    discountLabel: active.discountType === 'percent' ? `-${active.discountValue}%` : `-฿${active.discountValue}`,
    eventTitle: active.title,
  };
}

/** Normalize shirt custom name based on ShirtNameConfig */
const normalizeShirtName = (value: string, cfg: ShirtNameConfig = DEFAULT_SHIRT_NAME): string => {
  let pattern = '';
  if (cfg.allowEnglish) pattern += 'a-zA-Z';
  if (cfg.allowThai) pattern += '\u0E00-\u0E7F';
  if (cfg.allowSpecialChars && cfg.allowedSpecialChars) {
    pattern += cfg.allowedSpecialChars.replace(/[\\\]\^\-]/g, '\\$&');
  }
  pattern += '\\s';
  const regex = new RegExp(`[^${pattern}]`, 'g');
  let result = value.replace(regex, '');
  if (cfg.autoUppercase) result = result.toUpperCase();
  return result.slice(0, cfg.maxLength).trim();
};

const normalizeDigits99 = (value: string) => {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  return String(Math.min(99, Number(digits)));
};

// ==================== COMPONENT ====================
export default function ShopStorefront({ shopSlug, initialShop }: ShopStorefrontProps) {
  const { data: session } = useSession();
  const { t, lang } = useTranslation();
  const { confirm: showConfirm, ConfirmDialog } = useConfirmDialog();
  const { success: toastSuccess, error: toastError, warning: toastWarning, info: toastInfo } = useNotification();
  const isMobile = useMediaQuery('(max-width:600px)', { noSsr: true });
  const cart = useCartStore((s) => s.cart);
  const addToCart = useCartStore((s) => s.addToCart);
  const wishlistStore = useWishlistStore();

  // Filter cart items for this shop only
  const shopCart = useMemo(() => cart.filter(item => item.shopSlug === shopSlug), [cart, shopSlug]);

  const queryClient = useQueryClient();
  const { data: shopQueryResult, isFetching: isShopFetching } = usePublicShopQuery(initialShop.id, initialShop);

  const shop = shopQueryResult?.shop || initialShop;
  const products: Product[] = (shop as any)?.products || [];
  const shopOpenFields = useMemo(() => resolveShopOpenFields(shop), [shop]);
  const shopStatusType = useMemo(
    () => getShopStatus(shopOpenFields.isOpen, shopOpenFields.closeDate, shopOpenFields.openDate),
    [shopOpenFields],
  );
  const isShopOpen = shopStatusType === 'OPEN';
  const announcements: any[] = (shop as any)?.announcements || [];
  const announcementHistory: any[] = (shop as any)?.announcementHistory || [];
  const events: ShopEvent[] = (shop as any)?.events || [];
  const socialMediaNews: any[] = (shop as any)?.socialMediaNews || [];
  const loading = isShopFetching && products.length === 0;
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [cartOpen, setCartOpen] = useState(false);
  const paymentOpenerRef = useRef<((ref: string) => void) | null>(null);
  const cartHoldTimers = useRef<Record<string, ReturnType<typeof setInterval> | null>>({});
  const shopCartRef = useRef(shopCart);
  const loadOrderHistoryRef = useRef<(opts?: { append?: boolean }) => Promise<void>>(async () => {});
  const historyLoadedRef = useRef(false);
  const [editingCartItem, setEditingCartItem] = useState<DrawerCartItem | null>(null);
  const [shippingConfig, setShippingConfig] = useState<ShippingConfig | null>(null);
  const [confirmCancelRef, setConfirmCancelRef] = useState<string | null>(null);

  // Product dialog state
  const [selectedSize, setSelectedSize] = useState('');
  const sizeSelectorRef = useRef<HTMLDivElement>(null);
  const [selectedPattern, setSelectedPattern] = useState<any>(null);
  const [quantity, setQuantity] = useState(1);
  const patternSelectorRef = useRef<HTMLDivElement>(null);
  const [customName, setCustomName] = useState('');
  const [customNumber, setCustomNumber] = useState('');
  const [isLongSleeve, setIsLongSleeve] = useState<boolean | null>(null);
  const customNameInputRef = useRef<HTMLInputElement>(null);
  const customNumberInputRef = useRef<HTMLInputElement>(null);

  // Product gallery states
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const imageScrollRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  // Compile all unique images for the selected product
  const productImages = useMemo(() => {
    if (!selectedProduct) return [];
    const imgs: string[] = [];
    
    if (selectedProduct.coverImage) {
      imgs.push(selectedProduct.coverImage);
    }
    
    if (selectedProduct.images && selectedProduct.images.length > 0) {
      selectedProduct.images.forEach((img) => {
        if (img && !imgs.includes(img)) {
          imgs.push(img);
        }
      });
    }

    if (selectedProduct.patterns && selectedProduct.patterns.length > 0) {
      selectedProduct.patterns.forEach((p: any) => {
        if (p.isActive !== false && p.image && !imgs.includes(p.image)) {
          imgs.push(p.image);
        }
      });
    }

    return imgs;
  }, [selectedProduct]);

  // Smooth scroll container to a specific image index
  const scrollToImage = useCallback((index: number) => {
    if (!imageScrollRef.current || productImages.length === 0) return;
    const container = imageScrollRef.current;
    const targetIndex = (index + productImages.length) % productImages.length;
    const itemWidth = container.clientWidth;
    container.scrollTo({
      left: targetIndex * itemWidth,
      behavior: 'smooth',
    });
    setActiveImageIndex(targetIndex);
  }, [productImages]);

  // Handle native scroll/swipe index detection
  const handleImageScroll = useCallback(() => {
    if (!imageScrollRef.current) return;
    const container = imageScrollRef.current;
    const scrollPosition = container.scrollLeft;
    const itemWidth = container.clientWidth;
    if (itemWidth > 0) {
      const roundedIndex = Math.round(scrollPosition / itemWidth);
      if (roundedIndex >= 0 && roundedIndex < productImages.length) {
        setActiveImageIndex(prev => prev !== roundedIndex ? roundedIndex : prev);
      }
    }
  }, [productImages]);

  // Sync selected pattern to scroll to its corresponding image
  useEffect(() => {
    if (selectedPattern?.image) {
      const idx = productImages.indexOf(selectedPattern.image);
      if (idx !== -1) {
        const timer = setTimeout(() => {
          scrollToImage(idx);
        }, 100);
        return () => clearTimeout(timer);
      }
    }
  }, [selectedPattern, productImages, scrollToImage]);

  useGalleryImagePreload(productImages, activeImageIndex);
  useGalleryImagePreload(productImages, lightboxIndex);

  // Keyboard navigation for fullscreen lightbox
  useEffect(() => {
    if (!lightboxOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        setLightboxIndex((prev) => (prev - 1 + productImages.length) % productImages.length);
      } else if (e.key === 'ArrowRight') {
        setLightboxIndex((prev) => (prev + 1) % productImages.length);
      } else if (e.key === 'Escape') {
        setLightboxOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxOpen, productImages]);

  // Checkout state
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutProcessing, setCheckoutProcessing] = useState(false);
  const [orderName, setOrderName] = useState('');
  const [orderPhone, setOrderPhone] = useState('');
  const [orderAddress, setOrderAddress] = useState('');
  const [orderInstagram, setOrderInstagram] = useState('');
  const [orderProfileImage, setOrderProfileImage] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');

  // Profile modal state
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [pendingCheckout, setPendingCheckout] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);

  const orderData = useMemo(() => ({
    name: orderName,
    phone: orderPhone,
    address: orderAddress,
    instagram: orderInstagram,
    profileImage: orderProfileImage,
    email: session?.user?.email || '',
  }), [orderName, orderPhone, orderAddress, orderInstagram, orderProfileImage, session?.user?.email]);

  const nameValidation = useMemo(
    () => ({ ...DEFAULT_NAME_VALIDATION, ...(shop as any).nameValidation }),
    [shop],
  );

  const profileComplete = useMemo(() => {
    return isValidCustomerName(orderName, nameValidation) && !!orderPhone && !!orderInstagram;
  }, [orderName, orderPhone, orderInstagram, nameValidation]);

  const mappedShopCart = useMemo(() => {
    return shopCart.map((item) => ({
      id: item.id,
      productId: item.productId || item.id.split('-')[0],
      productName: item.name,
      size: item.size || '-',
      quantity: item.qty,
      unitPrice: item.price,
      options: {
        customName: item.customName,
        customNumber: item.customNumber,
        isLongSleeve: item.sleeve === 'LONG',
        pattern: item.selectedPattern?.name || undefined,
      },
    }));
  }, [shopCart]);

  // Order History state
  const [showOrderHistory, setShowOrderHistory] = useState(false);
  const [orderHistory, setOrderHistory] = useState<OrderHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingHistoryMore, setLoadingHistoryMore] = useState(false);
  const [historyCursor, setHistoryCursor] = useState<string | null>(null);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<'ALL' | 'WAITING_PAYMENT' | 'COMPLETED' | 'SHIPPED' | 'RECEIVED' | 'CANCELLED'>('ALL');
  const [cancellingRef, setCancellingRef] = useState<string | null>(null);

  const pendingPaymentCount = useMemo(() => {
    return orderHistory.filter((order) => {
      const category = getStatusCategory(normalizeStatus(order.status));
      return category === 'WAITING_PAYMENT';
    }).length;
  }, [orderHistory]);

  const needsPatternFirst = useMemo(() => {
    if (!selectedProduct) return false;
    return Boolean(selectedProduct.patterns && selectedProduct.patterns.filter((p: any) => p.isActive !== false).length > 0 && !selectedPattern);
  }, [selectedProduct, selectedPattern]);

  const displaySizes = useMemo(() => {
    if (!selectedProduct) return [] as string[];
    return getDisplaySizes(selectedProduct, t.common.freeSize);
  }, [selectedProduct, t.common.freeSize]);

  const shopSocialLinks = useMemo(
    () => getSocialLinkEntries(shop.socialLinks),
    [shop.socialLinks],
  );

  const hasShopContact = Boolean(shop.contactEmail || shop.contactPhone || shopSocialLinks.length > 0);

  // Follow shop state
  const [isFollowing, setIsFollowing] = useState(false);

  const showToast = useCallback((type: 'success' | 'error' | 'info' | 'warning', message: string) => {
    if (type === 'success') toastSuccess(message);
    else if (type === 'error') toastError(message);
    else if (type === 'warning') toastWarning(message);
    else toastInfo(message);
  }, [toastSuccess, toastError, toastWarning, toastInfo]);

  const shopConfig = useMemo((): ShopConfig => ({
    isOpen: shopOpenFields.isOpen,
    closeDate: shopOpenFields.closeDate ?? '',
    openDate: shopOpenFields.openDate,
    closedMessage: shopOpenFields.closedMessage,
    products,
    announcements,
    announcementHistory,
    events,
    socialMediaNews,
    liveStream: (shop as any).liveStream,
    promoCodes: (shop as any).promoCodes,
    nameValidation: (shop as any).nameValidation,
    shirtNameConfig: (shop as any).shirtNameConfig ?? DEFAULT_SHIRT_NAME,
    pickup: (shop as any).pickup,
  }), [shopOpenFields, products, announcements, announcementHistory, events, socialMediaNews]);

  const shirtCfg = useMemo(
    () => getProductShirtNameConfig(selectedProduct, shopConfig.shirtNameConfig),
    [selectedProduct, shopConfig.shirtNameConfig],
  );
  const drawerCart = useMemo(() => zustandCartToDrawerCart(shopCart), [shopCart]);

  const liveStream = (shop as any).liveStream;
  const isLiveActive = Boolean(
    liveStream?.enabled &&
    (!liveStream.endedAt || new Date(liveStream.endedAt) > new Date())
  );
  const liveTitle = liveStream?.title || '';

  const openLiveStream = useCallback(() => {
    window.dispatchEvent(new CustomEvent('open-live-stream'));
  }, []);

  const openPaymentFlow = useCallback((ref: string) => {
    setShowOrderHistory(false);
    setShowProfileModal(false);
    setCartOpen(false);
    setCheckoutOpen(false);
    paymentOpenerRef.current?.(ref);
  }, []);

  useEffect(() => {
    shopCartRef.current = shopCart;
  }, [shopCart]);

  // Load user profile for checkout (API returns { data: { profile: {...} } })
  useEffect(() => {
    if (!session?.user?.email) return;
    getProfile(session.user.email)
      .then((res) => {
        const profile = (res.data as { profile?: Record<string, unknown> })?.profile;
        if (res.status !== 'success' || !profile) return;

        const sanitized = {
          name: typeof profile.name === 'string' ? profile.name.trim() : '',
          phone: typeof profile.phone === 'string' ? onlyDigitsPhone(profile.phone) : '',
          address: typeof profile.address === 'string' ? profile.address.trim() : '',
          instagram: typeof profile.instagram === 'string' ? profile.instagram.trim() : '',
          profileImage: typeof profile.profileImage === 'string' ? profile.profileImage : '',
        };

        const loadedAddresses = Array.isArray(profile.savedAddresses)
          ? (profile.savedAddresses as SavedAddress[])
          : [];
        const resolvedAddress = resolveProfileAddress(sanitized.address, loadedAddresses);

        setOrderName((prev) => sanitized.name || prev || session.user?.name || '');
        setOrderPhone((prev) => sanitized.phone || prev);
        setOrderAddress((prev) => resolvedAddress || prev);
        setOrderInstagram((prev) => sanitized.instagram || prev);
        if (sanitized.profileImage) setOrderProfileImage(sanitized.profileImage);
        if (loadedAddresses.length > 0) {
          setSavedAddresses(loadedAddresses);
        }
      })
      .catch(() => {});
  }, [session?.user?.email, session?.user?.name]);

  // Shipping options preview (same as main store cart drawer)
  useEffect(() => {
    apiFetch('/api/shipping/options', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (data?.config) setShippingConfig(data.config);
      })
      .catch(() => {});
  }, []);

  // Load order history on mount for badge count
  useEffect(() => {
    if (session?.user?.email) {
      loadOrderHistory();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.email]);

  // Load cart from database on mount or session change
  useEffect(() => {
    const email = session?.user?.email;
    if (!email) return;
    
    let active = true;
    const loadCart = async () => {
      try {
        const res = await getCart(email);
        const serverCart = (res.data as any)?.cart || (res as any)?.cart;
        if (res.status === 'success' && Array.isArray(serverCart) && active) {
          useCartStore.getState().setCart(serverCart);
        }
      } catch (error) {
        console.error('[Cart Sync] Failed to load cart from database:', error);
      }
    };
    
    loadCart();
    return () => { active = false; };
  }, [session?.user?.email]);

  // Sync local Zustand cart with database cart for logged-in users when it changes
  useEffect(() => {
    const email = session?.user?.email;
    if (!email) return;
    
    const saveTimer = setTimeout(async () => {
      try {
        await saveCartApi(email, cart);
      } catch (error) {
        console.error('[Cart Sync] Failed to save cart to database:', error);
      }
    }, 500);

    return () => clearTimeout(saveTimer);
  }, [cart, session?.user?.email]);

  // Load follow state from localStorage
  useEffect(() => {
    try {
      const follows = JSON.parse(localStorage.getItem('shop-follows') || '{}');
      setIsFollowing(!!follows[shopSlug]);
    } catch { /* ignore */ }
  }, [shopSlug]);

  // Realtime shop and product updates
  useEffect(() => {
    if (!shopSlug) return;

    const channel = supabase
      .channel(`shop-realtime-${shopSlug}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'shops',
          filter: `slug=eq.${shopSlug}`,
        },
        (payload) => {
          console.log('[Realtime] Shop updated:', payload);
          const updatedRow = payload.new as Record<string, any> | null;
          if (updatedRow) {
            queryClient.setQueryData([...queryKeys.shop.all, 'public', initialShop.id], (prev: any) => {
              if (!prev?.shop) return prev;
              return {
                ...prev,
                shop: applyRealtimeShopRow(prev.shop, updatedRow),
              };
            });
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [shopSlug, queryClient, initialShop.id]);

  // Refetch shop status when user returns to the tab (same as main shop)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        queryClient.invalidateQueries({ queryKey: [...queryKeys.shop.all, 'public', initialShop.id] });
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [queryClient, initialShop.id]);

  // Block purchase / close product details drawer if active product status changes in shop products (e.g. disabled or out of stock)
  useEffect(() => {
    if (!selectedProduct || !products.length) return;
    const updatedProduct = products.find(p => p.id === selectedProduct.id);
    const isOutOfStock = updatedProduct && (
      (updatedProduct.stock !== null && updatedProduct.stock !== undefined && updatedProduct.stock <= 0) ||
      (updatedProduct.variants && updatedProduct.variants.length > 0 && updatedProduct.variants.every(v => v.stock !== null && v.stock !== undefined && v.stock <= 0))
    );
    if (!updatedProduct || getProductStatus(updatedProduct) !== 'OPEN' || isOutOfStock) {
      showToast('warning', lang === 'en' ? 'This product is no longer available' : 'สินค้านี้ไม่พร้อมจำหน่ายแล้ว');
      setSelectedProduct(null);
    } else {
      setSelectedProduct(updatedProduct);
    }
  }, [products, selectedProduct, lang, showToast]);

  // Auto-close product dialog/cart when shop becomes closed
  useEffect(() => {
    if (!isShopOpen) {
      if (selectedProduct) {
        setSelectedProduct(null);
        setSelectedSize('');
        setSelectedPattern(null);
        setQuantity(1);
        setCustomName('');
        setCustomNumber('');
        setIsLongSleeve(null);
        showToast('warning', lang === 'en' ? 'Shop is closed temporarily' : 'ร้านค้าปิดให้บริการชั่วคราว');
      }
      if (cartOpen) {
        setCartOpen(false);
        showToast('warning', lang === 'en' ? 'Shop is closed temporarily' : 'ร้านค้าปิดให้บริการชั่วคราว');
      }
    }
  }, [isShopOpen, selectedProduct, cartOpen, lang, showToast]);

  const toggleFollow = useCallback(() => {
    setIsFollowing(prev => {
      const newVal = !prev;
      try {
        const follows = JSON.parse(localStorage.getItem('shop-follows') || '{}');
        if (newVal) {
          follows[shopSlug] = Date.now();
        } else {
          delete follows[shopSlug];
        }
        localStorage.setItem('shop-follows', JSON.stringify(follows));
      } catch { /* ignore */ }
      return newVal;
    });
  }, [shopSlug]);

  // Order History - Load orders for this shop
  const loadOrderHistory = useCallback(async (opts?: { append?: boolean }) => {
    if (!session?.user?.email) return;
    const append = opts?.append;
    const pageSize = isMobile ? 20 : 50;
    append ? setLoadingHistoryMore(true) : setLoadingHistory(true);
    try {
      const res = await getHistory(session.user.email, append ? historyCursor || undefined : undefined, pageSize, shopSlug);
      if (res.status === 'success') {
        const rawHistory = res.data?.history || (res as any)?.history || [];
        const hasMore = Boolean(res.data?.hasMore);
        const nextCursor = res.data?.nextCursor || null;
        if (Array.isArray(rawHistory)) {
          const history = rawHistory.map((order: any) => {
            let total = order.total || order.totalAmount || order.amount || 0;
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
            return { ...order, total, items: order.items || order.cart || [] };
          });
          setOrderHistory(prev => {
            if (append) {
              const existingRefs = new Set(prev.map(o => o.ref));
              const newOrders = history.filter((o: any) => !existingRefs.has(o.ref));
              return [...prev, ...newOrders];
            } else {
              const seen = new Set<string>();
              return history.filter((o: any) => {
                if (seen.has(o.ref)) return false;
                seen.add(o.ref);
                return true;
              });
            }
          });
          setHistoryHasMore(hasMore);
          setHistoryCursor(nextCursor);
          historyLoadedRef.current = true;
        } else {
          if (!append) setOrderHistory([]);
          setHistoryHasMore(false);
          setHistoryCursor(null);
        }
      }
    } catch (error) {
      console.error('Failed to load history:', error);
      showToast('error', lang === 'en' ? 'Cannot load order history' : 'ไม่สามารถโหลดประวัติคำสั่งซื้อได้');
    } finally {
      append ? setLoadingHistoryMore(false) : setLoadingHistory(false);
    }
  }, [session?.user?.email, isMobile, historyCursor, shopSlug, showToast, lang]);

  useEffect(() => {
    loadOrderHistoryRef.current = loadOrderHistory;
  }, [loadOrderHistory]);

  const handleOrderChange = useCallback((change: any) => {
    const orderShopSlug = change.order?.shop_slug || change.order?.shopSlug;
    if (orderShopSlug && orderShopSlug !== shopSlug) return;

    if (change.type === 'UPDATE' && change.order) {
      setOrderHistory((prev) => {
        const existingIndex = prev.findIndex((o) => o.ref === change.order.ref);
        if (existingIndex < 0) return prev;
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          status: change.order.status,
          total: change.order.total_amount ?? change.order.totalAmount ?? updated[existingIndex].total,
          items: change.order.cart || change.order.items || updated[existingIndex].items,
        };
        return updated;
      });
    } else if (change.type === 'INSERT' && change.order) {
      const newOrder: OrderHistory = {
        ref: change.order.ref,
        date: change.order.date || change.order.created_at,
        status: change.order.status,
        total: change.order.total_amount ?? change.order.totalAmount,
        items: change.order.cart || change.order.items || [],
      };
      setOrderHistory((prev) => (prev.some((o) => o.ref === newOrder.ref) ? prev : [newOrder, ...prev]));
    } else if (change.type === 'DELETE') {
      const deletedRef = change.oldOrder?.ref;
      if (deletedRef) {
        setOrderHistory((prev) => prev.filter((o) => o.ref !== deletedRef));
      } else if (historyLoadedRef.current) {
        loadOrderHistoryRef.current({ append: false });
      }
    }
  }, [shopSlug]);

  const { isConnected: realtimeConnected } = useRealtimeOrdersByEmail(
    session?.user?.email,
    handleOrderChange,
  );

  // Load order history when drawer opens
  useEffect(() => {
    if (showOrderHistory && session?.user?.email) {
      loadOrderHistory();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showOrderHistory, session?.user?.email, historyFilter]);

  // Cancel order handler
  const handleCancelOrder = useCallback(async (ref: string) => {
    setConfirmCancelRef(ref);
  }, []);

  const confirmCancelOrder = useCallback(async () => {
    const ref = confirmCancelRef;
    if (!ref) return;
    try {
      setCancellingRef(ref);
      const res = await cancelOrderApi(ref);
      if (res.status === 'success') {
        showToast('success', lang === 'en' ? 'Order cancelled' : 'ยกเลิกคำสั่งซื้อแล้ว');
        setOrderHistory(prev => prev.map(order => order.ref === ref ? { ...order, status: 'CANCELLED' } : order));
        setTimeout(() => loadOrderHistory(), 500);
      } else {
        showToast('error', res.message || (lang === 'en' ? 'Cancel failed' : 'ยกเลิกไม่สำเร็จ'));
      }
    } catch (error: any) {
      showToast('error', error.message || (lang === 'en' ? 'Cancel failed' : 'ยกเลิกไม่สำเร็จ'));
    } finally {
      setCancellingRef(null);
      setConfirmCancelRef(null);
    }
  }, [confirmCancelRef, lang, showToast, loadOrderHistory]);

  // Cart operations
  const removeFromCart = useCartStore((s) => s.removeFromCart);
  const updateItem = useCartStore((s) => s.updateItem);

  const handleRemoveCartItem = useCallback((idx: number) => {
    removeFromCart(idx);
    showToast('success', lang === 'en' ? 'Removed from cart' : 'ลบสินค้าออกจากตะกร้าแล้ว');
  }, [removeFromCart, showToast, lang]);

  const handleUpdateCartQty = useCallback((globalIdx: number, newQty: number) => {
    if (newQty <= 0) {
      removeFromCart(globalIdx);
      showToast('success', lang === 'en' ? 'Removed from cart' : 'ลบสินค้าออกจากตะกร้าแล้ว');
      return;
    }
    const item = cart[globalIdx];
    if (item) {
      updateItem(globalIdx, { ...item, qty: newQty, total: item.price * newQty });
    }
  }, [cart, removeFromCart, updateItem, showToast, lang]);

  const findCartIndexById = useCallback((id: string) => {
    return cart.findIndex((c) => c.id === id && c.shopSlug === shopSlug);
  }, [cart, shopSlug]);

  const updateDrawerCartQuantity = useCallback((id: string, quantity: number) => {
    const idx = findCartIndexById(id);
    if (idx < 0) return;
    handleUpdateCartQty(idx, quantity);
  }, [findCartIndexById, handleUpdateCartQty]);

  const removeDrawerCartItem = useCallback((id: string) => {
    const idx = findCartIndexById(id);
    if (idx >= 0) handleRemoveCartItem(idx);
  }, [findCartIndexById, handleRemoveCartItem]);

  const stopCartHold = useCallback((id: string) => {
    const timer = cartHoldTimers.current[id];
    if (timer) {
      clearInterval(timer);
      cartHoldTimers.current[id] = null;
    }
  }, []);

  const startCartHold = useCallback((id: string, delta: number) => {
    stopCartHold(id);
    cartHoldTimers.current[id] = setInterval(() => {
      const target = shopCartRef.current.find((item) => item.id === id);
      if (!target) {
        stopCartHold(id);
        return;
      }
      updateDrawerCartQuantity(id, target.qty + delta);
    }, 200);
  }, [stopCartHold, updateDrawerCartQuantity]);

  const getTotalPrice = useCallback(() => {
    return shopCart.reduce((sum, item) => sum + item.total, 0);
  }, [shopCart]);

  const updateDrawerCartItem = useCallback((id: string, item: DrawerCartItem) => {
    const idx = findCartIndexById(id);
    const zItem = drawerCartToZustandItem(item, shopSlug, products);
    if (idx >= 0 && zItem) {
      updateItem(idx, zItem);
      showToast('success', lang === 'en' ? 'Cart updated' : 'อัปเดตตะกร้าแล้ว');
    }
    setEditingCartItem(null);
  }, [findCartIndexById, shopSlug, products, updateItem, showToast, lang]);

  const requireProfileBeforeCheckout = useCallback(() => {
    if (!session?.user?.email) {
      showToast('warning', lang === 'en' ? 'Please sign in to checkout' : 'กรุณาเข้าสู่ระบบก่อนสั่งซื้อ');
      signIn();
      return false;
    }
    if (!profileComplete) {
      showToast('warning', t.profile.profileSaveRequired);
      setShowProfileModal(true);
      setPendingCheckout(true);
      return false;
    }
    return true;
  }, [session?.user?.email, profileComplete, showToast, t.profile.profileSaveRequired]);

  // Profile save handler
  const handleSaveProfile = async (data: Partial<typeof orderData> & { savedAddresses?: SavedAddress[] }) => {
    if (!session?.user?.email) {
      showToast('error', lang === 'en' ? 'Please log in' : 'กรุณาเข้าสู่ระบบ');
      return;
    }

    setSavingProfile(true);
    const nameCfg = { ...DEFAULT_NAME_VALIDATION, ...shopConfig.nameValidation };
    const addressList = data.savedAddresses ?? savedAddresses;
    const resolvedAddress = resolveProfileAddress(
      data.address?.trim() || orderAddress,
      addressList,
    );

    const sanitized = {
      name: data.name ? sanitizeCustomerName(data.name, nameCfg) : orderName,
      phone: data.phone ? onlyDigitsPhone(data.phone) : orderPhone,
      address: resolvedAddress,
      instagram: data.instagram ? data.instagram.trim() : orderInstagram,
      profileImage: data.profileImage !== undefined ? (data.profileImage || '') : orderProfileImage,
    };

    if (sanitized.name) setOrderName(sanitized.name);
    if (sanitized.phone) setOrderPhone(sanitized.phone);
    if (sanitized.address) setOrderAddress(sanitized.address);
    if (sanitized.instagram) setOrderInstagram(sanitized.instagram);
    if (data.profileImage !== undefined) setOrderProfileImage(sanitized.profileImage);

    if (data.savedAddresses) {
      setSavedAddresses(data.savedAddresses);
    }

    try {
      const profilePayload: Parameters<typeof saveProfileApi>[1] = {
        name: sanitized.name,
        phone: sanitized.phone,
        instagram: sanitized.instagram,
      };
      if (sanitized.address) profilePayload.address = sanitized.address;
      if (data.savedAddresses && data.savedAddresses.length > 0) {
        profilePayload.savedAddresses = data.savedAddresses;
      }
      if (sanitized.profileImage) {
        profilePayload.profileImage = sanitized.profileImage;
      }

      await saveProfileApi(session.user.email, profilePayload);

      showToast('success', lang === 'en' ? 'Profile saved' : 'บันทึกข้อมูลจัดส่งแล้ว');
      setShowProfileModal(false);
      if (pendingCheckout && isValidCustomerName(sanitized.name, nameCfg) && sanitized.phone && sanitized.instagram) {
        setCheckoutOpen(true);
        setPendingCheckout(false);
      }
    } catch (error: any) {
      showToast('error', error.message || (lang === 'en' ? 'Save failed' : 'บันทึกข้อมูลไม่สำเร็จ'));
    } finally {
      setSavingProfile(false);
    }
  };

  // Checkout handler
  const handleShopCheckout = useCallback(async (options?: {
    shippingOptionId?: string;
    paymentOptionId?: string;
    shippingFee?: number;
    promoCode?: string;
    promoDiscount?: number;
  }) => {
    if (!session?.user?.email) {
      showToast('warning', lang === 'en' ? 'Please sign in to checkout' : 'กรุณาเข้าสู่ระบบก่อนสั่งซื้อ');
      return;
    }
    if (shopCart.length === 0) {
      showToast('warning', lang === 'en' ? 'Cart is empty' : 'ตะกร้าว่าง');
      return;
    }
    if (!isShopOpen) {
      showToast('warning', lang === 'en' ? 'Shop is closed temporarily' : 'ร้านค้าปิดให้บริการชั่วคราว');
      setCheckoutOpen(false);
      return;
    }

    // Block submission if any product in cart is disabled or out of stock
    const unavailableItem = shopCart.find(item => {
      const p = products.find(prod => prod.id === item.productId || prod.id === item.id.split('-')[0]);
      if (!p) return true; // Product deleted
      const isOutOfStock = (
        (p.stock !== null && p.stock !== undefined && p.stock <= 0) ||
        (p.variants && p.variants.length > 0 && p.variants.every(v => v.stock !== null && v.stock !== undefined && v.stock <= 0))
      );
      return getProductStatus(p) !== 'OPEN' || isOutOfStock;
    });

    if (unavailableItem) {
      showToast('error', lang === 'en' ? `Product "${unavailableItem.name}" is no longer available.` : `สินค้า "${unavailableItem.name}" ไม่พร้อมจำหน่ายแล้ว`);
      setCheckoutOpen(false);
      return;
    }
    if (!orderName.trim()) {
      showToast('warning', lang === 'en' ? 'Please enter your name' : 'กรุณากรอกชื่อ');
      return;
    }
    if (!turnstileToken) {
      showToast('warning', lang === 'en' ? 'Please complete the verification' : 'กรุณายืนยันว่าคุณไม่ใช่บอท');
      return;
    }

    setCheckoutProcessing(true);
    try {
      const subtotal = shopCart.reduce((sum, item) => sum + item.total, 0);
      const shippingFee = options?.shippingFee || 0;
      const promoDiscount = options?.promoDiscount || 0;
      const totalAmount = Math.max(0, subtotal + shippingFee - promoDiscount);

      const res = await submitOrderApi({
        customerName: orderName.trim(),
        customerEmail: session.user.email,
        customerPhone: orderPhone.trim(),
        customerAddress: orderAddress.trim(),
        customerInstagram: orderInstagram.trim(),
        cart: shopCart.map(item => ({
          productId: item.productId || item.id.split('-')[0],
          productName: item.name,
          size: item.size || '-',
          quantity: item.qty,
          unitPrice: item.price,
          options: {
            customName: item.customName,
            customNumber: item.customNumber,
            isLongSleeve: item.sleeve === 'LONG',
            pattern: item.selectedPattern?.name || undefined,
          },
        })),
        totalAmount,
        turnstileToken,
        shippingOptionId: options?.shippingOptionId,
        paymentOptionId: options?.paymentOptionId,
        shippingFee: options?.shippingFee,
        promoCode: options?.promoCode,
        promoDiscount: options?.promoDiscount,
        shopId: shop.id,
        shopSlug: shop.slug,
      });

      if (res.status === 'success' && res.ref) {
        showToast('success', `${lang === 'en' ? 'Order placed!' : 'สั่งซื้อสำเร็จ!'} ${res.ref}`);

        // Persist latest shipping info so address does not disappear next visit
        if (session.user.email) {
          const postOrderPayload: Parameters<typeof saveProfileApi>[1] = {
            name: orderName.trim(),
            phone: orderPhone.trim(),
            instagram: orderInstagram.trim(),
          };
          const addrToSave = orderAddress.trim() || resolveProfileAddress('', savedAddresses);
          if (addrToSave) postOrderPayload.address = addrToSave;
          if (savedAddresses.length > 0) postOrderPayload.savedAddresses = savedAddresses;
          saveProfileApi(session.user.email, postOrderPayload).catch(() => {});
        }

        // Clear only this shop's cart items
        const clearCartByShop = useCartStore.getState().clearCartByShop;
        clearCartByShop(shopSlug);
        setCartOpen(false);
        setCheckoutOpen(false);
        setTurnstileToken('');
        openPaymentFlow(res.ref);
        setTimeout(() => loadOrderHistory(), 500);

        // Invalidate shop public query to refresh inventory/stock
        queryClient.invalidateQueries({
          queryKey: [...queryKeys.shop.all, 'public', shop.id],
        });
      } else {
        showToast('error', (res as any).message || (lang === 'en' ? 'Order failed' : 'สั่งซื้อไม่สำเร็จ'));
      }
    } catch (err: any) {
      showToast('error', err.message || (lang === 'en' ? 'Error' : 'เกิดข้อผิดพลาด'));
    } finally {
      setCheckoutProcessing(false);
    }
  }, [session, shopCart, orderName, orderPhone, orderAddress, orderInstagram, shop.id, shop.slug, shopSlug, lang, showToast, turnstileToken, queryClient, openPaymentFlow, loadOrderHistory, products, isShopOpen]);

  // Categories from products
  const categories = useMemo(() => {
    const cats = new Set<string>();
    products.forEach((p) => {
      if (p.category) cats.add(p.category);
    });
    return Array.from(cats);
  }, [products]);

  // Grouped products by category
  const filteredGroupedProducts = useMemo(() => {
    const filtered = sortProductsNewestFirst(products.filter((p) => {
      if (selectedCategory !== 'all' && p.category !== selectedCategory) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return p.name.toLowerCase().includes(q) ||
          (p.nameEn && p.nameEn.toLowerCase().includes(q)) ||
          (p.description && p.description.toLowerCase().includes(q));
      }
      return true;
    }));

    const grouped: Record<string, Product[]> = {};
    filtered.forEach((p) => {
      const cat = p.category || 'OTHER';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(p);
    });
    return grouped;
  }, [products, selectedCategory, searchQuery]);

  const totalFilteredCount = Object.values(filteredGroupedProducts).reduce((sum, items) => sum + items.length, 0);
  const cartCount = shopCart.length;

  const handleSelectProduct = useCallback((product: Product) => {
    setSelectedProduct(product);
    setSelectedSize('');
    setSelectedPattern(null);
    setQuantity(1);
    setCustomName('');
    setCustomNumber('');
    setIsLongSleeve(null);
    setActiveImageIndex(0);
  }, []);

  const handleAnnouncementProductClick = useCallback((productId: string) => {
    const target = products.find((p) => p.id === productId);
    if (target) handleSelectProduct(target);
  }, [products, handleSelectProduct]);

  const handleEventClick = useCallback((event: ShopEvent) => {
    const linkedId = event.linkedProducts?.[0];
    if (linkedId) {
      const target = products.find((p) => p.id === linkedId);
      if (target) handleSelectProduct(target);
    }
  }, [products, handleSelectProduct]);

  const resetProductDialog = useCallback(() => {
    setSelectedProduct(null);
    setSelectedSize('');
    setSelectedPattern(null);
    setQuantity(1);
    setCustomName('');
    setCustomNumber('');
    setIsLongSleeve(null);
  }, []);

  const buildCartItem = useCallback(() => {
    if (!selectedProduct) return null;

    if (!isShopOpen) {
      showToast('warning', lang === 'en' ? 'Shop is closed' : 'ร้านค้าปิดให้บริการอยู่');
      return null;
    }

    const needsSize = productRequiresSize(selectedProduct);
    const hasVariants = !needsSize && !!selectedProduct.variants?.length;

    if ((needsSize || hasVariants) && !selectedSize) {
      sizeSelectorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => {
        sizeSelectorRef.current?.classList.add('shake-highlight');
        setTimeout(() => sizeSelectorRef.current?.classList.remove('shake-highlight'), 600);
      }, 300);
      showToast('warning', needsSize
        ? (lang === 'en' ? 'Please select a size' : 'กรุณาเลือกขนาดไซส์')
        : (lang === 'en' ? 'Please select an option' : 'กรุณาเลือกตัวเลือกสินค้า'));
      return null;
    }

    const hasPatterns = selectedProduct.patterns && selectedProduct.patterns.filter((p: any) => p.isActive !== false).length > 0;
    if (hasPatterns && !selectedPattern) {
      patternSelectorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => {
        patternSelectorRef.current?.classList.add('shake-highlight');
        setTimeout(() => patternSelectorRef.current?.classList.remove('shake-highlight'), 600);
      }, 300);
      showToast('warning', lang === 'en' ? 'Please select a design/pattern' : 'กรุณาเลือกลายสินค้า');
      return null;
    }

    const normalizedCustomName = selectedProduct.options?.hasCustomName ? normalizeShirtName(customName, shirtCfg) : '';

    if (selectedProduct.options?.hasCustomName && !normalizedCustomName) {
      customNameInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => customNameInputRef.current?.focus(), 300);
      showToast('warning', lang === 'en' ? 'Please enter a custom name' : 'กรุณากรอกชื่อสกรีน');
      return null;
    }

    if (selectedProduct.options?.hasCustomName && normalizedCustomName.length < shirtCfg.minLength) {
      customNameInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => customNameInputRef.current?.focus(), 300);
      showToast('warning', `${lang === 'en' ? 'Name must be at least' : 'ชื่อสกรีนต้องมีความยาวอย่างน้อย'} ${shirtCfg.minLength} ${lang === 'en' ? 'characters' : 'ตัวอักษร'}`);
      return null;
    }

    if (selectedProduct.options?.hasCustomNumber && !customNumber) {
      customNumberInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => customNumberInputRef.current?.focus(), 300);
      showToast('warning', lang === 'en' ? 'Please enter a number' : 'กรุณากรอกเบอร์สกรีน');
      return null;
    }

    if (selectedProduct.options?.hasLongSleeve && isLongSleeve === null) {
      showToast('warning', lang === 'en' ? 'Please select a sleeve type' : 'กรุณาเลือกประเภทแขนเสื้อ');
      return null;
    }

    const price = resolveProductUnitPrice(selectedProduct, selectedSize, isLongSleeve);
    const patternName = selectedPattern?.name || '';

    let sizeToUse = needsSize ? selectedSize : '-';
    let variantForCart: NonNullable<Product['variants']>[number] | undefined;
    if (hasVariants) {
      const variant = selectedProduct.variants!.find((v) => v.id === selectedSize);
      if (!variant) return null;
      variantForCart = variant;
      sizeToUse = variant.name;
    }

    return {
      id: `${selectedProduct.id}-${selectedSize || '-'}-${variantForCart?.id || '-'}-${patternName || '-'}-${isLongSleeve === true ? 'LONG' : 'SHORT'}-${normalizedCustomName || '-'}-${customNumber || '-'}`,
      productId: selectedProduct.id,
      name: selectedProduct.name,
      type: selectedProduct.type || 'OTHER' as const,
      category: selectedProduct.category,
      subType: selectedProduct.subType,
      price,
      qty: quantity,
      size: sizeToUse || '-',
      total: price * quantity,
      selectedVariant: variantForCart || undefined,
      selectedPattern: selectedPattern || undefined,
      sleeve: (selectedProduct.options?.hasLongSleeve ? (isLongSleeve === true ? 'LONG' : 'SHORT') : undefined) as 'LONG' | 'SHORT' | undefined,
      customName: selectedProduct.options?.hasCustomName ? normalizedCustomName : undefined,
      customNumber: selectedProduct.options?.hasCustomNumber ? customNumber : undefined,
      shopSlug,
    };
  }, [selectedProduct, selectedSize, selectedPattern, quantity, customName, customNumber, isLongSleeve, showToast, lang, shopSlug, isShopOpen, shirtCfg]);

  const commitCartItem = useCallback((item: NonNullable<ReturnType<typeof buildCartItem>>, options?: { goCheckout?: boolean }) => {
    const productName = selectedProduct ? getProductName(selectedProduct, lang) : item.name;
    addToCart(item);
    showToast(
      'success',
      options?.goCheckout ? t.cart.addedGoCheckout : `${t.cart.addedToCart}: ${productName}`,
    );
    resetProductDialog();
    if (options?.goCheckout) {
      setCheckoutOpen(true);
    }
  }, [addToCart, showToast, t.cart.addedGoCheckout, t.cart.addedToCart, resetProductDialog, selectedProduct, lang]);

  const handleAddToCart = useCallback(() => {
    const item = buildCartItem();
    if (!item) return;
    commitCartItem(item);
  }, [buildCartItem, commitCartItem]);

  const handleBuyNow = useCallback(() => {
    const item = buildCartItem();
    if (!item) return;
    if (!requireProfileBeforeCheckout()) return;
    commitCartItem(item, { goCheckout: true });
  }, [buildCartItem, commitCartItem, requireProfileBeforeCheckout]);

  const handleShareProduct = useCallback(async (product: Product) => {
    const url = `${window.location.origin}/shop/${shopSlug}`;
    const shareText = `${getProductName(product, lang)} - ฿${product.basePrice.toLocaleString()}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: getProductName(product, lang), text: shareText, url });
      } else {
        await navigator.clipboard.writeText(`${shareText}\n${url}`);
        showToast('success', t.product.linkCopied);
      }
    } catch { /* User cancelled */ }
  }, [shopSlug, lang, showToast, t]);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'var(--background)', color: 'var(--foreground)' }}>
      {/* ==================== HEADER ==================== */}
      <Box sx={{
        position: 'sticky', top: 0, zIndex: 100,
        backdropFilter: 'blur(20px)',
        bgcolor: 'var(--glass-bg)',
        borderBottom: '1px solid var(--glass-border)',
      }}>
        <Box sx={{
          maxWidth: '1200px', mx: 'auto', px: 2, py: 1.5,
          display: 'flex', alignItems: 'center', gap: 2,
        }}>
          <Link href="/" style={{ textDecoration: 'none', color: 'inherit' }}>
            <IconButton sx={{ color: 'var(--text-muted)' }}>
              <ArrowLeft size={20} />
            </IconButton>
          </Link>
          <Avatar
            src={shop.logoUrl}
            sx={{ width: 36, height: 36, bgcolor: 'var(--surface-2)' }}
          >
            {shop.name[0]}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 700, fontSize: '1rem', lineHeight: 1.2, color: 'var(--foreground)' }} noWrap>
              {shop.name}
            </Typography>
            {!isShopOpen && (
              <Typography sx={{ fontSize: '0.7rem', color: 'var(--error)' }}>
                {shopOpenFields.closedMessage || (lang === 'en' ? 'Orders closed' : 'ปิดรับออเดอร์')}
              </Typography>
            )}
          </Box>
          {/* Follow button */}
          <Tooltip title={isFollowing ? (lang === 'en' ? 'Unfollow' : 'เลิกติดตาม') : (lang === 'en' ? 'Follow' : 'ติดตาม')}>
            <IconButton
              onClick={toggleFollow}
              sx={{
                color: isFollowing ? '#ff453a' : 'var(--text-muted)',
                transition: 'all 0.2s ease',
                '&:hover': { color: '#ff453a' },
              }}
            >
              <Heart size={20} fill={isFollowing ? '#ff453a' : 'none'} />
            </IconButton>
          </Tooltip>
          {isLiveActive && (
            <Tooltip title={liveTitle || (lang === 'en' ? 'Live now' : 'กำลังไลฟ์')}>
              <Button
                size="small"
                onClick={openLiveStream}
                sx={{
                  minWidth: 'auto',
                  px: 1.2,
                  py: 0.5,
                  borderRadius: '999px',
                  bgcolor: 'rgba(255,69,58,0.15)',
                  color: '#ff453a',
                  fontWeight: 800,
                  fontSize: '0.72rem',
                  '&:hover': { bgcolor: 'rgba(255,69,58,0.25)' },
                }}
              >
                LIVE
              </Button>
            </Tooltip>
          )}
          <ThemeToggle />
          <LanguageToggle />
          {/* Order History button */}
          {session?.user?.email && (
            <Tooltip title={lang === 'en' ? 'Order History' : 'ประวัติคำสั่งซื้อ'}>
              <IconButton
                onClick={() => setShowOrderHistory(true)}
                sx={{ color: 'var(--foreground)' }}
              >
                <Badge badgeContent={pendingPaymentCount} color="warning">
                  <History size={20} />
                </Badge>
              </IconButton>
            </Tooltip>
          )}
          <IconButton onClick={() => setCartOpen(true)} sx={{ color: 'var(--foreground)' }}>
            <Badge badgeContent={cartCount} color="error">
              <ShoppingCart size={22} />
            </Badge>
          </IconButton>
          {session?.user?.email ? (
            <Tooltip title={lang === 'en' ? 'Profile' : 'โปรไฟล์'}>
              <Avatar
                src={orderProfileImage || session.user?.image || ''}
                onClick={() => setShowProfileModal(true)}
                sx={{
                  width: 32,
                  height: 32,
                  cursor: 'pointer',
                  border: '1px solid var(--glass-border)',
                  bgcolor: 'var(--surface-2)',
                }}
              >
                {!orderProfileImage && !session.user?.image && (
                  session.user?.name?.[0] || <User size={16} />
                )}
              </Avatar>
            </Tooltip>
          ) : (
            <Tooltip title={lang === 'en' ? 'Sign in' : 'เข้าสู่ระบบ'}>
              <IconButton
                onClick={() => signIn()}
                sx={{ p: 0.25 }}
              >
                <Avatar sx={{ width: 32, height: 32, bgcolor: 'var(--surface-2)', border: '1px solid var(--glass-border)' }}>
                  <User size={16} color="var(--text-muted)" />
                </Avatar>
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>

      <ShopStatusBanner
        isOpen={shopOpenFields.isOpen}
        closeDate={shopOpenFields.closeDate}
        openDate={shopOpenFields.openDate}
        customMessage={shopOpenFields.closedMessage}
      />

      {/* ==================== BANNER ==================== */}
      <Box sx={{
        position: 'relative',
        height: isMobile ? 160 : 220,
        background: shop.bannerUrl
          ? `url(${shop.bannerUrl}) center/cover`
          : 'linear-gradient(135deg, #0071e3 0%, #0077ED 50%, #34c759 100%)',
        display: 'flex', alignItems: 'flex-end',
      }}>
        <Box sx={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(transparent 30%, var(--background) 100%)',
        }} />
        <Box sx={{
          position: 'relative', px: 3, pb: 2.5, maxWidth: '1200px',
          mx: 'auto', width: '100%',
        }}>
          <Typography sx={{ fontSize: isMobile ? '1.4rem' : '1.8rem', fontWeight: 800, color: 'white', textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>
            {shop.name}
          </Typography>
          {shop.description && (
            <Typography sx={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)', mt: 0.5, textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
              {shop.description}
            </Typography>
          )}
          <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
            <Chip
              label={isShopOpen ? t.shopStatus.open : t.shopStatus.closed}
              size="small"
              sx={{
                bgcolor: isShopOpen ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                color: isShopOpen ? '#34c759' : 'var(--error)',
                fontWeight: 700, fontSize: '0.75rem',
                backdropFilter: 'blur(8px)',
              }}
            />
            <Chip
              label={`${products.filter(p => p.isActive).length} ${t.common.items}`}
              size="small"
              sx={{
                bgcolor: 'rgba(0,113,227,0.15)',
                color: '#2997ff',
                fontWeight: 700, fontSize: '0.75rem',
                backdropFilter: 'blur(8px)',
              }}
            />
            <Chip
              icon={<Heart size={12} fill={isFollowing ? '#ff453a' : 'none'} color={isFollowing ? '#ff453a' : '#fff'} />}
              label={isFollowing ? (lang === 'en' ? 'Following' : 'กำลังติดตาม') : (lang === 'en' ? 'Follow' : 'ติดตาม')}
              size="small"
              onClick={toggleFollow}
              sx={{
                bgcolor: isFollowing ? 'rgba(255,69,58,0.2)' : 'rgba(255,255,255,0.15)',
                color: isFollowing ? '#ff453a' : 'white',
                fontWeight: 700, fontSize: '0.75rem',
                backdropFilter: 'blur(8px)',
                cursor: 'pointer',
                '&:hover': { opacity: 0.8 },
                transition: 'all 0.2s ease',
              }}
            />
          </Box>
        </Box>
      </Box>

      {/* ==================== ANNOUNCEMENTS ==================== */}
      {announcements.length > 0 && (
        <Box sx={{ maxWidth: '1200px', mx: 'auto', px: { xs: 0, sm: 2 }, pt: 2 }}>
          <AnnouncementBar
            announcements={announcements}
            history={announcementHistory}
            socialMediaNews={socialMediaNews}
            onProductClick={handleAnnouncementProductClick}
          />
        </Box>
      )}

      {/* ==================== EVENTS ==================== */}
      {events.filter(e => e.enabled).length > 0 && (
        <Box sx={{ maxWidth: '1200px', mx: 'auto', px: { xs: 0, sm: 2 }, pt: 2 }}>
          <EventBanner
            events={events.filter(e => e.enabled)}
            compact
            onEventClick={handleEventClick}
          />
        </Box>
      )}

      {/* ==================== SEARCH & FILTERS ==================== */}
      <Box sx={{ maxWidth: '1200px', mx: 'auto', px: 2, pt: 3 }}>
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <TextField
            size="small"
            placeholder={lang === 'en' ? 'Search products...' : 'ค้นหาสินค้า...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            fullWidth
            InputProps={{
              startAdornment: <Search size={16} style={{ marginRight: 8, color: 'var(--text-muted)' }} />,
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: '12px',
                bgcolor: 'var(--surface)',
                '& fieldset': { borderColor: 'var(--glass-border)' },
                '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.15)' },
                '&.Mui-focused fieldset': { borderColor: '#0071e3' },
              },
              '& .MuiInputBase-input': { color: 'var(--foreground)', fontSize: '0.85rem' },
            }}
          />
        </Box>

        {/* Category Tabs */}
        {categories.length > 1 && (
          <Box sx={{ mb: 2, overflowX: 'auto', '&::-webkit-scrollbar': { display: 'none' }, scrollbarWidth: 'none' }}>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <Chip
                label={lang === 'en' ? 'All' : 'ทั้งหมด'}
                onClick={() => setSelectedCategory('all')}
                sx={{
                  bgcolor: selectedCategory === 'all' ? '#0071e3' : 'var(--surface)',
                  color: selectedCategory === 'all' ? 'white' : 'var(--foreground)',
                  fontWeight: 600, cursor: 'pointer',
                  border: `1px solid ${selectedCategory === 'all' ? '#0071e3' : 'var(--glass-border)'}`,
                  '&:hover': { opacity: 0.8 },
                }}
              />
              {categories.map((cat) => (
                <Chip
                  key={cat}
                  label={`${getCategoryIcon(cat)} ${getCategoryLabel(cat, lang) || cat}`}
                  onClick={() => setSelectedCategory(cat)}
                  sx={{
                    bgcolor: selectedCategory === cat ? '#0071e3' : 'var(--surface)',
                    color: selectedCategory === cat ? 'white' : 'var(--foreground)',
                    fontWeight: 600, cursor: 'pointer',
                    border: `1px solid ${selectedCategory === cat ? '#0071e3' : 'var(--glass-border)'}`,
                    '&:hover': { opacity: 0.8 },
                  }}
                />
              ))}
            </Box>
          </Box>
        )}

        {/* ==================== PRODUCT GRID ==================== */}
        {loading ? (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(4, 1fr)' }, gap: 2 }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <Box key={i} sx={{ borderRadius: '20px', overflow: 'hidden', bgcolor: 'var(--surface)' }}>
                <Skeleton variant="rectangular" sx={{ aspectRatio: '1/1', bgcolor: 'var(--surface-2)' }} />
                <Box sx={{ p: 2 }}>
                  <Skeleton sx={{ bgcolor: 'var(--surface-2)' }} />
                  <Skeleton width="60%" sx={{ bgcolor: 'var(--surface-2)' }} />
                </Box>
              </Box>
            ))}
          </Box>
        ) : totalFilteredCount === 0 ? (
          <Box sx={{
            py: 8, textAlign: 'center',
            borderRadius: '20px', bgcolor: 'var(--surface)',
            border: '1px solid var(--glass-border)',
          }}>
            <Store size={64} style={{ color: 'var(--text-muted)', marginBottom: 16 }} />
            <Typography variant="h6" sx={{ color: 'var(--text-muted)', mb: 1 }}>
              {searchQuery ? t.product.noProductsSearch : t.product.noProductsYet}
            </Typography>
            {!searchQuery && (
              <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                {t.product.comingSoon}
              </Typography>
            )}
          </Box>
        ) : (
          /* Products grouped by category */
          Object.entries(filteredGroupedProducts).map(([category, items]) => (
            <Box key={category} sx={{ mb: 4 }}>
              {/* Category header */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
                <Box sx={{
                  px: 1.5, py: 0.6, borderRadius: '10px',
                  background: 'linear-gradient(135deg, #0071e3 0%, #0077ED 100%)',
                  display: 'flex', alignItems: 'center', gap: 0.75,
                }}>
                  <Box component="span" sx={{ fontSize: '0.9rem' }}>{getCategoryIcon(category)}</Box>
                  <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: 'white' }}>
                    {(t.category as Record<string, string>)[category] || getCategoryLabel(category, lang) || category}
                  </Typography>
                </Box>
                <Typography sx={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {items.length} {t.common.items}
                </Typography>
                {items.length > 1 && (
                  <Typography sx={{
                    display: { xs: 'flex', sm: 'none' },
                    alignItems: 'center', gap: 0.5,
                    fontSize: '0.7rem', color: 'var(--text-muted)',
                    ml: 'auto',
                  }}>
                    {t.product.scrollMore}
                  </Typography>
                )}
              </Box>

              {/* Product scroll/grid container */}
              <Box sx={{ position: 'relative', overflow: 'hidden', mx: { xs: -2, sm: 0 } }}>
                {/* Right fade hint on mobile */}
                <Box sx={{
                  display: { xs: 'block', sm: 'none' },
                  position: 'absolute', top: 0, right: 0, bottom: 0, width: 32,
                  background: 'linear-gradient(to right, transparent, var(--background))',
                  zIndex: 2, pointerEvents: 'none',
                }} />
                <Box sx={{
                  display: { xs: 'flex', sm: 'grid' },
                  gridTemplateColumns: { sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(4, 1fr)' },
                  gap: 2,
                  overflowX: { xs: 'auto', sm: 'visible' },
                  scrollSnapType: { xs: 'x mandatory', sm: 'none' },
                  WebkitOverflowScrolling: 'touch',
                  '&::-webkit-scrollbar': { display: 'none' },
                  scrollbarWidth: 'none',
                  px: { xs: 2, sm: 0 },
                  pb: { xs: 1, sm: 0 },
                }}>
                  {items.map((product, productIdx) => {
                    const productStatus = getProductStatus(product);
                    const isProductAvailable = productStatus === 'OPEN' && isShopOpen;
                    const isProductClosed = productStatus !== 'OPEN';
                    const eventDiscount = getEventDiscount(product.id, events);

                    return (
                      <Box key={product.id} sx={{
                        minWidth: { xs: '68vw', sm: 0 },
                        maxWidth: { xs: '68vw', sm: 'none' },
                        flex: { xs: '0 0 auto', sm: '1 1 auto' },
                        scrollSnapAlign: { xs: 'start', sm: 'unset' },
                      }}>
                        <Box
                          className={isProductAvailable ? 'product-card-hover' : ''}
                          onClick={() => {
                            if (!isShopOpen) {
                              showToast('warning', t.checkout.shopClosedWarning);
                              return;
                            }
                            if (productStatus !== 'OPEN') {
                              const statusLabelsMap: Record<ShopStatusType, string> = {
                                OPEN: t.shopStatus.open,
                                COMING_SOON: t.shopStatus.comingSoon,
                                ORDER_ENDED: t.shopStatus.closedEnded,
                                TEMPORARILY_CLOSED: t.shopStatus.closed,
                                WAITING_TO_OPEN: t.shopStatus.waitingToOpen,
                              };
                              showToast('info', `${getProductName(product, lang)} - ${statusLabelsMap[productStatus]}`);
                              return;
                            }
                            handleSelectProduct(product);
                          }}
                          sx={{
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            cursor: isProductAvailable ? 'pointer' : 'default',
                            borderRadius: 'var(--card-radius, 20px)',
                            overflow: 'hidden',
                            bgcolor: 'var(--surface)',
                            boxShadow: 'var(--card-shadow, none)',
                            border: isProductClosed ? `1px solid ${SHOP_STATUS_CONFIG[productStatus].borderColor}` : '1px solid transparent',
                            transition: 'all 0.25s ease',
                            position: 'relative',
                            opacity: isProductClosed ? 0.85 : 1,
                            '&:hover': isProductAvailable ? {
                              boxShadow: (theme: any) => theme.palette.mode === 'dark'
                                ? '0 12px 40px rgba(0,0,0,0.45), 0 0 0 1px rgba(0,113,227,0.15)'
                                : '0 8px 30px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,113,227,0.08)',
                            } : {},
                          }}
                        >
                          {/* Product Image — 1:1 aspect ratio */}
                          <Box sx={{
                            position: 'relative',
                            width: '100%',
                            aspectRatio: '1 / 1',
                            bgcolor: 'var(--surface-2)',
                            overflow: 'hidden',
                          }}>
                            {(product.coverImage || product.images?.[0]) ? (
                              <OptimizedImage
                                src={product.coverImage ?? (product.images && product.images[0]) ?? ''}
                                alt={getProductName(product, lang)}
                                width="100%"
                                height="100%"
                                objectFit="cover"
                                priority={productIdx < 4}
                                placeholder="shimmer"
                                showLoadingIndicator={productIdx < 4}
                                style={{
                                  position: 'absolute',
                                  inset: 0,
                                  filter: isProductClosed ? 'grayscale(40%) brightness(0.7)' : 'none',
                                  transition: 'filter 0.3s ease, transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                                }}
                                className={!isProductClosed ? 'product-image-zoom' : ''}
                              />
                            ) : (
                              <Box sx={{
                                position: 'absolute', inset: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: 'var(--text-muted)', fontSize: '0.8rem',
                              }}>
                                {t.common.noImage}
                              </Box>
                            )}

                            {/* Status Overlay for closed products */}
                            {isProductClosed && (
                              <Box sx={{
                                position: 'absolute', inset: 0,
                                display: 'flex', flexDirection: 'column',
                                alignItems: 'center', justifyContent: 'center',
                                background: 'rgba(0,0,0,0.6)',
                                backdropFilter: 'blur(2px)',
                              }}>
                                <Box sx={{
                                  width: 48, height: 48, borderRadius: '14px',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  background: `linear-gradient(135deg, ${SHOP_STATUS_CONFIG[productStatus].color}40 0%, ${SHOP_STATUS_CONFIG[productStatus].color}20 100%)`,
                                  border: `2px solid ${SHOP_STATUS_CONFIG[productStatus].color}`,
                                  color: SHOP_STATUS_CONFIG[productStatus].color,
                                  mb: 1,
                                  boxShadow: `0 0 20px ${SHOP_STATUS_CONFIG[productStatus].color}40`,
                                }}>
                                  {(() => {
                                    const IconComponent = SHOP_STATUS_CONFIG[productStatus].icon;
                                    return <IconComponent size={24} />;
                                  })()}
                                </Box>
                                <Typography sx={{
                                  fontSize: '0.8rem', fontWeight: 800,
                                  color: SHOP_STATUS_CONFIG[productStatus].color,
                                  textAlign: 'center', px: 2,
                                  textShadow: '0 2px 8px rgba(0,0,0,0.5)',
                                }}>
                                  {({
                                    OPEN: t.shopStatus.open,
                                    COMING_SOON: t.shopStatus.comingSoon,
                                    ORDER_ENDED: t.shopStatus.closedEnded,
                                    TEMPORARILY_CLOSED: t.shopStatus.closed,
                                    WAITING_TO_OPEN: t.shopStatus.waitingToOpen,
                                  } as Record<ShopStatusType, string>)[productStatus]}
                                </Typography>
                                {product.startDate && productStatus === 'COMING_SOON' && (
                                  <Typography sx={{ fontSize: '0.65rem', color: 'var(--foreground)', mt: 0.5, textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
                                    {t.product.opensOn} {new Date(product.startDate).toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US')}
                                  </Typography>
                                )}
                              </Box>
                            )}

                            {/* Countdown timer badge */}
                            {!isProductClosed && product.endDate && new Date(product.endDate) > new Date() && (
                              <Box sx={{
                                position: 'absolute', top: 8, left: 8,
                                display: 'flex', flexDirection: 'column', gap: 0.5,
                              }}>
                                <Box sx={{
                                  px: 0.8, py: 0.4, borderRadius: '6px',
                                  bgcolor: 'rgba(239,68,68,0.9)',
                                  fontSize: '0.58rem', fontWeight: 700, color: 'white',
                                  display: 'flex', alignItems: 'center', gap: 0.5,
                                }}>
                                  <Clock size={10} />
                                  {(() => {
                                    const end = new Date(product.endDate!);
                                    const now = new Date();
                                    const diff = end.getTime() - now.getTime();
                                    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                                    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                                    if (days > 0) return `${t.common.remaining} ${days} ${t.common.days}`;
                                    if (hours > 0) return `${t.common.remaining} ${hours} ${t.common.hours}`;
                                    return t.product.closingSoon;
                                  })()}
                                </Box>
                              </Box>
                            )}

                            {/* Price badge */}
                            <Box sx={{
                              position: 'absolute', bottom: 8, right: 8,
                              px: 1.2, py: 0.5, borderRadius: '10px',
                              bgcolor: isProductClosed ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.7)',
                              backdropFilter: 'blur(8px)',
                              display: 'flex', alignItems: 'center', gap: 0.5,
                            }}>
                              {eventDiscount && !isProductClosed ? (
                                <>
                                  <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: '#86868b', textDecoration: 'line-through' }}>
                                    ฿{product.basePrice.toLocaleString()}
                                  </Typography>
                                  <Typography sx={{ fontSize: '0.9rem', fontWeight: 800, color: '#ff453a' }}>
                                    ฿{eventDiscount.discountedPrice(product.basePrice).toLocaleString()}
                                  </Typography>
                                </>
                              ) : (
                                <Typography sx={{
                                  fontSize: '0.9rem', fontWeight: 800,
                                  color: isProductClosed ? 'var(--text-muted)' : '#34c759',
                                }}>
                                  ฿{product.basePrice.toLocaleString()}
                                  {product.sizePricing && Object.keys(product.sizePricing).length > 0 && (
                                    <Typography component="span" sx={{ fontSize: '0.6rem', color: 'var(--text-muted)', ml: 0.3 }}>+</Typography>
                                  )}
                                </Typography>
                              )}
                            </Box>

                            {/* Event discount badge */}
                            {eventDiscount && !isProductClosed && (
                              <Box sx={{
                                position: 'absolute', top: 8, right: 8,
                                px: 0.8, py: 0.4, borderRadius: '8px',
                                bgcolor: 'rgba(255,69,58,0.9)',
                                fontSize: '0.6rem', fontWeight: 800, color: 'white',
                                display: 'flex', alignItems: 'center', gap: 0.3,
                                backdropFilter: 'blur(4px)',
                              }}>
                                <Tag size={10} />
                                {eventDiscount.discountLabel}
                              </Box>
                            )}

                            {/* Action buttons */}
                            <Box sx={{
                              position: 'absolute', bottom: 8, left: 8,
                              display: 'flex', alignItems: 'center', gap: 1,
                            }}>
                              <IconButton
                                size="small"
                                onClick={(e) => { e.stopPropagation(); handleShareProduct(product); }}
                                sx={{
                                  bgcolor: 'rgba(0,0,0,0.5)',
                                  backdropFilter: 'blur(8px)',
                                  color: 'white', width: 30, height: 30,
                                  '&:hover': { bgcolor: 'rgba(0,113,227,0.7)' },
                                }}
                              >
                                <Share2 size={14} />
                              </IconButton>
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const wasInWishlist = wishlistStore.items.includes(product.id);
                                  wishlistStore.toggleItem(product.id);
                                  showToast(
                                    wasInWishlist ? 'info' : 'success',
                                    wasInWishlist ? t.wishlist.removedFromWishlist : t.wishlist.addedToWishlist
                                  );
                                }}
                                sx={{
                                  bgcolor: 'rgba(0,0,0,0.5)',
                                  backdropFilter: 'blur(8px)',
                                  color: wishlistStore.isInWishlist(product.id) ? '#ff453a' : 'white',
                                  width: 30, height: 30,
                                  '&:hover': { bgcolor: 'rgba(255,69,58,0.7)' },
                                  transition: 'all 0.2s ease',
                                }}
                              >
                                <Heart size={14} fill={wishlistStore.isInWishlist(product.id) ? '#ff453a' : 'none'} />
                              </IconButton>
                            </Box>
                          </Box>

                          {/* Product Info */}
                          <Box sx={{ p: 2, flex: 1, display: 'flex', flexDirection: 'column' }}>
                            <Typography sx={{
                              fontSize: '0.95rem', fontWeight: 700,
                              color: isProductClosed ? 'var(--text-muted)' : 'var(--foreground)',
                              mb: 0.5,
                              overflow: 'hidden', textOverflow: 'ellipsis',
                              display: '-webkit-box',
                              WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                              lineHeight: 1.3,
                            }}>
                              {getProductName(product, lang)}
                            </Typography>

                            <Typography sx={{
                              fontSize: '0.75rem', color: 'var(--text-muted)',
                              overflow: 'hidden', textOverflow: 'ellipsis',
                              display: '-webkit-box',
                              WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                              lineHeight: 1.4, mb: 1,
                            }}>
                              {getProductDescription(product, lang) || product.type || ''}
                            </Typography>

                            {/* Tags */}
                            {(() => {
                              const tags = product.customTags && product.customTags.length > 0
                                ? product.customTags
                                : [
                                    ...(product.endDate && new Date(product.endDate) > new Date() ? [{
                                      text: `${t.product.until} ${new Date(product.endDate).toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US', { day: 'numeric', month: 'short' })}`,
                                      color: 'var(--error)',
                                      bgColor: 'rgba(239,68,68,0.15)',
                                      borderColor: 'rgba(239,68,68,0.3)',
                                      icon: 'clock',
                                    }] : []),
                                    ...(product.options?.hasCustomName ? [{
                                      text: t.product.customNameAvailable,
                                      color: 'var(--success)',
                                      bgColor: 'rgba(16,185,129,0.15)',
                                      borderColor: 'rgba(16,185,129,0.3)',
                                    }] : []),
                                    ...(product.options?.hasCustomNumber ? [{
                                      text: t.product.customNumberAvailable,
                                      color: 'var(--secondary)',
                                      bgColor: 'rgba(0,113,227,0.15)',
                                      borderColor: 'rgba(0,113,227,0.3)',
                                    }] : []),
                                  ];
                              if (tags.length === 0) return null;
                              return (
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                                  {tags.map((tag, idx) => (
                                    <Box key={idx} sx={{
                                      px: 0.8, py: 0.2, borderRadius: '6px',
                                      bgcolor: (tag as any).bgColor || `${tag.color}20`,
                                      border: `1px solid ${(tag as any).borderColor || `${tag.color}40`}`,
                                      fontSize: '0.6rem', fontWeight: 600, color: tag.color,
                                      display: 'flex', alignItems: 'center', gap: 0.3,
                                    }}>
                                      {(tag as any).icon === 'clock' && <Clock size={10} />}
                                      {lang === 'en'
                                        ? ((tag as any).textEn || TAG_TRANSLATIONS_TH_TO_EN[tag.text] || tag.text)
                                        : tag.text}
                                    </Box>
                                  ))}
                                </Box>
                              );
                            })()}

                            {/* CTA Button / Status */}
                            <Box sx={{ mt: 'auto' }}>
                              {!isProductClosed ? (
                                <Button
                                  fullWidth
                                  className={isProductAvailable ? 'shimmer-btn' : ''}
                                  disabled={!isProductAvailable}
                                  size="small"
                                  sx={{
                                    py: 0.7,
                                    px: 2,
                                    borderRadius: '10px',
                                    bgcolor: isProductAvailable ? 'var(--primary)' : 'var(--surface-3)',
                                    color: isProductAvailable ? 'white' : 'var(--text-muted)',
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    textTransform: 'none',
                                    boxShadow: isProductAvailable ? '0 3px 10px rgba(0,113,227,0.25)' : 'none',
                                    '&:hover': {
                                      bgcolor: isProductAvailable ? 'var(--primary)' : 'var(--surface-3)',
                                      filter: isProductAvailable ? 'brightness(1.1)' : 'none',
                                      boxShadow: isProductAvailable ? '0 5px 16px rgba(0,113,227,0.35)' : 'none',
                                    },
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {isShopOpen ? t.product.viewDetail : t.product.shopClosedTemp}
                                </Button>
                              ) : (
                                <Box sx={{
                                  py: 0.8, px: 1.5, borderRadius: '10px',
                                  background: SHOP_STATUS_CONFIG[productStatus].bgGradient,
                                  border: `1px solid ${SHOP_STATUS_CONFIG[productStatus].borderColor}`,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.75,
                                }}>
                                  {(() => {
                                    const IconComponent = SHOP_STATUS_CONFIG[productStatus].icon;
                                    return <IconComponent size={14} color={SHOP_STATUS_CONFIG[productStatus].color} />;
                                  })()}
                                  <Typography sx={{
                                    fontSize: '0.75rem', fontWeight: 700,
                                    color: SHOP_STATUS_CONFIG[productStatus].color,
                                  }}>
                                    {({
                                      OPEN: t.shopStatus.open,
                                      COMING_SOON: t.shopStatus.comingSoon,
                                      ORDER_ENDED: t.shopStatus.closedEnded,
                                      TEMPORARILY_CLOSED: t.shopStatus.closed,
                                      WAITING_TO_OPEN: t.shopStatus.waitingToOpen,
                                    } as Record<ShopStatusType, string>)[productStatus]}
                                  </Typography>
                                </Box>
                              )}
                            </Box>
                          </Box>
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            </Box>
          ))
        )}

        <Box sx={{ pb: 4 }} />
      </Box>

      {/* ==================== PRODUCT DETAIL DRAWER ==================== */}
      <Drawer
        anchor={isMobile ? "bottom" : "right"}
        open={!!selectedProduct}
        onClose={() => { setSelectedProduct(null); setSelectedSize(''); setSelectedPattern(null); setQuantity(1); setActiveImageIndex(0); setIsLongSleeve(null); setCustomName(''); setCustomNumber(''); }}
        PaperProps={{
          sx: {
            width: '100%',
            maxWidth: isMobile ? 'none' : '100%',
            height: isMobile ? '95vh' : '100%',
            maxHeight: isMobile ? '95vh' : '100%',
            borderTopLeftRadius: isMobile ? 28 : 0,
            borderTopRightRadius: isMobile ? 28 : 0,
            bgcolor: 'var(--background)',
            color: 'var(--foreground)',
            overflow: 'hidden',
            boxShadow: (theme: any) => theme.palette.mode === 'dark' 
              ? (isMobile ? '0 -10px 60px rgba(0,0,0,0.5), 0 -4px 20px rgba(0,113,227,0.15)' : '-10px 0 60px rgba(0,0,0,0.5), -4px 0 20px rgba(0,113,227,0.15)') 
              : (isMobile ? '0 -10px 60px rgba(0,0,0,0.1), 0 -4px 20px rgba(0,113,227,0.08)' : '-10px 0 60px rgba(0,0,0,0.1), -4px 0 20px rgba(0,113,227,0.08)'),
          },
        }}
        transitionDuration={{ enter: isMobile ? 350 : 300, exit: isMobile ? 250 : 200 }}
        sx={{ zIndex: 8000 }}
      >
        {selectedProduct && (() => {
          const currentUnitPrice = resolveProductUnitPrice(selectedProduct, selectedSize, isLongSleeve);

          const bottomActionsNode = (
            <Box sx={{
              px: { xs: 3, md: 0 },
              pb: { xs: 2.5, md: 0 },
              pt: { xs: 2, md: 0 },
              borderTop: { xs: '1px solid var(--glass-border)', md: 'none' },
              bgcolor: { xs: 'var(--background)', md: 'transparent' },
              opacity: needsPatternFirst ? 0.5 : 1,
              pointerEvents: needsPatternFirst ? 'none' : 'auto',
              transition: 'all 0.3s ease',
            }}>
              <Box sx={{ display: 'flex', gap: 1.2 }}>
                <Button
                  onClick={handleAddToCart}
                  disabled={!isShopOpen}
                  startIcon={<ShoppingCart size={18} />}
                  sx={{
                    flex: 1,
                    py: 1.4,
                    borderRadius: '14px',
                    border: '1px solid var(--glass-border)',
                    bgcolor: 'var(--surface)',
                    color: isShopOpen ? 'var(--foreground)' : 'var(--text-muted)',
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    textTransform: 'none',
                    boxShadow: 'none',
                    '&:hover': {
                      bgcolor: isShopOpen ? 'var(--surface-2)' : 'var(--surface)',
                      transform: isShopOpen ? 'scale(0.98)' : 'none',
                    },
                    '&.Mui-disabled': { color: 'var(--text-muted)' },
                  }}
                >
                  {t.product.addToCart}
                  <Box component="span" sx={{ ml: 0.5, opacity: 0.85, fontSize: '0.82rem' }}>
                    ฿{(currentUnitPrice * quantity).toLocaleString()}
                  </Box>
                </Button>
                <Button
                  onClick={handleBuyNow}
                  disabled={!isShopOpen}
                  startIcon={<Zap size={18} />}
                  sx={{
                    flex: 1.3,
                    py: 1.4,
                    borderRadius: '14px',
                    bgcolor: isShopOpen ? 'var(--primary)' : 'var(--surface-2)',
                    color: isShopOpen ? 'white' : 'var(--text-muted)',
                    fontSize: '0.95rem',
                    fontWeight: 800,
                    textTransform: 'none',
                    boxShadow: 'none',
                    '&:hover': {
                      bgcolor: isShopOpen ? '#0062cc' : 'var(--surface-2)',
                      transform: isShopOpen ? 'scale(0.98)' : 'none',
                    },
                    '&.Mui-disabled': { bgcolor: 'var(--surface-2)', color: 'var(--text-muted)' },
                  }}
                >
                  {t.product.buyNow}
                </Button>
              </Box>
            </Box>
          );

          return (
            <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'var(--background)', color: 'var(--foreground)' }}>
              {/* Sticky Header */}
              <Box sx={{
                position: 'sticky',
                top: 0,
                zIndex: 10,
                borderBottom: '1px solid var(--glass-border)',
                bgcolor: 'var(--background)',
              }}>
                <Box sx={{
                  maxWidth: 1200,
                  mx: 'auto',
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  px: 3,
                  py: 2,
                }}>
                  <Typography sx={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--foreground)' }}>
                    {lang === 'en' ? 'Product Details' : 'รายละเอียดสินค้า'}
                  </Typography>
                  <IconButton
                    onClick={() => { setSelectedProduct(null); setSelectedSize(''); setSelectedPattern(null); setQuantity(1); }}
                    sx={{
                      bgcolor: 'var(--surface-2)',
                      color: 'var(--foreground)',
                      '&:hover': { bgcolor: 'var(--surface-3)' },
                    }}
                  >
                    <X size={18} />
                  </IconButton>
                </Box>
              </Box>

              {/* Content body split layout */}
              <Box sx={{
                flex: 1,
                overflow: 'auto',
                WebkitOverflowScrolling: 'touch',
              }}>
                <Box sx={{
                  maxWidth: 1200,
                  mx: 'auto',
                  width: '100%',
                  px: 3,
                  py: 2.5,
                  display: 'flex',
                  flexDirection: { xs: 'column', md: 'row' },
                  gap: { xs: 3, md: 4 },
                }}>
                  {/* Left Column - Pinned on desktop to keep preview and details visible */}
                  <Box sx={{ 
                    flex: 1.2, 
                    minWidth: 0, 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: 2.5,
                    position: { md: 'sticky' },
                    top: { md: 20 },
                    alignSelf: { md: 'flex-start' },
                    maxHeight: { md: 'calc(100vh - 100px)' },
                    overflowY: { md: 'auto' },
                    '&::-webkit-scrollbar': { display: 'none' },
                    msOverflowStyle: 'none',
                    scrollbarWidth: 'none',
                  }}>
                    {productImages.length > 0 && (
                      <Box sx={{ 
                        position: 'relative', 
                        width: '100%', 
                        aspectRatio: '4/3', 
                        overflow: 'hidden',
                        borderRadius: '16px',
                        border: '1px solid var(--glass-border)',
                        bgcolor: 'var(--surface-2)',
                      }}>
                        {/* Image Scroll container */}
                        <Box
                          ref={imageScrollRef}
                          onScroll={handleImageScroll}
                          sx={{
                            display: 'flex',
                            width: '100%',
                            height: '100%',
                            overflowX: 'auto',
                            scrollSnapType: 'x mandatory',
                            WebkitOverflowScrolling: 'touch',
                            '&::-webkit-scrollbar': { display: 'none' },
                            scrollbarWidth: 'none',
                          }}
                        >
                          {productImages.map((img, idx) => (
                            <Box
                              key={idx}
                              onClick={() => {
                                setLightboxIndex(idx);
                                setLightboxOpen(true);
                              }}
                              sx={{
                                minWidth: '100%',
                                height: '100%',
                                scrollSnapAlign: 'start',
                                position: 'relative',
                                cursor: 'pointer',
                              }}
                            >
                              {isGalleryImageInRange(idx, activeImageIndex) ? (
                                <OptimizedImage
                                  src={img}
                                  alt={`${getProductName(selectedProduct, lang)} - ${idx + 1}`}
                                  width="100%"
                                  height="100%"
                                  objectFit="cover"
                                  priority={idx === activeImageIndex}
                                  disableFade={idx !== activeImageIndex}
                                  placeholder={idx === activeImageIndex ? 'shimmer' : 'none'}
                                />
                              ) : (
                                <Box sx={{ width: '100%', height: '100%', bgcolor: 'var(--surface-2)' }} />
                              )}
                            </Box>
                          ))}
                        </Box>

                        {/* Navigation Chevrons */}
                        {productImages.length > 1 && (
                          <>
                            <IconButton
                              onClick={(e) => {
                                e.stopPropagation();
                                scrollToImage(activeImageIndex - 1);
                              }}
                              sx={{
                                position: 'absolute',
                                left: 10,
                                top: '50%',
                                transform: 'translateY(-50%)',
                                bgcolor: 'rgba(0,0,0,0.5)',
                                color: 'white',
                                width: 32,
                                height: 32,
                                '&:hover': { bgcolor: 'rgba(0,0,0,0.7)', transform: 'translateY(-50%) scale(1.05)' },
                                transition: 'all 0.2s ease',
                                zIndex: 5,
                              }}
                              size="small"
                            >
                              <ChevronLeft size={18} />
                            </IconButton>
                            <IconButton
                              onClick={(e) => {
                                e.stopPropagation();
                                scrollToImage(activeImageIndex + 1);
                              }}
                              sx={{
                                position: 'absolute',
                                right: 10,
                                top: '50%',
                                transform: 'translateY(-50%)',
                                bgcolor: 'rgba(0,0,0,0.5)',
                                color: 'white',
                                width: 32,
                                height: 32,
                                '&:hover': { bgcolor: 'rgba(0,0,0,0.7)', transform: 'translateY(-50%) scale(1.05)' },
                                transition: 'all 0.2s ease',
                                zIndex: 5,
                              }}
                              size="small"
                            >
                              <ChevronRight size={18} />
                            </IconButton>
                          </>
                        )}

                        {/* Dot indicators */}
                        {productImages.length > 1 && (
                          <Box sx={{
                            position: 'absolute',
                            bottom: 12,
                            left: '50%',
                            transform: 'translateX(-50%)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.75,
                            zIndex: 5,
                          }}>
                            {productImages.map((_, idx) => {
                              const active = activeImageIndex === idx;
                              return (
                                <Box
                                  key={idx}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    scrollToImage(idx);
                                  }}
                                  sx={{
                                    cursor: 'pointer',
                                    width: active ? 8 : 6,
                                    height: active ? 8 : 6,
                                    borderRadius: '50%',
                                    bgcolor: active ? '#0071e3' : 'rgba(255, 255, 255, 0.45)',
                                    transition: 'background-color 0.2s ease',
                                    flexShrink: 0,
                                    '&:hover': {
                                      bgcolor: active ? '#0071e3' : 'rgba(255, 255, 255, 0.75)',
                                    },
                                  }}
                                />
                              );
                            })}
                          </Box>
                        )}

                        {/* Price Badge */}
                        <Box sx={{
                          position: 'absolute', bottom: 12, right: 12,
                          px: 1.5, py: 0.6, borderRadius: '12px',
                          bgcolor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
                          zIndex: 5,
                        }}>
                          <Typography sx={{ fontSize: '1.2rem', fontWeight: 800, color: '#34c759' }}>
                            ฿{currentUnitPrice.toLocaleString()}
                          </Typography>
                        </Box>
                      </Box>
                    )}

                    <Box>
                      <Typography sx={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--foreground)' }}>
                        {getProductName(selectedProduct, lang)}
                      </Typography>
                      {getProductDescription(selectedProduct, lang) && (
                        <Typography sx={{ fontSize: '0.85rem', color: 'var(--text-muted)', mt: 1.5, whiteSpace: 'pre-line', lineHeight: 1.6 }}>
                          {getProductDescription(selectedProduct, lang)}
                        </Typography>
                      )}
                    </Box>
                  </Box>

                  {/* Right Column */}
                  <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                    {/* Pattern Selection */}
                    {selectedProduct.patterns && selectedProduct.patterns.filter((p: any) => p.isActive !== false).length > 0 && (
                      <Box
                        ref={patternSelectorRef}
                        sx={{
                          p: 2,
                          borderRadius: '16px',
                          background: 'linear-gradient(135deg, rgba(56,189,248,0.15) 0%, rgba(56,189,248,0.05) 100%)',
                          border: '1px solid rgba(56,189,248,0.3)',
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                          <Box sx={{
                            width: 32,
                            height: 32,
                            borderRadius: '8px',
                            bgcolor: 'rgba(56,189,248,0.2)',
                            display: 'grid',
                            placeItems: 'center',
                          }}>
                            <Palette size={16} color="#38bdf8" />
                          </Box>
                          <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--foreground)', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                            <span>{lang === 'en' ? 'Select Design/Pattern' : 'เลือกลายสินค้า'}</span>
                            {needsPatternFirst && (
                              <Box component="span" sx={{ fontSize: '0.72rem', color: '#ff453a', fontWeight: 600, animation: 'pulse 1.5s infinite' }}>
                                ({lang === 'en' ? 'Please select a design first' : 'กรุณาเลือกลายสินค้าก่อน'})
                              </Box>
                            )}
                          </Typography>
                        </Box>

                        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 1.2 }}>
                          {selectedProduct.patterns
                            .filter((p: any) => p.isActive !== false)
                            .map((pattern: any) => {
                              const active = selectedPattern?.id === pattern.id;
                              return (
                                <Box
                                  key={pattern.id}
                                  onClick={() => setSelectedPattern(pattern)}
                                  sx={{
                                    p: 0.8,
                                    borderRadius: '10px',
                                    border: active ? '2px solid #38bdf8' : '1px solid var(--glass-border)',
                                    bgcolor: active ? 'rgba(56,189,248,0.08)' : 'var(--surface-2)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: 0.5,
                                    '&:hover': { opacity: 0.9, borderColor: '#38bdf8' },
                                    transition: 'all 0.2s ease',
                                    position: 'relative',
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
                                      <ImageOutlinedIcon size={18} style={{ color: 'var(--text-muted)' }} />
                                    )}
                                  </Box>
                                  <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: active ? 'var(--secondary)' : 'var(--foreground)', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
                                    {pattern.name}
                                  </Typography>
                                </Box>
                              );
                            })}
                        </Box>
                      </Box>
                    )}

                    <Box sx={{
                      opacity: needsPatternFirst ? 0.45 : 1,
                      pointerEvents: needsPatternFirst ? 'none' : 'auto',
                      transition: 'all 0.3s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2.5,
                    }}>
                      {/* Size Chart & Selection — same as main shop */}
                      {productRequiresSize(selectedProduct) && (
                        <Box sx={{
                          p: { xs: 2.5, sm: 3 },
                          borderRadius: '20px',
                          background: (theme: any) => theme.palette.mode === 'dark'
                            ? 'linear-gradient(135deg, rgba(29,29,31,0.6) 0%, rgba(29,29,31,0.3) 100%)'
                            : 'linear-gradient(135deg, rgba(255,255,255,0.8) 0%, rgba(245,245,247,0.6) 100%)',
                          border: '1px solid var(--glass-border)',
                          boxShadow: (theme: any) => theme.palette.mode === 'dark'
                            ? 'inset 0 1px 0 rgba(255,255,255,0.05)'
                            : 'inset 0 1px 0 rgba(255,255,255,0.8)',
                        }}>
                          <Box ref={sizeSelectorRef} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                            <Box sx={{
                              width: 36, height: 36, borderRadius: '10px',
                              bgcolor: 'rgba(0,113,227,0.15)',
                              display: 'grid', placeItems: 'center',
                            }}>
                              <Ruler size={18} color="#2997ff" />
                            </Box>
                            <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--foreground)' }}>
                              {t.product.sizeChart} & {t.product.selectSize}
                            </Typography>
                          </Box>

                          <Box sx={{ borderRadius: '16px', bgcolor: 'var(--surface)', border: '1px solid var(--glass-border)', overflow: 'hidden' }}>
                            <Box sx={{
                              display: 'grid', gridTemplateColumns: '1.2fr 1fr 1.2fr 1fr',
                              p: 1.5, bgcolor: 'rgba(0,113,227,0.08)',
                              borderBottom: '1px solid var(--glass-border)', textAlign: 'center',
                            }}>
                              <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--primary)', textAlign: 'left', pl: 2 }}>
                                {lang === 'en' ? 'Size' : 'ขนาดไซส์'}
                              </Typography>
                              <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--primary)' }}>
                                {lang === 'en' ? 'Chest (in)' : 'รอบอก (นิ้ว)'}
                              </Typography>
                              <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--primary)' }}>
                                {lang === 'en' ? 'Length (in)' : 'ความยาว (นิ้ว)'}
                              </Typography>
                              <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--primary)', pr: 1 }}>
                                {lang === 'en' ? 'Price' : 'ราคา'}
                              </Typography>
                            </Box>

                            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                              {displaySizes.map((size) => {
                                const sizeKey = size as keyof typeof SIZE_MEASUREMENTS;
                                const measurement = SIZE_MEASUREMENTS[sizeKey];
                                const isSelected = selectedSize === size;
                                const rowPrice = resolveProductUnitPrice(selectedProduct, size, isLongSleeve);
                                return (
                                  <Box
                                    key={size}
                                    onClick={() => setSelectedSize(size)}
                                    sx={{
                                      display: 'grid', gridTemplateColumns: '1.2fr 1fr 1.2fr 1fr',
                                      p: 1.5, alignItems: 'center', textAlign: 'center',
                                      cursor: 'pointer',
                                      bgcolor: isSelected ? 'rgba(0,113,227,0.08)' : 'transparent',
                                      borderBottom: '1px solid var(--glass-border)',
                                      '&:last-child': { borderBottom: 'none' },
                                      position: 'relative', transition: 'all 0.2s ease',
                                      '&:hover': { bgcolor: isSelected ? 'rgba(0,113,227,0.12)' : 'var(--surface-2)' },
                                    }}
                                  >
                                    {isSelected && (
                                      <Box sx={{
                                        position: 'absolute', left: 0, top: 0, bottom: 0, width: 4,
                                        bgcolor: 'var(--primary)', borderRadius: '0 4px 4px 0',
                                      }} />
                                    )}
                                    <Typography sx={{
                                      fontSize: '0.85rem', fontWeight: 700,
                                      color: isSelected ? 'var(--primary)' : 'var(--foreground)',
                                      textAlign: 'left', pl: 2,
                                    }}>
                                      {size}
                                    </Typography>
                                    <Typography sx={{
                                      fontSize: '0.82rem', fontWeight: isSelected ? 600 : 500,
                                      color: isSelected ? 'var(--foreground)' : 'var(--text-muted)',
                                    }}>
                                      {measurement?.chest ? `${measurement.chest}"` : '-'}
                                    </Typography>
                                    <Typography sx={{
                                      fontSize: '0.82rem', fontWeight: isSelected ? 600 : 500,
                                      color: isSelected ? 'var(--foreground)' : 'var(--text-muted)',
                                    }}>
                                      {measurement?.length ? `${measurement.length}"` : '-'}
                                    </Typography>
                                    <Typography sx={{
                                      fontSize: '0.82rem', fontWeight: 700,
                                      color: isSelected ? 'var(--success)' : 'var(--foreground)', pr: 1,
                                    }}>
                                      ฿{rowPrice.toLocaleString()}
                                    </Typography>
                                  </Box>
                                );
                              })}
                            </Box>
                          </Box>
                        </Box>
                      )}

                      {/* Variant Selection — non-apparel products */}
                      {!productRequiresSize(selectedProduct) && selectedProduct.variants && selectedProduct.variants.length > 0 && (
                        <Box sx={{
                          p: { xs: 2.5, sm: 3 },
                          borderRadius: '20px',
                          background: 'linear-gradient(135deg, rgba(0,113,227,0.15) 0%, rgba(0,113,227,0.05) 100%)',
                          border: '1px solid rgba(0,113,227,0.3)',
                        }}>
                          <Box ref={sizeSelectorRef} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                            <Box sx={{
                              width: 36, height: 36, borderRadius: '10px',
                              bgcolor: 'rgba(0,113,227,0.2)',
                              display: 'grid', placeItems: 'center',
                            }}>
                              <Tag size={18} color="#2997ff" />
                            </Box>
                            <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--secondary)' }}>
                              {t.product.selectOption}
                            </Typography>
                          </Box>

                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {selectedProduct.variants
                              .filter((v) => v.isActive !== false)
                              .map((variant) => {
                                const active = selectedSize === variant.id;
                                const isOutOfStock = variant.stock !== null && variant.stock !== undefined && variant.stock <= 0;
                                return (
                                  <Box
                                    key={variant.id}
                                    onClick={() => { if (!isOutOfStock) setSelectedSize(variant.id); }}
                                    sx={{
                                      px: 2, py: 1.5, borderRadius: '12px',
                                      border: active ? '2px solid var(--primary)' : '1px solid var(--glass-border)',
                                      bgcolor: active ? 'rgba(0,122,255,0.08)' : isOutOfStock ? 'var(--surface)' : 'var(--surface-2)',
                                      cursor: isOutOfStock ? 'not-allowed' : 'pointer',
                                      opacity: isOutOfStock ? 0.5 : 1,
                                      transition: 'all 0.2s ease',
                                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                                      minWidth: 90, position: 'relative',
                                      '&:hover': !isOutOfStock ? {
                                        borderColor: active ? '#0077ED' : 'rgba(0,113,227,0.5)',
                                        bgcolor: active ? 'rgba(0,113,227,0.2)' : 'rgba(0,113,227,0.08)',
                                      } : {},
                                    }}
                                  >
                                    {isOutOfStock && (
                                      <Box sx={{
                                        position: 'absolute', top: -8, right: -8,
                                        px: 0.8, py: 0.2, bgcolor: '#ff453a',
                                        borderRadius: '6px', fontSize: '0.6rem', fontWeight: 700, color: 'white',
                                      }}>
                                        {t.common.outOfStock}
                                      </Box>
                                    )}
                                    <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, color: active ? 'var(--secondary)' : 'var(--foreground)' }}>
                                      {variant.name}
                                    </Typography>
                                    <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: active ? 'var(--secondary)' : 'var(--text-muted)' }}>
                                      ฿{(variant.price || selectedProduct.basePrice).toLocaleString()}
                                    </Typography>
                                    {variant.stock !== null && variant.stock !== undefined && variant.stock > 0 && (
                                      <Typography sx={{ fontSize: '0.6rem', color: 'var(--text-muted)', mt: 0.3 }}>
                                        {t.common.remaining} {variant.stock}
                                      </Typography>
                                    )}
                                  </Box>
                                );
                              })}
                          </Box>
                        </Box>
                      )}

                      {/* Additional Options */}
                      {(selectedProduct.options?.hasCustomName || selectedProduct.options?.hasCustomNumber || selectedProduct.options?.hasLongSleeve) && (
                        <Box sx={{
                          p: { xs: 2, sm: 2.5 },
                          borderRadius: '18px',
                          bgcolor: 'var(--surface-2)',
                          border: '1px solid var(--glass-border)',
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
                              <Tag size={18} color="#30d158" />
                            </Box>
                            <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--foreground)' }}>
                              {lang === 'en' ? 'Additional Options' : 'ตัวเลือกเพิ่มเติม'}
                            </Typography>
                          </Box>

                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {selectedProduct.options?.hasCustomName && (() => {
                              const sc = shirtCfg;
                              const langs: string[] = [];
                              if (sc.allowThai) langs.push(lang === 'en' ? 'Thai' : 'ภาษาไทย');
                              if (sc.allowEnglish) langs.push(lang === 'en' ? 'English' : 'ภาษาอังกฤษ');
                              const langLabel = langs.join('/');
                              const label = `${lang === 'en' ? 'Screen Name' : 'ชื่อสกรีน'} (${langLabel}, ${sc.minLength}-${sc.maxLength} ${lang === 'en' ? 'chars' : 'ตัวอักษร'})`;
                              return (
                                <TextField
                                  label={label}
                                  fullWidth
                                  value={customName}
                                  onChange={(e) => setCustomName(normalizeShirtName(e.target.value, sc))}
                                  inputProps={{ maxLength: sc.maxLength }}
                                  inputRef={customNameInputRef}
                                  placeholder={sc.allowThai ? (lang === 'en' ? 'Example: SOMCHAI' : 'ตัวอย่าง: SOMCHAI') : 'SOMCHAI'}
                                  helperText={`${customName.length}/${sc.maxLength}`}
                                  sx={{ 
                                    '& .MuiOutlinedInput-root': { 
                                      color: 'var(--foreground)',
                                      borderRadius: '12px',
                                      '& fieldset': { borderColor: 'var(--glass-border)' },
                                      '&:hover fieldset': { borderColor: 'rgba(0,113,227,0.5)' },
                                      '&.Mui-focused fieldset': { borderColor: '#0071e3' },
                                    }, 
                                    '& label': { color: 'var(--text-muted)' },
                                    '& label.Mui-focused': { color: 'var(--secondary)' },
                                  }}
                                />
                              );
                            })()}

                            {selectedProduct.options?.hasCustomNumber && (
                              <TextField
                                label={lang === 'en' ? 'Screen Number (0-99)' : 'เบอร์สกรีน (0-99)'}
                                fullWidth
                                value={customNumber}
                                onChange={(e) => setCustomNumber(normalizeDigits99(e.target.value))}
                                inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }}
                                inputRef={customNumberInputRef}
                                placeholder="99"
                                sx={{ 
                                  '& .MuiOutlinedInput-root': { 
                                    color: 'var(--foreground)',
                                    borderRadius: '12px',
                                    '& fieldset': { borderColor: 'var(--glass-border)' },
                                    '&:hover fieldset': { borderColor: 'rgba(0,113,227,0.5)' },
                                    '&.Mui-focused fieldset': { borderColor: '#0071e3' },
                                  }, 
                                  '& label': { color: 'var(--text-muted)' },
                                  '& label.Mui-focused': { color: 'var(--secondary)' },
                                }}
                              />
                            )}

                            {selectedProduct.options?.hasLongSleeve && (() => {
                              const sleevePrice = selectedProduct.options?.longSleevePrice ?? 50;
                              return (
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                                  <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--foreground)' }}>
                                    {lang === 'en' ? 'Sleeve Type' : 'ประเภทแขนเสื้อ'}
                                  </Typography>
                                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                                    {/* Short Sleeve Card */}
                                    <Box
                                      onClick={() => setIsLongSleeve(false)}
                                      sx={{
                                        p: 2.2,
                                        borderRadius: '16px',
                                        border: isLongSleeve === false ? '2px solid #ff9f0a' : '1px solid var(--glass-border)',
                                        bgcolor: isLongSleeve === false ? 'rgba(255,159,10,0.08)' : 'var(--glass-bg)',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        position: 'relative',
                                        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                                        boxShadow: isLongSleeve === false ? '0 8px 20px rgba(255,159,10,0.15)' : 'none',
                                        '&:hover': {
                                          borderColor: '#ff9f0a',
                                          bgcolor: 'rgba(255,159,10,0.04)',
                                          transform: 'translateY(-2px)',
                                        },
                                      }}
                                    >
                                      {isLongSleeve === false && (
                                        <Box sx={{
                                          position: 'absolute',
                                          top: 8,
                                          right: 8,
                                          color: '#ff9f0a',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                        }}>
                                          <CheckCircle2 size={16} fill="rgba(255,159,10,0.2)" />
                                        </Box>
                                      )}
                                      <Typography sx={{ fontSize: '0.92rem', fontWeight: 800, color: isLongSleeve === false ? '#ff9f0a' : 'var(--foreground)' }}>
                                        {lang === 'en' ? 'Short Sleeve (แขนสั้น)' : 'แขนสั้น (Short Sleeve)'}
                                      </Typography>
                                      <Typography sx={{ fontSize: '0.78rem', color: 'var(--text-muted)', mt: 0.5, fontWeight: 600 }}>
                                        +฿0
                                      </Typography>
                                    </Box>

                                    {/* Long Sleeve Card */}
                                    <Box
                                      onClick={() => setIsLongSleeve(true)}
                                      sx={{
                                        p: 2.2,
                                        borderRadius: '16px',
                                        border: isLongSleeve === true ? '2px solid #ff9f0a' : '1px solid var(--glass-border)',
                                        bgcolor: isLongSleeve === true ? 'rgba(255,159,10,0.08)' : 'var(--glass-bg)',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        position: 'relative',
                                        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                                        boxShadow: isLongSleeve === true ? '0 8px 20px rgba(255,159,10,0.15)' : 'none',
                                        '&:hover': {
                                          borderColor: '#ff9f0a',
                                          bgcolor: 'rgba(255,159,10,0.04)',
                                          transform: 'translateY(-2px)',
                                        },
                                      }}
                                    >
                                      {isLongSleeve === true && (
                                        <Box sx={{
                                          position: 'absolute',
                                          top: 8,
                                          right: 8,
                                          color: '#ff9f0a',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                        }}>
                                          <CheckCircle2 size={16} fill="rgba(255,159,10,0.2)" />
                                        </Box>
                                      )}
                                      <Typography sx={{ fontSize: '0.92rem', fontWeight: 800, color: isLongSleeve === true ? '#ff9f0a' : 'var(--foreground)' }}>
                                        {lang === 'en' ? 'Long Sleeve (แขนยาว)' : 'แขนยาว (Long Sleeve)'}
                                      </Typography>
                                      <Typography sx={{ fontSize: '0.78rem', color: isLongSleeve === true ? '#ff9f0a' : 'var(--text-muted)', mt: 0.5, fontWeight: 700 }}>
                                        +฿{sleevePrice}
                                      </Typography>
                                    </Box>
                                  </Box>
                                </Box>
                              );
                            })()}
                          </Box>
                        </Box>
                      )}

                      {/* Quantity */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--foreground)' }}>
                          {lang === 'en' ? 'Quantity' : 'จำนวน'}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <IconButton
                            size="small"
                            onClick={() => setQuantity(Math.max(1, quantity - 1))}
                            sx={{ bgcolor: 'var(--surface-2)', color: 'var(--foreground)', border: '1px solid var(--glass-border)' }}
                          >
                            <Minus size={16} />
                          </IconButton>
                          <Typography sx={{ fontWeight: 700, minWidth: 30, textAlign: 'center', color: 'var(--foreground)' }}>
                            {quantity}
                          </Typography>
                          <IconButton
                            size="small"
                            onClick={() => setQuantity(quantity + 1)}
                            sx={{ bgcolor: 'var(--surface-2)', color: 'var(--foreground)', border: '1px solid var(--glass-border)' }}
                          >
                            <Plus size={16} />
                          </IconButton>
                        </Box>
                      </Box>
                    </Box>

                    {/* Desktop Actions */}
                    {!isMobile && bottomActionsNode}
                  </Box>
                </Box>
              </Box>

              {/* Mobile Bottom Actions */}
              {isMobile && bottomActionsNode}
            </Box>
          );
        })()}
      </Drawer>

      {/* ==================== CART DRAWER (same as main store) ==================== */}
      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        cart={drawerCart}
        config={shopConfig}
        shippingConfig={shippingConfig}
        isShopOpen={isShopOpen}
        onClearCart={async () => {
          const ok = await showConfirm({
            title: lang === 'en' ? 'Clear entire cart?' : 'ล้างตะกร้าทั้งหมด?',
            message: lang === 'en'
              ? 'Are you sure you want to remove all items from your cart?'
              : 'คุณแน่ใจหรือไม่ว่าต้องการนำสินค้าทั้งหมดออกจากตะกร้าของคุณ?',
            variant: 'warning',
            confirmText: lang === 'en' ? 'Clear All' : 'ล้างทั้งหมด',
            cancelText: lang === 'en' ? 'Cancel' : 'ยกเลิก',
            destructive: true,
          });
          if (ok) {
            useCartStore.getState().clearCartByShop(shopSlug);
            showToast('success', lang === 'en' ? 'Cart cleared' : 'ล้างตะกร้าแล้ว');
          }
        }}
        onUpdateQuantity={updateDrawerCartQuantity}
        onRemoveItem={removeDrawerCartItem}
        onEditItem={(item) => setEditingCartItem(item)}
        onCheckout={() => {
          if (!isShopOpen) {
            showToast('warning', lang === 'en' ? 'Shop is closed' : 'ร้านค้าปิดรับออเดอร์แล้ว');
            return;
          }
          if (!requireProfileBeforeCheckout()) return;
          setCartOpen(false);
          setCheckoutOpen(true);
        }}
        onStartHold={startCartHold}
        onStopHold={stopCartHold}
        onGoHome={() => setCartOpen(false)}
        getTotalPrice={getTotalPrice}
        editingCartItem={editingCartItem}
        onSetEditingCartItem={setEditingCartItem}
        onUpdateCartItem={updateDrawerCartItem}
      />

      <PaymentFlow
        registerOpener={(opener) => {
          paymentOpenerRef.current = opener;
        }}
        onPaymentSuccess={(ref) => {
          setOrderHistory((prev) => {
            const orderExists = prev.some((order) => order.ref === ref);
            if (orderExists) {
              return prev.map((order) =>
                order.ref === ref ? { ...order, status: 'PAID' } : order
              );
            }
            return [{ ref, status: 'PAID', date: new Date().toISOString(), total: 0, items: [] }, ...prev];
          });
          showToast('success', lang === 'en' ? 'Payment submitted!' : 'ส่งหลักฐานการชำระเงินแล้ว!');
          setTimeout(() => loadOrderHistory(), 500);
        }}
      />

      {/* ==================== ORDER HISTORY DRAWER ==================== */}
      <OrderHistoryDrawer
        open={showOrderHistory}
        onClose={() => setShowOrderHistory(false)}
        orderHistory={orderHistory}
        loadingHistory={loadingHistory}
        loadingHistoryMore={loadingHistoryMore}
        historyHasMore={historyHasMore}
        historyFilter={historyFilter}
        onFilterChange={(filter) => setHistoryFilter(filter)}
        onLoadMore={() => loadOrderHistory({ append: true })}
        onOpenPayment={(ref) => openPaymentFlow(ref)}
        onCancelOrder={(ref) => handleCancelOrder(ref)}
        onShowQR={(ref) => openPaymentFlow(ref)}
        cancellingRef={cancellingRef}
        isShopOpen={isShopOpen}
        realtimeConnected={realtimeConnected}
        config={shopConfig}
        onRefundRequested={() => loadOrderHistory()}
      />

      {/* ==================== SUPPORT CHAT ==================== */}
      <SupportChatWidget shopId={shop.id} shopName={shop.name} />

      {/* ==================== SHOP CONTACT ==================== */}
      {hasShopContact && (
        <Box sx={{
          maxWidth: '1200px', mx: 'auto', px: 2, py: 4,
          borderTop: '1px solid var(--glass-border)',
        }}>
          <Typography sx={{
            fontSize: '0.95rem', fontWeight: 700, mb: 1.5,
            display: 'flex', alignItems: 'center', gap: 1, color: 'var(--foreground)',
          }}>
            <Store size={16} /> {t.storefront.shopContact}
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
            {shop.contactEmail && (
              <Typography
                component="a"
                href={`mailto:${shop.contactEmail}`}
                sx={{
                  fontSize: '0.85rem', color: 'var(--text-muted)',
                  display: 'flex', alignItems: 'center', gap: 1,
                  textDecoration: 'none', '&:hover': { color: 'var(--primary)' },
                }}
              >
                <Mail size={14} />
                <Box component="span" sx={{ fontWeight: 600, color: 'var(--foreground)', minWidth: 52 }}>
                  {t.storefront.email}:
                </Box>
                {shop.contactEmail}
              </Typography>
            )}
            {shop.contactPhone && (
              <Typography
                component="a"
                href={`tel:${shop.contactPhone.replace(/\s/g, '')}`}
                sx={{
                  fontSize: '0.85rem', color: 'var(--text-muted)',
                  display: 'flex', alignItems: 'center', gap: 1,
                  textDecoration: 'none', '&:hover': { color: 'var(--primary)' },
                }}
              >
                <Phone size={14} />
                <Box component="span" sx={{ fontWeight: 600, color: 'var(--foreground)', minWidth: 52 }}>
                  {t.storefront.phone}:
                </Box>
                {shop.contactPhone}
              </Typography>
            )}
            {shopSocialLinks.map(({ key, url }) => {
              const label = SOCIAL_LINK_LABELS[key]?.[lang] || key.charAt(0).toUpperCase() + key.slice(1);
              const SocialIcon = key === 'facebook' ? Facebook : key === 'instagram' ? Instagram : Share2;
              return (
                <Typography
                  key={`${key}-${url}`}
                  component="a"
                  href={normalizeSocialUrl(url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{
                    fontSize: '0.85rem', color: 'var(--text-muted)',
                    display: 'flex', alignItems: 'center', gap: 1,
                    textDecoration: 'none', '&:hover': { color: 'var(--primary)' },
                  }}
                >
                  <SocialIcon size={14} />
                  <Box component="span" sx={{ fontWeight: 600, color: 'var(--foreground)' }}>
                    {label}
                  </Box>
                </Typography>
              );
            })}
          </Box>
          <Box sx={{ mt: 3 }}>
            <Link href="/" style={{ textDecoration: 'none' }}>
              <Button
                variant="outlined"
                startIcon={<ArrowLeft size={16} />}
                sx={{
                  color: 'var(--text-muted)',
                  borderColor: 'var(--glass-border)',
                  borderRadius: '12px',
                  textTransform: 'none',
                  fontWeight: 600,
                  '&:hover': { borderColor: 'var(--primary)', color: 'var(--primary)' },
                }}
              >
                {t.storefront.backToMain}
              </Button>
            </Link>
          </Box>
        </Box>
      )}

      {/* ==================== FOOTER ==================== */}
      <Footer />

      {/* ==================== CHECKOUT DIALOG ==================== */}
      <CheckoutDialog
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        cart={mappedShopCart}
        orderData={orderData}
        profileComplete={profileComplete}
        processing={checkoutProcessing}
        turnstileToken={turnstileToken}
        setTurnstileToken={setTurnstileToken}
        onSubmitOrder={handleShopCheckout}
        onEditProfile={() => { setShowProfileModal(true); setPendingCheckout(true); }}
        products={products}
        isMobile={isMobile}
        savedAddresses={savedAddresses}
        onAddressChange={(address) => setOrderAddress(address)}
        shopId={shop.id}
      />

      {/* ==================== PROFILE MODAL ==================== */}
      {showProfileModal && (
        <ProfileModal
          initialData={{
            name: orderData.name,
            phone: orderData.phone,
            address: orderData.address,
            instagram: orderData.instagram,
            profileImage: orderData.profileImage,
            savedAddresses,
          }}
          onClose={() => setShowProfileModal(false)}
          onSave={handleSaveProfile}
          userImage={session?.user?.image || ''}
          userEmail={session?.user?.email || ''}
          nameValidation={shopConfig.nameValidation}
        />
      )}

      <Dialog open={!!confirmCancelRef} onClose={() => setConfirmCancelRef(null)}>
        <DialogContent sx={{ bgcolor: 'var(--surface)', color: 'var(--foreground)' }}>
          <Typography sx={{ fontWeight: 700, mb: 1 }}>
            {lang === 'en' ? 'Cancel order?' : 'ยกเลิกคำสั่งซื้อ?'}
          </Typography>
          <Typography sx={{ color: 'var(--text-muted)', mb: 2 }}>
            {confirmCancelRef}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
            <Button onClick={() => setConfirmCancelRef(null)}>
              {lang === 'en' ? 'Back' : 'ย้อนกลับ'}
            </Button>
            <Button color="error" variant="contained" onClick={confirmCancelOrder}>
              {lang === 'en' ? 'Confirm cancel' : 'ยืนยันยกเลิก'}
            </Button>
          </Box>
        </DialogContent>
      </Dialog>

      {/* ==================== FULLSCREEN GALLERY LIGHTBOX ==================== */}
      <Dialog
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        maxWidth={false}
        fullScreen
        PaperProps={{
          sx: {
            background: 'rgba(0,0,0,0.96)',
            boxShadow: 'none',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            overflow: 'hidden',
          }
        }}
        sx={{ zIndex: 9999 }}
      >
        {/* Close Button */}
        <IconButton
          onClick={() => setLightboxOpen(false)}
          sx={{
            position: 'absolute',
            top: { xs: 16, sm: 24 },
            right: { xs: 16, sm: 24 },
            color: 'white',
            bgcolor: 'rgba(255,255,255,0.12)',
            backdropFilter: 'blur(8px)',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' },
            zIndex: 10,
            width: 44,
            height: 44,
          }}
        >
          <X size={24} />
        </IconButton>

        {/* Navigation Chevrons */}
        {productImages.length > 1 && (
          <>
            <IconButton
              onClick={() => setLightboxIndex((prev) => (prev - 1 + productImages.length) % productImages.length)}
              sx={{
                position: 'absolute',
                top: '50%',
                left: { xs: 12, sm: 24 },
                transform: 'translateY(-50%)',
                bgcolor: 'rgba(255,255,255,0.12)',
                backdropFilter: 'blur(8px)',
                color: 'white',
                zIndex: 10,
                width: { xs: 44, sm: 52 },
                height: { xs: 44, sm: 52 },
                '&:hover': { bgcolor: 'rgba(255,255,255,0.22)', transform: 'translateY(-50%) scale(1.05)' },
                transition: 'all 0.2s ease',
              }}
            >
              <ChevronLeft size={28} />
            </IconButton>
            <IconButton
              onClick={() => setLightboxIndex((prev) => (prev + 1) % productImages.length)}
              sx={{
                position: 'absolute',
                top: '50%',
                right: { xs: 12, sm: 24 },
                transform: 'translateY(-50%)',
                bgcolor: 'rgba(255,255,255,0.12)',
                backdropFilter: 'blur(8px)',
                color: 'white',
                zIndex: 10,
                width: { xs: 44, sm: 52 },
                height: { xs: 44, sm: 52 },
                '&:hover': { bgcolor: 'rgba(255,255,255,0.22)', transform: 'translateY(-50%) scale(1.05)' },
                transition: 'all 0.2s ease',
              }}
            >
              <ChevronRight size={28} />
            </IconButton>
          </>
        )}

        {/* Image Container with Swipe Support */}
        {productImages.length > 0 && (
          <Box
            onTouchStart={(e) => {
              touchStartX.current = e.targetTouches[0].clientX;
              touchEndX.current = e.targetTouches[0].clientX;
            }}
            onTouchMove={(e) => {
              touchEndX.current = e.targetTouches[0].clientX;
            }}
            onTouchEnd={() => {
              const diffX = touchStartX.current - touchEndX.current;
              if (diffX > 50) {
                // Swipe Left -> Next
                setLightboxIndex((prev) => (prev + 1) % productImages.length);
              } else if (diffX < -50) {
                // Swipe Right -> Prev
                setLightboxIndex((prev) => (prev - 1 + productImages.length) % productImages.length);
              }
            }}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              height: '100%',
              p: { xs: 2, sm: 4 },
              userSelect: 'none',
            }}
          >
            <OptimizedImage
              src={productImages[lightboxIndex]}
              alt={`Fullscreen ${lightboxIndex + 1}`}
              width="100%"
              height="100%"
              objectFit="contain"
              priority
              disableFade
              placeholder="none"
              style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: '8px', userSelect: 'none' }}
            />
          </Box>
        )}

        {/* Interactive Thumbnail Strip at Bottom */}
        {productImages.length > 1 && (
          <Box sx={{
            position: 'absolute',
            bottom: { xs: 24, sm: 32 },
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: 1.5,
            px: 2.5,
            py: 1.2,
            borderRadius: '20px',
            bgcolor: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(12px)',
            maxWidth: '92vw',
            overflowX: 'auto',
            zIndex: 10,
            '&::-webkit-scrollbar': { display: 'none' },
            scrollbarWidth: 'none',
          }}>
            {productImages.map((img, idx) => (
              <Box
                key={idx}
                onClick={() => setLightboxIndex(idx)}
                sx={{
                  width: 52,
                  height: 52,
                  borderRadius: '10px',
                  border: lightboxIndex === idx ? '2.5px solid white' : '2px solid transparent',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  opacity: lightboxIndex === idx ? 1 : 0.45,
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  flexShrink: 0,
                  transform: lightboxIndex === idx ? 'scale(1.08)' : 'scale(1)',
                  '&:hover': { opacity: 0.95 },
                }}
              >
                <OptimizedImage
                  src={img}
                  alt={`Thumbnail ${idx + 1}`}
                  width="100%"
                  height="100%"
                  objectFit="cover"
                  disableFade
                  placeholder="none"
                  priority={lightboxIndex === idx}
                />
              </Box>
            ))}
          </Box>
        )}
      </Dialog>

      <ConfirmDialog />
    </Box>
  );
}
