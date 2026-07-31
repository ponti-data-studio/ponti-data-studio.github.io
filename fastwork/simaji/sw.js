/**
 * SIMAJI — sw.js
 * Service worker MINIMAL. Hanya meng-cache "shell" statis (index.html,
 * manifest, ikon) agar aplikasi bisa terpasang dan langsung terbuka.
 *
 * Konten sebenarnya (dashboard, form, laporan) berjalan di dalam iframe
 * yang mengarah ke Google Apps Script — TIDAK di-cache di sini, karena
 * data harus selalu terbaru dan Apps Script sudah mengurus sesi/autentikasi
 * sendiri. Mode offline untuk data ditangani oleh SIMAJI sendiri
 * (localStorage) di dalam iframe tersebut.
 */

var CACHE_NAME = 'simaji-shell-v1';
var SHELL_FILES = [
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32x32.png',
  './icons/favicon-16x16.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) { return cache.addAll(SHELL_FILES); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE_NAME; })
            .map(function (k) { return caches.delete(k); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;

  // Hanya tangani navigasi/aset milik origin shell ini (GET, same-origin).
  // Permintaan ke script.google.com (di dalam iframe) dibiarkan lewat
  // langsung ke jaringan — tidak boleh di-cache oleh service worker ini.
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(req).then(function (cached) {
      var network = fetch(req).then(function (res) {
        if (res && res.status === 200) {
          var copy = res.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put(req, copy); });
        }
        return res;
      }).catch(function () { return cached; });
      return cached || network;
    })
  );
});
