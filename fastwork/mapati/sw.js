/**
 * sw.js — Service Worker untuk MAPATI (Manajemen Pangkat Terintegrasi)
 *
 * Strategi:
 * - Precache "app shell" (index.html, manifest, ikon) agar splash/offline bar
 *   tetap tampil walau tidak ada koneksi.
 * - HANYA meng-cache request same-origin (file PWA shell ini sendiri).
 *   Permintaan ke Google Apps Script (domain script.google.com) dan ke CDN
 *   pihak ketiga SENGAJA tidak di-cache di sini — dibiarkan lewat langsung
 *   ke jaringan, karena data kepegawaian harus selalu real-time dan tidak
 *   boleh basi/ketinggalan zaman.
 * - Naikkan CACHE_VERSION setiap kali file shell (index.html/manifest/ikon)
 *   diubah, supaya klien lama otomatis mengambil versi baru.
 */

const CACHE_VERSION = 'mapati-shell-v1';
const SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/favicon-16x16.png',
  './icons/favicon-32x32.png',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Hanya tangani GET
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Biarkan semua request lintas-origin (mis. script.google.com, CDN
  // Bootstrap/FontAwesome/SweetAlert2) langsung ke jaringan, tanpa cache,
  // supaya data MAPATI selalu segar dan tidak ada isu autentikasi/CORS.
  if (url.origin !== self.location.origin) {
    return;
  }

  // Untuk shell same-origin: cache-first, lalu fallback ke jaringan,
  // dan perbarui cache di latar belakang (stale-while-revalidate).
  event.respondWith(
    caches.match(req).then((cached) => {
      const networkFetch = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, clone));
          }
          return res;
        })
        .catch(() => cached || caches.match('./index.html'));

      return cached || networkFetch;
    })
  );
});
