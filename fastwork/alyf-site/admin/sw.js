/**
 * sw.js — ALYF CMS PWA shell service worker.
 *
 * Scope: this only caches the SHELL of this app (this index.html, its icons,
 * and the manifest) so the splash screen / install prompt / offline banner
 * still work when there's no connection.
 *
 * It deliberately does NOT try to cache anything from the CMS itself
 * (script.google.com) — the real admin app runs inside an <iframe> pointing
 * to a different origin, so this service worker never sees or intercepts
 * those requests (each browsing context is controlled by the service
 * worker of its own origin, or none at all for cross-origin iframes).
 * Editing content still requires an actual internet connection.
 */

const CACHE_VERSION = 'alyf-cms-shell-v1';
const SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32x32.png',
  './icons/favicon-16x16.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only handle same-origin GET requests for this shell. Everything else
  // (the CMS iframe's own requests to script.google.com, POST requests,
  // etc.) is left completely alone and goes straight to the network.
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((response) => {
          // Cache a copy of newly-fetched shell assets for next time.
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, responseClone));
          }
          return response;
        })
        .catch(() => {
          // Offline and not cached: for a navigation request, fall back to
          // the cached shell page so the user at least sees the splash /
          // offline banner instead of a browser error page.
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
          return undefined;
        });
    })
  );
});
