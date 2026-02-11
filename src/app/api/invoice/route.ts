// API route for generating invoice/receipt HTML (can be printed/saved as PDF)
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/invoice?ref=xxx&lang=th
export async function GET(request: NextRequest) {
  try {
    const ref = request.nextUrl.searchParams.get('ref');
    const lang = (request.nextUrl.searchParams.get('lang') || 'th') as 'th' | 'en';

    if (!ref) {
      return NextResponse.json({ error: 'Missing order reference' }, { status: 400 });
    }

    // Try to get order from Supabase first, then Filebase
    let order: any = null;

    try {
      const { supabase } = await import('@/lib/supabase');
      const { data } = await supabase
        .from('orders')
        .select('*')
        .eq('ref', ref)
        .single();
      if (data) order = data;
    } catch {
      // Supabase not available, try filebase
    }

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const labels = lang === 'en' ? {
      title: 'Invoice / Receipt',
      orderRef: 'Order Reference',
      date: 'Date',
      customer: 'Customer',
      email: 'Email',
      phone: 'Phone',
      address: 'Shipping Address',
      item: 'Item',
      size: 'Size',
      qty: 'Qty',
      unitPrice: 'Unit Price',
      total: 'Total',
      subtotal: 'Subtotal',
      shipping: 'Shipping Fee',
      discount: 'Discount',
      grandTotal: 'Grand Total',
      paymentMethod: 'Payment Method',
      status: 'Status',
      generatedAt: 'Generated at',
      shopName: 'PSU SCC Shop',
      thankYou: 'Thank you for your purchase!',
    } : {
      title: 'ใบเสร็จรับเงิน',
      orderRef: 'เลขที่คำสั่งซื้อ',
      date: 'วันที่',
      customer: 'ลูกค้า',
      email: 'อีเมล',
      phone: 'โทรศัพท์',
      address: 'ที่อยู่จัดส่ง',
      item: 'รายการ',
      size: 'ไซส์',
      qty: 'จำนวน',
      unitPrice: 'ราคาต่อชิ้น',
      total: 'รวม',
      subtotal: 'ยอดรวมสินค้า',
      shipping: 'ค่าจัดส่ง',
      discount: 'ส่วนลด',
      grandTotal: 'ยอดรวมทั้งสิ้น',
      paymentMethod: 'วิธีชำระเงิน',
      status: 'สถานะ',
      generatedAt: 'ออกใบเสร็จเมื่อ',
      shopName: 'PSU SCC Shop',
      thankYou: 'ขอบคุณที่อุดหนุนค่ะ!',
    };

    const cart = (typeof order.cart === 'string' ? JSON.parse(order.cart) : order.cart) || [];
    const orderDate = order.created_at || order.createdAt || new Date().toISOString();
    const subtotal = cart.reduce((sum: number, item: any) => sum + (item.total || item.price * item.qty || 0), 0);
    const shippingFee = order.shipping_fee || order.shippingFee || 0;
    const discount = order.discount || 0;
    const grandTotal = order.total_amount || order.totalAmount || subtotal + shippingFee - discount;

    const cartRows = cart.map((item: any) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;">
          ${item.name || 'Item'}
          ${item.customName ? `<br><small style="color:#666;">Name: ${item.customName}</small>` : ''}
          ${item.customNumber ? `<small style="color:#666;"> #${item.customNumber}</small>` : ''}
        </td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;text-align:center;">${item.size || '-'}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;text-align:center;">${item.qty || 1}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;text-align:right;">฿${((item.total || item.price || 0) / (item.qty || 1)).toLocaleString()}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;text-align:right;font-weight:600;">฿${(item.total || item.price || 0).toLocaleString()}</td>
      </tr>
    `).join('');

    const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${labels.title} - ${ref}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;500;600;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'IBM Plex Sans Thai', -apple-system, sans-serif; background: #f5f5f7; padding: 20px; color: #1d1d1f; }
    .invoice { max-width: 700px; margin: 0 auto; background: white; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); overflow: hidden; }
    .header { background: linear-gradient(135deg, #0071e3, #2997ff); color: white; padding: 32px; }
    .header h1 { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
    .header .ref { font-size: 14px; opacity: 0.9; }
    .section { padding: 24px 32px; }
    .section-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #86868b; margin-bottom: 12px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .info-item { font-size: 13px; }
    .info-label { color: #86868b; font-size: 11px; font-weight: 600; }
    .info-value { font-weight: 500; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f5f5f7; font-size: 11px; font-weight: 700; text-transform: uppercase; color: #86868b; padding: 10px 12px; text-align: left; }
    .totals { border-top: 2px solid #f0f0f0; padding: 16px 32px; }
    .total-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; }
    .total-row.grand { font-size: 18px; font-weight: 800; color: #0071e3; padding: 12px 0 0; border-top: 1px solid #f0f0f0; margin-top: 8px; }
    .footer { text-align: center; padding: 24px; color: #86868b; font-size: 12px; border-top: 1px solid #f0f0f0; }
    @media print { body { background: white; padding: 0; } .invoice { box-shadow: none; border-radius: 0; } .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="no-print" style="text-align:center;margin-bottom:16px;">
    <button onclick="window.print()" style="padding:10px 24px;background:#0071e3;color:white;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;">
      🖨️ ${lang === 'en' ? 'Print / Save as PDF' : 'พิมพ์ / บันทึกเป็น PDF'}
    </button>
  </div>
  <div class="invoice">
    <div class="header">
      <h1>${labels.shopName}</h1>
      <div class="ref">${labels.title} — ${ref}</div>
    </div>
    <div class="section">
      <div class="section-title">${labels.customer}</div>
      <div class="info-grid">
        <div class="info-item"><div class="info-label">${labels.customer}</div><div class="info-value">${order.customer_name || order.customerName || '-'}</div></div>
        <div class="info-item"><div class="info-label">${labels.date}</div><div class="info-value">${new Date(orderDate).toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div></div>
        <div class="info-item"><div class="info-label">${labels.email}</div><div class="info-value">${order.customer_email || order.email || '-'}</div></div>
        <div class="info-item"><div class="info-label">${labels.phone}</div><div class="info-value">${order.customer_phone || order.phone || '-'}</div></div>
        ${order.customer_address || order.address ? `<div class="info-item" style="grid-column:span 2;"><div class="info-label">${labels.address}</div><div class="info-value">${order.customer_address || order.address}</div></div>` : ''}
      </div>
    </div>
    <div class="section" style="padding-top:0;">
      <div class="section-title">${labels.item}</div>
      <table>
        <thead>
          <tr>
            <th>${labels.item}</th>
            <th style="text-align:center;">${labels.size}</th>
            <th style="text-align:center;">${labels.qty}</th>
            <th style="text-align:right;">${labels.unitPrice}</th>
            <th style="text-align:right;">${labels.total}</th>
          </tr>
        </thead>
        <tbody>
          ${cartRows}
        </tbody>
      </table>
    </div>
    <div class="totals">
      <div class="total-row"><span>${labels.subtotal}</span><span>฿${subtotal.toLocaleString()}</span></div>
      ${shippingFee > 0 ? `<div class="total-row"><span>${labels.shipping}</span><span>฿${shippingFee.toLocaleString()}</span></div>` : ''}
      ${discount > 0 ? `<div class="total-row"><span>${labels.discount}</span><span style="color:#ff453a;">-฿${discount.toLocaleString()}</span></div>` : ''}
      <div class="total-row grand"><span>${labels.grandTotal}</span><span>฿${grandTotal.toLocaleString()}</span></div>
    </div>
    <div class="footer">
      <p>${labels.thankYou}</p>
      <p style="margin-top:8px;">${labels.generatedAt}: ${new Date().toLocaleString(lang === 'th' ? 'th-TH' : 'en-US')}</p>
    </div>
  </div>
</body>
</html>`;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (error: any) {
    console.error('GET /api/invoice error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
