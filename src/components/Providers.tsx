// src/components/Providers.tsx
'use client';

import React, { Component, ErrorInfo } from 'react';
import { SessionProvider } from "next-auth/react";
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { NotificationProvider } from './NotificationContext';
import ToastContainer from './ToastContainer';
import CookieConsentBanner from './CookieConsentBanner';
import { useScreenshotProtection } from '@/hooks';

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
          backgroundColor: '#0f172a',
          color: '#f1f5f9',
          padding: 24,
          fontFamily: 'system-ui, -apple-system, sans-serif',
          textAlign: 'center'
        }}>
          <h1 style={{ fontSize: 24, marginBottom: 16, color: '#ef4444' }}>
            เกิดข้อผิดพลาด / Something went wrong
          </h1>
          <p style={{ fontSize: 16, marginBottom: 24, maxWidth: 400, lineHeight: 1.6, color: '#94a3b8' }}>
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

// Liquid glass dark theme
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#5ac8fa',
      light: '#7cd5ff',
      dark: '#3aa3d8',
    },
    secondary: {
      main: '#7c8aff',
      light: '#9aa5ff',
      dark: '#5b67d6',
    },
    success: { main: '#34d399' },
    error: { main: '#ef4444' },
    warning: { main: '#f59e0b' },
    background: {
      default: 'transparent',
      paper: 'rgba(255,255,255,0.06)',
    },
    text: {
      primary: '#f8fafc',
      secondary: '#cbd5e1',
      disabled: 'rgba(241,245,249,0.5)',
    },
  },
  typography: {
    fontFamily: '"Noto Sans Thai", "Inter", system-ui, -apple-system, sans-serif',
    button: {
      fontWeight: 700,
      letterSpacing: 0.2,
    },
  },
  shape: {
    borderRadius: 14,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: 'transparent',
        },
      },
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
          boxShadow: '0 10px 30px rgba(90,200,250,0.25)',
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
        root: {
          background: 'rgba(255,255,255,0.04)',
          borderRadius: 14,
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          fieldset: {
            borderColor: 'rgba(255,255,255,0.16)',
          },
          '&:hover fieldset': {
            borderColor: 'rgba(90,200,250,0.6)',
          },
        },
      },
    },
  },
});

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <SessionProvider>
        <ThemeProvider theme={darkTheme}>
          <CssBaseline />
          <NotificationProvider>
            <ScreenshotProtectionProvider>
              {children}
            </ScreenshotProtectionProvider>
            <ToastContainer />
            <CookieConsentBanner />
          </NotificationProvider>
        </ThemeProvider>
      </SessionProvider>
    </ErrorBoundary>
  );
}