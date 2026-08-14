/* =========================================================
   service-worker.js — offline-first cache with versioning
   Bump CACHE_VERSION whenever app files change to safely
   invalidate old caches and avoid stale-version bugs.
   ========================================================= */
const CACHE_VERSION = "ponti-prompt-studio-v1";
const RUNTIME_CACHE = "ponti-prompt-studio-runtime-v1";

const APP_SHELL = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/app.js",
  "./js/generator.js",
  "./js/history.js",
  "./js/storage.js",
  "./js/templates.js",
  "./js/ui.js",
  "./js/pwa.js",
  "./manifest.json",
  "./assets/icons/icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch((err) => console.warn("SW install: sebagian aset gagal di-cache.", err))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name !== CACHE_VERSION && name !== RUNTIME_CACHE)
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Strategy:
// - App shell (same-origin, navigation/css/js): cache-first, fallback to network, then update cache.
// - Everything else (e.g. CDN libraries): network-first with cache fallback, so the app
//   still works offline once a resource has been fetched once.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  const isSameOrigin = url.origin === self.location.origin;

  if (isSameOrigin) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req)
          .then((res) => {
            const resClone = res.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, resClone));
            return res;
          })
          .catch(() => caches.match("./index.html"));
      })
    );
  } else {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const resClone = res.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(req, resClone));
          return res;
        })
        .catch(() => caches.match(req))
    );
  }
});
