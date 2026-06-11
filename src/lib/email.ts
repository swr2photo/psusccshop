// src/lib/email.ts
// Email service for sending notifications to customers

import { putJson, getJson, listKeys } from './filebase';

// ==================== TYPES ====================
export interface EmailLog {
  id: string;
  to: string;
  subject: string;
  type: EmailType;
  status: 'sent' | 'failed' | 'pending';
  orderRef?: string;
  sentAt: string;
  error?: string;
  metadata?: Record<string, any>;
}

export type EmailType = 
  | 'order_confirmation'
  | 'payment_received'
  | 'order_ready'
  | 'order_shipped'
  | 'order_completed'
  | 'order_cancelled'
  | 'custom'
  | 'broadcast';

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  type: EmailType;
  orderRef?: string;
  metadata?: Record<string, any>;
}

// ==================== EMAIL CONFIGURATION ====================
const DEFAULT_EMAIL_FROM = 'SCC Shop <no_reply@psuscc.club>';
const SHOP_NAME = 'SCC Shop';

function getResendApiKey(): string | undefined {
  return process.env.RESEND_API_KEY?.trim() || undefined;
}

function getEmailFrom(): string {
  return process.env.EMAIL_FROM?.trim() || DEFAULT_EMAIL_FROM;
}

function getShopUrl(): string {
  return process.env.NEXT_PUBLIC_BASE_URL || 'https://sccshop.psusci.club';
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SUPPORT_EMAIL = 'psuscc@psusci.club';

/** Extract no-reply mailbox from EMAIL_FROM for reply_to header. */
function getNoReplyAddress(): string {
  const from = getEmailFrom();
  const bracket = from.match(/<([^>]+)>/);
  if (bracket?.[1]) return bracket[1].trim().toLowerCase();
  if (EMAIL_RE.test(from.trim())) return from.trim().toLowerCase();
  return 'no_reply@psuscc.club';
}

/** Resolve recipient email from order objects (legacy + current field names). */
export function getOrderRecipientEmail(order: {
  customerEmail?: string | null;
  email?: string | null;
  customer_email?: string | null;
} | null | undefined): string {
  const raw = order?.customerEmail || order?.email || order?.customer_email || '';
  return raw.trim().toLowerCase();
}

function extractFromDomain(from: string): string | null {
  const match = from.match(/<([^>]+)>/) || from.match(/([\w.-]+@[\w.-]+\.\w+)/);
  const email = (match?.[1] || from).trim();
  const domain = email.split('@')[1]?.toLowerCase();
  return domain || null;
}

function parseResendError(result: unknown, status: number, from?: string): string {
  let message = '';
  if (result && typeof result === 'object') {
    const r = result as Record<string, unknown>;
    if (typeof r.message === 'string' && r.message) message = r.message;
    else if (Array.isArray(r.errors) && r.errors.length > 0) {
      const first = r.errors[0] as Record<string, unknown>;
      if (typeof first.message === 'string') message = first.message;
    }
  }
  if (!message) message = `Resend API error (${status})`;

  if (/domain is not verified/i.test(message) && from) {
    const domain = extractFromDomain(from);
    if (domain) {
      message += ` — verify ${domain} at https://resend.com/domains or set EMAIL_FROM to an address on a verified domain (e.g. no_reply@psuscc.club).`;
    }
  }
  return message;
}

// ==================== EMAIL LOG HELPERS ====================
const emailLogKey = (id: string) => `email-logs/${id}.json`;

export async function saveEmailLog(log: EmailLog & { from?: string; html?: string; text?: string; body?: string }): Promise<void> {
  const from = log.from || getEmailFrom();
  const body = log.body || log.html || log.text || '';
  await putJson(emailLogKey(log.id), { ...log, from, body });

  // Also update index by date
  try {
    const date = new Date(log.sentAt);
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const indexKey = `email-logs/index/${dateKey}.json`;
    const existing = (await getJson<string[]>(indexKey)) || [];
    if (!existing.includes(log.id)) {
      await putJson(indexKey, [...existing, log.id]);
    }
  } catch (indexError) {
    console.warn('[Email] Failed to update email log index:', indexError);
  }
}

export async function getEmailLogs(limit = 100): Promise<EmailLog[]> {
  const keys = await listKeys('email-logs/');
  const logKeys = keys.filter(k => k.endsWith('.json') && !k.includes('/index/'));
  // listKeys already returns newest-first from the database
  const sortedKeys = logKeys.slice(0, limit);
  
  const logs = await Promise.all(
    sortedKeys.map(async (k) => {
      const log = await getJson<EmailLog>(k);
      return log;
    })
  );
  
  return logs.filter(Boolean) as EmailLog[];
}

export async function getEmailLogsByOrder(orderRef: string): Promise<EmailLog[]> {
  const allLogs = await getEmailLogs(500);
  return allLogs.filter(log => log.orderRef === orderRef);
}

export async function getEmailLogsByEmail(email: string): Promise<EmailLog[]> {
  const allLogs = await getEmailLogs(500);
  return allLogs.filter(log => log.to.toLowerCase() === email.toLowerCase());
}

// ==================== SEND EMAIL ====================
export async function sendEmail(options: SendEmailOptions): Promise<{ success: boolean; error?: string; id?: string }> {
  const logId = `email-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const to = options.to?.trim().toLowerCase();
  const from = getEmailFrom();
  const textBody = options.text || stripHtml(options.html);

  const log: EmailLog & { from: string; html: string; text: string } = {
    id: logId,
    to,
    from,
    subject: options.subject,
    type: options.type,
    status: 'pending',
    orderRef: options.orderRef,
    sentAt: new Date().toISOString(),
    metadata: options.metadata,
    html: options.html,
    text: textBody,
  };

  const persistLog = async () => {
    try {
      await saveEmailLog(log);
    } catch (saveError) {
      console.error('[Email] Failed to persist email log:', saveError);
    }
  };

  if (!to || !EMAIL_RE.test(to)) {
    const error = 'Invalid or missing recipient email address';
    log.status = 'failed';
    log.error = error;
    await persistLog();
    return { success: false, error, id: logId };
  }

  const apiKey = getResendApiKey();
  if (!apiKey) {
    const error = 'RESEND_API_KEY is not configured — email was not sent';
    console.error('[Email]', error, { to, subject: options.subject, type: options.type });
    log.status = 'failed';
    log.error = error;
    log.metadata = { ...log.metadata, mode: 'log_only' };
    await persistLog();
    return { success: false, error, id: logId };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to,
        reply_to: getNoReplyAddress(),
        subject: options.subject,
        html: options.html,
        text: textBody,
        headers: {
          'Auto-Submitted': 'auto-generated',
          'X-Auto-Response-Suppress': 'All',
          Precedence: 'bulk',
        },
      }),
    });

    let result: Record<string, unknown> = {};
    try {
      result = await response.json();
    } catch {
      result = {};
    }

    if (!response.ok) {
      throw new Error(parseResendError(result, response.status, from));
    }

    log.status = 'sent';
    log.metadata = { ...log.metadata, resendId: result.id };
    await persistLog();

    console.log('[Email] Sent successfully:', { to, subject: options.subject, id: result.id });
    return { success: true, id: logId };
  } catch (error: any) {
    log.status = 'failed';
    log.error = error.message;
    await persistLog();

    console.error('[Email] Failed to send:', { to, error: error.message });
    return { success: false, error: error.message, id: logId };
  }
}

// ==================== EMAIL TEMPLATES ====================
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function baseTemplate(content: string, preheader?: string): string {
  const year = new Date().getFullYear();
  return `
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${SHOP_NAME}</title>
  ${preheader ? `<span style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${preheader}</span>` : ''}
  <style>
    body { margin: 0; padding: 0; font-family: 'Sarabun', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #eef2f6; color: #1f2937; }
    .wrapper { padding: 24px 12px; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #d8dee6; border-radius: 4px; overflow: hidden; }
    .header { background: #1e3a5f; padding: 28px 32px; border-bottom: 3px solid #c9a227; }
    .header h1 { margin: 0; color: #ffffff; font-size: 22px; font-weight: 700; letter-spacing: 0.3px; }
    .header p { margin: 6px 0 0; color: rgba(255,255,255,0.88); font-size: 13px; }
    .content { padding: 32px; font-size: 15px; line-height: 1.75; color: #374151; }
    .content h2 { color: #1e3a5f; font-size: 20px; font-weight: 700; margin: 0 0 16px; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px; }
    .content h3 { color: #1e3a5f; font-size: 16px; font-weight: 700; margin: 24px 0 12px; }
    .content p { margin: 0 0 14px; }
    .box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 18px 20px; margin: 18px 0; }
    .box-success { border-color: #86efac; background: #f0fdf4; }
    .box-warning { border-color: #fcd34d; background: #fffbeb; }
    .box-error { border-color: #fca5a5; background: #fef2f2; }
    .box-info { border-color: #93c5fd; background: #eff6ff; }
    .btn { display: inline-block; padding: 12px 24px; background: #1e3a5f; color: #ffffff !important; text-decoration: none; border-radius: 4px; font-weight: 600; font-size: 14px; margin: 16px 0; }
    .order-item { display: flex; justify-content: space-between; gap: 12px; padding: 12px 0; border-bottom: 1px solid #e5e7eb; }
    .order-item:last-child { border-bottom: none; }
    .total { font-size: 18px; font-weight: 700; color: #1e3a5f; }
    .status-badge { display: inline-block; padding: 4px 10px; border-radius: 4px; font-size: 12px; font-weight: 700; letter-spacing: 0.2px; }
    .status-success { background: #dcfce7; color: #166534; border: 1px solid #86efac; }
    .status-pending { background: #fef3c7; color: #92400e; border: 1px solid #fcd34d; }
    .status-cancelled { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
    .noreply { background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 4px; padding: 12px 14px; margin-top: 20px; font-size: 12px; color: #64748b; line-height: 1.6; }
    .footer { background: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e5e7eb; }
    .footer p { margin: 0 0 6px; color: #64748b; font-size: 12px; line-height: 1.6; }
    .footer a { color: #1e3a5f; text-decoration: none; }
    .sign-off { margin-top: 24px; color: #374151; }
    @media (max-width: 600px) {
      .content { padding: 22px 18px; }
      .header { padding: 22px 18px; }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <h1>${SHOP_NAME}</h1>
        <p>ชุมนุมคอมพิวเตอร์ คณะวิทยาศาสตร์ มหาวิทยาลัยสงขลานครินทร์</p>
      </div>
      <div class="content">
        ${content}
        <p class="sign-off">ขอแสดงความนับถือ<br><strong>${SHOP_NAME}</strong></p>
        <div class="noreply">
          <strong>อีเมลฉบับนี้ส่งจากระบบอัตโนมัติ (no-reply)</strong><br>
          กรุณาอย่าตอบกลับอีเมลนี้ หากต้องการสอบถามเพิ่มเติม กรุณาติดต่อผ่านระบบแชทบนเว็บไซต์หรืออีเมล ${SUPPORT_EMAIL}
        </div>
      </div>
      <div class="footer">
        <p>&copy; ${year} ${SHOP_NAME} — ชุมนุมคอมพิวเตอร์ มหาวิทยาลัยสงขลานครินทร์</p>
        <p>
          <a href="${getShopUrl()}">เว็บไซต์ร้านค้า</a> &nbsp;|&nbsp;
          <a href="https://facebook.com/psuscc">Facebook</a> &nbsp;|&nbsp;
          <a href="https://instagram.com/psuscc">Instagram</a>
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export function generateOrderConfirmationEmail(order: {
  ref: string;
  customerName: string;
  cart: any[];
  totalAmount: number;
}): EmailTemplate {
  const itemsHtml = order.cart.map(item => `
    <div class="order-item">
      <div>
        <strong style="color: #1f2937;">${item.productName || item.name}</strong>
        <br><span style="font-size: 12px; color: #6b7280;">ไซส์: ${item.size || '-'} | จำนวน: ${item.quantity || item.qty}</span>
        ${item.options?.isLongSleeve ? '<br><span style="font-size: 12px; color: #92400e;">แขนยาว</span>' : ''}
        ${item.options?.customName ? `<br><span style="font-size: 12px; color: #1e3a5f;">ชื่อ: ${item.options.customName}</span>` : ''}
        ${item.options?.customNumber ? `<span style="font-size: 12px; color: #1e3a5f;"> | เบอร์: ${item.options.customNumber}</span>` : ''}
      </div>
      <div style="color: #1e3a5f; font-weight: 600;">฿${(item.unitPrice * (item.quantity || item.qty || 1)).toLocaleString()}</div>
    </div>
  `).join('');

  const content = `
    <h2>ยืนยันคำสั่งซื้อ</h2>
    <p>เรียน คุณ${order.customerName}</p>
    <p>ทางร้านได้รับคำสั่งซื้อของท่านเรียบร้อยแล้ว กรุณาดำเนินการชำระเงินเพื่อยืนยันคำสั่งซื้อภายในระยะเวลาที่กำหนด</p>
    
    <div class="box box-info">
      <p style="margin: 0; color: #1e40af;"><strong>หมายเลขคำสั่งซื้อ</strong></p>
      <p style="margin: 8px 0 0; font-size: 22px; font-weight: 700; color: #1e3a5f;">${order.ref}</p>
    </div>
    
    <h3>รายการสินค้า</h3>
    <div class="box">
      ${itemsHtml}
      <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="color: #6b7280;">ยอดรวมทั้งหมด</span>
          <span class="total">฿${order.totalAmount.toLocaleString()}</span>
        </div>
      </div>
    </div>
    
    <div class="box box-warning">
      <p style="margin: 0; color: #92400e;"><strong>กรุณาชำระเงินภายใน 24 ชั่วโมง</strong></p>
      <p style="margin: 8px 0 0; color: #6b7280;">หากไม่ชำระเงินภายในเวลาที่กำหนด ระบบอาจยกเลิกคำสั่งซื้อโดยอัตโนมัติ</p>
    </div>
    
    <center>
      <a href="${getShopUrl()}" class="btn">ดำเนินการชำระเงิน</a>
    </center>
  `;

  return {
    subject: `[${SHOP_NAME}] ยืนยันคำสั่งซื้อ #${order.ref}`,
    html: baseTemplate(content, `คำสั่งซื้อ #${order.ref} ได้รับการยืนยันแล้ว`),
    text: `เรียน คุณ${order.customerName}\n\nยืนยันคำสั่งซื้อ #${order.ref}\nยอดรวม: ฿${order.totalAmount.toLocaleString()}\nกรุณาชำระเงินที่ ${getShopUrl()}\n\n(อีเมลฉบับนี้ส่งจากระบบอัตโนมัติ กรุณาอย่าตอบกลับ)`,
  };
}

export function generatePaymentReceivedEmail(order: {
  ref: string;
  customerName: string;
  totalAmount: number;
}): EmailTemplate {
  const content = `
    <h2>แจ้งผลการชำระเงิน</h2>
    <p>เรียน คุณ${order.customerName}</p>
    <p>ทางร้านได้รับการชำระเงินสำหรับคำสั่งซื้อของท่านเรียบร้อยแล้ว ขอขอบพระคุณที่ไว้วางใจ ${SHOP_NAME}</p>
    
    <div class="box box-success">
      <div style="text-align: center;">
        <span class="status-badge status-success">ชำระเงินแล้ว</span>
        <p style="margin: 16px 0 0; color: #6b7280;">หมายเลขคำสั่งซื้อ</p>
        <p style="margin: 8px 0 0; font-size: 22px; font-weight: 700; color: #1e3a5f;">${order.ref}</p>
        <p style="margin: 16px 0 0; color: #166534; font-size: 18px; font-weight: 700;">฿${order.totalAmount.toLocaleString()}</p>
      </div>
    </div>
    
    <h3>ขั้นตอนถัดไป</h3>
    <div class="box">
      <p style="margin: 0; color: #4b5563;">
        1. ทีมงานจะตรวจสอบและเตรียมสินค้า<br>
        2. เมื่อสินค้าพร้อม ระบบจะแจ้งเตือนท่านทางอีเมล<br>
        3. สามารถติดตามสถานะได้ที่เว็บไซต์ร้านค้า
      </p>
    </div>
    
    <center>
      <a href="${getShopUrl()}" class="btn">ตรวจสอบสถานะคำสั่งซื้อ</a>
    </center>
  `;

  return {
    subject: `[${SHOP_NAME}] ชำระเงินสำเร็จ #${order.ref}`,
    html: baseTemplate(content, `การชำระเงินคำสั่งซื้อ #${order.ref} สำเร็จแล้ว`),
    text: `ชำระเงินสำเร็จ! คำสั่งซื้อ: ${order.ref} ยอด: ฿${order.totalAmount.toLocaleString()} ติดตามสถานะที่ ${getShopUrl()}`,
  };
}

export function generateOrderReadyEmail(order: {
  ref: string;
  customerName: string;
  pickupLocation?: string;
  pickupNotes?: string;
}): EmailTemplate {
  const location = order.pickupLocation || 'ชุมนุมคอมพิวเตอร์ คณะวิทยาศาสตร์';
  const content = `
    <h2>สินค้าพร้อมรับแล้ว!</h2>
    <p>สวัสดีคุณ ${order.customerName}</p>
    <p>คำสั่งซื้อของคุณพร้อมให้รับแล้ว!</p>
    
    <div class="box box-success">
      <div style="text-align: center;">
        <span class="status-badge status-success">พร้อมรับสินค้า</span>
        <p style="margin: 16px 0 0; color: #94a3b8;">หมายเลขคำสั่งซื้อ</p>
        <p style="margin: 8px 0 0; font-size: 24px; font-weight: 700; color: #f1f5f9;">${order.ref}</p>
      </div>
    </div>
    
    <h3 style="color: #f1f5f9;">สถานที่รับสินค้า</h3>
    <div class="box box-info">
      <p style="margin: 0; color: #f1f5f9;"><strong>${location}</strong></p>
      ${order.pickupNotes ? `<p style="margin: 8px 0 0; color: #94a3b8;">${order.pickupNotes}</p>` : ''}
      <p style="margin: 8px 0 0; color: #2563eb;">กรุณานำหลักฐานยืนยันตัวตนมาด้วย</p>
    </div>
    
    <center>
      <a href="${getShopUrl()}" class="btn">ดูรายละเอียด</a>
    </center>
  `;

  return {
    subject: `[${SHOP_NAME}] สินค้าพร้อมรับ #${order.ref}`,
    html: baseTemplate(content, `คำสั่งซื้อ #${order.ref} พร้อมให้รับแล้ว`),
    text: `สินค้าพร้อมรับแล้ว! คำสั่งซื้อ: ${order.ref} รับได้ที่ ${location}`,
  };
}

export function generateOrderShippedEmail(order: {
  ref: string;
  customerName: string;
  trackingNumber?: string;
  shippingProvider?: string;
}): EmailTemplate {
  const content = `
    <h2>จัดส่งสินค้าแล้ว!</h2>
    <p>สวัสดีคุณ ${order.customerName}</p>
    <p>คำสั่งซื้อของคุณได้ถูกจัดส่งแล้ว!</p>
    
    <div class="box box-info">
      <div style="text-align: center;">
        <span class="status-badge" style="background: rgba(14,165,233,0.2); color: #0ea5e9;">จัดส่งแล้ว</span>
        <p style="margin: 16px 0 0; color: #94a3b8;">หมายเลขคำสั่งซื้อ</p>
        <p style="margin: 8px 0 0; font-size: 24px; font-weight: 700; color: #f1f5f9;">${order.ref}</p>
      </div>
    </div>
    
    ${order.trackingNumber ? `
    <h3 style="color: #f1f5f9;">ข้อมูลการจัดส่ง</h3>
    <div class="box">
      <p style="margin: 0; color: #94a3b8;">ขนส่ง: <strong style="color: #f1f5f9;">${order.shippingProvider || 'ไม่ระบุ'}</strong></p>
      <p style="margin: 8px 0 0; color: #94a3b8;">เลขพัสดุ: <strong style="color: #10b981; font-size: 18px;">${order.trackingNumber}</strong></p>
    </div>
    ` : ''}
    
    <center>
      <a href="${getShopUrl()}" class="btn">ติดตามสถานะ</a>
    </center>
  `;

  return {
    subject: `[${SHOP_NAME}] จัดส่งแล้ว #${order.ref}`,
    html: baseTemplate(content, `คำสั่งซื้อ #${order.ref} ได้ถูกจัดส่งแล้ว`),
    text: `จัดส่งแล้ว! คำสั่งซื้อ: ${order.ref}${order.trackingNumber ? ` เลขพัสดุ: ${order.trackingNumber}` : ''}`,
  };
}

export function generateOrderCompletedEmail(order: {
  ref: string;
  customerName: string;
}): EmailTemplate {
  const content = `
    <h2>รับสินค้าเรียบร้อย!</h2>
    <p>สวัสดีคุณ ${order.customerName}</p>
    <p>ขอบคุณที่ใช้บริการ ${SHOP_NAME} หวังว่าคุณจะพอใจกับสินค้าของเรา!</p>
    
    <div class="box box-success">
      <div style="text-align: center;">
        <span class="status-badge status-success">สำเร็จ</span>
        <p style="margin: 16px 0 0; color: #94a3b8;">หมายเลขคำสั่งซื้อ</p>
        <p style="margin: 8px 0 0; font-size: 24px; font-weight: 700; color: #f1f5f9;">${order.ref}</p>
        <p style="margin: 16px 0 0; font-size: 32px;"></p>
      </div>
    </div>
    
    <div class="box">
      <p style="margin: 0; color: #f1f5f9; text-align: center;"><strong>ขอบคุณที่เลือกใช้บริการ!</strong></p>
      <p style="margin: 8px 0 0; color: #94a3b8; text-align: center;">
        หากมีข้อสงสัยหรือปัญหาใดๆ สามารถติดต่อเราได้ตลอดเวลา
      </p>
    </div>
    
    <center>
      <a href="${getShopUrl()}" class="btn">ดูสินค้าอื่นๆ</a>
    </center>
  `;

  return {
    subject: `[${SHOP_NAME}] คำสั่งซื้อเสร็จสมบูรณ์ #${order.ref}`,
    html: baseTemplate(content, `คำสั่งซื้อ #${order.ref} เสร็จสมบูรณ์`),
    text: `ขอบคุณที่ใช้บริการ ${SHOP_NAME}! คำสั่งซื้อ: ${order.ref} เสร็จสมบูรณ์แล้ว`,
  };
}

export function generateOrderCancelledEmail(order: {
  ref: string;
  customerName: string;
  reason?: string;
}): EmailTemplate {
  const content = `
    <h2>คำสั่งซื้อถูกยกเลิก</h2>
    <p>สวัสดีคุณ ${order.customerName}</p>
    <p>คำสั่งซื้อของคุณได้ถูกยกเลิกแล้ว</p>
    
    <div class="box box-error">
      <div style="text-align: center;">
        <span class="status-badge status-cancelled"> ยกเลิก</span>
        <p style="margin: 16px 0 0; color: #94a3b8;">หมายเลขคำสั่งซื้อ</p>
        <p style="margin: 8px 0 0; font-size: 24px; font-weight: 700; color: #f1f5f9;">${order.ref}</p>
      </div>
    </div>
    
    ${order.reason ? `
    <div class="box">
      <p style="margin: 0; color: #94a3b8;"><strong>เหตุผล:</strong></p>
      <p style="margin: 8px 0 0; color: #f1f5f9;">${order.reason}</p>
    </div>
    ` : ''}
    
    <p style="color: #94a3b8;">หากคุณมีคำถามหรือต้องการสั่งซื้อใหม่ สามารถติดต่อเราได้ตลอดเวลา</p>
    
    <center>
      <a href="${getShopUrl()}" class="btn">กลับไปหน้าร้าน</a>
    </center>
  `;

  return {
    subject: `[${SHOP_NAME}] ยกเลิกคำสั่งซื้อ #${order.ref}`,
    html: baseTemplate(content, `คำสั่งซื้อ #${order.ref} ถูกยกเลิกแล้ว`),
    text: `คำสั่งซื้อถูกยกเลิก: ${order.ref}${order.reason ? ` เหตุผล: ${order.reason}` : ''}`,
  };
}

export function generateCustomEmail(options: {
  customerName: string;
  subject: string;
  message: string;
}): EmailTemplate {
  const content = `
    <h2>${options.subject}</h2>
    <p>สวัสดีคุณ ${options.customerName}</p>
    <div class="box">
      ${options.message.split('\n').map(line => `<p style="margin: 0 0 8px; color: #e2e8f0;">${line}</p>`).join('')}
    </div>
    
    <center>
      <a href="${getShopUrl()}" class="btn">ไปที่ร้านค้า</a>
    </center>
  `;

  return {
    subject: `[${SHOP_NAME}] ${options.subject}`,
    html: baseTemplate(content),
    text: `${options.subject}\n\nสวัสดีคุณ ${options.customerName}\n\n${options.message}`,
  };
}

// ==================== AUTO EMAIL TRIGGERS ====================
export async function sendOrderConfirmationEmail(order: any): Promise<void> {
  const to = getOrderRecipientEmail(order);
  if (!to) {
    console.warn('[Email] Skipping order confirmation — no recipient email', { ref: order?.ref });
    return;
  }

  const template = generateOrderConfirmationEmail({
    ref: order.ref,
    customerName: order.customerName || order.name,
    cart: order.cart || [],
    totalAmount: order.totalAmount || order.amount || 0,
  });

  await sendEmail({
    to,
    subject: template.subject,
    html: template.html,
    text: template.text,
    type: 'order_confirmation',
    orderRef: order.ref,
  });
}

export async function sendPaymentReceivedEmail(order: any): Promise<void> {
  const to = getOrderRecipientEmail(order);
  if (!to) {
    console.warn('[Email] Skipping payment received email — no recipient email', { ref: order?.ref });
    return;
  }

  const template = generatePaymentReceivedEmail({
    ref: order.ref,
    customerName: order.customerName || order.name,
    totalAmount: order.totalAmount || order.amount || 0,
  });

  await sendEmail({
    to,
    subject: template.subject,
    html: template.html,
    text: template.text,
    type: 'payment_received',
    orderRef: order.ref,
  });
}

export async function sendOrderStatusEmail(order: any, newStatus: string, options?: { pickupLocation?: string; pickupNotes?: string }): Promise<void> {
  const email = getOrderRecipientEmail(order);
  if (!email) {
    console.warn('[Email] Skipping status email — no recipient email', { ref: order?.ref, status: newStatus });
    return;
  }
  const name = order.customerName || order.name;
  
  let template: EmailTemplate;
  let type: EmailType;

  switch (newStatus.toUpperCase()) {
    case 'PAID':
      template = generatePaymentReceivedEmail({ ref: order.ref, customerName: name, totalAmount: order.totalAmount || order.amount || 0 });
      type = 'payment_received';
      break;
    case 'READY':
      template = generateOrderReadyEmail({ 
        ref: order.ref, 
        customerName: name,
        pickupLocation: options?.pickupLocation || order.pickupLocation,
        pickupNotes: options?.pickupNotes || order.pickupNotes,
      });
      type = 'order_ready';
      break;
    case 'SHIPPED':
      template = generateOrderShippedEmail({ ref: order.ref, customerName: name, trackingNumber: order.trackingNumber, shippingProvider: order.shippingProvider });
      type = 'order_shipped';
      break;
    case 'COMPLETED':
      template = generateOrderCompletedEmail({ ref: order.ref, customerName: name });
      type = 'order_completed';
      break;
    case 'CANCELLED':
      template = generateOrderCancelledEmail({ ref: order.ref, customerName: name, reason: order.cancelReason });
      type = 'order_cancelled';
      break;
    default:
      return; // Don't send email for other statuses
  }

  await sendEmail({
    to: email,
    subject: template.subject,
    html: template.html,
    text: template.text,
    type,
    orderRef: order.ref,
  });
}

/**
 * ส่งอีเมลแจ้งยกเลิก order (สำหรับ auto-cancel)
 */
export async function sendOrderCancelledEmail(order: {
  ref: string;
  customerName: string;
  customerEmail: string;
  reason?: string;
}): Promise<void> {
  const template = generateOrderCancelledEmail({
    ref: order.ref,
    customerName: order.customerName,
    reason: order.reason,
  });

  const to = getOrderRecipientEmail(order);
  if (!to) {
    console.warn('[Email] Skipping cancellation email — no recipient email', { ref: order?.ref });
    return;
  }

  await sendEmail({
    to,
    subject: template.subject,
    html: template.html,
    text: template.text,
    type: 'order_cancelled',
    orderRef: order.ref,
  });
}

// ==================== CHAT REPLY EMAIL ====================

export function generateChatReplyEmail(options: {
  customerName: string;
  adminName: string;
  messagePreview: string;
  chatId: string;
}): EmailTemplate {
  const { customerName, adminName, messagePreview, chatId } = options;
  const escapedMessage = messagePreview.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
  
  const content = `
    <h2>แจ้งเตือนข้อความจากทีมงาน</h2>
    <p>เรียน คุณ${customerName}</p>
    <p>เจ้าหน้าที่ <strong>${adminName}</strong> ได้ตอบกลับข้อความของท่านผ่านระบบแชทสนับสนุน</p>
    
    <div class="box box-info">
      <p style="margin: 0 0 8px; color: #6b7280; font-size: 12px;">ข้อความจากเจ้าหน้าที่</p>
      <p style="margin: 0; color: #1f2937; line-height: 1.6; white-space: pre-wrap;">${escapedMessage}</p>
    </div>
    
    <center>
      <a href="${getShopUrl()}" class="btn">เปิดระบบแชทสนับสนุน</a>
    </center>
    
    <div class="box">
      <p style="margin: 0; color: #6b7280; text-align: center; font-size: 13px;">
        กรุณาตอบกลับผ่านระบบแชทบนเว็บไซต์เท่านั้น (ไม่สามารถตอบกลับอีเมลฉบับนี้ได้)
      </p>
    </div>
  `;

  return {
    subject: `[${SHOP_NAME}] แจ้งเตือนข้อความจากทีมงาน`,
    html: baseTemplate(content, `${adminName} ตอบกลับข้อความของคุณ`),
    text: `สวัสดีคุณ ${customerName} - แอดมิน ${adminName} ตอบกลับข้อความของคุณ: "${messagePreview.substring(0, 200)}" เปิดเว็บไซต์เพื่อดูข้อความเพิ่มเติม: ${getShopUrl()}`,
  };
}

export async function sendChatReplyEmail(options: {
  customerEmail: string;
  customerName: string;
  adminName: string;
  messagePreview: string;
  chatId: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const template = generateChatReplyEmail(options);
    return await sendEmail({
      to: options.customerEmail,
      subject: template.subject,
      html: template.html,
      text: template.text,
      type: 'custom',
      metadata: { chatId: options.chatId, trigger: 'admin_chat_reply' },
    });
  } catch (error: any) {
    console.error('[Email] Chat reply email failed:', error);
    return { success: false, error: error.message };
  }
}
