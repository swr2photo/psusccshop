// src/app/api/payment/create-charge/route.ts
// Create payment charge API (for card payments via Omise/Stripe)

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { orders, paymentTransactions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import { 
  PaymentMethod, 
  PaymentGateway,
  createOmiseCharge,
  createOmiseSource,
  createStripePaymentIntent,
} from '@/lib/payment';
import { isResourceOwner } from '@/lib/auth';
import { rateLimitOrNull } from '@/lib/api-helpers';
import { RATE_LIMITS } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface CreateChargeRequest {
  orderId: string;
  amount: number;
  gateway: PaymentGateway;
  method: PaymentMethod;
  // For card payments
  token?: string;
  // For TrueMoney
  phoneNumber?: string;
  // For installment
  installmentTerm?: number;
  // Return URL after 3DS
  returnUrl?: string;
}

export async function POST(request: NextRequest) {
  const rateLimited = rateLimitOrNull(request, RATE_LIMITS.payment);
  if (rateLimited) return rateLimited;

  try {
    // User must be logged in
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'กรุณาเข้าสู่ระบบ' },
        { status: 401 }
      );
    }

    const body: CreateChargeRequest = await request.json();
    const { orderId, amount, gateway, method, token, phoneNumber, installmentTerm, returnUrl } = body;

    // Validate input
    if (!orderId || !amount || !gateway) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Verify order exists and belongs to user
    const orderData = await db
      .select()
      .from(orders)
      .where(eq(orders.ref, orderId))
      .limit(1);
    const order = orderData[0];
 
    if (!order) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบรายการสั่งซื้อ' },
        { status: 404 }
      );
    }

    if (!isResourceOwner(order.customerEmail, session.user.email)) {
      return NextResponse.json(
        { success: false, error: 'ไม่มีสิทธิ์ชำระเงินสำหรับออเดอร์นี้' },
        { status: 403 }
      );
    }

    const expectedAmount = Number(order.totalAmount) || 0;
    if (expectedAmount < 1) {
      return NextResponse.json(
        { success: false, error: 'ยอดชำระไม่ถูกต้อง' },
        { status: 400 }
      );
    }
    if (Math.abs(Number(amount) - expectedAmount) > 0.01) {
      return NextResponse.json(
        { success: false, error: 'ยอดชำระไม่ตรงกับคำสั่งซื้อ' },
        { status: 400 }
      );
    }

    const chargeAmount = expectedAmount;

    // Create charge based on gateway
    let chargeResult: any;

    if (gateway === 'omise') {
      chargeResult = await createOmiseChargeForMethod(method, {
        amount: chargeAmount * 100, // Omise uses satang
        orderId,
        token,
        phoneNumber,
        installmentTerm,
        returnUrl: returnUrl || `${process.env.NEXTAUTH_URL}/payment/complete?ref=${orderId}`,
        email: session.user.email,
      });
    } else if (gateway === 'stripe') {
      chargeResult = await createStripeChargeForMethod(method, {
        amount: chargeAmount * 100, // Stripe uses smallest unit
        orderId,
        returnUrl: returnUrl || `${process.env.NEXTAUTH_URL}/payment/complete?ref=${orderId}`,
        email: session.user.email,
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'ไม่รองรับ Payment Gateway นี้' },
        { status: 400 }
      );
    }

    if (!chargeResult.success) {
      return NextResponse.json(
        { success: false, error: chargeResult.error || 'Failed to create charge' },
        { status: 400 }
      );
    }

    // Save transaction record
    const transactionId = crypto.randomUUID();
    
    await db.insert(paymentTransactions).values({
      id: transactionId,
      orderId: order.id,
      method,
      gateway,
      amount,
      currency: 'THB',
      status: 'pending',
      gatewayChargeId: chargeResult.chargeId,
      createdAt: new Date(),
      rawResponse: chargeResult.rawResponse,
    });

    return NextResponse.json({
      success: true,
      data: {
        transactionId,
        chargeId: chargeResult.chargeId,
        // For redirect-based payments (3DS, TrueMoney)
        authorizeUrl: chargeResult.authorizeUrl,
        // For Stripe Elements
        clientSecret: chargeResult.clientSecret,
      }
    });

  } catch (error) {
    console.error('[API] Create charge error:', error);
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการสร้างรายการชำระเงิน' },
      { status: 500 }
    );
  }
}

async function createOmiseChargeForMethod(
  method: PaymentMethod,
  params: {
    amount: number;
    orderId: string;
    token?: string;
    phoneNumber?: string;
    installmentTerm?: number;
    returnUrl: string;
    email: string;
  }
): Promise<{
  success: boolean;
  chargeId?: string;
  authorizeUrl?: string;
  error?: string;
  rawResponse?: any;
}> {
  try {
    if (method === 'credit_card') {
      if (!params.token) {
        return { success: false, error: 'Missing card token' };
      }

      const charge = await createOmiseCharge({
        amount: params.amount,
        card: params.token,
        description: `Order ${params.orderId}`,
        metadata: {
          orderId: params.orderId,
          email: params.email,
        },
        returnUri: params.returnUrl,
      });

      if (!charge) {
        return { success: false, error: 'Failed to create Omise charge' };
      }

      return {
        success: true,
        chargeId: charge.id,
        authorizeUrl: charge.authorizeUri,
        rawResponse: charge,
      };
    }

    if (method === 'true_money') {
      if (!params.phoneNumber) {
        return { success: false, error: 'Missing phone number for TrueMoney' };
      }

      const source = await createOmiseSource('truemoney', params.amount, {
        phoneNumber: params.phoneNumber,
      });

      if (!source) {
        return { success: false, error: 'Failed to create TrueMoney source' };
      }

      const charge = await createOmiseCharge({
        amount: params.amount,
        source: source.id,
        description: `Order ${params.orderId}`,
        metadata: {
          orderId: params.orderId,
          email: params.email,
        },
        returnUri: params.returnUrl,
      });

      if (!charge) {
        return { success: false, error: 'Failed to create Omise charge for TrueMoney' };
      }

      return {
        success: true,
        chargeId: charge.id,
        authorizeUrl: charge.authorizeUri,
        rawResponse: charge,
      };
    }

    if (method === 'installment') {
      if (!params.installmentTerm) {
        return { success: false, error: 'Missing installment term' };
      }

      // Default to KBank installment, can be extended
      const source = await createOmiseSource('installment_kbank', params.amount, {
        installmentTerm: params.installmentTerm,
      });

      if (!source) {
        return { success: false, error: 'Failed to create installment source' };
      }

      const charge = await createOmiseCharge({
        amount: params.amount,
        source: source.id,
        description: `Order ${params.orderId}`,
        metadata: {
          orderId: params.orderId,
          email: params.email,
        },
        returnUri: params.returnUrl,
      });

      if (!charge) {
        return { success: false, error: 'Failed to create Omise charge for installment' };
      }

      return {
        success: true,
        chargeId: charge.id,
        authorizeUrl: charge.authorizeUri,
        rawResponse: charge,
      };
    }

    return { success: false, error: 'Unsupported payment method for Omise' };
  } catch (error) {
    console.error('[Payment] Omise charge error:', error);
    return { success: false, error: String(error) };
  }
}

async function createStripeChargeForMethod(
  method: PaymentMethod,
  params: {
    amount: number;
    orderId: string;
    returnUrl: string;
    email: string;
  }
): Promise<{
  success: boolean;
  chargeId?: string;
  clientSecret?: string;
  error?: string;
  rawResponse?: any;
}> {
  try {
    if (method === 'credit_card') {
      const intent = await createStripePaymentIntent({
        amount: params.amount,
        description: `Order ${params.orderId}`,
        metadata: {
          orderId: params.orderId,
          email: params.email,
        },
        returnUrl: params.returnUrl,
      });

      if (!intent) {
        return { success: false, error: 'Failed to create Stripe PaymentIntent' };
      }

      return {
        success: true,
        chargeId: intent.id,
        clientSecret: intent.clientSecret,
      };
    }

    return { success: false, error: 'Unsupported payment method for Stripe' };
  } catch (error) {
    console.error('[Payment] Stripe charge error:', error);
    return { success: false, error: String(error) };
  }
}
