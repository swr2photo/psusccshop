'use client';

import React from 'react';
import {
  Ban,
  Banknote,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  FileSpreadsheet,
  Image as ImageIcon,
  Mail,
  MapPin,
  MoreHorizontal,
  Package,
  PackageCheck,
  Pencil,
  Phone,
  Receipt,
  RefreshCw,
  Search,
  Store,
  Trash2,
  Truck,
  X,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { STATUS_THEME } from '@/lib/adminTheme';
import { SHIPPING_PROVIDERS } from '@/lib/shipping';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { EmptyState, StatCard } from '@/components/admin/admin-ui';

// ============== TYPES ==============
export interface OrdersViewCartItem {
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

export interface OrdersViewOrder {
  ref: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  instagram?: string;
  amount: number;
  status: string;
  date?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw?: any;
  slip?: { imageUrl?: string; base64?: string };
  cart?: OrdersViewCartItem[];
  items?: OrdersViewCartItem[];
  shippingOption?: string;
  shippingProvider?: string;
  trackingNumber?: string;
  pickup?: { pickedUp?: boolean; pickedUpAt?: string };
}

export interface OrdersViewProduct {
  id: string;
  name: string;
  images?: string[];
  coverImage?: string;
}

export interface OrdersViewKpis {
  total: number;
  pending: number;
  paidShip: number;
  revenue: number;
}

export interface OrdersViewProps<O extends OrdersViewOrder> {
  /** Orders on the current page */
  orders: O[];
  /** All orders in the current product scope (for status counts) */
  scopedOrders: O[];
  filteredCount: number;
  filteredRefs: string[];
  kpis: OrdersViewKpis;

  products: OrdersViewProduct[];
  productFilter: string;
  onProductFilterChange: (id: string) => void;

  statuses: string[];
  statusLabels: Record<string, string>;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  normalizeStatus: (status?: string) => string;

  searchTerm: string;
  onSearchChange: (term: string) => void;
  searchInputRef?: React.Ref<HTMLInputElement>;

  page: number;
  totalPages: number;
  pageSize: number;
  onPageChange: (page: number) => void;

  selected: Set<string>;
  allSelected: boolean;
  onToggleSelect: (ref: string) => void;
  onSelectAll: (refs: string[]) => void;
  onClearSelection: () => void;
  onBatchUpdate: () => void;

  expanded: Set<string>;
  onToggleExpand: (ref: string) => void;
  processingRef: string | null;

  onStatusChange: (ref: string, status: string) => void;
  onEdit: (order: O) => void;
  onViewSlip: (order: O) => void;
  onCancel: (order: O) => void;
  onDelete: (order: O) => void;

  sheetUrl?: string;
  hasSheet: boolean;
  sheetSyncing: boolean;
  onSheetSync: () => void;
  onRefresh: () => void;
}

// ============== HELPERS ==============
const baht = (n: number) => `฿${(Number(n) || 0).toLocaleString()}`;

function shippingInfo(order: OrdersViewOrder): { isPickup: boolean; label: string } {
  const opt = order.shippingOption || '';
  const isPickup = opt === 'pickup' || opt.toLowerCase().includes('รับ') || (!opt && !order.shippingProvider);
  let label = 'รับหน้าร้าน';
  if (opt === 'pickup') label = 'รับหน้าร้าน';
  else if (opt === 'delivery_legacy') label = 'จัดส่ง (เดิม)';
  else if (order.shippingProvider) {
    label =
      (SHIPPING_PROVIDERS as Record<string, { nameThai?: string }>)[order.shippingProvider]?.nameThai ||
      order.shippingProvider;
  } else if (opt === 'thailand_post_ems') label = 'EMS ไปรษณีย์ไทย';
  else if (opt && !isPickup) label = opt;
  else if (!opt) label = 'รับหน้าร้าน (เดิม)';
  else if (opt.toLowerCase().includes('รับ')) label = opt;
  return { isPickup, label };
}

function orderItems(order: OrdersViewOrder): OrdersViewCartItem[] {
  return order.cart || order.items || [];
}

function hasSlip(order: OrdersViewOrder) {
  const slip = order.slip || order.raw?.slip;
  return Boolean(slip && (slip.imageUrl || slip.base64));
}

function formatDate(date?: string) {
  if (!date) return '—';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const stop = (e: React.SyntheticEvent) => e.stopPropagation();

// ============== STATUS SELECT ==============
function StatusSelect({
  value,
  statuses,
  labels,
  disabled,
  onChange,
  normalizeStatus,
}: {
  value: string;
  statuses: string[];
  labels: Record<string, string>;
  disabled?: boolean;
  onChange: (status: string) => void;
  normalizeStatus: (s?: string) => string;
}) {
  const key = normalizeStatus(value);
  const theme = STATUS_THEME[key] || STATUS_THEME.PENDING;
  // Keep the raw value selectable even if it is not in the known list
  const options = statuses.includes(value) ? statuses : [value, ...statuses];
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger
        size="sm"
        aria-label="เปลี่ยนสถานะ"
        className="h-8 w-full min-w-[148px] gap-1.5 rounded-full border-transparent px-3 text-xs font-semibold shadow-none md:w-[160px]"
        style={{ backgroundColor: theme.bg, color: theme.text }}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {options.map((s) => {
          const t = STATUS_THEME[normalizeStatus(s)] || STATUS_THEME.PENDING;
          return (
            <SelectItem key={s} value={s} className="text-xs">
              <span className="size-1.5 rounded-full" style={{ backgroundColor: t.text }} />
              {labels[s] || s}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

// ============== ORDER ROW ==============
function OrderRow<O extends OrdersViewOrder>({
  order,
  products,
  props,
}: {
  order: O;
  products: OrdersViewProduct[];
  props: OrdersViewProps<O>;
}) {
  const isSelected = props.selected.has(order.ref);
  const isExpanded = props.expanded.has(order.ref);
  const isProcessing = props.processingRef === order.ref;
  const listOnly = Boolean((order as { _listOnly?: boolean })._listOnly);
  const items = orderItems(order);
  const itemCount = items.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
  const { isPickup, label: shipLabel } = shippingInfo(order);
  const slip = hasSlip(order);
  const statusKey = props.normalizeStatus(order.status);
  const theme = STATUS_THEME[statusKey] || STATUS_THEME.PENDING;

  return (
    <li
      className={cn(
        'group/row relative transition-colors',
        isSelected ? 'bg-primary/[0.06]' : 'hover:bg-muted/40',
        isProcessing && 'pointer-events-none opacity-60',
      )}
    >
      {/* status accent */}
      <span className="absolute inset-y-0 left-0 w-[3px]" style={{ backgroundColor: theme.text }} aria-hidden />

      <div
        role="button"
        tabIndex={0}
        onClick={() => props.onToggleExpand(order.ref)}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            props.onToggleExpand(order.ref);
          }
        }}
        aria-expanded={isExpanded}
        className="grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 py-3 pr-3 pl-4 outline-none focus-visible:bg-muted/60 md:grid-cols-[auto_minmax(0,1.6fr)_minmax(0,1.2fr)_auto_auto_auto] md:pr-4"
      >
        {/* select */}
        <label onClick={stop} className="-m-2 flex cursor-pointer items-center p-2">
          <Checkbox
            className="!min-h-0 !min-w-0"
            checked={isSelected}
            onCheckedChange={() => props.onToggleSelect(order.ref)}
            aria-label={`เลือก ${order.ref}`}
          />
        </label>

        {/* customer + ref */}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{order.name || '—'}</p>
          <p className="truncate text-xs text-muted-foreground">
            <span className="font-mono">#{order.ref}</span>
            <span className="mx-1.5 text-muted-foreground/50">·</span>
            {formatDate(order.date)}
          </p>
        </div>

        {/* amount (mobile: right of name) */}
        <p className="text-right text-sm font-bold tabular-nums md:order-4">{baht(order.amount)}</p>

        {/* chips: items / shipping / slip */}
        <div className="col-span-2 col-start-2 flex min-w-0 flex-wrap items-center gap-1.5 md:order-3 md:col-span-1 md:col-start-auto">
          <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[0.7rem] font-medium text-muted-foreground">
            <Package className="size-3" />
            {listOnly ? 'รายการสินค้า' : `${itemCount || items.length} ชิ้น`}
            <ChevronDown className={cn('size-3 transition-transform', isExpanded && 'rotate-180')} />
          </span>
          <span
            className={cn(
              'inline-flex max-w-[160px] items-center gap-1 truncate rounded-md px-2 py-0.5 text-[0.7rem] font-medium',
              isPickup
                ? 'bg-success/10 text-success dark:text-success'
                : 'bg-primary/10 text-primary dark:text-primary',
            )}
          >
            {isPickup ? <Store className="size-3 shrink-0" /> : <Truck className="size-3 shrink-0" />}
            <span className="truncate">{shipLabel}</span>
          </span>
          {order.pickup?.pickedUp ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-success/10 px-2 py-0.5 text-[0.7rem] font-medium text-success dark:text-success">
              <PackageCheck className="size-3" /> รับแล้ว
            </span>
          ) : null}
          {slip ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                props.onViewSlip(order);
              }}
              className="inline-flex !min-h-0 !min-w-0 items-center gap-1 rounded-md border border-success/30 px-2 py-0.5 text-[0.7rem] font-semibold text-success transition-colors hover:bg-success/10 dark:text-success"
            >
              <ImageIcon className="size-3" /> ดูสลิป
            </button>
          ) : null}
        </div>

        {/* status + actions */}
        <div
          onClick={stop}
          onKeyDown={stop}
          className="col-span-2 col-start-2 flex items-center gap-1.5 md:order-5 md:col-span-2 md:col-start-auto"
        >
          <div className="flex-1 md:flex-none">
            <StatusSelect
              value={order.status}
              statuses={props.statuses}
              labels={props.statusLabels}
              disabled={isProcessing}
              normalizeStatus={props.normalizeStatus}
              onChange={(s) => props.onStatusChange(order.ref, s)}
            />
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => props.onEdit(order)}
                aria-label="แก้ไขออเดอร์"
                disabled={isProcessing}
              >
                <Pencil />
              </Button>
            </TooltipTrigger>
            <TooltipContent>แก้ไข / ดูรายละเอียด</TooltipContent>
          </Tooltip>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="ตัวเลือกเพิ่มเติม" disabled={isProcessing}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onSelect={() => props.onEdit(order)}>
                <Pencil /> แก้ไขออเดอร์
              </DropdownMenuItem>
              {slip ? (
                <DropdownMenuItem onSelect={() => props.onViewSlip(order)}>
                  <ImageIcon /> ดูสลิปโอนเงิน
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem onSelect={() => navigator.clipboard?.writeText(order.ref)}>
                <Receipt /> คัดลอกเลขออเดอร์
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {statusKey !== 'CANCELLED' ? (
                <DropdownMenuItem onSelect={() => props.onCancel(order)}>
                  <Ban /> ยกเลิกออเดอร์
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem variant="destructive" onSelect={() => props.onDelete(order)}>
                <Trash2 /> ลบถาวร
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* expanded details */}
      {isExpanded ? (
        <div className="grid gap-3 border-t border-dashed border-border bg-muted/30 py-3 pr-4 pl-11 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="min-w-0">
            <p className="mb-2 text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
              รายการสินค้า
            </p>
            {listOnly && items.length === 0 ? (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <RefreshCw className="size-3.5 animate-spin" /> กำลังโหลดรายการ…
              </p>
            ) : items.length === 0 ? (
              <p className="text-xs text-muted-foreground">ไม่มีรายการสินค้า</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {items.map((item, idx) => {
                  const product = products.find((p) => p.id === item.productId);
                  const img = product?.coverImage || product?.images?.[0];
                  const detail = [
                    item.size,
                    item.options?.isLongSleeve ? 'แขนยาว' : null,
                    item.options?.customName,
                    item.options?.customNumber ? `#${item.options.customNumber}` : null,
                    item.options?.pattern,
                  ]
                    .filter(Boolean)
                    .join(' · ');
                  return (
                    <li key={item.id || idx} className="flex items-center gap-2.5 rounded-lg bg-card p-2 ring-1 ring-border">
                      {img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={img} alt="" className="size-9 shrink-0 rounded-md object-cover" />
                      ) : (
                        <span className="grid size-9 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
                          <Package className="size-4" />
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium">
                          {item.productName || product?.name || 'สินค้า'}
                        </span>
                        <span className="block truncate text-[0.7rem] text-muted-foreground">
                          {detail || '—'} · x{item.quantity}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs font-semibold tabular-nums">
                        {baht((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0))}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="min-w-0 space-y-1.5 text-xs">
            <p className="mb-2 text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">ลูกค้า</p>
            <p className="flex items-center gap-2 text-muted-foreground">
              <Mail className="size-3.5 shrink-0" />
              <span className="truncate text-foreground">{order.email || '—'}</span>
            </p>
            {order.phone ? (
              <p className="flex items-center gap-2 text-muted-foreground">
                <Phone className="size-3.5 shrink-0" />
                <a href={`tel:${order.phone}`} onClick={stop} className="text-foreground hover:underline">
                  {order.phone}
                </a>
              </p>
            ) : null}
            {!isPickup && order.address ? (
              <p className="flex items-start gap-2 text-muted-foreground">
                <MapPin className="mt-0.5 size-3.5 shrink-0" />
                <span className="text-foreground">{order.address}</span>
              </p>
            ) : null}
            {order.trackingNumber ? (
              <p className="flex items-center gap-2 text-muted-foreground">
                <Truck className="size-3.5 shrink-0" />
                <span className="font-mono text-foreground">{order.trackingNumber}</span>
              </p>
            ) : null}
            <div className="pt-2">
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  props.onEdit(order);
                }}
              >
                <Pencil /> เปิดรายละเอียดเต็ม
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </li>
  );
}

// ============== MAIN VIEW ==============
export function OrdersView<O extends OrdersViewOrder>(props: OrdersViewProps<O>) {
  const {
    orders,
    scopedOrders,
    filteredCount,
    filteredRefs,
    kpis,
    products,
    productFilter,
    onProductFilterChange,
    statuses,
    statusLabels,
    statusFilter,
    onStatusFilterChange,
    normalizeStatus,
    searchTerm,
    onSearchChange,
    searchInputRef,
    page,
    totalPages,
    pageSize,
    onPageChange,
    selected,
    allSelected,
    onSelectAll,
    onClearSelection,
    onBatchUpdate,
    sheetUrl,
    hasSheet,
    sheetSyncing,
    onSheetSync,
    onRefresh,
  } = props;

  const statusCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    for (const o of scopedOrders) {
      const k = normalizeStatus(o.status);
      counts[k] = (counts[k] || 0) + 1;
    }
    return counts;
  }, [scopedOrders, normalizeStatus]);

  // Only show statuses that have orders (plus the active one) to keep the bar short
  const statusTabs = ['ALL', ...statuses.filter((s) => (statusCounts[s] || 0) > 0 || s === statusFilter)];

  const someSelected = selected.size > 0;
  const firstIndex = filteredCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastIndex = Math.min(page * pageSize, filteredCount);
  const hasFilters = statusFilter !== 'ALL' || Boolean(searchTerm) || productFilter !== 'ALL';

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col gap-4">
        {/* ─── KPIs ─── */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="ออเดอร์ทั้งหมด" value={kpis.total.toLocaleString()} icon={<Receipt />} />
          <StatCard
            label="รอชำระ / รอตรวจสอบ"
            value={kpis.pending.toLocaleString()}
            icon={<Clock />}
            tone="warning"
            onClick={() => onStatusFilterChange(statusFilter === 'WAITING_PAYMENT' ? 'ALL' : 'WAITING_PAYMENT')}
            actionLabel="กรองเฉพาะรอชำระเงิน"
          />
          <StatCard label="ชำระแล้ว / จัดส่งแล้ว" value={kpis.paidShip.toLocaleString()} icon={<PackageCheck />} tone="info" />
          <StatCard label="ยอดขาย (ไม่รวมยกเลิก)" value={baht(kpis.revenue)} icon={<Banknote />} tone="success" />
        </div>

        {/* ─── List card ─── */}
        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          {/* toolbar */}
          <div className="flex flex-col gap-3 border-b border-border p-3 md:p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  ref={searchInputRef}
                  value={searchTerm}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="ค้นหาเลขออเดอร์, ชื่อ, อีเมล, เบอร์โทร, เลขพัสดุ…"
                  autoComplete="off"
                  aria-label="ค้นหาออเดอร์"
                  className="h-9 w-full rounded-lg border border-input bg-background pr-9 pl-9 text-sm outline-none transition-shadow placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 dark:bg-input/30"
                />
                {searchTerm ? (
                  <button
                    type="button"
                    onClick={() => onSearchChange('')}
                    aria-label="ล้างคำค้นหา"
                    className="absolute top-1/2 right-2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <Select value={productFilter || 'ALL'} onValueChange={onProductFilterChange}>
                  <SelectTrigger className="h-9 min-w-0 flex-1 sm:w-[200px] sm:flex-none" aria-label="กรองตามสินค้า">
                    <Package className="size-4" />
                    <SelectValue placeholder="ทุกสินค้า" />
                  </SelectTrigger>
                  <SelectContent align="end">
                    <SelectItem value="ALL">ทุกสินค้า</SelectItem>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon" onClick={onRefresh} aria-label="รีเฟรช">
                      <RefreshCw />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>รีเฟรชข้อมูล</TooltipContent>
                </Tooltip>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" aria-label="Google Sheet">
                      {sheetSyncing ? <RefreshCw className="animate-spin" /> : <FileSpreadsheet />}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem disabled={sheetSyncing} onSelect={onSheetSync}>
                      <RefreshCw /> {hasSheet ? 'ซิงก์ไป Google Sheet' : 'สร้าง Google Sheet'}
                    </DropdownMenuItem>
                    {sheetUrl ? (
                      <DropdownMenuItem asChild>
                        <a href={sheetUrl} target="_blank" rel="noreferrer">
                          <ExternalLink /> เปิด Google Sheet
                        </a>
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* status tabs */}
            <div className="-mx-3 overflow-x-auto px-3 md:-mx-4 md:px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex w-max gap-1.5" role="tablist" aria-label="กรองตามสถานะ">
                {statusTabs.map((status) => {
                  const active = statusFilter === status;
                  const count = status === 'ALL' ? scopedOrders.length : statusCounts[status] || 0;
                  const t = STATUS_THEME[status];
                  return (
                    <button
                      key={status}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => onStatusFilterChange(status)}
                      className={cn(
                        'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium whitespace-nowrap transition-colors',
                        active
                          ? 'border-foreground bg-foreground text-background'
                          : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground',
                      )}
                    >
                      {t ? <span className="size-1.5 rounded-full" style={{ backgroundColor: t.text }} /> : null}
                      {status === 'ALL' ? 'ทั้งหมด' : statusLabels[status] || status}
                      <span
                        className={cn(
                          'rounded-full px-1.5 text-[0.65rem] font-semibold tabular-nums',
                          active ? 'bg-background/20' : 'bg-muted',
                        )}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* list header */}
          <div className="flex items-center gap-3 border-b border-border bg-muted/30 py-2 pr-3 pl-4 text-xs text-muted-foreground md:pr-4">
            <Checkbox
              className="!min-h-0 !min-w-0"
              checked={allSelected ? true : someSelected ? 'indeterminate' : false}
              onCheckedChange={() => (allSelected || someSelected ? onClearSelection() : onSelectAll(filteredRefs))}
              disabled={filteredCount === 0}
              aria-label="เลือกทั้งหมด"
            />
            <span className="flex-1">
              {someSelected ? (
                <span className="font-medium text-foreground">เลือกแล้ว {selected.size} รายการ</span>
              ) : (
                <>
                  แสดง {firstIndex.toLocaleString()}–{lastIndex.toLocaleString()} จาก {filteredCount.toLocaleString()} รายการ
                </>
              )}
            </span>
            {hasFilters ? (
              <button
                type="button"
                onClick={() => {
                  onStatusFilterChange('ALL');
                  onSearchChange('');
                  onProductFilterChange('ALL');
                }}
                className="font-medium text-primary hover:underline"
              >
                ล้างตัวกรอง
              </button>
            ) : null}
          </div>

          {/* rows */}
          {orders.length === 0 ? (
            <EmptyState
              icon={<Receipt />}
              title="ไม่พบออเดอร์"
              description={hasFilters ? 'ลองเปลี่ยนตัวกรองหรือคำค้นหา' : 'ยังไม่มีออเดอร์ในร้านนี้'}
            />
          ) : (
            <ul className="divide-y divide-border">
              {orders.map((order) => (
                <OrderRow key={order.ref} order={order} products={products} props={props} />
              ))}
            </ul>
          )}

          {/* pagination */}
          {totalPages > 1 ? (
            <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 text-xs text-muted-foreground">
              <span>
                หน้า {page} / {totalPages}
              </span>
              <div className="flex items-center gap-1.5">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
                  <ChevronLeft /> ก่อนหน้า
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
                  ถัดไป <ChevronRight />
                </Button>
              </div>
            </div>
          ) : null}
        </section>

        {/* ─── Bulk action bar ─── */}
        {someSelected ? (
          <div className="pointer-events-none fixed inset-x-0 bottom-20 z-30 flex justify-center px-3 md:bottom-6">
            <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-border bg-popover py-1.5 pr-1.5 pl-4 text-sm shadow-lg">
              <span className="font-medium">เลือก {selected.size} รายการ</span>
              <Button size="sm" className="rounded-full" onClick={onBatchUpdate}>
                เปลี่ยนสถานะ
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                className="rounded-full"
                onClick={onClearSelection}
                aria-label="ยกเลิกการเลือก"
              >
                <X />
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </TooltipProvider>
  );
}
