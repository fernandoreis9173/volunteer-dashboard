
// sw.js

// --- Configuration ---
// Incrementing the cache name invalidates previous caches.
const CACHE_NAME = 'volunteer-dashboard-v9'; // VERSÃO ATUALIZADA PARA FORÇAR REFRESH
const urlsToCache = [
  '/',
  '/index.html',
  '/icon.svg',
  '/manifest.webmanifest',
  // REMOVIDO: '/index.css' (causava erro 404/addAll)
];

// --- Lifecycle Listeners ---

// Install: Caches the core application shell.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[sw.js] Opened cache and caching app shell.');
        
        // CORREÇÃO: Usar .catch para garantir que mesmo que um arquivo falhe (404),
        // o Service Worker ainda instale. Isso resolve o erro 'Failed to execute addAll'.
        return cache.addAll(urlsToCache)
            .catch(err => {
                console.warn('[sw.js] Falha parcial no cache. A instalação continua.', err);
                // A Promise é resolvida para que a instalação continue
                return; 
            });
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

// Fetch: Implements a robust Network First, falling back to Cache strategy.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // --- STRATEGY ---
  // 1. Ignore non-GET requests (like POST to Supabase functions).
  // 2. Ignore cross-origin requests (já que url.origin !== self.location.origin).
  // 3. Para same-origin GET requests, try network first.
  
  // Isso garante que o POST para a Edge Function não é interceptado e não quebra a Promise.
  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    // Let the browser handle it without interception.
    return;
  }
  
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        // If we get a valid response, update the cache and return it.
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // If the network fails, try to find the request in the cache.
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Special fallback for navigation requests to the main app page.
          if (request.mode === 'navigate') {
            return caches.match('/index.html');
          }
          // For other failed assets, there's no specific fallback.
          return new Response(null, { status: 404, statusText: 'Not Found' });
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
  } catch (_e) { // Correção para remover aviso de linter
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

// Listener for clicks em notificações
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
