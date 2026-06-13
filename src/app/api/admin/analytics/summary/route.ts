import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { orders } from '@/db/schema';
import { sql, eq } from 'drizzle-orm';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    // Only select the fields needed for dashboard stats to minimize memory usage
    const url = new URL(req.url);
    const shopId = url.searchParams.get('shopId');

    let query = db.select({
      status: orders.status,
      amount: orders.totalAmount,
      cart: orders.cart,
      date: orders.date,
    }).from(orders);

    if (shopId) {
      query = query.where(eq(orders.shopId, shopId)) as any;
    }

    const allOrders = await query;

    const validOrders = allOrders.filter(o => o.status !== 'CANCELLED');
    const totalSales = validOrders.reduce((sum, o) => sum + (Number(o.amount) || 0), 0);
    const pendingOrders = allOrders.filter(o => ['WAITING_PAYMENT', 'PENDING'].includes(o.status)).length;
    const paidOrders = allOrders.filter(o => o.status === 'PAID').length;
    const readyOrders = allOrders.filter(o => ['READY', 'SHIPPED'].includes(o.status)).length;
    const completedOrders = allOrders.filter(o => o.status === 'COMPLETED').length;
    const cancelledOrders = allOrders.filter(o => o.status === 'CANCELLED').length;

    // Revenue Trend (7 days)
    const days = 7;
    const dailyData: { date: string; revenue: number; count: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayLabel = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
      const dayOrders = validOrders.filter(o => {
        if (!o.date) return false;
        const od = new Date(o.date);
        return od.toISOString().split('T')[0] === dateStr;
      });
      dailyData.push({
        date: dayLabel,
        revenue: dayOrders.reduce((s, o) => s + (Number(o.amount) || 0), 0),
        count: dayOrders.length,
      });
    }

    // Best Selling Products
    const productSales: Record<string, { name: string; count: number; revenue: number }> = {};
    for (const order of validOrders) {
      const cartItems = typeof order.cart === 'string' ? JSON.parse(order.cart || '[]') : order.cart || [];
      for (const item of cartItems) {
        const key = item.name || item.id || 'Unknown';
        if (!productSales[key]) productSales[key] = { name: key, count: 0, revenue: 0 };
        productSales[key].count += item.qty || item.quantity || 1;
        productSales[key].revenue += item.total || item.price || 0;
      }
    }
    const bestSellers = Object.values(productSales)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Size / Sleeve Breakdown (from PAID orders)
    const paidOrdersList = allOrders.filter(o => o.status === 'PAID');
    const sizeCount: Record<string, number> = {};
    const sizeLongSleeveCount: Record<string, number> = {};
    const sizeShortSleeveCount: Record<string, number> = {};
    let totalItems = 0;

    paidOrdersList.forEach((o) => {
      const items = typeof o.cart === 'string' ? JSON.parse(o.cart || '[]') : o.cart || [];
      items.forEach((item: any) => {
        const size = item.size || 'ไม่ระบุ';
        const qty = Number(item.quantity ?? item.qty ?? 1) || 1;
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

    const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL', '7XL', '8XL', '9XL', '10XL'];
    const getSizeIndex = (size: string) => {
      const idx = sizeOrder.findIndex(s => size?.toUpperCase()?.includes(s));
      return idx === -1 ? 999 : idx;
    };
    const sortedSizes = Object.keys(sizeCount).sort((a, b) => getSizeIndex(a) - getSizeIndex(b));

    const totalShortSleeve = Object.values(sizeShortSleeveCount).reduce((a, b) => a + b, 0);
    const totalLongSleeve = Object.values(sizeLongSleeveCount).reduce((a, b) => a + b, 0);

    return NextResponse.json({
      status: 'success',
      data: {
        totalSales,
        counts: {
          pending: pendingOrders,
          paid: paidOrders,
          ready: readyOrders,
          completed: completedOrders,
          cancelled: cancelledOrders,
          total: allOrders.length,
        },
        revenueTrend: dailyData,
        bestSellers,
        production: {
          totalItems,
          sizes: sortedSizes.map(size => ({
            size,
            shortSleeve: sizeShortSleeveCount[size] || 0,
            longSleeve: sizeLongSleeveCount[size] || 0,
            total: sizeCount[size],
          })),
          totalShortSleeve,
          totalLongSleeve,
        }
      }
    });
  } catch (error: any) {
    console.error('[Analytics API] Error:', error);
    return NextResponse.json({ status: 'error', message: 'Failed to fetch analytics' }, { status: 500 });
  }
}
