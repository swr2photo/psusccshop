// src/app/shop/[slug]/ShopStorefront.tsx
// Client-side storefront for individual shops — matches main store design
'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Box, Typography, Button, Chip, Avatar, IconButton, Badge,
  Dialog, DialogContent, DialogActions, TextField,
  Snackbar, Alert, useMediaQuery, Skeleton,
  CircularProgress,
} from '@mui/material';
import {
  Store, ShoppingCart, Plus, Minus, X, ArrowLeft, Search,
  Share2, Heart, Package, Clock, Tag, CreditCard,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useCartStore } from '@/store/cartStore';
import { useWishlistStore } from '@/store/wishlistStore';
import { useTranslation } from '@/hooks/useTranslation';
import OptimizedImage from '@/components/OptimizedImage';
import AnnouncementBar from '@/components/AnnouncementBar';
import EventBanner, { type ShopEvent } from '@/components/EventBanner';
import Footer from '@/components/Footer';
import SupportChatWidget from '@/components/SupportChatWidget';
import PaymentModal from '@/components/PaymentModal';
import {
  getProductStatus, SHOP_STATUS_CONFIG, type ShopStatusType,
} from '@/components/ShopStatusCard';
import type { Product } from '@/lib/config';
import {
  getProductName, getProductDescription,
  getCategoryLabel, getCategoryIcon,
} from '@/lib/config';
import { submitOrder as submitOrderApi } from '@/lib/api-client';

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
  productCount?: number;
}

interface ShopStorefrontProps {
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

// ==================== COMPONENT ====================
export default function ShopStorefront({ shopSlug, initialShop }: ShopStorefrontProps) {
  const { data: session } = useSession();
  const { t, lang } = useTranslation();
  const isMobile = useMediaQuery('(max-width:600px)');
  const cart = useCartStore((s) => s.cart);
  const addToCart = useCartStore((s) => s.addToCart);
  const wishlistStore = useWishlistStore();

  const [shop, setShop] = useState<ShopInfo>(initialShop);
  const [products, setProducts] = useState<Product[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [announcementHistory, setAnnouncementHistory] = useState<any[]>([]);
  const [events, setEvents] = useState<ShopEvent[]>([]);
  const [socialMediaNews, setSocialMediaNews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [toast, setToast] = useState<{ open: boolean; type: 'success' | 'error' | 'info' | 'warning'; message: string }>({
    open: false, type: 'info', message: '',
  });
  const [cartOpen, setCartOpen] = useState(false);

  // Product dialog state
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedVariant, setSelectedVariant] = useState<any>(null);
  const [quantity, setQuantity] = useState(1);

  // Checkout state
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutProcessing, setCheckoutProcessing] = useState(false);
  const [orderName, setOrderName] = useState('');
  const [orderPhone, setOrderPhone] = useState('');
  const [paymentRef, setPaymentRef] = useState<string | null>(null);

  // Load user profile for checkout
  useEffect(() => {
    if (session?.user?.email) {
      fetch(`/api/profile?email=${encodeURIComponent(session.user.email)}`)
        .then(r => r.json())
        .then(data => {
          if (data.status === 'success' && data.data) {
            if (data.data.name && !orderName) setOrderName(data.data.name);
            if (data.data.phone && !orderPhone) setOrderPhone(data.data.phone);
          }
        })
        .catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.email]);

  const showToast = useCallback((type: 'success' | 'error' | 'info' | 'warning', message: string) => {
    setToast({ open: true, type, message });
  }, []);

  // Fetch shop data (products + config) from public API
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        let shopId = initialShop.id;
        if (!shopId) {
          const shopRes = await fetch('/api/shops?public=1');
          const shopData = await shopRes.json();
          const found = (shopData.shops || []).find((s: any) => s.slug === shopSlug);
          if (found) shopId = found.id;
        }
        if (!shopId) return;

        const res = await fetch(`/api/shops/${shopId}/public`);
        const data = await res.json();
        if (data.status === 'success' && data.shop) {
          const s = data.shop;
          setShop(s);
          setProducts(s.products || []);
          setAnnouncements(s.announcements || []);
          setAnnouncementHistory(s.announcementHistory || []);
          setEvents(s.events || []);
          setSocialMediaNews(s.socialMediaNews || []);
        }
      } catch {
        console.error('Failed to load shop data');
      } finally {
        setLoading(false);
      }
    })();
  }, [shopSlug, initialShop.id]);

  // Checkout handler
  const handleShopCheckout = useCallback(async () => {
    if (!session?.user?.email) {
      showToast('warning', lang === 'en' ? 'Please sign in to checkout' : 'กรุณาเข้าสู่ระบบก่อนสั่งซื้อ');
      return;
    }
    if (cart.length === 0) {
      showToast('warning', lang === 'en' ? 'Cart is empty' : 'ตะกร้าว่าง');
      return;
    }
    if (!orderName.trim()) {
      showToast('warning', lang === 'en' ? 'Please enter your name' : 'กรุณากรอกชื่อ');
      return;
    }

    setCheckoutProcessing(true);
    try {
      const totalAmount = cart.reduce((sum, item) => sum + item.total, 0);
      const res = await submitOrderApi({
        customerName: orderName.trim(),
        customerEmail: session.user.email,
        customerPhone: orderPhone.trim(),
        customerAddress: '',
        customerInstagram: '',
        cart: cart.map(item => ({
          productId: item.id,
          productName: item.name,
          size: item.size || '-',
          quantity: item.qty,
          unitPrice: item.price,
          options: {},
        })),
        totalAmount,
        shippingOptionId: 'pickup',
        paymentOptionId: 'bank_transfer',
        shopId: shop.id,
        shopSlug: shop.slug,
      } as any);

      if (res.status === 'success' && res.ref) {
        showToast('success', `${lang === 'en' ? 'Order placed!' : 'สั่งซื้อสำเร็จ!'} ${res.ref}`);
        // Clear cart items belonging to this shop
        const clearCart = useCartStore.getState().clearCart;
        clearCart();
        setCartOpen(false);
        setCheckoutOpen(false);
        // Open payment
        setPaymentRef(res.ref);
      } else {
        showToast('error', (res as any).message || (lang === 'en' ? 'Order failed' : 'สั่งซื้อไม่สำเร็จ'));
      }
    } catch (err: any) {
      showToast('error', err.message || (lang === 'en' ? 'Error' : 'เกิดข้อผิดพลาด'));
    } finally {
      setCheckoutProcessing(false);
    }
  }, [session, cart, orderName, orderPhone, shop.id, shop.slug, lang, showToast]);

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
    const filtered = products.filter((p) => {
      if (!p.isActive) return false;
      if (selectedCategory !== 'all' && p.category !== selectedCategory) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return p.name.toLowerCase().includes(q) ||
          (p.nameEn && p.nameEn.toLowerCase().includes(q)) ||
          (p.description && p.description.toLowerCase().includes(q));
      }
      return true;
    });

    const grouped: Record<string, Product[]> = {};
    filtered.forEach((p) => {
      const cat = p.category || 'OTHER';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(p);
    });
    return grouped;
  }, [products, selectedCategory, searchQuery]);

  const totalFilteredCount = Object.values(filteredGroupedProducts).reduce((sum, items) => sum + items.length, 0);
  const cartCount = cart.length;
  const isShopOpen = shop.settings?.isOpen !== false;

  const handleSelectProduct = useCallback((product: Product) => {
    setSelectedProduct(product);
    setSelectedSize('');
    setSelectedVariant(null);
    setQuantity(1);
  }, []);

  const handleAddToCart = useCallback(() => {
    if (!selectedProduct) return;
    const price = selectedVariant
      ? selectedVariant.price
      : selectedProduct.sizePricing?.[selectedSize] || selectedProduct.basePrice;
    const item = {
      id: selectedProduct.id,
      name: selectedProduct.name,
      type: selectedProduct.type || 'OTHER' as const,
      category: selectedProduct.category,
      subType: selectedProduct.subType,
      price,
      qty: quantity,
      size: selectedSize || '-',
      total: price * quantity,
      selectedVariant: selectedVariant || undefined,
    };
    addToCart(item);
    showToast('success', `เพิ่ม "${getProductName(selectedProduct, lang)}" ลงตะกร้าแล้ว`);
    setSelectedProduct(null);
    setSelectedSize('');
    setSelectedVariant(null);
    setQuantity(1);
  }, [selectedProduct, selectedVariant, selectedSize, quantity, addToCart, showToast, lang]);

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
                ปิดรับออเดอร์
              </Typography>
            )}
          </Box>
          <IconButton onClick={() => setCartOpen(true)} sx={{ color: 'var(--foreground)' }}>
            <Badge badgeContent={cartCount} color="error">
              <ShoppingCart size={22} />
            </Badge>
          </IconButton>
        </Box>
      </Box>

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
          />
        </Box>
      )}

      {/* ==================== EVENTS ==================== */}
      {events.filter(e => e.enabled).length > 0 && (
        <Box sx={{ maxWidth: '1200px', mx: 'auto', px: { xs: 0, sm: 2 }, pt: 2 }}>
          <EventBanner events={events.filter(e => e.enabled)} compact />
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
                  <span style={{ fontSize: '0.9rem' }}>{getCategoryIcon(category)}</span>
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
                        minWidth: { xs: '68vw', sm: 'auto' },
                        maxWidth: { xs: '68vw', sm: 'none' },
                        flex: { xs: '0 0 auto', sm: '1 1 auto' },
                        scrollSnapAlign: { xs: 'start', sm: 'unset' },
                      }}>
                        <Box
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
                            borderRadius: '20px',
                            overflow: 'hidden',
                            bgcolor: 'var(--surface)',
                            border: `1px solid ${isProductClosed ? SHOP_STATUS_CONFIG[productStatus].borderColor : 'var(--glass-border)'}`,
                            transition: 'all 0.25s ease',
                            position: 'relative',
                            opacity: isProductClosed ? 0.85 : 1,
                            '&:hover': isProductAvailable ? {
                              transform: 'translateY(-4px)',
                              boxShadow: '0 20px 40px rgba(0,113,227,0.2)',
                              borderColor: 'rgba(0,113,227,0.4)',
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
                                  transition: 'filter 0.3s ease',
                                }}
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
                                  disabled={!isProductAvailable}
                                  sx={{
                                    py: 0.8, borderRadius: '10px',
                                    background: isProductAvailable
                                      ? 'linear-gradient(135deg, #0071e3 0%, #0077ED 100%)'
                                      : 'rgba(100,116,139,0.2)',
                                    color: isProductAvailable ? 'white' : '#86868b',
                                    fontSize: '0.75rem', fontWeight: 700,
                                    textTransform: 'none',
                                    '&:hover': {
                                      background: isProductAvailable
                                        ? 'linear-gradient(135deg, #0071e3 0%, #0071e3 100%)'
                                        : 'rgba(100,116,139,0.2)',
                                    },
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

      {/* ==================== PRODUCT DETAIL DIALOG ==================== */}
      <Dialog
        open={!!selectedProduct}
        onClose={() => { setSelectedProduct(null); setSelectedSize(''); setSelectedVariant(null); setQuantity(1); }}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: 'var(--surface)',
            color: 'var(--foreground)',
            borderRadius: '20px',
            border: '1px solid var(--glass-border)',
            maxHeight: '90vh',
          },
        }}
      >
        {selectedProduct && (
          <>
            {(selectedProduct.coverImage || selectedProduct.images?.[0]) && (
              <Box sx={{ position: 'relative', width: '100%', aspectRatio: '4/3', overflow: 'hidden' }}>
                <OptimizedImage
                  src={selectedProduct.coverImage || selectedProduct.images?.[0] || ''}
                  alt={getProductName(selectedProduct, lang)}
                  width="100%"
                  height="100%"
                  objectFit="cover"
                  priority
                />
                <IconButton
                  onClick={() => { setSelectedProduct(null); setSelectedSize(''); setSelectedVariant(null); setQuantity(1); }}
                  sx={{
                    position: 'absolute', top: 12, right: 12,
                    bgcolor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)',
                    color: 'white', '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' },
                  }}
                >
                  <X size={18} />
                </IconButton>
                <Box sx={{
                  position: 'absolute', bottom: 12, right: 12,
                  px: 1.5, py: 0.6, borderRadius: '12px',
                  bgcolor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
                }}>
                  <Typography sx={{ fontSize: '1.2rem', fontWeight: 800, color: '#34c759' }}>
                    ฿{(selectedVariant?.price || selectedProduct.sizePricing?.[selectedSize] || selectedProduct.basePrice).toLocaleString()}
                  </Typography>
                </Box>
              </Box>
            )}

            <DialogContent sx={{ px: 3, py: 2.5 }}>
              <Typography sx={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--foreground)' }}>
                {getProductName(selectedProduct, lang)}
              </Typography>
              {getProductDescription(selectedProduct, lang) && (
                <Typography sx={{ fontSize: '0.85rem', color: 'var(--text-muted)', mt: 1, whiteSpace: 'pre-line' }}>
                  {getProductDescription(selectedProduct, lang)}
                </Typography>
              )}

              {/* Size Selection */}
              {selectedProduct.sizePricing && Object.keys(selectedProduct.sizePricing).length > 0 && (
                <Box sx={{ mt: 2.5 }}>
                  <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, mb: 1, color: 'var(--foreground)' }}>
                    {lang === 'en' ? 'Size' : 'ขนาด'}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {Object.entries(selectedProduct.sizePricing).map(([size, price]) => (
                      <Chip
                        key={size}
                        label={`${size} (฿${price})`}
                        onClick={() => setSelectedSize(size)}
                        sx={{
                          bgcolor: selectedSize === size ? '#0071e3' : 'var(--surface-2)',
                          color: selectedSize === size ? 'white' : 'var(--foreground)',
                          fontWeight: 600, cursor: 'pointer',
                          border: `1px solid ${selectedSize === size ? '#0071e3' : 'var(--glass-border)'}`,
                          '&:hover': { opacity: 0.8 },
                        }}
                      />
                    ))}
                  </Box>
                </Box>
              )}

              {/* Variant Selection */}
              {selectedProduct.variants && selectedProduct.variants.length > 0 && (
                <Box sx={{ mt: 2.5 }}>
                  <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, mb: 1, color: 'var(--foreground)' }}>
                    {lang === 'en' ? 'Options' : 'ตัวเลือก'}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {selectedProduct.variants.filter(v => v.isActive).map((variant) => (
                      <Chip
                        key={variant.id}
                        label={`${variant.name} (฿${variant.price})`}
                        onClick={() => setSelectedVariant(variant)}
                        sx={{
                          bgcolor: selectedVariant?.id === variant.id ? '#0071e3' : 'var(--surface-2)',
                          color: selectedVariant?.id === variant.id ? 'white' : 'var(--foreground)',
                          fontWeight: 600, cursor: 'pointer',
                          border: `1px solid ${selectedVariant?.id === variant.id ? '#0071e3' : 'var(--glass-border)'}`,
                          '&:hover': { opacity: 0.8 },
                        }}
                      />
                    ))}
                  </Box>
                </Box>
              )}

              {/* Quantity */}
              <Box sx={{ mt: 2.5, display: 'flex', alignItems: 'center', gap: 2 }}>
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
            </DialogContent>

            <DialogActions sx={{ px: 3, pb: 2.5 }}>
              <Button
                fullWidth
                variant="contained"
                onClick={handleAddToCart}
                disabled={
                  (selectedProduct.sizePricing && Object.keys(selectedProduct.sizePricing).length > 0 && !selectedSize) ||
                  (selectedProduct.variants && selectedProduct.variants.length > 0 && !selectedVariant)
                }
                startIcon={<ShoppingCart size={18} />}
                sx={{
                  background: 'linear-gradient(135deg, #0071e3 0%, #0077ED 100%)',
                  borderRadius: '12px',
                  textTransform: 'none',
                  fontWeight: 700,
                  py: 1.2,
                  fontSize: '1rem',
                  color: 'white',
                  '&:hover': { background: 'linear-gradient(135deg, #0071e3 0%, #0071e3 100%)' },
                  '&.Mui-disabled': { bgcolor: 'var(--surface-2)', color: 'var(--text-muted)' },
                }}
              >
                {lang === 'en' ? 'Add to Cart' : 'เพิ่มลงตะกร้า'} — ฿{((selectedVariant?.price || selectedProduct.sizePricing?.[selectedSize] || selectedProduct.basePrice) * quantity).toLocaleString()}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* ==================== CART DIALOG ==================== */}
      <Dialog
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: 'var(--surface)',
            color: 'var(--foreground)',
            borderRadius: '20px',
            border: '1px solid var(--glass-border)',
            maxHeight: '80vh',
          },
        }}
      >
        <Box sx={{ px: 3, py: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--glass-border)' }}>
          <Typography sx={{ fontWeight: 800, fontSize: '1.1rem' }}>
            🛒 {lang === 'en' ? 'Cart' : 'ตะกร้าสินค้า'} ({cart.length})
          </Typography>
          <IconButton onClick={() => setCartOpen(false)} sx={{ color: 'var(--text-muted)' }}>
            <X size={20} />
          </IconButton>
        </Box>
        <DialogContent sx={{ px: 3, py: 2 }}>
          {cart.length === 0 ? (
            <Box sx={{ py: 4, textAlign: 'center' }}>
              <ShoppingCart size={48} style={{ color: 'var(--text-muted)', marginBottom: 8 }} />
              <Typography sx={{ color: 'var(--text-muted)' }}>
                {lang === 'en' ? 'Your cart is empty' : 'ยังไม่มีสินค้าในตะกร้า'}
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {cart.map((item, idx) => (
                <Box key={idx} sx={{
                  p: 2, borderRadius: '12px',
                  bgcolor: 'var(--surface-2)',
                  border: '1px solid var(--glass-border)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--foreground)' }} noWrap>
                      {item.name}
                    </Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {item.size !== '-' ? `${lang === 'en' ? 'Size' : 'ขนาด'}: ${item.size} · ` : ''}
                      {lang === 'en' ? 'Qty' : 'จำนวน'}: {item.qty}
                    </Typography>
                  </Box>
                  <Typography sx={{ fontWeight: 800, color: '#34c759', fontSize: '0.95rem', ml: 2 }}>
                    ฿{item.total.toLocaleString()}
                  </Typography>
                </Box>
              ))}
              <Box sx={{ pt: 2, borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography sx={{ fontWeight: 700, fontSize: '1rem' }}>
                  {lang === 'en' ? 'Total' : 'รวม'}
                </Typography>
                <Typography sx={{ fontWeight: 800, color: '#34c759', fontSize: '1.2rem' }}>
                  ฿{cart.reduce((sum, item) => sum + item.total, 0).toLocaleString()}
                </Typography>
              </Box>
              <Link href="/" style={{ textDecoration: 'none' }}>
                <Button
                  fullWidth
                  variant="outlined"
                  sx={{
                    mt: 1,
                    borderColor: 'var(--glass-border)',
                    borderRadius: '12px',
                    textTransform: 'none',
                    fontWeight: 600,
                    py: 1,
                    color: 'var(--text-muted)',
                    fontSize: '0.85rem',
                  }}
                >
                  {lang === 'en' ? 'Continue Shopping at Main Store' : 'ช้อปต่อที่ร้านหลัก'}
                </Button>
              </Link>
              {session?.user?.email ? (
                <>
                  {!checkoutOpen ? (
                    <Button
                      fullWidth
                      onClick={() => setCheckoutOpen(true)}
                      sx={{
                        mt: 1,
                        background: 'linear-gradient(135deg, #0071e3 0%, #0077ED 100%)',
                        borderRadius: '12px',
                        textTransform: 'none',
                        fontWeight: 700,
                        py: 1.2,
                        color: 'white',
                      }}
                    >
                      {lang === 'en' ? 'Checkout' : 'สั่งซื้อสินค้า'}
                    </Button>
                  ) : (
                    <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1.5, pt: 1, borderTop: '1px solid var(--glass-border)' }}>
                      <Typography sx={{ fontWeight: 700, fontSize: '0.9rem' }}>
                        {lang === 'en' ? 'Order Details' : 'ข้อมูลการสั่งซื้อ'}
                      </Typography>
                      <TextField
                        label={lang === 'en' ? 'Name *' : 'ชื่อ-นามสกุล *'}
                        value={orderName}
                        onChange={(e) => setOrderName(e.target.value)}
                        fullWidth
                        size="small"
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px', bgcolor: 'var(--surface-2)' }, '& .MuiInputLabel-root': { color: 'var(--text-muted)' }, '& .MuiOutlinedInput-input': { color: 'var(--foreground)' } }}
                      />
                      <TextField
                        label={lang === 'en' ? 'Phone' : 'เบอร์โทร'}
                        value={orderPhone}
                        onChange={(e) => setOrderPhone(e.target.value)}
                        fullWidth
                        size="small"
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px', bgcolor: 'var(--surface-2)' }, '& .MuiInputLabel-root': { color: 'var(--text-muted)' }, '& .MuiOutlinedInput-input': { color: 'var(--foreground)' } }}
                      />
                      <Button
                        fullWidth
                        onClick={handleShopCheckout}
                        disabled={checkoutProcessing || !orderName.trim()}
                        startIcon={checkoutProcessing ? <CircularProgress size={16} /> : <CreditCard size={16} />}
                        sx={{
                          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                          borderRadius: '12px',
                          textTransform: 'none',
                          fontWeight: 700,
                          py: 1.2,
                          color: 'white',
                          '&.Mui-disabled': { opacity: 0.6, color: 'white' },
                        }}
                      >
                        {checkoutProcessing
                          ? (lang === 'en' ? 'Processing...' : 'กำลังดำเนินการ...')
                          : (lang === 'en' ? 'Place Order & Pay' : 'ยืนยันสั่งซื้อ & ชำระเงิน')}
                      </Button>
                    </Box>
                  )}
                </>
              ) : (
                <Link href="/auth/signin" style={{ textDecoration: 'none' }}>
                  <Button
                    fullWidth
                    sx={{
                      mt: 1,
                      background: 'linear-gradient(135deg, #0071e3 0%, #0077ED 100%)',
                      borderRadius: '12px',
                      textTransform: 'none',
                      fontWeight: 700,
                      py: 1.2,
                      color: 'white',
                    }}
                  >
                    {lang === 'en' ? 'Sign in to Checkout' : 'เข้าสู่ระบบเพื่อสั่งซื้อ'}
                  </Button>
                </Link>
              )}
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* ==================== PAYMENT MODAL ==================== */}
      {paymentRef && (
        <PaymentModal
          orderRef={paymentRef}
          onClose={() => setPaymentRef(null)}
          onSuccess={() => {
            setPaymentRef(null);
            showToast('success', lang === 'en' ? 'Payment submitted!' : 'ส่งหลักฐานการชำระเงินแล้ว!');
          }}
        />
      )}

      {/* ==================== SUPPORT CHAT ==================== */}
      <SupportChatWidget shopId={shop.id} shopName={shop.name} />

      {/* ==================== FOOTER ==================== */}
      <Footer />

      {/* ==================== TOAST ==================== */}
      <Snackbar
        open={toast.open}
        autoHideDuration={3000}
        onClose={() => setToast(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={toast.type}
          onClose={() => setToast(prev => ({ ...prev, open: false }))}
          sx={{ borderRadius: '12px' }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
