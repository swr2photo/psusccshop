'use client';

// Custom PromptPay payment via Stripe.js (https://docs.stripe.com/js)
//
// Flow:
// 1. POST /api/payment/stripe/promptpay -> PaymentIntent clientSecret
// 2. stripe.confirmPromptPayPayment(clientSecret, ..., { handleActions: false })
//    -> we render the QR code ourselves from next_action.promptpay_display_qr_code
// 3. Poll stripe.retrievePaymentIntent until status === 'succeeded'
//    (the order itself is marked PAID server-side by the Stripe webhook)

import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Typography, Button, CircularProgress } from '@mui/material';
import { QRCodeSVG } from 'qrcode.react';
import { CheckCircle2, RefreshCw, ShieldCheck, Clock3, AlertCircle } from 'lucide-react';
import { getStripe, preloadStripeJs, type StripeJS, type StripePromptPayQrCode } from '@/lib/stripe-client';
import { useTranslation } from '@/hooks/useTranslation';
import { CountdownBadge } from './OrderCountdown';

interface StripePromptPayProps {
  orderRef: string;
  orderDate?: string;
  onExpired?: () => void;
  onSuccess: () => void;
  size?: number;
}

type Phase = 'creating' | 'qr' | 'succeeded' | 'expired' | 'error';

const SERVER_POLL_MS = 2000;

// Dedupe concurrent intent creation (React StrictMode double-mounts in dev
// would otherwise create two PaymentIntents per modal open)
const inflightCreate = new Map<string, Promise<any>>();

async function createPromptPayIntent(orderRef: string): Promise<any> {
  const existing = inflightCreate.get(orderRef);
  if (existing) return existing;
  const promise = (async () => {
    try {
      const res = await fetch('/api/payment/stripe/promptpay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ref: orderRef }),
      });
      const json = await res.json();
      return { ok: res.ok, json };
    } finally {
      // Allow a fresh intent on explicit retry once this settles
      setTimeout(() => inflightCreate.delete(orderRef), 1000);
    }
  })();
  inflightCreate.set(orderRef, promise);
  return promise;
}

export default function StripePromptPay({
  orderRef,
  orderDate,
  onExpired,
  onSuccess,
  size = 232,
}: StripePromptPayProps) {
  const { t, lang } = useTranslation();
  const [phase, setPhase] = useState<Phase>('creating');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<StripePromptPayQrCode | null>(null);
  const [amount, setAmount] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  const stripeRef = useRef<StripeJS | null>(null);
  const publishableKeyRef = useRef<string | null>(null);
  const clientSecretRef = useRef<string | null>(null);
  const intentIdRef = useRef<string | null>(null);
  const successNotified = useRef(false);
  const mountedRef = useRef(true);
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Stable identity — a changing onSuccess prop must never recreate the intent
  const markSucceeded = useCallback(() => {
    if (successNotified.current) return;
    successNotified.current = true;
    setPhase('succeeded');
    onSuccessRef.current();
  }, []);

  // ---- 1+2) Create the PaymentIntent and confirm with handleActions: false ----
  const start = useCallback(async () => {
    setPhase('creating');
    setErrorMsg(null);
    setQrCode(null);
    successNotified.current = false;

    try {
      // Download Stripe.js in parallel with the intent creation
      preloadStripeJs();

      const { ok, json } = await createPromptPayIntent(orderRef);
      if (!ok || json.status !== 'success') {
        throw new Error(json.message || t.payment.stripeError);
      }

      const { clientSecret, publishableKey, amount: amt, email, qrCode: serverQr, intentStatus, paymentIntentId } = json.data;
      publishableKeyRef.current = publishableKey || null;
      clientSecretRef.current = clientSecret;
      intentIdRef.current = paymentIntentId || null;
      setAmount(Number(amt) || 0);

      // Preferred path: the server already confirmed the intent (Direct API)
      // and returned the QR code data — render it immediately.
      if (serverQr) {
        console.log('[StripePromptPay] Using server-confirmed QR, intent status:', intentStatus);
        if (!mountedRef.current) return;
        setQrCode(serverQr);
        setPhase('qr');
        if (publishableKey) {
          void getStripe(publishableKey, lang === 'th' ? 'th' : 'en').then((s) => {
            stripeRef.current = s;
          });
        }
        return;
      }

      if (intentStatus === 'succeeded') {
        markSucceeded();
        return;
      }

      // Fallback: confirm client-side via Stripe.js (handleActions: false so we
      // render the QR ourselves). Guarded with a timeout because confirm can
      // hang when a Stripe frame is blocked by extensions/CSP.
      const stripe = await getStripe(publishableKey, lang === 'th' ? 'th' : 'en');
      stripeRef.current = stripe;
      console.log('[StripePromptPay] No server QR — confirming via Stripe.js...');

      const confirmPromise = stripe.confirmPromptPayPayment(
        clientSecret,
        { payment_method: { billing_details: { email } } },
        { handleActions: false }
      );
      const result = await Promise.race([
        confirmPromise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Stripe confirm timeout (30s) — check CSP/network')), 30000)
        ),
      ]);
      const { paymentIntent, error } = result;
      console.log('[StripePromptPay] Confirm result:', paymentIntent?.status, error?.message || '');

      if (!mountedRef.current) return;
      if (error) throw new Error(error.message || t.payment.stripeError);

      if (paymentIntent?.status === 'succeeded') {
        markSucceeded();
        return;
      }

      const qr = paymentIntent?.next_action?.promptpay_display_qr_code;
      if (!qr) {
        console.error('[StripePromptPay] No QR in next_action:', paymentIntent?.next_action);
        throw new Error(t.payment.stripeError);
      }

      setQrCode(qr);
      setPhase('qr');
    } catch (err: any) {
      if (!mountedRef.current) return;
      console.error('[StripePromptPay]', err);
      setErrorMsg(err?.message || t.payment.stripeError);
      setPhase('error');
    }
  }, [orderRef, lang, markSucceeded, t.payment.stripeError]);

  useEffect(() => { start(); }, [start]);

  // ---- 3) Poll payment status while the QR is displayed ----
  // Server poll is authoritative (marks order PAID). Client Stripe.js runs in parallel
  // only to trigger an early server sync — never blocks the server poll loop.
  useEffect(() => {
    if (phase !== 'qr') return;
    let cancelled = false;

    const applyIntentStatus = (status: string | undefined) => {
      if (!mountedRef.current || cancelled || !status) return;
      if (status === 'succeeded') {
        markSucceeded();
      } else if (status === 'canceled') {
        setPhase('expired');
      }
    };

    const pollServer = async (): Promise<string | undefined> => {
      if (cancelled || successNotified.current) return;
      const intentId = intentIdRef.current;
      if (!intentId) return;

      const res = await fetch(
        `/api/payment/stripe/promptpay?ref=${encodeURIComponent(orderRef)}&intent=${encodeURIComponent(intentId)}`,
        { credentials: 'same-origin' }
      );
      const json = await res.json();
      if (json.status !== 'success') {
        throw new Error(json.message || 'poll failed');
      }
      const status = json.data?.intentStatus as string | undefined;
      applyIntentStatus(status);
      return status;
    };

    const pollClient = async () => {
      if (cancelled || successNotified.current) return;
      const clientSecret = clientSecretRef.current;
      const publishableKey = publishableKeyRef.current;
      if (!clientSecret || !publishableKey) return;

      try {
        const stripe =
          stripeRef.current ?? (await getStripe(publishableKey, lang === 'th' ? 'th' : 'en'));
        stripeRef.current = stripe;
        const { paymentIntent } = await stripe.retrievePaymentIntent(clientSecret);
        if (cancelled || successNotified.current) return;

        if (paymentIntent?.status === 'succeeded') {
          // Stripe confirmed — sync DB via server, then update UI
          try {
            await pollServer();
          } catch {
            // Server sync failed; server interval will retry
          }
        } else if (paymentIntent?.status === 'canceled') {
          setPhase('expired');
        }
      } catch {
        // Ad blockers / CSP — server poll handles verification
      }
    };

    void pollServer();
    void pollClient();

    const serverTimer = setInterval(() => void pollServer(), SERVER_POLL_MS);
    const clientTimer = setInterval(() => void pollClient(), SERVER_POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(serverTimer);
      clearInterval(clientTimer);
    };
  }, [phase, orderRef, markSucceeded, lang]);

  // ---- Countdown to QR expiry ----
  useEffect(() => {
    if (phase !== 'qr' || !qrCode?.expires_at) {
      setSecondsLeft(null);
      return;
    }
    const tick = () => {
      const left = Math.floor(qrCode.expires_at! - Date.now() / 1000);
      setSecondsLeft(left > 0 ? left : 0);
      if (left <= 0) setPhase('expired');
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [phase, qrCode]);

  const formatCountdown = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  // ==================== RENDER ====================

  if (phase === 'creating') {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 5 }}>
        <CircularProgress size={36} sx={{ color: '#64d2ff' }} />
        <Typography sx={{ fontSize: '0.85rem', color: 'var(--muted-foreground, #86868b)' }}>
          {t.payment.creatingQR}
        </Typography>
      </Box>
    );
  }

  if (phase === 'succeeded') {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5, py: 4 }}>
        <Box
          sx={{
            width: 72, height: 72, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            boxShadow: '0 8px 32px rgba(16,185,129,0.4)',
          }}
        >
          <CheckCircle2 size={40} color="#fff" />
        </Box>
        <Typography sx={{ fontWeight: 700, fontSize: '1.05rem', color: '#30d158' }}>
          {t.payment.paymentDetected}
        </Typography>
        <Typography sx={{ fontSize: '0.8rem', color: 'var(--muted-foreground, #86868b)' }}>
          {t.payment.paymentSuccessDesc}
        </Typography>
      </Box>
    );
  }

  if (phase === 'expired' || phase === 'error') {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5, py: 4 }}>
        <AlertCircle size={40} color={phase === 'expired' ? '#f59e0b' : '#ef4444'} />
        <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', textAlign: 'center' }}>
          {phase === 'expired' ? t.payment.qrExpired : (errorMsg || t.payment.stripeError)}
        </Typography>
        <Button
          onClick={start}
          startIcon={<RefreshCw size={16} />}
          sx={{
            mt: 0.5, px: 2.5, py: 1, borderRadius: 2.5, fontWeight: 700, textTransform: 'none',
            bgcolor: 'rgba(6,182,212,0.12)', color: '#64d2ff',
            border: '1px solid rgba(6,182,212,0.3)',
            '&:hover': { bgcolor: 'rgba(6,182,212,0.2)' },
          }}
        >
          {t.payment.createNewQR}
        </Button>
      </Box>
    );
  }

  // phase === 'qr'
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
      {/* QR card — custom UI built from the raw QR payload */}
      <Box
        sx={{
          p: 2, borderRadius: 3,
          background: 'linear-gradient(135deg, #1a237e 0%, #283593 50%, #3949ab 100%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          width: 'fit-content',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.25 }}>
          <Typography sx={{ color: '#fff', fontWeight: 700, letterSpacing: 0.5, fontSize: '0.95rem' }}>
            {t.payment.promptPay}
          </Typography>
          <Box
            component="span"
            sx={{
              bgcolor: '#fff', color: '#1a237e', px: 0.75, py: 0.2,
              borderRadius: 1, fontSize: '0.6rem', fontWeight: 700,
            }}
          >
            AUTO
          </Box>
        </Box>

        <Box sx={{ bgcolor: '#fff', p: 1.5, borderRadius: 2, lineHeight: 0, boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
          {qrCode?.data ? (
            <QRCodeSVG value={qrCode.data} size={size} level="M" bgColor="#ffffff" fgColor="#1a237e" />
          ) : qrCode?.image_url_png ? (
            // Fallback: Stripe-hosted QR image
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrCode.image_url_png} alt="PromptPay QR" width={size} height={size} />
          ) : null}
        </Box>

        <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
          {orderDate && (
            <CountdownBadge orderDate={orderDate} compact tone="inverse" onExpired={onExpired} />
          )}
          {secondsLeft !== null && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
              <Clock3 size={12} color="#ffffff" />
              <Typography sx={{ color: '#ffffff', fontSize: '0.72rem', fontWeight: 600, textShadow: '0 1px 2px rgba(0,0,0,0.35)' }}>
                {t.payment.expiresIn} {formatCountdown(secondsLeft)}
              </Typography>
            </Box>
          )}
        </Box>
      </Box>

      {/* Waiting indicator */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <CircularProgress size={14} sx={{ color: '#64d2ff' }} />
        <Typography sx={{ fontSize: '0.8rem', color: 'var(--muted-foreground, #86868b)' }}>
          {t.payment.waitingPayment}
        </Typography>
      </Box>

      <Typography sx={{ fontSize: '0.72rem', color: 'var(--muted-foreground, #86868b)', textAlign: 'center', maxWidth: 300 }}>
        {t.payment.scanInstruction} • {t.payment.autoVerifyHint}
      </Typography>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, opacity: 0.7 }}>
        <ShieldCheck size={13} color="#30d158" />
        <Typography sx={{ fontSize: '0.68rem', color: 'var(--muted-foreground, #86868b)' }}>
          {t.payment.securedByStripe}
        </Typography>
      </Box>
    </Box>
  );
}
