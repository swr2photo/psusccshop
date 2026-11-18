/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { assertShopAccess, resolveAdminSession } from '@/lib/admin-context';
import { db } from '@/lib/db';
import { orders } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { getCached } from '@/lib/server-cache';
import { secureJsonResponse } from '@/lib/payload-crypto';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const session = await resolveAdminSession(authResult.email);
    const url = new URL(req.url);
    const shopId = url.searchParams.get('shopId')?.trim() || undefined;

    let shopScopeIds: string[] | undefined;
    if (session.userRole === 'shopAdmin') {
      if (session.assignedShopIds.length === 0) {
        return await secureJsonResponse({ status: 'error', message: 'ไม่มีร้านค้าที่ได้รับมอบหมาย' }, { status: 403 });
      }
      if (shopId) {
        if (!assertShopAccess(session, shopId)) {
          return await secureJsonResponse({ status: 'error', message: 'ไม่มีสิทธิ์เข้าถึงร้านค้านี้' }, { status: 403 });
        }
        shopScopeIds = [shopId];
      } else {
        shopScopeIds = session.assignedShopIds;
      }
    } else if (shopId) {
      shopScopeIds = [shopId];
    }

    const cacheKey = `admin:analytics:summary:${shopScopeIds ? shopScopeIds.slice().sort().join(',') : 'all'}`;
    const summaryData = await getCached(cacheKey, 15_000, async () => {
      let query = db.select({
        status: orders.status,
        amount: orders.totalAmount,
        cart: orders.cart,
        date: orders.date,
      }).from(orders);

      if (shopScopeIds && shopScopeIds.length === 1) {
        query = query.where(eq(orders.shopId, shopScopeIds[0])) as any;
      } else if (shopScopeIds && shopScopeIds.length > 1) {
        query = query.where(inArray(orders.shopId, shopScopeIds)) as any;
      }

      const allOrders = await query;

      // Prepare 7-day trend buckets upfront
      const days = 7;
      const dailyBuckets = new Map<string, { date: string; revenue: number; count: number }>();
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateKey = d.toISOString().split('T')[0];
        const dayLabel = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
        dailyBuckets.set(dateKey, { date: dayLabel, revenue: 0, count: 0 });
      }

      let totalSales = 0;
      let pendingOrders = 0;
      let paidOrders = 0;
      let readyOrders = 0;
      let completedOrders = 0;
      let cancelledOrders = 0;

      const productSales: Record<string, { name: string; count: number; revenue: number }> = {};
      const sizeCount: Record<string, number> = {};
      const sizeLongSleeveCount: Record<string, number> = {};
      const sizeShortSleeveCount: Record<string, number> = {};
      let totalItems = 0;

      // Single O(N) pass across allOrders (parses cart JSON once per order)
      for (const order of allOrders) {
        const st = order.status;
        if (st === 'CANCELLED') {
          cancelledOrders += 1;
          continue;
        }

        if (st === 'WAITING_PAYMENT' || st === 'PENDING') pendingOrders += 1;
        else if (st === 'PAID') paidOrders += 1;
        else if (st === 'READY' || st === 'SHIPPED') readyOrders += 1;
        else if (st === 'COMPLETED') completedOrders += 1;

        const amt = Number(order.amount) || 0;
        totalSales += amt;

        if (order.date) {
          const od = new Date(order.date);
          if (!Number.isNaN(od.getTime())) {
            const bucket = dailyBuckets.get(od.toISOString().split('T')[0]);
            if (bucket) {
              bucket.revenue += amt;
              bucket.count += 1;
            }
          }
        }

        const cartItems = typeof order.cart === 'string'
          ? (() => { try { return JSON.parse(order.cart || '[]'); } catch { return []; } })()
          : (order.cart || []);

        const isPaid = st === 'PAID';
        for (const item of cartItems) {
          const key = item.name || item.id || 'Unknown';
          const qty = Number(item.quantity ?? item.qty ?? 1) || 1;
          if (!productSales[key]) productSales[key] = { name: key, count: 0, revenue: 0 };
          productSales[key].count += qty;
          productSales[key].revenue += Number(item.total ?? item.price ?? 0) || 0;

          if (isPaid) {
            const size = item.size || 'ไม่ระบุ';
            const isLongSleeve = Boolean(item.options?.isLongSleeve || item.isLongSleeve);
            totalItems += qty;
            sizeCount[size] = (sizeCount[size] || 0) + qty;
            if (isLongSleeve) {
              sizeLongSleeveCount[size] = (sizeLongSleeveCount[size] || 0) + qty;
            } else {
              sizeShortSleeveCount[size] = (sizeShortSleeveCount[size] || 0) + qty;
            }
          }
        }
      }

      const dailyData = Array.from(dailyBuckets.values());
      const bestSellers = Object.values(productSales)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL', '7XL', '8XL', '9XL', '10XL'];
      const getSizeIndex = (size: string) => {
        const idx = sizeOrder.findIndex(s => size?.toUpperCase()?.includes(s));
        return idx === -1 ? 999 : idx;
      };
      const sortedSizes = Object.keys(sizeCount).sort((a, b) => getSizeIndex(a) - getSizeIndex(b));

      const totalShortSleeve = Object.values(sizeShortSleeveCount).reduce((a, b) => a + b, 0);
      const totalLongSleeve = Object.values(sizeLongSleeveCount).reduce((a, b) => a + b, 0);

      return {
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
        },
      };
    });

    return await secureJsonResponse({
      status: 'success',
      data: summaryData,
    });
  } catch (error: any) /* eslint-disable-line @typescript-eslint/no-explicit-any */ {
    console.error('[Analytics API] Error:', error);
    return await secureJsonResponse({ status: 'error', message: 'Failed to fetch analytics' }, { status: 500 });
  }
}
