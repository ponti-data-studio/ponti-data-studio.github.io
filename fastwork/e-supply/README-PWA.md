# PWA Wrapper — E-Supply Procurement System

Paket ini membungkus Web App Apps Script Anda (`E-Supply`) menjadi **PWA** (Progressive Web App) yang bisa di-hosting di domain/web Anda sendiri, lalu dipasang (install) ke HP/desktop seperti aplikasi native — lengkap dengan splash screen, indikator offline, dan tombol "Pasang aplikasi".

## Isi paket

```
pwa/
├── index.html          ← shell PWA (bungkus <iframe> ke Web App Apps Script)
├── manifest.json        ← metadata PWA (nama, ikon, warna tema)
├── sw.js                ← service worker (cache app shell, bukan data PR)
└── icons/
    ├── favicon-16x16.png
    ├── favicon-32x32.png
    ├── apple-touch-icon.png   (180×180, untuk iOS)
    ├── icon-192.png
    ├── icon-512.png
    └── icon-512-maskable.png  (untuk ikon adaptif Android)
```

## Langkah pemasangan

### 1. Pastikan Web App Apps Script sudah ter-deploy
Ikuti `DEPLOYMENT.md` pada paket aplikasi utama: **Deploy → New deployment → Web app**, *Execute as* **Me**, *Who has access* **Anyone with the link**. Salin **Web app URL** (harus diakhiri `/exec`).

### 2. Isi URL Web App ke `index.html`
Buka `index.html`, cari baris:
```html
<iframe
  id="app"
  src="GANTI_DENGAN_URL_WEB_APP_ANDA/exec"
  ...
```
Ganti `GANTI_DENGAN_URL_WEB_APP_ANDA/exec` dengan URL Web App Anda, contoh:
```html
src="https://script.google.com/macros/s/AKfycb..................../exec"
```

### 3. Upload seluruh folder `pwa/` ke hosting Anda
Semua file dalam folder ini (`index.html`, `manifest.json`, `sw.js`, `icons/`) harus berada di **folder yang sama** di server — jangan dipisah, karena path-nya relatif (`./`).

Hosting apa pun yang mendukung file statis bisa dipakai, misalnya:
- GitHub Pages / GitLab Pages
- Netlify / Vercel / Cloudflare Pages
- cPanel / shared hosting biasa (upload via FTP ke `public_html`)

**Wajib HTTPS.** Service worker dan prompt "Pasang aplikasi" hanya berfungsi di halaman HTTPS (atau `localhost` saat development). Semua penyedia di atas sudah HTTPS otomatis.

### 4. Uji coba
- Buka URL hosting Anda di Chrome/Edge (desktop atau Android) → tombol "Pasang aplikasi" akan muncul di kanan bawah setelah beberapa detik.
- Di iPhone/iPad (Safari), tombol otomatis tidak muncul (Safari tidak mendukung `beforeinstallprompt`) — sebagai gantinya muncul kotak petunjuk "ketuk ikon Bagikan → Tambahkan ke Layar Utama".
- Matikan koneksi internet sebentar → muncul bar oranye "Tidak ada koneksi internet" di atas.

## Catatan penting

- **Service worker hanya meng-cache shell PWA** (index.html, manifest, ikon) yang ada di domain hosting Anda — **bukan** data pengajuan PR di dalam iframe, karena itu berasal dari domain berbeda (`script.google.com`, cross-origin). Jadi data PR selalu diambil langsung dan real-time dari Google Sheets; PWA ini hanya mempercepat pemuatan "bingkai" aplikasinya.
- `doGet()` di `Code.gs` sudah diset `setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)` sehingga Web App boleh dimuat di dalam `<iframe>` dari domain lain (domain hosting PWA Anda) — jangan menghapus baris ini.
- Kalau Anda mengganti isi `index.html` / `manifest.json` / ikon di kemudian hari, naikkan `CACHE_NAME` di `sw.js` (misal dari `esupply-pwa-shell-v1` menjadi `-v2`) supaya pengguna lama otomatis mengambil versi baru, bukan versi lama dari cache.
- Ikon yang disertakan adalah lambang "ES" bergaya navy+emas mengikuti tema aplikasi. Silakan ganti file-file di folder `icons/` dengan logo perusahaan Anda sendiri (pertahankan nama file & ukurannya agar tidak perlu mengubah `manifest.json`/`index.html`).
