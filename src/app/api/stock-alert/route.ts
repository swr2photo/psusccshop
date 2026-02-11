// API route for back-in-stock alerts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { createHash } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function hashEmail(email: string): string {
  return createHash('sha256').update(email.toLowerCase().trim()).digest('hex');
}

// POST /api/stock-alert - Register for back-in-stock alert
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productId, email, size } = body;

    if (!productId || !email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const emailHash = hashEmail(email);

    const { data, error } = await supabase
      .from('stock_alerts')
      .upsert({
        product_id: productId,
        email_hash: emailHash,
        size: size || null,
        notified: false,
        created_at: new Date().toISOString(),
      }, {
        onConflict: 'product_id,email_hash,size',
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, alert: data });
  } catch (error: any) {
    console.error('POST /api/stock-alert error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/stock-alert - Unsubscribe from alert
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { productId, email } = body;

    if (!productId || !email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const emailHash = hashEmail(email);

    const { error } = await supabase
      .from('stock_alerts')
      .delete()
      .eq('product_id', productId)
      .eq('email_hash', emailHash);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE /api/stock-alert error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET /api/stock-alert?email=xxx - Get user's active alerts
export async function GET(request: NextRequest) {
  try {
    const email = request.nextUrl.searchParams.get('email');
    if (!email) {
      return NextResponse.json({ error: 'Missing email' }, { status: 400 });
    }

    const emailHash = hashEmail(email);

    const { data, error } = await supabase
      .from('stock_alerts')
      .select('*')
      .eq('email_hash', emailHash)
      .eq('notified', false);

    if (error) throw error;

    return NextResponse.json({
      alerts: (data || []).map((a: any) => ({
        productId: a.product_id,
        size: a.size,
        createdAt: a.created_at,
      })),
    });
  } catch (error: any) {
    console.error('GET /api/stock-alert error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
