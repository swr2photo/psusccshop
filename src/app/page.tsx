'use client';

import { apiFetch } from '@/lib/api-client';
import React from 'react';
import { useLiveStreamContext } from '@/context/LiveStreamProvider';
import OptimizedImage, { preloadImages, OptimizedBackground } from '@/components/OptimizedImage';
import { useGalleryImagePreload, isGalleryImageInRange } from '@/hooks/useGalleryImagePreload';
import { Palette, MessageCircle as ChatIcon, Send as SendIcon, X as CloseIcon, Bot as SmartToyIcon, RotateCcw as RefreshIcon, Sparkles as AutoAwesomeIcon, Store as StorefrontIcon, Copy as ContentCopyIcon, Check as CheckIcon, Maximize2 as FullscreenIcon, Minimize2 as FullscreenExitIcon, ImagePlus as AddPhotoAlternateIcon, ShoppingCart as ShoppingCartOutlinedIcon, Coins as PaidOutlinedIcon, Ruler as StraightenOutlinedIcon, Truck as LocalShippingOutlinedIcon, Wallet as AccountBalanceWalletOutlinedIcon, HelpCircle as HelpOutlineOutlinedIcon, Image as ImageOutlinedIcon, User as PersonOutlineIcon, BadgeCheck as VerifiedIcon, BookOpen as MenuBookOutlinedIcon, Hand as WavingHandIcon, Reply as ReplyIcon, Pencil as EditIcon, ClipboardList as ClipboardListIcon, Tag as TagIcon, ChevronUp, ChevronDown } from 'lucide-react';

import ShirtChatBot from '@/components/ShirtChatBot';
import { ProductDetailsDialog } from '@/components/ProductDetailsDialog';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSession, signIn } from 'next-auth/react';
import { signOutUser } from '@/lib/sign-out-client';
import { QRCodeSVG } from 'qrcode.react';
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
  Collapse,
  IconButton,
  InputAdornment,
  LinearProgress,
  Paper,
  Skeleton,
  Snackbar,
  Slide,
  TextField,
  Toolbar,
  FormControlLabel,
  Switch,
  Typography,
  Popover,
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
  Copy,
  Expand,
  History,
  Home,
  LogIn,
  LogOut,
  Menu,
  Megaphone,
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
  ArrowLeftRight,
  TriangleAlert,
  Headphones,
  Bot,
  HandMetal,
  Share2,
  Link2,
  Percent,
  Ticket,
  Heart,
  ArrowUpDown,
  Star,
  ThumbsUp,
  Filter,
  Download,
  FileText,
  Users,
  Bell,
  BellOff,
  Eye,
  BarChart3,
  TrendingUp,
  Radio,
  ExternalLink,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { useNotification } from '@/components/NotificationContext';
import AnnouncementBar from '@/components/AnnouncementBar';
import EventBanner, { type ShopEvent } from '@/components/EventBanner';
import Footer from '@/components/Footer';
import TurnstileWidget from '@/components/TurnstileWidget';
import { ShopStatusBanner, getProductStatus, getShopStatus, SHOP_STATUS_CONFIG, type ShopStatusType } from '@/components/ShopStatusCard';
import type { SavedAddress } from '@/components/ProfileModal';

// ==================== DYNAMIC IMPORTS (Code Splitting) ====================
// Heavy components loaded on-demand to reduce initial bundle size
const PaymentFlow = dynamic(() => import('@/components/PaymentFlow'), { ssr: false });
const ProfileModal = dynamic(() => import('@/components/ProfileModal'), { ssr: false });
const CartDrawer = dynamic(() => import('@/components/CartDrawer'), { ssr: false });
const OrderHistoryDrawer = dynamic(() => import('@/components/OrderHistoryDrawer'), { ssr: false });
const CheckoutDialog = dynamic(() => import('@/components/CheckoutDialog'), { ssr: false });
const SupportChatWidget = dynamic(() => import('@/components/SupportChatWidget'), { ssr: false });
const PasskeyLoginButton = dynamic(() => import('@/components/PasskeyLoginButton'), { ssr: false });

// Common tag translations for well-known tags
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
import LoadingScreen from '@/components/LoadingScreen';
import ThemeToggle from '@/components/ThemeToggle';
import LanguageToggle from '@/components/LanguageToggle';
import LoginScreen from '@/components/LoginScreen';
import { 
  Product, 
  ShopConfig, 
  SIZES, 
  CATEGORY_LABELS as CONFIG_CATEGORY_LABELS, 
  CATEGORY_ICONS as CONFIG_CATEGORY_ICONS,
  getCategoryLabel,
  getSubTypeLabel,
  getCategoryIcon,
  getProductName,
  getProductDescription,
  getProductSortTime,
  sortProductsNewestFirst,
  DEFAULT_SHIRT_NAME,
  getProductShirtNameConfig,
  type ShirtNameConfig,
} from '@/lib/config';
import { productMatchesSearch, rankProductSearch } from '@/lib/product-search';
import { ShippingConfig } from '@/lib/shipping';
import { useRealtimeOrdersByEmail } from '@/hooks/useRealtimeOrders';
import { supabase } from '@/lib/supabase-client';
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
import { useThemeStore, ThemeMode } from '@/store/themeStore';
import { useWishlistStore } from '@/store/wishlistStore';
import { useRecentlyViewedStore } from '@/store/recentlyViewedStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useShopCatalog, useProductReviews } from '@/hooks/usePageData';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'รอดำเนินการ',
  PAID: 'ซื้อสำเร็จ',
  READY: 'พร้อมรับสินค้า',
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
  PENDING: '#ff9f0a',
  PAID: '#34c759',
  READY: '#34c759',
  SHIPPED: '#2997ff',
  COMPLETED: '#30d158',
  CANCELLED: '#ff453a',
  WAITING_PAYMENT: '#ff9f0a',
  AWAITING_PAYMENT: '#ff9f0a',
  UNPAID: '#ff9f0a',
  DRAFT: '#ff9f0a',
  VERIFYING: '#64d2ff',
  WAITING_SLIP: '#64d2ff',
  REJECTED: '#ff453a',
  FAILED: '#ff453a',
  REFUNDED: '#0077ED',
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
  // Legacy types
  CREW: 'เสื้อ Crew',
  HOODIE: 'ฮู้ดดี้',
  SHIRT: 'เสื้อเชิ้ต',
  TSHIRT: 'เสื้อยืด',
  POLO: 'เสื้อโปโล',
  JACKET: 'แจ็กเก็ต',
  CAP: 'หมวก',
  ACCESSORY: 'ของที่ระลึก',
  OTHER: 'อื่นๆ',
  // New types
  JERSEY: 'เสื้อกีฬา',
  STICKER: 'สติกเกอร์',
  KEYCHAIN: 'พวงกุญแจ',
  MUG: 'แก้ว',
  BADGE: 'เข็มกลัด/ตรา',
  POSTER: 'โปสเตอร์',
  NOTEBOOK: 'สมุด',
  CAMP_REGISTRATION: 'ค่าสมัครค่าย',
  EVENT_TICKET: 'ตั๋วเข้างาน',
  CUSTOM: 'กำหนดเอง',
};

// Category labels for new category system - use from config, extend with fallback
const CATEGORY_LABELS: Record<string, string> = {
  ...CONFIG_CATEGORY_LABELS,
};

// Category icons - use from config, extend with fallback
const CATEGORY_ICONS: Record<string, string> = {
  ...CONFIG_CATEGORY_ICONS,
};

// Helper: Get category from legacy type
const getCategoryFromType = (type: string): string => {
  switch (type) {
    case 'JERSEY':
    case 'CREW':
    case 'HOODIE':
    case 'TSHIRT':
    case 'POLO':
    case 'JACKET':
    case 'CAP':
      return 'APPAREL';
    case 'STICKER':
    case 'KEYCHAIN':
    case 'MUG':
    case 'BADGE':
    case 'POSTER':
    case 'NOTEBOOK':
    case 'ACCESSORY':
      return 'MERCHANDISE';
    case 'CAMP_REGISTRATION':
      return 'CAMP_FEE';
    case 'EVENT_TICKET':
      return 'EVENT';
    default:
      return 'OTHER';
  }
};

// Helper: Check if product requires size selection
const productRequiresSize = (product: Product): boolean => {
  if (product.options?.requiresSize === false) return false;
  const category = (product as any).category || getCategoryFromType(product.type);
  return category === 'APPAREL';
};

const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL', '7XL', '8XL', '9XL', '10XL'] as const;
const SIZE_MEASUREMENTS: Record<(typeof SIZE_ORDER)[number], { chest: number; length: number }> = {
  XS: { chest: 34, length: 24 },
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
  '8XL': { chest: 56, length: 35 },
  '9XL': { chest: 58, length: 36 },
  '10XL': { chest: 60, length: 37 },
};

const ANNOUNCEMENT_COLOR_MAP: Record<string, string> = {
  blue: '#0071e3',
  red: '#ff453a',
  green: '#30d158',
  emerald: '#34c759',
  orange: '#ff9f0a',
};

// Shop status helpers imported from ShopStatusCard component

// Helper to get announcement color (supports both named colors and hex)
const getAnnouncementColor = (color: string | undefined): string => {
  if (!color) return '#0071e3';
  // If it's a hex color, return it directly
  if (color.startsWith('#')) return color;
  // Otherwise, look up in the map
  return ANNOUNCEMENT_COLOR_MAP[color] || '#0071e3';
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
  pattern?: string;
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
    variantId?: string;
    variantName?: string;
    pattern?: string;
  };
  shopId?: string;
  shopSlug?: string;
};

type PublicShopCatalogEntry = {
  id: string;
  slug: string;
  name: string;
  nameEn?: string;
  logoUrl?: string;
  isOpen?: boolean;
  products?: Product[];
  events?: ShopEvent[];
  shirtNameConfig?: ShirtNameConfig;
  nameValidation?: ShopConfig['nameValidation'];
  shippingOptions?: unknown[];
  promoCodes?: ShopConfig['promoCodes'];
  settings?: { isOpen?: boolean };
};

type OrderHistoryItem = {
  productId?: string;
  name?: string;
  productName?: string;
  size?: string;
  qty?: number;
  quantity?: number;
  customName?: string;
  customNumber?: string;
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
  // Shipping info for proper QR code display
  shippingFee?: number;
  shippingOption?: string;
  trackingNumber?: string;
  shippingProvider?: string;
};

type Interval = ReturnType<typeof setInterval>;

type LeanProduct = Pick<Product, 'id' | 'name' | 'description' | 'type' | 'images' | 'basePrice' | 'sizePricing' | 'isActive' | 'startDate' | 'endDate'>;
type LeanConfig = {
  isOpen: boolean;
  closeDate?: string;
  openDate?: string;
  announcements: ShopConfig['announcements'];
  announcementHistory?: ShopConfig['announcementHistory'];
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
const normalizeEngName = (value: string) => value.replace(/[^\x20-\x7E]/g, '').toUpperCase().slice(0, 7).trim();

/** Normalize shirt custom name based on ShirtNameConfig */
const normalizeShirtName = (value: string, cfg: ShirtNameConfig = DEFAULT_SHIRT_NAME): string => {
  // Build allowed character pattern
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
const isThaiText = (value: string) => /^[\u0E00-\u0E7F\s]+$/.test(value.trim());
const onlyDigitsPhone = (value: string) => value.replace(/\D/g, '').slice(0, 12);
const getBasePrice = (p: Product) => {
  const prices = Object.values(p.sizePricing || {});
  if (prices.length === 0) return p.basePrice;
  return Math.min(...prices);
};

/** คำนวณราคาส่วนลดจากอีเวนต์ที่กำลังดำเนินอยู่ */
function getEventDiscount(productId: string, events: ShopEvent[] | undefined): { discountedPrice: (original: number) => number; discountLabel: string; eventTitle: string; discountType?: 'percent' | 'fixed'; discountValue?: number } | null {
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
    discountType: active.discountType,
    discountValue: active.discountValue,
  };
}

/** สร้าง slug จากชื่อสินค้า */
function generateSlug(name: string, id: string): string {
  return name.replace(/[^\u0E00-\u0E7Fa-zA-Z0-9\s-]/g, '').replace(/\s+/g, '-').toLowerCase() || id;
}

/** สร้าง product link (short format) */
function getProductLink(product: Product): string {
  return `${typeof window !== 'undefined' ? window.location.origin : ''}/?p=${encodeURIComponent(product.id)}`;
}

export default function HomePage() {
  const { data: session, status } = useSession();
  const isMobile = useMediaQuery('(max-width:600px)');

  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  
  // Chatbot dialog state
  const [chatbotOpen, setChatbotOpen] = useState(false);
  // Support chat & chat menu state
  const [supportChatOpen, setSupportChatOpen] = useState(false);
  const [chatMenuAnchor, setChatMenuAnchor] = useState<HTMLElement | null>(null);

  // Logout confirmation
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [switchAccountOpen, setSwitchAccountOpen] = useState(false);
  const [availableProviders, setAvailableProviders] = useState<string[]>(['google']);

  const [config, setConfig] = useState<ShopConfig | null>(null);
  const [shippingConfig, setShippingConfig] = useState<ShippingConfig | null>(null);
  
  // ==================== DEV MODE TEST PRODUCTS ====================
  const isDev = process.env.NODE_ENV === 'development';
  const devTestProducts: Product[] = isDev ? [
    // เสื้อผ้า - APPAREL
    {
      id: 'dev-jersey-1',
      name: '[DEV] เสื้อกีฬา SCC 2026',
      nameEn: '[DEV] SCC Jersey 2026',
      description: 'เสื้อกีฬารุ่นใหม่ล่าสุด\nเนื้อผ้า Cool Elite\nระบายอากาศดี',
      descriptionEn: 'Latest jersey model\nCool Elite fabric\nGreat breathability',
      category: 'APPAREL',
      subType: 'JERSEY',
      type: 'JERSEY',
      basePrice: 350,
      sizePricing: { 'S': 350, 'M': 350, 'L': 350, 'XL': 370, '2XL': 390 },
      isActive: true,
      options: { hasCustomName: true, hasCustomNumber: true, hasLongSleeve: true, longSleevePrice: 50 },
      images: ['https://placehold.co/400x400/6366f1/white?text=Jersey+SCC'],
      coverImage: 'https://placehold.co/400x400/6366f1/white?text=Jersey+SCC',
    },
    {
      id: 'dev-crew-1',
      name: '[DEV] เสื้อ Crew Neck รุ่น Classic',
      nameEn: '[DEV] Crew Neck Classic',
      description: 'เสื้อ Crew Neck สไตล์คลาสสิค',
      descriptionEn: 'Classic style Crew Neck',
      category: 'APPAREL',
      subType: 'CREW',
      type: 'CREW',
      basePrice: 299,
      sizePricing: { 'S': 299, 'M': 299, 'L': 299, 'XL': 319 },
      isActive: true,
      options: { hasCustomName: true, hasCustomNumber: false, hasLongSleeve: false },
      images: ['https://placehold.co/400x400/10b981/white?text=Crew+Neck'],
    },
    // ของที่ระลึก - MERCHANDISE (with variants)
    {
      id: 'dev-merch-1',
      name: '[DEV] แก้วน้ำ SCC Limited',
      nameEn: '[DEV] SCC Limited Tumbler',
      description: 'แก้วน้ำเก็บความเย็น 24 ชม.\nขนาด 600ml',
      descriptionEn: 'Insulated tumbler, keeps cold 24 hrs\n600ml capacity',
      category: 'MERCHANDISE',
      subType: 'MUG',
      type: 'OTHER',
      basePrice: 250,
      isActive: true,
      variants: [
        { id: 'var-black', name: 'สีดำ', price: 250, stock: 50, isActive: true },
        { id: 'var-white', name: 'สีขาว', price: 250, stock: 30, isActive: true },
        { id: 'var-blue', name: 'สีน้ำเงิน', price: 280, stock: 20, isActive: true },
        { id: 'var-gold', name: 'สีทอง (Limited)', price: 350, stock: 5, isActive: true },
      ],
      images: ['https://placehold.co/400x400/f59e0b/white?text=Mug+Limited'],
    },
    {
      id: 'dev-merch-2',
      name: '[DEV] พวงกุญแจ SCC',
      nameEn: '[DEV] SCC Keychain',
      description: 'พวงกุญแจโลหะ พร้อมสายคล้อง',
      descriptionEn: 'Metal keychain with lanyard',
      category: 'MERCHANDISE',
      subType: 'KEYCHAIN',
      type: 'OTHER',
      basePrice: 79,
      isActive: true,
      variants: [
        { id: 'var-silver', name: 'สีเงิน', price: 79, stock: 100, isActive: true },
        { id: 'var-rose-gold', name: 'สี Rose Gold', price: 99, stock: 50, isActive: true },
      ],
      images: ['https://placehold.co/400x400/ec4899/white?text=Keychain'],
    },
    {
      id: 'dev-merch-3',
      name: '[DEV] สติกเกอร์ SCC Set',
      nameEn: '[DEV] SCC Sticker Set',
      description: 'เซ็ตสติกเกอร์ 10 ชิ้น\nกันน้ำ กันแดด',
      descriptionEn: '10-piece sticker set\nWaterproof & UV resistant',
      category: 'MERCHANDISE',
      subType: 'STICKER',
      type: 'OTHER',
      basePrice: 50,
      isActive: true,
      images: ['https://placehold.co/400x400/8b5cf6/white?text=Sticker+Set'],
    },
    // ค่าสมัครค่าย - CAMP_FEE
    {
      id: 'dev-camp-1',
      name: '[DEV] ค่ายอาสา SCC รุ่น 15',
      nameEn: '[DEV] SCC Volunteer Camp #15',
      description: 'ค่ายอาสาพัฒนาชุมชน\nรวมอาหาร ที่พัก และเสื้อค่าย',
      descriptionEn: 'Community volunteer camp\nIncludes meals, lodging & camp shirt',
      category: 'CAMP_FEE',
      subType: 'CAMP_REGISTRATION',
      type: 'OTHER',
      basePrice: 1500,
      isActive: true,
      campInfo: {
        campName: 'ค่ายอาสา SCC รุ่น 15',
        campDate: '2026-03-15',
        location: 'โรงเรียนบ้านห้วยน้ำใส จ.พังงา',
        organizer: 'ชมรม SCC',
        maxParticipants: 50,
        currentParticipants: 32,
        requirements: 'นิสิตชั้นปี 1-4',
      },
      variants: [
        { id: 'var-full', name: 'สมาชิกเต็มรูปแบบ', price: 1500, stock: 18, isActive: true },
        { id: 'var-day', name: 'สมาชิกรายวัน', price: 500, stock: 10, isActive: true },
        { id: 'var-staff', name: 'ทีมงาน (ไม่มีค่าใช้จ่าย)', price: 0, stock: 5, isActive: true },
      ],
      images: ['https://placehold.co/400x400/22c55e/white?text=Camp+15'],
    },
    // กิจกรรม - EVENT
    {
      id: 'dev-event-1',
      name: '[DEV] บัตรงาน SCC Night',
      nameEn: '[DEV] SCC Night Ticket',
      description: 'งานเลี้ยงสังสรรค์ประจำปี\nรวมอาหารและเครื่องดื่ม',
      descriptionEn: 'Annual party\nIncludes food and drinks',
      category: 'EVENT',
      subType: 'EVENT_TICKET',
      type: 'OTHER',
      basePrice: 200,
      isActive: true,
      eventInfo: {
        eventName: 'SCC Night 2026',
        eventDate: '2026-04-20T18:00',
        venue: 'หอประชุมใหญ่ มหาวิทยาลัย',
        organizer: 'สโมสรนิสิต SCC',
      },
      variants: [
        { id: 'var-standard', name: 'บัตรทั่วไป', price: 200, stock: 100, isActive: true },
        { id: 'var-vip', name: 'บัตร VIP (โต๊ะหน้า)', price: 500, stock: 20, isActive: true },
        { id: 'var-couple', name: 'บัตรคู่ (2 ที่นั่ง)', price: 350, stock: 30, isActive: true },
      ],
      images: ['https://placehold.co/400x400/ef4444/white?text=SCC+Night'],
    },
    // หมวดหมู่กำหนดเอง - Custom Category
    {
      id: 'dev-custom-1',
      name: '[DEV] อุปกรณ์กีฬา SCC',
      nameEn: '[DEV] SCC Sports Equipment',
      description: 'ลูกฟุตบอล มาตรฐาน FIFA',
      descriptionEn: 'FIFA standard football',
      category: 'อุปกรณ์กีฬา', // Custom category
      subType: 'ลูกฟุตบอล', // Custom subType
      type: 'OTHER',
      basePrice: 890,
      isActive: true,
      variants: [
        { id: 'var-size5', name: 'ขนาด 5 (มาตรฐาน)', price: 890, stock: 15, isActive: true },
        { id: 'var-size4', name: 'ขนาด 4 (เยาวชน)', price: 690, stock: 10, isActive: true },
      ],
      images: ['https://placehold.co/400x400/3b82f6/white?text=Football'],
    },
    {
      id: 'dev-custom-2',
      name: '[DEV] กระเป๋า SCC Bag',
      nameEn: '[DEV] SCC Bag',
      description: 'กระเป๋าสะพายข้าง\nกันน้ำ ทนทาน',
      descriptionEn: 'Crossbody bag\nWaterproof & durable',
      category: 'กระเป๋า', // Custom category
      subType: 'กระเป๋าสะพายข้าง', // Custom subType
      type: 'OTHER',
      basePrice: 450,
      isActive: true,
      variants: [
        { id: 'var-small', name: 'ขนาดเล็ก', price: 350, stock: 25, isActive: true },
        { id: 'var-medium', name: 'ขนาดกลาง', price: 450, stock: 20, isActive: true },
        { id: 'var-large', name: 'ขนาดใหญ่', price: 550, stock: 15, isActive: true },
      ],
      images: ['https://placehold.co/400x400/06b6d4/white?text=SCC+Bag'],
    },
  ] : [];
  // ==================== END DEV TEST PRODUCTS ====================
  
  const [announcements, setAnnouncements] = useState<ShopConfig['announcements']>([]);
  const [announcementHistory, setAnnouncementHistory] = useState<ShopConfig['announcementHistory']>([]);
  const [showAnnouncementHistory, setShowAnnouncementHistory] = useState(false);
  const [showAnnouncementPopup, setShowAnnouncementPopup] = useState(true); // For floating popup
  const [currentAnnouncementIndex, setCurrentAnnouncementIndex] = useState(0); // For cycling announcements
  const [showAnnouncementImage, setShowAnnouncementImage] = useState(false); // For image lightbox
  const [isShopOpen, setIsShopOpen] = useState(true);
  // Health of the public config realtime channel — gates fallback polling.
  // (realtimeConnected from useRealtimeOrders only reflects the orders channel)
  const [configRealtimeOk, setConfigRealtimeOk] = useState(false);
  const configFetchInFlight = useRef(false);
  const configPollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [navHandedness, setNavHandedness] = useState<'right' | 'left'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('scc_nav_hand') as 'right' | 'left') || 'right';
    }
    return 'right';
  });
  const toggleNavHandedness = useCallback(() => {
    setNavHandedness(prev => {
      const next = prev === 'right' ? 'left' : 'right';
      localStorage.setItem('scc_nav_hand', next);
      return next;
    });
  }, []);
  const [showCart, setShowCart] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [showOrderDialog, setShowOrderDialog] = useState(false);
  const [showQRFullscreen, setShowQRFullscreen] = useState<string | null>(null); // Store order ref for fullscreen QR
  const paymentOpenerRef = useRef<((ref: string) => void) | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'home' | 'cart' | 'history' | 'profile'>('home');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [activeShopMenu, setActiveShopMenu] = useState<'main' | string>('main');
  const { shops: subShopCatalogRaw } = useShopCatalog();
  const subShopCatalog = subShopCatalogRaw as PublicShopCatalogEntry[];
  const [selectedProductContext, setSelectedProductContext] = useState<{ shopId?: string; shopSlug?: string }>({});
  const [productSearch, setProductSearch] = useState('');
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 0]);
  const [sortBy, setSortBy] = useState<'default' | 'price-low' | 'price-high' | 'newest' | 'name'>('default');
  const [showOnlyAvailable, setShowOnlyAvailable] = useState(false);
  const [showWishlistDrawer, setShowWishlistDrawer] = useState(false);
  const [showRecentlyViewed, setShowRecentlyViewed] = useState(false);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [productReviews, setProductReviews] = useState<Record<string, Array<{ id: string; userName: string; userImage?: string; rating: number; comment: string; date: string; verified: boolean; helpful: number }>>>({});
  const [editingCartItem, setEditingCartItem] = useState<CartItem | null>(null);
  const [bulkOrderOpen, setBulkOrderOpen] = useState(false);
  const [bulkStep, setBulkStep] = useState(0); // 0=sizes, 1=names, 2=preview
  const [bulkSizes, setBulkSizes] = useState<Record<string, number>>({}); // size -> qty
  const [bulkNames, setBulkNames] = useState('');
  const [bulkLongSleeve, setBulkLongSleeve] = useState(false);
  const [bulkAssignments, setBulkAssignments] = useState<Array<{ name: string; size: string }>>([]); // name->size

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const { reviews: selectedProductReviewsList } = useProductReviews(selectedProduct?.id);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [bottomPanelCollapsed, setBottomPanelCollapsed] = useState(true);
  const [productOptions, setProductOptions] = useState<ProductOptions>({
    size: '',
    quantity: 1,
    customName: '',
    customNumber: '',
    isLongSleeve: false,
    pattern: '',
  });

  const sizeSelectorRef = useRef<HTMLDivElement>(null);
  const customNameInputRef = useRef<HTMLInputElement>(null);
  const customNumberInputRef = useRef<HTMLInputElement>(null);
  const patternSelectorRef = useRef<HTMLDivElement>(null);

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
    profileImage: '',
  });
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [orderHistory, setOrderHistory] = useState<OrderHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingHistoryMore, setLoadingHistoryMore] = useState(false);
  const [historyCursor, setHistoryCursor] = useState<string | null>(null);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  // True once the full history list has been fetched from the server at least
  // once. Orders added locally (after checkout / realtime INSERT) do NOT count —
  // gating "should we fetch?" on orderHistory.length caused the drawer to show
  // only those few local orders and never load the rest.
  const historyLoadedRef = useRef(false);
  // Stable handle to the latest loadOrderHistory for use inside effects
  const loadOrderHistoryRef = useRef<(opts?: { append?: boolean; silent?: boolean }) => void>(() => {});
  const [historyFilter, setHistoryFilter] = useState<'ALL' | 'WAITING_PAYMENT' | 'COMPLETED' | 'SHIPPED' | 'RECEIVED' | 'CANCELLED'>('ALL');
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
  const [turnstileToken, setTurnstileToken] = useState<string>('');

  // Theme sync with DB
  const themeMode = useThemeStore((s) => s.mode);
  const prevThemeModeRef = useRef<ThemeMode | null>(null);

  // Wishlist & Recently Viewed
  const wishlistStore = useWishlistStore();
  const recentlyViewedStore = useRecentlyViewedStore();

  const { t, lang } = useTranslation();
  const STATUS_LABELS_I18N: Record<string, string> = t.status as unknown as Record<string, string>;
  const TYPE_LABELS_I18N: Record<string, string> = t.type as unknown as Record<string, string>;

  const [navHidden, setNavHidden] = useState(false);
  const lastScrollYRef = useRef(0);
  const scrollIdleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showRefreshDroplet, setShowRefreshDroplet] = useState(false);
  const hideNavBars = navHidden || productDialogOpen;

  const [toasts, setToasts] = useState<Toast[]>([]);
  const [inlineNotice, setInlineNotice] = useState<Toast | null>(null);
  const toastTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const ToastTransition = (props: any) => <Slide {...props} direction="down" />;

  // Live stream status for navbar indicator (shared SWR — no duplicate /api/live polling)
  const { isActive: isLiveActive, liveTitle, openLiveStream } = useLiveStreamContext();

  const pendingOrderCount = useMemo(() => {
    const EXPIRY_MS = 24 * 60 * 60 * 1000;
    return orderHistory.filter((order) => {
      const status = normalizeStatus(order.status);
      if (!PAYABLE_STATUSES.includes(status)) return false;
      if (!order.date) return true;
      const created = new Date(order.date).getTime();
      return Date.now() - created < EXPIRY_MS;
    }).length;
  }, [orderHistory]);

  const historyBadgeSx = {
    '& .MuiBadge-badge': {
      fontSize: '0.6rem',
      minWidth: 16,
      height: 16,
      fontWeight: 700,
    },
  } as const;

  const bottomTabs = useMemo(() => {
    const leftTabs = [
      { key: 'home', label: t.nav.home, icon: <Home size={24} />, center: false },
      {
        key: 'cart',
        label: t.nav.cart,
        icon: (
          <Badge badgeContent={cart.length} color="error">
            <ShoppingCart size={24} />
          </Badge>
        ),
        center: false,
      },
    ];
    const centerTab = { key: 'chat', label: t.nav.chat, icon: <Headphones size={28} />, center: true };
    const rightTabs = [
      {
        key: 'history',
        label: t.nav.history,
        icon: (
          <Badge
            badgeContent={pendingOrderCount > 0 ? pendingOrderCount : undefined}
            color="warning"
            max={99}
            invisible={pendingOrderCount === 0}
            sx={historyBadgeSx}
          >
            <History size={24} />
          </Badge>
        ),
        center: false,
      },
      { key: 'profile', label: t.nav.profile, icon: <User size={24} />, center: false },
    ];
    // For left-handed: swap sides so primary actions are on the left
    if (navHandedness === 'left') {
      return [...rightTabs.reverse(), centerTab, ...leftTabs.reverse()];
    }
    return [...leftTabs, centerTab, ...rightTabs];
  }, [cart.length, pendingOrderCount, navHandedness, t, lang]);


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
          sizes="48px"
          className="theme-logo"
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
            color: 'var(--foreground)',
            textTransform: 'uppercase',
            fontSize: { xs: '1rem', sm: '1.25rem' },
          }}
        >
          SCC Shop
        </Typography>
      )}
    </Box>
  );

  // ==================== SHOP STATUS CARD COMPONENT ====================
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    apiFetch('/api/auth/available-providers')
      .then(res => res.json())
      .then(data => {
        if (data.providers) setAvailableProviders(data.providers);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let rafId: number | null = null;
    const onScroll = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const currentY = window.scrollY;
        const delta = Math.abs(currentY - lastScrollYRef.current);
        lastScrollYRef.current = currentY;
        if (delta < 2) return;
        setNavHidden(true);
        if (scrollIdleTimer.current) clearTimeout(scrollIdleTimer.current);
        scrollIdleTimer.current = setTimeout(() => setNavHidden(false), 220);
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (rafId) cancelAnimationFrame(rafId);
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

  const refreshConfig = useCallback(async (fresh = false) => {
    // fresh = realtime signaled a change: bypass the in-flight guard and all
    // caches so we never miss the update
    if (configFetchInFlight.current && !fresh) return;
    configFetchInFlight.current = true;
    try {
      const res = await getPublicConfig(fresh);
      if (res.status === 'success') {
        const cfg = (res.data as ShopConfig | undefined) ?? (res.config as ShopConfig | undefined);
        if (cfg) {
          const lean = sanitizeConfig(cfg);
          cacheConfig(lean);
          // Only update state if data actually changed to prevent flickering
          setConfig(prev => {
            if (!prev) return cfg;
            // Simple comparison of key fields
            const changed = prev.isOpen !== cfg.isOpen || 
              JSON.stringify(prev.products) !== JSON.stringify(cfg.products) ||
              JSON.stringify(prev.announcements) !== JSON.stringify(cfg.announcements);
            return changed ? cfg : prev;
          });
          setAnnouncements(prev => {
            const nextJson = JSON.stringify(cfg.announcements || []);
            const prevJson = JSON.stringify(prev);
            return prevJson === nextJson ? prev : (cfg.announcements || []);
          });
          setAnnouncementHistory(prev => {
            const nextJson = JSON.stringify(cfg.announcementHistory || []);
            const prevJson = JSON.stringify(prev);
            return prevJson === nextJson ? prev : (cfg.announcementHistory || []);
          });
          // Calculate actual shop open status based on isOpen flag AND closeDate
          const shopStatus = getShopStatus(cfg.isOpen, cfg.closeDate, cfg.openDate);
          const actuallyOpen = shopStatus === 'OPEN';
          setIsShopOpen(prev => prev === actuallyOpen ? prev : actuallyOpen);
        } else {
          console.warn('No config returned from getPublicConfig');
        }
      } else {
        console.error('Failed to load config:', res.message || res.error);
      }
      
      // Fetch shipping config for cart display
      try {
        const shippingRes = await apiFetch('/api/shipping/options');
        if (shippingRes.ok) {
          const shippingData = await shippingRes.json();
          setShippingConfig(shippingData);
        }
      } catch (shippingErr) {
        console.error('Failed to load shipping config:', shippingErr);
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
          setAnnouncements(cached.announcements || []);
          setAnnouncementHistory(cached.announcementHistory || []);
          // Calculate actual shop open status based on isOpen flag AND closeDate
          const cachedCfg = cached as unknown as ShopConfig;
          const shopStatus = getShopStatus(cachedCfg.isOpen, cachedCfg.closeDate, cachedCfg.openDate);
          setIsShopOpen(shopStatus === 'OPEN');
          
          // Preload product images from cache (first image of each product)
          const imageUrls = (cachedCfg.products || [])
            .flatMap((p: Product) => p.images?.slice(0, 1) || [])
            .filter(Boolean);
          if (imageUrls.length > 0) {
            preloadImages(imageUrls).catch(() => {});
          }
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

  // Auto-open product from URL query param (?p=id or legacy ?product=slug-or-id)
  useEffect(() => {
    if (!config?.products?.length || loading) return;
    const params = new URLSearchParams(window.location.search);
    const productParam = params.get('p') || params.get('product');
    if (!productParam) return;
    const decoded = decodeURIComponent(productParam);
    const found = config.products.find(p =>
      p.id === decoded ||
      p.slug === decoded ||
      generateSlug(p.name, p.id) === decoded
    );
    if (found && isProductCurrentlyOpen(found)) {
      handleSelectProduct(found);
      // Clean URL without reload
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [config?.products, loading]);

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
            profileImage: typeof profile.profileImage === 'string' ? profile.profileImage : '',
          };
          setOrderData((prev) => ({ ...prev, ...sanitizedProfile, email: session.user?.email || prev.email }));

          // Load saved addresses
          if (Array.isArray(profile.savedAddresses)) {
            setSavedAddresses(profile.savedAddresses);
          }

          // Load theme preference from DB
          if (profile.theme && ['light', 'dark', 'system'].includes(profile.theme)) {
            const { setMode, mode } = useThemeStore.getState();
            if (mode !== profile.theme) {
              setMode(profile.theme as ThemeMode);
            }
            // Initialize ref so the auto-save effect knows the baseline
            prevThemeModeRef.current = profile.theme as ThemeMode;
          } else {
            // No theme in DB yet — set current mode as baseline
            prevThemeModeRef.current = useThemeStore.getState().mode;
          }

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

  // Recalculate cart prices when events change (auto-revert discounts when event ends)
  useEffect(() => {
    if (!config?.products?.length || cart.length === 0) return;
    const events = config.events as ShopEvent[] | undefined;
    let needsUpdate = false;
    const updatedCart = cart.map(item => {
      const product = config.products.find(p => p.id === item.productId);
      if (!product) return item;

      // Determine base price from size/variant
      let basePrice: number;
      if (item.options?.variantId) {
        const variant = (product as any).variants?.find((v: any) => v.id === item.options?.variantId);
        basePrice = variant?.price || product.basePrice;
      } else if (item.size && item.size !== '-') {
        basePrice = product.sizePricing?.[item.size] ?? product.basePrice;
      } else {
        basePrice = product.basePrice;
      }

      // Apply event discount if still active
      const discount = getEventDiscount(product.id, events);
      if (discount) {
        basePrice = discount.discountedPrice(basePrice);
      }

      // Add long sleeve fee
      const longSleeveFee = item.options?.isLongSleeve
        ? (product.options?.longSleevePrice ?? 50)
        : 0;

      const correctPrice = basePrice + longSleeveFee;
      if (item.unitPrice !== correctPrice) {
        needsUpdate = true;
        return { ...item, unitPrice: correctPrice };
      }
      return item;
    });

    if (needsUpdate) {
      saveCart(updatedCart);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config?.events, config?.products, cart.length]);

  // Auto-save theme to DB when user changes it
  useEffect(() => {
    // Skip if ref hasn't been initialized yet (profile not loaded)
    if (prevThemeModeRef.current === null) return;
    // Skip if theme hasn't actually changed
    if (prevThemeModeRef.current === themeMode) return;
    prevThemeModeRef.current = themeMode;
    // Save to DB if logged in
    const email = session?.user?.email;
    if (email) {
      saveProfileApi(email, { theme: themeMode }).catch((err) => {
        console.error('Failed to save theme preference:', err);
      });
    }
  }, [themeMode, session?.user?.email]);

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

  // Unified product select handler — batches all state into one render
  const handleSelectProduct = useCallback((product: Product, shopContext?: { shopId?: string; shopSlug?: string }) => {
    const sizeKeys = Object.keys(product.sizePricing || {});
    const defaultSize = sizeKeys.length > 0 ? sizeKeys[0] : t.common.freeSize;
    setSelectedProduct(product);
    setSelectedProductContext(shopContext || {});
    setProductOptions({ size: defaultSize, quantity: 1, customName: '', customNumber: '', isLongSleeve: false, pattern: '' });
    setProductDialogOpen(true);
    // Track recently viewed
    recentlyViewedStore.addItem(product.id);
  }, [t.common.freeSize]);

  const catalogContext = useMemo(() => {
    if (activeShopMenu === 'main') {
      return {
        shopId: undefined as string | undefined,
        shopSlug: undefined as string | undefined,
        shopName: t.storefront.mainShop,
        products: config?.products || [],
        events: config?.events as ShopEvent[] | undefined,
        isOpen: isShopOpen,
        shirtNameConfig: config?.shirtNameConfig,
        nameValidation: config?.nameValidation,
        shippingOptions: (config as { shippingOptions?: unknown[] })?.shippingOptions,
        promoCodes: config?.promoCodes,
      };
    }
    const shop = subShopCatalog.find((s) => s.slug === activeShopMenu);
    if (!shop) {
      return {
        shopId: undefined,
        shopSlug: undefined,
        shopName: '',
        products: [] as Product[],
        events: undefined as ShopEvent[] | undefined,
        isOpen: false,
        shirtNameConfig: undefined,
        nameValidation: undefined,
        shippingOptions: undefined,
        promoCodes: undefined,
      };
    }
    return {
      shopId: shop.id,
      shopSlug: shop.slug,
      shopName: lang === 'en' && shop.nameEn ? shop.nameEn : shop.name,
      products: (shop.products || []).filter((p) => p.isActive !== false) as Product[],
      events: shop.events as ShopEvent[] | undefined,
      isOpen: shop.isOpen ?? shop.settings?.isOpen ?? true,
      shirtNameConfig: shop.shirtNameConfig,
      nameValidation: shop.nameValidation,
      shippingOptions: shop.shippingOptions,
      promoCodes: shop.promoCodes,
    };
  }, [activeShopMenu, config, subShopCatalog, lang, isShopOpen, t.storefront.mainShop]);

  const activeProductCatalog = useMemo(() => {
    if (selectedProductContext.shopSlug) {
      const shop = subShopCatalog.find((s) => s.slug === selectedProductContext.shopSlug);
      return {
        events: shop?.events as ShopEvent[] | undefined,
        shirtNameConfig: shop?.shirtNameConfig,
        products: (shop?.products || []) as Product[],
        isOpen: shop?.isOpen ?? shop?.settings?.isOpen ?? true,
        shopId: shop?.id,
        shopSlug: shop?.slug,
      };
    }
    return {
      events: config?.events as ShopEvent[] | undefined,
      shirtNameConfig: config?.shirtNameConfig,
      products: config?.products || [],
      isOpen: isShopOpen,
      shopId: undefined,
      shopSlug: undefined,
    };
  }, [selectedProductContext.shopSlug, subShopCatalog, config?.events, config?.shirtNameConfig, config?.products, isShopOpen]);

  const allCatalogProducts = useMemo(() => {
    const main = config?.products || [];
    const sub = subShopCatalog.flatMap((s) => s.products || []);
    return [...main, ...sub] as Product[];
  }, [config?.products, subShopCatalog]);

  const findProductForCartItem = useCallback((item: CartItem) => {
    if (item.shopSlug) {
      return subShopCatalog
        .find((s) => s.slug === item.shopSlug)
        ?.products?.find((p) => p.id === item.productId) as Product | undefined;
    }
    return config?.products?.find((p) => p.id === item.productId);
  }, [config?.products, subShopCatalog]);

  const cartCheckoutOpen = useMemo(() => {
    const slug = cart[0]?.shopSlug;
    if (!slug) return isShopOpen;
    const shop = subShopCatalog.find((s) => s.slug === slug);
    return shop?.isOpen ?? shop?.settings?.isOpen ?? true;
  }, [cart, subShopCatalog, isShopOpen]);

  const checkoutShopId = useMemo(() => {
    const slug = cart[0]?.shopSlug;
    if (!slug) return undefined;
    return cart[0]?.shopId || subShopCatalog.find((s) => s.slug === slug)?.id;
  }, [cart, subShopCatalog]);

  // Sync SWR-cached reviews into local state (supports optimistic updates after submit)
  useEffect(() => {
    if (!selectedProduct?.id) return;
    setProductReviews((prev) => ({
      ...prev,
      [selectedProduct.id]: selectedProductReviewsList,
    }));
  }, [selectedProduct?.id, selectedProductReviewsList]);

  //  Auto-cycle through announcements
  useEffect(() => {
    const enabledAnnouncements = announcements?.filter(a => a.enabled) || [];
    if (enabledAnnouncements.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentAnnouncementIndex(prev => (prev + 1) % enabledAnnouncements.length);
    }, 8000); // Change every 8 seconds
    
    return () => clearInterval(interval);
  }, [announcements]);

  //  Check if announcement was dismissed in this session
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const dismissed = sessionStorage.getItem('announcementDismissed');
    if (dismissed === 'true') {
      setShowAnnouncementPopup(false);
    }
  }, []);

  //  Auto-close product dialog when shop becomes closed
  useEffect(() => {
    if (!activeProductCatalog.isOpen && productDialogOpen) {
      setProductDialogOpen(false);
      setSelectedProduct(null);
      setSelectedProductContext({});
      setProductOptions({ size: '', quantity: 1, customName: '', customNumber: '', isLongSleeve: false, pattern: '' });
      showToast('warning', t.checkout.shopClosedWarning);
    }
    // Also close order dialog if shop is closed
    if (!cartCheckoutOpen && showOrderDialog) {
      setShowOrderDialog(false);
      showToast('warning', t.checkout.shopClosedWarning);
    }
  }, [activeProductCatalog.isOpen, cartCheckoutOpen, productDialogOpen, showOrderDialog, showToast, t.checkout.shopClosedWarning]);

  // Auto-close product dialog if active product status changes in shop products (e.g. disabled or out of stock)
  useEffect(() => {
    if (!selectedProduct) return;
    const products = selectedProductContext.shopSlug
      ? (subShopCatalog.find((s) => s.slug === selectedProductContext.shopSlug)?.products || [])
      : (config?.products || []);
    if (!products.length) return;
    const updatedProduct = products.find((p) => p.id === selectedProduct.id);
    const isOutOfStock = updatedProduct && (
      (updatedProduct.stock !== null && updatedProduct.stock !== undefined && updatedProduct.stock <= 0) ||
      (updatedProduct.variants && updatedProduct.variants.length > 0 && updatedProduct.variants.every(v => v.stock !== null && v.stock !== undefined && v.stock <= 0))
    );
    if (!updatedProduct || getProductStatus(updatedProduct) !== 'OPEN' || isOutOfStock) {
      showToast('warning', lang === 'en' ? 'This product is no longer available' : 'สินค้านี้ไม่พร้อมจำหน่ายแล้ว');
      setSelectedProduct(null);
      setProductDialogOpen(false);
    }
  }, [selectedProduct, selectedProductContext.shopSlug, subShopCatalog, config?.products, lang, showToast]);

  //  Realtime config updates via Supabase + fallback polling for visibility changes
  // The realtime payload is a lightweight signal ({ updatedAt, isOpen }) —
  // we refetch the full sanitized config from the API (bypassing CDN cache).
  const handleConfigChange = useCallback((signal?: { updatedAt?: string; isOpen?: boolean | null }) => {
    console.log('[Realtime] Config change signal received. Open status:', signal?.isOpen);
    refreshConfig(true);
  }, [refreshConfig]);

  const handleOrderChange = useCallback((change: { type: string; order: any; oldOrder?: any }) => {
    console.log('[Realtime] Order change received:', change.type);
    
    // Helper to calculate shipping fee from realtime data
    const calculateShippingFee = (order: any): number | undefined => {
      if (order.shipping_fee !== undefined && order.shipping_fee !== null) return order.shipping_fee;
      if (order.shippingFee !== undefined && order.shippingFee !== null) return order.shippingFee;
      
      const cart = order.cart || order.items || [];
      const cartSubtotal = cart.reduce((sum: number, item: any) => {
        const price = item.unitPrice || item.price || 0;
        const qty = item.quantity || 1;
        return sum + (price * qty);
      }, 0);
      const totalAmount = order.total_amount || order.totalAmount || order.amount || 0;
      const calculatedFee = totalAmount - cartSubtotal;
      
      // Only return if it's a reasonable shipping fee
      if (calculatedFee > 0 && calculatedFee < 200) {
        return calculatedFee;
      }
      return undefined;
    };
    
    if (change.type === 'UPDATE' && change.order) {
      // Update order in history if it exists
      setOrderHistory((prev) => {
        const existingIndex = prev.findIndex((o) => o.ref === change.order.ref);
        if (existingIndex >= 0) {
          const updated = [...prev];
          // Convert DB format to OrderHistory format
          updated[existingIndex] = {
            ...updated[existingIndex],
            status: change.order.status,
            total: change.order.total_amount,
            cart: change.order.cart || [],
            date: change.order.date || change.order.created_at,
            // Include shipping info for proper QR code display
            shippingFee: calculateShippingFee(change.order),
            shippingOption: change.order.shipping_option || change.order.shippingOption,
            trackingNumber: change.order.tracking_number || change.order.trackingNumber,
            shippingProvider: change.order.shipping_provider || change.order.shippingProvider,
          };
          return updated;
        }
        return prev;
      });
    } else if (change.type === 'INSERT' && change.order) {
      // Add new order to history
      const newOrder: OrderHistory = {
        ref: change.order.ref,
        date: change.order.date || change.order.created_at,
        status: change.order.status,
        total: change.order.total_amount,
        cart: change.order.cart || [],
        shippingFee: calculateShippingFee(change.order),
        shippingOption: change.order.shipping_option || change.order.shippingOption,
        trackingNumber: change.order.tracking_number || change.order.trackingNumber,
        shippingProvider: change.order.shipping_provider || change.order.shippingProvider,
      };
      setOrderHistory((prev) => {
        // Check if already exists
        if (prev.some((o) => o.ref === newOrder.ref)) return prev;
        return [newOrder, ...prev];
      });
    } else if (change.type === 'DELETE') {
      // DELETE payloads usually carry only the primary key (no ref unless the
      // table has REPLICA IDENTITY FULL) — remove by ref when available,
      // otherwise resync the list from the server in the background
      const deletedRef = change.oldOrder?.ref;
      if (deletedRef) {
        setOrderHistory((prev) => prev.filter((o) => o.ref !== deletedRef));
      } else if (historyLoadedRef.current) {
        loadOrderHistoryRef.current({ silent: true });
      }
    }
  }, []);


  // Use realtime subscriptions for user's orders
  const userEmail = session?.user?.email;
  const { isConnected: realtimeConnected, error: realtimeError } = useRealtimeOrdersByEmail(
    userEmail,
    handleOrderChange,
    handleConfigChange
  );

  // Resync order history after a realtime disconnect - events fired while the
  // socket was down are lost, so refetch from the server once we reconnect
  const realtimeWasDownRef = useRef(false);
  useEffect(() => {
    if (!realtimeConnected) {
      realtimeWasDownRef.current = true;
      return;
    }
    if (realtimeWasDownRef.current) {
      realtimeWasDownRef.current = false;
      if (historyLoadedRef.current) {
        loadOrderHistoryRef.current({ silent: true });
      }
    }
  }, [realtimeConnected]);

  // Fallback: Refresh on visibility change (in case realtime disconnects)

  // --- Chatbot button ---
  // Render at the end of the page
  useEffect(() => {
    const handleVisibility = () => {
      // Always refresh when the tab becomes visible again — realtime events
      // may have been missed while the socket was suspended in background
      if (!document.hidden) {
        refreshConfig();
      }
    };

    window.addEventListener('focus', handleVisibility);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('focus', handleVisibility);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [refreshConfig]);

  // Fallback polling only when the CONFIG realtime channel is unhealthy
  // (previously gated on the orders channel, which stayed "connected" even
  // though config events were never delivered)
  useEffect(() => {
    if (configRealtimeOk) {
      // Config realtime healthy, clear polling
      if (configPollTimer.current) {
        clearInterval(configPollTimer.current);
        configPollTimer.current = null;
      }
      return;
    }

    // Fallback polling when config realtime is not available
    const intervalMs = 60_000; // 60s fallback when config realtime is down
    configPollTimer.current = setInterval(() => {
      refreshConfig();
    }, intervalMs);

    return () => {
      if (configPollTimer.current) clearInterval(configPollTimer.current);
    };
  }, [refreshConfig, configRealtimeOk]);

  // Subscribe to config updates in realtime (for both logged-in and guest users)
  useEffect(() => {
    if (!supabase) return undefined;
    
    console.log('[Realtime] Initializing guest/public config subscription');
    const channel = supabase
      .channel('public-config-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'config',
          // Lightweight version row bumped by the server on every config save
          filter: 'key=eq.config-version',
        },
        (payload) => {
          console.log('[Realtime] Public config change payload:', payload);
          const newData = payload.new as Record<string, any> | null;
          handleConfigChange(newData?.value || {});
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Public config subscription status:', status);
        setConfigRealtimeOk(status === 'SUBSCRIBED');
      });

    return () => {
      setConfigRealtimeOk(false);
      channel.unsubscribe();
    };
  }, [handleConfigChange]);


  function showToast(type: ToastSeverity, message: string) {
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
    closeDate: cfg.closeDate,
    openDate: cfg.openDate,
    announcements: cfg.announcements || [],
    announcementHistory: cfg.announcementHistory || [],
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
    setSelectedProductContext({});
    setProductOptions({ size: '', quantity: 1, customName: '', customNumber: '', isLongSleeve: false, pattern: '' });
  };

  const buildCartItem = (): CartItem | null => {
    // Block cart operations when shop is closed
    if (!activeProductCatalog.isOpen) {
      showToast('warning', t.checkout.shopClosedWarning);
      return null;
    }
    
    // Check if this product requires size selection
    const needsSize = productRequiresSize(selectedProduct as Product);
    
    // Check if product has variants (non-apparel)
    const hasVariants = !needsSize && (selectedProduct as any)?.variants && (selectedProduct as any).variants.length > 0;
    
    // For variant products, size field stores variant id
    if (!selectedProduct || (needsSize && !productOptions.size) || (hasVariants && !productOptions.size)) {
      // Scroll to size selector and show visual feedback
      sizeSelectorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => {
        sizeSelectorRef.current?.classList.add('shake-highlight');
        setTimeout(() => sizeSelectorRef.current?.classList.remove('shake-highlight'), 600);
      }, 300);
      return null;
    }

    const shirtCfg = getProductShirtNameConfig(
      selectedProduct,
      activeProductCatalog.shirtNameConfig ?? config?.shirtNameConfig,
    );
    const normalizedCustomName = normalizeShirtName(productOptions.customName, shirtCfg);

    if (selectedProduct.options?.hasCustomName && !normalizedCustomName) {
      // Scroll to customName input and focus
      customNameInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => {
        customNameInputRef.current?.focus();
        customNameInputRef.current?.parentElement?.parentElement?.classList.add('shake-highlight');
        setTimeout(() => customNameInputRef.current?.parentElement?.parentElement?.classList.remove('shake-highlight'), 600);
      }, 300);
      return null;
    }

    if (selectedProduct.options?.hasCustomName && normalizedCustomName.length < shirtCfg.minLength) {
      customNameInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => {
        customNameInputRef.current?.focus();
        customNameInputRef.current?.parentElement?.parentElement?.classList.add('shake-highlight');
        setTimeout(() => customNameInputRef.current?.parentElement?.parentElement?.classList.remove('shake-highlight'), 600);
      }, 300);
      showToast('warning', `${t.product.customNameMinLength} ${shirtCfg.minLength} ${t.profile.characters}`);
      return null;
    }

    if (selectedProduct.options?.hasCustomNumber && !productOptions.customNumber) {
      // Scroll to customNumber input and focus
      customNumberInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => {
        customNumberInputRef.current?.focus();
        customNumberInputRef.current?.parentElement?.parentElement?.classList.add('shake-highlight');
        setTimeout(() => customNumberInputRef.current?.parentElement?.parentElement?.classList.remove('shake-highlight'), 600);
      }, 300);
      return null;
    }

    // Handle variants - find selected variant and use its price
    let sizeToUse = needsSize ? productOptions.size : '-';
    let basePrice = needsSize 
      ? (selectedProduct.sizePricing?.[productOptions.size] ?? selectedProduct.basePrice)
      : selectedProduct.basePrice;
    
    // If product has variants, get variant name and price
    let variantName = '';
    if (hasVariants) {
      const selectedVariant = ((selectedProduct as any).variants || []).find((v: any) => v.id === productOptions.size);
      if (selectedVariant) {
        variantName = selectedVariant.name;
        sizeToUse = selectedVariant.name; // Show variant name instead of id
        basePrice = selectedVariant.price || selectedProduct.basePrice;
      }
    }
    
    // Check if product has patterns
    const hasPatterns = selectedProduct.patterns && selectedProduct.patterns.filter((p: any) => p.isActive !== false).length > 0;
    if (hasPatterns && !productOptions.pattern) {
      patternSelectorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => {
        patternSelectorRef.current?.classList.add('shake-highlight');
        setTimeout(() => patternSelectorRef.current?.classList.remove('shake-highlight'), 600);
      }, 300);
      showToast('warning', lang === 'en' ? 'Please select a design first' : 'กรุณาเลือกลายสินค้าก่อน');
      return null;
    }
    
    const longSleeveFee = selectedProduct.options?.hasLongSleeve && productOptions.isLongSleeve 
      ? (selectedProduct.options?.longSleevePrice ?? 50) 
      : 0;

    // Apply event discount to base price before adding fees
    const discount = getEventDiscount(selectedProduct.id, activeProductCatalog.events);
    if (discount) {
      basePrice = discount.discountedPrice(basePrice);
    }

    const unitPrice = basePrice + longSleeveFee;
    const quantity = clampQty(productOptions.quantity);
    const patternToUse = productOptions.pattern || '';

    return {
      id: `${selectedProduct.id}-${productOptions.size}-${normalizedCustomName}-${productOptions.customNumber}-${productOptions.isLongSleeve}-${patternToUse}`,
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      size: sizeToUse,
      quantity,
      unitPrice,
      options: {
        customName: normalizedCustomName,
        customNumber: productOptions.customNumber,
        isLongSleeve: productOptions.isLongSleeve,
        variantId: hasVariants ? productOptions.size : undefined,
        variantName: variantName || undefined,
        pattern: patternToUse || undefined,
      },
      shopId: activeProductCatalog.shopId,
      shopSlug: activeProductCatalog.shopSlug,
    };
  };

  const commitCartItem = (item: CartItem, options?: { goCheckout?: boolean }) => {
    const incomingShop = item.shopSlug || '';
    const cartShop = cart[0]?.shopSlug || '';
    if (cart.length > 0 && incomingShop !== cartShop) {
      showToast('warning', t.storefront.mixedCartWarning);
      return;
    }
    const newCart = [...cart, item];
    saveCart(newCart);
    showToast('success', options?.goCheckout ? t.cart.addedGoCheckout : t.cart.addedToCart);
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

  // ==================== BULK ORDER LOGIC ====================
  const openBulkOrder = () => {
    if (!selectedProduct || !activeProductCatalog.isOpen) return;
    setBulkStep(0);
    setBulkSizes({});
    setBulkNames('');
    setBulkLongSleeve(false);
    setBulkAssignments([]);
    setBulkOrderOpen(true);
  };

  const bulkTotalQty = Object.values(bulkSizes).reduce((s, q) => s + q, 0);

  const bulkBuildAssignments = () => {
    const names = bulkNames.split('\n').map(n => n.trim()).filter(Boolean);
    // Distribute sizes across names sequentially
    const sizeList: string[] = [];
    for (const [size, qty] of Object.entries(bulkSizes)) {
      for (let i = 0; i < qty; i++) sizeList.push(size);
    }
    const assignments: Array<{ name: string; size: string }> = names.map((name, i) => ({
      name,
      size: sizeList[i] || sizeList[sizeList.length - 1] || Object.keys(bulkSizes)[0] || 'M',
    }));
    setBulkAssignments(assignments);
    return assignments;
  };

  const bulkCommitToCart = (goCheckout = false) => {
    if (!selectedProduct) return;
    const assignments = bulkAssignments.length ? bulkAssignments : bulkBuildAssignments();
    if (!assignments.length) return;

    const discount = getEventDiscount(selectedProduct.id, activeProductCatalog.events);
    const longSleeveFee = selectedProduct.options?.hasLongSleeve && bulkLongSleeve
      ? (selectedProduct.options?.longSleevePrice ?? 50) : 0;

    const newItems: CartItem[] = assignments.map(a => {
      let basePrice = selectedProduct.sizePricing?.[a.size] ?? selectedProduct.basePrice;
      if (discount) basePrice = discount.discountedPrice(basePrice);
      const unitPrice = basePrice + longSleeveFee;
      return {
        id: `${selectedProduct.id}-${a.size}-${a.name}--${bulkLongSleeve}`,
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        size: a.size,
        quantity: 1,
        unitPrice,
        options: {
          customName: a.name,
          isLongSleeve: bulkLongSleeve,
        },
        shopId: activeProductCatalog.shopId,
        shopSlug: activeProductCatalog.shopSlug,
      };
    });

    const incomingShop = activeProductCatalog.shopSlug || '';
    const cartShop = cart[0]?.shopSlug || '';
    if (cart.length > 0 && incomingShop !== cartShop) {
      showToast('warning', t.storefront.mixedCartWarning);
      return;
    }

    const newCart = [...cart, ...newItems];
    saveCart(newCart);
    showToast('success', `${t.bulkOrder.addToCart} (${newItems.length} ${t.bulkOrder.pieces})`);
    setBulkOrderOpen(false);
    resetProductDialog();

    if (goCheckout) {
      setShowCart(false);
      setShowOrderDialog(true);
      setActiveTab('cart');
    }
  };

  const handleShareProduct = async (product: Product) => {
    const url = getProductLink(product);
    const shareText = `${getProductName(product, lang)} - ฿${product.basePrice.toLocaleString()}`;

    // Try to fetch product image as a File for sharing
    const getImageFile = async (): Promise<File | null> => {
      const imgUrl = product.coverImage || product.images?.[0];
      if (!imgUrl) return null;
      try {
        const res = await apiFetch(imgUrl, { cache: 'force-cache' });
        if (!res.ok) return null;
        const blob = await res.blob();
        const ext = blob.type.split('/')[1] || 'jpg';
        return new File([blob], `${product.name}.${ext}`, { type: blob.type });
      } catch {
        return null;
      }
    };

    try {
      if (navigator.share) {
        // Try sharing with image file first
        const file = await getImageFile();
        if (file && navigator.canShare?.({ files: [file] })) {
          await navigator.share({ title: getProductName(product, lang), text: shareText, url, files: [file] });
        } else {
          await navigator.share({ title: getProductName(product, lang), text: shareText, url });
        }
      } else {
        await navigator.clipboard.writeText(`${shareText}\n${url}`);
        showToast('success', t.product.linkCopied);
      }
    } catch {
      try { await navigator.clipboard.writeText(`${shareText}\n${url}`); showToast('success', t.product.linkCopied); } catch { /* ignore */ }
    }
  };

  const removeFromCart = (id: string) => {
    const newCart = cart.filter((item) => item.id !== id);
    saveCart(newCart);
    showToast('success', t.cart.removed);
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
    showToast('success', t.cart.updated);
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
    }, 200);
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
    }, 200);
  };

  const getTotalPrice = useCallback(() => {
    return cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  }, [cart]);

  const getStatusLabel = (status: string): string => STATUS_LABELS_I18N[normalizeStatus(status)] || STATUS_LABELS[normalizeStatus(status)] || status;
  const getStatusColor = (status: string): string => STATUS_COLORS[normalizeStatus(status)] || '#86868b';

  // Calculate current price for product dialog
  const getCurrentPrice = useCallback(() => {
    if (!selectedProduct) return 0;
    
    // Check if product has variants (non-apparel)
    const hasVariants = !productRequiresSize(selectedProduct) && (selectedProduct as any)?.variants && (selectedProduct as any).variants.length > 0;
    
    let basePrice = selectedProduct.basePrice;
    
    if (hasVariants && productOptions.size) {
      // For variants, size field stores variant id
      const selectedVariant = ((selectedProduct as any).variants || []).find((v: any) => v.id === productOptions.size);
      if (selectedVariant) {
        basePrice = selectedVariant.price || selectedProduct.basePrice;
      }
    } else if (productRequiresSize(selectedProduct)) {
      // For apparel, use size pricing
      basePrice = selectedProduct.sizePricing?.[productOptions.size] ?? selectedProduct.basePrice;
    }
    
    // Apply event discount
    const discount = getEventDiscount(selectedProduct.id, activeProductCatalog.events);
    if (discount) {
      basePrice = discount.discountedPrice(basePrice);
    }

    const longSleeveFee = selectedProduct.options?.hasLongSleeve && productOptions.isLongSleeve 
      ? (selectedProduct.options?.longSleevePrice ?? 50) 
      : 0;
    return (basePrice + longSleeveFee) * productOptions.quantity;
  }, [selectedProduct, productOptions, activeProductCatalog.events]);

  const needsPatternFirst = useMemo(() => {
    if (!selectedProduct) return false;
    return Boolean(
      selectedProduct.patterns
      && selectedProduct.patterns.filter((p: any) => p.isActive !== false).length > 0
      && !productOptions.pattern,
    );
  }, [selectedProduct, productOptions.pattern]);

;

  // Note: historyFilters, filterCounts, and filteredOrders are now handled inside OrderHistoryDrawer

  const cancelOrderByRef = async (ref: string) => {
    try {
      setCancellingRef(ref);
      setProcessing(true);
      const res = await cancelOrder(ref);

      if (res.status === 'success') {
        showToast('success', t.orderHistory.cancelledOrder);
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
        showToast('error', res.message || t.orderHistory.cancelFailed);
      }
    } catch (error: any) {
      showToast('error', error.message || t.orderHistory.cancelFailed);
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
    // Block checkout if shop is closed
    if (!cartCheckoutOpen) {
      showToast('warning', t.checkout.shopClosedWarning);
      return false;
    }
    if (!profileComplete) {
      showToast('warning', t.profile.profileSaveRequired);
      setShowProfileModal(true);
      setPendingCheckout(true);
      return false;
    }
    return true;
  };

  const submitOrder = async (options?: {
    shippingOptionId?: string;
    paymentOptionId?: string;
    shippingFee?: number;
    promoCode?: string;
    promoDiscount?: number;
  }) => {
    const orderShopSlug = cart[0]?.shopSlug;
    const orderShopId = checkoutShopId;

    // Block submission if shop is closed
    if (!cartCheckoutOpen) {
      showToast('warning', t.checkout.shopClosedWarning);
      setShowOrderDialog(false);
      return;
    }

    const cartShopSlugs = new Set(cart.map((i) => i.shopSlug || 'main'));
    if (cartShopSlugs.size > 1) {
      showToast('warning', t.storefront.mixedCartWarning);
      return;
    }
    
    // Block submission if any product in cart is disabled or out of stock
    const unavailableItem = cart.find(item => {
      const p = findProductForCartItem(item);
      if (!p) return true; // Product deleted
      const isOutOfStock = (
        (p.stock !== null && p.stock !== undefined && p.stock <= 0) ||
        (p.variants && p.variants.length > 0 && p.variants.every(v => v.stock !== null && v.stock !== undefined && v.stock <= 0))
      );
      return getProductStatus(p) !== 'OPEN' || isOutOfStock;
    });

    if (unavailableItem) {
      showToast('error', lang === 'en' ? `Product "${unavailableItem.productName}" is no longer available.` : `สินค้า "${unavailableItem.productName}" ไม่พร้อมจำหน่ายแล้ว`);
      setShowOrderDialog(false);
      return;
    }
    
    if (!profileComplete) {
      showToast('warning', t.checkout.profileRequired);
      setShowProfileModal(true);
      setPendingCheckout(true);
      return;
    }

    if (cart.length === 0) {
      showToast('warning', t.cart.emptyWarning);
      return;
    }

    // Calculate total with shipping fee and promo discount
    const subtotal = getTotalPrice();
    const shippingFee = options?.shippingFee || 0;
    const promoDiscount = options?.promoDiscount || 0;
    const totalAmount = Math.max(0, subtotal + shippingFee - promoDiscount);

    try {
      setProcessing(true);
      
      const res = await submitOrderApi({
        customerName: orderData.name,
        customerEmail: orderData.email,
        customerPhone: orderData.phone,
        customerAddress: orderData.address,
        customerInstagram: orderData.instagram,
        cart: cart,
        totalAmount: totalAmount,
        turnstileToken,
        shippingOptionId: options?.shippingOptionId,
        paymentOptionId: options?.paymentOptionId,
        shippingFee: options?.shippingFee,
        promoCode: options?.promoCode,
        promoDiscount: options?.promoDiscount,
        shopId: orderShopId,
        shopSlug: orderShopSlug,
      });

      if (res.status === 'success') {
        showToast('success', `${t.checkout.orderSuccess} ${res.ref}`);
        
        // Add new order to history immediately with full item details
        if (res.ref) {
          const newOrder: OrderHistory = {
            ref: res.ref,
            status: 'PENDING',
            date: new Date().toISOString(),
            total: totalAmount,
            items: cart.map((item) => ({
              productId: item.productId,
              name: item.productName,
              size: item.size,
              qty: item.quantity,
              customName: item.options?.customName,
              isLongSleeve: item.options?.isLongSleeve,
              unitPrice: item.unitPrice,
              subtotal: item.unitPrice * item.quantity,
            })),
          };
          // Only add if not already present (avoid duplicates from realtime)
          setOrderHistory((prev) => {
            if (prev.some((o) => o.ref === newOrder.ref)) return prev;
            return [newOrder, ...prev];
          });
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
          profileImage: orderData.profileImage,
        });

        if (res.ref) openPaymentFlow(res.ref);
      } else {
        throw new Error(res.message || t.common.error);
      }
    } catch (error: any) {
      showToast('error', error.message || t.checkout.orderError);
    } finally {
      setProcessing(false);
    }
  };

  const loadOrderHistory = async (opts?: { append?: boolean; silent?: boolean }) => {
    if (!session?.user?.email) return;
    const append = opts?.append;
    const silent = opts?.silent;
    const pageSize = isMobile ? 20 : 50;
    if (!silent) { append ? setLoadingHistoryMore(true) : setLoadingHistory(true); }
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
          
          // Deduplicate orders by ref
          setOrderHistory((prev) => {
            if (append) {
              // When appending, only add orders not already present
              const existingRefs = new Set(prev.map(o => o.ref));
              const newOrders = history.filter((o: any) => !existingRefs.has(o.ref));
              return [...prev, ...newOrders];
            } else {
              // When replacing, deduplicate the new list itself
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
          console.warn('History response missing array', { res });
          if (!append) setOrderHistory([]);
          setHistoryHasMore(false);
          setHistoryCursor(null);
        }
      }
    } catch (error) {
      console.error('Failed to load history:', error);
      if (!silent) showToast('error', t.misc.cannotLoadHistory);
    } finally {
      if (!silent) { append ? setLoadingHistoryMore(false) : setLoadingHistory(false); }
    }
  };
  loadOrderHistoryRef.current = loadOrderHistory;

  // Prefetch order history for navbar pending-payment badge
  useEffect(() => {
    if (!session?.user?.email) return;
    if (!historyLoadedRef.current) {
      void loadOrderHistoryRef.current({ silent: true });
    }
  }, [session?.user?.email]);

  // ===== Auto-cancel expired unpaid orders (24h) =====
  // Check if waiting_payment orders have expired and auto-cancel them client-side
  useEffect(() => {
    if (orderHistory.length === 0) return;
    
    const EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
    const expiredOrders = orderHistory.filter((order) => {
      const status = normalizeStatus(order.status);
      if (!PAYABLE_STATUSES.includes(status)) return false;
      if (!order.date) return false;
      const created = new Date(order.date).getTime();
      return Date.now() - created >= EXPIRY_MS;
    });

    if (expiredOrders.length > 0) {
      // Update local state immediately for UI feedback
      setOrderHistory((prev) =>
        prev.map((order) => {
          const isExpired = expiredOrders.some((e) => e.ref === order.ref);
          return isExpired ? { ...order, status: 'CANCELLED' } : order;
        })
      );

      // Trigger server-side cancel for each expired order (fire and forget)
      expiredOrders.forEach((order) => {
        cancelOrder(order.ref).catch((err) =>
          console.error(`[auto-cancel] Failed to cancel expired order ${order.ref}:`, err)
        );
      });
    }
  }, [orderHistory.length]); // Only run when history count changes (not on every render)

  const handleSaveProfile = async (data: Partial<typeof orderData> & { savedAddresses?: SavedAddress[] }) => {
    if (!session?.user?.email) {
      showToast('error', t.misc.pleaseLogin);
      return;
    }

    setSavingProfile(true);
    const sanitized = {
      name: data.name ? data.name.replace(/[^\u0E00-\u0E7F\s]/g, '').trim() : orderData.name,
      phone: data.phone ? onlyDigitsPhone(data.phone) : orderData.phone,
      address: data.address ? data.address.trim() : orderData.address,
      instagram: data.instagram ? data.instagram.trim() : orderData.instagram,
      profileImage: data.profileImage !== undefined ? (data.profileImage || '') : orderData.profileImage,
    };
    setOrderData((prev) => ({ ...prev, ...sanitized }));

    // Update saved addresses if provided
    if (data.savedAddresses) {
      setSavedAddresses(data.savedAddresses);
    }

    try {
      await saveProfileApi(session.user.email, {
        name: sanitized.name,
        phone: sanitized.phone,
        address: sanitized.address,
        instagram: sanitized.instagram,
        profileImage: sanitized.profileImage,
        ...(data.savedAddresses && { savedAddresses: data.savedAddresses }),
      });

      showToast('success', t.profile.savedProfile);
      setShowProfileModal(false);
      if (pendingCheckout && isThaiText(sanitized.name) && sanitized.phone && sanitized.instagram) {
        setShowOrderDialog(true);
        setPendingCheckout(false);
      }
    } catch (error: any) {
      showToast('error', error.message || t.profile.saveProfileFailed);
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
      // Only load if the full list was never fetched (locally-added orders
      // from checkout/realtime don't count as a loaded history)
      if (!historyLoadedRef.current) {
        setHistoryCursor(null);
        setHistoryHasMore(false);
        loadOrderHistory();
      }
    } else if (tab === 'profile') {
      setSidebarOpen(false);
      setShowProfileModal(true);
    } else if (tab === 'chat') {
      // Show chat selection menu - do nothing here, handled by onClick
      return;
    }
  };



  // Keyboard navigation for fullscreen lightbox on the main page
  useEffect(() => {
    if (!lightboxImage) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        setLightboxIndex((prev) => (prev - 1 + lightboxImages.length) % lightboxImages.length);
      } else if (e.key === 'ArrowRight') {
        setLightboxIndex((prev) => (prev + 1) % lightboxImages.length);
      } else if (e.key === 'Escape') {
        setLightboxImage(null);
        setLightboxImages([]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxImage, lightboxImages]);
  const displaySizes = useMemo(() => {
    if (!selectedProduct) return [] as string[];
    const sizeKeys = Object.keys(selectedProduct.sizePricing || {});
    if (sizeKeys.length === 0) return [t.common.freeSize];
    // Sort sizes according to standard size order (XS, S, M, L, XL, etc.)
    return sizeKeys.sort((a, b) => {
      const indexA = SIZES.indexOf(a);
      const indexB = SIZES.indexOf(b);
      // If both sizes are in SIZES array, sort by their index
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      // If only one is in SIZES, prioritize it
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      // Otherwise sort alphabetically
      return a.localeCompare(b);
    });
  }, [selectedProduct]);

  const sizeChartRows = useMemo(() => {
    if (!selectedProduct) return [] as { size: string; price: number }[];
    return displaySizes.map((size) => ({
      size,
      price: selectedProduct.sizePricing?.[size] ?? selectedProduct.basePrice,
    }));
  }, [displaySizes, selectedProduct]);

  // All products (including non-active for showing status badges)
  // Group by category first, then subType/type
  // In dev mode, merge test products with real products
  const allGroupedProducts = useMemo(() => {
    const realProducts = catalogContext.products || [];
    const items = sortProductsNewestFirst(isDev && activeShopMenu === 'main' ? [...devTestProducts, ...realProducts] : realProducts);
    const map: Record<string, Product[]> = {};
    items.forEach((p) => {
      // Use category if available, otherwise infer from type
      const category = (p as any).category || getCategoryFromType(p.type);
      if (!map[category]) map[category] = [];
      map[category].push(p);
    });
    return map;
  }, [catalogContext.products, isDev, devTestProducts, activeShopMenu]);

  // Only active products (for counting and filtering)
  const groupedProducts = useMemo(() => {
    const realProducts = catalogContext.products || [];
    const items = sortProductsNewestFirst(isDev && activeShopMenu === 'main' ? [...devTestProducts, ...realProducts] : realProducts);
    const activeItems = items.filter((p) => isProductCurrentlyOpen(p));
    const map: Record<string, Product[]> = {};
    activeItems.forEach((p) => {
      const category = (p as any).category || getCategoryFromType(p.type);
      if (!map[category]) map[category] = [];
      map[category].push(p);
    });
    return map;
  }, [catalogContext.products, isDev, devTestProducts, activeShopMenu]);

  const totalProductCount = useMemo(() => Object.values(allGroupedProducts).reduce((acc, items) => acc + items.length, 0), [allGroupedProducts]);
  const activeProductCount = useMemo(() => Object.values(groupedProducts).reduce((acc, items) => acc + items.length, 0), [groupedProducts]);

  const priceBounds = useMemo(() => {
    const all = Object.values(allGroupedProducts).flat();
    if (all.length === 0) return { min: 0, max: 0 };
    const prices = all.map(getBasePrice);
    return { min: Math.min(...prices), max: Math.max(...prices) };
  }, [allGroupedProducts]);

  useEffect(() => {
    if (priceBounds.max === 0 && priceBounds.min === 0) return;
    setPriceRange([priceBounds.min, priceBounds.max]);
  }, [priceBounds.min, priceBounds.max]);

  const categoryMeta = useMemo(
    () => [
      { key: 'ALL', label: t.common.all, count: totalProductCount, icon: '' },
      ...Object.entries(allGroupedProducts).map(([key, items]) => ({ 
        key, 
        label: (t.category as Record<string, string>)[key] || getCategoryLabel(key, lang) || TYPE_LABELS_I18N[key] || key || t.type.OTHER, 
        count: items.length,
        icon: getCategoryIcon(key),
      })),
    ],
    [totalProductCount, allGroupedProducts]
  );

  // Filter products - show all products including inactive ones (with status badges)
  const filteredGroupedProducts = useMemo(() => {
    const term = productSearch.trim().toLowerCase();
    const entries = Object.entries(allGroupedProducts)
      .filter(([key]) => categoryFilter === 'ALL' || key === categoryFilter)
      .map(([key, items]) => {
        const catLabel = (t.category as Record<string, string>)[key] || getCategoryLabel(key, lang) || key || '';
        const bySearch = term
          ? items.filter((p) => productMatchesSearch(p, term, lang, catLabel))
          : items;
        const byPrice = bySearch.filter((p) => {
          const price = getBasePrice(p);
          return priceRange[0] <= price && price <= priceRange[1];
        });
        // Filter by availability
        const byAvailability = showOnlyAvailable 
          ? byPrice.filter((p) => getProductStatus(p) === 'OPEN')
          : byPrice;
        // Filter by wishlist if wishlist drawer is open
        return [key, byAvailability] as const;
      })
      .filter(([, items]) => items.length > 0);
    
    // Apply sorting
    for (const entry of entries) {
      const items = [...entry[1]];
      if (term && sortBy === 'default') {
        items.sort((a, b) => rankProductSearch(b, term, lang) - rankProductSearch(a, term, lang));
      } else if (sortBy !== 'default') {
        items.sort((a, b) => {
          switch (sortBy) {
            case 'price-low': return getBasePrice(a) - getBasePrice(b);
            case 'price-high': return getBasePrice(b) - getBasePrice(a);
            case 'newest': return getProductSortTime(b) - getProductSortTime(a);
            case 'name': return getProductName(a, lang).localeCompare(getProductName(b, lang), lang === 'th' ? 'th' : 'en');
            default: return 0;
          }
        });
      }
      (entry as any)[1] = items;
    }

    if (term && sortBy === 'default') {
      entries.sort(([, aItems], [, bItems]) => {
        const aBest = aItems.reduce((max, p) => Math.max(max, rankProductSearch(p, term, lang)), 0);
        const bBest = bItems.reduce((max, p) => Math.max(max, rankProductSearch(p, term, lang)), 0);
        return bBest - aBest;
      });
    }
    
    return Object.fromEntries(entries);
  }, [categoryFilter, allGroupedProducts, priceRange, productSearch, sortBy, showOnlyAvailable, lang]);

  const displayGroupedProducts = useMemo(() => {
    const term = productSearch.trim();
    if (!term) return filteredGroupedProducts;
    const flat = Object.values(filteredGroupedProducts).flat();
    if (flat.length === 0) return filteredGroupedProducts;
    const ranked = [...flat].sort((a, b) => rankProductSearch(b, term, lang) - rankProductSearch(a, term, lang));
    return { __SEARCH__: ranked };
  }, [filteredGroupedProducts, productSearch, lang]);

  const filteredProductCount = useMemo(
    () => Object.values(filteredGroupedProducts).reduce((acc, items) => acc + items.length, 0),
    [filteredGroupedProducts]
  );

  const hasActiveSearchFilters = Boolean(
    productSearch.trim() || categoryFilter !== 'ALL' || showOnlyAvailable || sortBy !== 'default',
  );

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (productSearch.trim()) count += 1;
    if (categoryFilter !== 'ALL') count += 1;
    if (showOnlyAvailable) count += 1;
    if (sortBy !== 'default') count += 1;
    return count;
  }, [productSearch, categoryFilter, showOnlyAvailable, sortBy]);

  const resetSearchFilters = useCallback(() => {
    setProductSearch('');
    setCategoryFilter('ALL');
    setSortBy('default');
    setShowOnlyAvailable(false);
    if (priceBounds.max > priceBounds.min) {
      setPriceRange([priceBounds.min, priceBounds.max]);
    }
  }, [priceBounds.max, priceBounds.min]);

  // Ctrl/Cmd+K toggles product search
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'k') return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return;
      e.preventDefault();
      setShowSearchBar((v) => !v);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  if (!mounted || loading || status === 'loading') {
    return <LoadingScreen />;
  }

  if (status === 'unauthenticated') {
    return <LoginScreen />;
  }

  // Check if there are enabled announcements for padding adjustment
  const hasEnabledAnnouncements = (announcements?.filter(a => a.enabled)?.length ?? 0) > 0;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', bgcolor: 'var(--background)', pb: { xs: 9, md: 0 } }}>
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.65)' : 'rgba(255,255,255,0.75)',
          borderBottom: (theme) => `1px solid ${theme.palette.mode === 'dark' ? 'var(--glass-bg)' : 'rgba(0,0,0,0.06)'}`,
          backdropFilter: 'blur(14px)',
          boxShadow: (theme) => theme.palette.mode === 'dark' ? '0 18px 50px rgba(0,0,0,0.35)' : '0 4px 20px rgba(0,0,0,0.04)',
          color: 'var(--foreground)',
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
              startIcon={(
                <Badge badgeContent={activeFilterCount || undefined} color="warning" invisible={activeFilterCount === 0}>
                  <Search size={18} />
                </Badge>
              )}
              onClick={() => setShowSearchBar((v) => !v)}
              sx={{
                color: (theme) => showSearchBar ? '#fff' : theme.palette.text.primary,
                borderColor: (theme) => showSearchBar ? 'transparent' : theme.palette.divider,
                background: (theme) => showSearchBar ? 'linear-gradient(135deg, #0071e3 0%, #64d2ff 100%)' : (theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.04)'),
                textTransform: 'none',
                fontWeight: 700,
                borderRadius: 1.5,
              }}
            >
              {t.nav.search}
            </Button>
          </Box>
          <IconButton
            onClick={() => setShowSearchBar((v) => !v)}
            sx={{ mr: 1, display: { xs: 'flex', md: 'none' }, color: 'var(--foreground)', alignItems: 'center', gap: 0.5 }}
          >
            <Search size={22} />
          </IconButton>
          {isLiveActive && (
            <IconButton
              onClick={openLiveStream}
              sx={{
                mr: 0.5,
                display: { xs: 'flex', md: 'none' },
                color: '#fff',
                bgcolor: '#ef4444',
                width: 34,
                height: 34,
                animation: 'navLivePulse 2s ease-in-out infinite',
                '@keyframes navLivePulse': {
                  '0%, 100%': { boxShadow: '0 0 0 0 rgba(239,68,68,0.4)' },
                  '50%': { boxShadow: '0 0 0 6px rgba(239,68,68,0)' },
                },
                '&:hover': { bgcolor: '#dc2626' },
              }}
            >
              <Radio size={18} />
            </IconButton>
          )}
          <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 1, mr: 2 }}>
            <Button
              variant="outlined"
              startIcon={<Home size={18} />}
              onClick={() => handleTabChange('home')}
              sx={{
                color: (theme) => activeTab === 'home' ? '#0071e3' : theme.palette.text.primary,
                borderColor: (theme) => activeTab === 'home' ? 'rgba(0,113,227,0.6)' : theme.palette.divider,
                backgroundColor: activeTab === 'home' ? 'rgba(0,113,227,0.12)' : 'transparent',
                textTransform: 'none',
                borderRadius: 2,
                px: 1.5,
                py: 0.5,
                height: 40,
                '&:hover': { borderColor: '#0071e3', backgroundColor: 'rgba(0,113,227,0.16)' },
              }}
            >
              {t.nav.home}
            </Button>
            <Button
              variant="outlined"
              startIcon={(
                <Badge
                  badgeContent={pendingOrderCount > 0 ? pendingOrderCount : undefined}
                  color="warning"
                  max={99}
                  invisible={pendingOrderCount === 0}
                  sx={historyBadgeSx}
                >
                  <History size={18} />
                </Badge>
              )}
              onClick={() => handleTabChange('history')}
              sx={{
                color: (theme) => activeTab === 'history' ? '#0071e3' : theme.palette.text.primary,
                borderColor: (theme) => activeTab === 'history' ? 'rgba(0,113,227,0.6)' : theme.palette.divider,
                backgroundColor: activeTab === 'history' ? 'rgba(0,113,227,0.12)' : 'transparent',
                textTransform: 'none',
                borderRadius: 2,
                px: 1.5,
                py: 0.5,
                height: 40,
                '&:hover': { borderColor: '#0071e3', backgroundColor: 'rgba(0,113,227,0.16)' },
              }}
            >
              {t.nav.history}
            </Button>
            <Button
              variant="outlined"
              startIcon={<User size={18} />}
              onClick={() => handleTabChange('profile')}
              sx={{
                color: (theme) => activeTab === 'profile' ? '#0071e3' : theme.palette.text.primary,
                borderColor: (theme) => activeTab === 'profile' ? 'rgba(0,113,227,0.6)' : theme.palette.divider,
                backgroundColor: activeTab === 'profile' ? 'rgba(0,113,227,0.12)' : 'transparent',
                textTransform: 'none',
                borderRadius: 2,
                px: 1.5,
                py: 0.5,
                height: 40,
                '&:hover': { borderColor: '#0071e3', backgroundColor: 'rgba(0,113,227,0.16)' },
              }}
            >
              {t.nav.profile}
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
                color: (theme) => activeTab === 'cart' ? '#0071e3' : theme.palette.text.primary,
                borderColor: (theme) => activeTab === 'cart' ? 'rgba(0,113,227,0.6)' : theme.palette.divider,
                backgroundColor: activeTab === 'cart' ? 'rgba(0,113,227,0.12)' : 'transparent',
                textTransform: 'none',
                borderRadius: 2,
                px: 1.5,
                py: 0.5,
                height: 40,
                '&:hover': { borderColor: '#0071e3', backgroundColor: 'rgba(0,113,227,0.16)' },
              }}
            >
              {t.nav.cart}
            </Button>
            {isLiveActive && (
              <Button
                variant="contained"
                startIcon={<Radio size={18} />}
                onClick={openLiveStream}
                sx={{
                  background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  color: '#fff',
                  textTransform: 'none',
                  borderRadius: 2,
                  px: 1.5,
                  py: 0.5,
                  height: 40,
                  fontWeight: 700,
                  position: 'relative',
                  overflow: 'visible',
                  animation: 'navLivePulse 2s ease-in-out infinite',
                  '@keyframes navLivePulse': {
                    '0%, 100%': { boxShadow: '0 0 0 0 rgba(239,68,68,0.4)' },
                    '50%': { boxShadow: '0 0 0 8px rgba(239,68,68,0)' },
                  },
                  '&:hover': { background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)' },
                  '&::before': {
                    content: '""',
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: '#fff',
                    position: 'absolute',
                    top: 6,
                    right: 6,
                    animation: 'navLiveDot 1.5s ease-in-out infinite',
                  },
                  '@keyframes navLiveDot': {
                    '0%, 100%': { opacity: 1 },
                    '50%': { opacity: 0.3 },
                  },
                }}
              >
                {t.nav.live}
              </Button>
            )}
          </Box>
          {session && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <LanguageToggle size="small" />
              <ThemeToggle size="small" />
              <Avatar src={orderData.profileImage || session?.user?.image || ''} sx={{ width: 32, height: 32, cursor: 'pointer' }} onClick={() => setSidebarOpen(true)} />
            </Box>
          )}
          {!session && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <LanguageToggle size="small" />
              <ThemeToggle size="small" />
            </Box>
          )}
        </Toolbar>
        {showSearchBar && (
          <Box sx={{ px: { xs: 1.5, md: 3 }, pb: 2, pt: 1 }}>
            <Box sx={{
              borderRadius: '20px',
              bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(15,15,15,0.98)' : 'rgba(255,255,255,0.99)',
              border: '1px solid',
              borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
              boxShadow: (theme) => theme.palette.mode === 'dark' ? '0 8px 32px rgba(0,0,0,0.5)' : '0 8px 32px rgba(0,0,0,0.1)',
              overflow: 'hidden',
            }}>
              {/* Search Input */}
              <Box sx={{ p: 2, pb: 1.5 }}>
                <TextField
                  autoFocus
                  size="small"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      if (productSearch) setProductSearch('');
                      else setShowSearchBar(false);
                    }
                    if (e.key === 'Enter') {
                      setShowSearchBar(false);
                      document.getElementById('product-grid')?.scrollIntoView({ behavior: 'smooth' });
                    }
                  }}
                  placeholder={t.search.placeholder}
                  inputProps={{ maxLength: 50 }}
                  fullWidth
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      color: 'var(--foreground)',
                      background: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                      borderRadius: '14px',
                      fontSize: '0.95rem',
                      '& fieldset': { border: 'none' },
                    },
                    '& .MuiInputBase-input::placeholder': { color: 'text.disabled', opacity: 0.7 },
                  }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search size={20} color="var(--text-muted)" />
                      </InputAdornment>
                    ),
                    endAdornment: productSearch ? (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => setProductSearch('')} sx={{ color: 'var(--text-muted)' }}>
                          <X size={16} />
                        </IconButton>
                      </InputAdornment>
                    ) : (
                      <InputAdornment position="end">
                        <Typography sx={{ fontSize: '0.65rem', color: 'var(--text-muted)', opacity: 0.5 }}>
                          {t.search.shortcutHint}
                        </Typography>
                      </InputAdornment>
                    ),
                  }}
                />
                {hasActiveSearchFilters && (
                  <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)', mt: 1 }}>
                    {t.search.activeFilters}: {filteredProductCount} {t.common.items}
                  </Typography>
                )}
              </Box>

              {/* Categories */}
              <Box sx={{ px: 2, pb: 1.25 }}>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6 }}>
                  {categoryMeta.map((cat) => (
                    <Chip
                      key={cat.key}
                      label={`${cat.icon ? `${cat.icon} ` : ''}${cat.label}${cat.key !== 'ALL' ? ` (${cat.count})` : ''}`}
                      size="small"
                      onClick={() => setCategoryFilter(cat.key)}
                      sx={{
                        bgcolor: categoryFilter === cat.key ? 'rgba(0,113,227,0.15)' : 'transparent',
                        color: categoryFilter === cat.key ? '#0071e3' : 'var(--text-muted)',
                        border: '1px solid',
                        borderColor: categoryFilter === cat.key ? 'rgba(0,113,227,0.3)' : (theme: any) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        height: 28,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        '&:hover': { bgcolor: 'rgba(0,113,227,0.1)', borderColor: 'rgba(0,113,227,0.2)' },
                      }}
                    />
                  ))}
                </Box>
              </Box>

              {/* Sort & filters */}
              <Box sx={{ px: 2, pb: 1.5, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                  <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {t.search.sortBy}
                  </Typography>
                  {([
                    { key: 'default' as const, label: t.search.sortPopular },
                    { key: 'price-low' as const, label: t.search.sortPriceLow },
                    { key: 'price-high' as const, label: t.search.sortPriceHigh },
                    { key: 'newest' as const, label: t.search.sortNewest },
                    { key: 'name' as const, label: t.search.sortName },
                  ] as const).map((opt) => (
                    <Chip
                      key={opt.key}
                      label={opt.label}
                      size="small"
                      onClick={() => setSortBy(opt.key)}
                      sx={{
                        bgcolor: sortBy === opt.key ? 'rgba(52,199,89,0.15)' : 'transparent',
                        color: sortBy === opt.key ? '#34c759' : 'var(--text-muted)',
                        border: '1px solid',
                        borderColor: sortBy === opt.key ? 'rgba(52,199,89,0.3)' : (theme: any) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                        fontSize: '0.68rem',
                        fontWeight: 600,
                        height: 26,
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'rgba(52,199,89,0.1)' },
                      }}
                    />
                  ))}
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, flexWrap: 'wrap' }}>
                  <Chip
                    icon={<Eye size={10} />}
                    label={t.search.filterAvailable}
                    size="small"
                    onClick={() => setShowOnlyAvailable(!showOnlyAvailable)}
                    sx={{
                      bgcolor: showOnlyAvailable ? 'rgba(0,113,227,0.15)' : 'transparent',
                      color: showOnlyAvailable ? '#0071e3' : 'var(--text-muted)',
                      border: '1px solid',
                      borderColor: showOnlyAvailable ? 'rgba(0,113,227,0.3)' : (theme: any) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                      fontSize: '0.68rem',
                      fontWeight: 600,
                      height: 26,
                      cursor: 'pointer',
                      '& .MuiChip-icon': { color: 'inherit', ml: 0.5 },
                      '&:hover': { bgcolor: 'rgba(0,113,227,0.1)' },
                    }}
                  />
                  {hasActiveSearchFilters && (
                    <Chip
                      label={t.search.resetFilters}
                      size="small"
                      onClick={resetSearchFilters}
                      sx={{
                        bgcolor: 'rgba(239,68,68,0.08)',
                        color: '#ff453a',
                        border: '1px solid rgba(239,68,68,0.25)',
                        fontSize: '0.68rem',
                        fontWeight: 600,
                        height: 26,
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'rgba(239,68,68,0.14)' },
                      }}
                    />
                  )}
                </Box>
              </Box>

              {/* Search results preview */}
              {hasActiveSearchFilters && (() => {
                const allResults = Object.values(filteredGroupedProducts).flat();
                const ranked = productSearch.trim()
                  ? [...allResults].sort(
                      (a, b) => rankProductSearch(b, productSearch, lang) - rankProductSearch(a, productSearch, lang),
                    )
                  : allResults;
                const previewItems = ranked.slice(0, 5);
                return (
                  <Box sx={{ borderTop: '1px solid', borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }}>
                    {/* Results header */}
                    <Box sx={{ px: 2, pt: 1.5, pb: 0.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {t.search.results}
                      </Typography>
                      <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {allResults.length} {t.common.items}
                      </Typography>
                    </Box>

                    {previewItems.length > 0 ? (
                      <Box sx={{ px: 1, pb: 1.5 }}>
                        {previewItems.map((product) => {
                          const img = product.coverImage || product.images?.[0];
                          const eventDisc = getEventDiscount(product.id, config?.events as ShopEvent[] | undefined);
                          return (
                            <Box
                              key={product.id}
                              onClick={() => {
                                if (isProductCurrentlyOpen(product)) {
                                  handleSelectProduct(product);
                                  setShowSearchBar(false);
                                  setProductSearch('');
                                }
                              }}
                              sx={{
                                display: 'flex', alignItems: 'center', gap: 1.5,
                                px: 1.5, py: 1,
                                borderRadius: '12px',
                                cursor: isProductCurrentlyOpen(product) ? 'pointer' : 'default',
                                opacity: isProductCurrentlyOpen(product) ? 1 : 0.5,
                                transition: 'all 0.15s ease',
                                '&:hover': { bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)' },
                              }}
                            >
                              {/* Thumbnail */}
                              <Box sx={{
                                width: 44, height: 44, borderRadius: '10px', flexShrink: 0,
                                bgcolor: 'var(--surface-2)', overflow: 'hidden',
                                border: '1px solid', borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}>
                                {img ? (
                                  <img src={img} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                                ) : (
                                  <Package size={18} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
                                )}
                              </Box>
                              {/* Info */}
                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {getProductName(product, lang)}
                                </Typography>
                                <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {TYPE_LABELS_I18N[product.type] || product.type}
                                </Typography>
                              </Box>
                              {/* Price */}
                              <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                                {eventDisc ? (
                                  <>
                                    <Typography sx={{ fontSize: '0.65rem', color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                                      ฿{getBasePrice(product).toLocaleString()}
                                    </Typography>
                                    <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#ff453a' }}>
                                      ฿{eventDisc.discountedPrice(getBasePrice(product)).toLocaleString()}
                                    </Typography>
                                  </>
                                ) : (
                                  <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#34c759' }}>
                                    ฿{getBasePrice(product).toLocaleString()}
                                  </Typography>
                                )}
                              </Box>
                            </Box>
                          );
                        })}
                        {allResults.length > 5 && (
                          <Typography sx={{ textAlign: 'center', fontSize: '0.72rem', color: '#0071e3', fontWeight: 600, py: 1, cursor: 'pointer' }}
                            onClick={() => { setShowSearchBar(false); document.getElementById('product-grid')?.scrollIntoView({ behavior: 'smooth' }); }}
                          >
                            {t.search.viewAll} {allResults.length} {t.common.items} →
                          </Typography>
                        )}
                      </Box>
                    ) : (
                      <Box sx={{ textAlign: 'center', py: 3, px: 2 }}>
                        <Search size={32} style={{ color: 'var(--text-muted)', opacity: 0.2, marginBottom: 8 }} />
                        <Typography sx={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                          {t.search.noResults}
                        </Typography>
                        <Typography sx={{ fontSize: '0.72rem', color: 'var(--text-muted)', opacity: 0.6, mt: 0.5 }}>
                          {t.search.tryOther}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                );
              })()}

              {/* Popular suggestions — only when no filters applied */}
              {!hasActiveSearchFilters && totalProductCount > 0 && (
                <Box sx={{ borderTop: '1px solid', borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', px: 2, py: 1.5 }}>
                  <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1 }}>
                    {t.search.popular}
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6 }}>
                    {[t.type.JERSEY, t.type.TSHIRT, t.type.STICKER, t.type.KEYCHAIN, t.type.CAP].filter(s => {
                      const term = s.toLowerCase();
                      return Object.values(allGroupedProducts).flat().some(p => 
                        p.name?.toLowerCase().includes(term) || (TYPE_LABELS_I18N[p.type] || '').toLowerCase().includes(term)
                      );
                    }).map(suggestion => (
                      <Chip
                        key={suggestion}
                        label={suggestion}
                        size="small"
                        onClick={() => setProductSearch(suggestion)}
                        sx={{
                          bgcolor: 'transparent',
                          color: 'var(--text-muted)',
                          border: '1px solid',
                          borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                          fontSize: '0.72rem',
                          fontWeight: 500,
                          height: 26,
                          cursor: 'pointer',
                          '&:hover': { bgcolor: 'rgba(0,113,227,0.08)', color: '#0071e3' },
                        }}
                      />
                    ))}
                  </Box>
                </Box>
              )}
            </Box>
          </Box>
        )}
      </AppBar>

      {/* Shop Status Banner - Shows different states (not open, coming soon, order ended, etc.) */}
      <ShopStatusBanner 
        isOpen={isShopOpen}
        closeDate={config?.closeDate}
        openDate={config?.openDate}
        customMessage={config?.closedMessage}
      />

      {/* Modern Announcement Bar */}
      <AnnouncementBar
        announcements={announcements || []}
        history={announcementHistory}
        socialMediaNews={config?.socialMediaNews}
        onProductClick={(productId) => {
          const products = config?.products || [];
          let product = null;
          if (productId && productId !== '__default__') {
            product = products.find(p => p.id === productId)
              || products.find(p => p.id?.includes(productId) || productId?.includes(p.id));
          }
          // Fallback: open first product if only one, or scroll to grid
          if (!product && products.length > 0) {
            product = products[0];
          }
          if (product) {
            handleSelectProduct(product);
          } else {
            document.getElementById('product-grid')?.scrollIntoView({ behavior: 'smooth' });
          }
        }}
      />

      {/* Event / Promotion Banners */}
      <EventBanner
        events={config?.events || []}
        onEventClick={(event) => {
          if (event.ctaLink) {
            if (event.ctaLink.startsWith('http')) {
              window.open(event.ctaLink, '_blank');
            } else {
              // Treat as product ID — find and open the product
              const products = config?.products || [];
              const product = products.find(p => p.id === event.ctaLink)
                || products.find(p => p.id?.includes(event.ctaLink!) || event.ctaLink!.includes(p.id));
              if (product) {
                handleSelectProduct(product);
              } else if (products.length > 0) {
                handleSelectProduct(products[0]);
              } else {
                document.getElementById('product-grid')?.scrollIntoView({ behavior: 'smooth' });
              }
            }
          }
        }}
      />

      <Drawer
        anchor={navHandedness === 'left' ? 'left' : 'right'}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        PaperProps={{
          sx: {
            bgcolor: 'var(--surface)',
            color: 'var(--foreground)',
            width: 320,
            maxHeight: '100dvh',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            backdropFilter: 'blur(24px)',
            borderLeft: navHandedness === 'left' ? 'none' : '1px solid var(--glass-border)',
            borderRight: navHandedness === 'left' ? '1px solid var(--glass-border)' : 'none',
            boxShadow: (theme: any) => {
              const dir = navHandedness === 'left' ? '18px' : '-18px';
              return theme.palette.mode === 'dark' ? `${dir} 0 60px rgba(0,0,0,0.45)` : `${dir} 0 60px rgba(0,0,0,0.08)`;
            },
            backgroundImage: (theme: any) => theme.palette.mode === 'dark' 
              ? 'radial-gradient(circle at 20% 20%, rgba(0,113,227,0.18), transparent 42%), radial-gradient(circle at 80% 0%, rgba(14,165,233,0.16), transparent 38%)'
              : 'radial-gradient(circle at 20% 20%, rgba(0,113,227,0.06), transparent 42%), radial-gradient(circle at 80% 0%, rgba(14,165,233,0.04), transparent 38%)',
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>{t.nav.menu}</Typography>
            <IconButton onClick={() => setSidebarOpen(false)}>
              <X style={{ color: 'var(--foreground)' }} size={24} />
            </IconButton>
          </Box>
          <Divider sx={{ mb: 2, borderColor: 'var(--glass-border)' }} />

          {session && (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Avatar src={orderData.profileImage || session?.user?.image || ''} sx={{ mr: 2, width: 40, height: 40 }} />
                <Box>
                  <Typography sx={{ fontWeight: 'bold', color: 'var(--foreground)' }}>{session?.user?.name}</Typography>
                  <Typography variant="caption" sx={{ color: 'var(--text-muted)' }}>{session?.user?.email}</Typography>
                </Box>
              </Box>
              <Divider sx={{ my: 2, borderColor: 'var(--glass-border)' }} />
              <Button
                fullWidth
                onClick={() => { setSidebarOpen(false); setShowProfileModal(true); setActiveTab('profile'); }}
                sx={{
                  textAlign: 'left',
                  mb: 1,
                  color: 'var(--foreground)',
                  justifyContent: 'flex-start',
                  borderRadius: 2,
                  px: 1.5,
                  py: 1.1,
                  background: 'linear-gradient(120deg, rgba(0,113,227,0.18), rgba(14,165,233,0.12))',
                  border: '1px solid var(--glass-border)',
                  boxShadow: (theme: any) => theme.palette.mode === 'dark' ? '0 12px 30px rgba(0,0,0,0.25)' : '0 4px 12px rgba(0,0,0,0.06)',
                  '&:hover': { borderColor: 'rgba(0,113,227,0.5)', background: 'linear-gradient(120deg, rgba(0,113,227,0.24), rgba(14,165,233,0.18))' },
                }}
                startIcon={<User size={20} />}
              >
                {t.nav.myShippingInfo}
              </Button>
              <Button
                fullWidth
                onClick={() => { setSidebarOpen(false); setShowHistoryDialog(true); loadOrderHistory(); }}
                sx={{
                  textAlign: 'left',
                  mb: 1,
                  color: 'var(--foreground)',
                  justifyContent: 'flex-start',
                  borderRadius: 2,
                  px: 1.5,
                  py: 1.1,
                  background: 'linear-gradient(120deg, rgba(16,185,129,0.18), rgba(14,165,233,0.12))',
                  border: '1px solid var(--glass-border)',
                  boxShadow: (theme: any) => theme.palette.mode === 'dark' ? '0 12px 30px rgba(0,0,0,0.25)' : '0 4px 12px rgba(0,0,0,0.06)',
                  '&:hover': { borderColor: 'rgba(16,185,129,0.5)', background: 'linear-gradient(120deg, rgba(16,185,129,0.22), rgba(14,165,233,0.16))' },
                }}
                startIcon={(
                  <Badge
                    badgeContent={pendingOrderCount > 0 ? pendingOrderCount : undefined}
                    color="warning"
                    max={99}
                    invisible={pendingOrderCount === 0}
                    sx={historyBadgeSx}
                  >
                    <History size={20} />
                  </Badge>
                )}
              >
                {t.nav.orderHistory}
              </Button>
              {/* Wishlist button */}
              <Button
                fullWidth
                onClick={() => { setSidebarOpen(false); setShowWishlistDrawer(true); }}
                sx={{
                  textAlign: 'left',
                  mb: 1,
                  color: 'var(--foreground)',
                  justifyContent: 'flex-start',
                  borderRadius: 2,
                  px: 1.5,
                  py: 1.1,
                  background: 'linear-gradient(120deg, rgba(255,69,58,0.18), rgba(255,159,10,0.12))',
                  border: '1px solid var(--glass-border)',
                  boxShadow: (theme: any) => theme.palette.mode === 'dark' ? '0 12px 30px rgba(0,0,0,0.25)' : '0 4px 12px rgba(0,0,0,0.06)',
                  '&:hover': { borderColor: 'rgba(255,69,58,0.5)', background: 'linear-gradient(120deg, rgba(255,69,58,0.24), rgba(255,159,10,0.18))' },
                }}
                startIcon={
                  <Badge badgeContent={wishlistStore.items.length} color="error" sx={{ '& .MuiBadge-badge': { fontSize: '0.6rem', minWidth: 16, height: 16 } }}>
                    <Heart size={20} />
                  </Badge>
                }
              >
                {t.wishlist.title}
              </Button>
              {/* Recently Viewed button */}
              <Button
                fullWidth
                onClick={() => { setSidebarOpen(false); setShowRecentlyViewed(true); }}
                sx={{
                  textAlign: 'left',
                  mb: 1,
                  color: 'var(--foreground)',
                  justifyContent: 'flex-start',
                  borderRadius: 2,
                  px: 1.5,
                  py: 1.1,
                  background: 'linear-gradient(120deg, rgba(100,210,255,0.18), rgba(48,209,88,0.12))',
                  border: '1px solid var(--glass-border)',
                  boxShadow: (theme: any) => theme.palette.mode === 'dark' ? '0 12px 30px rgba(0,0,0,0.25)' : '0 4px 12px rgba(0,0,0,0.06)',
                  '&:hover': { borderColor: 'rgba(100,210,255,0.5)', background: 'linear-gradient(120deg, rgba(100,210,255,0.24), rgba(48,209,88,0.18))' },
                }}
                startIcon={<Eye size={20} />}
              >
                {t.recentlyViewed.title}
              </Button>
              <Button
                fullWidth
                onClick={() => { setSidebarOpen(false); setSwitchAccountOpen(true); }}
                sx={{
                  textAlign: 'left',
                  mb: 1,
                  color: 'var(--foreground)',
                  justifyContent: 'flex-start',
                  borderRadius: 2,
                  px: 1.5,
                  py: 1.1,
                  background: 'linear-gradient(120deg, rgba(139,92,246,0.18), rgba(99,102,241,0.12))',
                  border: '1px solid var(--glass-border)',
                  boxShadow: (theme: any) => theme.palette.mode === 'dark' ? '0 12px 30px rgba(0,0,0,0.25)' : '0 4px 12px rgba(0,0,0,0.06)',
                  '&:hover': { borderColor: 'rgba(139,92,246,0.5)', background: 'linear-gradient(120deg, rgba(139,92,246,0.24), rgba(99,102,241,0.18))' },
                }}
                startIcon={<ArrowLeftRight size={20} />}
              >
                {t.nav.switchAccount}
              </Button>
              <Button
                fullWidth
                onClick={toggleNavHandedness}
                sx={{
                  textAlign: 'left',
                  mb: 1,
                  color: 'var(--foreground)',
                  justifyContent: 'flex-start',
                  borderRadius: 2,
                  px: 1.5,
                  py: 1.1,
                  background: 'linear-gradient(120deg, rgba(245,158,11,0.18), rgba(251,191,36,0.12))',
                  border: '1px solid var(--glass-border)',
                  boxShadow: (theme: any) => theme.palette.mode === 'dark' ? '0 12px 30px rgba(0,0,0,0.25)' : '0 4px 12px rgba(0,0,0,0.06)',
                  '&:hover': { borderColor: 'rgba(245,158,11,0.5)', background: 'linear-gradient(120deg, rgba(245,158,11,0.24), rgba(251,191,36,0.18))' },
                }}
                startIcon={<HandMetal size={20} style={{ transform: navHandedness === 'left' ? 'scaleX(-1)' : 'none' }} />}
              >
                {navHandedness === 'right' ? t.nav.switchViewRight : t.nav.switchViewLeft}
              </Button>
              <Button
                fullWidth
                onClick={() => { setSidebarOpen(false); setLogoutConfirmOpen(true); }}
                sx={{
                  textAlign: 'left',
                  color: (theme: any) => theme.palette.mode === 'dark' ? '#fecdd3' : '#ff3b30',
                  justifyContent: 'flex-start',
                  borderRadius: 2,
                  px: 1.5,
                  py: 1.1,
                  background: 'linear-gradient(120deg, rgba(239,68,68,0.12), rgba(239,68,68,0.06))',
                  border: '1px solid rgba(248,113,113,0.4)',
                  boxShadow: (theme: any) => theme.palette.mode === 'dark' ? '0 12px 30px rgba(239,68,68,0.18)' : '0 4px 12px rgba(239,68,68,0.08)',
                  '&:hover': { borderColor: 'rgba(248,113,113,0.8)', background: 'linear-gradient(120deg, rgba(239,68,68,0.18), rgba(239,68,68,0.12))' },
                }}
                startIcon={<LogOut size={20} />}
              >
                {t.nav.logout}
              </Button>
            </>
          )}

          <Divider sx={{ my: 2, borderColor: 'var(--glass-border)' }} />
          <Button
            component={Link}
            href="/"
            fullWidth
            sx={{
              textAlign: 'left',
              color: 'var(--foreground)',
              justifyContent: 'flex-start',
              borderRadius: 2,
              px: 1.5,
              py: 1.1,
              background: (theme: any) => theme.palette.mode === 'dark' 
                ? 'linear-gradient(120deg, rgba(0,113,227,0.16), rgba(29,29,31,0.6))' 
                : 'linear-gradient(120deg, rgba(0,113,227,0.08), rgba(245,245,247,0.6))',
              border: '1px solid var(--glass-border)',
              boxShadow: (theme: any) => theme.palette.mode === 'dark' ? '0 12px 30px rgba(0,0,0,0.22)' : '0 4px 12px rgba(0,0,0,0.06)',
              '&:hover': { borderColor: 'rgba(0,113,227,0.6)', background: 'linear-gradient(120deg, rgba(0,113,227,0.22), rgba(0,113,227,0.08))' },
            }}
            startIcon={<Home size={20} />}
          >
            {t.nav.home}
          </Button>
        </Box>
      </Drawer>

      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Box sx={{ flex: 1, p: { xs: 2, md: 3 }, overflow: 'auto', maxWidth: '100%' }}>
          <Container maxWidth="lg" sx={{ px: { xs: 0, sm: 2 } }}>
            

            {(activeProductCount > 0 || subShopCatalog.length > 0) && (
              <Box sx={{ mb: 3 }}>
                {subShopCatalog.length > 0 && (
                  <Box sx={{ mb: 2 }}>
                    <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', mb: 1 }}>
                      {t.storefront.selectShop}
                    </Typography>
                    <Box sx={{
                      display: 'flex',
                      gap: 0.8,
                      flexWrap: 'nowrap',
                      overflowX: 'auto',
                      pb: 0.5,
                      '&::-webkit-scrollbar': { display: 'none' },
                    }}>
                      <Chip
                        label={t.storefront.mainShop}
                        onClick={() => { setActiveShopMenu('main'); setCategoryFilter('ALL'); }}
                        sx={{
                          flexShrink: 0,
                          fontWeight: 700,
                          bgcolor: activeShopMenu === 'main' ? 'rgba(0,113,227,0.2)' : 'var(--glass-bg)',
                          color: activeShopMenu === 'main' ? 'var(--primary)' : 'var(--text-muted)',
                          border: activeShopMenu === 'main' ? '1px solid rgba(0,113,227,0.4)' : '1px solid var(--glass-border)',
                        }}
                      />
                      {subShopCatalog.map((shop) => {
                        const label = lang === 'en' && shop.nameEn ? shop.nameEn : shop.name;
                        const active = activeShopMenu === shop.slug;
                        return (
                          <Chip
                            key={shop.slug}
                            avatar={shop.logoUrl ? <Avatar src={shop.logoUrl} sx={{ width: 22, height: 22 }} /> : undefined}
                            label={label}
                            onClick={() => { setActiveShopMenu(shop.slug); setCategoryFilter('ALL'); }}
                            sx={{
                              flexShrink: 0,
                              fontWeight: 700,
                              bgcolor: active ? 'rgba(0,113,227,0.2)' : 'var(--glass-bg)',
                              color: active ? 'var(--primary)' : 'var(--text-muted)',
                              border: active ? '1px solid rgba(0,113,227,0.4)' : '1px solid var(--glass-border)',
                            }}
                          />
                        );
                      })}
                    </Box>
                    {activeShopMenu !== 'main' && (
                      <Button
                        component={Link}
                        href={`/shop/${activeShopMenu}`}
                        size="small"
                        endIcon={<ExternalLink size={14} />}
                        sx={{ mt: 1, textTransform: 'none', fontWeight: 600, color: 'var(--primary)' }}
                      >
                        {t.storefront.viewShopPage}
                      </Button>
                    )}
                  </Box>
                )}
                {/* Modern Filter Bar */}
                <Box sx={{
                  p: 2,
                  mb: 3,
                  borderRadius: '20px',
                  bgcolor: 'var(--surface)',
                  border: '1px solid var(--glass-border)',
                  backdropFilter: 'blur(16px)',
                  backgroundImage: (theme: any) => theme.palette.mode === 'dark'
                    ? 'radial-gradient(ellipse at 30% 0%, rgba(0,113,227,0.08) 0%, transparent 60%)'
                    : 'radial-gradient(ellipse at 30% 0%, rgba(0,113,227,0.04) 0%, transparent 60%)',
                  boxShadow: (theme: any) => theme.palette.mode === 'dark'
                    ? '0 8px 32px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.04)'
                    : '0 4px 16px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.8)',
                }}>
                  {/* Search and Stats Row */}
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Box sx={{
                        width: 36,
                        height: 36,
                        borderRadius: '10px',
                        bgcolor: 'rgba(0,113,227,0.15)',
                        display: 'grid',
                        placeItems: 'center',
                      }}>
                        <Store size={18} color="#2997ff" />
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--foreground)' }}>
                          {catalogContext.shopName || t.product.allProducts}
                        </Typography>
                        <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {t.product.foundItems} {filteredProductCount} {t.common.items} ({activeProductCount} {t.product.openForSale})
                        </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <IconButton 
                        onClick={() => setShowSearchBar(!showSearchBar)}
                        sx={{ 
                          color: showSearchBar ? 'var(--primary)' : 'var(--text-muted)',
                          bgcolor: showSearchBar ? 'rgba(0,113,227,0.15)' : 'var(--glass-bg)',
                        }}
                      >
                        <Badge badgeContent={activeFilterCount || undefined} color="warning" invisible={activeFilterCount === 0}>
                          <Search size={18} />
                        </Badge>
                      </IconButton>
                    </Box>
                  </Box>

                  {!showSearchBar && (
                    <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap', pb: 0.5 }}>
                      {categoryMeta.map((cat) => {
                        const active = categoryFilter === cat.key;
                        return (
                          <Box
                            key={cat.key}
                            className={active ? 'category-chip-active' : ''}
                            onClick={() => setCategoryFilter(cat.key)}
                            sx={{
                              px: 1.8,
                              py: 0.8,
                              borderRadius: '12px',
                              bgcolor: active ? 'rgba(0,113,227,0.2)' : 'var(--glass-bg)',
                              border: active ? '1px solid rgba(0,113,227,0.5)' : '1px solid var(--glass-border)',
                              color: active ? 'var(--primary)' : 'var(--text-muted)',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 0.8,
                              '&:hover': {
                                bgcolor: active ? 'rgba(0,113,227,0.25)' : 'rgba(0,113,227,0.08)',
                                borderColor: active ? 'rgba(0,113,227,0.6)' : 'rgba(0,113,227,0.2)',
                                color: 'var(--primary)',
                              },
                            }}
                          >
                            <span style={{ fontSize: '0.9rem' }}>{(cat as any).icon || ''}</span>
                            {cat.label}
                            <Box sx={{
                              px: 0.7,
                              py: 0.1,
                              borderRadius: '6px',
                              bgcolor: active ? 'rgba(0,113,227,0.4)' : 'var(--glass-bg)',
                              fontSize: '0.65rem',
                              fontWeight: 700,
                            }}>
                              {cat.count}
                            </Box>
                          </Box>
                        );
                      })}
                    </Box>
                  )}
                </Box>
              </Box>
            )}

            {catalogContext.products.length > 0 && Object.keys(displayGroupedProducts).length > 0 ? (
              Object.entries(displayGroupedProducts).map(([category, items]) => (
                <Box key={category} sx={{ mb: 5 }}>
                  {/* Category Header — Redesigned */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
                    <Box sx={{
                      width: 40,
                      height: 40,
                      borderRadius: '12px',
                      background: 'linear-gradient(135deg, rgba(0,113,227,0.15) 0%, rgba(100,210,255,0.1) 100%)',
                      border: '1px solid rgba(0,113,227,0.15)',
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: '1.15rem',
                      flexShrink: 0,
                    }}>
                      {category === '__SEARCH__' ? '🔍' : getCategoryIcon(category)}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ 
                        fontSize: '1.15rem', 
                        fontWeight: 800, 
                        color: 'var(--foreground)', 
                        letterSpacing: '-0.02em',
                        lineHeight: 1.2,
                      }}>
                        {category === '__SEARCH__'
                          ? t.search.results
                          : (t.category as Record<string, string>)[category] || getCategoryLabel(category, lang) || TYPE_LABELS_I18N[category] || category || t.type.OTHER}
                      </Typography>
                      <Typography sx={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                        {items.length} {t.common.items}
                        {items.length > 1 && <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' }, ml: 0.5 }}>• {t.product.scrollMore}</Box>}
                      </Typography>
                    </Box>
                    <Box sx={{
                      px: 1.5,
                      py: 0.5,
                      borderRadius: '10px',
                      bgcolor: 'rgba(0,113,227,0.1)',
                      border: '1px solid rgba(0,113,227,0.15)',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      color: 'var(--primary)',
                      flexShrink: 0,
                    }}>
                      {items.filter(p => getProductStatus(p) === 'OPEN').length}/{items.length}
                    </Box>
                  </Box>
                  {/* Gradient Divider */}
                  <Box className="gradient-divider" sx={{ mb: 2.5 }} />
                  <Box sx={{ position: 'relative', overflow: 'hidden', mx: { xs: -2, sm: 0 } }}>
                    {/* Right fade hint on mobile */}
                    <Box sx={{
                      display: { xs: 'block', sm: 'none' },
                      position: 'absolute',
                      top: 0,
                      right: 0,
                      bottom: 0,
                      width: 32,
                      background: 'linear-gradient(to right, transparent, var(--background))',
                      zIndex: 2,
                      pointerEvents: 'none',
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
                      const isProductAvailable = productStatus === 'OPEN' && catalogContext.isOpen;
                      const isProductClosed = productStatus !== 'OPEN'; // Product is closed/coming soon/ended
                      const eventDiscount = getEventDiscount(product.id, catalogContext.events);
                      
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
                            if (!catalogContext.isOpen) {
                              showToast('warning', t.checkout.shopClosedWarning);
                              return;
                            }
                            if (productStatus !== 'OPEN') {
                              const statusConfig = SHOP_STATUS_CONFIG[productStatus];
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
                            handleSelectProduct(product, {
                              shopId: catalogContext.shopId,
                              shopSlug: catalogContext.shopSlug,
                            });
                          }}
                          sx={{
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            cursor: isProductAvailable ? 'pointer' : 'default',
                            borderRadius: 'var(--card-radius)',
                            overflow: 'hidden',
                            bgcolor: 'var(--surface)',
                            boxShadow: 'var(--card-shadow)',
                            border: isProductClosed ? `1px solid ${SHOP_STATUS_CONFIG[productStatus].borderColor}` : '1px solid transparent',
                            position: 'relative',
                            opacity: isProductClosed ? 0.85 : 1,
                            '&:hover': isProductAvailable ? {
                              boxShadow: (theme: any) => theme.palette.mode === 'dark'
                                ? '0 12px 40px rgba(0,0,0,0.45), 0 0 0 1px rgba(0,113,227,0.15)'
                                : '0 8px 30px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,113,227,0.08)',
                            } : {},
                          }}
                        >
                          {/* Product Image Area */}
                          <Box sx={{
                            position: 'relative',
                            width: '100%',
                            aspectRatio: '1 / 1',
                            bgcolor: 'var(--surface-2)',
                            overflow: 'hidden',
                          }}>
                            {/* Optimized product image with lazy loading - ใช้ coverImage ก่อน */}
                            {(product.coverImage || product.images?.[0]) ? (
                              <OptimizedImage
                                src={product.coverImage ?? (product.images && product.images[0]) ?? ''}
                                alt={product.name}
                                width="100%"
                                height="100%"
                                objectFit="cover"
                                priority={productIdx < 4} // First 4 products load eagerly
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
                                position: 'absolute', 
                                inset: 0, 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                color: 'var(--text-muted)',
                                fontSize: '0.8rem',
                              }}>
                                {t.common.noImage}
                              </Box>
                            )}
                            {/* Status Overlay for closed products */}
                            {isProductClosed && (
                              <Box sx={{
                                position: 'absolute',
                                inset: 0,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: 'rgba(0,0,0,0.6)',
                                backdropFilter: 'blur(2px)',
                              }}>
                                <Box
                                  sx={{
                                    width: 48,
                                    height: 48,
                                    borderRadius: '14px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: `linear-gradient(135deg, ${SHOP_STATUS_CONFIG[productStatus].color}40 0%, ${SHOP_STATUS_CONFIG[productStatus].color}20 100%)`,
                                    border: `2px solid ${SHOP_STATUS_CONFIG[productStatus].color}`,
                                    color: SHOP_STATUS_CONFIG[productStatus].color,
                                    mb: 1,
                                    boxShadow: `0 0 20px ${SHOP_STATUS_CONFIG[productStatus].color}40`,
                                  }}
                                >
                                  {(() => {
                                    const IconComponent = SHOP_STATUS_CONFIG[productStatus].icon;
                                    return <IconComponent size={24} />;
                                  })()}
                                </Box>
                                <Typography
                                  sx={{
                                    fontSize: '0.8rem',
                                    fontWeight: 800,
                                    color: SHOP_STATUS_CONFIG[productStatus].color,
                                    textAlign: 'center',
                                    px: 2,
                                    textShadow: '0 2px 8px rgba(0,0,0,0.5)',
                                  }}
                                >
                                  {({
                                    OPEN: t.shopStatus.open,
                                    COMING_SOON: t.shopStatus.comingSoon,
                                    ORDER_ENDED: t.shopStatus.closedEnded,
                                    TEMPORARILY_CLOSED: t.shopStatus.closed,
                                    WAITING_TO_OPEN: t.shopStatus.waitingToOpen,
                                  } as Record<ShopStatusType, string>)[productStatus]}
                                </Typography>
                                {/* Show date info */}
                                {product.startDate && productStatus === 'COMING_SOON' && (
                                  <Typography sx={{ fontSize: '0.65rem', color: 'var(--foreground)', mt: 0.5, textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
                                    {t.product.opensOn} {new Date(product.startDate).toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US')}
                                  </Typography>
                                )}
                              </Box>
                            )}
                            
                            {/* Feature badges */}
                            {!isProductClosed && (
                              <Box className="floating-badge" sx={{ 
                                position: 'absolute', 
                                top: 8, 
                                left: 8, 
                                display: 'flex', 
                                flexDirection: 'column', 
                                gap: 0.5,
                                zIndex: 2,
                              }}>
                                {/* Countdown timer if has endDate */}
                                {product.endDate && new Date(product.endDate) > new Date() && (
                                  <Box sx={{
                                    px: 0.8,
                                    py: 0.4,
                                    borderRadius: '6px',
                                    bgcolor: 'rgba(239,68,68,0.9)',
                                    fontSize: '0.58rem',
                                    fontWeight: 700,
                                    color: 'white',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 0.5,
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
                                )}
                              </Box>
                            )}
                            
                            {/* Price badge */}
                            <Box sx={{
                              position: 'absolute',
                              bottom: 10,
                              right: 10,
                              px: 1.2,
                              py: 0.4,
                              borderRadius: '10px',
                              bgcolor: (theme: any) => theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.75)' : 'rgba(255,255,255,0.9)',
                              backdropFilter: 'blur(12px)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 0.5,
                              boxShadow: (theme: any) => theme.palette.mode === 'dark' ? 'none' : '0 1px 4px rgba(0,0,0,0.1)',
                            }}>
                              {eventDiscount && !isProductClosed ? (
                                <>
                                  <Typography sx={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                                    ฿{product.basePrice.toLocaleString()}
                                  </Typography>
                                  <Typography sx={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--error)' }}>
                                    ฿{eventDiscount.discountedPrice(product.basePrice).toLocaleString()}
                                  </Typography>
                                </>
                              ) : (
                                <Typography sx={{ 
                                  fontSize: '0.88rem', 
                                  fontWeight: 800, 
                                  color: isProductClosed ? 'var(--text-muted)' : 'var(--foreground)',
                                }}>
                                  ฿{product.basePrice.toLocaleString()}
                                </Typography>
                              )}
                            </Box>

                            {/* Event discount badge */}
                            {eventDiscount && !isProductClosed && (
                              <Box sx={{
                                position: 'absolute',
                                top: 8,
                                right: 8,
                                px: 0.8,
                                py: 0.4,
                                borderRadius: '8px',
                                bgcolor: 'rgba(255,69,58,0.9)',
                                fontSize: '0.6rem',
                                fontWeight: 800,
                                color: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.3,
                                backdropFilter: 'blur(4px)',
                              }}>
                                <Tag size={10} />
                                {eventDiscount.discountLabel}
                              </Box>
                            )}

                            {/* Action buttons */}
                            <Box
                              sx={{
                                position: 'absolute',
                                bottom: 8,
                                left: 8,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                              }}
                            >
                              <IconButton
                                size="small"
                                onClick={(e) => { e.stopPropagation(); handleShareProduct(product); }}
                                sx={{
                                  bgcolor: 'rgba(0,0,0,0.5)',
                                  backdropFilter: 'blur(8px)',
                                  color: 'white',
                                  width: 30,
                                  height: 30,
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
                                  width: 30,
                                  height: 30,
                                  '&:hover': { bgcolor: 'rgba(255,69,58,0.7)' },
                                  transition: 'all 0.2s ease',
                                }}
                              >
                                <Heart size={14} fill={wishlistStore.isInWishlist(product.id) ? '#ff453a' : 'none'} />
                              </IconButton>
                            </Box>
                          </Box>

                          {/* Product Info — Redesigned */}
                          <Box sx={{ 
                            p: 2, 
                            pt: 1.5,
                            flex: 1, 
                            display: 'flex', 
                            flexDirection: 'column',
                          }}>
                            {/* Type Label */}
                            <Typography sx={{
                              fontSize: '0.62rem',
                              fontWeight: 700,
                              color: 'var(--primary)',
                              textTransform: 'uppercase',
                              letterSpacing: '0.06em',
                              mb: 0.3,
                              opacity: isProductClosed ? 0.5 : 0.8,
                            }}>
                              {(t.category as Record<string, string>)[((product as any).category || getCategoryFromType(product.type))] || TYPE_LABELS_I18N[product.type] || product.type}
                            </Typography>

                            {/* Product Name */}
                            <Typography sx={{ 
                              fontSize: '0.9rem', 
                              fontWeight: 700, 
                              color: isProductClosed ? 'var(--text-muted)' : 'var(--foreground)',
                              mb: 0.5,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              lineHeight: 1.3,
                              letterSpacing: '-0.01em',
                            }}>
                              {getProductName(product, lang)}
                            </Typography>
                            
                            {/* Description — 1 line */}
                            {getProductDescription(product, lang) && (
                              <Typography sx={{ 
                                fontSize: '0.72rem', 
                                color: 'var(--text-muted)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                lineHeight: 1.4,
                                mb: 0.8,
                              }}>
                                {getProductDescription(product, lang)}
                              </Typography>
                            )}

                            {/* Tags — inline compact */}
                            {(() => {
                              const tags = product.customTags && product.customTags.length > 0 
                                ? product.customTags 
                                : [
                                    ...(product.options?.hasCustomName ? [{
                                      text: t.product.customNameAvailable,
                                      color: 'var(--success)',
                                      bgColor: 'rgba(16,185,129,0.1)',
                                      borderColor: 'rgba(16,185,129,0.2)'
                                    }] : []),
                                    ...(product.options?.hasCustomNumber ? [{
                                      text: t.product.customNumberAvailable,
                                      color: 'var(--secondary)',
                                      bgColor: 'rgba(0,113,227,0.1)',
                                      borderColor: 'rgba(0,113,227,0.2)'
                                    }] : []),
                                  ];
                              
                              if (tags.length === 0) return null;
                              
                              return (
                                <Box sx={{ 
                                  display: 'flex', 
                                  flexWrap: 'wrap', 
                                  gap: 0.4, 
                                  mb: 0.8,
                                }}>
                                  {tags.slice(0, 3).map((tag, idx) => (
                                    <Box key={idx} sx={{
                                      px: 0.7,
                                      py: 0.15,
                                      borderRadius: '5px',
                                      bgcolor: (tag as any).bgColor || `${tag.color}15`,
                                      fontSize: '0.55rem',
                                      fontWeight: 600,
                                      color: tag.color,
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 0.2,
                                    }}>
                                      {lang === 'en' 
                                        ? ((tag as any).textEn || TAG_TRANSLATIONS_TH_TO_EN[tag.text] || tag.text)
                                        : tag.text}
                                    </Box>
                                  ))}
                                </Box>
                              );
                            })()}

                            {/* ---- Price + Action Row ---- */}
                            <Box sx={{ mt: 'auto', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 1 }}>
                              {/* Price Display */}
                              <Box>
                                {!isProductClosed && (
                                  <>
                                    {eventDiscount ? (
                                      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                                        <Typography className="price-glow" sx={{
                                          fontSize: '1.1rem',
                                          fontWeight: 800,
                                          color: '#ff453a',
                                          lineHeight: 1,
                                          letterSpacing: '-0.02em',
                                        }}>
                                          ฿{eventDiscount.discountedPrice(getBasePrice(product)).toLocaleString()}
                                        </Typography>
                                        <Typography sx={{
                                          fontSize: '0.68rem',
                                          color: 'var(--text-muted)',
                                          textDecoration: 'line-through',
                                          lineHeight: 1,
                                        }}>
                                          ฿{getBasePrice(product).toLocaleString()}
                                        </Typography>
                                      </Box>
                                    ) : (
                                      <Typography className="price-glow" sx={{
                                        fontSize: '1.1rem',
                                        fontWeight: 800,
                                        color: 'var(--foreground)',
                                        lineHeight: 1,
                                        letterSpacing: '-0.02em',
                                      }}>
                                        ฿{getBasePrice(product).toLocaleString()}
                                      </Typography>
                                    )}
                                    {Object.keys(product.sizePricing || {}).length > 1 && (
                                      <Typography sx={{
                                        fontSize: '0.58rem',
                                        color: 'var(--text-muted)',
                                        mt: 0.2,
                                      }}>
                                        {lang === 'en' ? 'Starting from' : 'เริ่มต้น'}
                                      </Typography>
                                    )}
                                  </>
                                )}
                              </Box>
                              
                              {/* Action Button — Compact */}
                              {!isProductClosed ? (
                                <Button
                                  className={isProductAvailable ? 'shimmer-btn' : ''}
                                  disabled={!isProductAvailable}
                                  size="small"
                                  sx={{
                                    minWidth: 0,
                                    px: 2,
                                    py: 0.7,
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
                                  {catalogContext.isOpen ? t.product.viewDetail : t.product.shopClosedTemp}
                                </Button>
                              ) : (
                                <Box
                                  sx={{
                                    px: 1.2,
                                    py: 0.5,
                                    borderRadius: '8px',
                                    background: SHOP_STATUS_CONFIG[productStatus].bgGradient,
                                    border: `1px solid ${SHOP_STATUS_CONFIG[productStatus].borderColor}`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 0.5,
                                    flexShrink: 0,
                                  }}
                                >
                                  {(() => {
                                    const IconComponent = SHOP_STATUS_CONFIG[productStatus].icon;
                                    return <IconComponent size={12} color={SHOP_STATUS_CONFIG[productStatus].color} />;
                                  })()}
                                  <Typography 
                                    sx={{ 
                                      fontSize: '0.65rem', 
                                      fontWeight: 700, 
                                      color: SHOP_STATUS_CONFIG[productStatus].color,
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
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
            ) : (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <Store size={64} style={{ color: 'var(--text-muted)', marginBottom: 16 }} />
                <Typography variant="h6" sx={{ color: 'var(--text-muted)', mb: 1 }}>
                  {totalProductCount > 0 ? t.product.noProductsSearch : t.product.noProductsYet}
                </Typography>
                {totalProductCount === 0 && (
                  <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    {t.product.comingSoon}
                  </Typography>
                )}
              </Box>
            )}
          </Container>
        </Box>
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
          showToast('success', t.payment.paymentSuccessToast);
          
          // Refresh order history from server to get complete data
          setTimeout(() => {
            loadOrderHistory();
          }, 500);
        }}
      />

      {showProfileModal && (
        <ProfileModal
          initialData={{ name: orderData.name, phone: orderData.phone, address: orderData.address, instagram: orderData.instagram, profileImage: orderData.profileImage, savedAddresses }}
          onClose={() => { setShowProfileModal(false); setActiveTab('home'); }}
          onSave={handleSaveProfile}
          userImage={session?.user?.image || ''}
          userEmail={session?.user?.email || ''}
          nameValidation={config?.nameValidation}
        />
      )}


      {/* ===== Cart Drawer with Edit Dialog ===== */}
      <CartDrawer
        open={showCart}
        onClose={() => setShowCart(false)}
        cart={cart}
        config={config}
        shippingConfig={shippingConfig}
        isShopOpen={cartCheckoutOpen}
        onClearCart={() => {
          saveCart([]);
          showToast('success', t.cart.cleared);
        }}
        onUpdateQuantity={(itemId, quantity) => updateCartQuantity(itemId, quantity)}
        onRemoveItem={(itemId) => removeFromCart(itemId)}
        onEditItem={(item) => openEditCartItem(item)}
        onCheckout={() => {
          if (!requireProfileBeforeCheckout()) return;
          setShowCart(false);
          setShowOrderDialog(true);
        }}
        onStartHold={(itemId, direction) => startCartHold(itemId, direction)}
        onStopHold={(itemId) => stopCartHold(itemId)}
        onGoHome={() => { setShowCart(false); setActiveTab('home'); }}
        getTotalPrice={getTotalPrice}
        editingCartItem={editingCartItem}
        onSetEditingCartItem={setEditingCartItem}
        onUpdateCartItem={(itemId, item) => updateCartItem(itemId, item)}
      />
      <ProductDetailsDialog
        selectedProduct={selectedProduct}
        productDialogOpen={productDialogOpen}
        isMobile={isMobile}
        lang={lang}
        activeProductCatalog={activeProductCatalog}
        t={t}
        wishlistStore={wishlistStore}
        showToast={showToast}
        resetProductDialog={resetProductDialog}
        inlineNotice={inlineNotice}
        setInlineNotice={setInlineNotice}
        productReviews={productReviews}
        productOptions={productOptions}
        setProductOptions={setProductOptions}
        handleAddToCart={handleAddToCart}
        handleBuyNow={handleBuyNow}
        openBulkOrder={openBulkOrder}
        handleShareProduct={handleShareProduct}
        sizeSelectorRef={sizeSelectorRef}
        customNameInputRef={customNameInputRef}
        customNumberInputRef={customNumberInputRef}
        patternSelectorRef={patternSelectorRef}
        getCurrentPrice={getCurrentPrice}
        bottomPanelCollapsed={bottomPanelCollapsed}
        setBottomPanelCollapsed={setBottomPanelCollapsed}
        session={session}
        setReviewRating={setReviewRating}
        setReviewComment={setReviewComment}
        setReviewDialogOpen={setReviewDialogOpen}
        config={config!}
      />

      {/* ===== Size Chart Dialog - Modern Design ===== */}
      <Dialog
        open={showSizeChart}
        onClose={() => setShowSizeChart(false)}
        maxWidth="sm"
        fullWidth
        sx={{ zIndex: 1500 }}
        PaperProps={{
          sx: {
            bgcolor: 'var(--background)',
            color: 'var(--foreground)',
            borderRadius: '20px',
            border: (theme) => `1px solid ${theme.palette.divider}`,
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
          borderBottom: '1px solid var(--glass-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{
              width: 40,
              height: 40,
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #0071e3 0%, #0077ED 100%)',
              display: 'grid',
              placeItems: 'center',
            }}>
              <Ruler size={20} color="white" />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--foreground)' }}>{t.product.sizeChartTitle}</Typography>
              <Typography sx={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.product.sizeChartSubtitle}</Typography>
            </Box>
          </Box>
        </Box>

        {/* Content */}
        <Box sx={{ px: 2.5, py: 2, overflow: 'auto' }}>
          {/* Info Badges */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8, mb: 2.5 }}>
            <Box sx={{
              px: 1.2,
              py: 0.4,
              borderRadius: '8px',
              bgcolor: 'rgba(0,113,227,0.15)',
              border: '1px solid rgba(0,113,227,0.3)',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'var(--secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
            }}>
              <Ruler size={14} /> {t.misc.sizeChartInch}
            </Box>
            <Box sx={{
              px: 1.2,
              py: 0.4,
              borderRadius: '8px',
              bgcolor: 'rgba(245,158,11,0.15)',
              border: '1px solid rgba(245,158,11,0.3)',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'var(--warning)',
            }}>
              {t.common.longSleeve} +{selectedProduct?.options?.longSleevePrice ?? 50}฿
            </Box>
          </Box>

          {/* Size Cards Grid */}
          <Box sx={{ 
            display: 'grid', 
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, 
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
                    bgcolor: 'var(--surface-2)',
                    border: '1px solid var(--glass-border)',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      bgcolor: 'var(--glass-bg)',
                      borderColor: 'rgba(0,113,227,0.3)',
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Box sx={{
                      px: 1,
                      py: 0.3,
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, #0071e3 0%, #0077ED 100%)',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      color: 'white',
                    }}>
                      {size}
                    </Box>
                    <Typography sx={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--success)' }}>
                      {row ? `฿${row.price.toLocaleString()}` : '—'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1.5 }}>
                    <Box>
                      <Typography sx={{ fontSize: '0.65rem', color: 'var(--text-muted)', mb: 0.2 }}>{t.product.chestFull}</Typography>
                      <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--foreground)' }}>
                        {measurements ? `${measurements.chest}"` : '—'}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: '0.65rem', color: 'var(--text-muted)', mb: 0.2 }}>{t.product.lengthFull}</Typography>
                      <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--foreground)' }}>
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
          borderTop: '1px solid var(--glass-border)',
        }}>
          <Button
            fullWidth
            onClick={() => setShowSizeChart(false)}
            sx={{
              py: 1.3,
              borderRadius: '12px',
              bgcolor: 'var(--glass-bg)',
              color: 'var(--text-muted)',
              fontSize: '0.9rem',
              fontWeight: 600,
              '&:hover': {
                bgcolor: 'var(--glass-bg)',
              },
            }}
          >
            {t.common.close}
          </Button>
        </Box>
      </Dialog>

      {/* Checkout Dialog with Shipping & Payment Selection */}
      <CheckoutDialog
        open={showOrderDialog}
        onClose={() => setShowOrderDialog(false)}
        cart={cart}
        orderData={orderData}
        profileComplete={profileComplete}
        processing={processing}
        turnstileToken={turnstileToken}
        setTurnstileToken={setTurnstileToken}
        onSubmitOrder={submitOrder}
        onEditProfile={() => { setShowProfileModal(true); setPendingCheckout(true); }}
        products={allCatalogProducts}
        shopId={checkoutShopId}
        isMobile={isMobile}
        savedAddresses={savedAddresses}
        onAddressChange={(address) => setOrderData(prev => ({ ...prev, address }))}
      />

      <Dialog
        open={!!confirmCancelRef}
        onClose={() => setConfirmCancelRef(null)}
        fullScreen={isMobile}
        PaperProps={{
          sx: {
            width: { xs: '100%', sm: 420 },
            maxWidth: 'calc(100% - 24px)',
            bgcolor: 'var(--surface)',
            color: 'var(--foreground)',
            borderRadius: 2,
            p: 1,
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
          <AlertTriangle size={20} color="#ffd60a" />
          {t.orderHistory.confirmCancelTitle}
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: 'var(--text-muted)', mb: 1 }}>
            {t.orderHistory.confirmCancelMessage} {confirmCancelRef ? `#${confirmCancelRef}` : ''} {t.orderHistory.confirmCancelAsk}
          </Typography>
          <Typography variant="caption" sx={{ color: 'var(--text-muted)' }}>
            {t.orderHistory.cancelWarning}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button
            variant="outlined"
            onClick={() => setConfirmCancelRef(null)}
            sx={{ color: 'var(--text-muted)', borderColor: 'var(--glass-border)' }}
          >
            {t.orderHistory.dontCancel}
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
              background: '#ff453a',
              '&:hover': { background: '#ff3b30' },
              fontWeight: 800,
              px: 2.5,
            }}
          >
            {t.orderHistory.confirmCancel}
          </Button>
        </DialogActions>
      </Dialog>


      {/* ===== Order History Drawer ===== */}
      <OrderHistoryDrawer
        open={showHistoryDialog}
        onClose={() => setShowHistoryDialog(false)}
        orderHistory={orderHistory}
        loadingHistory={loadingHistory}
        loadingHistoryMore={loadingHistoryMore}
        historyHasMore={historyHasMore}
        historyFilter={historyFilter}
        onFilterChange={(filter) => setHistoryFilter(filter)}
        onLoadMore={() => loadOrderHistory({ append: true })}
        onOpenPayment={(ref) => openPaymentFlow(ref)}
        onCancelOrder={(ref) => handleCancelOrder(ref)}
        onShowQR={(ref) => setShowQRFullscreen(ref)}
        cancellingRef={cancellingRef}
        isShopOpen={isShopOpen}
        realtimeConnected={realtimeConnected}
        config={config}
        onImageClick={(image) => {
          setLightboxImages([image]);
          setLightboxIndex(0);
          setLightboxImage(image);
        }}
      />

      {/* ===== Wishlist Drawer ===== */}
      <Drawer
        anchor="right"
        open={showWishlistDrawer}
        onClose={() => setShowWishlistDrawer(false)}
        PaperProps={{
          sx: {
            width: { xs: '100%', sm: 420 },
            bgcolor: 'var(--background)',
            backgroundImage: 'none',
          },
        }}
      >
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--glass-border)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Heart size={20} color="#ff453a" />
            <Typography sx={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--foreground)' }}>
              {t.wishlist.title}
            </Typography>
            {wishlistStore.items.length > 0 && (
              <Chip label={`${wishlistStore.items.length} ${t.wishlist.items}`} size="small" sx={{ fontSize: '0.7rem', height: 22, bgcolor: 'rgba(255,69,58,0.1)', color: '#ff453a' }} />
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {wishlistStore.items.length > 0 && (
              <IconButton size="small" onClick={() => { wishlistStore.clearWishlist(); showToast('info', t.wishlist.clearAll); }} sx={{ color: 'var(--text-muted)' }}>
                <X size={16} />
              </IconButton>
            )}
            <IconButton size="small" onClick={() => setShowWishlistDrawer(false)} sx={{ color: 'var(--text-muted)' }}>
              <X size={20} />
            </IconButton>
          </Box>
        </Box>
        <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
          {wishlistStore.items.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8, color: 'var(--text-muted)' }}>
              <Heart size={48} strokeWidth={1} />
              <Typography sx={{ mt: 2, fontWeight: 600 }}>{t.wishlist.empty}</Typography>
              <Typography sx={{ mt: 0.5, fontSize: '0.85rem', opacity: 0.7 }}>{t.wishlist.emptyDesc}</Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {wishlistStore.items.map((productId) => {
                const product = Object.values(allGroupedProducts).flat().find((p) => p.id === productId);
                if (!product) return null;
                const eventDiscount = getEventDiscount(product.id, config?.events as ShopEvent[] | undefined);
                const productStatus = getProductStatus(product);
                const statusLabelsMap: Record<ShopStatusType, string> = {
                  OPEN: t.shopStatus.open,
                  COMING_SOON: t.shopStatus.comingSoon,
                  ORDER_ENDED: t.shopStatus.closedEnded,
                  TEMPORARILY_CLOSED: t.shopStatus.closed,
                  WAITING_TO_OPEN: t.shopStatus.waitingToOpen,
                };
                return (
                  <Box
                    key={productId}
                    onClick={() => {
                      if (!isShopOpen) {
                        showToast('warning', t.checkout.shopClosedWarning);
                        return;
                      }
                      if (productStatus !== 'OPEN') {
                        showToast('info', `${getProductName(product, lang)} - ${statusLabelsMap[productStatus]}`);
                        return;
                      }
                      setShowWishlistDrawer(false);
                      handleSelectProduct(product);
                    }}
                    sx={{
                      display: 'flex',
                      gap: 1.5,
                      p: 1.5,
                      borderRadius: '16px',
                      bgcolor: 'var(--surface)',
                      border: '1px solid var(--glass-border)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      '&:hover': { borderColor: 'rgba(0,113,227,0.3)', transform: 'translateX(4px)' },
                    }}
                  >
                    <Box sx={{ width: 72, height: 72, borderRadius: '12px', overflow: 'hidden', flexShrink: 0, bgcolor: 'var(--surface-2)' }}>
                      {(product.coverImage || product.images?.[0]) && (
                        <OptimizedImage src={product.coverImage ?? product.images![0]} alt={product.name} width={72} height={72} objectFit="cover" />
                      )}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {getProductName(product, lang)}
                      </Typography>
                      <Typography sx={{ fontSize: '0.8rem', color: 'var(--text-muted)', mt: 0.3 }}>
                        {getCategoryLabel(product.category || product.type, lang)}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                        {eventDiscount ? (
                          <>
                            <Typography sx={{ fontSize: '0.75rem', color: '#86868b', textDecoration: 'line-through' }}>฿{product.basePrice.toLocaleString()}</Typography>
                            <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, color: '#ff453a' }}>฿{eventDiscount.discountedPrice(product.basePrice).toLocaleString()}</Typography>
                          </>
                        ) : (
                          <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, color: '#34c759' }}>฿{product.basePrice.toLocaleString()}</Typography>
                        )}
                      </Box>
                    </Box>
                    <IconButton
                      size="small"
                      onClick={(e) => { e.stopPropagation(); wishlistStore.removeItem(productId); showToast('info', t.wishlist.removedFromWishlist); }}
                      sx={{ color: '#ff453a', alignSelf: 'center' }}
                    >
                      <Heart size={18} fill="#ff453a" />
                    </IconButton>
                  </Box>
                );
              })}
            </Box>
          )}
        </Box>
      </Drawer>

      {/* ===== Recently Viewed Drawer ===== */}
      <Drawer
        anchor="right"
        open={showRecentlyViewed}
        onClose={() => setShowRecentlyViewed(false)}
        PaperProps={{
          sx: {
            width: { xs: '100%', sm: 420 },
            bgcolor: 'var(--background)',
            backgroundImage: 'none',
          },
        }}
      >
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--glass-border)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Eye size={20} color="#64d2ff" />
            <Typography sx={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--foreground)' }}>
              {t.recentlyViewed.title}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {recentlyViewedStore.items.length > 0 && (
              <Button size="small" onClick={() => recentlyViewedStore.clear()} sx={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                {t.recentlyViewed.clearAll}
              </Button>
            )}
            <IconButton size="small" onClick={() => setShowRecentlyViewed(false)} sx={{ color: 'var(--text-muted)' }}>
              <X size={20} />
            </IconButton>
          </Box>
        </Box>
        <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
          {recentlyViewedStore.items.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8, color: 'var(--text-muted)' }}>
              <Eye size={48} strokeWidth={1} />
              <Typography sx={{ mt: 2, fontWeight: 600 }}>{t.recentlyViewed.empty}</Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {recentlyViewedStore.items.map((productId) => {
                const product = Object.values(allGroupedProducts).flat().find((p) => p.id === productId);
                if (!product) return null;
                const productStatus = getProductStatus(product);
                const statusLabelsMap: Record<ShopStatusType, string> = {
                  OPEN: t.shopStatus.open,
                  COMING_SOON: t.shopStatus.comingSoon,
                  ORDER_ENDED: t.shopStatus.closedEnded,
                  TEMPORARILY_CLOSED: t.shopStatus.closed,
                  WAITING_TO_OPEN: t.shopStatus.waitingToOpen,
                };
                return (
                  <Box
                    key={productId}
                    onClick={() => {
                      if (!isShopOpen) {
                        showToast('warning', t.checkout.shopClosedWarning);
                        return;
                      }
                      if (productStatus !== 'OPEN') {
                        showToast('info', `${getProductName(product, lang)} - ${statusLabelsMap[productStatus]}`);
                        return;
                      }
                      setShowRecentlyViewed(false);
                      handleSelectProduct(product);
                    }}
                    sx={{
                      display: 'flex',
                      gap: 1.5,
                      p: 1.5,
                      borderRadius: '16px',
                      bgcolor: 'var(--surface)',
                      border: '1px solid var(--glass-border)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      '&:hover': { borderColor: 'rgba(0,113,227,0.3)', transform: 'translateX(4px)' },
                    }}
                  >
                    <Box sx={{ width: 60, height: 60, borderRadius: '10px', overflow: 'hidden', flexShrink: 0, bgcolor: 'var(--surface-2)' }}>
                      {(product.coverImage || product.images?.[0]) && (
                        <OptimizedImage src={product.coverImage ?? product.images![0]} alt={product.name} width={60} height={60} objectFit="cover" />
                      )}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {getProductName(product, lang)}
                      </Typography>
                      <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#34c759', mt: 0.3 }}>
                        ฿{product.basePrice.toLocaleString()}
                      </Typography>
                    </Box>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        const wasInWishlist = wishlistStore.items.includes(productId);
                        wishlistStore.toggleItem(productId);
                        showToast(
                          wasInWishlist ? 'info' : 'success',
                          wasInWishlist ? t.wishlist.removedFromWishlist : t.wishlist.addedToWishlist
                        );
                      }}
                      sx={{ color: wishlistStore.isInWishlist(productId) ? '#ff453a' : 'var(--text-muted)', alignSelf: 'center' }}
                    >
                      <Heart size={16} fill={wishlistStore.isInWishlist(productId) ? '#ff453a' : 'none'} />
                    </IconButton>
                  </Box>
                );
              })}
            </Box>
          )}
        </Box>
      </Drawer>

      {/* ===== Bulk Order Dialog ===== */}
      <Dialog
        open={bulkOrderOpen}
        onClose={() => setBulkOrderOpen(false)}
        fullWidth
        maxWidth="sm"
        sx={{ zIndex: 9000 }}
        slotProps={{ backdrop: { sx: { backdropFilter: 'blur(8px)', backgroundColor: 'rgba(0,0,0,0.5)' } } }}
        PaperProps={{
          sx: {
            borderRadius: '24px',
            bgcolor: 'var(--surface)',
            backgroundImage: 'none',
            maxHeight: '85vh',
          },
        }}
      >
        {selectedProduct && (
          <>
            {/* Header */}
            <Box sx={{ p: 2.5, pb: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{
                width: 44, height: 44, borderRadius: '12px', overflow: 'hidden', flexShrink: 0,
                bgcolor: 'rgba(168,85,247,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Users size={22} style={{ color: '#a855f7' }} />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: 'var(--foreground)' }}>
                  {t.bulkOrder.title}
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {getProductName(selectedProduct, lang)}
                </Typography>
              </Box>
              <IconButton size="small" onClick={() => setBulkOrderOpen(false)} sx={{ color: 'var(--text-muted)' }}>
                <X size={20} />
              </IconButton>
            </Box>

            {/* Steps Indicator */}
            <Box sx={{ px: 2.5, pb: 1.5, display: 'flex', gap: 1 }}>
              {[t.bulkOrder.step1, t.bulkOrder.step2, t.bulkOrder.step3].map((label, i) => (
                <Box key={i} sx={{
                  flex: 1, textAlign: 'center', py: 0.6, borderRadius: '10px', fontSize: '0.72rem', fontWeight: 600,
                  bgcolor: bulkStep === i ? 'rgba(168,85,247,0.15)' : 'var(--surface-2)',
                  color: bulkStep === i ? '#a855f7' : 'var(--text-muted)',
                  border: bulkStep === i ? '1px solid rgba(168,85,247,0.3)' : '1px solid transparent',
                  transition: 'all 0.2s',
                }}>
                  {i + 1}. {label}
                </Box>
              ))}
            </Box>

            <Divider />

            {/* Step Content */}
            <Box sx={{ p: 2.5, overflowY: 'auto', maxHeight: '50vh' }}>
              {/* Step 0: Select Sizes & Quantities */}
              {bulkStep === 0 && (
                <Box>
                  <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--foreground)', mb: 1.5 }}>
                    {t.bulkOrder.sizeQuantity}
                  </Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 1 }}>
                    {SIZE_ORDER.filter(s => {
                      const sp = selectedProduct.sizePricing;
                      return !sp || sp[s] !== undefined;
                    }).map(size => {
                      const qty = bulkSizes[size] || 0;
                      const price = selectedProduct.sizePricing?.[size] ?? selectedProduct.basePrice;
                      return (
                        <Box key={size} sx={{
                          p: 1.2, borderRadius: '14px', border: qty > 0 ? '2px solid #a855f7' : '1px solid var(--glass-border)',
                          bgcolor: qty > 0 ? 'rgba(168,85,247,0.06)' : 'var(--surface-2)', transition: 'all 0.2s',
                        }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                            <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--foreground)' }}>{size}</Typography>
                            <Typography sx={{ fontSize: '0.7rem', color: '#34c759', fontWeight: 600 }}>฿{price.toLocaleString()}</Typography>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <IconButton
                              size="small"
                              onClick={() => setBulkSizes(prev => {
                                const n = { ...prev };
                                if (n[size] && n[size] > 0) { n[size]--; if (n[size] === 0) delete n[size]; }
                                return n;
                              })}
                              disabled={!qty}
                              sx={{ width: 28, height: 28, bgcolor: 'var(--surface)', border: '1px solid var(--glass-border)' }}
                            >
                              <Minus size={14} />
                            </IconButton>
                            <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--foreground)', minWidth: 24, textAlign: 'center' }}>
                              {qty}
                            </Typography>
                            <IconButton
                              size="small"
                              onClick={() => setBulkSizes(prev => ({ ...prev, [size]: (prev[size] || 0) + 1 }))}
                              sx={{ width: 28, height: 28, bgcolor: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.3)', color: '#a855f7' }}
                            >
                              <Plus size={14} />
                            </IconButton>
                          </Box>
                        </Box>
                      );
                    })}
                  </Box>

                  {/* Long Sleeve Option */}
                  {selectedProduct.options?.hasLongSleeve && (
                    <FormControlLabel
                      control={<Switch checked={bulkLongSleeve} onChange={(e) => setBulkLongSleeve(e.target.checked)} size="small" />}
                      label={<Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>{t.bulkOrder.longSleeve} (+฿{selectedProduct.options?.longSleevePrice ?? 50})</Typography>}
                      sx={{ mt: 1.5 }}
                    />
                  )}

                  {/* Summary */}
                  {bulkTotalQty > 0 && (
                    <Box sx={{ mt: 2, p: 1.5, borderRadius: '12px', bgcolor: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)' }}>
                      <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: '#a855f7' }}>
                        {t.bulkOrder.totalItems}: {bulkTotalQty} {t.bulkOrder.pieces}
                      </Typography>
                    </Box>
                  )}
                </Box>
              )}

              {/* Step 1: Enter Names */}
              {bulkStep === 1 && (
                <Box>
                  <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--foreground)', mb: 0.5 }}>
                    {t.bulkOrder.nameList}
                  </Typography>
                  <Typography sx={{ fontSize: '0.72rem', color: 'var(--text-muted)', mb: 1.5 }}>
                    {t.bulkOrder.nameListHint} ({bulkTotalQty} {t.bulkOrder.pieces})
                  </Typography>
                  <TextField
                    multiline
                    rows={8}
                    value={bulkNames}
                    onChange={(e) => setBulkNames(e.target.value)}
                    placeholder={`Name 1\nName 2\nName 3\n...`}
                    fullWidth
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '14px',
                        bgcolor: 'var(--surface-2)',
                        fontSize: '0.85rem',
                      },
                    }}
                  />
                  <Box sx={{ mt: 1, display: 'flex', justifyContent: 'space-between' }}>
                    <Typography sx={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {t.bulkOrder.namesCount}: {bulkNames.split('\n').filter(n => n.trim()).length}
                    </Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {t.bulkOrder.sizesCount}: {bulkTotalQty}
                    </Typography>
                  </Box>
                  {bulkNames.split('\n').filter(n => n.trim()).length !== bulkTotalQty && bulkNames.trim() && (
                    <Box sx={{ mt: 1, p: 1, borderRadius: '10px', bgcolor: 'rgba(255,159,10,0.1)', border: '1px solid rgba(255,159,10,0.3)' }}>
                      <Typography sx={{ fontSize: '0.72rem', color: '#ff9f0a', fontWeight: 600 }}>
                        {t.bulkOrder.mismatchWarning}
                      </Typography>
                    </Box>
                  )}
                </Box>
              )}

              {/* Step 2: Preview & Assign */}
              {bulkStep === 2 && (
                <Box>
                  <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--foreground)', mb: 1.5 }}>
                    {t.bulkOrder.preview}
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
                    {bulkAssignments.map((a, i) => {
                      const price = selectedProduct.sizePricing?.[a.size] ?? selectedProduct.basePrice;
                      const longFee = selectedProduct.options?.hasLongSleeve && bulkLongSleeve ? (selectedProduct.options?.longSleevePrice ?? 50) : 0;
                      return (
                        <Box key={i} sx={{
                          display: 'flex', alignItems: 'center', gap: 1, p: 1, borderRadius: '10px',
                          bgcolor: 'var(--surface-2)', border: '1px solid var(--glass-border)',
                        }}>
                          <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', width: 24, textAlign: 'center' }}>
                            {i + 1}
                          </Typography>
                          <Typography sx={{ flex: 1, fontSize: '0.82rem', fontWeight: 600, color: 'var(--foreground)' }}>
                            {a.name}
                          </Typography>
                          {/* Size dropdown */}
                          <select
                            value={a.size}
                            onChange={(e) => {
                              const newAssignments = [...bulkAssignments];
                              newAssignments[i] = { ...newAssignments[i], size: e.target.value };
                              setBulkAssignments(newAssignments);
                            }}
                            style={{
                              padding: '4px 8px', borderRadius: '8px', border: '1px solid var(--glass-border)',
                              background: 'var(--surface)', color: 'var(--foreground)', fontSize: '0.75rem', fontWeight: 700,
                              outline: 'none',
                            }}
                          >
                            {SIZE_ORDER.filter(s => !selectedProduct.sizePricing || selectedProduct.sizePricing[s] !== undefined).map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                          <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#34c759', minWidth: 55, textAlign: 'right' }}>
                            ฿{(price + longFee).toLocaleString()}
                          </Typography>
                        </Box>
                      );
                    })}
                  </Box>

                  {/* Total */}
                  <Box sx={{ mt: 2, p: 1.5, borderRadius: '12px', bgcolor: 'rgba(52,199,89,0.08)', border: '1px solid rgba(52,199,89,0.2)' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--foreground)' }}>
                        {t.bulkOrder.totalPrice}
                      </Typography>
                      <Typography sx={{ fontSize: '1rem', fontWeight: 800, color: '#34c759' }}>
                        ฿{bulkAssignments.reduce((s, a) => {
                          const price = selectedProduct.sizePricing?.[a.size] ?? selectedProduct.basePrice;
                          const longFee = selectedProduct.options?.hasLongSleeve && bulkLongSleeve ? (selectedProduct.options?.longSleevePrice ?? 50) : 0;
                          return s + price + longFee;
                        }, 0).toLocaleString()}
                      </Typography>
                    </Box>
                    <Typography sx={{ fontSize: '0.72rem', color: 'var(--text-muted)', mt: 0.3 }}>
                      {bulkAssignments.length} {t.bulkOrder.pieces}
                    </Typography>
                  </Box>
                </Box>
              )}
            </Box>

            <Divider />

            {/* Footer Actions */}
            <Box sx={{ p: 2, display: 'flex', gap: 1 }}>
              {bulkStep > 0 && (
                <Button
                  onClick={() => setBulkStep(s => s - 1)}
                  sx={{
                    flex: 1, py: 1.2, borderRadius: '14px', border: '1px solid var(--glass-border)',
                    color: 'var(--foreground)', fontWeight: 600, textTransform: 'none', fontSize: '0.85rem',
                  }}
                >
                  {t.bulkOrder.back}
                </Button>
              )}
              {bulkStep < 2 ? (
                <Button
                  onClick={() => {
                    if (bulkStep === 0) {
                      if (bulkTotalQty === 0) { showToast('warning', t.bulkOrder.noSizesSelected); return; }
                      setBulkStep(1);
                    } else if (bulkStep === 1) {
                      if (!bulkNames.trim()) { showToast('warning', t.bulkOrder.noNamesEntered); return; }
                      bulkBuildAssignments();
                      setBulkStep(2);
                    }
                  }}
                  sx={{
                    flex: 2, py: 1.2, borderRadius: '14px',
                    background: 'linear-gradient(135deg, #a855f7 0%, #8b5cf6 100%)',
                    color: 'white', fontWeight: 700, textTransform: 'none', fontSize: '0.85rem',
                    boxShadow: '0 4px 16px rgba(168,85,247,0.3)',
                    '&:hover': { boxShadow: '0 6px 24px rgba(168,85,247,0.4)' },
                  }}
                >
                  {t.bulkOrder.next}
                </Button>
              ) : (
                <>
                  <Button
                    onClick={() => bulkCommitToCart(false)}
                    startIcon={<ShoppingCart size={18} />}
                    sx={{
                      flex: 1, py: 1.2, borderRadius: '14px',
                      background: 'rgba(0,113,227,0.12)', border: '1px solid rgba(0,113,227,0.3)',
                      color: '#2997ff', fontWeight: 700, textTransform: 'none', fontSize: '0.82rem',
                    }}
                  >
                    {t.bulkOrder.addToCart}
                  </Button>
                  <Button
                    onClick={() => bulkCommitToCart(true)}
                    startIcon={<Zap size={18} />}
                    sx={{
                      flex: 1.5, py: 1.2, borderRadius: '14px',
                      background: 'linear-gradient(135deg, #34c759 0%, #34c759 100%)',
                      color: 'white', fontWeight: 800, textTransform: 'none', fontSize: '0.82rem',
                      boxShadow: '0 4px 16px rgba(52,199,89,0.3)',
                    }}
                  >
                    {t.bulkOrder.buyNow}
                  </Button>
                </>
              )}
            </Box>
          </>
        )}
      </Dialog>

      <Box
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.96)' : 'rgba(255,255,255,0.94)',
          borderTop: (theme) => `1px solid ${theme.palette.divider}`,
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          boxShadow: (theme) => theme.palette.mode === 'dark' ? '0 -4px 24px rgba(0,0,0,0.5)' : '0 -2px 16px rgba(0,0,0,0.08)',
          display: { xs: 'flex', md: 'none' },
          justifyContent: 'space-around',
          alignItems: 'flex-end',
          py: 0.5,
          px: 0.5,
          touchAction: 'pan-y',
          WebkitOverflowScrolling: 'touch',
          paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
          zIndex: 1100,
          transform: hideNavBars ? 'translateY(120%)' : 'translateY(0)',
          opacity: hideNavBars ? 0 : 1,
          transition: 'transform 0.32s ease, opacity 0.28s ease',
        }}
      >
        {bottomTabs.map((tab) => {
          const isActive = tab.key === 'chat' ? chatbotOpen : activeTab === tab.key;

          // Center chat button - prominent raised design
          if (tab.center) {
            return (
              <Box
                key={tab.key}
                onClick={(e: React.MouseEvent<HTMLElement>) => setChatMenuAnchor(e.currentTarget)}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 0.2,
                  cursor: 'pointer',
                  mt: -2.5,
                  touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'transparent',
                  userSelect: 'none',
                }}
              >
                <Box
                  sx={{
                    width: 56,
                    height: 56,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #0071e3 0%, #bf5af2 100%)',
                    display: 'grid',
                    placeItems: 'center',
                    color: 'white',
                    boxShadow: '0 4px 16px rgba(0,113,227,0.4), 0 0 0 3px rgba(0,113,227,0.1)',
                    willChange: 'transform',
                    transition: 'transform 0.15s cubic-bezier(0.2, 0, 0, 1)',
                    '&:active': {
                      transform: 'scale(0.92)',
                    },
                  }}
                >
                  {tab.icon}
                </Box>
                <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--primary)', mt: 0.3 }}>
                  {tab.label}
                </Typography>
              </Box>
            );
          }

          // Regular nav tabs
          return (
            <IconButton
              key={tab.key}
              data-tab-key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 0.2,
                color: (theme) => isActive ? 'var(--primary)' : theme.palette.text.secondary,
                borderRadius: '14px',
                px: 1.8,
                py: 0.6,
                minWidth: 56,
                background: (theme) => isActive
                  ? (theme.palette.mode === 'dark' ? 'rgba(0,113,227,0.12)' : 'rgba(0,113,227,0.08)')
                  : 'transparent',
                border: 'none',
                boxShadow: 'none',
                transition: 'all 0.2s ease',
                '&:hover': {
                  background: (theme) => theme.palette.mode === 'dark' ? 'rgba(0,113,227,0.08)' : 'rgba(0,113,227,0.06)',
                },
                touchAction: 'manipulation',
              }}
            >
              <Box sx={{
                transition: 'transform 0.2s ease',
                transform: isActive ? 'scale(1.1)' : 'scale(1)',
              }}>
                {tab.icon}
              </Box>
              <Typography
                variant="caption"
                sx={{
                  fontSize: '0.62rem',
                  fontWeight: isActive ? 800 : 500,
                  color: (theme) => isActive ? 'var(--primary)' : theme.palette.text.secondary,
                  lineHeight: 1.2,
                }}
              >
                {tab.label}
              </Typography>
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
            bottom: { xs: 90, sm: 32 },
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 99999,
            display: 'flex',
            flexDirection: 'column-reverse',
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
                bg: 'linear-gradient(135deg, rgba(0,113,227, 0.98) 0%, rgba(0,113,227, 0.98) 100%)', 
                icon: <Info size={18} />,
                shadow: '0 8px 32px rgba(0,113,227, 0.35)',
              },
            };
            return (
              <Slide key={t.id} in direction="up" timeout={350}>
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
                    animation: 'toastEnterBottom 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
                    '@keyframes toastEnterBottom': {
                      '0%': { opacity: 0, transform: 'translateY(12px) scale(0.96)' },
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
                      color: 'var(--foreground)',
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
        sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 10, backdropFilter: 'blur(2px)', bgcolor: 'var(--glass-bg)' }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
          <CircularProgress color="inherit" size={36} />
          <Typography variant="body2" sx={{ color: 'var(--foreground)' }}>
            {savingProfile ? t.misc.processingData : t.misc.processingOrder}
          </Typography>
        </Box>
      </Backdrop>

      {/* Fullscreen QR Code Dialog */}
      <Dialog
        open={!!showQRFullscreen}
        onClose={() => setShowQRFullscreen(null)}
        fullScreen
        PaperProps={{
          sx: {
            bgcolor: 'var(--background)',
            backgroundImage: (theme) => theme.palette.mode === 'dark' ? 'radial-gradient(circle at 50% 50%, rgba(6, 182, 212, 0.1) 0%, transparent 50%)' : 'radial-gradient(circle at 50% 50%, rgba(0,113,227, 0.06) 0%, transparent 50%)',
          },
        }}
      >
        <Box sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          p: 3,
          position: 'relative',
        }}>
          {/* Close Button */}
          <IconButton
            onClick={() => setShowQRFullscreen(null)}
            sx={{
              position: 'absolute',
              top: 16,
              right: 16,
              bgcolor: 'var(--glass-bg)',
              color: 'var(--foreground)',
              '&:hover': { bgcolor: 'var(--glass-bg)' },
            }}
          >
            <X size={24} />
          </IconButton>

          {/* Header */}
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Box sx={{
              width: 64,
              height: 64,
              borderRadius: '20px',
              background: 'linear-gradient(135deg, #64d2ff 0%, #34c759 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: 2,
              boxShadow: '0 8px 32px rgba(6, 182, 212, 0.3)',
            }}>
              <Package size={32} color="white" />
            </Box>
            <Typography sx={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--foreground)', mb: 0.5 }}>
              {t.qrDialog.title}
            </Typography>
            <Typography sx={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              {t.qrDialog.instruction}
            </Typography>
          </Box>

          {/* QR Code */}
          <Box sx={{
            p: 4,
            borderRadius: '24px',
            bgcolor: 'white',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            mb: 3,
          }}>
            <QRCodeSVG
              value={`ORDER:${showQRFullscreen || ''}`}
              size={Math.min(280, typeof window !== 'undefined' ? window.innerWidth - 100 : 280)}
              level="H"
              includeMargin={false}
            />
          </Box>

          {/* Order Ref */}
          <Box sx={{
            px: 3,
            py: 1.5,
            borderRadius: '16px',
            bgcolor: 'var(--glass-bg)',
            border: '1px solid var(--glass-border)',
            mb: 4,
          }}>
            <Typography sx={{ 
              fontSize: '0.75rem', 
              color: 'var(--text-muted)', 
              textAlign: 'center',
              mb: 0.5,
            }}>
              {t.qrDialog.orderNumber}
            </Typography>
            <Typography sx={{ 
              fontSize: '1.3rem', 
              fontWeight: 800, 
              color: 'var(--secondary)',
              fontFamily: 'monospace',
              textAlign: 'center',
              letterSpacing: '0.05em',
            }}>
              {showQRFullscreen}
            </Typography>
          </Box>

          {/* Pickup Location - Per Product */}
          {(() => {
            // Find the order to get product IDs
            const targetOrder = orderHistory.find((o: any) => o.ref === showQRFullscreen);
            if (!targetOrder) return null;
            
            const orderItems = targetOrder.items || targetOrder.cart || [];
            const productIds = orderItems.map((item: any) => item.productId || item.id).filter(Boolean);
            const productsWithPickup = config?.products?.filter(
              (p) => p.pickup?.enabled && productIds.includes(p.id)
            ) || [];
            
            if (productsWithPickup.length === 0) return null;
            
            const uniqueLocations = [...new Set(productsWithPickup.map(p => p.pickup?.location).filter(Boolean))];
            const firstPickup = productsWithPickup[0]?.pickup;
            
            return (
              <Box sx={{ 
                maxWidth: 360,
                width: '100%',
                p: 2.5, 
                borderRadius: '16px', 
                bgcolor: 'rgba(16,185,129,0.1)',
                border: '1px solid rgba(16,185,129,0.3)',
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <MapPin size={18} style={{ color: 'var(--success)' }} />
                  <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--success)' }}>
                    {t.qrDialog.pickupLocation}
                  </Typography>
                </Box>
                {uniqueLocations.map((loc, idx) => (
                  <Typography key={idx} sx={{ fontSize: '1rem', color: 'var(--foreground)', fontWeight: 600, mb: 0.5 }}>
                    {loc}
                  </Typography>
                ))}
                {firstPickup && (firstPickup.startDate || firstPickup.endDate) && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
                    <Clock size={14} style={{ color: 'var(--text-muted)' }} />
                    <Typography sx={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {firstPickup.startDate && new Date(firstPickup.startDate).toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      {firstPickup.startDate && firstPickup.endDate && ' - '}
                      {firstPickup.endDate && new Date(firstPickup.endDate).toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </Typography>
                  </Box>
                )}
                {firstPickup?.notes && (
                  <Typography sx={{ fontSize: '0.8rem', color: 'var(--warning)', mt: 1 }}>
                     {firstPickup.notes}
                  </Typography>
                )}
              </Box>
            );
          })()}

          {/* Close Button at Bottom */}
          <Button
            onClick={() => setShowQRFullscreen(null)}
            sx={{
              mt: 4,
              px: 4,
              py: 1.5,
              borderRadius: '12px',
              bgcolor: 'var(--glass-bg)',
              color: 'var(--foreground)',
              fontSize: '1rem',
              fontWeight: 600,
              textTransform: 'none',
              '&:hover': { bgcolor: 'var(--glass-bg)' },
            }}
          >
            {t.common.close}
          </Button>
        </Box>
      </Dialog>

      {/* Logout Confirmation Dialog */}
      <Dialog
        open={logoutConfirmOpen}
        onClose={() => setLogoutConfirmOpen(false)}
        PaperProps={{
          sx: {
            borderRadius: '16px',
            bgcolor: 'var(--surface)',
            backdropFilter: 'blur(20px)',
            border: '1px solid var(--glass-border)',
            maxWidth: 360,
          },
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1, color: 'var(--foreground)' }}>
          <TriangleAlert size={22} color="#ff9f0a" />
          {t.nav.confirmLogout}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'var(--text-muted)' }}>
            {t.nav.logoutConfirmMessage}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button
            onClick={() => setLogoutConfirmOpen(false)}
            sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 600, color: 'var(--foreground)' }}
          >
            {t.common.cancel}
          </Button>
          <Button
            onClick={() => signOutUser()}
            variant="contained"
            color="error"
            sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 600 }}
          >
            {t.nav.logout}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Switch Account Dialog */}
      <Dialog
        open={switchAccountOpen}
        onClose={() => setSwitchAccountOpen(false)}
        fullWidth
        maxWidth="xs"
        PaperProps={{
          sx: {
            borderRadius: '20px',
            bgcolor: 'var(--surface)',
            backdropFilter: 'blur(20px)',
            border: '1px solid var(--glass-border)',
            overflow: 'hidden',
          },
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: '1px solid var(--glass-border)',
          color: 'var(--foreground)',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ArrowLeftRight size={20} />
            {t.nav.switchAccount}
          </Box>
          <IconButton onClick={() => setSwitchAccountOpen(false)} sx={{ color: 'var(--text-muted)' }}>
            <X size={20} />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Current Account */}
          {session && (
            <Box sx={{
              p: 2, borderRadius: '14px',
              bgcolor: 'rgba(0,113,227,0.08)',
              border: '1px solid rgba(0,113,227,0.2)',
              display: 'flex', alignItems: 'center', gap: 1.5,
            }}>
              <Avatar src={orderData.profileImage || session?.user?.image || ''} sx={{ width: 40, height: 40 }} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {session?.user?.name}
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {session?.user?.email}
                </Typography>
              </Box>
              <Chip label={t.common.current} size="small" sx={{ bgcolor: 'rgba(0,113,227,0.15)', color: '#0071e3', fontWeight: 600, fontSize: '0.7rem' }} />
            </Box>
          )}

          <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.85rem', mt: 1 }}>
            {t.nav.selectLoginMethod}
          </Typography>

          {/* Provider Buttons */}
          <Button
            fullWidth
            onClick={() => { setSwitchAccountOpen(false); signIn('google', { redirect: true, callbackUrl: '/', prompt: 'select_account' }); }}
            sx={{
              py: 1.3, borderRadius: '12px', fontWeight: 600, fontSize: '0.9rem', textTransform: 'none',
              background: '#ffffff', color: '#1d1d1f',
              border: '1px solid rgba(0,0,0,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5,
              '&:hover': { background: '#f5f5f7', boxShadow: '0 4px 14px rgba(0,0,0,0.1)' },
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Google
          </Button>

          {availableProviders.includes('azure-ad') && (
            <Button
              fullWidth
              onClick={() => { setSwitchAccountOpen(false); signIn('azure-ad', { redirect: true, callbackUrl: '/' }); }}
              sx={{
                py: 1.3, borderRadius: '12px', fontWeight: 600, fontSize: '0.9rem', textTransform: 'none',
                background: '#2f2f2f', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5,
                '&:hover': { background: '#404040', boxShadow: '0 4px 14px rgba(0,0,0,0.15)' },
              }}
            >
              <svg width="18" height="18" viewBox="0 0 23 23">
                <path fill="#f35325" d="M1 1h10v10H1z"/>
                <path fill="#81bc06" d="M12 1h10v10H12z"/>
                <path fill="#05a6f0" d="M1 12h10v10H1z"/>
                <path fill="#ffba08" d="M12 12h10v10H12z"/>
              </svg>
              Microsoft
            </Button>
          )}

          {availableProviders.includes('facebook') && (
            <Button
              fullWidth
              onClick={() => { setSwitchAccountOpen(false); signIn('facebook', { redirect: true, callbackUrl: '/' }); }}
              sx={{
                py: 1.3, borderRadius: '12px', fontWeight: 600, fontSize: '0.9rem', textTransform: 'none',
                background: '#1877F2', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5,
                '&:hover': { background: '#166FE5', boxShadow: '0 4px 14px rgba(24,119,242,0.3)' },
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              Facebook
            </Button>
          )}

          {availableProviders.includes('apple') && (
            <Button
              fullWidth
              onClick={() => { setSwitchAccountOpen(false); signIn('apple', { redirect: true, callbackUrl: '/' }); }}
              sx={{
                py: 1.3, borderRadius: '12px', fontWeight: 600, fontSize: '0.9rem', textTransform: 'none',
                background: '#000', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5,
                '&:hover': { background: '#1a1a1a', boxShadow: '0 4px 14px rgba(0,0,0,0.2)' },
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.52-3.23 0-1.44.62-2.2.44-3.06-.4C4.24 16.76 4.89 10.87 8.88 10.6c1.24.07 2.1.72 2.83.78.99-.2 1.94-.78 3-.84 1.28-.08 2.25.48 2.88 1.22-2.65 1.58-2.02 5.07.36 6.04-.47 1.2-.97 2.4-1.9 3.48zM12.07 10.5c-.16-2.3 1.74-4.2 3.93-4.5.32 2.5-2.25 4.64-3.93 4.5z"/>
              </svg>
              Apple
            </Button>
          )}

          {availableProviders.includes('line') && (
            <Button
              fullWidth
              onClick={() => { setSwitchAccountOpen(false); signIn('line', { redirect: true, callbackUrl: '/' }); }}
              sx={{
                py: 1.3, borderRadius: '12px', fontWeight: 600, fontSize: '0.9rem', textTransform: 'none',
                background: '#06C755', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5,
                '&:hover': { background: '#05B34C', boxShadow: '0 4px 14px rgba(6,199,85,0.3)' },
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .348-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .349-.281.63-.63.63h-2.386c-.348 0-.63-.281-.63-.63V8.108c0-.348.282-.63.63-.63h2.386c.349 0 .63.282.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .349-.282.63-.631.63-.345 0-.627-.281-.627-.63V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.348.279-.63.63-.63.346 0 .627.282.627.63v4.771zm-5.741 0c0 .349-.282.63-.631.63-.345 0-.627-.281-.627-.63V8.108c0-.348.282-.63.627-.63.349 0 .631.282.631.63v4.771zm-2.466.63H4.917c-.348 0-.63-.281-.63-.63V8.108c0-.348.282-.63.63-.63.349 0 .63.282.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .349-.281.63-.629.63M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
              </svg>
              LINE
            </Button>
          )}

          {/* Passkey Sign In */}
          <Box sx={{ mt: 1 }}>
            <PasskeyLoginButton variant="outlined" />
          </Box>
        </DialogContent>
      </Dialog>

      {/* Chat Selection Popover */}
      <Popover
        open={Boolean(chatMenuAnchor)}
        anchorEl={chatMenuAnchor}
        onClose={() => setChatMenuAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transitionDuration={{ enter: 150, exit: 100 }}
        disableScrollLock
        slotProps={{
          paper: {
            sx: {
              bgcolor: (theme: any) => theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.97)' : 'rgba(255,255,255,0.98)',
              color: (theme: any) => theme.palette.mode === 'dark' ? '#f5f5f7' : '#1d1d1f',
              borderRadius: 3,
              minWidth: 220,
              border: (theme: any) => `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
              boxShadow: (theme: any) => theme.palette.mode === 'dark'
                ? '0 8px 24px rgba(0,0,0,0.5)'
                : '0 8px 24px rgba(0,0,0,0.12)',
              mb: 1,
              overflow: 'hidden',
            },
          },
        }}
      >
        <Box
          onClick={() => {
            setChatMenuAnchor(null);
            setChatbotOpen(true);
          }}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            px: 2.5,
            py: 1.8,
            cursor: 'pointer',
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent',
            transition: 'background 0.1s',
            '&:active': { bgcolor: (theme: any) => theme.palette.mode === 'dark' ? 'rgba(34,197,94,0.15)' : 'rgba(34,197,94,0.1)' },
          }}
        >
          <Bot size={24} color="#30d158" />
          <Box>
            <Typography sx={{ fontSize: '0.9rem', fontWeight: 600 }}>{t.help.askChatbot}</Typography>
            <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{t.help.chatbotDesc}</Typography>
          </Box>
        </Box>
        <Divider sx={{ borderColor: (theme: any) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }} />
        <Box
          onClick={() => {
            setChatMenuAnchor(null);
            setSupportChatOpen(true);
          }}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            px: 2.5,
            py: 1.8,
            cursor: 'pointer',
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent',
            transition: 'background 0.1s',
            '&:active': { bgcolor: (theme: any) => theme.palette.mode === 'dark' ? 'rgba(0,113,227,0.15)' : 'rgba(0,113,227,0.1)' },
          }}
        >
          <Headphones size={24} color="#0071e3" />
          <Box>
            <Typography sx={{ fontSize: '0.9rem', fontWeight: 600 }}>{t.help.contactAdmin}</Typography>
            <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{t.help.contactAdminDesc}</Typography>
          </Box>
        </Box>
      </Popover>

      {/* Chatbot */}
      <ShirtChatBot open={chatbotOpen} setOpen={setChatbotOpen} />

      {/* Support Chat Widget - ปุ่มแชทสนับสนุน */}
      <SupportChatWidget
        onOpenChatbot={() => setChatbotOpen(true)}
        hideMobileFab
        externalOpen={supportChatOpen}
        onExternalOpenHandled={() => setSupportChatOpen(false)}
      />

      {/* Image Lightbox - Fullscreen Gallery (HomePage) */}
      <Dialog
        open={!!lightboxImage}
        onClose={() => { setLightboxImage(null); setLightboxImages([]); }}
        maxWidth={false}
        fullScreen
        PaperProps={{
          sx: {
            background: 'rgba(0,0,0,0.97)',
            boxShadow: 'none',
          }
        }}
        sx={{
          zIndex: 99999,
          '& .MuiDialog-container': {
            alignItems: 'center',
            justifyContent: 'center',
          },
        }}
      >
        <IconButton
          onClick={() => { setLightboxImage(null); setLightboxImages([]); }}
          sx={{
            position: 'absolute',
            top: { xs: 12, sm: 16 },
            right: { xs: 12, sm: 16 },
            color: 'white',
            bgcolor: 'rgba(255,255,255,0.12)',
            backdropFilter: 'blur(8px)',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' },
            zIndex: 10,
            width: 44,
            height: 44,
          }}
        >
          <X size={24} />
        </IconButton>
        {lightboxImages.length > 1 && (
          <>
            <IconButton
              onClick={() => setLightboxIndex((prev) => (prev - 1 + lightboxImages.length) % lightboxImages.length)}
              sx={{
                position: 'absolute', top: '50%', left: { xs: 8, sm: 24 },
                transform: 'translateY(-50%)',
                bgcolor: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)',
                color: 'white', zIndex: 10,
                width: { xs: 40, sm: 48 }, height: { xs: 40, sm: 48 },
                '&:hover': { bgcolor: 'rgba(255,255,255,0.2)', transform: 'translateY(-50%) scale(1.05)' },
                transition: 'all 0.2s ease',
              }}
            >
              <ChevronLeft size={24} />
            </IconButton>
            <IconButton
              onClick={() => setLightboxIndex((prev) => (prev + 1) % lightboxImages.length)}
              sx={{
                position: 'absolute', top: '50%', right: { xs: 8, sm: 24 },
                transform: 'translateY(-50%)',
                bgcolor: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)',
                color: 'white', zIndex: 10,
                width: { xs: 40, sm: 48 }, height: { xs: 40, sm: 48 },
                '&:hover': { bgcolor: 'rgba(255,255,255,0.2)', transform: 'translateY(-50%) scale(1.05)' },
                transition: 'all 0.2s ease',
              }}
            >
              <ChevronRight size={24} />
            </IconButton>
          </>
        )}
        {lightboxImage && (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', p: { xs: 2, sm: 4 } }}>
            <Box
              component="img"
              src={lightboxImages.length > 1 ? lightboxImages[lightboxIndex] : lightboxImage}
              alt="Full size"
              sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '8px', userSelect: 'none' }}
            />
          </Box>
        )}
        {lightboxImages.length > 1 && (
          <Box sx={{
            position: 'absolute', bottom: { xs: 16, sm: 24 }, left: '50%', transform: 'translateX(-50%)',
            display: 'flex', gap: 1, px: 2, py: 1, borderRadius: '16px',
            bgcolor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)',
            maxWidth: '90vw', overflowX: 'auto',
          }}>
            {lightboxImages.map((img, idx) => (
              <Box
                key={idx}
                onClick={() => setLightboxIndex(idx)}
                sx={{
                  width: 48, height: 48, borderRadius: '10px',
                  border: lightboxIndex === idx ? '2px solid white' : '2px solid transparent',
                  overflow: 'hidden', cursor: 'pointer',
                  opacity: lightboxIndex === idx ? 1 : 0.5,
                  transition: 'all 0.2s ease', flexShrink: 0,
                  '&:hover': { opacity: 1 },
                }}
              >
                <Box component="img" src={img} alt={`Thumbnail ${idx + 1}`} sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </Box>
            ))}
          </Box>
        )}
      </Dialog>

      {/* ===== Review Dialog ===== */}
      <Dialog
        open={reviewDialogOpen}
        onClose={() => setReviewDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '20px',
            bgcolor: 'var(--background)',
            backgroundImage: 'none',
            border: '1px solid var(--glass-border)',
            mx: 2,
          },
        }}
        sx={{ zIndex: 9000 }}
      >
        <Box sx={{ p: 3 }}>
          <Typography sx={{ fontSize: '1.1rem', fontWeight: 700, mb: 2, color: 'var(--foreground)' }}>
            {t.reviews.writeReview}
          </Typography>

          {/* Star Rating */}
          <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', mb: 1 }}>{t.reviews.rating}</Typography>
          <Box sx={{ display: 'flex', gap: 0.5, mb: 2 }}>
            {[1, 2, 3, 4, 5].map((s) => (
              <IconButton
                key={s}
                onClick={() => setReviewRating(s)}
                sx={{ 
                  p: 0.5,
                  color: s <= reviewRating ? '#ff9f0a' : 'var(--text-muted)',
                  transition: 'all 0.15s ease',
                  '&:hover': { transform: 'scale(1.2)' },
                }}
              >
                <Star size={28} fill={s <= reviewRating ? '#ff9f0a' : 'none'} />
              </IconButton>
            ))}
          </Box>

          {/* Comment */}
          <TextField
            multiline
            rows={3}
            fullWidth
            value={reviewComment}
            onChange={(e) => setReviewComment(e.target.value)}
            placeholder={t.reviews.commentPlaceholder}
            inputProps={{ maxLength: 500 }}
            sx={{
              mb: 2,
              '& .MuiOutlinedInput-root': {
                borderRadius: '14px',
                bgcolor: 'var(--surface-2)',
                color: 'var(--foreground)',
                fontSize: '0.9rem',
                '& fieldset': { borderColor: 'var(--glass-border)' },
                '&:hover fieldset': { borderColor: 'rgba(0,113,227,0.3)' },
                '&.Mui-focused fieldset': { borderColor: '#0071e3' },
              },
            }}
          />

          {/* Actions */}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              onClick={() => setReviewDialogOpen(false)}
              sx={{ flex: 1, borderRadius: '12px', color: 'var(--text-muted)', border: '1px solid var(--glass-border)' }}
            >
              {t.common.cancel}
            </Button>
            <Button
              onClick={async () => {
                if (reviewRating === 0) {
                  showToast('warning', t.reviews.rating);
                  return;
                }
                if (!session?.user?.email) {
                  showToast('warning', t.reviews.loginRequired);
                  return;
                }

                const reviewData = {
                  productId: selectedProduct?.id,
                  email: session.user.email,
                  userName: session.user.name || 'Anonymous',
                  userImage: session.user.image || '',
                  rating: reviewRating,
                  comment: reviewComment,
                };

                try {
                  const res = await apiFetch('/api/reviews', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(reviewData),
                  });
                  
                  if (res.ok) {
                    const data = await res.json();
                    if (data.success) {
                      // Fetch updated reviews
                      const freshRes = await apiFetch(`/api/reviews?productId=${encodeURIComponent(selectedProduct?.id || '')}`);
                      if (freshRes.ok) {
                        const freshData = await freshRes.json();
                        if (freshData.reviews) {
                          setProductReviews((prev) => ({
                            ...prev,
                            [selectedProduct?.id || '']: freshData.reviews,
                          }));
                        }
                      }
                      showToast('success', t.reviews.thankYou);
                    } else {
                      showToast('error', data.error || 'Failed to submit review');
                    }
                  } else {
                    showToast('error', 'Failed to submit review');
                  }
                } catch (err) {
                  console.error('Submit review error:', err);
                  showToast('error', 'Failed to submit review');
                }
                
                setReviewDialogOpen(false);
              }}
              disabled={reviewRating === 0}
              sx={{
                flex: 2,
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #0071e3 0%, #2997ff 100%)',
                color: 'white',
                fontWeight: 700,
                '&:disabled': { background: 'rgba(100,116,139,0.15)', color: 'var(--text-muted)' },
              }}
            >
              {t.reviews.submit}
            </Button>
          </Box>
        </Box>
      </Dialog>
    </Box>
  );
}
