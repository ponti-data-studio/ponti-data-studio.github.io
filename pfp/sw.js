/**
 * Service worker untuk shell PWA "Personal Finance Pro".
 *
 * Catatan penting: konten sesungguhnya (Apps Script web app) dimuat lewat
 * <iframe> ke domain script.google.com — CROSS-ORIGIN, sehingga TIDAK bisa
 * dan TIDAK boleh di-cache di sini (browser memblokirnya, dan mencobanya
 * hanya membuat halaman offline yang menyesatkan). Yang di-cache hanya
 * "cangkang" (shell): index.html, manifest, ikon, dan halaman offline —
 * cukup untuk membuat situs ini installable dan tetap tampil rapi saat
 * sinyal internet hilang.
 */

const CACHE_NAME = 'pfp-shell-v1';
const SHELL_ASSETS = [
  './',
  './index.html',
  './offline.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-192-maskable.png',
  './icons/icon-512-maskable.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32x32.png',
  './icons/favicon-16x16.png'
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
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Biarkan semua permintaan lintas-domain (termasuk iframe ke script.google.com)
  // lewat apa adanya — jangan disentuh oleh service worker ini.
  if (url.origin !== self.location.origin) return;
  if (req.method !== 'GET') return;

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached || (req.mode === 'navigate' ? caches.match('./offline.html') : undefined));
      return cached || network;
    })
  );
});
