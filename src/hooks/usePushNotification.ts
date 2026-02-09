// src/hooks/usePushNotification.ts
// Client-side hook for managing Web Push notifications

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';

// Convert base64 URL-safe string to Uint8Array for applicationServerKey
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

/** Cross-browser requestPermission — uses modern Promise API first, callback fallback */
async function requestNotificationPermission(): Promise<NotificationPermission> {
  try {
    // Modern API (all current browsers including iOS 16.4+ PWA and iOS 26+)
    const result = Notification.requestPermission();
    if (result && typeof result.then === 'function') {
      return await result;
    }
    // Very old callback-only browsers — shouldn't reach here in practice
    return await new Promise<NotificationPermission>((resolve) => {
      Notification.requestPermission((permission) => resolve(permission));
    });
  } catch {
    return 'default';
  }
}

export type PushPermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

interface UsePushNotificationReturn {
  /** Current notification permission state */
  permission: PushPermissionState;
  /** Whether push is supported in this browser */
  isSupported: boolean;
  /** Whether the user is currently subscribed to push */
  isSubscribed: boolean;
  /** Whether an operation is in progress */
  loading: boolean;
  /** Request notification permission and subscribe to push */
  subscribe: () => Promise<boolean>;
  /** Unsubscribe from push notifications */
  unsubscribe: () => Promise<void>;
  /** Service worker registration (null if not registered) */
  registration: ServiceWorkerRegistration | null;
}

export function usePushNotification(): UsePushNotificationReturn {
  const { data: session } = useSession();
  const [permission, setPermission] = useState<PushPermissionState>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const initRef = useRef(false);

  const isSupported = typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window &&
    !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  // Initialize: register service worker and check subscription state
  useEffect(() => {
    if (!isSupported || initRef.current) return;
    initRef.current = true;

    const init = async () => {
      try {
        // Check current permission
        setPermission(Notification.permission as PushPermissionState);

        // Register service worker (update on each page load to pick up new versions)
        const reg = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none',
        });
        
        // Force update check to clear old caches
        reg.update().catch(() => {});
        
        setRegistration(reg);

        // Check existing subscription
        const sub = await reg.pushManager.getSubscription();
        setIsSubscribed(!!sub);
      } catch (err) {
        console.error('[Push] Service worker registration failed:', err);
      }
    };

    init();
  }, [isSupported]);

  // Listen for permission changes
  useEffect(() => {
    if (!isSupported) return;

    const checkPermission = () => {
      setPermission(Notification.permission as PushPermissionState);
    };

    // Check on visibility change (user returns to tab) instead of aggressive polling
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') checkPermission();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // Fallback: poll very infrequently (permission changes are user-initiated)
    const interval = setInterval(checkPermission, 60000);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isSupported]);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported || !registration || !session?.user?.email) return false;

    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) {
      console.warn('[Push] VAPID public key not configured — push notifications disabled');
      return false;
    }

    setLoading(true);
    try {
      // Request permission (cross-browser: handles callback + Promise patterns)
      const result = await requestNotificationPermission();
      setPermission(result as PushPermissionState);

      if (result !== 'granted') {
        setLoading(false);
        return false;
      }

      // Subscribe to push
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
      });

      // Send subscription to server
      const response = await fetch('/api/push-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: sub.toJSON(),
          action: 'subscribe',
        }),
      });

      if (response.ok) {
        setIsSubscribed(true);
        setLoading(false);
        return true;
      } else {
        console.error('[Push] Failed to save subscription to server');
        setLoading(false);
        return false;
      }
    } catch (err) {
      console.error('[Push] Subscribe failed:', err);
      setLoading(false);
      return false;
    }
  }, [isSupported, registration, session?.user?.email]);

  const unsubscribe = useCallback(async () => {
    if (!registration) return;

    setLoading(true);
    try {
      const sub = await registration.pushManager.getSubscription();
      if (sub) {
        // Remove from server
        await fetch('/api/push-subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subscription: { endpoint: sub.endpoint },
            action: 'unsubscribe',
          }),
        }).catch(() => {});

        // Unsubscribe locally
        await sub.unsubscribe();
      }
      setIsSubscribed(false);
    } catch (err) {
      console.error('[Push] Unsubscribe failed:', err);
    } finally {
      setLoading(false);
    }
  }, [registration]);

  if (!isSupported) {
    return {
      permission: 'unsupported',
      isSupported: false,
      isSubscribed: false,
      loading: false,
      subscribe: async () => false,
      unsubscribe: async () => {},
      registration: null,
    };
  }

  return {
    permission,
    isSupported,
    isSubscribed,
    loading,
    subscribe,
    unsubscribe,
    registration,
  };
}
