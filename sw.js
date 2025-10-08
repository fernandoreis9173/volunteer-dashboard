// sw.js

// --- Configuration ---
// Incrementing the cache name invalidates previous caches.
const CACHE_NAME = 'volunteer-dashboard-v3'; 
const urlsToCache = [
  '/',
  '/index.html',
  '/icon.svg',
  '/manifest.webmanifest',
];

// --- Lifecycle Listeners ---

// Install: Caches the core application shell.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[sw.js] Opened cache and caching app shell.');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting()) // Activate new SW immediately
  );
});

// Activate: Cleans up old, unused caches.
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log(`[sw.js] Deleting old cache: ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // Take control of all open clients
  );
});

// Fetch: Implements the "Network First, falling back to Cache" strategy.
self.addEventListener('fetch', (event) => {
  // We only want to cache GET requests.
  if (event.request.method !== 'GET') {
    return;
  }

  const requestUrl = new URL(event.request.url);

  // IMPORTANT: Do not intercept and cache cross-origin requests (e.g., CDNs, Google Fonts).
  // This prevents CORS errors when the Service Worker tries to fetch them.
  if (requestUrl.origin !== self.location.origin) {
    return;
  }
  
  // For navigation requests (like loading the page), always go network-first.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => caches.match('/index.html')) // Fallback to the main page if offline
    );
    return;
  }

  // For all other assets, use the network-first strategy.
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // If the fetch is successful, clone it, cache it, and return it.
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME)
          .then((cache) => {
            cache.put(event.request, responseToCache);
          });
        return networkResponse;
      })
      .catch(() => {
        // If the network fails, try to serve the response from the cache.
        return caches.match(event.request)
          .then((cachedResponse) => {
            return cachedResponse || new Response(null, { status: 404, statusText: 'Not Found' });
          });
      })
  );
});


// --- Push Notification Listeners ---

// Listener for incoming push notifications
self.addEventListener('push', (event) => {
  console.log('[sw.js] Push Received.');

  let data;
  try {
    data = event.data.json();
  } catch (e) {
    data = {
      title: 'Nova Notificação',
      body: event.data.text(),
    };
  }
  
  const title = data.title || 'Nova Notificação';
  const options = {
    body: data.body || 'Você recebeu uma nova notificação.',
    icon: '/icon.svg',
    badge: '/icon.svg',
    data: {
        url: data.url || '/'
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Listener for clicks on notifications
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const notificationData = event.notification.data;
  const urlToOpen = new URL(notificationData.url || '/', self.location.origin).href;

  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    }).then((clientList) => {
      if (clientList.length > 0) {
        let client = clientList[0];
        for (let i = 0; i < clientList.length; i++) {
          if (clientList[i].focused) {
            client = clientList[i];
          }
        }
        return client.focus().then(c => c.navigate(urlToOpen));
      }
      return clients.openWindow(urlToOpen);
    })
  );
});