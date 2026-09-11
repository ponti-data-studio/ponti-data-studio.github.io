/**
 * sw.js - SIMONIKA-OSES PWA shell cache
 *
 * Hanya meng-cache berkas SHELL lokal (index.html, manifest, icon) supaya
 * pembungkus aplikasi tetap bisa terbuka (menampilkan splash + pesan offline)
 * walau tidak ada koneksi. Konten aplikasi sesungguhnya berjalan di dalam
 * <iframe> lintas domain (script.google.com) yang TIDAK bisa/boleh di-cache
 * oleh service worker ini (dibatasi CORS, dan datanya memang harus selalu
 * yang terbaru dari server Apps Script).
 */

const CACHE_NAME = 'simonika-oses-shell-v1';
const SHELL_ASSETS = [
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/favicon-32x32.png',
  './icons/favicon-16x16.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Hanya tangani permintaan same-origin untuk berkas shell.
  // Biarkan semua permintaan lain (termasuk ke script.google.com di dalam
  // iframe) berjalan normal lewat jaringan, tanpa campur tangan SW ini.
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached); // offline -> pakai versi cache jika ada

      // Cache-first untuk shell supaya buka aplikasi terasa instan,
      // tetap diperbarui diam-diam di latar belakang (stale-while-revalidate).
      return cached || networkFetch;
    })
  );
});
