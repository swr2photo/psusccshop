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
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'SCC Shop <psuscc@psusci.club>';
const SHOP_NAME = 'SCC Shop';
const SHOP_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://sccshop.psusci.club';

// ==================== EMAIL LOG HELPERS ====================
const emailLogKey = (id: string) => `email-logs/${id}.json`;

export async function saveEmailLog(log: EmailLog): Promise<void> {
  await putJson(emailLogKey(log.id), log);
  
  // Also update index by date
  const date = new Date(log.sentAt);
  const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const indexKey = `email-logs/index/${dateKey}.json`;
  const existing = (await getJson<string[]>(indexKey)) || [];
  if (!existing.includes(log.id)) {
    await putJson(indexKey, [...existing, log.id]);
  }
}

export async function getEmailLogs(limit = 100): Promise<EmailLog[]> {
  const keys = await listKeys('email-logs/');
  const logKeys = keys.filter(k => k.endsWith('.json') && !k.includes('/index/'));
  
  // Sort by newest first
  const sortedKeys = logKeys.sort().reverse().slice(0, limit);
  
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
  
  // Create log entry
  const log: EmailLog = {
    id: logId,
    to: options.to,
    subject: options.subject,
    type: options.type,
    status: 'pending',
    orderRef: options.orderRef,
    sentAt: new Date().toISOString(),
    metadata: options.metadata,
  };

  try {
    if (!RESEND_API_KEY) {
      // Fallback: Log only mode if no API key
      console.log('[Email] No RESEND_API_KEY, logging only:', {
        to: options.to,
        subject: options.subject,
        type: options.type,
      });
      log.status = 'sent';
      log.metadata = { ...log.metadata, mode: 'log_only' };
      await saveEmailLog(log);
      return { success: true, id: logId };
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || stripHtml(options.html),
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Failed to send email');
    }

    log.status = 'sent';
    log.metadata = { ...log.metadata, resendId: result.id };
    await saveEmailLog(log);

    console.log('[Email] Sent successfully:', { to: options.to, subject: options.subject, id: result.id });
    return { success: true, id: logId };

  } catch (error: any) {
    log.status = 'failed';
    log.error = error.message;
    await saveEmailLog(log);

    console.error('[Email] Failed to send:', { to: options.to, error: error.message });
    return { success: false, error: error.message, id: logId };
  }
}

// ==================== EMAIL TEMPLATES ====================
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function baseTemplate(content: string, preheader?: string): string {
  return `
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${SHOP_NAME}</title>
  ${preheader ? `<span style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${preheader}</span>` : ''}
  <style>
    body { margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0f172a; }
    .container { max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); }
    .header { background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 32px; text-align: center; }
    .header h1 { margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; }
    .header p { margin: 8px 0 0; color: rgba(255,255,255,0.8); font-size: 14px; }
    .content { padding: 32px; color: #e2e8f0; }
    .content h2 { color: #f1f5f9; font-size: 22px; margin: 0 0 16px; }
    .content p { margin: 0 0 16px; line-height: 1.6; color: #94a3b8; }
    .box { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 20px; margin: 20px 0; }
    .box-success { border-color: rgba(16,185,129,0.3); background: rgba(16,185,129,0.1); }
    .box-warning { border-color: rgba(245,158,11,0.3); background: rgba(245,158,11,0.1); }
    .box-error { border-color: rgba(239,68,68,0.3); background: rgba(239,68,68,0.1); }
    .box-info { border-color: rgba(99,102,241,0.3); background: rgba(99,102,241,0.1); }
    .btn { display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #ffffff !important; text-decoration: none; border-radius: 10px; font-weight: 600; margin: 16px 0; }
    .btn:hover { opacity: 0.9; }
    .order-item { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.1); }
    .order-item:last-child { border-bottom: none; }
    .total { font-size: 20px; font-weight: 700; color: #10b981; }
    .footer { background: #0a0f1a; padding: 24px; text-align: center; border-top: 1px solid rgba(255,255,255,0.1); }
    .footer p { margin: 0; color: #64748b; font-size: 12px; }
    .footer a { color: #6366f1; text-decoration: none; }
    .status-badge { display: inline-block; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
    .status-success { background: rgba(16,185,129,0.2); color: #10b981; }
    .status-pending { background: rgba(245,158,11,0.2); color: #f59e0b; }
    .status-cancelled { background: rgba(239,68,68,0.2); color: #ef4444; }
    @media (max-width: 600px) {
      .content { padding: 20px; }
      .header { padding: 24px; }
      .header h1 { font-size: 24px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🛍️ ${SHOP_NAME}</h1>
      <p>ร้านค้าชุมนุมคอมพิวเตอร์ ม.อ.</p>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>ขอบคุณที่ใช้บริการ ${SHOP_NAME}</p>
      <p style="margin-top: 8px;">
        <a href="${SHOP_URL}">เว็บไซต์</a> • 
        <a href="https://facebook.com/psuscc">Facebook</a> • 
        <a href="https://instagram.com/psuscc">Instagram</a>
      </p>
      <p style="margin-top: 16px; font-size: 11px;">
        หากคุณมีคำถามหรือข้อสงสัย กรุณาติดต่อ psuscc@psusci.club
      </p>
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
        <strong style="color: #f1f5f9;">${item.productName || item.name}</strong>
        <br><span style="font-size: 12px; color: #64748b;">ไซส์: ${item.size} | จำนวน: ${item.quantity || item.qty}</span>
        ${item.options?.isLongSleeve ? '<br><span style="font-size: 12px; color: #f59e0b;">แขนยาว</span>' : ''}
        ${item.options?.customName ? `<br><span style="font-size: 12px; color: #6366f1;">ชื่อ: ${item.options.customName}</span>` : ''}
        ${item.options?.customNumber ? `<span style="font-size: 12px; color: #6366f1;"> | เบอร์: ${item.options.customNumber}</span>` : ''}
      </div>
      <div style="color: #10b981; font-weight: 600;">฿${(item.unitPrice * (item.quantity || item.qty || 1)).toLocaleString()}</div>
    </div>
  `).join('');

  const content = `
    <h2>🎉 ขอบคุณสำหรับการสั่งซื้อ!</h2>
    <p>สวัสดีคุณ ${order.customerName}</p>
    <p>เราได้รับคำสั่งซื้อของคุณเรียบร้อยแล้ว กรุณาชำระเงินเพื่อยืนยันคำสั่งซื้อ</p>
    
    <div class="box box-info">
      <p style="margin: 0; color: #a5b4fc;"><strong>หมายเลขคำสั่งซื้อ:</strong></p>
      <p style="margin: 8px 0 0; font-size: 24px; font-weight: 700; color: #f1f5f9;">${order.ref}</p>
    </div>
    
    <h3 style="color: #f1f5f9; margin-top: 24px;">📦 รายการสินค้า</h3>
    <div class="box">
      ${itemsHtml}
      <div style="margin-top: 16px; padding-top: 16px; border-top: 2px solid rgba(255,255,255,0.1);">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="color: #94a3b8;">ยอดรวมทั้งหมด</span>
          <span class="total">฿${order.totalAmount.toLocaleString()}</span>
        </div>
      </div>
    </div>
    
    <div class="box box-warning">
      <p style="margin: 0; color: #fbbf24;"><strong>⚠️ กรุณาชำระเงินภายใน 24 ชั่วโมง</strong></p>
      <p style="margin: 8px 0 0; color: #94a3b8;">หากไม่ชำระเงินภายในเวลาที่กำหนด คำสั่งซื้ออาจถูกยกเลิกอัตโนมัติ</p>
    </div>
    
    <center>
      <a href="${SHOP_URL}" class="btn">ชำระเงินตอนนี้</a>
    </center>
  `;

  return {
    subject: `✅ ยืนยันคำสั่งซื้อ #${order.ref} - ${SHOP_NAME}`,
    html: baseTemplate(content, `คำสั่งซื้อ #${order.ref} ได้รับการยืนยันแล้ว`),
    text: `ขอบคุณสำหรับการสั่งซื้อ! หมายเลขคำสั่งซื้อ: ${order.ref} ยอดรวม: ฿${order.totalAmount.toLocaleString()} กรุณาชำระเงินที่ ${SHOP_URL}`,
  };
}

export function generatePaymentReceivedEmail(order: {
  ref: string;
  customerName: string;
  totalAmount: number;
}): EmailTemplate {
  const content = `
    <h2>💚 ชำระเงินสำเร็จ!</h2>
    <p>สวัสดีคุณ ${order.customerName}</p>
    <p>เราได้รับการชำระเงินของคุณเรียบร้อยแล้ว ขอบคุณที่ไว้วางใจ ${SHOP_NAME}</p>
    
    <div class="box box-success">
      <div style="text-align: center;">
        <span class="status-badge status-success">✓ ชำระเงินแล้ว</span>
        <p style="margin: 16px 0 0; color: #94a3b8;">หมายเลขคำสั่งซื้อ</p>
        <p style="margin: 8px 0 0; font-size: 24px; font-weight: 700; color: #f1f5f9;">${order.ref}</p>
        <p style="margin: 16px 0 0; color: #10b981; font-size: 20px; font-weight: 700;">฿${order.totalAmount.toLocaleString()}</p>
      </div>
    </div>
    
    <h3 style="color: #f1f5f9;">📌 ขั้นตอนถัดไป</h3>
    <div class="box">
      <p style="margin: 0; color: #94a3b8;">
        1. ทีมงานจะตรวจสอบและเตรียมสินค้าให้คุณ<br>
        2. เมื่อสินค้าพร้อม จะมีอีเมลแจ้งให้ทราบ<br>
        3. สามารถติดตามสถานะได้ที่เว็บไซต์
      </p>
    </div>
    
    <center>
      <a href="${SHOP_URL}" class="btn">ดูสถานะคำสั่งซื้อ</a>
    </center>
  `;

  return {
    subject: `💚 ชำระเงินสำเร็จ #${order.ref} - ${SHOP_NAME}`,
    html: baseTemplate(content, `การชำระเงินคำสั่งซื้อ #${order.ref} สำเร็จแล้ว`),
    text: `ชำระเงินสำเร็จ! คำสั่งซื้อ: ${order.ref} ยอด: ฿${order.totalAmount.toLocaleString()} ติดตามสถานะที่ ${SHOP_URL}`,
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
    <h2>📦 สินค้าพร้อมรับแล้ว!</h2>
    <p>สวัสดีคุณ ${order.customerName}</p>
    <p>คำสั่งซื้อของคุณพร้อมให้รับแล้ว!</p>
    
    <div class="box box-success">
      <div style="text-align: center;">
        <span class="status-badge status-success">✓ พร้อมรับสินค้า</span>
        <p style="margin: 16px 0 0; color: #94a3b8;">หมายเลขคำสั่งซื้อ</p>
        <p style="margin: 8px 0 0; font-size: 24px; font-weight: 700; color: #f1f5f9;">${order.ref}</p>
      </div>
    </div>
    
    <h3 style="color: #f1f5f9;">📍 สถานที่รับสินค้า</h3>
    <div class="box box-info">
      <p style="margin: 0; color: #f1f5f9;"><strong>${location}</strong></p>
      ${order.pickupNotes ? `<p style="margin: 8px 0 0; color: #94a3b8;">${order.pickupNotes}</p>` : ''}
      <p style="margin: 8px 0 0; color: #6366f1;">กรุณานำหลักฐานยืนยันตัวตนมาด้วย</p>
    </div>
    
    <center>
      <a href="${SHOP_URL}" class="btn">ดูรายละเอียด</a>
    </center>
  `;

  return {
    subject: `📦 สินค้าพร้อมรับ #${order.ref} - ${SHOP_NAME}`,
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
    <h2>🚚 จัดส่งสินค้าแล้ว!</h2>
    <p>สวัสดีคุณ ${order.customerName}</p>
    <p>คำสั่งซื้อของคุณได้ถูกจัดส่งแล้ว!</p>
    
    <div class="box box-info">
      <div style="text-align: center;">
        <span class="status-badge" style="background: rgba(14,165,233,0.2); color: #0ea5e9;">🚚 จัดส่งแล้ว</span>
        <p style="margin: 16px 0 0; color: #94a3b8;">หมายเลขคำสั่งซื้อ</p>
        <p style="margin: 8px 0 0; font-size: 24px; font-weight: 700; color: #f1f5f9;">${order.ref}</p>
      </div>
    </div>
    
    ${order.trackingNumber ? `
    <h3 style="color: #f1f5f9;">📍 ข้อมูลการจัดส่ง</h3>
    <div class="box">
      <p style="margin: 0; color: #94a3b8;">ขนส่ง: <strong style="color: #f1f5f9;">${order.shippingProvider || 'ไม่ระบุ'}</strong></p>
      <p style="margin: 8px 0 0; color: #94a3b8;">เลขพัสดุ: <strong style="color: #10b981; font-size: 18px;">${order.trackingNumber}</strong></p>
    </div>
    ` : ''}
    
    <center>
      <a href="${SHOP_URL}" class="btn">ติดตามสถานะ</a>
    </center>
  `;

  return {
    subject: `🚚 จัดส่งแล้ว #${order.ref} - ${SHOP_NAME}`,
    html: baseTemplate(content, `คำสั่งซื้อ #${order.ref} ได้ถูกจัดส่งแล้ว`),
    text: `จัดส่งแล้ว! คำสั่งซื้อ: ${order.ref}${order.trackingNumber ? ` เลขพัสดุ: ${order.trackingNumber}` : ''}`,
  };
}

export function generateOrderCompletedEmail(order: {
  ref: string;
  customerName: string;
}): EmailTemplate {
  const content = `
    <h2>🎊 รับสินค้าเรียบร้อย!</h2>
    <p>สวัสดีคุณ ${order.customerName}</p>
    <p>ขอบคุณที่ใช้บริการ ${SHOP_NAME} หวังว่าคุณจะพอใจกับสินค้าของเรา!</p>
    
    <div class="box box-success">
      <div style="text-align: center;">
        <span class="status-badge status-success">✓ สำเร็จ</span>
        <p style="margin: 16px 0 0; color: #94a3b8;">หมายเลขคำสั่งซื้อ</p>
        <p style="margin: 8px 0 0; font-size: 24px; font-weight: 700; color: #f1f5f9;">${order.ref}</p>
        <p style="margin: 16px 0 0; font-size: 32px;">🎉</p>
      </div>
    </div>
    
    <div class="box">
      <p style="margin: 0; color: #f1f5f9; text-align: center;"><strong>ขอบคุณที่เลือกใช้บริการ!</strong></p>
      <p style="margin: 8px 0 0; color: #94a3b8; text-align: center;">
        หากมีข้อสงสัยหรือปัญหาใดๆ สามารถติดต่อเราได้ตลอดเวลา
      </p>
    </div>
    
    <center>
      <a href="${SHOP_URL}" class="btn">ดูสินค้าอื่นๆ</a>
    </center>
  `;

  return {
    subject: `🎊 ขอบคุณที่ใช้บริการ #${order.ref} - ${SHOP_NAME}`,
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
    <h2>❌ คำสั่งซื้อถูกยกเลิก</h2>
    <p>สวัสดีคุณ ${order.customerName}</p>
    <p>คำสั่งซื้อของคุณได้ถูกยกเลิกแล้ว</p>
    
    <div class="box box-error">
      <div style="text-align: center;">
        <span class="status-badge status-cancelled">✕ ยกเลิก</span>
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
      <a href="${SHOP_URL}" class="btn">กลับไปหน้าร้าน</a>
    </center>
  `;

  return {
    subject: `❌ ยกเลิกคำสั่งซื้อ #${order.ref} - ${SHOP_NAME}`,
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
      <a href="${SHOP_URL}" class="btn">ไปที่ร้านค้า</a>
    </center>
  `;

  return {
    subject: `${options.subject} - ${SHOP_NAME}`,
    html: baseTemplate(content),
    text: `${options.subject}\n\nสวัสดีคุณ ${options.customerName}\n\n${options.message}`,
  };
}

// ==================== AUTO EMAIL TRIGGERS ====================
export async function sendOrderConfirmationEmail(order: any): Promise<void> {
  const template = generateOrderConfirmationEmail({
    ref: order.ref,
    customerName: order.customerName || order.name,
    cart: order.cart || [],
    totalAmount: order.totalAmount || order.amount || 0,
  });

  await sendEmail({
    to: order.customerEmail || order.email,
    subject: template.subject,
    html: template.html,
    text: template.text,
    type: 'order_confirmation',
    orderRef: order.ref,
  });
}

export async function sendPaymentReceivedEmail(order: any): Promise<void> {
  const template = generatePaymentReceivedEmail({
    ref: order.ref,
    customerName: order.customerName || order.name,
    totalAmount: order.totalAmount || order.amount || 0,
  });

  await sendEmail({
    to: order.customerEmail || order.email,
    subject: template.subject,
    html: template.html,
    text: template.text,
    type: 'payment_received',
    orderRef: order.ref,
  });
}

export async function sendOrderStatusEmail(order: any, newStatus: string, options?: { pickupLocation?: string; pickupNotes?: string }): Promise<void> {
  const email = order.customerEmail || order.email;
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

  await sendEmail({
    to: order.customerEmail,
    subject: template.subject,
    html: template.html,
    text: template.text,
    type: 'order_cancelled',
    orderRef: order.ref,
  });
}

