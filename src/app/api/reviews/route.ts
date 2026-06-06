// API route for product reviews
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { reviews } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { createHash } from 'crypto';

function hashEmail(email: string): string {
  return createHash('sha256').update(email.toLowerCase().trim()).digest('hex');
}

// GET /api/reviews?productId=xxx
export async function GET(request: NextRequest) {
  try {
    const productId = request.nextUrl.searchParams.get('productId');
    
    let data;
    if (productId) {
      data = await db
        .select()
        .from(reviews)
        .where(eq(reviews.productId, productId))
        .orderBy(desc(reviews.createdAt))
        .limit(100);
    } else {
      data = await db
        .select()
        .from(reviews)
        .orderBy(desc(reviews.createdAt))
        .limit(100);
    }

    // Calculate average rating per product
    const reviewData = (data || []).map((r: any) => ({
      id: r.id,
      productId: r.productId,
      userName: r.userName || 'Anonymous',
      userImage: r.userImage,
      rating: r.rating,
      comment: r.comment || '',
      date: r.createdAt?.toISOString() || new Date().toISOString(),
      verified: r.verified,
      helpful: r.helpfulCount || 0,
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
    const existing = await db
      .select()
      .from(reviews)
      .where(
        and(
          eq(reviews.productId, productId),
          eq(reviews.emailHash, emailHash)
        )
      )
      .limit(1);

    let resultData;
    if (existing.length > 0) {
      const updated = await db
        .update(reviews)
        .set({
          userName: userName || 'Anonymous',
          userImage: userImage || null,
          rating,
          comment: (comment || '').slice(0, 500),
          verified: true,
          updatedAt: new Date(),
        })
        .where(eq(reviews.id, existing[0].id))
        .returning();
      resultData = updated[0];
    } else {
      const inserted = await db
        .insert(reviews)
        .values({
          productId,
          emailHash,
          userName: userName || 'Anonymous',
          userImage: userImage || null,
          rating,
          comment: (comment || '').slice(0, 500),
          verified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();
      resultData = inserted[0];
    }

    return NextResponse.json({ success: true, review: resultData });
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

    await db
      .delete(reviews)
      .where(
        and(
          eq(reviews.id, reviewId),
          eq(reviews.emailHash, emailHash)
        )
      );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE /api/reviews error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
