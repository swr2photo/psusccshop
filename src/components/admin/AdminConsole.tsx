/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { apiFetch, uploadImageApi } from '@/lib/api-client';
import { formatFriendlyError } from '@/utils/error';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { JSX } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { useNotification } from '@/components/NotificationContext';
import { signOutUser } from '@/lib/sign-out-client';
import dynamic from 'next/dynamic';
const PasskeyLoginButton = dynamic(() => import('@/components/PasskeyLoginButton'), { ssr: false });
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import {
  adminPath,
  adminSectionFromTab,
  adminTabFromSection,
  isAdminSection,
} from '@/lib/admin-tabs';
import { useConfirmDialog, useAlertDialog } from '@/hooks/useConfirmDialog';
import { useRealtimeAdminOrders } from '@/hooks/useRealtimeOrders';
import { supabase } from '@/lib/supabase-client';
import { useAdminDataSWR } from '@/hooks/useAdminDataSWR';
import { SettingsView } from '@/components/admin/SettingsView';
import { DashboardView } from '@/components/admin/DashboardView';

import {
  Box,
  AppBar,
  Toolbar,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Button,
  Card,
  CardContent,
  CardHeader,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Badge,
  Avatar,
  Chip,
  FormControlLabel,
  FormControl,
  InputLabel,
  Checkbox,
  CircularProgress,
  Typography,
  Switch,
  InputAdornment,
  Stack,
  IconButton,
  useMediaQuery,
  Tooltip,
  Autocomplete,
} from '@/components/admin/mui-shims';

import {
  LayoutDashboard as Dashboard,
  ShoppingCart,
  Receipt,
  Settings,
  History,
  LogOut as Logout,
  Lock,
  RotateCcw as Refresh,
  Plus as Add,
  Trash2 as Delete,
  Pencil as Edit,
  X as Close,
  Search,
  Store,
  DollarSign as AttachMoney,
  CalendarRange as DateRange,
  Bell as Notifications,
  Zap as Bolt,
  CircleCheck as CheckCircle,
  Truck as LocalShipping,
  Save,
  Pencil as EditIconMUI,
  Check,
  AlignJustify as FormatLineSpacing,
  XCircle as Clear,
  Hand as WavingHand,
  Package as Inventory,
  User as Person,
  Mail as Email,
  Calendar as CalendarToday,
  Image as ImageIcon,
  Eye as Visibility,
  EyeOff as VisibilityOff,
  CheckSquare as CheckBox,
  Square as CheckBoxOutlineBlank,
  RefreshCw as Update,
  PartyPopper as Celebration,
  Zap as ElectricBolt,
  Flame as Whatshot,
  Megaphone as Campaign,
  Clock as AccessTime,
  Circle as FiberManualRecord,
  AlertTriangle as Warning,
  FileText as Description,
  BookOpen as HistoryEdu,
  ShoppingBag,
  ChevronDown as ExpandMore,
  ChevronUp as ExpandLess,
  UserPlus as PersonAdd,
  ShieldCheck as AdminPanelSettings,
  Shield,
  Megaphone as Announcement,
  BellRing as NotificationsActive,
  ToggleRight as ToggleOn,
  ToggleLeft as ToggleOff,
  Copy as ContentCopy,
  Send,
  Users as Groups,
  Archive,
  QrCode as QrCodeScanner,
  ShoppingBag as LocalMall,
  Camera as CameraAlt,
  AlertCircle as ErrorOutline,
  CircleCheckBig as CheckCircleOutline,
  AlertTriangle as ReportProblem,
  Headphones as SupportAgent,
  HelpCircle as HelpOutline,
  Tag as LocalOffer,
  Sparkles,
  Calendar as CalendarIcon,
  PartyPopper,
  Ticket,
  Shirt,
  Gift,
  Tent,
  Wrench,
  Palette,
  Target,
  Building2,
  Banknote,
  ClipboardList,
  Ruler,
  Hash,
  FileText as FileTextIcon,
  ImageIcon as ImageLucide,
  StickyNote,
  Circle,
  CircleDot,
  RefreshCw,
  Crosshair,
  Timer,
  Radio,
  User as UserIcon,
  CalendarDays,
  TrendingUp,
  BarChart3,
  Flame as Fire,
  Loader2,
  MapPin,
} from 'lucide-react';

import { isAdmin, isSuperAdmin, setDynamicAdminEmails, SUPER_ADMIN_EMAIL, Product, ShopConfig, SIZES, AdminPermissions, DEFAULT_ADMIN_PERMISSIONS, DEFAULT_NAME_VALIDATION, type NameValidationConfig, DEFAULT_SHIRT_NAME, getProductShirtNameConfig, validatePrice, DEFAULT_CONFIG } from '@/lib/config';
import ShirtNameConfigFields from '@/components/admin/ShirtNameConfigFields';
import {
  ADMIN_THEME,
  STATUS_THEME,
  adminGlassCardSx as glassCardSx,
  adminInputSx as inputSx,
  adminGradientButtonSx as gradientButtonSx,
  adminSecondaryButtonSx as secondaryButtonSx,
  adminTableSx as tableSx,
} from '@/lib/adminTheme';
import { deleteOrderAdmin, getProfile, saveShopConfig, syncOrdersSheet, updateOrderAdmin, updateOrderStatusAPI } from '@/lib/api-client';
import SupportChatPanel from '@/components/admin/SupportChatPanel';
import EmailManagement from '@/components/admin/EmailManagement';
import UserLogsView from '@/components/admin/UserLogsView';
import ShippingSettings from '@/components/admin/ShippingSettings';
import { SHIPPING_PROVIDERS, type ShippingProvider } from '@/lib/shipping';
import PaymentSettings from '@/components/admin/PaymentSettings';
import TrackingManagement from '@/components/admin/TrackingManagement';
import RefundManagement from '@/components/admin/RefundManagement';
import LiveStreamSettings from '@/components/admin/LiveStreamSettings';
import ShopManagement from '@/components/admin/ShopManagement';
import { PromoCodesView } from '@/components/admin/PromoCodesView';
import { EventsView } from '@/components/admin/EventsView';
import { AnnouncementsView } from '@/components/admin/AnnouncementsView';
import { ProductsView } from '@/components/admin/ProductsView';
import { mapShopPermissionsToAdminPanel } from '@/lib/admin-permissions';
import { useTranslation } from '@/hooks/useTranslation';
import { AdminShell, type AdminNavGroup } from '@/components/admin/AdminShell';
import { AdminLoadingShell } from '@/components/admin/AdminLoadingShell';
import {
  Select as UiSelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog as UiDialog,
  DialogContent as UiDialogContent,
  DialogHeader as UiDialogHeader,
  DialogTitle as UiDialogTitle,
  DialogFooter as UiDialogFooter,
} from '@/components/ui/dialog';
import { Button as UiButton } from '@/components/ui/button';
import { DateTimePicker } from '@/components/ui/date-picker';

// ============== TYPES ==============
interface AdminDataResponse {
  orders?: any[];
  logs?: any[][];
  config?: ShopConfig;
}

interface CartItemAdmin {
  id?: string;
  productId?: string;
  productName?: string;
  size?: string;
  quantity: number;
  unitPrice: number;
  options?: {
    customName?: string;
    customNumber?: string;
    isLongSleeve?: boolean;
    pattern?: string;
  };
}

interface AdminOrder {
  ref: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  instagram?: string;
  amount: number;
  status: string;
  date?: string;
  raw: any;
  slip?: {
    uploadedAt: string;
    base64?: string;
    imageUrl?: string;  // URL from SlipOK S3
    fileName?: string;
    mime?: string;
    slipData?: {
      transRef?: string;
      transDate?: string;
      transTime?: string;
      amount?: number;
      // ข้อมูลผู้โอน (sender) - คนที่โอนเงิน
      senderName?: string;        // ชื่อหลัก (ใช้ fullName ถ้ามี)
      senderFullName?: string;    // ชื่อเต็มภาษาไทย
      senderDisplayName?: string; // ชื่อย่อ (Mr. Justin M)
      senderBank?: string;
      senderAccount?: string;
      // ข้อมูลผู้รับ (receiver) - บัญชีร้านค้า
      receiverName?: string;
      receiverDisplayName?: string;
      receiverBank?: string;
      receiverAccount?: string;
    };
  };
  cart?: CartItemAdmin[];
  items?: CartItemAdmin[]; // Legacy field name for cart
  // Shipping info
  shippingOption?: string;
  shippingProvider?: string;
  trackingNumber?: string;
  // Pickup confirmation
  pickup?: {
    pickedUp?: boolean;
    pickedUpAt?: string;
    pickedUpBy?: string;
    condition?: string;
    notes?: string;
  };
  // Multi-shop
  shopId?: string;
  shopSlug?: string;
}

// Preset colors for color picker
const PRESET_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
  '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e', '#64748b', '#1e293b', '#000000',
];

// Announcement type definition
interface Announcement {
  id: string;
  enabled: boolean;
  message: string;
  color: string;
  imageUrl?: string;
  postedBy?: string;
  displayName?: string;
  postedAt: string;
  type?: 'text' | 'image' | 'both';
  showLogo?: boolean;
  priority?: number;
  /** ข้อความพิเศษ (ตัวหนา/ขีดเส้นใต้/สำคัญ) */
  isSpecial?: boolean;
  /** ไอคอน emoji สำหรับข้อความพิเศษ */
  specialIcon?: string;
  /** ลิงก์แนบ */
  link?: string;
  /** ข้อความปุ่มลิงก์ */
  linkText?: string;
  /** สินค้าที่เชื่อมโยง */
  linkedProductId?: string;
}

const ADMIN_CACHE_KEY = 'psusccshop-admin-cache';
let ADMIN_CACHE_DISABLED = false;

const normalizeStatusKey = (status?: string): string => (status || 'PENDING').toString().trim().toUpperCase();

const getOrderCartItems = (order: AdminOrder | any): CartItemAdmin[] => {
  const cart = order?.cart || order?.items || order?.raw?.cart || [];
  return Array.isArray(cart) ? cart : [];
};

const orderContainsProduct = (order: AdminOrder | any, productId: string): boolean => {
  return getOrderCartItems(order).some((item) => {
    const pid = item.productId || (item as { product_id?: string }).product_id || item.id;
    return pid === productId;
  });
};

const normalizeOrder = (order: any): AdminOrder => {
  const ref = order?.ref || order?.Ref || order?.orderRef || (order?._key ? String(order._key).split('/').pop()?.replace('.json', '') : '') || '';
  // Calculate total from cart if amount is 0
  let amount = Number(order?.totalAmount ?? order?.FinalAmount ?? order?.amount ?? 0) || 0;
  const cart = order?.cart || [];
  if (amount === 0 && Array.isArray(cart) && cart.length > 0) {
    amount = cart.reduce((sum: number, item: any) => {
      const price = Number(item?.unitPrice ?? item?.price ?? 0);
      const qty = Number(item?.quantity ?? item?.qty ?? 1);
      return sum + (price * qty);
    }, 0);
  }
  
  // Calculate cart subtotal to detect shipping fee
  const cartSubtotal = Array.isArray(cart) ? cart.reduce((sum: number, item: any) => {
    const price = Number(item?.unitPrice ?? item?.price ?? 0);
    const qty = Number(item?.quantity ?? item?.qty ?? 1);
    return sum + (price * qty);
  }, 0) : 0;
  
  // Detect shipping option - if total > cart subtotal, likely has shipping
  let shippingOpt = order?.shippingOption || order?.shippingOptionId || order?.shipping_option || '';
  const shippingFeeDiff = amount - cartSubtotal;
  
  // If no shipping option but has fee difference, it's likely EMS/delivery
  if (!shippingOpt && shippingFeeDiff > 0) {
    shippingOpt = 'delivery_legacy'; // Mark as legacy delivery (with fee)
  }
  
  return {
    ref,
    name: order?.customerName || order?.Name || order?.name || '',
    email: order?.customerEmail || order?.Email || order?.email || '',
    phone: order?.customerPhone || order?.phone || '',
    address: order?.customerAddress || order?.address || '',
    instagram: order?.customerInstagram || order?.instagram || '',
    amount,
    status: normalizeStatusKey(order?.status || order?.Status),
    date: order?.date || order?.Timestamp || order?.timestamp || order?.createdAt || order?.created_at,
    raw: order || {},
    slip: order?.slip,
    cart,
    // Shipping info - support both shippingOption and shippingOptionId
    shippingOption: shippingOpt,
    shippingProvider: order?.shippingProvider || order?.shipping_provider || '',
    trackingNumber: order?.trackingNumber || order?.tracking_number || '',
    // Pickup confirmation
    pickup: order?.pickup || undefined,
    // Multi-shop
    shopId: order?.shopId || order?.shop_id || undefined,
    shopSlug: order?.shopSlug || order?.shop_slug || undefined,
  };
};

const loadAdminCache = (): { config: ShopConfig; orders: AdminOrder[]; logs: any[][] } | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(ADMIN_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error) {
    console.error('Failed to read admin cache', error);
    return null;
  }
};

const saveAdminCache = (payload: { config: ShopConfig; orders?: AdminOrder[]; logs?: any[][] }) => {
  if (typeof window === 'undefined' || ADMIN_CACHE_DISABLED) return;
  try {
    // Save more complete data for instant loading
    const cacheData = {
      config: {
        isOpen: payload.config?.isOpen ?? false,
        sheetId: payload.config?.sheetId || '',
        sheetUrl: payload.config?.sheetUrl || '',
        vendorSheetId: payload.config?.vendorSheetId || '',
        vendorSheetUrl: payload.config?.vendorSheetUrl || '',
        announcements: payload.config?.announcements || [],
        adminEmails: payload.config?.adminEmails || [],
        products: (payload.config?.products || []).slice(0, 20).map(p => ({
          id: p.id,
          name: p.name,
          category: p.category,
          subType: p.subType,
          basePrice: p.basePrice,
          isActive: p.isActive,
        })),
      },
      orders: (payload.orders || []).slice(0, 50).map(o => ({ 
        ref: o.ref, 
        status: o.status,
        name: o.name,
        email: o.email,
        amount: o.amount,
        date: o.date,
        cart: o.cart,
        // Include slip metadata (without base64) for hasSlip check
        slip: o.slip ? {
          hasData: Boolean(o.slip.base64 || o.slip.imageUrl),
          imageUrl: o.slip.imageUrl,
          uploadedAt: o.slip.uploadedAt,
        } : undefined,
      })),
      logs: (payload.logs || []).slice(0, 20),
      timestamp: Date.now(),
    };
    
    try {
      window.localStorage.setItem(ADMIN_CACHE_KEY, JSON.stringify(cacheData));
    } catch (err: unknown) {
      // If still fails, just disable cache
      console.warn('Admin cache disabled');
      ADMIN_CACHE_DISABLED = true;
      try { window.localStorage.removeItem(ADMIN_CACHE_KEY); } catch {}
    }
  } catch (error) {
    ADMIN_CACHE_DISABLED = true;
  }
};

const ORDER_STATUSES = ['WAITING_PAYMENT', 'PENDING', 'PAID', 'READY', 'SHIPPED', 'COMPLETED', 'CANCELLED', 'REFUND_REQUESTED', 'REFUNDED'];
const ORDER_STATUS_LABELS: Record<string, string> = {
  WAITING_PAYMENT: 'รอชำระเงิน',
  PENDING: 'รอตรวจสอบ',
  PAID: 'ชำระเงินแล้ว',
  READY: 'พร้อมจัดส่ง/รับ',
  SHIPPED: 'จัดส่งแล้ว',
  COMPLETED: 'สำเร็จแล้ว',
  CANCELLED: 'ยกเลิก',
  REFUND_REQUESTED: 'ขอคืนเงิน',
  REFUNDED: 'คืนเงินแล้ว',
};
const ORDERS_PAGE_SIZE = 30;
const PRODUCT_TYPES = ['JERSEY', 'CREW', 'OTHER'];

// New category system
const PRODUCT_CATEGORIES = ['APPAREL', 'MERCHANDISE', 'CAMP_FEE', 'EVENT', 'SERVICE', 'OTHER'] as const;
const PRODUCT_SUBTYPES: Record<string, string[]> = {
  APPAREL: ['JERSEY', 'CREW', 'HOODIE', 'TSHIRT', 'POLO', 'JACKET', 'CAP'],
  MERCHANDISE: ['STICKER', 'KEYCHAIN', 'MUG', 'BADGE', 'POSTER', 'NOTEBOOK'],
  CAMP_FEE: ['CAMP_REGISTRATION'],
  EVENT: ['EVENT_TICKET'],
  SERVICE: ['CUSTOM'],
  OTHER: ['OTHER'],
};

const CATEGORY_LABELS: Record<string, string> = {
  APPAREL: 'เสื้อผ้า',
  MERCHANDISE: 'ของที่ระลึก',
  CAMP_FEE: 'ค่าสมัครค่าย',
  EVENT: 'กิจกรรม/อีเวนต์',
  SERVICE: 'บริการ',
  OTHER: 'อื่นๆ',
};

const SUBTYPE_LABELS: Record<string, string> = {
  JERSEY: 'เสื้อกีฬา',
  CREW: 'เสื้อ Crew',
  HOODIE: 'ฮู้ดดี้',
  TSHIRT: 'เสื้อยืด',
  POLO: 'เสื้อโปโล',
  JACKET: 'แจ็กเก็ต',
  CAP: 'หมวก',
  STICKER: 'สติกเกอร์',
  KEYCHAIN: 'พวงกุญแจ',
  MUG: 'แก้ว',
  BADGE: 'เข็มกลัด/ตรา',
  POSTER: 'โปสเตอร์',
  NOTEBOOK: 'สมุด',
  CAMP_REGISTRATION: 'ค่าสมัครค่าย',
  EVENT_TICKET: 'ตั๋วเข้างาน',
  CUSTOM: 'กำหนดเอง',
  OTHER: 'อื่นๆ',
};

const CATEGORY_ICONS: Record<string, string> = {
  APPAREL: 'Shirt',
  MERCHANDISE: 'Gift',
  CAMP_FEE: 'Tent',
  EVENT: 'Ticket',
  SERVICE: 'Wrench',
  OTHER: 'Package',
};

const CATEGORY_ICON_COMPONENTS: Record<string, React.ReactNode> = {
  APPAREL: <Shirt size={16} />,
  MERCHANDISE: <Gift size={16} />,
  CAMP_FEE: <Tent size={16} />,
  EVENT: <Ticket size={16} />,
  SERVICE: <Wrench size={16} />,
  OTHER: <Inventory size={16} />,
};

// ============== DATETIME HELPERS ==============
/** Convert ISO string to local datetime-local value (YYYY-MM-DDTHH:MM) */
function isoToLocalDatetime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Convert local datetime-local value to ISO string (Safari-safe).
 *  datetime-local gives "YYYY-MM-DDTHH:MM" with no timezone.
 */
function localDatetimeToIso(localStr?: string): string {
  if (!localStr) return '';
  try {
    const d = new Date(localStr);
    if (isNaN(d.getTime())) return '';
    return d.toISOString();
  } catch {
    return '';
  }
}

function toDateTimeLocal(dateInput?: Date | string | null): string {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day}T${hh}:${mm}`;
}

function sanitizeInput(str?: string): string {
  if (!str) return '';
  return str.trim();
}

// ============== MAIN COMPONENT ==============
type AdminConsoleProps = {
  /** Path segment under /admin/... (e.g. support, orders). Defaults from pathname. */
  section?: string;
};

export default function AdminConsole({ section: sectionProp }: AdminConsoleProps = {}): JSX.Element {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t, lang } = useTranslation();
  const { success: toastSuccess, error: toastError, warning: toastWarning, info: toastInfo } = useNotification();

  const sectionFromPath = useMemo(() => {
    const parts = (pathname || '').split('/').filter(Boolean);
    // /admin/support → ['admin','support']
    if (parts[0] === 'admin' && parts[1] && isAdminSection(parts[1])) return parts[1];
    return null;
  }, [pathname]);

  const activeSection = (sectionProp && isAdminSection(sectionProp) ? sectionProp : null)
    || sectionFromPath
    || 'dashboard';

  const [activeTab, setActiveTabState] = useState<number>(() => adminTabFromSection(activeSection));

  // Keep tab in sync when the URL section changes (soft nav / back-forward)
  useEffect(() => {
    setActiveTabState(adminTabFromSection(activeSection));
  }, [activeSection]);

  // Legacy hash / ?tab= → real path (once on mount / when stale)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const hash = window.location.hash.replace(/^#/, '').split('?')[0];
    const tabQuery = searchParams?.get('tab') || '';
    const legacy = (hash && isAdminSection(hash) ? hash : null)
      || (tabQuery && isAdminSection(tabQuery) ? tabQuery : null);

    if (legacy && legacy !== activeSection) {
      const sp = new URLSearchParams(searchParams?.toString() || '');
      sp.delete('tab');
      const q = sp.toString();
      router.replace(adminPath(legacy, q ? `?${q}` : ''));
      return;
    }

    // Strip leftover hash once we are on a real section path
    if (window.location.hash && isAdminSection(activeSection)) {
      const sp = searchParams?.toString() || '';
      window.history.replaceState(null, '', adminPath(activeSection, sp ? `?${sp}` : ''));
    }

    // /admin with no section → /admin/dashboard
    if (pathname === '/admin' || pathname === '/admin/') {
      const sp = searchParams?.toString() || '';
      router.replace(adminPath('dashboard', sp ? `?${sp}` : ''));
    }
  }, [pathname, activeSection, router, searchParams]);

  const setActiveTab = useCallback((tab: number) => {
    setActiveTabState(tab);
    const next = adminSectionFromTab(tab);
    const sp = new URLSearchParams(searchParams?.toString() || '');
    sp.delete('tab');
    // Drop chatId when leaving support
    if (next !== 'support') sp.delete('chatId');
    const q = sp.toString();
    router.push(adminPath(next, q ? `?${q}` : ''));
  }, [router, searchParams]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [realtimeIsConnected, setRealtimeIsConnected] = useState(false);
  const isDesktop = useMediaQuery('(min-width: 900px)');

  // Available OAuth providers
  const [availableProviders, setAvailableProviders] = useState<string[]>(['google']);

  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [logs, setLogs] = useState<any[][]>([]);
  const [config, setConfig] = useState<ShopConfig>(DEFAULT_CONFIG);
  const [lastSavedTime, setLastSavedTime] = useState<Date | null>(null);
  const [sheetSyncing, setSheetSyncing] = useState(false);
  const [orderProcessingRef, setOrderProcessingRef] = useState<string | null>(null);
  // Server-validated admin role (set from API response, never from client env vars)
  const [serverUserRole, setServerUserRole] = useState<'superadmin' | 'admin' | 'shopAdmin' | null>(null);
  // Whether the server has responded with the role (prevents premature access-denied for shop admins)
  const [serverRoleChecked, setServerRoleChecked] = useState(false);
  // Shop-admin-specific permissions (from shop_admins table, merged across shops)
  const [shopAdminPermissions, setShopAdminPermissions] = useState<Record<string, boolean> | null>(null);
  // Settings state (moved from SettingsView to prevent re-render issues)
  const [settingsLocalConfig, setSettingsLocalConfig] = useState<ShopConfig>(DEFAULT_CONFIG);
  const [settingsHasChanges, setSettingsHasChanges] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [orderEditor, setOrderEditor] = useState<{
    open: boolean;
    ref: string;
    name: string;
    email: string;
    phone: string;
    address: string;
    instagram: string;
    amount: number;
    status: string;
    date: string;
    cart: CartItemAdmin[];
    profileLoading?: boolean;
  }>({
    open: false,
    ref: '',
    name: '',
    email: '',
    phone: '',
    address: '',
    instagram: '',
    amount: 0,
    status: 'PENDING',
    date: '',
    cart: [],
  });
  // Batch selection state
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [batchStatusDialogOpen, setBatchStatusDialogOpen] = useState(false);
  const [batchNewStatus, setBatchNewStatus] = useState('PAID');
  const [batchUpdating, setBatchUpdating] = useState(false);
  const { confirm: confirmDialog, ConfirmDialog } = useConfirmDialog();
  const { alert: alertDialog, AlertDialog } = useAlertDialog();
  // Orders filter state (moved from OrdersView to prevent re-render issues)
  const [orderFilterStatus, setOrderFilterStatus] = useState<string>('ALL');
  // 'ALL' = all products; null = product picker grid; product id = scoped list
  const [selectedProductIdForOrders, setSelectedProductIdForOrders] = useState<string | null>('ALL');
  const [ordersPage, setOrdersPage] = useState(1);

  // Slip viewer state
  const [slipViewerOpen, setSlipViewerOpen] = useState(false);
  const [slipViewerData, setSlipViewerData] = useState<{ ref: string; slip?: AdminOrder['slip'] } | null>(null);
  const hasInitialData = serverRoleChecked || orders.length > 0 || (config.products || []).length > 0 || logs.length > 0 || !!lastSavedTime;
  const fetchInFlightRef = useRef(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // ========== Multi-Shop Context ==========
  interface MyShopInfo {
    id: string;
    slug: string;
    name: string;
    role: 'owner' | 'admin';
    permissions: Record<string, boolean>;
  }
  const [myShops, setMyShops] = useState<MyShopInfo[]>([]);
  const [selectedShopId, setSelectedShopId] = useState<string | 'all' | ''>('');

  // Reset order filters when shop changes
  useEffect(() => {
    setSelectedProductIdForOrders('ALL');
    setSearchTerm('');
    setOrderFilterStatus('ALL');
    setOrdersPage(1);
    setSelectedOrders(new Set());
  }, [selectedShopId]);
  const myShopsLoadedRef = useRef(false);
  // Ref to hold the global config when switching to a specific shop
  const globalConfigRef = useRef<ShopConfig | null>(null);
  const [shopConfigLoading, setShopConfigLoading] = useState(false);
  // Whether we're currently viewing a specific shop's data (not 'all')
  const isShopMode = selectedShopId !== '' && selectedShopId !== 'all';
  const isShopModeRef = useRef(isShopMode);
  isShopModeRef.current = isShopMode;

  // Check authorization including dynamic admin list from config
  // Priority: server-validated role > dynamic admin list > static admin list
  const isAuthorized = useMemo(() => {
    // Trust server-validated role first (avoids client env var issues)
    if (serverUserRole) return true;
    
    const email = session?.user?.email;
    if (!email) return false;
    const normalized = email.trim().toLowerCase();
    // Check static admin list (works only if NEXT_PUBLIC_ env vars are set)
    if (isAdmin(normalized)) return true;
    // Check dynamic admin list from loaded config
    const dynamicAdmins = (config.adminEmails || []).map(e => e.trim().toLowerCase());
    return dynamicAdmins.includes(normalized);
  }, [session?.user?.email, config.adminEmails, serverUserRole]);

  // Calculate admin permissions
  const userEmail = session?.user?.email?.toLowerCase() ?? '';
  // Trust server-validated role OR fall back to client-side check
  const isSuperAdminUser = serverUserRole === 'superadmin' || isSuperAdmin(session?.user?.email ?? null);
  const selectedShopPerms = useMemo(() => {
    if (serverUserRole !== 'shopAdmin' || !selectedShopId || selectedShopId === 'all') return null;
    return myShops.find((s) => s.id === selectedShopId)?.permissions ?? null;
  }, [serverUserRole, selectedShopId, myShops]);

  const adminPerms = useMemo(() => {
    // If user has custom permissions in config, use those
    if (config.adminPermissions?.[userEmail]) {
      return { ...DEFAULT_ADMIN_PERMISSIONS, ...config.adminPermissions[userEmail] };
    }
    // Shop admin: permissions for the currently selected sub-shop only
    if (serverUserRole === 'shopAdmin') {
      if (selectedShopPerms) {
        return { ...DEFAULT_ADMIN_PERMISSIONS, ...mapShopPermissionsToAdminPanel(selectedShopPerms) } as AdminPermissions;
      }
      if (shopAdminPermissions) {
        return { ...DEFAULT_ADMIN_PERMISSIONS, ...mapShopPermissionsToAdminPanel(shopAdminPermissions) } as AdminPermissions;
      }
    }
    // Server-validated admins (from ADMIN_EMAILS env var) get all permissions
    // by default until the super admin explicitly customizes them
    if (serverUserRole) {
      const allPerms: AdminPermissions = {};
      for (const key of Object.keys(DEFAULT_ADMIN_PERMISSIONS) as (keyof AdminPermissions)[]) {
        allPerms[key] = true;
      }
      return allPerms;
    }
    return { ...DEFAULT_ADMIN_PERMISSIONS };
  }, [config.adminPermissions, userEmail, serverUserRole, shopAdminPermissions, selectedShopPerms]);

  // Permission flags - super admin has all permissions
  const canManageShop = isSuperAdminUser || adminPerms.canManageShop;
  const canManageSheet = isSuperAdminUser || adminPerms.canManageSheet;
  const canManageAnnouncement = isSuperAdminUser || adminPerms.canManageAnnouncement;
  const canManageOrders = isSuperAdminUser || adminPerms.canManageOrders;
  const canManageProducts = isSuperAdminUser || adminPerms.canManageProducts;
  const canManagePickup = isSuperAdminUser || adminPerms.canManagePickup;
  const canManageEvents = isSuperAdminUser || adminPerms.canManageEvents;
  const canManagePromoCodes = isSuperAdminUser || adminPerms.canManagePromoCodes;
  const canManageRefunds = isSuperAdminUser || adminPerms.canManageRefunds;
  const canManageTracking = isSuperAdminUser || adminPerms.canManageTracking;
  const canManageShipping = isSuperAdminUser || adminPerms.canManageShipping;
  const canManagePayment = isSuperAdminUser || adminPerms.canManagePayment;
  const canManageSupport = isSuperAdminUser || adminPerms.canManageSupport;
  const canManageLiveStream = isSuperAdminUser || adminPerms.canManageLiveStream;
  const canSendEmail = isSuperAdminUser || adminPerms.canSendEmail;
  
  const isSessionLoading = status === 'loading';
  const isDataLoading = loading && !hasInitialData;

  const showToast = useCallback((type: 'success' | 'error' | 'info' | 'warning', message: string) => {
    const handlers = {
      success: toastSuccess,
      error: toastError,
      warning: toastWarning,
      info: toastInfo,
    } as const;
    handlers[type](formatFriendlyError(message));
  }, [toastSuccess, toastError, toastWarning, toastInfo]);

  const addLog = useCallback((action: string, detail: string, overrides?: { config?: ShopConfig; orders?: AdminOrder[] }) => {
    const entry: any[] = [new Date().toISOString(), session?.user?.email || 'system', action, detail];
    setLogs((prev) => {
      const next = [entry, ...prev].slice(0, 200);
      saveAdminCache({
        config: overrides?.config ?? configRef.current,
        orders: overrides?.orders ?? ordersRef.current,
        logs: next,
      });
      return next;
    });
    // Durable legal audit (fire-and-forget) — replaces localStorage-only history
    void apiFetch('/api/admin/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        detail,
        entityType: 'system',
        entityId: action,
        metadata: { source: 'admin_ui' },
      }),
    }).catch(() => {});
  }, [session?.user?.email]);

  // 📥 Progressive admin data — merge each section as it arrives
  const handleAdminSectionReceived = useCallback((payload: {
    section: 'bootstrap' | 'config' | 'orders';
    orders?: any[];
    config?: any;
    logs?: any[];
    userRole?: string;
    userEmail?: string;
    shopAdminPermissions?: Record<string, boolean>;
  }) => {
    if (payload.section === 'bootstrap') {
      if (payload.userRole) {
        setServerUserRole(payload.userRole as 'superadmin' | 'admin' | 'shopAdmin');
        setServerRoleChecked(true);
      }
      if (payload.shopAdminPermissions) {
        setShopAdminPermissions(payload.shopAdminPermissions);
      }
      return;
    }

    if (payload.section === 'config' && payload.config) {
      const nextConfig = payload.config || DEFAULT_CONFIG;
      if (!isShopModeRef.current) {
        setConfig((prev) => {
          if (prev.isOpen === nextConfig.isOpen &&
              prev.sheetId === nextConfig.sheetId &&
              (prev.products?.length ?? 0) === (nextConfig.products?.length ?? 0) &&
              (prev.adminEmails?.length ?? 0) === (nextConfig.adminEmails?.length ?? 0)) {
            const prevJson = JSON.stringify(prev);
            const nextJson = JSON.stringify(nextConfig);
            if (prevJson === nextJson) return prev;
          }
          return nextConfig;
        });
      } else {
        globalConfigRef.current = nextConfig;
      }
      setDynamicAdminEmails(nextConfig.adminEmails || []);
      setLastSavedTime(new Date());
      saveAdminCache({
        config: nextConfig,
        orders: ordersRef.current,
        logs: logsRef.current,
      });
      return;
    }

    if (payload.section === 'orders') {
      const normalizedOrders = Array.isArray(payload.orders)
        ? payload.orders.map(normalizeOrder).filter((o) => o.ref)
        : [];
      let nextLogs = payload.logs || [];
      if ((!nextLogs || nextLogs.length === 0) && normalizedOrders.length > 0) {
        nextLogs = normalizedOrders.slice(0, 50).map((o) => [
          o.date || new Date().toISOString(),
          o.email || o.name || 'system',
          'ORDER',
          `${o.ref} : ${o.status}`,
        ]);
      }

      setOrders((prev) => {
        if (prev.length !== normalizedOrders.length) return normalizedOrders;
        const prevKey = prev.map((o) => `${o.ref}:${o.status}`).join(',');
        const nextKey = normalizedOrders.map((o) => `${o.ref}:${o.status}`).join(',');
        return prevKey === nextKey ? prev : normalizedOrders;
      });
      setLogs((prev) => {
        if (prev.length === nextLogs.length && prev.length > 0) {
          const prevTs = prev[0]?.[0];
          const nextTs = nextLogs[0]?.[0];
          if (prevTs === nextTs) return prev;
        }
        return nextLogs;
      });

      setLastSavedTime(new Date());
      saveAdminCache({
        config: configRef.current,
        orders: normalizedOrders,
        logs: nextLogs,
      });
    }
  }, []);

  // ========== Realtime Subscription for Shops ==========
  useEffect(() => {
    if (!serverRoleChecked || serverUserRole !== 'superadmin') return;

    const channelName = `admin-shops-sync-${Math.random().toString(36).substring(2, 9)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shops' },
        () => {
          console.log('[Admin Realtime] Shops table changed, refetching...');
          apiFetch('/api/shops').then(res => res.json()).then(data => {
            if (data.status === 'success') {
              const shops: MyShopInfo[] = (data.shops || []).map((s: any) => ({
                id: s.id,
                slug: s.slug,
                name: s.name,
                role: s.role || 'admin',
                permissions: s.permissions || {},
              }));
              setMyShops(shops);
            }
          }).catch(err => console.warn('[Admin Realtime] Failed to refetch shops', err));
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [serverRoleChecked, serverUserRole]);

  // ========== Fetch My Shops (after auth) ==========
  useEffect(() => {
    if (status !== 'authenticated' || myShopsLoadedRef.current) return;
    myShopsLoadedRef.current = true;
    (async () => {
      try {
        const res = await apiFetch('/api/shops');
        const data = await res.json();
        if (data.status === 'success') {
          const shops: MyShopInfo[] = (data.shops || []).map((s: any) => ({
            id: s.id,
            slug: s.slug,
            name: s.name,
            role: s.role || 'admin',
            permissions: s.permissions || {},
          }));
          setMyShops(shops);
          if (data.role === 'superadmin') {
            setSelectedShopId('all');
          } else if (data.role === 'shopAdmin') {
            if (shops.length > 0) {
              setSelectedShopId(shops[0].id);
            }
          } else if (shops.length > 0) {
            setSelectedShopId(shops[0].id);
          }
        } else if (data.status === 'error' && data.message?.includes('มอบหมาย')) {
          alertDialog({
            title: 'ไม่มีสิทธิ์เข้าถึง',
            message: data.message || 'บัญชีของคุณยังไม่ได้รับมอบหมายร้านค้าย่อย',
            variant: 'error',
            confirmText: 'กลับหน้าหลัก',
            onClose: () => router.push('/'),
          });
        }
      } catch {
        console.warn('[Admin] Failed to fetch shops');
      }
    })();
  }, [status]);

  // ========== Load Shop Config when selectedShopId changes ==========
  useEffect(() => {
    if (!selectedShopId) return;
    
    if (selectedShopId === 'all') {
      // Switch back to global config
      if (globalConfigRef.current) {
        setConfig(globalConfigRef.current);
        setSettingsLocalConfig(globalConfigRef.current);
        globalConfigRef.current = null;
      }
      return;
    }
    
    // Save global config before switching to shop mode
    if (!globalConfigRef.current) {
      globalConfigRef.current = config;
    }
    
    // Fetch shop-specific config
    let cancelled = false;
    setShopConfigLoading(true);
    (async () => {
      try {
        const res = await apiFetch(`/api/shops/${selectedShopId}/config`);
        const data = await res.json();
        if (!cancelled && data.status === 'success' && data.config) {
          const shopConfig: ShopConfig = {
            ...(globalConfigRef.current || config),
            // Override with shop-specific data
            isOpen: data.config.isOpen ?? true,
            closeDate: data.config.closeDate || '',
            openDate: data.config.openDate,
            closedMessage: data.config.closedMessage,
            paymentEnabled: data.config.paymentEnabled,
            paymentDisabledMessage: data.config.paymentDisabledMessage,
            products: data.config.products || [],
            bankAccount: data.config.bankAccount,
            announcements: data.config.announcements || [],
            announcementHistory: data.config.announcementHistory || [],
            announcement: data.config.announcement,
            events: data.config.events || [],
            promoCodes: data.config.promoCodes || [],
            liveStream: data.config.liveStream,
            pickup: data.config.pickup,
            nameValidation: data.config.nameValidation,
            shirtNameConfig: data.config.shirtNameConfig,
            socialMediaNews: data.config.socialMediaNews || [],
          };
          setConfig(shopConfig);
          setSettingsLocalConfig(shopConfig);
        }
      } catch (err) {
        console.warn('[Admin] Failed to fetch shop config:', err);
      } finally {
        if (!cancelled) setShopConfigLoading(false);
      }
    })();
    
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedShopId]);

  const shopContextReady = myShops.length === 0 || selectedShopId !== '';

  // 📥 SWR Hook for Admin Data (replaces manual fetchData)
  const { 
    isLoading: swrLoading, 
    isRefreshing: swrRefreshing,
    sectionsLoading,
    refresh: swrRefresh,
    refreshConfig: swrRefreshConfig,
    invalidate: swrInvalidate,
    applyRealtimeOrderChange,
  } = useAdminDataSWR({
    enabled: status === 'authenticated',
    shopId: isShopMode && selectedShopId !== 'all' ? selectedShopId : undefined,
    ordersReady: shopContextReady,
    onSectionReceived: handleAdminSectionReceived,
    onError: (error) => {
      // Mark role check complete so auth useEffect can proceed
      setServerRoleChecked(true);
      const status = (error as Error & { status?: number })?.status;
      const isNetworkError = error?.message?.includes('Failed to fetch') || 
                            error?.message?.includes('NETWORK_ERROR');
      if (status === 401) {
        // Workers 401 ≠ session expired; do not auto sign-out from admin data fetches.
        console.warn('[Admin SWR] Unauthorized:', status);
      } else if (isNetworkError) {
        console.warn('[Admin SWR] Network error - using cached data');
      } else {
        console.error('[Admin SWR] Error:', error);
      }
      // Load from local cache as fallback
      const cached = loadAdminCache();
      if (cached) {
        setConfig(cached.config);
        setOrders((cached.orders || []).map(normalizeOrder));
        setLogs(cached.logs || []);
      }
    },
    onLoadingChange: (loading) => {
      setLoading(loading);
    },
    realtimeConnected: realtimeIsConnected,
  });

  // 📥 Fetch Data wrapper (for compatibility with existing code)
  const fetchData = useCallback(async (_opts?: { silent?: boolean }) => {
    await swrRefresh();
  }, [swrRefresh]);

  // Batch update order statuses
  const handleBatchUpdateStatus = async () => {
    if (selectedOrders.size === 0) return;
    setBatchUpdating(true);
    try {
      const refs = Array.from(selectedOrders);
      const promises = refs.map(ref => 
        updateOrderStatusAPI(ref, batchNewStatus, session?.user?.email || '')
      );
      await Promise.all(promises);
      setOrders(prev => prev.map(o => 
        selectedOrders.has(o.ref) ? { ...o, status: batchNewStatus } : o
      ));
      setSelectedOrders(new Set());
      setBatchStatusDialogOpen(false);
      addLog('BATCH_UPDATE_STATUS', `Updated ${refs.length} orders to ${batchNewStatus}`);
      triggerSheetSync('sync', { silent: true });
    } catch (error: unknown) {
      console.error('Batch update error:', error);
    } finally {
      setBatchUpdating(false);
    }
  };

  // Toggle order selection
  const toggleOrderSelection = (ref: string) => {
    setSelectedOrders(prev => {
      const next = new Set(prev);
      if (next.has(ref)) {
        next.delete(ref);
      } else {
        next.add(ref);
      }
      return next;
    });
  };

  const hydrateAdminOrder = useCallback(async (ref: string): Promise<AdminOrder | null> => {
    try {
      const res = await apiFetch(`/api/admin/orders?ref=${encodeURIComponent(ref)}`);
      const data = await res.json();
      if (data.status === 'success' && data.data) {
        const full = normalizeOrder(data.data);
        setOrders((prev) => prev.map((o) => (o.ref === ref ? full : o)));
        return full;
      }
    } catch {
      console.warn('[Admin] Failed to load order detail', ref);
    }
    return null;
  }, []);

  // Toggle order expansion (lazy-load cart when list used index-only scan)
  const toggleOrderExpand = (ref: string) => {
    setExpandedOrders((prev) => {
      const next = new Set(prev);
      const expanding = !next.has(ref);
      if (expanding) {
        next.add(ref);
        const order = orders.find((o) => o.ref === ref);
        if ((order as AdminOrder & { _listOnly?: boolean })?._listOnly) {
          void hydrateAdminOrder(ref);
        }
      } else {
        next.delete(ref);
      }
      return next;
    });
  };

  // Select all filtered orders
  const selectAllOrders = (filteredRefs: string[]) => {
    setSelectedOrders(new Set(filteredRefs));
  };

  // Clear all selections
  const clearAllSelections = () => {
    setSelectedOrders(new Set());
  };

  // Open slip viewer
  const openSlipViewer = (order: AdminOrder) => {
    const slip = order.slip || order.raw?.slip;
    setSlipViewerData({ ref: order.ref, slip });
    setSlipViewerOpen(true);
  };

  // Upload images to Filebase before saving
  const uploadImagesToStorage = async (products: any[]): Promise<any[]> => {
    const isBase64 = (str: string) => str && str.startsWith('data:image');
    
    // Collect all base64 images
    const imagesToUpload: { productIndex: number; field: 'coverImage' | 'images' | 'patternImage'; imageIndex?: number; patternIndex?: number; base64: string }[] = [];
    
    products.forEach((product, productIndex) => {
      if (product.coverImage && isBase64(product.coverImage)) {
        imagesToUpload.push({ productIndex, field: 'coverImage', base64: product.coverImage });
      }
      if (Array.isArray(product.images)) {
        product.images.forEach((img: string, imageIndex: number) => {
          if (isBase64(img)) {
            imagesToUpload.push({ productIndex, field: 'images', imageIndex, base64: img });
          }
        });
      }
      if (Array.isArray(product.patterns)) {
        product.patterns.forEach((pattern: any, patternIndex: number) => {
          if (pattern?.image && isBase64(pattern.image)) {
            imagesToUpload.push({ productIndex, field: 'patternImage', patternIndex, base64: pattern.image });
          }
        });
      }
    });

    if (imagesToUpload.length === 0) return products;

    console.log(`📤 Uploading ${imagesToUpload.length} images to storage...`);

    // Upload in batches
    const BATCH_SIZE = 5;
    const updatedProducts = [...products];
    
    for (let i = 0; i < imagesToUpload.length; i += BATCH_SIZE) {
      const batch = imagesToUpload.slice(i, i + BATCH_SIZE);
      const uploadPromises = batch.map(async (item) => {
        try {
          const res = await uploadImageApi({
            base64: item.base64,
            filename: `product_${item.productIndex}_${Date.now()}.png`,
            mime: 'image/png',
          });
          if (!res.ok) {
            const errText = await res.text().catch(() => '');
            console.error(`Upload HTTP ${res.status}:`, errText.substring(0, 200));
            return { ...item, url: null, error: `อัปโหลดล้มเหลว (HTTP ${res.status})` };
          }
          let data;
          try {
            data = await res.json();
          } catch {
            return { ...item, url: null, error: 'เซิร์ฟเวอร์ตอบกลับผิดปกติ' };
          }
          if (data.status === 'success' && data.data?.url) {
            return { ...item, url: data.data.url };
          }
          return { ...item, url: null, error: data.message };
        } catch (err: unknown) {
          console.error('Upload error:', err);
          return { ...item, url: null, error: err?.message };
        }
      });

      const results = await Promise.all(uploadPromises);
      
      // Update products with uploaded URLs
      results.forEach((result) => {
        if (result.url) {
          if (result.field === 'coverImage') {
            updatedProducts[result.productIndex] = {
              ...updatedProducts[result.productIndex],
              coverImage: result.url,
            };
          } else if (result.field === 'images' && typeof result.imageIndex === 'number') {
            const images = [...(updatedProducts[result.productIndex].images || [])];
            images[result.imageIndex] = result.url;
            updatedProducts[result.productIndex] = {
              ...updatedProducts[result.productIndex],
              images,
            };
          } else if (result.field === 'patternImage' && typeof result.patternIndex === 'number') {
            const patterns = [...(updatedProducts[result.productIndex].patterns || [])];
            const target = patterns[result.patternIndex] || {};
            patterns[result.patternIndex] = { ...target, image: result.url };
            updatedProducts[result.productIndex] = {
              ...updatedProducts[result.productIndex],
              patterns,
            };
          }
        }
      });
    }

    console.log(`✅ Image upload complete`);
    return updatedProducts;
  };

  // 💾 Save Config
  const saveFullConfig = useCallback(async (newConfig: ShopConfig) => {
    // ⚠️ Safeguard: prevent saving empty config that would wipe products
    // This can happen if save is triggered before real config loads from server
    if ((!newConfig.products || newConfig.products.length === 0) && !serverUserRole) {
      console.warn('[Admin] Blocked save: config has no products and server role not confirmed yet');
      return;
    }
    
    // Capture previous config for rollback in case of error
    const previousConfig = config;
    
    // 1. Optimistic Update: Save to local state/cache immediately for instant UI feedback
    setConfig(newConfig);
    setLastSavedTime(new Date());
    saveAdminCache({ config: newConfig, orders, logs });
    
    setSaving(true);
    
    try {
      // Upload images first if any are base64
      const productsWithUrls = await uploadImagesToStorage(newConfig.products || []);
      let configWithUrls = { ...newConfig, products: productsWithUrls };
      
      // Add announcement to history if it has content and is enabled
      const currentAnnouncement = configWithUrls.announcement;
      const previousAnnouncement = previousConfig?.announcement;
      
      // Check if announcement content changed (message or image)
      const announcementChanged = currentAnnouncement?.enabled && 
        (currentAnnouncement.message || currentAnnouncement.imageUrl) &&
        (currentAnnouncement.message !== previousAnnouncement?.message ||
         currentAnnouncement.imageUrl !== previousAnnouncement?.imageUrl);
      
      if (announcementChanged && currentAnnouncement) {
        const announcementHistory = [...(configWithUrls.announcementHistory || [])];
        
        // Create history entry
        const historyEntry = {
          id: `ann_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          message: currentAnnouncement.message || '',
          color: currentAnnouncement.color || '#3b82f6',
          imageUrl: currentAnnouncement.imageUrl,
          postedBy: currentAnnouncement.postedBy,
          displayName: currentAnnouncement.displayName,
          postedAt: currentAnnouncement.postedAt || new Date().toISOString(),
          type: currentAnnouncement.type,
        };
        
        // Add to beginning of history (newest first)
        announcementHistory.unshift(historyEntry);
        
        // Keep only last 20 announcements
        if (announcementHistory.length > 20) {
          announcementHistory.splice(20);
        }
        
        configWithUrls = { ...configWithUrls, announcementHistory };
      }
      
      // Update local state/cache with final configuration containing uploaded image URLs
      setConfig(configWithUrls);
      saveAdminCache({ config: configWithUrls, orders, logs });

      // Save to server — shop-specific or global
      if (isShopMode && selectedShopId) {
        // Save to shop-specific config API
        const res = await apiFetch(`/api/shops/${selectedShopId}/config`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(configWithUrls),
        });
        const data = await res.json();
        if (data.status !== 'success') {
          throw new Error(data.message || 'บันทึกร้านค้าย่อยไม่สำเร็จ');
        }
        addLog('SAVE_SHOP_CONFIG', `บันทึกการตั้งค่าร้านค้า (${myShops.find(s => s.id === selectedShopId)?.name || selectedShopId})`, { config: configWithUrls });
      } else {
        // Save to global config
        const res = await saveShopConfig(configWithUrls, session?.user?.email || '');
        if (res.status !== 'success') {
          throw new Error((res as any).message || 'บันทึกไม่สำเร็จ');
        }
        addLog('SAVE_CONFIG', 'บันทึกการตั้งค่า', { config: configWithUrls });
      }
    } catch (error: unknown) {
      console.error('❌ Save error:', error);
      showToast('error', error?.message || 'บันทึกไม่สำเร็จ');
      // Rollback to previous config on error
      setConfig(previousConfig);
      saveAdminCache({ config: previousConfig, orders, logs });
    } finally {
      setSaving(false);
    }
  }, [orders, logs, showToast, session?.user?.email, addLog, config, isShopMode, selectedShopId, myShops]);

  // Update Order Status
  const updateOrderStatus = async (ref: string, newStatus: string) => {
    const normalizedStatus = normalizeStatusKey(newStatus);
    const prevStatus = orders.find((o) => o.ref === ref)?.status;

    setOrders((prev) => prev.map((o) => (o.ref === ref ? { ...o, status: normalizedStatus } : o)));

    try {
      const res = await updateOrderStatusAPI(ref, normalizedStatus, session?.user?.email || '');
      if (res.status !== 'success') {
        throw new Error(res.message || 'อัปเดตสถานะไม่สำเร็จ');
      }

      setOrders((prev) => {
        const next = prev.map((o) => (o.ref === ref ? { ...o, status: normalizedStatus } : o));
        saveAdminCache({ config, orders: next, logs });
        addLog('UPDATE_STATUS', `${ref} -> ${normalizedStatus}`, { orders: next });
        return next;
      });
      triggerSheetSync('sync', { silent: true });
    } catch (error: unknown) {
      setOrders((prev) => prev.map((o) => (o.ref === ref ? { ...o, status: prevStatus || o.status } : o)));
      console.error('❌ Update status error:', error);
      showToast('error', error?.message || 'อัปเดตสถานะไม่สำเร็จ');
    }
  };

  const triggerSheetSync = useCallback(async (mode: 'sync' | 'create' = 'sync', opts?: { silent?: boolean }) => {
    // Factory sheet no longer required; create if main sheet missing only
    const effectiveMode = (!config.sheetId) ? 'create' : mode;
    setSheetSyncing(true);
    try {
      const res = await syncOrdersSheet(
        effectiveMode,
        effectiveMode === 'create' ? undefined : config.sheetId,
        // vendor sheet optional now; pass only if present
        effectiveMode === 'create' ? undefined : (config.vendorSheetId || undefined)
      );
      if (res.status !== 'success') {
        throw new Error(res.message || 'sync failed');
      }

      const nextSheetId = (res.data as any)?.sheetId || config.sheetId || '';
      const nextSheetUrl = (res.data as any)?.sheetUrl || config.sheetUrl || (nextSheetId ? `https://docs.google.com/spreadsheets/d/${nextSheetId}` : '');
      const nextVendorSheetId = (res.data as any)?.vendorSheetId || config.vendorSheetId || '';
      const nextVendorSheetUrl = (res.data as any)?.vendorSheetUrl || config.vendorSheetUrl || (nextVendorSheetId ? `https://docs.google.com/spreadsheets/d/${nextVendorSheetId}` : '');

      if (
        nextSheetId !== config.sheetId ||
        nextSheetUrl !== config.sheetUrl ||
        nextVendorSheetId !== config.vendorSheetId ||
        nextVendorSheetUrl !== config.vendorSheetUrl
      ) {
        const nextConfig = { 
          ...config, 
          sheetId: nextSheetId, 
          sheetUrl: nextSheetUrl,
          vendorSheetId: nextVendorSheetId,
          vendorSheetUrl: nextVendorSheetUrl,
        };
        setConfig(nextConfig);
        saveAdminCache({ config: nextConfig, orders, logs });
        await saveFullConfig(nextConfig);
        addLog('SYNC_SHEET', effectiveMode === 'create' ? 'สร้าง Sheet ใหม่' : 'ซิงก์ Sheet', { config: nextConfig });
      } else {
        addLog('SYNC_SHEET', 'ซิงก์ Sheet', { config });
      }

      if (!opts?.silent) {
        showToast('success', res.message || (effectiveMode === 'create' ? 'สร้าง Sheet สำเร็จ' : 'ซิงก์ Sheet แล้ว'));
      }
    } catch (error: unknown) {
      if (!opts?.silent) {
        showToast('error', error?.message || 'ซิงก์ Sheet ไม่สำเร็จ');
      }
    } finally {
      setSheetSyncing(false);
    }
  }, [config, orders, logs, saveFullConfig, showToast]);

  const resetOrderEditor = () => setOrderEditor({
    open: false,
    ref: '',
    name: '',
    email: '',
    phone: '',
    address: '',
    instagram: '',
    amount: 0,
    status: 'PENDING',
    date: '',
    cart: [],
  });

  const applyProfileToOrderEditor = useCallback(async (email: string, mode: 'fillGaps' | 'overwrite' = 'fillGaps') => {
    if (!email?.trim()) {
      showToast('warning', 'ไม่มีอีเมลสำหรับดึงโปรไฟล์');
      return;
    }
    setOrderEditor((prev) => ({ ...prev, profileLoading: true }));
    try {
      const res = await getProfile(email.trim());
      const profile = (res as any)?.data?.profile || (res as any)?.profile || {};
      if ((res as any)?.status !== 'success' && !profile) {
        throw new Error((res as any)?.message || 'โหลดโปรไฟล์ไม่สำเร็จ');
      }
      setOrderEditor((prev) => {
        const pick = (orderVal: string, profileVal: unknown) => {
          const p = typeof profileVal === 'string' ? profileVal : '';
          if (mode === 'overwrite') return p || orderVal;
          return orderVal?.trim() ? orderVal : (p || '');
        };
        return {
          ...prev,
          profileLoading: false,
          name: pick(prev.name, profile.name),
          phone: pick(prev.phone, profile.phone),
          address: pick(prev.address, profile.address),
          instagram: pick(prev.instagram, profile.instagram),
        };
      });
      showToast(
        'success',
        mode === 'overwrite' ? 'ดึงโปรไฟล์ลูกค้ามาแล้ว' : 'เติมข้อมูลจากโปรไฟล์แล้ว',
      );
    } catch (err: unknown) {
      setOrderEditor((prev) => ({ ...prev, profileLoading: false }));
      showToast('error', err?.message || 'ดึงโปรไฟล์ไม่สำเร็จ');
    }
  }, [showToast]);

  // Calculate unit price for a cart item based on product pricing
  const calculateItemUnitPrice = (item: CartItemAdmin, product: Product | undefined): number => {
    if (!product) return item.unitPrice || 0;
    
    // Base price
    let price = product.basePrice || 0;
    
    // Add size pricing if available
    if (item.size && product.sizePricing?.[item.size]) {
      price = product.sizePricing[item.size];
    }
    
    // Add long sleeve surcharge (use product config or default 50)
    if (item.options?.isLongSleeve) {
      price += product.options?.longSleevePrice ?? 50;
    }
    
    return price;
  };

  // Update cart item with recalculated price
  const updateCartItem = (idx: number, updates: Partial<CartItemAdmin>) => {
    const newCart = [...orderEditor.cart];
    const updatedItem = { ...newCart[idx], ...updates };
    
    // Find the product to recalculate price
    const product = config.products?.find(p => p.id === updatedItem.productId);
    
    // Recalculate unless caller explicitly set unitPrice
    if (!Object.prototype.hasOwnProperty.call(updates, 'unitPrice')) {
      updatedItem.unitPrice = calculateItemUnitPrice(updatedItem, product);
    }
    
    newCart[idx] = updatedItem;
    setOrderEditor(prev => ({ ...prev, cart: newCart }));
  };

  const activeCatalogProducts = useMemo(
    () => (config.products || []).filter((p) => p.isActive !== false),
    [config.products],
  );

  const changeCartProduct = (idx: number, productId: string) => {
    const product = config.products?.find((p) => p.id === productId);
    if (!product) return;
    const prev = orderEditor.cart[idx];
    if (!prev) return;
    const patternStillValid = product.patterns?.some(
      (p) => p.name === prev.options?.pattern && p.isActive !== false,
    );
    const updated: CartItemAdmin = {
      ...prev,
      productId: product.id,
      productName: product.name,
      options: {
        ...prev.options,
        pattern: patternStillValid ? prev.options?.pattern : undefined,
      },
    };
    updated.unitPrice = calculateItemUnitPrice(updated, product);
    const newCart = [...orderEditor.cart];
    newCart[idx] = updated;
    setOrderEditor((s) => ({ ...s, cart: newCart }));
    showToast('success', `เปลี่ยนเป็น ${product.name} แล้ว`);
  };

  const addCartProduct = (productId: string) => {
    const product = config.products?.find((p) => p.id === productId);
    if (!product) return;
    const item: CartItemAdmin = {
      id: `item_${Date.now()}`,
      productId: product.id,
      productName: product.name,
      size: '',
      quantity: 1,
      unitPrice: 0,
      options: {},
    };
    item.unitPrice = calculateItemUnitPrice(item, product);
    setOrderEditor((s) => ({ ...s, cart: [...s.cart, item] }));
    showToast('success', `เพิ่ม ${product.name} แล้ว`);
  };

  const openOrderEditor = async (order: AdminOrder) => {
    let detail = order;
    // Always hydrate for full customer profile fields (phone/address/etc.)
    try {
      const full = await hydrateAdminOrder(order.ref);
      if (full) detail = full;
    } catch (err) {
      console.warn('[Admin] Failed to hydrate order for editor', err);
    }
    let formattedDate = '';
    if (detail.date) {
      try {
        const d = new Date(detail.date);
        if (!isNaN(d.getTime())) {
          formattedDate = d.toISOString().slice(0, 16);
        }
      } catch {}
    }

    const email = detail.email || '';
    setOrderEditor({
      open: true,
      ref: detail.ref,
      name: detail.name || '',
      email,
      phone: detail.phone || '',
      address: detail.address || '',
      instagram: detail.instagram || '',
      amount: detail.amount || 0,
      status: detail.status || 'PENDING',
      date: formattedDate,
      cart: detail.cart || detail.items || [],
      profileLoading: !!email,
    });

    if (!email) return;

    // Pull registered profile to fill any missing contact fields
    try {
      const res = await getProfile(email);
      const profile = (res as any)?.data?.profile || {};
      if ((res as any)?.status === 'success' && profile) {
        setOrderEditor((prev) => {
          if (prev.ref !== detail.ref) return prev;
          const fill = (orderVal: string, profileVal: unknown) =>
            orderVal?.trim() ? orderVal : (typeof profileVal === 'string' ? profileVal : '') || '';
          return {
            ...prev,
            profileLoading: false,
            name: fill(prev.name, profile.name),
            phone: fill(prev.phone, profile.phone),
            address: fill(prev.address, profile.address),
            instagram: fill(prev.instagram, profile.instagram),
          };
        });
        return;
      }
    } catch (err) {
      console.warn('[Admin] Failed to load customer profile', err);
    }
    setOrderEditor((prev) => (prev.ref === detail.ref ? { ...prev, profileLoading: false } : prev));
  };

  const saveOrderEdits = async () => {
    if (!orderEditor.ref) return;
    setOrderProcessingRef(orderEditor.ref);
    try {
      // Calculate total from cart if cart exists
      const cartTotal = orderEditor.cart.reduce((sum, item) => {
        const price = Number(item.unitPrice ?? 0);
        const qty = Number(item.quantity ?? 1);
        return sum + (price * qty);
      }, 0);

      let parsedIsoDate: string | undefined = undefined;
      if (orderEditor.date) {
        try {
          const d = new Date(orderEditor.date);
          if (!isNaN(d.getTime())) {
            parsedIsoDate = d.toISOString();
          }
        } catch {}
      }

      const payload: Record<string, any> = {
        name: sanitizeInput(orderEditor.name),
        email: sanitizeInput(orderEditor.email),
        phone: sanitizeInput(orderEditor.phone),
        address: sanitizeInput(orderEditor.address),
        amount: cartTotal > 0 ? cartTotal : (Number(orderEditor.amount) || 0),
        status: normalizeStatusKey(orderEditor.status),
        cart: orderEditor.cart,
      };

      if (parsedIsoDate) {
        payload.date = parsedIsoDate;
      }

      const res = await updateOrderAdmin(orderEditor.ref, payload, session?.user?.email || '');
      if (res.status !== 'success') throw new Error(res.message || 'แก้ไขออเดอร์ไม่สำเร็จ');

      const nextOrders = orders.map((o) => o.ref === orderEditor.ref
        ? {
            ...o,
            ...payload,
            amount: payload.amount,
            phone: payload.phone,
            address: payload.address,
            raw: { ...(o.raw || {}), ...payload },
          }
        : o);
      setOrders(nextOrders);
      saveAdminCache({ config, orders: nextOrders, logs });
      addLog('EDIT_ORDER', `${orderEditor.ref}`, { orders: nextOrders });
      resetOrderEditor();
      triggerSheetSync('sync', { silent: true });
    } catch (error: unknown) {
      showToast('error', error?.message || 'แก้ไขออเดอร์ไม่สำเร็จ');
    } finally {
      setOrderProcessingRef(null);
    }
  };

  const deleteOrder = async (order: AdminOrder, hard = false) => {
    const ok = await confirmDialog({
      title: hard ? 'ลบออเดอร์ถาวร?' : 'ยกเลิกออเดอร์?',
      message: hard ? 'ข้อมูลจะถูกลบออกจากระบบถาวร' : 'สถานะจะถูกเปลี่ยนเป็น CANCELLED',
      variant: 'warning',
      confirmText: hard ? 'ลบเลย' : 'ยืนยัน',
      cancelText: 'ปิด',
      destructive: hard,
      confirmColor: hard ? '#ef4444' : '#22c55e',
    });
    if (!ok) return;

    setOrderProcessingRef(order.ref);
    try {
      const res = await deleteOrderAdmin(order.ref, hard);
      if (res.status !== 'success') throw new Error(res.message || 'ลบออเดอร์ไม่สำเร็จ');

      const nextOrders = hard
        ? orders.filter((o) => o.ref !== order.ref)
        : orders.map((o) => (o.ref === order.ref ? { ...o, status: 'CANCELLED' } : o));
      setOrders(nextOrders);
      saveAdminCache({ config, orders: nextOrders, logs });
      addLog(hard ? 'DELETE_ORDER' : 'CANCEL_ORDER', `${order.ref}`, { orders: nextOrders });
      triggerSheetSync('sync', { silent: true });
    } catch (error: unknown) {
      showToast('error', error?.message || 'ลบออเดอร์ไม่สำเร็จ');
    } finally {
      setOrderProcessingRef(null);
    }
  };
  // Fetch available OAuth providers
  useEffect(() => {
    apiFetch('/api/auth/available-providers')
      .then(res => res.json())
      .then(data => { if (data.providers) setAvailableProviders(data.providers); })
      .catch(() => {});
  }, []);

  // 🔐 Authentication Check - Load cache immediately (SWR handles fresh fetch)
  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'authenticated') {
      // Load cache immediately for instant UI - SWR will fetch fresh data automatically
      const cached = loadAdminCache();
      if (cached) {
        setConfig(cached.config || DEFAULT_CONFIG);
        setOrders((cached.orders || []).map(normalizeOrder));
        setLogs(cached.logs || []);
        setLoading(false); // Show cached data immediately
        console.log('[Admin] Loaded from cache:', cached.orders?.length || 0, 'orders');
      }
      // Note: SWR hook above handles fetching fresh data automatically
    }
  }, [status]);

  // Check authorization after server role check completes
  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.email) return;
    if (!serverRoleChecked) return; // Wait for server to respond (prevents premature block for shop admins)
    
    // If server already validated our role, we're authorized
    if (serverUserRole) return;
    
    // Fallback: check with loaded config (including dynamic admins)
    const email = session.user.email.trim().toLowerCase();
    const staticAdmin = isAdmin(email);
    const dynamicAdmins = (config.adminEmails || []).map(e => e.trim().toLowerCase());
    const dynamicAdmin = dynamicAdmins.includes(email);
    
    if (!staticAdmin && !dynamicAdmin) {
      alertDialog({
        title: 'ไม่มีสิทธิ์เข้าถึง',
        message: 'บัญชีของคุณไม่มีสิทธิ์เข้าถึงหน้านี้',
        variant: 'error',
        confirmText: 'กลับหน้าหลัก',
        onClose: () => router.push('/'),
      });
    }
  }, [status, session, serverRoleChecked, config.adminEmails, router, serverUserRole]);

  // 🔁 Lightweight polling for fresher data
  // ⚠️ Pause polling when order editor is open to prevent flickering
  // ℹ️ Now uses Supabase Realtime as primary, polling as fallback
  
  // Stable refs for realtime handler to avoid stale closures
  const configRef = useRef(config);
  const logsRef = useRef(logs);
  const ordersRef = useRef(orders);
  useEffect(() => { configRef.current = config; }, [config]);
  useEffect(() => { logsRef.current = logs; }, [logs]);
  useEffect(() => { ordersRef.current = orders; }, [orders]);

  // Handle realtime order changes - immediate UI update + SWR cache sync
  const handleRealtimeOrderChange = useCallback((change: { type: string; order: any; oldOrder?: any }) => {
    console.log('[Admin Realtime] Order change:', change.type, change.order?.ref);
    
    // Also sync into SWR cache to prevent stale overwrites on next poll
    applyRealtimeOrderChange(change as any);
    
    if (change.type === 'UPDATE' && change.order) {
      setOrders((prev) => {
        const existingIndex = prev.findIndex((o) => o.ref === change.order.ref);
        if (existingIndex >= 0) {
          const updated = [...prev];
          const existing = updated[existingIndex];
          // Convert DB format to AdminOrder format - full update
          updated[existingIndex] = {
            ...existing,
            status: change.order.status ?? existing.status,
            amount: change.order.total_amount ?? change.order.amount ?? existing.amount,
            cart: change.order.cart || existing.cart,
            date: change.order.date || change.order.created_at || existing.date,
            name: change.order.customer_name ?? change.order.name ?? existing.name,
            email: change.order.customer_email ?? change.order.email ?? existing.email,
            slip: change.order.slip_data ?? change.order.slip ?? existing.slip,
            trackingNumber: change.order.tracking_number ?? change.order.trackingNumber ?? existing.trackingNumber,
            raw: { ...existing.raw, ...change.order },
          };
          saveAdminCache({ config: configRef.current, orders: updated, logs: logsRef.current });
          return updated;
        }
        return prev;
      });
    } else if (change.type === 'INSERT' && change.order) {
      const newOrder: AdminOrder = {
        ref: change.order.ref,
        date: change.order.date || change.order.created_at,
        status: change.order.status,
        amount: change.order.total_amount ?? change.order.amount ?? 0,
        name: change.order.customer_name ?? change.order.name ?? '',
        email: change.order.customer_email ?? change.order.email ?? '',
        cart: change.order.cart || [],
        slip: change.order.slip_data ?? change.order.slip,
        trackingNumber: change.order.tracking_number ?? change.order.trackingNumber ?? '',
        raw: change.order,
      };
      setOrders((prev) => {
        if (prev.some((o) => o.ref === newOrder.ref)) return prev;
        const updated = [newOrder, ...prev];
        saveAdminCache({ config: configRef.current, orders: updated, logs: logsRef.current });
        return updated;
      });
    } else if (change.type === 'DELETE' && change.oldOrder) {
      setOrders((prev) => {
        const updated = prev.filter((o) => o.ref !== change.oldOrder.ref);
        saveAdminCache({ config: configRef.current, orders: updated, logs: logsRef.current });
        return updated;
      });
    }
  }, [applyRealtimeOrderChange]); // stable — no config/logs closure

  // Handle realtime config changes from other admins.
  // The realtime payload is only a lightweight signal ({ updatedAt, isOpen });
  // refetch /api/admin/data to get the full (unsanitized) config.
  const handleRealtimeConfigChange = useCallback((signal?: { updatedAt?: string; isOpen?: boolean | null }) => {
    console.log('[Admin Realtime] Config changed — refetching config. Open status:', signal?.isOpen);
    swrRefreshConfig();
  }, [swrRefreshConfig]);

  // Use realtime subscriptions for admin (orders + config)
  const { isConnected: realtimeConnected } = useRealtimeAdminOrders(
    handleRealtimeOrderChange,
    undefined,
    handleRealtimeConfigChange,
  );

  // Sync realtimeConnected back to SWR hook (controls polling interval)
  useEffect(() => {
    setRealtimeIsConnected(realtimeConnected);
  }, [realtimeConnected]);

  // Sync settings local config with main config (only when no unsaved changes)
  useEffect(() => {
    if (!settingsHasChanges) {
      setSettingsLocalConfig(prev => {
        // Quick check before expensive stringify
        if (prev.isOpen === config.isOpen &&
            prev.sheetId === config.sheetId &&
            (prev.products?.length ?? 0) === (config.products?.length ?? 0)) {
          const prevJson = JSON.stringify(prev);
          const nextJson = JSON.stringify(config);
          if (prevJson === nextJson) return prev;
        }
        return config;
      });
    }
  }, [config, settingsHasChanges]);

  // ✅ No Permission View
  const NoPermissionView = ({ permission }: { permission: string }): JSX.Element => (
    <div className="flex min-h-[300px] flex-col items-center justify-center p-8 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-[20px] bg-red-500/10">
        <Lock size={40} color="#ef4444" />
      </div>
      <p className="mb-1 text-xl font-bold text-[var(--foreground)]">ไม่มีสิทธิ์เข้าถึง</p>
      <p className="mb-2 text-sm text-[var(--text-muted)]">คุณไม่มีสิทธิ์ในการ{permission}</p>
      <p className="text-xs text-[var(--text-muted)]">กรุณาติดต่อ Super Admin เพื่อขอสิทธิ์เพิ่มเติม</p>
    </div>
  );


  // ============== PICKUP VIEW ==============
  // States for pickup view
  const [pickupSearch, setPickupSearch] = useState('');
  const [pickupSearchResults, setPickupSearchResults] = useState<any[]>([]);
  const [pickupSearching, setPickupSearching] = useState(false);
  const [pickupSelectedOrder, setPickupSelectedOrder] = useState<any | null>(null);
  const [pickupProcessing, setPickupProcessing] = useState(false);
  const [pickupCondition, setPickupCondition] = useState<'complete' | 'partial' | 'damaged'>('complete');
  const [pickupNotes, setPickupNotes] = useState('');
  const [pickupFilter, setPickupFilter] = useState<'ready' | 'today' | 'all_completed'>('ready');
  const [pickupScanMode, setPickupScanMode] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [scannerReady, setScannerReady] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [isProcessingScan, setIsProcessingScan] = useState(false);
  const pickupSearchRef = useRef<HTMLInputElement>(null);
  const qrScannerRef = useRef<any>(null);
  const isProcessingScanRef = useRef(false);

  // Keep ref in sync with state
  useEffect(() => {
    isProcessingScanRef.current = isProcessingScan;
  }, [isProcessingScan]);

  // Initialize ZXing scanner when scan mode is opened
  useEffect(() => {
    if (!pickupScanMode) return;
    
    let mounted = true;
    let controls: any = null;
    
    const initScanner = async () => {
      // Wait for DOM to be ready
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const videoElement = document.getElementById('qr-video') as HTMLVideoElement;
      if (!videoElement) {
        console.log('Video element not found');
        if (!mounted) return;
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      try {
        // Dynamic import ZXing
        const { BrowserQRCodeReader } = await import('@zxing/browser');
        
        if (!mounted) return;
        
        const codeReader = new BrowserQRCodeReader();
        
        console.log('Starting ZXing QR scanner...');
        
        // Get the video element
        const video = document.getElementById('qr-video') as HTMLVideoElement;
        if (!video) {
          throw new Error('Video element not found');
        }
        
        // Use decodeFromConstraints for better control
        controls = await codeReader.decodeFromConstraints(
          {
            video: {
              facingMode: { ideal: 'environment' },
              width: { ideal: 1280, min: 640 },
              height: { ideal: 720, min: 480 }
            },
            audio: false
          },
          video,
          (result: any, error: any) => {
            if (!mounted) return;
            
            if (result) {
              const decodedText = result.getText();
              console.log('QR Code scanned:', decodedText);
              
              if (decodedText && decodedText.trim() && !isProcessingScanRef.current) {
                isProcessingScanRef.current = true;
                setIsProcessingScan(true);
                
                const text = decodedText.trim();
                console.log('Processing scan:', text);
                
                // Extract order ref from QR code
                // Handle formats: ORDER:REF, URL/REF, or just REF
                let orderRef = text;
                
                // Remove ORDER: prefix if present
                if (orderRef.toUpperCase().startsWith('ORDER:')) {
                  orderRef = orderRef.substring(6);
                }
                
                // Handle URL format
                if (orderRef.includes('/')) {
                  const parts = orderRef.split('/');
                  orderRef = parts[parts.length - 1];
                }
                
                // Remove query parameters
                if (orderRef.includes('?')) {
                  orderRef = orderRef.split('?')[0];
                }
                
                // Clean up whitespace
                orderRef = orderRef.trim();
                
                console.log('Extracted orderRef:', orderRef);
                
                // Search for the order
                apiFetch(`/api/pickup?search=${encodeURIComponent(orderRef)}`)
                  .then(res => res.json())
                  .then(data => {
                    if (data.status === 'success' && data.data && data.data.length > 0) {
                      const order = data.data[0];
                      setPickupSelectedOrder(order);
                      setPickupScanMode(false);
                      showToast('success', `พบออเดอร์: ${order.ref}`);
                    } else {
                      showToast('error', `ไม่พบออเดอร์: ${orderRef}`);
                    }
                  })
                  .catch(() => {
                    showToast('error', 'เกิดข้อผิดพลาดในการค้นหา');
                  })
                  .finally(() => {
                    isProcessingScanRef.current = false;
                    setIsProcessingScan(false);
                  });
              }
            }
          }
        );
        
        qrScannerRef.current = controls;
        
        if (mounted) {
          setScannerReady(true);
          setScannerError(null);
        }
      } catch (err: unknown) {
        console.error('Failed to start scanner:', err);
        if (!mounted) return;
        
        const errorMsg = err?.message || err?.name || String(err);
        console.log('Error details:', errorMsg, err?.name);
        
        if (err?.name === 'NotAllowedError' || errorMsg.includes('Permission') || errorMsg.includes('permission')) {
          setScannerError('กรุณาอนุญาตการเข้าถึงกล้องในการตั้งค่าเบราว์เซอร์');
        } else if (err?.name === 'NotFoundError' || errorMsg.includes('NotFound') || errorMsg.includes('not found')) {
          setScannerError('ไม่พบกล้องในอุปกรณ์นี้');
        } else if (err?.name === 'NotReadableError' || errorMsg.includes('NotReadable') || errorMsg.includes('Could not start')) {
          setScannerError('ไม่สามารถเข้าถึงกล้องได้ กรุณาปิดแอปอื่นที่ใช้กล้อง หรือรีเฟรชหน้าเว็บ');
        } else if (err?.name === 'OverconstrainedError') {
          setScannerError('กล้องไม่รองรับการตั้งค่าที่ต้องการ');
        } else {
          setScannerError(`ไม่สามารถเปิดกล้องได้: ${errorMsg}`);
        }
        setScannerReady(false);
      }
    };
    
    initScanner();
    
    // Cleanup on unmount or when scan mode closes
    return () => {
      mounted = false;
      console.log('Cleaning up scanner...');
      
      // Stop ZXing controls
      if (qrScannerRef.current) {
        try {
          if (typeof qrScannerRef.current.stop === 'function') {
            qrScannerRef.current.stop();
          }
        } catch (e) {
          console.log('Error stopping scanner:', e);
        }
        qrScannerRef.current = null;
      }
      
      // Also stop video element stream directly
      const videoEl = document.getElementById('qr-video') as HTMLVideoElement;
      if (videoEl) {
        if (videoEl.srcObject) {
          const stream = videoEl.srcObject as MediaStream;
          stream.getTracks().forEach(track => track.stop());
          videoEl.srcObject = null;
        }
        videoEl.pause();
      }
      
      setScannerReady(false);
    };
  }, [pickupScanMode, showToast]);

  // Search orders for pickup
  const searchPickupOrders = useCallback(async (term: string) => {
    if (!term.trim()) {
      setPickupSearchResults([]);
      return;
    }
    
    setPickupSearching(true);
    try {
      const shopParam = isShopMode && selectedShopId ? `&shopId=${encodeURIComponent(selectedShopId)}` : '';
      const res = await apiFetch(`/api/pickup?search=${encodeURIComponent(term.trim())}${shopParam}`);
      const data = await res.json();
      if (data.status === 'success') {
        setPickupSearchResults(data.data || []);
      } else {
        showToast('error', data.message || 'ค้นหาไม่สำเร็จ');
      }
    } catch (err) {
      showToast('error', 'เกิดข้อผิดพลาดในการค้นหา');
    } finally {
      setPickupSearching(false);
    }
  }, [showToast, isShopMode, selectedShopId]);

  // Handle pickup confirmation
  const handlePickupConfirm = useCallback(async () => {
    if (!pickupSelectedOrder) return;
    
    setPickupProcessing(true);
    try {
      const res = await apiFetch('/api/pickup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ref: pickupSelectedOrder.ref,
          action: 'pickup',
          condition: pickupCondition,
          notes: pickupNotes,
        }),
      });
      
      const data = await res.json();
      if (data.status === 'success') {
        showToast('success', `ยืนยันรับสินค้าสำเร็จ: ${pickupSelectedOrder.ref}`);
        // Update local order state immediately so pickup data shows
        const pickupData = {
          pickedUp: true,
          pickedUpAt: new Date().toISOString(),
          condition: pickupCondition,
          notes: pickupNotes,
        };
        setOrders(prev => prev.map(o => o.ref === pickupSelectedOrder.ref
          ? { ...o, status: 'COMPLETED', pickup: pickupData, raw: { ...o.raw, pickup: pickupData, status: 'COMPLETED' } }
          : o
        ));
        setPickupSelectedOrder(null);
        setPickupCondition('complete');
        setPickupNotes('');
        // Refresh search results
        if (pickupSearch) {
          searchPickupOrders(pickupSearch);
        }
      } else {
        showToast('error', data.message || 'ไม่สามารถยืนยันการรับสินค้า');
      }
    } catch (err) {
      showToast('error', 'เกิดข้อผิดพลาด');
    } finally {
      setPickupProcessing(false);
    }
  }, [pickupSelectedOrder, pickupCondition, pickupNotes, pickupSearch, searchPickupOrders, showToast, fetchData]);

  // Handle QR scan result - search and open confirmation popup immediately
  const handleQrScan = useCallback(async (scannedData: string) => {
    // Prevent multiple rapid scans
    if (isProcessingScan) return;
    
    // Expected format: ORDER:REF or just REF
    const ref = scannedData.replace('ORDER:', '').trim();
    if (!ref) return;
    
    console.log('QR Scanned:', ref); // Debug log
    
    setIsProcessingScan(true);
    setPickupScanMode(false);
    setPickupSearch(ref);
    
    // Search for the order and open confirmation popup
    try {
      const res = await apiFetch(`/api/pickup?search=${encodeURIComponent(ref)}`);
      const data = await res.json();
      if (data.status === 'success' && data.data?.length > 0) {
        // Find exact match
        const exactMatch = data.data.find((o: any) => o.ref === ref) || data.data[0];
        setPickupSearchResults(data.data);
        
        // Check if order is ready for pickup
        const canPickup = ['READY', 'SHIPPED', 'PAID'].includes(normalizeStatusKey(exactMatch.status)) && !exactMatch.pickup?.pickedUp;
        
        if (canPickup) {
          // Open confirmation popup directly
          setPickupSelectedOrder(exactMatch);
          showToast('success', `พบคำสั่งซื้อ: ${exactMatch.ref}`);
        } else if (exactMatch.pickup?.pickedUp) {
          showToast('warning', `คำสั่งซื้อ ${exactMatch.ref} รับสินค้าไปแล้ว`);
        } else {
          showToast('warning', `คำสั่งซื้อ ${exactMatch.ref} สถานะ: ${exactMatch.status} (ยังไม่พร้อมรับ)`);
        }
      } else {
        showToast('error', `ไม่พบคำสั่งซื้อ: ${ref}`);
      }
    } catch (err) {
      console.error('Pickup search error:', err);
      showToast('error', 'เกิดข้อผิดพลาดในการค้นหา');
    } finally {
      // Reset after a delay to allow for another scan
      setTimeout(() => setIsProcessingScan(false), 1500);
    }
  }, [showToast, isProcessingScan]);

  // Shop-scoped orders (used for dashboard stats, badge counts, pickup, etc.)
  const shopOrders = useMemo(() => {
    if (!selectedShopId || selectedShopId === 'all') return orders;
    const shop = myShops.find((s) => s.id === selectedShopId);
    return orders.filter((o) =>
      o.shopId === selectedShopId
      || (shop?.slug && (o.shopSlug === shop.slug || o.raw?.shopSlug === shop.slug)),
    );
  }, [orders, selectedShopId, myShops]);

  // Memoize pickup data outside PickupView to avoid conditional hook calls
  // Use shopOrders so pickup list is shop-scoped when a shop is selected
  const readyForPickup = useMemo(() => 
    shopOrders.filter(o => ['READY', 'SHIPPED', 'PAID'].includes(normalizeStatusKey(o.status))),
    [shopOrders]
  );
  
  const completedPickups = useMemo(() => 
    shopOrders.filter(o => {
      if (normalizeStatusKey(o.status) !== 'COMPLETED') return false;
      const pickup = o.pickup || o.raw?.pickup;
      return !!pickup?.pickedUp;
    }),
    [shopOrders]
  );

  const completedToday = useMemo(() => {
    const today = new Date().toDateString();
    return completedPickups.filter(o => {
      const pickup = o.pickup || o.raw?.pickup;
      if (!pickup?.pickedUpAt) return false;
      return new Date(pickup.pickedUpAt).toDateString() === today;
    });
  }, [completedPickups]);

  const PickupView = () => {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, height: '100%' }}>
        {/* Header */}
        <Box sx={{ 
          position: 'sticky',
          top: 0,
          zIndex: 10,
          bgcolor: ADMIN_THEME.bg,
          pb: 2,
          mx: { xs: -2, md: -3 },
          px: { xs: 2, md: 3 },
        }}>
          <Box sx={{ 
            display: 'flex', 
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between', 
            alignItems: { xs: 'stretch', sm: 'center' }, 
            gap: 1.5,
            mb: 2,
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <QrCodeScanner size={32} color="#06b6d4" />
              <Box>
                <Typography sx={{ fontSize: { xs: '1.1rem', md: '1.5rem' }, fontWeight: 800, color: 'var(--foreground)', lineHeight: 1.2 }}>
                  รับสินค้า
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  สแกน QR หรือค้นหาเพื่อยืนยันการรับ
                </Typography>
              </Box>
            </Box>
            
            {/* Filter Tabs */}
            <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap' }}>
              <Box
                onClick={() => setPickupFilter('ready')}
                sx={{
                  px: 1.5,
                  py: 0.8,
                  borderRadius: '12px',
                  bgcolor: pickupFilter === 'ready' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(16, 185, 129, 0.08)',
                  border: `1px solid ${pickupFilter === 'ready' ? 'rgba(16, 185, 129, 0.5)' : 'rgba(16, 185, 129, 0.2)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.8,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  '&:hover': { bgcolor: 'rgba(16, 185, 129, 0.2)' },
                }}
              >
                <LocalMall size={16} color="#10b981" />
                <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: '#10b981' }}>
                  รอรับ {readyForPickup.length}
                </Typography>
              </Box>
              <Box
                onClick={() => setPickupFilter('today')}
                sx={{
                  px: 1.5,
                  py: 0.8,
                  borderRadius: '12px',
                  bgcolor: pickupFilter === 'today' ? 'rgba(99, 102, 241, 0.25)' : 'rgba(99, 102, 241, 0.08)',
                  border: `1px solid ${pickupFilter === 'today' ? 'rgba(99, 102, 241, 0.5)' : 'rgba(99, 102, 241, 0.2)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.8,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  '&:hover': { bgcolor: 'rgba(99, 102, 241, 0.2)' },
                }}
              >
                <CheckCircleOutline size={16} color="#818cf8" />
                <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: '#818cf8' }}>
                  วันนี้ {completedToday.length}
                </Typography>
              </Box>
              <Box
                onClick={() => setPickupFilter('all_completed')}
                sx={{
                  px: 1.5,
                  py: 0.8,
                  borderRadius: '12px',
                  bgcolor: pickupFilter === 'all_completed' ? 'rgba(251, 191, 36, 0.25)' : 'rgba(251, 191, 36, 0.08)',
                  border: `1px solid ${pickupFilter === 'all_completed' ? 'rgba(251, 191, 36, 0.5)' : 'rgba(251, 191, 36, 0.2)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.8,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  '&:hover': { bgcolor: 'rgba(251, 191, 36, 0.2)' },
                }}
              >
                <Inventory size={16} color="#fbbf24" />
                <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: '#fbbf24' }}>
                  รับแล้ว {completedPickups.length}
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Search Bar */}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              onClick={() => setPickupScanMode(true)}
              sx={{
                minWidth: { xs: 48 },
                px: 1.5,
                py: 1,
                borderRadius: '12px',
                bgcolor: 'rgba(6, 182, 212, 0.15)',
                border: '1px solid rgba(6, 182, 212, 0.3)',
                color: '#06b6d4',
                '&:hover': {
                  bgcolor: 'rgba(6, 182, 212, 0.25)',
                },
              }}
            >
              <CameraAlt size={22} />
            </Button>
            <TextField
              inputRef={pickupSearchRef}
              placeholder="พิมพ์เลข Order / ชื่อ / อีเมล..."
              variant="outlined"
              fullWidth
              value={pickupSearch}
              onChange={(e) => setPickupSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  searchPickupOrders(pickupSearch);
                }
              }}
              size="small"
              autoComplete="off"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={20} color="#64748b" />
                  </InputAdornment>
                ),
                endAdornment: pickupSearching ? (
                  <InputAdornment position="end">
                    <CircularProgress size={18} sx={{ color: 'var(--text-muted)' }} />
                  </InputAdornment>
                ) : pickupSearch ? (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => { setPickupSearch(''); setPickupSearchResults([]); }}>
                      <Clear size={18} color="#64748b" />
                    </IconButton>
                  </InputAdornment>
                ) : null,
              }}
              sx={{
                ...inputSx,
                '& .MuiOutlinedInput-root': {
                  ...inputSx['& .MuiOutlinedInput-root'],
                  borderRadius: '12px',
                },
              }}
            />
            <Button
              onClick={() => searchPickupOrders(pickupSearch)}
              disabled={!pickupSearch.trim() || pickupSearching}
              sx={{
                ...gradientButtonSx,
                minWidth: { xs: 48, sm: 100 },
                px: { xs: 1, sm: 2 },
              }}
            >
              <Search size={20} />
              <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' }, ml: 0.5 }}>ค้นหา</Box>
            </Button>
          </Box>
        </Box>

        {/* Search Results */}
        {pickupSearchResults.length > 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              พบ {pickupSearchResults.length} รายการ
            </Typography>
            
            {pickupSearchResults.map((order) => {
              const statusTheme = STATUS_THEME[normalizeStatusKey(order.status)] || STATUS_THEME.WAITING_PAYMENT;
              const isPickedUp = order.pickup?.pickedUp;
              const canPickup = ['READY', 'SHIPPED', 'PAID'].includes(normalizeStatusKey(order.status)) && !isPickedUp;
              
              return (
                <Box
                  key={order.ref}
                  onClick={() => canPickup && setPickupSelectedOrder(order)}
                  sx={{
                    ...glassCardSx,
                    p: 2,
                    cursor: canPickup ? 'pointer' : 'default',
                    opacity: isPickedUp ? 0.6 : 1,
                    transition: 'all 0.2s ease',
                    '&:hover': canPickup ? {
                      transform: 'translateY(-2px)',
                      borderColor: 'rgba(6, 182, 212, 0.5)',
                    } : {},
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2 }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      {/* Order Ref & Status */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Typography sx={{ 
                          fontSize: '1rem', 
                          fontWeight: 700, 
                          color: 'var(--foreground)',
                          fontFamily: 'monospace',
                        }}>
                          {order.ref}
                        </Typography>
                        <Chip
                          size="small"
                          label={isPickedUp ? 'รับแล้ว' : (canPickup ? 'พร้อมรับ' : order.status)}
                          sx={{
                            height: 22,
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            bgcolor: isPickedUp ? 'rgba(16, 185, 129, 0.2)' : statusTheme.bg,
                            color: isPickedUp ? '#10b981' : statusTheme.text,
                            border: `1px solid ${isPickedUp ? 'rgba(16, 185, 129, 0.4)' : statusTheme.border}`,
                          }}
                        />
                      </Box>
                      
                      {/* Customer Info */}
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                          <Person size={14} color="#a78bfa" />
                          <Typography sx={{ fontSize: '0.85rem', color: 'var(--foreground)' }}>
                            {order.name}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                          <Email size={14} color="#60a5fa" />
                          <Typography sx={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {order.email}
                          </Typography>
                        </Box>
                      </Box>
                      
                      {/* Cart Summary */}
                      {order.cart && order.cart.length > 0 && (
                        <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 0.8 }}>
                          <ShoppingBag size={14} color="#818cf8" />
                          <Typography sx={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {order.cart.length} รายการ
                          </Typography>
                        </Box>
                      )}
                      
                      {/* Pickup Info if already picked up */}
                      {isPickedUp && order.pickup && (
                        <Box sx={{ 
                          mt: 1, 
                          p: 1, 
                          borderRadius: '8px',
                          bgcolor: 'rgba(16, 185, 129, 0.1)',
                          border: '1px solid rgba(16, 185, 129, 0.2)',
                        }}>
                          <Typography sx={{ fontSize: '0.75rem', color: '#10b981' }}>
                            ✓ รับแล้วเมื่อ {new Date(order.pickup.pickedUpAt).toLocaleString('th-TH')}
                          </Typography>
                          {order.pickup.notes && (
                            <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)', mt: 0.5 }}>
                              หมายเหตุ: {order.pickup.notes}
                            </Typography>
                          )}
                        </Box>
                      )}
                    </Box>
                    
                    {/* Amount & Action */}
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography sx={{ fontSize: '1.1rem', fontWeight: 700, color: '#10b981' }}>
                        ฿{Number(order.amount).toLocaleString()}
                      </Typography>
                      {canPickup && (
                        <Button
                          onClick={(e) => { e.stopPropagation(); setPickupSelectedOrder(order); }}
                          size="small"
                          sx={{
                            mt: 1,
                            px: 2,
                            py: 0.5,
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            borderRadius: '8px',
                            bgcolor: 'rgba(6, 182, 212, 0.2)',
                            color: '#06b6d4',
                            border: '1px solid rgba(6, 182, 212, 0.4)',
                            '&:hover': {
                              bgcolor: 'rgba(6, 182, 212, 0.3)',
                            },
                          }}
                        >
                          ยืนยันรับ
                        </Button>
                      )}
                    </Box>
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}

        {/* Empty State */}
        {pickupSearch && pickupSearchResults.length === 0 && !pickupSearching && (
          <Box sx={{ ...glassCardSx, textAlign: 'center', py: 6 }}>
            <Search size={56} color="#475569" style={{ marginBottom: 16 }} />
            <Typography sx={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              ไม่พบออเดอร์
            </Typography>
            <Typography sx={{ fontSize: '0.85rem', color: '#475569' }}>
              ลองค้นหาด้วยคำค้นอื่น
            </Typography>
          </Box>
        )}

        {/* Filtered Order List */}
        {!pickupSearch && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: 1 }}>
              {pickupFilter === 'ready' && <><LocalMall size={20} color="#10b981" /> ออเดอร์พร้อมรับ ({readyForPickup.length})</>}
              {pickupFilter === 'today' && <><CheckCircleOutline size={20} color="#818cf8" /> รับแล้ววันนี้ ({completedToday.length})</>}
              {pickupFilter === 'all_completed' && <><Inventory size={20} color="#fbbf24" /> รับแล้วทั้งหมด ({completedPickups.length})</>}
            </Typography>
            
            {/* Ready for pickup list */}
            {pickupFilter === 'ready' && (
              <>
                {readyForPickup.slice(0, 20).map((order) => {
                  const statusTheme = STATUS_THEME[normalizeStatusKey(order.status)] || STATUS_THEME.READY;
                  return (
                    <Box
                      key={order.ref}
                      onClick={() => setPickupSelectedOrder({
                        ref: order.ref,
                        name: order.name,
                        email: order.email,
                        status: order.status,
                        amount: order.amount,
                        cart: order.cart || order.items || [],
                        pickup: order.pickup || order.raw?.pickup,
                        date: order.date,
                      })}
                      sx={{
                        ...glassCardSx,
                        p: 1.5,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          transform: 'translateY(-2px)',
                          borderColor: 'rgba(6, 182, 212, 0.5)',
                        },
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Box sx={{
                            width: 40,
                            height: 40,
                            borderRadius: '10px',
                            bgcolor: statusTheme.bg,
                            border: `1px solid ${statusTheme.border}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                            <LocalMall size={20} color={statusTheme.text} />
                          </Box>
                          <Box>
                            <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--foreground)' }}>
                              {order.ref}
                            </Typography>
                            <Typography sx={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {order.name}
                            </Typography>
                          </Box>
                        </Box>
                        <Box sx={{ textAlign: 'right' }}>
                          <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, color: '#10b981' }}>
                            ฿{Number(order.amount).toLocaleString()}
                          </Typography>
                          <Chip
                            size="small"
                            label={order.status}
                            sx={{
                              height: 18,
                              fontSize: '0.65rem',
                              bgcolor: statusTheme.bg,
                              color: statusTheme.text,
                              border: `1px solid ${statusTheme.border}`,
                            }}
                          />
                        </Box>
                      </Box>
                    </Box>
                  );
                })}
                {readyForPickup.length === 0 && (
                  <Box sx={{ ...glassCardSx, textAlign: 'center', py: 4 }}>
                    <CheckCircleOutline size={48} color="#10b981" style={{ marginBottom: 8 }} />
                    <Typography sx={{ fontSize: '0.95rem', color: 'var(--text-muted)' }}>
                      ไม่มีออเดอร์รอรับ
                    </Typography>
                  </Box>
                )}
              </>
            )}

            {/* Completed pickups list (today or all) */}
            {(pickupFilter === 'today' || pickupFilter === 'all_completed') && (() => {
              const displayList = pickupFilter === 'today' ? completedToday : completedPickups;
              return displayList.length > 0 ? (
                <>
                  {displayList.slice(0, 50).map((order) => {
                    const pickup = order.pickup || order.raw?.pickup;
                    return (
                      <Box
                        key={order.ref}
                        sx={{
                          ...glassCardSx,
                          p: 1.5,
                          opacity: 0.85,
                        }}
                      >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Box sx={{
                              width: 40,
                              height: 40,
                              borderRadius: '10px',
                              bgcolor: 'rgba(16, 185, 129, 0.15)',
                              border: '1px solid rgba(16, 185, 129, 0.3)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}>
                              <CheckCircle size={20} color="#10b981" />
                            </Box>
                            <Box>
                              <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--foreground)' }}>
                                {order.ref}
                              </Typography>
                              <Typography sx={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {order.name}
                              </Typography>
                              {pickup?.pickedUpAt && (
                                <Typography sx={{ fontSize: '0.7rem', color: '#10b981' }}>
                                  ✓ {new Date(pickup.pickedUpAt).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                  {pickup.notes ? ` · ${pickup.notes}` : ''}
                                </Typography>
                              )}
                            </Box>
                          </Box>
                          <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, color: '#10b981' }}>
                            ฿{Number(order.amount).toLocaleString()}
                          </Typography>
                        </Box>
                      </Box>
                    );
                  })}
                </>
              ) : (
                <Box sx={{ ...glassCardSx, textAlign: 'center', py: 4 }}>
                  <Inventory size={48} color="#64748b" style={{ marginBottom: 8 }} />
                  <Typography sx={{ fontSize: '0.95rem', color: 'var(--text-muted)' }}>
                    {pickupFilter === 'today' ? 'ยังไม่มีคนรับวันนี้' : 'ยังไม่มีออเดอร์ที่รับแล้ว'}
                  </Typography>
                </Box>
              );
            })()}
          </Box>
        )}

        {/* QR Scanner Dialog */}
        <Dialog
          open={pickupScanMode}
          onClose={() => { setPickupScanMode(false); setScannerError(null); setScannerReady(false); setManualInput(''); setIsProcessingScan(false); }}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: {
              bgcolor: 'var(--surface)',
              borderRadius: '20px',
              border: '1px solid var(--glass-border)',
              overflow: 'hidden',
            }
          }}
        >
          <DialogTitle sx={{ 
            bgcolor: 'rgba(6, 182, 212, 0.1)',
            borderBottom: '1px solid var(--glass-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2,
            py: 1.5,
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CameraAlt color="#06b6d4" />
              <Typography sx={{ fontWeight: 700, color: 'var(--foreground)' }}>
                สแกน QR Code
              </Typography>
              {isProcessingScan && (
                <CircularProgress size={16} sx={{ color: '#06b6d4', ml: 1 }} />
              )}
            </Box>
            <IconButton 
              onClick={() => { setPickupScanMode(false); setScannerError(null); setScannerReady(false); setManualInput(''); setIsProcessingScan(false); }} 
              size="small"
              sx={{ color: 'var(--text-muted)' }}
            >
              <Close />
            </IconButton>
          </DialogTitle>
          <DialogContent sx={{ p: 0 }}>
            {pickupScanMode && (
              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                {/* Camera Scanner */}
                <Box sx={{ 
                  position: 'relative',
                  overflow: 'hidden',
                  bgcolor: '#000',
                  minHeight: scannerError ? 'auto' : 320,
                }}>
                  {scannerError ? (
                    <Box sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      p: 3,
                      textAlign: 'center',
                      bgcolor: 'rgba(239, 68, 68, 0.08)',
                      minHeight: 200,
                    }}>
                      <CameraAlt size={48} color="#ef4444" style={{ marginBottom: 12 }} />
                      <Typography sx={{ color: '#ef4444', fontWeight: 600, fontSize: '1rem', mb: 0.5 }}>
                        ไม่สามารถใช้กล้องได้
                      </Typography>
                      <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.75rem', mb: 1 }}>
                        {scannerError}
                      </Typography>
                      <Button
                        size="small"
                        onClick={() => {
                          setScannerError(null);
                          setScannerReady(false);
                          setPickupScanMode(false);
                          setTimeout(() => setPickupScanMode(true), 100);
                        }}
                        sx={{
                          fontSize: '0.75rem',
                          bgcolor: 'rgba(6, 182, 212, 0.15)',
                          color: '#06b6d4',
                          '&:hover': { bgcolor: 'rgba(6, 182, 212, 0.25)' },
                        }}
                      >
                        ลองใหม่
                      </Button>
                    </Box>
                  ) : (
                    <>
                      {/* Custom scanner frame overlay */}
                      <Box sx={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: 250,
                        height: 250,
                        zIndex: 20,
                        pointerEvents: 'none',
                      }}>
                        {/* Corner borders */}
                        <Box sx={{
                          position: 'absolute',
                          top: 0, left: 0,
                          width: 50, height: 50,
                          borderTop: '4px solid #06b6d4',
                          borderLeft: '4px solid #06b6d4',
                          borderRadius: '8px 0 0 0',
                        }} />
                        <Box sx={{
                          position: 'absolute',
                          top: 0, right: 0,
                          width: 50, height: 50,
                          borderTop: '4px solid #06b6d4',
                          borderRight: '4px solid #06b6d4',
                          borderRadius: '0 8px 0 0',
                        }} />
                        <Box sx={{
                          position: 'absolute',
                          bottom: 0, left: 0,
                          width: 50, height: 50,
                          borderBottom: '4px solid #06b6d4',
                          borderLeft: '4px solid #06b6d4',
                          borderRadius: '0 0 0 8px',
                        }} />
                        <Box sx={{
                          position: 'absolute',
                          bottom: 0, right: 0,
                          width: 50, height: 50,
                          borderBottom: '4px solid #06b6d4',
                          borderRight: '4px solid #06b6d4',
                          borderRadius: '0 0 8px 0',
                        }} />
                        {/* Scanning line animation */}
                        <Box sx={{
                          position: 'absolute',
                          top: 0,
                          left: 10,
                          right: 10,
                          height: 2,
                          background: 'linear-gradient(90deg, transparent, #06b6d4, transparent)',
                          animation: 'scanLine 2s ease-in-out infinite',
                          '@keyframes scanLine': {
                            '0%': { top: 0 },
                            '50%': { top: 'calc(100% - 2px)' },
                            '100%': { top: 0 },
                          },
                        }} />
                      </Box>

                      {/* Loading indicator while scanner initializes */}
                      {!scannerReady && (
                        <Box sx={{ 
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          display: 'flex', 
                          flexDirection: 'column',
                          alignItems: 'center', 
                          justifyContent: 'center',
                          bgcolor: 'var(--glass-strong)',
                          zIndex: 30,
                        }}>
                          <Box sx={{ 
                            width: 80, 
                            height: 80, 
                            borderRadius: '50%',
                            bgcolor: 'rgba(6, 182, 212, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            mb: 2,
                          }}>
                            <CameraAlt size={36} color="#06b6d4" />
                          </Box>
                          <CircularProgress size={24} sx={{ color: '#06b6d4', mb: 1.5 }} />
                          <Typography sx={{ color: 'var(--foreground)', fontSize: '0.9rem', fontWeight: 600 }}>
                            กำลังเปิดกล้อง...
                          </Typography>
                          <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.75rem', mt: 0.5 }}>
                            กรุณารอสักครู่
                          </Typography>
                        </Box>
                      )}

                      {/* ZXing video element for QR scanning */}
                      <Box
                        component="video"
                        id="qr-video"
                        sx={{
                          width: '100%',
                          maxHeight: '320px',
                          objectFit: 'cover',
                          borderRadius: '8px',
                        }}
                        playsInline
                        muted
                      />

                      {/* Hint text at bottom */}
                      {scannerReady && (
                        <Box sx={{
                          position: 'absolute',
                          bottom: 16,
                          left: 0,
                          right: 0,
                          textAlign: 'center',
                          zIndex: 20,
                        }}>
                          <Typography sx={{
                            color: '#fff',
                            fontSize: '0.8rem',
                            fontWeight: 500,
                            textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                            px: 2,
                            py: 0.5,
                            bgcolor: 'rgba(0,0,0,0.5)',
                            borderRadius: '20px',
                            display: 'inline-block',
                          }}>
                            <CameraAlt size={14} /> วาง QR Code ในกรอบ
                          </Typography>
                        </Box>
                      )}
                    </>
                  )}
                </Box>

                {/* Manual Input Fallback */}
                <Box sx={{ 
                  p: 2, 
                  bgcolor: scannerError ? 'rgba(6, 182, 212, 0.08)' : 'rgba(255,255,255,0.02)',
                  borderTop: '1px solid var(--glass-border)',
                }}>
                  <Typography sx={{ 
                    fontSize: scannerError ? '0.9rem' : '0.8rem', 
                    color: scannerError ? '#06b6d4' : '#94a3b8', 
                    fontWeight: scannerError ? 600 : 400,
                    mb: 1.5, 
                    textAlign: 'center' 
                  }}>
                    {scannerError ? 'พิมพ์เลข Order เพื่อค้นหา' : 
                     'หากกล้องไม่ทำงาน ให้พิมพ์เลข Order ด้านล่าง'}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField
                      placeholder="เลข Order เช่น ORD-XXX..."
                      variant="outlined"
                      fullWidth
                      size="small"
                      autoComplete="off"
                      autoFocus={!!scannerError}
                      value={manualInput}
                      onChange={(e) => setManualInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && manualInput.trim()) {
                          handleQrScan(manualInput.trim());
                          setManualInput('');
                        }
                      }}
                      sx={{
                        ...inputSx,
                        '& .MuiOutlinedInput-root': {
                          ...inputSx['& .MuiOutlinedInput-root'],
                          borderRadius: '10px',
                        },
                      }}
                    />
                    <Button
                      onClick={() => {
                        if (manualInput.trim()) {
                          handleQrScan(manualInput.trim());
                          setManualInput('');
                        }
                      }}
                      disabled={!manualInput.trim()}
                      sx={{
                        ...gradientButtonSx,
                        minWidth: 48,
                        px: 1.5,
                      }}
                    >
                      <Search size={20} />
                    </Button>
                  </Box>
                </Box>
              </Box>
            )}
          </DialogContent>
        </Dialog>
      </Box>
    );
  };

  // Pickup Confirmation Dialog
  const pickupConfirmDialog = (
    <Dialog
      open={!!pickupSelectedOrder}
      onClose={() => !pickupProcessing && setPickupSelectedOrder(null)}
      maxWidth="sm"
      fullWidth
      ariaTitle="ยืนยันการรับสินค้า"
      PaperProps={{
        sx: {
          bgcolor: 'var(--surface)',
          backgroundImage: 'linear-gradient(135deg, rgba(6, 182, 212, 0.05) 0%, rgba(16, 185, 129, 0.05) 100%)',
          border: '1px solid var(--glass-border)',
          borderRadius: '20px',
        },
      }}
    >
      {pickupSelectedOrder && (
        <>
          <Box sx={{ p: 3, borderBottom: '1px solid var(--glass-border)' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={{
                  width: 48,
                  height: 48,
                  borderRadius: '14px',
                  background: 'linear-gradient(135deg, #06b6d4 0%, #10b981 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <QrCodeScanner size={24} color="white" />
                </Box>
                <Box>
                  <DialogTitle className="p-0 m-0 text-[1.1rem] font-bold text-[var(--foreground)]">
                    ยืนยันการรับสินค้า
                  </DialogTitle>
                  <Typography sx={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                    #{pickupSelectedOrder.ref}
                  </Typography>
                </Box>
              </Box>
              <IconButton onClick={() => setPickupSelectedOrder(null)} disabled={pickupProcessing}>
                <Close color="#64748b" />
              </IconButton>
            </Box>
          </Box>

          <DialogContent sx={{ p: 3 }}>
            {/* Customer Info */}
            <Box sx={{ mb: 3 }}>
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', mb: 1 }}>
                ข้อมูลลูกค้า
              </Typography>
              <Box sx={{ 
                p: 2, 
                borderRadius: '12px', 
                bgcolor: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--glass-border)',
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Person size={18} color="#a78bfa" />
                  <Typography sx={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--foreground)' }}>
                    {pickupSelectedOrder.name}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Email size={18} color="#60a5fa" />
                  <Typography sx={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {pickupSelectedOrder.email}
                  </Typography>
                </Box>
              </Box>
            </Box>

            {/* Cart Items */}
            {((pickupSelectedOrder.cart && pickupSelectedOrder.cart.length > 0) || (pickupSelectedOrder.items && pickupSelectedOrder.items.length > 0)) && (
              <Box sx={{ mb: 3 }}>
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', mb: 1 }}>
                  รายการสินค้า ({(pickupSelectedOrder.cart || pickupSelectedOrder.items || []).length} รายการ)
                </Typography>
                <Box sx={{ 
                  maxHeight: 280, 
                  overflowY: 'auto',
                  borderRadius: '12px',
                  border: '1px solid var(--glass-border)',
                }}>
                  {(pickupSelectedOrder.cart || pickupSelectedOrder.items || []).map((item: any, idx: number) => (
                    <Box
                      key={idx}
                      sx={{
                        p: 2,
                        borderBottom: idx < (pickupSelectedOrder.cart || pickupSelectedOrder.items || []).length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                        bgcolor: idx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Box sx={{ flex: 1 }}>
                          <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--foreground)', mb: 0.5 }}>
                            {item.productName || 'สินค้า'}
                          </Typography>
                          
                          {/* Size, Quantity, Options */}
                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 0.8 }}>
                            {item.size && (
                              <Chip 
                                size="small" 
                                label={`ไซส์: ${item.size}`} 
                                sx={{ 
                                  height: 22, 
                                  fontSize: '0.7rem', 
                                  fontWeight: 600,
                                  bgcolor: 'rgba(16, 185, 129, 0.2)', 
                                  color: '#34d399',
                                  border: '1px solid rgba(16, 185, 129, 0.3)',
                                }} 
                              />
                            )}
                            <Chip 
                              size="small" 
                              label={`จำนวน: ${item.quantity}`} 
                              sx={{ 
                                height: 22, 
                                fontSize: '0.7rem', 
                                fontWeight: 600,
                                bgcolor: 'rgba(99, 102, 241, 0.2)', 
                                color: '#a5b4fc',
                                border: '1px solid rgba(99, 102, 241, 0.3)',
                              }} 
                            />
                            {item.options?.isLongSleeve && (
                              <Chip 
                                size="small" 
                                label="แขนยาว" 
                                sx={{ 
                                  height: 22, 
                                  fontSize: '0.7rem', 
                                  fontWeight: 600,
                                  bgcolor: 'rgba(245, 158, 11, 0.2)', 
                                  color: '#fbbf24',
                                  border: '1px solid rgba(245, 158, 11, 0.3)',
                                }} 
                              />
                            )}
                            {item.options?.pattern && (
                              <Chip 
                                size="small" 
                                label={`ลาย: ${item.options.pattern}`} 
                                sx={{ 
                                  height: 22, 
                                  fontSize: '0.7rem', 
                                  fontWeight: 600,
                                  bgcolor: 'rgba(56, 189, 248, 0.2)', 
                                  color: '#38bdf8',
                                  border: '1px solid rgba(56, 189, 248, 0.3)',
                                }} 
                              />
                            )}
                          </Box>

                          {/* Custom Name & Number - More prominent */}
                          {(item.options?.customName || item.options?.customNumber) && (
                            <Box sx={{ 
                              p: 1.2, 
                              borderRadius: '8px', 
                              bgcolor: 'rgba(139, 92, 246, 0.1)',
                              border: '1px solid rgba(139, 92, 246, 0.3)',
                            }}>
                              {item.options?.customName && (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: item.options?.customNumber ? 0.5 : 0 }}>
                                  <Typography sx={{ fontSize: '0.7rem', color: '#a78bfa', fontWeight: 600, minWidth: 60 }}>
                                    ชื่อติดเสื้อ:
                                  </Typography>
                                  <Typography sx={{ 
                                    fontSize: '0.9rem', 
                                    fontWeight: 800, 
                                    color: 'var(--foreground)',
                                    fontFamily: 'monospace',
                                    bgcolor: 'var(--glass-bg)',
                                    px: 1,
                                    py: 0.3,
                                    borderRadius: '6px',
                                    letterSpacing: '0.05em',
                                  }}>
                                    {item.options?.customName}
                                  </Typography>
                                </Box>
                              )}
                              {item.options?.customNumber && (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Typography sx={{ fontSize: '0.7rem', color: '#a78bfa', fontWeight: 600, minWidth: 60 }}>
                                    เลขเสื้อ:
                                  </Typography>
                                  <Typography sx={{ 
                                    fontSize: '1rem', 
                                    fontWeight: 800, 
                                    color: '#fbbf24',
                                    fontFamily: 'monospace',
                                    bgcolor: 'rgba(245, 158, 11, 0.15)',
                                    px: 1.2,
                                    py: 0.3,
                                    borderRadius: '6px',
                                    minWidth: 36,
                                    textAlign: 'center',
                                  }}>
                                    {item.options?.customNumber}
                                  </Typography>
                                </Box>
                              )}
                            </Box>
                          )}
                        </Box>
                        
                        {/* Price */}
                        <Typography sx={{ 
                          fontSize: '0.9rem', 
                          fontWeight: 700, 
                          color: '#10b981',
                          ml: 2,
                        }}>
                          ฿{(item.quantity * item.unitPrice).toLocaleString()}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Box>
                <Box sx={{ 
                  p: 1.5, 
                  mt: 1,
                  borderRadius: '12px',
                  bgcolor: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  display: 'flex',
                  justifyContent: 'space-between',
                }}>
                  <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--foreground)' }}>รวมทั้งหมด</Typography>
                  <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#10b981' }}>
                    ฿{Number(pickupSelectedOrder.amount).toLocaleString()}
                  </Typography>
                </Box>
              </Box>
            )}

            {/* Pickup Condition */}
            <Box sx={{ mb: 3 }}>
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', mb: 1 }}>
                สถานะสินค้า
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {[
                  { value: 'complete', label: 'ครบถ้วน', icon: <CheckCircleOutline />, color: '#10b981' },
                  { value: 'partial', label: 'ไม่ครบ', icon: <ErrorOutline />, color: '#f59e0b' },
                  { value: 'damaged', label: 'เสียหาย', icon: <ReportProblem />, color: '#ef4444' },
                ].map((option) => (
                  <Box
                    key={option.value}
                    onClick={() => setPickupCondition(option.value as any)}
                    sx={{
                      flex: 1,
                      minWidth: 80,
                      p: 1.5,
                      borderRadius: '12px',
                      cursor: 'pointer',
                      textAlign: 'center',
                      transition: 'all 0.2s ease',
                      bgcolor: pickupCondition === option.value ? `${option.color}20` : 'rgba(255,255,255,0.03)',
                      border: `2px solid ${pickupCondition === option.value ? option.color : 'var(--glass-border)'}`,
                      '&:hover': { bgcolor: `${option.color}15` },
                    }}
                  >
                    <Box sx={{ color: option.color, mb: 0.5 }}>{option.icon}</Box>
                    <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: pickupCondition === option.value ? option.color : '#94a3b8' }}>
                      {option.label}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>

            {/* Notes */}
            <Box>
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', mb: 1 }}>
                หมายเหตุ (ถ้ามี)
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={2}
                placeholder="เช่น สินค้าขาด 1 ชิ้น, สินค้ามีรอยตำหนิ..."
                value={pickupNotes}
                onChange={(e) => setPickupNotes(e.target.value)}
                sx={{
                  ...inputSx,
                  '& .MuiOutlinedInput-root': {
                    ...inputSx['& .MuiOutlinedInput-root'],
                    borderRadius: '12px',
                  },
                }}
              />
            </Box>
          </DialogContent>

          <DialogActions sx={{ p: 3, pt: 0, gap: 1 }}>
            <Button
              onClick={() => setPickupSelectedOrder(null)}
              disabled={pickupProcessing}
              sx={{
                flex: 1,
                py: 1.2,
                borderRadius: '12px',
                bgcolor: 'var(--glass-bg)',
                color: 'var(--text-muted)',
                border: '1px solid var(--glass-border)',
                '&:hover': { bgcolor: 'var(--glass-bg)' },
              }}
            >
              ยกเลิก
            </Button>
            <Button
              onClick={handlePickupConfirm}
              disabled={pickupProcessing}
              sx={{
                flex: 2,
                py: 1.2,
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #06b6d4 0%, #10b981 100%)',
                color: 'white',
                fontWeight: 700,
                '&:hover': { opacity: 0.9 },
                '&:disabled': { opacity: 0.5 },
              }}
            >
              {pickupProcessing ? (
                <CircularProgress size={20} sx={{ color: 'white' }} />
              ) : (
                <>
                  <CheckCircle style={{ marginRight: 8 }} />
                  ยืนยันรับสินค้า
                </>
              )}
            </Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  );

  // Ref to preserve search input focus
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Orders scoped to selected product (before status/search filters)
  const scopedOrders = useMemo(() => {
    if (!selectedProductIdForOrders || selectedProductIdForOrders === 'ALL') return shopOrders;
    return shopOrders.filter((o) => orderContainsProduct(o, selectedProductIdForOrders));
  }, [shopOrders, selectedProductIdForOrders]);

  const filteredOrders = useMemo(() => {
    let filtered = scopedOrders;
    if (orderFilterStatus !== 'ALL') {
      filtered = filtered.filter(o => normalizeStatusKey(o.status) === orderFilterStatus);
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(o =>
        o.ref.toLowerCase().includes(term) ||
        o.name.toLowerCase().includes(term) ||
        (o.email && o.email.toLowerCase().includes(term))
      );
    }
    return filtered;
  }, [scopedOrders, orderFilterStatus, searchTerm]);

  useEffect(() => {
    setOrdersPage(1);
  }, [selectedProductIdForOrders, orderFilterStatus, searchTerm]);

  const ordersTotalPages = Math.max(1, Math.ceil(filteredOrders.length / ORDERS_PAGE_SIZE));
  const safeOrdersPage = Math.min(ordersPage, ordersTotalPages);
  const pagedOrders = useMemo(() => {
    const start = (safeOrdersPage - 1) * ORDERS_PAGE_SIZE;
    return filteredOrders.slice(start, start + ORDERS_PAGE_SIZE);
  }, [filteredOrders, safeOrdersPage]);

  const scopedKpis = useMemo(() => {
    let pending = 0;
    let paidShip = 0;
    let revenue = 0;
    for (const o of scopedOrders) {
      const st = normalizeStatusKey(o.status);
      if (st === 'WAITING_PAYMENT' || st === 'PENDING') pending += 1;
      if (st === 'PAID' || st === 'READY' || st === 'SHIPPED' || st === 'COMPLETED') paidShip += 1;
      revenue += Number(o.amount) || 0;
    }
    return { total: scopedOrders.length, pending, paidShip, revenue };
  }, [scopedOrders]);

  const allFilteredSelected = filteredOrders.length > 0 && filteredOrders.every((o) => selectedOrders.has(o.ref));

  // JSX variable (not nested component) so parent re-renders do not remount and swallow clicks
  const activeProductsForOrders = config.products || [];
  const ordersViewElement =
    activeTab !== 2 || !canManageOrders
      ? null
      : selectedProductIdForOrders === null ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, height: '100%', py: 1 }}>
          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, mb: 1, flexWrap: 'wrap' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Inventory size={28} color="#a5b4fc" />
              <Box>
                <Typography sx={{ fontSize: { xs: '1.1rem', md: '1.4rem' }, fontWeight: 800, color: 'var(--foreground)', lineHeight: 1.2 }}>
                  เลือกสินค้าเพื่อดูออเดอร์
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  เลือกสินค้าที่ต้องการตรวจสอบรายละเอียดและสถานะการสั่งซื้อ
                </Typography>
              </Box>
            </Box>
            <Button
              size="small"
              onClick={() => setSelectedProductIdForOrders('ALL')}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                color: '#a5b4fc',
                bgcolor: 'rgba(99,102,241,0.12)',
                border: '1px solid rgba(99,102,241,0.3)',
                borderRadius: '10px',
                px: 1.5,
              }}
            >
              ดูทั้งหมดเลย
            </Button>
          </Box>

          <Box sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
            gap: 2.5,
          }}>
            {/* View All Orders Card */}
            <Card
              onClick={() => setSelectedProductIdForOrders('ALL')}
              sx={{
                ...glassCardSx,
                cursor: 'pointer',
                transition: 'all 0.2s ease-in-out',
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(168, 85, 247, 0.08) 100%)',
                border: '1px solid rgba(139, 92, 246, 0.2)',
                display: 'flex',
                alignItems: 'center',
                p: 2.5,
                gap: 2,
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 8px 24px rgba(139, 92, 246, 0.12)',
                  borderColor: 'rgba(139, 92, 246, 0.45)',
                },
              }}
            >
              <Box sx={{
                width: 48,
                height: 48,
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                flexShrink: 0,
              }}>
                <Receipt size={24} />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--foreground)' }}>
                  ออเดอร์ทั้งหมด (ทุกสินค้า)
                </Typography>
                <Typography sx={{ fontSize: '0.7rem', color: '#a5b4fc', mt: 0.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  ออเดอร์ทั้งหมดในระบบของร้านนี้
                </Typography>
                <Box sx={{ display: 'inline-flex', mt: 1, px: 1.2, py: 0.2, borderRadius: '12px', bgcolor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}>
                  <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: 'white' }}>
                    {shopOrders.length} ออเดอร์
                  </Typography>
                </Box>
              </Box>
            </Card>

            {/* Product Cards */}
            {activeProductsForOrders.map((p) => {
              const productOrdersCount = shopOrders.filter((o) => orderContainsProduct(o, p.id)).length;
              const coverImg = p.coverImage || p.images?.[0];

              return (
                <Card
                  key={p.id}
                  onClick={() => setSelectedProductIdForOrders(p.id)}
                  sx={{
                    ...glassCardSx,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease-in-out',
                    display: 'flex',
                    alignItems: 'center',
                    p: 2.5,
                    gap: 2,
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: '0 8px 24px rgba(255, 255, 255, 0.04)',
                      borderColor: 'var(--primary)',
                    },
                  }}
                >
                  {/* Thumbnail */}
                  <Box sx={{
                    width: 48,
                    height: 48,
                    borderRadius: '10px',
                    overflow: 'hidden',
                    flexShrink: 0,
                    bgcolor: 'var(--surface-2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid var(--glass-border)',
                  }}>
                    {coverImg ? (
                      <Box component="img" src={coverImg} alt={p.name} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <Store size={22} color="var(--text-muted)" />
                    )}
                  </Box>

                  {/* Info */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography noWrap sx={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--foreground)' }}>
                      {p.name}
                    </Typography>
                    <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)', mt: 0.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.category ? `หมวดหมู่: ${p.category}` : 'ไม่มีหมวดหมู่'}
                    </Typography>
                    <Box sx={{ display: 'inline-flex', mt: 1, px: 1.2, py: 0.2, borderRadius: '12px', bgcolor: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.15)' }}>
                      <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: '#a5b4fc' }}>
                        {productOrdersCount} ออเดอร์
                      </Typography>
                    </Box>
                  </Box>
                </Card>
              );
            })}
          </Box>
        </Box>
      ) : (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, height: '100%' }}>
        {/* Sticky: title + search + filters only */}
        <Box sx={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          bgcolor: ADMIN_THEME.bg,
          pb: 1.5,
          mx: { xs: -2, md: -3 },
          px: { xs: 2, md: 3 },
          pt: { xs: 0.5, md: 0 },
        }}>
          <Box sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between',
            alignItems: { xs: 'stretch', sm: 'center' },
            gap: 1.5,
            mb: 1.5,
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: { xs: '1.1rem', md: '1.3rem' }, fontWeight: 800, color: 'var(--foreground)', lineHeight: 1.2 }}>
                  {selectedProductIdForOrders === 'ALL'
                    ? 'ออเดอร์ทั้งหมด'
                    : (config.products?.find(p => p.id === selectedProductIdForOrders)?.name || 'ออเดอร์สินค้า')}
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {filteredOrders.length}/{scopedOrders.length} รายการ
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8, alignItems: 'center' }}>
              <TextField
                select
                size="small"
                value={selectedProductIdForOrders || 'ALL'}
                onChange={(e) => {
                  const v = e.target.value;
                  setSelectedProductIdForOrders(v === '__PICKER__' ? null : v);
                }}
                SelectProps={{ native: true }}
                sx={{
                  ...inputSx,
                  minWidth: { xs: 140, sm: 180 },
                  '& .MuiOutlinedInput-root': {
                    ...inputSx['& .MuiOutlinedInput-root'],
                    borderRadius: '10px',
                    fontSize: '0.8rem',
                  },
                }}
              >
                <option value="ALL">ทุกสินค้า</option>
                {activeProductsForOrders.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
                <option value="__PICKER__">เลือกจากกริด…</option>
              </TextField>
              {selectedOrders.size > 0 && (
                <>
                  <Button
                    onClick={() => setBatchStatusDialogOpen(true)}
                    size="small"
                    sx={{
                      ...gradientButtonSx,
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      px: 1.5,
                      py: 0.8,
                      gap: 0.5,
                    }}
                  >
                    <Update size={16} />
                    <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>อัปเดต</Box> ({selectedOrders.size})
                  </Button>
                  <IconButton
                    onClick={clearAllSelections}
                    size="small"
                    sx={{ color: 'var(--text-muted)', bgcolor: 'var(--glass-bg)', border: `1px solid ${ADMIN_THEME.border}` }}
                  >
                    <Clear size={18} />
                  </IconButton>
                </>
              )}
              {config.sheetUrl && (
                <IconButton
                  component="a"
                  href={config.sheetUrl}
                  target="_blank"
                  rel="noreferrer"
                  size="small"
                  sx={{ color: '#60a5fa', bgcolor: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)' }}
                >
                  <Description size={18} />
                </IconButton>
              )}
              <IconButton
                onClick={() => triggerSheetSync(config.sheetId ? 'sync' : 'create')}
                disabled={sheetSyncing}
                size="small"
                sx={{ color: '#a5b4fc', bgcolor: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)' }}
              >
                {sheetSyncing ? <CircularProgress size={18} sx={{ color: '#a5b4fc' }} /> : <Bolt size={18} />}
              </IconButton>
              <IconButton
                onClick={() => fetchData()}
                size="small"
                sx={{ color: 'var(--text-muted)', bgcolor: 'var(--glass-bg)', border: `1px solid ${ADMIN_THEME.border}` }}
              >
                <Refresh size={18} />
              </IconButton>
            </Box>
          </Box>

          <TextField
            key="orders-search-input"
            inputRef={searchInputRef}
            placeholder="ค้นหา Ref / ชื่อ / อีเมล..."
            variant="outlined"
            fullWidth
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            size="small"
            autoComplete="off"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={20} color="#64748b" />
                </InputAdornment>
              ),
              endAdornment: searchTerm ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setSearchTerm('')} sx={{ color: 'var(--text-muted)' }}>
                    <Clear size={18} />
                  </IconButton>
                </InputAdornment>
              ) : null,
            }}
            sx={{
              ...inputSx,
              mb: 1.2,
              '& .MuiOutlinedInput-root': {
                ...inputSx['& .MuiOutlinedInput-root'],
                borderRadius: '12px',
                py: 0.3,
              },
            }}
          />

          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            mb: 0.5,
          }}>
            <Box sx={{
              display: 'flex',
              gap: 0.8,
              overflowX: 'auto',
              pb: 0.5,
              flex: 1,
              '&::-webkit-scrollbar': { height: 3 },
              '&::-webkit-scrollbar-track': { bgcolor: 'transparent' },
              '&::-webkit-scrollbar-thumb': { bgcolor: 'var(--glass-bg)', borderRadius: 2 },
            }}>
              {['ALL', ...ORDER_STATUSES].map((status) => {
                const isActive = orderFilterStatus === status;
                const count = status === 'ALL'
                  ? scopedOrders.length
                  : scopedOrders.filter(o => normalizeStatusKey(o.status) === status).length;
                const theme = STATUS_THEME[status] || { bg: 'rgba(255,255,255,0.05)', text: 'var(--text-muted)', border: ADMIN_THEME.border };
                return (
                  <Box
                    key={status}
                    onClick={() => setOrderFilterStatus(status)}
                    sx={{
                      px: 1.5,
                      py: 0.6,
                      borderRadius: '16px',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                      transition: 'all 0.15s ease',
                      bgcolor: isActive ? theme.bg : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${isActive ? theme.border : ADMIN_THEME.border}`,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.6,
                      '&:hover': { bgcolor: theme.bg },
                      '&:active': { transform: 'scale(0.97)' },
                    }}
                  >
                    <Typography sx={{
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      color: isActive ? theme.text : '#64748b',
                    }}>
                      {status === 'ALL' ? 'ทั้งหมด' : (ORDER_STATUS_LABELS[status] || status)}
                    </Typography>
                    <Box sx={{
                      px: 0.6,
                      py: 0.1,
                      borderRadius: '6px',
                      bgcolor: isActive ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)',
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      color: isActive ? theme.text : '#64748b',
                      minWidth: 18,
                      textAlign: 'center',
                    }}>
                      {count}
                    </Box>
                  </Box>
                );
              })}
            </Box>
            <Button
              size="small"
              onClick={() => {
                if (allFilteredSelected) clearAllSelections();
                else selectAllOrders(filteredOrders.map((o) => o.ref));
              }}
              disabled={filteredOrders.length === 0}
              sx={{
                flexShrink: 0,
                textTransform: 'none',
                fontSize: '0.72rem',
                fontWeight: 600,
                color: allFilteredSelected ? '#a5b4fc' : 'var(--text-muted)',
                bgcolor: 'var(--glass-bg)',
                border: `1px solid ${ADMIN_THEME.border}`,
                borderRadius: '10px',
                px: 1.2,
                py: 0.6,
                whiteSpace: 'nowrap',
              }}
            >
              {allFilteredSelected ? 'ยกเลิกเลือก' : 'เลือกทั้งหมด'}
            </Button>
          </Box>
        </Box>

        {/* KPI summary — scrolls with content (scoped to selected product) */}
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' },
          gap: 1.5,
        }}>
          <Box sx={{
            p: 1.5,
            borderRadius: '14px',
            bgcolor: 'rgba(99, 102, 241, 0.08)',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            gap: 0.3,
          }}>
            <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: '#a5b4fc' }}>
              ออเดอร์ทั้งหมด
            </Typography>
            <Typography sx={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--foreground)' }}>
              {scopedKpis.total} <Typography component="span" sx={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>รายการ</Typography>
            </Typography>
          </Box>
          <Box sx={{
            p: 1.5,
            borderRadius: '14px',
            bgcolor: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            gap: 0.3,
          }}>
            <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: '#fbbf24' }}>
              รอตรวจสอบ / รอชำระ
            </Typography>
            <Typography sx={{ fontSize: '1.2rem', fontWeight: 800, color: '#fbbf24' }}>
              {scopedKpis.pending} <Typography component="span" sx={{ fontSize: '0.75rem', color: '#fbbf24', opacity: 0.8, fontWeight: 500 }}>รายการ</Typography>
            </Typography>
          </Box>
          <Box sx={{
            p: 1.5,
            borderRadius: '14px',
            bgcolor: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            gap: 0.3,
          }}>
            <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: '#34d399' }}>
              ชำระแล้ว / จัดส่งแล้ว
            </Typography>
            <Typography sx={{ fontSize: '1.2rem', fontWeight: 800, color: '#34d399' }}>
              {scopedKpis.paidShip} <Typography component="span" sx={{ fontSize: '0.75rem', color: '#34d399', opacity: 0.8, fontWeight: 500 }}>รายการ</Typography>
            </Typography>
          </Box>
          <Box sx={{
            p: 1.5,
            borderRadius: '14px',
            bgcolor: 'rgba(56, 189, 248, 0.08)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            gap: 0.3,
          }}>
            <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: '#38bdf8' }}>
              ยอดขายรวม
            </Typography>
            <Typography sx={{ fontSize: '1.2rem', fontWeight: 800, color: '#38bdf8' }}>
              ฿{scopedKpis.revenue.toLocaleString()}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {pagedOrders.map(order => {
            const statusTheme = STATUS_THEME[normalizeStatusKey(order.status)] || STATUS_THEME.WAITING_PAYMENT;
            const isProcessing = orderProcessingRef === order.ref;
            const isSelected = selectedOrders.has(order.ref);
            const slipData = order.slip || order.raw?.slip;
            const hasSlip = !!(slipData && (slipData.imageUrl || slipData.base64));
            const isPickup =
              order.shippingOption === 'pickup' ||
              (order.shippingOption || '').toLowerCase().includes('รับ') ||
              (!order.shippingOption && !order.shippingProvider);
            let shippingLabel = 'รับหน้าร้าน';
            if (order.shippingOption === 'pickup') shippingLabel = 'รับหน้าร้าน';
            else if (order.shippingOption === 'delivery_legacy') shippingLabel = 'จัดส่ง (เดิม)';
            else if (order.shippingProvider) {
              shippingLabel = (SHIPPING_PROVIDERS as Record<string, any>)[order.shippingProvider]?.nameThai || order.shippingProvider;
            } else if (order.shippingOption === 'thailand_post_ems') shippingLabel = 'EMS ไปรษณีย์ไทย';
            else if (order.shippingOption && !isPickup) shippingLabel = order.shippingOption;
            else if (!order.shippingOption && !order.shippingProvider) shippingLabel = 'รับหน้าร้าน (เดิม)';
            else if ((order.shippingOption || '').toLowerCase().includes('รับ')) shippingLabel = order.shippingOption || 'รับหน้าร้าน';

            return (
              <Box
                key={order.ref}
                sx={{
                  ...glassCardSx,
                  p: 0,
                  transition: 'all 0.2s ease',
                  opacity: isProcessing ? 0.6 : 1,
                  border: isSelected ? '2px solid rgba(99,102,241,0.6)' : `1px solid ${ADMIN_THEME.border}`,
                  '&:active': { transform: 'scale(0.99)' },
                }}
              >
                <Box sx={{
                  height: '3px',
                  background: `linear-gradient(90deg, ${statusTheme.text}, ${statusTheme.border})`,
                }} />

                <Box sx={{ p: { xs: 1.5, sm: 2 } }}>
                  <Box sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 1,
                    mb: 1,
                    flexWrap: 'wrap',
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, minWidth: 0, flex: 1, flexWrap: 'wrap' }}>
                      <IconButton
                        size="small"
                        onClick={(e) => { e.stopPropagation(); toggleOrderSelection(order.ref); }}
                        sx={{
                          color: isSelected ? '#6366f1' : '#64748b',
                          p: 0.3,
                        }}
                      >
                        {isSelected ? <CheckBox size={20} /> : <CheckBoxOutlineBlank size={20} />}
                      </IconButton>
                      <Typography sx={{
                        fontFamily: 'monospace',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        color: '#a5b4fc',
                      }}>
                        #{order.ref}
                      </Typography>
                      {hasSlip && (
                        <Button
                          size="small"
                          onClick={(e) => { e.stopPropagation(); openSlipViewer(order); }}
                          sx={{
                            height: 24,
                            px: 1,
                            borderRadius: '8px',
                            bgcolor: 'rgba(16, 185, 129, 0.15)',
                            color: '#34d399',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            fontSize: '0.68rem',
                            fontWeight: 600,
                            textTransform: 'none',
                            gap: 0.5,
                            '&:hover': { bgcolor: 'rgba(16, 185, 129, 0.25)' },
                          }}
                        >
                          <ImageIcon size={14} />
                          สลิป
                        </Button>
                      )}
                    </Box>
                    <Typography sx={{
                      fontSize: { xs: '1.05rem', sm: '1.2rem' },
                      fontWeight: 800,
                      color: '#10b981',
                      whiteSpace: 'nowrap',
                    }}>
                      ฿{Number(order.amount).toLocaleString()}
                    </Typography>
                  </Box>

                  <Box sx={{
                    display: 'flex',
                    flexDirection: { xs: 'column', sm: 'row' },
                    gap: { xs: 0.3, sm: 2 },
                    mb: 1,
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                      <Person size={15} color="#a78bfa" />
                      <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--foreground)' }}>
                        {order.name}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, overflow: 'hidden' }}>
                      <Email size={15} color="#60a5fa" style={{ flexShrink: 0 }} />
                      <Typography sx={{
                        fontSize: '0.78rem',
                        color: 'var(--text-muted)',
                        textOverflow: 'ellipsis',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                      }}>
                        {order.email || '-'}
                      </Typography>
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6, mb: 1, alignItems: 'center' }}>
                    <Chip
                      size="small"
                      icon={isPickup ? <Inventory size={14} /> : <LocalShipping size={14} />}
                      label={shippingLabel}
                      sx={{
                        height: 24,
                        fontSize: '0.7rem',
                        bgcolor: isPickup ? 'rgba(16, 185, 129, 0.12)' : 'rgba(96, 165, 250, 0.12)',
                        color: isPickup ? '#10b981' : '#60a5fa',
                        border: `1px solid ${isPickup ? 'rgba(16, 185, 129, 0.28)' : 'rgba(96, 165, 250, 0.28)'}`,
                        '& .MuiChip-icon': { color: isPickup ? '#10b981' : '#60a5fa' },
                      }}
                    />
                    {order.trackingNumber && (
                      <Chip
                        size="small"
                        label={order.trackingNumber}
                        sx={{
                          height: 24,
                          fontSize: '0.7rem',
                          bgcolor: 'rgba(34, 211, 238, 0.12)',
                          color: '#22d3ee',
                          border: '1px solid rgba(34, 211, 238, 0.28)',
                          fontFamily: 'monospace',
                        }}
                      />
                    )}
                    {order.pickup?.pickedUp && (
                      <Chip
                        size="small"
                        icon={<CheckCircle size={14} />}
                        label="รับแล้ว"
                        sx={{
                          height: 24,
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          bgcolor: 'rgba(16, 185, 129, 0.12)',
                          color: '#10b981',
                          border: '1px solid rgba(16, 185, 129, 0.28)',
                          '& .MuiChip-icon': { color: '#10b981' },
                        }}
                      />
                    )}
                    {!isPickup && order.address && (
                      <Typography sx={{
                        fontSize: '0.7rem',
                        color: 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 0.4,
                        width: '100%',
                        mt: 0.2,
                      }}>
                        <MapPin size={13} color="#64748b" style={{ marginTop: 2, flexShrink: 0 }} />
                        <Box component="span" sx={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          WebkitLineClamp: 1,
                          WebkitBoxOrient: 'vertical',
                        }}>
                          {order.address}
                        </Box>
                      </Typography>
                    )}
                  </Box>

                  {((order as AdminOrder & { _listOnly?: boolean })._listOnly
                    || (order.cart && order.cart.length > 0)
                    || (order.items && order.items.length > 0)) && (
                    <Box sx={{ mb: 1 }}>
                      <Box
                        onClick={() => toggleOrderExpand(order.ref)}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.8,
                          cursor: 'pointer',
                          py: 0.6,
                          px: 1,
                          borderRadius: '8px',
                          bgcolor: 'rgba(99, 102, 241, 0.06)',
                          border: '1px solid rgba(99, 102, 241, 0.15)',
                        }}
                      >
                        <ShoppingBag size={15} color="#818cf8" />
                        <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: '#a5b4fc', flex: 1 }}>
                          {(order as AdminOrder & { _listOnly?: boolean })._listOnly
                            ? (expandedOrders.has(order.ref) ? 'กำลังโหลดรายการ...' : 'แตะเพื่อโหลดรายการ')
                            : `${(order.cart || order.items || []).length} รายการ`}
                        </Typography>
                        {expandedOrders.has(order.ref) ? (
                          <ExpandLess size={16} color="#818cf8" />
                        ) : (
                          <ExpandMore size={16} color="#818cf8" />
                        )}
                      </Box>

                      {expandedOrders.has(order.ref) && (
                        <Box sx={{
                          mt: 0.8,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 0.6,
                        }}>
                          {(order.cart || order.items || []).map((item, idx) => {
                            const product = config.products?.find(p => p.id === item.productId);
                            return (
                              <Box
                                key={item.id || idx}
                                sx={{
                                  display: 'flex',
                                  alignItems: 'flex-start',
                                  gap: 1,
                                  p: 1,
                                  borderRadius: '8px',
                                  bgcolor: 'rgba(255,255,255,0.03)',
                                  border: `1px solid ${ADMIN_THEME.border}`,
                                }}
                              >
                                {product?.images?.[0] ? (
                                  <Box
                                    component="img"
                                    src={product.images[0]}
                                    alt={item.productName}
                                    sx={{
                                      width: 40,
                                      height: 40,
                                      borderRadius: '8px',
                                      objectFit: 'cover',
                                      border: '1px solid var(--glass-border)',
                                    }}
                                  />
                                ) : (
                                  <Box sx={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: '8px',
                                    bgcolor: 'rgba(99, 102, 241, 0.15)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}>
                                    <Inventory size={16} color="#818cf8" />
                                  </Box>
                                )}
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                  <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--foreground)' }}>
                                    {item.productName || product?.name || 'สินค้า'}
                                  </Typography>
                                  <Typography sx={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                    {[item.size, item.options?.customName, item.options?.customNumber ? `#${item.options.customNumber}` : null, item.options?.pattern]
                                      .filter(Boolean).join(' · ') || '—'}
                                    {' · '}x{item.quantity}
                                  </Typography>
                                </Box>
                                <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: '#10b981', whiteSpace: 'nowrap' }}>
                                  ฿{(item.quantity * item.unitPrice).toLocaleString()}
                                </Typography>
                              </Box>
                            );
                          })}
                        </Box>
                      )}
                    </Box>
                  )}

                  <Box sx={{
                    display: 'flex',
                    flexDirection: { xs: 'column', sm: 'row' },
                    justifyContent: 'space-between',
                    alignItems: { xs: 'stretch', sm: 'center' },
                    gap: 1,
                    pt: 1,
                    borderTop: `1px solid ${ADMIN_THEME.border}`,
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'var(--text-muted)' }}>
                      <CalendarToday size={12} />
                      <Typography sx={{ fontSize: '0.7rem' }}>
                        {order.date ? new Date(order.date).toLocaleDateString('th-TH', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        }) : '-'}
                      </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', gap: 0.8, alignItems: 'center', flexWrap: 'wrap', justifyContent: { xs: 'space-between', sm: 'flex-end' } }}>
                      <Select
                        value={order.status}
                        onChange={(e) => { updateOrderStatus(order.ref, e.target.value as string); }}
                        size="small"
                        disabled={isProcessing}
                        MenuProps={{
                          PaperProps: {
                            sx: {
                              bgcolor: 'var(--card-bg, #1e293b)',
                              color: 'var(--foreground, #f8fafc)',
                              border: '1px solid var(--glass-border, rgba(255,255,255,0.15))',
                              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)',
                              backgroundImage: 'none',
                              '& .MuiMenuItem-root': {
                                fontSize: '0.8rem',
                                fontWeight: 500,
                                color: 'var(--foreground, #f8fafc)',
                                py: 1,
                                px: 1.5,
                                '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' },
                                '&.Mui-selected': {
                                  bgcolor: 'rgba(99,102,241,0.25)',
                                  color: '#a5b4fc',
                                  fontWeight: 700,
                                  '&:hover': { bgcolor: 'rgba(99,102,241,0.35)' },
                                },
                              },
                            },
                          },
                        }}
                        sx={{
                          minWidth: { xs: 130, sm: 150 },
                          fontSize: '0.75rem',
                          bgcolor: statusTheme.bg,
                          borderRadius: '8px',
                          '& .MuiOutlinedInput-notchedOutline': {
                            borderColor: statusTheme.border,
                          },
                          '& .MuiSelect-select': {
                            py: 0.5,
                            px: 1.2,
                            fontWeight: 600,
                            color: statusTheme.text,
                          },
                        }}
                      >
                        {ORDER_STATUSES.map(status => (
                          <MenuItem key={status} value={status}>
                            {ORDER_STATUS_LABELS[status] || status}
                          </MenuItem>
                        ))}
                      </Select>

                      <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                        <Button
                          size="small"
                          onClick={() => openOrderEditor(order)}
                          disabled={isProcessing}
                          sx={{
                            bgcolor: 'rgba(59, 130, 246, 0.12)',
                            color: '#60a5fa',
                            border: '1px solid rgba(59, 130, 246, 0.3)',
                            borderRadius: '8px',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            textTransform: 'none',
                            px: 1.2,
                            py: 0.4,
                            minWidth: 'auto',
                            '&:hover': { bgcolor: 'rgba(59, 130, 246, 0.22)' },
                          }}
                        >
                          <EditIconMUI size={14} style={{ marginRight: 4 }} />
                          แก้ไข
                        </Button>
                        {order.status !== 'CANCELLED' && (
                          <Tooltip title="ยกเลิกออเดอร์">
                            <IconButton
                              size="small"
                              onClick={() => deleteOrder(order, false)}
                              disabled={isProcessing}
                              sx={{
                                color: '#fbbf24',
                                bgcolor: 'rgba(245, 158, 11, 0.1)',
                                border: '1px solid rgba(245, 158, 11, 0.25)',
                                borderRadius: '8px',
                                '&:hover': { bgcolor: 'rgba(245, 158, 11, 0.2)' },
                              }}
                            >
                              <Close size={16} />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title="ลบถาวร">
                          <IconButton
                            size="small"
                            onClick={() => deleteOrder(order, true)}
                            disabled={isProcessing}
                            sx={{
                              color: '#f87171',
                              bgcolor: 'rgba(239, 68, 68, 0.1)',
                              border: '1px solid rgba(239, 68, 68, 0.25)',
                              borderRadius: '8px',
                              '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.2)' },
                            }}
                          >
                            <Delete size={16} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>
                  </Box>
                </Box>
              </Box>
            );
          })}

          {filteredOrders.length === 0 && (
            <Box sx={{
              ...glassCardSx,
              textAlign: 'center',
              py: 6,
            }}>
              <Receipt size={56} color="#475569" style={{ marginBottom: 16 }} />
              <Typography sx={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-muted)', mb: 0.5 }}>
                ไม่พบออเดอร์
              </Typography>
              <Typography sx={{ fontSize: '0.85rem', color: '#475569' }}>
                ลองเปลี่ยนตัวกรองหรือคำค้นหา
              </Typography>
            </Box>
          )}

          {filteredOrders.length > ORDERS_PAGE_SIZE && (
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1.5,
              py: 1,
            }}>
              <Button
                size="small"
                disabled={safeOrdersPage <= 1}
                onClick={() => setOrdersPage((p) => Math.max(1, p - 1))}
                sx={{
                  textTransform: 'none',
                  color: 'var(--text-muted)',
                  border: `1px solid ${ADMIN_THEME.border}`,
                  borderRadius: '10px',
                  minWidth: 80,
                }}
              >
                ก่อนหน้า
              </Button>
              <Typography sx={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                {safeOrdersPage} / {ordersTotalPages}
              </Typography>
              <Button
                size="small"
                disabled={safeOrdersPage >= ordersTotalPages}
                onClick={() => setOrdersPage((p) => Math.min(ordersTotalPages, p + 1))}
                sx={{
                  textTransform: 'none',
                  color: 'var(--text-muted)',
                  border: `1px solid ${ADMIN_THEME.border}`,
                  borderRadius: '10px',
                  minWidth: 80,
                }}
              >
                ถัดไป
              </Button>
            </Box>
          )}
        </Box>
      </Box>
  );

  // Order Editor Dialog - rendered as JSX variable (not as component) to prevent remounting
  const orderEditorDialogElement = (
    <Dialog 
      open={orderEditor.open} 
      onClose={resetOrderEditor} 
      fullscreen
      ariaTitle="แก้ไขออเดอร์"
    >
      {/* Header */}
      <Box sx={{
        p: 3,
        pb: 2,
        flexShrink: 0,
        background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%)',
        borderBottom: '1px solid var(--glass-border)',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }} className="mx-auto max-w-[1100px]">
          <Box sx={{
            width: 48,
            height: 48,
            borderRadius: '14px',
            background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <EditIconMUI size={24} color="#fff" />
          </Box>
          <Box>
            <DialogTitle
              className="p-0 m-0 text-[1.2rem] font-bold text-[var(--foreground)]"
            >
              แก้ไขออเดอร์
            </DialogTitle>
            {orderEditor.ref && (
              <Typography sx={{ 
                fontSize: '0.85rem', 
                color: 'var(--text-muted)',
                fontFamily: 'monospace',
              }}>
                #{orderEditor.ref}
              </Typography>
            )}
          </Box>
        </Box>
      </Box>

      <DialogContent
        className="mx-auto min-h-0 w-full max-w-[1100px] flex-1 overflow-y-auto"
        sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: 2.5,
          p: 3,
        }}
      >
        {/* Customer Info Section */}
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
            <Typography sx={{ 
              fontSize: '0.75rem', 
              fontWeight: 600, 
              color: 'var(--text-muted)', 
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              ข้อมูลลูกค้า / โปรไฟล์
            </Typography>
            <Button
              size="small"
              type="button"
              variant="outlined"
              disabled={!orderEditor.email || orderEditor.profileLoading}
              onClick={() => applyProfileToOrderEditor(orderEditor.email, 'overwrite')}
              sx={{
                textTransform: 'none',
                fontSize: '0.72rem',
                fontWeight: 600,
                color: '#818cf8',
                borderColor: 'rgba(129,140,248,0.4)',
                borderRadius: '10px',
                px: 1.2,
                gap: 0.5,
              }}
            >
              {orderEditor.profileLoading ? <CircularProgress size={14} /> : <Person size={14} />}
              ดึงโปรไฟล์ทั้งหมด
            </Button>
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            <TextField
              label="ชื่อลูกค้า"
              placeholder="กรอกชื่อ-นามสกุล"
              value={orderEditor.name}
              onChange={(e) => setOrderEditor(prev => ({ ...prev, name: e.target.value }))}
              fullWidth
              sx={{
                ...inputSx,
                gridColumn: { xs: 'auto', sm: '1 / -1' },
                '& .MuiOutlinedInput-root': {
                  ...inputSx['& .MuiOutlinedInput-root'],
                  borderRadius: '12px',
                },
              }}
            />
            <TextField
              label="อีเมล"
              placeholder="example@email.com"
              type="email"
              value={orderEditor.email}
              onChange={(e) => setOrderEditor(prev => ({ ...prev, email: e.target.value }))}
              fullWidth
              sx={{
                ...inputSx,
                '& .MuiOutlinedInput-root': {
                  ...inputSx['& .MuiOutlinedInput-root'],
                  borderRadius: '12px',
                },
              }}
            />
            <TextField
              label="เบอร์โทร"
              placeholder="08x-xxx-xxxx"
              value={orderEditor.phone}
              onChange={(e) => setOrderEditor(prev => ({ ...prev, phone: e.target.value }))}
              fullWidth
              sx={{
                ...inputSx,
                '& .MuiOutlinedInput-root': {
                  ...inputSx['& .MuiOutlinedInput-root'],
                  borderRadius: '12px',
                },
              }}
            />
            <TextField
              label="Instagram"
              placeholder="@username"
              value={orderEditor.instagram}
              onChange={(e) => setOrderEditor(prev => ({ ...prev, instagram: e.target.value }))}
              fullWidth
              sx={{
                ...inputSx,
                gridColumn: { xs: 'auto', sm: '1 / -1' },
                '& .MuiOutlinedInput-root': {
                  ...inputSx['& .MuiOutlinedInput-root'],
                  borderRadius: '12px',
                },
              }}
            />
            <TextField
              label="ที่อยู่จัดส่ง"
              placeholder="บ้านเลขที่ ถนน ตำบล อำเภอ จังหวัด รหัสไปรษณีย์"
              value={orderEditor.address}
              onChange={(e) => setOrderEditor(prev => ({ ...prev, address: e.target.value }))}
              fullWidth
              multiline
              rows={3}
              sx={{
                ...inputSx,
                gridColumn: { xs: 'auto', sm: '1 / -1' },
                '& .MuiOutlinedInput-root': {
                  ...inputSx['& .MuiOutlinedInput-root'],
                  borderRadius: '12px',
                },
              }}
            />
          </Box>
        </Box>

        {/* Order Details Section */}
        <Box>
          <Typography sx={{ 
            fontSize: '0.75rem', 
            fontWeight: 600, 
            color: 'var(--text-muted)', 
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            mb: 1.5,
          }}>
            รายละเอียดออเดอร์
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            {/* Calculated Amount - Read Only */}
            <Box sx={{
              p: 2,
              borderRadius: '12px',
              bgcolor: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
            }}>
              <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)', mb: 0.5 }}>
                ยอดชำระ (คำนวณจากตะกร้า)
              </Typography>
              <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, color: '#10b981' }}>
                ฿{orderEditor.cart.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0).toLocaleString()}
              </Typography>
              {orderEditor.amount > 0 && orderEditor.amount !== orderEditor.cart.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0) && (
                <Typography sx={{ fontSize: '0.7rem', color: '#f59e0b', mt: 0.5 }}>
                  ยอดเดิม: ฿{orderEditor.amount.toLocaleString()}
                </Typography>
              )}
            </Box>
            <DateTimePicker
              id="order-editor-date"
              label="วันที่"
              value={orderEditor.date}
              onChange={(local) => setOrderEditor((prev) => ({ ...prev, date: local }))}
              placeholder="เลือกวันและเวลา"
            />
          </Box>
        </Box>

        {/* Cart Items Section */}
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
            <Typography sx={{ 
              fontSize: '0.75rem', 
              fontWeight: 600, 
              color: 'var(--text-muted)', 
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              รายการสินค้า ({orderEditor.cart.length} รายการ)
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
              <Button
                size="small"
                type="button"
                onClick={() => {
                  let changed = 0;
                  let missingProduct = 0;
                  const newCart = orderEditor.cart.map((item) => {
                    const product = config.products?.find((p) => p.id === item.productId);
                    if (!product) {
                      missingProduct += 1;
                      return item;
                    }
                    const nextPrice = calculateItemUnitPrice(item, product);
                    if (Number(item.unitPrice) !== nextPrice) changed += 1;
                    return { ...item, unitPrice: nextPrice };
                  });
                  const cartTotal = newCart.reduce(
                    (sum, item) => sum + item.quantity * item.unitPrice,
                    0,
                  );
                  setOrderEditor((prev) => ({ ...prev, cart: newCart, amount: cartTotal }));
                  if (missingProduct > 0 && changed === 0) {
                    showToast('warning', 'ไม่พบสินค้าในระบบสำหรับบางรายการ จึงคำนวณไม่ได้');
                  } else if (changed > 0) {
                    showToast('success', `อัปเดตราคาแล้ว ${changed} รายการ`);
                  } else {
                    showToast('info', 'ราคาตรงกับสินค้าปัจจุบันแล้ว');
                  }
                }}
                sx={{
                  fontSize: '0.7rem',
                  color: '#f59e0b',
                  borderColor: 'rgba(245,158,11,0.3)',
                  '&:hover': { borderColor: '#f59e0b', bgcolor: 'rgba(245,158,11,0.1)' },
                }}
                variant="outlined"
              >
                <RefreshCw size={12} /> คำนวณราคาใหม่
              </Button>
              <Typography sx={{ 
                fontSize: '0.85rem', 
                fontWeight: 700, 
                color: '#10b981',
              }}>
                รวม ฿{orderEditor.cart.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0).toLocaleString()}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {orderEditor.cart.map((item, idx) => {
              const product = config.products?.find(p => p.id === item.productId);
              const catalogPrice = calculateItemUnitPrice(item, product);
              const orderedPrice = Number(item.unitPrice) || 0;
              const priceDiff = catalogPrice - orderedPrice;
              const hasPriceDiff = !!product && orderedPrice !== catalogPrice;
              const productMissing = !product;
              const productInactive = !!product && product.isActive === false;
              const cover = product?.coverImage || product?.images?.[0];

              return (
                <Box 
                  key={item.id || idx}
                  sx={{
                    p: 2.5,
                    borderRadius: '16px',
                    bgcolor: 'var(--surface-2, rgba(255,255,255,0.03))',
                    border: hasPriceDiff
                      ? '1px solid rgba(245,158,11,0.45)'
                      : productMissing || productInactive
                        ? '1px solid rgba(239,68,68,0.35)'
                        : `1px solid ${ADMIN_THEME.border}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                    {cover ? (
                      <Box
                        component="img"
                        src={cover}
                        alt={item.productName}
                        sx={{
                          width: 56,
                          height: 56,
                          borderRadius: '12px',
                          objectFit: 'cover',
                          border: '1px solid var(--glass-border)',
                          flexShrink: 0,
                        }}
                      />
                    ) : (
                      <Box sx={{
                        width: 56,
                        height: 56,
                        borderRadius: '12px',
                        bgcolor: 'rgba(99, 102, 241, 0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <Inventory size={22} color="#818cf8" />
                      </Box>
                    )}
                    <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <TextField
                        select
                        fullWidth
                        size="small"
                        label="สินค้าในระบบ (เปิดอยู่)"
                        value={
                          activeCatalogProducts.some((p) => p.id === item.productId)
                            ? (item.productId || '')
                            : (item.productId || '__missing__')
                        }
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v && v !== '__missing__') changeCartProduct(idx, v);
                        }}
                        SelectProps={{ native: true }}
                        sx={{
                          ...inputSx,
                          '& .MuiOutlinedInput-root': {
                            ...inputSx['& .MuiOutlinedInput-root'],
                            borderRadius: '10px',
                          },
                        }}
                      >
                        {(productMissing || productInactive) && (
                          <option value={item.productId || '__missing__'}>
                            {item.productName || product?.name || 'สินค้าเดิม'}{productInactive ? ' (ปิดอยู่)' : ' (ไม่พบในระบบ)'}
                          </option>
                        )}
                        {activeCatalogProducts.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} — ฿{Number(p.basePrice || 0).toLocaleString()}
                          </option>
                        ))}
                      </TextField>
                      {(productMissing || productInactive) && (
                        <Typography sx={{ fontSize: '0.72rem', color: '#f87171', fontWeight: 600 }}>
                          {productMissing
                            ? 'ไม่พบสินค้านี้ในแคตตาล็อก — เลือกสินค้าที่เปิดอยู่เพื่อเปลี่ยน'
                            : 'สินค้านี้ถูกปิดในระบบแล้ว — แนะนำให้เปลี่ยนเป็นสินค้าที่เปิดอยู่'}
                        </Typography>
                      )}
                    </Box>
                    <IconButton
                      size="small"
                      onClick={() => {
                        const newCart = orderEditor.cart.filter((_, i) => i !== idx);
                        setOrderEditor(prev => ({ ...prev, cart: newCart }));
                      }}
                      sx={{ color: '#ef4444', '&:hover': { bgcolor: 'rgba(239,68,68,0.1)' } }}
                    >
                      <Delete size={18} />
                    </IconButton>
                  </Box>

                  <Box sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr auto' },
                    gap: 1.2,
                    p: 1.5,
                    borderRadius: '12px',
                    bgcolor: hasPriceDiff ? 'rgba(245,158,11,0.08)' : 'rgba(16,185,129,0.06)',
                    border: `1px solid ${hasPriceDiff ? 'rgba(245,158,11,0.3)' : 'rgba(16,185,129,0.22)'}`,
                    alignItems: 'center',
                  }}>
                    <Box>
                      <Typography sx={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, mb: 0.3 }}>
                        ราคาในออเดอร์
                      </Typography>
                      <Typography sx={{ fontSize: '1rem', fontWeight: 800, color: 'var(--foreground)' }}>
                        ฿{orderedPrice.toLocaleString()}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, mb: 0.3 }}>
                        ราคาปัจจุบันในระบบ
                      </Typography>
                      <Typography sx={{ fontSize: '1rem', fontWeight: 800, color: product ? '#38bdf8' : '#94a3b8' }}>
                        {product ? `฿${catalogPrice.toLocaleString()}` : '—'}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6, alignItems: { xs: 'stretch', sm: 'flex-end' } }}>
                      {hasPriceDiff ? (
                        <>
                          <Typography sx={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            color: priceDiff > 0 ? '#f59e0b' : '#34d399',
                          }}>
                            ส่วนต่าง {priceDiff > 0 ? '+' : ''}฿{priceDiff.toLocaleString()}
                          </Typography>
                          <Button
                            size="small"
                            type="button"
                            variant="outlined"
                            onClick={() => updateCartItem(idx, { unitPrice: catalogPrice })}
                            sx={{
                              textTransform: 'none',
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              color: '#f59e0b',
                              borderColor: 'rgba(245,158,11,0.4)',
                              borderRadius: '8px',
                            }}
                          >
                            ใช้ราคาปัจจุบัน
                          </Button>
                        </>
                      ) : (
                        <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: '#34d399' }}>
                          {product ? 'ราคาตรงกับระบบ' : 'เทียบราคาไม่ได้'}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                  
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, alignItems: 'start' }}>
                    <TextField
                      select
                      fullWidth
                      label="ไซส์"
                      value={item.size || ''}
                      onChange={(e) => updateCartItem(idx, { size: e.target.value })}
                      size="small"
                      SelectProps={{ native: true }}
                      sx={{
                        ...inputSx,
                        '& .MuiOutlinedInput-root': {
                          ...inputSx['& .MuiOutlinedInput-root'],
                          borderRadius: '10px',
                        },
                      }}
                    >
                      <option value="">เลือกไซส์</option>
                      {SIZES.map((size) => (
                        <option key={size} value={size}>{size}</option>
                      ))}
                    </TextField>
                    
                    <TextField
                      type="number"
                      fullWidth
                      label="จำนวน"
                      value={item.quantity}
                      onChange={(e) => updateCartItem(idx, { quantity: Math.max(1, Number(e.target.value)) })}
                      size="small"
                      inputProps={{ min: 1 }}
                      sx={{
                        ...inputSx,
                        '& .MuiOutlinedInput-root': {
                          ...inputSx['& .MuiOutlinedInput-root'],
                          borderRadius: '10px',
                        },
                      }}
                    />
                  </Box>
                  
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {(() => {
                      const cartProduct = config?.products?.find((p) => p.id === item.productId);
                      const sc = getProductShirtNameConfig(cartProduct, config?.shirtNameConfig);
                      const langs: string[] = [];
                      if (sc.allowThai) langs.push('ไทย');
                      if (sc.allowEnglish) langs.push('อังกฤษ');
                      const langLabel = langs.join('/');
                      return (
                        <TextField
                          label={`ชื่อติดเสื้อ (${langLabel}, ${sc.minLength}-${sc.maxLength} ตัว)`}
                          value={item.options?.customName || ''}
                          onChange={(e) => {
                            let pattern = '';
                            if (sc.allowEnglish) pattern += 'a-zA-Z';
                            if (sc.allowThai) pattern += '\u0E00-\u0E7F';
                            if (sc.allowSpecialChars && sc.allowedSpecialChars) {
                              pattern += sc.allowedSpecialChars.replace(/[\\\]\^\-]/g, '\\$&');
                            }
                            pattern += '\\s';
                            const regex = new RegExp(`[^${pattern}]`, 'g');
                            let val = e.target.value.replace(regex, '');
                            if (sc.autoUppercase) val = val.toUpperCase();
                            val = val.slice(0, sc.maxLength);
                            const newOptions = { ...item.options, customName: val };
                            updateCartItem(idx, { options: newOptions });
                          }}
                          size="small"
                          inputProps={{ maxLength: sc.maxLength }}
                          placeholder={sc.allowThai ? 'เช่น สมชาย' : 'เช่น JOHN'}
                          sx={{
                            ...inputSx,
                            '& .MuiOutlinedInput-root': {
                              ...inputSx['& .MuiOutlinedInput-root'],
                              borderRadius: '10px',
                            },
                          }}
                        />
                      );
                    })()}
                    
                    <TextField
                      label="หมายเลขเสื้อ (0-99)"
                      value={item.options?.customNumber || ''}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, '');
                        const num = digits ? String(Math.min(99, Number(digits))) : '';
                        const newOptions = { ...item.options, customNumber: num };
                        updateCartItem(idx, { options: newOptions });
                      }}
                      size="small"
                      placeholder="เช่น 10"
                      sx={{
                        ...inputSx,
                        '& .MuiOutlinedInput-root': {
                          ...inputSx['& .MuiOutlinedInput-root'],
                          borderRadius: '10px',
                        },
                      }}
                    />
                    
                    {(() => {
                      const patterns = product?.patterns?.filter(p => p.isActive !== false) || [];
                      if (patterns.length === 0) return null;
                      return (
                        <TextField
                          select
                          fullWidth
                          label="ลายเสื้อ"
                          value={item.options?.pattern || ''}
                          onChange={(e) => {
                            const newOptions = { ...item.options, pattern: e.target.value };
                            updateCartItem(idx, { options: newOptions });
                          }}
                          SelectProps={{ native: true }}
                          size="small"
                          sx={{
                            ...inputSx,
                            '& .MuiOutlinedInput-root': {
                              ...inputSx['& .MuiOutlinedInput-root'],
                              borderRadius: '10px',
                            },
                          }}
                        >
                          <option value="">-- เลือกลายสินค้า --</option>
                          {patterns.map(p => (
                            <option key={p.id} value={p.name}>{p.name}</option>
                          ))}
                        </TextField>
                      );
                    })()}
                    
                    <Box 
                      onClick={() => {
                        const newOptions = { ...item.options, isLongSleeve: !item.options?.isLongSleeve };
                        updateCartItem(idx, { options: newOptions });
                      }}
                      sx={{
                        p: 1.5,
                        borderRadius: '10px',
                        border: item.options?.isLongSleeve ? '2px solid #f59e0b' : '1px solid rgba(255,255,255,0.1)',
                        bgcolor: item.options?.isLongSleeve ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.02)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'all 0.2s ease',
                        '&:hover': { borderColor: item.options?.isLongSleeve ? '#f59e0b' : 'rgba(245,158,11,0.5)' },
                      }}
                    >
                      <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--foreground)' }}>
                        แขนยาว (+฿{product?.options?.longSleevePrice ?? 50})
                      </Typography>
                      <Switch
                        checked={item.options?.isLongSleeve || false}
                        color="warning"
                        size="small"
                        sx={{ pointerEvents: 'none' }}
                      />
                    </Box>
                  </Box>
                  
                  <Box sx={{ 
                    pt: 1.5, 
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}>
                    <Typography sx={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {item.quantity} × ฿{orderedPrice.toLocaleString()}
                    </Typography>
                    <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#10b981' }}>
                      ฿{(item.quantity * orderedPrice).toLocaleString()}
                    </Typography>
                  </Box>
                </Box>
              );
            })}

            <Box sx={{
              p: 2,
              borderRadius: '14px',
              border: `1px dashed ${ADMIN_THEME.border}`,
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              gap: 1.5,
              alignItems: { xs: 'stretch', sm: 'center' },
            }}>
              <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', flexShrink: 0 }}>
                เพิ่มสินค้าที่เปิดอยู่
              </Typography>
              <TextField
                select
                fullWidth
                size="small"
                value=""
                onChange={(e) => {
                  if (e.target.value) addCartProduct(e.target.value);
                }}
                SelectProps={{ native: true }}
                sx={{
                  ...inputSx,
                  '& .MuiOutlinedInput-root': {
                    ...inputSx['& .MuiOutlinedInput-root'],
                    borderRadius: '10px',
                  },
                }}
              >
                <option value="">-- เลือกสินค้าเพื่อเพิ่ม --</option>
                {activeCatalogProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — ฿{Number(p.basePrice || 0).toLocaleString()}
                  </option>
                ))}
              </TextField>
            </Box>
          </Box>
        </Box>


        {/* Status Section */}
        <Box>
          <Typography sx={{ 
            fontSize: '0.75rem', 
            fontWeight: 600, 
            color: 'var(--text-muted)', 
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            mb: 1.5,
          }}>
            สถานะ
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {ORDER_STATUSES.map(status => {
              const theme = STATUS_THEME[status] || STATUS_THEME.WAITING_PAYMENT;
              const isSelected = orderEditor.status === status;
              return (
                <Box
                  key={status}
                  onClick={() => setOrderEditor(prev => ({ ...prev, status }))}
                  sx={{
                    px: 2,
                    py: 1,
                    borderRadius: '10px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    bgcolor: isSelected ? theme.bg : 'rgba(255,255,255,0.03)',
                    border: `2px solid ${isSelected ? theme.border : 'transparent'}`,
                    '&:hover': { 
                      bgcolor: theme.bg,
                      transform: 'translateY(-1px)',
                    },
                  }}
                >
                  <Typography sx={{ 
                    fontSize: '0.8rem', 
                    fontWeight: 600, 
                    color: isSelected ? theme.text : '#64748b',
                  }}>
                    {ORDER_STATUS_LABELS[status] || status}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </Box>
      </DialogContent>

      <DialogActions
        className="border-t border-[var(--glass-border)] bg-[var(--surface)]"
        sx={{ 
          p: 3, 
          pt: 2,
          gap: 1.5,
        }}
      >
        <Box className="mx-auto flex w-full max-w-[1100px] gap-3">
          <Button 
            onClick={resetOrderEditor}
            sx={{
              ...secondaryButtonSx,
              flex: 1,
            }}
          >
            ยกเลิก
          </Button>
          <Button
            onClick={saveOrderEdits}
            disabled={orderProcessingRef === orderEditor.ref}
            sx={{
              ...gradientButtonSx,
              flex: 2,
              gap: 1,
            }}
          >
            <Save size={18} />
            {orderProcessingRef === orderEditor.ref ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );

  // Callbacks for SettingsView component
  const handleSettingsConfigChange = useCallback((newVal: ShopConfig) => {
    setSettingsLocalConfig(newVal);
    setSettingsHasChanges(true);
  }, []);

  const handleSettingsSave = useCallback(() => {
    saveFullConfig(settingsLocalConfig);
    setSettingsHasChanges(false);
  }, [settingsLocalConfig, saveFullConfig]);

  const handleSettingsReset = useCallback(() => {
    setSettingsLocalConfig(config);
    setSettingsHasChanges(false);
  }, [config]);

  const handleNewAdminEmailChange = useCallback((email: string) => {
    setNewAdminEmail(email);
  }, []);

  // Compress image client-side using canvas (returns base64 data URL)
  const compressImage = useCallback(async (file: File, maxWidth = 1920, maxHeight = 1920, quality = 0.85): Promise<{ base64: string; mime: string }> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        // Scale down if exceeds max dimensions
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas not supported')); return; }
        ctx.drawImage(img, 0, 0, width, height);
        // Use webp if supported for better compression, fallback to jpeg
        const outputMime = 'image/webp';
        const base64 = canvas.toDataURL(outputMime, quality);
        // If toDataURL returned png (webp not supported), try jpeg
        if (base64.startsWith('data:image/png') && file.type !== 'image/png') {
          resolve({ base64: canvas.toDataURL('image/jpeg', quality), mime: 'image/jpeg' });
        } else {
          resolve({ base64, mime: outputMime });
        }
        URL.revokeObjectURL(img.src);
      };
      img.onerror = () => { URL.revokeObjectURL(img.src); reject(new Error('ไม่สามารถอ่านรูปภาพได้')); };
      img.src = URL.createObjectURL(file);
    });
  }, []);

  // Handle image upload for announcements
  const handleAnnouncementImageUpload = useCallback(async (file: File): Promise<string | null> => {
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    const COMPRESS_THRESHOLD = 2 * 1024 * 1024; // 2MB — compress above this

    try {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        throw new Error('กรุณาเลือกไฟล์รูปภาพเท่านั้น');
      }

      let base64: string;
      let mime = file.type;

      if (file.size > COMPRESS_THRESHOLD) {
        // Compress large images before upload
        const compressed = await compressImage(file);
        base64 = compressed.base64;
        mime = compressed.mime;

        // Check compressed size (base64 overhead is ~33%)
        const compressedBytes = Math.ceil((base64.split(',')[1]?.length || 0) * 0.75);
        if (compressedBytes > MAX_FILE_SIZE) {
          // Try again with lower quality
          const recompressed = await compressImage(file, 1440, 1440, 0.7);
          base64 = recompressed.base64;
          mime = recompressed.mime;
          const recheckBytes = Math.ceil((base64.split(',')[1]?.length || 0) * 0.75);
          if (recheckBytes > MAX_FILE_SIZE) {
            throw new Error(`ไฟล์รูปภาพมีขนาดใหญ่เกินไป (${(recheckBytes / 1024 / 1024).toFixed(1)}MB หลังบีบอัด) สูงสุด 5MB`);
          }
        }
      } else {
        // Small file — read as-is
        const reader = new FileReader();
        base64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }

      const response = await uploadImageApi({
        base64,
        filename: file.name,
        mime,
      });

      if (!response.ok) {
        let errorMessage = `อัปโหลดล้มเหลว (HTTP ${response.status}) กรุณาลองใหม่`;
        try {
          const errData = await response.json();
          if (errData?.message) {
            errorMessage = response.status === 413
              ? `ไฟล์รูปภาพมีขนาดใหญ่เกินไป (สูงสุด 5MB) กรุณาเลือกรูปที่เล็กกว่า`
              : errData.message;
          }
        } catch {
          // ignore parse error
        }
        throw new Error(errorMessage);
      }
      let data;
      try {
        data = await response.json();
      } catch {
        throw new Error('เซิร์ฟเวอร์ตอบกลับผิดปกติ กรุณาลองใหม่');
      }
      
      if (data.status === 'error') {
        console.error('Upload failed:', data.message);
        throw new Error(data.message || 'Upload failed');
      }

      // API returns { status: 'success', data: { url, key, cid, size } }
      const imageUrl = data.data?.url || data.url;
      if (!imageUrl) {
        throw new Error('No URL returned from upload');
      }

      return imageUrl;
    } catch (error: unknown) {
      console.error('Image upload error:', error);
      throw error; // Re-throw to let caller handle
    }
  }, [compressImage]);

  const LogsView = (): JSX.Element => {
    const [logFilter, setLogFilter] = useState<string>('ALL');
    const [durableLogs, setDurableLogs] = useState<any[][]>([]);

    useEffect(() => {
      let cancelled = false;
      (async () => {
        try {
          const res = await apiFetch('/api/admin/audit?limit=200');
          const data = await res.json();
          if (cancelled || !data?.logs) return;
          const mapped = (data.logs as any[]).map((row) => [
            row.timestamp,
            row.performedBy || 'system',
            row.action,
            row.changes?.summary || `${row.entityType}/${row.entityId}`,
            row.changes,
            row.ipAddress,
          ]);
          setDurableLogs(mapped);
        } catch {
          /* keep session logs */
        }
      })();
      return () => { cancelled = true; };
    }, []);

    const mergedLogs = (() => {
      const seen = new Set<string>();
      const out: any[][] = [];
      for (const entry of [...durableLogs, ...logs]) {
        const key = `${entry[0]}|${entry[1]}|${entry[2]}|${entry[3]}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(entry);
      }
      out.sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime());
      return out;
    })();

    const filteredLogs = logFilter === 'ALL'
      ? mergedLogs
      : mergedLogs.filter(log => log[2] === logFilter);

    const getActionTheme = (action: string) => {
      switch (action) {
        case 'UPDATE_CONFIG': 
        case 'SAVE_CONFIG': return { icon: <Settings size={14} />, color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.15)' };
        case 'UPDATE_STATUS': 
        case 'BATCH_UPDATE_STATUS': return { icon: <Update size={14} />, color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' };
        case 'SEND_EMAIL': return { icon: <Email size={14} />, color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' };
        case 'SUBMIT_ORDER': return { icon: <ShoppingCart size={14} />, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' };
        case 'SYNC_FILEBASE': return { icon: <Refresh size={14} />, color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.15)' };
        case 'SYNC_SHEET': return { icon: <Description size={14} />, color: '#22c55e', bg: 'rgba(34, 197, 94, 0.15)' };
        case 'EDIT_ORDER': return { icon: <Edit size={14} />, color: '#eab308', bg: 'rgba(234, 179, 8, 0.15)' };
        case 'DELETE_ORDER': 
        case 'CANCEL_ORDER': return { icon: <Delete size={14} />, color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' };
        case 'CREATE_PRODUCT':
        case 'EDIT_PRODUCT': return { icon: <Inventory size={14} />, color: '#f472b6', bg: 'rgba(244, 114, 182, 0.15)' };
        default: return { icon: <Description size={14} />, color: 'var(--text-muted)', bg: 'rgba(100, 116, 139, 0.15)' };
      }
    };

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, height: '100%' }}>
        {/* Sticky Header */}
        <Box sx={{ 
          position: 'sticky',
          top: 0,
          zIndex: 10,
          bgcolor: ADMIN_THEME.bg,
          pb: 1.5,
          mx: { xs: -2, md: -3 },
          px: { xs: 2, md: 3 },
        }}>
          <Box sx={{ mb: 1.5 }}>
            <Typography sx={{ fontSize: { xs: '1.1rem', md: '1.5rem' }, fontWeight: 800, color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: 1 }}>
              <HistoryEdu size={24} />
              ประวัติระบบ
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {filteredLogs.length}/{mergedLogs.length} รายการ · เก็บถาวรใน audit_trail 2 ปี
            </Typography>
          </Box>

          {/* Filter Tabs - Compact */}
          <Box sx={{ 
            display: 'flex', 
            gap: 0.8, 
            overflowX: 'auto',
            pb: 0.5,
            '&::-webkit-scrollbar': { height: 3 },
            '&::-webkit-scrollbar-thumb': { bgcolor: 'var(--glass-bg)', borderRadius: 2 },
          }}>
            {[
              { value: 'ALL', label: 'ทั้งหมด' },
              { value: 'SAVE_CONFIG', label: 'ตั้งค่า' },
              { value: 'UPDATE_STATUS', label: 'สถานะ' },
              { value: 'EDIT_ORDER', label: 'แก้ไข' },
              { value: 'DELETE_ORDER', label: 'ลบ' },
              { value: 'SYNC_FILEBASE', label: 'ซิงก์' },
            ].map(filter => {
              const isActive = logFilter === filter.value;
              const count = filter.value === 'ALL' ? mergedLogs.length : mergedLogs.filter(l => l[2] === filter.value).length;
              return (
                <Box
                  key={filter.value}
                  onClick={() => setLogFilter(filter.value)}
                  sx={{
                    px: 1.5,
                    py: 0.5,
                    borderRadius: '14px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    transition: 'all 0.15s ease',
                    bgcolor: isActive ? 'rgba(139, 92, 246, 0.2)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${isActive ? 'rgba(139, 92, 246, 0.4)' : ADMIN_THEME.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    '&:active': { transform: 'scale(0.97)' },
                  }}
                >
                  <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: isActive ? '#a78bfa' : '#64748b' }}>
                    {filter.label}
                  </Typography>
                  <Box sx={{
                    px: 0.5,
                    py: 0.1,
                    borderRadius: '6px',
                    bgcolor: 'var(--glass-bg)',
                    fontSize: '0.6rem',
                    fontWeight: 700,
                    color: isActive ? '#a78bfa' : '#64748b',
                    minWidth: 16,
                    textAlign: 'center',
                  }}>
                    {count}
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>

        {/* Log Entries - Compact */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {filteredLogs.map((log, idx) => {
            const actionTheme = getActionTheme(log[2] || '');
            return (
              <Box
                key={idx}
                sx={{
                  ...glassCardSx,
                  p: 1.5,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 1.5,
                }}
              >
                {/* Action Icon */}
                <Box sx={{
                  width: 32,
                  height: 32,
                  borderRadius: '8px',
                  bgcolor: actionTheme.bg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  color: actionTheme.color,
                }}>
                  {actionTheme.icon}
                </Box>

                {/* Content */}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', mb: 0.3 }}>
                    <Typography sx={{ 
                      fontSize: '0.7rem', 
                      fontWeight: 700,
                      color: actionTheme.color,
                    }}>
                      {log[2]}
                    </Typography>
                    <Typography sx={{ 
                      fontSize: '0.65rem', 
                      color: 'var(--text-muted)',
                    }}>
                      {log[0] ? new Date(log[0]).toLocaleString('th-TH', {
                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                      }) : '-'}
                    </Typography>
                  </Box>
                  <Typography sx={{ 
                    fontSize: '0.75rem', 
                    color: 'var(--text-muted)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {log[3] || '-'}
                  </Typography>
                  <Typography sx={{ fontSize: '0.65rem', color: '#475569' }}>
                    {log[1]}
                  </Typography>
                </Box>
              </Box>
            );
          })}

          {filteredLogs.length === 0 && (
            <Box sx={{ 
              ...glassCardSx,
              textAlign: 'center', 
              py: 4,
            }}>
              <History size={40} color="#475569" style={{ marginBottom: 8 }} />
              <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                ไม่พบประวัติ
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
    );
  };

  // Loading State (keep layout mounted while fetching to avoid null returns)
  // isLoading / isAuthorized defined earlier

  // Main Render
  const pendingCount = shopOrders.filter((o) => ['WAITING_PAYMENT', 'PENDING'].includes(o.status)).length;

  // 🔐 Login Component - Show when not authenticated
  if (status === 'unauthenticated') {
    return (
      <div
        className="relative flex min-h-screen items-center justify-center p-4"
        style={{
          background: `radial-gradient(ellipse at top, rgba(99,102,241,0.15) 0%, transparent 50%),
                       radial-gradient(ellipse at bottom right, rgba(139,92,246,0.1) 0%, transparent 50%),
                       var(--background)`,
        }}
      >
        {/* Animated Background Elements */}
        <div
          className="absolute left-[10%] top-[20%] size-[300px] animate-pulse rounded-full opacity-50 blur-[40px]"
          style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)' }}
        />
        <div
          className="absolute bottom-[15%] right-[15%] size-[250px] animate-pulse rounded-full opacity-60 blur-[40px]"
          style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)' }}
        />

        {/* Login Card */}
        <div className="relative z-[1] w-full max-w-[440px]">
          <div
            className="overflow-hidden rounded-[20px] backdrop-blur-xl"
            style={{
              background: ADMIN_THEME.glass,
              border: `1px solid ${ADMIN_THEME.border}`,
              boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
              color: ADMIN_THEME.text,
            }}
          >
            {/* Header Gradient */}
            <div
              className="relative px-8 pb-10 pt-8 text-center"
              style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.2) 0%, rgba(59,130,246,0.2) 100%)' }}
            >
              {/* Logo */}
              <div className="mx-auto mb-5 flex size-20 items-center justify-center rounded-3xl bg-gradient-to-br from-violet-500 via-indigo-500 to-blue-500 shadow-[0_20px_40px_rgba(139,92,246,0.3)]">
                <Store size={40} color="#fff" />
              </div>
              <h1 className="mb-1 text-[1.6rem] font-extrabold text-[var(--foreground)]">
                PSUSCC Admin
              </h1>
              <p className="text-sm text-[var(--text-muted)]">
                ระบบจัดการร้านค้า
              </p>
            </div>

            {/* Login Form */}
            <div className="p-8 pt-6">
              <p className="mb-6 text-center text-[0.85rem] text-[var(--text-muted)]">
                เข้าสู่ระบบด้วยบัญชีที่ได้รับอนุญาต
              </p>

              {/* Google Sign In Button */}
              <Button
                onClick={() => signIn('google', { prompt: 'select_account' })}
                fullWidth
                sx={{
                  py: 1.8,
                  borderRadius: '14px',
                  background: '#fff',
                  color: '#1f2937',
                  fontWeight: 600,
                  fontSize: '1rem',
                  textTransform: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    background: '#f8fafc',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
                  },
                }}
              >
                {/* Google Icon */}
                <Box
                  component="svg"
                  viewBox="0 0 24 24"
                  sx={{ width: 24, height: 24 }}
                >
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </Box>
                เข้าสู่ระบบด้วย Google
              </Button>

              {/* Microsoft Sign In Button */}
              {availableProviders.includes('azure-ad') && <Button
                onClick={() => signIn('azure-ad')}
                fullWidth
                sx={{
                  mt: 1.5,
                  py: 1.8,
                  borderRadius: '14px',
                  background: '#2f2f2f',
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: '1rem',
                  textTransform: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    background: '#404040',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
                  },
                }}
              >
                <Box component="svg" viewBox="0 0 23 23" sx={{ width: 24, height: 24 }}>
                  <path fill="#f35325" d="M1 1h10v10H1z"/>
                  <path fill="#81bc06" d="M12 1h10v10H12z"/>
                  <path fill="#05a6f0" d="M1 12h10v10H1z"/>
                  <path fill="#ffba08" d="M12 12h10v10H12z"/>
                </Box>
                เข้าสู่ระบบด้วย Microsoft
              </Button>}

              {/* Passkey Sign In */}
              <div className="mt-3">
                <PasskeyLoginButton fullWidth variant="outlined" />
              </div>

              {/* Divider */}
              <div className="my-6 flex items-center">
                <div className="h-px flex-1 bg-[var(--glass-bg)]" />
                <span className="px-4 text-xs text-slate-600">หรือ</span>
                <div className="h-px flex-1 bg-[var(--glass-bg)]" />
              </div>

              {/* Back to Shop */}
              <Button
                onClick={() => router.push('/')}
                fullWidth
                sx={{
                  ...secondaryButtonSx,
                  py: 1.5,
                }}
              >
                กลับไปหน้าร้าน
              </Button>
            </div>

            {/* Footer */}
            <div
              className="border-t px-8 py-4"
              style={{
                borderColor: ADMIN_THEME.border,
                background: 'var(--glass-bg)',
              }}
            >
              <p className="text-center text-xs text-slate-600">
                <Lock size={16} className="mr-1 inline" />
                เฉพาะผู้ดูแลระบบที่ได้รับอนุญาตเท่านั้น
              </p>
            </div>
          </div>

          {/* Version Badge */}
          <p className="mt-6 text-center text-[0.7rem] text-slate-600">
            PSUSCC Shop Admin v{process.env.NEXT_PUBLIC_APP_VERSION || '2.1.0'}
          </p>
        </div>
      </div>
    );
  }

  // Access pending / denied — show admin shell skeleton instead of a blank dark gate
  const isAuthPending =
    isSessionLoading ||
    (status === 'authenticated' && !serverRoleChecked) ||
    (!isAuthorized && !serverRoleChecked);

  if (isAuthPending || !isAuthorized) {
    return (
      <>
        <AlertDialog />
        <AdminLoadingShell message={t.admin.checkingAccess} />
      </>
    );
  }


  const adminNavGroups: AdminNavGroup[] = [
    {
      category: t.admin.catMain,
      items: [
        { icon: <Dashboard size={18} />, label: t.admin.navDashboard, idx: 0, color: '#a5b4fc', show: true },
        { icon: <ShoppingCart size={18} />, label: t.admin.navProducts, idx: 1, color: '#fbbf24', show: Boolean(canManageProducts) },
        { icon: <Receipt size={18} />, label: t.admin.navOrders, idx: 2, color: '#34d399', badge: pendingCount, show: Boolean(canManageOrders) },
      ],
    },
    {
      category: t.admin.catManage,
      items: [
        { icon: <QrCodeScanner size={18} />, label: t.admin.navPickup, idx: 3, color: '#06b6d4', show: Boolean(canManagePickup) },
        { icon: <LocalShipping size={18} />, label: t.admin.navTracking, idx: 12, color: '#fb923c', show: Boolean(canManageTracking) },
        { icon: <Refresh size={18} />, label: t.admin.navRefunds, idx: 13, color: '#c084fc', show: Boolean(canManageRefunds) },
      ],
    },
    {
      category: t.admin.catComms,
      items: [
        { icon: <SupportAgent size={18} />, label: t.admin.navSupport, idx: 4, color: '#ec4899', show: Boolean(canManageSupport) },
        { icon: <NotificationsActive size={18} />, label: t.admin.navAnnounce, idx: 5, color: '#f472b6', show: Boolean(canManageAnnouncement) },
        { icon: <Send size={18} />, label: t.admin.navEmail, idx: 7, color: '#10b981', show: Boolean(canSendEmail) },
        { icon: <Sparkles size={18} />, label: t.admin.navEvents, idx: 14, color: '#fbbf24', show: Boolean(canManageEvents) },
        { icon: <Ticket size={18} />, label: t.admin.navPromo, idx: 15, color: '#34c759', show: Boolean(canManagePromoCodes) },
        { icon: <Radio size={18} />, label: t.admin.navLive, idx: 16, color: '#ef4444', show: true },
      ],
    },
    {
      category: t.admin.catSettings,
      items: [
        { icon: <Settings size={18} />, label: t.admin.navShopSettings, idx: 6, color: '#60a5fa', show: Boolean(canManageShop || canManageSheet || isSuperAdminUser) },
        { icon: <LocalShipping size={18} />, label: t.admin.navShipping, idx: 10, color: '#a78bfa', show: Boolean(canManageShipping) },
        { icon: <AttachMoney size={18} />, label: t.admin.navPayment, idx: 11, color: '#22d3ee', show: Boolean(canManagePayment) },
      ],
    },
    {
      category: t.admin.catAudit,
      items: [
        { icon: <Groups size={18} />, label: t.admin.navUserLogs, idx: 8, color: '#f97316', show: Boolean(isSuperAdminUser) },
        { icon: <Store size={18} />, label: t.admin.navShops, idx: 17, color: '#c084fc', show: Boolean(isSuperAdminUser) },
        { icon: <History size={18} />, label: t.admin.navSystemLogs, idx: 9, color: '#64748b', show: Boolean(isSuperAdminUser) },
      ],
    },
  ];

  const shopSwitcher = myShops.length > 0 ? (
    <UiSelect value={selectedShopId} onValueChange={setSelectedShopId}>
      <SelectTrigger className="w-full bg-muted/40">
        <SelectValue placeholder="ร้านค้า" />
      </SelectTrigger>
      <SelectContent>
        {isSuperAdminUser && (
          <SelectItem value="all">
            <span className="inline-flex items-center gap-2"><Store size={16} />ทุกร้านค้า</span>
          </SelectItem>
        )}
        {myShops.map((shop) => (
          <SelectItem key={shop.id} value={shop.id}>
            <span className="inline-flex items-center gap-2"><Store size={16} />{shop.name}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </UiSelect>
  ) : null;


  return (
    <>
      <ConfirmDialog />
      <AlertDialog />
      {isDataLoading && (
        <div className="fixed inset-x-0 top-0 z-[9999] h-[3px] overflow-hidden bg-[var(--glass-bg)]">
          <div
            className="h-full w-[40%] animate-pulse"
            style={{
              background: 'linear-gradient(90deg, transparent, #8b5cf6, #3b82f6, transparent)',
            }}
          />
          {(sectionsLoading?.config || sectionsLoading?.orders) && (
            <p className="fixed top-1.5 right-3 z-[10000] rounded bg-black/45 px-2 py-0.5 text-[0.65rem] text-[var(--text-muted)]">
              {sectionsLoading.config && sectionsLoading.orders
                ? t.admin.loadingConfigOrders
                : sectionsLoading.config
                  ? t.admin.loadingConfig
                  : t.admin.loadingOrders}
            </p>
          )}
        </div>
      )}
      <AdminShell
        title={t.admin.title}
        brand={t.admin.brand}
        roleLabel={t.admin.role}
        userName={session?.user?.name}
        userImage={session?.user?.image}
        saving={saving}
        savingLabel={t.admin.saving}
        readyLabel={t.admin.ready}
        statusTime={
          lastSavedTime
            ? lastSavedTime.toLocaleTimeString(lang === 'en' ? 'en-US' : 'th-TH', {
                hour: '2-digit',
                minute: '2-digit',
              })
            : null
        }
        navGroups={adminNavGroups}
        activeTab={activeTab}
        onNavigate={setActiveTab}
        onLogout={() => setLogoutConfirmOpen(true)}
        sidebarOpen={sidebarOpen}
        onSidebarOpenChange={setSidebarOpen}
        isDesktop={isDesktop}
        shopSwitcher={shopSwitcher}
      >
        <div className="flex min-h-0 flex-col gap-6">
          <div className="breadcrumb mb-1 flex items-center gap-1.5 px-0.5 text-xs text-muted-foreground">
            <Dashboard size={12} />
            <span>Admin</span>
            <span className="breadcrumb-separator text-[0.65rem]">›</span>
            <span className="breadcrumb-current text-foreground">
              {(
                {
                  0: t.admin.navDashboard,
                  1: t.admin.navProducts,
                  2: t.admin.navOrders,
                  3: t.admin.navPickup,
                  4: t.admin.navSupport,
                  5: t.admin.navAnnounce,
                  6: t.admin.navShopSettings,
                  7: t.admin.navEmail,
                  8: t.admin.navUserLogs,
                  9: t.admin.navSystemLogs,
                  10: t.admin.navShipping,
                  11: t.admin.navPayment,
                  12: t.admin.navTracking,
                  13: t.admin.navRefunds,
                  14: t.admin.navEvents,
                  15: t.admin.navPromo,
                  16: t.admin.navLive,
                  17: t.admin.navShops,
                } as Record<number, string>
              )[activeTab] || t.admin.navDashboard}
            </span>
          </div>

          {shopConfigLoading && (
            <div className="flex items-center justify-center gap-3 rounded-2xl border border-border bg-card/60 p-8">
              <Loader2 className="size-6 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                {lang === 'en' ? 'Loading shop data...' : 'กำลังโหลดข้อมูลร้านค้า...'}
              </p>
            </div>
          )}
          {!shopConfigLoading && activeTab === 0 && (
            <DashboardView
              shopOrders={shopOrders}
              orders={orders}
              session={session}
              isShopMode={isShopMode}
              myShops={myShops}
              selectedShopId={selectedShopId}
              lastSavedTime={lastSavedTime}
              realtimeConnected={realtimeConnected}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              setSearchTerm={setSearchTerm}
              config={config}
              sheetSyncing={sheetSyncing}
              triggerSheetSync={triggerSheetSync}
            />
          )}
          {activeTab === 1 && (
            canManageProducts ? (
              <ProductsView
                config={config}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                saveFullConfig={saveFullConfig}
                showToast={showToast}
                addLog={addLog}
                saving={saving}
                onRefresh={fetchData}
                isRefreshing={swrRefreshing}
              />
            ) : (
              <NoPermissionView permission="จัดการสินค้า" />
            )
          )}
          {activeTab === 2 && (canManageOrders ? ordersViewElement : <NoPermissionView permission="จัดการออเดอร์" />)}
          {activeTab === 3 && (canManagePickup ? <PickupView /> : <NoPermissionView permission="จัดการรับสินค้า" />)}
          {activeTab === 4 && (canManageSupport ? <SupportChatPanel selectedShopId={isShopMode ? selectedShopId : undefined} /> : <NoPermissionView permission="แชทสนับสนุน" />)}
          {activeTab === 5 && (
            canManageAnnouncement ? (
              <AnnouncementsView
                config={config}
                saveConfig={saveFullConfig}
                showToast={showToast}
                userEmail={session?.user?.email}
                onImageUpload={handleAnnouncementImageUpload}
              />
            ) : (
              <NoPermissionView permission="จัดการประกาศ" />
            )
          )}
          {activeTab === 14 && (
            canManageEvents ? (
              <EventsView
                config={config}
                saveConfig={saveFullConfig}
                showToast={showToast}
                userEmail={session?.user?.email}
                onImageUpload={handleAnnouncementImageUpload}
              />
            ) : (
              <NoPermissionView permission="จัดการอีเวนต์" />
            )
          )}
          {activeTab === 15 && (
            canManagePromoCodes ? (
              <PromoCodesView
                config={config}
                saveConfig={saveFullConfig}
                showToast={showToast}
                userEmail={session?.user?.email}
              />
            ) : (
              <NoPermissionView permission="จัดการโค้ดส่วนลด" />
            )
          )}
          {activeTab === 16 && (
            canManageLiveStream ? (
              <LiveStreamSettings
                config={config}
                saveConfig={saveFullConfig}
                showToast={showToast}
                userEmail={session?.user?.email}
              />
            ) : (
              <NoPermissionView permission="จัดการไลฟ์สด" />
            )
          )}
          {activeTab === 6 && (
            <SettingsView
              localConfig={settingsLocalConfig}
              hasChanges={settingsHasChanges}
              loading={loading}
              lastSavedTime={lastSavedTime}
              newAdminEmail={newAdminEmail}
              userEmail={session?.user?.email}
              sheetSyncing={sheetSyncing}
              isSuperAdminUser={isSuperAdminUser}
              onConfigChange={handleSettingsConfigChange}
              onSave={handleSettingsSave}
              onReset={handleSettingsReset}
              onNewAdminEmailChange={handleNewAdminEmailChange}
              showToast={showToast}
              triggerSheetSync={triggerSheetSync}
              onImageUpload={handleAnnouncementImageUpload}
            />
          )}
          {activeTab === 7 && (canSendEmail ? <EmailManagement showToast={showToast} /> : <NoPermissionView permission="ส่งอีเมล" />)}
          {activeTab === 8 && (isSuperAdminUser ? <UserLogsView showToast={showToast} /> : <NoPermissionView permission="ดูประวัติผู้ใช้" />)}
          {activeTab === 9 && (isSuperAdminUser ? <LogsView /> : <NoPermissionView permission="ดูประวัติระบบ" />)}
          {activeTab === 10 && (canManageShipping ? <ShippingSettings onSave={() => showToast('success', 'บันทึกการตั้งค่าจัดส่งแล้ว')} /> : <NoPermissionView permission="ตั้งค่าจัดส่ง" />)}
          {activeTab === 11 && (canManagePayment ? <PaymentSettings onSave={() => showToast('success', 'บันทึกการตั้งค่าชำระเงินแล้ว')} /> : <NoPermissionView permission="ตั้งค่าชำระเงิน" />)}
          {activeTab === 12 && (canManageTracking ? <TrackingManagement showToast={showToast} selectedShopId={isShopMode ? selectedShopId : undefined} /> : <NoPermissionView permission="ติดตามพัสดุ" />)}
          {activeTab === 13 && (canManageRefunds ? <RefundManagement showToast={showToast} selectedShopId={isShopMode ? selectedShopId : undefined} /> : <NoPermissionView permission="จัดการคืนเงิน" />)}
          {activeTab === 17 && (isSuperAdminUser ? <ShopManagement showToast={showToast} isSuperAdmin={isSuperAdminUser} userEmail={session?.user?.email || ''} /> : <NoPermissionView permission="จัดการร้านค้าย่อย" />)}
        </div>
      </AdminShell>

      {/* Slip Viewer Dialog */}
      <UiDialog open={slipViewerOpen} onOpenChange={setSlipViewerOpen}>
        <UiDialogContent className="max-w-2xl border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl sm:max-w-2xl">
          <UiDialogHeader className="border-b border-[var(--glass-border)] pb-4">
            <UiDialogTitle className="flex items-center gap-2 text-base font-bold">
              <ImageIcon color="#10b981" />
              สลิปการโอนเงิน #{slipViewerData?.ref ?? '-'}
            </UiDialogTitle>
          </UiDialogHeader>
          <div className="py-2">
          {(slipViewerData?.slip?.imageUrl || slipViewerData?.slip?.base64) ? (
            <div className="text-center">
              <img
                src={slipViewerData.slip.imageUrl 
                  ? slipViewerData.slip.imageUrl
                  : slipViewerData.slip.base64?.startsWith('data:') 
                    ? slipViewerData.slip.base64 
                    : `data:${slipViewerData.slip.mime || 'image/png'};base64,${slipViewerData.slip.base64}`}
                alt="สลิปการโอนเงิน"
                onError={(e) => {
                  console.error('[SlipViewer] Image load error:', slipViewerData.slip?.imageUrl);
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
                className="mx-auto max-h-[70vh] max-w-full rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.3)]"
              />
              {slipViewerData.slip.imageUrl && (
                <UiButton variant="outline" size="sm" className="mt-4" asChild>
                  <a href={slipViewerData.slip.imageUrl} target="_blank" rel="noreferrer">
                    เปิดรูปภาพในแท็บใหม่
                  </a>
                </UiButton>
              )}
              {slipViewerData.slip.uploadedAt && (
                <p className="mt-4 text-sm text-[var(--text-muted)]">
                  อัพโหลดเมื่อ: {new Date(slipViewerData.slip.uploadedAt).toLocaleString('th-TH')}
                </p>
              )}
              {slipViewerData.slip.slipData && (
                <div className="mt-4 rounded-xl bg-emerald-500/10 p-4 text-left">
                  <p className="mb-2 flex items-center gap-1 font-semibold text-emerald-500"><ClipboardList size={16} /> ข้อมูลจากสลิป</p>
                  {slipViewerData.slip.slipData.amount && (
                    <p className="flex items-center gap-1 text-sm text-[var(--foreground)]"><Banknote size={14} /> จำนวนเงิน: ฿{Number(slipViewerData.slip.slipData.amount).toLocaleString()}</p>
                  )}
                  {(slipViewerData.slip.slipData.senderName || slipViewerData.slip.slipData.senderFullName || slipViewerData.slip.slipData.senderDisplayName) && (
                    <div className="mt-2">
                      <p className="flex items-center gap-1 text-sm text-[var(--text-muted)]">
                        <UserIcon size={13} /> ผู้โอน: {slipViewerData.slip.slipData.senderFullName || slipViewerData.slip.slipData.senderName || slipViewerData.slip.slipData.senderDisplayName}
                      </p>
                      {slipViewerData.slip.slipData.senderDisplayName && slipViewerData.slip.slipData.senderFullName && (
                        <p className="ml-6 text-xs text-[var(--text-muted)]">
                          ({slipViewerData.slip.slipData.senderDisplayName})
                        </p>
                      )}
                      {slipViewerData.slip.slipData.senderBank && (
                        <p className="ml-6 flex items-center gap-1 text-xs text-[var(--text-muted)]">
                          <Building2 size={12} /> {slipViewerData.slip.slipData.senderBank}
                        </p>
                      )}
                    </div>
                  )}
                  {slipViewerData.slip.slipData.transRef && (
                    <p className="mt-2 flex items-center gap-1 text-sm text-[var(--text-muted)]"><Hash size={13} /> เลขอ้างอิง: {slipViewerData.slip.slipData.transRef}</p>
                  )}
                  {slipViewerData.slip.slipData.transDate && slipViewerData.slip.slipData.transTime && (
                    <p className="ml-6 flex items-center gap-1 text-xs text-[var(--text-muted)]">
                      <CalendarDays size={12} /> {slipViewerData.slip.slipData.transDate} {slipViewerData.slip.slipData.transTime}
                    </p>
                  )}
                  {slipViewerData.slip.slipData.receiverName && (
                    <div className="mt-2 border-t border-dashed border-white/10 pt-2">
                      <p className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                        <Archive size={12} /> ผู้รับ: {slipViewerData.slip.slipData.receiverName}
                        {slipViewerData.slip.slipData.receiverBank && ` (${slipViewerData.slip.slipData.receiverBank})`}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="py-8 text-center">
              <Warning size={48} color="#f59e0b" className="mx-auto mb-4" />
              <p className="text-[var(--text-muted)]">ไม่พบข้อมูลรูปภาพสลิป</p>
              {slipViewerData?.ref && (
                <UiButton variant="outline" size="sm" className="mt-4" asChild>
                  <a href={`/api/slip/${slipViewerData.ref}`} target="_blank" rel="noreferrer">
                    เปิดหน้าดูสลิป
                  </a>
                </UiButton>
              )}
            </div>
          )}
          </div>
        </UiDialogContent>
      </UiDialog>

      {/* Batch Status Update Dialog */}
      <UiDialog open={batchStatusDialogOpen} onOpenChange={setBatchStatusDialogOpen}>
        <UiDialogContent className="border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl sm:max-w-md">
          <UiDialogHeader className="border-b border-[var(--glass-border)] pb-4">
            <UiDialogTitle className="flex items-center gap-2 text-base font-bold">
              <Update color="#6366f1" />
              อัปเดตสถานะพร้อมกัน
            </UiDialogTitle>
          </UiDialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <p className="mb-3 text-[var(--text-muted)]">
                เลือก {selectedOrders.size} ออเดอร์เพื่ออัปเดตสถานะ
              </p>
              <div className="flex flex-wrap gap-2">
                {Array.from(selectedOrders).map(ref => (
                  <Chip
                    key={ref}
                    label={`#${ref}`}
                    size="small"
                    sx={{
                      bgcolor: 'rgba(99,102,241,0.15)',
                      color: '#a5b4fc',
                      fontFamily: 'monospace',
                    }}
                  />
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 font-semibold text-[var(--foreground)]">สถานะใหม่</p>
              <Select
                value={batchNewStatus}
                onChange={(e) => setBatchNewStatus(e.target.value)}
                fullWidth
                MenuProps={{
                  PaperProps: {
                    sx: {
                      bgcolor: 'var(--card-bg, #1e293b)',
                      color: 'var(--foreground, #f8fafc)',
                      border: '1px solid var(--glass-border, rgba(255,255,255,0.15))',
                      boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)',
                      backgroundImage: 'none',
                      '& .MuiMenuItem-root': {
                        fontSize: '0.82rem',
                        fontWeight: 500,
                        color: 'var(--foreground, #f8fafc)',
                        py: 1,
                        px: 1.5,
                        '&:hover': {
                          bgcolor: 'rgba(255,255,255,0.08)',
                        },
                        '&.Mui-selected': {
                          bgcolor: 'rgba(99,102,241,0.25)',
                          color: '#a5b4fc',
                          fontWeight: 700,
                          '&:hover': {
                            bgcolor: 'rgba(99,102,241,0.35)',
                          },
                        },
                      },
                    },
                  },
                }}
                sx={{
                  bgcolor: 'rgba(255,255,255,0.03)',
                  borderRadius: '10px',
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: ADMIN_THEME.border,
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'var(--glass-border)',
                  },
                  '& .MuiSelect-select': {
                    color: 'var(--foreground)',
                  },
                }}
              >
                {ORDER_STATUSES.map(status => (
                  <MenuItem key={status} value={status}>
                    {ORDER_STATUS_LABELS[status] || status}
                  </MenuItem>
                ))}
              </Select>
            </div>
          </div>
          <UiDialogFooter className="border-t border-[var(--glass-border)] pt-4">
            <UiButton variant="outline" onClick={() => setBatchStatusDialogOpen(false)}>
              ยกเลิก
            </UiButton>
            <UiButton
              onClick={handleBatchUpdateStatus}
              disabled={batchUpdating || !batchNewStatus}
              className="bg-gradient-to-r from-violet-500 to-indigo-500 text-white hover:from-violet-600 hover:to-indigo-600"
            >
              {batchUpdating ? (
                <>
                  <Loader2 className="animate-spin" />
                  กำลังอัปเดต...
                </>
              ) : (
                `อัปเดต ${selectedOrders.size} รายการ`
              )}
            </UiButton>
          </UiDialogFooter>
        </UiDialogContent>
      </UiDialog>

      {/* Order Editor Dialog - rendered at root level */}
      {orderEditorDialogElement}
      
      {/* Pickup Confirm Dialog */}
      {pickupConfirmDialog}

      {/* Logout Confirmation Dialog */}
      <UiDialog open={logoutConfirmOpen} onOpenChange={setLogoutConfirmOpen}>
        <UiDialogContent className="min-w-[320px] border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl sm:max-w-sm">
          <UiDialogHeader>
            <UiDialogTitle className="flex items-center gap-2">
              <Warning size={22} color="#f59e0b" />
              ยืนยันการออกจากระบบ
            </UiDialogTitle>
          </UiDialogHeader>
          <p className="text-sm text-[var(--text-muted)]">
            คุณต้องการออกจากระบบใช่หรือไม่?
          </p>
          <UiDialogFooter>
            <UiButton variant="outline" onClick={() => setLogoutConfirmOpen(false)}>
              ยกเลิก
            </UiButton>
            <UiButton variant="destructive" onClick={() => signOutUser()}>
              ออกจากระบบ
            </UiButton>
          </UiDialogFooter>
        </UiDialogContent>
      </UiDialog>
    </>
  );
}

// ============== SUB-COMPONENTS ==============

