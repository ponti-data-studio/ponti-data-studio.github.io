/* Service worker — ERP Perhiasan (PWA shell).
 * Hanya meng-cache "cangkang" PWA (index.html, manifest, ikon) agar bisa dibuka
 * dan dipasang. Konten ERP itu sendiri ada di iframe Apps Script (lintas-origin)
 * dan TIDAK di-cache di sini: data/login selalu diambil langsung dari server.
 * Naikkan CACHE_VERSION setiap kali file shell diubah. */
const CACHE_VERSION = 'erp-perhiasan-v2';
const SHELL = [
  './',
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

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_VERSION)
      // cache:'reload' = ambil baru dari server, jangan dari cache HTTP browser.
      .then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Jangan sentuh Apps Script / Google / domain lain: biarkan langsung ke jaringan.
  if (url.origin !== self.location.origin) return;

  // Navigasi: selalu ambil baru dari jaringan (lewati cache HTTP), jatuh ke index.html tersimpan saat offline.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req.url, { cache: 'reload' }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Aset statis: cache dulu, perbarui di latar belakang.
  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
