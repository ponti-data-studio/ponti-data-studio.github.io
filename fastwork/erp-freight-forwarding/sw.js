/**
 * sw.js — Service worker for the ERP Freight Forwarding PWA shell.
 *
 * IMPORTANT SCOPE NOTE: this service worker only caches the STATIC SHELL files that live on
 * this same origin (index.html, manifest.json, icons). It deliberately never intercepts or
 * caches the actual application content, which loads inside an <iframe> pointing at the
 * Google Apps Script Web App URL (a different origin). Cross-origin iframe content can't be
 * meaningfully cached from here anyway (opaque responses), and the ERP app itself already
 * requires a live connection to Google Sheets — there is no offline mode for the ERP data
 * itself, only for this installable shell (splash screen, install prompt, offline notice).
 */

const CACHE_NAME = 'erp-freight-shell-v1';

const SHELL_FILES = [
  './',
  './index.html',
  './manifest.json',
  './icons/favicon-16x16.png',
  './icons/favicon-32x32.png',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-192-maskable.png',
  './icons/icon-512-maskable.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_FILES))
      .catch((err) => console.warn('SW: gagal meng-cache sebagian shell file', err))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only ever handle same-origin GET requests for the shell. Everything else (the Apps Script
  // iframe, any POST/PUT, any other origin) is left completely untouched and goes straight to
  // the network exactly as if this service worker didn't exist.
  let url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      const networkFetch = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const resClone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          }
          return res;
        })
        .catch(() => cached); // offline and not cached -> let it fail naturally
      // Stale-while-revalidate: serve the cached shell instantly if we have it, but still
      // refresh the cache in the background so the next load picks up any shell update.
      return cached || networkFetch;
    })
  );
});
