// API route for inventory/stock management
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/inventory?productId=xxx
export async function GET(request: NextRequest) {
  try {
    const productId = request.nextUrl.searchParams.get('productId');

    let query = supabase.from('inventory').select('*');

    if (productId) {
      query = query.eq('product_id', productId);
    }

    const { data, error } = await query.order('product_id');
    if (error) throw error;

    // Group by product_id
    const grouped: Record<string, any> = {};
    for (const row of data || []) {
      if (!grouped[row.product_id]) {
        grouped[row.product_id] = {
          productId: row.product_id,
          totalStock: 0,
          bySize: {} as Record<string, number>,
          lowStockThreshold: row.low_stock_threshold || 5,
        };
      }
      grouped[row.product_id].totalStock += row.quantity;
      grouped[row.product_id].bySize[row.size || 'FREE'] = row.quantity;
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

    const { data, error } = await supabase
      .from('inventory')
      .upsert({
        product_id: productId,
        size: size || 'FREE',
        variant_id: null,
        quantity: quantity ?? 0,
        low_stock_threshold: lowStockThreshold ?? 5,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'product_id,size,variant_id',
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, inventory: data });
  } catch (error: any) {
    console.error('POST /api/inventory error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
