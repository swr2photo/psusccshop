// Service Worker for SCC Shop Push Notifications
// This file MUST be in /public to be served at the root scope

const CACHE_NAME = 'scc-shop-v1';

// Install event — activate immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate event — claim all clients
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Push notification received
self.addEventListener('push', (event) => {
  let data = { title: 'SCC Shop', body: 'คุณมีข้อความใหม่', icon: '/favicon.png' };
  
  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/favicon.png',
    badge: '/favicon.png',
    vibrate: [200, 100, 200],
    tag: data.tag || 'scc-chat',
    renotify: true,
    requireInteraction: false,
    data: {
      url: data.url || '/',
      chatId: data.chatId,
    },
    actions: [
      { action: 'open', title: 'เปิดแชท' },
      { action: 'dismiss', title: 'ปิด' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      return self.clients.openWindow(urlToOpen);
    })
  );
});
