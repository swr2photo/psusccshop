// API route for generating Electronic Payment Notice (หนังสือแจ้งชำระเงินอิเล็กทรอนิกส์) HTML
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isResourceOwner, isAdminEmailAsync } from '@/lib/auth';
import { API_CACHE } from '@/lib/api-helpers';
import { buildPaymentNoticeHtml } from '@/lib/invoice-html';
import { absoluteUrl } from '@/lib/site';
import { eq } from 'drizzle-orm';
import QRCode from 'qrcode';
import { secureJsonResponse } from '@/lib/payload-crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function wantsHtml(request: NextRequest): boolean {
  const mode = request.headers.get('sec-fetch-mode');
  const dest = request.headers.get('sec-fetch-dest');
  const accept = request.headers.get('accept') || '';
  return mode === 'navigate' || dest === 'document' || accept.includes('text/html');
}

function htmlErrorPage(opts: {
  title: string;
  message: string;
  path?: string;
  lang: 'th' | 'en';
}): string {
  const loginHint =
    opts.lang === 'en'
      ? 'Sign in on the shop to view this payment notice.'
      : 'กรุณาเข้าสู่ระบบเพื่อดูหนังสือแจ้งชำระเงินอิเล็กทรอนิกส์';
  const href = opts.path || '/';
  return `<!DOCTYPE html><html lang="${opts.lang}"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${opts.title}</title>
<style>body{font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#f4f4f5;color:#18181b}
.card{background:#fff;border:1px solid #e4e4e7;border-radius:12px;padding:28px;max-width:420px;text-align:center;box-shadow:0 8px 24px rgba(0,0,0,.06)}
a{display:inline-block;margin-top:14px;padding:10px 16px;border-radius:8px;background:#1e3a5f;color:#fff;text-decoration:none;font-weight:600}
p{color:#52525b;line-height:1.5}</style></head><body><div class="card"><h1 style="font-size:1.15rem;margin:0 0 8px">${opts.title}</h1><p>${opts.message}</p><p style="font-size:.85rem">${loginHint}</p><a href="${href}">${opts.lang === 'en' ? 'Back to Shop' : 'กลับสู่ร้านค้า'}</a></div></body></html>`;
}

// GET /api/payment-notice?ref=xxx&lang=th
export async function GET(request: NextRequest) {
  const langParam = (request.nextUrl.searchParams.get('lang') || 'th') as 'th' | 'en';
  const refEarly = request.nextUrl.searchParams.get('ref') || '';
  const asHtml = wantsHtml(request);

  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    if (asHtml) {
      const path = refEarly ? `/orders/${encodeURIComponent(refEarly)}` : '/';
      return new NextResponse(
        htmlErrorPage({
          title: langParam === 'en' ? 'Payment Notice' : 'หนังสือแจ้งชำระเงิน',
          message: langParam === 'en' ? 'Please sign in' : 'กรุณาเข้าสู่ระบบ',
          path,
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
      return await secureJsonResponse({ error: 'Missing order reference' }, { status: 400 });
    }

    let order: Record<string, unknown> | null = null;

    try {
      const { db } = await import('@/lib/db');
      const { orders } = await import('@/db/schema');
      const data = await db.select().from(orders).where(eq(orders.ref, ref)).limit(1);
      if (data[0]) order = data[0] as Record<string, unknown>;
    } catch (err) {
      console.error('[PaymentNotice] DB fetch error:', err);
    }

    if (!order) {
      return await secureJsonResponse({ error: 'Order not found' }, { status: 404 });
    }

    const orderEmail = readOrderField(order, 'customerEmail', 'customer_email', 'email');
    const userEmail = authResult.email;
    if (!(await isAdminEmailAsync(userEmail)) && !isResourceOwner(orderEmail, userEmail)) {
      return await secureJsonResponse({ error: 'Forbidden' }, { status: 403 });
    }

    const verifyUrl = absoluteUrl(`/orders/${encodeURIComponent(ref)}?lang=${lang}`);
    const paymentUrl = absoluteUrl(`/payment/${encodeURIComponent(ref)}`);

    let qrSvg: string | null = null;
    let paymentQrSvg: string | null = null;

    try {
      qrSvg = await QRCode.toString(verifyUrl, {
        type: 'svg',
        width: 110,
        margin: 1,
        errorCorrectionLevel: 'M',
        color: { dark: '#1e3a5f', light: '#ffffff' },
      });
    } catch (qrErr) {
      console.error('[PaymentNotice] QR generate failed:', qrErr);
    }

    try {
      paymentQrSvg = await QRCode.toString(paymentUrl, {
        type: 'svg',
        width: 130,
        margin: 1,
        errorCorrectionLevel: 'M',
        color: { dark: '#047857', light: '#ffffff' },
      });
    } catch (pQrErr) {
      console.error('[PaymentNotice] Payment QR generate failed:', pQrErr);
    }

    const html = buildPaymentNoticeHtml(order, ref, lang, { qrSvg, paymentQrSvg, paymentUrl });

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': API_CACHE.private,
      },
    });
  } catch (error: any) {
    const message = error instanceof Error ? error.message : 'Payment notice error';
    console.error('GET /api/payment-notice error:', error);
    return await secureJsonResponse({ error: message }, { status: 500 });
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
