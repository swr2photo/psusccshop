import { absoluteUrl } from '@/lib/site';

export type InvoiceLang = 'th' | 'en';

export interface InvoiceBuildOptions {
  stripeReceiptUrl?: string | null;
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatMoney(amount: number, lang: InvoiceLang): string {
  return `฿${amount.toLocaleString(lang === 'th' ? 'th-TH' : 'en-US', {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(iso: string, lang: InvoiceLang): string {
  try {
    return new Date(iso).toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

function formatDateTime(iso: Date, lang: InvoiceLang): string {
  return iso.toLocaleString(lang === 'th' ? 'th-TH' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface InvoiceLabelSet {
  title: string;
  orderRef: string;
  date: string;
  paidAt: string;
  customer: string;
  email: string;
  phone: string;
  address: string;
  item: string;
  size: string;
  qty: string;
  unitPrice: string;
  lineTotal: string;
  subtotal: string;
  shipping: string;
  discount: string;
  grandTotal: string;
  paymentMethod: string;
  status: string;
  pattern: string;
  jerseyName: string;
  jerseyNumber: string;
  sleeve: string;
  longSleeve: string;
  shortSleeve: string;
  generatedAt: string;
  shopName: string;
  shopTagline: string;
  thankYou: string;
  print: string;
  stripeReceipt: string;
  stripeNote: string;
  paid: string;
  methods: Record<string, string>;
  statuses: Record<string, string>;
}

const LABELS: Record<InvoiceLang, InvoiceLabelSet> = {
  th: {
    title: 'ใบเสร็จรับเงิน / Receipt',
    orderRef: 'เลขที่คำสั่งซื้อ',
    date: 'วันที่สั่งซื้อ',
    paidAt: 'วันที่ชำระเงิน',
    customer: 'ลูกค้า',
    email: 'อีเมล',
    phone: 'โทรศัพท์',
    address: 'ที่อยู่จัดส่ง',
    item: 'รายการ',
    size: 'ไซส์',
    qty: 'จำนวน',
    unitPrice: 'ราคา/ชิ้น',
    lineTotal: 'รวม',
    subtotal: 'ยอดรวมสินค้า',
    shipping: 'ค่าจัดส่ง',
    discount: 'ส่วนลด',
    grandTotal: 'ยอดชำระทั้งสิ้น',
    paymentMethod: 'ช่องทางชำระเงิน',
    status: 'สถานะ',
    pattern: 'ลาย',
    jerseyName: 'ชื่อหลังเสื้อ',
    jerseyNumber: 'เบอร์',
    sleeve: 'แขน',
    longSleeve: 'แขนยาว',
    shortSleeve: 'แขนสั้น',
    generatedAt: 'ออกใบเสร็จเมื่อ',
    shopName: 'PSU SCC Shop',
    shopTagline: 'Computer Science & Computing Shop',
    thankYou: 'ขอบคุณที่อุดหนุน SCC Shop',
    print: 'พิมพ์ / บันทึก PDF',
    stripeReceipt: 'ใบเสร็จอย่างเป็นทางการจาก Stripe',
    stripeNote: 'การชำระผ่าน Stripe PromptPay — สามารถเปิดใบเสร็จอิเล็กทรอนิกส์จาก Stripe ได้ด้านล่าง',
    paid: 'ชำระแล้ว',
    methods: {
      promptpay: 'PromptPay (Stripe)',
      credit_card: 'บัตรเครดิต/เดบิต',
      bank_transfer: 'โอนธนาคาร',
      slip: 'อัปโหลดสลิป',
      default: 'ออนไลน์',
    },
    statuses: {
      PAID: 'ชำระแล้ว',
      WAITING_PAYMENT: 'รอชำระ',
      READY: 'พร้อมจัดส่ง',
      SHIPPED: 'จัดส่งแล้ว',
      RECEIVED: 'ได้รับแล้ว',
      COMPLETED: 'สำเร็จ',
      CANCELLED: 'ยกเลิก',
    },
  },
  en: {
    title: 'Receipt / Tax Invoice',
    orderRef: 'Order Reference',
    date: 'Order Date',
    paidAt: 'Paid At',
    customer: 'Customer',
    email: 'Email',
    phone: 'Phone',
    address: 'Shipping Address',
    item: 'Item',
    size: 'Size',
    qty: 'Qty',
    unitPrice: 'Unit',
    lineTotal: 'Total',
    subtotal: 'Subtotal',
    shipping: 'Shipping',
    discount: 'Discount',
    grandTotal: 'Amount Paid',
    paymentMethod: 'Payment Method',
    status: 'Status',
    pattern: 'Pattern',
    jerseyName: 'Jersey Name',
    jerseyNumber: 'Number',
    sleeve: 'Sleeve',
    longSleeve: 'Long sleeve',
    shortSleeve: 'Short sleeve',
    generatedAt: 'Generated at',
    shopName: 'PSU SCC Shop',
    shopTagline: 'Computer Science & Computing Shop',
    thankYou: 'Thank you for your purchase!',
    print: 'Print / Save PDF',
    stripeReceipt: 'Official Stripe Receipt',
    stripeNote: 'Paid via Stripe PromptPay — open the official Stripe receipt below.',
    paid: 'Paid',
    methods: {
      promptpay: 'PromptPay (Stripe)',
      credit_card: 'Credit / Debit Card',
      bank_transfer: 'Bank Transfer',
      slip: 'Slip Upload',
      default: 'Online',
    },
    statuses: {
      PAID: 'Paid',
      WAITING_PAYMENT: 'Awaiting Payment',
      READY: 'Ready to Ship',
      SHIPPED: 'Shipped',
      RECEIVED: 'Received',
      COMPLETED: 'Completed',
      CANCELLED: 'Cancelled',
    },
  },
};

function resolveLabels(lang: InvoiceLang) {
  return LABELS[lang];
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

function paymentMethodLabel(order: Record<string, unknown>, lang: InvoiceLang): string {
  const L = resolveLabels(lang);
  const method = readOrderField(order, 'paymentMethod', 'payment_method').toLowerCase();
  const gateway = readOrderField(order, 'paymentGateway', 'payment_gateway').toLowerCase();
  if (gateway === 'stripe' && method === 'promptpay') return L.methods.promptpay;
  if (method && L.methods[method]) return L.methods[method];
  if (gateway === 'stripe') return 'Stripe';
  return L.methods.default;
}

function statusLabel(status: string, lang: InvoiceLang): string {
  const L = resolveLabels(lang);
  const key = status.toUpperCase();
  return L.statuses[key] || status;
}

function formatPattern(item: Record<string, unknown>, lang: InvoiceLang): string | null {
  const L = resolveLabels(lang);
  const raw =
    item.pattern ??
    (item.options as Record<string, unknown> | undefined)?.pattern ??
    item.patternName;
  if (!raw) return null;
  const str = String(raw).trim();
  if (!str || str === 'unnamed') return null;
  return `${L.pattern}: ${str}`;
}

function formatCartLineMeta(item: Record<string, unknown>, lang: InvoiceLang): string {
  const L = resolveLabels(lang);
  const parts: string[] = [];

  const pattern = formatPattern(item, lang);
  if (pattern) parts.push(pattern);

  const customName =
    item.customName ||
    (item.options as Record<string, unknown> | undefined)?.customName;
  if (customName) parts.push(`${L.jerseyName}: ${customName}`);

  const customNumber =
    item.customNumber ||
    (item.options as Record<string, unknown> | undefined)?.customNumber;
  if (customNumber) parts.push(`${L.jerseyNumber}: ${customNumber}`);

  const sleeve = item.sleeve || (item.options as Record<string, unknown> | undefined)?.sleeve;
  if (sleeve === 'long' || item.isLongSleeve) parts.push(L.longSleeve);
  else if (sleeve === 'short') parts.push(L.shortSleeve);

  return parts.map((p) => `<div class="line-meta">${escapeHtml(p)}</div>`).join('');
}

export function buildInvoiceHtml(
  order: Record<string, unknown>,
  ref: string,
  lang: InvoiceLang,
  options: InvoiceBuildOptions = {}
): string {
  const L = resolveLabels(lang);
  const cartRaw = order.cart;
  const cart: Record<string, unknown>[] =
    typeof cartRaw === 'string'
      ? (JSON.parse(cartRaw) as Record<string, unknown>[])
      : Array.isArray(cartRaw)
        ? cartRaw
        : [];

  const orderDate =
    readOrderField(order, 'createdAt', 'created_at', 'date') || new Date().toISOString();
  const paidAt = readOrderField(order, 'paymentVerifiedAt', 'payment_verified_at', 'verifiedAt');
  const status = readOrderField(order, 'status') || 'WAITING_PAYMENT';
  const isPaid = status.toUpperCase() === 'PAID' || order.paymentVerified === true;

  const subtotal = cart.reduce((sum, item) => {
    const qty = Number(item.qty ?? item.quantity ?? 1) || 1;
    const line = Number(item.total ?? item.price ?? 0);
    const unit = Number(item.unitPrice ?? 0);
    return sum + (line || unit * qty);
  }, 0);

  const shippingFee = Number(order.shippingFee ?? order.shipping_fee ?? 0) || 0;
  const discount = Number(order.discount ?? order.promoDiscount ?? 0) || 0;
  const grandTotal =
    Number(order.totalAmount ?? order.total_amount ?? 0) || subtotal + shippingFee - discount;

  const customerName = readOrderField(order, 'customerName', 'customer_name', 'name') || '-';
  const customerEmail = readOrderField(order, 'customerEmail', 'customer_email', 'email') || '-';
  const customerPhone = readOrderField(order, 'customerPhone', 'customer_phone', 'phone') || '-';
  const customerAddress = readOrderField(
    order,
    'customerAddress',
    'customer_address',
    'address'
  );

  const cartRows = cart
    .map((item) => {
      const qty = Number(item.qty ?? item.quantity ?? 1) || 1;
      const lineTotal = Number(item.total ?? item.price ?? 0) || 0;
      const unitPrice =
        Number(item.unitPrice ?? 0) ||
        (qty > 0 && lineTotal > 0 ? lineTotal / qty : 0);
      const name =
        readOrderField(item as Record<string, unknown>, 'productName', 'name') || L.item;
      const meta = formatCartLineMeta(item, lang);

      return `
        <tr>
          <td>
            <div class="line-title">${escapeHtml(name)}</div>
            ${meta}
          </td>
          <td class="num">${escapeHtml(item.size || '-')}</td>
          <td class="num">${qty}</td>
          <td class="num">${formatMoney(unitPrice, lang)}</td>
          <td class="num strong">${formatMoney(lineTotal, lang)}</td>
        </tr>`;
    })
    .join('');

  const stripeBlock = options.stripeReceiptUrl
    ? `
    <div class="stripe-box no-print">
      <p>${escapeHtml(L.stripeNote)}</p>
      <a class="stripe-btn" href="${escapeHtml(options.stripeReceiptUrl)}" target="_blank" rel="noopener noreferrer">
        ${escapeHtml(L.stripeReceipt)} →
      </a>
    </div>`
    : '';

  const logoUrl = absoluteUrl('/logo.png');

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(L.title)} — ${escapeHtml(ref)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;500;600;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'IBM Plex Sans Thai', -apple-system, BlinkMacSystemFont, sans-serif;
      background: #f0f4f8;
      color: #1a1f36;
      padding: 24px 16px 40px;
      line-height: 1.5;
    }
    .toolbar { text-align: center; margin-bottom: 20px; }
    .btn-print {
      padding: 11px 22px;
      background: linear-gradient(135deg, #0a2540, #1a4d7a);
      color: #fff;
      border: none;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(10,37,64,0.25);
    }
    .invoice {
      max-width: 720px;
      margin: 0 auto;
      background: #fff;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 8px 40px rgba(10,37,64,0.1);
      border: 1px solid #e3e8ef;
    }
    .header {
      background: linear-gradient(135deg, #0a2540 0%, #1a4d7a 55%, #2d6a9f 100%);
      color: #fff;
      padding: 28px 32px 24px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
    }
    .brand { display: flex; gap: 14px; align-items: center; }
    .brand img {
      width: 52px; height: 52px;
      border-radius: 12px;
      background: #fff;
      object-fit: contain;
      padding: 4px;
    }
    .brand h1 { font-size: 20px; font-weight: 800; letter-spacing: -0.02em; }
    .brand p { font-size: 12px; opacity: 0.85; margin-top: 2px; }
    .doc-title { text-align: right; }
    .doc-title .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; opacity: 0.8; }
    .doc-title .ref { font-size: 15px; font-weight: 700; margin-top: 4px; font-family: ui-monospace, monospace; }
    .badge-paid {
      display: inline-block;
      margin-top: 10px;
      padding: 4px 12px;
      border-radius: 999px;
      background: rgba(48,209,88,0.2);
      border: 1px solid rgba(48,209,88,0.5);
      color: #b8f5c8;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.04em;
    }
    .stripe-box {
      margin: 20px 32px 0;
      padding: 14px 16px;
      border-radius: 12px;
      background: #f6f9fc;
      border: 1px solid #d8e3f0;
    }
    .stripe-box p { font-size: 12px; color: #4f566b; margin-bottom: 10px; }
    .stripe-btn {
      display: inline-block;
      padding: 9px 16px;
      background: #635bff;
      color: #fff !important;
      text-decoration: none;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 700;
    }
    .section { padding: 22px 32px; }
    .section + .section { padding-top: 0; }
    .section-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #697386;
      margin-bottom: 12px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px 20px;
    }
    .info-label { font-size: 11px; color: #8792a2; font-weight: 600; }
    .info-value { font-size: 14px; font-weight: 600; margin-top: 3px; word-break: break-word; }
    .span-2 { grid-column: span 2; }
    table { width: 100%; border-collapse: collapse; }
    th {
      background: #f6f9fc;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #697386;
      padding: 10px 12px;
      text-align: left;
      border-bottom: 2px solid #e3e8ef;
    }
    td {
      padding: 12px;
      border-bottom: 1px solid #eef2f7;
      font-size: 13px;
      vertical-align: top;
    }
    .line-title { font-weight: 600; color: #1a1f36; }
    .line-meta { font-size: 11px; color: #5469d4; margin-top: 3px; font-weight: 500; }
    .num { text-align: center; white-space: nowrap; }
    td.num:last-child, th:last-child { text-align: right; }
    th:nth-child(2), th:nth-child(3), th:nth-child(4) { text-align: center; }
    .strong { font-weight: 700; }
    .totals { padding: 8px 32px 24px; }
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 5px 0;
      font-size: 14px;
      color: #4f566b;
    }
    .total-row.grand {
      margin-top: 12px;
      padding-top: 14px;
      border-top: 2px solid #0a2540;
      font-size: 20px;
      font-weight: 800;
      color: #0a2540;
    }
    .meta-row {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      padding: 14px 32px;
      background: #f6f9fc;
      border-top: 1px solid #e3e8ef;
      font-size: 13px;
    }
    .meta-row span:first-child { color: #697386; font-weight: 600; }
    .meta-row span:last-child { font-weight: 700; text-align: right; }
    .footer {
      text-align: center;
      padding: 20px 32px 28px;
      color: #8792a2;
      font-size: 12px;
      border-top: 1px solid #eef2f7;
    }
    .footer strong { color: #4f566b; }
    @media print {
      body { background: #fff; padding: 0; }
      .invoice { box-shadow: none; border-radius: 0; border: none; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="toolbar no-print">
    <button class="btn-print" onclick="window.print()">🖨️ ${escapeHtml(L.print)}</button>
  </div>
  <div class="invoice">
    <div class="header">
      <div class="brand">
        <img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(L.shopName)}" />
        <div>
          <h1>${escapeHtml(L.shopName)}</h1>
          <p>${escapeHtml(L.shopTagline)}</p>
        </div>
      </div>
      <div class="doc-title">
        <div class="label">${escapeHtml(L.title)}</div>
        <div class="ref">${escapeHtml(ref)}</div>
        ${isPaid ? `<div class="badge-paid">✓ ${escapeHtml(L.paid)}</div>` : ''}
      </div>
    </div>
    ${stripeBlock}
    <div class="section">
      <div class="section-title">${escapeHtml(L.customer)}</div>
      <div class="info-grid">
        <div>
          <div class="info-label">${escapeHtml(L.customer)}</div>
          <div class="info-value">${escapeHtml(customerName)}</div>
        </div>
        <div>
          <div class="info-label">${escapeHtml(L.date)}</div>
          <div class="info-value">${escapeHtml(formatDate(orderDate, lang))}</div>
        </div>
        <div>
          <div class="info-label">${escapeHtml(L.email)}</div>
          <div class="info-value">${escapeHtml(customerEmail)}</div>
        </div>
        <div>
          <div class="info-label">${escapeHtml(L.phone)}</div>
          <div class="info-value">${escapeHtml(customerPhone)}</div>
        </div>
        ${
          customerAddress
            ? `<div class="span-2">
          <div class="info-label">${escapeHtml(L.address)}</div>
          <div class="info-value">${escapeHtml(customerAddress)}</div>
        </div>`
            : ''
        }
        ${
          paidAt
            ? `<div>
          <div class="info-label">${escapeHtml(L.paidAt)}</div>
          <div class="info-value">${escapeHtml(formatDate(paidAt, lang))}</div>
        </div>`
            : ''
        }
      </div>
    </div>
    <div class="section">
      <div class="section-title">${escapeHtml(L.item)}</div>
      <table>
        <thead>
          <tr>
            <th>${escapeHtml(L.item)}</th>
            <th>${escapeHtml(L.size)}</th>
            <th>${escapeHtml(L.qty)}</th>
            <th>${escapeHtml(L.unitPrice)}</th>
            <th>${escapeHtml(L.lineTotal)}</th>
          </tr>
        </thead>
        <tbody>
          ${cartRows || `<tr><td colspan="5" style="text-align:center;color:#8792a2;">—</td></tr>`}
        </tbody>
      </table>
    </div>
    <div class="totals">
      <div class="total-row"><span>${escapeHtml(L.subtotal)}</span><span>${formatMoney(subtotal, lang)}</span></div>
      ${shippingFee > 0 ? `<div class="total-row"><span>${escapeHtml(L.shipping)}</span><span>${formatMoney(shippingFee, lang)}</span></div>` : ''}
      ${discount > 0 ? `<div class="total-row"><span>${escapeHtml(L.discount)}</span><span style="color:#df1b41;">-${formatMoney(discount, lang)}</span></div>` : ''}
      <div class="total-row grand"><span>${escapeHtml(L.grandTotal)}</span><span>${formatMoney(grandTotal, lang)}</span></div>
    </div>
    <div class="meta-row">
      <span>${escapeHtml(L.paymentMethod)}</span>
      <span>${escapeHtml(paymentMethodLabel(order, lang))}</span>
    </div>
    <div class="meta-row" style="border-top:none;padding-top:0;">
      <span>${escapeHtml(L.status)}</span>
      <span>${escapeHtml(statusLabel(status, lang))}</span>
    </div>
    <div class="footer">
      <p><strong>${escapeHtml(L.thankYou)}</strong></p>
      <p style="margin-top:6px;">${escapeHtml(L.generatedAt)}: ${escapeHtml(formatDateTime(new Date(), lang))}</p>
      <p style="margin-top:4px;">${escapeHtml(absoluteUrl('/'))}</p>
    </div>
  </div>
</body>
</html>`;
}
