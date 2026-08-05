# SINORA — PWA Wrapper

Folder ini membungkus Web App SINORA (Google Apps Script) sebagai aplikasi
yang bisa **dipasang** di HP maupun desktop (Add to Home Screen / Install App),
lengkap dengan splash screen, indikator offline, dan popup ajakan pasang.

## Isi

```
pwa/
├── index.html      → shell PWA (iframe ke Web App Anda)
├── manifest.json    → metadata aplikasi (nama, ikon, warna tema)
├── sw.js             → service worker (cache shell, bukan konten Sheets)
└── icons/
    ├── favicon-16x16.png
    ├── favicon-32x32.png
    ├── apple-touch-icon.png     (180×180, untuk iOS)
    ├── icon-192.png / icon-512.png            (ikon standar)
    └── icon-192-maskable.png / icon-512-maskable.png  (ikon adaptif Android)
```

## Langkah Pemasangan

1. **Wajib diganti** di `index.html`, cari komentar `PENTING — SEBELUM DI-HOST`
   dan ganti URL iframe `src` dengan URL deployment Web App Anda sendiri
   (Apps Script editor → **Deploy → Manage deployments** → salin *Web app URL*,
   harus berakhiran `/exec`, bukan `/dev`).
2. Unggah seluruh isi folder `pwa/` ke hosting statis mana pun yang mendukung
   **HTTPS** (wajib untuk service worker & install prompt) — misalnya GitHub
   Pages, Firebase Hosting, Netlify, Vercel, atau Google Sites/Cloud Storage
   dengan HTTPS aktif.
3. Buka URL hosting tersebut di Chrome (Android/desktop) atau Safari (iOS):
   - **Android/Chrome/Edge**: popup "Pasang SINORA?" akan muncul otomatis
     (atau lewat menu ⋮ → *Install app*).
   - **iOS Safari**: popup akan menampilkan instruksi manual — ketuk ikon
     **Bagikan** → **Tambahkan ke Layar Utama** (iOS tidak mengizinkan
     instalasi otomatis dari browser).
4. Setelah terpasang, aplikasi berjalan **standalone** (tanpa address bar)
   dan ikon muncul di layar utama/menu Start seperti aplikasi native.

## Catatan Teknis

- **Konten Google Sheets tidak pernah di-cache.** `sw.js` hanya menyimpan
  shell (index.html, manifest, ikon) agar aplikasi tetap tampil saat offline
  dengan pesan yang jelas — data surat & nomor selalu diambil langsung dari
  Apps Script agar tidak pernah menampilkan data usang atau nomor basi.
- Popup pasang tidak akan muncul lagi selama 3 hari setelah ditutup
  ("Nanti saja"), dan tidak pernah muncul lagi setelah aplikasi benar-benar
  terpasang (`display-mode: standalone`).
- Jika ingin mengganti warna/ikon, edit `manifest.json` (`theme_color`,
  `background_color`) dan file di `icons/`, lalu naikkan `CACHE_VERSION` di
  `sw.js` supaya pengguna lama mendapat versi terbaru.
