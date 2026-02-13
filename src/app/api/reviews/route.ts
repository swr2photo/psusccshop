// API route for product reviews
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { createHash } from 'crypto';

function hashEmail(email: string): string {
  return createHash('sha256').update(email.toLowerCase().trim()).digest('hex');
}

// GET /api/reviews?productId=xxx
export async function GET(request: NextRequest) {
  try {
    const productId = request.nextUrl.searchParams.get('productId');
    
    let query = supabase
      .from('reviews')
      .select('*')
      .order('created_at', { ascending: false });

    if (productId) {
      query = query.eq('product_id', productId);
    }

    const { data, error } = await query.limit(100);
    if (error) throw error;

    // Calculate average rating per product
    const reviewData = (data || []).map((r: any) => ({
      id: r.id,
      productId: r.product_id,
      userName: r.user_name || 'Anonymous',
      userImage: r.user_image,
      rating: r.rating,
      comment: r.comment || '',
      date: r.created_at,
      verified: r.verified,
      helpful: r.helpful_count || 0,
    }));

    return NextResponse.json(
      { reviews: reviewData },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } }
    );
  } catch (error: any) {
    console.error('GET /api/reviews error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/reviews - Create or update a review
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productId, email, userName, userImage, rating, comment } = body;

    if (!productId || !email || !rating) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating must be 1-5' }, { status: 400 });
    }

    const emailHash = hashEmail(email);

    // Upsert review (one per user per product)
    const { data, error } = await supabase
      .from('reviews')
      .upsert({
        product_id: productId,
        email_hash: emailHash,
        user_name: userName || 'Anonymous',
        user_image: userImage || null,
        rating,
        comment: (comment || '').slice(0, 500),
        verified: true,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'product_id,email_hash',
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, review: data });
  } catch (error: any) {
    console.error('POST /api/reviews error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/reviews - Delete a review
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { reviewId, email } = body;

    if (!reviewId || !email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const emailHash = hashEmail(email);

    const { error } = await supabase
      .from('reviews')
      .delete()
      .eq('id', reviewId)
      .eq('email_hash', emailHash);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE /api/reviews error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
