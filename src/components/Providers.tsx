// src/components/Providers.tsx
'use client';

import React, { Component, ErrorInfo, useMemo, useEffect, lazy, Suspense } from 'react';
import { SessionProvider } from "next-auth/react";
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { NotificationProvider } from './NotificationContext';
// Performance: lazy-load non-critical UI components
const ToastContainer = lazy(() => import('./ToastContainer'));
const CookieConsentBanner = lazy(() => import('./CookieConsentBanner'));
const NotificationPrompt = lazy(() => import('./NotificationPrompt'));
const LiveStreamPopup = lazy(() => import('./LiveStreamPopup'));
import ScreenCaptureGuard, { type CaptureEvent } from './ScreenCaptureGuard';
import { SWRProvider } from '@/hooks/useSWRConfig';
import { TanStackQueryProvider } from '@/hooks/useTanStackQuery';
import { useThemeStore } from '@/store/themeStore';
import { getTranslations } from '@/lib/i18n/translations';
import { useLanguageStore } from '@/store/languageStore';

// Error Boundary for catching client-side errors (especially on older browsers)
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Client error caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const lang = useLanguageStore.getState().language;
      const t = getTranslations(lang);
      const errorMessage = this.state.error?.message || 'Unknown error';
      const isDataError = errorMessage.includes('Cannot read properties of undefined') || 
                          errorMessage.includes('Cannot read properties of null') ||
                          errorMessage.includes('is not a function');
      
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--surface, #1d1d1f)',
          color: 'var(--foreground, #f5f5f7)',
          padding: 24,
          fontFamily: 'system-ui, -apple-system, sans-serif',
          textAlign: 'center',
        }}>
          <style dangerouslySetInnerHTML={{ __html: `
            @keyframes errFadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
            @keyframes errIconPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.08); } }
            .err-container { animation: errFadeIn 0.5s cubic-bezier(0.2, 0.6, 0.35, 1) both; }
            .err-icon { animation: errIconPulse 2s ease-in-out infinite; }
            .err-btn { transition: all 0.2s cubic-bezier(0.2, 0.6, 0.35, 1); }
            .err-btn:hover { transform: translateY(-1px); filter: brightness(1.1); }
            .err-btn:active { transform: translateY(0); filter: brightness(0.95); }
          ` }} />
          <div className="err-container" style={{ maxWidth: 400, width: '100%' }}>
          <div className="err-icon" style={{ 
            marginBottom: 16, 
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="url(#err-grad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <defs><linearGradient id="err-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#ff453a" /><stop offset="100%" stopColor="#ff6b6b" /></linearGradient></defs>
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/>
            </svg>
          </div>
          <h1 style={{ fontSize: 22, marginBottom: 8, fontWeight: 700, color: 'var(--foreground, #f5f5f7)' }}>
            {t.misc.errorOccurred}
          </h1>
          <p style={{ fontSize: 14, marginBottom: 24, maxWidth: 400, lineHeight: 1.6, color: 'var(--text-muted, #86868b)' }}>
            {isDataError
              ? t.misc.dataOutdated
              : t.misc.genericErrorDesc}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 280, margin: '0 auto' }}>
            <button
              className="err-btn"
              onClick={function() { window.location.reload(); }}
              style={{
                padding: '12px 32px',
                fontSize: 15,
                fontWeight: 600,
                backgroundColor: '#0071e3',
                color: 'white',
                border: 'none',
                borderRadius: 12,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>
              {t.misc.refreshPage}
            </button>
            {isDataError && (
              <button
                className="err-btn"
                onClick={function() {
                  try {
                    // Clear potentially corrupted cached data
                    const keysToRemove = [];
                    for (let i = 0; i < localStorage.length; i++) {
                      const key = localStorage.key(i);
                      if (key && (key.includes('cart') || key.includes('Cache') || key.includes('cache'))) {
                        keysToRemove.push(key);
                      }
                    }
                    keysToRemove.forEach(function(k) { localStorage.removeItem(k); });
                    window.location.reload();
                  } catch (e) {
                    window.location.reload();
                  }
                }}
                style={{
                  padding: '12px 32px',
                  fontSize: 15,
                  fontWeight: 600,
                  backgroundColor: 'rgba(255,69,58,0.15)',
                  color: '#ff453a',
                  border: '1px solid rgba(255,69,58,0.3)',
                  borderRadius: 12,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                {t.misc.clearAndRefresh}
              </button>
            )}
            <button
              className="err-btn"
              onClick={function() { window.location.href = '/'; }}
              style={{
                padding: '10px 32px',
                fontSize: 14,
                fontWeight: 500,
                backgroundColor: 'transparent',
                color: 'var(--text-muted, #86868b)',
                border: '1px solid rgba(134,134,139,0.3)',
                borderRadius: 12,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              {t.misc.goHome}
            </button>
          </div>
          {this.state.error && (
            <details style={{ marginTop: 24, fontSize: 12, color: '#86868b', maxWidth: 500, width: '100%' }}>
              <summary style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></svg>
                {t.misc.technicalDetails}</summary>
              <pre style={{ 
                textAlign: 'left', 
                whiteSpace: 'pre-wrap', 
                wordBreak: 'break-all',
                marginTop: 8,
                padding: 12,
                backgroundColor: 'rgba(0,0,0,0.3)',
                borderRadius: 8,
                fontSize: 11,
                lineHeight: 1.5,
              }}>
                {this.state.error.toString()}
                {'\n\nTime: ' + new Date().toISOString()}
                {'\nURL: ' + (typeof window !== 'undefined' ? window.location.href : '')}
              </pre>
            </details>
          )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Screen Capture Guard — banking-grade protection wrapper
// Throttle logging to avoid console spam
let lastCapturelog = 0;
const CAPTURE_LOG_INTERVAL = 10000; // 10 seconds

function ScreenCaptureGuardWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ScreenCaptureGuard
      enabled={true}
      shieldDuration={2000}
      onCaptureDetected={(event: CaptureEvent) => {
        const now = Date.now();
        if (now - lastCapturelog > CAPTURE_LOG_INTERVAL) {
          console.log(`[Security] Screen capture blocked: ${event.type} on ${event.platform}`);
          lastCapturelog = now;
        }
      }}
    >
      {children}
    </ScreenCaptureGuard>
  );
}

// ==================== SHARED THEME CONFIG — Apple-inspired ====================

const sharedTypography = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", "Noto Sans Thai", system-ui, sans-serif',
  button: {
    fontWeight: 600,
    letterSpacing: 0,
  },
};

const sharedShape = { borderRadius: 12 };

// ==================== DARK THEME — Apple-inspired ====================

const darkTheme = createTheme({
  cssVariables: true,
  palette: {
    mode: 'dark',
    primary: { main: '#2997ff', light: '#64d2ff', dark: '#0071e3' },
    secondary: { main: '#64d2ff', light: '#99e9f2', dark: '#2997ff' },
    success: { main: '#30d158' },
    error: { main: '#ff453a' },
    warning: { main: '#ffd60a' },
    background: { default: '#000000', paper: '#1d1d1f' },
    text: {
      primary: '#f5f5f7',
      secondary: '#86868b',
      disabled: 'rgba(245,245,247,0.3)',
    },
  },
  typography: sharedTypography,
  shape: sharedShape,
  components: {
    MuiCssBaseline: {
      styleOverrides: { body: { backgroundColor: 'transparent' } },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          border: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 12,
          boxShadow: 'none',
          '&:hover': { boxShadow: 'none' },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          borderRadius: 16,
          border: '1px solid rgba(255,255,255,0.06)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 18,
          backgroundColor: 'rgba(29,29,31,0.92)',
          border: '1px solid rgba(255,255,255,0.06)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 600,
          backgroundColor: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.06)',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: { background: 'rgba(255,255,255,0.04)', borderRadius: 12 },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          fieldset: { borderColor: 'rgba(255,255,255,0.12)' },
          '&:hover fieldset': { borderColor: 'rgba(41,151,255,0.5)' },
        },
      },
    },
  },
});

// ==================== LIGHT THEME — Apple-inspired ====================

const lightTheme = createTheme({
  cssVariables: true,
  palette: {
    mode: 'light',
    primary: { main: '#0071e3', light: '#2997ff', dark: '#0058b0' },
    secondary: { main: '#0077ed', light: '#2997ff', dark: '#005bb5' },
    success: { main: '#34c759' },
    error: { main: '#ff3b30' },
    warning: { main: '#ff9f0a' },
    background: { default: '#ffffff', paper: '#f5f5f7' },
    text: {
      primary: '#1d1d1f',
      secondary: '#86868b',
      disabled: 'rgba(29,29,31,0.3)',
    },
  },
  typography: sharedTypography,
  shape: sharedShape,
  components: {
    MuiCssBaseline: {
      styleOverrides: { body: { backgroundColor: 'transparent' } },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          border: '1px solid rgba(0,0,0,0.04)',
          boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 12,
          boxShadow: 'none',
          '&:hover': { boxShadow: 'none' },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          borderRadius: 16,
          border: '1px solid rgba(0,0,0,0.04)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 18,
          backgroundColor: '#ffffff',
          border: '1px solid rgba(0,0,0,0.06)',
          boxShadow: '0 8px 40px rgba(0,0,0,0.12)',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 600,
          backgroundColor: 'rgba(0,0,0,0.03)',
          border: '1px solid rgba(0,0,0,0.04)',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: { background: 'rgba(0,0,0,0.02)', borderRadius: 12 },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          fieldset: { borderColor: 'rgba(0,0,0,0.08)' },
          '&:hover fieldset': { borderColor: 'rgba(0,113,227,0.4)' },
        },
      },
    },
  },
});

export default function Providers({ children }: { children: React.ReactNode }) {
  const resolvedMode = useThemeStore((s) => s.resolvedMode);
  const activeTheme = useMemo(() => resolvedMode === 'light' ? lightTheme : darkTheme, [resolvedMode]);

  // Sync data-theme attribute on mount and mode change
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolvedMode);
    document.documentElement.style.colorScheme = resolvedMode;
  }, [resolvedMode]);

  return (
    <ErrorBoundary>
      <SessionProvider>
        <TanStackQueryProvider>
          <SWRProvider>
            <ThemeProvider theme={activeTheme}>
              <CssBaseline />
              <NotificationProvider>
                <ScreenCaptureGuardWrapper>
                  {children}
                </ScreenCaptureGuardWrapper>
                <Suspense fallback={null}>
                  <ToastContainer />
                  <CookieConsentBanner />
                  <NotificationPrompt />
                  <LiveStreamPopup />
                </Suspense>
              </NotificationProvider>
            </ThemeProvider>
          </SWRProvider>
        </TanStackQueryProvider>
      </SessionProvider>
    </ErrorBoundary>
  );
}