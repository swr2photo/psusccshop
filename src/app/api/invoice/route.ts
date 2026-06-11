// API route for generating invoice/receipt HTML (can be printed/saved as PDF)
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isResourceOwner, isAdminEmailAsync } from '@/lib/auth';
import { API_CACHE } from '@/lib/api-helpers';
import { buildInvoiceHtml } from '@/lib/invoice-html';
import { fetchStripeReceiptUrl, readStoredStripeReceiptUrl } from '@/lib/stripe-receipt';
import { eq, desc } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveStripeReceiptUrl(order: Record<string, unknown>): Promise<string | null> {
  const stored = readStoredStripeReceiptUrl(order.slipData ?? order.slip_data);
  if (stored) return stored;

  const orderId = order.id;
  if (!orderId || typeof orderId !== 'string') return null;

  try {
    const { db } = await import('@/lib/db');
    const { paymentTransactions } = await import('@/db/schema');
    const txRows = await db
      .select({ gatewayChargeId: paymentTransactions.gatewayChargeId })
      .from(paymentTransactions)
      .where(eq(paymentTransactions.orderId, orderId))
      .orderBy(desc(paymentTransactions.createdAt))
      .limit(1);
    const intentId = txRows[0]?.gatewayChargeId;
    if (!intentId) return null;
    return fetchStripeReceiptUrl(intentId);
  } catch (error) {
    console.error('[Invoice] Stripe receipt lookup failed:', error);
    return null;
  }
}

// GET /api/invoice?ref=xxx&lang=th
export async function GET(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  try {
    const ref = request.nextUrl.searchParams.get('ref');
    const lang = (request.nextUrl.searchParams.get('lang') || 'th') as 'th' | 'en';

    if (!ref) {
      return NextResponse.json({ error: 'Missing order reference' }, { status: 400 });
    }

    let order: Record<string, unknown> | null = null;

    try {
      const { db } = await import('@/lib/db');
      const { orders } = await import('@/db/schema');
      const data = await db.select().from(orders).where(eq(orders.ref, ref)).limit(1);
      if (data[0]) order = data[0] as Record<string, unknown>;
    } catch (err) {
      console.error('Invoice DB fetch error:', err);
    }

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const orderEmail = readOrderField(order, 'customerEmail', 'customer_email', 'email');
    const userEmail = authResult.email;
    if (!(await isAdminEmailAsync(userEmail)) && !isResourceOwner(orderEmail, userEmail)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const isStripePaid =
      readOrderField(order, 'paymentGateway', 'payment_gateway') === 'stripe' &&
      (order.paymentVerified === true || order.payment_verified === true);

    const stripeReceiptUrl = isStripePaid ? await resolveStripeReceiptUrl(order) : null;

    // ?stripe=only — jump straight to Stripe hosted receipt (legacy redirect behaviour)
    if (stripeReceiptUrl && request.nextUrl.searchParams.get('stripe') === 'only') {
      return NextResponse.redirect(stripeReceiptUrl, 302);
    }

    const html = buildInvoiceHtml(order, ref, lang, { stripeReceiptUrl });

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': API_CACHE.private,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Invoice error';
    console.error('GET /api/invoice error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function readOrderField(order: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const val = order[key];
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      return String(val).trim();
    }
  }
  return '';
}
