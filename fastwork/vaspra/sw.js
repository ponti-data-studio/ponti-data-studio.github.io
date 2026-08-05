/**
 * ============================================================
 * sw.js — Service Worker untuk PWA "Pengajuan Peta Tematik"
 * ------------------------------------------------------------
 * Strategi: App Shell caching.
 * Yang di-cache HANYA kerangka pembungkus (index.html, manifest,
 * ikon) — bukan konten Web App Google Apps Script di dalam
 * iframe, karena itu lintas origin dan selalu butuh data terbaru
 * (form, dashboard, hasil pencarian, dsb).
 *
 * Naikkan CACHE_VERSION setiap kali file shell diubah agar
 * pengguna lama mendapat versi baru.
 * ============================================================
 */

var CACHE_VERSION = 'vaspra-shell-v2';

var SHELL_FILES = [
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

/* ---------------------------- INSTALL ---------------------------- */
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(function (cache) {
      return cache.addAll(SHELL_FILES);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

/* ---------------------------- ACTIVATE ---------------------------- */
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (key) { return key !== CACHE_VERSION; })
          .map(function (key) { return caches.delete(key); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

/* ----------------------------- FETCH ----------------------------- */
self.addEventListener('fetch', function (event) {
  var req = event.request;
  var url = new URL(req.url);

  // Hanya tangani permintaan GET pada origin sendiri (file shell).
  // Permintaan ke script.google.com (iframe/API) dibiarkan lewat
  // langsung ke jaringan tanpa campur tangan service worker.
  if (req.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(req).then(function (cached) {
      var networkFetch = fetch(req).then(function (res) {
        if (res && res.status === 200) {
          var resClone = res.clone();
          caches.open(CACHE_VERSION).then(function (cache) {
            cache.put(req, resClone);
          });
        }
        return res;
      }).catch(function () {
        // Offline & tidak ada di cache -> untuk navigasi, jatuhkan ke index.html
        if (req.mode === 'navigate') {
          return caches.match('./index.html');
        }
        return cached;
      });

      // Strategi: stale-while-revalidate -> tampilkan cache dulu jika ada,
      // sambil memperbarui cache di latar belakang.
      return cached || networkFetch;
    })
  );
});
