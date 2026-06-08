'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Box, Button, Card, Container, Divider, Typography, Theme } from '@mui/material';
import { AlertTriangle, Copy } from 'lucide-react';
import { signIn } from 'next-auth/react';
import { useTranslation } from '@/hooks/useTranslation';
import { useNotification } from '@/components/NotificationContext';
import LanguageToggle from '@/components/LanguageToggle';
import ThemeToggle from '@/components/ThemeToggle';

const PasskeyLoginButton = dynamic(() => import('@/components/PasskeyLoginButton'), { ssr: false });

export default function LoginScreen() {
  const { t, lang } = useTranslation();
  const { info: toastInfo } = useNotification();
  const [availableProviders, setAvailableProviders] = useState<string[]>(['google']);

  // Fetch available OAuth providers
  useEffect(() => {
    fetch('/api/auth/available-providers')
      .then(res => res.json())
      .then(data => {
        if (data.providers) setAvailableProviders(data.providers);
      })
      .catch(() => {});
  }, []);

  // Detect if running in WebView (LINE, Facebook, Instagram, etc.)
  const isWebView = typeof window !== 'undefined' && (
    /FBAN|FBAV|Instagram|Line\/|KAKAOTALK|Snapchat|Twitter/i.test(navigator.userAgent) ||
    /WebView|wv/i.test(navigator.userAgent) ||
    (window as unknown as { ReactNativeWebView?: unknown }).ReactNativeWebView !== undefined
  );

  // Get current URL for copy
  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';

  return (
    <Box sx={{ position: 'relative', display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'var(--background)' }}>
      {/* Floating Language & Theme Toggles (No Navbar) */}
      <Box sx={{ position: 'absolute', top: 20, right: 20, display: 'flex', gap: 1.5, zIndex: 10 }}>
        <LanguageToggle size="small" />
        <ThemeToggle size="small" />
      </Box>

      <Box sx={{ flex: 1, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, minHeight: '100vh' }}>
        {/* Left Side: Storefront Image Showcase */}
        <Box
          sx={{
            display: { xs: 'none', md: 'flex' },
            flex: 1.1,
            position: 'relative',
            backgroundImage: 'url("/shop_login_bg.png")',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            flexDirection: 'column',
            justifyContent: 'space-between',
            p: 6,
            color: '#ffffff',
            overflow: 'hidden',
            '&::before': {
              content: '""',
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(135deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.85) 100%)',
              zIndex: 1,
            },
          }}
        >
          <Box sx={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 44,
                height: 44,
                position: 'relative',
                borderRadius: '12px',
                overflow: 'hidden',
                background: 'rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                p: 0.5,
              }}
            >
              <Image
                src="/logo.png"
                alt="PSU SCC Shop Logo"
                fill
                sizes="44px"
                style={{ objectFit: 'contain' }}
                priority
              />
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
              SCC SHOP
            </Typography>
          </Box>

          <Box sx={{ position: 'relative', zIndex: 2, my: 'auto', maxWidth: 480 }}>
            <Typography 
              variant="h3" 
              sx={{ 
                fontWeight: 800, 
                lineHeight: 1.25, 
                mb: 2,
                background: 'linear-gradient(135deg, #ffffff 0%, #a5d8ff 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              {t.nav.shopTitle}
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.8)', fontSize: '1.05rem', lineHeight: 1.6 }}>
              {t.nav.appDescription}
            </Typography>
          </Box>

          <Typography sx={{ position: 'relative', zIndex: 2, color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem' }}>
            © {new Date().getFullYear()} Science Computer Club, Faculty of Science, PSU
          </Typography>
        </Box>

        {/* Right Side: Login Form */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: { xs: 'calc(100vh - 64px)', md: 'unset' },
            bgcolor: 'var(--background)',
            py: 4,
          }}
        >
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: { xs: 2, sm: 4 } }}>
            <Container maxWidth="sm" sx={{ px: 0 }}>
              {/* WebView Warning Banner */}
              {isWebView && (
                <Box
                  sx={{
                    mb: 3,
                    p: 2.5,
                    borderRadius: '16px',
                    background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(239, 68, 68, 0.1) 100%)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                    <Box sx={{
                      width: 40,
                      height: 40,
                      borderRadius: '12px',
                      bgcolor: 'rgba(245, 158, 11, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <AlertTriangle size={22} color="#ff9f0a" />
                    </Box>
                    <Box>
                      <Typography sx={{ color: 'var(--warning)', fontWeight: 700, fontSize: '0.95rem', mb: 0.5 }}>
                        {t.nav.openInBrowser}
                      </Typography>
                      <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.8rem', lineHeight: 1.6 }}>
                        {t.nav.openInBrowserDesc}
                      </Typography>
                      <Button
                        size="small"
                        onClick={() => {
                          navigator.clipboard?.writeText(currentUrl);
                          toastInfo(t.nav.linkCopied);
                        }}
                        sx={{
                          mt: 1.5,
                          color: 'var(--warning)',
                          fontSize: '0.75rem',
                          textTransform: 'none',
                          '&:hover': { bgcolor: 'rgba(245, 158, 11, 0.1)' },
                        }}
                        startIcon={<Copy size={14} />}
                      >
                        {t.nav.copyLink}
                      </Button>
                    </Box>
                  </Box>
                </Box>
              )}
              
              <Card 
                className="glass-card-premium aurora-bg"
                sx={{ 
                  bgcolor: 'var(--surface)', 
                  p: { xs: 3, sm: 5 }, 
                  textAlign: 'center',
                }}
              >
                {/* On Mobile: Logo, Shop Title, and Description */}
                <Box sx={{ display: { xs: 'block', md: 'none' } }}>
                  <Box
                    sx={{
                      width: 80,
                      height: 80,
                      position: 'relative',
                      borderRadius: '20px',
                      overflow: 'hidden',
                      margin: '0 auto 20px',
                      boxShadow: '0 10px 30px rgba(0,113,227, 0.3)',
                      border: '2px solid rgba(0,113,227, 0.3)',
                    }}
                  >
                    <Image
                      src="/logo.png"
                      alt="PSU SCC Shop Logo"
                      fill
                      sizes="64px"
                      className="theme-logo"
                      style={{ objectFit: 'contain' }}
                      priority
                    />
                  </Box>
                  
                  <Typography 
                    variant="h4" 
                    sx={{ 
                      fontWeight: 800, 
                      mb: 1.5, 
                      color: 'var(--foreground)',
                      background: (theme: Theme) => theme.palette.mode === 'dark' 
                        ? 'linear-gradient(135deg, #f5f5f7 0%, #64d2ff 50%, #0071e3 100%)'
                        : 'linear-gradient(135deg, #0071e3 0%, #0071e3 50%, #0071e3 100%)',
                      backgroundClip: 'text',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      fontSize: { xs: '1.4rem', sm: '1.75rem' },
                      lineHeight: 1.3,
                    }}
                  >
                    {t.nav.shopTitle}
                  </Typography>

                  <Typography sx={{ color: 'var(--text-muted)', mb: 3, fontSize: '0.85rem', lineHeight: 1.7, textAlign: 'center', maxWidth: 400, mx: 'auto' }}>
                    {t.nav.appDescription}
                  </Typography>
                  
                  <Divider sx={{ borderColor: 'var(--glass-border)', mb: 3 }} />
                </Box>

                {/* On Desktop: A very clean, premium sign-in title */}
                <Box sx={{ display: { xs: 'none', md: 'block' }, mb: 4 }}>
                  <Typography 
                    variant="h4" 
                    sx={{ 
                      fontWeight: 800, 
                      mb: 1.5, 
                      color: 'var(--foreground)',
                      fontSize: '1.75rem',
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {t.nav.loginToShop}
                  </Typography>
                  <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: 420, mx: 'auto', lineHeight: 1.6 }}>
                    {lang === 'en' ? 'Welcome back! Please choose a sign-in method to start shopping.' : 'ยินดีต้อนรับกลับมา! กรุณาเลือกวิธีเข้าสู่ระบบเพื่อเริ่มต้นการสั่งซื้อ'}
                  </Typography>
                </Box>

                {/* Show mobile-specific header prompt */}
                <Typography sx={{ display: { xs: 'block', md: 'none' }, color: 'var(--text-muted)', mb: 3, fontSize: '0.9rem' }}>
                  {t.nav.loginToShop}
                </Typography>
                
                {/* Google Sign In */}
                <Button
                  variant="contained"
                  size="large"
                  onClick={() => signIn('google', { redirect: true, callbackUrl: '/', prompt: 'select_account' })}
                  sx={{
                    background: '#ffffff',
                    color: '#1d1d1f',
                    width: '100%',
                    py: 1.5,
                    borderRadius: '14px',
                    fontWeight: 600,
                    fontSize: '1rem',
                    textTransform: 'none',
                    boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 1.5,
                    '&:hover': {
                      background: '#f5f5f7',
                      transform: 'translateY(-2px)',
                      boxShadow: '0 8px 25px rgba(0,0,0,0.2)',
                    },
                    '&:active': {
                      transform: 'translateY(0)',
                    },
                  }}
                >
                  {/* Google Logo SVG */}
                  <svg width="20" height="20" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  {`${t.nav.loginWith} Google`}
                </Button>

                {/* Microsoft Sign In */}
                {availableProviders.includes('azure-ad') && <Button
                  variant="contained"
                  size="large"
                  onClick={() => signIn('azure-ad', { redirect: true, callbackUrl: '/' })}
                  sx={{
                    background: '#2f2f2f',
                    color: '#ffffff',
                    width: '100%',
                    mt: 1.5,
                    py: 1.5,
                    borderRadius: '14px',
                    fontWeight: 600,
                    fontSize: '1rem',
                    textTransform: 'none',
                    boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 1.5,
                    '&:hover': {
                      background: '#404040',
                      transform: 'translateY(-2px)',
                      boxShadow: '0 8px 25px rgba(0,0,0,0.2)',
                    },
                    '&:active': { transform: 'translateY(0)' },
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 23 23">
                    <path fill="#f35325" d="M1 1h10v10H1z"/>
                    <path fill="#81bc06" d="M12 1h10v10H12z"/>
                    <path fill="#05a6f0" d="M1 12h10v10H1z"/>
                    <path fill="#ffba08" d="M12 12h10v10H12z"/>
                  </svg>
                  {`${t.nav.loginWith} Microsoft`}
                </Button>}

                {/* Facebook Sign In */}
                {availableProviders.includes('facebook') && <Button
                  variant="contained"
                  size="large"
                  onClick={() => signIn('facebook', { redirect: true, callbackUrl: '/' })}
                  sx={{
                    background: '#1877F2',
                    color: '#ffffff',
                    width: '100%',
                    mt: 1.5,
                    py: 1.5,
                    borderRadius: '14px',
                    fontWeight: 600,
                    fontSize: '1rem',
                    textTransform: 'none',
                    boxShadow: '0 4px 14px rgba(24,119,242,0.3)',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 1.5,
                    '&:hover': {
                      background: '#166FE5',
                      transform: 'translateY(-2px)',
                      boxShadow: '0 8px 25px rgba(24,119,242,0.4)',
                    },
                    '&:active': { transform: 'translateY(0)' },
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                  {`${t.nav.loginWith} Facebook`}
                </Button>}

                {/* Apple Sign In */}
                {availableProviders.includes('apple') && <Button
                  variant="contained"
                  size="large"
                  onClick={() => signIn('apple', { redirect: true, callbackUrl: '/' })}
                  sx={{
                    background: '#000000',
                    color: '#ffffff',
                    width: '100%',
                    mt: 1.5,
                    py: 1.5,
                    borderRadius: '14px',
                    fontWeight: 600,
                    fontSize: '1rem',
                    textTransform: 'none',
                    boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 1.5,
                    '&:hover': {
                      background: '#1a1a1a',
                      transform: 'translateY(-2px)',
                      boxShadow: '0 8px 25px rgba(0,0,0,0.35)',
                    },
                    '&:active': { transform: 'translateY(0)' },
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                    <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.52-3.23 0-1.44.62-2.2.44-3.06-.4C4.24 16.76 4.89 10.87 8.88 10.6c1.24.07 2.1.72 2.83.78.99-.2 1.94-.78 3-.84 1.28-.08 2.25.48 2.88 1.22-2.65 1.58-2.02 5.07.36 6.04-.47 1.2-.97 2.4-1.9 3.48zM12.07 10.5c-.16-2.3 1.74-4.2 3.93-4.5.32 2.5-2.25 4.64-3.93 4.5z"/>
                  </svg>
                  {`${t.nav.loginWith} Apple`}
                </Button>}

                {/* LINE Sign In */}
                {availableProviders.includes('line') && <Button
                  variant="contained"
                  size="large"
                  onClick={() => signIn('line', { redirect: true, callbackUrl: '/' })}
                  sx={{
                    background: '#06C755',
                    color: '#ffffff',
                    width: '100%',
                    mt: 1.5,
                    py: 1.5,
                    borderRadius: '14px',
                    fontWeight: 600,
                    fontSize: '1rem',
                    textTransform: 'none',
                    boxShadow: '0 4px 14px rgba(6,199,85,0.3)',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 1.5,
                    '&:hover': {
                      background: '#05B34C',
                      transform: 'translateY(-2px)',
                      boxShadow: '0 8px 25px rgba(6,199,85,0.4)',
                    },
                    '&:active': { transform: 'translateY(0)' },
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                    <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .348-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .349-.281.63-.63.63h-2.386c-.348 0-.63-.281-.63-.63V8.108c0-.348.282-.63.63-.63h2.386c.349 0 .63.282.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .349-.282.63-.631.63-.345 0-.627-.281-.627-.63V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.348.279-.63.63-.63.346 0 .627.282.627.63v4.771zm-5.741 0c0 .349-.282.63-.631.63-.345 0-.627-.281-.627-.63V8.108c0-.348.282-.63.627-.63.349 0 .631.282.631.63v4.771zm-2.466.63H4.917c-.348 0-.63-.281-.63-.63V8.108c0-.348.282-.63.63-.63.349 0 .63.282.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .349-.281.63-.629.63M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
                  </svg>
                  {`${t.nav.loginWith} LINE`}
                </Button>}
                
                {/* Passkey Sign In */}
                <Box sx={{ mt: 2 }}>
                  <Divider sx={{ borderColor: 'var(--glass-border)', mb: 2, '&::before, &::after': { borderColor: 'var(--glass-border)' } }}>
                    <Typography sx={{ color: 'var(--text-muted)', fontSize: '0.75rem', px: 1 }}>
                      {lang === 'en' ? 'or' : 'หรือ'}
                    </Typography>
                  </Divider>
                  <PasskeyLoginButton />
                </Box>

                <Typography sx={{ color: 'var(--text-muted)', mt: 4, fontSize: '0.75rem', lineHeight: 1.8 }}>
                  {t.nav.termsAgreement}{' '}
                  <Link href="/terms" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>
                    {lang === 'en' ? 'Terms of Service' : 'ข้อกำหนดการใช้งาน'}
                  </Link>
                  {' & '}
                  <Link href="/privacy" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>
                    {lang === 'en' ? 'Privacy Policy' : 'นโยบายความเป็นส่วนตัว'}
                  </Link>
                </Typography>
              </Card>
            </Container>
          </Box>

        </Box>
      </Box>
    </Box>
  );
}
