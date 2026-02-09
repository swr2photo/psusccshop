// src/components/NotificationPrompt.tsx
// Global notification permission prompt — shows once per session for logged-in users
// Registers service worker for push notifications independently of the chat widget
// Supports iOS 16.4+ PWA, iOS 26+ (all home-screen sites are web apps), Android + Desktop
// Handles denied permission with guidance to re-enable via device settings

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Box, Typography, Button, IconButton, Slide } from '@mui/material';
import {
  Bell as BellIcon,
  X as CloseIcon,
  Smartphone as PhoneIcon,
  Settings as SettingsIcon,
} from 'lucide-react';

const DISMISS_KEY = 'scc-push-prompt-dismissed';
const DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days
const DENIED_DISMISS_DURATION = 3 * 24 * 60 * 60 * 1000; // 3 days for denied state (shorter to re-remind)
const NOTIFICATION_DESC = 'รับการแจ้งเตือนเมื่อมีข้อความใหม่หรือสถานะออเดอร์อัปเดต';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/** Detect iOS device — works on all iOS versions including iOS 26+ (frozen UA) */
function isIOSDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  // Check user agent first (covers most cases including iOS 26 frozen UA)
  // iOS 26 freezes the UA version string but still includes iPhone/iPad/iPod
  if (/iPad|iPhone|iPod/.test(navigator.userAgent)) return true;
  // iPadOS 13+ reports as Mac but has touch
  if (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1) return true;
  // Check User-Agent Client Hints (future-proof for when UA string changes entirely)
  if ('userAgentData' in navigator) {
    const uaData = (navigator as any).userAgentData;
    if (uaData?.platform === 'iOS' || uaData?.platform === 'iPadOS') return true;
  }
  // Fallback: deprecated platform check
  if (typeof navigator.platform === 'string' && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) return true;
  // iOS 26+: GestureEvent is a WebKit-only API that only ships on iOS/iPadOS Safari
  if (typeof window !== 'undefined' && 'GestureEvent' in window) return true;
  // Safari-only ontouchend combined with WebKit (excludes Android Chrome)
  if (typeof document !== 'undefined' && 'ontouchend' in document &&
      navigator.maxTouchPoints > 0 && /AppleWebKit/.test(navigator.userAgent) &&
      !/Android/i.test(navigator.userAgent)) return true;
  return false;
}

/** Detect Android device */
function isAndroidDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  if (/Android/i.test(navigator.userAgent)) return true;
  // User-Agent Client Hints fallback
  if ('userAgentData' in navigator) {
    const uaData = (navigator as any).userAgentData;
    if (uaData?.platform === 'Android') return true;
  }
  return false;
}

/** Detect if running as installed PWA (standalone mode) */
function isStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches ||
    // iOS 26: all home-screen sites report as standalone, also check fullscreen
    window.matchMedia('(display-mode: fullscreen)').matches ||
    (window.navigator as any).standalone === true;
}

/** Cross-browser requestPermission — uses modern Promise API first, callback fallback */
async function requestNotificationPermission(): Promise<NotificationPermission> {
  try {
    // Modern API (all current browsers including iOS 16.4+ PWA)
    const result = Notification.requestPermission();
    if (result && typeof result.then === 'function') {
      return await result;
    }
    // Very old callback-only browsers (Safari <15) — shouldn't reach here in practice
    return await new Promise<NotificationPermission>((resolve) => {
      Notification.requestPermission((permission) => resolve(permission));
    });
  } catch {
    return 'default';
  }
}

type PromptMode = 'ask' | 'denied' | 'ios-guide' | 'unsupported';

export default function NotificationPrompt() {
  const { data: session } = useSession();
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [promptMode, setPromptMode] = useState<PromptMode>('ask');

  useEffect(() => {
    // Only show for logged-in users
    if (!session?.user?.email) return;

    // Check browser support
    if (typeof window === 'undefined') return;

    const ios = isIOSDevice();
    const android = isAndroidDevice();
    const standalone = isStandaloneMode();
    setIsIOS(ios);
    setIsAndroid(android);
    setIsStandalone(standalone);

    // Missing VAPID key = server config issue — don't bother the user
    if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return;

    // iOS devices: push only works in standalone/PWA mode (iOS 16.4+).
    // iOS 26+ makes every home-screen site a web app, but the Notification API
    // is still only exposed in standalone context, NOT Safari.
    // → Always show add-to-home-screen guidance when not standalone.
    if (ios && !standalone) {
      try {
        const dismissed = localStorage.getItem(DISMISS_KEY + '-ios');
        if (dismissed) {
          const dismissedAt = parseInt(dismissed, 10);
          if (Date.now() - dismissedAt < DISMISS_DURATION) return;
        }
      } catch {}
      setPromptMode('ios-guide');
      const timer = setTimeout(() => setShow(true), 5000);
      return () => clearTimeout(timer);
    }

    // Standard push notification flow (Android, Desktop, iOS PWA/standalone)
    const hasSW = 'serviceWorker' in navigator;
    const hasPush = 'PushManager' in window;
    const hasNotif = 'Notification' in window;
    if (!hasSW || !hasPush || !hasNotif) {
      // iOS in standalone but APIs somehow unavailable — suggest iOS update
      if (ios) {
        try {
          const dismissed = localStorage.getItem(DISMISS_KEY + '-ios');
          if (dismissed) {
            const dismissedAt = parseInt(dismissed, 10);
            if (Date.now() - dismissedAt < DISMISS_DURATION) return;
          }
        } catch {}
        setPromptMode('ios-guide');
        const timer = setTimeout(() => setShow(true), 5000);
        return () => clearTimeout(timer);
      }
      // Non-iOS device with missing push APIs — truly unsupported
      try {
        const dismissed = localStorage.getItem(DISMISS_KEY + '-unsupported');
        if (dismissed) {
          const dismissedAt = parseInt(dismissed, 10);
          if (Date.now() - dismissedAt < DISMISS_DURATION) return;
        }
      } catch {}
      setPromptMode('unsupported');
      const timer = setTimeout(() => setShow(true), 5000);
      return () => clearTimeout(timer);
    }

    const currentPermission = Notification.permission;

    // Already granted — check if already subscribed, if not re-subscribe
    if (currentPermission === 'granted') {
      // Silently register SW and ensure subscription is active
      navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
        .then(async (reg) => {
          await navigator.serviceWorker.ready;
          const existingSub = await reg.pushManager.getSubscription();
          if (!existingSub) {
            // Permission granted but no subscription (e.g., cleared data) — re-subscribe silently
            try {
              const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
              if (vapidKey) {
                const sub = await reg.pushManager.subscribe({
                  userVisibleOnly: true,
                  applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
                });
                await fetch('/api/push-subscription', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ subscription: sub.toJSON(), action: 'subscribe' }),
                });
              }
            } catch (e) {
              console.warn('[NotificationPrompt] Re-subscribe failed:', e);
            }
          }
        })
        .catch(() => {});
      return;
    }

    // Permission denied — show guidance to re-enable from settings
    if (currentPermission === 'denied') {
      try {
        const dismissed = localStorage.getItem(DISMISS_KEY + '-denied');
        if (dismissed) {
          const dismissedAt = parseInt(dismissed, 10);
          if (Date.now() - dismissedAt < DENIED_DISMISS_DURATION) return;
        }
      } catch {}
      setPromptMode('denied');
      const timer = setTimeout(() => setShow(true), 5000);
      return () => clearTimeout(timer);
    }

    // Permission is 'default' — show standard prompt
    // Check if dismissed recently
    try {
      const dismissed = localStorage.getItem(DISMISS_KEY);
      if (dismissed) {
        const dismissedAt = parseInt(dismissed, 10);
        if (Date.now() - dismissedAt < DISMISS_DURATION) return;
      }
    } catch {}

    // Register SW early (even before user clicks)
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => {});

    setPromptMode('ask');
    // Show prompt after a delay (don't be annoying on page load)
    const timer = setTimeout(() => setShow(true), 5000);
    return () => clearTimeout(timer);
  }, [session?.user?.email]);

  const handleDismiss = useCallback(() => {
    setShow(false);
    try {
      if (promptMode === 'ios-guide') {
        localStorage.setItem(DISMISS_KEY + '-ios', Date.now().toString());
      } else if (promptMode === 'denied') {
        localStorage.setItem(DISMISS_KEY + '-denied', Date.now().toString());
      } else if (promptMode === 'unsupported') {
        localStorage.setItem(DISMISS_KEY + '-unsupported', Date.now().toString());
      } else {
        localStorage.setItem(DISMISS_KEY, Date.now().toString());
      }
    } catch {}
  }, [promptMode]);

  const handleEnable = useCallback(async () => {
    setLoading(true);
    try {
      // Use cross-browser permission request (handles callback + Promise patterns)
      const permission = await requestNotificationPermission();
      if (permission !== 'granted') {
        // If permission was denied, switch to denied mode instead of just dismissing
        if (permission === 'denied') {
          setPromptMode('denied');
          // Don't hide — show the denied guidance immediately
          setLoading(false);
          return;
        }
        handleDismiss();
        return;
      }

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        handleDismiss();
        return;
      }

      // Wait for service worker to be ready (important on slow mobile connections)
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
      });

      await fetch('/api/push-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: sub.toJSON(),
          action: 'subscribe',
        }),
      });

      setShow(false);
      // Mark as permanently dismissed after successful subscription
      try { localStorage.setItem(DISMISS_KEY, (Date.now() + 365 * 24 * 60 * 60 * 1000).toString()); } catch {}
    } catch (err) {
      console.error('[NotificationPrompt] Error:', err);
      handleDismiss();
    } finally {
      setLoading(false);
    }
  }, [handleDismiss]);

  // Handler for "denied" mode: try re-requesting in case browser allows it, otherwise show settings guide
  const handleRetryOrOpenSettings = useCallback(async () => {
    // Some mobile browsers (e.g., newer Chrome on Android) allow re-requesting after deny
    // Try requesting again — if the browser blocks it, the permission stays 'denied'
    if ('Notification' in window && Notification.permission === 'denied') {
      try {
        const perm = await requestNotificationPermission();
        if (perm === 'granted') {
          // Great! Subscribe normally
          await handleEnable();
          return;
        }
      } catch {
        // Browser didn't show dialog — expected
      }
    }
    // If still denied, dismiss with short timeout so they'll be reminded again
    handleDismiss();
  }, [handleEnable, handleDismiss]);

  if (!show) return null;

  // Determine prompt content based on mode
  const getDeniedGuidance = (): string => {
    if (isIOS) {
      if (isStandalone) {
        // In PWA/home-screen web app
        return 'การแจ้งเตือนถูกปิดอยู่ ไปที่ ตั้งค่า > แอป SCC Shop > การแจ้งเตือน แล้วเปิดอนุญาตการแจ้งเตือน';
      }
      // In Safari on iOS 26+ (push available in browser)
      return 'การแจ้งเตือนถูกปิดอยู่ ไปที่ ตั้งค่า > Safari > เว็บไซต์ > การแจ้งเตือน แล้วเปิดการแจ้งเตือนสำหรับเว็บนี้';
    }
    if (isAndroid) {
      return 'การแจ้งเตือนถูกปิดอยู่ กดที่ 🔒 ข้างแถบที่อยู่ > สิทธิ์ > การแจ้งเตือน แล้วเลือก "อนุญาต"';
    }
    return 'การแจ้งเตือนถูกปิดอยู่ กดที่ 🔒 ข้างแถบที่อยู่ แล้วเปิดการแจ้งเตือนสำหรับเว็บนี้';
  };

  const getUnsupportedGuidance = (): string => {

    if (isAndroid) {
      return 'เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือน ลองเปิดใน Google Chrome หรือ Samsung Internet แล้วลองใหม่';
    }
    return 'เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือน ลองเปิดใน Google Chrome หรือ Microsoft Edge แล้วลองใหม่';
  };

  const getTitle = (): string => {
    switch (promptMode) {
      case 'ios-guide': return isStandalone ? 'อัปเดต iOS เพื่อรับการแจ้งเตือน' : 'เพิ่มไปที่หน้าจอหลัก';
      case 'denied': return 'เปิดการแจ้งเตือนอีกครั้ง';
      case 'unsupported': return 'เบราว์เซอร์ไม่รองรับ';
      default: return 'เปิดรับการแจ้งเตือน';
    }
  };

  const getDescription = (): string => {
    switch (promptMode) {
      case 'ios-guide':
        if (isStandalone) {
          return 'อุปกรณ์ของคุณอาจต้องอัพเดต iOS เป็นเวอร์ชัน 16.4 ขึ้นไปเพื่อรองรับการแจ้งเตือน (ตั้งค่า > ทั่วไป > อัพเดตซอฟต์แวร์)';
        }
        return 'กดปุ่ม แชร์ (Share) ⬆ แล้วเลือก "เพิ่มไปที่หน้าจอหลัก" จากนั้นเปิดแอปจากหน้าจอหลักเพื่อรับการแจ้งเตือน';
      case 'denied':
        return getDeniedGuidance();
      case 'unsupported':
        return getUnsupportedGuidance();
      default:
        return NOTIFICATION_DESC;
    }
  };

  const getIcon = () => {
    switch (promptMode) {
      case 'ios-guide': return <PhoneIcon size={20} color="white" />;
      case 'denied': return <SettingsIcon size={20} color="white" />;
      case 'unsupported': return <PhoneIcon size={20} color="white" />;
      default: return <BellIcon size={20} color="white" />;
    }
  };

  const getGradient = (): string => {
    switch (promptMode) {
      case 'ios-guide': return 'linear-gradient(135deg, #5ac8fa 0%, #34c759 100%)';
      case 'denied': return 'linear-gradient(135deg, #ff9500 0%, #ff3b30 100%)';
      case 'unsupported': return 'linear-gradient(135deg, #8e8e93 0%, #636366 100%)';
      default: return 'linear-gradient(135deg, #0071e3 0%, #5ac8fa 100%)';
    }
  };

  return (
    <Slide direction="up" in={show} mountOnEnter unmountOnExit>
      <Box
        sx={{
          position: 'fixed',
          bottom: { xs: 90, sm: 24 },
          left: { xs: 16, sm: 'auto' },
          right: { xs: 16, sm: 24 },
          maxWidth: { sm: 380 },
          zIndex: 1199,
          bgcolor: 'var(--surface)',
          border: '1px solid var(--glass-border)',
          borderRadius: 3,
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          p: 2,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 1.5,
          backdropFilter: 'blur(12px)',
        }}
      >
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: getGradient(),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {getIcon()}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--foreground)', mb: 0.3 }}>
            {getTitle()}
          </Typography>
          <Typography sx={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.4, mb: 1.2 }}>
            {getDescription()}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {promptMode === 'ask' && (
              <Button
                size="small"
                variant="contained"
                disabled={loading}
                onClick={handleEnable}
                sx={{
                  fontSize: '0.78rem',
                  px: 2,
                  py: 0.5,
                  textTransform: 'none',
                  borderRadius: 2,
                  background: '#0071e3',
                  fontWeight: 600,
                  '&:hover': { background: '#1d4ed8' },
                }}
              >
                {loading ? 'กำลังเปิด...' : 'เปิดการแจ้งเตือน'}
              </Button>
            )}
            {promptMode === 'denied' && (
              <Button
                size="small"
                variant="contained"
                onClick={handleRetryOrOpenSettings}
                sx={{
                  fontSize: '0.78rem',
                  px: 2,
                  py: 0.5,
                  textTransform: 'none',
                  borderRadius: 2,
                  background: '#ff9500',
                  fontWeight: 600,
                  '&:hover': { background: '#e68900' },
                }}
              >
                ลองอีกครั้ง
              </Button>
            )}
            <Button
              size="small"
              onClick={handleDismiss}
              sx={{
                fontSize: '0.78rem',
                px: 1.5,
                py: 0.5,
                textTransform: 'none',
                borderRadius: 2,
                color: 'var(--text-muted)',
              }}
            >
              {promptMode === 'ios-guide' || promptMode === 'unsupported' ? 'เข้าใจแล้ว' : 'ไม่ใช่ตอนนี้'}
            </Button>
          </Box>
        </Box>
        <IconButton size="small" onClick={handleDismiss} sx={{ mt: -0.5, mr: -0.5 }}>
          <CloseIcon size={16} />
        </IconButton>
      </Box>
    </Slide>
  );
}
