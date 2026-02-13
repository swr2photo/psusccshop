'use client';

/**
 * ScreenCaptureGuard — Banking-grade screen capture protection
 * 
 * Mimics banking apps (SCB, KBank, Bangkok Bank) behavior:
 * - Detects screenshot attempts (blur/focus pattern, keyboard shortcuts)
 * - Detects screen recording / screen sharing
 * - Shows full-screen shield overlay with "ไม่สามารถบันทึกหน้าจอได้"
 * - Blacks out all content instantly when triggered
 */

import React, { useEffect, useCallback, useRef, useState } from 'react';

// ==================== TYPES ====================

type CaptureEventType =
  | 'screenshot'
  | 'screen-recording'
  | 'screen-sharing'
  | 'visibility-hidden'
  | 'window-blur'
  | 'devtools-open'
  | 'keyboard';

export interface CaptureEvent {
  type: CaptureEventType;
  timestamp: number;
  platform: string;
}

interface ScreenCaptureGuardProps {
  children: React.ReactNode;
  enabled?: boolean;
  shieldDuration?: number;
  onCaptureDetected?: (event: CaptureEvent) => void;
  message?: string;
  subMessage?: string;
}

// ==================== CSS ====================

const SHIELD_CSS = `
@keyframes scg-fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes scg-pulse {
  0%, 100% { transform: scale(1); opacity: 0.9; }
  50% { transform: scale(1.05); opacity: 1; }
}
@keyframes scg-textIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes scg-scan {
  0% { top: 20%; opacity: 0; }
  10% { opacity: 1; }
  50% { top: 80%; opacity: 1; }
  90% { opacity: 1; }
  100% { top: 20%; opacity: 0; }
}
@keyframes scg-recordDot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
body.scg-active {
  caret-color: transparent !important;
}
body.scg-active *:not(.scg-overlay):not(.scg-overlay *) {
  filter: brightness(0) !important;
  -webkit-filter: brightness(0) !important;
}
body.scg-active .scg-overlay,
body.scg-active .scg-overlay * {
  filter: none !important;
  -webkit-filter: none !important;
}
@media print {
  body { display: none !important; visibility: hidden !important; }
}
img, canvas, video {
  -webkit-touch-callout: none !important;
  -webkit-user-select: none !important;
  user-select: none !important;
}
`;

// ==================== MAIN COMPONENT ====================

export default function ScreenCaptureGuard({
  children,
  enabled = true,
  shieldDuration = 2000,
  onCaptureDetected,
  message,
  subMessage,
}: ScreenCaptureGuardProps) {
  const [showShield, setShowShield] = useState(false);
  const [captureType, setCaptureType] = useState<CaptureEventType | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [ready, setReady] = useState(false);
  const shieldTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blurTimeRef = useRef(0);
  const lastTriggerRef = useRef(0);

  // Detect platform
  const getPlatform = useCallback(() => {
    if (typeof window === 'undefined') return 'unknown';
    const ua = navigator.userAgent;
    if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
    if (/Android/i.test(ua)) return 'android';
    if (/Mac/i.test(navigator.platform || '')) return 'macos';
    if (/Win/i.test(navigator.platform || '')) return 'windows';
    return 'desktop';
  }, []);

  // ==================== INJECT CSS + MOUNT ====================

  useEffect(() => {
    if (!enabled) return;

    const id = 'scg-styles';
    if (!document.getElementById(id)) {
      const style = document.createElement('style');
      style.id = id;
      style.textContent = SHIELD_CSS;
      document.head.appendChild(style);
    }

    setReady(true);
    console.log('[SCG] ✅ ScreenCaptureGuard active — platform:', getPlatform());

    return () => {
      document.body.classList.remove('scg-active');
    };
  }, [enabled, getPlatform]);

  // ==================== TRIGGER SHIELD ====================

  const triggerShield = useCallback((type: CaptureEventType, duration?: number) => {
    const now = Date.now();
    if (now - lastTriggerRef.current < 300) return;
    lastTriggerRef.current = now;

    console.log(`[SCG] 🛡️ Shield triggered: ${type}`);

    setCaptureType(type);
    setShowShield(true);
    document.body.classList.add('scg-active');

    onCaptureDetected?.({
      type,
      timestamp: now,
      platform: getPlatform(),
    });

    if (shieldTimeoutRef.current) clearTimeout(shieldTimeoutRef.current);
    shieldTimeoutRef.current = setTimeout(() => {
      setShowShield(false);
      setCaptureType(null);
      document.body.classList.remove('scg-active');
    }, duration ?? shieldDuration);
  }, [shieldDuration, onCaptureDetected, getPlatform]);

  // ==================== WINDOW BLUR/FOCUS ====================
  // PRIMARY detection for Win+Shift+S, Alt+PrintScreen, etc.

  useEffect(() => {
    if (!enabled || !ready) return;

    const handleBlur = () => {
      blurTimeRef.current = Date.now();
      triggerShield('window-blur');
    };

    const handleFocus = () => {
      const gap = Date.now() - blurTimeRef.current;
      if (gap > 30 && gap < 10000) {
        triggerShield('screenshot', shieldDuration + 500);
      }
    };

    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    console.log('[SCG] 👁️ Blur/focus listeners active');

    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, [enabled, ready, triggerShield, shieldDuration]);

  // ==================== VISIBILITY CHANGE ====================

  useEffect(() => {
    if (!enabled || !ready) return;

    const handler = () => {
      if (document.hidden) {
        triggerShield('visibility-hidden');
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [enabled, ready, triggerShield]);

  // ==================== KEYBOARD SHORTCUTS ====================

  useEffect(() => {
    if (!enabled || !ready) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen' || e.code === 'PrintScreen') {
        e.preventDefault();
        triggerShield('keyboard');
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && ['3', '4', '5', 's', 'S'].includes(e.key)) {
        e.preventDefault();
        triggerShield('keyboard');
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && !e.shiftKey) {
        e.preventDefault();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [enabled, ready, triggerShield]);

  // ==================== DEVTOOLS DETECTION ====================

  useEffect(() => {
    if (!enabled || !ready) return;

    const check = () => {
      const wDiff = window.outerWidth - window.innerWidth;
      const hDiff = window.outerHeight - window.innerHeight;
      if (wDiff > 160 || hDiff > 160) {
        triggerShield('devtools-open', 5000);
      }
    };

    const interval = setInterval(check, 3000);
    return () => clearInterval(interval);
  }, [enabled, ready, triggerShield]);

  // ==================== FOCUS POLLING FALLBACK ====================

  useEffect(() => {
    if (!enabled || !ready) return;
    let hadFocus = document.hasFocus();

    const interval = setInterval(() => {
      const hasFocus = document.hasFocus();
      if (hadFocus && !hasFocus) {
        triggerShield('window-blur');
      }
      hadFocus = hasFocus;
    }, 300);

    return () => clearInterval(interval);
  }, [enabled, ready, triggerShield]);

  // ==================== CONTEXT MENU / DRAG / CLIPBOARD ====================

  useEffect(() => {
    if (!enabled || !ready) return;

    const handleContext = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'IMG' || t.tagName === 'CANVAS' || t.closest('.protected-content')) {
        e.preventDefault();
      }
    };
    const handleDrag = (e: DragEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'IMG' || t.tagName === 'CANVAS') e.preventDefault();
    };
    const handleCopy = (e: ClipboardEvent) => {
      const t = document.activeElement as HTMLElement;
      if (t?.closest?.('.protected-content') || t?.closest?.('.no-copy')) {
        e.preventDefault();
        e.clipboardData?.setData('text/plain', '[Protected Content]');
      }
    };

    document.addEventListener('contextmenu', handleContext);
    document.addEventListener('dragstart', handleDrag);
    document.addEventListener('copy', handleCopy);
    return () => {
      document.removeEventListener('contextmenu', handleContext);
      document.removeEventListener('dragstart', handleDrag);
      document.removeEventListener('copy', handleCopy);
    };
  }, [enabled, ready]);

  // ==================== CLEANUP ====================

  useEffect(() => {
    return () => {
      if (shieldTimeoutRef.current) clearTimeout(shieldTimeoutRef.current);
      document.body.classList.remove('scg-active');
    };
  }, []);

  // ==================== SHIELD MESSAGES ====================

  const isVideoCapture = isRecording || captureType === 'screen-recording' || captureType === 'screen-sharing';

  const shieldMessage = message || (
    isVideoCapture
      ? 'ไม่สามารถบันทึกวิดีโอหน้าจอได้'
      : 'ไม่สามารถบันทึกภาพหน้าจอได้'
  );

  const shieldSubMessage = subMessage || (
    isVideoCapture
      ? 'Screen recording is not allowed'
      : 'Screenshot is not allowed'
  );

  // ==================== RENDER ====================

  // Debug: visible indicator that component mounted (remove after confirming)
  if (typeof window !== 'undefined' && !document.getElementById('scg-debug-flag')) {
    const flag = document.createElement('div');
    flag.id = 'scg-debug-flag';
    flag.textContent = '🛡️ SCG';
    flag.style.cssText = 'position:fixed;bottom:4px;right:4px;z-index:999999;background:#000;color:#0f0;font-size:10px;padding:2px 6px;border-radius:4px;opacity:0.7;pointer-events:none;';
    document.body.appendChild(flag);
  }

  return (
    <>
      {children}

      {/* Shield Overlay */}
      {showShield && (
        <div
          className="scg-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2147483647,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.97)',
            backdropFilter: 'blur(40px)',
            WebkitBackdropFilter: 'blur(40px)',
            animation: 'scg-fadeIn 0.08s ease-out both',
            touchAction: 'none',
            userSelect: 'none',
          }}
        >
          {/* Icon */}
          <div style={{ animation: 'scg-pulse 2s ease-in-out infinite', marginBottom: 24, opacity: 0.9 }}>
            {isVideoCapture ? (
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M16.5 10L21 7V17L16.5 14" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <rect x="2" y="6" width="14.5" height="12" rx="2" stroke="white" strokeWidth="1.5" />
                <line x1="2" y1="2" x2="22" y2="22" stroke="#ff453a" strokeWidth="2" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L3 7V12C3 17.25 6.85 22.03 12 23C17.15 22.03 21 17.25 21 12V7L12 2Z" stroke="white" strokeWidth="1.5" strokeLinejoin="round" fill="rgba(255,255,255,0.08)" />
                <rect x="9" y="10" width="6" height="5" rx="1" stroke="white" strokeWidth="1.3" />
                <path d="M10 10V8.5C10 7.12 10.9 6 12 6C13.1 6 14 7.12 14 8.5V10" stroke="white" strokeWidth="1.3" strokeLinecap="round" />
                <circle cx="12" cy="12.5" r="0.8" fill="white" />
              </svg>
            )}
          </div>

          {/* Main Thai message */}
          <div style={{
            color: '#f5f5f7',
            fontSize: '1.25rem',
            fontWeight: 600,
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Noto Sans Thai", system-ui, sans-serif',
            textAlign: 'center',
            lineHeight: 1.5,
            marginBottom: 8,
            padding: '0 32px',
            animation: 'scg-textIn 0.3s ease-out 0.1s both',
          }}>
            {shieldMessage}
          </div>

          {/* English sub-message */}
          <div style={{
            color: 'rgba(255, 255, 255, 0.45)',
            fontSize: '0.875rem',
            fontWeight: 400,
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
            textAlign: 'center',
            marginBottom: 32,
            padding: '0 32px',
            animation: 'scg-textIn 0.3s ease-out 0.2s both',
          }}>
            {shieldSubMessage}
          </div>

          {/* Branding */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: 0.3, animation: 'scg-textIn 0.3s ease-out 0.3s both' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L3 7V12C3 17.25 6.85 22.03 12 23C17.15 22.03 21 17.25 21 12V7L12 2Z" fill="rgba(255,255,255,0.5)" />
            </svg>
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', fontWeight: 500, letterSpacing: '0.05em' }}>
              SCC SHOP SECURITY
            </span>
          </div>

          {/* Scanning line */}
          <div style={{
            position: 'absolute',
            left: 0,
            right: 0,
            height: 1,
            background: 'linear-gradient(90deg, transparent, rgba(41, 151, 255, 0.3), transparent)',
            animation: 'scg-scan 3s ease-in-out infinite',
          }} />
        </div>
      )}

      {/* Recording banner */}
      {isRecording && !showShield && (
        <div
          className="scg-overlay"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 2147483646,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: '10px 16px',
            background: 'rgba(255, 69, 58, 0.95)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff', animation: 'scg-recordDot 1s ease-in-out infinite' }} />
          <span style={{ color: '#fff', fontSize: '0.8125rem', fontWeight: 600, fontFamily: '-apple-system, "Noto Sans Thai", sans-serif' }}>
            ตรวจพบการบันทึกหน้าจอ — เนื้อหาถูกซ่อน
          </span>
        </div>
      )}
    </>
  );
}
