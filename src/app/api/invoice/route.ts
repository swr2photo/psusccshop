// API route for generating invoice/receipt HTML (can be printed/saved as PDF)
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isResourceOwner, isAdminEmailAsync } from '@/lib/auth';
import { API_CACHE } from '@/lib/api-helpers';
import { buildInvoiceHtml } from '@/lib/invoice-html';
import { fetchStripeReceiptUrl, readStoredStripeReceiptUrl } from '@/lib/stripe-receipt';
import { isOrderPaidForReceipt } from '@/lib/shop-constants';
import { absoluteUrl } from '@/lib/site';
import { eq, desc } from 'drizzle-orm';
import QRCode from 'qrcode';

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

function wantsHtml(request: NextRequest): boolean {
  const mode = request.headers.get('sec-fetch-mode');
  const dest = request.headers.get('sec-fetch-dest');
  const accept = request.headers.get('accept') || '';
  return mode === 'navigate' || dest === 'document' || accept.includes('text/html');
}

function htmlErrorPage(opts: {
  title: string;
  message: string;
  receiptPath?: string;
  lang: 'th' | 'en';
}): string {
  const loginHint =
    opts.lang === 'en'
      ? 'Sign in on the shop, then open the receipt again from Order History.'
      : 'เข้าสู่ระบบที่หน้าร้าน แล้วเปิดใบเสร็จอีกครั้งจากประวัติคำสั่งซื้อ';
  const receiptHref = opts.receiptPath || '/';
  return `<!DOCTYPE html><html lang="${opts.lang}"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${opts.title}</title>
<style>body{font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#f4f4f5;color:#18181b}
.card{background:#fff;border:1px solid #e4e4e7;border-radius:12px;padding:28px;max-width:420px;text-align:center;box-shadow:0 8px 24px rgba(0,0,0,.06)}
a{display:inline-block;margin-top:14px;padding:10px 16px;border-radius:8px;background:#2563eb;color:#fff;text-decoration:none;font-weight:600}
p{color:#52525b;line-height:1.5}</style></head><body><div class="card"><h1 style="font-size:1.15rem;margin:0 0 8px">${opts.title}</h1><p>${opts.message}</p><p style="font-size:.85rem">${loginHint}</p><a href="${receiptHref}">${opts.lang === 'en' ? 'Open receipt page' : 'เปิดหน้าใบเสร็จ'}</a></div></body></html>`;
}

// GET /api/invoice?ref=xxx&lang=th
export async function GET(request: NextRequest) {
  const langParam = (request.nextUrl.searchParams.get('lang') || 'th') as 'th' | 'en';
  const refEarly = request.nextUrl.searchParams.get('ref') || '';
  const asHtml = wantsHtml(request);

  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    if (asHtml) {
      const receiptPath = refEarly
        ? `/receipt/${encodeURIComponent(refEarly)}?lang=${langParam}`
        : '/';
      return new NextResponse(
        htmlErrorPage({
          title: langParam === 'en' ? 'Receipt' : 'ใบเสร็จ',
          message: langParam === 'en' ? 'Please sign in' : 'กรุณาเข้าสู่ระบบ',
          receiptPath,
          lang: langParam,
        }),
        { status: 401, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
      );
    }
    return authResult;
  }

  try {
    const ref = request.nextUrl.searchParams.get('ref');
    const lang = langParam;

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

    if (!isOrderPaidForReceipt(order)) {
      return NextResponse.json({ error: 'Receipt available after payment is confirmed' }, { status: 403 });
    }

    const isStripePaid =
      readOrderField(order, 'paymentGateway', 'payment_gateway') === 'stripe' &&
      (order.paymentVerified === true || order.payment_verified === true);

    const stripeReceiptUrl = isStripePaid ? await resolveStripeReceiptUrl(order) : null;

    // ?stripe=only — jump straight to Stripe hosted receipt (legacy redirect behaviour)
    if (stripeReceiptUrl && request.nextUrl.searchParams.get('stripe') === 'only') {
      return NextResponse.redirect(stripeReceiptUrl, 302);
    }

    // Inline SVG QR — works under CSP and inside srcDoc iframes (no external img)
    const verifyUrl = absoluteUrl(`/receipt/${encodeURIComponent(ref)}?lang=${lang}`);
    let qrSvg: string | null = null;
    try {
      qrSvg = await QRCode.toString(verifyUrl, {
        type: 'svg',
        width: 110,
        margin: 1,
        errorCorrectionLevel: 'M',
        color: { dark: '#1e3a8a', light: '#ffffff' },
      });
    } catch (qrErr) {
      console.error('[Invoice] QR generate failed:', qrErr);
    }

    const html = buildInvoiceHtml(order, ref, lang, { stripeReceiptUrl, qrSvg });

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': API_CACHE.private,
      },
    });
  } catch (error: any) /* eslint-disable-line @typescript-eslint/no-explicit-any */ {
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
