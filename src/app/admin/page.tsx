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
    const cached = loadAdminCache();
    const next = {
      config: payload.config || cached?.config || DEFAULT_CONFIG,
      orders: payload.orders ?? cached?.orders ?? [],
      logs: payload.logs ?? cached?.logs ?? [],
    };
    const save = (data: any) => window.localStorage.setItem(ADMIN_CACHE_KEY, JSON.stringify(data));

    try {
      save(next);
    } catch (err: any) {
      if (err?.name !== 'QuotaExceededError') throw err;
      // Fallback: store smaller snapshot to avoid quota blowups in dev tools
      const compact = {
        config: next.config,
        orders: (next.orders || []).slice(0, 30).map(o => ({ ref: o.ref, status: o.status })),
        logs: [],
      };
      try {
        save(compact);
        console.warn('Admin cache trimmed due to quota limit');
      } catch (err2) {
        console.warn('Admin cache disabled due to quota limit');
        ADMIN_CACHE_DISABLED = true;
      }
    }
  } catch (error) {
    if ((error as any)?.name === 'QuotaExceededError') {
      console.warn('Admin cache disabled due to quota limit');
      ADMIN_CACHE_DISABLED = true;
      window.localStorage.removeItem(ADMIN_CACHE_KEY);
      return;
    }
    console.error('Failed to save admin cache', error);
  }
};

const ORDER_STATUSES = ['WAITING_PAYMENT', 'PENDING', 'PAID', 'READY', 'SHIPPED', 'COMPLETED', 'CANCELLED'];
const PRODUCT_TYPES = ['JERSEY', 'CREW', 'OTHER'];

const ADMIN_THEME = {
  bg: '#0f172a',
  text: '#e2e8f0',
  muted: '#cbd5e1',
  border: 'rgba(255,255,255,0.14)',
  glass: 'rgba(255,255,255,0.06)',
  glassSoft: 'rgba(255,255,255,0.04)',
  gradient: 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)',
  gradientAlt: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
};

const glassCardSx = {
  background: ADMIN_THEME.glass,
  border: `1px solid ${ADMIN_THEME.border}`,
  boxShadow: '0 18px 44px rgba(0,0,0,0.35)',
  backdropFilter: 'blur(18px)',
  color: ADMIN_THEME.text,
};

const inputSx = {
  '& .MuiOutlinedInput-root': {
    backgroundColor: ADMIN_THEME.glassSoft,
    color: ADMIN_THEME.text,
    '& fieldset': { borderColor: ADMIN_THEME.border },
    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.28)' },
    '&.Mui-focused fieldset': { borderColor: '#6366f1', boxShadow: '0 0 0 1px rgba(99,102,241,0.35)' },
  },
  '& .MuiInputLabel-root': { color: ADMIN_THEME.muted },
  '& .MuiFormHelperText-root': { color: ADMIN_THEME.muted },
  '& .MuiSelect-icon': { color: ADMIN_THEME.text },
};

const gradientButtonSx = {
  background: ADMIN_THEME.gradient,
  color: '#f8fafc',
  boxShadow: '0 12px 30px rgba(99,102,241,0.35)',
  '&:hover': { background: 'linear-gradient(135deg, #5458e9 0%, #05a2c2 100%)', boxShadow: '0 14px 34px rgba(99,102,241,0.45)' },
};

const tableSx = {
  '& th, & td': { borderColor: 'rgba(255,255,255,0.12)', color: ADMIN_THEME.text },
  '& thead th': { backgroundColor: 'rgba(255,255,255,0.08)', color: ADMIN_THEME.text },
};

// ============== UTILITIES ==============
const sanitizeInput = (str: string) => str.trim().slice(0, 500);
const validatePrice = (price: number) => price >= 0 && price <= 999999;

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
  const isLoading = status === 'loading' || loading;

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

  // 💾 Save Config
  const saveFullConfig = useCallback((newConfig: ShopConfig) => {
    setSaving(true);
    // Save to local state/cache immediately for instant UI feedback
    setConfig(newConfig);
    setLastSavedTime(new Date());
    saveAdminCache({ config: newConfig, orders, logs });
    // Fire-and-forget remote save
    saveShopConfig({ ...newConfig, products: newConfig.products || [] }, session?.user?.email || '')
      .then((res) => {
        if (res.status !== 'success') {
          throw new Error(res.message || 'บันทึกไม่สำเร็จ');
        }
        // Optionally update config with server response if needed
        // setConfig(res.data as ShopConfig);
      })
      .catch((error) => {
        console.error('❌ Save error:', error);
        showToast('error', error?.message || 'บันทึกไม่สำเร็จ');
      })
      .finally(() => {
        setSaving(false);
      });
  }, [orders, logs, showToast, session?.user?.email]);

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

    if (status === 'unauthenticated') {
      signIn('google');
    } else if (status === 'authenticated') {
      if (!session?.user?.email || !isAdmin(session.user.email)) {
        Swal.fire({
          icon: 'error',
          title: 'Access Denied',
          text: 'You do not have permission to access this page',
          confirmButtonText: 'Go Back',
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

  // ✅ View Components
  const DashboardView = (): JSX.Element => {
    const validOrders = orders.filter(o => o.status !== 'CANCELLED');
    const totalSales = validOrders.reduce((sum, o) => sum + (Number(o.amount) || 0), 0);
    const pendingOrders = orders.filter(o => ['WAITING_PAYMENT', 'PENDING'].includes(o.status)).length;
    const paidOrders = orders.filter(o => o.status === 'PAID').length;
    const readyOrders = orders.filter(o => ['READY', 'SHIPPED'].includes(o.status)).length;
    const completedOrders = orders.filter(o => o.status === 'COMPLETED').length;

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* Stats Grid */}
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(4, 1fr)' },
          gap: 2
        }}>
          <StatCard
            label="Total Sales"
            value={`฿${totalSales.toLocaleString()}`}
            trend="+12.5% from last month"
            icon={<AttachMoney sx={{ fontSize: 32, color: '#10b981' }} />}
          />
          <StatCard
            label="Pending Orders"
            value={`${pendingOrders}`}
            trend="waiting for verification"
            icon={<DateRange sx={{ fontSize: 32, color: '#f59e0b' }} />}
          />
          <StatCard
            label="Paid Orders"
            value={`${paidOrders}`}
            trend="ready to pack"
            icon={<CheckCircle sx={{ fontSize: 32, color: '#3b82f6' }} />}
          />
          <StatCard
            label="Completed"
            value={`${completedOrders + readyOrders}`}
            trend="this month"
            icon={<LocalShipping sx={{ fontSize: 32, color: '#10b981' }} />}
          />
        </Box>

        {/* Recent Orders Table */}
        <Card sx={glassCardSx}>
          <CardHeader
            title="Recent Orders"
            avatar={<LocalShipping />}
            titleTypographyProps={{ sx: { fontWeight: 'bold', color: ADMIN_THEME.text } }}
            sx={{ color: ADMIN_THEME.text }}
          />
          <CardContent>
            <TableContainer component={Box} sx={{ background: 'transparent' }}>
              <Table sx={tableSx}>
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Ref</strong></TableCell>
                    <TableCell><strong>Customer</strong></TableCell>
                    <TableCell align="right"><strong>Amount</strong></TableCell>
                    <TableCell><strong>Status</strong></TableCell>
                    <TableCell><strong>Date</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {orders.slice(0, 5).map((order) => (
                    <TableRow key={order.ref} hover>
                      <TableCell>
                        <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                          {order.ref}
                        </Typography>
                      </TableCell>
                      <TableCell>{order.name}</TableCell>
                      <TableCell align="right" sx={{ color: '#10b981', fontWeight: 'bold' }}>
                        ฿{Number(order.amount).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <StatusChip status={order.status} />
                      </TableCell>
                      <TableCell>
                        {order.date ? new Date(order.date).toLocaleDateString() : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
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
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
            Orders ({filteredOrders.length}/{orders.length})
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" justifyContent="flex-end">
            {config.sheetUrl && (
              <Button
                variant="text"
                component="a"
                href={config.sheetUrl}
                target="_blank"
                rel="noreferrer"
                startIcon={<Bolt />}
                sx={{ color: '#a5b4fc' }}
              >
                เปิด Google Sheet
              </Button>
            )}
            <Button
              variant="contained"
              startIcon={<Bolt />}
              onClick={() => triggerSheetSync(config.sheetId ? 'sync' : 'create')}
              disabled={sheetSyncing}
              sx={gradientButtonSx}
            >
              {sheetSyncing ? 'กำลังซิงก์...' : config.sheetId ? 'ซิงก์ Sheet' : 'สร้าง Sheet' }
            </Button>
            <Button 
              variant="outlined" 
              startIcon={<Refresh />}
              onClick={() => fetchData()}
            >
              Refresh
            </Button>
          </Stack>
        </Box>

        {/* Search & Filter */}
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' },
          gap: 2
        }}>
          <TextField
            placeholder="Search by Ref, Name, or Email..."
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
          <Select
            fullWidth
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            sx={inputSx}
          >
            <MenuItem value="ALL">All Status</MenuItem>
            {ORDER_STATUSES.map(status => (
              <MenuItem key={status} value={status}>{status}</MenuItem>
            ))}
          </Select>
        </Box>

        {/* Orders Table */}
        <Card sx={glassCardSx}>
          <CardContent>
            <TableContainer component={Box} sx={{ background: 'transparent' }}>
              <Table sx={tableSx}>
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Ref</strong></TableCell>
                    <TableCell><strong>Customer</strong></TableCell>
                    <TableCell><strong>Email</strong></TableCell>
                    <TableCell align="right"><strong>Amount</strong></TableCell>
                    <TableCell><strong>Status</strong></TableCell>
                    <TableCell><strong>Date</strong></TableCell>
                    <TableCell><strong>Action</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredOrders.map(order => (
                    <TableRow key={order.ref} hover>
                      <TableCell>
                        <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                          {order.ref}
                        </Typography>
                      </TableCell>
                      <TableCell>{order.name}</TableCell>
                      <TableCell>
                        <Typography variant="caption">{order.email}</Typography>
                      </TableCell>
                      <TableCell align="right" sx={{ color: '#10b981', fontWeight: 'bold' }}>
                        ฿{Number(order.amount).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <StatusChip status={order.status} />
                      </TableCell>
                      <TableCell>
                        {order.date ? new Date(order.date).toLocaleDateString() : '-'}
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Select
                            value={order.status}
                            onChange={(e) => updateOrderStatus(order.ref, e.target.value)}
                            size="small"
                            sx={{ ...inputSx, minWidth: 140 }}
                          >
                            {ORDER_STATUSES.map(status => (
                              <MenuItem key={status} value={status}>{status}</MenuItem>
                            ))}
                          </Select>
                          <IconButton
                            size="small"
                            onClick={() => openOrderEditor(order)}
                            sx={{ color: '#e2e8f0' }}
                            disabled={orderProcessingRef === order.ref}
                          >
                            <EditIconMUI fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => deleteOrder(order, false)}
                            sx={{ color: '#f59e0b' }}
                            disabled={orderProcessingRef === order.ref}
                          >
                            <Close fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => deleteOrder(order, true)}
                            sx={{ color: '#ef4444' }}
                            disabled={orderProcessingRef === order.ref}
                          >
                            <Delete fontSize="small" />
                          </IconButton>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            {filteredOrders.length === 0 && (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Receipt sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                <Typography sx={{ color: ADMIN_THEME.muted }}>No orders found</Typography>
              </Box>
            )}
          </CardContent>
        </Card>

        <Dialog open={orderEditor.open} onClose={resetOrderEditor} fullWidth maxWidth="sm">
          <DialogTitle>
            แก้ไขออเดอร์ {orderEditor.ref && <Typography component="span" variant="caption">#{orderEditor.ref}</Typography>}
          </DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="ชื่อลูกค้า"
              value={orderEditor.name}
              onChange={(e) => setOrderEditor(prev => ({ ...prev, name: e.target.value }))}
              fullWidth
              sx={inputSx}
            />
            <TextField
              label="อีเมล"
              value={orderEditor.email}
              onChange={(e) => setOrderEditor(prev => ({ ...prev, email: e.target.value }))}
              fullWidth
              sx={inputSx}
            />
            <TextField
              label="ยอดชำระ (บาท)"
              type="number"
              value={orderEditor.amount}
              onChange={(e) => setOrderEditor(prev => ({ ...prev, amount: Number(e.target.value) }))}
              fullWidth
              sx={inputSx}
            />
            <TextField
              label="วันที่"
              type="datetime-local"
              value={orderEditor.date}
              onChange={(e) => setOrderEditor(prev => ({ ...prev, date: e.target.value }))}
              InputLabelProps={{ shrink: true }}
              fullWidth
              sx={inputSx}
            />
            <Select
              value={orderEditor.status}
              onChange={(e) => setOrderEditor(prev => ({ ...prev, status: e.target.value }))}
              fullWidth
              sx={inputSx}
            >
              {ORDER_STATUSES.map(status => (
                <MenuItem key={status} value={status}>{status}</MenuItem>
              ))}
            </Select>
          </DialogContent>
          <DialogActions>
            <Button onClick={resetOrderEditor}>ปิด</Button>
            <Button
              onClick={saveOrderEdits}
              variant="contained"
              startIcon={<Save />}
              disabled={orderProcessingRef === orderEditor.ref}
              sx={gradientButtonSx}
            >
              บันทึก
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    );
  };

  const SettingsView = (): JSX.Element => {
    const [localConfig, setLocalConfig] = useState(config);
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
      setLocalConfig(config);
      setHasChanges(false);
    }, [config]);

    const handleChange = (newVal: ShopConfig) => {
      setLocalConfig(newVal);
      setHasChanges(true);
    };

    const handleSave = () => {
      saveFullConfig(localConfig);
      setHasChanges(false);
    };

    useEffect(() => {
      if (!hasChanges) return;
      const timer = setTimeout(() => {
        saveFullConfig(localConfig);
        setHasChanges(false);
      }, 800);
      return () => clearTimeout(timer);
    }, [hasChanges, localConfig, saveFullConfig]);

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 800 }}>
        <Typography variant="h5" sx={{ fontWeight: 'bold' }}>Shop Settings</Typography>

        {/* Shop Status */}
        <Card sx={glassCardSx}>
          <CardHeader
            title="Shop Status"
            avatar={<Store />}
            titleTypographyProps={{ sx: { fontWeight: 'bold', color: ADMIN_THEME.text } }}
            sx={{ color: ADMIN_THEME.text }}
          />
          <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography>Shop Is Open</Typography>
              <Switch
                checked={localConfig.isOpen}
                onChange={(e) => handleChange({...localConfig, isOpen: e.target.checked})}
              />
            </Box>

            {!localConfig.isOpen && (
              <TextField
                type="date"
                label="Close Until"
                value={localConfig.closeDate}
                onChange={(e) => handleChange({...localConfig, closeDate: e.target.value})}
                fullWidth
                InputLabelProps={{ shrink: true }}
                sx={inputSx}
              />
            )}
          </CardContent>
        </Card>

        {/* Announcement */}
        <Card sx={glassCardSx}>
          <CardHeader
            title="Announcement"
            avatar={<Notifications />}
            titleTypographyProps={{ sx: { fontWeight: 'bold', color: ADMIN_THEME.text } }}
            sx={{ color: ADMIN_THEME.text }}
          />
          <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={localConfig.announcement?.enabled ?? false}
                  onChange={(e) => handleChange({
                    ...localConfig,
                    announcement: {...(localConfig.announcement ?? { enabled: false, message: '', color: 'blue' }), enabled: e.target.checked}
                  })}
                />
              }
              label="Enable Announcement"
            />

            {(localConfig.announcement?.enabled) && (
              <>
                <TextField
                  label="Message"
                  multiline
                  rows={3}
                  value={localConfig.announcement?.message ?? ''}
                  onChange={(e) => handleChange({
                    ...localConfig,
                    announcement: {...(localConfig.announcement ?? { enabled: false, message: '', color: 'blue' }), message: e.target.value}
                  })}
                  fullWidth
                  inputProps={{ maxLength: 200 }}
                  helperText={`${(localConfig.announcement?.message ?? '').length}/200`}
                  sx={inputSx}
                />

                <Select
                  value={localConfig.announcement?.color ?? 'blue'}
                  onChange={(e) => handleChange({
                    ...localConfig,
                    announcement: {...(localConfig.announcement ?? { enabled: false, message: '', color: 'blue' }), color: e.target.value as any}
                  })}
                  fullWidth
                  sx={inputSx}
                >
                  <MenuItem value="blue">Blue</MenuItem>
                  <MenuItem value="red">Red</MenuItem>
                  <MenuItem value="emerald">Emerald</MenuItem>
                  <MenuItem value="orange">Orange</MenuItem>
                </Select>
              </>
            )}
          </CardContent>
        </Card>

        <Card sx={glassCardSx}>
          <CardHeader
            title="Google Sheet"
            avatar={<Bolt />}
            titleTypographyProps={{ sx: { fontWeight: 'bold', color: ADMIN_THEME.text } }}
            sx={{ color: ADMIN_THEME.text }}
          />
          <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Sheet ID"
              value={localConfig.sheetId || ''}
              onChange={(e) => handleChange({ ...localConfig, sheetId: e.target.value, sheetUrl: e.target.value ? `https://docs.google.com/spreadsheets/d/${e.target.value}` : '' })}
              fullWidth
              sx={inputSx}
              helperText="ใส่ ID จากลิงก์ Sheet หรือปล่อยว่างแล้วกด 'สร้างและเชื่อม Sheet'"
            />
            <TextField
              label="Sheet URL"
              value={localConfig.sheetUrl || ''}
              onChange={(e) => handleChange({ ...localConfig, sheetUrl: e.target.value })}
              fullWidth
              sx={inputSx}
              helperText="เปิดดู/แก้ไขได้ที่ลิงก์นี้"
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <Button
                variant="contained"
                startIcon={<Bolt />}
                onClick={() => triggerSheetSync(localConfig.sheetId ? 'sync' : 'create')}
                disabled={sheetSyncing}
                sx={{ ...gradientButtonSx, flex: 1 }}
              >
                {sheetSyncing ? 'กำลังซิงก์...' : localConfig.sheetId ? 'ซิงก์ทันที' : 'สร้างและเชื่อม Sheet'}
              </Button>
              {localConfig.sheetUrl && (
                <Button
                  variant="outlined"
                  component="a"
                  href={localConfig.sheetUrl}
                  target="_blank"
                  rel="noreferrer"
                  fullWidth
                  sx={{ minWidth: 160 }}
                >
                  เปิด Sheet
                </Button>
              )}
            </Stack>
          </CardContent>
        </Card>

        {/* Save Button */}
        {hasChanges && (
          <Stack direction="row" spacing={2}>
            <Button
              variant="contained"
              fullWidth
              onClick={handleSave}
              disabled={loading}
              startIcon={<Save />}
              sx={{ ...gradientButtonSx, background: ADMIN_THEME.gradientAlt, '&:hover': { background: 'linear-gradient(135deg, #0ea472 0%, #0591b5 100%)', boxShadow: '0 14px 34px rgba(16,185,129,0.45)' } }}
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
            <Button
              variant="outlined"
              fullWidth
              onClick={() => {
                setLocalConfig(config);
                setHasChanges(false);
              }}
            >
              Cancel
            </Button>
          </Stack>
        )}

        {!hasChanges && (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button
              variant="contained"
              startIcon={<Save />}
              onClick={() => handleSave()}
              disabled={loading}
              sx={{ ...gradientButtonSx, flex: 1 }}
            >
              บันทึกตอนนี้
            </Button>
            <Button
              variant="outlined"
              onClick={() => triggerSheetSync(localConfig.sheetId ? 'sync' : 'create')}
              disabled={sheetSyncing}
              sx={{ flex: 1, borderColor: 'rgba(255,255,255,0.25)' }}
            >
              {sheetSyncing ? 'กำลังซิงก์...' : 'ซิงก์ Sheet เร็วๆ'}
            </Button>
          </Stack>
        )}

        {lastSavedTime && (
          <Typography variant="caption" sx={{ color: ADMIN_THEME.muted }}>
            Last saved: {lastSavedTime.toLocaleString()}
          </Typography>
        )}
      </Box>
    );
  };

  const LogsView = (): JSX.Element => {
    const [logFilter, setLogFilter] = useState<string>('ALL');

    const filteredLogs = logFilter === 'ALL'
      ? logs
      : logs.filter(log => log[2] === logFilter);

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 'bold' }}>System Logs</Typography>

        {/* Filter */}
        <Select
          value={logFilter}
          onChange={(e) => setLogFilter(e.target.value)}
          sx={{ maxWidth: 300, ...inputSx }}
        >
          <MenuItem value="ALL">All Actions</MenuItem>
          <MenuItem value="UPDATE_CONFIG">Config Updates</MenuItem>
          <MenuItem value="UPDATE_STATUS">Status Changes</MenuItem>
          <MenuItem value="SEND_EMAIL">Emails</MenuItem>
          <MenuItem value="SUBMIT_ORDER">New Orders</MenuItem>
        </Select>

        {/* Logs Table */}
        <Card sx={glassCardSx}>
          <CardContent>
            <TableContainer component={Box} sx={{ background: 'transparent' }}>
              <Table sx={tableSx}>
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Timestamp</strong></TableCell>
                    <TableCell><strong>Admin</strong></TableCell>
                    <TableCell><strong>Action</strong></TableCell>
                    <TableCell><strong>Detail</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredLogs.map((log, idx) => (
                    <TableRow key={idx} hover>
                      <TableCell>
                        <Typography variant="caption">
                          {log[0] ? new Date(log[0]).toLocaleString() : '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>{log[1] || '-'}</TableCell>
                      <TableCell>
                        <Chip label={log[2] || '-'} size="small" />
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption">{log[3] || '-'}</Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            {filteredLogs.length === 0 && (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <History sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                <Typography sx={{ color: ADMIN_THEME.muted }}>No logs found</Typography>
              </Box>
            )}
          </CardContent>
        </Card>
      </Box>
    );
  };

  // Loading State (keep layout mounted while fetching to avoid null returns)
  // isLoading / isAuthorized defined earlier

  // Main Render
  const pendingCount = orders.filter((o) => ['WAITING_PAYMENT', 'PENDING'].includes(o.status)).length;

  if (!isAuthorized) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)' }}>
        <Card sx={{ ...glassCardSx, maxWidth: 420, textAlign: 'center', p: 4 }}>
          <Lock sx={{ fontSize: 64, color: '#ef4444', mb: 2 }} />
          <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 2 }}>Access Denied</Typography>
          <Typography sx={{ mb: 3, color: ADMIN_THEME.muted }}>
            You don't have permission to access this page
          </Typography>
          <Button
            variant="contained"
            onClick={() => router.push('/')}
            fullWidth
            sx={gradientButtonSx}
          >
            Go Home
          </Button>
        </Card>
      </Box>
    );
  }

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)' }}>
        <Typography sx={{ color: ADMIN_THEME.muted }}>Loading…</Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
        color: ADMIN_THEME.text,
      }}
    >
      {/* Header */}
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          bgcolor: 'rgba(15,23,42,0.78)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 18px 44px rgba(0,0,0,0.45)',
          color: ADMIN_THEME.text,
        }}
      >
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            sx={{ mr: 2, display: { xs: 'block', md: 'none' } }}
          >
            <Dashboard />
          </IconButton>
          <Bolt sx={{ mr: 1 }} />
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 'bold' }}>
            PSUSCCSHOP Admin
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {saving ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: ADMIN_THEME.muted }}>
                <CircularProgress size={14} thickness={6} color="inherit" />
                <Typography variant="caption">กำลังบันทึก…</Typography>
              </Box>
            ) : (
              <Typography variant="caption" sx={{ color: ADMIN_THEME.muted }}>
                {lastSavedTime ? `บันทึกล่าสุด ${lastSavedTime.toLocaleTimeString()}` : 'ยังไม่บันทึก'}
              </Typography>
            )}
            <Typography variant="caption" sx={{ color: ADMIN_THEME.muted }}>{session?.user?.name || 'Admin'}</Typography>
            <Avatar src={session?.user?.image || ''} />
            <Button color="inherit" onClick={() => signOut()}>
              <Logout />
            </Button>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Sidebar & Content */}
      <Box sx={{ display: 'flex', flex: 1 }}>
        {/* Sidebar */}
        <Drawer
          open={isDesktop ? true : sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          sx={{
            width: 260,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: 260,
              background: 'rgba(15,23,42,0.92)',
              color: ADMIN_THEME.text,
              borderRight: '1px solid rgba(255,255,255,0.12)',
              boxSizing: 'border-box',
              position: { xs: 'fixed', md: 'relative' },
              height: { xs: 'auto', md: '100%' },
              backdropFilter: 'blur(20px)',
              boxShadow: '0 18px 44px rgba(0,0,0,0.45)',
            }
          }}
          variant={isDesktop ? 'permanent' : 'temporary'}
          ModalProps={{ keepMounted: true }}
          anchor="left"
        >
          <List sx={{ p: 2 }}>
            {[
              { icon: <Dashboard />, label: 'Dashboard', idx: 0 },
              { icon: <ShoppingCart />, label: 'Products', idx: 1 },
              { icon: <Receipt />, label: 'Orders', idx: 2 },
              { icon: <Settings />, label: 'Settings', idx: 3 },
              { icon: <History />, label: 'Logs', idx: 4 },
            ].map((item) => (
              <ListItem
                key={item.idx}
                onClick={() => {
                  setActiveTab(item.idx);
                  setSidebarOpen(false);
                }}
                sx={{
                  borderRadius: 1,
                  mb: 1,
                  bgcolor: activeTab === item.idx ? 'rgba(99,102,241,0.16)' : 'transparent',
                  border: activeTab === item.idx ? '1px solid rgba(99,102,241,0.45)' : '1px solid transparent',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' },
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  color: activeTab === item.idx ? ADMIN_THEME.text : ADMIN_THEME.muted,
                  fontWeight: activeTab === item.idx ? 'bold' : 'normal',
                }}
              >
                <ListItemIcon sx={{ color: 'inherit', minWidth: 40 }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText primary={item.label} />
                {item.idx === 2 && pendingCount > 0 && (
                  <Badge badgeContent={pendingCount} color="error" />
                )}
              </ListItem>
            ))}
          </List>
        </Drawer>

        {/* Main Content */}
        <Box sx={{ flex: 1, p: { xs: 2, md: 3 }, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
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

      {/* Toast intentionally disabled */}
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

const ProductCardItem = ({ product, onEdit, onDelete }: any): JSX.Element => {
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
        {!product.isActive && (
          <Box sx={{
            position: 'absolute',
            inset: 0,
            bgcolor: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ff6b6b',
            fontWeight: 'bold'
          }}>
            INACTIVE
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

        <TextField
          label="Start Date"
          type="date"
          value={product.startDate}
          onChange={(e) => onChange({...product, startDate: e.target.value})}
          fullWidth
          InputLabelProps={{ shrink: true }}
          sx={inputSx}
        />

        <TextField
          label="End Date"
          type="date"
          value={product.endDate}
          onChange={(e) => onChange({...product, endDate: e.target.value})}
          fullWidth
          InputLabelProps={{ shrink: true }}
          sx={inputSx}
        />

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
