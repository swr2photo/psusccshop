// src/components/Providers.tsx
'use client';

import React, { Component, ErrorInfo, useMemo, useEffect } from 'react';
import { SessionProvider } from "next-auth/react";
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { NotificationProvider } from './NotificationContext';
import ToastContainer from './ToastContainer';
import CookieConsentBanner from './CookieConsentBanner';
import { useScreenshotProtection } from '@/hooks';
import { SWRProvider } from '@/hooks/useSWRConfig';
import { TanStackQueryProvider } from '@/hooks/useTanStackQuery';
import { useThemeStore } from '@/store/themeStore';

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
          textAlign: 'center'
        }}>
          <div style={{ 
            fontSize: 48, marginBottom: 16, 
            background: 'linear-gradient(135deg, #ff453a, #ff6b6b)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            ⚠️
          </div>
          <h1 style={{ fontSize: 22, marginBottom: 8, fontWeight: 700, color: 'var(--foreground, #f5f5f7)' }}>
            เกิดข้อผิดพลาด
          </h1>
          <p style={{ fontSize: 14, marginBottom: 24, maxWidth: 400, lineHeight: 1.6, color: 'var(--text-muted, #86868b)' }}>
            {isDataError
              ? 'ข้อมูลบางส่วนอาจล้าสมัย กรุณาล้างข้อมูลเก่าแล้วลองใหม่อีกครั้ง'
              : 'มีบางอย่างผิดพลาด กรุณารีเฟรชหน้าเว็บ หรืออัปเดต browser'}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 280 }}>
            <button
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
              }}
            >
              🔄 รีเฟรชหน้าเว็บ
            </button>
            {isDataError && (
              <button
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
                }}
              >
                🗑️ ล้างข้อมูลเก่าแล้วรีเฟรช
              </button>
            )}
            <button
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
              }}
            >
              🏠 กลับหน้าหลัก
            </button>
          </div>
          {this.state.error && (
            <details style={{ marginTop: 24, fontSize: 12, color: '#86868b', maxWidth: 500, width: '100%' }}>
              <summary style={{ cursor: 'pointer', userSelect: 'none' }}>📋 รายละเอียดทางเทคนิค</summary>
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
      );
    }

    return this.props.children;
  }
}

// Screenshot protection wrapper
// Throttle logging to avoid console spam
let lastScreenshotLog = 0;
const SCREENSHOT_LOG_INTERVAL = 10000; // 10 seconds

function ScreenshotProtectionProvider({ children }: { children: React.ReactNode }) {
  // Enable screenshot protection across the entire app
  useScreenshotProtection({
    recoveryTime: 300,
    onScreenshotDetected: () => {
      const now = Date.now();
      if (now - lastScreenshotLog > SCREENSHOT_LOG_INTERVAL) {
        console.log('[Security] Screenshot protection active');
        lastScreenshotLog = now;
      }
    },
  });

  return <>{children}</>;
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
                <ScreenshotProtectionProvider>
                  {children}
                </ScreenshotProtectionProvider>
                <ToastContainer />
                <CookieConsentBanner />
              </NotificationProvider>
            </ThemeProvider>
          </SWRProvider>
        </TanStackQueryProvider>
      </SessionProvider>
    </ErrorBoundary>
  );
}