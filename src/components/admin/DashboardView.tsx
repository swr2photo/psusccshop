import React from 'react';
import {
  Box,
  Typography,
  Chip,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@mui/material';
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

import {
  ShopConfig,
} from '@/lib/config';

import {
  ADMIN_THEME,
  STATUS_THEME,
  adminGlassCardSx as glassCardSx,
  adminSecondaryButtonSx as secondaryButtonSx,
  adminGradientButtonSx as gradientButtonSx,
} from '@/lib/adminTheme';

const Shirt = ({ size, color }: { size?: number; color?: string }) => (
  // Simple fallback SVG for Shirt icon
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size || 24}
    height={size || 24}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color || "currentColor"}
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
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Welcome Header — Aurora + Grid Pattern */}
      <Box className="aurora-bg grid-pattern noise-overlay" sx={{ 
        p: 3, 
        borderRadius: '20px', 
        border: '1px solid rgba(99,102,241,0.15)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <Typography sx={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--foreground)', mb: 0.5, display: 'flex', alignItems: 'center', gap: 1, position: 'relative', zIndex: 2 }}>
          <WavingHand size={22} color="#fbbf24" />
          ยินดีต้อนรับ, {session?.user?.name?.split(' ')[0] || 'Admin'}
        </Typography>
        {isShopMode && (
          <Chip 
            icon={<Store size={14} />}
            label={`กำลังดูร้าน: ${myShops.find(s => s.id === selectedShopId)?.name || 'ร้านค้าย่อย'}`}
            size="small"
            sx={{ mb: 1, bgcolor: 'rgba(139,92,246,0.2)', color: '#c084fc', fontWeight: 700, borderRadius: '10px' }}
          />
        )}
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

      {/* ===== Analytics Charts ===== */}
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' },
        gap: 2,
      }}>
        {/* Revenue Trend - Last 7 days */}
        <Box sx={{ ...glassCardSx, p: 3 }}>
          <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: 'var(--foreground)', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <TrendingUp size={20} color="#34c759" />
            Revenue Trend (7 Days)
          </Typography>
          {(() => {
            // Calculate daily revenue for last 7 days
            const days = 7;
            const dailyData: { date: string; revenue: number; count: number }[] = [];
            for (let i = days - 1; i >= 0; i--) {
              const d = new Date();
              d.setDate(d.getDate() - i);
              const dateStr = d.toISOString().split('T')[0];
              const dayLabel = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
              const dayOrders = validOrders.filter(o => {
                const od = new Date(o.date || '');
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
              <Box>
                {/* Bar chart using pure CSS */}
                <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 0.5, height: 120, mb: 1 }}>
                  {dailyData.map((d, i) => (
                    <Box key={i} sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                      <Typography sx={{ fontSize: '0.55rem', color: '#34c759', fontWeight: 700, opacity: d.revenue > 0 ? 1 : 0 }}>
                        ฿{d.revenue >= 1000 ? `${(d.revenue / 1000).toFixed(1)}k` : d.revenue.toLocaleString()}
                      </Typography>
                      <Box sx={{
                        width: '100%',
                        height: `${Math.max((d.revenue / maxRev) * 100, 3)}%`,
                        background: d.revenue > 0 ? 'linear-gradient(180deg, #34c759, #059669)' : 'rgba(100,116,139,0.15)',
                        borderRadius: '6px 6px 2px 2px',
                        transition: 'height 0.5s ease',
                        minHeight: 4,
                      }} />
                    </Box>
                  ))}
                </Box>
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  {dailyData.map((d, i) => (
                    <Box key={i} sx={{ flex: 1, textAlign: 'center' }}>
                      <Typography sx={{ fontSize: '0.55rem', color: 'var(--text-muted)' }}>{d.date}</Typography>
                      <Typography sx={{ fontSize: '0.55rem', color: 'var(--text-muted)', opacity: 0.6 }}>{d.count} orders</Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            );
          })()}
        </Box>

        {/* Order Status Donut Chart */}
        <Box sx={{ ...glassCardSx, p: 3 }}>
          <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: 'var(--foreground)', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <BarChart3 size={20} color="#a5b4fc" />
            Order Distribution
          </Typography>
          {(() => {
            const total = orders.length || 1;
            const segments = [
              { label: 'Pending', count: pendingOrders, color: '#ff9f0a' },
              { label: 'Paid', count: paidOrders, color: '#34c759' },
              { label: 'Ready/Shipped', count: readyOrders, color: '#2997ff' },
              { label: 'Completed', count: completedOrders, color: '#30d158' },
              { label: 'Cancelled', count: cancelledOrders, color: '#ff453a' },
            ].filter(s => s.count > 0);

            // CSS conic-gradient for donut
            let accumulated = 0;
            const gradientParts = segments.map(s => {
              const start = accumulated;
              const end = accumulated + (s.count / total) * 360;
              accumulated = end;
              return `${s.color} ${start}deg ${end}deg`;
            });

            return (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                {/* Donut */}
                <Box sx={{
                  width: 120, height: 120, borderRadius: '50%',
                  background: `conic-gradient(${gradientParts.join(', ')})`,
                  position: 'relative',
                  '&::after': {
                    content: '""',
                    position: 'absolute',
                    inset: '25%',
                    borderRadius: '50%',
                    bgcolor: 'var(--surface)',
                  },
                }}>
                  <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', zIndex: 1 }}>
                    <Typography sx={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--foreground)', mx: 'auto' }}>{total}</Typography>
                  </Box>
                </Box>
                {/* Legend */}
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center' }}>
                  {segments.map((s) => (
                    <Box key={s.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: s.color }} />
                      <Typography sx={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>
                        {s.label} ({s.count})
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            );
          })()}
        </Box>
      </Box>

      {/* ===== Best Sellers ===== */}
      <Box sx={{ ...glassCardSx, p: 3 }}>
        <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: 'var(--foreground)', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Fire size={20} color="#ff9f0a" />
          Best Selling Products
        </Typography>
        {(() => {
          // Count product sales from order carts
          const productSales: Record<string, { name: string; count: number; revenue: number }> = {};
          for (const order of validOrders) {
            const cart = typeof order.cart === 'string' ? JSON.parse(order.cart || '[]') : order.cart || [];
            for (const item of cart) {
              const key = item.name || item.id || 'Unknown';
              if (!productSales[key]) productSales[key] = { name: key, count: 0, revenue: 0 };
              productSales[key].count += item.qty || 1;
              productSales[key].revenue += item.total || item.price || 0;
            }
          }
          const sorted = Object.values(productSales).sort((a, b) => b.count - a.count).slice(0, 5);
          if (sorted.length === 0) {
            return <Typography sx={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No sales data yet</Typography>;
          }
          const maxCount = sorted[0].count;
          return (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {sorted.map((product, idx) => (
                <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 800, color: idx === 0 ? '#ff9f0a' : 'var(--text-muted)', width: 20 }}>
                    #{idx + 1}
                  </Typography>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {product.name}
                    </Typography>
                    <Box sx={{ 
                      height: 4, borderRadius: 2, mt: 0.5,
                      bgcolor: 'rgba(100,116,139,0.1)',
                      position: 'relative',
                      overflow: 'hidden',
                    }}>
                      <Box sx={{
                        position: 'absolute', left: 0, top: 0, bottom: 0,
                        width: `${(product.count / maxCount) * 100}%`,
                        background: 'linear-gradient(90deg, #0071e3, #2997ff)',
                        borderRadius: 2,
                        transition: 'width 0.5s ease',
                      }} />
                    </Box>
                  </Box>
                  <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                    <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--foreground)' }}>{product.count} pcs</Typography>
                    <Typography sx={{ fontSize: '0.6rem', color: '#34c759' }}>฿{product.revenue.toLocaleString()}</Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          );
        })()}
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
              <Store size={20} />
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
});
