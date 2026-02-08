// Service Worker for SCC Shop Push Notifications
// This file MUST be in /public to be served at the root scope
// v3 — cross-platform (iOS + Android) with cache clearing

const CACHE_VERSION = 'scc-shop-v3';

// Install event — activate immediately, clear old caches
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_VERSION)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.skipWaiting();
});

// Activate event — claim all clients, clear old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_VERSION)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Push notification received — cross-platform compatible
self.addEventListener('push', (event) => {
  let data = { title: 'SCC Shop', body: 'คุณมีข้อความใหม่', icon: '/favicon.png' };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch {
      data.body = event.data.text();
    }
  }

  // Base options that work on ALL platforms (iOS, Android, Desktop)
  const options = {
    body: data.body,
    icon: data.icon || '/favicon.png',
    badge: '/favicon.png',
    tag: data.tag || 'scc-chat',
    requireInteraction: false,
    silent: false,
    data: {
      url: data.url || '/',
      chatId: data.chatId,
    },
  };

  // Android/Desktop-only features (iOS ignores these but they won't cause errors)
  try {
    options.vibrate = [200, 100, 200];
    options.renotify = true;
    options.actions = [
      { action: 'open', title: 'เปิดดู' },
      { action: 'dismiss', title: 'ปิด' },
    ];
  } catch {
    // Silently ignore if platform doesn't support these
  }

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click handler — works on all platforms
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it and navigate
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          // Navigate to the target URL if different
          if ('navigate' in client) {
            client.navigate(urlToOpen);
          }
          return client.focus();
        }
      }
      // Otherwise open a new window
      return self.clients.openWindow(urlToOpen);
    })
  );
});
