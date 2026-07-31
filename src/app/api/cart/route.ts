/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getJson, putJson, getShopConfig } from '@/lib/filebase';
import crypto from 'crypto';
import { requireAuth, isResourceOwner, isAdminEmailAsync } from '@/lib/auth';
import { secureJsonRequest, secureJsonResponse } from '@/lib/payload-crypto';
import { getShopById, getShopBySlug } from '@/lib/shops';
import { isProductCurrentlyOpen, isProductOutOfStock } from '@/lib/shop-constants';
import type { Product } from '@/lib/config';

const cartKey = (email: string) => `carts/${crypto.createHash('sha256').update(email.toLowerCase()).digest('hex')}.json`;
type CartItemLike = {
  productId?: string;
  productName?: string;
  name?: string;
  shopId?: string;
  shopSlug?: string;
};

async function resolveProductsForCartItem(
  item: CartItemLike,
  cache: Map<string, Product[]>,
): Promise<Product[]> {
  const key = item.shopId ? `id:${item.shopId}` : item.shopSlug ? `slug:${item.shopSlug}` : 'main';
  const cached = cache.get(key);
  if (cached) return cached;

  let products: Product[] = [];
  if (item.shopId) {
    const shop = await getShopById(item.shopId);
    if (!shop) {
      throw new Error('ไม่พบข้อมูลร้านค้า');
    }
    products = shop.products || [];
  } else if (item.shopSlug) {
    const shop = await getShopBySlug(item.shopSlug);
    if (!shop) {
      throw new Error('ไม่พบข้อมูลร้านค้า');
    }
    products = shop.products || [];
  } else {
    const cfg = await getShopConfig();
    products = (cfg?.products || []) as Product[];
  }

  cache.set(key, products);
  return products;
}

// Helper to save user log server-side
async function saveUserLogServer(log: {
  email: string;
  name?: string;
  action: string;
  details?: string;
  metadata?: Record<string, any>;
  ip?: string;
  userAgent?: string;
}) {
  try {
    const id = `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const fullLog = {
      ...log,
      id,
      timestamp: new Date().toISOString(),
    };
    await putJson(`user-logs/${id}.json`, fullLog);
  } catch (e) {
    console.warn("[Cart API] Failed to save user log:", e);
  }
}

export async function GET(req: NextRequest) {
  // ตรวจสอบว่าเข้าสู่ระบบแล้ว
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const email = req.nextUrl.searchParams.get('email');
  if (!email) return await secureJsonResponse({ status: 'error', message: 'missing email' }, { status: 400 });

  // ตรวจสอบว่าเป็นเจ้าของหรือเป็น admin
  const currentEmail = authResult.email;
  if (!isResourceOwner(email, currentEmail) && !(await isAdminEmailAsync(currentEmail))) {
    return await secureJsonResponse({ status: 'error', message: 'ไม่มีสิทธิ์เข้าถึงข้อมูลนี้' }, { status: 403 });
  }

  try {
    const data = (await getJson(cartKey(email))) || [];
    if (!Array.isArray(data) || data.length === 0) {
      return await secureJsonResponse({ status: 'success', data: { cart: [] } });
    }

    const now = new Date();
    const catalogCache = new Map<string, Product[]>();
    const cleanedCart: CartItemLike[] = [];

    for (const item of data as CartItemLike[]) {
      const products = await resolveProductsForCartItem(item, catalogCache);
      const prod = products.find((p) => p.id === item.productId);
      if (!prod) continue;
      if (!isProductCurrentlyOpen(prod, now)) continue;
      if (isProductOutOfStock(prod)) continue;
      cleanedCart.push(item);
    }

    if (cleanedCart.length !== data.length) {
      await putJson(cartKey(email), cleanedCart);
    }

    return await secureJsonResponse({ status: 'success', data: { cart: cleanedCart } });
  } catch (error) {
    console.error('[Cart API] GET failed:', error);
    // Never mask failures as empty cart — clients would wipe a non-empty local cart
    return await secureJsonResponse(
      { status: 'error', message: 'Failed to load cart' },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  // ตรวจสอบว่าเข้าสู่ระบบแล้ว
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const body = await secureJsonRequest(req);
    const email = body?.email as string | undefined;
    const cart = body?.cart as CartItemLike[] | undefined;
    if (!email || !Array.isArray(cart)) return await secureJsonResponse({ status: 'error', message: 'missing email/cart' }, { status: 400 });

    // ตรวจสอบว่าเป็นเจ้าของหรือเป็น admin
    const currentEmail = authResult.email;
    if (!isResourceOwner(email, currentEmail) && !(await isAdminEmailAsync(currentEmail))) {
      return await secureJsonResponse({ status: 'error', message: 'ไม่มีสิทธิ์แก้ไขข้อมูลนี้' }, { status: 403 });
    }

    const now = new Date();
    const catalogCache = new Map<string, Product[]>();

    for (const item of cart) {
      const products = await resolveProductsForCartItem(item, catalogCache);
      const prod = products.find((p) => p.id === item.productId);
      // We no longer block saving the cart if an item is expired, missing, or out of stock.
      // The frontend UI handles displaying these states (e.g. disabled, "out of stock" label).
      // Validation for purchasing happens in the checkout route (POST /api/orders).
    }

    // Get old cart for comparison
    const oldCart = (await getJson(cartKey(email))) || [];

    await putJson(cartKey(email), cart);
    
    // Log cart change (only if items changed significantly)
    const oldCount = Array.isArray(oldCart) ? oldCart.length : 0;
    const newCount = cart.length;
    if (oldCount !== newCount) {
      const userAgent = req.headers.get('user-agent') || undefined;
      const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 
                       req.headers.get('x-real-ip') || undefined;
      const action = newCount > oldCount ? 'add_to_cart' : 'remove_from_cart';
      await saveUserLogServer({
        email,
        action,
        details: newCount > oldCount 
          ? `เพิ่มสินค้าลงตะกร้า (${newCount} รายการ)` 
          : `ลบสินค้าจากตะกร้า (${newCount} รายการ)`,
        metadata: { 
          itemCount: newCount,
          previousCount: oldCount,
        },
        ip: clientIP,
        userAgent,
      });
    }
    
    return await secureJsonResponse({ status: 'success' });
  } catch (error: unknown) {
    return await secureJsonResponse({
      status: 'error',
      message: error instanceof Error ? error.message : 'save failed',
      error: typeof error === 'object' && error !== null ? error : { detail: String(error) },
    }, { status: 500 });
  }
}
