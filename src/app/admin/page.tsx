'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { JSX } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Swal from 'sweetalert2';
import { useRealtimeAdminOrders } from '@/hooks/useRealtimeOrders';
import { 
  useAdminData, 
  useUpdateOrderStatus, 
  useUpdateConfig, 
  useBatchUpdateStatus,
  useDeleteOrder,
  useUpdateOrder,
  useSyncSheet,
  updateOrderInCache,
  removeOrderFromCache,
  invalidateAdminData,
  saveAdminCacheSWR,
  loadAdminCacheSWR,
} from '@/hooks/useAdminData';
import { useAdminDataSWR, useOptimisticOrderUpdate, useOptimisticBatchUpdate } from '@/hooks/useAdminDataSWR';

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
} from '@mui/material';

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
} from 'lucide-react';

import { isAdmin, isSuperAdmin, setDynamicAdminEmails, SUPER_ADMIN_EMAIL, Product, ShopConfig, SIZES, AdminPermissions, DEFAULT_ADMIN_PERMISSIONS, DEFAULT_NAME_VALIDATION, type NameValidationConfig, DEFAULT_SHIRT_NAME, type ShirtNameConfig } from '@/lib/config';
import { deleteOrderAdmin, saveShopConfig, syncOrdersSheet, updateOrderAdmin, updateOrderStatusAPI } from '@/lib/api-client';
import SupportChatPanel from '@/components/admin/SupportChatPanel';
import EmailManagement from '@/components/admin/EmailManagement';
import UserLogsView from '@/components/admin/UserLogsView';
import ShippingSettings from '@/components/admin/ShippingSettings';
import { SHIPPING_PROVIDERS, type ShippingProvider } from '@/lib/shipping';
import PaymentSettings from '@/components/admin/PaymentSettings';
import TrackingManagement from '@/components/admin/TrackingManagement';
import RefundManagement from '@/components/admin/RefundManagement';

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
  };
}

interface AdminOrder {
  ref: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
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
}

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}

// ============== CONSTANTS ==============
const DEFAULT_CONFIG: ShopConfig = {
  isOpen: true,
  closeDate: '',
  openDate: '',
  closedMessage: '',
  paymentEnabled: true,
  paymentDisabledMessage: '',
  announcements: [],
  products: [],
  sheetId: '',
  sheetUrl: '',
  vendorSheetId: '',
  vendorSheetUrl: '',
  bankAccount: { bankName: '', accountName: '', accountNumber: '' },
  announcementHistory: [],
};

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
}

const ADMIN_CACHE_KEY = 'psusccshop-admin-cache';
let ADMIN_CACHE_DISABLED = false;

const normalizeStatusKey = (status?: string): string => (status || 'PENDING').toString().trim().toUpperCase();

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
    } catch (err: any) {
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
 *  Parsing that as-is can differ across browsers (Chrome = local, Safari = UTC).
 *  We explicitly construct a local Date to avoid the discrepancy. */
function localDatetimeToIso(local: string): string | undefined {
  if (!local) return undefined;
  // Parse "YYYY-MM-DDTHH:MM" or "YYYY-MM-DDTHH:MM:SS" manually
  const parts = local.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!parts) return undefined;
  const d = new Date(
    Number(parts[1]),     // year
    Number(parts[2]) - 1, // month (0-based)
    Number(parts[3]),     // day
    Number(parts[4]),     // hours
    Number(parts[5]),     // minutes
    Number(parts[6] || 0) // seconds
  );
  if (isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

// ============== NEW MODERN THEME ==============
const ADMIN_THEME = {
  // Base colors
  bg: 'var(--background)',
  bgCard: 'var(--glass-bg)',
  bgSidebar: 'var(--surface)',
  bgHeader: 'var(--glass-strong)',
  
  // Text colors
  text: 'var(--foreground)',
  textSecondary: 'var(--text-muted)',
  muted: 'var(--text-muted)',
  
  // Borders
  border: 'var(--glass-border)',
  borderActive: 'rgba(99,102,241,0.5)',
  
  // Glass effects
  glass: 'var(--glass-bg)',
  glassSoft: 'var(--glass-bg)',
  glassHover: 'var(--glass-strong)',
  
  // Gradients
  gradient: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
  gradientAlt: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
  gradientWarm: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
  gradientCool: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
  
  // Accent colors
  primary: '#6366f1',
  primaryLight: '#a5b4fc',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#06b6d4',
};

// Status color mapping
const STATUS_THEME: Record<string, { bg: string; text: string; border: string }> = {
  WAITING_PAYMENT: { bg: 'rgba(245,158,11,0.15)', text: '#fbbf24', border: 'rgba(245,158,11,0.4)' },
  PENDING: { bg: 'rgba(245,158,11,0.15)', text: '#fbbf24', border: 'rgba(245,158,11,0.4)' },
  PAID: { bg: 'rgba(59,130,246,0.15)', text: '#60a5fa', border: 'rgba(59,130,246,0.4)' },
  READY: { bg: 'rgba(16,185,129,0.15)', text: '#34d399', border: 'rgba(16,185,129,0.4)' },
  SHIPPED: { bg: 'rgba(6,182,212,0.15)', text: '#22d3ee', border: 'rgba(6,182,212,0.4)' },
  COMPLETED: { bg: 'rgba(34,197,94,0.15)', text: '#4ade80', border: 'rgba(34,197,94,0.4)' },
  CANCELLED: { bg: 'rgba(239,68,68,0.15)', text: '#f87171', border: 'rgba(239,68,68,0.4)' },
  REFUND_REQUESTED: { bg: 'rgba(124,58,237,0.15)', text: '#a78bfa', border: 'rgba(124,58,237,0.4)' },
  REFUNDED: { bg: 'rgba(168,85,247,0.15)', text: '#c084fc', border: 'rgba(168,85,247,0.4)' },
};

const glassCardSx = {
  background: ADMIN_THEME.glass,
  border: `1px solid ${ADMIN_THEME.border}`,
  borderRadius: '20px',
  boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
  backdropFilter: 'blur(20px)',
  color: ADMIN_THEME.text,
  overflow: 'hidden',
};

const inputSx = {
  '& .MuiOutlinedInput-root': {
    backgroundColor: ADMIN_THEME.glassSoft,
    borderRadius: '12px',
    color: ADMIN_THEME.text,
    '& fieldset': { borderColor: ADMIN_THEME.border },
    '&:hover fieldset': { borderColor: 'rgba(99,102,241,0.4)' },
    '&.Mui-focused fieldset': { borderColor: '#6366f1', boxShadow: '0 0 0 3px rgba(99,102,241,0.15)' },
  },
  '& .MuiInputLabel-root': { color: ADMIN_THEME.textSecondary },
  '& .MuiFormHelperText-root': { color: ADMIN_THEME.muted },
  '& .MuiSelect-icon': { color: ADMIN_THEME.textSecondary },
};

const gradientButtonSx = {
  background: ADMIN_THEME.gradient,
  color: '#fff',
  borderRadius: '12px',
  fontWeight: 700,
  textTransform: 'none',
  px: 3,
  py: 1.2,
  boxShadow: '0 4px 14px rgba(99,102,241,0.35)',
  '&:hover': { 
    background: 'linear-gradient(135deg, #5458e9 0%, #7c3aed 100%)', 
    boxShadow: '0 6px 20px rgba(99,102,241,0.45)',
    transform: 'translateY(-1px)',
  },
  transition: 'all 0.2s ease',
};

const secondaryButtonSx = {
  bgcolor: 'var(--glass-bg)',
  color: ADMIN_THEME.textSecondary,
  borderRadius: '12px',
  border: `1px solid ${ADMIN_THEME.border}`,
  fontWeight: 600,
  textTransform: 'none',
  px: 2.5,
  py: 1,
  '&:hover': { 
    bgcolor: 'var(--glass-bg)',
    borderColor: 'var(--glass-border)',
  },
};

const tableSx = {
  '& th, & td': { borderColor: 'var(--glass-border)', color: ADMIN_THEME.text },
  '& thead th': { backgroundColor: 'var(--glass-bg)', color: ADMIN_THEME.text },
};

// ============== SETTINGS COMPONENTS (Stable - defined outside to prevent remount) ==============
const SettingSection = ({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) => (
  <Box sx={{
    ...glassCardSx,
    overflow: 'hidden',
  }}>
    <Box sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 2,
      p: 2.5,
      borderBottom: `1px solid ${ADMIN_THEME.border}`,
      background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.05) 0%, rgba(59, 130, 246, 0.05) 100%)',
    }}>
      <Box sx={{
        width: 40,
        height: 40,
        borderRadius: '12px',
        background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
      }}>
        {icon}
      </Box>
      <Typography sx={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--foreground)' }}>
        {title}
      </Typography>
    </Box>
    <Box sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
      {children}
    </Box>
  </Box>
);

const SettingToggleRow = ({ label, description, checked, onChange }: { label: string; description?: string; checked: boolean; onChange: (checked: boolean) => void }) => (
  <Box sx={{ 
    display: 'flex', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    py: 0.5,
  }}>
    <Box>
      <Typography sx={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--foreground)' }}>{label}</Typography>
      {description && (
        <Typography sx={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{description}</Typography>
      )}
    </Box>
    <Switch
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      sx={{
        '& .MuiSwitch-switchBase.Mui-checked': {
          color: '#10b981',
        },
        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
          backgroundColor: '#10b981',
        },
      }}
    />
  </Box>
);

// ============== UTILITIES ==============
// sanitizeInput: ตัด whitespace หัว-ท้าย แต่เก็บ space ตรงกลาง
const sanitizeInput = (str: string) => str.replace(/^\s+|\s+$/g, '').slice(0, 500);
const validatePrice = (price: number) => price >= 0 && price <= 999999;

// Convert date-only "2026-01-14" to datetime-local "2026-01-14T00:00" format
const toDateTimeLocal = (dateStr: string | undefined): string => {
  if (!dateStr) return '';
  // Already in datetime-local format
  if (dateStr.includes('T')) return dateStr;
  // Date-only format - add time
  return `${dateStr}T00:00`;
};

// Accept both Sheet ID or full URL and normalize to id + url
const extractSheetInfo = (input: string): { sheetId: string; sheetUrl: string } => {
  const value = (input || '').trim();
  if (!value) return { sheetId: '', sheetUrl: '' };
  const match = value.match(/\/d\/([a-zA-Z0-9-_]+)/);
  const sheetId = match?.[1] || value;
  const sheetUrl = sheetId ? `https://docs.google.com/spreadsheets/d/${sheetId}` : '';
  return { sheetId, sheetUrl };
};

// ============== SETTINGS VIEW COMPONENT (Stable - React.memo outside AdminPage) ==============
interface SettingsViewProps {
  localConfig: ShopConfig;
  hasChanges: boolean;
  loading: boolean;
  lastSavedTime: Date | null;
  newAdminEmail: string;
  userEmail: string | null | undefined;
  sheetSyncing: boolean;
  onConfigChange: (newVal: ShopConfig) => void;
  onSave: () => void;
  onReset: () => void;
  onNewAdminEmailChange: (email: string) => void;
  showToast: (type: 'success' | 'error' | 'info' | 'warning', message: string) => void;
  triggerSheetSync: (action: 'sync' | 'create') => void;
  onImageUpload?: (file: File) => Promise<string | null>;
}

import React from 'react';

const SettingsView = React.memo(function SettingsView({
  localConfig,
  hasChanges,
  loading,
  lastSavedTime,
  newAdminEmail,
  userEmail,
  sheetSyncing,
  onConfigChange,
  onSave,
  onReset,
  onNewAdminEmailChange,
  showToast,
  triggerSheetSync,
}: SettingsViewProps) {
  const isSuperAdminUser = isSuperAdmin(userEmail ?? null);

  // Get admin permissions
  const adminPerms = localConfig.adminPermissions?.[userEmail?.toLowerCase() ?? ''] ?? {
    canManageShop: false,
    canManageSheet: false,
    canManageAnnouncement: true, // Default: admins can manage announcements
    canManageOrders: true,
    canManageProducts: true,
    canManagePickup: false,
  };

  // Super admin has all permissions
  const canManageShop = isSuperAdminUser || adminPerms.canManageShop;
  const canManageSheet = isSuperAdminUser || adminPerms.canManageSheet;
  const canManageAnnouncement = isSuperAdminUser || adminPerms.canManageAnnouncement;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 700 }}>
      {/* Header with Save Button */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography sx={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: 1 }}>
            <Settings size={24} />
            ตั้งค่าร้านค้า
          </Typography>
          <Typography sx={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {isSuperAdminUser ? 'จัดการการตั้งค่าทั้งหมดของร้าน' : 'จัดการประกาศและการตั้งค่าที่ได้รับอนุญาต'}
          </Typography>
        </Box>
        
        <Box sx={{ display: 'flex', gap: 1, opacity: hasChanges ? 1 : 0, pointerEvents: hasChanges ? 'auto' : 'none', transition: 'opacity 0.2s' }}>
          <Button
            variant="outlined"
            onClick={onReset}
            sx={{
              borderColor: ADMIN_THEME.border,
              color: ADMIN_THEME.muted,
              borderRadius: '10px',
              textTransform: 'none',
              '&:hover': { borderColor: '#ef4444', color: '#ef4444' },
            }}
          >
            ยกเลิก
          </Button>
          <Button
            variant="contained"
            onClick={onSave}
            startIcon={<Save />}
            sx={{
              background: ADMIN_THEME.gradient,
              borderRadius: '10px',
              textTransform: 'none',
              fontWeight: 700,
              boxShadow: '0 4px 15px rgba(139, 92, 246, 0.3)',
              animation: hasChanges ? 'pulse 2s infinite' : 'none',
              '@keyframes pulse': {
                '0%, 100%': { boxShadow: '0 4px 15px rgba(139, 92, 246, 0.3)' },
                '50%': { boxShadow: '0 4px 25px rgba(139, 92, 246, 0.5)' },
              },
            }}
          >
            บันทึกการตั้งค่า
          </Button>
        </Box>
      </Box>

      {/* Unsaved Changes Warning - use opacity instead of conditional render to prevent layout shift */}
      <Box sx={{
        p: 2,
        borderRadius: '12px',
        bgcolor: 'rgba(251, 191, 36, 0.1)',
        border: '1px solid rgba(251, 191, 36, 0.3)',
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        opacity: hasChanges ? 1 : 0,
        maxHeight: hasChanges ? 100 : 0,
        overflow: 'hidden',
        transition: 'opacity 0.2s, max-height 0.2s',
        mb: hasChanges ? 0 : -3,
      }}>
        <Warning size={24} color="#fbbf24" />
        <Typography sx={{ fontSize: '0.9rem', color: '#fbbf24' }}>
          มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก กดปุ่ม "บันทึกการตั้งค่า" เพื่อยืนยัน
        </Typography>
      </Box>

      {/* Shop Status - Only for Super Admin or admins with permission */}
      {canManageShop && (
        <SettingSection icon={<Store size={20} />} title="สถานะร้านค้า">
          <SettingToggleRow
            label="เปิดรับออเดอร์"
            description={localConfig.isOpen ? 'ร้านเปิดให้บริการอยู่' : 'ปิดรับออเดอร์ชั่วคราว'}
            checked={localConfig.isOpen}
            onChange={(checked) => onConfigChange({...localConfig, isOpen: checked})}
          />
          {!localConfig.isOpen && (
            <Box sx={{ 
              mt: 1, 
              p: 2, 
              borderRadius: '12px', 
              bgcolor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}>
              <Box>
                <Typography sx={{ fontSize: '0.85rem', color: '#f87171', mb: 1 }}>
                  <CalendarToday size={18} style={{ marginRight: 8, verticalAlign: 'middle' }} />
                  กำหนดวันเปิดร้านใหม่ (ถ้ามี)
                </Typography>
                <TextField
                  type="datetime-local"
                  value={localConfig.openDate || ''}
                  onChange={(e) => onConfigChange({...localConfig, openDate: e.target.value})}
                  placeholder="เช่น 2025-01-20T09:00"
                  fullWidth
                  sx={{
                    ...inputSx,
                    '& .MuiOutlinedInput-root': {
                      ...inputSx['& .MuiOutlinedInput-root'],
                      borderRadius: '10px',
                    },
                  }}
                />
              </Box>
              <Box>
                <Typography sx={{ fontSize: '0.85rem', color: '#f87171', mb: 1 }}>
                  <Warning size={18} style={{ marginRight: 8, verticalAlign: 'middle' }} />
                  ข้อความแจ้งผู้ใช้ (ไม่บังคับ)
                </Typography>
                <TextField
                  placeholder="เช่น: ร้านปิดปรับปรุงถึงวันที่ 20 ม.ค."
                  value={localConfig.closedMessage || ''}
                  onChange={(e) => onConfigChange({...localConfig, closedMessage: e.target.value})}
                  fullWidth
                  multiline
                  rows={2}
                  sx={{
                    ...inputSx,
                    '& .MuiOutlinedInput-root': {
                      ...inputSx['& .MuiOutlinedInput-root'],
                      borderRadius: '10px',
                    },
                  }}
                />
              </Box>
            </Box>
          )}
          
          {/* Close Date - กำหนดวันปิดรับออเดอร์ */}
          {localConfig.isOpen && (
            <Box sx={{ 
              mt: 1, 
              p: 2, 
              borderRadius: '12px', 
              bgcolor: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.2)',
            }}>
              <Typography sx={{ fontSize: '0.85rem', color: '#fbbf24', mb: 1 }}>
                <CalendarToday size={18} style={{ marginRight: 8, verticalAlign: 'middle' }} />
                กำหนดวันปิดรับออเดอร์ (ไม่บังคับ)
              </Typography>
              <TextField
                type="datetime-local"
                value={localConfig.closeDate || ''}
                onChange={(e) => onConfigChange({...localConfig, closeDate: e.target.value})}
                placeholder="เช่น 2025-01-25T23:59"
                fullWidth
                sx={{
                  ...inputSx,
                  '& .MuiOutlinedInput-root': {
                    ...inputSx['& .MuiOutlinedInput-root'],
                    borderRadius: '10px',
                  },
                }}
              />
              <Typography sx={{ fontSize: '0.75rem', color: 'var(--text-muted)', mt: 1 }}>
                เมื่อถึงวันนี้ ระบบจะแสดงสถานะ "หมดเขตสั่งซื้อ" โดยอัตโนมัติ
              </Typography>
            </Box>
          )}
        </SettingSection>
      )}

      {/* Payment System Toggle - Only for Super Admin or admins with shop permission */}
      {canManageShop && (
        <SettingSection icon={<AttachMoney size={20} />} title="ระบบชำระเงิน">
          <SettingToggleRow
            label="เปิดรับชำระเงิน"
            description={localConfig.paymentEnabled !== false ? 'ผู้ใช้สามารถอัพโหลดสลิปได้' : 'ปิดรับชำระเงินชั่วคราว'}
            checked={localConfig.paymentEnabled !== false}
            onChange={(checked) => onConfigChange({...localConfig, paymentEnabled: checked})}
          />
          {localConfig.paymentEnabled === false && (
            <Box sx={{ 
              mt: 1, 
              p: 2, 
              borderRadius: '12px', 
              bgcolor: 'rgba(249, 115, 22, 0.1)',
              border: '1px solid rgba(249, 115, 22, 0.2)',
            }}>
              <Typography sx={{ fontSize: '0.85rem', color: '#fb923c', mb: 1.5 }}>
                <Warning size={20} style={{ marginRight: 8, verticalAlign: 'middle' }} />
                ข้อความแจ้งผู้ใช้ (ไม่บังคับ)
              </Typography>
              <TextField
                placeholder="เช่น: ระบบปิดปรับปรุงถึง 18:00 น."
                value={localConfig.paymentDisabledMessage || ''}
                onChange={(e) => onConfigChange({...localConfig, paymentDisabledMessage: e.target.value})}
                fullWidth
                multiline
                rows={2}
                sx={{
                  ...inputSx,
                  '& .MuiOutlinedInput-root': {
                    ...inputSx['& .MuiOutlinedInput-root'],
                    borderRadius: '10px',
                  },
                }}
              />
            </Box>
          )}
        </SettingSection>
      )}

      {/* Name Validation Settings */}
      {canManageShop && (
        <SettingSection icon={<Person size={20} />} title="ตั้งค่าชื่อ-นามสกุล">
          {(() => {
            const nv = { ...DEFAULT_NAME_VALIDATION, ...localConfig.nameValidation };
            const updateNV = (patch: Partial<NameValidationConfig>) => {
              onConfigChange({ ...localConfig, nameValidation: { ...nv, ...patch } });
            };
            return (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {/* Length settings */}
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                  <TextField
                    type="number"
                    label="ความยาวขั้นต่ำ"
                    value={nv.minLength}
                    onChange={e => updateNV({ minLength: Math.max(1, Number(e.target.value) || 1) })}
                    inputProps={{ min: 1, max: 200 }}
                    size="small"
                    sx={{
                      flex: 1,
                      ...inputSx,
                      '& .MuiOutlinedInput-root': { ...inputSx['& .MuiOutlinedInput-root'], borderRadius: '10px' },
                    }}
                  />
                  <TextField
                    type="number"
                    label="ความยาวสูงสุด"
                    value={nv.maxLength}
                    onChange={e => updateNV({ maxLength: Math.max(nv.minLength, Number(e.target.value) || 10) })}
                    inputProps={{ min: nv.minLength, max: 500 }}
                    size="small"
                    sx={{
                      flex: 1,
                      ...inputSx,
                      '& .MuiOutlinedInput-root': { ...inputSx['& .MuiOutlinedInput-root'], borderRadius: '10px' },
                    }}
                  />
                </Box>

                {/* Language toggles */}
                <Box sx={{
                  p: 2,
                  borderRadius: '12px',
                  bgcolor: 'rgba(99,102,241,0.08)',
                  border: '1px solid rgba(99,102,241,0.2)',
                }}>
                  <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#818cf8', mb: 1.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Groups size={14} /> ภาษาที่อนุญาต
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {[
                      { key: 'allowThai' as const, label: 'ภาษาไทย', color: '#0071e3' },
                      { key: 'allowEnglish' as const, label: 'English', color: '#10b981' },
                    ].map(lang => (
                      <Box
                        key={lang.key}
                        onClick={() => {
                          // Don't allow disabling all languages
                          if (nv[lang.key] && !Object.entries(nv).some(([k, v]) => k !== lang.key && k.startsWith('allow') && k !== 'allowSpecialChars' && v === true)) return;
                          updateNV({ [lang.key]: !nv[lang.key] });
                        }}
                        sx={{
                          px: 2,
                          py: 1,
                          borderRadius: '10px',
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          bgcolor: nv[lang.key] ? `${lang.color}15` : 'rgba(255,255,255,0.05)',
                          color: nv[lang.key] ? lang.color : '#64748b',
                          border: `1.5px solid ${nv[lang.key] ? lang.color : 'transparent'}`,
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            bgcolor: nv[lang.key] ? `${lang.color}25` : 'rgba(255,255,255,0.1)',
                          },
                        }}
                      >
                        {lang.label}
                      </Box>
                    ))}
                  </Box>
                </Box>

                {/* Special characters */}
                <SettingToggleRow
                  label="อนุญาตอักษรพิเศษ"
                  description={nv.allowSpecialChars ? `ตัวอักษรที่อนุญาต: ${nv.allowedSpecialChars}` : 'ปิดใช้งาน'}
                  checked={nv.allowSpecialChars}
                  onChange={checked => updateNV({ allowSpecialChars: checked })}
                />
                {nv.allowSpecialChars && (
                  <TextField
                    label="อักษรพิเศษที่อนุญาต"
                    value={nv.allowedSpecialChars}
                    onChange={e => updateNV({ allowedSpecialChars: e.target.value })}
                    placeholder=".-'"
                    helperText="กรอกตัวอักษรพิเศษที่ต้องการอนุญาต เช่น . - ' ( )"
                    size="small"
                    sx={{
                      ...inputSx,
                      '& .MuiOutlinedInput-root': { ...inputSx['& .MuiOutlinedInput-root'], borderRadius: '10px' },
                    }}
                  />
                )}

                {/* Preview */}
                <Box sx={{
                  p: 1.5,
                  borderRadius: '10px',
                  bgcolor: 'rgba(16,185,129,0.08)',
                  border: '1px solid rgba(16,185,129,0.2)',
                }}>
                  <Typography sx={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600, mb: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <CheckCircle size={14} /> ตัวอย่างที่ระบบจะยอมรับ:
                  </Typography>
                  <Typography sx={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {[
                      nv.allowThai && 'สมชาย ใจดี',
                      nv.allowEnglish && 'John Smith',
                      (nv.allowThai && nv.allowEnglish) && 'สมชาย Smith',
                      nv.allowSpecialChars && (nv.allowThai ? `สมชาย ใจ${nv.allowedSpecialChars[0] || '.'}ดี` : `John O${nv.allowedSpecialChars[0] || "'"}Brien`),
                    ].filter(Boolean).join(' / ')}
                    {` (${nv.minLength}-${nv.maxLength} ตัว)`}
                  </Typography>
                </Box>
              </Box>
            );
          })()}
        </SettingSection>
      )}

      {/* Shirt Custom Name Settings */}
      {canManageShop && (
        <SettingSection icon={<ShoppingBag size={20} />} title="ชื่อบนเสื้อ (Custom Name)">
          {(() => {
            const sn = { ...DEFAULT_SHIRT_NAME, ...localConfig.shirtNameConfig };
            const updateSN = (patch: Partial<ShirtNameConfig>) => {
              onConfigChange({ ...localConfig, shirtNameConfig: { ...sn, ...patch } });
            };
            return (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {/* Length settings */}
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                  <TextField
                    type="number"
                    label="ความยาวขั้นต่ำ"
                    value={sn.minLength}
                    onChange={e => updateSN({ minLength: Math.max(1, Number(e.target.value) || 1) })}
                    inputProps={{ min: 1, max: 50 }}
                    size="small"
                    sx={{
                      flex: 1,
                      ...inputSx,
                      '& .MuiOutlinedInput-root': { ...inputSx['& .MuiOutlinedInput-root'], borderRadius: '10px' },
                    }}
                  />
                  <TextField
                    type="number"
                    label="ความยาวสูงสุด"
                    value={sn.maxLength}
                    onChange={e => updateSN({ maxLength: Math.max(sn.minLength, Number(e.target.value) || 7) })}
                    inputProps={{ min: sn.minLength, max: 50 }}
                    size="small"
                    sx={{
                      flex: 1,
                      ...inputSx,
                      '& .MuiOutlinedInput-root': { ...inputSx['& .MuiOutlinedInput-root'], borderRadius: '10px' },
                    }}
                  />
                </Box>

                {/* Language toggles */}
                <Box sx={{
                  p: 2,
                  borderRadius: '12px',
                  bgcolor: 'rgba(99,102,241,0.08)',
                  border: '1px solid rgba(99,102,241,0.2)',
                }}>
                  <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#818cf8', mb: 1.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Groups size={14} /> ภาษาที่อนุญาต
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {[
                      { key: 'allowThai' as const, label: 'ภาษาไทย', color: '#0071e3' },
                      { key: 'allowEnglish' as const, label: 'English', color: '#10b981' },
                    ].map(lang => (
                      <Box
                        key={lang.key}
                        onClick={() => {
                          // Don't allow disabling all languages
                          if (sn[lang.key] && !['allowThai', 'allowEnglish'].some(k => k !== lang.key && sn[k as keyof ShirtNameConfig] === true)) return;
                          updateSN({ [lang.key]: !sn[lang.key] });
                        }}
                        sx={{
                          px: 2,
                          py: 1,
                          borderRadius: '10px',
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          bgcolor: sn[lang.key] ? `${lang.color}15` : 'rgba(255,255,255,0.05)',
                          color: sn[lang.key] ? lang.color : '#64748b',
                          border: `1.5px solid ${sn[lang.key] ? lang.color : 'transparent'}`,
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            bgcolor: sn[lang.key] ? `${lang.color}25` : 'rgba(255,255,255,0.1)',
                          },
                        }}
                      >
                        {lang.label}
                      </Box>
                    ))}
                  </Box>
                </Box>

                {/* Auto uppercase toggle */}
                <SettingToggleRow
                  label="แปลงเป็นตัวพิมพ์ใหญ่อัตโนมัติ"
                  description={sn.autoUppercase ? 'john → JOHN' : 'ปิดใช้งาน'}
                  checked={sn.autoUppercase}
                  onChange={checked => updateSN({ autoUppercase: checked })}
                />

                {/* Special characters */}
                <SettingToggleRow
                  label="อนุญาตอักษรพิเศษ"
                  description={sn.allowSpecialChars ? `ตัวอักษรที่อนุญาต: ${sn.allowedSpecialChars}` : 'ปิดใช้งาน'}
                  checked={sn.allowSpecialChars}
                  onChange={checked => updateSN({ allowSpecialChars: checked })}
                />
                {sn.allowSpecialChars && (
                  <TextField
                    label="อักษรพิเศษที่อนุญาต"
                    value={sn.allowedSpecialChars}
                    onChange={e => updateSN({ allowedSpecialChars: e.target.value })}
                    placeholder=".-"
                    helperText="กรอกตัวอักษรพิเศษที่ต้องการอนุญาต เช่น . - _ +"
                    size="small"
                    sx={{
                      ...inputSx,
                      '& .MuiOutlinedInput-root': { ...inputSx['& .MuiOutlinedInput-root'], borderRadius: '10px' },
                    }}
                  />
                )}

                {/* Preview */}
                <Box sx={{
                  p: 1.5,
                  borderRadius: '10px',
                  bgcolor: 'rgba(16,185,129,0.08)',
                  border: '1px solid rgba(16,185,129,0.2)',
                }}>
                  <Typography sx={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600, mb: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Shirt size={14} /> ตัวอย่างที่ใช้ได้:
                  </Typography>
                  <Typography sx={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {[
                      sn.allowEnglish && (sn.autoUppercase ? 'JOHN' : 'John'),
                      sn.allowThai && 'สมชาย',
                      sn.allowSpecialChars && (sn.allowEnglish ? `O${sn.allowedSpecialChars[0] || '.'}BRIEN` : `สม${sn.allowedSpecialChars[0] || '.'}ชาย`),
                    ].filter(Boolean).join(' / ')}
                    {` (${sn.minLength}-${sn.maxLength} ตัว)`}
                  </Typography>
                </Box>
              </Box>
            );
          })()}
        </SettingSection>
      )}

      {/* Google Sheet - Only for Super Admin or admins with permission */}
      {canManageSheet && (
        <SettingSection icon={<Bolt size={20} />} title="Google Sheet">
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Sheet ID"
              placeholder="วาง Sheet ID หรือ URL ก็ได้"
              value={localConfig.sheetId || ''}
              onChange={(e) => {
                const { sheetId, sheetUrl } = extractSheetInfo(e.target.value);
                onConfigChange({ ...localConfig, sheetId, sheetUrl });
              }}
              fullWidth
              sx={{
                ...inputSx,
                '& .MuiOutlinedInput-root': {
                  ...inputSx['& .MuiOutlinedInput-root'],
                  borderRadius: '10px',
                },
              }}
              helperText="ใส่ Sheet ID หรือ URL ของ Google Sheet"
            />

            <TextField
              label="Vendor Sheet ID"
              placeholder="วาง Sheet ID หรือ URL ให้โรงงาน"
              value={localConfig.vendorSheetId || ''}
              onChange={(e) => {
                const { sheetId, sheetUrl } = extractSheetInfo(e.target.value);
                onConfigChange({ ...localConfig, vendorSheetId: sheetId, vendorSheetUrl: sheetUrl });
              }}
              fullWidth
              sx={{
                ...inputSx,
                '& .MuiOutlinedInput-root': {
                  ...inputSx['& .MuiOutlinedInput-root'],
                  borderRadius: '10px',
                },
              }}
              helperText="ชีตสำหรับส่งให้โรงงาน (ตัดอีเมล/ลิงก์สลิปออก)"
            />
            
            {localConfig.sheetUrl && (
              <Box sx={{
                p: 2,
                borderRadius: '12px',
                bgcolor: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
              }}>
                <Box sx={{
                  width: 36,
                  height: 36,
                  borderRadius: '10px',
                  bgcolor: '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Check size={20} color="#fff" />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, color: '#10b981' }}>
                    เชื่อมต่อแล้ว
                  </Typography>
                  <Typography 
                    component="a"
                    href={localConfig.sheetUrl}
                    target="_blank"
                    rel="noreferrer"
                    sx={{ 
                      fontSize: '0.8rem', 
                      color: 'var(--text-muted)',
                      textDecoration: 'underline',
                      '&:hover': { color: 'var(--text-muted)' },
                    }}
                  >
                    เปิด Google Sheet
                  </Typography>
                </Box>
              </Box>
            )}

            {localConfig.vendorSheetUrl && (
              <Box sx={{
                p: 2,
                borderRadius: '12px',
                bgcolor: 'rgba(59,130,246,0.1)',
                border: '1px solid rgba(59,130,246,0.2)',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
              }}>
                <Box sx={{
                  width: 36,
                  height: 36,
                  borderRadius: '10px',
                  bgcolor: '#3b82f6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Check size={20} color="#fff" />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, color: '#3b82f6' }}>
                    เชื่อมต่อชีตโรงงานแล้ว
                  </Typography>
                  <Typography 
                    component="a"
                    href={localConfig.vendorSheetUrl}
                    target="_blank"
                    rel="noreferrer"
                    sx={{ 
                      fontSize: '0.8rem', 
                      color: 'var(--text-muted)',
                      textDecoration: 'underline',
                      '&:hover': { color: 'var(--text-muted)' },
                    }}
                  >
                    เปิด Vendor Sheet
                  </Typography>
                </Box>
              </Box>
            )}

            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Button
                onClick={() => triggerSheetSync(localConfig.sheetId ? 'sync' : 'create')}
                disabled={sheetSyncing}
                sx={{ ...gradientButtonSx, flex: 1, gap: 1 }}
              >
                <Bolt size={18} />
                {sheetSyncing ? 'กำลังซิงก์...' : localConfig.sheetId ? 'ซิงก์ทันที' : 'สร้าง Sheet ใหม่'}
              </Button>
            </Box>
          </Box>
        </SettingSection>
      )}

      {/* Admin Management - Only visible to Super Admin */}
      {isSuperAdminUser && (
        <SettingSection icon={<AdminPanelSettings size={20} />} title="จัดการแอดมิน">
          <Box sx={{ mb: 2 }}>
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 1, 
              mb: 1.5,
              p: 1.5,
              borderRadius: '10px',
              bgcolor: 'rgba(251, 191, 36, 0.1)',
              border: '1px solid rgba(251, 191, 36, 0.3)',
            }}>
              <Shield size={18} color="#fbbf24" />
              <Typography sx={{ fontSize: '0.8rem', color: '#fbbf24' }}>
                เฉพาะบัญชีสูงสุดเท่านั้นที่สามารถจัดการแอดมินได้
              </Typography>
            </Box>
            
            {/* Super Admin Badge */}
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 1.5, 
              p: 2,
              borderRadius: '12px',
              bgcolor: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              mb: 2,
            }}>
              <Box sx={{
                width: 40,
                height: 40,
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Shield size={20} color="#fff" />
              </Box>
              <Box>
                <Typography sx={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>บัญชีสูงสุด (Super Admin)</Typography>
                <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, color: '#34d399' }}>
                  {SUPER_ADMIN_EMAIL}
                </Typography>
              </Box>
            </Box>

            {/* Add Admin Form */}
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <TextField
                placeholder="กรอกอีเมลแอดมินใหม่..."
                value={newAdminEmail}
                onChange={(e) => onNewAdminEmailChange(e.target.value)}
                fullWidth
                size="small"
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
                  const email = newAdminEmail.trim().toLowerCase();
                  if (!email) return;
                  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                    showToast('error', 'รูปแบบอีเมลไม่ถูกต้อง');
                    return;
                  }
                  if (email === SUPER_ADMIN_EMAIL.toLowerCase()) {
                    showToast('warning', 'ไม่สามารถเพิ่มบัญชีสูงสุดซ้ำได้');
                    return;
                  }
                  const currentAdmins = localConfig.adminEmails || [];
                  if (currentAdmins.map(e => e.toLowerCase()).includes(email)) {
                    showToast('warning', 'อีเมลนี้เป็นแอดมินอยู่แล้ว');
                    return;
                  }
                  onConfigChange({
                    ...localConfig,
                    adminEmails: [...currentAdmins, email]
                  });
                  onNewAdminEmailChange('');
                  showToast('success', `เพิ่ม ${email} เป็นแอดมินแล้ว (กรุณาบันทึกการตั้งค่า)`);
                }}
                sx={{
                  ...gradientButtonSx,
                  minWidth: 100,
                  whiteSpace: 'nowrap',
                }}
              >
                <PersonAdd size={18} style={{ marginRight: 4 }} />
                เพิ่ม
              </Button>
            </Box>

            {/* Admin List */}
            <Typography sx={{ fontSize: '0.8rem', color: 'var(--text-muted)', mb: 1 }}>
              รายชื่อแอดมิน ({(localConfig.adminEmails || []).length} คน)
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {(localConfig.adminEmails || []).length === 0 ? (
                <Box sx={{
                  p: 2,
                  borderRadius: '10px',
                  bgcolor: 'rgba(255,255,255,0.03)',
                  border: `1px solid ${ADMIN_THEME.border}`,
                  textAlign: 'center',
                }}>
                  <Typography sx={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    ยังไม่มีแอดมินเพิ่มเติม
                  </Typography>
                </Box>
              ) : (
                (localConfig.adminEmails || []).map((adminEmail, idx) => {
                  const perms: AdminPermissions = localConfig.adminPermissions?.[adminEmail.toLowerCase()]
                    ? { ...DEFAULT_ADMIN_PERMISSIONS, ...localConfig.adminPermissions[adminEmail.toLowerCase()] }
                    : { ...DEFAULT_ADMIN_PERMISSIONS };
                  
                  const togglePermission = (key: string, value: boolean) => {
                    const currentPerms = localConfig.adminPermissions ?? {};
                    onConfigChange({
                      ...localConfig,
                      adminPermissions: {
                        ...currentPerms,
                        [adminEmail.toLowerCase()]: {
                          ...perms,
                          [key]: value,
                        }
                      }
                    });
                  };

                  return (
                    <Box
                      key={idx}
                      sx={{
                        borderRadius: '12px',
                        bgcolor: 'rgba(255,255,255,0.03)',
                        border: `1px solid ${ADMIN_THEME.border}`,
                        overflow: 'hidden',
                      }}
                    >
                      {/* Admin Header */}
                      <Box sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        p: 1.5,
                        borderBottom: `1px solid ${ADMIN_THEME.border}`,
                        bgcolor: 'rgba(139, 92, 246, 0.05)',
                      }}>
                        <Box sx={{
                          width: 32,
                          height: 32,
                          borderRadius: '8px',
                          bgcolor: 'rgba(139, 92, 246, 0.2)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                          <Person size={18} color="#a78bfa" />
                        </Box>
                        <Typography sx={{ flex: 1, fontSize: '0.9rem', color: 'var(--foreground)', fontWeight: 600 }}>
                          {adminEmail}
                        </Typography>
                        <IconButton
                          size="small"
                          onClick={() => {
                            const currentAdmins = localConfig.adminEmails || [];
                            const currentPerms = { ...(localConfig.adminPermissions ?? {}) };
                            delete currentPerms[adminEmail.toLowerCase()];
                            onConfigChange({
                              ...localConfig,
                              adminEmails: currentAdmins.filter((_, i) => i !== idx),
                              adminPermissions: currentPerms,
                            });
                            showToast('info', `ลบ ${adminEmail} ออกจากแอดมินแล้ว (กรุณาบันทึกการตั้งค่า)`);
                          }}
                          sx={{
                            color: '#ef4444',
                            '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.1)' },
                          }}
                        >
                          <Delete size={18} />
                        </IconButton>
                      </Box>
                      
                      {/* Permissions */}
                      <Box sx={{ p: 1.5 }}>
                        <Typography sx={{ fontSize: '0.75rem', color: 'var(--text-muted)', mb: 1 }}>สิทธิ์การใช้งาน:</Typography>
                        
                        {/* Permission Groups */}
                        {[
                          {
                            group: 'ร้านค้า & ระบบ', groupIcon: <Store size={14} />,
                            items: [
                              { key: 'canManageShop', label: 'เปิด/ปิดร้าน', color: '#10b981' },
                              { key: 'canManageSheet', label: 'จัดการ Sheet', color: '#3b82f6' },
                              { key: 'canManageShipping', label: 'ตั้งค่าจัดส่ง', color: '#a78bfa' },
                              { key: 'canManagePayment', label: 'ตั้งค่าชำระเงิน', color: '#22d3ee' },
                            ],
                          },
                          {
                            group: 'สินค้า & ออเดอร์', groupIcon: <Inventory size={14} />,
                            items: [
                              { key: 'canManageProducts', label: 'จัดการสินค้า', color: '#ec4899' },
                              { key: 'canManageOrders', label: 'จัดการออเดอร์', color: '#8b5cf6' },
                              { key: 'canManagePickup', label: 'รับสินค้า', color: '#06b6d4' },
                              { key: 'canManageTracking', label: 'ติดตามพัสดุ', color: '#fb923c' },
                              { key: 'canManageRefunds', label: 'คืนเงิน', color: '#c084fc' },
                            ],
                          },
                          {
                            group: 'การตลาด & สื่อสาร', groupIcon: <Campaign size={14} />,
                            items: [
                              { key: 'canManageAnnouncement', label: 'ประกาศ', color: '#f59e0b' },
                              { key: 'canManageEvents', label: 'อีเวนต์/โปรโมชั่น', color: '#fbbf24' },
                              { key: 'canManagePromoCodes', label: 'โค้ดส่วนลด', color: '#34c759' },
                              { key: 'canManageSupport', label: 'แชทสนับสนุน', color: '#ec4899' },
                              { key: 'canSendEmail', label: 'ส่งอีเมล', color: '#10b981' },
                            ],
                          },
                        ].map((group) => (
                          <Box key={group.group} sx={{ mb: 1.5 }}>
                            <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)', mb: 0.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              {group.groupIcon} {group.group}
                            </Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                              {group.items.map(perm => (
                                <Box
                                  key={perm.key}
                                  onClick={() => togglePermission(perm.key, !perms[perm.key as keyof AdminPermissions])}
                                  sx={{
                                    px: 1.5,
                                    py: 0.5,
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontSize: '0.75rem',
                                    fontWeight: 500,
                                    bgcolor: perms[perm.key as keyof AdminPermissions] 
                                      ? `${perm.color}20` 
                                      : 'rgba(255,255,255,0.05)',
                                    color: perms[perm.key as keyof AdminPermissions] 
                                      ? perm.color 
                                      : '#64748b',
                                    border: `1px solid ${perms[perm.key as keyof AdminPermissions] 
                                      ? perm.color 
                                      : 'transparent'}`,
                                    transition: 'all 0.2s ease',
                                    '&:hover': { 
                                      bgcolor: perms[perm.key as keyof AdminPermissions] 
                                        ? `${perm.color}30` 
                                        : 'rgba(255,255,255,0.1)',
                                    },
                                  }}
                                >
                                  {perm.label}
                                </Box>
                              ))}
                            </Box>
                          </Box>
                        ))}

                        {/* Quick Actions */}
                        <Box sx={{ display: 'flex', gap: 0.5, mt: 1, pt: 1, borderTop: `1px solid ${ADMIN_THEME.border}` }}>
                          <Box
                            onClick={() => {
                              const allPerms: AdminPermissions = {};
                              Object.keys(DEFAULT_ADMIN_PERMISSIONS).forEach(k => {
                                (allPerms as Record<string, boolean>)[k] = true;
                              });
                              const currentPerms = localConfig.adminPermissions ?? {};
                              onConfigChange({
                                ...localConfig,
                                adminPermissions: {
                                  ...currentPerms,
                                  [adminEmail.toLowerCase()]: allPerms,
                                }
                              });
                            }}
                            sx={{
                              px: 1.5,
                              py: 0.4,
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              bgcolor: 'rgba(16,185,129,0.1)',
                              color: '#10b981',
                              border: '1px solid rgba(16,185,129,0.3)',
                              '&:hover': { bgcolor: 'rgba(16,185,129,0.2)' },
                            }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><Check size={12} /> เปิดทั้งหมด</Box>
                          </Box>
                          <Box
                            onClick={() => {
                              const noPerms: AdminPermissions = {};
                              Object.keys(DEFAULT_ADMIN_PERMISSIONS).forEach(k => {
                                (noPerms as Record<string, boolean>)[k] = false;
                              });
                              const currentPerms = localConfig.adminPermissions ?? {};
                              onConfigChange({
                                ...localConfig,
                                adminPermissions: {
                                  ...currentPerms,
                                  [adminEmail.toLowerCase()]: noPerms,
                                }
                              });
                            }}
                            sx={{
                              px: 1.5,
                              py: 0.4,
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              bgcolor: 'rgba(239,68,68,0.1)',
                              color: '#ef4444',
                              border: '1px solid rgba(239,68,68,0.3)',
                              '&:hover': { bgcolor: 'rgba(239,68,68,0.2)' },
                            }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><Close size={12} /> ปิดทั้งหมด</Box>
                          </Box>
                          <Box
                            onClick={() => {
                              const currentPerms = localConfig.adminPermissions ?? {};
                              onConfigChange({
                                ...localConfig,
                                adminPermissions: {
                                  ...currentPerms,
                                  [adminEmail.toLowerCase()]: { ...DEFAULT_ADMIN_PERMISSIONS },
                                }
                              });
                            }}
                            sx={{
                              px: 1.5,
                              py: 0.4,
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              bgcolor: 'rgba(99,102,241,0.1)',
                              color: '#6366f1',
                              border: '1px solid rgba(99,102,241,0.3)',
                              '&:hover': { bgcolor: 'rgba(99,102,241,0.2)' },
                            }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><RefreshCw size={12} /> ค่าเริ่มต้น</Box>
                          </Box>
                        </Box>
                      </Box>
                    </Box>
                  );
                })
              )}
            </Box>
          </Box>
        </SettingSection>
      )}

      {/* Pickup Settings - Per Product Summary */}
      {canManageShop && (
        <SettingSection icon={<QrCodeScanner size={20} />} title="สถานะรับสินค้า">
          {/* Summary of products with pickup enabled */}
          {(() => {
            const productsWithPickup = localConfig.products?.filter(p => p.pickup?.enabled) || [];
            const totalProducts = localConfig.products?.length || 0;
            
            return (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 2,
                  p: 2,
                  borderRadius: '12px',
                  bgcolor: productsWithPickup.length > 0 ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${productsWithPickup.length > 0 ? 'rgba(16,185,129,0.3)' : ADMIN_THEME.border}`,
                }}>
                  <LocalMall size={32} color={productsWithPickup.length > 0 ? '#10b981' : ADMIN_THEME.muted} />
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={{ fontWeight: 700, color: ADMIN_THEME.text }}>
                      {productsWithPickup.length > 0 
                        ? `เปิดรับ ${productsWithPickup.length} สินค้า` 
                        : 'ยังไม่มีสินค้าเปิดรับ'}
                    </Typography>
                    <Typography sx={{ fontSize: '0.8rem', color: ADMIN_THEME.muted }}>
                      จากทั้งหมด {totalProducts} สินค้า
                    </Typography>
                  </Box>
                </Box>

                {productsWithPickup.length > 0 && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {productsWithPickup.map(p => (
                      <Box 
                        key={p.id}
                        sx={{
                          p: 1.5,
                          borderRadius: '10px',
                          bgcolor: 'rgba(6,182,212,0.05)',
                          border: `1px solid rgba(6,182,212,0.15)`,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.5,
                        }}
                      >
                        <CheckCircle size={18} color="#10b981" />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography sx={{ 
                            fontWeight: 600, 
                            color: ADMIN_THEME.text,
                            fontSize: '0.85rem',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>
                            {p.name}
                          </Typography>
                          {p.pickup?.location && (
                            <Typography sx={{ fontSize: '0.75rem', color: ADMIN_THEME.muted, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Crosshair size={12} /> {p.pickup.location}
                            </Typography>
                          )}
                          {(p.pickup?.startDate || p.pickup?.endDate) && (
                            <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <CalendarDays size={12} /> {p.pickup?.startDate ? new Date(p.pickup.startDate).toLocaleDateString('th-TH') : '...'} - {p.pickup?.endDate ? new Date(p.pickup.endDate).toLocaleDateString('th-TH') : '...'}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    ))}
                  </Box>
                )}

                <Alert 
                  severity="info" 
                  sx={{ 
                    bgcolor: 'rgba(99,102,241,0.1)', 
                    border: '1px solid rgba(99,102,241,0.2)',
                    '& .MuiAlert-icon': { color: '#6366f1' },
                    fontSize: '0.8rem',
                  }}
                >
                  ไปที่แท็บ <strong>สินค้า</strong> และกดปุ่ม "ตั้งค่ารับสินค้า" ในแต่ละสินค้าเพื่อเปิด/ปิดการรับสินค้า
                </Alert>
              </Box>
            );
          })()}
        </SettingSection>
      )}

      {/* Save Status */}
      <Box sx={{ 
        ...glassCardSx,
        p: 2,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            bgcolor: hasChanges ? '#f59e0b' : '#10b981',
            boxShadow: `0 0 12px ${hasChanges ? '#f59e0b' : '#10b981'}`,
          }} />
          <Typography sx={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {hasChanges ? 'มีการเปลี่ยนแปลงที่ยังไม่บันทึก' : 'บันทึกล่าสุด: ' + (lastSavedTime ? lastSavedTime.toLocaleString('th-TH') : '-')}
          </Typography>
        </Box>
        <Button
          onClick={onSave}
          disabled={!hasChanges || loading}
          sx={{
            ...gradientButtonSx,
            minWidth: 120,
            opacity: hasChanges ? 1 : 0.5,
          }}
        >
          <Save size={18} style={{ marginRight: 8 }} />
          บันทึก
        </Button>
      </Box>
    </Box>
  );
});

// ============== PROMO CODES VIEW COMPONENT ==============
interface PromoCode {
  id: string;
  code: string;
  enabled: boolean;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  minOrderAmount?: number;
  maxDiscount?: number;
  usageLimit?: number | null;
  usageCount?: number;
  expiresAt?: string;
  description?: string;
  createdBy?: string;
  createdAt: string;
}

interface PromoCodesViewProps {
  config: ShopConfig;
  saveConfig: (newConfig: ShopConfig) => Promise<void>;
  showToast: (type: 'success' | 'error' | 'info' | 'warning', message: string) => void;
  userEmail: string | null | undefined;
}

const PromoCodesView = React.memo(function PromoCodesView({ config, saveConfig, showToast, userEmail }: PromoCodesViewProps) {
  const [codes, setCodes] = React.useState<PromoCode[]>((config.promoCodes || []) as PromoCode[]);
  const [editingCode, setEditingCode] = React.useState<PromoCode | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setCodes((config.promoCodes || []) as PromoCode[]);
  }, [config.promoCodes]);

  const createNewCode = (): PromoCode => ({
    id: `promo_${Date.now()}`,
    code: '',
    enabled: true,
    discountType: 'percent',
    discountValue: 10,
    createdBy: userEmail || 'admin',
    createdAt: new Date().toISOString(),
  });

  const handleSave = async (code: PromoCode) => {
    if (!code.code.trim()) { showToast('warning', 'กรุณากรอกรหัสส่วนลด'); return; }
    setSaving(true);
    try {
      const existingIdx = codes.findIndex(c => c.id === code.id);
      let newCodes: PromoCode[];
      if (existingIdx >= 0) {
        newCodes = codes.map(c => c.id === code.id ? code : c);
      } else {
        newCodes = [...codes, code];
      }
      await saveConfig({ ...config, promoCodes: newCodes as any });
      setCodes(newCodes);
      setEditingCode(null);
      showToast('success', existingIdx >= 0 ? 'อัปเดตโค้ดแล้ว' : 'สร้างโค้ดแล้ว');
    } catch {
      showToast('error', 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    Swal.fire({
      title: 'ลบโค้ดส่วนลด?',
      text: 'โค้ดนี้จะถูกลบถาวร',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#475569',
      confirmButtonText: 'ลบ',
      cancelButtonText: 'ยกเลิก',
    }).then(async (result) => {
      if (result.isConfirmed) {
        const newCodes = codes.filter(c => c.id !== id);
        await saveConfig({ ...config, promoCodes: newCodes as any });
        setCodes(newCodes);
        showToast('success', 'ลบโค้ดแล้ว');
      }
    });
  };

  const toggleEnabled = async (id: string) => {
    const newCodes = codes.map(c => c.id === id ? { ...c, enabled: !c.enabled } : c);
    await saveConfig({ ...config, promoCodes: newCodes as any });
    setCodes(newCodes);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: ADMIN_THEME.text, display: 'flex', alignItems: 'center', gap: 1 }}><Ticket size={22} /> โค้ดส่วนลด</Typography>
          <Typography sx={{ color: ADMIN_THEME.muted, fontSize: '0.85rem' }}>จัดการรหัสส่วนลดสำหรับลูกค้า</Typography>
        </Box>
        <Button
          variant="contained"
          onClick={() => setEditingCode(createNewCode())}
          sx={{ background: ADMIN_THEME.gradient, fontWeight: 700, borderRadius: '12px', textTransform: 'none', px: 3, py: 1 }}
        >
          + สร้างโค้ดใหม่
        </Button>
      </Box>

      {codes.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8, color: ADMIN_THEME.muted }}>
          <Ticket size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
          <Typography sx={{ fontWeight: 600 }}>ยังไม่มีโค้ดส่วนลด</Typography>
          <Typography sx={{ fontSize: '0.85rem', mt: 0.5 }}>สร้างโค้ดใหม่เพื่อเริ่มต้นใช้งาน</Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {codes.map(code => {
            const isExpired = code.expiresAt && new Date(code.expiresAt) < new Date();
            const isUsedUp = code.usageLimit != null && (code.usageCount || 0) >= code.usageLimit;
            return (
              <Box key={code.id} sx={{ p: 2, borderRadius: '14px', bgcolor: ADMIN_THEME.glass, border: `1px solid ${ADMIN_THEME.border}`, display: 'flex', alignItems: 'center', gap: 2, opacity: isExpired || isUsedUp ? 0.5 : 1 }}>
                <Switch checked={code.enabled} onChange={() => toggleEnabled(code.id)} size="small" />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Typography sx={{ fontWeight: 800, fontSize: '1rem', color: '#34c759', fontFamily: 'monospace', letterSpacing: '0.05em' }}>
                      {code.code}
                    </Typography>
                    {isExpired && <Chip label="หมดอายุ" size="small" sx={{ bgcolor: 'rgba(239,68,68,0.15)', color: '#ef4444', fontWeight: 600, fontSize: '0.65rem' }} />}
                    {isUsedUp && <Chip label="ใช้ครบแล้ว" size="small" sx={{ bgcolor: 'rgba(245,158,11,0.15)', color: '#f59e0b', fontWeight: 600, fontSize: '0.65rem' }} />}
                  </Box>
                  <Typography sx={{ fontSize: '0.8rem', color: ADMIN_THEME.muted }}>
                    {code.discountType === 'percent' ? `ลด ${code.discountValue}%` : `ลด ฿${code.discountValue}`}
                    {code.maxDiscount ? ` (สูงสุด ฿${code.maxDiscount})` : ''}
                    {code.minOrderAmount ? ` • ขั้นต่ำ ฿${code.minOrderAmount}` : ''}
                    {code.usageLimit != null ? ` • ใช้แล้ว ${code.usageCount || 0}/${code.usageLimit}` : ''}
                    {code.expiresAt ? ` • หมดอายุ ${new Date(code.expiresAt).toLocaleDateString('th-TH')}` : ''}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  <IconButton size="small" onClick={() => setEditingCode(code)} sx={{ color: ADMIN_THEME.primary }}>
                    <Edit size={16} />
                  </IconButton>
                  <IconButton size="small" onClick={() => handleDelete(code.id)} sx={{ color: '#ef4444' }}>
                    <Delete size={16} />
                  </IconButton>
                </Box>
              </Box>
            );
          })}
        </Box>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingCode} onClose={() => !saving && setEditingCode(null)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { bgcolor: 'var(--background)', color: 'var(--foreground)', borderRadius: '16px', border: '1px solid var(--glass-border)' } }}>
        {editingCode && (
          <>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 700 }}>
              <Ticket size={20} /> {codes.some(c => c.id === editingCode.id) ? 'แก้ไขโค้ด' : 'สร้างโค้ดใหม่'}
            </DialogTitle>
            <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
              <TextField fullWidth label="รหัสส่วนลด" value={editingCode.code} onChange={e => setEditingCode({ ...editingCode, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })} placeholder="เช่น FIRST20, SALE50" helperText="ใช้ตัวพิมพ์ใหญ่และตัวเลขเท่านั้น"
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px', bgcolor: 'var(--surface)', color: 'var(--foreground)', fontFamily: 'monospace', fontWeight: 700, fontSize: '1.1rem', letterSpacing: '0.05em' }, '& .MuiInputLabel-root': { color: 'var(--text-muted)' } }} />

              <TextField fullWidth label="คำอธิบาย" value={editingCode.description || ''} onChange={e => setEditingCode({ ...editingCode, description: e.target.value })} placeholder="เช่น ลูกค้าใหม่ลด 20%"
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px', bgcolor: 'var(--surface)', color: 'var(--foreground)' }, '& .MuiInputLabel-root': { color: 'var(--text-muted)' } }} />

              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  {([{ value: 'percent' as const, label: 'ลด %' }, { value: 'fixed' as const, label: 'ลด ฿' }]).map(opt => (
                    <Chip key={opt.value} label={opt.label} onClick={() => setEditingCode({ ...editingCode, discountType: opt.value })}
                      sx={{ bgcolor: editingCode.discountType === opt.value ? 'rgba(52,199,89,0.2)' : 'var(--surface)', color: editingCode.discountType === opt.value ? '#34c759' : 'var(--text-muted)', border: `1px solid ${editingCode.discountType === opt.value ? 'rgba(52,199,89,0.4)' : 'var(--glass-border)'}`, fontWeight: 700, cursor: 'pointer' }} />
                  ))}
                </Box>
                <TextField type="number" label={editingCode.discountType === 'percent' ? 'เปอร์เซ็นต์ (%)'  : 'จำนวนเงิน (฿)'} value={editingCode.discountValue || ''} onChange={e => setEditingCode({ ...editingCode, discountValue: Number(e.target.value) || 0 })} inputProps={{ min: 0, max: editingCode.discountType === 'percent' ? 100 : 99999 }} size="small" sx={{ flex: 1, '& .MuiOutlinedInput-root': { borderRadius: '10px', bgcolor: 'var(--surface)', color: 'var(--foreground)' }, '& .MuiInputLabel-root': { color: 'var(--text-muted)' } }} />
              </Box>

              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                <TextField type="number" label="ยอดขั้นต่ำ (฿)" value={editingCode.minOrderAmount || ''} onChange={e => setEditingCode({ ...editingCode, minOrderAmount: Number(e.target.value) || undefined })} inputProps={{ min: 0 }} size="small" sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px', bgcolor: 'var(--surface)', color: 'var(--foreground)' }, '& .MuiInputLabel-root': { color: 'var(--text-muted)' } }} />
                {editingCode.discountType === 'percent' && (
                  <TextField type="number" label="ลดสูงสุด (฿)" value={editingCode.maxDiscount || ''} onChange={e => setEditingCode({ ...editingCode, maxDiscount: Number(e.target.value) || undefined })} inputProps={{ min: 0 }} size="small" sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px', bgcolor: 'var(--surface)', color: 'var(--foreground)' }, '& .MuiInputLabel-root': { color: 'var(--text-muted)' } }} />
                )}
                <TextField type="number" label="จำนวนครั้งที่ใช้ได้ (0 = ไม่จำกัด)" value={editingCode.usageLimit ?? ''} onChange={e => setEditingCode({ ...editingCode, usageLimit: e.target.value === '' || e.target.value === '0' ? null : Number(e.target.value) })} inputProps={{ min: 0 }} size="small" sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px', bgcolor: 'var(--surface)', color: 'var(--foreground)' }, '& .MuiInputLabel-root': { color: 'var(--text-muted)' } }} />
                <TextField type="datetime-local" label="วันหมดอายุ" value={isoToLocalDatetime(editingCode.expiresAt)} onChange={e => setEditingCode({ ...editingCode, expiresAt: localDatetimeToIso(e.target.value) })} InputLabelProps={{ shrink: true }} size="small" sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px', bgcolor: 'var(--surface)', color: 'var(--foreground)' }, '& .MuiInputLabel-root': { color: 'var(--text-muted)' }, '& input': { color: 'var(--foreground)' } }} />
              </Box>

              <FormControlLabel control={<Switch checked={editingCode.enabled} onChange={e => setEditingCode({ ...editingCode, enabled: e.target.checked })} />} label="เปิดใช้งาน" sx={{ color: 'var(--foreground)' }} />
            </DialogContent>
            <DialogActions sx={{ p: 2, gap: 1, borderTop: '1px solid var(--glass-border)' }}>
              <Button onClick={() => setEditingCode(null)} sx={{ color: 'var(--text-muted)', borderRadius: '10px' }}>ยกเลิก</Button>
              <Button onClick={() => handleSave(editingCode)} disabled={saving} variant="contained"
                sx={{ background: `linear-gradient(135deg, #34c759, #30d158)`, borderRadius: '10px', fontWeight: 700, textTransform: 'none' }}>
                {saving ? 'กำลังบันทึก...' : 'บันทึก'}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
});

// ============== EVENTS VIEW COMPONENT ==============
interface ShopEvent {
  id: string;
  enabled: boolean;
  title: string;
  description?: string;
  imageUrl?: string;
  color: string;
  type: 'event' | 'promotion' | 'sale' | 'announcement';
  startDate?: string;
  endDate?: string;
  ctaText?: string;
  ctaLink?: string;
  badge?: string;
  priority?: number;
  linkedProducts?: string[];
  discountType?: 'percent' | 'fixed';
  discountValue?: number;
  createdBy?: string;
  createdAt: string;
  updatedAt?: string;
}

interface EventsViewProps {
  config: ShopConfig;
  saveConfig: (newConfig: ShopConfig) => Promise<void>;
  showToast: (type: 'success' | 'error' | 'info' | 'warning', message: string) => void;
  userEmail: string | null | undefined;
  onImageUpload: (file: File) => Promise<string | null>;
}

const EVENT_TYPE_OPTIONS = [
  { value: 'event', label: 'อีเวนท์', icon: 'PartyPopper', color: '#bf5af2' },
  { value: 'promotion', label: 'โปรโมชั่น', icon: 'Sparkles', color: '#ff9f0a' },
  { value: 'sale', label: 'ลดราคา', icon: 'Tag', color: '#ff453a' },
  { value: 'announcement', label: 'ประกาศพิเศษ', icon: 'Megaphone', color: '#0071e3' },
];

const EVENT_TYPE_ICON_MAP: Record<string, React.ReactElement> = {
  PartyPopper: <PartyPopper size={16} />,
  Sparkles: <Sparkles size={16} />,
  Tag: <LocalOffer size={16} />,
  Megaphone: <Campaign size={16} />,
};

const EVENT_COLORS = [
  '#0071e3', '#3b82f6', '#5e5ce6', '#bf5af2',
  '#ff375f', '#ff453a', '#ff9f0a', '#ffd60a',
  '#30d158', '#34c759', '#64d2ff', '#06b6d4',
  '#ec4899', '#f472b6', '#a78bfa', '#fb923c',
];

const EventsView = React.memo(function EventsView({
  config,
  saveConfig,
  showToast,
  userEmail,
  onImageUpload,
}: EventsViewProps) {
  const [events, setEvents] = React.useState<ShopEvent[]>(config.events || []);
  const [editingEvent, setEditingEvent] = React.useState<ShopEvent | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [uploadingImage, setUploadingImage] = React.useState(false);

  React.useEffect(() => {
    setEvents(config.events || []);
  }, [config.events]);

  const createNewEvent = (): ShopEvent => ({
    id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    enabled: true,
    title: '',
    description: '',
    color: '#0071e3',
    type: 'promotion',
    ctaText: '',
    ctaLink: '',
    badge: '',
    priority: events.length,
    createdBy: userEmail || 'แอดมิน',
    createdAt: new Date().toISOString(),
  });

  const handleSave = async (event: ShopEvent) => {
    setSaving(true);
    try {
      const existingIndex = events.findIndex(e => e.id === event.id);
      let newEvents: ShopEvent[];
      if (existingIndex >= 0) {
        newEvents = events.map(e => e.id === event.id ? { ...event, updatedAt: new Date().toISOString() } : e);
      } else {
        newEvents = [...events, event];
      }
      await saveConfig({ ...config, events: newEvents });
      setEvents(newEvents);
      setEditingEvent(null);
      showToast('success', existingIndex >= 0 ? 'อัปเดตอีเวนต์แล้ว' : 'สร้างอีเวนต์แล้ว');
    } catch {
      showToast('error', 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (event: ShopEvent) => {
    const result = await Swal.fire({
      title: 'ยืนยันการลบ?',
      text: `ลบ "${event.title}" ออกจากระบบ`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'ลบ',
      cancelButtonText: 'ยกเลิก',
      background: 'var(--surface-2)',
      color: 'var(--foreground)',
    });
    if (!result.isConfirmed) return;

    setSaving(true);
    try {
      const newEvents = events.filter(e => e.id !== event.id);
      await saveConfig({ ...config, events: newEvents });
      setEvents(newEvents);
      showToast('success', 'ลบอีเวนต์แล้ว');
    } catch {
      showToast('error', 'ลบไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (event: ShopEvent) => {
    const newEvents = events.map(e => e.id === event.id ? { ...e, enabled: !e.enabled } : e);
    setEvents(newEvents);
    try {
      await saveConfig({ ...config, events: newEvents });
      showToast('success', event.enabled ? 'ปิดอีเวนต์แล้ว' : 'เปิดอีเวนต์แล้ว');
    } catch {
      showToast('error', 'บันทึกไม่สำเร็จ');
      setEvents(events); // rollback
    }
  };

  const handleImageUpload = async (file: File) => {
    if (!editingEvent) return;
    // Client-side validation
    if (!file.type.startsWith('image/')) {
      showToast('error', 'กรุณาเลือกไฟล์รูปภาพเท่านั้น');
      return;
    }
    setUploadingImage(true);
    try {
      const url = await onImageUpload(file);
      if (url) {
        setEditingEvent(prev => prev ? { ...prev, imageUrl: url } : null);
        showToast('success', 'อัปโหลดรูปสำเร็จ');
      }
    } catch (err: any) {
      showToast('error', err?.message || 'อัปโหลดรูปไม่สำเร็จ');
    } finally {
      setUploadingImage(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        mb: 3, flexWrap: 'wrap', gap: 2,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{
            width: 44, height: 44, borderRadius: '14px',
            background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
            display: 'grid', placeItems: 'center',
            boxShadow: '0 4px 16px rgba(251,191,36,0.3)',
          }}>
            <Sparkles size={22} color="#fff" />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: '1.3rem', color: 'var(--foreground)' }}>
              อีเวนต์ & โปรโมชั่น
            </Typography>
            <Typography sx={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              จัดการแบนเนอร์โฆษณาและอีเวนต์ ({events.length} รายการ)
            </Typography>
          </Box>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add size={18} />}
          onClick={() => setEditingEvent(createNewEvent())}
          sx={{
            borderRadius: '12px',
            textTransform: 'none',
            fontWeight: 700,
            background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
            color: '#000',
            px: 2.5,
            '&:hover': { background: 'linear-gradient(135deg, #f59e0b, #d97706)' },
          }}
        >
          สร้างอีเวนต์ใหม่
        </Button>
      </Box>

      {/* Events List */}
      {events.length === 0 ? (
        <Box sx={{
          py: 8, textAlign: 'center',
          borderRadius: '20px',
          bgcolor: 'var(--surface-2)',
          border: '1px solid var(--glass-border)',
        }}>
          <Sparkles size={56} style={{ opacity: 0.2, marginBottom: 16, color: 'var(--text-muted)' }} />
          <Typography sx={{ color: 'var(--text-muted)', fontSize: '1.1rem', fontWeight: 600 }}>
            ยังไม่มีอีเวนต์
          </Typography>
          <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.85rem', mt: 0.5 }}>
            สร้างอีเวนต์แรกเพื่อโปรโมทสินค้า
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {events.sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99)).map((event) => {
            const typeInfo = EVENT_TYPE_OPTIONS.find(t => t.value === event.type) || EVENT_TYPE_OPTIONS[0];
            const nowMs = Date.now();
            const endMs = event.endDate ? new Date(event.endDate).getTime() : NaN;
            const isExpired = !isNaN(endMs) && endMs <= nowMs;
            const isActive = event.enabled && !isExpired;

            return (
              <Box key={event.id} sx={{
                p: 2, borderRadius: '16px',
                bgcolor: 'var(--surface-2)',
                border: `1px solid ${isActive ? event.color + '30' : 'var(--glass-border)'}`,
                opacity: isExpired ? 0.6 : 1,
                transition: 'all 0.2s ease',
                '&:hover': { borderColor: event.color + '50' },
              }}>
                <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, alignItems: { xs: 'stretch', sm: 'flex-start' } }}>
                  {/* Thumbnail */}
                  {event.imageUrl && (
                    <Box sx={{
                      width: { xs: '100%', sm: 80 }, height: { xs: 120, sm: 56 }, borderRadius: '10px', overflow: 'hidden',
                      flexShrink: 0, border: '1px solid var(--glass-border)',
                    }}>
                      <img src={event.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </Box>
                  )}

                  {/* Content */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
                      <Chip
                        icon={EVENT_TYPE_ICON_MAP[typeInfo.icon]}
                      label={typeInfo.label}
                        size="small"
                        sx={{
                          bgcolor: typeInfo.color + '18',
                          color: typeInfo.color,
                          fontWeight: 700,
                          fontSize: '0.7rem',
                          height: 22,
                        }}
                      />
                      {event.badge && (
                        <Chip label={event.badge} size="small" sx={{
                          bgcolor: event.color + '18', color: event.color,
                          fontWeight: 700, fontSize: '0.7rem', height: 22,
                        }} />
                      )}
                      {isExpired && (
                        <Chip label="หมดอายุ" size="small" sx={{
                          bgcolor: 'rgba(239,68,68,0.1)', color: '#ef4444',
                          fontWeight: 700, fontSize: '0.65rem', height: 20,
                        }} />
                      )}
                      <Chip
                        label={event.enabled ? 'เปิด' : 'ปิด'}
                        size="small"
                        sx={{
                          bgcolor: event.enabled ? 'rgba(16,185,129,0.1)' : 'rgba(107,114,128,0.1)',
                          color: event.enabled ? '#10b981' : '#6b7280',
                          fontWeight: 700, fontSize: '0.65rem', height: 20,
                        }}
                      />
                    </Box>

                    <Typography sx={{
                      fontWeight: 700, fontSize: '1rem', color: 'var(--foreground)',
                      mb: 0.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {event.title || '(ไม่มีชื่อ)'}
                    </Typography>

                    {event.description && (
                      <Typography sx={{
                        fontSize: '0.8rem', color: 'var(--text-muted)',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {event.description}
                      </Typography>
                    )}

                    {/* Date info */}
                    <Box sx={{ display: 'flex', gap: 1.5, mt: 0.5, flexWrap: 'wrap' }}>
                      {event.startDate && (
                        <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 0.3 }}>
                          <CalendarIcon size={11} /> เริ่ม: {new Date(event.startDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}{' '}
                          {new Date(event.startDate).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                        </Typography>
                      )}
                      {event.endDate && (
                        <Typography sx={{ fontSize: '0.7rem', color: isExpired ? '#ef4444' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 0.3 }}>
                          <AccessTime size={11} /> สิ้นสุด: {new Date(event.endDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}{' '}
                          {new Date(event.endDate).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                        </Typography>
                      )}
                    </Box>
                  </Box>

                  {/* Actions */}
                  <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0, alignSelf: { xs: 'flex-end', sm: 'flex-start' } }}>
                    <Tooltip title={event.enabled ? 'ปิดอีเวนต์' : 'เปิดอีเวนต์'}>
                      <IconButton size="small" onClick={() => handleToggle(event)}
                        sx={{ color: event.enabled ? '#10b981' : 'var(--text-muted)' }}>
                        {event.enabled ? <ToggleOn size={18} /> : <ToggleOff size={18} />}
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="แก้ไข">
                      <IconButton size="small" onClick={() => setEditingEvent({ ...event })}
                        sx={{ color: 'var(--text-muted)', '&:hover': { color: '#0071e3' } }}>
                        <Edit size={16} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="ลบ">
                      <IconButton size="small" onClick={() => handleDelete(event)}
                        sx={{ color: 'var(--text-muted)', '&:hover': { color: '#ef4444' } }}>
                        <Delete size={16} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>
              </Box>
            );
          })}
        </Box>
      )}

      {/* Edit/Create Dialog */}
      <Dialog
        open={!!editingEvent}
        onClose={() => !saving && setEditingEvent(null)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: 'var(--surface)',
            borderRadius: '20px',
            border: '1px solid var(--glass-border)',
            maxHeight: '90vh',
          },
        }}
      >
        {editingEvent && (
          <>
            <DialogTitle sx={{ borderBottom: '1px solid var(--glass-border)', pb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={{
                  width: 40, height: 40, borderRadius: '12px',
                  background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
                  display: 'grid', placeItems: 'center',
                }}>
                  <Sparkles size={20} color="#fff" />
                </Box>
                <Box>
                  <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--foreground)' }}>
                    {events.some(e => e.id === editingEvent.id) ? 'แก้ไขอีเวนต์' : 'สร้างอีเวนต์ใหม่'}
                  </Typography>
                </Box>
              </Box>
            </DialogTitle>

            <DialogContent sx={{ py: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* Enable toggle */}
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--foreground)' }}>
                  เปิดใช้งาน
                </Typography>
                <Switch
                  checked={editingEvent.enabled}
                  onChange={e => setEditingEvent(prev => prev ? { ...prev, enabled: e.target.checked } : null)}
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': { color: '#10b981' },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#10b981' },
                  }}
                />
              </Box>

              {/* Type selector */}
              <Box>
                <Typography sx={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--foreground)', mb: 1 }}>
                  ประเภท
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {EVENT_TYPE_OPTIONS.map(opt => (
                    <Chip
                      key={opt.value}
                      icon={EVENT_TYPE_ICON_MAP[opt.icon]}
                      label={opt.label}
                      onClick={() => setEditingEvent(prev => prev ? { ...prev, type: opt.value as ShopEvent['type'] } : null)}
                      sx={{
                        bgcolor: editingEvent.type === opt.value ? opt.color + '20' : 'var(--glass-bg)',
                        color: editingEvent.type === opt.value ? opt.color : 'var(--text-muted)',
                        border: editingEvent.type === opt.value ? `2px solid ${opt.color}50` : '2px solid transparent',
                        fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        '&:hover': { bgcolor: opt.color + '15' },
                      }}
                    />
                  ))}
                </Box>
              </Box>

              {/* Title */}
              <TextField
                fullWidth
                label="ชื่ออีเวนต์ / โปรโมชั่น"
                value={editingEvent.title}
                onChange={e => setEditingEvent(prev => prev ? { ...prev, title: e.target.value } : null)}
                placeholder="เช่น Flash Sale วันนี้เท่านั้น!"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '12px',
                    bgcolor: 'var(--surface)',
                    color: 'var(--foreground)',
                  },
                  '& .MuiInputLabel-root': { color: 'var(--text-muted)' },
                }}
              />

              {/* Description */}
              <TextField
                fullWidth
                multiline
                rows={2}
                label="รายละเอียด (ไม่บังคับ)"
                value={editingEvent.description || ''}
                onChange={e => setEditingEvent(prev => prev ? { ...prev, description: e.target.value } : null)}
                placeholder="รายละเอียดเพิ่มเติม..."
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '12px',
                    bgcolor: 'var(--surface)',
                    color: 'var(--foreground)',
                  },
                  '& .MuiInputLabel-root': { color: 'var(--text-muted)' },
                }}
              />

              {/* Badge */}
              <TextField
                fullWidth
                label="ป้ายข้อความ เช่น ลด 20%, ฟรีค่าส่ง"
                value={editingEvent.badge || ''}
                onChange={e => setEditingEvent(prev => prev ? { ...prev, badge: e.target.value } : null)}
                placeholder="ลด 30%"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '12px',
                    bgcolor: 'var(--surface)',
                    color: 'var(--foreground)',
                  },
                  '& .MuiInputLabel-root': { color: 'var(--text-muted)' },
                }}
              />

              {/* CTA */}
              <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5 }}>
                <TextField
                  fullWidth
                  label="ข้อความปุ่ม"
                  value={editingEvent.ctaText || ''}
                  onChange={e => setEditingEvent(prev => prev ? { ...prev, ctaText: e.target.value } : null)}
                  placeholder="ดูรายละเอียด"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '12px',
                      bgcolor: 'var(--surface)',
                      color: 'var(--foreground)',
                    },
                    '& .MuiInputLabel-root': { color: 'var(--text-muted)' },
                  }}
                />
                <TextField
                  fullWidth
                  label="ลิงก์ / Product ID"
                  value={editingEvent.ctaLink || ''}
                  onChange={e => setEditingEvent(prev => prev ? { ...prev, ctaLink: e.target.value } : null)}
                  placeholder="https://... หรือ product_id"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '12px',
                      bgcolor: 'var(--surface)',
                      color: 'var(--foreground)',
                    },
                    '& .MuiInputLabel-root': { color: 'var(--text-muted)' },
                  }}
                />
              </Box>

              {/* Dates */}
              <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5 }}>
                <TextField
                  fullWidth
                  label="วันเริ่มต้น"
                  type="datetime-local"
                  value={isoToLocalDatetime(editingEvent.startDate)}
                  onChange={e => setEditingEvent(prev => prev ? { ...prev, startDate: localDatetimeToIso(e.target.value) } : null)}
                  InputLabelProps={{ shrink: true }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '12px',
                      bgcolor: 'var(--surface)',
                      color: 'var(--foreground)',
                    },
                    '& .MuiInputLabel-root': { color: 'var(--text-muted)' },
                    '& input': { color: 'var(--foreground)' },
                  }}
                />
                <TextField
                  fullWidth
                  label="วันสิ้นสุด"
                  type="datetime-local"
                  value={isoToLocalDatetime(editingEvent.endDate)}
                  onChange={e => setEditingEvent(prev => prev ? { ...prev, endDate: localDatetimeToIso(e.target.value) } : null)}
                  InputLabelProps={{ shrink: true }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '12px',
                      bgcolor: 'var(--surface)',
                      color: 'var(--foreground)',
                    },
                    '& .MuiInputLabel-root': { color: 'var(--text-muted)' },
                    '& input': { color: 'var(--foreground)' },
                  }}
                />
              </Box>

              {/* Discount Settings */}
              <Box sx={{ p: 2, borderRadius: '12px', bgcolor: 'rgba(255,69,58,0.08)', border: '1px solid rgba(255,69,58,0.2)' }}>
                <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: '#ff453a', mb: 1.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <LocalOffer size={16} /> ส่วนลดสินค้า (ลดราคาอัตโนมัติเมื่ออีเวนต์เปิด)
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5, mb: 1.5 }}>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    {([{ value: 'percent', label: 'ลด %' }, { value: 'fixed', label: 'ลด ฿' }] as const).map(opt => (
                      <Chip
                        key={opt.value}
                        label={opt.label}
                        onClick={() => setEditingEvent(prev => prev ? { ...prev, discountType: prev.discountType === opt.value ? undefined : opt.value } : null)}
                        sx={{
                          bgcolor: editingEvent.discountType === opt.value ? 'rgba(255,69,58,0.2)' : 'var(--surface)',
                          color: editingEvent.discountType === opt.value ? '#ff453a' : 'var(--text-muted)',
                          border: `1px solid ${editingEvent.discountType === opt.value ? 'rgba(255,69,58,0.4)' : 'var(--glass-border)'}`,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      />
                    ))}
                  </Box>
                  {editingEvent.discountType && (
                    <TextField
                      type="number"
                      label={editingEvent.discountType === 'percent' ? 'เปอร์เซ็นต์ลด' : 'จำนวนเงินลด (฿)'}
                      value={editingEvent.discountValue || ''}
                      onChange={e => setEditingEvent(prev => prev ? { ...prev, discountValue: Number(e.target.value) || 0 } : null)}
                      inputProps={{ min: 0, max: editingEvent.discountType === 'percent' ? 100 : 99999 }}
                      size="small"
                      sx={{
                        width: 160,
                        '& .MuiOutlinedInput-root': { borderRadius: '10px', bgcolor: 'var(--surface)', color: 'var(--foreground)' },
                        '& .MuiInputLabel-root': { color: 'var(--text-muted)' },
                      }}
                    />
                  )}
                </Box>

                {/* Linked Products */}
                <Typography sx={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-muted)', mb: 0.75 }}>
                  สินค้าที่เข้าร่วม (คลิกเพื่อเลือก/ยกเลิก)
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', maxHeight: 150, overflowY: 'auto' }}>
                  {(config.products || []).map(p => {
                    const isLinked = editingEvent.linkedProducts?.includes(p.id);
                    return (
                      <Chip
                        key={p.id}
                        label={`${p.name}${p.basePrice ? ` ฿${p.basePrice}` : ''}`}
                        size="small"
                        onClick={() => setEditingEvent(prev => {
                          if (!prev) return null;
                          const current = prev.linkedProducts || [];
                          const next = isLinked ? current.filter(id => id !== p.id) : [...current, p.id];
                          return { ...prev, linkedProducts: next };
                        })}
                        sx={{
                          bgcolor: isLinked ? 'rgba(255,69,58,0.15)' : 'var(--surface)',
                          color: isLinked ? '#ff453a' : 'var(--text-muted)',
                          border: `1px solid ${isLinked ? 'rgba(255,69,58,0.4)' : 'var(--glass-border)'}`,
                          fontWeight: isLinked ? 700 : 500,
                          fontSize: '0.7rem',
                          cursor: 'pointer',
                        }}
                      />
                    );
                  })}
                </Box>
                {editingEvent.linkedProducts?.length ? (
                  <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)', mt: 0.5 }}>
                    เลือก {editingEvent.linkedProducts.length} สินค้า
                    {editingEvent.discountType && editingEvent.discountValue ? ` • ลด${editingEvent.discountType === 'percent' ? ` ${editingEvent.discountValue}%` : ` ฿${editingEvent.discountValue}`}` : ''}
                  </Typography>
                ) : null}
              </Box>

              {/* Color picker */}
              <Box>
                <Typography sx={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--foreground)', mb: 1 }}>
                  สีธีม
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                  {EVENT_COLORS.map(c => (
                    <Box
                      key={c}
                      onClick={() => setEditingEvent(prev => prev ? { ...prev, color: c } : null)}
                      sx={{
                        width: 28, height: 28, borderRadius: '8px',
                        bgcolor: c, cursor: 'pointer',
                        border: editingEvent.color === c ? '3px solid var(--foreground)' : '2px solid transparent',
                        transition: 'all 0.15s ease',
                        '&:hover': { transform: 'scale(1.15)' },
                      }}
                    />
                  ))}
                </Box>
              </Box>

              {/* Image upload */}
              <Box>
                <Typography sx={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--foreground)', mb: 1 }}>
                  รูปแบนเนอร์
                </Typography>
                {editingEvent.imageUrl ? (
                  <Box sx={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--glass-border)' }}>
                    <img src={editingEvent.imageUrl} alt="" style={{ width: '100%', height: 150, objectFit: 'cover' }} />
                    <IconButton
                      onClick={() => setEditingEvent(prev => prev ? { ...prev, imageUrl: undefined } : null)}
                      sx={{
                        position: 'absolute', top: 8, right: 8,
                        bgcolor: 'rgba(0,0,0,0.5)', color: '#fff',
                        width: 28, height: 28,
                        '&:hover': { bgcolor: 'rgba(239,68,68,0.8)' },
                      }}
                    >
                      <Close size={14} />
                    </IconButton>
                  </Box>
                ) : (
                  <Button
                    component="label"
                    variant="outlined"
                    fullWidth
                    disabled={uploadingImage}
                    startIcon={uploadingImage ? <CircularProgress size={16} /> : <ImageIcon size={18} />}
                    sx={{
                      borderRadius: '12px',
                      borderStyle: 'dashed',
                      borderColor: 'var(--glass-border)',
                      color: 'var(--text-muted)',
                      py: 2,
                      textTransform: 'none',
                      fontWeight: 600,
                      '&:hover': { borderColor: '#fbbf24', color: '#fbbf24' },
                    }}
                  >
                    {uploadingImage ? 'กำลังอัปโหลด...' : 'เลือกรูปภาพ'}
                    <input
                      type="file"
                      hidden
                      accept="image/*"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(file);
                        e.target.value = '';
                      }}
                    />
                  </Button>
                )}
              </Box>

              {/* Priority */}
              <TextField
                fullWidth
                label="ลำดับการแสดง (ตัวเลขน้อย = แสดงก่อน)"
                type="number"
                value={editingEvent.priority ?? 0}
                onChange={e => setEditingEvent(prev => prev ? { ...prev, priority: parseInt(e.target.value) || 0 } : null)}
                InputProps={{ inputProps: { min: 0, max: 99 } }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '12px',
                    bgcolor: 'var(--surface)',
                    color: 'var(--foreground)',
                  },
                  '& .MuiInputLabel-root': { color: 'var(--text-muted)' },
                }}
              />
            </DialogContent>

            <DialogActions sx={{ borderTop: '1px solid var(--glass-border)', p: 2, gap: 1 }}>
              <Button
                onClick={() => setEditingEvent(null)}
                disabled={saving}
                sx={{ color: 'var(--text-muted)', borderRadius: '10px', textTransform: 'none' }}
              >
                ยกเลิก
              </Button>
              <Button
                variant="contained"
                onClick={() => handleSave(editingEvent)}
                disabled={saving || !editingEvent.title.trim()}
                startIcon={saving ? <CircularProgress size={16} /> : <Save size={16} />}
                sx={{
                  borderRadius: '10px',
                  textTransform: 'none',
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
                  color: '#000',
                  px: 3,
                  '&:hover': { background: 'linear-gradient(135deg, #f59e0b, #d97706)' },
                  '&.Mui-disabled': { opacity: 0.5 },
                }}
              >
                {saving ? 'กำลังบันทึก...' : 'บันทึก'}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
});

// ============== ANNOUNCEMENTS VIEW COMPONENT ==============
interface AnnouncementsViewProps {
  config: ShopConfig;
  saveConfig: (newConfig: ShopConfig) => Promise<void>;
  showToast: (type: 'success' | 'error' | 'info' | 'warning', message: string) => void;
  userEmail: string | null | undefined;
  onImageUpload: (file: File) => Promise<string | null>;
}

const AnnouncementsView = React.memo(function AnnouncementsView({
  config,
  saveConfig,
  showToast,
  userEmail,
  onImageUpload,
}: AnnouncementsViewProps) {
  const isSuperAdminUser = isSuperAdmin(userEmail ?? null);
  const [announcements, setAnnouncements] = React.useState<Announcement[]>(config.announcements || []);
  const [history, setHistory] = React.useState(config.announcementHistory || []);
  const [editingAnn, setEditingAnn] = React.useState<Announcement | null>(null);
  const [showHistory, setShowHistory] = React.useState(false);
  const [uploadingImage, setUploadingImage] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  // Sync from config
  React.useEffect(() => {
    setAnnouncements(config.announcements || []);
    setHistory(config.announcementHistory || []);
  }, [config.announcements, config.announcementHistory]);

  const createNewAnnouncement = (): Announcement => ({
    id: `ann_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    enabled: true,
    message: '',
    color: '#3b82f6',
    postedAt: new Date().toISOString(),
    postedBy: userEmail || 'แอดมิน',
    displayName: '',
    type: 'text',
    showLogo: true,
    priority: 0,
  });

  const handleAddNew = () => {
    setEditingAnn(createNewAnnouncement());
  };

  const handleEdit = (ann: Announcement) => {
    setEditingAnn({ ...ann });
  };

  const handleDelete = async (ann: Announcement) => {
    const result = await Swal.fire({
      title: 'ยืนยันการลบ?',
      text: 'ประกาศนี้จะถูกย้ายไปประวัติ',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'ลบ',
      cancelButtonText: 'ยกเลิก',
      background: 'var(--surface-2)',
      color: 'var(--foreground)',
    });

    if (result.isConfirmed) {
      setSaving(true);
      try {
        const newAnnouncements = announcements.filter(a => a.id !== ann.id);
        const newHistory = [
          {
            ...ann,
            deletedAt: new Date().toISOString(),
            deletedBy: userEmail || 'แอดมิน',
          },
          ...history,
        ].slice(0, 50); // Keep last 50

        await saveConfig({
          ...config,
          announcements: newAnnouncements,
          announcementHistory: newHistory,
        });

        setAnnouncements(newAnnouncements);
        setHistory(newHistory);
        showToast('success', 'ลบประกาศสำเร็จ');
      } catch (error) {
        showToast('error', 'ไม่สามารถลบประกาศได้');
      } finally {
        setSaving(false);
      }
    }
  };

  const handleToggleEnabled = async (ann: Announcement) => {
    setSaving(true);
    try {
      const newAnnouncements = announcements.map(a => 
        a.id === ann.id ? { ...a, enabled: !a.enabled } : a
      );
      await saveConfig({ ...config, announcements: newAnnouncements });
      setAnnouncements(newAnnouncements);
      showToast('success', ann.enabled ? 'ปิดประกาศแล้ว' : 'เปิดประกาศแล้ว');
    } catch (error) {
      showToast('error', 'ไม่สามารถเปลี่ยนสถานะได้');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAnnouncement = async () => {
    if (!editingAnn) return;
    if (!editingAnn.message && !editingAnn.imageUrl) {
      showToast('error', 'กรุณากรอกข้อความหรืออัพโหลดรูปภาพ');
      return;
    }

    setSaving(true);
    try {
      const isNew = !announcements.find(a => a.id === editingAnn.id);
      let newAnnouncements: Announcement[];

      if (isNew) {
        newAnnouncements = [editingAnn, ...announcements];
      } else {
        newAnnouncements = announcements.map(a => 
          a.id === editingAnn.id ? editingAnn : a
        );
      }

      await saveConfig({ ...config, announcements: newAnnouncements });
      setAnnouncements(newAnnouncements);
      setEditingAnn(null);
      showToast('success', isNew ? 'สร้างประกาศสำเร็จ' : 'แก้ไขประกาศสำเร็จ');
    } catch (error) {
      showToast('error', 'ไม่สามารถบันทึกประกาศได้');
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('error', 'กรุณาเลือกไฟล์รูปภาพเท่านั้น');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      showToast('error', 'ไฟล์รูปภาพต้องมีขนาดไม่เกิน 20MB (จะบีบอัดอัตโนมัติ)');
      return;
    }

    setUploadingImage(true);
    try {
      const imageUrl = await onImageUpload(file);
      if (imageUrl && editingAnn) {
        setEditingAnn({
          ...editingAnn,
          imageUrl,
          type: editingAnn.message ? 'both' : 'image',
        });
        showToast('success', 'อัพโหลดรูปภาพสำเร็จ');
      }
    } catch (err: any) {
      showToast('error', err?.message || 'อัพโหลดรูปภาพล้มเหลว');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRestoreFromHistory = async (histItem: typeof history[0]) => {
    const result = await Swal.fire({
      title: 'กู้คืนประกาศ?',
      text: 'ประกาศนี้จะถูกเพิ่มกลับไปยังรายการประกาศ',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'กู้คืน',
      cancelButtonText: 'ยกเลิก',
      background: 'var(--surface-2)',
      color: 'var(--foreground)',
    });

    if (result.isConfirmed) {
      setSaving(true);
      try {
        const restored: Announcement = {
          id: `ann_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          enabled: false,
          message: histItem.message,
          color: histItem.color,
          imageUrl: histItem.imageUrl,
          postedBy: userEmail || 'แอดมิน',
          displayName: histItem.displayName,
          postedAt: new Date().toISOString(),
          type: histItem.type,
          showLogo: true,
        };

        const newAnnouncements = [restored, ...announcements];
        const newHistory = history.filter(h => h.id !== histItem.id);

        await saveConfig({
          ...config,
          announcements: newAnnouncements,
          announcementHistory: newHistory,
        });

        setAnnouncements(newAnnouncements);
        setHistory(newHistory);
        showToast('success', 'กู้คืนประกาศสำเร็จ');
      } catch (error) {
        showToast('error', 'ไม่สามารถกู้คืนประกาศได้');
      } finally {
        setSaving(false);
      }
    }
  };

  const handleDeleteFromHistory = async (histItem: typeof history[0]) => {
    const result = await Swal.fire({
      title: 'ลบถาวร?',
      text: 'ประกาศนี้จะถูกลบออกจากประวัติอย่างถาวร',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'ลบถาวร',
      cancelButtonText: 'ยกเลิก',
      background: 'var(--surface-2)',
      color: 'var(--foreground)',
    });

    if (result.isConfirmed) {
      setSaving(true);
      try {
        const newHistory = history.filter(h => h.id !== histItem.id);
        await saveConfig({ ...config, announcementHistory: newHistory });
        setHistory(newHistory);
        showToast('success', 'ลบประวัติสำเร็จ');
      } catch (error) {
        showToast('error', 'ไม่สามารถลบประวัติได้');
      } finally {
        setSaving(false);
      }
    }
  };

  const activeCount = announcements.filter(a => a.enabled).length;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 900 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography sx={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: 1 }}>
            <NotificationsActive size={28} />
            จัดการประกาศ
          </Typography>
          <Typography sx={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            สร้าง แก้ไข และจัดการประกาศทั้งหมด • {announcements.length} รายการ ({activeCount} เปิดอยู่)
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Button
            onClick={() => setShowHistory(true)}
            sx={{
              ...secondaryButtonSx,
              gap: 1,
            }}
          >
            <Archive size={18} />
            ประวัติ ({history.length})
          </Button>
          <Button
            onClick={handleAddNew}
            sx={{
              ...gradientButtonSx,
              gap: 1,
            }}
          >
            <Add size={20} />
            สร้างประกาศใหม่
          </Button>
        </Box>
      </Box>

      {/* Active Announcements List */}
      {announcements.length === 0 ? (
        <Box sx={{
          ...glassCardSx,
          p: 6,
          textAlign: 'center',
        }}>
          <Announcement size={64} color="#334155" style={{ marginBottom: 16 }} />
          <Typography sx={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-muted)', mb: 1 }}>
            ยังไม่มีประกาศ
          </Typography>
          <Typography sx={{ fontSize: '0.85rem', color: 'var(--text-muted)', mb: 3 }}>
            คลิกปุ่ม "สร้างประกาศใหม่" เพื่อเริ่มต้น
          </Typography>
          <Button onClick={handleAddNew} sx={gradientButtonSx}>
            <Add style={{ marginRight: 8 }} /> สร้างประกาศแรก
          </Button>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {announcements.map((ann) => (
            <Box
              key={ann.id}
              sx={{
                ...glassCardSx,
                p: 0,
                overflow: 'hidden',
                opacity: ann.enabled ? 1 : 0.6,
                border: ann.enabled ? `1px solid ${ann.color}40` : `1px solid ${ADMIN_THEME.border}`,
              }}
            >
              {/* Color bar */}
              <Box sx={{ height: 4, bgcolor: ann.color }} />
              
              <Box sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                  {/* Image preview */}
                  {ann.imageUrl && (
                    <Box
                      component="img"
                      src={ann.imageUrl}
                      alt="Announcement"
                      sx={{
                        width: 80,
                        height: 60,
                        objectFit: 'cover',
                        borderRadius: '8px',
                        flexShrink: 0,
                      }}
                    />
                  )}

                  {/* Content */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <Box
                        sx={{
                          px: 1,
                          py: 0.25,
                          borderRadius: '6px',
                          bgcolor: ann.enabled ? 'rgba(16, 185, 129, 0.15)' : 'rgba(100, 116, 139, 0.15)',
                          color: ann.enabled ? '#10b981' : '#64748b',
                          fontSize: '0.7rem',
                          fontWeight: 600,
                        }}
                      >
                        {ann.enabled ? 'เปิดอยู่' : 'ปิดอยู่'}
                      </Box>
                      <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {new Date(ann.postedAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </Typography>
                    </Box>
                    
                    <Typography sx={{ 
                      color: 'var(--foreground)', 
                      fontSize: '0.9rem',
                      whiteSpace: 'pre-wrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}>
                      {ann.message || '(รูปภาพอย่างเดียว)'}
                    </Typography>

                    {ann.displayName && (
                      <Typography sx={{ fontSize: '0.75rem', color: 'var(--text-muted)', mt: 0.5 }}>
                        ประกาศโดย: {ann.displayName}
                      </Typography>
                    )}
                  </Box>

                  {/* Actions */}
                  <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                    <Tooltip title={ann.enabled ? 'ปิดประกาศ' : 'เปิดประกาศ'}>
                      <IconButton
                        size="small"
                        onClick={() => handleToggleEnabled(ann)}
                        disabled={saving}
                        sx={{ 
                          color: ann.enabled ? '#10b981' : '#64748b',
                          '&:hover': { bgcolor: 'rgba(16, 185, 129, 0.1)' },
                        }}
                      >
                        {ann.enabled ? <ToggleOn /> : <ToggleOff />}
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="แก้ไข">
                      <IconButton
                        size="small"
                        onClick={() => handleEdit(ann)}
                        sx={{ color: '#3b82f6', '&:hover': { bgcolor: 'rgba(59, 130, 246, 0.1)' } }}
                      >
                        <Edit size={18} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="ลบ">
                      <IconButton
                        size="small"
                        onClick={() => handleDelete(ann)}
                        disabled={saving}
                        sx={{ color: '#ef4444', '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.1)' } }}
                      >
                        <Delete size={18} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>
              </Box>
            </Box>
          ))}
        </Box>
      )}

      {/* Edit/Create Dialog */}
      <Dialog
        open={!!editingAnn}
        onClose={() => setEditingAnn(null)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: ADMIN_THEME.bgCard,
            backdropFilter: 'blur(20px)',
            border: `1px solid ${ADMIN_THEME.border}`,
            borderRadius: '16px',
          },
        }}
      >
        <DialogTitle sx={{ 
          borderBottom: `1px solid ${ADMIN_THEME.border}`,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
        }}>
          <Box sx={{
            width: 40,
            height: 40,
            borderRadius: '12px',
            bgcolor: editingAnn?.id?.startsWith('ann_') && !announcements.find(a => a.id === editingAnn?.id) ? '#10b981' : '#3b82f6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {announcements.find(a => a.id === editingAnn?.id) ? <Edit color="#fff" /> : <Add color="#fff" />}
          </Box>
          <Typography sx={{ fontWeight: 700, color: 'var(--foreground)' }}>
            {announcements.find(a => a.id === editingAnn?.id) ? 'แก้ไขประกาศ' : 'สร้างประกาศใหม่'}
          </Typography>
        </DialogTitle>

        <DialogContent sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          {editingAnn && (
            <>
              {/* Enable Toggle */}
              <SettingToggleRow
                label="เปิดใช้งานประกาศ"
                description="เมื่อเปิด ประกาศจะแสดงบนหน้าร้าน"
                checked={editingAnn.enabled}
                onChange={(checked) => setEditingAnn({ ...editingAnn, enabled: checked })}
              />

              {/* Type Selection */}
              <Box>
                <Typography sx={{ fontSize: '0.8rem', color: 'var(--text-muted)', mb: 1 }}>ประเภทประกาศ</Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {[
                    { value: 'text', label: 'ข้อความ', icon: <FileTextIcon size={14} /> },
                    { value: 'image', label: 'รูปภาพ', icon: <ImageIcon size={14} /> },
                    { value: 'both', label: 'ทั้งสอง', icon: <><FileTextIcon size={14} /><ImageIcon size={14} /></> },
                  ].map(option => (
                    <Box
                      key={option.value}
                      onClick={() => setEditingAnn({ ...editingAnn, type: option.value as any })}
                      sx={{
                        flex: 1,
                        py: 1.5,
                        borderRadius: '10px',
                        cursor: 'pointer',
                        textAlign: 'center',
                        bgcolor: (editingAnn.type ?? 'text') === option.value 
                          ? 'rgba(139, 92, 246, 0.3)' 
                          : 'rgba(255,255,255,0.05)',
                        border: `2px solid ${(editingAnn.type ?? 'text') === option.value 
                          ? '#8b5cf6' 
                          : 'transparent'}`,
                        transition: 'all 0.2s ease',
                        '&:hover': { bgcolor: 'rgba(139, 92, 246, 0.15)' },
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5, color: (editingAnn.type ?? 'text') === option.value ? '#fff' : '#94a3b8' }}>
                        {option.icon}
                      </Box>
                      <Typography sx={{ 
                        fontSize: '0.85rem', 
                        fontWeight: 600,
                        color: (editingAnn.type ?? 'text') === option.value ? '#fff' : '#94a3b8',
                      }}>
                        {option.label}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Box>

              {/* Message Input */}
              {((editingAnn.type ?? 'text') === 'text' || editingAnn.type === 'both') && (
                <TextField
                  label="ข้อความประกาศ"
                  multiline
                  rows={4}
                  value={editingAnn.message}
                  onChange={(e) => setEditingAnn({ ...editingAnn, message: e.target.value })}
                  fullWidth
                  placeholder="พิมพ์ข้อความประกาศ..."
                  inputProps={{ maxLength: 500 }}
                  helperText={`${editingAnn.message.length}/500 ตัวอักษร`}
                  sx={inputSx}
                />
              )}

              {/* Image Upload */}
              {((editingAnn.type ?? 'text') === 'image' || editingAnn.type === 'both') && (
                <Box>
                  <Typography sx={{ fontSize: '0.8rem', color: 'var(--text-muted)', mb: 1 }}>รูปภาพประกาศ</Typography>
                  {editingAnn.imageUrl ? (
                    <Box sx={{ position: 'relative' }}>
                      <Box
                        component="img"
                        src={editingAnn.imageUrl}
                        alt="Announcement"
                        sx={{
                          width: '100%',
                          maxHeight: 200,
                          objectFit: 'cover',
                          borderRadius: '12px',
                          border: `1px solid ${ADMIN_THEME.border}`,
                        }}
                      />
                      <IconButton
                        onClick={() => setEditingAnn({ ...editingAnn, imageUrl: undefined, type: editingAnn.message ? 'text' : 'text' })}
                        sx={{
                          position: 'absolute',
                          top: 8,
                          right: 8,
                          bgcolor: 'rgba(239, 68, 68, 0.9)',
                          color: '#fff',
                          '&:hover': { bgcolor: '#ef4444' },
                        }}
                        size="small"
                      >
                        <Delete size={18} />
                      </IconButton>
                    </Box>
                  ) : (
                    <Button
                      component="label"
                      disabled={uploadingImage}
                      sx={{
                        ...secondaryButtonSx,
                        py: 3,
                        width: '100%',
                        border: `2px dashed ${ADMIN_THEME.border}`,
                        bgcolor: 'transparent',
                        '&:hover': { borderColor: '#8b5cf6' },
                      }}
                    >
                      {uploadingImage ? (
                        <CircularProgress size={24} sx={{ color: '#8b5cf6' }} />
                      ) : (
                        <>
                          <ImageIcon size={24} style={{ marginRight: 8 }} />
                          คลิกเพื่ออัพโหลดรูปภาพ (สูงสุด 5MB)
                        </>
                      )}
                      <input
                        type="file"
                        hidden
                        accept="image/*"
                        onChange={handleImageUpload}
                      />
                    </Button>
                  )}
                </Box>
              )}

              {/* Display Name */}
              <TextField
                label="ชื่อที่แสดงในประกาศ"
                value={editingAnn.displayName || ''}
                onChange={(e) => setEditingAnn({ ...editingAnn, displayName: e.target.value })}
                fullWidth
                size="small"
                placeholder="เช่น ทีมงาน PSU SCC Shop"
                helperText="ถ้าไม่ระบุจะแสดงเป็น 'แอดมิน'"
                sx={inputSx}
              />

              {/* Show Logo Toggle */}
              <SettingToggleRow
                label="แสดงโลโก้เว็บไซต์"
                description="แสดงโลโก้ของเว็บไซต์ในประกาศ"
                checked={editingAnn.showLogo ?? true}
                onChange={(checked) => setEditingAnn({ ...editingAnn, showLogo: checked })}
              />

              {/* Special Announcement */}
              <Box sx={{
                p: 2,
                borderRadius: '12px',
                bgcolor: 'rgba(251,191,36,0.08)',
                border: `1px solid rgba(251,191,36,0.2)`,
              }}>
                <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#fbbf24', mb: 1.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Sparkles size={16} /> ข้อความพิเศษ
                </Typography>
                <SettingToggleRow
                  label="ประกาศพิเศษ"
                  description="เน้นการแสดงผล ขอบเรืองแสง + ไอคอนพิเศษ"
                  checked={editingAnn.isSpecial ?? false}
                  onChange={(checked) => setEditingAnn({ ...editingAnn, isSpecial: checked })}
                />
                {editingAnn.isSpecial && (
                  <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    <TextField
                      label="ไอคอน Emoji"
                      value={editingAnn.specialIcon || ''}
                      onChange={(e) => setEditingAnn({ ...editingAnn, specialIcon: e.target.value.slice(0, 4) })}
                      placeholder="🔥 🎉 ⚡ 🎊 💥 📢"
                      size="small"
                      helperText="เลือก emoji ที่ต้องการแสดง (ว่าง = ✨)"
                      sx={inputSx}
                    />
                    <TextField
                      label="ลิงก์แนบ (ไม่บังคับ)"
                      value={editingAnn.link || ''}
                      onChange={(e) => setEditingAnn({ ...editingAnn, link: e.target.value })}
                      placeholder="https://..."
                      size="small"
                      sx={inputSx}
                    />
                    {editingAnn.link && (
                      <TextField
                        label="ข้อความปุ่มลิงก์"
                        value={editingAnn.linkText || ''}
                        onChange={(e) => setEditingAnn({ ...editingAnn, linkText: e.target.value })}
                        placeholder="ดูเพิ่มเติม →"
                        size="small"
                        sx={inputSx}
                      />
                    )}
                  </Box>
                )}
              </Box>

              {/* Color Picker */}
              <Box>
                <Typography sx={{ fontSize: '0.8rem', color: 'var(--text-muted)', mb: 1.5 }}>สีพื้นหลัง</Typography>
                <Box sx={{ 
                  height: 40, 
                  borderRadius: '12px', 
                  bgcolor: editingAnn.color,
                  mb: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
                }}>
                  <Typography sx={{ fontSize: '0.8rem', color: '#fff', fontWeight: 600, textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                    {editingAnn.color}
                  </Typography>
                </Box>
                <Box sx={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(10, 1fr)', 
                  gap: 0.75,
                  p: 1.5,
                  borderRadius: '12px',
                  bgcolor: 'var(--glass-bg)',
                  border: `1px solid ${ADMIN_THEME.border}`,
                }}>
                  {PRESET_COLORS.map(color => (
                    <Box
                      key={color}
                      onClick={() => setEditingAnn({ ...editingAnn, color })}
                      sx={{
                        width: '100%',
                        aspectRatio: '1',
                        borderRadius: '8px',
                        bgcolor: color,
                        cursor: 'pointer',
                        border: editingAnn.color === color ? '3px solid #fff' : '2px solid transparent',
                        boxShadow: editingAnn.color === color ? `0 0 10px ${color}` : 'none',
                        transition: 'all 0.2s ease',
                        '&:hover': { transform: 'scale(1.15)' },
                      }}
                    />
                  ))}
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 2 }}>
                  <TextField
                    size="small"
                    value={editingAnn.color}
                    onChange={(e) => {
                      if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) {
                        setEditingAnn({ ...editingAnn, color: e.target.value });
                      }
                    }}
                    placeholder="#3b82f6"
                    sx={{ flex: 1, ...inputSx }}
                  />
                  <input
                    type="color"
                    value={editingAnn.color}
                    onChange={(e) => setEditingAnn({ ...editingAnn, color: e.target.value })}
                    style={{ width: 45, height: 45, padding: 0, border: 'none', borderRadius: '10px', cursor: 'pointer' }}
                  />
                </Box>
              </Box>

              {/* Preview */}
              {(editingAnn.message || editingAnn.imageUrl) && (
                <Box sx={{ mt: 1 }}>
                  <Typography sx={{ fontSize: '0.75rem', color: 'var(--text-muted)', mb: 1 }}>ตัวอย่างการแสดงผล:</Typography>
                  <Box sx={{ p: 2, borderRadius: '12px', bgcolor: editingAnn.color }}>
                    {editingAnn.imageUrl && (
                      <Box
                        component="img"
                        src={editingAnn.imageUrl}
                        alt="Preview"
                        sx={{ width: '100%', maxHeight: 120, objectFit: 'cover', borderRadius: '8px', mb: editingAnn.message ? 1.5 : 0 }}
                      />
                    )}
                    {editingAnn.message && (
                      <Typography sx={{ fontSize: '0.9rem', color: '#fff', whiteSpace: 'pre-wrap', textAlign: 'center' }}>
                        {editingAnn.message}
                      </Typography>
                    )}
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1, mt: 1 }}>
                      {editingAnn.showLogo && (
                        <Box component="img" src="/logo.png" alt="Logo" className="theme-logo" sx={{ width: 20, height: 20, borderRadius: '4px' }} onError={(e: any) => { e.target.style.display = 'none'; }} />
                      )}
                      <Typography sx={{ fontSize: '0.7rem', color: 'var(--foreground)' }}>
                        — {editingAnn.displayName || 'แอดมิน'}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              )}
            </>
          )}
        </DialogContent>

        <DialogActions sx={{ borderTop: `1px solid ${ADMIN_THEME.border}`, p: 2, gap: 1 }}>
          <Button onClick={() => setEditingAnn(null)} sx={secondaryButtonSx}>
            ยกเลิก
          </Button>
          <Button
            onClick={handleSaveAnnouncement}
            disabled={saving || (!editingAnn?.message && !editingAnn?.imageUrl)}
            sx={gradientButtonSx}
          >
            {saving ? <CircularProgress size={20} sx={{ mr: 1 }} /> : <Save style={{ marginRight: 8 }} />}
            บันทึก
          </Button>
        </DialogActions>
      </Dialog>

      {/* History Dialog */}
      <Dialog
        open={showHistory}
        onClose={() => setShowHistory(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: ADMIN_THEME.bgCard,
            backdropFilter: 'blur(20px)',
            border: `1px solid ${ADMIN_THEME.border}`,
            borderRadius: '16px',
            maxHeight: '80vh',
          },
        }}
      >
        <DialogTitle sx={{ 
          borderBottom: `1px solid ${ADMIN_THEME.border}`,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
        }}>
          <Box sx={{
            width: 40,
            height: 40,
            borderRadius: '12px',
            bgcolor: '#8b5cf6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <History color="#fff" />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 700, color: 'var(--foreground)' }}>ประวัติประกาศ</Typography>
            <Typography sx={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ประกาศที่ถูกลบไปแล้ว {history.length} รายการ</Typography>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ p: 0 }}>
          {history.length === 0 ? (
            <Box sx={{ p: 6, textAlign: 'center' }}>
              <Archive size={64} color="#334155" style={{ marginBottom: 16 }} />
              <Typography sx={{ color: 'var(--text-muted)' }}>ยังไม่มีประวัติประกาศ</Typography>
            </Box>
          ) : (
            <Box sx={{ py: 2 }}>
              {history.map((item, idx) => (
                <Box
                  key={item.id || idx}
                  sx={{
                    mx: 2,
                    mb: 2,
                    p: 2,
                    borderRadius: '12px',
                    bgcolor: 'rgba(255,255,255,0.03)',
                    border: `1px solid ${ADMIN_THEME.border}`,
                    position: 'relative',
                  }}
                >
                  <Box sx={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 4, bgcolor: item.color, borderRadius: '12px 0 0 12px' }} />
                  
                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                    {item.imageUrl && (
                      <Box component="img" src={item.imageUrl} alt="" sx={{ width: 60, height: 45, objectFit: 'cover', borderRadius: '8px' }} />
                    )}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          ลบเมื่อ: {item.deletedAt ? new Date(item.deletedAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                        </Typography>
                      </Box>
                      <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.85rem', whiteSpace: 'pre-wrap', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {item.message || '(รูปภาพอย่างเดียว)'}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <Tooltip title="กู้คืน">
                        <IconButton size="small" onClick={() => handleRestoreFromHistory(item)} disabled={saving} sx={{ color: '#10b981' }}>
                          <ContentCopy size={18} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="ลบถาวร">
                        <IconButton size="small" onClick={() => handleDeleteFromHistory(item)} disabled={saving} sx={{ color: '#ef4444' }}>
                          <Delete size={18} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                </Box>
              ))}
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ borderTop: `1px solid ${ADMIN_THEME.border}`, p: 2 }}>
          <Button onClick={() => setShowHistory(false)} sx={secondaryButtonSx}>ปิด</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
});

// ============== MAIN COMPONENT ==============
export default function AdminPage(): JSX.Element {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Tab-to-hash mapping for URL persistence
  const TAB_HASH_MAP: Record<number, string> = {
    0: 'dashboard',
    1: 'products',
    2: 'orders',
    3: 'pickup',
    4: 'support',
    5: 'announce',
    6: 'settings',
    7: 'email',
    8: 'user-logs',
    9: 'logs',
    10: 'shipping',
    11: 'payment',
    12: 'tracking',
    14: 'events',
    15: 'promo',
  };
  const HASH_TAB_MAP: Record<string, number> = Object.fromEntries(
    Object.entries(TAB_HASH_MAP).map(([k, v]) => [v, Number(k)])
  );

  // Read initial tab from URL hash
  const getInitialTab = (): number => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace('#', '');
      if (hash && HASH_TAB_MAP[hash] !== undefined) {
        return HASH_TAB_MAP[hash];
      }
    }
    return 0;
  };

  const [activeTab, setActiveTabState] = useState<number>(getInitialTab);
  
  // Custom setActiveTab that also updates URL hash
  const setActiveTab = useCallback((tab: number) => {
    setActiveTabState(tab);
    const hash = TAB_HASH_MAP[tab];
    if (hash && typeof window !== 'undefined') {
      window.history.replaceState(null, '', `#${hash}`);
    }
  }, []);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const toastTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const [realtimeIsConnected, setRealtimeIsConnected] = useState(false);

  // Available OAuth providers
  const [availableProviders, setAvailableProviders] = useState<string[]>(['google']);

  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [logs, setLogs] = useState<any[][]>([]);
  const [config, setConfig] = useState<ShopConfig>(DEFAULT_CONFIG);
  const [lastSavedTime, setLastSavedTime] = useState<Date | null>(null);
  const [sheetSyncing, setSheetSyncing] = useState(false);
  const [orderProcessingRef, setOrderProcessingRef] = useState<string | null>(null);
  // Settings state (moved from SettingsView to prevent re-render issues)
  const [settingsLocalConfig, setSettingsLocalConfig] = useState<ShopConfig>(DEFAULT_CONFIG);
  const [settingsHasChanges, setSettingsHasChanges] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [orderEditor, setOrderEditor] = useState<{
    open: boolean;
    ref: string;
    name: string;
    email: string;
    amount: number;
    status: string;
    date: string;
    cart: CartItemAdmin[];
  }>({
    open: false,
    ref: '',
    name: '',
    email: '',
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
  // Orders filter state (moved from OrdersView to prevent re-render issues)
  const [orderFilterStatus, setOrderFilterStatus] = useState<string>('ALL');
  // Slip viewer state
  const [slipViewerOpen, setSlipViewerOpen] = useState(false);
  const [slipViewerData, setSlipViewerData] = useState<{ ref: string; slip?: AdminOrder['slip'] } | null>(null);
  const isDesktop = useMediaQuery('(min-width:900px)');
  const hasInitialData = orders.length > 0 || (config.products || []).length > 0 || logs.length > 0 || !!lastSavedTime;
  const fetchInFlightRef = useRef(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Check authorization including dynamic admin list from config
  const isAuthorized = useMemo(() => {
    const email = session?.user?.email;
    if (!email) return false;
    const normalized = email.trim().toLowerCase();
    // Check static admin list
    if (isAdmin(normalized)) return true;
    // Check dynamic admin list from loaded config
    const dynamicAdmins = (config.adminEmails || []).map(e => e.trim().toLowerCase());
    return dynamicAdmins.includes(normalized);
  }, [session?.user?.email, config.adminEmails]);

  // Calculate admin permissions
  const userEmail = session?.user?.email?.toLowerCase() ?? '';
  const isSuperAdminUser = isSuperAdmin(session?.user?.email ?? null);
  const adminPerms = useMemo(() => {
    return config.adminPermissions?.[userEmail] 
      ? { ...DEFAULT_ADMIN_PERMISSIONS, ...config.adminPermissions[userEmail] }
      : { ...DEFAULT_ADMIN_PERMISSIONS };
  }, [config.adminPermissions, userEmail]);

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
  const canSendEmail = isSuperAdminUser || adminPerms.canSendEmail;
  
  const isSessionLoading = status === 'loading';
  const isDataLoading = loading && !hasInitialData;

  const showToast = useCallback((type: 'success' | 'error' | 'info' | 'warning', message: string) => {
    const id = `${type}-${message}`;
    
    setToasts((prev) => {
      if (prev.some((t) => t.id === id)) return prev;
      return [...prev, { id, type, message }].slice(-3);
    });
    
    if (toastTimeoutsRef.current.has(id)) {
      clearTimeout(toastTimeoutsRef.current.get(id)!);
    }
    toastTimeoutsRef.current.set(id, setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      toastTimeoutsRef.current.delete(id);
    }, 3000));
  }, []);

  const addLog = useCallback((action: string, detail: string, overrides?: { config?: ShopConfig; orders?: AdminOrder[] }) => {
    const entry: any[] = [new Date().toISOString(), session?.user?.email || 'system', action, detail];
    setLogs((prev) => {
      const next = [entry, ...prev].slice(0, 200);
      saveAdminCache({
        config: overrides?.config ?? config,
        orders: overrides?.orders ?? orders,
        logs: next,
      });
      return next;
    });
  }, [session?.user?.email, config, orders]);

  // 📥 SWR Data Handler - processes data from SWR hook
  const handleSWRDataReceived = useCallback((data: { orders: any[]; config: any; logs: any[] }) => {
    const normalizedOrders = Array.isArray(data.orders) 
      ? data.orders.map(normalizeOrder).filter((o) => o.ref) 
      : [];
    const nextConfig = data.config || DEFAULT_CONFIG;
    let nextLogs = data.logs || [];
    
    if ((!nextLogs || nextLogs.length === 0) && normalizedOrders.length > 0) {
      nextLogs = normalizedOrders.slice(0, 50).map((o) => [
        o.date || new Date().toISOString(),
        o.email || o.name || 'system',
        'ORDER',
        `${o.ref} : ${o.status}`
      ]);
    }
    
    // Only update state if data actually changed to prevent flickering
    setConfig(prev => {
      const prevJson = JSON.stringify(prev);
      const nextJson = JSON.stringify(nextConfig);
      return prevJson === nextJson ? prev : nextConfig;
    });
    setDynamicAdminEmails(nextConfig.adminEmails || []);
    setOrders(prev => {
      const prevKey = prev.map(o => `${o.ref}:${o.status}:${o.slip?.base64 || o.slip?.imageUrl ? '1' : '0'}`).join(',');
      const nextKey = normalizedOrders.map(o => `${o.ref}:${o.status}:${o.slip?.base64 || o.slip?.imageUrl ? '1' : '0'}`).join(',');
      return prevKey === nextKey ? prev : normalizedOrders;
    });
    setLogs(prev => {
      if (prev.length === nextLogs.length && prev.length > 0) {
        const prevFirst = JSON.stringify(prev[0]);
        const nextFirst = JSON.stringify(nextLogs[0]);
        if (prevFirst === nextFirst) return prev;
      }
      return nextLogs;
    });
    
    setLastSavedTime(new Date());
    saveAdminCache({ config: nextConfig, orders: normalizedOrders, logs: nextLogs });
  }, []);

  // 📥 SWR Hook for Admin Data (replaces manual fetchData)
  const { 
    isLoading: swrLoading, 
    isRefreshing: swrRefreshing,
    refresh: swrRefresh,
    invalidate: swrInvalidate,
    applyRealtimeOrderChange,
  } = useAdminDataSWR({
    enabled: status === 'authenticated',
    onDataReceived: handleSWRDataReceived,
    onError: (error) => {
      const isNetworkError = error?.message?.includes('Failed to fetch') || 
                            error?.message?.includes('NETWORK_ERROR');
      if (isNetworkError) {
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
  const fetchData = useCallback(async (opts?: { silent?: boolean }) => {
    await swrRefresh(opts);
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
    } catch (error: any) {
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

  // Toggle order expansion (show cart items)
  const toggleOrderExpand = (ref: string) => {
    setExpandedOrders(prev => {
      const next = new Set(prev);
      if (next.has(ref)) {
        next.delete(ref);
      } else {
        next.add(ref);
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
    const imagesToUpload: { productIndex: number; field: 'coverImage' | 'images'; imageIndex?: number; base64: string }[] = [];
    
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
          const res = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              base64: item.base64,
              filename: `product_${item.productIndex}_${Date.now()}.png`,
              mime: 'image/png',
            }),
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
        } catch (err: any) {
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
          }
        }
      });
    }

    console.log(`✅ Image upload complete`);
    return updatedProducts;
  };

  // 💾 Save Config
  const saveFullConfig = useCallback(async (newConfig: ShopConfig) => {
    setSaving(true);
    
    try {
      // Upload images first if any are base64
      const productsWithUrls = await uploadImagesToStorage(newConfig.products || []);
      let configWithUrls = { ...newConfig, products: productsWithUrls };
      
      // Add announcement to history if it has content and is enabled
      const currentAnnouncement = configWithUrls.announcement;
      const previousAnnouncement = config?.announcement;
      
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
      
      // Save to local state/cache immediately for instant UI feedback
      setConfig(configWithUrls);
      setLastSavedTime(new Date());
      saveAdminCache({ config: configWithUrls, orders, logs });

      // Save to server
      const res = await saveShopConfig(configWithUrls, session?.user?.email || '');
      if (res.status !== 'success') {
        throw new Error((res as any).message || 'บันทึกไม่สำเร็จ');
      }
      
      addLog('SAVE_CONFIG', 'บันทึกการตั้งค่า', { config: configWithUrls });
    } catch (error: any) {
      console.error('❌ Save error:', error);
      showToast('error', error?.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  }, [orders, logs, showToast, session?.user?.email, addLog, config?.announcement]);

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
    } catch (error: any) {
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
    } catch (error: any) {
      if (!opts?.silent) {
        showToast('error', error?.message || 'ซิงก์ Sheet ไม่สำเร็จ');
      }
    } finally {
      setSheetSyncing(false);
    }
  }, [config, orders, logs, saveFullConfig, showToast]);

  const resetOrderEditor = () => setOrderEditor({ open: false, ref: '', name: '', email: '', amount: 0, status: 'PENDING', date: '', cart: [] });

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
    
    // Recalculate unit price
    updatedItem.unitPrice = calculateItemUnitPrice(updatedItem, product);
    
    newCart[idx] = updatedItem;
    setOrderEditor(prev => ({ ...prev, cart: newCart }));
  };

  const openOrderEditor = (order: AdminOrder) => {
    setOrderEditor({
      open: true,
      ref: order.ref,
      name: order.name,
      email: order.email,
      amount: order.amount,
      status: order.status,
      date: order.date ? new Date(order.date).toISOString().slice(0, 16) : '',
      cart: order.cart || [],
    });
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
      
      const payload: Record<string, any> = {
        name: sanitizeInput(orderEditor.name),
        email: sanitizeInput(orderEditor.email),
        amount: cartTotal > 0 ? cartTotal : (Number(orderEditor.amount) || 0),
        date: orderEditor.date ? new Date(orderEditor.date).toISOString() : undefined,
        cart: orderEditor.cart,
      };
      
      // Only include status if it's different from existing
      const existingOrder = orders.find(o => o.ref === orderEditor.ref);
      if (existingOrder && existingOrder.status !== orderEditor.status) {
        payload.status = normalizeStatusKey(orderEditor.status);
      }

      const res = await updateOrderAdmin(orderEditor.ref, payload, session?.user?.email || '');
      if (res.status !== 'success') throw new Error(res.message || 'แก้ไขออเดอร์ไม่สำเร็จ');

      const nextOrders = orders.map((o) => o.ref === orderEditor.ref
        ? { ...o, ...payload, amount: payload.amount, raw: { ...(o.raw || {}), ...payload } }
        : o);
      setOrders(nextOrders);
      saveAdminCache({ config, orders: nextOrders, logs });
      addLog('EDIT_ORDER', `${orderEditor.ref}`, { orders: nextOrders });
      resetOrderEditor();
      triggerSheetSync('sync', { silent: true });
    } catch (error: any) {
      showToast('error', error?.message || 'แก้ไขออเดอร์ไม่สำเร็จ');
    } finally {
      setOrderProcessingRef(null);
    }
  };

  const deleteOrder = async (order: AdminOrder, hard = false) => {
    const confirmation = await Swal.fire({
      icon: 'warning',
      title: hard ? 'ลบออเดอร์ถาวร?' : 'ยกเลิกออเดอร์?',
      text: hard ? 'ข้อมูลจะถูกลบออกจากระบบถาวร' : 'สถานะจะถูกเปลี่ยนเป็น CANCELLED',
      showCancelButton: true,
      confirmButtonText: hard ? 'ลบเลย' : 'ยืนยัน',
      cancelButtonText: 'ปิด',
      confirmButtonColor: hard ? '#ef4444' : '#22c55e',
    });
    if (!confirmation.isConfirmed) return;

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
    } catch (error: any) {
      showToast('error', error?.message || 'ลบออเดอร์ไม่สำเร็จ');
    } finally {
      setOrderProcessingRef(null);
    }
  };
  // Fetch available OAuth providers
  useEffect(() => {
    fetch('/api/auth/available-providers')
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

  // Check authorization after config loads (includes dynamic admin list)
  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.email) return;
    if (loading) return; // Wait for config to load
    
    // Now check with loaded config (including dynamic admins)
    const email = session.user.email.trim().toLowerCase();
    const staticAdmin = isAdmin(email);
    const dynamicAdmins = (config.adminEmails || []).map(e => e.trim().toLowerCase());
    const dynamicAdmin = dynamicAdmins.includes(email);
    
    if (!staticAdmin && !dynamicAdmin) {
      Swal.fire({
        icon: 'error',
        title: 'ไม่มีสิทธิ์เข้าถึง',
        text: 'บัญชีของคุณไม่มีสิทธิ์เข้าถึงหน้านี้',
        confirmButtonText: 'กลับหน้าหลัก',
        didClose: () => router.push('/')
      });
    }
  }, [status, session, loading, config.adminEmails, router]);

  // 🔁 Lightweight polling for fresher data
  // ⚠️ Pause polling when order editor is open to prevent flickering
  // ℹ️ Now uses Supabase Realtime as primary, polling as fallback
  
  // Stable refs for realtime handler to avoid stale closures
  const configRef = useRef(config);
  const logsRef = useRef(logs);
  useEffect(() => { configRef.current = config; }, [config]);
  useEffect(() => { logsRef.current = logs; }, [logs]);

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

  // Handle realtime config changes from other admins
  const handleRealtimeConfigChange = useCallback((newConfig: any) => {
    console.log('[Admin Realtime] Config updated by another admin');
    if (newConfig) {
      setConfig(prev => {
        const prevJson = JSON.stringify(prev);
        const nextJson = JSON.stringify(newConfig);
        return prevJson === nextJson ? prev : newConfig;
      });
    }
  }, []);

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
        const prevJson = JSON.stringify(prev);
        const nextJson = JSON.stringify(config);
        return prevJson === nextJson ? prev : config;
      });
    }
  }, [config, settingsHasChanges]);

  // ✅ No Permission View
  const NoPermissionView = ({ permission }: { permission: string }): JSX.Element => (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center',
      minHeight: 300,
      textAlign: 'center',
      p: 4,
    }}>
      <Box sx={{
        width: 80,
        height: 80,
        borderRadius: '20px',
        bgcolor: 'rgba(239,68,68,0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        mb: 3,
      }}>
        <Lock size={40} color="#ef4444" />
      </Box>
      <Typography sx={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--foreground)', mb: 1 }}>
        ไม่มีสิทธิ์เข้าถึง
      </Typography>
      <Typography sx={{ fontSize: '0.9rem', color: 'var(--text-muted)', mb: 2 }}>
        คุณไม่มีสิทธิ์ในการ{permission}
      </Typography>
      <Typography sx={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        กรุณาติดต่อ Super Admin เพื่อขอสิทธิ์เพิ่มเติม
      </Typography>
    </Box>
  );

  // ✅ View Components
  const DashboardView = (): JSX.Element => {
    const validOrders = orders.filter(o => o.status !== 'CANCELLED');
    const totalSales = validOrders.reduce((sum, o) => sum + (Number(o.amount) || 0), 0);
    const pendingOrders = orders.filter(o => ['WAITING_PAYMENT', 'PENDING'].includes(o.status)).length;
    const paidOrders = orders.filter(o => o.status === 'PAID').length;
    const readyOrders = orders.filter(o => ['READY', 'SHIPPED'].includes(o.status)).length;
    const completedOrders = orders.filter(o => o.status === 'COMPLETED').length;
    const cancelledOrders = orders.filter(o => o.status === 'CANCELLED').length;

    const statsData = [
      { 
        label: 'ยอดขายรวม', 
        value: `฿${totalSales.toLocaleString()}`, 
        subtitle: `${validOrders.length} ออเดอร์`,
        gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        iconBg: 'rgba(16,185,129,0.2)',
        icon: <AttachMoney size={28} color="#34d399" />,
      },
      { 
        label: 'รอชำระเงิน', 
        value: `${pendingOrders}`, 
        subtitle: 'รายการ',
        gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
        iconBg: 'rgba(245,158,11,0.2)',
        icon: <DateRange size={28} color="#fbbf24" />,
      },
      { 
        label: 'ชำระแล้ว', 
        value: `${paidOrders}`, 
        subtitle: 'พร้อมจัดส่ง',
        gradient: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
        iconBg: 'rgba(59,130,246,0.2)',
        icon: <CheckCircle size={28} color="#60a5fa" />,
      },
      { 
        label: 'จัดส่งแล้ว', 
        value: `${readyOrders + completedOrders}`, 
        subtitle: 'เสร็จสมบูรณ์',
        gradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
        iconBg: 'rgba(139,92,246,0.2)',
        icon: <LocalShipping size={28} color="#a78bfa" />,
      },
    ];

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* Welcome Header */}
        <Box sx={{ 
          p: 3, 
          borderRadius: '20px', 
          background: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(139,92,246,0.1) 100%)',
          border: '1px solid rgba(99,102,241,0.2)',
        }}>
          <Typography sx={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--foreground)', mb: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
            <WavingHand size={24} color="#fbbf24" />
            ยินดีต้อนรับ, {session?.user?.name?.split(' ')[0] || 'Admin'}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Typography sx={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              จัดการร้านค้าและออเดอร์ของคุณได้ที่นี่ • อัพเดทล่าสุด: {lastSavedTime?.toLocaleTimeString('th-TH') || 'กำลังโหลด...'}
            </Typography>
            {/* Realtime Status Indicator */}
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 0.5, 
              px: 1.5, 
              py: 0.5, 
              borderRadius: '20px',
              bgcolor: realtimeConnected ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
              border: `1px solid ${realtimeConnected ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`,
            }}>
              <Box sx={{ 
                width: 8, 
                height: 8, 
                borderRadius: '50%', 
                bgcolor: realtimeConnected ? '#10b981' : '#f59e0b',
                animation: realtimeConnected ? 'pulse 2s infinite' : 'none',
                '@keyframes pulse': {
                  '0%, 100%': { opacity: 1 },
                  '50%': { opacity: 0.5 },
                },
              }} />
              <Typography sx={{ fontSize: '0.7rem', color: realtimeConnected ? '#10b981' : '#f59e0b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {realtimeConnected ? <><Radio size={10} /> Live</> : <><Timer size={10} /> Polling</>}
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Stats Grid - Modern Cards */}
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
          gap: 2,
        }}>
          {statsData.map((stat, idx) => (
            <Box
              key={idx}
              sx={{
                p: 2.5,
                borderRadius: '18px',
                bgcolor: ADMIN_THEME.glass,
                border: `1px solid ${ADMIN_THEME.border}`,
                backdropFilter: 'blur(20px)',
                position: 'relative',
                overflow: 'hidden',
                transition: 'all 0.2s ease',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
                },
              }}
            >
              {/* Background Glow */}
              <Box sx={{
                position: 'absolute',
                top: -20,
                right: -20,
                width: 80,
                height: 80,
                borderRadius: '50%',
                background: stat.gradient,
                opacity: 0.15,
                filter: 'blur(20px)',
              }} />
              
              <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2, position: 'relative' }}>
                <Box sx={{
                  width: 48,
                  height: 48,
                  borderRadius: '14px',
                  bgcolor: stat.iconBg,
                  display: 'grid',
                  placeItems: 'center',
                }}>
                  {stat.icon}
                </Box>
              </Box>
              
              <Typography sx={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--foreground)', lineHeight: 1, mb: 0.5 }}>
                {stat.value}
              </Typography>
              <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                {stat.label}
              </Typography>
              <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)', mt: 0.5 }}>
                {stat.subtitle}
              </Typography>
            </Box>
          ))}
        </Box>

        {/* Quick Status Overview */}
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          gap: 2,
        }}>
          {/* Order Status Breakdown */}
          <Box sx={{ ...glassCardSx, p: 3 }}>
            <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: 'var(--foreground)', mb: 2.5, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Receipt size={20} color="#a5b4fc" />
              สถานะออเดอร์
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {[
                { status: 'WAITING_PAYMENT', count: pendingOrders },
                { status: 'PAID', count: paidOrders },
                { status: 'READY', count: readyOrders },
                { status: 'COMPLETED', count: completedOrders },
                { status: 'CANCELLED', count: cancelledOrders },
              ].map((item) => {
                const theme = STATUS_THEME[item.status] || STATUS_THEME.PENDING;
                const total = orders.length || 1;
                const percent = Math.round((item.count / total) * 100);
                return (
                  <Box key={item.status} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box sx={{ 
                      width: 100, 
                      flexShrink: 0,
                      px: 1.5, 
                      py: 0.5, 
                      borderRadius: '8px', 
                      bgcolor: theme.bg, 
                      border: `1px solid ${theme.border}`,
                      textAlign: 'center',
                    }}>
                      <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: theme.text }}>
                        {item.status.replace('_', ' ')}
                      </Typography>
                    </Box>
                    <Box sx={{ flex: 1, height: 8, bgcolor: 'var(--glass-bg)', borderRadius: '4px', overflow: 'hidden' }}>
                      <Box sx={{ 
                        width: `${percent}%`, 
                        height: '100%', 
                        bgcolor: theme.text.replace('1)', '0.8)'),
                        borderRadius: '4px',
                        transition: 'width 0.5s ease',
                      }} />
                    </Box>
                    <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: theme.text, minWidth: 30, textAlign: 'right' }}>
                      {item.count}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          </Box>

          {/* Quick Actions */}
          <Box sx={{ ...glassCardSx, p: 3 }}>
            <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: 'var(--foreground)', mb: 2.5, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Bolt size={20} color="#fbbf24" />
              Quick Actions
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Button
                fullWidth
                onClick={() => setActiveTab(1)}
                sx={{
                  ...secondaryButtonSx,
                  justifyContent: 'flex-start',
                  gap: 1.5,
                }}
              >
                <ShoppingCart size={20} />
                จัดการสินค้า ({config.products?.length || 0} รายการ)
              </Button>
              <Button
                fullWidth
                onClick={() => setActiveTab(2)}
                sx={{
                  ...secondaryButtonSx,
                  justifyContent: 'flex-start',
                  gap: 1.5,
                }}
              >
                <Receipt size={20} />
                ดูออเดอร์ทั้งหมด ({orders.length} รายการ)
              </Button>
              <Button
                fullWidth
                onClick={() => triggerSheetSync(config.sheetId ? 'sync' : 'create')}
                disabled={sheetSyncing}
                sx={{
                  ...gradientButtonSx,
                  justifyContent: 'flex-start',
                  gap: 1.5,
                }}
              >
                <Bolt size={20} />
                {sheetSyncing ? 'กำลังซิงก์...' : 'ซิงก์ Google Sheet'}
              </Button>
            </Box>
          </Box>
        </Box>

        {/* Factory Production Summary - Size & Sleeve breakdown for PAID orders */}
        {(() => {
          const paidOrders = orders.filter(o => o.status === 'PAID');
          const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL', '7XL', '8XL', '9XL', '10XL'];
          const getSizeIndex = (size: string) => {
            const idx = sizeOrder.findIndex(s => size?.toUpperCase()?.includes(s));
            return idx === -1 ? 999 : idx;
          };

          const sizeCount: Record<string, number> = {};
          const sizeLongSleeveCount: Record<string, number> = {};
          const sizeShortSleeveCount: Record<string, number> = {};
          let totalItems = 0;

          paidOrders.forEach((o) => {
            const items = o?.items || o?.cart || [];
            items.forEach((item: any) => {
              const size = item.size || 'ไม่ระบุ';
              const qty = Number(item.quantity ?? 1) || 1;
              const isLongSleeve = item.options?.isLongSleeve || item.isLongSleeve || false;

              totalItems += qty;
              sizeCount[size] = (sizeCount[size] || 0) + qty;
              if (isLongSleeve) {
                sizeLongSleeveCount[size] = (sizeLongSleeveCount[size] || 0) + qty;
              } else {
                sizeShortSleeveCount[size] = (sizeShortSleeveCount[size] || 0) + qty;
              }
            });
          });

          const sortedSizes = Object.keys(sizeCount).sort((a, b) => getSizeIndex(a) - getSizeIndex(b));
          const totalShortSleeve = Object.values(sizeShortSleeveCount).reduce((a, b) => a + b, 0);
          const totalLongSleeve = Object.values(sizeLongSleeveCount).reduce((a, b) => a + b, 0);

          return (
            <Box sx={{ ...glassCardSx, p: 3 }}>
              <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: 'var(--foreground)', mb: 2.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                <LocalMall size={20} color="#f472b6" />
                สรุปการผลิต (ออเดอร์ชำระแล้ว)
              </Typography>
              
              {/* Summary Stats */}
              <Box sx={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(3, 1fr)', 
                gap: 2, 
                mb: 3,
                p: 2,
                borderRadius: '12px',
                bgcolor: 'rgba(99,102,241,0.1)',
                border: '1px solid rgba(99,102,241,0.2)',
              }}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography sx={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--foreground)' }}>{paidOrders.length}</Typography>
                  <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 0.5 }}><Inventory size={12} /> ออเดอร์</Typography>
                </Box>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography sx={{ fontSize: '1.5rem', fontWeight: 900, color: '#22d3ee' }}>{totalItems}</Typography>
                  <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 0.5 }}><Shirt size={12} /> ตัวทั้งหมด</Typography>
                </Box>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography sx={{ fontSize: '1.5rem', fontWeight: 900, color: '#a78bfa' }}>{sortedSizes.length}</Typography>
                  <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 0.5 }}><Ruler size={12} /> ไซส์</Typography>
                </Box>
              </Box>

              {/* Size Breakdown Table */}
              {sortedSizes.length > 0 ? (
                <Box sx={{ overflowX: 'auto' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', borderColor: ADMIN_THEME.border }}>ไซส์</TableCell>
                        <TableCell align="center" sx={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', borderColor: ADMIN_THEME.border }}>แขนสั้น</TableCell>
                        <TableCell align="center" sx={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', borderColor: ADMIN_THEME.border }}>แขนยาว</TableCell>
                        <TableCell align="center" sx={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', borderColor: ADMIN_THEME.border }}>รวม</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {sortedSizes.map((size) => (
                        <TableRow key={size} sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' } }}>
                          <TableCell sx={{ borderColor: ADMIN_THEME.border }}>
                            <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--foreground)' }}>{size}</Typography>
                          </TableCell>
                          <TableCell align="center" sx={{ borderColor: ADMIN_THEME.border }}>
                            <Typography sx={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{sizeShortSleeveCount[size] || 0}</Typography>
                          </TableCell>
                          <TableCell align="center" sx={{ borderColor: ADMIN_THEME.border }}>
                            <Typography sx={{ fontSize: '0.85rem', color: '#60a5fa' }}>{sizeLongSleeveCount[size] || 0}</Typography>
                          </TableCell>
                          <TableCell align="center" sx={{ borderColor: ADMIN_THEME.border }}>
                            <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, color: '#10b981' }}>{sizeCount[size]}</Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                      {/* Total Row */}
                      <TableRow sx={{ bgcolor: 'rgba(99,102,241,0.1)' }}>
                        <TableCell sx={{ borderColor: ADMIN_THEME.border }}>
                          <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#a5b4fc', display: 'flex', alignItems: 'center', gap: 0.5 }}><Target size={14} /> รวมทั้งหมด</Typography>
                        </TableCell>
                        <TableCell align="center" sx={{ borderColor: ADMIN_THEME.border }}>
                          <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--foreground)' }}>{totalShortSleeve}</Typography>
                        </TableCell>
                        <TableCell align="center" sx={{ borderColor: ADMIN_THEME.border }}>
                          <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, color: '#60a5fa' }}>{totalLongSleeve}</Typography>
                        </TableCell>
                        <TableCell align="center" sx={{ borderColor: ADMIN_THEME.border }}>
                          <Typography sx={{ fontSize: '1rem', fontWeight: 900, color: '#10b981' }}>{totalItems}</Typography>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </Box>
              ) : (
                <Typography sx={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', py: 3 }}>
                  ยังไม่มีออเดอร์ที่ชำระแล้ว
                </Typography>
              )}
            </Box>
          );
        })()}

        {/* Recent Orders - Modern Table */}
        <Box sx={{ ...glassCardSx, p: 0 }}>
          <Box sx={{ 
            px: 3, 
            py: 2.5, 
            borderBottom: `1px solid ${ADMIN_THEME.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: 1 }}>
              <LocalShipping size={20} color="#22d3ee" />
              ออเดอร์ล่าสุด
            </Typography>
            <Button
              size="small"
              onClick={() => setActiveTab(2)}
              sx={{ color: '#a5b4fc', fontSize: '0.8rem', textTransform: 'none' }}
            >
              ดูทั้งหมด →
            </Button>
          </Box>
          <Box sx={{ overflowX: 'auto' }}>
            <Table sx={{ minWidth: 600 }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', borderColor: ADMIN_THEME.border }}>REF</TableCell>
                  <TableCell sx={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', borderColor: ADMIN_THEME.border }}>ลูกค้า</TableCell>
                  <TableCell align="right" sx={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', borderColor: ADMIN_THEME.border }}>ยอด</TableCell>
                  <TableCell sx={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', borderColor: ADMIN_THEME.border }}>สถานะ</TableCell>
                  <TableCell sx={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', borderColor: ADMIN_THEME.border }}>วันที่</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {orders.slice(0, 5).map((order) => {
                  const theme = STATUS_THEME[order.status] || STATUS_THEME.PENDING;
                  return (
                    <TableRow 
                      key={order.ref} 
                      sx={{ 
                        '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' },
                        cursor: 'pointer',
                      }}
                      onClick={() => { setActiveTab(2); setSearchTerm(order.ref); }}
                    >
                      <TableCell sx={{ borderColor: ADMIN_THEME.border }}>
                        <Typography sx={{ fontSize: '0.8rem', fontFamily: 'monospace', color: '#a5b4fc', fontWeight: 600 }}>
                          {order.ref.slice(-8)}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ borderColor: ADMIN_THEME.border }}>
                        <Typography sx={{ fontSize: '0.85rem', color: 'var(--foreground)', fontWeight: 600 }}>
                          {order.name || '—'}
                        </Typography>
                        <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {order.email?.slice(0, 20) || ''}
                        </Typography>
                      </TableCell>
                      <TableCell align="right" sx={{ borderColor: ADMIN_THEME.border }}>
                        <Typography sx={{ fontSize: '0.9rem', color: '#10b981', fontWeight: 700 }}>
                          ฿{Number(order.amount).toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ borderColor: ADMIN_THEME.border }}>
                        <Box sx={{
                          display: 'inline-flex',
                          px: 1.5,
                          py: 0.5,
                          borderRadius: '8px',
                          bgcolor: theme.bg,
                          border: `1px solid ${theme.border}`,
                        }}>
                          <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: theme.text }}>
                            {order.status.replace('_', ' ')}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ borderColor: ADMIN_THEME.border }}>
                        <Typography sx={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {order.date ? new Date(order.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) : '-'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Box>
        </Box>
      </Box>
    );
  };

  // ============== PICKUP VIEW ==============
  // States for pickup view
  const [pickupSearch, setPickupSearch] = useState('');
  const [pickupSearchResults, setPickupSearchResults] = useState<any[]>([]);
  const [pickupSearching, setPickupSearching] = useState(false);
  const [pickupSelectedOrder, setPickupSelectedOrder] = useState<any | null>(null);
  const [pickupProcessing, setPickupProcessing] = useState(false);
  const [pickupCondition, setPickupCondition] = useState<'complete' | 'partial' | 'damaged'>('complete');
  const [pickupNotes, setPickupNotes] = useState('');
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
                fetch(`/api/pickup?search=${encodeURIComponent(orderRef)}`)
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
      } catch (err: any) {
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
      const res = await fetch(`/api/pickup?search=${encodeURIComponent(term.trim())}`);
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
  }, [showToast]);

  // Handle pickup confirmation
  const handlePickupConfirm = useCallback(async () => {
    if (!pickupSelectedOrder) return;
    
    setPickupProcessing(true);
    try {
      const res = await fetch('/api/pickup', {
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
        setPickupSelectedOrder(null);
        setPickupCondition('complete');
        setPickupNotes('');
        // Refresh search results
        if (pickupSearch) {
          searchPickupOrders(pickupSearch);
        }
        // Refresh orders list
        fetchData();
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
      const res = await fetch(`/api/pickup?search=${encodeURIComponent(ref)}`);
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

  // Memoize pickup data outside PickupView to avoid conditional hook calls
  const readyForPickup = useMemo(() => 
    orders.filter(o => ['READY', 'SHIPPED', 'PAID'].includes(normalizeStatusKey(o.status))),
    [orders]
  );
  
  const completedToday = useMemo(() => {
    const today = new Date().toDateString();
    return orders.filter(o => {
      if (normalizeStatusKey(o.status) !== 'COMPLETED') return false;
      const pickup = o.raw?.pickup;
      if (!pickup?.pickedUpAt) return false;
      return new Date(pickup.pickedUpAt).toDateString() === today;
    });
  }, [orders]);

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
            
            {/* Stats */}
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Box sx={{
                px: 1.5,
                py: 0.8,
                borderRadius: '12px',
                bgcolor: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: 0.8,
              }}>
                <LocalMall size={18} color="#10b981" />
                <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#10b981' }}>
                  รอรับ: {readyForPickup.length}
                </Typography>
              </Box>
              <Box sx={{
                px: 1.5,
                py: 0.8,
                borderRadius: '12px',
                bgcolor: 'rgba(99, 102, 241, 0.15)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: 0.8,
              }}>
                <CheckCircleOutline size={18} color="#818cf8" />
                <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#818cf8' }}>
                  วันนี้: {completedToday.length}
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
              const statusTheme = STATUS_THEME[normalizeStatusKey(order.status)] || STATUS_THEME.PENDING_PAYMENT;
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

        {/* Recent Ready Orders */}
        {!pickupSearch && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: 1 }}>
              <LocalMall size={20} color="#10b981" />
              ออเดอร์พร้อมรับ ({readyForPickup.length})
            </Typography>
            
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
                    pickup: order.raw?.pickup,
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
                      <video 
                        id="qr-video" 
                        style={{
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
                  <Typography sx={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--foreground)' }}>
                    ยืนยันการรับสินค้า
                  </Typography>
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

  // Memoize filtered orders outside the render function
  const filteredOrders = useMemo(() => {
    let filtered = orders;
    if (orderFilterStatus !== 'ALL') {
      filtered = orders.filter(o => normalizeStatusKey(o.status) === orderFilterStatus);
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
  }, [orderFilterStatus, searchTerm, orders]);

  const OrdersView = () => {

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, height: '100%' }}>
        {/* Sticky Header + Search */}
        <Box sx={{ 
          position: 'sticky',
          top: 0,
          zIndex: 10,
          bgcolor: ADMIN_THEME.bg,
          pb: 2,
          mx: { xs: -2, md: -3 },
          px: { xs: 2, md: 3 },
          pt: { xs: 0.5, md: 0 },
        }}>
          {/* Header */}
          <Box sx={{ 
            display: 'flex', 
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between', 
            alignItems: { xs: 'stretch', sm: 'center' }, 
            gap: 1.5,
            mb: 1.5,
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Inventory size={28} color="#a5b4fc" />
              <Box>
                <Typography sx={{ fontSize: { xs: '1.1rem', md: '1.5rem' }, fontWeight: 800, color: 'var(--foreground)', lineHeight: 1.2 }}>
                  ออเดอร์
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {filteredOrders.length}/{orders.length} รายการ
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8 }}>
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

          {/* Search - with inputRef to prevent focus loss */}
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
              mb: 1.5,
              '& .MuiOutlinedInput-root': {
                ...inputSx['& .MuiOutlinedInput-root'],
                borderRadius: '12px',
                py: 0.3,
              },
            }}
          />

          {/* Status Filters - Pill Style */}
          <Box sx={{ 
            display: 'flex', 
            gap: 0.8, 
            overflowX: 'auto', 
            pb: 0.5,
            mx: -0.5,
            px: 0.5,
            '&::-webkit-scrollbar': { height: 3 },
            '&::-webkit-scrollbar-track': { bgcolor: 'transparent' },
            '&::-webkit-scrollbar-thumb': { bgcolor: 'var(--glass-bg)', borderRadius: 2 },
          }}>
            {['ALL', ...ORDER_STATUSES].map((status) => {
              const isActive = orderFilterStatus === status;
              const count = status === 'ALL' ? orders.length : orders.filter(o => o.status === status).length;
              const theme = STATUS_THEME[status] || { bg: 'rgba(255,255,255,0.05)', text: 'var(--text-muted)', border: ADMIN_THEME.border };
              // Short labels for mobile
              const shortLabels: Record<string, string> = {
                'ALL': 'ทั้งหมด',
                'WAITING_PAYMENT': 'รอจ่าย',
                'PAID': 'จ่ายแล้ว',
                'READY': 'พร้อมส่ง',
                'SHIPPED': 'ส่งแล้ว',
                'COMPLETED': 'สำเร็จ',
                'CANCELLED': 'ยกเลิก',
                'REFUND_REQUESTED': 'ขอคืนเงิน',
                'REFUNDED': 'คืนแล้ว',
              };
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
                    color: isActive ? theme.text : '#64748b' 
                  }}>
                    {shortLabels[status] || status}
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
        </Box>

        {/* Orders List - Mobile-friendly Cards */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {filteredOrders.map(order => {
            const statusTheme = STATUS_THEME[normalizeStatusKey(order.status)] || STATUS_THEME.PENDING_PAYMENT;
            const isProcessing = orderProcessingRef === order.ref;
            const isSelected = selectedOrders.has(order.ref);
            const slipData = order.slip || order.raw?.slip;
            // Support both imageUrl (from SlipOK S3) and base64
            const hasSlip = !!(slipData && (slipData.imageUrl || slipData.base64));
            // Short status labels
            const shortStatus: Record<string, string> = {
              'WAITING_PAYMENT': 'รอจ่าย',
              'PAID': 'จ่ายแล้ว',
              'READY': 'พร้อมส่ง',
              'SHIPPED': 'ส่งแล้ว',
              'COMPLETED': 'สำเร็จ',
              'CANCELLED': 'ยกเลิก',
            };
            return (
              <Box
                key={order.ref}
                sx={{
                  ...glassCardSx,
                  p: 0,
                  overflow: 'hidden',
                  transition: 'all 0.2s ease',
                  opacity: isProcessing ? 0.6 : 1,
                  border: isSelected ? '2px solid rgba(99,102,241,0.6)' : `1px solid ${ADMIN_THEME.border}`,
                  '&:active': { transform: 'scale(0.99)' },
                }}
              >
                {/* Status Bar */}
                <Box sx={{
                  height: '3px',
                  background: `linear-gradient(90deg, ${statusTheme.text}, ${statusTheme.border})`,
                }} />
                
                <Box sx={{ p: { xs: 1.5, sm: 2.5 } }}>
                  {/* Compact Header: Checkbox + Ref + Status + Amount */}
                  <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 1,
                    mb: 1.5,
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, minWidth: 0, flex: 1 }}>
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
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: '#a5b4fc',
                      }}>
                        #{order.ref.slice(-6)}
                      </Typography>
                      <Box sx={{
                        px: 1,
                        py: 0.25,
                        borderRadius: '8px',
                        bgcolor: statusTheme.bg,
                        border: `1px solid ${statusTheme.border}`,
                        fontSize: '0.65rem',
                        fontWeight: 600,
                        color: statusTheme.text,
                        whiteSpace: 'nowrap',
                      }}>
                        {shortStatus[order.status] || order.status}
                      </Box>
                      {hasSlip && (
                        <IconButton
                          size="small"
                          onClick={(e) => { e.stopPropagation(); openSlipViewer(order); }}
                          sx={{ 
                            color: '#10b981',
                            p: 0.3,
                          }}
                        >
                          <ImageIcon size={16} />
                        </IconButton>
                      )}
                    </Box>
                    <Typography sx={{ 
                      fontSize: { xs: '1rem', sm: '1.2rem' }, 
                      fontWeight: 800, 
                      color: '#10b981',
                      whiteSpace: 'nowrap',
                    }}>
                      ฿{Number(order.amount).toLocaleString()}
                    </Typography>
                  </Box>

                  {/* Customer Info - Compact */}
                  <Box sx={{ 
                    display: 'flex', 
                    flexDirection: { xs: 'column', sm: 'row' },
                    gap: { xs: 0.5, sm: 2 },
                    mb: 1.5,
                    fontSize: '0.8rem',
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                      <Person size={16} color="#a78bfa" />
                      <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--foreground)' }}>
                        {order.name}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, overflow: 'hidden' }}>
                      <Email size={16} color="#60a5fa" style={{ flexShrink: 0 }} />
                      <Typography sx={{ 
                        fontSize: '0.8rem', 
                        color: 'var(--text-muted)',
                        textOverflow: 'ellipsis',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                      }}>
                        {order.email || '-'}
                      </Typography>
                    </Box>
                  </Box>

                  {/* Shipping Info - Always show shipping type */}
                  <Box sx={{ 
                    display: 'flex', 
                    flexWrap: 'wrap',
                    gap: 0.8,
                    mb: 1.5,
                    p: 1,
                    borderRadius: '10px',
                    bgcolor: 'rgba(59, 130, 246, 0.08)',
                    border: '1px solid rgba(59, 130, 246, 0.2)',
                  }}>
                    {/* Shipping Option */}
                    {order.shippingOption === 'pickup' || (order.shippingOption || '').toLowerCase().includes('รับ') ? (
                      <Chip
                        size="small"
                        icon={<Inventory size={14} />}
                        label={order.shippingOption === 'pickup' ? 'รับหน้าร้าน' : order.shippingOption}
                        sx={{
                          height: 24,
                          fontSize: '0.72rem',
                          bgcolor: 'rgba(16, 185, 129, 0.15)',
                          color: '#10b981',
                          border: '1px solid rgba(16, 185, 129, 0.3)',
                          '& .MuiChip-icon': { color: '#10b981' },
                        }}
                      />
                    ) : order.shippingOption === 'delivery_legacy' ? (
                      <Chip
                        size="small"
                        icon={<LocalShipping size={14} />}
                        label="จัดส่ง (เดิม)"
                        sx={{
                          height: 24,
                          fontSize: '0.72rem',
                          bgcolor: 'rgba(251, 191, 36, 0.15)',
                          color: '#fbbf24',
                          border: '1px solid rgba(251, 191, 36, 0.3)',
                          '& .MuiChip-icon': { color: '#fbbf24' },
                        }}
                      />
                    ) : order.shippingProvider ? (
                      <Chip
                        size="small"
                        icon={<LocalShipping size={14} />}
                        label={(SHIPPING_PROVIDERS as Record<string, any>)[order.shippingProvider]?.nameThai || order.shippingProvider}
                        sx={{
                          height: 24,
                          fontSize: '0.72rem',
                          bgcolor: 'rgba(96, 165, 250, 0.15)',
                          color: '#60a5fa',
                          border: '1px solid rgba(96, 165, 250, 0.3)',
                          '& .MuiChip-icon': { color: '#60a5fa' },
                        }}
                      />
                    ) : order.shippingOption ? (
                      <Chip
                        size="small"
                        icon={<LocalShipping size={14} />}
                        label={order.shippingOption === 'thailand_post_ems' ? 'EMS ไปรษณีย์ไทย' : order.shippingOption}
                        sx={{
                          height: 24,
                          fontSize: '0.72rem',
                          bgcolor: 'rgba(251, 191, 36, 0.15)',
                          color: '#fbbf24',
                          border: '1px solid rgba(251, 191, 36, 0.3)',
                          '& .MuiChip-icon': { color: '#fbbf24' },
                        }}
                      />
                    ) : (
                      <Chip
                        size="small"
                        icon={<Inventory size={14} />}
                        label="รับหน้าร้าน (เดิม)"
                        sx={{
                          height: 24,
                          fontSize: '0.72rem',
                          bgcolor: 'rgba(148, 163, 184, 0.15)',
                          color: 'var(--text-muted)',
                          border: '1px solid rgba(148, 163, 184, 0.3)',
                          '& .MuiChip-icon': { color: 'var(--text-muted)' },
                        }}
                      />
                    )}
                    {/* Tracking Number */}
                    {order.trackingNumber && (
                      <Chip
                        size="small"
                        label={`เลขพัสดุ: ${order.trackingNumber}`}
                        sx={{
                          height: 24,
                          fontSize: '0.72rem',
                          bgcolor: 'rgba(34, 211, 238, 0.15)',
                          color: '#22d3ee',
                          border: '1px solid rgba(34, 211, 238, 0.3)',
                          fontFamily: 'monospace',
                        }}
                      />
                    )}
                    {/* Address preview */}
                    {order.address && (
                      <Box sx={{ 
                        width: '100%', 
                        mt: 0.5, 
                        display: 'flex', 
                        alignItems: 'flex-start', 
                        gap: 0.5 
                      }}>
                        <Receipt size={14} color="#64748b" style={{ marginTop: 1.6, flexShrink: 0 }} />
                        <Typography sx={{ 
                          fontSize: '0.72rem', 
                          color: 'var(--text-muted)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                        }}>
                          {order.address}
                        </Typography>
                      </Box>
                    )}
                  </Box>

                  {/* Cart Items Preview - Compact */}
                  {((order.cart && order.cart.length > 0) || (order.items && order.items.length > 0)) && (
                    <Box sx={{ mt: 1.5 }}>
                      <Box 
                        onClick={() => toggleOrderExpand(order.ref)}
                        sx={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 0.8,
                          cursor: 'pointer',
                          py: 0.8,
                          px: 1.2,
                          borderRadius: '8px',
                          bgcolor: 'rgba(99, 102, 241, 0.08)',
                          border: '1px solid rgba(99, 102, 241, 0.2)',
                          transition: 'all 0.15s ease',
                          '&:active': { transform: 'scale(0.98)' },
                        }}
                      >
                        <ShoppingBag size={16} color="#818cf8" />
                        <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#a5b4fc', flex: 1 }}>
                          {(order.cart || order.items || []).length} รายการ
                        </Typography>
                        {expandedOrders.has(order.ref) ? (
                          <ExpandLess size={18} color="#818cf8" />
                        ) : (
                          <ExpandMore size={18} color="#818cf8" />
                        )}
                      </Box>
                      
                      {/* Expanded Cart Items - Compact */}
                      {expandedOrders.has(order.ref) && (
                        <Box sx={{ 
                          mt: 1, 
                          display: 'flex', 
                          flexDirection: 'column', 
                          gap: 0.8,
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
                                {/* Product Image */}
                                {product?.images?.[0] ? (
                                  <Box
                                    component="img"
                                    src={product.images[0]}
                                    alt={item.productName}
                                    sx={{
                                      width: 48,
                                      height: 48,
                                      borderRadius: '8px',
                                      objectFit: 'cover',
                                      border: '1px solid var(--glass-border)',
                                    }}
                                  />
                                ) : (
                                  <Box sx={{
                                    width: 48,
                                    height: 48,
                                    borderRadius: '8px',
                                    bgcolor: 'rgba(99, 102, 241, 0.15)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}>
                                    <Inventory size={20} color="#818cf8" />
                                  </Box>
                                )}
                                
                                {/* Item Details */}
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                  <Typography sx={{ 
                                    fontSize: '0.85rem', 
                                    fontWeight: 600, 
                                    color: 'var(--foreground)',
                                    mb: 0.3,
                                  }}>
                                    {item.productName || product?.name || 'สินค้าไม่ระบุ'}
                                  </Typography>
                                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 0.5 }}>
                                    {item.size && (
                                      <Chip
                                        size="small"
                                        label={`ไซส์ ${item.size}`}
                                        sx={{
                                          height: 20,
                                          fontSize: '0.7rem',
                                          bgcolor: 'rgba(16, 185, 129, 0.15)',
                                          color: '#34d399',
                                          border: '1px solid rgba(16, 185, 129, 0.3)',
                                        }}
                                      />
                                    )}
                                    {item.options?.customName && (
                                      <Chip
                                        size="small"
                                        label={`ชื่อ: ${item.options?.customName}`}
                                        sx={{
                                          height: 20,
                                          fontSize: '0.7rem',
                                          bgcolor: 'rgba(251, 191, 36, 0.15)',
                                          color: '#fcd34d',
                                          border: '1px solid rgba(251, 191, 36, 0.3)',
                                        }}
                                      />
                                    )}
                                    {item.options?.customNumber && (
                                      <Chip
                                        size="small"
                                        label={`เบอร์: ${item.options?.customNumber}`}
                                        sx={{
                                          height: 20,
                                          fontSize: '0.7rem',
                                          bgcolor: 'rgba(244, 114, 182, 0.15)',
                                          color: '#f472b6',
                                          border: '1px solid rgba(244, 114, 182, 0.3)',
                                        }}
                                      />
                                    )}
                                    {item.options?.isLongSleeve && (
                                      <Chip
                                        size="small"
                                        label="แขนยาว"
                                        sx={{
                                          height: 20,
                                          fontSize: '0.7rem',
                                          bgcolor: 'rgba(99, 102, 241, 0.15)',
                                          color: '#a5b4fc',
                                          border: '1px solid rgba(99, 102, 241, 0.3)',
                                        }}
                                      />
                                    )}
                                  </Box>
                                  <Typography sx={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    จำนวน: {item.quantity} ชิ้น × ฿{Number(item.unitPrice).toLocaleString()}
                                  </Typography>
                                </Box>
                                
                                {/* Item Total */}
                                <Typography sx={{ 
                                  fontSize: '0.9rem', 
                                  fontWeight: 700, 
                                  color: '#10b981',
                                  whiteSpace: 'nowrap',
                                }}>
                                  ฿{(item.quantity * item.unitPrice).toLocaleString()}
                                </Typography>
                              </Box>
                            );
                          })}
                        </Box>
                      )}
                    </Box>
                  )}

                  {/* Date and Actions - Mobile Optimized */}
                  <Box sx={{
                    display: 'flex',
                    flexDirection: { xs: 'column', sm: 'row' },
                    justifyContent: 'space-between',
                    alignItems: { xs: 'stretch', sm: 'center' },
                    gap: 1,
                    pt: 1.5,
                    borderTop: `1px solid ${ADMIN_THEME.border}`,
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'var(--text-muted)' }}>
                      <CalendarToday size={12} />
                      <Typography sx={{ fontSize: '0.7rem' }}>
                        {order.date ? new Date(order.date).toLocaleDateString('th-TH', { 
                          day: 'numeric', 
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        }) : '-'}
                      </Typography>
                    </Box>
                    
                    <Box sx={{ display: 'flex', gap: 0.8, alignItems: 'center', justifyContent: { xs: 'space-between', sm: 'flex-end' } }}>
                      {/* Quick Status Change - Compact */}
                      <Select
                        value={order.status}
                        onChange={(e) => updateOrderStatus(order.ref, e.target.value)}
                        size="small"
                        disabled={isProcessing}
                        sx={{ 
                          minWidth: { xs: 100, sm: 120 },
                          fontSize: '0.7rem',
                          bgcolor: 'rgba(255,255,255,0.03)',
                          borderRadius: '8px',
                          '& .MuiOutlinedInput-notchedOutline': {
                            borderColor: ADMIN_THEME.border,
                          },
                          '& .MuiSelect-select': {
                            py: 0.5,
                            px: 1,
                            color: 'var(--foreground)',
                          },
                        }}
                      >
                        {ORDER_STATUSES.map(status => (
                          <MenuItem key={status} value={status} sx={{ fontSize: '0.75rem' }}>{status}</MenuItem>
                        ))}
                      </Select>

                      {/* Action Buttons - Compact */}
                      <Box sx={{
                        display: 'flex',
                        bgcolor: 'rgba(255,255,255,0.03)',
                        borderRadius: '8px',
                        border: `1px solid ${ADMIN_THEME.border}`,
                        overflow: 'hidden',
                      }}>
                        <IconButton
                          size="small"
                          onClick={() => openOrderEditor(order)}
                          disabled={isProcessing}
                          sx={{ 
                            color: '#60a5fa',
                            borderRadius: 0,
                            p: { xs: 0.6, sm: 0.8 },
                          }}
                        >
                          <EditIconMUI size={16} />
                        </IconButton>
                        <Box sx={{ width: '1px', bgcolor: ADMIN_THEME.border }} />
                        <IconButton
                          size="small"
                          onClick={() => deleteOrder(order, false)}
                          disabled={isProcessing}
                          sx={{ 
                            color: '#f59e0b',
                            borderRadius: 0,
                            p: { xs: 0.6, sm: 0.8 },
                          }}
                        >
                          <Close size={16} />
                        </IconButton>
                        <Box sx={{ width: '1px', bgcolor: ADMIN_THEME.border }} />
                        <IconButton
                          size="small"
                          onClick={() => deleteOrder(order, true)}
                          disabled={isProcessing}
                          sx={{ 
                            color: '#ef4444',
                            borderRadius: 0,
                            p: { xs: 0.6, sm: 0.8 },
                          }}
                        >
                          <Delete size={16} />
                        </IconButton>
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
        </Box>
      </Box>
    );
  };

  // Order Editor Dialog - rendered as JSX variable (not as component) to prevent remounting
  const orderEditorDialogElement = (
    <Dialog 
      open={orderEditor.open} 
      onClose={resetOrderEditor} 
      fullWidth 
      maxWidth="sm"
      PaperProps={{
        sx: {
          bgcolor: 'var(--surface)',
          backgroundImage: 'linear-gradient(135deg, rgba(139, 92, 246, 0.03) 0%, rgba(16, 185, 129, 0.03) 100%)',
          border: '1px solid var(--glass-border)',
          borderRadius: '20px',
          overflow: 'hidden',
        }
      }}
    >
      {/* Header */}
      <Box sx={{
        p: 3,
        pb: 2,
        background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%)',
        borderBottom: '1px solid var(--glass-border)',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
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
            <Typography sx={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--foreground)' }}>
              แก้ไขออเดอร์
            </Typography>
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

      <DialogContent sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: 2.5,
        p: 3,
      }}>
        {/* Customer Info Section */}
        <Box>
          <Typography sx={{ 
            fontSize: '0.75rem', 
            fontWeight: 600, 
            color: 'var(--text-muted)', 
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            mb: 1.5,
          }}>
            ข้อมูลลูกค้า
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="ชื่อลูกค้า"
              placeholder="กรอกชื่อ-นามสกุล"
              value={orderEditor.name}
              onChange={(e) => setOrderEditor(prev => ({ ...prev, name: e.target.value }))}
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
            <TextField
              label="วันที่"
              type="datetime-local"
              value={toDateTimeLocal(orderEditor.date)}
              onChange={(e) => setOrderEditor(prev => ({ ...prev, date: e.target.value }))}
              InputLabelProps={{ shrink: true }}
              fullWidth
              sx={{
                ...inputSx,
                '& .MuiOutlinedInput-root': {
                  ...inputSx['& .MuiOutlinedInput-root'],
                  borderRadius: '12px',
                },
              }}
            />
          </Box>
        </Box>

        {/* Cart Items Section */}
        {orderEditor.cart && orderEditor.cart.length > 0 && (
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
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Button
                  size="small"
                  onClick={() => {
                    // Recalculate all prices
                    const newCart = orderEditor.cart.map(item => {
                      const product = config.products?.find(p => p.id === item.productId);
                      return {
                        ...item,
                        unitPrice: calculateItemUnitPrice(item, product),
                      };
                    });
                    setOrderEditor(prev => ({ ...prev, cart: newCart }));
                  }}
                  sx={{
                    fontSize: '0.7rem',
                    color: '#f59e0b',
                    borderColor: 'rgba(245,158,11,0.3)',
                    '&:hover': { borderColor: '#f59e0b', bgcolor: 'rgba(245,158,11,0.1)' },
                  }}
                  variant="outlined"
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><RefreshCw size={12} /> คำนวณราคาใหม่</Box>
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
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {orderEditor.cart.map((item, idx) => {
                const product = config.products?.find(p => p.id === item.productId);
                return (
                  <Box 
                    key={item.id || idx}
                    sx={{
                      p: 2,
                      borderRadius: '14px',
                      bgcolor: 'rgba(255,255,255,0.03)',
                      border: `1px solid ${ADMIN_THEME.border}`,
                    }}
                  >
                    {/* Product Info Header */}
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 2 }}>
                      {product?.images?.[0] ? (
                        <Box
                          component="img"
                          src={product.images[0]}
                          alt={item.productName}
                          sx={{
                            width: 48,
                            height: 48,
                            borderRadius: '10px',
                            objectFit: 'cover',
                            border: '1px solid var(--glass-border)',
                          }}
                        />
                      ) : (
                        <Box sx={{
                          width: 48,
                          height: 48,
                          borderRadius: '10px',
                          bgcolor: 'rgba(99, 102, 241, 0.15)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                          <Inventory size={20} color="#818cf8" />
                        </Box>
                      )}
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ 
                          fontSize: '0.9rem', 
                          fontWeight: 700, 
                          color: 'var(--foreground)',
                          mb: 0.3,
                        }}>
                          {item.productName || product?.name || 'สินค้าไม่ระบุ'}
                        </Typography>
                        <Typography sx={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          ราคาต่อชิ้น: ฿{Number(item.unitPrice).toLocaleString()}
                          {product && item.unitPrice !== calculateItemUnitPrice(item, product) && (
                            <span style={{ color: '#f59e0b', marginLeft: 8 }}>
                              → ฿{calculateItemUnitPrice(item, product).toLocaleString()}
                            </span>
                          )}
                        </Typography>
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
                    
                    {/* Editable Fields */}
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, mb: 1.5 }}>
                      {/* Size */}
                      <Select
                        value={item.size || ''}
                        onChange={(e) => updateCartItem(idx, { size: e.target.value })}
                        size="small"
                        displayEmpty
                        sx={{ 
                          bgcolor: 'rgba(255,255,255,0.03)',
                          borderRadius: '10px',
                          color: 'var(--foreground)',
                          '& .MuiOutlinedInput-notchedOutline': { borderColor: ADMIN_THEME.border },
                          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--glass-border)' },
                        }}
                      >
                        <MenuItem value="" disabled>ไซส์</MenuItem>
                        {SIZES.map(size => (
                          <MenuItem key={size} value={size}>{size}</MenuItem>
                        ))}
                      </Select>
                      
                      {/* Quantity */}
                      <TextField
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateCartItem(idx, { quantity: Math.max(1, Number(e.target.value)) })}
                        size="small"
                        InputProps={{
                          startAdornment: <Typography sx={{ color: 'var(--text-muted)', mr: 1, fontSize: '0.8rem' }}>จำนวน</Typography>,
                          inputProps: { min: 1 }
                        }}
                        sx={{
                          ...inputSx,
                          '& .MuiOutlinedInput-root': {
                            ...inputSx['& .MuiOutlinedInput-root'],
                            borderRadius: '10px',
                          },
                        }}
                      />
                    </Box>
                    
                    {/* Custom Options */}
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      {/* Custom Name */}
                      {(() => {
                        const sc = { ...DEFAULT_SHIRT_NAME, ...config?.shirtNameConfig };
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
                      
                      {/* Custom Number */}
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
                      
                      {/* Long Sleeve Toggle */}
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
                          แขนยาว (+฿{config.products?.find(p => p.id === item.productId)?.options?.longSleevePrice ?? 50})
                        </Typography>
                        <Switch
                          checked={item.options?.isLongSleeve || false}
                          color="warning"
                          size="small"
                          sx={{ pointerEvents: 'none' }}
                        />
                      </Box>
                    </Box>
                    
                    {/* Item Total */}
                    <Box sx={{ 
                      mt: 1.5, 
                      pt: 1.5, 
                      borderTop: '1px solid rgba(255,255,255,0.06)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}>
                      <Typography sx={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {item.quantity} × ฿{Number(item.unitPrice).toLocaleString()}
                      </Typography>
                      <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#10b981' }}>
                        ฿{(item.quantity * item.unitPrice).toLocaleString()}
                      </Typography>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          </Box>
        )}

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
              const theme = STATUS_THEME[status] || STATUS_THEME.PENDING_PAYMENT;
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
                    {status}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ 
        p: 3, 
        pt: 0,
        gap: 1.5,
      }}>
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

      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          base64,
          filename: file.name,
          mime,
        }),
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
    } catch (error: any) {
      console.error('Image upload error:', error);
      throw error; // Re-throw to let caller handle
    }
  }, [compressImage]);

  const LogsView = (): JSX.Element => {
    const [logFilter, setLogFilter] = useState<string>('ALL');

    const filteredLogs = logFilter === 'ALL'
      ? logs
      : logs.filter(log => log[2] === logFilter);

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
              {filteredLogs.length}/{logs.length} รายการ
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
              const count = filter.value === 'ALL' ? logs.length : logs.filter(l => l[2] === filter.value).length;
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
  const pendingCount = orders.filter((o) => ['WAITING_PAYMENT', 'PENDING'].includes(o.status)).length;

  // 🔐 Login Component - Show when not authenticated
  if (status === 'unauthenticated') {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: `radial-gradient(ellipse at top, rgba(99,102,241,0.15) 0%, transparent 50%),
                       radial-gradient(ellipse at bottom right, rgba(139,92,246,0.1) 0%, transparent 50%),
                       var(--background)`,
          p: 2,
        }}
      >
        {/* Animated Background Elements */}
        <Box
          sx={{
            position: 'absolute',
            top: '20%',
            left: '10%',
            width: 300,
            height: 300,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)',
            filter: 'blur(40px)',
            animation: 'pulse 4s ease-in-out infinite',
            '@keyframes pulse': {
              '0%, 100%': { transform: 'scale(1)', opacity: 0.5 },
              '50%': { transform: 'scale(1.1)', opacity: 0.8 },
            },
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            bottom: '15%',
            right: '15%',
            width: 250,
            height: 250,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)',
            filter: 'blur(40px)',
            animation: 'pulse2 5s ease-in-out infinite',
            '@keyframes pulse2': {
              '0%, 100%': { transform: 'scale(1.1)', opacity: 0.6 },
              '50%': { transform: 'scale(1)', opacity: 0.4 },
            },
          }}
        />

        {/* Login Card */}
        <Box
          sx={{
            position: 'relative',
            zIndex: 1,
            width: '100%',
            maxWidth: 440,
          }}
        >
          <Box
            sx={{
              ...glassCardSx,
              p: 0,
              overflow: 'hidden',
            }}
          >
            {/* Header Gradient */}
            <Box
              sx={{
                background: 'linear-gradient(135deg, rgba(139,92,246,0.2) 0%, rgba(59,130,246,0.2) 100%)',
                p: 4,
                pb: 5,
                textAlign: 'center',
                position: 'relative',
              }}
            >
              {/* Logo */}
              <Box
                sx={{
                  width: 80,
                  height: 80,
                  borderRadius: '24px',
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 50%, #3b82f6 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mx: 'auto',
                  mb: 2.5,
                  boxShadow: '0 20px 40px rgba(139,92,246,0.3)',
                }}
              >
                <Store size={40} color="#fff" />
              </Box>
              <Typography
                sx={{
                  fontSize: '1.6rem',
                  fontWeight: 800,
                  color: 'var(--foreground)',
                  mb: 0.5,
                }}
              >
                PSUSCC Admin
              </Typography>
              <Typography
                sx={{
                  fontSize: '0.9rem',
                  color: 'var(--text-muted)',
                }}
              >
                ระบบจัดการร้านค้า
              </Typography>
            </Box>

            {/* Login Form */}
            <Box sx={{ p: 4, pt: 3 }}>
              <Typography
                sx={{
                  fontSize: '0.85rem',
                  color: 'var(--text-muted)',
                  textAlign: 'center',
                  mb: 3,
                }}
              >
                เข้าสู่ระบบด้วยบัญชีที่ได้รับอนุญาต
              </Typography>

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

              {/* Divider */}
              <Box sx={{ display: 'flex', alignItems: 'center', my: 3 }}>
                <Box sx={{ flex: 1, height: 1, bgcolor: 'var(--glass-bg)' }} />
                <Typography sx={{ px: 2, fontSize: '0.75rem', color: '#475569' }}>หรือ</Typography>
                <Box sx={{ flex: 1, height: 1, bgcolor: 'var(--glass-bg)' }} />
              </Box>

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
            </Box>

            {/* Footer */}
            <Box
              sx={{
                px: 4,
                py: 2,
                borderTop: `1px solid ${ADMIN_THEME.border}`,
                background: 'var(--glass-bg)',
              }}
            >
              <Typography
                sx={{
                  fontSize: '0.75rem',
                  color: '#475569',
                  textAlign: 'center',
                }}
              >
                <Lock size={16} style={{ marginRight: 4 }} />
                เฉพาะผู้ดูแลระบบที่ได้รับอนุญาตเท่านั้น
              </Typography>
            </Box>
          </Box>

          {/* Version Badge */}
          <Typography
            sx={{
              textAlign: 'center',
              mt: 3,
              fontSize: '0.7rem',
              color: '#475569',
            }}
          >
            PSUSCC Shop Admin v2.0
          </Typography>
        </Box>
      </Box>
    );
  }

  // Access Denied - logged in but not admin - just redirect (Swal already shown in useEffect)
  if (!isAuthorized) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 3,
          background: `radial-gradient(ellipse at top, rgba(99,102,241,0.1) 0%, transparent 50%),
                       var(--background)`,
        }}
      >
        <CircularProgress size={48} sx={{ color: '#8b5cf6' }} />
        <Typography sx={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          กำลังตรวจสอบสิทธิ์...
        </Typography>
      </Box>
    );
  }

  // Only show loading for initial session check
  if (isSessionLoading) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 3,
          background: `radial-gradient(ellipse at top, rgba(99,102,241,0.1) 0%, transparent 50%),
                       var(--background)`,
        }}
      >
        {/* Animated Logo */}
        <Box
          sx={{
            width: 80,
            height: 80,
            borderRadius: '24px',
            background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 50%, #3b82f6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 20px 40px rgba(139,92,246,0.3)',
            animation: 'pulse-logo 2s ease-in-out infinite',
            '@keyframes pulse-logo': {
              '0%, 100%': { transform: 'scale(1)', boxShadow: '0 20px 40px rgba(139,92,246,0.3)' },
              '50%': { transform: 'scale(1.05)', boxShadow: '0 25px 50px rgba(139,92,246,0.4)' },
            },
          }}
        >
          <Store size={40} color="#fff" />
        </Box>
        
        {/* Loading Spinner */}
        <Box sx={{ position: 'relative' }}>
          <CircularProgress
            size={48}
            thickness={2}
            sx={{
              color: 'rgba(139,92,246,0.3)',
              position: 'absolute',
            }}
          />
          <CircularProgress
            size={48}
            thickness={2}
            sx={{
              color: '#8b5cf6',
              animation: 'spin 1s linear infinite',
              '@keyframes spin': {
                '0%': { transform: 'rotate(0deg)' },
                '100%': { transform: 'rotate(360deg)' },
              },
            }}
          />
        </Box>
        
        <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          กำลังตรวจสอบสิทธิ์...
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        background: `radial-gradient(ellipse at top, rgba(99,102,241,0.08) 0%, transparent 50%),
                     radial-gradient(ellipse at bottom right, rgba(6,182,212,0.06) 0%, transparent 50%),
                     var(--background)`,
        color: ADMIN_THEME.text,
        position: 'relative',
      }}
    >
      {/* Data Loading Overlay - non-blocking */}
      {isDataLoading && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 9999,
            height: 3,
            background: 'var(--glass-bg)',
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              height: '100%',
              width: '40%',
              background: 'linear-gradient(90deg, transparent, #8b5cf6, #3b82f6, transparent)',
              animation: 'loading-bar 1.5s ease-in-out infinite',
              '@keyframes loading-bar': {
                '0%': { transform: 'translateX(-100%)' },
                '100%': { transform: 'translateX(350%)' },
              },
            }}
          />
        </Box>
      )}

      {/* Modern Header */}
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 1200,
          px: { xs: 2, md: 3 },
          py: 1.5,
          bgcolor: ADMIN_THEME.bgHeader,
          backdropFilter: 'blur(20px)',
          borderBottom: `1px solid ${ADMIN_THEME.border}`,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Left: Logo & Menu Toggle */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <IconButton
              onClick={() => setSidebarOpen(!sidebarOpen)}
              sx={{ 
                display: { xs: 'flex', md: 'none' },
                color: ADMIN_THEME.textSecondary,
                bgcolor: 'var(--glass-bg)',
                '&:hover': { bgcolor: 'var(--glass-bg)' },
              }}
            >
              <Dashboard />
            </IconButton>
            
            {/* Brand */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{
                width: 40,
                height: 40,
                borderRadius: '12px',
                background: ADMIN_THEME.gradient,
                display: 'grid',
                placeItems: 'center',
                boxShadow: '0 4px 14px rgba(99,102,241,0.3)',
              }}>
                <Bolt size={22} color="#fff" />
              </Box>
              <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                <Typography sx={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--foreground)', lineHeight: 1.2 }}>
                  Admin Panel
                </Typography>
                <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  PSUSCCSHOP
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Right: Status & User */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {/* Sync Status */}
            <Box sx={{ 
              display: { xs: 'none', sm: 'flex' },
              alignItems: 'center', 
              gap: 1,
              px: 1.5,
              py: 0.6,
              borderRadius: '10px',
              bgcolor: saving ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.15)',
              border: `1px solid ${saving ? 'rgba(245,158,11,0.3)' : 'rgba(16,185,129,0.3)'}`,
            }}>
              {saving ? (
                <>
                  <CircularProgress size={12} thickness={6} sx={{ color: '#fbbf24' }} />
                  <Typography sx={{ fontSize: '0.7rem', color: '#fbbf24', fontWeight: 600 }}>กำลังบันทึก...</Typography>
                </>
              ) : (
                <>
                  <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#10b981' }} />
                  <Typography sx={{ fontSize: '0.7rem', color: '#34d399', fontWeight: 600 }}>
                    {lastSavedTime ? lastSavedTime.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : 'พร้อม'}
                  </Typography>
                </>
              )}
            </Box>

            {/* User Menu */}
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 1.5,
              pl: 2,
              borderLeft: `1px solid ${ADMIN_THEME.border}`,
            }}>
              <Avatar 
                src={session?.user?.image || ''} 
                sx={{ 
                  width: 36, 
                  height: 36,
                  border: '2px solid rgba(99,102,241,0.3)',
                }} 
              />
              <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--foreground)', lineHeight: 1.2 }}>
                  {session?.user?.name?.split(' ')[0] || 'Admin'}
                </Typography>
                <Typography sx={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                  Administrator
                </Typography>
              </Box>
              <IconButton 
                onClick={() => setLogoutConfirmOpen(true)}
                sx={{ 
                  color: 'var(--text-muted)',
                  '&:hover': { color: '#f87171', bgcolor: 'rgba(239,68,68,0.1)' },
                }}
              >
                <Logout size={20} />
              </IconButton>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Sidebar & Content */}
      <Box sx={{ display: 'flex', flex: 1 }}>
        {/* Modern Sidebar */}
        <Drawer
          open={isDesktop ? true : sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          sx={{
            width: { xs: '100%', md: 260 },
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: { xs: '100%', md: 260 },
              background: ADMIN_THEME.bgSidebar,
              color: ADMIN_THEME.text,
              borderRight: { xs: 'none', md: `1px solid ${ADMIN_THEME.border}` },
              boxSizing: 'border-box',
              position: { xs: 'fixed', md: 'relative' },
              height: { xs: '100%', md: '100%' },
              backdropFilter: 'blur(20px)',
              pt: { xs: 2, md: 0 },
              display: 'flex',
              flexDirection: 'column',
            }
          }}
          variant={isDesktop ? 'permanent' : 'temporary'}
          ModalProps={{ 
            keepMounted: true,
            disableEnforceFocus: true,
            disableRestoreFocus: true,
          }}
          anchor="left"
        >
          {/* Sidebar Content */}
          <Box sx={{ 
            p: 2, 
            display: 'flex', 
            flexDirection: 'column', 
            gap: 1, 
            flex: 1,
            overflow: 'hidden',
          }}>
            {/* Mobile Header with Close Button */}
            {!isDesktop && (
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                mb: 2,
                pb: 2,
                borderBottom: `1px solid ${ADMIN_THEME.border}`,
                flexShrink: 0,
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{
                    width: 40,
                    height: 40,
                    borderRadius: '12px',
                    background: ADMIN_THEME.gradient,
                    display: 'grid',
                    placeItems: 'center',
                  }}>
                    <Bolt size={22} color="#fff" />
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: '1rem', fontWeight: 800, color: 'var(--foreground)' }}>
                      Admin Panel
                    </Typography>
                    <Typography sx={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      เลือกเมนู
                    </Typography>
                  </Box>
                </Box>
                <IconButton 
                  onClick={() => setSidebarOpen(false)}
                  sx={{ 
                    color: 'var(--text-muted)',
                    bgcolor: 'var(--glass-bg)',
                    '&:hover': { bgcolor: 'var(--glass-bg)' },
                  }}
                >
                  <Close />
                </IconButton>
              </Box>
            )}
            
            {/* Navigation Items - Scrollable */}
            <Box sx={{
              flex: 1,
              overflow: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
              pb: 2,
              // Custom scrollbar
              '&::-webkit-scrollbar': { width: 6 },
              '&::-webkit-scrollbar-track': { bgcolor: 'transparent' },
              '&::-webkit-scrollbar-thumb': { 
                bgcolor: 'var(--glass-bg)', 
                borderRadius: 3,
                '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' },
              },
            }}>
            {[
              { icon: <Dashboard size={20} />, label: 'แดชบอร์ด', idx: 0, color: '#a5b4fc', show: true },
              { icon: <ShoppingCart size={20} />, label: 'จัดการสินค้า', idx: 1, color: '#fbbf24', show: canManageProducts },
              { icon: <Receipt size={20} />, label: 'ออเดอร์', idx: 2, color: '#34d399', badge: pendingCount, show: canManageOrders },
              { icon: <QrCodeScanner size={20} />, label: 'รับสินค้า', idx: 3, color: '#06b6d4', show: canManagePickup },
              { icon: <LocalShipping size={20} />, label: 'ติดตามพัสดุ', idx: 12, color: '#fb923c', show: canManageTracking },
              { icon: <Refresh size={20} />, label: 'คืนเงิน', idx: 13, color: '#c084fc', show: canManageRefunds },
              { icon: <SupportAgent size={20} />, label: 'แชทสนับสนุน', idx: 4, color: '#ec4899', show: canManageSupport },
              { icon: <NotificationsActive size={20} />, label: 'ประกาศ', idx: 5, color: '#f472b6', show: canManageAnnouncement },
              { icon: <Sparkles size={20} />, label: 'อีเวนต์/โปรโมชั่น', idx: 14, color: '#fbbf24', show: canManageEvents },
              { icon: <Ticket size={20} />, label: 'โค้ดส่วนลด', idx: 15, color: '#34c759', show: canManagePromoCodes },
              { icon: <Settings size={20} />, label: 'ตั้งค่าร้าน', idx: 6, color: '#60a5fa', show: canManageShop || canManageSheet || isSuperAdminUser },
              { icon: <LocalShipping size={20} />, label: 'ตั้งค่าจัดส่ง', idx: 10, color: '#a78bfa', show: canManageShipping },
              { icon: <AttachMoney size={20} />, label: 'ตั้งค่าชำระเงิน', idx: 11, color: '#22d3ee', show: canManagePayment },
              { icon: <Send size={20} />, label: 'ส่งอีเมล', idx: 7, color: '#10b981', show: canSendEmail },
              { icon: <Groups size={20} />, label: 'ประวัติผู้ใช้', idx: 8, color: '#f97316', show: isSuperAdminUser },
              { icon: <History size={20} />, label: 'ประวัติระบบ', idx: 9, color: 'var(--text-muted)', show: isSuperAdminUser },
            ].filter(item => item.show).map((item) => {
              const isActive = activeTab === item.idx;
              return (
                <Box
                  key={item.idx}
                  onClick={() => {
                    setActiveTab(item.idx);
                    setSidebarOpen(false);
                  }}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    px: 2,
                    py: 1.5,
                    borderRadius: '14px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    bgcolor: isActive ? 'rgba(99,102,241,0.15)' : 'transparent',
                    border: isActive ? '1px solid rgba(99,102,241,0.3)' : '1px solid transparent',
                    '&:hover': { 
                      bgcolor: isActive ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)',
                    },
                  }}
                >
                  <Box sx={{
                    width: 36,
                    height: 36,
                    borderRadius: '10px',
                    bgcolor: isActive ? `${item.color}20` : 'rgba(255,255,255,0.05)',
                    display: 'grid',
                    placeItems: 'center',
                    color: isActive ? item.color : '#64748b',
                    transition: 'all 0.2s ease',
                  }}>
                    {item.icon}
                  </Box>
                  <Typography sx={{ 
                    flex: 1,
                    fontSize: '0.9rem', 
                    fontWeight: isActive ? 700 : 500, 
                    color: isActive ? 'var(--foreground)' : 'var(--text-muted)',
                  }}>
                    {item.label}
                  </Typography>
                  {item.badge && item.badge > 0 && (
                    <Box sx={{
                      px: 1,
                      py: 0.3,
                      borderRadius: '8px',
                      bgcolor: 'rgba(239,68,68,0.2)',
                      border: '1px solid rgba(239,68,68,0.4)',
                    }}>
                      <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#f87171' }}>
                        {item.badge}
                      </Typography>
                    </Box>
                  )}
                </Box>
              );
            })}
            </Box>
          </Box>

          {/* Sidebar Footer */}
          <Box sx={{ p: 2, borderTop: `1px solid ${ADMIN_THEME.border}`, flexShrink: 0 }}>
            <Box sx={{
              p: 2,
              borderRadius: '14px',
              bgcolor: 'rgba(16,185,129,0.1)',
              border: '1px solid rgba(16,185,129,0.2)',
              mb: !isDesktop ? 2 : 0,
            }}>
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#34d399', mb: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                ร้านค้า: 
                <FiberManualRecord size={10} color={config.isOpen ? '#22c55e' : '#ef4444'} />
                {config.isOpen ? 'เปิดขาย' : 'ปิดชั่วคราว'}
              </Typography>
              <Typography sx={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                สินค้า {config.products?.length || 0} รายการ
              </Typography>
            </Box>
            
            {/* Mobile Close Button */}
            {!isDesktop && (
              <Button
                fullWidth
                onClick={() => setSidebarOpen(false)}
                startIcon={<Close />}
                sx={{
                  py: 1.5,
                  borderRadius: '12px',
                  bgcolor: 'rgba(100,116,139,0.15)',
                  border: '1px solid rgba(100,116,139,0.3)',
                  color: 'var(--text-muted)',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  textTransform: 'none',
                  '&:hover': { bgcolor: 'rgba(100,116,139,0.25)' },
                }}
              >
                ปิดเมนู
              </Button>
            )}
          </Box>
        </Drawer>

        {/* Main Content */}
        <Box sx={{ 
          flex: 1, 
          p: { xs: 2, md: 3 }, 
          overflow: 'auto', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: 3,
          minHeight: 0,
        }}>
          {activeTab === 0 && <DashboardView />}
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
              />
            ) : (
              <NoPermissionView permission="จัดการสินค้า" />
            )
          )}
          {activeTab === 2 && (canManageOrders ? OrdersView() : <NoPermissionView permission="จัดการออเดอร์" />)}
          {activeTab === 3 && (canManagePickup ? PickupView() : <NoPermissionView permission="จัดการรับสินค้า" />)}
          {activeTab === 4 && (canManageSupport ? <SupportChatPanel /> : <NoPermissionView permission="แชทสนับสนุน" />)}
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
          {activeTab === 6 && (
            <SettingsView
              localConfig={settingsLocalConfig}
              hasChanges={settingsHasChanges}
              loading={loading}
              lastSavedTime={lastSavedTime}
              newAdminEmail={newAdminEmail}
              userEmail={session?.user?.email}
              sheetSyncing={sheetSyncing}
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
          {activeTab === 12 && (canManageTracking ? <TrackingManagement showToast={showToast} /> : <NoPermissionView permission="ติดตามพัสดุ" />)}
          {activeTab === 13 && (canManageRefunds ? <RefundManagement showToast={showToast} /> : <NoPermissionView permission="จัดการคืนเงิน" />)}
        </Box>
      </Box>

      {/* Slip Viewer Dialog */}
      <Dialog
        open={slipViewerOpen}
        onClose={() => setSlipViewerOpen(false)}
        maxWidth="md"
        PaperProps={{
          sx: {
            bgcolor: ADMIN_THEME.glass,
            backdropFilter: 'blur(20px)',
            border: `1px solid ${ADMIN_THEME.border}`,
            borderRadius: '16px',
          },
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          borderBottom: `1px solid ${ADMIN_THEME.border}`,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ImageIcon color="#10b981" />
            <Typography sx={{ fontWeight: 700, color: 'var(--foreground)' }}>
              สลิปการโอนเงิน #{slipViewerData?.ref ?? '-'}
            </Typography>
          </Box>
          <IconButton onClick={() => setSlipViewerOpen(false)} sx={{ color: 'var(--text-muted)' }}>
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          {(slipViewerData?.slip?.imageUrl || slipViewerData?.slip?.base64) ? (
            <Box sx={{ textAlign: 'center' }}>
              <Box
                component="img"
                src={slipViewerData.slip.imageUrl 
                  ? slipViewerData.slip.imageUrl
                  : slipViewerData.slip.base64?.startsWith('data:') 
                    ? slipViewerData.slip.base64 
                    : `data:${slipViewerData.slip.mime || 'image/png'};base64,${slipViewerData.slip.base64}`}
                alt="สลิปการโอนเงิน"
                onError={(e) => {
                  console.error('[SlipViewer] Image load error:', slipViewerData.slip?.imageUrl);
                  // Try to show a fallback message
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
                sx={{
                  maxWidth: '100%',
                  maxHeight: '70vh',
                  borderRadius: '12px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                }}
              />
              {/* Show imageUrl link if image fails to load */}
              {slipViewerData.slip.imageUrl && (
                <Button 
                  variant="outlined" 
                  size="small"
                  href={slipViewerData.slip.imageUrl}
                  target="_blank"
                  sx={{ mt: 2, color: '#6366f1', borderColor: '#6366f1' }}
                >
                  เปิดรูปภาพในแท็บใหม่
                </Button>
              )}
              {slipViewerData.slip.uploadedAt && (
                <Typography sx={{ mt: 2, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  อัพโหลดเมื่อ: {new Date(slipViewerData.slip.uploadedAt).toLocaleString('th-TH')}
                </Typography>
              )}
              {slipViewerData.slip.slipData && (
                <Box sx={{ mt: 2, p: 2, bgcolor: 'rgba(16,185,129,0.1)', borderRadius: '12px', textAlign: 'left' }}>
                  <Typography sx={{ color: '#10b981', fontWeight: 600, mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}><ClipboardList size={16} /> ข้อมูลจากสลิป</Typography>
                  {slipViewerData.slip.slipData.amount && (
                    <Typography sx={{ color: 'var(--foreground)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 0.5 }}><Banknote size={14} /> จำนวนเงิน: ฿{Number(slipViewerData.slip.slipData.amount).toLocaleString()}</Typography>
                  )}
                  {/* ข้อมูลผู้โอน - แสดงทั้งชื่อเต็มและชื่อย่อ */}
                  {(slipViewerData.slip.slipData.senderName || slipViewerData.slip.slipData.senderFullName || slipViewerData.slip.slipData.senderDisplayName) && (
                    <Box sx={{ mt: 1 }}>
                      <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <UserIcon size={13} /> ผู้โอน: {slipViewerData.slip.slipData.senderFullName || slipViewerData.slip.slipData.senderName || slipViewerData.slip.slipData.senderDisplayName}
                      </Typography>
                      {slipViewerData.slip.slipData.senderDisplayName && slipViewerData.slip.slipData.senderFullName && (
                        <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.75rem', ml: 3 }}>
                          ({slipViewerData.slip.slipData.senderDisplayName})
                        </Typography>
                      )}
                      {slipViewerData.slip.slipData.senderBank && (
                        <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.75rem', ml: 3, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Building2 size={12} /> {slipViewerData.slip.slipData.senderBank}
                        </Typography>
                      )}
                    </Box>
                  )}
                  {slipViewerData.slip.slipData.transRef && (
                    <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.85rem', mt: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}><Hash size={13} /> เลขอ้างอิง: {slipViewerData.slip.slipData.transRef}</Typography>
                  )}
                  {slipViewerData.slip.slipData.transDate && slipViewerData.slip.slipData.transTime && (
                    <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.75rem', ml: 3, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <CalendarDays size={12} /> {slipViewerData.slip.slipData.transDate} {slipViewerData.slip.slipData.transTime}
                    </Typography>
                  )}
                  {/* ข้อมูลผู้รับ (ร้านค้า) */}
                  {slipViewerData.slip.slipData.receiverName && (
                    <Box sx={{ mt: 1, pt: 1, borderTop: '1px dashed rgba(255,255,255,0.1)' }}>
                      <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Archive size={12} /> ผู้รับ: {slipViewerData.slip.slipData.receiverName} 
                        {slipViewerData.slip.slipData.receiverBank && ` (${slipViewerData.slip.slipData.receiverBank})`}
                      </Typography>
                    </Box>
                  )}
                </Box>
              )}
            </Box>
          ) : (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Warning size={48} color="#f59e0b" style={{ marginBottom: 16 }} />
              <Typography sx={{ color: 'var(--text-muted)' }}>
                ไม่พบข้อมูลรูปภาพสลิป
              </Typography>
              {slipViewerData?.ref && (
                <Button
                  variant="outlined"
                  size="small"
                  href={`/api/slip/${slipViewerData.ref}`}
                  target="_blank"
                  sx={{ mt: 2, color: '#6366f1', borderColor: '#6366f1' }}
                >
                  เปิดหน้าดูสลิป
                </Button>
              )}
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* Batch Status Update Dialog */}
      <Dialog
        open={batchStatusDialogOpen}
        onClose={() => setBatchStatusDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: ADMIN_THEME.glass,
            backdropFilter: 'blur(20px)',
            border: `1px solid ${ADMIN_THEME.border}`,
            borderRadius: '16px',
          },
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          borderBottom: `1px solid ${ADMIN_THEME.border}`,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Update color="#6366f1" />
            <Typography sx={{ fontWeight: 700, color: 'var(--foreground)' }}>
              อัปเดตสถานะพร้อมกัน
            </Typography>
          </Box>
          <IconButton onClick={() => setBatchStatusDialogOpen(false)} sx={{ color: 'var(--text-muted)' }}>
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <Box sx={{ mb: 3 }}>
            <Typography sx={{ color: 'var(--text-muted)', mb: 2 }}>
              เลือก {selectedOrders.size} ออเดอร์เพื่ออัปเดตสถานะ
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
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
            </Box>
          </Box>
          
          <Typography sx={{ color: 'var(--foreground)', fontWeight: 600, mb: 1.5 }}>
            สถานะใหม่
          </Typography>
          <Select
            value={batchNewStatus}
            onChange={(e) => setBatchNewStatus(e.target.value)}
            fullWidth
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
              <MenuItem key={status} value={status}>{status}</MenuItem>
            ))}
          </Select>
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: `1px solid ${ADMIN_THEME.border}`, gap: 1 }}>
          <Button
            onClick={() => setBatchStatusDialogOpen(false)}
            variant="outlined"
            sx={{
              borderColor: ADMIN_THEME.border,
              color: 'var(--text-muted)',
              '&:hover': { borderColor: '#6366f1' },
            }}
          >
            ยกเลิก
          </Button>
          <Button
            onClick={handleBatchUpdateStatus}
            variant="contained"
            disabled={batchUpdating || !batchNewStatus}
            sx={gradientButtonSx}
          >
            {batchUpdating ? 'กำลังอัปเดต...' : `อัปเดต ${selectedOrders.size} รายการ`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modern Toast Container */}
      {toasts.length > 0 && (
        <Box
          sx={{
            position: 'fixed',
            top: 20,
            right: 20,
            zIndex: 99999,
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
            maxWidth: 380,
          }}
        >
          {toasts.map((t) => {
            const colors: Record<string, { bg: string; border: string }> = {
              success: { bg: 'linear-gradient(135deg, rgba(16,185,129,0.95) 0%, rgba(5,150,105,0.95) 100%)', border: 'rgba(52,211,153,0.5)' },
              error: { bg: 'linear-gradient(135deg, rgba(239,68,68,0.95) 0%, rgba(220,38,38,0.95) 100%)', border: 'rgba(248,113,113,0.5)' },
              warning: { bg: 'linear-gradient(135deg, rgba(245,158,11,0.95) 0%, rgba(217,119,6,0.95) 100%)', border: 'rgba(251,191,36,0.5)' },
              info: { bg: 'linear-gradient(135deg, rgba(59,130,246,0.95) 0%, rgba(37,99,235,0.95) 100%)', border: 'rgba(96,165,250,0.5)' },
            };
            const icons: Record<string, JSX.Element> = {
              success: <CheckCircle size={20} />,
              error: <ErrorOutline size={20} />,
              warning: <Warning size={20} />,
              info: <Bolt size={20} />,
            };
            return (
              <Box
                key={t.id}
                sx={{
                  background: colors[t.type].bg,
                  borderRadius: '14px',
                  py: 1.5,
                  px: 2.5,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  boxShadow: '0 10px 40px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.1) inset',
                  backdropFilter: 'blur(10px)',
                  cursor: 'pointer',
                  animation: 'adminToastIn 0.4s cubic-bezier(0.2, 0.6, 0.35, 1)',
                  transition: 'all 0.25s cubic-bezier(0.2, 0.6, 0.35, 1)',
                  '&:hover': {
                    transform: 'translateX(-4px) scale(1.01)',
                    boxShadow: '0 12px 45px rgba(0,0,0,0.35)',
                  },
                  '@keyframes adminToastIn': {
                    '0%': { opacity: 0, transform: 'translateX(100%) scale(0.95)' },
                    '100%': { opacity: 1, transform: 'translateX(0) scale(1)' },
                  },
                }}
                onClick={() => setToasts((prev) => prev.filter((toast) => toast.id !== t.id))}
              >
                <Box sx={{ color: '#fff', display: 'flex', alignItems: 'center' }}>
                  {icons[t.type]}
                </Box>
                <Typography
                  sx={{
                    color: '#fff',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    flex: 1,
                    textShadow: '0 1px 2px rgba(0,0,0,0.2)',
                  }}
                >
                  {t.message}
                </Typography>
                <Box
                  sx={{
                    color: 'var(--foreground)',
                    cursor: 'pointer',
                    '&:hover': { color: '#fff' },
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <Close size={16} />
                </Box>
              </Box>
            );
          })}
        </Box>
      )}

      {/* Order Editor Dialog - rendered at root level */}
      {orderEditorDialogElement}
      
      {/* Pickup Confirm Dialog */}
      {pickupConfirmDialog}

      {/* Logout Confirmation Dialog */}
      <Dialog
        open={logoutConfirmOpen}
        onClose={() => setLogoutConfirmOpen(false)}
        PaperProps={{
          sx: {
            borderRadius: 3,
            background: ADMIN_THEME.glass,
            backdropFilter: 'blur(20px)',
            border: `1px solid ${ADMIN_THEME.border}`,
            minWidth: 320,
          },
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1, color: ADMIN_THEME.text }}>
          <Warning size={22} color="#f59e0b" />
          ยืนยันการออกจากระบบ
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: ADMIN_THEME.muted }}>
            คุณต้องการออกจากระบบใช่หรือไม่?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setLogoutConfirmOpen(false)} sx={{ borderRadius: 2, color: ADMIN_THEME.text }}>
            ยกเลิก
          </Button>
          <Button
            onClick={() => signOut()}
            variant="contained"
            color="error"
            sx={{ borderRadius: 2 }}
          >
            ออกจากระบบ
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ============== SUB-COMPONENTS ==============

const StatCard = ({ label, value, trend, icon }: any): JSX.Element => {
  return (
    <Card sx={{ ...glassCardSx, position: 'relative', overflow: 'hidden', height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box>
            <Typography gutterBottom sx={{ fontSize: 12, fontWeight: 'bold', color: ADMIN_THEME.muted }}>
              {label}
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 'bold', color: ADMIN_THEME.text }}>
              {value}
            </Typography>
          </Box>
          <Box sx={{ fontSize: 32, opacity: 0.85, color: '#a5b4fc' }}>{icon}</Box>
        </Box>
        <Typography variant="caption" sx={{ color: ADMIN_THEME.muted }}>
          {trend}
        </Typography>
      </CardContent>
    </Card>
  );
};

const StatusChip = ({ status }: { status: string }): JSX.Element => {
  const normalized = normalizeStatusKey(status);
  const colors: Record<string, 'warning' | 'info' | 'success' | 'error'> = {
    WAITING_PAYMENT: 'warning',
    PENDING: 'warning',
    PAID: 'info',
    READY: 'success',
    SHIPPED: 'info',
    COMPLETED: 'success',
    CANCELLED: 'error'
  };

  const label = normalized.replace('_', ' ');

  return <Chip label={label} size="small" color={colors[normalized] || 'default'} variant="outlined" />;
};

// Check if product is currently open based on startDate/endDate
const isProductOpen = (product: any): { isOpen: boolean; status: 'upcoming' | 'active' | 'ended' | 'always' } => {
  const now = new Date();
  const start = product.startDate ? new Date(product.startDate) : null;
  const end = product.endDate ? new Date(product.endDate) : null;
  
  // No dates set = always open (if isActive)
  if (!start && !end) return { isOpen: product.isActive, status: 'always' };
  
  // Has start date but not reached yet
  if (start && now < start) return { isOpen: false, status: 'upcoming' };
  
  // Has end date and already passed
  if (end && now > end) return { isOpen: false, status: 'ended' };
  
  // Within date range (or no constraints violated)
  return { isOpen: product.isActive, status: 'active' };
};

// Format date/time for display
const formatDateTime = (dateStr: string | undefined): string => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleString('th-TH', { 
    day: '2-digit', 
    month: 'short', 
    year: 'numeric',
    hour: '2-digit', 
    minute: '2-digit' 
  });
};

const ProductCardItem = ({ product, onEdit, onDelete, onToggle, onPickupSetting }: { product: any; onEdit: () => void; onDelete: () => void; onToggle?: () => void; onPickupSetting?: () => void }): JSX.Element => {
  const { isOpen, status } = isProductOpen(product);
  
  const statusConfig = {
    upcoming: { label: 'รอเปิด', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', icon: <AccessTime size={12} /> },
    active: { label: 'กำลังขาย', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', icon: <FiberManualRecord size={10} color="#22c55e" /> },
    ended: { label: 'หมดเวลา', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', icon: <FiberManualRecord size={10} color="#ef4444" /> },
    always: { label: product.isActive ? 'เปิดขาย' : 'ปิดขาย', color: product.isActive ? '#10b981' : '#64748b', bg: product.isActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(100, 116, 139, 0.15)', icon: product.isActive ? <Check size={12} /> : <Close size={12} /> },
  };
  
  const currentStatus = statusConfig[status];
  
  return (
    <Card sx={{ ...glassCardSx, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box
        sx={{
          height: 150,
          bgcolor: ADMIN_THEME.glassSoft,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
          background: product.coverImage ? `url(${product.coverImage})` : (product.images?.[0] ? `url(${product.images[0]})` : ADMIN_THEME.gradient),
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          borderBottom: `1px solid ${ADMIN_THEME.border}`
        }}
      >
        {/* Status Badge */}
        <Box sx={{
          position: 'absolute',
          top: 8,
          left: 8,
          px: 1.5,
          py: 0.5,
          borderRadius: '8px',
          bgcolor: currentStatus.bg,
          border: `1px solid ${currentStatus.color}40`,
          backdropFilter: 'blur(8px)',
        }}>
          <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: currentStatus.color, display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {currentStatus.icon} {currentStatus.label}
          </Typography>
        </Box>
        
        {/* Date Range Badge */}
        {(product.startDate || product.endDate) && (
          <Box sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            px: 1,
            py: 0.5,
            borderRadius: '6px',
            bgcolor: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(8px)',
          }}>
            <Typography sx={{ fontSize: '0.65rem', color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <CalendarToday size={12} /> {product.startDate ? formatDateTime(product.startDate).split(' ')[0] : '...'} - {product.endDate ? formatDateTime(product.endDate).split(' ')[0] : '...'}
            </Typography>
          </Box>
        )}
        
        {!isOpen && (
          <Box sx={{
            position: 'absolute',
            inset: 0,
            bgcolor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Typography sx={{ 
              color: status === 'upcoming' ? '#f59e0b' : '#ff6b6b', 
              fontWeight: 'bold',
              fontSize: '0.9rem',
              textTransform: 'uppercase',
            }}>
              {status === 'upcoming' ? 'Coming Soon' : status === 'ended' ? 'Ended' : 'Inactive'}
            </Typography>
          </Box>
        )}
      </Box>
      <CardContent sx={{ flex: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1, color: ADMIN_THEME.text }}>
          {product.name}
        </Typography>
        <Typography variant="caption" display="block" sx={{ mb: 2, color: ADMIN_THEME.muted }}>
          {product.type}
        </Typography>
        <Typography variant="h6" color="success.main" sx={{ fontWeight: 'bold', mb: 2 }}>
          ฿{product.basePrice}
        </Typography>
        <Stack direction="column" spacing={1}>
          <Button
            size="small"
            variant="outlined"
            color="primary"
            onClick={onEdit}
            fullWidth
            startIcon={<EditIconMUI />}
            sx={{ borderColor: ADMIN_THEME.border, color: ADMIN_THEME.text, '&:hover': { borderColor: '#6366f1', background: 'rgba(99,102,241,0.08)' } }}
          >
            แก้ไข
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="error"
            onClick={onDelete}
            fullWidth
            startIcon={<Delete />}
            sx={{ borderColor: 'rgba(239,68,68,0.45)' }}
          >
            ลบ
          </Button>
        </Stack>
        {/* Quick Toggle Switch */}
        {onToggle && (
          <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1, bgcolor: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: `1px solid ${ADMIN_THEME.border}` }}>
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: ADMIN_THEME.textSecondary }}>
              เปิด/ปิดขาย
            </Typography>
            <Switch
              size="small"
              checked={product.isActive}
              onChange={onToggle}
              color={product.isActive ? 'success' : 'default'}
            />
          </Box>
        )}
        {/* Pickup Setting Button */}
        {onPickupSetting && (
          <Button
            size="small"
            variant="outlined"
            fullWidth
            onClick={onPickupSetting}
            startIcon={<LocalMall size={16} />}
            sx={{ 
              mt: 1, 
              borderColor: product.pickup?.enabled ? '#10b981' : ADMIN_THEME.border, 
              color: product.pickup?.enabled ? '#10b981' : ADMIN_THEME.textSecondary,
              bgcolor: product.pickup?.enabled ? 'rgba(16,185,129,0.08)' : 'transparent',
              fontSize: '0.75rem',
              py: 0.5,
              '&:hover': { 
                borderColor: '#06b6d4', 
                bgcolor: 'rgba(6,182,212,0.08)' 
              } 
            }}
          >
            {product.pickup?.enabled ? '✓ รับสินค้า' : 'ตั้งค่ารับสินค้า'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};


type ProductsViewProps = {
  config: ShopConfig;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  saveFullConfig: (config: ShopConfig) => void;
  showToast: (type: 'success' | 'error' | 'info' | 'warning', message: string) => void;
  addLog: (action: string, detail: string, overrides?: { config?: ShopConfig; orders?: AdminOrder[] }) => void;
  saving: boolean;
};

function ProductsView({ config, searchTerm, setSearchTerm, saveFullConfig, showToast, addLog, saving }: ProductsViewProps): JSX.Element {
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [pickupSettingProduct, setPickupSettingProduct] = useState<Product | null>(null);
  const [pickupSaving, setPickupSaving] = useState(false);

  const filteredProducts = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return config.products.filter((p) =>
      p.name.toLowerCase().includes(term) ||
      p.id.toLowerCase().includes(term)
    );
  }, [searchTerm, config.products]);

  const createNewProduct = () => {
    const newP: Product = {
      id: `prod_${Date.now()}`,
      name: 'New Product',
      description: '',
      type: 'CREW',
      images: [],
      coverImage: '',
      basePrice: 0,
      sizePricing: {},
      startDate: '',
      endDate: '',
      isActive: true,
      options: { hasCustomName: false, hasCustomNumber: false, hasLongSleeve: false, longSleevePrice: 50 },
      customTags: []
    };
    setEditingProduct(newP);
  };

  const handleDelete = (id: string) => {
    Swal.fire({
      title: 'Delete Product?',
      text: 'This action cannot be undone',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#475569',
      confirmButtonText: 'Delete',
      cancelButtonText: 'Cancel'
    }).then((res) => {
      if (res.isConfirmed) {
        const newProducts = config.products.filter((p) => p.id !== id);
        saveFullConfig({ ...config, products: newProducts });
        showToast('success', 'Product deleted');
      }
    });
  };

  const handleToggleActive = (id: string) => {
    const newProducts = config.products.map((p) =>
      p.id === id ? { ...p, isActive: !p.isActive } : p
    );
    saveFullConfig({ ...config, products: newProducts });
    const target = newProducts.find((p) => p.id === id);
    showToast('success', target?.isActive ? 'เปิดขายสินค้าแล้ว' : 'ปิดขายสินค้าแล้ว');
  };

  const handleSaveEdit = async (mode?: 'publish' | 'draft') => {
    if (!editingProduct) return;

    const nextProduct = { 
      ...editingProduct,
      name: sanitizeInput(editingProduct.name),
      description: sanitizeInput(editingProduct.description || ''),
    };
    if (mode === 'publish') {
      nextProduct.isActive = true;
    } else if (mode === 'draft') {
      nextProduct.isActive = false;
    }

    if (!nextProduct.name.trim()) {
      return;
    }
    if (!validatePrice(nextProduct.basePrice)) {
      return;
    }

    const invalidSizePrice = Object.values(nextProduct.sizePricing || {}).some((p) => !validatePrice(Number(p)));
    if (invalidSizePrice) {
      return;
    }

    const idx = config.products.findIndex((p) => p.id === nextProduct.id);
    const newProducts = [...config.products];

    if (idx >= 0) {
      newProducts[idx] = nextProduct;
    } else {
      newProducts.push(nextProduct);
    }

    // Save and close popup immediately for better UX
    setEditingProduct(null);
    addLog(idx >= 0 ? 'EDIT_PRODUCT' : 'CREATE_PRODUCT', nextProduct.id, { config: { ...config, products: newProducts } });
    // Fire and forget for speed, no await
    saveFullConfig({ ...config, products: newProducts });
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
        pt: { xs: 0.5, md: 0 },
      }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1.5, mb: 1.5 }}>
          <Typography sx={{ fontSize: { xs: '1.1rem', md: '1.4rem' }, fontWeight: 800, color: 'var(--foreground)' }}>
            สินค้า ({filteredProducts.length}/{config.products.length})
          </Typography>
          <Button
            variant="contained"
            size="small"
            startIcon={<Add size={18} />}
            onClick={createNewProduct}
            sx={{ ...gradientButtonSx, px: 2, py: 0.8, fontSize: '0.85rem' }}
          >
            เพิ่มสินค้า
          </Button>
        </Box>

        <TextField
          placeholder="ค้นหาชื่อหรือ ID..."
          variant="outlined"
          fullWidth
          size="small"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{
            ...inputSx,
            '& .MuiOutlinedInput-root': {
              ...inputSx['& .MuiOutlinedInput-root'],
              borderRadius: '12px',
              py: 0.3,
            },
          }}
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
        />
      </Box>

      {filteredProducts.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <History size={48} color="text.secondary" style={{ marginBottom: 8 }} />
          <Typography sx={{ color: ADMIN_THEME.muted }}>No logs found</Typography>
        </Box>
      ) : (
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(3, 1fr)', lg: 'repeat(4, 1fr)' },
          gap: 2
        }}>
          {filteredProducts.map((p) => (
            <ProductCardItem
              key={p.id}
              product={p}
              onEdit={() => setEditingProduct(p)}
              onDelete={() => handleDelete(p.id)}
              onToggle={() => handleToggleActive(p.id)}
              onPickupSetting={() => setPickupSettingProduct(p)}
            />
          ))}
        </Box>
      )}

      {editingProduct && (
        <ProductEditDialog
          product={editingProduct}
          onClose={() => setEditingProduct(null)}
          onChange={setEditingProduct}
          onSave={handleSaveEdit}
          isSaving={saving}
        />
      )}

      {/* Pickup Settings Dialog */}
      {pickupSettingProduct && (
        <ProductPickupDialog
          product={pickupSettingProduct}
          onClose={() => setPickupSettingProduct(null)}
          saving={pickupSaving}
          onSave={async (pickup, autoUpdateOrders) => {
            setPickupSaving(true);
            try {
              // Call API to enable pickup and auto-update orders
              const res = await fetch('/api/pickup/enable', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  productId: pickupSettingProduct.id,
                  pickup,
                  autoUpdateOrders,
                }),
              });
              
              const data = await res.json();
              if (!res.ok) throw new Error(data.error || 'Failed to update');
              
              // Update local config
              const newProducts = config.products.map((p) =>
                p.id === pickupSettingProduct.id ? { ...p, pickup } : p
              );
              saveFullConfig({ ...config, products: newProducts });
              
              if (data.updatedCount > 0) {
                showToast('success', `เปิดรับสินค้าแล้ว และอัปเดต ${data.updatedCount} ออเดอร์เป็น "พร้อมรับ"`);
              } else {
                showToast('success', pickup.enabled ? 'เปิดรับสินค้าแล้ว' : 'ปิดรับสินค้าแล้ว');
              }
              
              setPickupSettingProduct(null);
            } catch (err: any) {
              showToast('error', err.message || 'เกิดข้อผิดพลาด');
            } finally {
              setPickupSaving(false);
            }
          }}
        />
      )}
    </Box>
  );
}

// ============== PRODUCT PICKUP SETTINGS DIALOG ==============
interface ProductPickupSettings {
  enabled: boolean;
  location?: string;
  startDate?: string;
  endDate?: string;
  notes?: string;
  updatedBy?: string;
  updatedAt?: string;
}

const ProductPickupDialog = ({ 
  product, 
  onClose, 
  saving, 
  onSave 
}: { 
  product: Product; 
  onClose: () => void; 
  saving: boolean;
  onSave: (pickup: ProductPickupSettings, autoUpdateOrders: boolean) => Promise<void>;
}): JSX.Element => {
  const [pickup, setPickup] = useState<ProductPickupSettings>({
    enabled: product.pickup?.enabled || false,
    location: product.pickup?.location || '',
    startDate: product.pickup?.startDate || '',
    endDate: product.pickup?.endDate || '',
    notes: product.pickup?.notes || '',
  });
  const [autoUpdateOrders, setAutoUpdateOrders] = useState(true);

  const handleSave = () => {
    onSave(pickup, autoUpdateOrders);
  };

  return (
    <Dialog
      open
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          ...glassCardSx,
          borderRadius: '16px',
          m: 2,
          maxHeight: '90vh',
        },
      }}
    >
      <DialogTitle sx={{ 
        borderBottom: `1px solid ${ADMIN_THEME.border}`,
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        pb: 2,
      }}>
        <LocalMall color="#06b6d4" />
        <Box>
          <Typography sx={{ fontWeight: 700, color: ADMIN_THEME.text }}>
            ตั้งค่ารับสินค้า
          </Typography>
          <Typography sx={{ fontSize: '0.8rem', color: ADMIN_THEME.muted }}>
            {product.name}
          </Typography>
        </Box>
      </DialogTitle>
      
      <DialogContent sx={{ py: 3 }}>
        {/* Enable Toggle */}
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          p: 2,
          mb: 2,
          borderRadius: '12px',
          bgcolor: pickup.enabled ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.03)',
          border: `1px solid ${pickup.enabled ? 'rgba(16,185,129,0.3)' : ADMIN_THEME.border}`,
        }}>
          <Box>
            <Typography sx={{ fontWeight: 600, color: ADMIN_THEME.text }}>
              เปิดรับสินค้า
            </Typography>
            <Typography sx={{ fontSize: '0.8rem', color: ADMIN_THEME.muted }}>
              {pickup.enabled ? 'ลูกค้าสามารถมารับสินค้าได้' : 'ยังไม่เปิดรับสินค้า'}
            </Typography>
          </Box>
          <Switch
            checked={pickup.enabled}
            onChange={(e) => setPickup({ ...pickup, enabled: e.target.checked })}
            color="success"
          />
        </Box>

        {pickup.enabled && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            {/* Location */}
            <Box>
              <Typography sx={{ fontSize: '0.85rem', color: '#06b6d4', mb: 1, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Crosshair size={14} /> สถานที่รับสินค้า
              </Typography>
              <TextField
                placeholder="เช่น: ห้อง 123 ตึก A คณะวิศวกรรมศาสตร์"
                value={pickup.location}
                onChange={(e) => setPickup({ ...pickup, location: e.target.value })}
                fullWidth
                sx={inputSx}
              />
            </Box>

            {/* Date Range */}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
              <Box>
                <Typography sx={{ fontSize: '0.85rem', color: '#06b6d4', mb: 1, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <CalendarDays size={14} /> วันเริ่มรับสินค้า
                </Typography>
                <TextField
                  type="datetime-local"
                  value={pickup.startDate}
                  onChange={(e) => setPickup({ ...pickup, startDate: e.target.value })}
                  fullWidth
                  sx={inputSx}
                />
              </Box>
              <Box>
                <Typography sx={{ fontSize: '0.85rem', color: '#06b6d4', mb: 1, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <CalendarDays size={14} /> วันสิ้นสุดรับสินค้า
                </Typography>
                <TextField
                  type="datetime-local"
                  value={pickup.endDate}
                  onChange={(e) => setPickup({ ...pickup, endDate: e.target.value })}
                  fullWidth
                  sx={inputSx}
                />
              </Box>
            </Box>

            {/* Notes */}
            <Box>
              <Typography sx={{ fontSize: '0.85rem', color: '#06b6d4', mb: 1, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <StickyNote size={14} /> หมายเหตุเพิ่มเติม
              </Typography>
              <TextField
                placeholder="เช่น: กรุณานำบัตรนักศึกษามาด้วย"
                value={pickup.notes}
                onChange={(e) => setPickup({ ...pickup, notes: e.target.value })}
                fullWidth
                multiline
                rows={2}
                sx={inputSx}
              />
            </Box>

            {/* Auto Update Orders */}
            <Box sx={{ 
              p: 2, 
              borderRadius: '12px', 
              bgcolor: 'rgba(99,102,241,0.1)',
              border: '1px solid rgba(99,102,241,0.2)',
            }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={autoUpdateOrders}
                    onChange={(e) => setAutoUpdateOrders(e.target.checked)}
                    sx={{ color: '#6366f1', '&.Mui-checked': { color: '#6366f1' } }}
                  />
                }
                label={
                  <Box>
                    <Typography sx={{ fontWeight: 600, color: ADMIN_THEME.text, fontSize: '0.9rem' }}>
                      อัปเดตออเดอร์ที่จ่ายแล้วเป็น "พร้อมรับ" อัตโนมัติ
                    </Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: ADMIN_THEME.muted }}>
                      ออเดอร์สถานะ PAID ที่มีสินค้านี้จะเปลี่ยนเป็น READY ทันที
                    </Typography>
                  </Box>
                }
              />
            </Box>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ 
        borderTop: `1px solid ${ADMIN_THEME.border}`,
        px: 3,
        py: 2,
        gap: 1,
      }}>
        <Button 
          onClick={onClose}
          sx={{ color: ADMIN_THEME.muted }}
        >
          ยกเลิก
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving}
          variant="contained"
          startIcon={saving ? <CircularProgress size={16} /> : <Save />}
          sx={{ ...gradientButtonSx }}
        >
          {saving ? 'กำลังบันทึก...' : 'บันทึก'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const ProductEditDialog = ({ product, onClose, onChange, onSave, isSaving }: any): JSX.Element => {
  const [newSizeKey, setNewSizeKey] = useState('');
  const [newSizePrice, setNewSizePrice] = useState<number | ''>('');
  const [coverUploadLoading, setCoverUploadLoading] = useState(false);
  // Variants state for non-apparel products
  const [newVariantName, setNewVariantName] = useState('');
  const [newVariantPrice, setNewVariantPrice] = useState<number | ''>('');
  const [newVariantStock, setNewVariantStock] = useState<number | ''>('');
  const MAX_IMAGE_SIZE = 3 * 1024 * 1024; // ~3MB
  
  // Helper: Check if product needs variants instead of sizes
  const needsVariants = () => {
    const category = (product as any).category;
    return category && category !== 'APPAREL';
  };
  
  // Variant handlers
  const handleAddVariant = () => {
    if (!newVariantName.trim()) return;
    const newVariant = {
      id: `var_${Date.now()}`,
      name: newVariantName.trim(),
      price: typeof newVariantPrice === 'number' ? newVariantPrice : product.basePrice || 0,
      stock: typeof newVariantStock === 'number' ? newVariantStock : null,
      isActive: true,
    };
    const variants = [...((product as any).variants || []), newVariant];
    onChange({ ...product, variants } as any);
    setNewVariantName('');
    setNewVariantPrice('');
    setNewVariantStock('');
  };
  
  const handleUpdateVariant = (variantId: string, field: string, value: any) => {
    const variants = ((product as any).variants || []).map((v: any) =>
      v.id === variantId ? { ...v, [field]: value } : v
    );
    onChange({ ...product, variants } as any);
  };
  
  const handleRemoveVariant = (variantId: string) => {
    const variants = ((product as any).variants || []).filter((v: any) => v.id !== variantId);
    onChange({ ...product, variants } as any);
  };

  const handleDialogClose = (_event?: unknown, reason?: 'backdropClick' | 'escapeKeyDown') => {
    if (reason === 'backdropClick' || reason === 'escapeKeyDown') return;
    onClose();
  };

  useEffect(() => {
    if (product && !product.coverImage && Array.isArray(product.images) && product.images.length > 0) {
      onChange({ ...product, coverImage: product.images[0] });
    }
  }, [product, onChange]);

  const filterValidFiles = (files: FileList | null) => {
    if (!files) return [];
    return Array.from(files).filter((file) => file.type.startsWith('image/') && file.size <= MAX_IMAGE_SIZE);
  };

  const handleSizePriceChange = (size: string, price: number) => {
    if (!size || Number.isNaN(price)) return;
    const next = { ...(product.sizePricing || {}) };
    next[size] = Math.max(0, price);
    onChange({ ...product, sizePricing: next });
  };

  const handleRemoveSize = (size: string) => {
    const next = { ...(product.sizePricing || {}) };
    delete next[size];
    onChange({ ...product, sizePricing: next });
  };

  const handleAddSize = () => {
    const key = newSizeKey.trim();
    if (!key) return;
    const priceNumber = typeof newSizePrice === 'number' ? newSizePrice : product.basePrice || 0;
    handleSizePriceChange(key, priceNumber);
    setNewSizeKey('');
    setNewSizePrice('');
  };

  const handleImagesUpload = async (files: FileList | null) => {
    const validFiles = filterValidFiles(files);
    if (validFiles.length === 0) return;
    const readers = validFiles.map((file) => new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    }));

    const dataUrls = await Promise.all(readers);
    const merged = [...(product.images || []), ...dataUrls];
    const nextCover = product.coverImage || merged[0] || '';
    onChange({ ...product, images: merged, coverImage: nextCover });
  };

  const handleRemoveImage = (imgUrl: string) => {
    const nextImages = (product.images || []).filter((img: string) => img !== imgUrl);
    const nextCover = imgUrl === product.coverImage ? (nextImages[0] || '') : (product.coverImage || '');
    onChange({ ...product, images: nextImages, coverImage: nextCover });
  };

  const handleSetCover = (img: string) => {
    onChange({ ...product, coverImage: img });
  };

  const handleCoverUpload = async (files: FileList | null) => {
    const validFiles = filterValidFiles(files);
    if (validFiles.length === 0) return;
    setCoverUploadLoading(true);
    try {
      const file = validFiles[0];
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const merged = [...(product.images || []), dataUrl];
      onChange({ ...product, images: merged, coverImage: dataUrl });
    } finally {
      setCoverUploadLoading(false);
    }
  };

  const isMobileDevice = useMediaQuery('(max-width: 600px)');

  return (
    <Dialog
      open={!!product}
      onClose={handleDialogClose}
      maxWidth="md"
      fullWidth
      fullScreen={isMobileDevice}
      disableEscapeKeyDown
      PaperProps={{ 
        sx: { 
          ...glassCardSx, 
          background: 'var(--glass-strong)', 
          borderColor: ADMIN_THEME.border,
          borderRadius: isMobileDevice ? 0 : undefined,
        } 
      }}
    >
      <DialogTitle sx={{ background: ADMIN_THEME.gradient, color: '#fff', fontWeight: 'bold', pb: 2 }}>
        {product.id.startsWith('prod_') ? 'New' : 'Edit'} Product
      </DialogTitle>
      <IconButton
        onClick={onClose}
        sx={{ position: 'absolute', right: 8, top: 8, color: '#fff' }}
      >
        <Close />
      </IconButton>
      <DialogContent sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' }, gap: 2, pt: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField
          label="Product Name"
          value={product.name}
          onChange={(e) => onChange({...product, name: e.target.value})}
          fullWidth
          sx={inputSx}
        />

        <TextField
          label="Slug (ลิงก์สินค้า)"
          value={(product as any).slug || ''}
          onChange={(e) => onChange({...product, slug: e.target.value.replace(/[^a-zA-Z0-9\u0E00-\u0E7F\s-]/g, '').replace(/\s+/g, '-').toLowerCase()} as any)}
          fullWidth
          placeholder={product.name.replace(/[^\u0E00-\u0E7Fa-zA-Z0-9\s-]/g, '').replace(/\s+/g, '-').toLowerCase() || 'auto-generated'}
          helperText={`ลิงก์: ${typeof window !== 'undefined' ? window.location.origin : ''}/?p=${product.id}`}
          sx={inputSx}
        />

        {/* Category Selection */}
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          <Autocomplete
            freeSolo
            options={PRODUCT_CATEGORIES as unknown as string[]}
            value={(product as any).category || 'OTHER'}
            onChange={(_e, newValue) => {
              const newCategory = newValue || 'OTHER';
              const subTypes = PRODUCT_SUBTYPES[newCategory] || ['OTHER'];
              onChange({
                ...product, 
                category: newCategory,
                subType: subTypes[0] || 'OTHER',
                // Legacy type compatibility
                type: newCategory === 'APPAREL' ? (product.type || 'CREW') : 'OTHER',
              } as any);
            }}
            onInputChange={(_e, newInputValue) => {
              if (newInputValue && !PRODUCT_CATEGORIES.includes(newInputValue as any)) {
                onChange({
                  ...product, 
                  category: newInputValue,
                  type: 'OTHER',
                } as any);
              }
            }}
            getOptionLabel={(option) => {
              const label = CATEGORY_LABELS[option] || option;
              return label;
            }}
            renderOption={(props, option) => (
              <li {...props} key={option} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {CATEGORY_ICON_COMPONENTS[option] || <Inventory size={16} />} {CATEGORY_LABELS[option] || option}
              </li>
            )}
            renderInput={(params) => (
              <TextField
                {...params}
                label="หมวดหมู่"
                placeholder="เลือกหรือพิมพ์เอง"
                sx={inputSx}
              />
            )}
            sx={{ '& .MuiOutlinedInput-root': inputSx['& .MuiOutlinedInput-root'] }}
          />

          <Autocomplete
            freeSolo
            options={[
              ...(PRODUCT_SUBTYPES[(product as any).category || 'OTHER'] || ['OTHER']),
              // Add common custom options
              'ของขวัญ', 'ชุดกีฬา', 'อุปกรณ์', 'เครื่องเขียน', 'กระเป๋า', 'รองเท้า', 'หมวก', 'ผ้าพันคอ'
            ]}
            value={(product as any).subType || product.type || 'OTHER'}
            onChange={(_e, newValue) => {
              const newSubType = newValue || 'OTHER';
              onChange({
                ...product, 
                subType: newSubType,
                // Legacy type compatibility - keep JERSEY/CREW/OTHER
                type: ['JERSEY', 'CREW'].includes(newSubType) ? newSubType : 'OTHER',
              } as any);
            }}
            onInputChange={(_e, newInputValue) => {
              if (newInputValue) {
                onChange({
                  ...product, 
                  subType: newInputValue,
                  type: ['JERSEY', 'CREW'].includes(newInputValue) ? newInputValue : 'OTHER',
                } as any);
              }
            }}
            getOptionLabel={(option) => SUBTYPE_LABELS[option] || option}
            renderOption={(props, option) => (
              <li {...props} key={option}>
                {SUBTYPE_LABELS[option] || option}
              </li>
            )}
            renderInput={(params) => (
              <TextField
                {...params}
                label="ประเภทย่อย"
                placeholder="เลือกหรือพิมพ์เอง"
                sx={inputSx}
                helperText="พิมพ์ชื่อประเภทเองได้"
              />
            )}
            sx={{ '& .MuiOutlinedInput-root': inputSx['& .MuiOutlinedInput-root'] }}
          />
        </Box>

        {/* Legacy type for backward compatibility (hidden) */}
        <input type="hidden" value={product.type} />

        <TextField
          label="Description (รองรับการเว้นบรรทัด)"
          multiline
          rows={4}
          value={product.description}
          onChange={(e) => onChange({...product, description: e.target.value})}
          fullWidth
          sx={inputSx}
          placeholder="เช่น:
เสื้อ Jersey รุ่นใหม่
เนื้อผ้า: Cool Elite
ดีไซน์: แขนสั้นและยาว"
          helperText="กด Enter เพื่อเว้นบรรทัดใหม่"
        />

        {/* Camp/Event specific fields */}
        {((product as any).category === 'CAMP_FEE' || (product as any).subType === 'CAMP_REGISTRATION') && (
          <Box sx={{ bgcolor: 'rgba(245,158,11,0.1)', p: 2, borderRadius: 1, border: '1px solid rgba(245,158,11,0.3)', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: 1 }}>
              <Tent size={16} /> ข้อมูลค่าย
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <TextField
                label="ชื่อค่าย"
                value={(product as any).campInfo?.campName || ''}
                onChange={(e) => onChange({...product, campInfo: { ...(product as any).campInfo, campName: e.target.value }} as any)}
                fullWidth
                sx={inputSx}
              />
              <TextField
                label="วันที่จัดค่าย"
                type="date"
                value={(product as any).campInfo?.campDate || ''}
                onChange={(e) => onChange({...product, campInfo: { ...(product as any).campInfo, campDate: e.target.value }} as any)}
                fullWidth
                sx={inputSx}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="สถานที่"
                value={(product as any).campInfo?.location || ''}
                onChange={(e) => onChange({...product, campInfo: { ...(product as any).campInfo, location: e.target.value }} as any)}
                fullWidth
                sx={inputSx}
              />
              <TextField
                label="ผู้จัด"
                value={(product as any).campInfo?.organizer || ''}
                onChange={(e) => onChange({...product, campInfo: { ...(product as any).campInfo, organizer: e.target.value }} as any)}
                fullWidth
                sx={inputSx}
              />
              <TextField
                label="จำนวนรับสูงสุด"
                type="number"
                value={(product as any).campInfo?.maxParticipants || ''}
                onChange={(e) => onChange({...product, campInfo: { ...(product as any).campInfo, maxParticipants: Number(e.target.value) || 0 }} as any)}
                fullWidth
                sx={inputSx}
              />
              <TextField
                label="เงื่อนไข/ข้อกำหนด"
                value={(product as any).campInfo?.requirements || ''}
                onChange={(e) => onChange({...product, campInfo: { ...(product as any).campInfo, requirements: e.target.value }} as any)}
                fullWidth
                sx={inputSx}
                multiline
                rows={2}
              />
            </Box>
          </Box>
        )}

        {((product as any).category === 'EVENT' || (product as any).subType === 'EVENT_TICKET') && (
          <Box sx={{ bgcolor: 'rgba(236,72,153,0.1)', p: 2, borderRadius: 1, border: '1px solid rgba(236,72,153,0.3)', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#f472b6', display: 'flex', alignItems: 'center', gap: 1 }}>
              <Ticket size={16} /> ข้อมูลอีเวนต์
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <TextField
                label="ชื่ออีเวนต์"
                value={(product as any).eventInfo?.eventName || ''}
                onChange={(e) => onChange({...product, eventInfo: { ...(product as any).eventInfo, eventName: e.target.value }} as any)}
                fullWidth
                sx={inputSx}
              />
              <TextField
                label="วันที่จัดงาน"
                type="datetime-local"
                value={(product as any).eventInfo?.eventDate || ''}
                onChange={(e) => onChange({...product, eventInfo: { ...(product as any).eventInfo, eventDate: e.target.value }} as any)}
                fullWidth
                sx={inputSx}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="สถานที่"
                value={(product as any).eventInfo?.venue || ''}
                onChange={(e) => onChange({...product, eventInfo: { ...(product as any).eventInfo, venue: e.target.value }} as any)}
                fullWidth
                sx={inputSx}
              />
              <TextField
                label="ผู้จัด"
                value={(product as any).eventInfo?.organizer || ''}
                onChange={(e) => onChange({...product, eventInfo: { ...(product as any).eventInfo, organizer: e.target.value }} as any)}
                fullWidth
                sx={inputSx}
              />
            </Box>
          </Box>
        )}

        {/* Product options - only for APPAREL */}
        {((product as any).category === 'APPAREL' || !((product as any).category)) && (
          <Box sx={{ bgcolor: ADMIN_THEME.glassSoft, p: 2, borderRadius: 1, border: `1px solid ${ADMIN_THEME.border}`, display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: ADMIN_THEME.text, mb: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Settings size={16} /> ตัวเลือกเสื้อ
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={product.options?.requiresSize !== false}
                  onChange={(e) => onChange({...product, options: { ...product.options, requiresSize: e.target.checked }} as any)}
                />
              }
              label="ต้องเลือกไซส์"
              sx={{ color: ADMIN_THEME.text }}
            />
          </Box>
        )}

        {/* Stock management */}
        <Box sx={{ bgcolor: ADMIN_THEME.glassSoft, p: 2, borderRadius: 1, border: `1px solid ${ADMIN_THEME.border}`, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: ADMIN_THEME.text, display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Inventory size={16} /> จำนวนสินค้า
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <TextField
              label="จำนวนในสต็อก (ปล่อยว่าง = ไม่จำกัด)"
              type="number"
              value={(product as any).stock ?? ''}
              onChange={(e) => onChange({...product, stock: e.target.value === '' ? null : Number(e.target.value)} as any)}
              fullWidth
              inputProps={{ min: 0 }}
              sx={inputSx}
            />
            <TextField
              label="จำนวนสูงสุดต่อออเดอร์"
              type="number"
              value={(product as any).maxPerOrder || ''}
              onChange={(e) => onChange({...product, maxPerOrder: e.target.value === '' ? null : Number(e.target.value)} as any)}
              fullWidth
              inputProps={{ min: 1 }}
              sx={inputSx}
            />
          </Box>
        </Box>

        <TextField
          label="Base Price (฿)"
          type="number"
          value={product.basePrice}
          onChange={(e) => onChange({...product, basePrice: Number(e.target.value)})}
          fullWidth
          inputProps={{ min: 0, max: 999999 }}
          sx={inputSx}
        />

        {/* Size pricing - only show for APPAREL */}
        {((product as any).category === 'APPAREL' || !((product as any).category)) && (product as any).options?.requiresSize !== false && (
        <Box sx={{ bgcolor: ADMIN_THEME.glassSoft, p: 2, borderRadius: 1, border: `1px solid ${ADMIN_THEME.border}`, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: ADMIN_THEME.text }}>ราคาต่อไซส์</Typography>
            <Typography variant="caption" sx={{ color: ADMIN_THEME.muted }}>ปล่อยว่างจะใช้ราคา base</Typography>
          </Box>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {SIZES.map((size) => (
              <Chip
                key={size}
                label={product.sizePricing?.[size] ? `${size}: ${product.sizePricing[size].toLocaleString()}฿` : `ตั้งราคา ${size}`}
                onClick={() => handleSizePriceChange(size, product.basePrice || 0)}
                sx={{
                  bgcolor: product.sizePricing?.[size] ? 'rgba(99,102,241,0.18)' : ADMIN_THEME.glass,
                  border: `1px solid ${ADMIN_THEME.border}`,
                  color: ADMIN_THEME.text,
                  fontWeight: 700,
                }}
              />
            ))}
          </Box>

          {Object.entries(product.sizePricing || {}).length > 0 && (
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 1 }}>
              {Object.entries(product.sizePricing || {}).map(([size, price]) => (
                <Box key={size} sx={{ display: 'contents' }}>
                  <TextField
                    label={`ไซส์ ${size}`}
                    type="number"
                    value={price}
                    onChange={(e) => handleSizePriceChange(size, Number(e.target.value))}
                    inputProps={{ min: 0, max: 999999 }}
                    sx={{ ...inputSx, '& .MuiOutlinedInput-root': { ...inputSx['& .MuiOutlinedInput-root'], minHeight: 52 } }}
                  />
                  <IconButton onClick={() => handleRemoveSize(size)} sx={{ color: '#f87171' }} aria-label={`remove-size-${size}`}>
                    <Delete />
                  </IconButton>
                </Box>
              ))}
            </Box>
          )}

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr auto' }, gap: 1 }}>
            <TextField
              label="เพิ่มไซส์ใหม่"
              value={newSizeKey}
              onChange={(e) => setNewSizeKey(e.target.value.trimStart())}
              sx={inputSx}
            />
            <TextField
              label="ราคา (฿)"
              type="number"
              value={newSizePrice}
              onChange={(e) => setNewSizePrice(e.target.value === '' ? '' : Number(e.target.value))}
              inputProps={{ min: 0, max: 999999 }}
              sx={inputSx}
            />
            <Button onClick={handleAddSize} variant="contained" sx={gradientButtonSx} startIcon={<Add size={20} />}>เพิ่มไซส์</Button>
          </Box>
        </Box>
        )}

        {/* Variants Section - for non-APPAREL products */}
        {needsVariants() && (
          <Box sx={{ bgcolor: 'rgba(139,92,246,0.1)', p: 2, borderRadius: 1, border: '1px solid rgba(139,92,246,0.3)', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#a78bfa', display: 'flex', alignItems: 'center', gap: 1 }}>
                <Palette size={16} /> ตัวเลือกสินค้า (Variants)
              </Typography>
              <Typography variant="caption" sx={{ color: ADMIN_THEME.muted }}>
                สำหรับสินค้าที่มีหลายแบบ/ราคา
              </Typography>
            </Box>
            
            <Typography variant="caption" sx={{ color: ADMIN_THEME.muted, mb: 1 }}>
              เพิ่มตัวเลือกเช่น ขนาด S/M/L, สีต่างๆ, รุ่นต่างๆ พร้อมกำหนดราคาและจำนวนแยกได้
            </Typography>

            {/* Existing Variants List */}
            {((product as any).variants || []).length > 0 && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {((product as any).variants || []).map((variant: any) => (
                  <Box key={variant.id} sx={{ 
                    display: 'grid', 
                    gridTemplateColumns: { xs: '1fr', sm: '2fr 1fr 1fr auto' }, 
                    gap: 1, 
                    alignItems: 'center',
                    p: 1.5,
                    bgcolor: 'var(--glass-bg)',
                    borderRadius: 1,
                    border: `1px solid ${ADMIN_THEME.border}`,
                  }}>
                    <TextField
                      label="ชื่อตัวเลือก"
                      value={variant.name}
                      onChange={(e) => handleUpdateVariant(variant.id, 'name', e.target.value)}
                      size="small"
                      sx={inputSx}
                    />
                    <TextField
                      label="ราคา (฿)"
                      type="number"
                      value={variant.price}
                      onChange={(e) => handleUpdateVariant(variant.id, 'price', Number(e.target.value))}
                      size="small"
                      inputProps={{ min: 0 }}
                      sx={inputSx}
                    />
                    <TextField
                      label="จำนวน"
                      type="number"
                      value={variant.stock ?? ''}
                      onChange={(e) => handleUpdateVariant(variant.id, 'stock', e.target.value === '' ? null : Number(e.target.value))}
                      size="small"
                      inputProps={{ min: 0 }}
                      placeholder="ไม่จำกัด"
                      sx={inputSx}
                    />
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <IconButton 
                        size="small"
                        onClick={() => handleUpdateVariant(variant.id, 'isActive', !variant.isActive)}
                        sx={{ color: variant.isActive ? '#22c55e' : '#64748b' }}
                      >
                        {variant.isActive ? <Visibility size={20} /> : <VisibilityOff size={20} />}
                      </IconButton>
                      <IconButton 
                        size="small"
                        onClick={() => handleRemoveVariant(variant.id)} 
                        sx={{ color: '#f87171' }}
                      >
                        <Delete size={20} />
                      </IconButton>
                    </Box>
                  </Box>
                ))}
              </Box>
            )}

            {/* Add New Variant */}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '2fr 1fr 1fr auto' }, gap: 1, mt: 1 }}>
              <TextField
                label="ชื่อตัวเลือกใหม่"
                value={newVariantName}
                onChange={(e) => setNewVariantName(e.target.value)}
                size="small"
                placeholder="เช่น ขนาด S, สีแดง, รุ่น A"
                sx={inputSx}
              />
              <TextField
                label="ราคา (฿)"
                type="number"
                value={newVariantPrice}
                onChange={(e) => setNewVariantPrice(e.target.value === '' ? '' : Number(e.target.value))}
                size="small"
                inputProps={{ min: 0 }}
                placeholder={`${product.basePrice || 0}`}
                sx={inputSx}
              />
              <TextField
                label="จำนวน"
                type="number"
                value={newVariantStock}
                onChange={(e) => setNewVariantStock(e.target.value === '' ? '' : Number(e.target.value))}
                size="small"
                inputProps={{ min: 0 }}
                placeholder="ไม่จำกัด"
                sx={inputSx}
              />
              <Button 
                onClick={handleAddVariant} 
                variant="contained" 
                size="small"
                startIcon={<Add />}
                sx={{ 
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
                  minWidth: 100,
                }}
              >
                เพิ่ม
              </Button>
            </Box>

            {/* Quick Add Common Variants */}
            <Box sx={{ mt: 1 }}>
              <Typography variant="caption" sx={{ color: ADMIN_THEME.muted, mb: 1, display: 'block' }}>
                เพิ่มตัวเลือกด่วน:
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {[
                  { name: 'ขนาด S', price: product.basePrice },
                  { name: 'ขนาด M', price: product.basePrice },
                  { name: 'ขนาด L', price: product.basePrice },
                  { name: 'สีดำ', price: product.basePrice },
                  { name: 'สีขาว', price: product.basePrice },
                  { name: 'ปกติ', price: product.basePrice },
                  { name: 'พิเศษ', price: Math.round((product.basePrice || 0) * 1.2) },
                ].map((preset) => {
                  const exists = ((product as any).variants || []).some((v: any) => v.name === preset.name);
                  return (
                    <Chip
                      key={preset.name}
                      label={preset.name}
                      size="small"
                      onClick={() => {
                        if (exists) return;
                        const newVariant = {
                          id: `var_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                          name: preset.name,
                          price: preset.price || 0,
                          stock: null,
                          isActive: true,
                        };
                        onChange({ ...product, variants: [...((product as any).variants || []), newVariant] } as any);
                      }}
                      sx={{
                        cursor: exists ? 'default' : 'pointer',
                        bgcolor: exists ? 'rgba(139,92,246,0.3)' : 'transparent',
                        color: '#a78bfa',
                        border: '1px dashed rgba(139,92,246,0.5)',
                        opacity: exists ? 0.5 : 1,
                        '&:hover': { bgcolor: exists ? undefined : 'rgba(139,92,246,0.15)' },
                      }}
                    />
                  );
                })}
              </Box>
            </Box>
          </Box>
        )}

        {/* Schedule Section */}
        <Box sx={{ bgcolor: ADMIN_THEME.glassSoft, p: 2, borderRadius: 1, border: `1px solid ${ADMIN_THEME.border}`, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{
              width: 36,
              height: 36,
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <DateRange size={20} color="#fff" />
            </Box>
            <Box>
              <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: ADMIN_THEME.text }}>กำหนดเวลาขาย</Typography>
              <Typography sx={{ fontSize: '0.75rem', color: ADMIN_THEME.muted }}>ตั้งเวลาเปิด-ปิดขายอัตโนมัติ</Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <Box>
              <Typography sx={{ fontSize: '0.8rem', color: 'var(--text-muted)', mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <FiberManualRecord size={10} color="#22c55e" /> เปิดขายเมื่อ
              </Typography>
              <TextField
                type="datetime-local"
                value={toDateTimeLocal(product.startDate)}
                onChange={(e) => onChange({...product, startDate: e.target.value})}
                fullWidth
                InputLabelProps={{ shrink: true }}
                sx={{
                  ...inputSx,
                  '& .MuiOutlinedInput-root': {
                    ...inputSx['& .MuiOutlinedInput-root'],
                    borderRadius: '10px',
                  },
                }}
              />
              {product.startDate && (
                <Button 
                  size="small" 
                  onClick={() => onChange({...product, startDate: ''})}
                  sx={{ mt: 0.5, color: 'var(--text-muted)', textTransform: 'none', fontSize: '0.7rem' }}
                >
                  ✕ ล้างวันเริ่ม
                </Button>
              )}
            </Box>
            <Box>
              <Typography sx={{ fontSize: '0.8rem', color: 'var(--text-muted)', mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <FiberManualRecord size={10} color="#ef4444" /> ปิดขายเมื่อ
              </Typography>
              <TextField
                type="datetime-local"
                value={toDateTimeLocal(product.endDate)}
                onChange={(e) => onChange({...product, endDate: e.target.value})}
                fullWidth
                InputLabelProps={{ shrink: true }}
                sx={{
                  ...inputSx,
                  '& .MuiOutlinedInput-root': {
                    ...inputSx['& .MuiOutlinedInput-root'],
                    borderRadius: '10px',
                  },
                }}
              />
              {product.endDate && (
                <Button 
                  size="small" 
                  onClick={() => onChange({...product, endDate: ''})}
                  sx={{ mt: 0.5, color: 'var(--text-muted)', textTransform: 'none', fontSize: '0.7rem' }}
                >
                  ✕ ล้างวันสิ้นสุด
                </Button>
              )}
            </Box>
          </Box>

          {/* Status Preview */}
          {(() => {
            const { status } = isProductOpen(product);
            const statusInfo: Record<string, { icon: React.ReactNode, text: string, color: string }> = {
              upcoming: { icon: <AccessTime size={16} />, text: 'สินค้าจะเปิดขายเมื่อถึงเวลาที่กำหนด', color: '#f59e0b' },
              active: { icon: <FiberManualRecord size={12} color="#22c55e" />, text: 'สินค้ากำลังเปิดขายอยู่', color: '#10b981' },
              ended: { icon: <FiberManualRecord size={12} color="#ef4444" />, text: 'หมดเวลาขายแล้ว', color: '#ef4444' },
              always: { icon: <DateRange size={16} />, text: 'ไม่มีกำหนดเวลา (เปิดตลอด)', color: 'var(--text-muted)' },
            };
            const info = statusInfo[status];
            return (
              <Box sx={{
                mt: 1,
                p: 1.5,
                borderRadius: '10px',
                bgcolor: `${info.color}15`,
                border: `1px solid ${info.color}30`,
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
              }}>
                <Box sx={{ color: info.color, display: 'flex', alignItems: 'center' }}>{info.icon}</Box>
                <Typography sx={{ fontSize: '0.85rem', color: info.color, fontWeight: 500 }}>
                  {info.text}
                </Typography>
              </Box>
            );
          })()}
        </Box>

        <Box sx={{ bgcolor: ADMIN_THEME.glassSoft, p: 2, borderRadius: 1, border: `1px solid ${ADMIN_THEME.border}`, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: ADMIN_THEME.text }}>รูปภาพสินค้า</Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button variant="outlined" component="label" sx={{ borderColor: ADMIN_THEME.border, color: ADMIN_THEME.text }}>
                เพิ่มหลายรูป
                <input hidden accept="image/*" multiple type="file" onChange={(e) => handleImagesUpload(e.target.files)} />
              </Button>
              <Button variant="contained" component="label" disabled={coverUploadLoading} sx={{ background: ADMIN_THEME.gradient, color: '#fff' }}>
                ตั้งรูปปก
                <input hidden accept="image/*" type="file" onChange={(e) => handleCoverUpload(e.target.files)} />
              </Button>
            </Box>
          </Box>

          <Typography variant="caption" sx={{ color: ADMIN_THEME.muted }}>
            รองรับหลายไฟล์ บันทึกเป็น Data URL · กด "ตั้งเป็นปก" เพื่อใช้ภาพหน้าปกสินค้า
          </Typography>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)' }, gap: 1.5 }}>
            {(() => {
              const images = product.images || [];
              const coverImage = product.coverImage;
              // เรียงให้ coverImage ขึ้นก่อน
              const sortedImages = coverImage && images.includes(coverImage)
                ? [coverImage, ...images.filter((img: string) => img !== coverImage)]
                : images;
              return sortedImages;
            })().map((img: string, idx: number) => {
              const isCover = product.coverImage === img;
              return (
                <Box key={idx} sx={{ position: 'relative', borderRadius: 1.5, overflow: 'hidden', border: `1px solid ${isCover ? '#6366f1' : ADMIN_THEME.border}`, boxShadow: isCover ? '0 0 0 2px rgba(99,102,241,0.35)' : 'none' }}>
                  {isCover && (
                    <Chip label="รูปปก" size="small" sx={{ position: 'absolute', top: 6, left: 6, bgcolor: '#6366f1', color: '#fff', zIndex: 1 }} />
                  )}
                  <Box component="img" src={img} alt={`product-${idx}`} sx={{ width: '100%', height: 140, objectFit: 'cover', display: 'block' }} />
                  <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 0.5, p: 1 }}>
                    <Button size="small" variant="contained" onClick={() => handleSetCover(img)} sx={{ background: 'rgba(99,102,241,0.9)', color: '#fff', textTransform: 'none' }}>
                      ตั้งเป็นปก
                    </Button>
                    <Button size="small" variant="outlined" onClick={() => handleRemoveImage(img)} sx={{ color: '#fff', borderColor: 'var(--glass-border)', textTransform: 'none' }}>
                      ลบรูป
                    </Button>
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>

        <Box sx={{ bgcolor: ADMIN_THEME.glassSoft, p: 2, borderRadius: 1, border: `1px solid ${ADMIN_THEME.border}` }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 2, color: ADMIN_THEME.text }}>Product Options</Typography>
          {[
            { key: 'hasCustomName', label: 'Allow Custom Name' },
            { key: 'hasCustomNumber', label: 'Allow Custom Number' },
            { key: 'hasLongSleeve', label: 'Offer Long Sleeve' }
          ].map(opt => (
            <FormControlLabel
              key={opt.key}
              control={
                <Checkbox
                  checked={(product.options as any)[opt.key]}
                  onChange={(e) => onChange({
                    ...product,
                    options: {...product.options, [opt.key]: e.target.checked}
                  })}
                />
              }
              label={opt.label}
              sx={{ color: ADMIN_THEME.text }}
            />
          ))}
          
          {/* Long Sleeve Price Input - แสดงเมื่อเปิดใช้ hasLongSleeve */}
          {product.options?.hasLongSleeve && (
            <Box sx={{ mt: 1.5, ml: 4 }}>
              <TextField
                label="ราคาเพิ่มแขนยาว (฿)"
                type="number"
                value={product.options?.longSleevePrice ?? 50}
                onChange={(e) => onChange({
                  ...product,
                  options: { ...product.options, longSleevePrice: Math.max(0, Number(e.target.value)) }
                })}
                inputProps={{ min: 0, max: 999999 }}
                size="small"
                sx={{ ...inputSx, width: 180 }}
                helperText="ราคาที่จะบวกเพิ่มเมื่อเลือกแขนยาว"
              />
            </Box>
          )}
        </Box>

        {/* Custom Tags Section */}
        <Box sx={{ bgcolor: ADMIN_THEME.glassSoft, p: 2, borderRadius: 1, border: `1px solid ${ADMIN_THEME.border}` }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1.5, color: ADMIN_THEME.text, display: 'flex', alignItems: 'center', gap: 1 }}>
            <LocalOffer size={20} />
            แท้กสินค้า (Custom Tags)
          </Typography>
          <Typography variant="caption" sx={{ color: ADMIN_THEME.muted, display: 'block', mb: 2 }}>
            ตั้งค่าแท้กที่จะแสดงบนการ์ดสินค้า หากไม่ตั้งค่าจะใช้แท้กอัตโนมัติจาก options
          </Typography>
          
          {/* Tag List */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
            {((product.customTags || []) as Array<{ text: string; color: string; bgColor?: string }>).map((tag, idx) => (
              <Chip
                key={idx}
                label={tag.text}
                onDelete={() => {
                  const newTags = [...(product.customTags || [])];
                  newTags.splice(idx, 1);
                  onChange({ ...product, customTags: newTags });
                }}
                sx={{
                  bgcolor: tag.bgColor || `${tag.color}20`,
                  color: tag.color,
                  border: `1px solid ${tag.color}40`,
                  '& .MuiChip-deleteIcon': { color: tag.color },
                }}
              />
            ))}
            {(!product.customTags || product.customTags.length === 0) && (
              <Typography variant="caption" sx={{ color: ADMIN_THEME.muted, fontStyle: 'italic' }}>
                ยังไม่มีแท้ก (ใช้แท้กอัตโนมัติ)
              </Typography>
            )}
          </Box>

          {/* Add New Tag */}
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <TextField
              label="ข้อความแท้ก"
              size="small"
              placeholder="เช่น สินค้ามาใหม่"
              sx={{ ...inputSx, flex: 1, minWidth: 150 }}
              inputProps={{ id: 'new-tag-text' }}
            />
            <TextField
              label="สี"
              size="small"
              type="color"
              defaultValue="#10b981"
              sx={{ ...inputSx, width: 80 }}
              inputProps={{ id: 'new-tag-color' }}
            />
            <Button
              variant="contained"
              size="small"
              onClick={() => {
                const textEl = document.getElementById('new-tag-text') as HTMLInputElement;
                const colorEl = document.getElementById('new-tag-color') as HTMLInputElement;
                if (textEl?.value?.trim()) {
                  const newTag = {
                    text: textEl.value.trim(),
                    color: colorEl?.value || '#10b981',
                    bgColor: `${colorEl?.value || '#10b981'}20`,
                  };
                  onChange({
                    ...product,
                    customTags: [...(product.customTags || []), newTag]
                  });
                  textEl.value = '';
                }
              }}
              sx={{ bgcolor: ADMIN_THEME.primary, minWidth: 80 }}
            >
              เพิ่ม
            </Button>
          </Box>
          
          {/* Quick Add Preset Tags */}
          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" sx={{ color: ADMIN_THEME.muted, mb: 1, display: 'block' }}>
              แท้กยอดนิยม:
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {[
                { text: 'สินค้ามาใหม่', color: '#f59e0b' },
                { text: 'ขายดี', color: '#ef4444' },
                { text: 'Limited', color: '#8b5cf6' },
                { text: 'Pre-order', color: '#3b82f6' },
                { text: 'พร้อมส่ง', color: '#10b981' },
              ].map((preset) => {
                const isAdded = ((product.customTags || []) as Array<{ text: string }>).some(t => t.text === preset.text);
                return (
                <Chip
                  key={preset.text}
                  label={preset.text}
                  size="small"
                  onClick={() => {
                    if (isAdded) return;
                    onChange({
                      ...product,
                      customTags: [...(product.customTags || []), { ...preset, bgColor: `${preset.color}20` }]
                    });
                  }}
                  sx={{
                    cursor: 'pointer',
                    bgcolor: isAdded ? `${preset.color}30` : 'transparent',
                    color: preset.color,
                    border: `1px dashed ${preset.color}60`,
                    '&:hover': { bgcolor: `${preset.color}20` },
                  }}
                />
              );})}
            </Box>
          </Box>
        </Box>

        <FormControlLabel
          control={
            <Switch
              checked={product.isActive}
              onChange={(e) => onChange({...product, isActive: e.target.checked})}
            />
          }
          label={product.isActive ? 'Active' : 'Inactive'}
          sx={{ color: ADMIN_THEME.text }}
        />
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: ADMIN_THEME.text }}>Preview</Typography>
          <Card sx={{ ...glassCardSx, p: 0, overflow: 'hidden' }}>
            <Box sx={{ height: 180, background: product.coverImage || (product.images?.[0] || '') ? `url(${product.coverImage || product.images?.[0]})` : ADMIN_THEME.gradient, backgroundSize: 'cover', backgroundPosition: 'center' }} />
            <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>{product.name || 'ชื่อสินค้า'}</Typography>
              <Typography variant="caption" sx={{ color: ADMIN_THEME.muted }}>{product.type}</Typography>
              <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#10b981' }}>฿{product.basePrice || 0}</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {(product.images || []).slice(0, 3).map((img: string | undefined, idx: number) => (
                  <Chip key={img || idx} label={`รูป ${idx + 1}`} size="small" />
                ))}
              </Stack>
              {Object.keys(product.sizePricing || {}).length > 0 && (
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  {Object.entries(product.sizePricing || {})
                    .slice(0, 5)
                    .map((entry: [string, unknown]) => {
                      const [size, raw] = entry;
                      const price = Number(raw) || 0;
                      return <Chip key={size} label={`${size}: ฿${price}`} size="small" />;
                    })}
                </Stack>
              )}
              <Chip label={product.isActive ? 'Published' : 'Draft'} color={product.isActive ? 'success' : 'default'} size="small" />
            </CardContent>
          </Card>
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2, gap: 1, borderTop: `1px solid ${ADMIN_THEME.border}` }}>
        <Button onClick={onClose} variant="outlined" sx={{ borderColor: ADMIN_THEME.border, color: ADMIN_THEME.text, '&:hover': { borderColor: '#6366f1' } }}>Cancel</Button>
        <Button
          onClick={() => onSave('draft')}
          variant="outlined"
          disabled={isSaving}
          sx={{ borderColor: ADMIN_THEME.border, color: ADMIN_THEME.text }}
        >
          {isSaving ? 'Saving...' : 'Save as Draft'}
        </Button>
        <Button
          onClick={() => onSave('publish')}
          variant="contained"
          disabled={isSaving}
          sx={gradientButtonSx}
        >
          {isSaving ? 'Saving...' : 'Save & Publish'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
