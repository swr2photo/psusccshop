// src/app/api/admin/email/route.ts
// Admin email management API

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminWithPermission } from '@/lib/auth';
import { secureJsonRequest, secureJsonResponse } from '@/lib/payload-crypto';
import {
  sendEmail,
  getEmailLogsByOrder,
  getEmailLogsByEmail,
  generateCustomEmail,
  sendOrderStatusEmail,
  EmailLog,
  } from '@/lib/email';
import {
  getEmailLogsFromDb,
  getEmailLogStats,
  getOrderCustomerAggregates,
  getJson,
  getOrderByRef,
} from '@/lib/filebase';

// GET: Retrieve email logs
export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdminWithPermission('canSendEmail', request);
    if (!admin || admin instanceof NextResponse) {
      return admin instanceof NextResponse ? admin : await secureJsonResponse('Unauthorized', { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'logs';
    const orderRef = searchParams.get('orderRef');
    const email = searchParams.get('email');
    const limit = parseInt(searchParams.get('limit') || '100');

    let logs: EmailLog[] = [];

    switch (action) {
      case 'logs':
        if (orderRef) {
          logs = await getEmailLogsByOrder(orderRef);
        } else if (email) {
          logs = await getEmailLogsByEmail(email);
        } else {
          logs = await getEmailLogsFromDb(limit);
        }
        break;

      case 'stats': {
        const stats = await getEmailLogStats();
        return await secureJsonResponse({ stats });
      }

      case 'customers': {
        const { customers, totalCustomers } = await getOrderCustomerAggregates(500);
        return await secureJsonResponse({ customers, totalCustomers });
      }

      default:
        return await secureJsonResponse({ error: 'Invalid action' }, { status: 400 });
    }

    return await secureJsonResponse({ logs, total: logs.length });

  } catch (error: any) /* eslint-disable-line @typescript-eslint/no-explicit-any */ {
    console.error('[Email API] Error:', error);
    return await secureJsonResponse({ error: error.message }, { status: 500 });
  }
}

// POST: Send email
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdminWithPermission('canSendEmail', request);
    if (!admin || admin instanceof NextResponse) {
      return admin instanceof NextResponse ? admin : await secureJsonResponse('Unauthorized', { status: 401 });
    }

    const body = await secureJsonRequest(request);
    const { action, to, subject, message, type: _type, orderRef, recipients } = body;

    switch (action) {
      case 'send_custom':
        // Send custom email to single recipient
        if (!to || !subject || !message) {
          return await secureJsonResponse({ error: 'Missing required fields: to, subject, message' }, { status: 400 });
        }

        const template = generateCustomEmail({
          customerName: body.customerName || 'ลูกค้า',
          subject,
          message,
        });

        const result = await sendEmail({
          to,
          subject: template.subject,
          html: template.html,
          text: template.text,
          type: 'custom',
          orderRef,
          metadata: { sentBy: admin },
        });

        return await secureJsonResponse(result);

      case 'send_broadcast':
        // Send email to multiple recipients
        if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
          return await secureJsonResponse({ error: 'No recipients specified' }, { status: 400 });
        }

        if (!subject || !message) {
          return await secureJsonResponse({ error: 'Missing subject or message' }, { status: 400 });
        }

        const results = {
          total: recipients.length,
          sent: 0,
          failed: 0,
          details: [] as { email: string; success: boolean; error?: string }[],
        };

        for (const recipient of recipients) {
          const bcTemplate = generateCustomEmail({
            customerName: recipient.name || 'ลูกค้า',
            subject,
            message,
          });

          const bcResult = await sendEmail({
            to: recipient.email,
            subject: bcTemplate.subject,
            html: bcTemplate.html,
            text: bcTemplate.text,
            type: 'broadcast',
            metadata: { sentBy: admin, broadcastId: Date.now() },
          });

          if (bcResult.success) {
            results.sent++;
          } else {
            results.failed++;
          }

          results.details.push({
            email: recipient.email,
            success: bcResult.success,
            error: bcResult.error,
          });

          // Small delay between emails to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        return await secureJsonResponse(results);

      case 'send_order_status':
        // Manually trigger order status email
        if (!orderRef) {
          return await secureJsonResponse({ error: 'Missing orderRef' }, { status: 400 });
        }

        const order = await getOrderByRef(orderRef);

        if (!order) {
          return await secureJsonResponse({ error: 'Order not found' }, { status: 404 });
        }

        const status = body.status || order.status;
        await sendOrderStatusEmail(order, status);

        return await secureJsonResponse({ success: true, message: `Email sent for order ${orderRef} with status ${status}` });

      case 'resend':
        // Resend a failed email
        const { logId } = body;
        if (!logId) {
          return await secureJsonResponse({ error: 'Missing logId' }, { status: 400 });
        }

        const log = await getJson<EmailLog>(`email-logs/${logId}.json`);
        if (!log) {
          return await secureJsonResponse({ error: 'Email log not found' }, { status: 404 });
        }

        // Note: We can't resend the exact email since we don't store the full HTML
        // Instead, this would need to regenerate the email based on order data
        return await secureJsonResponse({ error: 'Resend not implemented - regenerate from order instead' }, { status: 501 });

      default:
        return await secureJsonResponse({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error: any) /* eslint-disable-line @typescript-eslint/no-explicit-any */ {
    console.error('[Email API] Error:', error);
    return await secureJsonResponse({ error: error.message }, { status: 500 });
  }
}
