/**
 * sw.js — Khotbah Pro service worker
 *
 * Scope: this file only caches the *shell* (this wrapper page, manifest,
 * icons). The actual app UI lives inside the Google Apps Script iframe on
 * a different origin (script.google.com), which a service worker
 * registered here cannot and should not intercept — so this worker makes
 * the wrapper itself load instantly and be installable, while the
 * Apps Script content inside the iframe always needs a live connection.
 *
 * Bump CACHE_VERSION whenever you change any shell file so returning
 * visitors pick up the update instead of a stale cached copy.
 */

var CACHE_VERSION = 'khotbahpro-shell-v1';

var SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32x32.png',
  './icons/favicon-16x16.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(function (cache) { return cache.addAll(SHELL_ASSETS); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (key) { return key !== CACHE_VERSION; })
          .map(function (key) { return caches.delete(key); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;

  // Only handle GET requests for this worker's own origin (the shell).
  // Everything else — including all requests from inside the Apps
  // Script iframe — passes straight through to the network untouched.
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(req).then(function (cached) {
      var networkFetch = fetch(req)
        .then(function (response) {
          if (response && response.ok) {
            var copy = response.clone();
            caches.open(CACHE_VERSION).then(function (cache) { cache.put(req, copy); });
          }
          return response;
        })
        .catch(function () { return cached; });

      // Cache-first for instant loads; refresh the cache in the
      // background so the shell stays up to date on the next visit.
      return cached || networkFetch;
    })
  );
});
