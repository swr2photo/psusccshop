'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  IconButton,
  Chip,
  Stack,
  Alert,
  Tooltip,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Checkbox,
  Tabs,
  Tab,
  InputAdornment,
} from '@mui/material';
import {
  LocalShipping,
  Search,
  Refresh,
  OpenInNew,
  ContentCopy,
  Edit,
  Save,
  CheckCircle,
  Schedule,
  Error as ErrorIcon,
  Flight,
  Close,
  Add,
  Delete,
  Download,
  Print,
  FilterList,
  SelectAll,
  ClearAll,
  Person,
  Phone,
  Home,
} from '@mui/icons-material';
import {
  TrackingInfo,
  TrackingStatus,
  SHIPPING_PROVIDERS,
  TRACKING_STATUS_THAI,
  ShippingProvider,
} from '@/lib/shipping';

interface TrackingManagementProps {
  showToast?: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
}

interface Order {
  ref: string;
  customerName?: string;
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  status: string;
  trackingNumber?: string;
  shippingProvider?: ShippingProvider;
  date?: string;
  cart?: any[];
  total?: number;
  shippingOption?: string;
}

const STATUS_ICONS: Record<TrackingStatus, React.ReactNode> = {
  pending: <Schedule sx={{ fontSize: 18, color: '#94a3b8' }} />,
  picked_up: <Flight sx={{ fontSize: 18, color: '#a78bfa' }} />,
  in_transit: <LocalShipping sx={{ fontSize: 18, color: '#60a5fa' }} />,
  out_for_delivery: <LocalShipping sx={{ fontSize: 18, color: '#22d3ee' }} />,
  delivered: <CheckCircle sx={{ fontSize: 18, color: '#22c55e' }} />,
  returned: <ErrorIcon sx={{ fontSize: 18, color: '#f59e0b' }} />,
  failed: <ErrorIcon sx={{ fontSize: 18, color: '#ef4444' }} />,
  unknown: <Schedule sx={{ fontSize: 18, color: '#94a3b8' }} />,
};

const inputSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '8px',
    bgcolor: 'rgba(255, 255, 255, 0.05)',
    '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.08)' },
    '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.1)' },
    '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
    '&.Mui-focused fieldset': { borderColor: '#8b5cf6' },
  },
  '& .MuiInputLabel-root': {
    color: 'rgba(255, 255, 255, 0.6)',
    '&.Mui-focused': { color: '#8b5cf6' },
  },
  '& .MuiInputBase-input': { color: '#fff' },
};

// Label printing URLs for different carriers
// These are the main shipping label/booking portals for each carrier
const CARRIER_LABEL_URLS: Record<string, string> = {
  thailand_post: 'https://etracking.thailandpost.com/', // Thailand Post tracking & services portal
  kerry: 'https://th.kerryexpress.com/en/ship', // Kerry Express shipping
  jandt: 'https://www.jtexpress.co.th/index/index/index.html', // J&T Express main page with shipping
  flash: 'https://merchant.flashexpress.com/', // Flash Express merchant portal
};

export default function TrackingManagement({ showToast }: TrackingManagementProps) {
  // Tab state
  const [activeTab, setActiveTab] = useState(0);
  
  // State for tracking lookup
  const [searchTrackingNumber, setSearchTrackingNumber] = useState('');
  const [searchProvider, setSearchProvider] = useState<ShippingProvider | ''>('');
  const [trackingResult, setTrackingResult] = useState<TrackingInfo | null>(null);
  const [loadingTracking, setLoadingTracking] = useState(false);
  const [trackingError, setTrackingError] = useState<string | null>(null);

  // State for orders
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'shipped'>('pending');

  // State for editing tracking
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [editTrackingNumber, setEditTrackingNumber] = useState('');
  const [editProvider, setEditProvider] = useState<ShippingProvider>('thailand_post');
  const [saving, setSaving] = useState(false);

  // State for bulk actions
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [bulkTrackingInput, setBulkTrackingInput] = useState('');
  const [bulkProvider, setBulkProvider] = useState<ShippingProvider>('thailand_post');

  // Load orders
  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      setLoadingOrders(true);
      const res = await fetch('/api/admin/data');
      const data = await res.json();
      
      if (data.status === 'success' && data.data?.orders) {
        // Get all orders that are PAID, READY, or SHIPPED (shipping-related) and NOT pickup
        const ordersWithShipping = data.data.orders.filter((o: any) => 
          ['SHIPPED', 'READY', 'PAID'].includes(o.status) && o.shippingOption !== 'pickup'
        ).map((o: any) => ({
          ref: o.ref,
          customerName: o.customerName || o.name,
          name: o.name,
          email: o.email || o.customerEmail || '',
          phone: o.customerPhone || o.phone || '',
          address: o.customerAddress || o.address || '',
          status: o.status,
          trackingNumber: o.trackingNumber,
          shippingProvider: o.shippingProvider,
          date: o.date,
          cart: o.cart,
          total: o.total || o.totalAmount || o.amount,
          shippingOption: o.shippingOption,
        }));
        setAllOrders(ordersWithShipping);
      }
    } catch (error) {
      console.error('Failed to load orders:', error);
      showToast?.('error', 'ไม่สามารถโหลดรายการออเดอร์');
    } finally {
      setLoadingOrders(false);
    }
  };

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return allOrders.filter(order => {
      // Filter by status
      if (filterStatus === 'pending' && order.trackingNumber) return false;
      if (filterStatus === 'shipped' && !order.trackingNumber) return false;

      // Filter by search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return (
          order.ref.toLowerCase().includes(query) ||
          order.customerName?.toLowerCase().includes(query) ||
          order.email?.toLowerCase().includes(query) ||
          order.trackingNumber?.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [allOrders, filterStatus, searchQuery]);

  // Orders pending shipping (no tracking number)
  const pendingOrders = useMemo(() => 
    allOrders.filter(o => !o.trackingNumber),
    [allOrders]
  );

  // Orders already shipped (has tracking number)
  const shippedOrders = useMemo(() => 
    allOrders.filter(o => o.trackingNumber),
    [allOrders]
  );

  // Track shipment
  const handleTrack = async () => {
    if (!searchTrackingNumber.trim()) {
      setTrackingError('กรุณาใส่เลขพัสดุ');
      return;
    }

    setLoadingTracking(true);
    setTrackingError(null);
    setTrackingResult(null);

    try {
      const res = await fetch('/api/shipping/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: searchProvider || undefined,
          trackingNumber: searchTrackingNumber.trim(),
        }),
      });

      const data = await res.json();
      if (data.success && data.data) {
        setTrackingResult(data.data);
      } else {
        setTrackingError(data.error || 'ไม่สามารถดึงข้อมูลการติดตามได้');
      }
    } catch (error) {
      setTrackingError('เกิดข้อผิดพลาดในการติดต่อระบบ');
    } finally {
      setLoadingTracking(false);
    }
  };

  // Update order tracking number
  const handleSaveTracking = async () => {
    if (!editingOrder) return;

    setSaving(true);
    try {
      const res = await fetch('/api/admin/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ref: editingOrder.ref,
          status: 'SHIPPED',
          trackingNumber: editTrackingNumber.trim() || null,
          shippingProvider: editTrackingNumber.trim() ? editProvider : null,
        }),
      });

      const data = await res.json();
      if (data.status === 'success') {
        showToast?.('success', editTrackingNumber.trim() 
          ? `บันทึกเลขพัสดุสำหรับ ${editingOrder.ref} แล้ว`
          : `ลบเลขพัสดุสำหรับ ${editingOrder.ref} แล้ว`
        );
        setEditingOrder(null);
        loadOrders();
      } else {
        showToast?.('error', data.message || 'ไม่สามารถบันทึกได้');
      }
    } catch (error) {
      showToast?.('error', 'เกิดข้อผิดพลาด');
    } finally {
      setSaving(false);
    }
  };

  // Delete tracking number
  const handleDeleteTracking = async (order: Order) => {
    if (!confirm(`ต้องการลบเลขพัสดุของ ${order.ref} ใช่หรือไม่?`)) return;

    try {
      const res = await fetch('/api/admin/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ref: order.ref,
          status: 'PAID', // Revert to PAID status
          trackingNumber: null,
          shippingProvider: null,
        }),
      });

      const data = await res.json();
      if (data.status === 'success') {
        showToast?.('success', `ลบเลขพัสดุสำหรับ ${order.ref} แล้ว`);
        loadOrders();
      } else {
        showToast?.('error', data.message || 'ไม่สามารถลบได้');
      }
    } catch (error) {
      showToast?.('error', 'เกิดข้อผิดพลาด');
    }
  };

  // Bulk add tracking (format: REF:TRACKING per line)
  const handleBulkAddTracking = async () => {
    const lines = bulkTrackingInput.trim().split('\n').filter(l => l.trim());
    if (lines.length === 0) {
      showToast?.('warning', 'กรุณาใส่ข้อมูล');
      return;
    }

    let success = 0;
    let failed = 0;

    for (const line of lines) {
      const parts = line.split(':').map(p => p.trim());
      if (parts.length < 2) continue;

      const [ref, trackingNumber] = parts;
      
      try {
        const res = await fetch('/api/admin/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ref,
            status: 'SHIPPED',
            trackingNumber,
            shippingProvider: bulkProvider,
          }),
        });

        const data = await res.json();
        if (data.status === 'success') {
          success++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }

    showToast?.(success > 0 ? 'success' : 'error', 
      `เพิ่มเลขพัสดุสำเร็จ ${success} รายการ${failed > 0 ? `, ล้มเหลว ${failed} รายการ` : ''}`
    );
    
    if (success > 0) {
      setBulkTrackingInput('');
      loadOrders();
    }
  };

  // Export shipping data
  const handleExportShipping = () => {
    const ordersToExport = selectedOrders.size > 0 
      ? filteredOrders.filter(o => selectedOrders.has(o.ref))
      : pendingOrders;

    if (ordersToExport.length === 0) {
      showToast?.('warning', 'ไม่มีออเดอร์ที่ต้องจัดส่ง');
      return;
    }

    // Create CSV content
    const headers = ['ลำดับ', 'เลขออเดอร์', 'ชื่อผู้รับ', 'เบอร์โทร', 'ที่อยู่', 'อีเมล', 'รายการสินค้า', 'ยอดรวม', 'เลขพัสดุ', 'ขนส่ง'];
    const rows = ordersToExport.map((order, idx) => {
      const items = order.cart?.map((item: any) => {
        const name = item.productName || item.name || item.type || 'สินค้า';
        const size = item.size || '-';
        const qty = item.quantity || item.qty || 1;
        return `${name} (${size}) x${qty}`;
      }).join(', ') || '-';
      
      const providerName = order.shippingProvider 
        ? (SHIPPING_PROVIDERS[order.shippingProvider]?.nameThai || order.shippingProvider) 
        : '-';
      
      return [
        idx + 1,
        order.ref,
        order.customerName || order.name || '-',
        order.phone || '-',
        `"${(order.address || '-').replace(/"/g, '""')}"`,
        order.email || '-',
        `"${items.replace(/"/g, '""')}"`,
        order.total || '-',
        order.trackingNumber || '-',
        providerName,
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    // Download CSV
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `shipping-orders-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();

    showToast?.('success', `ส่งออกข้อมูล ${ordersToExport.length} รายการแล้ว`);
  };

  // Print labels (open carrier websites) - uses anchor element to avoid popup blocker
  const handlePrintLabels = (provider: ShippingProvider) => {
    const url = CARRIER_LABEL_URLS[provider];
    if (url) {
      // Create temporary anchor element to properly open link without popup blocker
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast?.('info', 'เปิดหน้าพิมพ์ใบจ่าหน้าของขนส่งแล้ว');
    } else {
      showToast?.('warning', 'ไม่พบลิงก์สำหรับขนส่งนี้');
    }
  };

  // Copy to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast?.('info', 'คัดลอกแล้ว');
  };

  // Toggle select order
  const toggleSelectOrder = (ref: string) => {
    const newSelected = new Set(selectedOrders);
    if (newSelected.has(ref)) {
      newSelected.delete(ref);
    } else {
      newSelected.add(ref);
    }
    setSelectedOrders(newSelected);
  };

  // Select all visible orders
  const selectAllOrders = () => {
    const allRefs = filteredOrders.map(o => o.ref);
    setSelectedOrders(new Set(allRefs));
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedOrders(new Set());
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1400, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: '#f1f5f9', mb: 1, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <LocalShipping sx={{ color: '#8b5cf6' }} />
          จัดการการจัดส่ง
        </Typography>
        <Typography sx={{ color: '#94a3b8', fontSize: '0.9rem' }}>
          เพิ่มเลขพัสดุ ติดตามสถานะ และส่งออกข้อมูลการจัดส่ง
        </Typography>
      </Box>

      {/* Quick Stats */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <Card sx={{ 
          bgcolor: 'rgba(251, 191, 36, 0.1)', 
          border: '1px solid rgba(251, 191, 36, 0.3)', 
          borderRadius: 2,
          flex: '1 1 150px',
        }}>
          <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
            <Typography sx={{ color: '#fbbf24', fontWeight: 700, fontSize: '1.5rem' }}>
              {pendingOrders.length}
            </Typography>
            <Typography sx={{ color: '#fbbf24', fontSize: '0.8rem' }}>
              รอจัดส่ง
            </Typography>
          </CardContent>
        </Card>
        <Card sx={{ 
          bgcolor: 'rgba(34, 211, 238, 0.1)', 
          border: '1px solid rgba(34, 211, 238, 0.3)', 
          borderRadius: 2,
          flex: '1 1 150px',
        }}>
          <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
            <Typography sx={{ color: '#22d3ee', fontWeight: 700, fontSize: '1.5rem' }}>
              {shippedOrders.length}
            </Typography>
            <Typography sx={{ color: '#22d3ee', fontSize: '0.8rem' }}>
              จัดส่งแล้ว
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Tabs */}
      <Tabs 
        value={activeTab} 
        onChange={(_, v) => setActiveTab(v)}
        sx={{
          mb: 3,
          '& .MuiTab-root': { color: '#94a3b8', fontWeight: 600 },
          '& .Mui-selected': { color: '#8b5cf6' },
          '& .MuiTabs-indicator': { bgcolor: '#8b5cf6' },
        }}
      >
        <Tab label="รายการออเดอร์" />
        <Tab label="เพิ่มเลขพัสดุแบบกลุ่ม" />
        <Tab label="ค้นหาพัสดุ" />
      </Tabs>

      {/* Tab 0: Order List */}
      {activeTab === 0 && (
        <Card sx={{ bgcolor: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 3 }}>
          <CardContent sx={{ p: 3 }}>
            {/* Toolbar */}
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2, mb: 3 }}>
              {/* Search */}
              <TextField
                placeholder="ค้นหา ออเดอร์/ชื่อ/อีเมล/เลขพัสดุ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                size="small"
                sx={{ ...inputSx, flex: 1 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search sx={{ color: '#64748b' }} />
                    </InputAdornment>
                  ),
                }}
              />

              {/* Filter */}
              <FormControl size="small" sx={{ minWidth: 150, ...inputSx }}>
                <Select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  startAdornment={<FilterList sx={{ color: '#64748b', mr: 1 }} />}
                >
                  <MenuItem value="all">ทั้งหมด ({allOrders.length})</MenuItem>
                  <MenuItem value="pending">รอจัดส่ง ({pendingOrders.length})</MenuItem>
                  <MenuItem value="shipped">จัดส่งแล้ว ({shippedOrders.length})</MenuItem>
                </Select>
              </FormControl>

              {/* Refresh */}
              <IconButton onClick={loadOrders} disabled={loadingOrders} sx={{ color: '#64748b' }}>
                <Refresh />
              </IconButton>
            </Box>

            {/* Action Buttons */}
            <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
              <Button
                size="small"
                startIcon={<SelectAll />}
                onClick={selectAllOrders}
                sx={{ color: '#60a5fa' }}
              >
                เลือกทั้งหมด
              </Button>
              {selectedOrders.size > 0 && (
                <Button
                  size="small"
                  startIcon={<ClearAll />}
                  onClick={clearSelection}
                  sx={{ color: '#94a3b8' }}
                >
                  ยกเลิก ({selectedOrders.size})
                </Button>
              )}
              <Box sx={{ flex: 1 }} />
              <Button
                size="small"
                variant="outlined"
                startIcon={<Download />}
                onClick={handleExportShipping}
                sx={{ 
                  borderColor: '#10b981', 
                  color: '#10b981',
                  '&:hover': { borderColor: '#059669', bgcolor: 'rgba(16, 185, 129, 0.1)' },
                }}
              >
                ส่งออก CSV {selectedOrders.size > 0 ? `(${selectedOrders.size})` : `(${pendingOrders.length})`}
              </Button>
            </Box>

            {/* Print Labels Buttons */}
            <Box sx={{ display: 'flex', gap: 1, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
              <Typography sx={{ color: '#94a3b8', fontSize: '0.8rem', mr: 1 }}>
                <Print sx={{ fontSize: 16, verticalAlign: 'middle', mr: 0.5 }} />
                พิมพ์ใบจ่าหน้า:
              </Typography>
              {Object.entries(SHIPPING_PROVIDERS)
                .filter(([key]) => CARRIER_LABEL_URLS[key])
                .map(([key, info]) => (
                  <Button
                    key={key}
                    component="a"
                    href={CARRIER_LABEL_URLS[key]}
                    target="_blank"
                    rel="noopener noreferrer"
                    size="small"
                    sx={{ 
                      bgcolor: 'rgba(139, 92, 246, 0.1)',
                      color: '#a78bfa',
                      fontSize: '0.75rem',
                      textDecoration: 'none',
                      '&:hover': { bgcolor: 'rgba(139, 92, 246, 0.2)' },
                    }}
                  >
                    {info.nameThai}
                  </Button>
                ))
              }
            </Box>

            {/* Orders Table */}
            {loadingOrders ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress size={32} />
              </Box>
            ) : filteredOrders.length === 0 ? (
              <Alert severity="info" sx={{ bgcolor: 'rgba(59, 130, 246, 0.1)' }}>
                ไม่พบออเดอร์ที่ตรงกับเงื่อนไข
              </Alert>
            ) : (
              <TableContainer sx={{ maxHeight: 500 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox" sx={{ bgcolor: '#1e293b', color: '#94a3b8', borderColor: 'rgba(255,255,255,0.1)' }}>
                        <Checkbox 
                          checked={selectedOrders.size === filteredOrders.length && filteredOrders.length > 0}
                          indeterminate={selectedOrders.size > 0 && selectedOrders.size < filteredOrders.length}
                          onChange={(e) => e.target.checked ? selectAllOrders() : clearSelection()}
                          sx={{ color: '#64748b' }}
                        />
                      </TableCell>
                      <TableCell sx={{ bgcolor: '#1e293b', color: '#94a3b8', borderColor: 'rgba(255,255,255,0.1)' }}>ออเดอร์</TableCell>
                      <TableCell sx={{ bgcolor: '#1e293b', color: '#94a3b8', borderColor: 'rgba(255,255,255,0.1)' }}>ลูกค้า</TableCell>
                      <TableCell sx={{ bgcolor: '#1e293b', color: '#94a3b8', borderColor: 'rgba(255,255,255,0.1)' }}>ที่อยู่</TableCell>
                      <TableCell sx={{ bgcolor: '#1e293b', color: '#94a3b8', borderColor: 'rgba(255,255,255,0.1)' }}>เลขพัสดุ</TableCell>
                      <TableCell sx={{ bgcolor: '#1e293b', color: '#94a3b8', borderColor: 'rgba(255,255,255,0.1)' }} align="right">จัดการ</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredOrders.map((order) => (
                      <TableRow 
                        key={order.ref}
                        selected={selectedOrders.has(order.ref)}
                        sx={{ 
                          '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' },
                          '&.Mui-selected': { bgcolor: 'rgba(139, 92, 246, 0.1)' },
                        }}
                      >
                        <TableCell padding="checkbox" sx={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                          <Checkbox 
                            checked={selectedOrders.has(order.ref)}
                            onChange={() => toggleSelectOrder(order.ref)}
                            sx={{ color: '#64748b' }}
                          />
                        </TableCell>
                        <TableCell sx={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                          <Typography sx={{ fontWeight: 600, fontSize: '0.85rem', color: '#f1f5f9' }}>
                            {order.ref}
                          </Typography>
                          <Chip
                            label={order.status}
                            size="small"
                            sx={{
                              height: 18,
                              fontSize: '0.65rem',
                              bgcolor: order.trackingNumber ? 'rgba(34, 211, 238, 0.2)' : 'rgba(251, 191, 36, 0.2)',
                              color: order.trackingNumber ? '#22d3ee' : '#fbbf24',
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Person sx={{ fontSize: 14, color: '#a78bfa' }} />
                              <Typography sx={{ color: '#f1f5f9', fontSize: '0.85rem' }}>
                                {order.customerName || order.name || '-'}
                              </Typography>
                            </Box>
                            {order.phone && (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Phone sx={{ fontSize: 12, color: '#64748b' }} />
                                <Typography sx={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                                  {order.phone}
                                </Typography>
                              </Box>
                            )}
                          </Box>
                        </TableCell>
                        <TableCell sx={{ borderColor: 'rgba(255,255,255,0.05)', maxWidth: 200 }}>
                          <Tooltip title={order.address || '-'}>
                            <Typography sx={{ 
                              color: '#94a3b8', 
                              fontSize: '0.75rem',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}>
                              {order.address || '-'}
                            </Typography>
                          </Tooltip>
                        </TableCell>
                        <TableCell sx={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                          {order.trackingNumber ? (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Typography sx={{ color: '#10b981', fontSize: '0.85rem', fontWeight: 600, fontFamily: 'monospace' }}>
                                {order.trackingNumber}
                              </Typography>
                              <IconButton size="small" onClick={() => copyToClipboard(order.trackingNumber!)}>
                                <ContentCopy sx={{ fontSize: 14, color: '#64748b' }} />
                              </IconButton>
                              {order.shippingProvider && SHIPPING_PROVIDERS[order.shippingProvider] && (
                                <Chip 
                                  label={SHIPPING_PROVIDERS[order.shippingProvider].nameThai}
                                  size="small"
                                  sx={{ height: 18, fontSize: '0.6rem', bgcolor: 'rgba(96, 165, 250, 0.2)', color: '#60a5fa' }}
                                />
                              )}
                            </Box>
                          ) : (
                            <Typography sx={{ color: '#64748b', fontSize: '0.8rem', fontStyle: 'italic' }}>
                              ยังไม่มี
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell sx={{ borderColor: 'rgba(255,255,255,0.05)' }} align="right">
                          <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                            <Tooltip title={order.trackingNumber ? 'แก้ไขเลขพัสดุ' : 'เพิ่มเลขพัสดุ'}>
                              <IconButton
                                size="small"
                                onClick={() => {
                                  setEditingOrder(order);
                                  setEditTrackingNumber(order.trackingNumber || '');
                                  setEditProvider(order.shippingProvider || 'thailand_post');
                                }}
                              >
                                {order.trackingNumber ? (
                                  <Edit sx={{ fontSize: 18, color: '#60a5fa' }} />
                                ) : (
                                  <Add sx={{ fontSize: 18, color: '#10b981' }} />
                                )}
                              </IconButton>
                            </Tooltip>
                            {order.trackingNumber && (
                              <>
                                <Tooltip title="ติดตามพัสดุ">
                                  <IconButton
                                    size="small"
                                    onClick={() => {
                                      setSearchTrackingNumber(order.trackingNumber!);
                                      setSearchProvider(order.shippingProvider || '');
                                      setActiveTab(2);
                                      setTimeout(() => handleTrack(), 100);
                                    }}
                                  >
                                    <Search sx={{ fontSize: 18, color: '#a78bfa' }} />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="ลบเลขพัสดุ">
                                  <IconButton
                                    size="small"
                                    onClick={() => handleDeleteTracking(order)}
                                  >
                                    <Delete sx={{ fontSize: 18, color: '#ef4444' }} />
                                  </IconButton>
                                </Tooltip>
                              </>
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab 1: Bulk Add */}
      {activeTab === 1 && (
        <Card sx={{ bgcolor: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography sx={{ fontWeight: 700, color: '#f1f5f9', mb: 2 }}>
              เพิ่มเลขพัสดุแบบกลุ่ม
            </Typography>
            <Typography sx={{ color: '#94a3b8', fontSize: '0.85rem', mb: 2 }}>
              ใส่ข้อมูลในรูปแบบ <code style={{ color: '#a78bfa' }}>เลขออเดอร์:เลขพัสดุ</code> บรรทัดละ 1 รายการ
            </Typography>

            <FormControl fullWidth sx={{ ...inputSx, mb: 2 }}>
              <InputLabel>ขนส่ง</InputLabel>
              <Select
                value={bulkProvider}
                label="ขนส่ง"
                onChange={(e) => setBulkProvider(e.target.value as ShippingProvider)}
              >
                {Object.entries(SHIPPING_PROVIDERS)
                  .filter(([key]) => key !== 'pickup' && key !== 'custom')
                  .map(([key, info]) => (
                    <MenuItem key={key} value={key}>{info.nameThai}</MenuItem>
                  ))
                }
              </Select>
            </FormControl>

            <TextField
              fullWidth
              multiline
              rows={8}
              placeholder={`ORD-123456789:EY123456789TH\nORD-987654321:KERTH00012345678\nORD-111222333:SPXTH012345678`}
              value={bulkTrackingInput}
              onChange={(e) => setBulkTrackingInput(e.target.value)}
              sx={inputSx}
            />

            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="contained"
                onClick={handleBulkAddTracking}
                disabled={!bulkTrackingInput.trim()}
                startIcon={<Save />}
                sx={{
                  bgcolor: '#10b981',
                  '&:hover': { bgcolor: '#059669' },
                }}
              >
                บันทึกทั้งหมด
              </Button>
            </Box>

            {/* Quick reference */}
            <Box sx={{ mt: 3, p: 2, bgcolor: 'rgba(0,0,0,0.2)', borderRadius: 2 }}>
              <Typography sx={{ color: '#94a3b8', fontSize: '0.8rem', mb: 1 }}>
                รายการรอจัดส่ง (คัดลอกเลขออเดอร์):
              </Typography>
              <Box sx={{ maxHeight: 150, overflow: 'auto' }}>
                {pendingOrders.map(order => (
                  <Box 
                    key={order.ref}
                    sx={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      py: 0.5,
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                    }}
                  >
                    <Typography sx={{ color: '#f1f5f9', fontSize: '0.8rem', fontFamily: 'monospace' }}>
                      {order.ref}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography sx={{ color: '#64748b', fontSize: '0.75rem' }}>
                        {order.customerName || order.name}
                      </Typography>
                      <IconButton size="small" onClick={() => copyToClipboard(order.ref)}>
                        <ContentCopy sx={{ fontSize: 14, color: '#64748b' }} />
                      </IconButton>
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Tab 2: Track Lookup */}
      {activeTab === 2 && (
        <Card sx={{ bgcolor: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography sx={{ fontWeight: 700, color: '#f1f5f9', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Search sx={{ color: '#60a5fa' }} />
              ค้นหาสถานะพัสดุ
            </Typography>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
              <FormControl sx={{ minWidth: 180, ...inputSx }}>
                <InputLabel>ขนส่ง (ไม่บังคับ)</InputLabel>
                <Select
                  value={searchProvider}
                  label="ขนส่ง (ไม่บังคับ)"
                  onChange={(e) => setSearchProvider(e.target.value as ShippingProvider | '')}
                >
                  <MenuItem value="">ตรวจจับอัตโนมัติ</MenuItem>
                  {Object.entries(SHIPPING_PROVIDERS).map(([key, info]) => (
                    <MenuItem key={key} value={key}>{info.nameThai}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                fullWidth
                label="เลขพัสดุ"
                value={searchTrackingNumber}
                onChange={(e) => setSearchTrackingNumber(e.target.value.toUpperCase())}
                onKeyPress={(e) => e.key === 'Enter' && handleTrack()}
                sx={inputSx}
                placeholder="เช่น EY123456789TH"
              />
              <Button
                variant="contained"
                onClick={handleTrack}
                disabled={loadingTracking || !searchTrackingNumber.trim()}
                sx={{
                  minWidth: 120,
                  bgcolor: '#6366f1',
                  '&:hover': { bgcolor: '#4f46e5' },
                }}
              >
                {loadingTracking ? <CircularProgress size={24} color="inherit" /> : 'ค้นหา'}
              </Button>
            </Stack>

            {trackingError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {trackingError}
              </Alert>
            )}

            {/* Tracking Result */}
            {trackingResult && (
              <Box sx={{ mt: 3, p: 2, borderRadius: 2, bgcolor: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Box>
                    <Typography sx={{ color: '#94a3b8', fontSize: '0.8rem' }}>เลขพัสดุ</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography sx={{ color: '#f1f5f9', fontWeight: 700, fontSize: '1.1rem' }}>
                        {trackingResult.trackingNumber}
                      </Typography>
                      <IconButton size="small" onClick={() => copyToClipboard(trackingResult.trackingNumber)}>
                        <ContentCopy sx={{ fontSize: 16, color: '#64748b' }} />
                      </IconButton>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {STATUS_ICONS[trackingResult.status]}
                    <Chip
                      label={TRACKING_STATUS_THAI[trackingResult.status]}
                      sx={{
                        bgcolor: `${trackingResult.status === 'delivered' ? '#22c55e' : '#64748b'}20`,
                        color: trackingResult.status === 'delivered' ? '#22c55e' : '#94a3b8',
                        fontWeight: 600,
                      }}
                    />
                  </Box>
                </Box>

                {/* Events */}
                {trackingResult.events && trackingResult.events.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography sx={{ color: '#94a3b8', fontSize: '0.8rem', mb: 1 }}>ประวัติการเคลื่อนไหว</Typography>
                    <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                      {trackingResult.events.slice(0, 10).map((event, idx) => (
                        <Box
                          key={idx}
                          sx={{
                            display: 'flex',
                            gap: 2,
                            py: 1,
                            borderBottom: idx < trackingResult.events.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                          }}
                        >
                          <Typography sx={{ color: '#64748b', fontSize: '0.75rem', minWidth: 90 }}>
                            {new Date(event.timestamp).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}
                          </Typography>
                          <Typography sx={{ color: '#e2e8f0', fontSize: '0.8rem', flex: 1 }}>
                            {event.descriptionThai || event.description}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                )}

                {/* External Links */}
                <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                  {trackingResult.trackingUrl && (
                    <Button
                      size="small"
                      href={trackingResult.trackingUrl}
                      target="_blank"
                      startIcon={<OpenInNew />}
                      sx={{ color: '#60a5fa' }}
                    >
                      ติดตามที่เว็บขนส่ง
                    </Button>
                  )}
                  {trackingResult.track123Url && (
                    <Button
                      size="small"
                      href={trackingResult.track123Url}
                      target="_blank"
                      startIcon={<OpenInNew />}
                      sx={{ color: '#a78bfa' }}
                    >
                      Track123
                    </Button>
                  )}
                </Box>
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {/* Edit Tracking Dialog */}
      <Dialog
        open={!!editingOrder}
        onClose={() => setEditingOrder(null)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#0f172a',
            color: '#f1f5f9',
            borderRadius: 2,
          },
        }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LocalShipping sx={{ color: '#8b5cf6' }} />
            {editingOrder?.trackingNumber ? 'แก้ไขเลขพัสดุ' : 'เพิ่มเลขพัสดุ'}
          </Box>
          <IconButton onClick={() => setEditingOrder(null)} sx={{ color: '#94a3b8' }}>
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ borderColor: 'rgba(255,255,255,0.1)' }}>
          {editingOrder && (
            <>
              <Box sx={{ mb: 2, p: 2, bgcolor: 'rgba(0,0,0,0.2)', borderRadius: 2 }}>
                <Typography sx={{ color: '#f1f5f9', fontWeight: 600, mb: 1 }}>
                  {editingOrder.ref}
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Person sx={{ fontSize: 14, color: '#a78bfa' }} />
                    <Typography sx={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                      {editingOrder.customerName || editingOrder.name || '-'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Home sx={{ fontSize: 14, color: '#64748b' }} />
                    <Typography sx={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                      {editingOrder.address || '-'}
                    </Typography>
                  </Box>
                </Box>
              </Box>
              
              <Stack spacing={2}>
                <FormControl fullWidth sx={inputSx}>
                  <InputLabel>ขนส่ง</InputLabel>
                  <Select
                    value={editProvider}
                    label="ขนส่ง"
                    onChange={(e) => setEditProvider(e.target.value as ShippingProvider)}
                  >
                    {Object.entries(SHIPPING_PROVIDERS)
                      .filter(([key]) => key !== 'pickup' && key !== 'custom')
                      .map(([key, info]) => (
                        <MenuItem key={key} value={key}>{info.nameThai}</MenuItem>
                      ))
                    }
                  </Select>
                </FormControl>
                
                <TextField
                  fullWidth
                  label="เลขพัสดุ"
                  value={editTrackingNumber}
                  onChange={(e) => setEditTrackingNumber(e.target.value.toUpperCase())}
                  sx={inputSx}
                  placeholder="เช่น EY123456789TH (เว้นว่างเพื่อลบ)"
                  helperText={editingOrder.trackingNumber ? "เว้นว่างเพื่อลบเลขพัสดุ" : ""}
                />
              </Stack>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={() => setEditingOrder(null)}
            sx={{ color: '#94a3b8' }}
          >
            ยกเลิก
          </Button>
          <Button
            onClick={handleSaveTracking}
            variant="contained"
            disabled={saving}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Save />}
            sx={{
              bgcolor: '#10b981',
              '&:hover': { bgcolor: '#059669' },
            }}
          >
            {saving ? 'กำลังบันทึก...' : 'บันทึก'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
