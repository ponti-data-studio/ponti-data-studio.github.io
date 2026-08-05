/**
 * sw.js — Service Worker untuk PWA shell SI-NOMOR.
 * ---------------------------------------------------------------------------
 * Yang di-cache HANYA "shell" (index.html, manifest, ikon) agar aplikasi bisa
 * tampil offline dengan pesan yang jelas. Konten sesungguhnya (Google Apps
 * Script Web App di dalam <iframe>) TIDAK di-cache karena:
 *   1. Berasal dari origin berbeda (script.google.com) — respons opaque,
 *      tidak bisa diverifikasi/di-invalidate dengan aman.
 *   2. Selalu butuh data terkini (nomor surat, riwayat) — cache basi
 *      berisiko menampilkan data usang atau nomor yang sudah terpakai.
 *
 * Strategi: Cache First untuk shell, Network Only (passthrough) untuk semua
 * permintaan lintas-origin dan navigasi ke luar shell.
 * ---------------------------------------------------------------------------
 */

const CACHE_VERSION = 'sinora-shell-v2';
const SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32x32.png',
  './icons/favicon-16x16.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names.filter((n) => n !== CACHE_VERSION).map((n) => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Hanya tangani GET pada origin sendiri (shell). Semua yang lain
  // (termasuk iframe ke script.google.com) dibiarkan lewat jaringan biasa.
  if (req.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          // Simpan salinan shell baru secara diam-diam untuk kunjungan berikut
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, clone));
          }
          return res;
        })
        .catch(() => {
          // Offline & tidak ada cache -> fallback ke shell utama bila ini navigasi halaman
          if (req.mode === 'navigate') return caches.match('./index.html');
          return new Response('', { status: 504, statusText: 'Offline' });
        });
    })
  );
});
