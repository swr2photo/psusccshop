/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';
// Refreshed: 2026-07-27 Tracking Management State Fix

import { useState, useMemo, useCallback, type ReactNode } from 'react';
import {
  Truck as LocalShipping,
  Search,
  RotateCcw as Refresh,
  ExternalLink as OpenInNew,
  Copy as ContentCopy,
  Pencil as Edit,
  Save,
  CheckCircle2 as CheckCircle,
  Clock as Schedule,
  AlertCircle as ErrorIcon,
  Plane as Flight,
  X as Close,
  Plus as Add,
  Trash2 as Delete,
  Download,
  Printer as Print,
  Filter as FilterList,
  CheckSquare as SelectAll,
  ListX as ClearAll,
  User as Person,
  Phone,
  Home,
  Loader2,
} from 'lucide-react';
import {
  TrackingInfo,
  TrackingStatus,
  SHIPPING_PROVIDERS,
  TRACKING_STATUS_THAI,
  ShippingProvider,
} from '@/lib/shipping';
import {
  useShippingOrders,
  useUpdateTracking,
  useTrackShipment,
} from '@/hooks/useShippingOrders';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface TrackingManagementProps {
  showToast?: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
  selectedShopId?: string;
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

const STATUS_ICONS: Record<TrackingStatus, ReactNode> = {
  pending: <Schedule size={18} className="text-slate-400" />,
  picked_up: <Flight size={18} className="text-violet-400" />,
  in_transit: <LocalShipping size={18} className="text-blue-400" />,
  out_for_delivery: <LocalShipping size={18} className="text-cyan-400" />,
  delivered: <CheckCircle size={18} className="text-green-500" />,
  returned: <ErrorIcon size={18} className="text-amber-500" />,
  failed: <ErrorIcon size={18} className="text-red-500" />,
  unknown: <Schedule size={18} className="text-slate-400" />,
};

const glassCardClass =
  'rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] py-0 shadow-none';

const CARRIER_LABEL_URLS: Record<string, string> = {
  thailand_post: 'https://etracking.thailandpost.com/',
  kerry: 'https://th.kerryexpress.com/en/ship',
  jandt: 'https://www.jtexpress.co.th/index/index/index.html',
  flash: 'https://merchant.flashexpress.com/',
};

function getShippingProviderInfo(provider: unknown) {
  if (typeof provider === 'string' && provider in SHIPPING_PROVIDERS) {
    return SHIPPING_PROVIDERS[provider as ShippingProvider];
  }
  return undefined;
}

function getShippingOptionBadge(order: Order) {
  if (order.shippingOption === 'pickup') {
    return (
      <Badge className="h-[22px] gap-1 border-transparent bg-emerald-500/20 text-[0.7rem] text-emerald-500">
        <Home size={14} />
        รับหน้าร้าน
      </Badge>
    );
  }
  if (order.shippingOption === 'delivery_legacy') {
    return (
      <Badge className="h-[22px] gap-1 border-transparent bg-amber-400/20 text-[0.7rem] text-amber-400">
        <LocalShipping size={14} />
        จัดส่ง (เดิม)
      </Badge>
    );
  }
  if (order.shippingOption === 'thailand_post_ems') {
    return (
      <Badge className="h-[22px] gap-1 border-transparent bg-blue-400/20 text-[0.7rem] text-blue-400">
        <LocalShipping size={14} />
        EMS ไปรษณีย์ไทย
      </Badge>
    );
  }
  if (order.shippingProvider) {
    const providerInfo = getShippingProviderInfo(order.shippingProvider);
    return (
      <Badge className="h-[22px] gap-1 border-transparent bg-blue-400/20 text-[0.7rem] text-blue-400">
        <LocalShipping size={14} />
        {providerInfo?.nameThai || order.shippingProvider}
      </Badge>
    );
  }
  if (order.shippingOption) {
    const label =
      order.shippingOption === 'thailand_post_registered' ? 'ลงทะเบียน ไปรษณีย์ไทย' :
      order.shippingOption === 'kerry' ? 'Kerry Express' :
      order.shippingOption === 'flash' ? 'Flash Express' :
      order.shippingOption === 'jandt' ? 'J&T Express' :
      order.shippingOption === 'ninja_van' ? 'Ninja Van' :
      order.shippingOption === 'best' ? 'BEST Express' :
      order.shippingOption === 'scg' ? 'SCG Express' :
      order.shippingOption;
    return (
      <Badge className="h-[22px] gap-1 border-transparent bg-blue-400/20 text-[0.7rem] text-blue-400">
        <LocalShipping size={14} />
        {label}
      </Badge>
    );
  }
  return (
    <Badge className="h-[22px] gap-1 border-transparent bg-slate-400/20 text-[0.7rem] text-[var(--text-muted)]">
      <LocalShipping size={14} />
      จัดส่ง
    </Badge>
  );
}

export default function TrackingManagement({ showToast, selectedShopId }: TrackingManagementProps) {
  const {
    orders: allOrders,
    isLoading: loadingOrders,
    refresh: refreshOrders,
    error: ordersError,
  } = useShippingOrders(selectedShopId);

  const {
    updateTracking,
    deleteTracking: deleteTrackingMutation,
    isUpdating: saving,
  } = useUpdateTracking();

  const {
    trackShipment,
    isTracking: loadingTracking,
    error: trackingError,
  } = useTrackShipment();
  const [trackingResult, setTrackingResult] = useState<any>(null);

  const { confirm: confirmDialog, ConfirmDialog } = useConfirmDialog();

  // States
  const [activeTab, setActiveTab] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'shipped'>('all');
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [bulkTrackingInput, setBulkTrackingInput] = useState<string>('');
  const [bulkProvider, setBulkProvider] = useState<ShippingProvider>('thailand_post' as ShippingProvider);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [editTrackingNumber, setEditTrackingNumber] = useState<string>('');
  const [editProvider, setEditProvider] = useState<ShippingProvider>('thailand_post' as ShippingProvider);
  const [searchTrackingNumber, setSearchTrackingNumber] = useState<string>('');
  const [searchProvider, setSearchProvider] = useState<ShippingProvider | ''>('');

  // Derived filtered order lists
  const pendingOrders = useMemo(() => {
    return allOrders.filter((o: any) => !o.trackingNumber || o.status === 'READY' || o.status === 'PAID');
  }, [allOrders]);

  const shippedOrders = useMemo(() => {
    return allOrders.filter((o: any) => !!o.trackingNumber || o.status === 'SHIPPED' || o.status === 'COMPLETED');
  }, [allOrders]);

  const filteredOrders = useMemo(() => {
    return allOrders.filter((o: any) => {
      // Filter by status tab/dropdown
      if (filterStatus === 'pending' && (o.trackingNumber || o.status === 'SHIPPED' || o.status === 'COMPLETED')) return false;
      if (filterStatus === 'shipped' && !o.trackingNumber && o.status !== 'SHIPPED' && o.status !== 'COMPLETED') return false;

      // Filter by search query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        o.ref.toLowerCase().includes(q) ||
        (o.customerName || o.name || '').toLowerCase().includes(q) ||
        (o.email || '').toLowerCase().includes(q) ||
        (o.phone || '').includes(q) ||
        (o.trackingNumber || '').toLowerCase().includes(q)
      );
    });
  }, [allOrders, filterStatus, searchQuery]);

  const handleTrack = async () => {
    if (!searchTrackingNumber.trim()) {
      showToast?.('warning', 'กรุณาระบุเลขพัสดุ');
      return;
    }
    try {
      await trackShipment(searchTrackingNumber.trim(), searchProvider || undefined);
    } catch (err: any) /* eslint-disable-line @typescript-eslint/no-explicit-any */ {
      showToast?.('error', err?.message || 'ไม่สามารถดึงข้อมูลติดตามพัสดุได้');
    }
  };

  const handleSaveTracking = async () => {
    if (!editingOrder) return;
    try {
      if (!editTrackingNumber.trim()) {
        await deleteTrackingMutation(editingOrder.ref);
        showToast?.('success', `ลบเลขพัสดุสำหรับ ${editingOrder.ref} แล้ว`);
      } else {
        await updateTracking(
          editingOrder.ref,
          editTrackingNumber.trim(),
          editProvider,
          'SHIPPED'
        );
        showToast?.('success', `บันทึกเลขพัสดุสำหรับ ${editingOrder.ref} เรียบร้อยแล้ว`);
      }
      setEditingOrder(null);
    } catch (error: any) /* eslint-disable-line @typescript-eslint/no-explicit-any */ {
      showToast?.('error', error?.message || 'ไม่สามารถบันทึกเลขพัสดุได้');
    }
  };

  const handleDeleteTracking = async (order: Order) => {
    const ok = await confirmDialog({
      title: 'ลบเลขพัสดุ?',
      message: `ต้องการลบเลขพัสดุของ ${order.ref} ใช่หรือไม่?`,
      variant: 'warning',
      confirmText: 'ลบเลย',
      cancelText: 'ยกเลิก',
      destructive: true,
    });
    if (!ok) return;

    try {
      await deleteTrackingMutation(order.ref);
      showToast?.('success', `ลบเลขพัสดุสำหรับ ${order.ref} แล้ว`);
    } catch (error: any) /* eslint-disable-line @typescript-eslint/no-explicit-any */ {
      showToast?.('error', error.message || 'ไม่สามารถลบได้');
    }
  };

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
        await updateTracking(ref, trackingNumber, bulkProvider, 'SHIPPED');
        success++;
      } catch {
        failed++;
      }
    }

    showToast?.(success > 0 ? 'success' : 'error',
      `เพิ่มเลขพัสดุสำเร็จ ${success} รายการ${failed > 0 ? `, ล้มเหลว ${failed} รายการ` : ''}`
    );

    if (success > 0) {
      setBulkTrackingInput('');
    }
  };

  const handleExportShipping = () => {
    const ordersToExport = selectedOrders.size > 0
      ? filteredOrders.filter((o: any) => selectedOrders.has(o.ref))
      : pendingOrders;

    if (ordersToExport.length === 0) {
      showToast?.('warning', 'ไม่มีออเดอร์ที่ต้องจัดส่ง');
      return;
    }

    const headers = ['ลำดับ', 'เลขออเดอร์', 'ชื่อผู้รับ', 'เบอร์โทร', 'ที่อยู่', 'อีเมล', 'รายการสินค้า', 'ยอดรวม', 'เลขพัสดุ', 'ขนส่ง'];
    const rows = ordersToExport.map((order: any, idx: number) => {
      const items = order.cart?.map((item: any) => {
        const name = item.productName || item.name || item.type || 'สินค้า';
        const size = item.size || '-';
        const qty = item.quantity || item.qty || 1;
        return `${name} (${size}) x${qty}`;
      }).join(', ') || '-';

      const providerName = order.shippingProvider
        ? (getShippingProviderInfo(order.shippingProvider)?.nameThai || order.shippingProvider)
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
      ...rows.map((row: any) => row.join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `shipping-orders-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();

    showToast?.('success', `ส่งออกข้อมูล ${ordersToExport.length} รายการแล้ว`);
  };

  const handlePrintLabels = (provider: ShippingProvider) => {
    const url = CARRIER_LABEL_URLS[provider];
    if (url) {
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast?.('info', 'คัดลอกแล้ว');
  };

  const toggleSelectOrder = (ref: string) => {
    const newSelected = new Set(selectedOrders);
    if (newSelected.has(ref)) {
      newSelected.delete(ref);
    } else {
      newSelected.add(ref);
    }
    setSelectedOrders(newSelected);
  };

  const selectAllOrders = () => {
    const allRefs = filteredOrders.map((o: any) => o.ref);
    setSelectedOrders(new Set(allRefs));
  };

  const clearSelection = () => {
    setSelectedOrders(new Set());
  };

  const headerCheckboxState =
    selectedOrders.size === filteredOrders.length && filteredOrders.length > 0
      ? true
      : selectedOrders.size > 0 && selectedOrders.size < filteredOrders.length
        ? 'indeterminate'
        : false;

  return (
    <TooltipProvider>
      <div className="mx-auto max-w-[1400px] p-4 md:p-6">
        {/* Header */}
        <div className="mb-6">
          <h2 className="mb-1 flex items-center gap-3 text-xl font-bold text-[var(--foreground)]">
            <LocalShipping size={24} className="text-blue-800" />
            จัดการการจัดส่ง
          </h2>
          <p className="text-[0.9rem] text-[var(--text-muted)]">
            เพิ่มเลขพัสดุ ติดตามสถานะ และส่งออกข้อมูลการจัดส่ง
          </p>
        </div>

        {/* Quick Stats */}
        <div className="mb-6 flex flex-wrap gap-4">
          <Card className="min-w-[150px] flex-1 rounded-lg border-amber-400/30 bg-amber-400/10 py-0 shadow-none">
            <CardContent className="px-4 py-3">
              <p className="text-2xl font-bold text-amber-400">{pendingOrders.length}</p>
              <p className="text-[0.8rem] text-amber-400">รอจัดส่ง</p>
            </CardContent>
          </Card>
          <Card className="min-w-[150px] flex-1 rounded-lg border-cyan-400/30 bg-cyan-400/10 py-0 shadow-none">
            <CardContent className="px-4 py-3">
              <p className="text-2xl font-bold text-cyan-400">{shippedOrders.length}</p>
              <p className="text-[0.8rem] text-cyan-400">จัดส่งแล้ว</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs
          value={String(activeTab)}
          onValueChange={(v) => setActiveTab(Number(v))}
          className="mb-6"
        >
          <TabsList variant="line" className="mb-6 w-full justify-start bg-transparent">
            <TabsTrigger
              value="0"
              className="data-[state=active]:text-blue-800 after:bg-blue-800"
            >
              รายการออเดอร์
            </TabsTrigger>
            <TabsTrigger
              value="1"
              className="data-[state=active]:text-blue-800 after:bg-blue-800"
            >
              เพิ่มเลขพัสดุแบบกลุ่ม
            </TabsTrigger>
            <TabsTrigger
              value="2"
              className="data-[state=active]:text-blue-800 after:bg-blue-800"
            >
              ค้นหาพัสดุ
            </TabsTrigger>
          </TabsList>

          {/* Tab 0: Order List */}
          <TabsContent value="0">
            <Card className={glassCardClass}>
              <CardContent className="p-6">
                {/* Toolbar */}
                <div className="mb-6 flex flex-col gap-4 md:flex-row">
                  <div className="relative flex-1">
                    <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500" />
                    <Input
                      placeholder="ค้นหา ออเดอร์/ชื่อ/อีเมล/เลขพัสดุ..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>

                  <Select
                    value={filterStatus}
                    onValueChange={(v) => setFilterStatus(v as 'all' | 'pending' | 'shipped')}
                  >
                    <SelectTrigger className="min-w-[150px]">
                      <FilterList className="size-4 text-slate-500" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">ทั้งหมด ({allOrders.length})</SelectItem>
                      <SelectItem value="pending">รอจัดส่ง ({pendingOrders.length})</SelectItem>
                      <SelectItem value="shipped">จัดส่งแล้ว ({shippedOrders.length})</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={refreshOrders}
                    disabled={loadingOrders}
                    className="text-[var(--text-muted)]"
                  >
                    <Refresh />
                  </Button>
                </div>

                {/* Action Buttons */}
                <div className="mb-4 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={selectAllOrders}
                    className="text-blue-400"
                  >
                    <SelectAll />
                    เลือกทั้งหมด
                  </Button>
                  {selectedOrders.size > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={clearSelection}
                      className="text-[var(--text-muted)]"
                    >
                      <ClearAll />
                      ยกเลิก ({selectedOrders.size})
                    </Button>
                  )}
                  <div className="flex-1" />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleExportShipping}
                    className="border-emerald-500 text-emerald-500 hover:bg-emerald-500/10"
                  >
                    <Download />
                    ส่งออก CSV {selectedOrders.size > 0 ? `(${selectedOrders.size})` : `(${pendingOrders.length})`}
                  </Button>
                </div>

                {/* Print Labels Buttons */}
                <div className="mb-6 flex flex-wrap items-center gap-2">
                  <span className="mr-1 text-[0.8rem] text-[var(--text-muted)]">
                    <Print size={16} className="mr-1 inline align-middle" />
                    พิมพ์ใบจ่าหน้า:
                  </span>
                  {Object.entries(SHIPPING_PROVIDERS)
                    .filter(([key]) => CARRIER_LABEL_URLS[key])
                    .map(([key, info]) => (
                      <Button
                        key={key}
                        asChild
                        size="sm"
                        className="bg-blue-800/10 text-[0.75rem] text-violet-400 hover:bg-blue-800/20"
                      >
                        <a
                          href={CARRIER_LABEL_URLS[key]}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {info.nameThai}
                        </a>
                      </Button>
                    ))
                  }
                </div>

                {/* Orders Table */}
                {loadingOrders ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="size-8 animate-spin text-[var(--text-muted)]" />
                  </div>
                ) : filteredOrders.length === 0 ? (
                  <Alert className="border-blue-500/20 bg-blue-500/10">
                    <AlertDescription>ไม่พบออเดอร์ที่ตรงกับเงื่อนไข</AlertDescription>
                  </Alert>
                ) : (
                  <ScrollArea className="max-h-[500px] rounded-md border border-[var(--glass-border)]">
                    <Table>
                      <TableHeader className="sticky top-0 z-10 bg-[var(--surface-2)]">
                        <TableRow className="border-[var(--glass-border)] hover:bg-transparent">
                          <TableHead className="w-10 bg-[var(--surface-2)] text-[var(--text-muted)]">
                            <Checkbox
                              checked={headerCheckboxState}
                              onCheckedChange={(checked) =>
                                checked ? selectAllOrders() : clearSelection()
                              }
                            />
                          </TableHead>
                          <TableHead className="bg-[var(--surface-2)] text-[var(--text-muted)]">ออเดอร์</TableHead>
                          <TableHead className="bg-[var(--surface-2)] text-[var(--text-muted)]">ลูกค้า</TableHead>
                          <TableHead className="bg-[var(--surface-2)] text-[var(--text-muted)]">ที่อยู่</TableHead>
                          <TableHead className="bg-[var(--surface-2)] text-[var(--text-muted)]">ตัวเลือกจัดส่ง</TableHead>
                          <TableHead className="bg-[var(--surface-2)] text-[var(--text-muted)]">เลขพัสดุ</TableHead>
                          <TableHead className="bg-[var(--surface-2)] text-right text-[var(--text-muted)]">จัดการ</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredOrders.map((order: any) => {
                          const providerInfo = getShippingProviderInfo(order.shippingProvider);
                          return (
                          <TableRow
                            key={order.ref}
                            data-state={selectedOrders.has(order.ref) ? 'selected' : undefined}
                            className={cn(
                              'border-[var(--glass-border)] hover:bg-[var(--surface-2)]/50',
                              selectedOrders.has(order.ref) && 'bg-blue-800/10'
                            )}
                          >
                            <TableCell className="border-[var(--glass-border)]">
                              <Checkbox
                                checked={selectedOrders.has(order.ref)}
                                onCheckedChange={() => toggleSelectOrder(order.ref)}
                              />
                            </TableCell>
                            <TableCell className="border-[var(--glass-border)]">
                              <p className="text-[0.85rem] font-semibold text-[var(--foreground)]">
                                {order.ref}
                              </p>
                              <Badge
                                className={cn(
                                  'mt-0.5 h-[18px] border-transparent text-[0.65rem]',
                                  order.trackingNumber
                                    ? 'bg-cyan-400/20 text-cyan-400'
                                    : 'bg-amber-400/20 text-amber-400'
                                )}
                              >
                                {order.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="border-[var(--glass-border)]">
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-1">
                                  <Person size={14} className="text-violet-400" />
                                  <span className="text-[0.85rem] text-[var(--foreground)]">
                                    {order.customerName || order.name || '-'}
                                  </span>
                                </div>
                                {order.phone && (
                                  <div className="flex items-center gap-1">
                                    <Phone size={12} className="text-slate-500" />
                                    <span className="text-[0.75rem] text-[var(--text-muted)]">
                                      {order.phone}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="max-w-[200px] border-[var(--glass-border)]">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <p className="truncate text-[0.75rem] text-[var(--text-muted)]">
                                    {order.address || '-'}
                                  </p>
                                </TooltipTrigger>
                                <TooltipContent>{order.address || '-'}</TooltipContent>
                              </Tooltip>
                            </TableCell>
                            <TableCell className="border-[var(--glass-border)]">
                              <div className="flex flex-col gap-0.5">
                                {getShippingOptionBadge(order)}
                              </div>
                            </TableCell>
                            <TableCell className="border-[var(--glass-border)]">
                              {order.trackingNumber ? (
                                <div className="flex items-center gap-1">
                                  <span className="font-mono text-[0.85rem] font-semibold text-emerald-500">
                                    {order.trackingNumber}
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="icon-xs"
                                    onClick={() => copyToClipboard(order.trackingNumber!)}
                                  >
                                    <ContentCopy size={14} className="text-slate-500" />
                                  </Button>
                                  {providerInfo && (
                                    <Badge className="h-[18px] border-transparent bg-blue-400/20 text-[0.6rem] text-blue-400">
                                      {providerInfo.nameThai}
                                    </Badge>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[0.8rem] italic text-[var(--text-muted)]">
                                  ยังไม่มี
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="border-[var(--glass-border)] text-right">
                              <div className="flex justify-end gap-1.5">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 gap-1 border-blue-500/30 bg-blue-500/10 px-2.5 text-xs text-blue-400 hover:bg-blue-500/20"
                                  onClick={() => {
                                    setEditingOrder(order);
                                    setEditTrackingNumber(order.trackingNumber || '');
                                    setEditProvider(order.shippingProvider || 'thailand_post');
                                  }}
                                >
                                  {order.trackingNumber ? <Edit size={14} /> : <Add size={14} />}
                                  <span>{order.trackingNumber ? 'แก้ไข' : 'เพิ่มเลข'}</span>
                                </Button>

                                {order.trackingNumber && (
                                  <>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-8 gap-1 border-violet-500/30 bg-violet-500/10 px-2.5 text-xs text-violet-400 hover:bg-violet-500/20"
                                      onClick={() => {
                                        setSearchTrackingNumber(order.trackingNumber!);
                                        setSearchProvider(order.shippingProvider || '');
                                        setActiveTab(2);
                                        setTimeout(() => handleTrack(), 100);
                                      }}
                                    >
                                      <Search size={14} />
                                      <span>ติดตาม</span>
                                    </Button>

                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-8 gap-1 border-red-500/30 bg-red-500/10 px-2.5 text-xs text-red-400 hover:bg-red-500/20 hover:text-red-300"
                                      onClick={() => handleDeleteTracking(order)}
                                    >
                                      <Delete size={14} />
                                      <span>ลบ</span>
                                    </Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 1: Bulk Add */}
          <TabsContent value="1">
            <Card className={glassCardClass}>
              <CardContent className="p-6">
                <h3 className="mb-4 font-bold text-[var(--foreground)]">
                  เพิ่มเลขพัสดุแบบกลุ่ม
                </h3>
                <p className="mb-4 text-[0.85rem] text-[var(--text-muted)]">
                  ใส่ข้อมูลในรูปแบบ{' '}
                  <code className="text-violet-400">เลขออเดอร์:เลขพัสดุ</code>{' '}
                  บรรทัดละ 1 รายการ
                </p>

                <div className="mb-4 space-y-2">
                  <Label htmlFor="bulk-provider">ขนส่ง</Label>
                  <Select
                    value={bulkProvider}
                    onValueChange={(v) => setBulkProvider(v as ShippingProvider)}
                  >
                    <SelectTrigger id="bulk-provider" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(SHIPPING_PROVIDERS)
                        .filter(([key]) => key !== 'pickup' && key !== 'custom')
                        .map(([key, info]) => (
                          <SelectItem key={key} value={key}>{info.nameThai}</SelectItem>
                        ))
                      }
                    </SelectContent>
                  </Select>
                </div>

                <Textarea
                  rows={8}
                  placeholder={`ORD-123456789:EY123456789TH\nORD-987654321:KERTH00012345678\nORD-111222333:SPXTH012345678`}
                  value={bulkTrackingInput}
                  onChange={(e) => setBulkTrackingInput(e.target.value)}
                />

                <div className="mt-4 flex justify-end">
                  <Button
                    onClick={handleBulkAddTracking}
                    disabled={!bulkTrackingInput.trim()}
                    className="bg-emerald-500 text-white hover:bg-emerald-600"
                  >
                    <Save />
                    บันทึกทั้งหมด
                  </Button>
                </div>

                {/* Quick reference */}
                <div className="mt-6 rounded-lg bg-[var(--glass-bg)] p-4">
                  <p className="mb-2 text-[0.8rem] text-[var(--text-muted)]">
                    รายการรอจัดส่ง (คัดลอกเลขออเดอร์):
                  </p>
                  <ScrollArea className="max-h-[150px]">
                    {pendingOrders.map((order: any) => (
                      <div
                        key={order.ref}
                        className="flex items-center justify-between border-b border-[var(--glass-border)] py-1"
                      >
                        <span className="font-mono text-[0.8rem] text-[var(--foreground)]">
                          {order.ref}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[0.75rem] text-[var(--text-muted)]">
                            {order.customerName || order.name}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => copyToClipboard(order.ref)}
                          >
                            <ContentCopy size={14} className="text-slate-500" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </ScrollArea>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 2: Track Lookup */}
          <TabsContent value="2">
            <Card className={glassCardClass}>
              <CardContent className="p-6">
                <h3 className="mb-4 flex items-center gap-2 font-bold text-[var(--foreground)]">
                  <Search size={20} className="text-blue-400" />
                  ค้นหาสถานะพัสดุ
                </h3>

                <div className="mb-4 flex flex-col gap-4 sm:flex-row">
                  <div className="space-y-2 sm:min-w-[180px]">
                    <Label htmlFor="search-provider">ขนส่ง (ไม่บังคับ)</Label>
                    <Select
                      value={searchProvider || 'auto'}
                      onValueChange={(v) =>
                        setSearchProvider(v === 'auto' ? '' : (v as ShippingProvider))
                      }
                    >
                      <SelectTrigger id="search-provider" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">ตรวจจับอัตโนมัติ</SelectItem>
                        {Object.entries(SHIPPING_PROVIDERS).map(([key, info]) => (
                          <SelectItem key={key} value={key}>{info.nameThai}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="search-tracking">เลขพัสดุ</Label>
                    <Input
                      id="search-tracking"
                      value={searchTrackingNumber}
                      onChange={(e) => setSearchTrackingNumber(e.target.value.toUpperCase())}
                      onKeyDown={(e) => e.key === 'Enter' && handleTrack()}
                      placeholder="เช่น EY123456789TH"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      onClick={handleTrack}
                      disabled={loadingTracking || !searchTrackingNumber.trim()}
                      className="min-w-[120px] bg-blue-600 text-white hover:bg-blue-700"
                    >
                      {loadingTracking ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        'ค้นหา'
                      )}
                    </Button>
                  </div>
                </div>

                {trackingError && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertDescription>{String(trackingError)}</AlertDescription>
                  </Alert>
                )}

                {/* Tracking Result */}
                {trackingResult && (
                  <div className="mt-6 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] p-4">
                    <div className="mb-4 flex items-start justify-between">
                      <div>
                        <p className="text-[0.8rem] text-[var(--text-muted)]">เลขพัสดุ</p>
                        <div className="flex items-center gap-2">
                          <span className="text-[1.1rem] font-bold text-[var(--foreground)]">
                            {trackingResult.trackingNumber}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => copyToClipboard(trackingResult.trackingNumber)}
                          >
                            <ContentCopy size={16} className="text-slate-500" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {(STATUS_ICONS as any)[trackingResult.status]}
                        <Badge
                          className={cn(
                            'font-semibold',
                            trackingResult.status === 'delivered'
                              ? 'border-transparent bg-green-500/20 text-green-500'
                              : 'border-transparent bg-slate-500/20 text-slate-400'
                          )}
                        >
                          {(TRACKING_STATUS_THAI as any)[trackingResult.status] || trackingResult.status}
                        </Badge>
                      </div>
                    </div>

                    {/* Events */}
                    {trackingResult.events && trackingResult.events.length > 0 && (
                      <div className="mt-4">
                        <p className="mb-2 text-[0.8rem] text-[var(--text-muted)]">ประวัติการเคลื่อนไหว</p>
                        <ScrollArea className="max-h-[200px]">
                          {trackingResult.events.slice(0, 10).map((event: any, idx: number) => (
                            <div
                              key={idx}
                              className={cn(
                                'flex gap-4 py-2',
                                idx < trackingResult.events.length - 1 && 'border-b border-[var(--glass-border)]'
                              )}
                            >
                              <span className="min-w-[90px] text-[0.75rem] text-[var(--text-muted)]">
                                {new Date(event.timestamp).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}
                              </span>
                              <span className="flex-1 text-[0.8rem] text-[var(--foreground)]">
                                {event.descriptionThai || event.description}
                              </span>
                            </div>
                          ))}
                        </ScrollArea>
                      </div>
                    )}

                    {/* External Links */}
                    <div className="mt-4 flex gap-2">
                      {trackingResult.trackingUrl && (
                        <Button asChild size="sm" variant="ghost" className="text-blue-400">
                          <a href={trackingResult.trackingUrl} target="_blank" rel="noopener noreferrer">
                            <OpenInNew />
                            ติดตามที่เว็บขนส่ง
                          </a>
                        </Button>
                      )}
                      {trackingResult.track123Url && (
                        <Button asChild size="sm" variant="ghost" className="text-violet-400">
                          <a href={trackingResult.track123Url} target="_blank" rel="noopener noreferrer">
                            <OpenInNew />
                            Track123
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Edit Tracking Dialog */}
        <Dialog
          open={!!editingOrder}
          onOpenChange={(open) => !open && setEditingOrder(null)}
        >
          <DialogContent
            showCloseButton={false}
            className="border-[var(--glass-border)] bg-[var(--surface)] text-[var(--foreground)] sm:max-w-md"
          >
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle className="flex items-center gap-2">
                  <LocalShipping size={24} className="text-blue-800" />
                  {editingOrder?.trackingNumber ? 'แก้ไขเลขพัสดุ' : 'เพิ่มเลขพัสดุ'}
                </DialogTitle>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setEditingOrder(null)}
                  className="text-[var(--text-muted)]"
                >
                  <Close />
                </Button>
              </div>
            </DialogHeader>

            <Separator className="bg-[var(--glass-border)]" />

            {editingOrder && (
              <div className="space-y-4">
                <div className="rounded-lg bg-[var(--glass-bg)] p-4">
                  <p className="mb-2 font-semibold text-[var(--foreground)]">
                    {editingOrder.ref}
                  </p>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1">
                      <Person size={14} className="text-violet-400" />
                      <span className="text-[0.85rem] text-[var(--text-muted)]">
                        {editingOrder.customerName || editingOrder.name || '-'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Home size={14} className="text-slate-500" />
                      <span className="text-[0.8rem] text-[var(--text-muted)]">
                        {editingOrder.address || '-'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-provider">ขนส่ง</Label>
                  <Select
                    value={editProvider}
                    onValueChange={(v) => setEditProvider(v as ShippingProvider)}
                  >
                    <SelectTrigger id="edit-provider" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(SHIPPING_PROVIDERS)
                        .filter(([key]) => key !== 'pickup' && key !== 'custom')
                        .map(([key, info]) => (
                          <SelectItem key={key} value={key}>{info.nameThai}</SelectItem>
                        ))
                      }
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-tracking">เลขพัสดุ</Label>
                  <Input
                    id="edit-tracking"
                    value={editTrackingNumber}
                    onChange={(e) => setEditTrackingNumber(e.target.value.toUpperCase())}
                    placeholder="เช่น EY123456789TH (เว้นว่างเพื่อลบ)"
                  />
                  {editingOrder.trackingNumber && (
                    <p className="text-xs text-[var(--text-muted)]">เว้นว่างเพื่อลบเลขพัสดุ</p>
                  )}
                </div>
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="ghost"
                onClick={() => setEditingOrder(null)}
                className="text-[var(--text-muted)]"
              >
                ยกเลิก
              </Button>
              <Button
                onClick={handleSaveTracking}
                disabled={saving}
                className="bg-emerald-500 text-white hover:bg-emerald-600"
              >
                {saving ? (
                  <>
                    <Loader2 className="animate-spin" />
                    กำลังบันทึก...
                  </>
                ) : (
                  <>
                    <Save />
                    บันทึก
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <ConfirmDialog />
      </div>
    </TooltipProvider>
  );
}
