# PWA Shell — ERP Freight Forwarding & Logistics

Folder ini berisi "pembungkus" PWA (Progressive Web App) yang membuat Web App Apps Script
Anda bisa **dipasang** ke HP/desktop layaknya aplikasi asli — ikon di layar utama, splash
screen, mode layar penuh, dan pop-up ajakan pasang otomatis.

## Isi Folder

```
index.html        <- Halaman utama PWA, memuat aplikasi ERP di dalam iframe
manifest.json      <- Metadata PWA (nama, ikon, warna tema)
sw.js              <- Service worker (cache shell + deteksi offline)
icons/             <- Semua ukuran ikon aplikasi (dibuat otomatis, tema navy #1B2430 + "EF")
  favicon-16x16.png
  favicon-32x32.png
  apple-touch-icon.png   (180x180, untuk iOS)
  icon-192.png
  icon-512.png
  icon-192-maskable.png  (untuk Android adaptive icon)
  icon-512-maskable.png
```

## Cara Pakai — HANYA 1 LANGKAH

Buka `index.html`, cari baris ini di bagian `<script>` paling bawah:

```js
var APP_URL = 'REPLACE_WITH_YOUR_APPS_SCRIPT_EXEC_URL';
```

Ganti dengan URL Web App Apps Script ERP Anda (dari **Deploy → Manage deployments**, diakhiri
`/exec`), contoh:

```js
var APP_URL = 'https://script.google.com/macros/s/AKfycbxxxxxxxxxxxxxxxxxxxxxxxx/exec';
```

Simpan. Selesai — tidak ada langkah lain yang perlu diubah.

## Cara Meng-hosting Folder Ini

Folder ini adalah situs statis biasa (HTML/CSS/JS + gambar) — tidak butuh server backend
sendiri, karena semua logika bisnis tetap berjalan di Apps Script (folder `erp-freight-forwarding`
yang terpisah). Pilih salah satu cara hosting gratis berikut:

- **GitHub Pages**: push folder ini ke sebuah repo GitHub, aktifkan Pages di Settings repo
- **Netlify / Vercel**: drag-and-drop folder ini ke dashboard mereka
- **Firebase Hosting**: `firebase deploy` setelah `firebase init hosting`

Setelah online, buka link-nya lewat HP → akan muncul pop-up "Pasang ERP Logistics?" (Android)
atau instruksi "Tambahkan ke Layar Utama" (iOS Safari).

## Kenapa Bisa Ditampilkan di dalam iframe?

Web App Apps Script pada dasarnya sering diblokir untuk ditampilkan di iframe demi keamanan.
`Code.gs` pada aplikasi ERP ini **sudah diset** agar mengizinkan ini secara eksplisit:

```js
return template.evaluate()
  ...
  .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
```

Jadi tidak perlu mengubah apa pun di sisi Apps Script — PWA shell ini memang sudah didesain
kompatibel dengan aplikasi ERP yang sudah Anda deploy.

## Batasan yang Perlu Diketahui

- **Tidak ada mode offline untuk data ERP-nya sendiri.** Service worker (`sw.js`) hanya
  meng-cache file-file shell ini (splash screen, ikon, dll), bukan data dari Google Sheets —
  karena isi sebenarnya dimuat lewat iframe cross-origin ke Apps Script, dan aplikasi ERP
  memang selalu butuh koneksi live ke Google Sheets.
- **Pop-up ajakan pasang muncul setiap kali halaman dibuka ulang** (bukan cuma sekali) — ini
  sesuai desain aslinya, sengaja tidak menyimpan status "sudah ditutup". Kalau ingin diubah
  jadi hanya muncul sekali (misalnya pakai `localStorage`), beri tahu saya.
- Ikon yang dibuat adalah placeholder sederhana (huruf "EF" di atas warna navy). Silakan ganti
  file-file di folder `icons/` dengan logo perusahaan Anda sendiri kapan saja — ukuran dan nama
  file harus tetap sama persis agar `manifest.json` dan `index.html` tidak perlu diubah.
