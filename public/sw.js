// Service Worker for SCC Shop
// This file MUST be in /public to be served at the root scope
// v2.2.0 — PWA navigation + push notifications
// Cross-platform: iOS 16.4+ / iOS 26+ / Android / Desktop

const SW_VERSION = '2.2.0';
const CACHE_VERSION = `scc-shop-v${SW_VERSION}`;

// Minimal shell to cache for offline/instant start
const PRECACHE_URLS = [
  '/',
  '/offline.html',
  '/favicon.png',
];

// Install event — precache shell, activate immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch(() => {
        // If precaching fails (e.g. offline install), continue anyway
        return cache.add('/offline.html').catch(() => {});
      });
    }).then(() => {
      // Clean old caches
      return caches.keys().then((names) =>
        Promise.all(names.filter((n) => n !== CACHE_VERSION).map((n) => caches.delete(n)))
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

// ============== FETCH HANDLER ==============
// Network-first for navigations (always get fresh HTML)
// Network-only for API calls (never cache dynamic data)
// Stale-while-revalidate for static assets (fast load + background update)
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and cross-origin requests
  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // Skip API routes, auth, and Next.js internals — always go to network
  if (url.pathname.startsWith('/api/') ||
      url.pathname.startsWith('/auth/') ||
      url.pathname.startsWith('/_next/webpack') ||
      url.pathname.includes('__nextjs')) {
    return;
  }

  // Navigation requests (HTML pages) — network-first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache a copy of successful navigations for offline support
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => {
              cache.put(request, clone);
            });
          }
          return response;
        })
        .catch(() => {
          // Offline — try cache first, then offline fallback
          return caches.match(request).then((cached) => {
            return cached || caches.match('/offline.html');
          });
        })
    );
    return;
  }

  // Static assets (_next/static, images, fonts) — stale-while-revalidate
  if (url.pathname.startsWith('/_next/static/') ||
      url.pathname.match(/\.(png|jpg|jpeg|svg|webp|ico|woff2?|ttf|css|js)$/)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
          }
          return response;
        }).catch(() => cached);

        return cached || networkFetch;
      })
    );
    return;
  }

  // Everything else — network only (don't cache)
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

  // Base options that work on ALL platforms (iOS 16.4+, iOS 26+, Android, Desktop)
  const options = {
    body: data.body,
    icon: data.icon || '/favicon.png',
    badge: '/favicon.png',
    tag: data.tag || 'scc-chat',
    // iOS 26+ respects requireInteraction; keep false for non-intrusive behavior
    requireInteraction: false,
    silent: false,
    data: {
      url: data.url || '/',
      chatId: data.chatId,
    },
  };

  // Android/Desktop features (iOS ignores unsupported fields gracefully)
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

  let urlToOpen = event.notification.data?.url || '/';
  const chatId = event.notification.data?.chatId;

  // If this is a chat notification, append chatId to URL for deep linking
  if (chatId) {
    const separator = urlToOpen.includes('?') ? '&' : '?';
    if (urlToOpen.startsWith('/admin')) {
      // Admin: navigate to support tab with chatId
      urlToOpen = `/admin?chatId=${chatId}#support`;
    } else {
      // Customer: navigate to home with chat param
      urlToOpen = `/?chat=${chatId}`;
    }
  }

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
