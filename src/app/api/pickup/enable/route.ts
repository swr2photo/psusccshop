import { NextRequest, NextResponse } from 'next/server';
import { getJson, putJson, listKeys } from '@/lib/filebase';
import { requireAdminWithPermission } from '@/lib/auth';
import { ShopConfig } from '@/lib/config';
import { sendOrderStatusEmail } from '@/lib/email';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CONFIG_KEY = 'config/shop-settings.json';

// Helper to generate email index key
const normalizeEmail = (email?: string | null) => (email || '').trim().toLowerCase();
const emailIndexKey = (email: string) => {
  const normalized = normalizeEmail(email);
  const hash = crypto.createHash('sha256').update(normalized).digest('hex');
  return `orders/index/${hash}.json`;
};

// Update order in user's index
const updateIndexEntry = async (email: string, order: any) => {
  const normalized = normalizeEmail(email);
  if (!normalized) return;
  const key = emailIndexKey(normalized);
  const existing = (await getJson<any[]>(key)) || [];
  const filtered = existing.filter((o) => o?.ref !== order?.ref);
  const next = [order, ...filtered].slice(0, 500);
  await putJson(key, next);
};

/**
 * POST - Enable pickup for a product and optionally update PAID orders to READY
 * Body: { productId: string, pickup: { enabled, location, startDate, endDate, notes }, autoUpdateOrders?: boolean }
 */
export async function POST(req: NextRequest) {
  const authResult = await requireAdminWithPermission('canManagePickup');
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const body = await req.json();
    const productId = body?.productId as string;
    const autoUpdateOrders = body?.autoUpdateOrders !== false; // Default true
    const pickupSettings = body?.pickup as {
      enabled: boolean;
      location?: string;
      startDate?: string;
      endDate?: string;
      notes?: string;
    };

    if (!productId) {
      return NextResponse.json(
        { status: 'error', message: 'Missing productId' },
        { status: 400 }
      );
    }

    // Get config and update product pickup settings
    const config = await getJson<ShopConfig>(CONFIG_KEY);
    if (!config) {
      return NextResponse.json(
        { status: 'error', message: 'Config not found' },
        { status: 404 }
      );
    }

    const productIndex = config.products?.findIndex(p => p.id === productId);
    if (productIndex === undefined || productIndex === -1) {
      return NextResponse.json(
        { status: 'error', message: 'Product not found' },
        { status: 404 }
      );
    }

    // Update product pickup settings
    config.products[productIndex].pickup = {
      ...pickupSettings,
      updatedBy: authResult.email,
      updatedAt: new Date().toISOString(),
    };

    await putJson(CONFIG_KEY, config);

    // If enabling pickup AND autoUpdateOrders is true, update all PAID orders containing this product to READY
    let updatedCount = 0;
    if (pickupSettings.enabled && autoUpdateOrders) {
      const keys = await listKeys('orders/');
      
      for (const key of keys) {
        const order = await getJson<any>(key);
        if (!order) continue;
        
        // Check if order is PAID and contains this product
        if (order.status !== 'PAID') continue;
        
        const items = order.cart || order.items || [];
        const hasProduct = items.some((item: any) => 
          item.productId === productId || item.id === productId
        );
        
        if (hasProduct) {
          // Update order status to READY
          const updatedOrder = {
            ...order,
            status: 'READY',
            readyAt: new Date().toISOString(),
            readyBy: authResult.email,
            readyReason: `Pickup enabled for product: ${config.products[productIndex].name}`,
            pickupLocation: pickupSettings.location,
            pickupNotes: pickupSettings.notes,
          };
          
          await putJson(key, updatedOrder);
          
          // Update user's index
          const customerEmail = order.customerEmail || order.email;
          if (customerEmail) {
            await updateIndexEntry(customerEmail, updatedOrder);
            
            // Send email notification with pickup location
            try {
              await sendOrderStatusEmail(updatedOrder, 'READY', {
                pickupLocation: pickupSettings.location,
                pickupNotes: pickupSettings.notes,
              });
            } catch (emailErr) {
              console.error('[Pickup Enable] Email send error:', emailErr);
            }
          }
          
          updatedCount++;
        }
      }
    }

    return NextResponse.json({
      status: 'success',
      message: pickupSettings.enabled 
        ? `เปิดรับสินค้าสำเร็จ อัปเดต ${updatedCount} คำสั่งซื้อเป็น "พร้อมรับ"` 
        : 'ปิดรับสินค้าสำเร็จ',
      updatedCount,
      data: {
        productId,
        pickup: config.products[productIndex].pickup,
        updatedOrders: updatedCount,
      },
    });
  } catch (error: any) {
    console.error('[Pickup Enable API] Error:', error);
    return NextResponse.json(
      { status: 'error', message: error?.message || 'Failed to update pickup' },
      { status: 500 }
    );
  }
}
