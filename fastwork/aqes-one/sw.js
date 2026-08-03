/**
 * ============================================================
 * AQES One — Service Worker
 * ------------------------------------------------------------
 * Hanya meng-cache "shell" pembungkus PWA (index.html, manifest,
 * ikon). Konten aplikasi sesungguhnya berjalan di dalam <iframe>
 * yang memuat Google Apps Script Web App — permintaan ke domain
 * script.google.com dibiarkan lewat langsung (tidak di-cache),
 * karena data selalu harus terbaru dari Google Sheets.
 *
 * PENTING: setiap kali file shell diperbarui (index.html,
 * manifest.json, atau ikon), naikkan versi CACHE_NAME di bawah
 * agar pengguna otomatis mendapat versi terbaru.
 * ============================================================ */

const CACHE_NAME = 'aqes-one-shell-v1';

const SHELL_FILES = [
  './',
  './index.html',
  './manifest.json',
  './icons/favicon-16x16.png',
  './icons/favicon-32x32.png',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png'
];

/* ---------------- INSTALL: simpan shell ke cache ---------------- */
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) { return cache.addAll(SHELL_FILES); })
      .catch(function (err) { console.warn('[SW] Gagal cache shell:', err); })
  );
  self.skipWaiting();
});

/* ---------------- ACTIVATE: bersihkan cache versi lama ---------------- */
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE_NAME; })
            .map(function (k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

/* ---------------- FETCH: cache-first untuk shell saja ---------------- */
self.addEventListener('fetch', function (event) {
  const url = new URL(event.request.url);

  // Biarkan semua permintaan lintas domain (Google Apps Script, Chart.js
  // via CDN, Bootstrap Icons, dsb.) lewat langsung tanpa campur tangan SW.
  if (url.origin !== location.origin) return;

  // Hanya tangani metode GET.
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(function (cached) {
      if (cached) return cached;
      return fetch(event.request).catch(function () {
        // Offline & tidak ada di cache -> fallback ke shell utama.
        return caches.match('./index.html');
      });
    })
  );
});
