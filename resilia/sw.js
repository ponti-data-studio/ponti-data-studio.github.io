/* Resilia — Service Worker (PWA mode)
 * App shell is precached → the app opens with no internet.
 * Data never goes through this cache: it lives in IndexedDB and syncs via the API.
 * Requests to other origins (the Apps Script API) are not intercepted.
 */
const VERSION = '1d8358c787';
const CACHE = 'resilia-shell-' + VERSION;
const SHELL = ["./","index.html","css/app.css","js/app.js","js/config.js","vendor/sweetalert2.all.min.js","manifest.webmanifest","icons/icon-192.png","icons/icon-512.png","icons/maskable-512.png","icons/apple-touch-icon.png","icons/favicon-64.png"];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('resilia-shell-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;           // API & CDNs: straight to network

  // App navigation → cached shell (works offline); refresh it in the background when online.
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match('index.html').then((cached) => {
        const net = fetch(req).then((res) => {
          if (res && res.ok) caches.open(CACHE).then((c) => c.put('index.html', res.clone()));
          return res;
        }).catch(() => cached);
        return cached || net;
      })
    );
    return;
  }
  // Static assets → cache first, then network (and cache it).
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => cached || fetch(req).then((res) => {
      if (res && res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }))
  );
});
