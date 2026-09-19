/**
 * Web to App Builder — Service Worker
 *
 * Scope: this file lives at the site root, so it controls navigation for
 * both Builder mode (/) and PWA runtime mode (/?app=slug), since both are
 * served from the same index.html on this same origin.
 *
 * What it does:
 *   - Caches this site's own static shell (HTML/CSS/JS/icons) for
 *     offline fallback and faster repeat loads.
 *
 * What it deliberately does NOT do:
 *   - It never intercepts, caches, or modifies requests to the Apps
 *     Script API (a different origin), nor anything loaded inside a
 *     customer app's <iframe> (also typically a different origin, and
 *     even if same-origin, iframed documents are outside this file's
 *     concern). The origin check below is what guarantees this.
 */

const CACHE_NAME = 'web-to-app-builder-shell-v1';

const PRECACHE_URLS = [
  './',
  './index.html',
  './config.js',
  './manifest.webmanifest',
  './assets/css/styles.css',
  './assets/js/api.js',
  './assets/js/app.js',
  './assets/js/pwa-runtime.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/favicon-32.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch((err) => console.warn('Precache failed (non-fatal):', err))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.map((name) => (name !== CACHE_NAME ? caches.delete(name) : null)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // never touch the API or any third-party origin

  event.respondWith(
    fetch(req)
      .then((res) => {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone)).catch(() => {});
        return res;
      })
      .catch(() =>
        caches.match(req).then((cached) => {
          if (cached) return cached;
          if (req.mode === 'navigate') {
            return new Response(
              '<!DOCTYPE html><html><head><meta charset="UTF-8">' +
              '<meta name="viewport" content="width=device-width, initial-scale=1"></head>' +
              '<body style="font-family:system-ui,-apple-system,sans-serif;display:flex;' +
              'flex-direction:column;align-items:center;justify-content:center;height:100vh;' +
              'margin:0;background:#F8FAFC;color:#0F172A;text-align:center;padding:24px;">' +
              '<h2 style="margin:0 0 8px;">Aplikasi sedang offline.</h2>' +
              '<p style="margin:0;color:#64748B;">Silakan periksa koneksi internet Anda.</p>' +
              '</body></html>',
              { headers: { 'Content-Type': 'text/html' } }
            );
          }
          return new Response('', { status: 504 });
        })
      )
  );
});
