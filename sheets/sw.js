/**
 * sw.js — Service Worker Ponti Sheets
 * Strategi: Cache First untuk aset statis (app shell), Network First
 * untuk panggilan API Google/AI (karena data harus selalu up-to-date).
 */

const CACHE_NAME = "ponti-sheets-v1.14.0";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./assets/css/theme.css",
  "./assets/css/layout.css",
  "./assets/css/components.css",
  "./assets/css/pages.css",
  "./assets/js/app.js",
  "./assets/icons/icon.svg",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon-maskable-512.png",
  "./assets/icons/icon-apple-touch-180.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

function isApiCall(url) {
  return url.includes("googleapis.com") || url.includes("openai.com") ||
         url.includes("generativelanguage") || url.includes("dashscope");
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = request.url;

  if (isApiCall(url)) {
    // Network First: API selalu butuh data terbaru, cache hanya untuk fallback offline.
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
    return;
  }

  // Network First untuk app shell juga: selalu utamakan versi terbaru saat online,
  // cache hanya dipakai sebagai fallback ketika benar-benar offline. Ini mencegah
  // pengguna "terjebak" versi lama setelah update, walau CACHE_NAME lupa di-bump.
  event.respondWith(
    fetch(request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match("./index.html")))
  );
});

// Background Sync placeholder — untuk versi mendatang (sinkronisasi history saat online kembali)
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-history") {
    // Diimplementasikan saat Cloud Sync (v2) tersedia
  }
});
