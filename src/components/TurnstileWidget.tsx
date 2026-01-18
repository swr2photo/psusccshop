'use client';

// src/components/TurnstileWidget.tsx
// Cloudflare Turnstile CAPTCHA alternative widget

import { useEffect, useRef, useCallback, useState } from 'react';
import { TURNSTILE_SITE_KEY } from '@/lib/cloudflare';

declare global {
  interface Window {
    turnstile?: {
      render: (container: string | HTMLElement, options: TurnstileOptions) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
      getResponse: (widgetId: string) => string | undefined;
    };
    onTurnstileLoad?: () => void;
  }
}

interface TurnstileOptions {
  sitekey: string;
  callback?: (token: string) => void;
  'expired-callback'?: () => void;
  'error-callback'?: (error: any) => void;
  theme?: 'light' | 'dark' | 'auto';
  size?: 'normal' | 'compact' | 'invisible';
  language?: string;
  action?: string;
  cData?: string;
  tabindex?: number;
  'response-field'?: boolean;
  'response-field-name'?: string;
  retry?: 'auto' | 'never';
  'retry-interval'?: number;
  'refresh-expired'?: 'auto' | 'manual' | 'never';
  appearance?: 'always' | 'execute' | 'interaction-only';
}

interface TurnstileWidgetProps {
  /** Callback when token is received */
  onSuccess: (token: string) => void;
  /** Callback when token expires */
  onExpire?: () => void;
  /** Callback on error */
  onError?: (error: any) => void;
  /** Theme: light, dark, or auto */
  theme?: 'light' | 'dark' | 'auto';
  /** Size: normal, compact, or invisible */
  size?: 'normal' | 'compact' | 'invisible';
  /** Action name for analytics */
  action?: string;
  /** Additional class names */
  className?: string;
}

// Track if script is loaded
let scriptLoaded = false;
let scriptLoading = false;
const loadCallbacks: (() => void)[] = [];

function loadTurnstileScript(): Promise<void> {
  return new Promise((resolve) => {
    if (scriptLoaded) {
      resolve();
      return;
    }

    loadCallbacks.push(resolve);

    if (scriptLoading) {
      return;
    }

    scriptLoading = true;

    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad';
    script.async = true;
    script.defer = true;

    window.onTurnstileLoad = () => {
      scriptLoaded = true;
      scriptLoading = false;
      loadCallbacks.forEach((cb) => cb());
      loadCallbacks.length = 0;
    };

    document.head.appendChild(script);
  });
}

export default function TurnstileWidget({
  onSuccess,
  onExpire,
  onError,
  theme = 'auto',
  size = 'normal',
  action,
  className,
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [devMode, setDevMode] = useState(false);
  const initializedRef = useRef(false);
  
  // Store callbacks in refs to avoid re-renders
  const onSuccessRef = useRef(onSuccess);
  const onExpireRef = useRef(onExpire);
  const onErrorRef = useRef(onError);
  
  // Update refs when callbacks change
  useEffect(() => {
    onSuccessRef.current = onSuccess;
    onExpireRef.current = onExpire;
    onErrorRef.current = onError;
  }, [onSuccess, onExpire, onError]);

  // Check if site key is configured
  const hasSiteKey = !!TURNSTILE_SITE_KEY;
  
  // Check if we're in development (GitHub Codespaces, localhost, etc.)
  // Production domain: sccshop.psusci.club - should use real Turnstile
  const isDevelopment = typeof window !== 'undefined' && (
    process.env.NODE_ENV === 'development' &&
    (
      window.location.hostname.includes('github.dev') ||
      window.location.hostname.includes('localhost') ||
      window.location.hostname.includes('127.0.0.1')
    )
  );

  useEffect(() => {
    // Prevent multiple initializations
    if (initializedRef.current) {
      return;
    }
    
    // Skip and auto-pass in development
    if (isDevelopment) {
      console.warn('[Turnstile] Development mode detected, auto-bypassing');
      setDevMode(true);
      onSuccessRef.current('dev-bypass');
      initializedRef.current = true;
      return;
    }

    // Skip if no site key configured
    if (!hasSiteKey) {
      console.warn('[Turnstile] Site key not configured, widget disabled');
      onSuccessRef.current('dev-bypass');
      initializedRef.current = true;
      return;
    }

    let mounted = true;

    const initWidget = async () => {
      await loadTurnstileScript();

      if (!mounted || !containerRef.current || !window.turnstile) {
        return;
      }

      // Remove existing widget if any
      if (widgetIdRef.current) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch (e) {
          // Ignore
        }
        widgetIdRef.current = null;
      }

      // Render new widget
      try {
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          callback: (token: string) => {
            onSuccessRef.current(token);
          },
          'expired-callback': () => {
            onExpireRef.current?.();
          },
          'error-callback': (error: any) => {
            console.error('[Turnstile] Error:', error);
            // If Turnstile fails, still allow the form to work
            console.warn('[Turnstile] Widget error, allowing form submission with fallback token');
            onSuccessRef.current('turnstile-error-bypass');
            onErrorRef.current?.(error);
          },
          theme,
          size,
          action,
          retry: 'auto',
          'retry-interval': 8000,
          'refresh-expired': 'auto',
        });

        setIsReady(true);
        initializedRef.current = true;
      } catch (e) {
        console.error('[Turnstile] Failed to render widget:', e);
        // Allow form submission on render failure
        onSuccessRef.current('turnstile-error-bypass');
        initializedRef.current = true;
      }
    };

    initWidget();

    return () => {
      mounted = false;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch (e) {
          // Ignore
        }
        widgetIdRef.current = null;
      }
    };
  }, [hasSiteKey, theme, size, action, isDevelopment]);

  // Show dev mode indicator
  if (devMode || isDevelopment) {
    return (
      <div className={className}>
        <div className="flex items-center gap-2 text-sm text-green-400 py-2 px-3 bg-green-500/10 border border-green-500/30 rounded-lg">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>🔧 Dev Mode - Bot protection bypassed</span>
        </div>
      </div>
    );
  }

  // Don't render anything if no site key
  if (!hasSiteKey) {
    return null;
  }

  return (
    <div className={className}>
      <div ref={containerRef} />
      {!isReady && (
        <div className="flex items-center gap-2 text-sm text-slate-400 py-2">
          <div className="animate-spin w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full" />
          <span>กำลังโหลดระบบป้องกัน...</span>
        </div>
      )}
    </div>
  );
}

/**
 * Hook to use Turnstile in forms
 */
export function useTurnstile() {
  const [token, setToken] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSuccess = useCallback((newToken: string) => {
    setToken(newToken);
    setIsVerified(true);
    setError(null);
  }, []);

  const handleExpire = useCallback(() => {
    setToken(null);
    setIsVerified(false);
  }, []);

  const handleError = useCallback((err: any) => {
    setError('การยืนยันล้มเหลว กรุณาลองใหม่');
    setIsVerified(false);
  }, []);

  const reset = useCallback(() => {
    setToken(null);
    setIsVerified(false);
    setError(null);
  }, []);

  return {
    token,
    isVerified,
    error,
    handleSuccess,
    handleExpire,
    handleError,
    reset,
    // Check if Turnstile is required (has site key)
    isRequired: !!TURNSTILE_SITE_KEY,
  };
}
