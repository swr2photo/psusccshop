/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { getStripe, preloadStripeJs, type StripeJS, type StripeCardElement } from '@/lib/stripe-client';
import { apiFetch } from '@/lib/api-client';
import {
  CreditCard,
  Lock,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
} from 'lucide-react';

interface StripeCardPaymentProps {
  orderRef: string;
  customerEmail?: string;
  customerName?: string;
  onSuccess?: () => void;
}

export default function StripeCardPayment({
  orderRef,
  customerEmail = '',
  customerName = '',
  onSuccess,
}: StripeCardPaymentProps) {
  const [loadingIntent, setLoadingIntent] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [paidSuccess, setPaidSuccess] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [publishableKey, setPublishableKey] = useState<string | null>(null);

  const [cardHolderName, setCardHolderName] = useState(customerName);
  const [emailInput, setEmailInput] = useState(customerEmail);

  const stripeRef = useRef<StripeJS | null>(null);
  const cardElementRef = useRef<StripeCardElement | null>(null);
  const cardContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    preloadStripeJs();
    fetchIntent();
  }, [orderRef]);

  const fetchIntent = async () => {
    try {
      setLoadingIntent(true);
      setErrorMsg(null);

      const res = await apiFetch('/api/payment/stripe/card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ref: orderRef }),
      });

      const data = await res.json();
      if (!res.ok || data.status !== 'success') {
        throw new Error(data.message || 'ไม่สามารถเริ่มรายการชำระเงินด้วยบัตรได้');
      }

      setClientSecret(data.clientSecret);
      setPublishableKey(data.publishableKey);

      // Initialize Stripe.js and Mount Card Element
      if (data.publishableKey && cardContainerRef.current) {
        const stripe = await getStripe(data.publishableKey);
        stripeRef.current = stripe;

        const elements = stripe.elements({ locale: 'th' });
        const cardElement = elements.create('card', {
          style: {
            base: {
              fontSize: '15px',
              color: '#0f172a',
              fontFamily: 'Inter, system-ui, sans-serif',
              '::placeholder': { color: '#94a3b8' },
            },
            invalid: { color: '#ef4444' },
          },
          hidePostalCode: true,
        });

        cardContainerRef.current.innerHTML = '';
        cardElement.mount(cardContainerRef.current);
        cardElementRef.current = cardElement;
      }
    } catch (err: any) {
      console.error('[StripeCardPayment] fetchIntent error:', err);
      setErrorMsg(err.message || 'เกิดข้อผิดพลาดในการโหลดระบบชำระเงิน');
    } finally {
      setLoadingIntent(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripeRef.current || !cardElementRef.current || !clientSecret) {
      setErrorMsg('ระบบชำระเงินยังไม่พร้อมใช้งาน กรุณารอสักครู่');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg(null);

      const { paymentIntent, error } = await stripeRef.current.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElementRef.current,
          billing_details: {
            name: cardHolderName || customerName || 'Customer',
            email: emailInput || customerEmail || '',
          },
        },
      });

      if (error) {
        throw new Error(error.message || 'การชำระเงินไม่สำเร็จ กรุณาตรวจสอบข้อมูลบัตร');
      }

      if (paymentIntent?.status === 'succeeded' || paymentIntent?.status === 'processing') {
        // Poll backend to confirm and update order status to PAID
        const checkRes = await apiFetch(`/api/payment/stripe/card?ref=${encodeURIComponent(orderRef)}`);
        const checkData = await checkRes.json();

        if (checkData.paid || checkData.orderStatus === 'PAID') {
          setPaidSuccess(true);
          setTimeout(() => {
            onSuccess?.();
          }, 1500);
        } else {
          setPaidSuccess(true);
          onSuccess?.();
        }
      }
    } catch (err: any) {
      console.error('[StripeCardPayment] handleSubmit error:', err);
      setErrorMsg(err.message || 'การชำระเงินล้มเหลว กรุณาลองใหม่อีกครั้ง');
    } finally {
      setSubmitting(false);
    }
  };

  if (paidSuccess) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600">
        <CheckCircle2 className="size-14 text-emerald-500 mb-3 animate-bounce" />
        <h3 className="text-xl font-bold text-emerald-700">ชำระเงินด้วยบัตรสำเร็จ!</h3>
        <p className="text-sm text-emerald-600/80 mt-1">ระบบกำลังบันทึกและปรับสถานะคำสั่งซื้อของท่าน...</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {/* Security Brand Banner */}
      <div className="flex items-center justify-between rounded-xl border border-blue-500/20 bg-blue-500/5 p-3.5 text-xs text-blue-600 dark:text-blue-400">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-5 shrink-0 text-blue-500" />
          <span>
            ชำระเงินปลอดภัยสูงสุดผ่าน <strong>Stripe 256-bit SSL (PCI-DSS Level 1)</strong>
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 opacity-80 text-[0.68rem]">
          <Lock className="size-3" />
          <span>3D Secure Supported</span>
        </div>
      </div>

      {errorMsg && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/10 p-3.5 text-xs text-red-500">
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">{errorMsg}</p>
          </div>
          <button
            type="button"
            onClick={fetchIntent}
            className="inline-flex items-center gap-1 text-[0.7rem] font-bold text-red-600 hover:underline"
          >
            <RefreshCw className="size-3" />
            ลองใหม่
          </button>
        </div>
      )}

      {loadingIntent ? (
        <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
          <Loader2 className="size-8 animate-spin text-indigo-500" />
          <span className="text-xs font-medium">กำลังเตรียมระบบชำระเงินด้วยบัตรเครดิต/เดบิต...</span>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Cardholder Name */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground">ชื่อบนบัตร (Cardholder Name)</label>
            <input
              type="text"
              required
              value={cardHolderName}
              onChange={(e) => setCardHolderName(e.target.value)}
              placeholder="e.g. SOMCHAI JAIDEE"
              className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Contact Email */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground">อีเมลสำหรับรับใบเสร็จ (Receipt Email)</label>
            <input
              type="email"
              required
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="your-email@example.com"
              className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Stripe Card Element Container */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground flex items-center justify-between">
              <span>ข้อมูลบัตรเครดิต / เดบิต (Credit/Debit Card)</span>
              <span className="text-[0.65rem] text-muted-foreground">Visa, Mastercard, JCB, UnionPay</span>
            </label>
            <div
              ref={cardContainerRef}
              className="w-full rounded-xl border border-input bg-background p-3.5 transition-all shadow-inner focus-within:ring-2 focus-within:ring-indigo-500"
              style={{ minHeight: '44px' }}
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting || !clientSecret}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-lg transition-all hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
          >
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span>กำลังดำเนินการชำระเงิน...</span>
              </>
            ) : (
              <>
                <CreditCard className="size-4" />
                <span>ยืนยันการชำระเงินด้วยบัตร</span>
              </>
            )}
          </button>
        </form>
      )}
    </div>
  );
}
