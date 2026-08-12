/**
 * Service Worker - POS Kasir
 * Strategi: Cache-first untuk asset statis & CDN, offline fallback untuk navigasi.
 */

const CACHE_VERSION = 'pos-kasir-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/db.js',
  './js/storage.js',
  './js/auth.js',
  './js/ui.js',
  './js/router.js',
  './js/pos.js',
  './js/products.js',
  './js/transactions.js',
  './js/reports.js',
  './js/settings.js',
  './js/app.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch((err) => console.error('SW install cache error:', err))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key.startsWith('pos-kasir-') && key !== STATIC_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (request.method !== 'GET') {
    return;
  }

  // Navigation requests: try network first (to get fresh shell), fallback to cache/offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put('./index.html', clone));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Cache-first for everything else (static assets + CDN libraries)
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        return cached;
      }
      return fetch(request)
        .then((response) => {
          if (!response || response.status !== 200) {
            return response;
          }
          const clone = response.clone();
          const cacheName = request.url.startsWith(self.location.origin) ? STATIC_CACHE : RUNTIME_CACHE;
          caches.open(cacheName).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => {
          // Offline fallback for images
          if (request.destination === 'image') {
            return caches.match('./assets/icons/icon-192.png');
          }
          return undefined;
        });
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
