# SIMONIKA-OSES — PWA Wrapper

Folder ini adalah **pembungkus PWA (Progressive Web App)** yang membuat SIMONIKA-OSES
bisa "dipasang" di HP/laptop (ikon di layar utama, tampilan layar penuh, terasa
seperti aplikasi asli) — dengan cara meng-*iframe* URL Web App SIMONIKA-OSES yang
sudah Anda deploy dari Apps Script.

**Ini bukan bagian dari project Apps Script** (`SIMONIKA-OSES.zip`) — folder ini
di-*hosting* terpisah sebagai situs statis (GitHub Pages, Firebase Hosting, Netlify,
Cloudflare Pages, dll — semuanya gratis untuk kebutuhan seperti ini).

## Prasyarat

SIMONIKA-OSES **harus sudah di-deploy sebagai Web App** (bukan cuma mode Extension
Sheets), karena wrapper ini butuh 1 URL yang bisa dibuka di `<iframe>`. Lihat bagian
"Deploy sebagai Web App" pada `README_DEPLOYMENT.md` di paket kode utama.

## Isi Folder

```
SIMONIKA-OSES-PWA/
├── index.html      ← halaman pembungkus (splash, offline bar, popup pasang aplikasi)
├── manifest.json   ← metadata PWA (nama, warna, ikon)
├── sw.js           ← service worker (cache shell lokal untuk kesan "instan" & offline-aware)
└── icons/
    ├── favicon-16x16.png
    ├── favicon-32x32.png
    ├── icon-192.png
    ├── icon-512.png
    ├── icon-512-maskable.png   ← untuk ikon adaptif Android
    └── apple-touch-icon.png
```

## Cara Pakai

1. Buka `index.html`, cari baris:
   ```js
   var APP_URL = 'REPLACE_WITH_YOUR_WEB_APP_URL';
   ```
   Ganti dengan URL Web App SIMONIKA-OSES Anda, contoh:
   ```js
   var APP_URL = 'https://script.google.com/macros/s/AKfycbxxxxxxxx/exec';
   ```
2. Upload seluruh isi folder ini (index.html, manifest.json, sw.js, icons/) ke
   layanan hosting statis pilihan Anda, dengan struktur folder tetap sama persis.
3. Buka URL hosting tsb dari HP:
   - **Android/Chrome**: akan muncul popup "Pasang SIMONIKA-OSES?" secara otomatis.
   - **iPhone/Safari**: akan muncul popup berisi instruksi "Tambahkan ke Layar Utama".
4. Setelah dipasang, ikon SIMONIKA-OSES akan muncul di layar utama seperti aplikasi
   biasa, terbuka tanpa address bar browser.

## Catatan Penting

- Popup ajakan pasang aplikasi **sengaja muncul setiap kali halaman dibuka ulang**
  (selama belum terpasang sebagai aplikasi standalone) — bukan tombol permanen,
  supaya tidak mengganggu tampilan.
- Service worker (`sw.js`) hanya meng-cache berkas pembungkus (shell) di atas —
  **bukan** data/tampilan SIMONIKA-OSES sendiri (yang berjalan di dalam iframe lintas
  domain `script.google.com`). Jadi wrapper tetap bisa terbuka saat offline
  (menampilkan splash + pesan "Tidak ada koneksi internet"), tapi data aplikasi
  tetap butuh koneksi internet seperti biasa — ini bukan aplikasi offline penuh.
- Ganti mark ikon "SO" atau warnanya di `icons/` kapan saja dengan logo resmi
  perusahaan bila tersedia — file-file ini hanya placeholder awal.
