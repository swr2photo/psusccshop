// API route for inventory/stock management
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { inventory } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/inventory?productId=xxx
export async function GET(request: NextRequest) {
  try {
    const productId = request.nextUrl.searchParams.get('productId');

    let data;
    if (productId) {
      data = await db
        .select()
        .from(inventory)
        .where(eq(inventory.productId, productId))
        .orderBy(inventory.productId);
    } else {
      data = await db
        .select()
        .from(inventory)
        .orderBy(inventory.productId);
    }

    // Group by product_id
    const grouped: Record<string, any> = {};
    for (const row of data || []) {
      if (!grouped[row.productId]) {
        grouped[row.productId] = {
          productId: row.productId,
          totalStock: 0,
          bySize: {} as Record<string, number>,
          lowStockThreshold: row.lowStockThreshold || 5,
        };
      }
      grouped[row.productId].totalStock += row.quantity;
      grouped[row.productId].bySize[row.size || 'FREE'] = row.quantity;
    }

    return NextResponse.json(
      { inventory: Object.values(grouped) },
      { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' } }
    );
  } catch (error: any) {
    console.error('GET /api/inventory error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/inventory - Update stock (admin only)
export async function POST(request: NextRequest) {
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

    return NextResponse.json({
      success: true,
      inventory: {
        product_id: resultData.productId,
        size: resultData.size,
        variant_id: resultData.variantId,
        quantity: resultData.quantity,
        low_stock_threshold: resultData.lowStockThreshold,
        updated_at: resultData.updatedAt?.toISOString(),
      }
    });
  } catch (error: any) {
    console.error('POST /api/inventory error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
