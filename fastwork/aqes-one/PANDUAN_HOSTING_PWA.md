# 🌐 Panduan Hosting PWA AQES One di Web Sendiri

Paket ini membungkus AQES One (yang berjalan di Google Apps Script) menjadi **PWA (Progressive Web App)** yang di-hosting di domain Anda sendiri — bisa dipasang ke layar utama HP/desktop, punya splash screen, ikon aplikasi, dan indikator offline.

Cara kerjanya: `index.html` menampilkan aplikasi Apps Script Anda di dalam `<iframe>` layar penuh, dibungkus splash screen dan ikon bermerek AQES One.

---

## Isi Paket

```
aqes-one-pwa/
├── index.html          ← halaman pembungkus (splash, iframe, tombol install)
├── manifest.json        ← identitas PWA (nama, warna, ikon)
├── sw.js                 ← service worker (cache shell, indikator offline)
└── icons/
    ├── favicon-16x16.png
    ├── favicon-32x32.png
    ├── apple-touch-icon.png     (180×180)
    ├── icon-192.png
    ├── icon-512.png
    ├── icon-maskable-192.png
    └── icon-maskable-512.png
```

✅ Seluruh ikon **sudah dibuat otomatis** dari logo TPQLansia-KU Al-'Abdu yang Anda kirim — tidak perlu membuat ulang, tinggal unggah apa adanya.

---

## Langkah 1 — Isi URL Web App Anda

1. Buka **`index.html`** dengan text editor.
2. Cari baris ini (sekitar tengah file):
   ```html
   <iframe
     id="app"
     src="GANTI_DENGAN_URL_WEB_APP_ANDA"
   ```
3. Ganti `GANTI_DENGAN_URL_WEB_APP_ANDA` dengan URL deployment Apps Script Anda, contoh:
   ```html
   src="https://script.google.com/macros/s/AKfycbXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX/exec"
   ```
   > URL ini didapat dari editor Apps Script: **Deploy → Manage deployments → salin "Web app URL"**.
4. Simpan file.

---

## Langkah 2 — Unggah ke Hosting

Unggah **seluruh isi folder** `aqes-one-pwa/` (termasuk folder `icons/`) ke direktori web Anda, misalnya:
- Root domain: `https://domainanda.com/` (aplikasi diakses langsung dari domain)
- Atau subfolder: `https://domainanda.com/aqes/` (aplikasi diakses via `/aqes/`)

Bisa memakai **FTP/cPanel File Manager**, **Netlify**, **Vercel**, **GitHub Pages**, atau **Firebase Hosting** — semuanya kompatibel karena paket ini hanya berisi file statis (HTML/JSON/JS/PNG), tidak butuh server khusus.

> ⚠️ **Wajib HTTPS.** PWA (service worker, tombol install) hanya berfungsi di alamat `https://`. Hampir semua hosting modern (Netlify, Vercel, GitHub Pages, cPanel + Let's Encrypt) sudah menyediakan HTTPS gratis.

---

## Langkah 3 — Uji Coba

1. Buka domain Anda di **Chrome (Android/desktop)**.
2. Aplikasi AQES One akan tampil dengan splash screen logo TPQLansia-KU, lalu memuat sistem di dalamnya.
3. Tombol **"Pasang aplikasi"** akan muncul di pojok kanan bawah (Chrome/Edge di Android & desktop) — tekan untuk memasang sebagai aplikasi mandiri.
4. Di **iPhone/iPad (Safari)**: tombol install otomatis tidak tersedia (keterbatasan iOS) — gunakan cara manual:
   `Tombol Bagikan (kotak dengan panah ke atas) → Tambahkan ke Layar Utama → Tambah`

---

## Langkah 4 (Opsional) — Ganti Ikon di Kemudian Hari

Jika suatu saat ingin mengganti logo:

1. Siapkan gambar logo baru berbentuk **persegi**, minimal 512×512 piksel, latar putih/transparan.
2. Buat 7 ukuran berikut menggunakan alat seperti **[realfavicongenerator.net](https://realfavicongenerator.net)**, Photoshop, GIMP, atau Canva (export as PNG per ukuran):

   | Nama file | Ukuran | Catatan |
   |---|---|---|
   | `favicon-16x16.png` | 16×16 | ikon tab browser |
   | `favicon-32x32.png` | 32×32 | ikon tab browser |
   | `apple-touch-icon.png` | 180×180 | ikon iOS |
   | `icon-192.png` | 192×192 | ikon Android/PWA |
   | `icon-512.png` | 512×512 | ikon Android/PWA, splash |
   | `icon-maskable-192.png` | 192×192 | logo ± 72% ukuran, sisanya padding latar putih (agar tidak terpotong saat dibentuk lingkaran/bulat oleh Android) |
   | `icon-maskable-512.png` | 512×512 | sama seperti di atas, ukuran besar |

3. Timpa file-file di folder `icons/` dengan nama yang **persis sama**.
4. Buka **`sw.js`**, naikkan angka versi cache di baris paling atas agar pengguna lama mendapat ikon baru:
   ```javascript
   const CACHE_NAME = 'aqes-one-shell-v1';   // ganti jadi 'aqes-one-shell-v2', dst.
   ```
5. Unggah ulang seluruh folder `icons/`, `index.html`, dan `sw.js` yang sudah diperbarui.

---

## Troubleshooting

| Gejala | Penyebab & Solusi |
|---|---|
| Layar putih / tidak memuat apa pun | Pastikan URL di `index.html` sudah benar dan diawali `https://script.google.com/...`. |
| Muncul halaman "Meminta Izin" Google terus-menerus | Pastikan deployment Apps Script diset **"Anyone"** pada bagian "Who has access". |
| Tombol "Pasang aplikasi" tidak muncul | Hanya tersedia di Chrome/Edge (Android & desktop); situs harus HTTPS; iOS memakai cara manual (lihat Langkah 3). |
| Ikon lama masih muncul setelah diganti | Naikkan versi `CACHE_NAME` di `sw.js` (Langkah 4.4), lalu hapus & pasang ulang aplikasi di HP. |
| Aplikasi terasa "menempel" pada versi lama setelah update Apps Script | Wajar — service worker hanya meng-cache file *shell* (index.html, ikon), **bukan** konten Apps Script di dalam iframe, jadi data selalu terbaru. Jika shell itu sendiri terasa basi, naikkan `CACHE_NAME`. |

---

**Ringkasan cepat:** isi URL Web App di `index.html` → unggah folder ini apa adanya ke hosting HTTPS Anda → selesai. Ikon sudah otomatis memakai logo TPQLansia-KU Al-'Abdu.
