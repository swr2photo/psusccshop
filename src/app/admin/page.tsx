'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { JSX } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';
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
  Checkbox,
  CircularProgress,
  Typography,
  Switch,
  InputAdornment,
  Stack,
  IconButton,
  useMediaQuery,
  Tooltip,
} from '@mui/material';

import {
  Dashboard,
  ShoppingCart,
  Receipt,
  Settings,
  History,
  Logout,
  Lock,
  Refresh,
  Add,
  Delete,
  Edit,
  Close,
  Search,
  Store,
  AttachMoney,
  DateRange,
  Notifications,
  Bolt,
  CheckCircle,
  LocalShipping,
  Save,
  Edit as EditIconMUI,
  Check,
  FormatLineSpacing,
  Clear,
} from '@mui/icons-material';

import { isAdmin, Product, ShopConfig, SIZES } from '@/lib/config';
import { deleteOrderAdmin, getAdminData, saveShopConfig, syncOrdersSheet, updateOrderAdmin, updateOrderStatusAPI } from '@/lib/api-client';

// ============== TYPES ==============
interface AdminDataResponse {
  orders?: any[];
  logs?: any[][];
  config?: ShopConfig;
}

interface AdminOrder {
  ref: string;
  name: string;
  email: string;
  amount: number;
  status: string;
  date?: string;
  raw: any;
}

interface Toast {
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}

// ============== CONSTANTS ==============
const DEFAULT_CONFIG: ShopConfig = {
  isOpen: true,
  closeDate: '',
  announcement: { enabled: false, message: '', color: 'blue' },
  products: [],
  sheetId: '',
  sheetUrl: '',
  bankAccount: { bankName: '', accountName: '', accountNumber: '' },
};

const ADMIN_CACHE_KEY = 'psusccshop-admin-cache';
let ADMIN_CACHE_DISABLED = false;

const normalizeStatusKey = (status?: string): string => (status || 'PENDING').toString().trim().toUpperCase();

const normalizeOrder = (order: any): AdminOrder => {
  const ref = order?.ref || order?.Ref || order?.orderRef || (order?._key ? String(order._key).split('/').pop()?.replace('.json', '') : '') || '';
  return {
    ref,
    name: order?.customerName || order?.Name || order?.name || '',
    email: order?.customerEmail || order?.Email || order?.email || '',
    amount: Number(order?.totalAmount ?? order?.FinalAmount ?? order?.amount ?? 0) || 0,
    status: normalizeStatusKey(order?.status || order?.Status),
    date: order?.date || order?.Timestamp || order?.timestamp || order?.createdAt || order?.created_at,
    raw: order || {},
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
    // Very minimal cache - only essential data
    const minimalCache = {
      config: {
        isOpen: payload.config?.isOpen ?? false,
        sheetId: payload.config?.sheetId || '',
        sheetUrl: payload.config?.sheetUrl || '',
        announcement: payload.config?.announcement,
        // Skip products entirely to save space
        products: [],
      },
      orders: (payload.orders || []).slice(0, 10).map(o => ({ 
        ref: o.ref, 
        status: o.status,
        name: o.name,
        amount: o.amount,
      })),
      logs: [],
    };
    
    try {
      window.localStorage.setItem(ADMIN_CACHE_KEY, JSON.stringify(minimalCache));
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

const ORDER_STATUSES = ['WAITING_PAYMENT', 'PENDING', 'PAID', 'READY', 'SHIPPED', 'COMPLETED', 'CANCELLED'];
const PRODUCT_TYPES = ['JERSEY', 'CREW', 'OTHER'];

// ============== NEW MODERN THEME ==============
const ADMIN_THEME = {
  // Base colors
  bg: '#0a0f1a',
  bgCard: 'rgba(15,23,42,0.7)',
  bgSidebar: 'rgba(10,15,26,0.95)',
  bgHeader: 'rgba(15,23,42,0.85)',
  
  // Text colors
  text: '#f1f5f9',
  textSecondary: '#94a3b8',
  muted: '#64748b',
  
  // Borders
  border: 'rgba(255,255,255,0.08)',
  borderActive: 'rgba(99,102,241,0.5)',
  
  // Glass effects
  glass: 'rgba(30,41,59,0.6)',
  glassSoft: 'rgba(30,41,59,0.4)',
  glassHover: 'rgba(30,41,59,0.8)',
  
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
  bgcolor: 'rgba(255,255,255,0.05)',
  color: ADMIN_THEME.textSecondary,
  borderRadius: '12px',
  border: `1px solid ${ADMIN_THEME.border}`,
  fontWeight: 600,
  textTransform: 'none',
  px: 2.5,
  py: 1,
  '&:hover': { 
    bgcolor: 'rgba(255,255,255,0.1)',
    borderColor: 'rgba(255,255,255,0.2)',
  },
};

const tableSx = {
  '& th, & td': { borderColor: 'rgba(255,255,255,0.12)', color: ADMIN_THEME.text },
  '& thead th': { backgroundColor: 'rgba(255,255,255,0.08)', color: ADMIN_THEME.text },
};

// ============== UTILITIES ==============
const sanitizeInput = (str: string) => str.trim().slice(0, 500);
const validatePrice = (price: number) => price >= 0 && price <= 999999;

// Convert date-only "2026-01-14" to datetime-local "2026-01-14T00:00" format
const toDateTimeLocal = (dateStr: string | undefined): string => {
  if (!dateStr) return '';
  // Already in datetime-local format
  if (dateStr.includes('T')) return dateStr;
  // Date-only format - add time
  return `${dateStr}T00:00`;
};

// ============== MAIN COMPONENT ==============
export default function AdminPage(): JSX.Element {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<number>(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast] = useState<Toast | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [logs, setLogs] = useState<any[][]>([]);
  const [config, setConfig] = useState<ShopConfig>(DEFAULT_CONFIG);
  const [lastSavedTime, setLastSavedTime] = useState<Date | null>(null);
  const [sheetSyncing, setSheetSyncing] = useState(false);
  const [orderProcessingRef, setOrderProcessingRef] = useState<string | null>(null);
  // Settings state (moved from SettingsView to prevent re-render issues)
  const [settingsLocalConfig, setSettingsLocalConfig] = useState<ShopConfig>(DEFAULT_CONFIG);
  const [settingsHasChanges, setSettingsHasChanges] = useState(false);
  const [orderEditor, setOrderEditor] = useState({
    open: false,
    ref: '',
    name: '',
    email: '',
    amount: 0,
    status: 'PENDING',
    date: '',
  });
  const isDesktop = useMediaQuery('(min-width:900px)');
  const hasInitialData = orders.length > 0 || (config.products || []).length > 0 || logs.length > 0 || !!lastSavedTime;
  const fetchInFlightRef = useRef(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const isAuthorized = isAdmin(session?.user?.email ?? null);
  const isSessionLoading = status === 'loading';
  const isDataLoading = loading && !hasInitialData;

  const showToast = useCallback((_type: 'success' | 'error' | 'info' | 'warning', _message: string) => {
    // Notifications disabled per request
    return;
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

  // 📥 Fetch Data (Filebase via internal API)
  const fetchData = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent;
    if (fetchInFlightRef.current) return;
    fetchInFlightRef.current = true;
    if (!silent) setLoading(true);
    try {
      const res = await getAdminData(session?.user?.email || '');
      if (res.status === 'success') {
        const data = (res.data as AdminDataResponse) || (res as any);
        const normalizedOrders = Array.isArray(data?.orders) ? data.orders.map(normalizeOrder).filter((o) => o.ref) : [];
        const nextConfig = data?.config || DEFAULT_CONFIG;
        let nextLogs = data?.logs || [];
        if ((!nextLogs || nextLogs.length === 0) && normalizedOrders.length > 0) {
          // Build lightweight log view from orders when backend logs are absent
          nextLogs = normalizedOrders.slice(0, 50).map((o) => [
            o.date || new Date().toISOString(),
            o.email || o.name || 'system',
            'ORDER',
            `${o.ref} : ${o.status}`
          ]);
        }
        setConfig(nextConfig);
        setOrders(normalizedOrders);
        setLogs(nextLogs);
        setLastSavedTime(new Date());
        saveAdminCache({ config: nextConfig, orders: normalizedOrders, logs: nextLogs });
        addLog('SYNC_FILEBASE', 'ดึงข้อมูลล่าสุด', { config: nextConfig, orders: normalizedOrders });
        return;
      }

      throw new Error(res.message || 'โหลดข้อมูลไม่สำเร็จ');
    } catch (error: any) {
      console.error('❌ Fetch error:', error);
      const cached = loadAdminCache();
      if (cached) {
        setConfig(cached.config);
        setOrders((cached.orders || []).map(normalizeOrder));
        setLogs(cached.logs || []);
        showToast('warning', 'แสดงข้อมูลจากแคช (เชื่อม Filebase ไม่สำเร็จ)');
      } else {
        setConfig(DEFAULT_CONFIG);
        setOrders([]);
        setLogs([]);
        showToast('error', error?.message || 'โหลดข้อมูลไม่สำเร็จ');
      }
    } finally {
      if (!silent) setLoading(false);
      fetchInFlightRef.current = false;
    }
  }, [session?.user?.email, showToast]);

  // �️ Upload images to Filebase before saving
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
          const data = await res.json();
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
      const configWithUrls = { ...newConfig, products: productsWithUrls };
      
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
  }, [orders, logs, showToast, session?.user?.email, addLog]);

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
    if (mode === 'sync' && !config.sheetId) return;
    setSheetSyncing(true);
    try {
      const res = await syncOrdersSheet(mode, mode === 'create' ? undefined : config.sheetId);
      if (res.status !== 'success') {
        throw new Error(res.message || 'sync failed');
      }

      const nextSheetId = (res.data as any)?.sheetId || config.sheetId || '';
      const nextSheetUrl = (res.data as any)?.sheetUrl || config.sheetUrl || (nextSheetId ? `https://docs.google.com/spreadsheets/d/${nextSheetId}` : '');

      if (nextSheetId !== config.sheetId || nextSheetUrl !== config.sheetUrl) {
        const nextConfig = { ...config, sheetId: nextSheetId, sheetUrl: nextSheetUrl };
        setConfig(nextConfig);
        saveAdminCache({ config: nextConfig, orders, logs });
        await saveFullConfig(nextConfig);
        addLog('SYNC_SHEET', mode === 'create' ? 'สร้าง Sheet ใหม่' : 'ซิงก์ Sheet', { config: nextConfig });
      } else {
        addLog('SYNC_SHEET', 'ซิงก์ Sheet', { config });
      }

      if (!opts?.silent) {
        showToast('success', res.message || (mode === 'create' ? 'สร้าง Sheet สำเร็จ' : 'ซิงก์ Sheet แล้ว'));
      }
    } catch (error: any) {
      if (!opts?.silent) {
        showToast('error', error?.message || 'ซิงก์ Sheet ไม่สำเร็จ');
      }
    } finally {
      setSheetSyncing(false);
    }
  }, [config, orders, logs, saveFullConfig, showToast]);

  const resetOrderEditor = () => setOrderEditor({ open: false, ref: '', name: '', email: '', amount: 0, status: 'PENDING', date: '' });

  const openOrderEditor = (order: AdminOrder) => {
    setOrderEditor({
      open: true,
      ref: order.ref,
      name: order.name,
      email: order.email,
      amount: order.amount,
      status: order.status,
      date: order.date ? new Date(order.date).toISOString().slice(0, 16) : '',
    });
  };

  const saveOrderEdits = async () => {
    if (!orderEditor.ref) return;
    setOrderProcessingRef(orderEditor.ref);
    try {
      const payload = {
        name: sanitizeInput(orderEditor.name),
        email: sanitizeInput(orderEditor.email),
        amount: Number(orderEditor.amount) || 0,
        status: normalizeStatusKey(orderEditor.status),
        date: orderEditor.date ? new Date(orderEditor.date).toISOString() : undefined,
      };

      const res = await updateOrderAdmin(orderEditor.ref, payload, session?.user?.email || '');
      if (res.status !== 'success') throw new Error(res.message || 'แก้ไขออเดอร์ไม่สำเร็จ');

      const nextOrders = orders.map((o) => o.ref === orderEditor.ref
        ? { ...o, ...payload, raw: { ...(o.raw || {}), ...payload } }
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

  // 🔐 Authentication Check
  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'authenticated') {
      if (!session?.user?.email || !isAdmin(session.user.email)) {
        Swal.fire({
          icon: 'error',
          title: 'ไม่มีสิทธิ์เข้าถึง',
          text: 'บัญชีของคุณไม่มีสิทธิ์เข้าถึงหน้านี้',
          confirmButtonText: 'กลับหน้าหลัก',
          didClose: () => router.push('/')
        });
        return;
      }
      fetchData();
    }
  }, [status, session, router, fetchData]);

  // 🔁 Lightweight polling for fresher data
  useEffect(() => {
    if (status !== 'authenticated') return;
    const intervalMs = 10000; // 10s polling
    const tick = async () => {
      await fetchData({ silent: true });
    };

    pollingRef.current = setInterval(tick, intervalMs);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [status, fetchData]);

  // Sync settings local config with main config (only when no unsaved changes)
  useEffect(() => {
    if (!settingsHasChanges) {
      setSettingsLocalConfig(config);
    }
  }, [config, settingsHasChanges]);

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
        icon: <AttachMoney sx={{ fontSize: 28, color: '#34d399' }} />,
      },
      { 
        label: 'รอชำระเงิน', 
        value: `${pendingOrders}`, 
        subtitle: 'รายการ',
        gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
        iconBg: 'rgba(245,158,11,0.2)',
        icon: <DateRange sx={{ fontSize: 28, color: '#fbbf24' }} />,
      },
      { 
        label: 'ชำระแล้ว', 
        value: `${paidOrders}`, 
        subtitle: 'พร้อมจัดส่ง',
        gradient: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
        iconBg: 'rgba(59,130,246,0.2)',
        icon: <CheckCircle sx={{ fontSize: 28, color: '#60a5fa' }} />,
      },
      { 
        label: 'จัดส่งแล้ว', 
        value: `${readyOrders + completedOrders}`, 
        subtitle: 'เสร็จสมบูรณ์',
        gradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
        iconBg: 'rgba(139,92,246,0.2)',
        icon: <LocalShipping sx={{ fontSize: 28, color: '#a78bfa' }} />,
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
          <Typography sx={{ fontSize: '1.5rem', fontWeight: 800, color: '#f1f5f9', mb: 0.5 }}>
            👋 ยินดีต้อนรับ, {session?.user?.name?.split(' ')[0] || 'Admin'}
          </Typography>
          <Typography sx={{ fontSize: '0.9rem', color: '#94a3b8' }}>
            จัดการร้านค้าและออเดอร์ของคุณได้ที่นี่ • อัพเดทล่าสุด: {lastSavedTime?.toLocaleTimeString('th-TH') || 'กำลังโหลด...'}
          </Typography>
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
              
              <Typography sx={{ fontSize: '1.75rem', fontWeight: 900, color: '#f1f5f9', lineHeight: 1, mb: 0.5 }}>
                {stat.value}
              </Typography>
              <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8' }}>
                {stat.label}
              </Typography>
              <Typography sx={{ fontSize: '0.7rem', color: '#64748b', mt: 0.5 }}>
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
            <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#f1f5f9', mb: 2.5, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Receipt sx={{ fontSize: 20, color: '#a5b4fc' }} />
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
                    <Box sx={{ flex: 1, height: 8, bgcolor: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
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
            <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#f1f5f9', mb: 2.5, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Bolt sx={{ fontSize: 20, color: '#fbbf24' }} />
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
                <ShoppingCart sx={{ fontSize: 20 }} />
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
                <Receipt sx={{ fontSize: 20 }} />
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
                <Bolt sx={{ fontSize: 20 }} />
                {sheetSyncing ? 'กำลังซิงก์...' : 'ซิงก์ Google Sheet'}
              </Button>
            </Box>
          </Box>
        </Box>

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
            <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: 1 }}>
              <LocalShipping sx={{ fontSize: 20, color: '#22d3ee' }} />
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
                  <TableCell sx={{ color: '#64748b', fontWeight: 600, fontSize: '0.75rem', borderColor: ADMIN_THEME.border }}>REF</TableCell>
                  <TableCell sx={{ color: '#64748b', fontWeight: 600, fontSize: '0.75rem', borderColor: ADMIN_THEME.border }}>ลูกค้า</TableCell>
                  <TableCell align="right" sx={{ color: '#64748b', fontWeight: 600, fontSize: '0.75rem', borderColor: ADMIN_THEME.border }}>ยอด</TableCell>
                  <TableCell sx={{ color: '#64748b', fontWeight: 600, fontSize: '0.75rem', borderColor: ADMIN_THEME.border }}>สถานะ</TableCell>
                  <TableCell sx={{ color: '#64748b', fontWeight: 600, fontSize: '0.75rem', borderColor: ADMIN_THEME.border }}>วันที่</TableCell>
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
                        <Typography sx={{ fontSize: '0.85rem', color: '#f1f5f9', fontWeight: 600 }}>
                          {order.name || '—'}
                        </Typography>
                        <Typography sx={{ fontSize: '0.7rem', color: '#64748b' }}>
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
                        <Typography sx={{ fontSize: '0.8rem', color: '#94a3b8' }}>
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

  const OrdersView = (): JSX.Element => {
    const [filterStatus, setFilterStatus] = useState<string>('ALL');
    const filteredOrders = useMemo(() => {
      let filtered = orders;
      if (filterStatus !== 'ALL') {
        filtered = orders.filter(o => normalizeStatusKey(o.status) === filterStatus);
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
    }, [filterStatus, searchTerm, orders]);

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* Header */}
        <Box sx={{ 
          display: 'flex', 
          flexDirection: { xs: 'column', md: 'row' },
          justifyContent: 'space-between', 
          alignItems: { xs: 'stretch', md: 'center' }, 
          gap: 2 
        }}>
          <Box>
            <Typography sx={{ fontSize: '1.5rem', fontWeight: 800, color: '#f1f5f9' }}>
              📦 จัดการออเดอร์
            </Typography>
            <Typography sx={{ fontSize: '0.85rem', color: '#64748b' }}>
              แสดง {filteredOrders.length} จาก {orders.length} รายการ
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {config.sheetUrl && (
              <Button
                component="a"
                href={config.sheetUrl}
                target="_blank"
                rel="noreferrer"
                sx={{
                  ...secondaryButtonSx,
                  gap: 1,
                }}
              >
                <Bolt sx={{ fontSize: 18 }} />
                Google Sheet
              </Button>
            )}
            <Button
              onClick={() => triggerSheetSync(config.sheetId ? 'sync' : 'create')}
              disabled={sheetSyncing}
              sx={gradientButtonSx}
            >
              <Bolt sx={{ fontSize: 18, mr: 1 }} />
              {sheetSyncing ? 'กำลังซิงก์...' : config.sheetId ? 'ซิงก์ Sheet' : 'สร้าง Sheet' }
            </Button>
            <Button 
              onClick={() => fetchData()}
              sx={secondaryButtonSx}
            >
              <Refresh sx={{ fontSize: 18 }} />
            </Button>
          </Box>
        </Box>

        {/* Status Filters - Pill Style */}
        <Box sx={{ 
          display: 'flex', 
          gap: 1, 
          overflowX: 'auto', 
          pb: 1,
          '&::-webkit-scrollbar': { display: 'none' },
        }}>
          {['ALL', ...ORDER_STATUSES].map((status) => {
            const isActive = filterStatus === status;
            const count = status === 'ALL' ? orders.length : orders.filter(o => o.status === status).length;
            const theme = STATUS_THEME[status] || { bg: 'rgba(255,255,255,0.05)', text: '#94a3b8', border: ADMIN_THEME.border };
            return (
              <Box
                key={status}
                onClick={() => setFilterStatus(status)}
                sx={{
                  px: 2,
                  py: 0.8,
                  borderRadius: '20px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s ease',
                  bgcolor: isActive ? theme.bg : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${isActive ? theme.border : ADMIN_THEME.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  '&:hover': { bgcolor: theme.bg },
                }}
              >
                <Typography sx={{ 
                  fontSize: '0.8rem', 
                  fontWeight: 600, 
                  color: isActive ? theme.text : '#64748b' 
                }}>
                  {status === 'ALL' ? 'ทั้งหมด' : status.replace('_', ' ')}
                </Typography>
                <Box sx={{
                  px: 0.8,
                  py: 0.2,
                  borderRadius: '8px',
                  bgcolor: isActive ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  color: isActive ? theme.text : '#64748b',
                }}>
                  {count}
                </Box>
              </Box>
            );
          })}
        </Box>

        {/* Search */}
        <TextField
          placeholder="🔍 ค้นหา Ref, ชื่อ, หรืออีเมล..."
          variant="outlined"
          fullWidth
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{
            ...inputSx,
            '& .MuiOutlinedInput-root': {
              ...inputSx['& .MuiOutlinedInput-root'],
              borderRadius: '14px',
            },
          }}
        />

        {/* Orders List - Modern Cards */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {filteredOrders.map(order => {
            const statusTheme = STATUS_THEME[normalizeStatusKey(order.status)] || STATUS_THEME.PENDING_PAYMENT;
            const isProcessing = orderProcessingRef === order.ref;
            return (
              <Box
                key={order.ref}
                sx={{
                  ...glassCardSx,
                  p: 0,
                  overflow: 'hidden',
                  transition: 'all 0.3s ease',
                  opacity: isProcessing ? 0.6 : 1,
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                  },
                }}
              >
                {/* Status Bar */}
                <Box sx={{
                  height: '4px',
                  background: `linear-gradient(90deg, ${statusTheme.text}, ${statusTheme.border})`,
                }} />
                
                <Box sx={{ p: 2.5 }}>
                  {/* Top Row: Ref, Status, Amount */}
                  <Box sx={{ 
                    display: 'flex', 
                    flexWrap: 'wrap',
                    justifyContent: 'space-between', 
                    alignItems: 'flex-start',
                    gap: 2,
                    mb: 2,
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Box sx={{
                        fontFamily: 'monospace',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        color: '#f1f5f9',
                        bgcolor: 'rgba(255,255,255,0.05)',
                        px: 1.5,
                        py: 0.5,
                        borderRadius: '8px',
                      }}>
                        #{order.ref}
                      </Box>
                      <Box sx={{
                        px: 1.5,
                        py: 0.4,
                        borderRadius: '12px',
                        bgcolor: statusTheme.bg,
                        border: `1px solid ${statusTheme.border}`,
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: statusTheme.text,
                      }}>
                        {order.status}
                      </Box>
                    </Box>
                    <Typography sx={{ 
                      fontSize: '1.3rem', 
                      fontWeight: 800, 
                      color: '#10b981',
                    }}>
                      ฿{Number(order.amount).toLocaleString()}
                    </Typography>
                  </Box>

                  {/* Customer Info */}
                  <Box sx={{ 
                    display: 'grid', 
                    gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                    gap: 1.5,
                    mb: 2,
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{
                        width: 32,
                        height: 32,
                        borderRadius: '8px',
                        bgcolor: 'rgba(139, 92, 246, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        <Typography sx={{ fontSize: '0.8rem' }}>👤</Typography>
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: '0.7rem', color: '#64748b' }}>ลูกค้า</Typography>
                        <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, color: '#f1f5f9' }}>
                          {order.name}
                        </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{
                        width: 32,
                        height: 32,
                        borderRadius: '8px',
                        bgcolor: 'rgba(59, 130, 246, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        <Typography sx={{ fontSize: '0.8rem' }}>📧</Typography>
                      </Box>
                      <Box sx={{ overflow: 'hidden' }}>
                        <Typography sx={{ fontSize: '0.7rem', color: '#64748b' }}>อีเมล</Typography>
                        <Typography sx={{ 
                          fontSize: '0.85rem', 
                          color: '#94a3b8',
                          textOverflow: 'ellipsis',
                          overflow: 'hidden',
                          whiteSpace: 'nowrap',
                        }}>
                          {order.email || '-'}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>

                  {/* Date and Actions */}
                  <Box sx={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 2,
                    pt: 2,
                    borderTop: `1px solid ${ADMIN_THEME.border}`,
                  }}>
                    <Typography sx={{ fontSize: '0.8rem', color: '#64748b' }}>
                      📅 {order.date ? new Date(order.date).toLocaleDateString('th-TH', { 
                        day: 'numeric', 
                        month: 'short', 
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      }) : '-'}
                    </Typography>
                    
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      {/* Quick Status Change */}
                      <Select
                        value={order.status}
                        onChange={(e) => updateOrderStatus(order.ref, e.target.value)}
                        size="small"
                        disabled={isProcessing}
                        sx={{ 
                          minWidth: 130,
                          fontSize: '0.8rem',
                          bgcolor: 'rgba(255,255,255,0.03)',
                          borderRadius: '10px',
                          '& .MuiOutlinedInput-notchedOutline': {
                            borderColor: ADMIN_THEME.border,
                          },
                          '&:hover .MuiOutlinedInput-notchedOutline': {
                            borderColor: 'rgba(255,255,255,0.2)',
                          },
                          '& .MuiSelect-select': {
                            py: 0.8,
                            color: '#e2e8f0',
                          },
                        }}
                      >
                        {ORDER_STATUSES.map(status => (
                          <MenuItem key={status} value={status}>{status}</MenuItem>
                        ))}
                      </Select>

                      {/* Action Buttons */}
                      <Box sx={{
                        display: 'flex',
                        bgcolor: 'rgba(255,255,255,0.03)',
                        borderRadius: '10px',
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
                            px: 1.2,
                            '&:hover': { bgcolor: 'rgba(96, 165, 250, 0.1)' },
                          }}
                        >
                          <EditIconMUI sx={{ fontSize: 18 }} />
                        </IconButton>
                        <Box sx={{ width: '1px', bgcolor: ADMIN_THEME.border }} />
                        <IconButton
                          size="small"
                          onClick={() => deleteOrder(order, false)}
                          disabled={isProcessing}
                          sx={{ 
                            color: '#f59e0b',
                            borderRadius: 0,
                            px: 1.2,
                            '&:hover': { bgcolor: 'rgba(245, 158, 11, 0.1)' },
                          }}
                          title="ยกเลิกออเดอร์"
                        >
                          <Close sx={{ fontSize: 18 }} />
                        </IconButton>
                        <Box sx={{ width: '1px', bgcolor: ADMIN_THEME.border }} />
                        <IconButton
                          size="small"
                          onClick={() => deleteOrder(order, true)}
                          disabled={isProcessing}
                          sx={{ 
                            color: '#ef4444',
                            borderRadius: 0,
                            px: 1.2,
                            '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.1)' },
                          }}
                          title="ลบถาวร"
                        >
                          <Delete sx={{ fontSize: 18 }} />
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
              <Receipt sx={{ fontSize: 56, color: '#475569', mb: 2 }} />
              <Typography sx={{ fontSize: '1.1rem', fontWeight: 600, color: '#64748b', mb: 0.5 }}>
                ไม่พบออเดอร์
              </Typography>
              <Typography sx={{ fontSize: '0.85rem', color: '#475569' }}>
                ลองเปลี่ยนตัวกรองหรือคำค้นหา
              </Typography>
            </Box>
          )}
        </Box>

        {/* Order Editor Dialog - Modern Design */}
        <Dialog 
          open={orderEditor.open} 
          onClose={resetOrderEditor} 
          fullWidth 
          maxWidth="sm"
          PaperProps={{
            sx: {
              bgcolor: '#0f172a',
              backgroundImage: 'linear-gradient(135deg, rgba(139, 92, 246, 0.03) 0%, rgba(16, 185, 129, 0.03) 100%)',
              border: '1px solid rgba(255,255,255,0.08)',
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
            borderBottom: '1px solid rgba(255,255,255,0.06)',
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
                <EditIconMUI sx={{ color: '#fff', fontSize: 24 }} />
              </Box>
              <Box>
                <Typography sx={{ fontSize: '1.2rem', fontWeight: 700, color: '#f1f5f9' }}>
                  แก้ไขออเดอร์
                </Typography>
                {orderEditor.ref && (
                  <Typography sx={{ 
                    fontSize: '0.85rem', 
                    color: '#64748b',
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
                color: '#64748b', 
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
                color: '#64748b', 
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                mb: 1.5,
              }}>
                รายละเอียดออเดอร์
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                <TextField
                  label="ยอดชำระ (บาท)"
                  type="number"
                  value={orderEditor.amount}
                  onChange={(e) => setOrderEditor(prev => ({ ...prev, amount: Number(e.target.value) }))}
                  fullWidth
                  InputProps={{
                    startAdornment: <Typography sx={{ color: '#10b981', mr: 1, fontWeight: 600 }}>฿</Typography>,
                  }}
                  sx={{
                    ...inputSx,
                    '& .MuiOutlinedInput-root': {
                      ...inputSx['& .MuiOutlinedInput-root'],
                      borderRadius: '12px',
                    },
                  }}
                />
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

            {/* Status Section */}
            <Box>
              <Typography sx={{ 
                fontSize: '0.75rem', 
                fontWeight: 600, 
                color: '#64748b', 
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
              <Save sx={{ fontSize: 18 }} />
              {orderProcessingRef === orderEditor.ref ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    );
  };

  const SettingsView = (): JSX.Element => {
    // Use parent-level state to prevent re-mount losing focus
    const localConfig = settingsLocalConfig;
    const hasChanges = settingsHasChanges;

    const handleChange = (newVal: ShopConfig) => {
      setSettingsLocalConfig(newVal);
      setSettingsHasChanges(true);
    };

    const handleSave = () => {
      saveFullConfig(localConfig);
      setSettingsHasChanges(false);
    };

    const handleReset = () => {
      setSettingsLocalConfig(config);
      setSettingsHasChanges(false);
    };

    // Section wrapper component
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
          <Typography sx={{ fontSize: '1.1rem', fontWeight: 700, color: '#f1f5f9' }}>
            {title}
          </Typography>
        </Box>
        <Box sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {children}
        </Box>
      </Box>
    );

    // Toggle row component
    const ToggleRow = ({ label, description, checked, onChange }: { label: string; description?: string; checked: boolean; onChange: (checked: boolean) => void }) => (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        py: 0.5,
      }}>
        <Box>
          <Typography sx={{ fontSize: '0.95rem', fontWeight: 500, color: '#e2e8f0' }}>{label}</Typography>
          {description && (
            <Typography sx={{ fontSize: '0.8rem', color: '#64748b' }}>{description}</Typography>
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

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 700 }}>
        {/* Header with Save Button */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
          <Box>
            <Typography sx={{ fontSize: '1.5rem', fontWeight: 800, color: '#f1f5f9' }}>
              ⚙️ ตั้งค่าร้านค้า
            </Typography>
            <Typography sx={{ fontSize: '0.85rem', color: '#64748b' }}>
              จัดการการตั้งค่าทั้งหมดของร้าน
            </Typography>
          </Box>
          
          {hasChanges && (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                onClick={handleReset}
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
                onClick={handleSave}
                startIcon={<Save />}
                sx={{
                  background: ADMIN_THEME.gradient,
                  borderRadius: '10px',
                  textTransform: 'none',
                  fontWeight: 700,
                  boxShadow: '0 4px 15px rgba(139, 92, 246, 0.3)',
                  animation: 'pulse 2s infinite',
                  '@keyframes pulse': {
                    '0%, 100%': { boxShadow: '0 4px 15px rgba(139, 92, 246, 0.3)' },
                    '50%': { boxShadow: '0 4px 25px rgba(139, 92, 246, 0.5)' },
                  },
                }}
              >
                💾 บันทึกการตั้งค่า
              </Button>
            </Box>
          )}
        </Box>

        {/* Unsaved Changes Warning */}
        {hasChanges && (
          <Box sx={{
            p: 2,
            borderRadius: '12px',
            bgcolor: 'rgba(251, 191, 36, 0.1)',
            border: '1px solid rgba(251, 191, 36, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: 2,
          }}>
            <Box sx={{ fontSize: '1.5rem' }}>⚠️</Box>
            <Typography sx={{ fontSize: '0.9rem', color: '#fbbf24' }}>
              มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก กดปุ่ม "บันทึกการตั้งค่า" เพื่อยืนยัน
            </Typography>
          </Box>
        )}

        {/* Shop Status */}
        <SettingSection icon={<Store sx={{ fontSize: 20 }} />} title="สถานะร้านค้า">
          <ToggleRow
            label="เปิดรับออเดอร์"
            description={localConfig.isOpen ? 'ร้านเปิดให้บริการอยู่' : 'ปิดรับออเดอร์ชั่วคราว'}
            checked={localConfig.isOpen}
            onChange={(checked) => handleChange({...localConfig, isOpen: checked})}
          />
          {!localConfig.isOpen && (
            <Box sx={{ 
              mt: 1, 
              p: 2, 
              borderRadius: '12px', 
              bgcolor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
            }}>
              <Typography sx={{ fontSize: '0.85rem', color: '#f87171', mb: 1.5 }}>
                📅 กำหนดวันเปิดร้าน
              </Typography>
              <TextField
                type="date"
                value={localConfig.closeDate}
                onChange={(e) => handleChange({...localConfig, closeDate: e.target.value})}
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
          )}
        </SettingSection>

        {/* Announcement */}
        <SettingSection icon={<Notifications sx={{ fontSize: 20 }} />} title="ประกาศ">
          <ToggleRow
            label="แสดงประกาศ"
            description="แสดงแถบประกาศบนหน้าร้าน"
            checked={localConfig.announcement?.enabled ?? false}
            onChange={(checked) => handleChange({
              ...localConfig,
              announcement: {...(localConfig.announcement ?? { enabled: false, message: '', color: 'blue' }), enabled: checked}
            })}
          />

          {(localConfig.announcement?.enabled) && (
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: 2,
              mt: 1,
              p: 2,
              borderRadius: '12px',
              bgcolor: 'rgba(139, 92, 246, 0.05)',
              border: `1px solid ${ADMIN_THEME.border}`,
            }}>
              {/* Formatting Toolbar */}
              <Box sx={{ 
                display: 'flex', 
                gap: 0.5, 
                p: 1, 
                borderRadius: '8px', 
                bgcolor: 'rgba(0,0,0,0.2)',
                border: `1px solid ${ADMIN_THEME.border}`,
              }}>
                <Tooltip title="ขึ้นบรรทัดใหม่">
                  <IconButton 
                    size="small" 
                    onClick={() => {
                      const msg = localConfig.announcement?.message ?? '';
                      handleChange({
                        ...localConfig,
                        announcement: {...(localConfig.announcement ?? { enabled: false, message: '', color: 'blue' }), message: msg + '\n'}
                      });
                    }}
                    sx={{ color: ADMIN_THEME.text }}
                  >
                    <FormatLineSpacing sx={{ fontSize: 18 }} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="เพิ่มอิโมจิ 🎉">
                  <IconButton 
                    size="small" 
                    onClick={() => {
                      const msg = localConfig.announcement?.message ?? '';
                      handleChange({
                        ...localConfig,
                        announcement: {...(localConfig.announcement ?? { enabled: false, message: '', color: 'blue' }), message: msg + '🎉'}
                      });
                    }}
                    sx={{ color: ADMIN_THEME.text }}
                  >
                    <span style={{ fontSize: 16 }}>🎉</span>
                  </IconButton>
                </Tooltip>
                <Tooltip title="เพิ่มอิโมจิ ⚡">
                  <IconButton 
                    size="small" 
                    onClick={() => {
                      const msg = localConfig.announcement?.message ?? '';
                      handleChange({
                        ...localConfig,
                        announcement: {...(localConfig.announcement ?? { enabled: false, message: '', color: 'blue' }), message: msg + '⚡'}
                      });
                    }}
                    sx={{ color: ADMIN_THEME.text }}
                  >
                    <span style={{ fontSize: 16 }}>⚡</span>
                  </IconButton>
                </Tooltip>
                <Tooltip title="เพิ่มอิโมจิ 🔥">
                  <IconButton 
                    size="small" 
                    onClick={() => {
                      const msg = localConfig.announcement?.message ?? '';
                      handleChange({
                        ...localConfig,
                        announcement: {...(localConfig.announcement ?? { enabled: false, message: '', color: 'blue' }), message: msg + '🔥'}
                      });
                    }}
                    sx={{ color: ADMIN_THEME.text }}
                  >
                    <span style={{ fontSize: 16 }}>🔥</span>
                  </IconButton>
                </Tooltip>
                <Tooltip title="เพิ่มอิโมจิ 📢">
                  <IconButton 
                    size="small" 
                    onClick={() => {
                      const msg = localConfig.announcement?.message ?? '';
                      handleChange({
                        ...localConfig,
                        announcement: {...(localConfig.announcement ?? { enabled: false, message: '', color: 'blue' }), message: msg + '📢'}
                      });
                    }}
                    sx={{ color: ADMIN_THEME.text }}
                  >
                    <span style={{ fontSize: 16 }}>📢</span>
                  </IconButton>
                </Tooltip>
                <Box sx={{ flex: 1 }} />
                <Tooltip title="ล้างข้อความ">
                  <IconButton 
                    size="small" 
                    onClick={() => {
                      handleChange({
                        ...localConfig,
                        announcement: {...(localConfig.announcement ?? { enabled: false, message: '', color: 'blue' }), message: ''}
                      });
                    }}
                    sx={{ color: '#ef4444' }}
                  >
                    <Clear sx={{ fontSize: 18 }} />
                  </IconButton>
                </Tooltip>
              </Box>

              <TextField
                label="ข้อความประกาศ"
                multiline
                rows={4}
                value={localConfig.announcement?.message ?? ''}
                onChange={(e) => handleChange({
                  ...localConfig,
                  announcement: {...(localConfig.announcement ?? { enabled: false, message: '', color: 'blue' }), message: e.target.value}
                })}
                fullWidth
                placeholder="พิมพ์ข้อความประกาศ... กด Enter เพื่อขึ้นบรรทัดใหม่"
                inputProps={{ maxLength: 500 }}
                helperText={`${(localConfig.announcement?.message ?? '').length}/500 ตัวอักษร • รองรับหลายบรรทัด`}
                sx={{
                  ...inputSx,
                  '& .MuiOutlinedInput-root': {
                    ...inputSx['& .MuiOutlinedInput-root'],
                    borderRadius: '10px',
                    fontFamily: 'inherit',
                  },
                  '& textarea': {
                    whiteSpace: 'pre-wrap',
                  },
                }}
              />

              {/* Preview */}
              {(localConfig.announcement?.message ?? '').trim() && (
                <Box sx={{ mt: 1 }}>
                  <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mb: 1 }}>ตัวอย่างการแสดงผล:</Typography>
                  <Box sx={{
                    p: 1.5,
                    borderRadius: '8px',
                    bgcolor: {
                      blue: '#3b82f6',
                      red: '#ef4444',
                      emerald: '#10b981',
                      orange: '#f59e0b',
                    }[localConfig.announcement?.color ?? 'blue'] || '#3b82f6',
                    textAlign: 'center',
                  }}>
                    <Typography sx={{ 
                      fontSize: '0.9rem', 
                      color: '#fff', 
                      whiteSpace: 'pre-wrap',
                      lineHeight: 1.6,
                    }}>
                      {localConfig.announcement?.message}
                    </Typography>
                  </Box>
                </Box>
              )}

              <Box>
                <Typography sx={{ fontSize: '0.8rem', color: '#64748b', mb: 1 }}>สีพื้นหลัง</Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {[
                    { value: 'blue', color: '#3b82f6', label: 'น้ำเงิน' },
                    { value: 'red', color: '#ef4444', label: 'แดง' },
                    { value: 'emerald', color: '#10b981', label: 'เขียว' },
                    { value: 'orange', color: '#f59e0b', label: 'ส้ม' },
                  ].map(option => (
                    <Box
                      key={option.value}
                      onClick={() => handleChange({
                        ...localConfig,
                        announcement: {...(localConfig.announcement ?? { enabled: false, message: '', color: 'blue' }), color: option.value as any}
                      })}
                      sx={{
                        flex: 1,
                        py: 1,
                        borderRadius: '10px',
                        cursor: 'pointer',
                        textAlign: 'center',
                        bgcolor: localConfig.announcement?.color === option.value ? option.color : 'rgba(255,255,255,0.05)',
                        border: `2px solid ${localConfig.announcement?.color === option.value ? option.color : 'transparent'}`,
                        transition: 'all 0.2s ease',
                        '&:hover': { transform: 'translateY(-1px)' },
                      }}
                    >
                      <Typography sx={{ 
                        fontSize: '0.75rem', 
                        fontWeight: 600,
                        color: localConfig.announcement?.color === option.value ? '#fff' : '#94a3b8',
                      }}>
                        {option.label}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            </Box>
          )}
        </SettingSection>

        {/* Google Sheet */}
        <SettingSection icon={<Bolt sx={{ fontSize: 20 }} />} title="Google Sheet">
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Sheet ID"
              placeholder="1abc123..."
              value={localConfig.sheetId || ''}
              onChange={(e) => handleChange({ ...localConfig, sheetId: e.target.value, sheetUrl: e.target.value ? `https://docs.google.com/spreadsheets/d/${e.target.value}` : '' })}
              fullWidth
              sx={{
                ...inputSx,
                '& .MuiOutlinedInput-root': {
                  ...inputSx['& .MuiOutlinedInput-root'],
                  borderRadius: '10px',
                },
              }}
              helperText="ใส่ ID จาก URL ของ Google Sheet"
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
                  <Check sx={{ color: '#fff', fontSize: 20 }} />
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
                      color: '#64748b',
                      textDecoration: 'underline',
                      '&:hover': { color: '#94a3b8' },
                    }}
                  >
                    เปิด Google Sheet
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
                <Bolt sx={{ fontSize: 18 }} />
                {sheetSyncing ? 'กำลังซิงก์...' : localConfig.sheetId ? 'ซิงก์ทันที' : 'สร้าง Sheet ใหม่'}
              </Button>
            </Box>
          </Box>
        </SettingSection>

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
            <Typography sx={{ fontSize: '0.85rem', color: '#94a3b8' }}>
              {hasChanges ? 'มีการเปลี่ยนแปลงที่ยังไม่บันทึก' : 'บันทึกล่าสุด: ' + (lastSavedTime ? lastSavedTime.toLocaleString('th-TH') : '-')}
            </Typography>
          </Box>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || loading}
            sx={{
              ...gradientButtonSx,
              minWidth: 120,
              opacity: hasChanges ? 1 : 0.5,
            }}
          >
            <Save sx={{ fontSize: 18, mr: 1 }} />
            บันทึก
          </Button>
        </Box>
      </Box>
    );
  };

  const LogsView = (): JSX.Element => {
    const [logFilter, setLogFilter] = useState<string>('ALL');

    const filteredLogs = logFilter === 'ALL'
      ? logs
      : logs.filter(log => log[2] === logFilter);

    const getActionTheme = (action: string) => {
      switch (action) {
        case 'UPDATE_CONFIG': return { icon: '⚙️', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.15)' };
        case 'UPDATE_STATUS': return { icon: '🔄', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' };
        case 'SEND_EMAIL': return { icon: '📧', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' };
        case 'SUBMIT_ORDER': return { icon: '🛒', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' };
        default: return { icon: '📋', color: '#64748b', bg: 'rgba(100, 116, 139, 0.15)' };
      }
    };

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* Header */}
        <Box>
          <Typography sx={{ fontSize: '1.5rem', fontWeight: 800, color: '#f1f5f9' }}>
            📜 ประวัติระบบ
          </Typography>
          <Typography sx={{ fontSize: '0.85rem', color: '#64748b' }}>
            แสดง {filteredLogs.length} จาก {logs.length} รายการ
          </Typography>
        </Box>

        {/* Filter Tabs */}
        <Box sx={{ 
          display: 'flex', 
          gap: 1, 
          overflowX: 'auto',
          pb: 1,
          '&::-webkit-scrollbar': { display: 'none' },
        }}>
          {[
            { value: 'ALL', label: 'ทั้งหมด', icon: '📋' },
            { value: 'UPDATE_CONFIG', label: 'ตั้งค่า', icon: '⚙️' },
            { value: 'UPDATE_STATUS', label: 'สถานะ', icon: '🔄' },
            { value: 'SEND_EMAIL', label: 'อีเมล', icon: '📧' },
            { value: 'SUBMIT_ORDER', label: 'ออเดอร์ใหม่', icon: '🛒' },
          ].map(filter => {
            const isActive = logFilter === filter.value;
            const count = filter.value === 'ALL' ? logs.length : logs.filter(l => l[2] === filter.value).length;
            return (
              <Box
                key={filter.value}
                onClick={() => setLogFilter(filter.value)}
                sx={{
                  px: 2,
                  py: 0.8,
                  borderRadius: '20px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s ease',
                  bgcolor: isActive ? 'rgba(139, 92, 246, 0.2)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${isActive ? 'rgba(139, 92, 246, 0.4)' : ADMIN_THEME.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  '&:hover': { bgcolor: 'rgba(139, 92, 246, 0.1)' },
                }}
              >
                <Typography sx={{ fontSize: '0.9rem' }}>{filter.icon}</Typography>
                <Typography sx={{ 
                  fontSize: '0.8rem', 
                  fontWeight: 600, 
                  color: isActive ? '#a78bfa' : '#64748b' 
                }}>
                  {filter.label}
                </Typography>
                <Box sx={{
                  px: 0.8,
                  py: 0.2,
                  borderRadius: '8px',
                  bgcolor: isActive ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  color: isActive ? '#a78bfa' : '#64748b',
                }}>
                  {count}
                </Box>
              </Box>
            );
          })}
        </Box>

        {/* Log Entries */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {filteredLogs.map((log, idx) => {
            const actionTheme = getActionTheme(log[2] || '');
            return (
              <Box
                key={idx}
                sx={{
                  ...glassCardSx,
                  p: 2,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 2,
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    bgcolor: 'rgba(255,255,255,0.03)',
                  },
                }}
              >
                {/* Action Icon */}
                <Box sx={{
                  width: 40,
                  height: 40,
                  borderRadius: '12px',
                  bgcolor: actionTheme.bg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Typography sx={{ fontSize: '1.1rem' }}>{actionTheme.icon}</Typography>
                </Box>

                {/* Content */}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center', mb: 0.5 }}>
                    <Box sx={{
                      px: 1.5,
                      py: 0.3,
                      borderRadius: '8px',
                      bgcolor: actionTheme.bg,
                      border: `1px solid ${actionTheme.color}30`,
                    }}>
                      <Typography sx={{ 
                        fontSize: '0.75rem', 
                        fontWeight: 600, 
                        color: actionTheme.color,
                      }}>
                        {log[2] || 'UNKNOWN'}
                      </Typography>
                    </Box>
                    <Typography sx={{ fontSize: '0.8rem', color: '#64748b' }}>
                      โดย <strong style={{ color: '#94a3b8' }}>{log[1] || 'ระบบ'}</strong>
                    </Typography>
                  </Box>
                  <Typography sx={{ 
                    fontSize: '0.9rem', 
                    color: '#e2e8f0',
                    wordBreak: 'break-word',
                  }}>
                    {log[3] || '-'}
                  </Typography>
                </Box>

                {/* Timestamp */}
                <Typography sx={{ 
                  fontSize: '0.75rem', 
                  color: '#475569',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}>
                  {log[0] ? new Date(log[0]).toLocaleString('th-TH', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  }) : '-'}
                </Typography>
              </Box>
            );
          })}

          {filteredLogs.length === 0 && (
            <Box sx={{ 
              ...glassCardSx,
              textAlign: 'center', 
              py: 6,
            }}>
              <History sx={{ fontSize: 56, color: '#475569', mb: 2 }} />
              <Typography sx={{ fontSize: '1.1rem', fontWeight: 600, color: '#64748b', mb: 0.5 }}>
                ไม่พบประวัติ
              </Typography>
              <Typography sx={{ fontSize: '0.85rem', color: '#475569' }}>
                ยังไม่มีกิจกรรมในระบบ
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
                       linear-gradient(180deg, #0a0f1a 0%, #0f172a 50%, #0a0f1a 100%)`,
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
                <Store sx={{ fontSize: 40, color: '#fff' }} />
              </Box>
              <Typography
                sx={{
                  fontSize: '1.6rem',
                  fontWeight: 800,
                  color: '#f1f5f9',
                  mb: 0.5,
                }}
              >
                PSUSCC Admin
              </Typography>
              <Typography
                sx={{
                  fontSize: '0.9rem',
                  color: '#94a3b8',
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
                  color: '#64748b',
                  textAlign: 'center',
                  mb: 3,
                }}
              >
                เข้าสู่ระบบด้วยบัญชี Google ที่ได้รับอนุญาต
              </Typography>

              {/* Google Sign In Button */}
              <Button
                onClick={() => signIn('google')}
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

              {/* Divider */}
              <Box sx={{ display: 'flex', alignItems: 'center', my: 3 }}>
                <Box sx={{ flex: 1, height: 1, bgcolor: 'rgba(255,255,255,0.08)' }} />
                <Typography sx={{ px: 2, fontSize: '0.75rem', color: '#475569' }}>หรือ</Typography>
                <Box sx={{ flex: 1, height: 1, bgcolor: 'rgba(255,255,255,0.08)' }} />
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
                background: 'rgba(0,0,0,0.2)',
              }}
            >
              <Typography
                sx={{
                  fontSize: '0.75rem',
                  color: '#475569',
                  textAlign: 'center',
                }}
              >
                🔒 เฉพาะผู้ดูแลระบบที่ได้รับอนุญาตเท่านั้น
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

  // Access Denied - logged in but not admin
  if (!isAuthorized) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: `radial-gradient(ellipse at top, rgba(239,68,68,0.1) 0%, transparent 50%),
                       linear-gradient(180deg, #0a0f1a 0%, #0f172a 50%, #0a0f1a 100%)`,
          p: 2,
        }}
      >
        <Box
          sx={{
            ...glassCardSx,
            maxWidth: 440,
            textAlign: 'center',
            p: 0,
            overflow: 'hidden',
          }}
        >
          {/* Error Header */}
          <Box
            sx={{
              background: 'linear-gradient(135deg, rgba(239,68,68,0.2) 0%, rgba(248,113,113,0.1) 100%)',
              p: 4,
            }}
          >
            <Box
              sx={{
                width: 80,
                height: 80,
                borderRadius: '24px',
                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 2,
                boxShadow: '0 20px 40px rgba(239,68,68,0.3)',
              }}
            >
              <Lock sx={{ fontSize: 40, color: '#fff' }} />
            </Box>
            <Typography sx={{ fontSize: '1.4rem', fontWeight: 800, color: '#f1f5f9' }}>
              ไม่มีสิทธิ์เข้าถึง
            </Typography>
          </Box>

          {/* Content */}
          <Box sx={{ p: 4 }}>
            <Typography sx={{ fontSize: '0.9rem', color: '#94a3b8', mb: 1 }}>
              บัญชี {session?.user?.email || 'ของคุณ'}
            </Typography>
            <Typography sx={{ fontSize: '0.85rem', color: '#64748b', mb: 3 }}>
              ไม่ได้รับอนุญาตให้เข้าถึงหน้านี้
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Button
                onClick={() => signOut()}
                sx={{
                  ...secondaryButtonSx,
                  py: 1.5,
                }}
              >
                ออกจากระบบ
              </Button>
              <Button
                onClick={() => router.push('/')}
                fullWidth
                sx={{
                  ...gradientButtonSx,
                  py: 1.5,
                }}
              >
                กลับหน้าหลัก
              </Button>
            </Box>
          </Box>
        </Box>
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
                       linear-gradient(180deg, #0a0f1a 0%, #0f172a 50%, #0a0f1a 100%)`,
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
          <Store sx={{ fontSize: 40, color: '#fff' }} />
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
        
        <Typography sx={{ color: '#64748b', fontSize: '0.9rem' }}>
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
                     linear-gradient(180deg, #0a0f1a 0%, #0f172a 50%, #0a0f1a 100%)`,
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
            background: 'rgba(0,0,0,0.2)',
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
                bgcolor: 'rgba(255,255,255,0.05)',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
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
                <Bolt sx={{ color: '#fff', fontSize: 22 }} />
              </Box>
              <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                <Typography sx={{ fontSize: '1.1rem', fontWeight: 800, color: '#f1f5f9', lineHeight: 1.2 }}>
                  Admin Panel
                </Typography>
                <Typography sx={{ fontSize: '0.7rem', color: '#64748b' }}>
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
                <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: '#f1f5f9', lineHeight: 1.2 }}>
                  {session?.user?.name?.split(' ')[0] || 'Admin'}
                </Typography>
                <Typography sx={{ fontSize: '0.65rem', color: '#64748b' }}>
                  Administrator
                </Typography>
              </Box>
              <IconButton 
                onClick={() => signOut()}
                sx={{ 
                  color: '#94a3b8',
                  '&:hover': { color: '#f87171', bgcolor: 'rgba(239,68,68,0.1)' },
                }}
              >
                <Logout sx={{ fontSize: 20 }} />
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
            width: 260,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: 260,
              background: ADMIN_THEME.bgSidebar,
              color: ADMIN_THEME.text,
              borderRight: `1px solid ${ADMIN_THEME.border}`,
              boxSizing: 'border-box',
              position: { xs: 'fixed', md: 'relative' },
              height: { xs: 'auto', md: '100%' },
              backdropFilter: 'blur(20px)',
              pt: { xs: 2, md: 0 },
            }
          }}
          variant={isDesktop ? 'permanent' : 'temporary'}
          ModalProps={{ keepMounted: true }}
          anchor="left"
        >
          {/* Sidebar Content */}
          <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
            {/* Navigation Items */}
            {[
              { icon: <Dashboard sx={{ fontSize: 20 }} />, label: 'แดชบอร์ด', idx: 0, color: '#a5b4fc' },
              { icon: <ShoppingCart sx={{ fontSize: 20 }} />, label: 'จัดการสินค้า', idx: 1, color: '#fbbf24' },
              { icon: <Receipt sx={{ fontSize: 20 }} />, label: 'ออเดอร์', idx: 2, color: '#34d399', badge: pendingCount },
              { icon: <Settings sx={{ fontSize: 20 }} />, label: 'ตั้งค่าร้าน', idx: 3, color: '#60a5fa' },
              { icon: <History sx={{ fontSize: 20 }} />, label: 'ประวัติการใช้งาน', idx: 4, color: '#f472b6' },
            ].map((item) => {
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
                    color: isActive ? '#f1f5f9' : '#94a3b8',
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

          {/* Sidebar Footer */}
          <Box sx={{ mt: 'auto', p: 2, borderTop: `1px solid ${ADMIN_THEME.border}` }}>
            <Box sx={{
              p: 2,
              borderRadius: '14px',
              bgcolor: 'rgba(16,185,129,0.1)',
              border: '1px solid rgba(16,185,129,0.2)',
            }}>
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#34d399', mb: 0.5 }}>
                ร้านค้า: {config.isOpen ? '🟢 เปิดขาย' : '🔴 ปิดชั่วคราว'}
              </Typography>
              <Typography sx={{ fontSize: '0.65rem', color: '#64748b' }}>
                สินค้า {config.products?.length || 0} รายการ
              </Typography>
            </Box>
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
            <ProductsView
              config={config}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              saveFullConfig={saveFullConfig}
              showToast={showToast}
              addLog={addLog}
              saving={saving}
            />
          )}
          {activeTab === 2 && <OrdersView />}
          {activeTab === 3 && <SettingsView />}
          {activeTab === 4 && <LogsView />}
        </Box>
      </Box>
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

const ProductCardItem = ({ product, onEdit, onDelete }: any): JSX.Element => {
  const { isOpen, status } = isProductOpen(product);
  
  const statusConfig = {
    upcoming: { label: '⏰ รอเปิด', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
    active: { label: '🟢 กำลังขาย', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' },
    ended: { label: '🔴 หมดเวลา', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' },
    always: { label: product.isActive ? '✓ เปิดขาย' : '✗ ปิดขาย', color: product.isActive ? '#10b981' : '#64748b', bg: product.isActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(100, 116, 139, 0.15)' },
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
          <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: currentStatus.color }}>
            {currentStatus.label}
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
            <Typography sx={{ fontSize: '0.65rem', color: '#e2e8f0' }}>
              📅 {product.startDate ? formatDateTime(product.startDate).split(' ')[0] : '...'} - {product.endDate ? formatDateTime(product.endDate).split(' ')[0] : '...'}
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
        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            variant="outlined"
            color="primary"
            onClick={onEdit}
            fullWidth
            startIcon={<EditIconMUI />}
            sx={{ borderColor: ADMIN_THEME.border, color: ADMIN_THEME.text, '&:hover': { borderColor: '#6366f1', background: 'rgba(99,102,241,0.08)' } }}
          >
            Edit
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
            Delete
          </Button>
        </Stack>
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
      options: { hasCustomName: false, hasCustomNumber: false, hasLongSleeve: false }
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

  const handleSaveEdit = async (mode?: 'publish' | 'draft') => {
    if (!editingProduct) return;

    const nextProduct = { ...editingProduct };
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
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
          Products ({filteredProducts.length}/{config.products.length})
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<Add />}
          onClick={createNewProduct}
          sx={gradientButtonSx}
        >
          Add Product
        </Button>
      </Box>

      <TextField
        placeholder="Search by name or ID..."
        variant="outlined"
        fullWidth
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        sx={inputSx}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Search />
            </InputAdornment>
          ),
        }}
      />

      {filteredProducts.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <History sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
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
    </Box>
  );
}

const ProductEditDialog = ({ product, onClose, onChange, onSave, isSaving }: any): JSX.Element => {
  const [newSizeKey, setNewSizeKey] = useState('');
  const [newSizePrice, setNewSizePrice] = useState<number | ''>('');
  const [coverUploadLoading, setCoverUploadLoading] = useState(false);
  const MAX_IMAGE_SIZE = 3 * 1024 * 1024; // ~3MB

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

  const handleRemoveImage = (index: number) => {
    const nextImages = [...(product.images || [])];
    const removed = nextImages.splice(index, 1)[0];
    const nextCover = removed === product.coverImage ? (nextImages[0] || '') : (product.coverImage || '');
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

  return (
    <Dialog
      open={!!product}
      onClose={handleDialogClose}
      maxWidth="md"
      fullWidth
      disableEscapeKeyDown
      PaperProps={{ sx: { ...glassCardSx, background: 'rgba(15,23,42,0.94)', borderColor: ADMIN_THEME.border } }}
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
          onChange={(e) => onChange({...product, name: sanitizeInput(e.target.value)})}
          fullWidth
          sx={inputSx}
        />

        <Select
          value={product.type}
          onChange={(e) => onChange({...product, type: e.target.value})}
          fullWidth
          sx={inputSx}
        >
          {PRODUCT_TYPES.map(t => (
            <MenuItem key={t} value={t}>{t}</MenuItem>
          ))}
        </Select>

        <TextField
          label="Description"
          multiline
          rows={3}
          value={product.description}
          onChange={(e) => onChange({...product, description: sanitizeInput(e.target.value)})}
          fullWidth
          sx={inputSx}
        />

        <TextField
          label="Base Price (฿)"
          type="number"
          value={product.basePrice}
          onChange={(e) => onChange({...product, basePrice: Number(e.target.value)})}
          fullWidth
          inputProps={{ min: 0, max: 999999 }}
          sx={inputSx}
        />

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
            <Button onClick={handleAddSize} variant="contained" sx={gradientButtonSx} startIcon={<Add />}>เพิ่มไซส์</Button>
          </Box>
        </Box>

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
              <DateRange sx={{ fontSize: 20, color: '#fff' }} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: ADMIN_THEME.text }}>กำหนดเวลาขาย</Typography>
              <Typography sx={{ fontSize: '0.75rem', color: ADMIN_THEME.muted }}>ตั้งเวลาเปิด-ปิดขายอัตโนมัติ</Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <Box>
              <Typography sx={{ fontSize: '0.8rem', color: '#64748b', mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                🟢 เปิดขายเมื่อ
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
                  sx={{ mt: 0.5, color: '#64748b', textTransform: 'none', fontSize: '0.7rem' }}
                >
                  ✕ ล้างวันเริ่ม
                </Button>
              )}
            </Box>
            <Box>
              <Typography sx={{ fontSize: '0.8rem', color: '#64748b', mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                🔴 ปิดขายเมื่อ
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
                  sx={{ mt: 0.5, color: '#64748b', textTransform: 'none', fontSize: '0.7rem' }}
                >
                  ✕ ล้างวันสิ้นสุด
                </Button>
              )}
            </Box>
          </Box>

          {/* Status Preview */}
          {(() => {
            const { status } = isProductOpen(product);
            const statusInfo = {
              upcoming: { icon: '⏰', text: 'สินค้าจะเปิดขายเมื่อถึงเวลาที่กำหนด', color: '#f59e0b' },
              active: { icon: '🟢', text: 'สินค้ากำลังเปิดขายอยู่', color: '#10b981' },
              ended: { icon: '🔴', text: 'หมดเวลาขายแล้ว', color: '#ef4444' },
              always: { icon: '∞', text: 'ไม่มีกำหนดเวลา (เปิดตลอด)', color: '#64748b' },
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
                <Typography sx={{ fontSize: '1.2rem' }}>{info.icon}</Typography>
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
            {(product.images || []).map((img: string, idx: number) => {
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
                    <Button size="small" variant="outlined" onClick={() => handleRemoveImage(idx)} sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.4)', textTransform: 'none' }}>
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
