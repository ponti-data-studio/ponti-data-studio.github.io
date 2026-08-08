'use strict';

// Bump this version string whenever any cached asset changes so the
// service worker knows to install a fresh cache and drop the old one.
const CACHE_VERSION = 'v1';
const CACHE_NAME = `prompt-library-${CACHE_VERSION}`;

const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

// ==========================================================
// INSTALL — pre-cache the app shell
// ==========================================================
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// ==========================================================
// ACTIVATE — clear out old cache versions
// ==========================================================
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith('prompt-library-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// ==========================================================
// FETCH — cache-first for app shell, falling back to network,
// and updating the cache in the background when possible.
// ==========================================================
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle same-origin GET requests; let everything else pass through.
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      const networkFetch = fetch(req)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return networkResponse;
        })
        .catch(() => {
          // Offline and not cached: fall back to index.html for navigations
          // so the app shell still loads.
          if (req.mode === 'navigate') {
            return caches.match('./index.html');
          }
          return cachedResponse;
        });

      // Cache-first: serve immediately if available, refresh in background.
      return cachedResponse || networkFetch;
    })
  );
});
