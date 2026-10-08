/* Idea Matrix — Service Worker
 *
 * Yang di-cache: "cangkang" PWA (index.html, manifest, ikon) agar aplikasi bisa dibuka
 * dan menampilkan layar splash/penanda offline walau tanpa internet.
 *
 * Yang TIDAK disentuh: seluruh permintaan lintas-origin (script.google.com, googleusercontent,
 * Google Drive, CDN). Aplikasi Apps Script berjalan di dalam iframe lintas-origin, jadi isinya
 * dimuat langsung oleh browser; service worker tidak dapat menyimpannya. Penyimpanan data
 * offline ditangani oleh aplikasi itu sendiri (localStorage di dalam iframe).
 *
 * Setiap mengubah berkas cangkang, naikkan VERSION agar cache lama diganti.
 */
const VERSION = 'v1.0.0';
const CACHE = 'idea-matrix-shell-' + VERSION;
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32x32.png',
  './icons/favicon-16x16.png'
];
const NAV_TIMEOUT_MS = 4000;     // tunggu jaringan maksimal 4 dtk sebelum memakai salinan cache

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      // add satu-satu: satu berkas gagal tidak menggagalkan seluruh instalasi
      return Promise.all(SHELL.map(function (url) {
        return cache.add(new Request(url, { cache: 'reload' })).catch(function (err) {
          console.warn('[SW] gagal cache', url, err);
        });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys
        .filter(function (k) { return k.indexOf('idea-matrix-shell-') === 0 && k !== CACHE; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('message', function (event) {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

function withTimeout(promise, ms) {
  return new Promise(function (resolve, reject) {
    const t = setTimeout(function () { reject(new Error('timeout')); }, ms);
    promise.then(function (v) { clearTimeout(t); resolve(v); }, function (e) { clearTimeout(t); reject(e); });
  });
}

self.addEventListener('fetch', function (event) {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;       // lintas-origin: biarkan browser

  // Navigasi halaman: jaringan dulu (selalu dapat versi terbaru), cache sebagai cadangan offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      withTimeout(fetch(req), NAV_TIMEOUT_MS).then(function (res) {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put('./index.html', copy); });
        }
        return res;
      }).catch(function () {
        return caches.match('./index.html').then(function (hit) {
          return hit || caches.match('./');
        });
      })
    );
    return;
  }

  // Aset statis (ikon, manifest): cache dulu, perbarui di latar belakang.
  event.respondWith(
    caches.match(req).then(function (hit) {
      const fresh = fetch(req).then(function (res) {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () { return hit; });
      return hit || fresh;
    })
  );
});
