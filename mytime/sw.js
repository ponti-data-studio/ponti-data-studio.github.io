/**
 * Mytime — Service Worker
 * Strategi:
 *  - App shell di-precache per versi (CACHE_VERSION). Versi baru → cache baru → cache lama dihapus saat activate.
 *  - Navigasi: index.html dari cache (offline-first), diperbarui di background.
 *  - Aset statis same-origin: cache-first.
 *  - config.js: network-first (agar perubahan URL backend terbaca), fallback cache.
 *  - Request ke backend GAS (cross-origin) TIDAK disentuh — data offline ditangani IndexedDB + antrean.
 *  - Update: halaman meminta SKIP_WAITING setelah pengguna menekan "Muat ulang".
 */
const CACHE_VERSION = 'ti-shell-v1.0.0';
const SHELL = [
  './',
  'index.html',
  'config.js',
  'manifest.webmanifest',
  'css/app.css',
  'fonts/pjs-400.woff2',
  'fonts/pjs-500.woff2',
  'fonts/pjs-600.woff2',
  'fonts/pjs-700.woff2',
  'icons/favicon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/maskable-512.png',
  'icons/apple-touch-icon.png',
  'vendor/sweetalert2.all.min.js',
  'vendor/chart.umd.min.js',
  'js/util.js',
  'js/icons.js',
  'js/db.js',
  'js/api.js',
  'js/repo.js',
  'js/sync.js',
  'js/calc.js',
  'js/timer.js',
  'js/ui.js',
  'js/forms.js',
  'js/auth.js',
  'js/views/home.js',
  'js/views/tasks.js',
  'js/views/track.js',
  'js/views/focus.js',
  'js/views/goals.js',
  'js/views/habits.js',
  'js/views/budget.js',
  'js/views/calendar.js',
  'js/views/analytics.js',
  'js/views/review.js',
  'js/views/journal.js',
  'js/views/settings.js',
  'js/views/more.js',
  'js/app.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(SHELL.map((p) => new Request(p, { cache: 'reload' }))))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('ti-shell-') && k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

async function shellResponse() {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match('index.html');
  const network = fetch('index.html', { cache: 'no-store' })
    .then((res) => { if (res.ok) cache.put('index.html', res.clone()); return res; })
    .catch(() => null);
  return cached || (await network) || new Response('<h1>Offline</h1><p>Buka aplikasi sekali saat online untuk mengaktifkan mode offline.</p>', { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 503 });
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;
  const res = await fetch(request);
  if (res.ok && res.type === 'basic') cache.put(request, res.clone());
  return res;
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_VERSION);
  try {
    const res = await fetch(request, { cache: 'no-store' });
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch (e) {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    throw e;
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (!isSameOrigin(url)) return; // API GAS & sumber lain: biarkan browser menangani

  if (req.mode === 'navigate') {
    event.respondWith(shellResponse());
    return;
  }
  if (url.pathname.endsWith('/config.js')) {
    event.respondWith(networkFirst(req));
    return;
  }
  event.respondWith(cacheFirst(req));
});
