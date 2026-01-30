// src/app/api/payment/create-charge/route.ts
// Create payment charge API (for card payments via Omise/Stripe)

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { 
  PaymentMethod, 
  PaymentGateway,
  createOmiseCharge,
  createOmiseSource,
  createStripePaymentIntent,
} from '@/lib/payment';

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
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('ref', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบรายการสั่งซื้อ' },
        { status: 404 }
      );
    }

    // Check order belongs to user (via email hash or direct email)
    // For simplicity, we allow any logged-in user to pay for now
    // In production, verify ownership properly

    // Create charge based on gateway
    let chargeResult: any;

    if (gateway === 'omise') {
      chargeResult = await createOmiseChargeForMethod(method, {
        amount: amount * 100, // Omise uses satang
        orderId,
        token,
        phoneNumber,
        installmentTerm,
        returnUrl: returnUrl || `${process.env.NEXTAUTH_URL}/payment/complete?ref=${orderId}`,
        email: session.user.email,
      });
    } else if (gateway === 'stripe') {
      chargeResult = await createStripeChargeForMethod(method, {
        amount: amount * 100, // Stripe uses smallest unit
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
    const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    await supabase
      .from('payment_transactions')
      .insert({
        id: transactionId,
        order_id: orderId,
        method,
        gateway,
        amount,
        currency: 'THB',
        status: 'pending',
        gateway_charge_id: chargeResult.chargeId,
        created_at: new Date().toISOString(),
        raw_response: chargeResult.rawResponse,
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
