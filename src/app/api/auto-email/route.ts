// Automated email notification system
// Sends transactional emails based on order status changes

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface EmailTemplate {
  subject: string;
  body: string;
}

function getOrderConfirmationTemplate(order: any, lang: 'th' | 'en'): EmailTemplate {
  const cart = typeof order.cart === 'string' ? JSON.parse(order.cart) : order.cart || [];
  const itemList = cart.map((item: any) => 
    `• ${item.name} (${item.size || '-'}) x${item.qty || 1} — ฿${(item.total || item.price || 0).toLocaleString()}`
  ).join('\n');

  if (lang === 'en') {
    return {
      subject: `Order Confirmed: ${order.ref} — PSU SCC Shop`,
      body: `Hi ${order.customer_name || 'Customer'},

Your order has been received! Here's your order summary:

📦 Order: ${order.ref}
📅 Date: ${new Date(order.created_at || Date.now()).toLocaleDateString('en-US')}

Items:
${itemList}

💰 Total: ฿${(order.total_amount || 0).toLocaleString()}

${order.shipping_method ? `🚚 Shipping: ${order.shipping_method}` : ''}

Please complete payment within the specified time to confirm your order.

Thank you for shopping with PSU SCC Shop! 🎉`,
    };
  }

  return {
    subject: `ยืนยันคำสั่งซื้อ: ${order.ref} — PSU SCC Shop`,
    body: `สวัสดีคุณ ${order.customer_name || 'ลูกค้า'},

ได้รับคำสั่งซื้อของคุณแล้ว! สรุปรายการดังนี้:

📦 เลขออเดอร์: ${order.ref}
📅 วันที่: ${new Date(order.created_at || Date.now()).toLocaleDateString('th-TH')}

รายการสินค้า:
${itemList}

💰 ยอดรวม: ฿${(order.total_amount || 0).toLocaleString()}

${order.shipping_method ? `🚚 การจัดส่ง: ${order.shipping_method}` : ''}

กรุณาชำระเงินภายในเวลาที่กำหนดเพื่อยืนยันคำสั่งซื้อ

ขอบคุณที่อุดหนุน PSU SCC Shop ค่ะ! 🎉`,
  };
}

function getPaymentReceivedTemplate(order: any, lang: 'th' | 'en'): EmailTemplate {
  if (lang === 'en') {
    return {
      subject: `Payment Confirmed: ${order.ref} — PSU SCC Shop`,
      body: `Hi ${order.customer_name || 'Customer'},

Your payment for order ${order.ref} has been verified! ✅

We're preparing your order and will notify you when it's ready.

💰 Amount: ฿${(order.total_amount || 0).toLocaleString()}

Thank you! 🎉`,
    };
  }

  return {
    subject: `ยืนยันการชำระเงิน: ${order.ref} — PSU SCC Shop`,
    body: `สวัสดีคุณ ${order.customer_name || 'ลูกค้า'},

การชำระเงินสำหรับออเดอร์ ${order.ref} ได้รับการยืนยันแล้ว! ✅

กำลังเตรียมสินค้าให้คุณ จะแจ้งให้ทราบเมื่อพร้อมส่ง/รับ

💰 ยอดชำระ: ฿${(order.total_amount || 0).toLocaleString()}

ขอบคุณค่ะ! 🎉`,
  };
}

function getShippingNotificationTemplate(order: any, trackingNumber: string, lang: 'th' | 'en'): EmailTemplate {
  if (lang === 'en') {
    return {
      subject: `Order Shipped: ${order.ref} — PSU SCC Shop`,
      body: `Hi ${order.customer_name || 'Customer'},

Great news! Your order ${order.ref} has been shipped! 🚚

${trackingNumber ? `📦 Tracking Number: ${trackingNumber}` : ''}

You can track your shipment in the order history section.

Thank you for your patience! 🎉`,
    };
  }

  return {
    subject: `จัดส่งแล้ว: ${order.ref} — PSU SCC Shop`,
    body: `สวัสดีคุณ ${order.customer_name || 'ลูกค้า'},

สินค้าออเดอร์ ${order.ref} ถูกจัดส่งแล้ว! 🚚

${trackingNumber ? `📦 เลขพัสดุ: ${trackingNumber}` : ''}

คุณสามารถติดตามสถานะได้ในประวัติคำสั่งซื้อ

ขอบคุณที่รอคอยค่ะ! 🎉`,
  };
}

// POST /api/auto-email - Send automated email based on event type
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, order, trackingNumber, lang = 'th' } = body;

    if (!type || !order) {
      return NextResponse.json({ error: 'Missing type or order' }, { status: 400 });
    }

    let template: EmailTemplate;
    switch (type) {
      case 'order_confirmation':
        template = getOrderConfirmationTemplate(order, lang);
        break;
      case 'payment_received':
        template = getPaymentReceivedTemplate(order, lang);
        break;
      case 'shipping_notification':
        template = getShippingNotificationTemplate(order, trackingNumber || '', lang);
        break;
      default:
        return NextResponse.json({ error: 'Unknown email type' }, { status: 400 });
    }

    const email = order.customer_email || order.email;
    if (!email) {
      return NextResponse.json({ error: 'No email address' }, { status: 400 });
    }

    // Send email using Resend
    const resendKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.EMAIL_FROM || 'SCC Shop <noreply@sccshop.com>';

    if (!resendKey) {
      console.warn('RESEND_API_KEY not set, skipping email');
      return NextResponse.json({ success: true, message: 'Email skipped (no API key)', template });
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: email,
        subject: template.subject,
        text: template.body,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Resend error: ${response.status} ${errBody}`);
    }

    const result = await response.json();

    // Log the email
    try {
      const { supabase } = await import('@/lib/supabase');
      await supabase.from('email_logs').insert({
        order_ref: order.ref,
        to_email: email,
        email_type: type,
        status: 'sent',
        metadata: { resendId: result.id, subject: template.subject },
      });
    } catch {
      // Log failure is non-critical
    }

    return NextResponse.json({ success: true, emailId: result.id });
  } catch (error: any) {
    console.error('POST /api/auto-email error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
