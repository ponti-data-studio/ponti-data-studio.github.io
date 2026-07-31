/* Service Worker — offline shell (cache-first untuk aset statis, network untuk API) */
const CACHE = 'aca-shell-v1';
const SHELL = [
  './', './index.html', './manifest.webmanifest', './css/style.css', './icons/icon.svg',
  './js/config.js', './js/utils.js', './js/api.js', './js/exportService.js',
  './js/fileParser.js', './js/ui.js', './js/auth.js', './js/dashboard.js',
  './js/projects.js', './js/consultation.js', './js/knowledge.js',
  './js/requirement.js', './js/settings.js', './js/app.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;                      // API POST → selalu network
  if (url.origin !== location.origin) {                        // CDN → network, fallback cache
    e.respondWith(fetch(e.request).then((r) => {
      const copy = r.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy));
      return r;
    }).catch(() => caches.match(e.request)));
    return;
  }
  e.respondWith(                                               // shell → cache-first
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((r) => {
      const copy = r.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy));
      return r;
    }))
  );
});
