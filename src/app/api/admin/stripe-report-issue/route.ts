/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/admin/stripe-report-issue/route.ts
// Admin API — Create and log a Stripe Support / Diagnostic issue report

import { NextRequest, NextResponse } from 'next/server';
import { isAdminEmailAsync, getSession } from '@/lib/auth';
import { secureJsonResponse } from '@/lib/payload-crypto';
import { db } from '@/lib/db';
import { userLogs } from '@/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Admin check
    const session = await getSession(request);
    const userEmail = session?.user?.email;
    if (!userEmail || !(await isAdminEmailAsync(userEmail))) {
      return await secureJsonResponse({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { issueCategory, subject, description, userContactEmail } = body;

    if (!subject || !description) {
      return await secureJsonResponse(
        { success: false, error: 'กรุณากรอกหัวข้อและรายละเอียดปัญหา' },
        { status: 400 }
      );
    }

    // Collect current system environment state for Stripe
    const secretKey = process.env.STRIPE_SECRET_KEY || '';
    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';

    const isTestMode = secretKey.startsWith('sk_test_') || publishableKey.startsWith('pk_test_');

    let stripeAccountInfo: Record<string, any> = {
      hasSecretKey: Boolean(secretKey),
      hasPublishableKey: Boolean(publishableKey),
      isTestMode,
    };

    if (secretKey) {
      try {
        const res = await fetch('https://api.stripe.com/v1/account', {
          headers: { Authorization: `Bearer ${secretKey}` },
        });
        if (res.ok) {
          const acc = await res.json();
          stripeAccountInfo = {
            ...stripeAccountInfo,
            accountId: acc.id,
            accountCountry: acc.country,
            accountEmail: acc.email,
            payoutsEnabled: acc.payouts_enabled,
            chargesEnabled: acc.charges_enabled,
            detailsSubmitted: acc.details_submitted,
            currentlyDue: acc.requirements?.currently_due || [],
          };
        }
      } catch (err: any) {
        stripeAccountInfo.fetchError = err?.message || 'Network error';
      }
    }

    // Generate formatted Diagnostic Support Report Text
    const timestamp = new Date().toISOString();
    const supportReportText = `
==================================================
  STRIPE DIAGNOSTIC & SUPPORT ISSUE REPORT
==================================================
Timestamp: ${timestamp}
Reported By: ${userEmail}
Category: ${issueCategory || 'general'}
Subject: ${subject}

--- CONTACT DETAILS ---
Email: ${userContactEmail || userEmail}

--- ISSUE DESCRIPTION ---
${description}

--- STRIPE ACCOUNT DIAGNOSTICS ---
Stripe Secret Key Set: ${stripeAccountInfo.hasSecretKey ? 'YES' : 'NO'}
Stripe Publishable Key Set: ${stripeAccountInfo.hasPublishableKey ? 'YES' : 'NO'}
Mode: ${isTestMode ? 'TEST MODE (sk_test_)' : 'LIVE MODE (sk_live_)'}
Account ID: ${stripeAccountInfo.accountId || 'Unknown/Unverified'}
Account Email: ${stripeAccountInfo.accountEmail || 'N/A'}
Country: ${stripeAccountInfo.accountCountry || 'N/A'}
Payouts Enabled: ${stripeAccountInfo.payoutsEnabled ?? 'N/A'}
Charges Enabled: ${stripeAccountInfo.chargesEnabled ?? 'N/A'}
Details Submitted: ${stripeAccountInfo.detailsSubmitted ?? 'N/A'}
Currently Due Items: ${Array.isArray(stripeAccountInfo.currentlyDue) ? stripeAccountInfo.currentlyDue.join(', ') || 'None' : 'N/A'}
Fetch Error: ${stripeAccountInfo.fetchError || 'None'}
==================================================
`.trim();

    // Log issue to DB userLogs table
    try {
      await db.insert(userLogs).values({
        email: userEmail,
        name: session?.user?.name || 'Admin',
        action: 'STRIPE_ISSUE_REPORTED',
        details: subject,
        metadata: {
          category: issueCategory,
          description,
          contactEmail: userContactEmail || userEmail,
          stripeAccountInfo,
          reportText: supportReportText,
        },
      });
    } catch (logErr) {
      console.error('[StripeReportIssue] Failed to write log:', logErr);
    }

    return await secureJsonResponse({
      success: true,
      data: {
        message: 'บันทึกรายงานปัญหาเรียบร้อยแล้ว',
        reportText: supportReportText,
        stripeSupportUrl: 'https://support.stripe.com/contact',
      },
    });
  } catch (error: any) {
    console.error('[API] Stripe report issue error:', error);
    return await secureJsonResponse(
      { success: false, error: error?.message || 'Failed to report Stripe issue' },
      { status: 500 }
    );
  }
}
