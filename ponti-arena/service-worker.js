/**
 * PONTI ARENA - Service Worker
 * Caches the full app shell on install so the game plays completely offline
 * after the first successful load. Never lets a caching failure crash
 * install; individual asset failures are swallowed so an optional missing
 * character photo can never block the whole cache.
 */

const CACHE_VERSION = 'ponti-arena-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './css/menu.css',
  './css/character.css',
  './css/battle.css',
  './css/responsive.css',
  './js/config.js',
  './js/characters.js',
  './js/balance.js',
  './js/status-effects.js',
  './js/combat.js',
  './js/targeting.js',
  './js/ai-scoring.js',
  './js/character-mechanics.js',
  './js/skills.js',
  './js/turn-manager.js',
  './js/ai.js',
  './js/storage.js',
  './js/audio.js',
  './js/assets.js',
  './js/battle.js',
  './js/ui.js',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/icon-apple-touch.png',
  './icons/favicon.png',
  './assets/audio/menu-theme.mp3',
  './assets/audio/battle-theme.mp3',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(async (cache) => {
      // Cache each file individually so one missing/failed asset never aborts install.
      await Promise.all(APP_SHELL.map(async (url) => {
        try {
          await cache.add(url);
        } catch (err) {
          console.warn('[SW] Failed to precache (non-fatal):', url, err);
        }
      }));
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request).then((response) => {
        try {
          if (response && response.status === 200 && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone)).catch(() => {});
          }
        } catch (err) { /* ignore cache write failures, never break navigation */ }
        return response;
      }).catch(() => cached); // offline: fall back to cache (or undefined if never cached)

      // Cache-first for instant offline play; refresh cache in background.
      return cached || networkFetch;
    }).catch(() => caches.match('./index.html'))
  );
});
