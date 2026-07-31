import { absoluteUrl } from '@/lib/site';

const TH_TIMEZONE = 'Asia/Bangkok';

export type InvoiceLang = 'th' | 'en';

export interface InvoiceBuildOptions {
  stripeReceiptUrl?: string | null;
  /** Inline QR as SVG markup (preferred — works under CSP / srcDoc) */
  qrSvg?: string | null;
  /** @deprecated use qrSvg */
  qrDataUrl?: string | null;
}

/** Issuer / organization details for official receipts & payment notices */
export const ISSUER = {
  nameTh: 'ชุมนุมคอมพิวเตอร์และวิทยาการคำนวณ คณะวิทยาศาสตร์ มหาวิทยาลัยสงขลานครินทร์',
  nameEn: 'Computer Science & Computing Club, Faculty of Science, Prince of Songkla University',
  shortTh: 'PSU SCC Shop',
  shortEn: 'PSU SCC Shop',
  addressTh: '15 ถ.กาญจนวณิชย์ ต.คอหงส์ อ.หาดใหญ่ จ.สงขลา 90110',
  addressEn: '15 Kanchanawanit Rd, Kho Hong, Hat Yai, Songkhla 90110, Thailand',
  phone: '063-092-7759',
  email: 'psuscc@psuscc.club',
  vatNoteTh: 'ได้รับการยกเว้นภาษีมูลค่าเพิ่ม',
  vatNoteEn: 'VAT exempt',
} as const;

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatMoney(amount: number, lang: InvoiceLang): string {
  const n = Number.isFinite(amount) ? amount : 0;
  return `฿${n?.toLocaleString(lang === 'th' ? 'th-TH' : 'en-US', {
    minimumFractionDigits: n % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

function invoiceLocale(lang: InvoiceLang): string {
  return lang === 'th' ? 'th-TH' : 'en-US';
}

function formatDateTime(iso: Date | string, lang: InvoiceLang): string {
  try {
    const date = typeof iso === 'string' ? new Date(iso) : iso;
    if (Number.isNaN(date.getTime())) return String(iso);
    return date?.toLocaleString(invoiceLocale(lang), {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: TH_TIMEZONE,
    });
  } catch {
    return String(iso);
  }
}

function hashRefSeq(ref: string): string {
  let hash = 0;
  const key = String(ref || '');
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return String((hash % 9000) + 1000);
}

function bangkokYearMonth(issuedAt: string | Date): { year: string; month: string } {
  const date = typeof issuedAt === 'string' ? new Date(issuedAt) : issuedAt;
  const valid = !Number.isNaN(date.getTime()) ? date : new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TH_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(valid);
  return {
    year: parts.find((p) => p.type === 'year')?.value || String(valid.getFullYear()),
    month: parts.find((p) => p.type === 'month')?.value || '01',
  };
}

/** Deterministic receipt no. from order ref + issue date (REC-YYYYMM-####) */
export function buildReceiptNumber(ref: string, issuedAt: string | Date): string {
  const { year, month } = bangkokYearMonth(issuedAt);
  return `REC-${year}${month}-${hashRefSeq(ref)}`;
}

/** Deterministic payment notice no. from order ref + order date (PAY-YYYYMM-####) */
export function buildPaymentNoticeNumber(ref: string, issuedAt: string | Date): string {
  const { year, month } = bangkokYearMonth(issuedAt);
  return `PAY-${year}${month}-${hashRefSeq(ref)}`;
}

/**
 * Fix line totals: order carts often store unitPrice/subtotal while `total` is 0.
 * Never treat a literal 0 `total` as authoritative when unit price exists.
 */
export function resolveCartLineAmounts(item: Record<string, unknown>): {
  qty: number;
  unitPrice: number;
  lineTotal: number;
} {
  const qty = Math.max(1, Number(item.qty ?? item.quantity ?? 1) || 1);
  const unitCandidate =
    Number(item.unitPrice ?? 0) ||
    Number(item.price ?? 0) ||
    0;
  const explicitLine =
    Number(item.subtotal ?? 0) ||
    Number(item.lineTotal ?? 0) ||
    Number(item.total ?? 0) ||
    0;

  let lineTotal = 0;
  let unitPrice = 0;

  if (explicitLine > 0 && unitCandidate > 0) {
    // Prefer explicit line when it matches unit*qty (±1 satang), else use unit*qty
    const expected = unitCandidate * qty;
    lineTotal = Math.abs(explicitLine - expected) < 0.02 ? explicitLine : expected;
    unitPrice = unitCandidate;
  } else if (unitCandidate > 0) {
    unitPrice = unitCandidate;
    lineTotal = unitCandidate * qty;
  } else if (explicitLine > 0) {
    lineTotal = explicitLine;
    unitPrice = qty > 0 ? explicitLine / qty : explicitLine;
  }

  return { qty, unitPrice, lineTotal };
}

/** Thai baht text e.g. "(สามร้อยหกสิบเก้าบาทถ้วน)" */
export function bahtTextThai(amount: number): string {
  const abs = Math.abs(Number(amount) || 0);
  const baht = Math.floor(abs + 1e-9);
  const satang = Math.round((abs - baht) * 100);

  const ones = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
  const positions = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];

  const readNumber = (n: number): string => {
    if (n === 0) return ones[0];
    if (n >= 1_000_000) {
      const millions = Math.floor(n / 1_000_000);
      const rest = n % 1_000_000;
      return `${readNumber(millions)}ล้าน${rest ? readNumber(rest) : ''}`;
    }
    const digits = String(n).split('').map((d) => Number(d));
    let text = '';
    for (let i = 0; i < digits.length; i++) {
      const d = digits[i];
      const pos = digits.length - i - 1;
      if (d === 0) continue;
      if (pos === 1) {
        if (d === 1) text += 'สิบ';
        else if (d === 2) text += 'ยี่สิบ';
        else text += `${ones[d]}สิบ`;
      } else if (pos === 0) {
        text += d === 1 && digits.length > 1 ? 'เอ็ด' : ones[d];
      } else {
        text += `${ones[d]}${positions[pos]}`;
      }
    }
    return text || ones[0];
  };

  let text = `${readNumber(baht)}บาท`;
  if (satang <= 0) text += 'ถ้วน';
  else text += `${readNumber(satang)}สตางค์`;
  if (amount < 0) text = `ลบ${text}`;
  return `(${text})`;
}

export function bahtTextEnglish(amount: number): string {
  const n = Math.abs(Number(amount) || 0);
  const formatted = n?.toLocaleString('en-US', {
    minimumFractionDigits: n % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `(${amount < 0 ? 'Minus ' : ''}${formatted} Baht only)`;
}

/** Localized amount-in-words for invoices / payment notices */
export function bahtText(amount: number, lang: InvoiceLang): string {
  return lang === 'th' ? bahtTextThai(amount) : bahtTextEnglish(amount);
}

interface InvoiceLabelSet {
  title: string;
  original: string;
  receiptNo: string;
  orderRef: string;
  issuedAt: string;
  date: string;
  paidAt: string;
  customer: string;
  email: string;
  phone: string;
  address: string;
  no: string;
  item: string;
  size: string;
  qty: string;
  unitPrice: string;
  lineTotal: string;
  subtotal: string;
  shipping: string;
  discount: string;
  grandTotal: string;
  amountInWords: string;
  paymentMethod: string;
  status: string;
  pattern: string;
  jerseyName: string;
  jerseyNumber: string;
  sleeve: string;
  longSleeve: string;
  shortSleeve: string;
  generatedAt: string;
  thankYou: string;
  print: string;
  stripeReceipt: string;
  stripeNote: string;
  paid: string;
  verifyScan: string;
  authorizedSign: string;
  receiverSign: string;
  methods: Record<string, string>;
  statuses: Record<string, string>;
}

const LABELS: Record<InvoiceLang, InvoiceLabelSet> = {
  th: {
    title: 'ใบเสร็จรับเงิน / RECEIPT',
    original: 'ต้นฉบับ / ORIGINAL',
    receiptNo: 'เลขที่ใบเสร็จ',
    orderRef: 'อ้างอิงออเดอร์',
    issuedAt: 'วันที่ออก',
    date: 'วันที่สั่งซื้อ',
    paidAt: 'วันที่ชำระเงิน',
    customer: 'ลูกค้า',
    email: 'อีเมล',
    phone: 'โทรศัพท์',
    address: 'ที่อยู่จัดส่ง',
    no: 'ลำดับ',
    item: 'รายการสินค้า / รายละเอียด',
    size: 'ขนาด',
    qty: 'จำนวน',
    unitPrice: 'ราคา/หน่วย',
    lineTotal: 'จำนวนเงิน',
    subtotal: 'ยอดรวมสินค้า',
    shipping: 'ค่าจัดส่ง',
    discount: 'ส่วนลด',
    grandTotal: 'ยอดชำระทั้งสิ้น',
    amountInWords: 'จำนวนเงินตัวอักษร',
    paymentMethod: 'ช่องทางชำระเงิน',
    status: 'สถานะ',
    pattern: 'ลาย',
    jerseyName: 'ชื่อหลังเสื้อ',
    jerseyNumber: 'เบอร์',
    sleeve: 'แขน',
    longSleeve: 'แขนยาว',
    shortSleeve: 'แขนสั้น',
    generatedAt: 'ออกใบเสร็จเมื่อ',
    thankYou: 'ขอบคุณที่อุดหนุนชุมนุมคอมพิวเตอร์และวิทยาการคำนวณ',
    print: 'พิมพ์ / บันทึก PDF',
    stripeReceipt: 'ใบเสร็จอย่างเป็นทางการจาก Stripe',
    stripeNote: 'การชำระผ่าน Stripe PromptPay — สามารถเปิดใบเสร็จอิเล็กทรอนิกส์จาก Stripe ได้ด้านล่าง',
    paid: 'สำเร็จ',
    verifyScan: 'สแกนเพื่อตรวจสอบเอกสาร',
    authorizedSign: 'ผู้มีอำนาจลงนาม / ผู้รับเงิน',
    receiverSign: '( ลงชื่อ )',
    methods: {
      promptpay: 'โอนเงินออนไลน์ PromptPay (Stripe)',
      credit_card: 'บัตรเครดิต/เดบิต',
      bank_transfer: 'โอนเงินออนไลน์',
      slip: 'อัปโหลดสลิป',
      default: 'โอนเงินออนไลน์',
    },
    statuses: {
      PAID: 'สำเร็จ',
      WAITING_PAYMENT: 'รอชำระ',
      READY: 'พร้อมจัดส่ง',
      SHIPPED: 'จัดส่งแล้ว',
      RECEIVED: 'ได้รับแล้ว',
      COMPLETED: 'สำเร็จ',
      CANCELLED: 'ยกเลิก',
    },
  },
  en: {
    title: 'RECEIPT',
    original: 'ORIGINAL',
    receiptNo: 'Receipt No.',
    orderRef: 'Order Ref.',
    issuedAt: 'Issued',
    date: 'Order Date',
    paidAt: 'Paid At',
    customer: 'Customer',
    email: 'Email',
    phone: 'Phone',
    address: 'Shipping Address',
    no: 'No.',
    item: 'Description',
    size: 'Size',
    qty: 'Qty',
    unitPrice: 'Unit Price',
    lineTotal: 'Amount',
    subtotal: 'Subtotal',
    shipping: 'Shipping',
    discount: 'Discount',
    grandTotal: 'Amount Paid',
    amountInWords: 'Amount in words',
    paymentMethod: 'Payment Method',
    status: 'Status',
    pattern: 'Pattern',
    jerseyName: 'Jersey Name',
    jerseyNumber: 'Number',
    sleeve: 'Sleeve',
    longSleeve: 'Long sleeve',
    shortSleeve: 'Short sleeve',
    generatedAt: 'Generated at',
    thankYou: 'Thank you for supporting PSU SCC',
    print: 'Print / Save PDF',
    stripeReceipt: 'Official Stripe Receipt',
    stripeNote: 'Paid via Stripe PromptPay — open the official Stripe receipt below.',
    paid: 'Paid',
    verifyScan: 'Scan to verify receipt',
    authorizedSign: 'Authorized signature / Cashier',
    receiverSign: '( Signature )',
    methods: {
      promptpay: 'Online transfer PromptPay (Stripe)',
      credit_card: 'Credit / Debit Card',
      bank_transfer: 'Online bank transfer',
      slip: 'Slip Upload',
      default: 'Online transfer',
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

/** Show shipping address only for delivery orders (not pickup / in-store). */
function orderRequiresShippingAddress(order: Record<string, unknown>): boolean {
  const shippingOpt = readOrderField(
    order,
    'shippingOption',
    'shipping_option',
    'shippingOptionId',
    'shipping_option_id'
  ).toLowerCase();
  const shippingProvider = readOrderField(order, 'shippingProvider', 'shipping_provider').toLowerCase();
  const shippingFee = Number(order.shippingFee ?? order.shipping_fee ?? 0) || 0;

  const isPickup =
    shippingOpt === 'pickup' ||
    shippingProvider === 'pickup' ||
    shippingOpt.includes('รับเอง') ||
    shippingOpt.includes('รับหน้าร้าน') ||
    shippingOpt.includes('pick up') ||
    shippingOpt.includes('รับ');

  if (isPickup) return false;
  if (shippingOpt && !isPickup) return true;
  return shippingFee > 0;
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

/** Sanitize QR SVG from `qrcode` — allow only SVG markup. */
function sanitizeQrSvg(svg: string): string {
  const trimmed = String(svg || '').trim();
  if (!trimmed.startsWith('<svg')) return '';
  // Strip scripts / event handlers just in case
  return trimmed
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '');
}

/** Soft circular official stamp (inline SVG) over signature area */
function buildOfficialStampSvg(lang: InvoiceLang): string {
  const ring = lang === 'th' ? 'ชุมนุมคอมพิวเตอร์และวิทยาการคำนวณ · ม.อ. หาดใหญ่' : 'PSU SCC · Faculty of Science · PSU';
  const center = lang === 'th' ? 'SCC' : 'SCC';
  const sub = lang === 'th' ? 'ร้านค้าชุมนุม' : 'CLUB SHOP';
  return `
<svg class="official-stamp" viewBox="0 0 120 120" width="120" height="120" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <circle cx="60" cy="60" r="56" fill="none" stroke="#1e3a8a" stroke-width="2.2" opacity="0.55"/>
  <circle cx="60" cy="60" r="48" fill="none" stroke="#1e3a8a" stroke-width="1" opacity="0.45" stroke-dasharray="2 2"/>
  <circle cx="60" cy="60" r="36" fill="none" stroke="#1e3a8a" stroke-width="1.4" opacity="0.5"/>
  <text x="60" y="56" text-anchor="middle" font-family="Sarabun, sans-serif" font-size="18" font-weight="700" fill="#1e3a8a" opacity="0.55">${escapeHtml(center)}</text>
  <text x="60" y="72" text-anchor="middle" font-family="Sarabun, sans-serif" font-size="8" font-weight="600" fill="#1e3a8a" opacity="0.5" letter-spacing="0.08em">${escapeHtml(sub)}</text>
  <defs>
    <path id="stamp-ring" d="M60,60 m-42,0 a42,42 0 1,1 84,0 a42,42 0 1,1 -84,0"/>
  </defs>
  <text font-family="Sarabun, sans-serif" font-size="7.2" fill="#1e3a8a" opacity="0.55" letter-spacing="0.5">
    <textPath xlink:href="#stamp-ring" href="#stamp-ring" startOffset="0%">${escapeHtml(ring)} · </textPath>
  </text>
</svg>`;
}

function renderQrBlock(options: InvoiceBuildOptions, verifyUrl: string, receiptNo: string, label: string): string {
  const svg = sanitizeQrSvg(options.qrSvg || '');
  if (svg) {
    return `
      <div class="qr-block">
        <div class="qr-svg">${svg}</div>
        <p>${escapeHtml(label)}<br /><span class="mono" style="font-size:9px;word-break:break-all;">${escapeHtml(receiptNo)}</span></p>
      </div>`;
  }
  // Last-resort: link + code (never broken external img)
  return `
      <div class="qr-block">
        <div class="qr-fallback">
          <div class="qr-fallback-title">VERIFY</div>
          <div class="mono qr-fallback-code">${escapeHtml(receiptNo)}</div>
          <a class="qr-fallback-link" href="${escapeHtml(verifyUrl)}">${escapeHtml(verifyUrl.replace(/^https?:\/\//, '').slice(0, 42))}…</a>
        </div>
        <p>${escapeHtml(label)}</p>
      </div>`;
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
  const receiptIssuedDate =
    readOrderField(order, 'receiptIssuedAt', 'receipt_issued_at') ||
    paidAt ||
    orderDate;
  const status = readOrderField(order, 'status') || 'WAITING_PAYMENT';
  const isPaid =
    ['PAID', 'READY', 'SHIPPED', 'RECEIVED', 'COMPLETED'].includes(status.toUpperCase()) ||
    order.paymentVerified === true;

  const lineAmounts = cart.map((item) => resolveCartLineAmounts(item));
  const subtotalFromCart = lineAmounts.reduce((sum, line) => sum + line.lineTotal, 0);
  const orderSubtotal = Number(order.subtotal ?? 0) || 0;
  const subtotal = subtotalFromCart > 0 ? subtotalFromCart : orderSubtotal;

  const shippingFee = Number(order.shippingFee ?? order.shipping_fee ?? 0) || 0;
  const discount = Number(order.discount ?? order.promoDiscount ?? 0) || 0;
  const grandTotal =
    Number(order.totalAmount ?? order.total_amount ?? 0) ||
    Math.max(0, subtotal + shippingFee - discount);

  const customerName = readOrderField(order, 'customerName', 'customer_name', 'name') || '-';
  const customerEmail = readOrderField(order, 'customerEmail', 'customer_email', 'email') || '-';
  const customerPhone = readOrderField(order, 'customerPhone', 'customer_phone', 'phone') || '-';
  const customerAddress = orderRequiresShippingAddress(order)
    ? readOrderField(order, 'customerAddress', 'customer_address', 'address')
    : '';

  const receiptNo = buildReceiptNumber(ref, receiptIssuedDate);
  const verifyUrl = absoluteUrl(`/receipt/${encodeURIComponent(ref)}?lang=${lang}`);
  const amountWords = lang === 'th' ? bahtTextThai(grandTotal) : bahtTextEnglish(grandTotal);
  const vatNote = lang === 'th' ? ISSUER.vatNoteTh : ISSUER.vatNoteEn;
  const orgName = lang === 'th' ? ISSUER.nameTh : ISSUER.nameEn;
  const orgAddress = lang === 'th' ? ISSUER.addressTh : ISSUER.addressEn;
  const paymentStatusText = isPaid
    ? lang === 'th'
      ? `${paymentMethodLabel(order, lang)} (สถานะ: ${L.paid})`
      : `${paymentMethodLabel(order, lang)} (Status: ${L.paid})`
    : paymentMethodLabel(order, lang);

  const cartRows = cart
    .map((item, index) => {
      const { qty, unitPrice, lineTotal } = lineAmounts[index] || resolveCartLineAmounts(item);
      const name =
        readOrderField(item as Record<string, unknown>, 'productName', 'name') || L.item;
      const size = String(item.size || '-');
      const meta = formatCartLineMeta(item, lang);
      const titleWithSize =
        size && size !== '-'
          ? `${escapeHtml(name)} <span class="size-inline">(${escapeHtml(L.size)}: ${escapeHtml(size)})</span>`
          : escapeHtml(name);

      return `
        <tr>
          <td class="num col-no">${index + 1}</td>
          <td>
            <div class="line-title">${titleWithSize}</div>
            ${meta}
          </td>
          <td class="num col-size">${escapeHtml(size)}</td>
          <td class="num col-qty">${qty}</td>
          <td class="num col-unit">${formatMoney(unitPrice, lang)}</td>
          <td class="num col-amt strong">${formatMoney(lineTotal, lang)}</td>
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

  const logoUrl = absoluteUrl('/logo3-01-01-01-01.png');

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(L.title)} — ${escapeHtml(receiptNo)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');
    :root {
      --ink: #1f2937;
      --navy: #1e3a8a;
      --muted: #4b5563;
      --line: #cbd5e1;
      --paper: #ffffff;
      --wash: #f8fafc;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Sarabun', 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #e5e7eb;
      color: var(--ink);
      padding: 20px 12px 36px;
      line-height: 1.45;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .toolbar { text-align: center; margin-bottom: 16px; }
    .btn-print {
      padding: 10px 20px;
      background: var(--navy);
      color: #fff;
      border: none;
      border-radius: 4px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      font-family: inherit;
    }
    .sheet {
      width: 100%;
      max-width: 210mm;
      min-height: 297mm;
      margin: 0 auto;
      background: var(--paper);
      border: 1px solid #94a3b8;
      box-shadow: 0 10px 30px rgba(15, 23, 42, 0.12);
      padding: 18mm 16mm 16mm;
      position: relative;
    }
    .original-badge {
      position: absolute;
      top: 12mm;
      right: 14mm;
      border: 1.5px solid var(--navy);
      color: var(--navy);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.04em;
      padding: 4px 10px;
      text-transform: uppercase;
    }
    .header {
      display: grid;
      grid-template-columns: 56px 1fr;
      gap: 14px;
      align-items: start;
      padding-bottom: 14px;
      border-bottom: 2.5px solid var(--navy);
      padding-right: 120px;
    }
    .header img {
      width: 56px;
      height: 56px;
      object-fit: contain;
      border: 1px solid var(--line);
      padding: 3px;
      background: #fff;
    }
    .org-name {
      font-size: 14px;
      font-weight: 700;
      color: var(--navy);
      line-height: 1.35;
    }
    .org-name-en {
      font-size: 11px;
      color: var(--muted);
      margin-top: 2px;
      line-height: 1.35;
    }
    .org-contact {
      margin-top: 6px;
      font-size: 11px;
      color: var(--muted);
      line-height: 1.5;
    }
    .doc-title {
      text-align: center;
      margin: 18px 0 16px;
    }
    .doc-title h1 {
      font-size: 22px;
      font-weight: 700;
      color: var(--navy);
      letter-spacing: 0.04em;
    }
    .doc-title .sub {
      font-size: 12px;
      color: var(--muted);
      margin-top: 2px;
    }
    .meta {
      display: grid;
      grid-template-columns: 1.2fr 1fr;
      gap: 10px 24px;
      padding: 12px 0 16px;
      border-bottom: 1px solid var(--line);
      font-size: 12.5px;
    }
    .meta .label {
      color: var(--muted);
      font-size: 11px;
      font-weight: 600;
    }
    .meta .value {
      font-weight: 600;
      margin-top: 1px;
      word-break: break-word;
    }
    .meta .mono { font-family: ui-monospace, 'Courier New', monospace; font-size: 12px; }
    table.items {
      width: 100%;
      border-collapse: collapse;
      margin-top: 16px;
      font-size: 12.5px;
    }
    table.items th {
      background: var(--wash);
      border-top: 1.5px solid var(--navy);
      border-bottom: 1.5px solid var(--navy);
      color: var(--navy);
      font-size: 11px;
      font-weight: 700;
      padding: 8px 6px;
      text-align: left;
    }
    table.items td {
      border-bottom: 1px solid var(--line);
      padding: 9px 6px;
      vertical-align: top;
    }
    .line-title { font-weight: 600; color: var(--ink); }
    .size-inline { font-weight: 500; color: var(--muted); }
    .line-meta { font-size: 11px; color: var(--muted); margin-top: 2px; }
    .num { text-align: center; white-space: nowrap; }
    .col-no { width: 36px; }
    .col-size { width: 64px; }
    .col-qty { width: 52px; }
    .col-unit, .col-amt { text-align: right !important; width: 88px; }
    th.col-unit, th.col-amt { text-align: right; }
    th.col-no, th.col-size, th.col-qty { text-align: center; }
    .strong { font-weight: 700; }
    .summary {
      display: grid;
      grid-template-columns: 1.3fr 1fr;
      gap: 16px;
      margin-top: 14px;
      align-items: start;
    }
    .words-box {
      border: 1px solid var(--line);
      background: var(--wash);
      padding: 10px 12px;
      font-size: 12px;
    }
    .words-box .label { color: var(--muted); font-size: 11px; font-weight: 600; }
    .words-box .value { margin-top: 4px; font-weight: 700; color: var(--ink); }
    .pay-meta { margin-top: 10px; font-size: 12px; color: var(--muted); line-height: 1.55; }
    .pay-meta strong { color: var(--ink); }
    .totals {
      border: 1px solid var(--line);
      padding: 8px 12px 10px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 4px 0;
      font-size: 12.5px;
      color: var(--muted);
    }
    .total-row.grand {
      margin-top: 6px;
      padding-top: 8px;
      border-top: 2px solid var(--navy);
      font-size: 15px;
      font-weight: 800;
      color: var(--navy);
    }
    .vat-note {
      margin-top: 8px;
      font-size: 11px;
      color: var(--muted);
      font-style: italic;
    }
    .footer-grid {
      display: grid;
      grid-template-columns: 140px 1fr;
      gap: 24px;
      margin-top: 28px;
      padding-top: 16px;
      border-top: 1px solid var(--line);
      align-items: end;
    }
    .qr-block { text-align: center; }
    .qr-svg {
      display: inline-flex;
      width: 110px;
      height: 110px;
      border: 1px solid var(--line);
      padding: 4px;
      background: #fff;
      align-items: center;
      justify-content: center;
    }
    .qr-svg svg { width: 100%; height: 100%; display: block; }
    .qr-fallback {
      width: 110px;
      height: 110px;
      margin: 0 auto;
      border: 1px solid var(--navy);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      padding: 6px;
      background: var(--wash);
    }
    .qr-fallback-title { font-size: 10px; font-weight: 800; color: var(--navy); letter-spacing: 0.08em; }
    .qr-fallback-code { font-size: 9px; color: var(--ink); word-break: break-all; line-height: 1.2; }
    .qr-fallback-link { font-size: 8px; color: var(--navy); text-decoration: none; word-break: break-all; line-height: 1.2; }
    .qr-block p {
      margin-top: 6px;
      font-size: 10px;
      color: var(--muted);
      line-height: 1.35;
    }
    .sign-block {
      text-align: center;
      padding-bottom: 4px;
      position: relative;
    }
    .sign-area {
      position: relative;
      margin: 8px auto 8px;
      width: 70%;
      max-width: 280px;
      height: 100px;
    }
    .sign-line {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 18px;
      border-bottom: 1px solid var(--ink);
    }
    .official-stamp {
      position: absolute;
      left: 50%;
      top: 46%;
      transform: translate(-50%, -50%) rotate(-12deg);
      opacity: 0.72;
      pointer-events: none;
      mix-blend-mode: multiply;
    }
    .sign-caption {
      font-size: 12px;
      font-weight: 600;
      color: var(--ink);
    }
    .sign-sub {
      font-size: 11px;
      color: var(--muted);
      margin-top: 2px;
    }
    .thanks {
      margin-top: 18px;
      text-align: center;
      font-size: 11px;
      color: var(--muted);
    }
    .stripe-box {
      margin-top: 14px;
      padding: 12px 14px;
      border: 1px solid var(--line);
      background: var(--wash);
      font-size: 12px;
    }
    .stripe-box p { color: var(--muted); margin-bottom: 8px; }
    .stripe-btn {
      display: inline-block;
      padding: 8px 12px;
      background: #4f46e5;
      color: #fff !important;
      text-decoration: none;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 700;
    }
    @media print {
      body { background: #fff; padding: 0; }
      .sheet {
        max-width: none;
        width: 210mm;
        min-height: 297mm;
        margin: 0;
        border: none;
        box-shadow: none;
        padding: 12mm 14mm;
      }
      .toolbar,
      .no-print { display: none !important; }
      .official-stamp { opacity: 0.65; }
      @page { size: A4; margin: 10mm; }
    }
    @media (max-width: 720px) {
      .sheet { padding: 18px 14px 24px; min-height: 0; }
      .header { padding-right: 0; }
      .original-badge { position: static; margin-bottom: 10px; display: inline-block; }
      .meta, .summary, .footer-grid { grid-template-columns: 1fr; }
      .col-size { display: none; }
      th.col-size { display: none; }
    }
  </style>
</head>
<body>
  <div class="toolbar no-print">
    <button class="btn-print" type="button" onclick="window.print()">${escapeHtml(L.print)}</button>
  </div>
  <article class="sheet" aria-label="${escapeHtml(L.title)}">
    <div class="original-badge">${escapeHtml(L.original)}</div>
    <header class="header">
      <img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(ISSUER.shortTh)}" />
      <div>
        <div class="org-name">${escapeHtml(lang === 'th' ? ISSUER.nameTh : ISSUER.nameEn)}</div>
        <div class="org-name-en">${escapeHtml(lang === 'th' ? ISSUER.nameEn : ISSUER.nameTh)}</div>
        <div class="org-contact">
          ${escapeHtml(orgAddress)}<br />
          ${lang === 'th' ? 'โทร' : 'Tel'}: ${escapeHtml(ISSUER.phone)}
          &nbsp;|&nbsp;
          ${lang === 'th' ? 'อีเมล' : 'Email'}: ${escapeHtml(ISSUER.email)}
        </div>
      </div>
    </header>

    <div class="doc-title">
      <h1>${escapeHtml(L.title)}</h1>
      <div class="sub">${escapeHtml(ISSUER.shortTh)}</div>
    </div>

    <section class="meta">
      <div>
        <div class="label">${escapeHtml(L.customer)}</div>
        <div class="value">${escapeHtml(customerName)}</div>
      </div>
      <div>
        <div class="label">${escapeHtml(L.receiptNo)}</div>
        <div class="value mono">${escapeHtml(receiptNo)}</div>
      </div>
      <div>
        <div class="label">${escapeHtml(L.email)}</div>
        <div class="value">${escapeHtml(customerEmail)}</div>
      </div>
      <div>
        <div class="label">${escapeHtml(L.orderRef)}</div>
        <div class="value mono">${escapeHtml(ref)}</div>
      </div>
      <div>
        <div class="label">${escapeHtml(L.phone)}</div>
        <div class="value">${escapeHtml(customerPhone)}</div>
      </div>
      <div>
        <div class="label">${escapeHtml(L.issuedAt)}</div>
        <div class="value">${escapeHtml(formatDateTime(receiptIssuedDate, lang))}</div>
      </div>
      ${
        customerAddress
          ? `<div style="grid-column:1/-1">
        <div class="label">${escapeHtml(L.address)}</div>
        <div class="value">${escapeHtml(customerAddress)}</div>
      </div>`
          : ''
      }
      ${
        paidAt
          ? `<div>
        <div class="label">${escapeHtml(L.paidAt)}</div>
        <div class="value">${escapeHtml(formatDateTime(paidAt, lang))}</div>
      </div>`
          : `<div>
        <div class="label">${escapeHtml(L.date)}</div>
        <div class="value">${escapeHtml(formatDateTime(orderDate, lang))}</div>
      </div>`
      }
      <div>
        <div class="label">${escapeHtml(L.status)}</div>
        <div class="value">${escapeHtml(statusLabel(status, lang))}</div>
      </div>
    </section>

    ${stripeBlock}

    <table class="items">
      <thead>
        <tr>
          <th class="col-no">${escapeHtml(L.no)}</th>
          <th>${escapeHtml(L.item)}</th>
          <th class="col-size">${escapeHtml(L.size)}</th>
          <th class="col-qty">${escapeHtml(L.qty)}</th>
          <th class="col-unit">${escapeHtml(L.unitPrice)}</th>
          <th class="col-amt">${escapeHtml(L.lineTotal)}</th>
        </tr>
      </thead>
      <tbody>
        ${
          cartRows ||
          `<tr><td colspan="6" style="text-align:center;color:#6b7280;padding:16px;">—</td></tr>`
        }
      </tbody>
    </table>

    <section class="summary">
      <div>
        <div class="words-box">
          <div class="label">${escapeHtml(L.amountInWords)}</div>
          <div class="value">${escapeHtml(amountWords)}</div>
        </div>
        <div class="pay-meta">
          <div><strong>${escapeHtml(L.paymentMethod)}:</strong> ${escapeHtml(paymentStatusText)}</div>
        </div>
      </div>
      <div class="totals">
        <div class="total-row"><span>${escapeHtml(L.subtotal)}</span><span>${formatMoney(subtotal, lang)}</span></div>
        ${
          shippingFee > 0
            ? `<div class="total-row"><span>${escapeHtml(L.shipping)}</span><span>${formatMoney(shippingFee, lang)}</span></div>`
            : ''
        }
        ${
          discount > 0
            ? `<div class="total-row"><span>${escapeHtml(L.discount)}</span><span>-${formatMoney(discount, lang)}</span></div>`
            : ''
        }
        <div class="total-row grand"><span>${escapeHtml(L.grandTotal)}</span><span>${formatMoney(grandTotal, lang)}</span></div>
        <div class="vat-note">${escapeHtml(vatNote)}</div>
      </div>
    </section>

    <section class="footer-grid">
      ${renderQrBlock(options, verifyUrl, receiptNo, L.verifyScan)}
      <div class="sign-block">
        <div class="sign-area" aria-hidden="true">
          ${buildOfficialStampSvg(lang)}
          <div class="sign-line"></div>
        </div>
        <div class="sign-caption">${escapeHtml(L.receiverSign)}</div>
        <div class="sign-sub">${escapeHtml(L.authorizedSign)}</div>
        <div class="sign-sub" style="margin-top:6px;">${escapeHtml(ISSUER.shortTh)}</div>
      </div>
    </section>

    <p class="thanks">
      ${escapeHtml(L.thankYou)}<br />
      ${escapeHtml(L.generatedAt)}: ${escapeHtml(formatDateTime(receiptIssuedDate, lang))}
    </p>
  </article>
</body>
</html>`;
}
