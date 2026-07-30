/* eslint-disable @typescript-eslint/no-explicit-any */
// src/lib/payment.ts
// Client-safe payment types, constants, and pure helpers.
// Secret-key gateway I/O lives in `@/lib/payment-server`.

// ==================== TYPES ====================

export type PaymentMethod =
  | 'bank_transfer'     // โอนผ่านธนาคาร / QR PromptPay (manual + slip)
  | 'promptpay'         // PromptPay ผ่าน gateway (ยืนยันอัตโนมัติ)
  | 'credit_card'       // บัตรเครดิต/เดบิต
  | 'installment'       // ผ่อนชำระ
  | 'true_money'        // TrueMoney Wallet
  | 'rabbit_line_pay'   // Rabbit LINE Pay
  | 'shopeepay'         // ShopeePay
  | 'cod';              // เก็บเงินปลายทาง

export type PaymentGateway =
  | 'omise'             // Omise (Thai-focused)
  | 'stripe'            // Stripe
  | 'gbprimepay'        // GB Prime Pay
  | 'scb'               // SCB Payment Gateway
  | '2c2p';             // 2C2P

export interface PaymentOption {
  id: string;
  method: PaymentMethod;
  gateway?: PaymentGateway;
  name: string;
  nameThai: string;
  descriptionThai?: string;
  description?: string;
  /** Is this option enabled */
  enabled: boolean;
  /** Fee type: fixed or percentage */
  feeType?: 'fixed' | 'percentage';
  /** Fee amount (in satang for fixed, or percentage for percentage type) */
  feeAmount?: number;
  /** Minimum order amount for this payment method */
  minOrderAmount?: number;
  /** Maximum order amount for this payment method */
  maxOrderAmount?: number;
  /** Show icon */
  icon?: string;
  /** Sort order */
  sortOrder?: number;
  /** Gateway specific config */
  gatewayConfig?: Record<string, any>;
}

export interface PaymentConfig {
  /** Default payment method ID */
  defaultMethodId?: string;
  /** Available payment options */
  options: PaymentOption[];
  /** Payment gateways configuration */
  gateways: PaymentGatewayConfig[];
  /** Enable COD (Cash on Delivery) */
  enableCOD: boolean;
  /** COD fee */
  codFee?: number;
}

export interface PaymentGatewayConfig {
  gateway: PaymentGateway;
  enabled: boolean;
  /** Public key (safe to expose) */
  publicKey?: string;
  /** Secret key is stored in environment variables, not here */
  /** Webhook secret for verifying payments */
  webhookEndpoint?: string;
  /** Test mode */
  testMode: boolean;
  /** Supported payment methods */
  supportedMethods: PaymentMethod[];
  /** Stripe-specific configuration */
  stripeConfig?: StripeSpecificConfig;
}

export interface StripeSpecificConfig {
  /** Enable PromptPay QR payments */
  enablePromptPay: boolean;
  /** Enable Credit/Debit Card payments */
  enableCreditCard: boolean;
  /** Minimum amount for PromptPay (THB) */
  promptPayMinAmount: number;
  /** Maximum amount for PromptPay (THB) — 0 = no limit */
  promptPayMaxAmount: number;
  /** Custom statement descriptor (max 22 chars) */
  statementDescriptor?: string;
  /** Enable automatic refund processing via Stripe */
  enableAutoRefund: boolean;
  /** Send receipt email via Stripe */
  receiptEmailEnabled: boolean;
  /** Custom currency (default: thb) */
  currency?: string;
  /** PromptPay QR expiration in minutes (default: 15) */
  promptPayExpirationMinutes?: number;
}

export interface PaymentTransaction {
  id: string;
  orderId: string;
  method: PaymentMethod;
  gateway?: PaymentGateway;
  amount: number;
  currency: string;
  status: PaymentStatus;
  statusText: string;
  createdAt: string;
  updatedAt: string;
  /** Gateway transaction ID */
  gatewayTransactionId?: string;
  /** Gateway charge ID */
  gatewayChargeId?: string;
  /** Card last 4 digits (if card payment) */
  cardLast4?: string;
  /** Card brand (if card payment) */
  cardBrand?: string;
  /** Error message if failed */
  errorMessage?: string;
  /** Raw gateway response */
  rawResponse?: any;
  /** Payment slip URL (for bank transfer) */
  slipUrl?: string;
  /** Payment verified */
  verified: boolean;
  /** Verification method */
  verificationMethod?: 'slipok' | 'manual' | 'gateway';
  /** Verification timestamp */
  verifiedAt?: string;
  /** Verified by (admin email) */
  verifiedBy?: string;
}

export type PaymentStatus =
  | 'pending'           // รอชำระ
  | 'processing'        // กำลังดำเนินการ
  | 'authorized'        // อนุมัติแล้ว (รอ capture)
  | 'paid'              // ชำระแล้ว
  | 'failed'            // ล้มเหลว
  | 'refunded'          // คืนเงินแล้ว
  | 'partially_refunded'// คืนเงินบางส่วน
  | 'cancelled'         // ยกเลิก
  | 'expired';          // หมดอายุ

// ==================== PROVIDER CONFIGS ====================

export const PAYMENT_METHODS: Record<PaymentMethod, {
  name: string;
  nameThai: string;
  icon: string;
  description: string;
  descriptionThai: string;
  requiresGateway: boolean;
  supportedGateways: PaymentGateway[];
}> = {
  bank_transfer: {
    name: 'Bank Transfer / QR PromptPay',
    nameThai: 'โอนเงิน / QR พร้อมเพย์',
    icon: '',
    description: 'Transfer via bank app or scan QR code',
    descriptionThai: 'โอนผ่านแอปธนาคารหรือสแกน QR Code',
    requiresGateway: false,
    supportedGateways: [],
  },
  promptpay: {
    name: 'PromptPay (Auto-verified)',
    nameThai: 'พร้อมเพย์ (ยืนยันอัตโนมัติ)',
    icon: '',
    description: 'Scan QR code, payment confirmed instantly',
    descriptionThai: 'สแกน QR Code ระบบยืนยันการชำระเงินทันที ไม่ต้องแนบสลิป',
    requiresGateway: true,
    supportedGateways: ['stripe'],
  },
  credit_card: {
    name: 'Credit/Debit Card',
    nameThai: 'บัตรเครดิต/เดบิต',
    icon: '',
    description: 'Visa, Mastercard, JCB',
    descriptionThai: 'บัตร Visa, Mastercard, JCB',
    requiresGateway: true,
    supportedGateways: ['omise', 'stripe', 'gbprimepay', '2c2p'],
  },
  installment: {
    name: 'Installment',
    nameThai: 'ผ่อนชำระ',
    icon: '',
    description: 'Pay in installments',
    descriptionThai: 'ผ่อนชำระ 0% ผ่านบัตรเครดิต',
    requiresGateway: true,
    supportedGateways: ['omise', 'gbprimepay', '2c2p'],
  },
  true_money: {
    name: 'TrueMoney Wallet',
    nameThai: 'ทรูมันนี่ วอลเล็ท',
    icon: '',
    description: 'Pay with TrueMoney Wallet',
    descriptionThai: 'ชำระผ่านทรูมันนี่ วอลเล็ท',
    requiresGateway: true,
    supportedGateways: ['omise', 'gbprimepay', '2c2p'],
  },
  rabbit_line_pay: {
    name: 'Rabbit LINE Pay',
    nameThai: 'แรบบิท ไลน์ เพย์',
    icon: '',
    description: 'Pay with Rabbit LINE Pay',
    descriptionThai: 'ชำระผ่านแรบบิท ไลน์ เพย์',
    requiresGateway: true,
    supportedGateways: ['gbprimepay', '2c2p'],
  },
  shopeepay: {
    name: 'ShopeePay',
    nameThai: 'ช้อปปี้เพย์',
    icon: '',
    description: 'Pay with ShopeePay',
    descriptionThai: 'ชำระผ่านช้อปปี้เพย์',
    requiresGateway: true,
    supportedGateways: ['gbprimepay', '2c2p'],
  },
  cod: {
    name: 'Cash on Delivery',
    nameThai: 'เก็บเงินปลายทาง',
    icon: '',
    description: 'Pay when you receive',
    descriptionThai: 'ชำระเงินเมื่อรับสินค้า',
    requiresGateway: false,
    supportedGateways: [],
  },
};

export const PAYMENT_GATEWAYS: Record<PaymentGateway, {
  name: string;
  nameThai: string;
  website: string;
  supportedMethods: PaymentMethod[];
  testModeAvailable: boolean;
  docUrl: string;
}> = {
  omise: {
    name: 'Omise',
    nameThai: 'โอมิเซะ',
    website: 'https://www.omise.co/th',
    supportedMethods: ['credit_card', 'installment', 'true_money'],
    testModeAvailable: true,
    docUrl: 'https://www.omise.co/docs',
  },
  stripe: {
    name: 'Stripe',
    nameThai: 'สไตรพ์',
    website: 'https://stripe.com',
    supportedMethods: ['credit_card', 'promptpay'],
    testModeAvailable: true,
    docUrl: 'https://stripe.com/docs',
  },
  gbprimepay: {
    name: 'GB Prime Pay',
    nameThai: 'จีบี ไพร์ม เพย์',
    website: 'https://www.gbprimepay.com',
    supportedMethods: ['credit_card', 'installment', 'true_money', 'rabbit_line_pay', 'shopeepay'],
    testModeAvailable: true,
    docUrl: 'https://doc.gbprimepay.com',
  },
  scb: {
    name: 'SCB Payment Gateway',
    nameThai: 'SCB Payment Gateway',
    website: 'https://www.scb.co.th',
    supportedMethods: ['credit_card'],
    testModeAvailable: true,
    docUrl: 'https://developer.scb.co.th',
  },
  '2c2p': {
    name: '2C2P',
    nameThai: '2C2P',
    website: 'https://www.2c2p.com',
    supportedMethods: ['credit_card', 'installment', 'true_money', 'rabbit_line_pay', 'shopeepay'],
    testModeAvailable: true,
    docUrl: 'https://developer.2c2p.com',
  },
};

export const PAYMENT_STATUS_THAI: Record<PaymentStatus, string> = {
  pending: 'รอชำระเงิน',
  processing: 'กำลังดำเนินการ',
  authorized: 'อนุมัติแล้ว',
  paid: 'ชำระแล้ว',
  failed: 'ไม่สำเร็จ',
  refunded: 'คืนเงินแล้ว',
  partially_refunded: 'คืนเงินบางส่วน',
  cancelled: 'ยกเลิก',
  expired: 'หมดอายุ',
};

// ==================== DEFAULT CONFIG ====================

export const DEFAULT_PAYMENT_CONFIG: PaymentConfig = {
  enableCOD: false,
  codFee: 30,
  gateways: [],
  options: [
    {
      id: 'bank_transfer',
      method: 'bank_transfer',
      name: 'Bank Transfer / PromptPay',
      nameThai: 'โอนเงิน / พร้อมเพย์',
      description: 'Scan QR code and transfer',
      descriptionThai: 'สแกน QR แล้วโอนเงิน',
      enabled: true,
      sortOrder: 1,
    },
    {
      id: 'credit_card_omise',
      method: 'credit_card',
      gateway: 'omise',
      name: 'Credit/Debit Card (Omise)',
      nameThai: 'บัตรเครดิต/เดบิต',
      description: 'Visa, Mastercard, JCB',
      enabled: false,
      feeType: 'percentage',
      feeAmount: 3.65, // 3.65%
      sortOrder: 2,
    },
    {
      id: 'true_money_omise',
      method: 'true_money',
      gateway: 'omise',
      name: 'TrueMoney Wallet',
      nameThai: 'ทรูมันนี่ วอลเล็ท',
      enabled: false,
      sortOrder: 3,
    },
    {
      id: 'cod',
      method: 'cod',
      name: 'Cash on Delivery',
      nameThai: 'เก็บเงินปลายทาง',
      description: 'Pay when you receive',
      descriptionThai: 'จ่ายเงินเมื่อรับสินค้า',
      enabled: false,
      feeType: 'fixed',
      feeAmount: 30,
      sortOrder: 10,
    },
  ],
};

// ==================== PURE HELPERS ====================

/**
 * Calculate payment fee
 */
export function calculatePaymentFee(option: PaymentOption, orderAmount: number): number {
  if (!option.feeType || !option.feeAmount) return 0;

  if (option.feeType === 'fixed') {
    return option.feeAmount;
  } else {
    // Percentage
    return Math.ceil(orderAmount * (option.feeAmount / 100));
  }
}

/**
 * Check if payment method is available for order amount
 */
export function isPaymentMethodAvailable(
  option: PaymentOption,
  orderAmount: number
): boolean {
  if (!option.enabled) return false;
  if (option.minOrderAmount && orderAmount < option.minOrderAmount) return false;
  if (option.maxOrderAmount && orderAmount > option.maxOrderAmount) return false;
  return true;
}

/**
 * Get available payment options for order
 */
export function getAvailablePaymentOptions(
  config: PaymentConfig,
  orderAmount: number
): PaymentOption[] {
  return config.options
    .filter(opt => isPaymentMethodAvailable(opt, orderAmount))
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
}
