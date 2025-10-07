// Service Worker mínimo para PWA
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Installed');
  self.skipWaiting(); // Ativa o SW imediatamente
});

self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activated');
});

self.addEventListener('fetch', (event) => {
  // Futuramente você pode implementar caching aqui
});
