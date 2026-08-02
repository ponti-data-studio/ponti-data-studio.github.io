/**
 * Service worker MATPRO (shell PWA).
 *
 * Yang di-cache hanya "cangkang" pembungkus (index.html, manifest, ikon) —
 * supaya splash screen dan tombol pasang tetap tampil walau sinyal jelek.
 * Konten aplikasi sendiri (di dalam iframe script.google.com) TIDAK di-cache
 * di sini: itu memakai antrean offline miliknya sendiri (localStorage),
 * dan lintas origin ke domain Google tidak bisa di-cache dari sini.
 */

var CACHE_NAME = 'matpro-shell-v1';
var SHELL_FILES = [
  './',
  './index.html',
  './manifest.json',
  './icons/favicon-16x16.png',
  './icons/favicon-32x32.png',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png'
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
    caches.keys().then(function (names) {
      return Promise.all(
        names.filter(function (n) { return n !== CACHE_NAME; })
             .map(function (n) { return caches.delete(n); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;

  // Hanya tangani permintaan GET ke origin sendiri (shell). Permintaan ke
  // script.google.com (isi iframe) dibiarkan lewat jaringan seperti biasa.
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then(function (cached) {
      var network = fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put(req, copy); });
        }
        return res;
      }).catch(function () { return cached; });
      // Cache-first untuk shell: tampil instan, lalu diperbarui diam-diam di latar.
      return cached || network;
    })
  );
});
