import React, { useMemo } from 'react';
import {
  ArrowRight,
  Banknote,
  CircleCheck,
  Clock,
  Flame,
  PackageCheck,
  Radio,
  Receipt,
  RefreshCw,
  Ruler,
  Shirt,
  ShoppingBag,
  Store,
  Timer,
  TrendingUp,
  Truck,
} from 'lucide-react';

import { ShopConfig } from '@/lib/config';
import { STATUS_THEME } from '@/lib/adminTheme';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState, Panel, StatCard, StatusPill, statusLabel } from '@/components/admin/admin-ui';
import { useTranslation } from '@/hooks/useTranslation';

interface DashboardOrderItem {
  name?: string;
  id?: string;
  qty?: number;
  total?: number;
  price?: number;
  size?: string;
  quantity?: number;
  isLongSleeve?: boolean;
  options?: {
    isLongSleeve?: boolean;
  };
}

interface DashboardAdminOrder {
  ref: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  amount: number;
  status: string;
  date?: string;
  raw?: unknown;
  slip?: unknown;
  cart?: DashboardOrderItem[] | string;
  items?: DashboardOrderItem[];
  trackingNumber?: string;
  shopId?: string;
  shopSlug?: string;
}

interface DashboardViewProps {
  shopOrders: DashboardAdminOrder[];
  orders: DashboardAdminOrder[];
  session: { user?: { name?: string | null; email?: string | null } } | null | undefined;
  isShopMode: boolean;
  myShops: { id: string; name: string }[];
  selectedShopId: string | undefined;
  lastSavedTime: Date | null;
  realtimeConnected: boolean;
  activeTab: number;
  setActiveTab: (tab: number) => void;
  setSearchTerm: (term: string) => void;
  config: ShopConfig;
  sheetSyncing: boolean;
  triggerSheetSync: (action: 'sync' | 'create') => void;
}

const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL', '7XL', '8XL', '9XL', '10XL'];
const sizeIndex = (size: string) => {
  // Match the longest size label first so "2XL" is not read as "XL"
  const upper = size?.toUpperCase() || '';
  let best = -1;
  let bestLen = 0;
  SIZE_ORDER.forEach((s, i) => {
    if (upper.includes(s) && s.length > bestLen) {
      best = i;
      bestLen = s.length;
    }
  });
  return best === -1 ? 999 : best;
};

const PENDING = ['WAITING_PAYMENT', 'PENDING', 'PENDING_PAYMENT', 'AWAITING_PAYMENT'];

const localDayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

const baht = (n: number) => `฿${(Number(n) || 0).toLocaleString()}`;
const bahtShort = (n: number) => (n >= 1000 ? `฿${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `฿${n.toLocaleString()}`);

function getCart(order: DashboardAdminOrder): DashboardOrderItem[] {
  if (typeof order.cart === 'string') {
    try {
      return JSON.parse(order.cart || '[]');
    } catch {
      return [];
    }
  }
  return order.cart || [];
}

export const DashboardView = React.memo(function DashboardView({
  shopOrders,
  session,
  isShopMode,
  myShops,
  selectedShopId,
  lastSavedTime,
  realtimeConnected,
  setActiveTab,
  setSearchTerm,
  config,
  sheetSyncing,
  triggerSheetSync,
}: DashboardViewProps) {
  const { lang } = useTranslation();
  const en = lang === 'en';
  const locale = en ? 'en-US' : 'th-TH';

  const stats = useMemo(() => {
    const valid = shopOrders.filter((o) => o.status !== 'CANCELLED');
    const count = (pred: (s: string) => boolean) => shopOrders.filter((o) => pred(o.status)).length;
    const todayKey = localDayKey(new Date());
    const todayOrders = valid.filter((o) => {
      const d = new Date(o.date || '');
      return !Number.isNaN(d.getTime()) && localDayKey(d) === todayKey;
    });
    return {
      valid,
      totalSales: valid.reduce((s, o) => s + (Number(o.amount) || 0), 0),
      todayCount: todayOrders.length,
      todaySales: todayOrders.reduce((s, o) => s + (Number(o.amount) || 0), 0),
      pending: count((s) => PENDING.includes(s)),
      paid: count((s) => s === 'PAID'),
      ready: count((s) => s === 'READY'),
      shipped: count((s) => s === 'SHIPPED'),
      completed: count((s) => s === 'COMPLETED'),
      cancelled: count((s) => s === 'CANCELLED'),
      refund: count((s) => s === 'REFUND_REQUESTED'),
    };
  }, [shopOrders]);

  // Last 7 days revenue (local time)
  const daily = useMemo(() => {
    const days: { key: string; label: string; weekday: string; revenue: number; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push({
        key: localDayKey(d),
        label: d.toLocaleDateString(locale, { day: 'numeric', month: 'short' }),
        weekday: d.toLocaleDateString(locale, { weekday: 'short' }),
        revenue: 0,
        count: 0,
      });
    }
    for (const o of stats.valid) {
      const d = new Date(o.date || '');
      if (Number.isNaN(d.getTime())) continue;
      const day = days.find((x) => x.key === localDayKey(d));
      if (day) {
        day.revenue += Number(o.amount) || 0;
        day.count += 1;
      }
    }
    return days;
  }, [stats.valid, locale]);
  const weekRevenue = daily.reduce((s, d) => s + d.revenue, 0);
  const weekOrders = daily.reduce((s, d) => s + d.count, 0);
  const maxDaily = Math.max(...daily.map((d) => d.revenue), 1);

  const bestSellers = useMemo(() => {
    const map: Record<string, { name: string; count: number; revenue: number }> = {};
    for (const order of stats.valid) {
      for (const item of getCart(order)) {
        const key = item.name || item.id || 'Unknown';
        if (!map[key]) map[key] = { name: key, count: 0, revenue: 0 };
        map[key].count += item.qty || 1;
        map[key].revenue += item.total || item.price || 0;
      }
    }
    return Object.values(map).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [stats.valid]);

  const production = useMemo(() => {
    const paid = shopOrders.filter((o) => o.status === 'PAID');
    const total: Record<string, number> = {};
    const long: Record<string, number> = {};
    const short: Record<string, number> = {};
    let items = 0;
    for (const o of paid) {
      const list = o.items || getCart(o);
      for (const item of list) {
        const size = item.size || (en ? 'N/A' : 'ไม่ระบุ');
        const qty = Number(item.quantity ?? item.qty ?? 1) || 1;
        const isLong = item.options?.isLongSleeve || item.isLongSleeve || false;
        items += qty;
        total[size] = (total[size] || 0) + qty;
        if (isLong) long[size] = (long[size] || 0) + qty;
        else short[size] = (short[size] || 0) + qty;
      }
    }
    const sizes = Object.keys(total).sort((a, b) => sizeIndex(a) - sizeIndex(b));
    return {
      paidCount: paid.length,
      items,
      sizes,
      total,
      long,
      short,
      totalLong: Object.values(long).reduce((a, b) => a + b, 0),
      totalShort: Object.values(short).reduce((a, b) => a + b, 0),
    };
  }, [shopOrders, en]);

  const recentOrders = useMemo(
    () =>
      [...shopOrders]
        .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())
        .slice(0, 6),
    [shopOrders],
  );

  const distribution = [
    { key: 'WAITING_PAYMENT', count: stats.pending },
    { key: 'PAID', count: stats.paid },
    { key: 'READY', count: stats.ready },
    { key: 'SHIPPED', count: stats.shipped },
    { key: 'COMPLETED', count: stats.completed },
    { key: 'REFUND_REQUESTED', count: stats.refund },
    { key: 'CANCELLED', count: stats.cancelled },
  ];
  const distTotal = distribution.reduce((s, d) => s + d.count, 0) || 1;

  const firstName = session?.user?.name?.split(' ')[0] || 'Admin';
  const shopName = isShopMode ? myShops.find((s) => s.id === selectedShopId)?.name : null;
  const hour = new Date().getHours();
  const greeting = en
    ? hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
    : hour < 12 ? 'สวัสดีตอนเช้า' : hour < 18 ? 'สวัสดีตอนบ่าย' : 'สวัสดีตอนเย็น';

  const goOrders = (term = '') => {
    setActiveTab(2);
    setSearchTerm(term);
  };

  const todo = [
    {
      count: stats.pending,
      label: en ? 'Awaiting payment' : 'รอชำระเงิน / ตรวจสลิป',
      icon: <Clock />,
      tone: 'text-warning dark:text-warning bg-warning/12',
    },
    {
      count: stats.paid,
      label: en ? 'Paid — prepare to ship' : 'ชำระแล้ว รอจัดเตรียม/จัดส่ง',
      icon: <PackageCheck />,
      tone: 'text-primary dark:text-primary bg-primary/12',
    },
    {
      count: stats.refund,
      label: en ? 'Refund requests' : 'คำขอคืนเงิน',
      icon: <RefreshCw />,
      tone: 'text-primary dark:text-primary bg-primary/12',
      tab: 13,
    },
  ].filter((t) => t.count > 0);

  return (
    <div className="flex flex-col gap-5">
      {/* ─── Greeting / status row ─── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-semibold">
            {greeting}, {firstName}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {shopName ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/12 px-2 py-0.5 font-medium text-primary dark:text-primary">
                <Store className="size-3" /> {shopName}
              </span>
            ) : null}
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium',
                realtimeConnected
                  ? 'bg-success/12 text-success dark:text-success'
                  : 'bg-warning/12 text-warning dark:text-warning',
              )}
            >
              {realtimeConnected ? <Radio className="size-3" /> : <Timer className="size-3" />}
              {realtimeConnected ? (en ? 'Live updates' : 'อัปเดตเรียลไทม์') : (en ? 'Polling' : 'รีเฟรชอัตโนมัติ')}
            </span>
            <span>
              {en ? 'Last update' : 'อัปเดตล่าสุด'}{' '}
              {lastSavedTime ? lastSavedTime.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : '—'}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={sheetSyncing}
            onClick={() => triggerSheetSync(config.sheetId ? 'sync' : 'create')}
          >
            <RefreshCw className={cn(sheetSyncing && 'animate-spin')} />
            {sheetSyncing
              ? (en ? 'Syncing…' : 'กำลังซิงก์…')
              : config.sheetId
                ? (en ? 'Sync Google Sheet' : 'ซิงก์ Google Sheet')
                : (en ? 'Create Google Sheet' : 'สร้าง Google Sheet')}
          </Button>
          <Button size="sm" onClick={() => goOrders()}>
            <Receipt />
            {en ? 'View orders' : 'ดูออเดอร์'}
          </Button>
        </div>
      </div>

      {/* ─── KPIs ─── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label={en ? 'Total sales' : 'ยอดขายรวม'}
          value={baht(stats.totalSales)}
          hint={en ? `${stats.valid.length} orders (excl. cancelled)` : `${stats.valid.length} ออเดอร์ (ไม่รวมยกเลิก)`}
          icon={<Banknote />}
          tone="success"
        />
        <StatCard
          label={en ? 'Today' : 'วันนี้'}
          value={baht(stats.todaySales)}
          hint={en ? `${stats.todayCount} new orders` : `${stats.todayCount} ออเดอร์ใหม่`}
          icon={<TrendingUp />}
          tone="info"
        />
        <StatCard
          label={en ? 'Awaiting payment' : 'รอชำระเงิน'}
          value={stats.pending.toLocaleString()}
          hint={en ? 'Check slips / follow up' : 'ตรวจสลิป / ติดตามลูกค้า'}
          icon={<Clock />}
          tone="warning"
          onClick={() => goOrders()}
          actionLabel={en ? 'Open orders' : 'เปิดหน้าออเดอร์'}
        />
        <StatCard
          label={en ? 'To ship' : 'รอจัดส่ง'}
          value={stats.paid.toLocaleString()}
          hint={en ? `${stats.shipped + stats.completed} delivered` : `ส่งแล้ว ${stats.shipped + stats.completed} รายการ`}
          icon={<Truck />}
          tone="violet"
          onClick={() => goOrders()}
          actionLabel={en ? 'Open orders' : 'เปิดหน้าออเดอร์'}
        />
      </div>

      {/* ─── To-do strip ─── */}
      {todo.length > 0 ? (
        <Panel
          title={en ? 'Needs your attention' : 'งานที่ต้องจัดการ'}
          icon={<CircleCheck />}
          bodyClassName="grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
        >
          {todo.map((t) => (
            <button
              key={t.label}
              type="button"
              onClick={() => (t.tab ? setActiveTab(t.tab) : goOrders())}
              className="group flex items-center gap-3 rounded-xl border border-border p-3 text-left transition-colors hover:border-primary/40 hover:bg-accent/40"
            >
              <span className={cn('grid size-9 shrink-0 place-items-center rounded-lg [&_svg]:size-[18px]', t.tone)}>
                {t.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-bold leading-tight tabular-nums">{t.count}</span>
                <span className="block truncate text-xs text-muted-foreground">{t.label}</span>
              </span>
              <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </button>
          ))}
        </Panel>
      ) : null}

      {/* ─── Revenue + distribution ─── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          title={en ? 'Revenue — last 7 days' : 'ยอดขาย 7 วันล่าสุด'}
          description={en ? `${baht(weekRevenue)} from ${weekOrders} orders` : `${baht(weekRevenue)} จาก ${weekOrders} ออเดอร์`}
          icon={<TrendingUp />}
        >
          <div className="flex h-44 items-end gap-2 pt-4">
            {daily.map((d, i) => {
              const isToday = i === daily.length - 1;
              return (
                <div key={d.key} className="group flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                  <span
                    className={cn(
                      'text-[0.65rem] font-semibold tabular-nums text-muted-foreground transition-opacity',
                      d.revenue > 0 ? 'opacity-100' : 'opacity-0',
                    )}
                  >
                    {bahtShort(d.revenue)}
                  </span>
                  <div
                    title={`${d.label}: ${baht(d.revenue)} · ${d.count} ${en ? 'orders' : 'ออเดอร์'}`}
                    className={cn(
                      'w-full max-w-12 rounded-md transition-[height] duration-500 ease-out',
                      d.revenue > 0
                        ? isToday
                          ? 'bg-primary'
                          : 'bg-primary/45 group-hover:bg-primary/70'
                        : 'bg-muted',
                    )}
                    style={{ height: `${Math.max((d.revenue / maxDaily) * 100, 3)}%` }}
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex gap-2 border-t border-border pt-2">
            {daily.map((d, i) => (
              <div key={d.key} className="flex-1 text-center">
                <p className={cn('text-[0.68rem]', i === daily.length - 1 ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
                  {d.weekday}
                </p>
                <p className="text-[0.62rem] text-muted-foreground/70">{d.count}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title={en ? 'Order status' : 'สถานะออเดอร์'} description={en ? `${shopOrders.length} orders total` : `ทั้งหมด ${shopOrders.length} ออเดอร์`} icon={<Receipt />}>
          <div className="mb-4 flex h-2.5 overflow-hidden rounded-full bg-muted">
            {distribution
              .filter((d) => d.count > 0)
              .map((d) => (
                <div
                  key={d.key}
                  title={`${statusLabel(d.key, lang)}: ${d.count}`}
                  style={{ width: `${(d.count / distTotal) * 100}%`, backgroundColor: (STATUS_THEME[d.key] || STATUS_THEME.PENDING).text }}
                />
              ))}
          </div>
          <ul className="flex flex-col gap-2">
            {distribution.map((d) => (
              <li key={d.key} className="flex items-center gap-2 text-sm">
                <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: (STATUS_THEME[d.key] || STATUS_THEME.PENDING).text }} />
                <span className="flex-1 truncate text-muted-foreground">{statusLabel(d.key, lang)}</span>
                <span className="font-semibold tabular-nums">{d.count}</span>
                <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">
                  {Math.round((d.count / distTotal) * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      {/* ─── Recent orders + best sellers ─── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          title={en ? 'Recent orders' : 'ออเดอร์ล่าสุด'}
          icon={<ShoppingBag />}
          flush
          action={
            <Button variant="ghost" size="sm" onClick={() => goOrders()}>
              {en ? 'View all' : 'ดูทั้งหมด'}
              <ArrowRight />
            </Button>
          }
        >
          {recentOrders.length === 0 ? (
            <EmptyState icon={<Receipt />} title={en ? 'No orders yet' : 'ยังไม่มีออเดอร์'} />
          ) : (
            <ul className="divide-y divide-border border-t border-border">
              {recentOrders.map((order) => (
                <li key={order.ref}>
                  <button
                    type="button"
                    onClick={() => goOrders(order.ref)}
                    className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-muted/50"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold uppercase text-muted-foreground">
                      {(order.name || '?').slice(0, 1)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{order.name || '—'}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        <span className="font-mono">#{order.ref.slice(-8)}</span>
                        {order.date
                          ? ` · ${new Date(order.date).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`
                          : ''}
                      </span>
                    </span>
                    <span className="hidden sm:block">
                      <StatusPill status={order.status} lang={lang} />
                    </span>
                    <span className="w-20 shrink-0 text-right text-sm font-semibold tabular-nums">
                      {baht(order.amount)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={en ? 'Best sellers' : 'สินค้าขายดี'} icon={<Flame />}>
          {bestSellers.length === 0 ? (
            <EmptyState icon={<Flame />} title={en ? 'No sales yet' : 'ยังไม่มียอดขาย'} className="py-6" />
          ) : (
            <ol className="flex flex-col gap-3.5">
              {bestSellers.map((p, i) => (
                <li key={p.name} className="flex items-center gap-3">
                  <span
                    className={cn(
                      'grid size-6 shrink-0 place-items-center rounded-md text-xs font-bold',
                      i === 0 ? 'bg-warning/15 text-warning dark:text-warning' : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-medium">{p.name}</span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {p.count} {en ? 'pcs' : 'ชิ้น'}
                      </span>
                    </span>
                    <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-muted">
                      <span
                        className="block h-full rounded-full bg-primary/70"
                        style={{ width: `${(p.count / bestSellers[0].count) * 100}%` }}
                      />
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>

      {/* ─── Production summary ─── */}
      <Panel
        title={en ? 'Production summary (paid orders)' : 'สรุปยอดผลิต (ออเดอร์ที่ชำระแล้ว)'}
        description={
          en
            ? `${production.paidCount} orders · ${production.items} items · ${production.sizes.length} sizes`
            : `${production.paidCount} ออเดอร์ · ${production.items} ตัว · ${production.sizes.length} ไซส์`
        }
        icon={<Shirt />}
        flush
      >
        {production.sizes.length === 0 ? (
          <EmptyState icon={<Ruler />} title={en ? 'No paid orders yet' : 'ยังไม่มีออเดอร์ที่ชำระแล้ว'} />
        ) : (
          <div className="overflow-x-auto border-t border-border">
            <Table className="min-w-[420px]">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-5">{en ? 'Size' : 'ไซส์'}</TableHead>
                  <TableHead className="text-right">{en ? 'Short sleeve' : 'แขนสั้น'}</TableHead>
                  <TableHead className="text-right">{en ? 'Long sleeve' : 'แขนยาว'}</TableHead>
                  <TableHead className="pr-5 text-right">{en ? 'Total' : 'รวม'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {production.sizes.map((size) => (
                  <TableRow key={size}>
                    <TableCell className="pl-5 font-semibold">{size}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{production.short[size] || 0}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{production.long[size] || 0}</TableCell>
                    <TableCell className="pr-5 text-right font-semibold tabular-nums">{production.total[size]}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50 font-semibold hover:bg-muted/50">
                  <TableCell className="pl-5">{en ? 'Total' : 'รวมทั้งหมด'}</TableCell>
                  <TableCell className="text-right tabular-nums">{production.totalShort}</TableCell>
                  <TableCell className="text-right tabular-nums">{production.totalLong}</TableCell>
                  <TableCell className="pr-5 text-right tabular-nums text-primary">{production.items}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>
    </div>
  );
});
