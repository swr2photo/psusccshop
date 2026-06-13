// src/app/api/inventory/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { withBackendProxy } from '@/lib/backend-proxy';
import { db } from '@/lib/db';
import { inventory } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { requireAdmin, isAdminEmailAsync, authOptions } from '@/lib/auth';
import { getServerSession } from 'next-auth';
import { API_CACHE } from '@/lib/api-helpers';
import { getCached, invalidateCachePrefix, CACHE_TTL } from '@/lib/server-cache';
import { groupInventoryRows, toPublicInventory } from '@/lib/inventory-public';

type InventoryDbRow = typeof inventory.$inferSelect;

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function fetchInventoryRows(productId: string | null): Promise<InventoryDbRow[]> {
  if (productId) {
    return db
      .select()
      .from(inventory)
      .where(eq(inventory.productId, productId))
      .orderBy(inventory.productId);
  }
  return db.select().from(inventory).orderBy(inventory.productId);
}

// GET /api/inventory?productId=xxx — public: coarse availability; admin: full counts
async function GETHandler(request: NextRequest) {
  try {
    const productId = request.nextUrl.searchParams.get('productId');
    const session = await getServerSession(authOptions);
    const adminView = session?.user?.email
      ? await isAdminEmailAsync(session.user.email)
      : false;

    const cacheKey = adminView
      ? `inventory:admin:${productId || 'all'}`
      : `inventory:public:${productId || 'all'}`;

    const payload = await getCached(cacheKey, CACHE_TTL.inventory, async () => {
      const data = await fetchInventoryRows(productId);
      const grouped = groupInventoryRows(
        (data || []).map((row) => ({
          productId: row.productId,
          quantity: row.quantity,
          size: row.size,
          lowStockThreshold: row.lowStockThreshold,
        }))
      );
      return adminView ? grouped : toPublicInventory(grouped);
    });

    return NextResponse.json(
      { inventory: payload, view: adminView ? 'admin' : 'public' },
      { headers: { 'Cache-Control': API_CACHE.short } }
    );
  } catch (error: any) {
    console.error('GET /api/inventory error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export const GET = withBackendProxy(GETHandler);

// POST /api/inventory - Update stock (admin only)
export async function POST(request: NextRequest) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await request.json();
    const { productId, size, quantity, lowStockThreshold } = body;

    if (!productId) {
      return NextResponse.json({ error: 'Missing productId' }, { status: 400 });
    }

    const existing = await db
      .select()
      .from(inventory)
      .where(
        and(
          eq(inventory.productId, productId),
          eq(inventory.size, size || 'FREE')
        )
      )
      .limit(1);

    let resultData;
    if (existing.length > 0) {
      const updated = await db
        .update(inventory)
        .set({
          quantity: quantity ?? 0,
          lowStockThreshold: lowStockThreshold ?? 5,
          updatedAt: new Date(),
        })
        .where(eq(inventory.id, existing[0].id))
        .returning();
      resultData = updated[0];
    } else {
      const inserted = await db
        .insert(inventory)
        .values({
          productId,
          size: size || 'FREE',
          variantId: null,
          quantity: quantity ?? 0,
          lowStockThreshold: lowStockThreshold ?? 5,
          updatedAt: new Date(),
        })
        .returning();
      resultData = inserted[0];
    }

    invalidateCachePrefix('inventory:');

    return NextResponse.json({
      success: true,
      inventory: {
        product_id: resultData.productId,
        size: resultData.size,
        variant_id: resultData.variantId,
        quantity: resultData.quantity,
        low_stock_threshold: resultData.lowStockThreshold,
        updated_at: resultData.updatedAt?.toISOString(),
      },
    });
  } catch (error: any) {
    console.error('POST /api/inventory error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
