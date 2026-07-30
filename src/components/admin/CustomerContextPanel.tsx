/* eslint-disable */
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Copy,
  ExternalLink,
  Loader2,
  RefreshCw,
  Search,
  Send,
  StickyNote,
  UserRoundCog,
  ImageIcon,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export type TransferAdmin = { email: string; name: string };

type OrderFilter = 'all' | 'pending' | 'completed' | 'cancelled';

type CustomerContextPanelProps = {
  customerName: string;
  customerEmail: string;
  customerAvatar?: string;
  chatStatus: 'pending' | 'active' | 'closed';
  adminName?: string;
  adminEmail?: string;
  currentAdminEmail?: string;
  orders: any[];
  loadingOrders: boolean;
  onRefreshOrders: () => void;
  focusOrderRef: string | null;
  onFocusHandled?: () => void;
  canSendToChat: boolean;
  onSendOrderSummary: (order: any) => void;
  onSendTrackingUpdate: (order: any) => void;
  onAccept: () => void;
  onTakeOver: () => void;
  onCloseCase: () => void;
  transferAdmins: TransferAdmin[];
  transferToEmail: string;
  onTransferToEmailChange: (email: string) => void;
  transferring: boolean;
  onTransfer: () => void;
  adminNote: string;
  onAdminNoteChange: (value: string) => void;
  getOrderStatusLabel: (status: string) => string;
  getOrderStatusBadgeClass: (status: string) => string;
};

function normalizeStatus(status: string | undefined) {
  return (status || '').toUpperCase();
}

function isCompletedStatus(status: string) {
  const s = normalizeStatus(status);
  return ['COMPLETED', 'PAID', 'SHIPPED', 'READY', 'PROCESSING', 'RECEIVED'].includes(s);
}

function isCancelledStatus(status: string) {
  const s = normalizeStatus(status);
  return s === 'CANCELLED' || s === 'REFUNDED' || s.startsWith('REFUND');
}

function isPendingStatus(status: string) {
  return !isCompletedStatus(status) && !isCancelledStatus(status);
}

function orderAmount(order: any) {
  return Number(order.totalAmount ?? order.amount ?? 0) || 0;
}

function orderDate(order: any) {
  const raw = order.date || order.createdAt;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function cartItems(order: any): any[] {
  return Array.isArray(order.cart) ? order.cart : [];
}

function itemLabel(item: any) {
  const name = item?.productName || item?.name || 'สินค้า';
  const size = item?.size ? ` (Size ${item.size})` : '';
  const qty = item?.quantity ?? item?.qty;
  return `${name}${size}${qty ? ` x${qty}` : ''}`;
}

function hasSlip(order: any) {
  const slip = order.slip || order.slipData;
  return Boolean(
    slip?.imageUrl ||
      slip?.hasBase64 ||
      slip?.hasData ||
      order.hasSlip
  );
}

function slipSrc(order: any) {
  const slip = order.slip || order.slipData;
  if (slip?.imageUrl) return slip.imageUrl as string;
  if (order.ref) return `/api/slip/${encodeURIComponent(order.ref)}`;
  return null;
}

function computeInsights(orders: any[]) {
  const total = orders.length;
  const completed = orders.filter((o) => isCompletedStatus(o.status));
  const cancelled = orders.filter((o) => isCancelledStatus(o.status));
  const spent = completed.reduce((sum, o) => sum + orderAmount(o), 0);
  const completionRate = total ? Math.round((completed.length / total) * 100) : 0;

  const badges: { key: string; label: string; className: string }[] = [];
  if (total === 0) {
    badges.push({
      key: 'new',
      label: 'ลูกค้าใหม่',
      className: 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
    });
  } else if (total === 1 && completed.length === 1) {
    badges.push({
      key: 'first',
      label: 'สั่งซื้อครั้งแรก',
      className: 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
    });
  }
  if (spent >= 5000 || completed.length >= 5) {
    badges.push({
      key: 'vip',
      label: 'VIP Customer',
      className: 'bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
    });
  }
  if (cancelled.length >= 3) {
    badges.push({
      key: 'cancel-heavy',
      label: `ยกเลิก ${cancelled.length} ครั้ง`,
      className: 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300',
    });
  }
  if (completed.length > 0) {
    badges.push({
      key: 'done',
      label: `ซื้อสำเร็จ ${completed.length} รายการ`,
      className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    });
  }

  return { total, completed: completed.length, cancelled: cancelled.length, spent, completionRate, badges };
}

export function CustomerContextPanel({
  customerName,
  customerEmail,
  customerAvatar,
  chatStatus,
  adminName,
  adminEmail,
  currentAdminEmail,
  orders,
  loadingOrders,
  onRefreshOrders,
  focusOrderRef,
  onFocusHandled,
  canSendToChat,
  onSendOrderSummary,
  onSendTrackingUpdate,
  onAccept,
  onTakeOver,
  onCloseCase,
  transferAdmins,
  transferToEmail,
  onTransferToEmailChange,
  transferring,
  onTransfer,
  adminNote,
  onAdminNoteChange,
  getOrderStatusLabel,
  getOrderStatusBadgeClass,
}: CustomerContextPanelProps) {
  const [orderQuery, setOrderQuery] = useState('');
  const [orderFilter, setOrderFilter] = useState<OrderFilter>('all');
  const [copiedTrack, setCopiedTrack] = useState<string | null>(null);
  const [slipOrder, setSlipOrder] = useState<any | null>(null);
  const [highlightRef, setHighlightRef] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLElement>>(new Map());

  const insights = useMemo(() => computeInsights(orders), [orders]);
  const myEmail = (currentAdminEmail || '').toLowerCase();
  const assigneeEmail = (adminEmail || '').toLowerCase();

  const filteredOrders = useMemo(() => {
    const q = orderQuery.trim().toLowerCase();
    return orders.filter((order) => {
      const status = order.status || '';
      if (orderFilter === 'pending' && !isPendingStatus(status)) return false;
      if (orderFilter === 'completed' && !isCompletedStatus(status)) return false;
      if (orderFilter === 'cancelled' && !isCancelledStatus(status)) return false;
      if (!q) return true;
      const hay = [
        order.ref,
        order.trackingNumber,
        order.tracking_number,
        ...cartItems(order).flatMap((item) => [
          item?.productName,
          item?.name,
          item?.size,
        ]),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [orders, orderQuery, orderFilter]);

  useEffect(() => {
    if (!focusOrderRef) return;
    const clean = focusOrderRef.replace(/^#/, '').trim();
    setOrderFilter('all');
    setOrderQuery(clean);
    setHighlightRef(clean);
    onFocusHandled?.();

    const scrollTimer = window.setTimeout(() => {
      const key = clean.toUpperCase();
      const el =
        cardRefs.current.get(key) ||
        [...cardRefs.current.entries()].find(([k]) => k.toUpperCase() === key)?.[1];
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 120);

    const clearTimer = window.setTimeout(() => setHighlightRef(null), 2800);
    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(clearTimer);
    };
  }, [focusOrderRef, orders, onFocusHandled]);

  const copyTracking = async (tracking: string) => {
    try {
      await navigator.clipboard.writeText(tracking);
      setCopiedTrack(tracking);
      window.setTimeout(() => setCopiedTrack(null), 1500);
    } catch {
      /* ignore */
    }
  };

  const transferTargets = transferAdmins.filter(
    (a) => a.email.toLowerCase() !== assigneeEmail
  );

  return (
    <aside className="flex w-[320px] shrink-0 flex-col overflow-hidden border-l border-slate-200 bg-slate-50 dark:border-white/5 dark:bg-[#0c1220]">
      {/* Customer header */}
      <div className="border-b border-slate-200 px-3 py-3 dark:border-white/5">
        <p className="text-[0.7rem] font-semibold tracking-wide text-muted-foreground uppercase">
          ข้อมูลลูกค้า
        </p>
        <div className="mt-2 flex items-start gap-2.5">
          <Avatar className="size-10 shrink-0">
            {customerAvatar ? <AvatarImage src={customerAvatar} alt={customerName} /> : null}
            <AvatarFallback className="bg-blue-100 text-sm font-semibold text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
              {(customerName || '?').slice(0, 1)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{customerName}</p>
            <p className="truncate text-[0.7rem] text-muted-foreground">{customerEmail}</p>
          </div>
        </div>
        {insights.badges.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {insights.badges.map((b) => (
              <Badge key={b.key} className={cn('text-[0.65rem] font-medium', b.className)}>
                {b.label}
              </Badge>
            ))}
          </div>
        )}
        {orders.length > 0 && (
          <div className="mt-2 grid grid-cols-2 gap-1.5 text-[0.65rem]">
            <div className="rounded-md bg-white px-2 py-1.5 ring-1 ring-slate-200 dark:bg-white/5 dark:ring-white/10">
              <p className="text-muted-foreground">ยอดซื้อสะสม</p>
              <p className="font-semibold text-foreground">฿{insights.spent.toLocaleString()}</p>
            </div>
            <div className="rounded-md bg-white px-2 py-1.5 ring-1 ring-slate-200 dark:bg-white/5 dark:ring-white/10">
              <p className="text-muted-foreground">อัตราสำเร็จ</p>
              <p className="font-semibold text-foreground">{insights.completionRate}%</p>
            </div>
          </div>
        )}
      </div>

      {/* Case status */}
      <div className="space-y-2 border-b border-slate-200 px-3 py-3 dark:border-white/5">
        <p className="text-[0.65rem] font-medium text-muted-foreground">สถานะเคส</p>
        <div className="flex flex-wrap gap-1.5">
          <Badge
            className={cn(
              'cursor-default text-[0.65rem]',
              chatStatus === 'pending'
                ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'
                : 'bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-muted-foreground'
            )}
          >
            รอรับ
          </Badge>
          <Badge
            className={cn(
              'cursor-default text-[0.65rem]',
              chatStatus === 'active'
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'
                : 'bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-muted-foreground'
            )}
          >
            กำลังดำเนินการ
          </Badge>
          <Badge
            className={cn(
              'cursor-default text-[0.65rem]',
              chatStatus === 'closed'
                ? 'bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300'
                : 'bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-muted-foreground'
            )}
          >
            ปิดเคส
          </Badge>
        </div>
        <p className="text-[0.7rem] text-muted-foreground">
          ผู้ดูแล:{' '}
          <span className="font-medium text-foreground">
            {chatStatus === 'pending' ? 'ยังไม่มี' : adminName || adminEmail || '—'}
          </span>
        </p>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {chatStatus === 'pending' && (
            <Button size="sm" className="h-8 bg-emerald-600 text-xs hover:bg-emerald-700" onClick={onAccept}>
              + รับเคสนี้
            </Button>
          )}
          {chatStatus === 'active' && assigneeEmail && assigneeEmail !== myEmail && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 border-blue-200 text-xs text-blue-700 hover:bg-blue-50 dark:border-blue-500/30 dark:text-blue-300"
              onClick={onTakeOver}
            >
              โอนเคสมาให้ฉัน
            </Button>
          )}
          {chatStatus === 'active' && !assigneeEmail && (
            <Button size="sm" className="h-8 bg-emerald-600 text-xs hover:bg-emerald-700" onClick={onTakeOver}>
              + รับเคสนี้
            </Button>
          )}
          {chatStatus === 'active' && assigneeEmail === myEmail && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs ring-1 ring-slate-200 dark:ring-white/10"
              onClick={onCloseCase}
            >
              ปิดเคส
            </Button>
          )}
        </div>

        {transferTargets.length > 0 && (chatStatus === 'pending' || chatStatus === 'active') && (
          <div className="space-y-2 rounded-lg bg-white p-2.5 ring-1 ring-slate-200 dark:bg-[#111827] dark:ring-white/10">
            <p className="flex items-center gap-1 text-[0.65rem] font-medium text-muted-foreground">
              <UserRoundCog className="size-3.5" />
              โอนให้แอดมินคนอื่น
            </p>
            <Select value={transferToEmail || undefined} onValueChange={onTransferToEmailChange}>
              <SelectTrigger className="h-9 w-full text-xs">
                <SelectValue placeholder="เลือกแอดมิน..." />
              </SelectTrigger>
              <SelectContent>
                {transferTargets.map((admin) => (
                  <SelectItem key={admin.email} value={admin.email} className="text-xs">
                    <span className="font-medium">{admin.name}</span>
                    <span className="ml-1.5 text-muted-foreground">{admin.email}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              className="h-8 w-full bg-blue-600 text-xs hover:bg-blue-700"
              disabled={!transferToEmail || transferring}
              onClick={onTransfer}
            >
              {transferring ? 'กำลังโอน...' : 'โอนเคส'}
            </Button>
          </div>
        )}
      </div>

      {/* Orders */}
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="shrink-0 space-y-2 border-b border-slate-200 px-3 py-2.5 dark:border-white/5">
          <div className="flex items-center justify-between">
            <p className="text-[0.65rem] font-medium text-muted-foreground">ค้นหาออเดอร์ลูกค้า</p>
            <Button
              variant="ghost"
              size="icon-xs"
              className="size-6 text-muted-foreground"
              onClick={onRefreshOrders}
              disabled={loadingOrders}
            >
              {loadingOrders ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
            </Button>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={orderQuery}
              onChange={(e) => setOrderQuery(e.target.value)}
              placeholder="เลข Order / สินค้า / Track..."
              className="h-9 border-slate-200 bg-white pl-8 text-xs dark:border-white/10 dark:bg-[#111827]"
            />
          </div>
          <div className="flex gap-1 overflow-x-auto [scrollbar-width:none]">
            {(
              [
                ['all', 'ทั้งหมด'],
                ['pending', 'รอดำเนินการ'],
                ['completed', 'สำเร็จ'],
                ['cancelled', 'ยกเลิก'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setOrderFilter(id)}
                className={cn(
                  'shrink-0 rounded-full px-2.5 py-1 text-[0.65rem] font-medium transition',
                  orderFilter === id
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100 dark:bg-white/5 dark:text-muted-foreground dark:ring-white/10'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-2.5">
          {loadingOrders ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : filteredOrders.length === 0 ? (
            <p className="py-6 text-center text-[0.7rem] text-muted-foreground">
              {orders.length === 0 ? 'ไม่พบออเดอร์' : 'ไม่พบออเดอร์ตามเงื่อนไข'}
            </p>
          ) : (
            <ul className="space-y-2.5">
              {filteredOrders.map((order) => {
                const ref = String(order.ref || '');
                const tracking = order.trackingNumber || order.tracking_number || '';
                const items = cartItems(order);
                const date = orderDate(order);
                const focused =
                  highlightRef &&
                  ref.replace(/^#/, '').toUpperCase() ===
                    highlightRef.replace(/^#/, '').toUpperCase();
                return (
                  <li
                    key={ref || order.id}
                    ref={(node) => {
                      if (node && ref) cardRefs.current.set(ref.toUpperCase(), node);
                    }}
                    className={cn(
                      'rounded-xl bg-white p-2.5 ring-1 ring-slate-200 transition dark:bg-[#111827] dark:ring-white/10',
                      focused && 'ring-2 ring-blue-500 shadow-[0_0_0_3px_rgba(37,99,235,0.2)]'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-mono text-[0.75rem] font-semibold text-emerald-700 dark:text-emerald-400">
                          #{ref}
                        </p>
                        <p className="text-[0.65rem] text-muted-foreground">
                          {date
                            ? date.toLocaleDateString('th-TH', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })
                            : '—'}
                        </p>
                      </div>
                      <Badge className={cn('shrink-0 text-[0.6rem]', getOrderStatusBadgeClass(order.status))}>
                        {getOrderStatusLabel(order.status)}
                      </Badge>
                    </div>

                    {items.length > 0 ? (
                      <ul className="mt-2 space-y-1">
                        {items.slice(0, 3).map((item, idx) => (
                          <li key={idx} className="truncate text-[0.7rem] text-slate-700 dark:text-foreground/90">
                            · {itemLabel(item)}
                          </li>
                        ))}
                        {items.length > 3 && (
                          <li className="text-[0.65rem] text-muted-foreground">+{items.length - 3} รายการ</li>
                        )}
                      </ul>
                    ) : (
                      <p className="mt-2 text-[0.7rem] text-muted-foreground">ไม่มีรายการสินค้า</p>
                    )}

                    <p className="mt-1.5 text-[0.7rem] font-medium">
                      ยอดรวม: ฿{orderAmount(order).toLocaleString()}
                    </p>

                    {tracking ? (
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <p className="min-w-0 flex-1 truncate font-mono text-[0.65rem] text-slate-600 dark:text-muted-foreground">
                          Track: {tracking}
                        </p>
                        <Button
                          type="button"
                          size="icon-xs"
                          variant="ghost"
                          className="size-7 shrink-0"
                          title="คัดลอกเลข Track"
                          onClick={() => void copyTracking(String(tracking))}
                        >
                          <Copy className="size-3.5" />
                        </Button>
                        {copiedTrack === tracking && (
                          <span className="text-[0.6rem] text-emerald-600">คัดลอกแล้ว</span>
                        )}
                      </div>
                    ) : null}

                    <div className="mt-2 flex flex-wrap gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1 px-2 text-[0.65rem]"
                        disabled={!canSendToChat}
                        onClick={() => onSendTrackingUpdate(order)}
                        title="ส่งสรุปสถานะ/Tracking เข้าแชต"
                      >
                        <Send className="size-3" />
                        ส่งสถานะเข้าแชต
                      </Button>
                      {hasSlip(order) && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1 px-2 text-[0.65rem]"
                          onClick={() => setSlipOrder(order)}
                        >
                          <ImageIcon className="size-3" />
                          ดูสลิป
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 gap-1 px-2 text-[0.65rem]"
                        onClick={() => window.open(`/admin/orders?ref=${encodeURIComponent(ref)}`, '_blank')}
                      >
                        <ExternalLink className="size-3" />
                        รายละเอียด
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="h-7 gap-1 bg-emerald-600 px-2 text-[0.65rem] hover:bg-emerald-700"
                        disabled={!canSendToChat}
                        onClick={() => onSendOrderSummary(order)}
                      >
                        <Send className="size-3" />
                        ส่งออเดอร์
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="border-t border-slate-200 px-3 py-3 dark:border-white/5">
        <label className="mb-1.5 flex items-center gap-1 text-[0.65rem] font-medium text-muted-foreground">
          <StickyNote className="size-3" />
          โน้ตแอดมิน (เฉพาะเครื่องนี้)
        </label>
        <Textarea
          rows={3}
          value={adminNote}
          onChange={(e) => onAdminNoteChange(e.target.value)}
          placeholder="จดบันทึกสั้นๆ..."
          className="min-h-[72px] resize-none border-slate-200 bg-white text-xs dark:border-white/10 dark:bg-[#111827]"
        />
      </div>

      <Dialog open={Boolean(slipOrder)} onOpenChange={(open) => !open && setSlipOrder(null)}>
        <DialogContent className="max-w-md bg-card">
          <DialogHeader>
            <DialogTitle>สลิปโอนเงิน #{slipOrder?.ref}</DialogTitle>
          </DialogHeader>
          {slipOrder && slipSrc(slipOrder) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={slipSrc(slipOrder)!}
              alt={`Slip ${slipOrder.ref}`}
              className="max-h-[70vh] w-full rounded-lg object-contain"
            />
          ) : (
            <p className="text-sm text-muted-foreground">ไม่พบรูปสลิป</p>
          )}
        </DialogContent>
      </Dialog>
    </aside>
  );
}

/** Turn #ORD-xxx mentions in chat text into clickable links */
export function ChatTextWithOrderLinks({
  text,
  className,
  onOrderClick,
}: {
  text: string;
  className?: string;
  onOrderClick: (ref: string) => void;
}) {
  const nodes = useMemo(() => {
    if (!text) return null;
    const re = /(#?ORD-[A-Z0-9]+)/gi;
    const parts: ReactNode[] = [];
    let last = 0;
    let match: RegExpExecArray | null;
    let i = 0;
    while ((match = re.exec(text)) !== null) {
      if (match.index > last) {
        parts.push(text.slice(last, match.index));
      }
      const raw = match[1];
      const ref = raw.replace(/^#/, '');
      parts.push(
        <button
          key={`ord-${i++}-${match.index}`}
          type="button"
          className="font-mono font-semibold text-blue-700 underline decoration-blue-400/60 underline-offset-2 hover:text-blue-800 dark:text-sky-300 dark:hover:text-sky-200"
          onClick={(e) => {
            e.stopPropagation();
            onOrderClick(ref);
          }}
        >
          {raw.startsWith('#') ? raw : `#${raw}`}
        </button>
      );
      last = match.index + raw.length;
    }
    if (last < text.length) parts.push(text.slice(last));
    return parts;
  }, [text, onOrderClick]);

  return (
    <p className={cn('whitespace-pre-wrap break-words text-[0.9rem] leading-relaxed', className)}>
      {nodes}
    </p>
  );
}
