# Ponti Prompt Studio

**Commercial AI Image Prompt Generator**
_Build Better Prompts. Create Better Visuals._

Made by **Ponti Data ID**

## Tentang Aplikasi

Ponti Prompt Studio adalah aplikasi web 100% frontend untuk membuat prompt AI image generation dalam format JSON terstruktur, tanpa perlu menulis JSON secara manual. Cukup isi form (brand, headline, gaya visual, warna, komposisi, dll), dan JSON prompt akan dibuat secara otomatis dan siap untuk di-copy/paste ke tool AI image generation favorit Anda.

Aplikasi berjalan **100% offline** setelah pertama kali dibuka (PWA, installable), dan **tidak pernah mengirim data apa pun ke server**. Semua data (history, template, project, pengaturan) tersimpan di perangkat Anda melalui `localStorage` dan `IndexedDB` (untuk preview gambar).

## Teknologi

- HTML5, CSS3, Vanilla JavaScript (tanpa framework)
- Bootstrap 5 (UI utility, dimuat via CDN dengan fallback tampilan dasar jika offline saat pertama kali dibuka)
- SweetAlert2 (notifikasi, dengan fallback native jika CDN tidak tersedia)
- LocalStorage + IndexedDB untuk penyimpanan lokal
- Service Worker untuk PWA / mode offline

Tidak menggunakan backend, database server, API eksternal, Google Apps Script, Firebase, atau framework JS (React/Vue/Angular).

## Struktur Proyek

```
ponti-prompt-studio/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── app.js          # bootstrap & event wiring
│   ├── generator.js     # form → JSON engine
│   ├── history.js       # riwayat prompt
│   ├── storage.js       # localStorage + IndexedDB wrapper
│   ├── templates.js     # template bawaan & kustom
│   ├── ui.js            # toast, tema, routing, syntax highlight
│   └── pwa.js           # registrasi service worker
├── assets/
│   └── icons/
├── manifest.json
├── service-worker.js
└── README.md
```

## Cara Menjalankan

Karena menggunakan Service Worker, aplikasi perlu diakses melalui HTTP(S), bukan `file://`.

**Opsi 1 — Python:**
```bash
cd ponti-prompt-studio
python3 -m http.server 8080
```
Lalu buka `http://localhost:8080`.

**Opsi 2 — Node (serve):**
```bash
npx serve ponti-prompt-studio
```

**Opsi 3 — Hosting statis apa pun** (Netlify, Vercel, GitHub Pages, cPanel, dsb) — cukup upload seluruh folder.

## Fitur Utama

1. **Dashboard** — ringkasan aktivitas, statistik prompt/template/project/history.
2. **Prompt Generator** — form konfigurasi lengkap (branding, product visual layout, upload gambar lokal, information layout, visual style, typography, composition rules, negative prompt, model parameters) dengan live JSON preview, syntax highlighting, nomor baris, copy, download, fullscreen.
3. **Templates** — 10 template bawaan (Commercial Banner, Product Advertisement, Landing Page Hero, Social Media Advertisement, E-Commerce Product, Corporate Banner, Luxury Product, Tech Product, App Promotion, YouTube Thumbnail) + template kustom (save/edit/duplicate/delete).
4. **Projects** — kelompokkan beberapa prompt ke dalam satu project/campaign.
5. **History** — maksimal 50 riwayat prompt tersimpan otomatis, dengan aksi view/copy/edit/delete dan clear all.
6. **Settings** — tema (light/dark/system), accent color, auto-generate, save-history, default template, export/import seluruh data, serta hapus data lokal.
7. **PWA** — installable, offline-first dengan strategi cache versioning agar update aplikasi tidak menyebabkan bug dari cache lama.

## Privasi

🔒 **Your data stays on this device.** Ponti Prompt Studio tidak memiliki backend dan tidak pernah mengirimkan data form, gambar, atau hasil prompt ke server manapun.

## Lisensi & Branding

Aplikasi ini dibuat khusus dengan branding **Ponti Data ID** dan tidak menggunakan branding pihak lain.
