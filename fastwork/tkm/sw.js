/* TKM Monitoring — Service Worker
   Strategi:
   - App shell (index.html, manifest, ikon): cache-first + update di latar belakang.
   - Navigasi: network-first, jatuh ke cache jika offline.
   - Permintaan lintas-origin (Apps Script / Google): TIDAK dicegat, langsung ke jaringan,
     supaya data selalu segar dan login Google tidak terganggu.
   Naikkan CACHE_VERSION setiap kali file di repo diubah agar pengguna dapat versi baru. */
const CACHE_VERSION = 'v1';
const CACHE_NAME = 'tkm-monitoring-' + CACHE_VERSION;

const APP_SHELL = [
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

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) { return cache.addAll(APP_SHELL); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys
          .filter(function (k) { return (k.indexOf('tkm-monitoring-') === 0 || k.indexOf('simonika-oses-') === 0) && k !== CACHE_NAME; })
          .map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // biarkan Apps Script/Google lewat langsung

  // Navigasi halaman: network-first, fallback ke cache saat offline
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(function (res) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(function (c) { c.put('./index.html', copy); });
          return res;
        })
        .catch(function () {
          return caches.match(req).then(function (hit) {
            return hit || caches.match('./index.html');
          });
        })
    );
    return;
  }

  // Aset statis: cache-first, perbarui di latar belakang
  event.respondWith(
    caches.match(req).then(function (hit) {
      const fetching = fetch(req).then(function (res) {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () { return hit; });
      return hit || fetching;
    })
  );
});
