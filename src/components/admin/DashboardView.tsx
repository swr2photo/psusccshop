import React from 'react';
import {
  DollarSign as AttachMoney,
  CalendarRange as DateRange,
  CircleCheck as CheckCircle,
  Truck as LocalShipping,
  Hand as WavingHand,
  Store,
  Radio,
  Timer,
  TrendingUp,
  BarChart3,
  Flame as Fire,
  Receipt,
  Zap as Bolt,
  Package as Inventory,
  Ruler,
  Target,
  ShoppingBag as LocalMall,
} from 'lucide-react';

import { ShopConfig } from '@/lib/config';
import { STATUS_THEME } from '@/lib/adminTheme';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';

const Shirt = ({ size, color }: { size?: number; color?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size || 24}
    height={size || 24}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color || 'currentColor'}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20.38 3.46L16 6.14V4a2 2 0 0 0-2-2H10a2 2 0 0 0-2 2v2.14L3.62 3.46a2 2 0 0 0-2.38.38l-1 1a2 2 0 0 0 .38 2.38L4 9.18V20a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9.18l3.38-2.96a2 2 0 0 0 .38-2.38l-1-1a2 2 0 0 0-2.38-.38z" />
  </svg>
);

interface DashboardOrderItem {
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
  slip?: {
    uploadedAt?: string;
    base64?: string;
    imageUrl?: string;
    fileName?: string;
    mime?: string;
    slipData?: {
      transRef?: string;
      transDate?: string;
      transTime?: string;
      amount?: number;
      senderName?: string;
      senderFullName?: string;
      senderDisplayName?: string;
      senderBank?: string;
      senderAccount?: string;
      receiverName?: string;
      receiverDisplayName?: string;
      receiverBank?: string;
      receiverAccount?: string;
    };
  };
  cart?: DashboardOrderItem[];
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

const glassCardClass = cn(
  'admin-glass gap-0 overflow-hidden border-[var(--border)] bg-[var(--card)] py-0 shadow-none',
);

const secondaryButtonClass = cn(
  'h-auto w-full justify-start gap-3 rounded-xl border-[var(--border)] bg-[var(--card)] py-3 font-semibold text-[var(--muted-foreground)] hover:bg-[var(--surface-2)]',
);

const gradientButtonClass = cn(
  'h-auto w-full justify-start gap-3 rounded-xl border-0 bg-gradient-to-br from-indigo-500 to-violet-500 py-3 font-bold text-white shadow-[0_4px_14px_rgba(99,102,241,0.35)] hover:from-indigo-600 hover:to-violet-600 hover:shadow-[0_6px_20px_rgba(99,102,241,0.45)] disabled:opacity-50',
);

export const DashboardView = React.memo(function DashboardView({
  shopOrders,
  orders,
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
  const validOrders = shopOrders.filter(o => o.status !== 'CANCELLED');
  const totalSales = validOrders.reduce((sum, o) => sum + (Number(o.amount) || 0), 0);
  const pendingOrders = shopOrders.filter(o => ['WAITING_PAYMENT', 'PENDING'].includes(o.status)).length;
  const paidOrders = shopOrders.filter(o => o.status === 'PAID').length;
  const readyOrders = shopOrders.filter(o => ['READY', 'SHIPPED'].includes(o.status)).length;
  const completedOrders = shopOrders.filter(o => o.status === 'COMPLETED').length;
  const cancelledOrders = shopOrders.filter(o => o.status === 'CANCELLED').length;

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
    <div className="flex flex-col gap-6">
      {/* Welcome Header — Aurora + Grid Pattern */}
      <div
        className={cn(
          'aurora-bg grid-pattern noise-overlay relative overflow-hidden rounded-[20px] border border-indigo-500/15 p-6',
        )}
      >
        <h2 className="relative z-[2] mb-1 flex items-center gap-2 text-[1.4rem] font-extrabold text-[var(--foreground)]">
          <WavingHand size={22} color="#fbbf24" />
          ยินดีต้อนรับ, {session?.user?.name?.split(' ')[0] || 'Admin'}
        </h2>
        {isShopMode && (
          <Badge
            className="relative z-[2] mb-2 rounded-[10px] border-transparent bg-violet-500/20 font-bold text-violet-300"
          >
            <Store size={14} />
            กำลังดูร้าน: {myShops.find(s => s.id === selectedShopId)?.name || 'ร้านค้าย่อย'}
          </Badge>
        )}
        <div className="relative z-[2] flex flex-wrap items-center gap-4">
          <p className="text-[0.9rem] text-[var(--muted-foreground)]">
            จัดการร้านค้าและออเดอร์ของคุณได้ที่นี่ • อัพเดทล่าสุด:{' '}
            {lastSavedTime?.toLocaleTimeString('th-TH') || 'กำลังโหลด...'}
          </p>
          <div
            className={cn(
              'flex items-center gap-1 rounded-full px-3 py-1',
              realtimeConnected
                ? 'border border-emerald-500/30 bg-emerald-500/15'
                : 'border border-amber-500/30 bg-amber-500/15',
            )}
          >
            <span
              className={cn(
                'size-2 rounded-full',
                realtimeConnected ? 'animate-pulse bg-[var(--success)]' : 'bg-amber-500',
              )}
            />
            <span
              className={cn(
                'flex items-center gap-1 text-[0.7rem] font-semibold',
                realtimeConnected ? 'text-[var(--success)]' : 'text-amber-500',
              )}
            >
              {realtimeConnected ? (
                <>
                  <Radio size={10} /> Live
                </>
              ) : (
                <>
                  <Timer size={10} /> Polling
                </>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Stats Grid - Modern Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {statsData.map((stat, idx) => (
          <div
            key={idx}
            className={cn(
              'admin-glass relative overflow-hidden rounded-[18px] p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(0,0,0,0.3)]',
            )}
          >
            <div
              className="absolute -right-5 -top-5 size-20 rounded-full opacity-15 blur-[20px]"
              style={{ background: stat.gradient }}
            />

            <div className="relative mb-4 flex items-start justify-between">
              <div
                className="grid size-12 place-items-center rounded-[14px]"
                style={{ backgroundColor: stat.iconBg }}
              >
                {stat.icon}
              </div>
            </div>

            <p className="mb-1 text-[1.75rem] font-black leading-none text-[var(--foreground)]">
              {stat.value}
            </p>
            <p className="text-[0.8rem] font-semibold text-[var(--muted-foreground)]">{stat.label}</p>
            <p className="mt-1 text-[0.7rem] text-[var(--muted-foreground)]">{stat.subtitle}</p>
          </div>
        ))}
      </div>

      {/* ===== Analytics Charts ===== */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[2fr_1fr]">
        {/* Revenue Trend - Last 7 days */}
        <Card className={cn(glassCardClass, 'p-0')}>
          <CardHeader className="px-6 pt-6 pb-0">
            <CardTitle className="flex items-center gap-2 text-base font-bold text-[var(--foreground)]">
              <TrendingUp size={20} color="#34c759" />
              Revenue Trend (7 Days)
            </CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            {(() => {
              const days = 7;
              const dailyData: { date: string; revenue: number; count: number }[] = [];
              for (let i = days - 1; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const dateStr = d.toISOString().split('T')[0];
                const dayLabel = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
                const dayOrders = validOrders.filter(o => {
                  const od = new Date(o.date || '');
                  if (Number.isNaN(od.getTime())) return false;
                  return od.toISOString().split('T')[0] === dateStr;
                });
                dailyData.push({
                  date: dayLabel,
                  revenue: dayOrders.reduce((s, o) => s + (Number(o.amount) || 0), 0),
                  count: dayOrders.length,
                });
              }
              const maxRev = Math.max(...dailyData.map(d => d.revenue), 1);
              return (
                <div>
                  <div className="mb-2 flex h-[120px] items-end gap-1">
                    {dailyData.map((d, i) => (
                      <div key={i} className="flex flex-1 flex-col items-center gap-1">
                        <span
                          className={cn(
                            'text-[0.55rem] font-bold text-[var(--success)]',
                            d.revenue > 0 ? 'opacity-100' : 'opacity-0',
                          )}
                        >
                          ฿{d.revenue >= 1000 ? `${(d.revenue / 1000).toFixed(1)}k` : d.revenue.toLocaleString()}
                        </span>
                        <div
                          className="w-full min-h-1 rounded-t-md rounded-b-sm transition-[height] duration-500 ease-out"
                          style={{
                            height: `${Math.max((d.revenue / maxRev) * 100, 3)}%`,
                            background:
                              d.revenue > 0
                                ? 'linear-gradient(180deg, #34c759, #059669)'
                                : 'rgba(100,116,139,0.15)',
                          }}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-1">
                    {dailyData.map((d, i) => (
                      <div key={i} className="flex-1 text-center">
                        <p className="text-[0.55rem] text-[var(--muted-foreground)]">{d.date}</p>
                        <p className="text-[0.55rem] text-[var(--muted-foreground)] opacity-60">
                          {d.count} orders
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>

        {/* Order Status Donut Chart */}
        <Card className={cn(glassCardClass, 'p-0')}>
          <CardHeader className="px-6 pt-6 pb-0">
            <CardTitle className="flex items-center gap-2 text-base font-bold text-[var(--foreground)]">
              <BarChart3 size={20} color="#a5b4fc" />
              Order Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            {(() => {
              const total = orders.length || 1;
              const segments = [
                { label: 'Pending', count: pendingOrders, color: '#ff9f0a' },
                { label: 'Paid', count: paidOrders, color: '#34c759' },
                { label: 'Ready/Shipped', count: readyOrders, color: '#2997ff' },
                { label: 'Completed', count: completedOrders, color: '#30d158' },
                { label: 'Cancelled', count: cancelledOrders, color: '#ff453a' },
              ].filter(s => s.count > 0);

              let accumulated = 0;
              const gradientParts = segments.map(s => {
                const start = accumulated;
                const end = accumulated + (s.count / total) * 360;
                accumulated = end;
                return `${s.color} ${start}deg ${end}deg`;
              });

              return (
                <div className="flex flex-col items-center gap-4">
                  <div
                    className="relative size-[120px] rounded-full"
                    style={{ background: `conic-gradient(${gradientParts.join(', ')})` }}
                  >
                    <div className="absolute inset-[25%] rounded-full bg-[var(--surface)]" />
                    <div className="absolute inset-0 z-[1] flex items-center justify-center">
                      <span className="text-[1.2rem] font-extrabold text-[var(--foreground)]">{total}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    {segments.map(s => (
                      <div key={s.label} className="flex items-center gap-1">
                        <span className="size-2 rounded-full" style={{ backgroundColor: s.color }} />
                        <span className="text-[0.6rem] text-[var(--muted-foreground)]">
                          {s.label} ({s.count})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      </div>

      {/* ===== Best Sellers ===== */}
      <Card className={cn(glassCardClass, 'p-0')}>
        <CardHeader className="px-6 pt-6 pb-0">
          <CardTitle className="flex items-center gap-2 text-base font-bold text-[var(--foreground)]">
            <Fire size={20} color="#ff9f0a" />
            Best Selling Products
          </CardTitle>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          {(() => {
            const productSales: Record<string, { name: string; count: number; revenue: number }> = {};
            for (const order of validOrders) {
              const cart =
                typeof order.cart === 'string' ? JSON.parse(order.cart || '[]') : order.cart || [];
              for (const item of cart) {
                const key = item.name || item.id || 'Unknown';
                if (!productSales[key]) productSales[key] = { name: key, count: 0, revenue: 0 };
                productSales[key].count += item.qty || 1;
                productSales[key].revenue += item.total || item.price || 0;
              }
            }
            const sorted = Object.values(productSales).sort((a, b) => b.count - a.count).slice(0, 5);
            if (sorted.length === 0) {
              return (
                <p className="text-[0.85rem] text-[var(--muted-foreground)]">No sales data yet</p>
              );
            }
            const maxCount = sorted[0].count;
            return (
              <div className="flex flex-col gap-2">
                {sorted.map((product, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <span
                      className={cn(
                        'w-5 text-[0.75rem] font-extrabold',
                        idx === 0 ? 'text-amber-500' : 'text-[var(--muted-foreground)]',
                      )}
                    >
                      #{idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[0.8rem] font-semibold text-[var(--foreground)]">
                        {product.name}
                      </p>
                      <div className="relative mt-1 h-1 overflow-hidden rounded-sm bg-slate-500/10">
                        <div
                          className="absolute inset-y-0 left-0 rounded-sm bg-gradient-to-r from-blue-600 to-blue-400 transition-[width] duration-500 ease-out"
                          style={{ width: `${(product.count / maxCount) * 100}%` }}
                        />
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[0.75rem] font-bold text-[var(--foreground)]">
                        {product.count} pcs
                      </p>
                      <p className="text-[0.6rem] text-[var(--success)]">
                        ฿{product.revenue.toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Quick Status Overview */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Order Status Breakdown */}
        <Card className={cn(glassCardClass, 'p-0')}>
          <CardHeader className="px-6 pt-6 pb-0">
            <CardTitle className="flex items-center gap-2 text-base font-bold text-[var(--foreground)]">
              <Receipt size={20} color="#a5b4fc" />
              สถานะออเดอร์
            </CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="flex flex-col gap-3">
              {[
                { status: 'WAITING_PAYMENT', count: pendingOrders },
                { status: 'PAID', count: paidOrders },
                { status: 'READY', count: readyOrders },
                { status: 'COMPLETED', count: completedOrders },
                { status: 'CANCELLED', count: cancelledOrders },
              ].map(item => {
                const theme = STATUS_THEME[item.status] || STATUS_THEME.PENDING;
                const total = orders.length || 1;
                const percent = Math.round((item.count / total) * 100);
                return (
                  <div key={item.status} className="flex items-center gap-4">
                    <div
                      className="w-[100px] shrink-0 rounded-lg px-3 py-1 text-center"
                      style={{
                        backgroundColor: theme.bg,
                        border: `1px solid ${theme.border}`,
                      }}
                    >
                      <span className="text-[0.7rem] font-bold" style={{ color: theme.text }}>
                        {item.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="h-2 flex-1 overflow-hidden rounded bg-[var(--glass-bg)]">
                      <div
                        className="h-full rounded transition-[width] duration-500 ease-out"
                        style={{
                          width: `${percent}%`,
                          backgroundColor: theme.text.replace('1)', '0.8)'),
                        }}
                      />
                    </div>
                    <span
                      className="min-w-[30px] text-right text-[0.85rem] font-bold"
                      style={{ color: theme.text }}
                    >
                      {item.count}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className={cn(glassCardClass, 'p-0')}>
          <CardHeader className="px-6 pt-6 pb-0">
            <CardTitle className="flex items-center gap-2 text-base font-bold text-[var(--foreground)]">
              <Bolt size={20} color="#fbbf24" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 px-6 pb-6">
            <Button variant="outline" className={secondaryButtonClass} onClick={() => setActiveTab(1)}>
              <Store size={20} />
              จัดการสินค้า ({config.products?.length || 0} รายการ)
            </Button>
            <Button variant="outline" className={secondaryButtonClass} onClick={() => setActiveTab(2)}>
              <Receipt size={20} />
              ดูออเดอร์ทั้งหมด ({orders.length} รายการ)
            </Button>
            <Button
              className={gradientButtonClass}
              disabled={sheetSyncing}
              onClick={() => triggerSheetSync(config.sheetId ? 'sync' : 'create')}
            >
              <Bolt size={20} />
              {sheetSyncing ? 'กำลังซิงก์...' : 'ซิงก์ Google Sheet'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Factory Production Summary - Size & Sleeve breakdown for PAID orders */}
      {(() => {
        const paidOrdersList = orders.filter(o => o.status === 'PAID');
        const sizeOrder = [
          'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL', '7XL', '8XL', '9XL', '10XL',
        ];
        const getSizeIndex = (size: string) => {
          const idx = sizeOrder.findIndex(s => size?.toUpperCase()?.includes(s));
          return idx === -1 ? 999 : idx;
        };

        const sizeCount: Record<string, number> = {};
        const sizeLongSleeveCount: Record<string, number> = {};
        const sizeShortSleeveCount: Record<string, number> = {};
        let totalItems = 0;

        paidOrdersList.forEach(o => {
          const items = o?.items || o?.cart || [];
          items.forEach((item: DashboardOrderItem) => {
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
          <Card className={cn(glassCardClass, 'p-0')}>
            <CardHeader className="px-6 pt-6 pb-0">
              <CardTitle className="flex items-center gap-2 text-base font-bold text-[var(--foreground)]">
                <LocalMall size={20} color="#f472b6" />
                สรุปการผลิต (ออเดอร์ชำระแล้ว)
              </CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              <div className="mb-6 grid grid-cols-3 gap-4 rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-4">
                <div className="text-center">
                  <p className="text-2xl font-black text-[var(--foreground)]">{paidOrdersList.length}</p>
                  <p className="flex items-center justify-center gap-1 text-[0.7rem] text-[var(--muted-foreground)]">
                    <Inventory size={12} /> ออเดอร์
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-black text-cyan-400">{totalItems}</p>
                  <p className="flex items-center justify-center gap-1 text-[0.7rem] text-[var(--muted-foreground)]">
                    <Shirt size={12} /> ตัวทั้งหมด
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-black text-violet-400">{sortedSizes.length}</p>
                  <p className="flex items-center justify-center gap-1 text-[0.7rem] text-[var(--muted-foreground)]">
                    <Ruler size={12} /> ไซส์
                  </p>
                </div>
              </div>

              {sortedSizes.length > 0 ? (
                <Table className="min-w-[400px]">
                  <TableHeader>
                    <TableRow className="border-[var(--border)] hover:bg-transparent">
                      <TableHead className="border-[var(--border)] text-[0.75rem] font-semibold text-[var(--muted-foreground)]">
                        ไซส์
                      </TableHead>
                      <TableHead className="border-[var(--border)] text-center text-[0.75rem] font-semibold text-[var(--muted-foreground)]">
                        แขนสั้น
                      </TableHead>
                      <TableHead className="border-[var(--border)] text-center text-[0.75rem] font-semibold text-[var(--muted-foreground)]">
                        แขนยาว
                      </TableHead>
                      <TableHead className="border-[var(--border)] text-center text-[0.75rem] font-semibold text-[var(--muted-foreground)]">
                        รวม
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedSizes.map(size => (
                      <TableRow key={size} className="border-[var(--border)] hover:bg-white/[0.02]">
                        <TableCell className="border-[var(--border)]">
                          <span className="text-[0.85rem] font-bold text-[var(--foreground)]">{size}</span>
                        </TableCell>
                        <TableCell className="border-[var(--border)] text-center">
                          <span className="text-[0.85rem] text-[var(--muted-foreground)]">
                            {sizeShortSleeveCount[size] || 0}
                          </span>
                        </TableCell>
                        <TableCell className="border-[var(--border)] text-center">
                          <span className="text-[0.85rem] text-blue-400">
                            {sizeLongSleeveCount[size] || 0}
                          </span>
                        </TableCell>
                        <TableCell className="border-[var(--border)] text-center">
                          <span className="text-[0.9rem] font-bold text-[var(--success)]">
                            {sizeCount[size]}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="border-[var(--border)] bg-indigo-500/10 hover:bg-indigo-500/10">
                      <TableCell className="border-[var(--border)]">
                        <span className="flex items-center gap-1 text-[0.85rem] font-bold text-indigo-300">
                          <Target size={14} /> รวมทั้งหมด
                        </span>
                      </TableCell>
                      <TableCell className="border-[var(--border)] text-center">
                        <span className="text-[0.9rem] font-bold text-[var(--foreground)]">
                          {totalShortSleeve}
                        </span>
                      </TableCell>
                      <TableCell className="border-[var(--border)] text-center">
                        <span className="text-[0.9rem] font-bold text-blue-400">{totalLongSleeve}</span>
                      </TableCell>
                      <TableCell className="border-[var(--border)] text-center">
                        <span className="text-base font-black text-[var(--success)]">{totalItems}</span>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              ) : (
                <p className="py-6 text-center text-[0.85rem] text-[var(--muted-foreground)]">
                  ยังไม่มีออเดอร์ที่ชำระแล้ว
                </p>
              )}
            </CardContent>
          </Card>
        );
      })()}

      {/* Recent Orders - Modern Table */}
      <Card className={glassCardClass}>
        <CardHeader className="flex-row items-center justify-between space-y-0 px-6 py-5">
          <CardTitle className="flex items-center gap-2 text-base font-bold text-[var(--foreground)]">
            <LocalShipping size={20} color="#22d3ee" />
            ออเดอร์ล่าสุด
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="text-[0.8rem] text-indigo-300 hover:text-indigo-200"
            onClick={() => setActiveTab(2)}
          >
            ดูทั้งหมด →
          </Button>
        </CardHeader>
        <Separator className="bg-[var(--border)]" />
        <CardContent className="px-0 pb-0">
          <Table className="min-w-[600px]">
            <TableHeader>
              <TableRow className="border-[var(--border)] hover:bg-transparent">
                <TableHead className="border-[var(--border)] text-[0.75rem] font-semibold text-[var(--muted-foreground)]">
                  REF
                </TableHead>
                <TableHead className="border-[var(--border)] text-[0.75rem] font-semibold text-[var(--muted-foreground)]">
                  ลูกค้า
                </TableHead>
                <TableHead className="border-[var(--border)] text-right text-[0.75rem] font-semibold text-[var(--muted-foreground)]">
                  ยอด
                </TableHead>
                <TableHead className="border-[var(--border)] text-[0.75rem] font-semibold text-[var(--muted-foreground)]">
                  สถานะ
                </TableHead>
                <TableHead className="border-[var(--border)] text-[0.75rem] font-semibold text-[var(--muted-foreground)]">
                  วันที่
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.slice(0, 5).map(order => {
                const theme = STATUS_THEME[order.status] || STATUS_THEME.PENDING;
                return (
                  <TableRow
                    key={order.ref}
                    className="cursor-pointer border-[var(--border)] hover:bg-white/[0.02]"
                    onClick={() => {
                      setActiveTab(2);
                      setSearchTerm(order.ref);
                    }}
                  >
                    <TableCell className="border-[var(--border)]">
                      <span className="font-mono text-[0.8rem] font-semibold text-indigo-300">
                        {order.ref.slice(-8)}
                      </span>
                    </TableCell>
                    <TableCell className="border-[var(--border)]">
                      <p className="text-[0.85rem] font-semibold text-[var(--foreground)]">
                        {order.name || '—'}
                      </p>
                      <p className="text-[0.7rem] text-[var(--muted-foreground)]">
                        {order.email?.slice(0, 20) || ''}
                      </p>
                    </TableCell>
                    <TableCell className="border-[var(--border)] text-right">
                      <span className="text-[0.9rem] font-bold text-[var(--success)]">
                        ฿{Number(order.amount).toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell className="border-[var(--border)]">
                      <span
                        className="inline-flex rounded-lg px-3 py-1 text-[0.7rem] font-bold"
                        style={{
                          backgroundColor: theme.bg,
                          border: `1px solid ${theme.border}`,
                          color: theme.text,
                        }}
                      >
                        {order.status.replace('_', ' ')}
                      </span>
                    </TableCell>
                    <TableCell className="border-[var(--border)]">
                      <span className="text-[0.8rem] text-[var(--muted-foreground)]">
                        {order.date
                          ? new Date(order.date).toLocaleDateString('th-TH', {
                              day: 'numeric',
                              month: 'short',
                            })
                          : '-'}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
});
