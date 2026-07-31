# SIMAJI — Paket PWA (Progressive Web App)

Paket ini adalah **shell/pembungkus** agar Web App SIMAJI (yang berjalan di Google Apps Script)
bisa **di-install** ke HP dan desktop layaknya aplikasi native, lengkap dengan splash screen,
indikator offline, dan tombol "Pasang aplikasi". Konten sebenarnya (dashboard, form, laporan)
tetap dimuat lewat `<iframe>` dari URL deployment Apps Script Anda — file di sini **tidak**
menggantikan `simaji-gas.zip`, hanya membungkusnya agar bisa di-hosting sebagai web biasa
(Netlify, Vercel, GitHub Pages, cPanel, dst.) dan diinstal.

## Isi Paket

```
index.html        shell PWA (splash, offline bar, tombol install, iframe ke Apps Script)
manifest.json      metadata PWA (nama, warna, ikon) agar bisa "Add to Home Screen"
sw.js              service worker minimal — hanya cache file shell, BUKAN data aplikasi
icons/
  icon-192.png            ikon standar 192×192
  icon-512.png             ikon standar 512×512
  icon-maskable-192.png    ikon adaptif Android (aman dipotong bulat/persegi)
  icon-maskable-512.png
  apple-touch-icon.png     ikon Add to Home Screen di iOS (180×180)
  favicon-32x32.png
  favicon-16x16.png
```

## Langkah Pemasangan

1. **Deploy dulu SIMAJI di Apps Script** (lihat `DEPLOYMENT.md` pada paket `simaji-gas.zip`) sampai Anda punya URL Web App, formatnya:
   `https://script.google.com/macros/s/AKfycbxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx/exec`

2. Buka `index.html`, cari baris:
   ```html
   src="https://script.google.com/macros/s/GANTI_DENGAN_DEPLOYMENT_ID_ANDA/exec"
   ```
   Ganti dengan URL Web App Anda dari langkah 1.

3. Upload seluruh isi folder ini (`index.html`, `manifest.json`, `sw.js`, folder `icons/`) ke hosting statis pilihan Anda, misalnya:
   - **GitHub Pages** — push ke repo, aktifkan Pages.
   - **Netlify / Vercel** — drag-and-drop folder ini.
   - **cPanel / shared hosting** — upload lewat File Manager/FTP ke `public_html`.

   Pastikan **semua file berada di folder yang sama** (jangan dipisah), karena path ikon dan `sw.js` memakai path relatif (`./icons/...`, `./sw.js`).

4. **Wajib HTTPS.** Service worker dan prompt "Pasang aplikasi" hanya aktif di koneksi HTTPS (atau `localhost` saat development). Semua hosting di atas sudah HTTPS otomatis.

5. Buka domain hosting Anda dari browser:
   - **Android/Chrome/Edge (desktop)**: tombol "Pasang aplikasi" muncul otomatis di kanan bawah, atau lewat menu browser → "Install app" / "Pasang".
   - **iOS/Safari**: tombol `beforeinstallprompt` tidak didukung Apple — pengguna memasang manual lewat tombol Share (kotak dengan panah ke atas) → **"Add to Home Screen"**.

## Kenapa Data Tidak Ikut Di-cache Service Worker?

`sw.js` sengaja **hanya** meng-cache file shell (HTML/manifest/ikon), bukan isi dari `script.google.com`
di dalam iframe. Ini karena:
- Apps Script sudah mengurus sesi login (token) dan keamanannya sendiri — meng-cache respons dari
  domain tersebut lewat service worker pihak luar berisiko menyimpan data sensitif/kedaluwarsa di
  luar kendali aplikasi.
- SIMAJI sendiri **sudah punya mode offline-first** (lihat fitur di dalam aplikasi) yang menyimpan
  data ke `localStorage` browser dan mengantre perubahan sampai koneksi kembali — jadi tidak perlu
  didobel oleh service worker shell ini.

## Kustomisasi

- **Ganti ikon**: timpa file di `icons/` dengan ukuran yang sama (PNG, latar transparan untuk ikon
  standar; latar penuh/tanpa transparansi untuk `icon-maskable-*`).
- **Ganti warna tema**: ubah `theme_color`/`background_color` di `manifest.json` dan variabel warna
  di `<style>` bagian `#splash`, `#offlineBar`, `#installBtn` pada `index.html`.
- **Ganti nama aplikasi**: ubah `name`/`short_name` di `manifest.json` serta tag `<title>` dan
  meta `apple-mobile-web-app-title` di `index.html`.

## Troubleshooting

| Gejala | Penyebab | Solusi |
|---|---|---|
| Tombol "Pasang aplikasi" tidak muncul | Belum HTTPS, atau browser tidak mendukung (Safari desktop/iOS) | Pastikan hosting HTTPS; di iOS gunakan Share → Add to Home Screen. |
| Layar putih/kosong setelah splash hilang | URL Apps Script salah, belum di-deploy, atau akses "Who has access" tidak sesuai | Cek ulang URL `/exec`, dan pastikan deployment aktif. |
| Ikon tidak muncul saat install | Path ikon tidak ditemukan | Pastikan folder `icons/` diupload persis strukturnya, jangan diganti nama. |
| Service worker gagal terdaftar | Hosting bukan HTTPS, atau `sw.js` tidak berada di root yang sama dengan `index.html` | Pindahkan `sw.js` ke folder yang sama dengan `index.html`. |
