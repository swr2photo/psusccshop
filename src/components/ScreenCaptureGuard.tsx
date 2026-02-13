'use client';

/**
 * ScreenCaptureGuard — Banking-grade screen capture protection (Web layer)
 * 
 * KEY ARCHITECTURE: The shield overlay is ALWAYS in the DOM (hidden via CSS).
 * When triggered, we only add a CSS class — no React re-render needed.
 * This fixes iOS timing: body hides + overlay shows in the SAME paint frame.
 * 
 * PROTECTION TIERS (what's possible on web):
 * - These are "frontend tricks" — they cannot 100% prevent capture
 * - For 100% protection, use native iOS/Android apps (ScreenCaptureManager.swift)
 * - DRM (EME+CDN) only works for <video> via Widevine/FairPlay
 * 
 * DETECTION METHODS:
 * 1. Window blur/focus (Win+Shift+S, Alt+Tab, iOS app switcher)
 * 2. Page Visibility API (iOS Control Center, Android screenshot, tab switch)
 * 3. Keyboard shortcuts (PrintScreen, Cmd+Shift+3/4/5)
 * 4. DevTools detection (outerWidth/innerWidth gap)
 * 5. iOS pageshow/pagehide (better iOS lifecycle detection)
 * 6. Screen Capture API interception (navigator.mediaDevices.getDisplayMedia)
 * 7. Permissions API monitoring (display-capture permission)
 * 8. CSS-level: print block, touch-callout prevention, user-select block
 */

import React, { useEffect, useCallback, useRef } from 'react';

// ==================== TYPES ====================

type CaptureEventType =
  | 'screenshot'
  | 'screen-recording'
  | 'visibility-hidden'
  | 'window-blur'
  | 'devtools-open'
  | 'keyboard'
  | 'ios-pagehide'
  | 'screen-capture-api'
  | 'permission-change';

export interface CaptureEvent {
  type: CaptureEventType;
  timestamp: number;
  platform: string;
}

interface Props {
  children: React.ReactNode;
  enabled?: boolean;
  shieldDuration?: number;
  onCaptureDetected?: (event: CaptureEvent) => void;
}

// ==================== CSS ====================
// The overlay is always in the DOM but hidden.
// Adding .scg-active to body shows it AND hides content in ONE paint frame.

const SHIELD_CSS = `
.scg-shield {
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,0.97);
  -webkit-backdrop-filter: blur(40px);
  backdrop-filter: blur(40px);
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  /* Hidden by default — NO transition for instant Win+Shift+S response */
  opacity: 0;
  pointer-events: none;
  transition: none;
}
/* When active: show shield, hide content */
body.scg-active .scg-shield {
  opacity: 1;
  pointer-events: auto;
}
body.scg-active {
  caret-color: transparent !important;
}
body.scg-active > *:not(script):not(style):not(link) {
  visibility: hidden !important;
}
body.scg-active .scg-shield,
body.scg-active .scg-shield * {
  visibility: visible !important;
}
/* Print protection */
@media print {
  body { display: none !important; }
}
/* iOS-specific: prevent long-press save image, copy */
img, canvas, video {
  -webkit-touch-callout: none !important;
  -webkit-user-select: none !important;
  user-select: none !important;
  pointer-events: auto;
}
/* Protect images from drag-save */
img[src] { draggable: false; }
/* iOS selection prevention on protected content */
.protected-content, .no-copy {
  -webkit-user-select: none !important;
  user-select: none !important;
  -webkit-touch-callout: none !important;
}
/* Shield animations (only when visible) */
@keyframes scg-pulse {
  0%, 100% { transform: scale(1); opacity: 0.9; }
  50% { transform: scale(1.05); opacity: 1; }
}
@keyframes scg-scan {
  0% { top: 20%; opacity: 0; }
  10% { opacity: 1; }
  50% { top: 80%; opacity: 1; }
  90% { opacity: 1; }
  100% { top: 20%; opacity: 0; }
}
`;

// ==================== COMPONENT ====================

export default function ScreenCaptureGuard({
  children,
  enabled = true,
  shieldDuration = 2000,
  onCaptureDetected,
}: Props) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blurTimeRef = useRef(0);
  const lastTriggerRef = useRef(0);

  const getPlatform = useCallback(() => {
    if (typeof window === 'undefined') return 'unknown';
    const ua = navigator.userAgent;
    if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
    if (/Android/i.test(ua)) return 'android';
    if (/Mac/i.test(navigator.platform || '')) return 'macos';
    if (/Win/i.test(navigator.platform || '')) return 'windows';
    return 'desktop';
  }, []);

  const isMobile = useCallback(() => {
    const p = getPlatform();
    return p === 'ios' || p === 'android';
  }, [getPlatform]);

  // ==================== SHOW / HIDE SHIELD (pure DOM, no React state) ====================

  const showShield = useCallback((type: CaptureEventType, duration?: number) => {
    const now = Date.now();
    // 50ms debounce — just enough to prevent double-fire, fast enough for Win+Shift+S
    if (now - lastTriggerRef.current < 50) return;
    lastTriggerRef.current = now;

    // Instant show — CSS only, no React re-render
    document.body.classList.add('scg-active');
    // Force synchronous paint — browser must commit the style BEFORE the OS captures the screen
    void document.body.offsetHeight;

    onCaptureDetected?.({ type, timestamp: now, platform: getPlatform() });

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      document.body.classList.remove('scg-active');
    }, duration ?? shieldDuration);
  }, [shieldDuration, onCaptureDetected, getPlatform]);

  // ==================== INJECT CSS ====================

  useEffect(() => {
    if (!enabled) return;
    const id = 'scg-styles';
    if (!document.getElementById(id)) {
      const s = document.createElement('style');
      s.id = id;
      s.textContent = SHIELD_CSS;
      document.head.appendChild(s);
    }
    return () => { document.body.classList.remove('scg-active'); };
  }, [enabled]);

  // ==================== WINDOW BLUR / FOCUS ====================
  // Primary detection for Win+Shift+S, iOS screenshot, Android screenshot

  useEffect(() => {
    if (!enabled) return;

    const onBlur = () => {
      blurTimeRef.current = Date.now();
      showShield('window-blur');
    };

    const onFocus = () => {
      const gap = Date.now() - blurTimeRef.current;
      // Quick blur→focus = screenshot tool
      if (gap > 30 && gap < 10000) {
        showShield('screenshot', shieldDuration + 500);
      }
    };

    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
    };
  }, [enabled, showShield, shieldDuration]);

  // ==================== VISIBILITY CHANGE ====================
  // iOS: Control Center, app switch; Android: screenshot button

  useEffect(() => {
    if (!enabled) return;
    const handler = () => {
      if (document.hidden) showShield('visibility-hidden');
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [enabled, showShield]);

  // ==================== iOS PAGE LIFECYCLE ====================
  // iOS Safari fires pagehide/pageshow during app switching and 
  // Control Center pull-down which is when screenshots happen

  useEffect(() => {
    if (!enabled) return;
    const platform = getPlatform();
    if (platform !== 'ios' && platform !== 'android') return;

    const onPageHide = () => {
      showShield('ios-pagehide');
    };
    const onPageShow = (e: PageTransitionEvent) => {
      // persisted = page restored from bfcache (back/forward)
      if (e.persisted) showShield('ios-pagehide', shieldDuration + 1000);
    };

    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [enabled, getPlatform, showShield, shieldDuration]);

  // ==================== KEYBOARD (Win+Shift+S ultra-fast path) ====================
  // Windows 11: Win+Shift+S opens Snipping Tool. The OS intercepts the combo,
  // so the browser may not get 'S'. We catch it at TWO stages:
  //   1. keydown with metaKey+shiftKey → shield IMMEDIATELY (before S is pressed)
  //   2. Fallback: blur event when Snipping Tool steals focus

  useEffect(() => {
    if (!enabled) return;

    // Track modifier state for pre-activation
    let metaDown = false;
    let shiftDown = false;

    const handler = (e: KeyboardEvent) => {
      // PrintScreen — instant
      if (e.key === 'PrintScreen' || e.code === 'PrintScreen') {
        e.preventDefault();
        showShield('keyboard');
        return;
      }

      // === WIN+SHIFT+S PRE-ACTIVATION (Windows 11) ===
      // When Meta (Win key) + Shift are both held, activate shield BEFORE S is pressed.
      // The OS often swallows the 'S' keydown, so we can't wait for it.
      if (e.key === 'Meta' || e.key === 'OS') metaDown = true;
      if (e.key === 'Shift') shiftDown = true;

      // Meta+Shift combo detected — pre-activate on Windows
      if (metaDown && shiftDown && getPlatform() === 'windows') {
        showShield('keyboard');
        return;
      }

      // macOS: Cmd+Shift+3/4/5, Windows: Ctrl+Shift+S fallback
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && ['3','4','5','s','S'].includes(e.key)) {
        e.preventDefault();
        showShield('keyboard');
        return;
      }
      // Ctrl+S / Cmd+S — save page
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && !e.shiftKey) {
        e.preventDefault();
      }
      // Ctrl+P / Cmd+P — print
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
      }
    };

    const keyupHandler = (e: KeyboardEvent) => {
      if (e.key === 'Meta' || e.key === 'OS') metaDown = false;
      if (e.key === 'Shift') shiftDown = false;
    };

    // Capture phase (true) = we get the event BEFORE any other handler
    window.addEventListener('keydown', handler, true);
    window.addEventListener('keyup', keyupHandler, true);
    return () => {
      window.removeEventListener('keydown', handler, true);
      window.removeEventListener('keyup', keyupHandler, true);
    };
  }, [enabled, showShield, getPlatform]);

  // ==================== SCREEN CAPTURE API INTERCEPTION ====================
  // Block navigator.mediaDevices.getDisplayMedia (screen sharing/recording)

  useEffect(() => {
    if (!enabled) return;
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) return;

    const original = navigator.mediaDevices.getDisplayMedia;
    if (original) {
      navigator.mediaDevices.getDisplayMedia = function(...args) {
        showShield('screen-capture-api', 5000);
        // Still allow the call to proceed (blocking it throws errors in browsers)
        return original.apply(this, args);
      };
    }

    return () => {
      if (original) {
        navigator.mediaDevices.getDisplayMedia = original;
      }
    };
  }, [enabled, showShield]);

  // ==================== PERMISSIONS API — display-capture monitoring ====================

  useEffect(() => {
    if (!enabled) return;
    if (typeof navigator === 'undefined' || !navigator.permissions) return;

    let permStatus: PermissionStatus | null = null;

    // Some browsers support 'display-capture' permission query
    navigator.permissions.query({ name: 'display-capture' as PermissionName }).then(status => {
      permStatus = status;
      const onChange = () => {
        if (status.state === 'granted') {
          showShield('permission-change', 3000);
        }
      };
      status.addEventListener('change', onChange);
    }).catch(() => {
      // Not supported — silently ignore
    });

    return () => { permStatus = null; };
  }, [enabled, showShield]);

  // ==================== DEVTOOLS ====================

  useEffect(() => {
    if (!enabled) return;
    // Skip devtools detection on mobile — no devtools there
    if (isMobile()) return;

    const check = () => {
      const w = window.outerWidth - window.innerWidth;
      const h = window.outerHeight - window.innerHeight;
      if (w > 160 || h > 160) showShield('devtools-open', 5000);
    };
    const id = setInterval(check, 10000);
    return () => clearInterval(id);
  }, [enabled, showShield, isMobile]);

  // ==================== CONTEXT MENU / DRAG / COPY / IMAGE SAVE ====================

  useEffect(() => {
    if (!enabled) return;
    const ctx = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'IMG' || t.tagName === 'CANVAS' || t.closest('.protected-content')) e.preventDefault();
    };
    const drag = (e: DragEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'IMG' || t.tagName === 'CANVAS') e.preventDefault();
    };
    const copy = (e: ClipboardEvent) => {
      const t = document.activeElement as HTMLElement;
      if (t?.closest?.('.protected-content') || t?.closest?.('.no-copy')) {
        e.preventDefault();
        e.clipboardData?.setData('text/plain', '[Protected Content]');
      }
    };

    // Prevent iOS long-press "Save Image" on all images
    const touchStart = (e: TouchEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'IMG' || t.tagName === 'CANVAS') {
        // Use a short timeout to distinguish tap from long-press
        const timer = setTimeout(() => {
          e.preventDefault();
        }, 500);
        const cleanup = () => {
          clearTimeout(timer);
          t.removeEventListener('touchend', cleanup);
          t.removeEventListener('touchmove', cleanup);
        };
        t.addEventListener('touchend', cleanup, { once: true });
        t.addEventListener('touchmove', cleanup, { once: true });
      }
    };

    document.addEventListener('contextmenu', ctx);
    document.addEventListener('dragstart', drag);
    document.addEventListener('copy', copy);
    document.addEventListener('touchstart', touchStart, { passive: false });

    // Make all images non-draggable
    document.querySelectorAll('img').forEach(img => {
      img.setAttribute('draggable', 'false');
    });

    return () => {
      document.removeEventListener('contextmenu', ctx);
      document.removeEventListener('dragstart', drag);
      document.removeEventListener('copy', copy);
      document.removeEventListener('touchstart', touchStart);
    };
  }, [enabled]);

  // ==================== CLEANUP ====================

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    document.body.classList.remove('scg-active');
  }, []);

  // ==================== RENDER ====================
  // Shield is ALWAYS in DOM — shown/hidden purely by CSS class on body

  return (
    <>
      {children}

      {/* Always-present shield overlay — controlled by body.scg-active CSS */}
      <div className="scg-shield" aria-hidden="true">
        {/* Icon */}
        <div style={{ animation: 'scg-pulse 2s ease-in-out infinite', marginBottom: 24, opacity: 0.9 }}>
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L3 7V12C3 17.25 6.85 22.03 12 23C17.15 22.03 21 17.25 21 12V7L12 2Z" stroke="white" strokeWidth="1.5" strokeLinejoin="round" fill="rgba(255,255,255,0.08)" />
            <rect x="9" y="10" width="6" height="5" rx="1" stroke="white" strokeWidth="1.3" />
            <path d="M10 10V8.5C10 7.12 10.9 6 12 6C13.1 6 14 7.12 14 8.5V10" stroke="white" strokeWidth="1.3" strokeLinecap="round" />
            <circle cx="12" cy="12.5" r="0.8" fill="white" />
          </svg>
        </div>

        {/* Thai message — primary */}
        <div style={{
          color: '#f5f5f7',
          fontSize: '1.25rem',
          fontWeight: 600,
          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Noto Sans Thai", system-ui, sans-serif',
          textAlign: 'center',
          lineHeight: 1.5,
          marginBottom: 4,
          padding: '0 32px',
        }}>
          ไม่สามารถบันทึกวิดีโอและแคปเจอร์จอได้
        </div>

        {/* Thai sub-message */}
        <div style={{
          color: 'rgba(255, 255, 255, 0.55)',
          fontSize: '0.9rem',
          fontWeight: 400,
          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Noto Sans Thai", system-ui, sans-serif',
          textAlign: 'center',
          lineHeight: 1.4,
          marginBottom: 8,
          padding: '0 32px',
        }}>
          เพื่อความปลอดภัยของข้อมูลทางการเงิน
        </div>

        {/* English sub-message */}
        <div style={{
          color: 'rgba(255, 255, 255, 0.35)',
          fontSize: '0.8rem',
          fontWeight: 400,
          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
          textAlign: 'center',
          marginBottom: 32,
          padding: '0 32px',
        }}>
          Screen capture is not allowed for security reasons
        </div>

        {/* Branding */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: 0.3 }}>
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
    </>
  );
}
