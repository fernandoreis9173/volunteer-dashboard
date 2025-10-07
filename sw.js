const CACHE_NAME = 'volunteer-dashboard-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/index.css',
  '/vite.svg',
  '/icon.svg'
];

// Install event
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(key => {
        if (key !== CACHE_NAME) return caches.delete(key);
      }))
    )
  );
  self.clients.claim();
});

// Fetch event - offline support
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});

// Push notification
self.addEventListener('push', event => {
  const data = event.data?.json() || {};
  const title = data.title || 'Nova Notificação';
  const options = {
    body: data.body,
    icon: '/icon.svg',
    badge: '/icon.svg'
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification click
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/'));
});
