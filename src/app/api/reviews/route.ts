// API route for product reviews
import { NextRequest, NextResponse } from 'next/server';
import { withBackendProxy } from '@/lib/backend-proxy';
import { db } from '@/lib/db';
import { reviews } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { createHash } from 'crypto';
import { requireAuth, authOptions } from '@/lib/auth';
import { getServerSession } from 'next-auth';
import { rateLimitOrNull, API_CACHE } from '@/lib/api-helpers';
import { getCached, invalidateCachePrefix, CACHE_TTL } from '@/lib/server-cache';

import { getOrdersByEmail } from '@/lib/supabase';

const PAID_STATUSES = new Set(['PAID', 'COMPLETED', 'SHIPPED', 'READY']);

async function hasPurchasedProduct(email: string, productId: string): Promise<boolean> {
  const { orders: userOrders } = await getOrdersByEmail(email, { limit: 500 });
  return userOrders.some((order: Record<string, unknown>) => {
    if (!PAID_STATUSES.has(String(order.status || '').toUpperCase())) return false;
    const cart = (order.cart || order.items || []) as Array<Record<string, unknown>>;
    return cart.some((item) => {
      const id = String(item.productId || item.id || '').split('-')[0];
      return id === productId;
    });
  });
}

function hashEmail(email: string): string {
  return createHash('sha256').update(email.toLowerCase().trim()).digest('hex');
}

function obfuscateName(name: string): string {
  if (!name || name === 'Anonymous' || name.toLowerCase() === 'anonymous') return 'Anonymous';
  const parts = name.trim().split(/\s+/);
  const first = parts[0];
  let obf = first;
  if (first.length <= 2) {
    obf = first.charAt(0) + '*';
  } else {
    obf = first.charAt(0) + '*'.repeat(first.length - 2) + first.charAt(first.length - 1);
  }
  if (parts.length > 1) {
    return `${obf} ${parts[parts.length - 1].charAt(0)}*.`;
  }
  return obf;
}

// GET /api/reviews?productId=xxx
async function GETHandler(request: NextRequest) {
  try {
    const productId = request.nextUrl.searchParams.get('productId');
    const cacheKey = productId ? `reviews:product:${productId}` : 'reviews:all';

    const reviewData = await getCached(cacheKey, CACHE_TTL.reviews, async () => {
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

      return (data || []).map((r: any) => ({
        id: r.id,
        productId: r.productId,
        emailHash: r.emailHash,
        userName: obfuscateName(r.userName || 'Anonymous'),
        userImage: r.userImage,
        rating: r.rating,
        comment: r.comment || '',
        date: r.createdAt?.toISOString() || new Date().toISOString(),
        verified: r.verified,
        helpful: r.helpfulCount || 0,
      }));
    });

    const session = await getServerSession(authOptions);
    const userEmailHash = session?.user?.email ? hashEmail(session.user.email) : null;

    const responseReviews = reviewData.map((r: any) => {
      const { emailHash, ...rest } = r;
      return {
        ...rest,
        isOwner: userEmailHash ? emailHash === userEmailHash : false
      };
    });

    return NextResponse.json(
      { reviews: responseReviews },
      { headers: { 'Cache-Control': API_CACHE.medium } }
    );
  } catch (error: any) {
    console.error('GET /api/reviews error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export const GET = withBackendProxy(GETHandler);

// POST /api/reviews - Create or update a review
export async function POST(request: NextRequest) {
  const rateLimited = await rateLimitOrNull(request, { maxRequests: 10, windowSeconds: 60, prefix: 'reviews' });
  if (rateLimited) return rateLimited;

  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await request.json();
    const { productId, rating, comment } = body;

    if (!productId || !rating) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const email = authResult.email;
    const session = await getServerSession(authOptions);
    const userName = session?.user?.name || 'Anonymous';
    const userImage = session?.user?.image || null;

    if (rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating must be 1-5' }, { status: 400 });
    }

    const emailHash = hashEmail(email);
    const verified = await hasPurchasedProduct(email, productId);

    // Insert new review (allow multiple reviews)
    const inserted = await db
      .insert(reviews)
      .values({
        productId,
        emailHash,
        userName,
        userImage,
        rating,
        comment: (comment || '').slice(0, 500),
        verified,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    const resultData = inserted[0];

    invalidateCachePrefix('reviews:');

    return NextResponse.json({ success: true, review: resultData });
  } catch (error: any) {
    console.error('POST /api/reviews error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT /api/reviews - Update an existing review
export async function PUT(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await request.json();
    const { id, rating, comment } = body;

    if (!id || !rating) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating must be 1-5' }, { status: 400 });
    }

    const emailHash = hashEmail(authResult.email);

    // Verify ownership
    const existing = await db.select().from(reviews).where(eq(reviews.id, id)).limit(1);
    if (existing.length === 0) return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    if (existing[0].emailHash !== emailHash) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    const updated = await db
      .update(reviews)
      .set({
        rating,
        comment: (comment || '').slice(0, 500),
        updatedAt: new Date(),
      })
      .where(eq(reviews.id, id))
      .returning();

    invalidateCachePrefix('reviews:');
    return NextResponse.json(updated[0]);
  } catch (error: any) {
    console.error('PUT /api/reviews error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/reviews?id=xxx
export async function DELETE(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const id = request.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing review id' }, { status: 400 });

    const emailHash = hashEmail(authResult.email);

    // Verify ownership
    const existing = await db.select().from(reviews).where(eq(reviews.id, id)).limit(1);
    if (existing.length === 0) return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    if (existing[0].emailHash !== emailHash) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    await db.delete(reviews).where(eq(reviews.id, id));

    invalidateCachePrefix('reviews:');
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE /api/reviews error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
