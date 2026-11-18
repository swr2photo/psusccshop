'use client';

import { apiFetch } from '@/lib/api-client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Box, Button, ButtonBase, CircularProgress, IconButton, Typography } from '@mui/material';
import { keyframes } from '@mui/material/styles';
import { AlertCircle, AlertTriangle, Copy, ExternalLink, Package, QrCode, Shirt, X } from 'lucide-react';
import { signIn } from 'next-auth/react';
import { useTranslation } from '@/hooks/useTranslation';
import { useNotification } from '@/components/NotificationContext';
import LanguageToggle from '@/components/LanguageToggle';
import ThemeToggle from '@/components/ThemeToggle';
import LoginHeroArt from '@/components/LoginHeroArt';

const PasskeyLoginButton = dynamic(() => import('@/components/PasskeyLoginButton'), { ssr: false });

const LAST_METHOD_KEY = 'scc:last-login-method';

type ProviderId = 'google' | 'azure-ad' | 'facebook' | 'apple' | 'line';

interface ProviderDef {
  id: ProviderId;
  name: string;
  icon: React.ReactNode;
}

const PROVIDERS: ProviderDef[] = [
  {
    id: 'google',
    name: 'Google',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
      </svg>
    ),
  },
  {
    id: 'azure-ad',
    name: 'Microsoft',
    icon: (
      <svg width="19" height="19" viewBox="0 0 23 23" aria-hidden="true">
        <path fill="#f35325" d="M1 1h10v10H1z" />
        <path fill="#81bc06" d="M12 1h10v10H12z" />
        <path fill="#05a6f0" d="M1 12h10v10H1z" />
        <path fill="#ffba08" d="M12 12h10v10H12z" />
      </svg>
    ),
  },
  {
    id: 'facebook',
    name: 'Facebook',
    icon: (
      <svg width="21" height="21" viewBox="0 0 24 24" fill="#1877F2" aria-hidden="true">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
  },
  {
    id: 'apple',
    name: 'Apple',
    icon: (
      <svg width="21" height="21" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.52-3.23 0-1.44.62-2.2.44-3.06-.4C4.24 16.76 4.89 10.87 8.88 10.6c1.24.07 2.1.72 2.83.78.99-.2 1.94-.78 3-.84 1.28-.08 2.25.48 2.88 1.22-2.65 1.58-2.02 5.07.36 6.04-.47 1.2-.97 2.4-1.9 3.48zM12.07 10.5c-.16-2.3 1.74-4.2 3.93-4.5.32 2.5-2.25 4.64-3.93 4.5z" />
      </svg>
    ),
  },
  {
    id: 'line',
    name: 'LINE',
    icon: (
      <svg width="21" height="21" viewBox="0 0 24 24" fill="#06C755" aria-hidden="true">
        <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .348-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .349-.281.63-.63.63h-2.386c-.348 0-.63-.281-.63-.63V8.108c0-.348.282-.63.63-.63h2.386c.349 0 .63.282.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .349-.282.63-.631.63-.345 0-.627-.281-.627-.63V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.348.279-.63.63-.63.346 0 .627.282.627.63v4.771zm-5.741 0c0 .349-.282.63-.631.63-.345 0-.627-.281-.627-.63V8.108c0-.348.282-.63.627-.63.349 0 .631.282.631.63v4.771zm-2.466.63H4.917c-.348 0-.63-.281-.63-.63V8.108c0-.348.282-.63.63-.63.349 0 .63.282.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .349-.281.63-.629.63M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
      </svg>
    ),
  },
];

const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const enter = (delayMs: number) => ({
  animation: `${fadeUp} 0.5s cubic-bezier(0.22, 1, 0.36, 1) both`,
  animationDelay: `${delayMs}ms`,
  '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
});

function readLastMethod(): string | null {
  try {
    return window.localStorage.getItem(LAST_METHOD_KEY);
  } catch {
    return null;
  }
}

function saveLastMethod(method: string) {
  try {
    window.localStorage.setItem(LAST_METHOD_KEY, method);
  } catch {
    /* storage unavailable — non-critical */
  }
}

type WebViewKind = 'line' | 'android' | 'ios' | null;

function detectWebView(): WebViewKind {
  if (typeof window === 'undefined') return null;
  const ua = navigator.userAgent;
  const inApp =
    /FBAN|FBAV|Instagram|Line\/|KAKAOTALK|Snapchat|Twitter/i.test(ua) ||
    /WebView|; wv\)/i.test(ua) ||
    (window as unknown as { ReactNativeWebView?: unknown }).ReactNativeWebView !== undefined;
  if (!inApp) return null;
  if (/Line\//i.test(ua)) return 'line';
  if (/Android/i.test(ua)) return 'android';
  return 'ios';
}

// ---------------------------------------------------------------------------

interface ProviderButtonProps {
  provider: ProviderDef;
  label: string;
  loading: boolean;
  disabled: boolean;
  highlighted: boolean;
  badge?: string;
  onClick: () => void;
}

function ProviderButton({ provider, label, loading, disabled, highlighted, badge, onClick }: ProviderButtonProps) {
  return (
    <ButtonBase
      onClick={onClick}
      disabled={disabled}
      aria-busy={loading || undefined}
      focusRipple
      sx={{
        position: 'relative',
        width: '100%',
        height: 52,
        px: 6,
        borderRadius: '14px',
        bgcolor: 'var(--surface)',
        color: 'var(--foreground)',
        border: '1px solid',
        borderColor: highlighted ? 'var(--primary)' : 'var(--border)',
        boxShadow: highlighted
          ? '0 0 0 3px color-mix(in srgb, var(--primary) 14%, transparent)'
          : '0 1px 2px rgba(0,0,0,0.04)',
        fontFamily: 'inherit',
        fontSize: '0.95rem',
        fontWeight: 600,
        transition: 'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease, background-color 0.18s ease',
        '&:hover': {
          borderColor: highlighted ? 'var(--primary)' : 'color-mix(in srgb, var(--foreground) 22%, transparent)',
          transform: 'translateY(-1px)',
          boxShadow: '0 6px 18px rgba(0,0,0,0.08)',
        },
        '&:active': { transform: 'translateY(0)' },
        '&.Mui-focusVisible': {
          outline: '2px solid var(--primary)',
          outlineOffset: 2,
        },
        '&.Mui-disabled': { opacity: loading ? 1 : 0.5 },
      }}
    >
      <Box
        component="span"
        sx={{
          position: 'absolute',
          left: 18,
          top: '50%',
          transform: 'translateY(-50%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 22,
          height: 22,
        }}
      >
        {loading ? <CircularProgress size={18} thickness={5} sx={{ color: 'var(--text-muted)' }} /> : provider.icon}
      </Box>
      <Box component="span" sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {label}
      </Box>
      {badge && (
        <Box
          component="span"
          sx={{
            position: 'absolute',
            top: -9,
            right: 14,
            px: 1,
            py: '1px',
            borderRadius: '999px',
            bgcolor: 'var(--primary)',
            color: 'var(--primary-foreground)',
            fontSize: '0.66rem',
            fontWeight: 700,
            lineHeight: 1.6,
            letterSpacing: '0.01em',
          }}
        >
          {badge}
        </Box>
      )}
    </ButtonBase>
  );
}

// ---------------------------------------------------------------------------

export default function LoginScreen() {
  const { t, lang } = useTranslation();
  const isEn = lang === 'en';
  const { info: toastInfo } = useNotification();
  const [availableProviders, setAvailableProviders] = useState<string[]>(['google']);
  const [pendingProvider, setPendingProvider] = useState<ProviderId | null>(null);
  // LoginScreen is loaded with ssr:false, so reading browser APIs at init is safe.
  const [lastMethod] = useState<string | null>(readLastMethod);
  const [error, setError] = useState<string | null>(null);
  const [webView] = useState<WebViewKind>(detectWebView);

  useEffect(() => {
    apiFetch('/api/auth/available-providers')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.providers)) setAvailableProviders(data.providers);
      })
      .catch(() => {});
  }, []);

  // If the user navigates back from the OAuth page (bfcache), clear the spinner.
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) setPendingProvider(null);
    };
    window.addEventListener('pageshow', onShow);
    return () => window.removeEventListener('pageshow', onShow);
  }, []);

  const providers = useMemo(() => {
    const list = PROVIDERS.filter((p) => p.id === 'google' || availableProviders.includes(p.id));
    // Bring the last-used provider to the top so returning users find it first.
    const idx = list.findIndex((p) => p.id === lastMethod);
    if (idx > 0) list.unshift(list.splice(idx, 1)[0]);
    return list;
  }, [availableProviders, lastMethod]);

  const handleProvider = useCallback((id: ProviderId) => {
    setError(null);
    setPendingProvider(id);
    saveLastMethod(id);
    // Return the user to where they were (e.g. a shared product link), not just "/".
    const callbackUrl = window.location.pathname + window.location.search + window.location.hash;
    const authParams = id === 'google' ? { prompt: 'select_account' } : undefined;
    signIn(id, { redirect: true, callbackUrl }, authParams).catch(() => {
      setPendingProvider(null);
      setError(isEn ? 'Could not start sign-in. Please try again.' : 'ไม่สามารถเริ่มการเข้าสู่ระบบได้ กรุณาลองใหม่อีกครั้ง');
    });
  }, [isEn]);

  const openInExternalBrowser = useCallback(() => {
    const url = new URL(window.location.href);
    if (webView === 'line') {
      url.searchParams.set('openExternalBrowser', '1');
      window.location.href = url.toString();
    } else if (webView === 'android') {
      window.location.href = `intent://${url.host}${url.pathname}${url.search}#Intent;scheme=https;end`;
    }
  }, [webView]);

  const copyCurrentLink = useCallback(() => {
    navigator.clipboard?.writeText(window.location.href).then(
      () => toastInfo(t.nav.linkCopied),
      () => {},
    );
  }, [t.nav.linkCopied, toastInfo]);

  const lastUsedBadge = isEn ? 'Last used' : 'ใช้ล่าสุด';
  const year = new Date().getFullYear();

  const features = [
    { icon: Shirt, label: isEn ? 'Club & faculty apparel' : 'เสื้อชุมนุม & เสื้อคณะ' },
    { icon: QrCode, label: isEn ? 'Pay with PromptPay' : 'ชำระผ่าน PromptPay' },
    { icon: Package, label: isEn ? 'Real-time order tracking' : 'ติดตามคำสั่งซื้อเรียลไทม์' },
  ];

  return (
    <Box
      component="main"
      sx={{
        position: 'relative',
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        minHeight: '100dvh',
        bgcolor: 'var(--background)',
      }}
    >
      {/* Language & theme toggles */}
      <Box sx={{ position: 'absolute', top: { xs: 14, md: 20 }, right: { xs: 14, md: 20 }, display: 'flex', gap: 1, zIndex: 10 }}>
        <LanguageToggle size="small" />
        <ThemeToggle size="small" />
      </Box>

      {/* ───────── Brand panel (hero on mobile, side panel on desktop) ───────── */}
      <Box
        sx={{
          position: 'relative',
          flex: { md: 1.1 },
          minHeight: { xs: 230, md: 'auto' },
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          p: { xs: 2.5, md: 6 },
          pb: { xs: 5.5, md: 6 },
          color: '#fff',
          overflow: 'hidden',
          bgcolor: '#030712',
        }}
      >
        <LoginHeroArt />
        {/* Gentle scrim so the headline stays readable over the artwork */}
        <Box
          aria-hidden="true"
          sx={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background: {
              xs: 'linear-gradient(180deg, rgba(3,7,18,0) 30%, rgba(3,7,18,0.55) 100%)',
              md: 'linear-gradient(90deg, rgba(3,7,18,0.55) 0%, rgba(3,7,18,0.15) 60%, rgba(3,7,18,0) 100%)',
            },
          }}
        />
        {/* Logo + brand */}
        {/* Same lockup as the storefront navbar (logo + "SCC" + blue "SHOP" tag),
            kept white because the hero background is always dark. */}
        <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 1.25, ...enter(0) }}>
          <Box
            sx={{
              width: { xs: 38, md: 42 },
              height: { xs: 38, md: 42 },
              position: 'relative',
              flexShrink: 0,
              filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.35))',
            }}
          >
            <Image src="/logo.png" alt="PSU SCC Shop" fill sizes="42px" style={{ objectFit: 'contain' }} priority />
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
            <Typography
              component="span"
              sx={{
                fontWeight: 800,
                fontSize: { xs: '1rem', md: '1.1rem' },
                letterSpacing: '0.08em',
                lineHeight: 1.1,
                color: '#fff',
                textShadow: '0 1px 8px rgba(0,0,0,0.35)',
              }}
            >
              SCC
            </Typography>
            <Box
              component="span"
              sx={{
                mt: 0.4,
                alignSelf: 'flex-start',
                px: 0.75,
                py: 0.2,
                borderRadius: '4px',
                bgcolor: 'var(--primary)',
                color: '#fff',
                fontWeight: 800,
                fontSize: { xs: '0.66rem', md: '0.72rem' },
                letterSpacing: '0.12em',
                lineHeight: 1.2,
              }}
            >
              SHOP
            </Box>
          </Box>
        </Box>

        {/* Headline */}
        <Box sx={{ position: 'relative', maxWidth: 500, mt: { xs: 3, md: 'auto' }, mb: { md: 'auto' }, ...enter(80) }}>
          <Typography
            component="h1"
            sx={{
              fontWeight: 800,
              lineHeight: 1.25,
              letterSpacing: '-0.02em',
              fontSize: { xs: '1.5rem', sm: '1.75rem', md: '2.6rem' },
              mb: { xs: 0, md: 2 },
              textShadow: '0 2px 20px rgba(0,0,0,0.35)',
            }}
          >
            {t.nav.shopTitle}
          </Typography>
          <Typography
            sx={{
              display: { xs: 'none', md: 'block' },
              color: 'rgba(255,255,255,0.82)',
              fontSize: '1.02rem',
              lineHeight: 1.7,
              mb: 3.5,
            }}
          >
            {t.nav.appDescription}
          </Typography>
          <Box component="ul" sx={{ display: { xs: 'none', md: 'flex' }, flexWrap: 'wrap', gap: 1, p: 0, m: 0, listStyle: 'none' }}>
            {features.map(({ icon: Icon, label }) => (
              <Box
                component="li"
                key={label}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  px: 1.5,
                  py: 0.75,
                  borderRadius: '999px',
                  bgcolor: 'rgba(255,255,255,0.12)',
                  border: '1px solid rgba(255,255,255,0.18)',
                  backdropFilter: 'blur(10px)',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                }}
              >
                <Icon size={15} aria-hidden="true" />
                {label}
              </Box>
            ))}
          </Box>
        </Box>

        <Typography sx={{ position: 'relative', display: { xs: 'none', md: 'block' }, color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem' }}>
          © {year} Science Computer Club, Faculty of Science, PSU
        </Typography>
      </Box>

      {/* ───────── Sign-in panel ───────── */}
      <Box
        sx={{
          position: 'relative',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'var(--background)',
          // On mobile the panel slides up over the hero like a sheet.
          mt: { xs: -3, md: 0 },
          borderRadius: { xs: '24px 24px 0 0', md: 0 },
          px: { xs: 2.5, sm: 4 },
          pt: { xs: 4, md: 6 },
          pb: { xs: 4, md: 6 },
          zIndex: 1,
        }}
      >
        <Box sx={{ width: '100%', maxWidth: 400 }}>
          {/* In-app browser warning */}
          {webView && (
            <Box
              role="status"
              sx={{
                mb: 3,
                p: 2,
                borderRadius: '16px',
                bgcolor: 'color-mix(in srgb, var(--warning) 12%, transparent)',
                border: '1px solid color-mix(in srgb, var(--warning) 35%, transparent)',
                ...enter(0),
              }}
            >
              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <AlertTriangle size={20} color="var(--warning)" style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ color: 'var(--foreground)', fontWeight: 700, fontSize: '0.9rem', mb: 0.5 }}>
                    {t.nav.openInBrowser}
                  </Typography>
                  <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.8rem', lineHeight: 1.6 }}>
                    {t.nav.openInBrowserDesc}
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1.5 }}>
                    {(webView === 'line' || webView === 'android') && (
                      <Button
                        size="small"
                        variant="contained"
                        disableElevation
                        onClick={openInExternalBrowser}
                        startIcon={<ExternalLink size={14} />}
                        sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 600, fontSize: '0.78rem' }}
                      >
                        {isEn ? 'Open in browser' : 'เปิดในเบราว์เซอร์'}
                      </Button>
                    )}
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={copyCurrentLink}
                      startIcon={<Copy size={14} />}
                      sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 600, fontSize: '0.78rem' }}
                    >
                      {t.nav.copyLink}
                    </Button>
                  </Box>
                </Box>
              </Box>
            </Box>
          )}

          {/* Heading */}
          <Box sx={{ mb: 3.5, textAlign: { xs: 'left', md: 'center' }, ...enter(60) }}>
            <Typography
              component="h2"
              sx={{ fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--foreground)', fontSize: { xs: '1.5rem', md: '1.85rem' }, mb: 1 }}
            >
              {lastMethod ? (isEn ? 'Welcome back' : 'ยินดีต้อนรับกลับมา') : (isEn ? 'Sign in' : 'เข้าสู่ระบบ')}
            </Typography>
            <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.92rem', lineHeight: 1.6 }}>
              {t.nav.loginToShop}
            </Typography>
          </Box>

          {/* Error */}
          {error && (
            <Box
              role="alert"
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1.25,
                mb: 2.5,
                p: 1.5,
                pr: 1,
                borderRadius: '12px',
                bgcolor: 'color-mix(in srgb, var(--error) 10%, transparent)',
                border: '1px solid color-mix(in srgb, var(--error) 30%, transparent)',
                color: 'var(--foreground)',
              }}
            >
              <AlertCircle size={18} color="var(--error)" style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
              <Typography sx={{ flex: 1, fontSize: '0.84rem', lineHeight: 1.55 }}>{error}</Typography>
              <IconButton size="small" onClick={() => setError(null)} aria-label={isEn ? 'Dismiss' : 'ปิด'} sx={{ mt: -0.5, color: 'var(--text-muted)' }}>
                <X size={16} />
              </IconButton>
            </Box>
          )}

          {/* Providers */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, ...enter(120) }}>
            {providers.map((p) => (
              <ProviderButton
                key={p.id}
                provider={p}
                label={`${t.nav.loginWith} ${p.name}`}
                loading={pendingProvider === p.id}
                disabled={pendingProvider !== null}
                highlighted={lastMethod === p.id}
                badge={lastMethod === p.id ? lastUsedBadge : undefined}
                onClick={() => handleProvider(p.id)}
              />
            ))}
          </Box>

          {/* Passkey */}
          <Box sx={{ ...enter(180) }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, my: 2.5 }}>
              <Box sx={{ flex: 1, height: '1px', bgcolor: 'var(--border)' }} />
              <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 500 }}>
                {isEn ? 'or' : 'หรือ'}
              </Typography>
              <Box sx={{ flex: 1, height: '1px', bgcolor: 'var(--border)' }} />
            </Box>
            <Box sx={{ position: 'relative' }}>
              <PasskeyLoginButton
                onError={(msg) => setError(msg)}
                onSuccess={() => saveLastMethod('passkey')}
                sx={{
                  height: 52,
                  borderRadius: '14px',
                  borderColor: lastMethod === 'passkey' ? 'var(--primary)' : undefined,
                }}
              />
              {lastMethod === 'passkey' && (
                <Box
                  component="span"
                  sx={{
                    position: 'absolute',
                    top: -9,
                    right: 14,
                    px: 1,
                    py: '1px',
                    borderRadius: '999px',
                    bgcolor: 'var(--primary)',
                    color: 'var(--primary-foreground)',
                    fontSize: '0.66rem',
                    fontWeight: 700,
                    lineHeight: 1.6,
                    pointerEvents: 'none',
                  }}
                >
                  {lastUsedBadge}
                </Box>
              )}
            </Box>
          </Box>

          {/* Terms */}
          <Typography sx={{ color: 'var(--text-muted)', mt: 4, fontSize: '0.75rem', lineHeight: 1.8, textAlign: 'center', ...enter(220) }}>
            {t.nav.termsAgreement}{' '}
            <Link href="/terms" style={{ color: 'var(--primary)', fontWeight: 600 }}>
              {isEn ? 'Terms of Service' : 'ข้อกำหนดการใช้งาน'}
            </Link>
            {isEn ? ' and ' : ' และ '}
            <Link href="/privacy" style={{ color: 'var(--primary)', fontWeight: 600 }}>
              {isEn ? 'Privacy Policy' : 'นโยบายความเป็นส่วนตัว'}
            </Link>
          </Typography>

          <Typography sx={{ display: { xs: 'block', md: 'none' }, color: 'var(--text-muted)', opacity: 0.7, mt: 3, fontSize: '0.7rem', textAlign: 'center' }}>
            © {year} Science Computer Club, Faculty of Science, PSU
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
