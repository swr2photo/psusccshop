// src/components/NotificationPrompt.tsx
// Global notification permission prompt — shows once per session for logged-in users
// Registers service worker for push notifications independently of the chat widget
// Supports iOS (PWA) + Android + Desktop

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Box, Typography, Button, IconButton, Slide } from '@mui/material';
import { Bell as BellIcon, X as CloseIcon, Smartphone as PhoneIcon } from 'lucide-react';

const DISMISS_KEY = 'scc-push-prompt-dismissed';
const DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days
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

/** Detect iOS device */
function isIOSDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/** Detect if running as installed PWA (standalone mode) */
function isStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true;
}

export default function NotificationPrompt() {
  const { data: session } = useSession();
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Only show for logged-in users
    if (!session?.user?.email) return;

    // Check browser support
    if (typeof window === 'undefined') return;

    const ios = isIOSDevice();
    const standalone = isStandaloneMode();
    setIsIOS(ios);
    setIsStandalone(standalone);

    // iOS in Safari (not PWA) — show PWA install guide instead
    if (ios && !standalone) {
      // Check if dismissed recently
      try {
        const dismissed = localStorage.getItem(DISMISS_KEY + '-ios');
        if (dismissed) {
          const dismissedAt = parseInt(dismissed, 10);
          if (Date.now() - dismissedAt < DISMISS_DURATION) return;
        }
      } catch {}
      const timer = setTimeout(() => setShow(true), 5000);
      return () => clearTimeout(timer);
    }

    // Standard push notification flow (Android, Desktop, iOS PWA)
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return;

    // Already granted or denied — don't show prompt
    if (Notification.permission !== 'default') return;

    // Check VAPID key
    if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return;

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

    // Show prompt after a delay (don't be annoying on page load)
    const timer = setTimeout(() => setShow(true), 5000);
    return () => clearTimeout(timer);
  }, [session?.user?.email]);

  const handleDismiss = useCallback(() => {
    setShow(false);
    try {
      const key = isIOS && !isStandalone ? DISMISS_KEY + '-ios' : DISMISS_KEY;
      localStorage.setItem(key, Date.now().toString());
    } catch {}
  }, [isIOS, isStandalone]);

  const handleEnable = useCallback(async () => {
    setLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        handleDismiss();
        return;
      }

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        handleDismiss();
        return;
      }

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

  if (!show) return null;

  // iOS in Safari (not PWA) — show "Add to Home Screen" guide
  const showIOSGuide = isIOS && !isStandalone;

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
            background: showIOSGuide
              ? 'linear-gradient(135deg, #5ac8fa 0%, #34c759 100%)'
              : 'linear-gradient(135deg, #0071e3 0%, #5ac8fa 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {showIOSGuide ? <PhoneIcon size={20} color="white" /> : <BellIcon size={20} color="white" />}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--foreground)', mb: 0.3 }}>
            {showIOSGuide ? 'เพิ่มไปที่หน้าจอหลัก' : 'เปิดรับการแจ้งเตือน'}
          </Typography>
          <Typography sx={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.4, mb: 1.2 }}>
            {showIOSGuide
              ? 'กดปุ่ม แชร์ (Share) แล้วเลือก "เพิ่มไปที่หน้าจอหลัก" เพื่อรับการแจ้งเตือนบน iPhone/iPad'
              : NOTIFICATION_DESC}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {!showIOSGuide && (
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
              {showIOSGuide ? 'เข้าใจแล้ว' : 'ไม่ใช่ตอนนี้'}
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
