
const CACHE_NAME = 'volunteer-dashboard-v1';
const urlsToCache = [
  '/',
  '/index.html',
  // '/index.tsx', // This is a source file, not a browser-ready asset. It will be cached by the fetch handler.
  '/icon.svg',
  '/manifest.webmanifest',
  'https://cdn.tailwindcss.com',
  'https://esm.sh/react@18.2.0',
  'https://esm.sh/react-dom@18.2.0',
  'https://esm.sh/@supabase/supabase-js@2.44.4',
  'https://esm.sh/jspdf@2.5.1',
  'https://esm.sh/jspdf-autotable@3.8.2',
  'https://esm.sh/recharts@2.12.7?external=react,react-dom',
  'https://esm.sh/react@18.2.0/jsx-runtime',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response; // Retorna do cache
        }

        const fetchRequest = event.request.clone();

        return fetch(fetchRequest).then(
          (response) => {
            if (!response || response.status !== 200) {
              return response;
            }
            
            // Apenas requisições GET são armazenadas em cache.
            if(event.request.method !== 'GET') {
                return response;
            }

            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
          }
        );
      })
  );
});

self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Listener para notificações push
self.addEventListener('push', (event) => {
  try {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: '/icon.svg',
      badge: '/icon.svg',
      data: {
        url: data.url || '/'
      }
    };
    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  } catch (e) {
    console.error('Push event error:', e);
    const options = {
      body: event.data.text(),
      icon: '/icon.svg',
      badge: '/icon.svg',
      data: {
          url: '/'
      }
    };
    event.waitUntil(
      self.registration.showNotification("Nova Notificação", options)
    );
  }
});

// Listener para cliques em notificações
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const notificationData = event.notification.data;
  const urlToOpen = new URL(notificationData.url || '/', self.location.origin).href;

  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    }).then((clientList) => {
      // Se um cliente (aba) já estiver aberto, foque nele e navegue.
      if (clientList.length > 0) {
        let client = clientList[0];
        // Tenta encontrar um cliente que já esteja focado.
        for (let i = 0; i < clientList.length; i++) {
          if (clientList[i].focused) {
            client = clientList[i];
          }
        }
        return client.focus().then(c => c.navigate(urlToOpen));
      }
      // Se nenhum cliente estiver aberto, abra uma nova janela.
      return clients.openWindow(urlToOpen);
    })
  );
});
