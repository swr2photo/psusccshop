// src/lib/payment.ts
// Payment methods and processing

// ==================== TYPES ====================

export type PaymentMethod = 
  | 'bank_transfer'     // โอนผ่านธนาคาร / QR PromptPay
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
    supportedMethods: ['credit_card'],
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
      enabled: false,
      feeType: 'fixed',
      feeAmount: 30,
      sortOrder: 10,
    },
  ],
};

// ==================== PAYMENT FUNCTIONS ====================

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

// ==================== OMISE INTEGRATION ====================

export interface OmiseChargeParams {
  amount: number;
  currency?: string;
  card?: string;
  customer?: string;
  description?: string;
  metadata?: Record<string, any>;
  returnUri?: string;
  source?: string;
}

export interface OmiseCharge {
  id: string;
  amount: number;
  currency: string;
  status: string;
  paid: boolean;
  authorizeUri?: string;
  failureCode?: string;
  failureMessage?: string;
  card?: {
    id: string;
    brand: string;
    last_digits: string;
    expiration_month: number;
    expiration_year: number;
  };
}

/**
 * Create Omise charge
 */
export async function createOmiseCharge(params: OmiseChargeParams): Promise<OmiseCharge | null> {
  const secretKey = process.env.OMISE_SECRET_KEY;
  
  if (!secretKey) {
    console.error('[Payment] Omise secret key not configured');
    return null;
  }
  
  try {
    const res = await fetch('https://api.omise.co/charges', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(secretKey + ':').toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: params.amount,
        currency: params.currency || 'THB',
        card: params.card,
        customer: params.customer,
        description: params.description,
        metadata: params.metadata,
        return_uri: params.returnUri,
        source: params.source,
      }),
    });
    
    if (!res.ok) {
      const errorData = await res.json();
      console.error('[Payment] Omise charge failed:', errorData);
      return null;
    }
    
    return await res.json();
  } catch (error) {
    console.error('[Payment] Omise charge error:', error);
    return null;
  }
}

/**
 * Create Omise token (should be done client-side ideally)
 */
export async function createOmiseToken(
  cardNumber: string,
  name: string,
  expirationMonth: number,
  expirationYear: number,
  securityCode: string
): Promise<{ id: string } | null> {
  const publicKey = process.env.NEXT_PUBLIC_OMISE_PUBLIC_KEY;
  
  if (!publicKey) {
    console.error('[Payment] Omise public key not configured');
    return null;
  }
  
  try {
    const res = await fetch('https://vault.omise.co/tokens', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(publicKey + ':').toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        card: {
          number: cardNumber,
          name: name,
          expiration_month: expirationMonth,
          expiration_year: expirationYear,
          security_code: securityCode,
        },
      }),
    });
    
    if (!res.ok) {
      const errorData = await res.json();
      console.error('[Payment] Omise token failed:', errorData);
      return null;
    }
    
    return await res.json();
  } catch (error) {
    console.error('[Payment] Omise token error:', error);
    return null;
  }
}

/**
 * Create Omise source for alternative payment methods
 */
export async function createOmiseSource(
  type: 'truemoney' | 'installment_bay' | 'installment_bbl' | 'installment_kbank' | 'installment_ktc' | 'installment_scb',
  amount: number,
  options?: {
    phoneNumber?: string;
    installmentTerm?: number;
  }
): Promise<{ id: string; amount: number; flow: string } | null> {
  const publicKey = process.env.NEXT_PUBLIC_OMISE_PUBLIC_KEY;
  
  if (!publicKey) {
    console.error('[Payment] Omise public key not configured');
    return null;
  }
  
  try {
    const body: Record<string, any> = {
      type,
      amount,
      currency: 'THB',
    };
    
    if (type === 'truemoney' && options?.phoneNumber) {
      body.phone_number = options.phoneNumber;
    }
    
    if (type.startsWith('installment_') && options?.installmentTerm) {
      body.installment_term = options.installmentTerm;
    }
    
    const res = await fetch('https://api.omise.co/sources', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(publicKey + ':').toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    
    if (!res.ok) {
      const errorData = await res.json();
      console.error('[Payment] Omise source failed:', errorData);
      return null;
    }
    
    return await res.json();
  } catch (error) {
    console.error('[Payment] Omise source error:', error);
    return null;
  }
}

/**
 * Verify Omise webhook signature
 */
export function verifyOmiseWebhook(
  payload: string,
  signature: string
): boolean {
  const webhookSecret = process.env.OMISE_WEBHOOK_SECRET;
  
  if (!webhookSecret) {
    console.error('[Payment] Omise webhook secret not configured');
    return false;
  }
  
  // Omise uses the signature directly
  const crypto = require('crypto');
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(payload)
    .digest('base64');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// ==================== STRIPE INTEGRATION ====================

export interface StripePaymentIntentParams {
  amount: number;
  currency?: string;
  paymentMethodTypes?: string[];
  description?: string;
  metadata?: Record<string, any>;
  returnUrl?: string;
}

/**
 * Create Stripe PaymentIntent
 */
export async function createStripePaymentIntent(
  params: StripePaymentIntentParams
): Promise<{ clientSecret: string; id: string } | null> {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  
  if (!secretKey) {
    console.error('[Payment] Stripe secret key not configured');
    return null;
  }
  
  try {
    const body = new URLSearchParams({
      amount: params.amount.toString(),
      currency: params.currency || 'thb',
      'payment_method_types[]': params.paymentMethodTypes?.join(',') || 'card',
    });
    
    if (params.description) {
      body.append('description', params.description);
    }
    
    if (params.metadata) {
      Object.entries(params.metadata).forEach(([key, value]) => {
        body.append(`metadata[${key}]`, String(value));
      });
    }
    
    const res = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });
    
    if (!res.ok) {
      const errorData = await res.json();
      console.error('[Payment] Stripe PaymentIntent failed:', errorData);
      return null;
    }
    
    const data = await res.json();
    return {
      clientSecret: data.client_secret,
      id: data.id,
    };
  } catch (error) {
    console.error('[Payment] Stripe PaymentIntent error:', error);
    return null;
  }
}

/**
 * Verify Stripe webhook signature
 */
export function verifyStripeWebhook(
  payload: string,
  signature: string
): boolean {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  if (!webhookSecret) {
    console.error('[Payment] Stripe webhook secret not configured');
    return false;
  }
  
  try {
    const crypto = require('crypto');
    const signatureParts = signature.split(',').reduce((acc, part) => {
      const [key, value] = part.split('=');
      acc[key] = value;
      return acc;
    }, {} as Record<string, string>);
    
    const timestamp = signatureParts['t'];
    const sig = signatureParts['v1'];
    
    const signedPayload = `${timestamp}.${payload}`;
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(signedPayload)
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(sig),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    console.error('[Payment] Stripe webhook verification error:', error);
    return false;
  }
}
