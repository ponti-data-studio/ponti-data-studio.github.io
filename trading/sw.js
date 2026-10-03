/* ==========================================================================
   Service Worker, Trading Journal (PWA wrapper)
   --------------------------------------------------------------------------
   Tugasnya hanya menyimpan "cangkang" aplikasi (index.html, manifest, ikon)
   agar PWA bisa terpasang dan cangkangnya cepat dibuka.

   Aplikasi sebenarnya berjalan di dalam iframe milik Google (script.google.com).
   Request ke domain Google itu TIDAK lewat service worker ini, dan data jurnal
   disimpan oleh aplikasi sendiri (IndexedDB) di dalam iframe tersebut.

   Setiap kali mengubah file di folder ini, naikkan CACHE_VERSION.
   ========================================================================== */

const CACHE_VERSION = 'v1.0.0';
const CACHE_PREFIX = 'trading-journal-shell-';
const CACHE_NAME = CACHE_PREFIX + CACHE_VERSION;

const SHELL = [
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

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // Satu file gagal tidak boleh menggagalkan seluruh instalasi.
      Promise.all(SHELL.map((url) => cache.add(url).catch((err) => console.warn('SW: gagal cache', url, err))))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.indexOf(CACHE_PREFIX) === 0 && k !== CACHE_NAME).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

/** Ambil dari jaringan, simpan salinan; jika gagal pakai cache. */
function networkFirst(request, fallbackUrl) {
  return fetch(request)
    .then((response) => {
      if (response && response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      }
      return response;
    })
    .catch(() =>
      caches.match(request).then((hit) => hit || (fallbackUrl ? caches.match(fallbackUrl) : undefined)).then((hit) =>
        hit || new Response('Offline', { status: 503, statusText: 'Offline', headers: { 'Content-Type': 'text/plain' } })
      )
    );
}

/** Tampilkan cache dulu (cepat), perbarui di belakang layar. */
function staleWhileRevalidate(request) {
  return caches.match(request).then((hit) => {
    const refresh = fetch(request)
      .then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => undefined);
    return hit || refresh.then((r) => r || new Response('', { status: 504 }));
  });
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Hanya file milik situs ini. Google Apps Script dan CDN dibiarkan lewat apa adanya.
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, './index.html'));
    return;
  }
  event.respondWith(staleWhileRevalidate(request));
});
