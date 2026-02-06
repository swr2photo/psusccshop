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
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--surface, #0f172a)',
          color: 'var(--foreground, #f1f5f9)',
          padding: 24,
          fontFamily: 'system-ui, -apple-system, sans-serif',
          textAlign: 'center'
        }}>
          <h1 style={{ fontSize: 24, marginBottom: 16, color: 'var(--error, #ef4444)' }}>
            เกิดข้อผิดพลาด / Something went wrong
          </h1>
          <p style={{ fontSize: 16, marginBottom: 24, maxWidth: 400, lineHeight: 1.6, color: 'var(--text-muted, #94a3b8)' }}>
            กรุณาลองรีเฟรชหน้าเว็บ หรืออัปเดต browser เป็นเวอร์ชันใหม่
            <br /><br />
            Please try refreshing the page or update your browser to the latest version.
          </p>
          <button
            onClick={function() { window.location.reload(); }}
            style={{
              padding: '12px 32px',
              fontSize: 16,
              fontWeight: 600,
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              marginBottom: 16
            }}
          >
            รีเฟรช / Refresh
          </button>
          {this.state.error && (
            <details style={{ marginTop: 16, fontSize: 12, color: '#64748b', maxWidth: 500 }}>
              <summary style={{ cursor: 'pointer' }}>รายละเอียด Error</summary>
              <pre style={{ 
                textAlign: 'left', 
                whiteSpace: 'pre-wrap', 
                wordBreak: 'break-all',
                marginTop: 8,
                padding: 12,
                backgroundColor: 'rgba(0,0,0,0.3)',
                borderRadius: 8
              }}>
                {this.state.error.toString()}
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

// ==================== SHARED THEME CONFIG ====================

const sharedTypography = {
  fontFamily: '"Noto Sans Thai", "Inter", system-ui, -apple-system, sans-serif',
  button: {
    fontWeight: 700,
    letterSpacing: 0.2,
  },
};

const sharedShape = { borderRadius: 14 };

// ==================== DARK THEME ====================

const darkTheme = createTheme({
  cssVariables: true,
  palette: {
    mode: 'dark',
    primary: { main: '#3b82f6', light: '#60a5fa', dark: '#2563eb' },
    secondary: { main: '#60a5fa', light: '#93c5fd', dark: '#3b82f6' },
    success: { main: '#34d399' },
    error: { main: '#ef4444' },
    warning: { main: '#f59e0b' },
    background: { default: '#0c1529', paper: '#162036' },
    text: {
      primary: '#f8fafc',
      secondary: '#cbd5e1',
      disabled: 'rgba(241,245,249,0.5)',
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
          backdropFilter: 'blur(36px) saturate(180%)',
          WebkitBackdropFilter: 'blur(36px) saturate(180%)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 18px 60px rgba(0,0,0,0.35), 0 1px 0 rgba(255,255,255,0.05)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 700,
          borderRadius: 14,
          boxShadow: '0 10px 30px rgba(30,64,175,0.25)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          borderRadius: 18,
          border: '1px solid rgba(255,255,255,0.08)',
          backdropFilter: 'blur(28px) saturate(180%)',
          WebkitBackdropFilter: 'blur(28px) saturate(180%)',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 22,
          backgroundColor: 'rgba(10,15,30,0.75)',
          border: '1px solid rgba(255,255,255,0.08)',
          backdropFilter: 'blur(36px) saturate(180%)',
          WebkitBackdropFilter: 'blur(36px) saturate(180%)',
          boxShadow: '0 26px 80px rgba(0,0,0,0.45)',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 700,
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          backgroundColor: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.08)',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: { background: 'rgba(255,255,255,0.04)', borderRadius: 14 },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          fieldset: { borderColor: 'rgba(255,255,255,0.16)' },
          '&:hover fieldset': { borderColor: 'rgba(59,130,246,0.6)' },
        },
      },
    },
  },
});

// ==================== LIGHT THEME ====================

const lightTheme = createTheme({
  cssVariables: true,
  palette: {
    mode: 'light',
    primary: { main: '#1e40af', light: '#3b82f6', dark: '#1e3a8a' },
    secondary: { main: '#2563eb', light: '#60a5fa', dark: '#1d4ed8' },
    success: { main: '#059669' },
    error: { main: '#dc2626' },
    warning: { main: '#d97706' },
    background: { default: '#f8fafc', paper: '#ffffff' },
    text: {
      primary: '#0f172a',
      secondary: '#475569',
      disabled: 'rgba(15,23,42,0.4)',
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
          backdropFilter: 'blur(36px) saturate(180%)',
          WebkitBackdropFilter: 'blur(36px) saturate(180%)',
          border: '1px solid rgba(0,0,0,0.06)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.06), 0 1px 0 rgba(255,255,255,0.8)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 700,
          borderRadius: 14,
          boxShadow: '0 4px 16px rgba(37,99,235,0.15)',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          borderRadius: 18,
          border: '1px solid rgba(0,0,0,0.06)',
          backdropFilter: 'blur(28px) saturate(180%)',
          WebkitBackdropFilter: 'blur(28px) saturate(180%)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 22,
          backgroundColor: 'rgba(255,255,255,0.97)',
          border: '1px solid rgba(0,0,0,0.08)',
          backdropFilter: 'blur(36px) saturate(180%)',
          WebkitBackdropFilter: 'blur(36px) saturate(180%)',
          boxShadow: '0 26px 80px rgba(0,0,0,0.15)',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 700,
          backgroundColor: 'rgba(0,0,0,0.04)',
          border: '1px solid rgba(0,0,0,0.06)',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: { background: 'rgba(0,0,0,0.02)', borderRadius: 14 },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          fieldset: { borderColor: 'rgba(0,0,0,0.12)' },
          '&:hover fieldset': { borderColor: 'rgba(37,99,235,0.5)' },
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