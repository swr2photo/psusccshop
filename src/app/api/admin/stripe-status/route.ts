/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/admin/stripe-status/route.ts
// Admin API — Stripe connection status check

import { NextRequest, NextResponse } from 'next/server';
import { isAdminEmailAsync, getSession } from '@/lib/auth';
import { secureJsonRequest, secureJsonResponse } from '@/lib/payload-crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Admin only
    const session = await getSession(request);
    if (!session?.user?.email || !(await isAdminEmailAsync(session.user.email))) {
      return await secureJsonResponse({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const secretKey = process.env.STRIPE_SECRET_KEY || '';
    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

    const hasSecretKey = Boolean(secretKey);
    const hasPublishableKey = Boolean(publishableKey);
    const hasWebhookSecret = Boolean(webhookSecret);

    // Detect test/live mode from key prefix
    const isTestMode = secretKey.startsWith('sk_test_') || publishableKey.startsWith('pk_test_');
    const isLiveMode = secretKey.startsWith('sk_live_') || publishableKey.startsWith('pk_live_');

    // Masked keys for display
    const maskedPublishableKey = publishableKey
      ? `${publishableKey.substring(0, 12)}...${publishableKey.slice(-4)}`
      : '';
    const maskedSecretKey = secretKey
      ? `${secretKey.substring(0, 10)}...${secretKey.slice(-4)}`
      : '';

    // Attempt to verify the key by calling Stripe /v1/account
    let accountVerified = false;
    let accountName = '';
    let accountCountry = '';
    let accountDefaultCurrency = '';
    let accountEmail = '';
    let capabilities: Record<string, string> = {};
    let verifyError = '';

    let accountId = '';
    let payoutsEnabled = false;
    let chargesEnabled = false;
    let detailsSubmitted = false;
    let currentlyDue: string[] = [];
    let payoutSchedule: Record<string, any> | null = null;
    let payoutBlockReasons: string[] = [];

    if (hasSecretKey) {
      try {
        const res = await fetch('https://api.stripe.com/v1/account', {
          headers: { Authorization: `Bearer ${secretKey}` },
        });

        if (res.ok) {
          const account = await res.json();
          accountVerified = true;
          accountId = account.id || '';
          accountName = account.settings?.dashboard?.display_name || account.business_profile?.name || '';
          accountCountry = account.country || '';
          accountDefaultCurrency = account.default_currency || '';
          accountEmail = account.email || '';
          capabilities = account.capabilities || {};
          payoutsEnabled = account.payouts_enabled ?? true;
          chargesEnabled = account.charges_enabled ?? true;
          detailsSubmitted = account.details_submitted ?? true;
          currentlyDue = account.requirements?.currently_due || [];
          payoutSchedule = account.settings?.payouts?.schedule || null;
        } else {
          const err = await res.json().catch(() => ({}));
          verifyError = err?.error?.message || `HTTP ${res.status}`;
        }
      } catch (e: any) /* eslint-disable-line @typescript-eslint/no-explicit-any */ {
        verifyError = e?.message || 'Network error';
      }
    }

    // Check balance to verify the key has proper permissions
    let balanceAvailable: { amount: number; currency: string }[] = [];
    let balancePending: { amount: number; currency: string }[] = [];

    if (accountVerified) {
      try {
        const balRes = await fetch('https://api.stripe.com/v1/balance', {
          headers: { Authorization: `Bearer ${secretKey}` },
        });
        if (balRes.ok) {
          const bal = await balRes.json();
          balanceAvailable = (bal.available || []).map((b: any) => ({
            amount: b.amount / 100,
            currency: b.currency,
          }));
          balancePending = (bal.pending || []).map((b: any) => ({
            amount: b.amount / 100,
            currency: b.currency,
          }));
        }
      } catch { /* non-critical */ }
    }

    // Build Payout Diagnostic Block Reasons
    if (!hasSecretKey) {
      payoutBlockReasons.push('ยังไม่ได้ตั้งค่า STRIPE_SECRET_KEY ในระบบ');
    } else if (!accountVerified) {
      payoutBlockReasons.push(`ไม่สามารถยืนยัน Stripe Account ได้: ${verifyError || 'API Key ไม่ถูกต้อง'}`);
    } else {
      if (isTestMode) {
        payoutBlockReasons.push('ระบบกำลังเปิดใช้งาน Test Mode (sk_test_) — เงินทั้งหมดเป็นเงินทดลอง ไม่สามารถสั่งถอนจริงเข้าบัญชีธนาคารได้');
      }
      if (!payoutsEnabled) {
        payoutBlockReasons.push('Stripe Account ของคุณปิดสิทธิ์ Payouts (payouts_enabled = false) — กรุณาตรวจสอบสถานะบัญชีใน Stripe Dashboard');
      }
      if (currentlyDue.length > 0) {
        payoutBlockReasons.push(`Stripe ต้องการข้อมูล/เอกสารยืนยันตัวตนเพิ่มเติม: ${currentlyDue.slice(0, 5).join(', ')}`);
      }
      const totalAvail = balanceAvailable.reduce((sum, b) => sum + b.amount, 0);
      const totalPending = balancePending.reduce((sum, b) => sum + b.amount, 0);
      if (totalAvail === 0 && totalPending > 0) {
        payoutBlockReasons.push('ยอดเงินคงเหลือยังอยู่ในสถานะ Pending Balance (รอระยะเวลาดำเนินการย้ายเข้า Available Balance ตามรอบ Payout)');
      } else if (totalAvail === 0 && totalPending === 0) {
        payoutBlockReasons.push('ยังไม่มีเงินคงเหลือในบัญชี Stripe (ยอด Available และ Pending เท่ากับ ฿0)');
      }
    }

    // Recent webhook events count (last 24 hours)
    let recentWebhookEvents = 0;
    if (accountVerified) {
      try {
        const since = Math.floor(Date.now() / 1000) - 86400;
        const evtRes = await fetch(
          `https://api.stripe.com/v1/events?limit=1&created[gte]=${since}`,
          { headers: { Authorization: `Bearer ${secretKey}` } }
        );
        if (evtRes.ok) {
          const evtData = await evtRes.json();
          recentWebhookEvents = evtData.data?.length || 0;
          // Use has_more to indicate if there are more
          if (evtData.has_more) recentWebhookEvents = 100; // indicates "many"
        }
      } catch { /* non-critical */ }
    }

    return await secureJsonResponse({
      success: true,
      data: {
        // Key presence
        hasSecretKey,
        hasPublishableKey,
        hasWebhookSecret,
        isTestMode,
        isLiveMode,
        maskedPublishableKey,
        maskedSecretKey,

        // Account verification
        accountVerified,
        accountId,
        accountName,
        accountCountry,
        accountDefaultCurrency,
        accountEmail,
        capabilities,
        payoutsEnabled,
        chargesEnabled,
        detailsSubmitted,
        currentlyDue,
        payoutSchedule,
        payoutBlockReasons,
        verifyError,

        // Balance
        balanceAvailable,
        balancePending,

        // Webhook activity
        recentWebhookEvents,

        // Webhook URL
        webhookUrl: `${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/payment/webhook/stripe`,

        // Supported events
        supportedWebhookEvents: [
          'payment_intent.succeeded',
          'payment_intent.payment_failed',
          'payment_intent.canceled',
          'charge.refunded',
        ],
      },
    });
  } catch (error) {
    console.error('[API] Stripe status error:', error);
    return await secureJsonResponse({ success: false, error: 'Failed to check Stripe status' }, { status: 500 });
  }
}
