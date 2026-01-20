// src/app/api/admin/email/route.ts
// Admin email management API

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import {
  sendEmail,
  getEmailLogs,
  getEmailLogsByOrder,
  getEmailLogsByEmail,
  generateCustomEmail,
  sendOrderStatusEmail,
  EmailLog,
  EmailType,
} from '@/lib/email';
import { getJson, listKeys } from '@/lib/filebase';

// GET: Retrieve email logs
export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
          logs = await getEmailLogs(limit);
        }
        break;

      case 'stats':
        const allLogs = await getEmailLogs(1000);
        const stats = {
          total: allLogs.length,
          sent: allLogs.filter(l => l.status === 'sent').length,
          failed: allLogs.filter(l => l.status === 'failed').length,
          pending: allLogs.filter(l => l.status === 'pending').length,
          byType: {} as Record<string, number>,
          last24h: allLogs.filter(l => {
            const sent = new Date(l.sentAt).getTime();
            const now = Date.now();
            return now - sent < 24 * 60 * 60 * 1000;
          }).length,
          last7days: allLogs.filter(l => {
            const sent = new Date(l.sentAt).getTime();
            const now = Date.now();
            return now - sent < 7 * 24 * 60 * 60 * 1000;
          }).length,
        };

        allLogs.forEach(log => {
          stats.byType[log.type] = (stats.byType[log.type] || 0) + 1;
        });

        return NextResponse.json({ stats });

      case 'customers':
        // Get unique customer emails from orders
        const orderKeys = await listKeys('orders/');
        const emails = new Set<string>();
        const customers: { email: string; name: string; orderCount: number }[] = [];
        const customerMap = new Map<string, { name: string; count: number }>();

        for (const key of orderKeys) {
          if (key.endsWith('.json') && !key.includes('/index/')) {
            const order = await getJson<any>(key);
            if (order?.customerEmail || order?.email) {
              const customerEmail = order.customerEmail || order.email;
              const customerName = order.customerName || order.name || 'ไม่ระบุชื่อ';
              
              if (!customerMap.has(customerEmail)) {
                customerMap.set(customerEmail, { name: customerName, count: 1 });
              } else {
                const existing = customerMap.get(customerEmail)!;
                existing.count++;
              }
            }
          }
        }

        customerMap.forEach((value, email) => {
          customers.push({
            email,
            name: value.name,
            orderCount: value.count,
          });
        });

        return NextResponse.json({
          customers: customers.sort((a, b) => b.orderCount - a.orderCount),
          totalCustomers: customers.length,
        });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json({ logs, total: logs.length });

  } catch (error: any) {
    console.error('[Email API] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Send email
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, to, subject, message, type, orderRef, recipients } = body;

    switch (action) {
      case 'send_custom':
        // Send custom email to single recipient
        if (!to || !subject || !message) {
          return NextResponse.json({ error: 'Missing required fields: to, subject, message' }, { status: 400 });
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

        return NextResponse.json(result);

      case 'send_broadcast':
        // Send email to multiple recipients
        if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
          return NextResponse.json({ error: 'No recipients specified' }, { status: 400 });
        }

        if (!subject || !message) {
          return NextResponse.json({ error: 'Missing subject or message' }, { status: 400 });
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

        return NextResponse.json(results);

      case 'send_order_status':
        // Manually trigger order status email
        if (!orderRef) {
          return NextResponse.json({ error: 'Missing orderRef' }, { status: 400 });
        }

        // Get order data
        const orderKeys = await listKeys(`orders/`);
        let order = null;

        for (const key of orderKeys) {
          if (key.includes(orderRef)) {
            order = await getJson(key);
            break;
          }
        }

        if (!order) {
          return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        const status = body.status || order.status;
        await sendOrderStatusEmail(order, status);

        return NextResponse.json({ success: true, message: `Email sent for order ${orderRef} with status ${status}` });

      case 'resend':
        // Resend a failed email
        const { logId } = body;
        if (!logId) {
          return NextResponse.json({ error: 'Missing logId' }, { status: 400 });
        }

        const log = await getJson<EmailLog>(`email-logs/${logId}.json`);
        if (!log) {
          return NextResponse.json({ error: 'Email log not found' }, { status: 404 });
        }

        // Note: We can't resend the exact email since we don't store the full HTML
        // Instead, this would need to regenerate the email based on order data
        return NextResponse.json({ error: 'Resend not implemented - regenerate from order instead' }, { status: 501 });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error: any) {
    console.error('[Email API] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
