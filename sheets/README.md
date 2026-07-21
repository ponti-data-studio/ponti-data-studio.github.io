# 📊 Ponti Sheets

**"Transform Your Spreadsheet into an AI-Ready Database."**

Ponti Sheets adalah **AI Development Workspace** yang membaca struktur Google Sheets Anda, memahaminya secara mendalam (tipe kolom, primary key, foreign key, formula, aturan bisnis), lalu mengubahnya menjadi **konteks siap-AI** sehingga AI (ChatGPT/OpenAI, Gemini, Qwen, atau Claude) bisa membangunkan Anda aplikasi yang **benar-benar sesuai dengan struktur data Anda** — bukan tebakan generik.

> Ponti Sheets bukan sekadar "spreadsheet analyzer". Ponti Sheets adalah **jembatan antara Google Sheets dan AI**.

---

## 📚 Daftar Isi

1. [Apa itu Ponti Sheets?](#1-apa-itu-ponti-sheets)
2. [Istilah Penting: Apa itu Primary Key (PK) dan Foreign Key (FK)?](#11-istilah-penting-apa-itu-primary-key-pk-dan-foreign-key-fk)
3. [Istilah Penting: Apa itu Named Range?](#12-istilah-penting-apa-itu-named-range)
4. [Visi Produk](#2-visi-produk)
5. [Manfaat](#3-manfaat)
6. [Fitur Utama](#4-fitur-utama)
7. [Cara Instalasi](#5-cara-instalasi)
8. [Cara Menjalankan Project](#6-cara-menjalankan-project)
9. [Struktur Folder](#7-struktur-folder)
10. [Cara Login Google](#8-cara-login-google)
11. [Cara Menggunakan Database Builder (Generate Database dengan AI)](#85-cara-menggunakan-database-builder-generate-database-dengan-ai)
12. [Cara Memilih Spreadsheet](#9-cara-memilih-spreadsheet)
13. [Cara Melakukan Analisis](#10-cara-melakukan-analisis)
14. [Cara Membaca Database Context](#11-cara-membaca-database-context)
15. [Cara Menggunakan Schema Editor (Edit Struktur)](#112-cara-menggunakan-schema-editor-edit-struktur-database-yang-sudah-ada)
16. [Cara Membaca Hasil Analisis](#12-cara-membaca-hasil-analisis)
17. [Cara Menggunakan Prompt Builder](#13-cara-menggunakan-prompt-builder)
18. [Cara Menggunakan AI Studio](#14-cara-menggunakan-ai-studio)
19. [Cara Export](#15-cara-export)
20. [Cara Build menjadi PWA](#16-cara-build-menjadi-pwa)
21. [Cara Build menjadi Android APK](#17-cara-build-menjadi-android-apk)
22. [Cara Build menjadi Windows EXE](#18-cara-build-menjadi-windows-exe)
23. [FAQ](#19-faq)
24. [Troubleshooting](#20-troubleshooting)
25. [Roadmap](#21-roadmap)
26. [Changelog](#22-changelog)
27. [License](#23-license)

---

## 1. Apa itu Ponti Sheets?

Bayangkan Anda punya Google Sheets berisi data toko, pelanggan, atau stok barang. Anda ingin AI membuatkan aplikasi dari data itu — tapi AI biasanya "menebak" struktur datanya, sehingga hasilnya sering meleset (nama kolom salah, tipe data salah, relasi antar sheet tidak dikenali).

**Ponti Sheets menyelesaikan masalah itu.** Aplikasi ini:

1. Membaca struktur Google Sheets Anda secara menyeluruh (kolom, tipe data, formula, relasi).
2. Membangun sebuah "peta data" bernama **`database_context.json`**.
3. Menyusun **prompt AI** otomatis dari peta data tersebut.
4. Mengirim prompt itu ke AI pilihan Anda (OpenAI, Gemini, Qwen, atau Claude) untuk menghasilkan aplikasi nyata.

Semua ini dilakukan **100% di browser Anda** (Versi 1 / Personal Mode) — tidak ada server database pihak ketiga yang menyimpan data Anda.

> 💡 Belum punya spreadsheet sama sekali? Fitur **✨ Database Builder** bisa membuatkan struktur database lengkap dari nol hanya dengan Anda menjelaskan kebutuhannya — lihat [Cara Menggunakan Database Builder](#85-cara-menggunakan-database-builder-generate-database-dengan-ai).

---

## 1.1 Istilah Penting: Apa itu Primary Key (PK) dan Foreign Key (FK)?

Kalau Anda baru pertama kali dengar istilah ini, tenang — konsepnya sebenarnya sederhana. Anda akan sering melihat badge **PK** dan **FK** di menu Analysis, Database Context, ERD, Database Builder, dan Schema Editor.

### Primary Key (PK) — "Nomor Identitas" Setiap Baris

**Primary Key** adalah kolom yang isinya **unik** untuk setiap baris — tidak boleh ada dua baris dengan nilai yang sama, dan tidak boleh kosong. Fungsinya seperti **NIK di KTP**: setiap orang punya NIK yang berbeda, dan NIK itu dipakai untuk mengidentifikasi orang tersebut secara pasti, tidak tertukar dengan orang lain.

Contoh: di sheet **Produk**, kolom `id_produk` (isinya PRD001, PRD002, PRD003, dst) adalah Primary Key — setiap produk punya `id_produk` yang berbeda-beda.

### Foreign Key (FK) — "Penghubung" ke Tabel Lain

**Foreign Key** adalah kolom di satu sheet yang **merujuk/menunjuk** ke Primary Key di sheet lain — fungsinya menghubungkan data antar sheet. Ibaratnya seperti **nomor rekening di slip transfer bank**: slip transfer bukan menyimpan semua data si penerima, tapi cukup menyimpan nomor rekeningnya — dari nomor itu, sistem bisa tahu persis rekening siapa yang dimaksud.

Contoh: di sheet **Penjualan**, kolom `id_produk` (isinya PRD001, PRD002, dst — sama seperti di sheet Produk) adalah Foreign Key. Kolom ini menghubungkan setiap transaksi penjualan ke produk yang sebenarnya di sheet **Produk**, tanpa perlu menyalin ulang nama produk, harga, dll di setiap baris penjualan.

### Kenapa ini penting?

Dengan PK & FK yang jelas, data antar sheet jadi **konsisten dan tidak berantakan** — kalau harga produk berubah, cukup diubah sekali di sheet Produk, semua transaksi yang merujuk ke situ otomatis "ikut" tanpa perlu diedit satu-satu. Ini juga yang memungkinkan Ponti Sheets menggambar diagram ERD, membuat dropdown Foreign Key otomatis di Schema Editor, dan menyusun prompt AI yang memahami struktur database Anda dengan benar.

> Anda tidak perlu menghafal ini untuk memakai Ponti Sheets — cukup pahami bahwa **PK = kolom ID unik**, dan **FK = kolom yang "menunjuk" ke PK di sheet lain**.

---

## 1.2 Istilah Penting: Apa itu Named Range?

**Named Range** adalah cara memberi **nama panggilan** untuk sekelompok sel di Google Sheets, supaya lebih gampang dirujuk daripada mengetik alamat sel mentah seperti `Produk!A2:A100`.

### Analoginya: seperti menyimpan kontak di HP

Bayangkan Anda bisa menelepon seseorang dengan mengetik nomornya langsung (`081234567890`), atau dengan menyimpannya sebagai kontak lalu tinggal pilih nama "Budi". Named Range itu seperti **menyimpan kontak** — daripada tulis rumus yang merujuk range sel mentah (`Produk!A2:A100`), Anda cukup beri nama, misalnya `DaftarProduk`, dan pakai nama itu di mana saja.

### Kenapa ini berguna?

- **Dropdown/data validation jadi lebih rapi.** Alih-alih dropdown-nya merujuk ke `Produk!A2:A100`, Anda (atau Ponti Sheets) bisa membuatnya merujuk ke `DaftarProduk` — lebih mudah dibaca, dan kalau data produknya pindah baris, named range otomatis "ikut" tanpa perlu mengedit ulang dropdown-nya.
- **Formula jadi lebih gampang dibaca.** Rumus seperti `=VLOOKUP(A2, DaftarProduk, 2, FALSE)` jauh lebih mudah dipahami daripada `=VLOOKUP(A2, Produk!A2:D100, 2, FALSE)`.
- **Tidak gampang rusak kalau struktur berubah.** Kalau Anda menambah baris atau kolom baru, cukup perbarui satu named range-nya saja — semua formula/dropdown yang memakai nama itu otomatis ikut ter-update, tidak perlu dicari & diedit satu-satu.

### Contoh nyata di Ponti Sheets

Kalau sheet **Produk** punya kolom `id_produk` (Primary Key) di kolom A, Ponti Sheets bisa membuatkan named range `DaftarProduk` yang merujuk ke `Produk!A2:A100`. Named range ini lalu dipakai sebagai sumber dropdown Foreign Key di sheet lain (mis. di sheet Penjualan, kolom `id_produk` dropdown-nya menampilkan pilihan dari `DaftarProduk`).

### Cara mengaturnya di Ponti Sheets

Buka menu **Schema Editor**, scroll ke bagian **Named Ranges** di paling bawah halaman. Anda bisa menambah, mengubah nama, memindahkan ke sheet lain, atau mengubah range-nya (format `A2:A100`) secara langsung dari situ — tidak perlu buka Google Sheets dan mengatur named range manual lewat menu Data-nya.

> Anda tidak wajib membuat named range untuk memakai Ponti Sheets — ini murni fitur opsional untuk merapikan formula & dropdown kalau Anda menginginkannya.

---

## 2. Visi Produk

Ponti Sheets dikembangkan bertahap:

| Versi | Nama | Fokus |
|---|---|---|
| **V1** | Personal Mode | Pemakaian pribadi, semua data tersimpan lokal di browser, tanpa server |
| **V2** | Cloud Sync | Akun pengguna, sinkronisasi riwayat ke cloud |
| **V3** | Multi User | Kolaborasi banyak pengguna |
| **V4** | Multi Tenant SaaS | Workspace, organisasi, tim, role, permission, billing |

Meskipun saat ini baru Versi 1, seluruh arsitektur aplikasi (Presentation, Business, Data, AI, Storage, Configuration, Authentication Layer) **sudah dirancang agar siap naik level ke SaaS tanpa perlu menulis ulang dari nol**.

---

## 3. Manfaat

- ✅ **Hemat waktu** — tidak perlu menjelaskan struktur database Anda satu per satu ke AI.
- ✅ **Lebih akurat** — AI membangun aplikasi berdasarkan struktur data *asli*, bukan asumsi.
- ✅ **Privasi terjaga** — di Versi 1, data Anda tidak pernah dikirim ke server Ponti Sheets (karena memang tidak ada server-nya).
- ✅ **Fleksibel** — mendukung banyak provider AI (OpenAI, Gemini, Qwen) yang bisa dipilih sesuai kebutuhan/budget.
- ✅ **Siap pakai di mana saja** — bisa diakses lewat browser, di-install sebagai aplikasi (PWA), bahkan nantinya di-build menjadi APK Android atau EXE Windows.

---

## 4. Fitur Utama

> 🔒 **Semua menu di bawah ini wajib login Google terlebih dahulu** (Login Gate) — lihat [Cara Login Google](#8-cara-login-google).

| Menu | Fungsi |
|---|---|
| **Dashboard** | Ringkasan aktivitas, statistik, dan alur kerja cepat |
| **✨ Database Builder** | Bangun struktur database Google Sheets/Excel baru dari nol memakai AI, cukup jelaskan kebutuhannya |
| **Spreadsheet** | Memilih spreadsheet sumber data dari Google Drive Anda |
| **Analysis** | Deteksi tipe kolom, primary/foreign key, formula, kualitas data |
| **Database Context** | Melihat & mengunduh `database_context.json` |
| **🛠️ Schema Editor** | Edit struktur database yang sudah ada langsung dari Ponti Sheets — tambah/hapus/rename kolom & sheet, formula, validasi, relasi, dan lainnya, tersinkron ke Google Sheets asli. Ada juga **"Minta Saran AI"** untuk mereview & menyarankan perbaikan struktur (PK/FK, tipe data, penamaan, split sheet). |
| **ERD** | Visualisasi diagram relasi antar sheet (kotak tabel + garis relasi FK → PK), bisa di-zoom & di-export sebagai SVG |
| **Prompt Builder** | Menyusun prompt AI otomatis dari Database Context + aturan bisnis |
| **AI Studio** | Provider & Model bebas dipilih (bahkan di tengah percakapan), percakapan multi-turn untuk revisi, syntax highlighting pada kode hasil |
| **Documentation** | Data dictionary, ERD teks, business rules, feature list otomatis |
| **History** | Riwayat prompt & response yang pernah dibuat |
| **Export** | Unduh hasil dalam format Markdown, JSON, TXT, atau PDF |
| **Settings** | Tema (gelap/terang), provider AI, API key, kelola storage |
| **❓ Panduan Penggunaan** | Halaman bantuan bahasa sederhana untuk pengguna awam — alur pemakaian singkat, kamus istilah teknis yang bisa dicari, dan FAQ dasar |

**Kemampuan analisis mencakup:**

- Deteksi 15 tipe kolom (Text, Number, Currency, Boolean, Date, Datetime, Email, Phone, GPS, Image URL, File URL, JSON, Array, URL, Unknown).
- Deteksi otomatis Primary Key & Foreign Key beserta *confidence score*-nya.
- Ekstraksi **formula asli** (bukan hasil hitungnya) — SUM, QUERY, FILTER, ARRAYFORMULA, VLOOKUP, XLOOKUP, INDEX, MATCH, IF, IFS, dan lainnya — lengkap dengan nama fungsi, deskripsi, lokasi sel, dan dependency-nya.
- Pemeriksaan kualitas data: duplikat, kosong, format email/telepon/tanggal tidak valid, relasi terputus.

---

## 4.1 Catatan Teknis: Styling

Brief produk menyebutkan Tailwind CSS sebagai bagian dari tech stack. Untuk menjaga performa (tanpa build step) dan konsistensi desain, Ponti Sheets V1 menggunakan **CSS custom berbasis design token** (`assets/css/theme.css`) dengan pendekatan utility-friendly yang setara secara fungsional. Alasannya: Tailwind Play CDN (versi tanpa build) secara resmi tidak disarankan untuk produksi oleh Tailwind sendiri, sedangkan setup build (PostCSS/CLI) akan menambah kompleksitas instalasi yang bertentangan dengan prinsip "tanpa Node.js, tanpa build step" pada bagian instalasi. Jika Anda ingin memakai Tailwind CSS sungguhan, tinggal tambahkan langkah build (`npx tailwindcss ...`) tanpa perlu mengubah struktur HTML/JS yang ada, karena kelas-kelas CSS pada project ini sudah disusun modular per komponen.

---

## 5. Cara Instalasi

Ponti Sheets adalah aplikasi web statis (HTML + CSS + JavaScript murni) — **tidak perlu Node.js, tidak perlu proses build/compile** untuk menjalankannya.

### Yang Anda butuhkan:
- Browser modern (Chrome, Edge, atau Firefox versi terbaru).
- Akun Google (untuk login & akses Google Sheets).
- (Opsional) API Key dari OpenAI, Google AI Studio (Gemini), Alibaba Cloud (Qwen), atau Anthropic (Claude) — hanya diperlukan saat Anda ingin memakai fitur AI Studio.

### Langkah instalasi:

1. Unduh/salin seluruh folder `PontiSheets/` ke komputer Anda.
2. Jalankan aplikasi lewat local web server (lihat bagian berikutnya) — **jangan** membuka `index.html` langsung dengan cara *double click* karena browser akan memblokir fitur ES Module & Service Worker jika diakses lewat `file://`.
3. Buka aplikasi — layar **Login Gate** akan otomatis menampilkan form untuk mengisi **Google Client ID** kalau belum pernah diisi (lihat [Cara Login Google](#8-cara-login-google)).

---

## 6. Cara Menjalankan Project

Karena Ponti Sheets memakai **ES Modules** (`import`/`export`) dan **Service Worker**, project ini harus dijalankan lewat web server (boleh yang paling sederhana sekalipun).

**Opsi A — Python (paling mudah, biasanya sudah terpasang):**
```bash
cd PontiSheets
python3 -m http.server 8080
```
Lalu buka `http://localhost:8080` di browser.

**Opsi B — Node.js (`npx serve`):**
```bash
cd PontiSheets
npx serve .
```

**Opsi C — VS Code Live Server:**
Install extension "Live Server", klik kanan `index.html` → "Open with Live Server".

**Opsi D — Deploy ke hosting statis:**
Karena ini murni file statis, Ponti Sheets bisa langsung di-deploy ke **Netlify**, **Vercel**, **GitHub Pages**, **Firebase Hosting**, atau **Google Cloud Storage**.

> ⚠️ Jika Anda deploy ke domain publik, jangan lupa tambahkan domain tersebut ke **Authorized JavaScript origins** di Google Cloud Console (lihat bagian Login Google).

---

## 7. Struktur Folder

```
PontiSheets/
├── README.md                  # Dokumen ini
├── CHANGELOG.md                # Catatan perubahan versi
├── LICENSE                     # Lisensi open source
├── manifest.json                # Konfigurasi PWA
├── sw.js                        # Service Worker (offline & caching)
├── index.html                   # Halaman utama (SPA shell)
└── assets/
    ├── css/                     # Stylesheet (design tokens, layout, komponen, halaman)
    ├── icons/                   # Ikon aplikasi (PWA)
    └── js/
        ├── app.js                # Entry point aplikasi (bootstrap, router)
        ├── config/               # Konfigurasi terpusat (TIDAK BOLEH ADA HARDCODE di file lain)
        ├── utils/                # Helper umum (DOM, format, logger)
        ├── storage/              # Storage Layer (abstraksi localStorage, siap diganti cloud DB)
        ├── models/               # Model data (Spreadsheet, Sheet, Column, Relationship, dll)
        ├── services/             # Business Layer (Google Auth, Sheets API, Analysis Engine,
        │                         #  Database Context Engine, Prompt Builder, Token Estimator,
        │                         #  Export, History, Settings)
        ├── adapters/              # AI Layer — Adapter Pattern untuk OpenAI/Gemini/Qwen
        ├── controllers/           # State management & routing
        ├── layouts/               # Layout utama (sidebar + topbar + content)
        ├── components/            # Komponen UI reusable (sidebar, topbar, toast, command palette, ikon)
        ├── pages/                 # Halaman-halaman aplikasi (1 file = 1 menu)
        └── logs/                  # (cadangan) lokasi log lokal bila diperlukan
```

Pemisahan ini sengaja dibuat mengikuti **Clean Architecture**: Presentation Layer (`components`, `layouts`, `pages`) tidak pernah memanggil Google API secara langsung — semuanya lewat Business Layer (`services`), yang juga tidak tahu-menahu detail penyimpanan karena itu tugas Storage Layer (`storage`). Struktur ini memudahkan migrasi ke Cloud Sync (V2) tanpa membongkar seluruh aplikasi.

---

## 8. Cara Login Google

Ponti Sheets memakai **Google Identity Services (OAuth 2.0)** agar bisa membaca (dan, untuk fitur tertentu, menulis) Google Sheets Anda dengan aman.

### 🔒 Login Gate (Multi-User)

Sejak versi ini, **login Google WAJIB dilakukan sebelum halaman apa pun bisa diakses** — termasuk Dashboard. Ini bukan cuma soal izin akses Sheets/Drive, tapi juga identitas aplikasi: setiap akun Google yang login mendapat "ruang data" sendiri (Settings, API Key AI, History) yang **terpisah total** dari akun Google lain — jadi beberapa orang bisa memakai device/browser yang sama tanpa saling melihat data satu sama lain. Klik **Logout** di pojok kanan atas untuk kembali ke layar login (mis. untuk bergantian pengguna).

> ⚠️ Karena ini murni aplikasi client-side (tanpa server sendiri), "akun" di sini sepenuhnya mengandalkan akun Google Anda sebagai identitas — tidak ada sistem username/password terpisah. Data setiap akun tersimpan di `localStorage` browser yang sama, dipisah lewat namespace per akun; ini bukan enkripsi/keamanan tingkat server, jadi cocok untuk pemakaian tim kecil/keluarga pada device bersama, bukan untuk memisahkan data secara aman dari orang yang punya akses admin ke browser tersebut.

> 📄 **Butuh lebih dari 100 pengguna, atau ingin menghilangkan peringatan "Unverified App"?** Lihat panduan terpisah **[PANDUAN_VERIFIKASI_GOOGLE.md](./PANDUAN_VERIFIKASI_GOOGLE.md)** — mencakup persiapan, langkah submit, video demo, dan penjelasan penting soal scope `drive.readonly` yang dipakai Ponti Sheets (masuk kategori *Restricted*, bukan cuma *Sensitive* — ada rekomendasi cara menghindarinya di situ).

### Langkah membuat Google OAuth Client ID:

1. Buka [Google Cloud Console](https://console.cloud.google.com/).
2. Buat project baru (atau pakai project yang sudah ada).
3. Buka menu **APIs & Services → Library**, aktifkan:
   - **Google Sheets API**
   - **Google Drive API**
4. Buka **APIs & Services → OAuth consent screen**, isi informasi dasar aplikasi (nama, email support). Untuk pemakaian pribadi/tim kecil, pilih *User type: External* lalu tambahkan email setiap orang yang akan memakai aplikasi ini sebagai *Test User*.
5. Buka **APIs & Services → Credentials → Create Credentials → OAuth Client ID**.
   - Application type: **Web application**.
   - **Authorized JavaScript origins**: tambahkan alamat tempat Anda menjalankan Ponti Sheets, misalnya `http://localhost:8080`.
6. Salin **Client ID** yang dihasilkan.
7. Buka Ponti Sheets — kalau ini pemakaian pertama kali, layar **Login Gate** akan langsung menampilkan kolom untuk mengisi Google Client ID (tidak perlu masuk ke Settings dulu, karena Settings sendiri ada di balik gerbang login). Tempel Client ID Anda di situ, klik **"Simpan & Lanjutkan"**.
8. Klik **"Login dengan Google"** dan ikuti alur consent Google.

> 💡 **Google Client ID bersifat GLOBAL** — satu Client ID berlaku untuk SEMUA akun Google yang login di instalasi Ponti Sheets ini (bukan per-orang), dan disimpan terpisah dari Settings pribadi masing-masing akun. Diisi sekali lewat form di **Login Gate** (muncul otomatis kalau belum dikonfigurasi) — untuk MENGGANTINYA nanti (mis. pindah ke Google Cloud Project lain), hapus key `ponti_sheets.google_client_id` di DevTools browser (F12 → Application → Local Storage), lalu reload — form pengisian Client ID akan muncul lagi di Login Gate.
>
> Jika Anda tetap ingin men-hardcode Client ID langsung di source code (misalnya untuk deployment permanen/tim), Anda masih bisa mengisi `GOOGLE_CONFIG.clientId` di `assets/js/config/app.config.js` sebagai fallback — nilai yang disimpan lewat Login Gate akan selalu diprioritaskan jika keduanya terisi.

> 🔒 Izin OAuth yang diminta bersifat **read-write** ke Google Sheets (dibutuhkan Database Builder & Schema Editor untuk membuat/mengedit spreadsheet). Namun secara perilaku, Ponti Sheets **hanya benar-benar menulis** ke spreadsheet saat Anda menekan tombol "Generate Google Sheets" atau "Terapkan Perubahan" — fitur Analyze, Database Context, ERD, dan Prompt Builder tetap murni membaca data Anda.

---

## 8.5 Cara Menggunakan Database Builder (Generate Database dengan AI)

### Apa itu Database Builder?

**Database Builder** adalah fitur yang membalik alur kerja biasa: alih-alih menganalisis spreadsheet yang **sudah ada**, Anda cukup **menjelaskan kebutuhan Anda dalam bahasa biasa**, dan AI akan merancang seluruh struktur database untuk Anda — lengkap dengan sheet, kolom, tipe data, relasi, formula, dummy data, validasi, hingga conditional formatting. Hasilnya bisa langsung dibuat menjadi **Google Sheets baru** atau **file Excel (.xlsx)**.

### Kapan fitur ini digunakan?

Gunakan Database Builder ketika:
- Anda **belum punya** spreadsheet dan ingin memulai dari nol (mis. bikin sistem POS, CRM, HRIS baru).
- Anda ingin **contoh struktur database yang baik** sebagai titik awal, yang nanti bisa disesuaikan.
- Anda ingin database yang sudah **berisi dummy data realistis** untuk keperluan demo/testing.

Kalau Anda sudah punya spreadsheet sendiri, langsung saja ke menu **Spreadsheet** seperti biasa (lihat [Cara Memilih Spreadsheet](#9-cara-memilih-spreadsheet)) — tidak perlu lewat Database Builder.

### ⚠️ Perubahan Izin (Permission) Google

Untuk bisa **membuat** spreadsheet baru (bukan cuma membaca), Ponti Sheets sekarang meminta izin OAuth **read-write** ke Google Sheets (sebelumnya read-only). Beberapa hal penting:
- Ponti Sheets **hanya benar-benar menulis** ke Google Sheets saat Anda menekan tombol **"Generate Google Sheets"** di Database Builder, atau **"Terapkan Perubahan ke Google Sheets"** di Schema Editor — fitur Analyze, Database Context, ERD, dan Prompt Builder tetap murni membaca data Anda.
- Jika Anda login sebelum update ini, **logout lalu login ulang** agar izin baru berlaku (Google akan menampilkan layar consent baru).
- Opsi **"Generate Excel (.xlsx)"** tidak membutuhkan izin tambahan sama sekali — file dibuat & diunduh langsung di browser Anda, tanpa menyentuh akun Google Anda.

### Cara membuat database baru

1. Buka menu **✨ Database Builder** (di Dashboard atau sidebar).
2. Pilih **AI Provider** yang API key-nya sudah Anda isi di Settings.
3. Tulis **instruksi** Anda di kolom teks selengkap mungkin — sebutkan jenis bisnis/aplikasinya, data apa saja yang perlu disimpan, dan relasi antar data yang Anda bayangkan. Contoh: *"Buatkan struktur database lengkap untuk aplikasi POS Restoran dengan meja dan status pesanan dapur."*
4. Klik **"Generate Blueprint"** — AI akan merancang struktur lengkapnya (biasanya 10–40 detik tergantung provider).
5. Periksa hasil **Preview Blueprint** yang muncul (lihat bagian [Cara Membaca Blueprint Database](#cara-membaca-blueprint-database) di bawah).
6. Kalau sudah sesuai, klik **"Generate Google Sheets"** atau **"Generate Excel (.xlsx)"**.
7. Kalau belum sesuai, klik **"Generate Ulang"**, atau ubah instruksi lalu Generate Blueprint lagi.

### Perbedaan Generate Google Sheets vs Generate Excel (.xlsx)

| | **Generate Google Sheets** | **Generate Excel (.xlsx)** |
|---|---|---|
| Butuh login Google? | Ya (izin read-write) | Tidak |
| Hasil | Spreadsheet baru langsung di Google Drive Anda | File `.xlsx` yang diunduh ke komputer Anda |
| Bisa langsung dianalisis Ponti Sheets? | Ya, langsung (tombol "Analisis Sekarang") | Perlu diimpor ke Google Sheets dulu (upload manual ke Drive), baru bisa dianalisis |
| Cocok untuk | Pemakaian online, kolaborasi, langsung lanjut ke fitur Ponti Sheets lain | Kerja offline, dikirim ke orang lain, atau dibuka di Excel/LibreOffice |

Kedua mode menghasilkan struktur yang sama persis (sheet, kolom, formula, dummy data, validasi, conditional formatting) — bedanya cuma format & tempat penyimpanan akhirnya.

### Tips menulis instruksi yang baik

Semakin detail instruksi Anda, semakin sesuai hasilnya — sebutkan jenis bisnis/aplikasinya, data apa saja yang perlu disimpan, fitur tambahan yang Anda butuhkan, dan relasi antar data yang Anda bayangkan. Contoh instruksi yang detail: *"Buatkan database untuk toko online kecil: Produk (dengan stok & harga), Pelanggan, Pesanan, dan Detail Pesanan. Status pesanan: Menunggu Pembayaran, Diproses, Dikirim, Selesai."*

### Cara membaca Blueprint Database

Setelah blueprint berhasil dibuat, Anda akan melihat:
- **Ringkasan** — nama project, deskripsi, dan statistik (jumlah sheet, kolom, relasi, formula, dummy data, validasi).
- **Kartu per sheet** — daftar kolom lengkap dengan tipe data, badge `PK`/`FK`, status wajib diisi, formula/aturan validasi, serta contoh dummy data.
- **Business Rules** — aturan bisnis yang disusun AI (mis. "Stok tidak boleh minus").
- **Rekomendasi** — saran AI untuk pengembangan struktur ke depan.

Blueprint ini setara dengan file `database_blueprint.json` — struktur mentahnya bisa dilihat lewat DevTools (disimpan sementara di state aplikasi selama Anda belum pindah/reload halaman).

### Cara melanjutkan hasilnya ke fitur lain

Setelah **Generate Google Sheets** berhasil, klik tombol **"Analisis Sekarang"** — spreadsheet baru otomatis dijadikan spreadsheet aktif dan Anda langsung diarahkan ke halaman **Analysis**, tanpa perlu mengunggah ulang apa pun. Dari situ Anda bisa lanjut seperti biasa ke **Database Context → ERD → Prompt Builder → AI Studio**.

Untuk hasil **Generate Excel**, impor dulu file `.xlsx` ke Google Drive Anda (upload biasa, Google Sheets akan otomatis menawarkan konversi), baru pilih spreadsheet tersebut di menu **Spreadsheet**.

### FAQ & Troubleshooting khusus Database Builder

| Masalah | Solusi |
|---|---|
| AI menghasilkan error "JSON tidak valid" | Klik **"Coba Generate Ulang"** — Ponti Sheets otomatis menambah instruksi tegas ke AI agar hanya membalas JSON murni pada percobaan berikutnya. Provider yang lebih baru/besar (mis. GPT-4o, Gemini 2.0 Pro) biasanya lebih patuh terhadap instruksi format. |
| Klik "Generate Google Sheets" tapi muncul error izin/401/403 | Logout lalu login ulang di menu Spreadsheet — Client ID Anda mungkin masih memakai sesi lama dengan izin read-only. |
| Relasi antar sheet di blueprint terlihat tidak konsisten | AI kadang membuat kesalahan kecil pada penamaan Foreign Key. Klik **Generate Ulang**, atau perjelas instruksi Anda dengan menyebutkan nama-nama tabel/kolom yang Anda inginkan secara eksplisit. |
| Ingin database dengan struktur yang sangat spesifik/kompleks | AI bekerja lebih baik dengan instruksi yang jelas & terstruktur. Pecah kebutuhan kompleks menjadi beberapa kalimat instruksi yang eksplisit, alih-alih satu kalimat umum. |
| Proses "Generate Google Sheets" terasa lama | Wajar untuk database dengan banyak sheet/kolom — Ponti Sheets melakukan puluhan panggilan Google Sheets API (buat sheet, tulis data, atur validasi, conditional formatting, dst). Jangan tutup tab sampai proses selesai. |
| Sebagian formatting (validasi/conditional formatting) tidak muncul di hasil akhir | Data inti (header, kolom, dummy data, formula) tetap tersimpan meski sebagian request formatting API gagal (mis. karena nama named range bentrok) — buka spreadsheet-nya dan tambahkan manual jika perlu. |

---

## 9. Cara Memilih Spreadsheet

1. Setelah login, buka menu **Spreadsheet**.
2. Anda akan melihat daftar spreadsheet yang ada di Google Drive Anda (diurutkan dari yang terakhir diubah).
3. Gunakan kolom pencarian untuk mencari nama spreadsheet tertentu.
4. Klik salah satu spreadsheet untuk menjadikannya **spreadsheet aktif** — Anda akan otomatis diarahkan ke halaman **Analysis**.

---

## 10. Cara Melakukan Analisis

Setelah memilih spreadsheet, Ponti Sheets otomatis menjalankan **Database Context Engine**, yang akan:

1. Mengambil metadata spreadsheet (nama, locale, timezone, jumlah sheet).
2. Untuk tiap sheet: mengambil header, sample data, dan formula asli.
3. Mendeteksi tipe tiap kolom beserta *confidence score*.
4. Mendeteksi kolom yang kemungkinan **Primary Key** (unik, tidak kosong, nama seperti `id`/`kode`) dan **Foreign Key** (nama seperti `customer_id`, `kode_produk`), lalu mencoba mencocokkannya ke sheet lain. *(Belum tahu apa itu PK/FK? Lihat [penjelasan sederhananya di sini](#11-istilah-penting-apa-itu-primary-key-pk-dan-foreign-key-fk).)*
5. Menjalankan pemeriksaan **Data Quality** (duplikat, kosong, format tidak valid).

> 💡 Kalau sheet ini pernah diedit lewat **Schema Editor**, tipe kolom/PK/FK yang sudah Anda tentukan di sana **selalu diikuti persis** di sini (bukan ditebak ulang) — supaya Analysis, Database Context, ERD, dan Documentation semuanya konsisten dengan apa yang sudah Anda atur. Kolom yang belum pernah disentuh Schema Editor tetap dideteksi lewat heuristik seperti biasa.

Proses ini berjalan langsung di browser Anda (tidak dikirim ke server manapun selain Google API itu sendiri).

---

## 11. Cara Membaca Database Context

Buka menu **Database Context** untuk melihat hasil akhir analisis dalam bentuk `database_context.json`. Struktur utamanya:

```json
{
  "meta": { "generatedAt": "...", "generator": "..." },
  "spreadsheet": { "id": "...", "name": "...", "locale": "...", "timezone": "..." },
  "sheets": [
    {
      "name": "Produk",
      "columns": [
        { "name": "id_produk", "type": "text", "isPrimaryKey": true, "confidence": 0.98 },
        { "name": "subtotal", "type": "currency", "formula": "=B2*C2", "formulaIsLive": true, "confidence": 1 },
        { "name": "email", "type": "email", "required": { "value": "true", "condition": null }, "editable": { "value": "unknown", "condition": null }, "show": { "value": "true", "condition": "Tampilkan hanya jika role = admin" } }
      ],
      "formulas": [ { "cell": "Produk!E2", "formula": "=B2*C2", "name": "CUSTOM" } ],
      "sampleData": [ ["P001", "Kopi Susu", 18000] ],
      "warnings": [ { "level": "warning", "message": "..." } ]
    }
  ],
  "relationships": [ { "from": "Transaksi.id_produk", "to": "Produk.id_produk" } ],
  "namedRanges": [ { "name": "DaftarProduk", "sheet": "Produk", "range": "A2:A100" } ],
  "businessRules": [ "Setiap baris pada \"Produk\" harus memiliki nilai unik pada kolom \"id_produk\"." ],
  "statistics": { "totalSheets": 3, "totalColumns": 18, "totalFormulas": 6 },
  "recommendations": [ "..." ]
}
```

Setiap kolom punya field `confidence` (0–1) yang menunjukkan seberapa yakin Ponti Sheets terhadap deteksi tipe/PK/FK tersebut — semakin mendekati 1, semakin yakin.

Kolom yang berformula juga menyertakan `formula` (teks rumusnya) dan `formulaIsLive` — `true` kalau formula-nya aktif sungguhan di Google Sheets (nilai ikut berubah otomatis), `false` kalau sudah "dibekukan" jadi nilai statis lewat centang **Formula Aktif** di Schema Editor (lihat [Cara Menggunakan Schema Editor](#112-cara-menggunakan-schema-editor-edit-struktur-database-yang-sudah-ada)).

Anda bisa **Copy JSON**, **Export JSON**, atau **Export Markdown** langsung dari halaman ini.

---

## 11.1 Cara Melihat ERD (Entity Relationship Diagram)

1. Pastikan Anda sudah membuka halaman **Database Context** minimal satu kali.
2. Buka menu **ERD** di sidebar (atau klik tombol "Lihat ERD Visual" di halaman Database Context / Documentation).
3. Setiap sheet ditampilkan sebagai kotak berisi daftar kolom — kolom **Primary Key** ditandai titik ungu + label `PK`, kolom **Foreign Key** ditandai titik biru + label `FK`.
4. Garis panah menghubungkan kolom Foreign Key ke Primary Key yang direferensikannya, lengkap dengan nomor urut relasi (cocokkan dengan daftar di halaman Database Context).
5. Gunakan tombol **+ / – / Reset** di toolbar untuk zoom in/out, dan geser (scroll) area diagram untuk pan ke sisi lain.
6. Klik **"Export SVG"** untuk mengunduh diagram sebagai file vektor (`.svg`) yang bisa dibuka di Figma, Illustrator, atau browser mana pun.

> Jika sebuah sheet punya lebih dari 8 kolom, kolom non-kunci yang tidak ditampilkan akan diringkas sebagai "+N kolom lainnya" agar diagram tetap mudah dibaca. Kolom Primary Key & Foreign Key selalu diprioritaskan untuk ditampilkan penuh.

---

## 11.2 Cara Menggunakan Schema Editor (Edit Struktur Database yang Sudah Ada)

### Apa itu Schema Editor?

**Schema Editor** memungkinkan Anda mengubah struktur spreadsheet yang **sudah ada** langsung dari Ponti Sheets — tambah/hapus/rename kolom & sheet, ubah tipe data, formula, data validation, conditional formatting, relasi Foreign Key, named range, freeze row, filter, warna tab, dan protect header. Semua perubahan ditulis balik ke Google Sheets asli Anda lewat Google Sheets API.

Ini berbeda dari **Database Builder** (yang membuat spreadsheet **baru** dari nol) — Schema Editor khusus untuk **mengedit spreadsheet yang sudah ada**.

### Cara membuka Schema Editor

1. Pilih spreadsheet terlebih dahulu di menu **Spreadsheet** (atau lewat Database Builder).
2. Buka menu **🛠️ Schema Editor** di sidebar (atau klik tombol "Edit Struktur" di halaman Database Context).
3. Ponti Sheets akan membaca struktur terkini dari Google Sheets Anda (header, tipe validasi, formula contoh, conditional formatting, named range, dsb).

### Cara mengedit

Setiap sheet ditampilkan sebagai kartu berisi tabel kolom yang bisa diedit langsung:

- **Nama Sheet, Warna Tab, Freeze Row, Filter, Protect Header** — diedit di bagian atas kartu.
- **Kolom** — setiap baris tabel adalah satu kolom: ubah nama, tipe data, centang **PK** (Primary Key) atau **FK** (Foreign Key, lalu pilih sheet & kolom yang direferensikan — ini akan membuat dropdown FK yang benar-benar berfungsi di Google Sheets), atur **Required/Editable/Show**, isi **Formula**, dan atur **Validasi** (dropdown list/number/date/checkbox/email/phone).
- **Required / Editable / Show** — tiga field tri-state yang jadi PETUNJUK UNTUK AI saat membangun aplikasi dari struktur ini (bukan validasi di Google Sheets itu sendiri):
  - **Required** — apakah kolom ini wajib diisi di form aplikasi yang dibuat AI.
  - **Editable** — apakah kolom ini boleh diisi/diubah manual oleh pengguna aplikasi (bukan dihitung otomatis).
  - **Show** — apakah kolom ini perlu ditampilkan di UI aplikasi.
  - Ketiganya punya 3 pilihan: **Unknown** (default — AI yang menyimpulkan sendiri berdasarkan konteks kolom), **TRUE**, atau **FALSE**. Kalau pilih **TRUE**, muncul kolom **keterangan opsional** (mis. *"Wajib jika kondisi A = TRUE"*) — kalau keterangan dikosongkan, berarti TRUE berlaku mutlak tanpa syarat; kalau diisi, AI akan menerapkannya secara kondisional sesuai keterangan itu.
- **Formula aktif vs hasil statis** — di kolom Formula ada centang "Formula aktif". Kalau **dicentang** (default begitu Anda isi Formula), formula-nya ditulis sebagai formula sungguhan di Google Sheets (nilai ikut berubah otomatis kalau data lain berubah). Kalau **tidak dicentang**, Ponti Sheets akan menghitung hasil formula itu lebih dulu lalu menyimpan HASIL akhirnya saja sebagai nilai tetap (statis). Centang ini **otomatis nonaktif & tidak bisa dicentang** kalau kolom Formula-nya kosong — tidak masuk akal ada formula "aktif" tanpa formulanya.
- **Mengurutkan ulang kolom** — geser ikon **⠿** di sebelah kanan setiap baris ke atas/bawah untuk memindah urutan kolom secara langsung (bisa pakai jari di HP atau mouse di desktop), atau pakai tombol **↑ / ↓** kalau lebih suka klik.
- Ikon tempat sampah menghapus kolom tersebut.
- **"+ Tambah Kolom"** menambah kolom baru di akhir tabel (bisa dipindah urutannya setelahnya).
- **"+ Tambah Conditional Format"** menambah aturan pewarnaan otomatis baru untuk sheet tersebut.
- **"+ Tambah Sheet Baru"** diletakkan di **bagian bawah halaman** (setelah semua kartu sheet) supaya Anda tidak perlu scroll bolak-balik ke atas saat sedang bekerja dengan banyak sheet — menambah sheet kosong baru (dengan 1 kolom `id` sebagai Primary Key).
- Bagian **Named Ranges** di paling bawah halaman mengatur named range untuk seluruh spreadsheet. *(Belum tahu apa itu named range? Lihat [penjelasan sederhananya di sini](#12-istilah-penting-apa-itu-named-range).)*

> 💡 Menambah/menghapus sheet, kolom, atau conditional format **tidak lagi membuat halaman lompat ke atas** — posisi scroll Anda dipertahankan supaya tidak perlu cari lokasi kerja lagi setiap kali menekan tombol tambah.

### ✨ Minta Saran AI (Redesign Struktur)

Selain mengedit manual, Anda bisa klik tombol **"Minta Saran AI"** di toolbar atas untuk meminta AI mereview struktur database Anda yang sudah ada dan memberi saran perbaikan konkret, mencakup:

- **Primary Key / Foreign Key** yang hilang atau salah arah.
- **Tipe Data** yang tidak sesuai dengan isi kolomnya (mis. tanggal disimpan sebagai teks).
- **Penamaan** kolom/sheet yang tidak konsisten.
- **Normalisasi (Split Sheet)** — data yang berulang di banyak baris (mis. nama & alamat pelanggan diulang di setiap baris pesanan) yang sebaiknya dipisah jadi sheet baru dengan relasi FK.
- **Struktur Umum** — termasuk rekomendasi penggabungan sheet yang mirip (ini SELALU berupa saran tertulis saja, tidak bisa diterapkan otomatis — perlu Anda tindak lanjuti manual karena berisiko tinggi kalau salah).

#### Jendela Saran (bisa digeser, diperbesar, diminimalkan)

Saran muncul dalam **jendela mengambang** terpisah dari halaman utama — supaya Anda tetap bisa melihat/mengerjakan tabel kolom sambil jendela sarannya tetap terbuka:

- **Geser** jendelanya dengan menyeret bagian judul (title bar) di atas.
- **Perbesar/perkecil** dengan menyeret pojok kanan-bawah (di desktop).
- **Sembunyikan/Minimalkan** (ikon ─) — menyembunyikan jendela dari layar, tapi progres Anda tetap tersimpan. Tombol di toolbar tetap **"Buka Kotak Saran"** — buka lagi kapan saja, persis dari kondisi terakhir.
- **Tutup** (ikon ✕) untuk menutup sepenuhnya — kapan saja, tidak ada syarat. Ini menandakan sesi perbaikan selesai, tombol di toolbar kembali jadi "Minta Saran AI".
- Isinya bisa di-scroll kalau sarannya banyak, dan jendelanya tidak akan pernah melebihi ukuran layar Anda.
- Di HP, jendela ini otomatis jadi layar penuh (geser/perbesar tidak relevan di layar kecil).
- **Hanya ada satu jendela saran dalam satu waktu** — kalau Anda klik tombolnya lagi padahal jendela sudah terbuka, jendelanya cuma akan berkedip sebentar (menandakan sudah ada), bukan membuka jendela baru. Setelah diminta, tombolnya berubah jadi **"Buka Kotak Saran"** — klik ini untuk membuka lagi jendela yang sama tanpa perlu menunggu proses AI ulang.
  - **Minimalkan (─)** — cuma menyembunyikan sementara, state & progres Anda TETAP UTUH. Tombol tetap **"Buka Kotak Saran"**, klik untuk membuka lagi persis dari kondisi terakhir.
  - **Tutup (✕)**, atau otomatis tertutup setelah kedua tombol "Terapkan"/"Selesai" diklik — dianggap sesi perbaikan **selesai**. Tombolnya kembali jadi **"Minta Saran AI"**, dan klik berikutnya akan meminta saran yang benar-benar baru dari AI.

#### Dua bagian: yang bisa otomatis, dan yang harus manual

Saran-sarannya dipisah jelas jadi dua bagian, **diurutkan dari yang paling penting (Prioritas Tinggi) ke yang paling ringan (Prioritas Rendah)**:

1. **✅ Bisa Diperbaiki Otomatis** — PK/FK, Tipe Data, Penamaan, dan Split Sheet. Untuk saran biasa (bukan Split Sheet): centang yang Anda mau (semua tercentang secara default). Split Sheet berbeda sendiri karena benar-benar memindahkan **data** (bukan cuma struktur) — sheet baru dibuat, data yang berulang dideduplikasi jadi baris unik, sheet asal diperbarui dengan Foreign Key baru — punya tombol sendiri **"Terapkan Split Ini Sekarang"** yang **langsung menulis ke Google Sheets saat itu juga** begitu diklik (bukan ditahan sebagai editan biasa), jadi pastikan editan lain sudah Anda simpan dulu sebelum melakukan ini.
2. **⚠️ Perlu Anda Perbaiki Manual** — hal-hal yang terlalu berisiko untuk diotomatisasi (mis. rekomendasi menggabungkan dua sheet). Kerjakan sendiri (biasanya langsung di Google Sheets), lalu **centang kotaknya satu per satu** sebagai tanda sudah selesai — tulisannya akan **dicoret** begitu dicentang, jadi gampang lihat mana yang masih tersisa.

#### Dua tombol di bagian bawah

- **"Terapkan (Otomatis)"** — menerapkan semua saran otomatis yang tercentang ke editan Anda saat ini. Perubahan langsung muncul di tabel kolom — **belum tersimpan ke Google Sheets** sampai Anda klik "Terapkan Perubahan ke Google Sheets" seperti biasa di halaman utama.
- **"Selesai (Manual)"** — menandai bahwa Anda sudah menindaklanjuti saran manual. Bisa diklik kapan saja, **tidak wajib mencentang semua kotak manual dulu** — kalau Anda merasa cukup dengan sebagian saja, tinggal klik.

Kedua tombol ini **terkunci (disabled) setelah diklik sekali** — mencegah klik ganda tidak sengaja, dan label berubah jadi "✓ Sudah Diterapkan"/"✓ Sudah Ditandai Selesai" sebagai penanda jelas bagian mana yang sudah Anda tindak lanjuti.

**Jendela saran tidak akan tertutup sendiri secara tidak sengaja** — hanya tertutup kalau Anda klik tombol ✕ atau ─ (kapan saja), ATAU setelah Anda klik **kedua** tombol "Terapkan (Otomatis)" dan "Selesai (Manual)" (jendelanya otomatis tertutup begitu keduanya sudah ditekan, sebagai tanda semuanya sudah ditindaklanjuti).

> Kalau struktur Anda memang sudah cukup baik, AI boleh saja mengembalikan sedikit saran atau bahkan tidak ada sama sekali — ini bukan error, cuma pertanda strukturnya sudah rapi, tidak perlu dipaksa mencari-cari masalah yang tidak ada.

> ⚠️ Fitur ini membutuhkan API Key AI Provider yang sudah diisi di menu Settings — sama seperti Database Builder & Prompt Builder.

### Cara menerapkan perubahan

Klik **"Terapkan Perubahan ke Google Sheets"** di toolbar atas — tombol ini akan menampilkan status loading dan terkunci (tidak bisa diklik dua kali) selama proses penyimpanan berlangsung. Kalau perubahan Anda mencakup **penghapusan sheet atau kolom**, Ponti Sheets akan menampilkan **layar konfirmasi** berisi daftar persis apa yang akan hilang, dan Anda harus mencentang "Saya paham data terkait akan hilang permanen" sebelum tombol konfirmasi aktif. Ini untuk mencegah kehilangan data tidak sengaja.

Setelah berhasil, klik **"Analisis Ulang Sekarang"** (toast konfirmasi) untuk langsung memperbarui Analysis/Database Context/ERD sesuai struktur terbaru.

### Yang perlu Anda ketahui tentang cara kerjanya

- **Rename kolom/sheet** — aman, tidak menyentuh data, hanya mengubah judul.
- **Tambah kolom baru** — aman, kolom baru akan kosong (atau berformula, kalau Anda isi field Formula).
- **Hapus kolom/sheet** — **permanen**, data terkait akan hilang. Selalu ada layar konfirmasi sebelum ini terjadi.
- **Ubah urutan kolom (↑/↓)** — data ikut berpindah mengikuti kolomnya, tidak hilang.
- **Sheet yang strukturnya berubah** (kolom ditambah/dihapus/diurutkan ulang) akan **ditulis ulang seluruh datanya** dalam satu kali proses — data pada kolom yang tidak berubah tetap dipertahankan persis seperti semula. Sheet yang tidak Anda ubah kolomnya sama sekali tidak disentuh datanya.
- **Ubah Tipe Data atau Formula sebuah kolom** juga memicu penulisan ulang data (bukan cuma tambah/hapus/reorder kolom). Kalau Anda mengubah **Tipe Data**, data yang sudah ada di kolom itu otomatis **dikonversi** ke tipe barunya — misalnya teks "15.000" jadi angka 15000 kalau diubah ke Number, "Ya"/"Tidak" jadi TRUE/FALSE kalau diubah ke Checkbox, berbagai format tanggal dinormalisasi ke YYYY-MM-DD. Kalau ada nilai yang formatnya tidak dikenali dan gagal dikonversi, nilai aslinya tetap dipertahankan (tidak dihapus).
- **Formula aktif vs statis**: kalau centang "Formula aktif" TIDAK dicentang, Ponti Sheets tetap menulis formulanya dulu ke Google Sheets (supaya Google Sheets sempat menghitungnya), lalu membaca kembali hasil hitungannya dan menimpa formula tersebut dengan nilai hasilnya — jadi butuh satu langkah ekstra dibanding formula aktif biasa, wajar kalau prosesnya sedikit lebih lama untuk kolom seperti ini.
- Mobile: seluruh tampilan Schema Editor (termasuk tabel kolom) sudah dioptimalkan untuk layar HP — tabel kolom otomatis berubah jadi daftar kartu bertumpuk di layar sempit, bukan tabel lebar yang perlu di-scroll horizontal.
- **Conditional Formatting** selalu diganti total (dihapus semua lalu ditulis ulang dari daftar yang Anda edit) — kalau ada conditional formatting manual yang Anda buat langsung di Google Sheets (di luar Ponti Sheets) sebelumnya, itu akan hilang setelah Terapkan Perubahan pertama kali. Setelah itu, edit lewat Schema Editor seperti biasa.
- **Foreign Key** yang Anda centang otomatis dibuatkan **dropdown asli** di Google Sheets yang merujuk ke kolom Primary Key sheet lain (pakai data validation "ONE_OF_RANGE") — kalau data di sheet sumbernya bertambah, dropdown ikut ter-update otomatis.
- **Tipe data, PK, FK, label, dan deskripsi kolom disimpan sebagai metadata tersembunyi** di spreadsheet-nya sendiri (Developer Metadata Google Sheets — tidak terlihat di tampilan Google Sheets, hanya terbaca lewat API). Ini penting karena Google Sheets sendiri tidak punya konsep "tipe kolom" — tanpa metadata ini, Ponti Sheets harus MENEBAK ULANG tipe setiap kali dibuka (yang tidak akurat untuk tipe seperti Currency/URL/UUID/Percentage/JSON/Array). Dengan metadata ini, apa pun yang Anda set akan selalu diingat persis, bahkan setelah reload berkali-kali.

### FAQ & Troubleshooting Schema Editor

| Masalah | Solusi |
|---|---|
| Struktur yang tampil tidak sesuai dengan isi spreadsheet asli | Klik **"Muat Ulang dari Google Sheets"** untuk membaca ulang struktur terkini (editan yang belum diterapkan akan hilang). |
| Ingin membatalkan semua editan yang belum diterapkan | Klik **"Muat Ulang dari Google Sheets"**, atau tinggalkan halaman tanpa menekan "Terapkan Perubahan". |
| Muncul error saat "Terapkan Perubahan" | Coba lagi — beberapa operasi (mis. named range dengan nama bentrok) bisa gagal sebagian; struktur inti (kolom, data) tetap tersimpan. Buka spreadsheet-nya untuk memeriksa hasil akhirnya. |
| Dropdown FK tidak muncul di Google Sheets | Pastikan sheet yang direferensikan (kolom PK-nya) sudah punya minimal 1 baris data, dan coba refresh halaman Google Sheets Anda. |
| Proses "Terapkan Perubahan" terasa lama | Wajar kalau banyak sheet berubah strukturnya sekaligus — setiap sheet yang kolomnya berubah ditulis ulang seluruh datanya. |
| Ubah tipe data (mis. ke Currency/URL/UUID) tapi setelah reload kembali jadi tipe lain | Sejak update ini, tipe kolom disimpan sebagai metadata tersembunyi di spreadsheet — pastikan Anda sudah klik "Terapkan Perubahan" (bukan cuma ubah di form) dan proses selesai tanpa error, supaya metadatanya benar-benar tersimpan. |

---

## 12. Cara Membaca Hasil Analisis

Di halaman **Analysis**, setiap sheet ditampilkan sebagai kartu terpisah berisi:

- **Tabel kolom** — nama, tipe terdeteksi, badge `PK`/`FK`, confidence, dan status **Required** (tri-state Unknown/TRUE/FALSE — sama seperti di Schema Editor).
- **Formula Terdeteksi** — daftar formula asli beserta lokasi sel dan penjelasan singkat fungsinya.
- **Data Quality** — daftar peringatan (❗ error, ⚠️ warning, ℹ️ info) bila ditemukan masalah pada sample data.

Badge **PK** berarti kolom tersebut terdeteksi sebagai Primary Key. Badge **FK → NamaSheet** berarti kolom tersebut terdeteksi merujuk ke Primary Key di sheet lain.

---

## 13. Cara Menggunakan Prompt Builder

1. Pastikan Anda sudah membuka halaman **Database Context** minimal satu kali (agar context tersimpan).
2. Buka menu **Prompt Builder**.
3. Isi konfigurasi di panel kiri:
   - **Template** — jenis aplikasi yang ingin dibangun (Web App Google Apps Script, Android APK, Windows EXE, dst).
   - **AI Provider** — OpenAI / Gemini / Qwen / Claude.
   - **Visual Style** — pilih gaya visual aplikasi (Modern, Corporate, Dark Theme, dst) lewat chip — **bisa pilih lebih dari satu sekaligus**, AI akan menggabungkan kombinasinya secara koheren.
   - **Requirement Tambahan** — kebutuhan teknis spesifik (contoh: "pakai Bootstrap 5").
   - **Instruksi Anda** — permintaan bebas (contoh: "buatkan aplikasi kasir dari struktur ini").
4. Panel kanan menampilkan **preview prompt** secara real-time, lengkap dengan estimasi jumlah karakter, token, biaya, dan waktu respon (**Token Estimator**). Prompt-nya bisa Anda edit langsung di situ sebelum dikirim, dan tombol **Reset** mengembalikannya ke versi hasil generate otomatis.
5. Prompt yang ditampilkan sudah melewati **Smart Prompt Optimizer** (context compression, JSON minifying, penghapusan duplikasi) agar hemat token tanpa kehilangan informasi penting.
6. Klik **"Kirim ke AI Studio"** untuk melanjutkan.

### Supaya AI tidak salah paham: Legend Field

Karena Database Context di-JSON-kan dalam bentuk singkat/minified untuk hemat token (mis. `pk`, `fk`, `ref`, `live`, `req`, `edit`, `show`), Prompt Builder otomatis menyertakan **bagian "Legend Field"** di awal prompt yang menjelaskan arti tiap singkatan itu ke AI — termasuk penjelasan field `formula`/`live` (formula aktif vs sudah dibekukan jadi nilai statis) dan `req`/`edit`/`show` (petunjuk Required/Editable/Show untuk AI saat membangun form aplikasi, lihat [Cara Menggunakan Schema Editor](#112-cara-menggunakan-schema-editor-edit-struktur-database-yang-sudah-ada)), serta daftar kemungkinan nilai `type`. Anda tidak perlu menjelaskan istilah-istilah ini sendiri ke AI — Ponti Sheets sudah melakukannya secara otomatis di setiap prompt yang dibuat.

---

## 14. Cara Menggunakan AI Studio

1. Pastikan API Key untuk provider yang dipilih sudah diisi di menu **Settings**.
2. **Provider & Model bisa diganti langsung di halaman ini** — tidak terkunci ke pilihan yang dibuat di Prompt Builder. Ganti kapan saja, **termasuk di tengah percakapan**: mis. pakai model besar (GPT-4o, Claude Opus) untuk generate pertama yang kompleks, lalu pindah ke model yang lebih murah (GPT-4o-mini, Claude Haiku) untuk revisi-revisi kecil berikutnya — jauh lebih hemat token tanpa perlu kualitas model besar terus-menerus.
3. Di halaman **AI Studio**, prompt yang akan dikirim tersembunyi secara default (klik **"Lihat Prompt Terkirim"** untuk membukanya) — supaya fokus utama halaman langsung ke response AI.
4. Klik **"Generate"** — Ponti Sheets akan memanggil API AI Provider & Model yang sedang dipilih secara langsung dari browser. Hasilnya otomatis tersimpan ke **History**.
5. **Blok kode di response otomatis diberi syntax highlighting** (lewat Prism.js, dimuat dari CDN saat dibutuhkan) — jauh lebih mudah dibaca dibanding teks polos, dan otomatis mengenali bahasa pemrogramannya dari label di blok kode markdown-nya (```` ```js ````, ```` ```html ````, dst).
6. **Minta revisi tanpa mengulang dari awal (percakapan multi-turn)** — setelah response pertama muncul, kotak "Kirim" muncul di bawahnya. Ketik permintaan revisi (mis. *"ubah warna tombol jadi biru"* atau *"tambahkan validasi email di form login"*) dan klik **Kirim** (atau `Ctrl/Cmd+Enter`) — AI akan menjawab dengan tetap mengingat seluruh konteks percakapan sebelumnya, tidak perlu menjelaskan ulang struktur database dari nol.
7. Setiap turn response menunjukkan **provider & model yang dipakai untuk turn itu** (mis. "AI · Claude · claude-haiku-4-5-20251001") — berguna untuk melacak kombinasi mana yang dipakai di percakapan yang sama kalau Anda gonta-ganti model.
8. Tombol **"Generate"** berubah jadi **"Mulai Percakapan Baru"** setelah turn pertama — klik ini kalau Anda ingin reset total dan mulai dari prompt awal lagi (akan diminta konfirmasi dulu; riwayat yang sudah tersimpan di menu History tidak ikut terhapus).
9. Setiap response AI punya tombol **Copy** sendiri-sendiri untuk menyalin teks response turn tersebut.

**Provider yang didukung** (dengan Adapter Pattern, sehingga mudah ditambah provider baru di kemudian hari):

| Provider | Model Default | Catatan |
|---|---|---|
| OpenAI | `gpt-4o-mini` | Butuh API Key dari platform.openai.com |
| Google Gemini | `gemini-2.0-flash` | Butuh API Key dari Google AI Studio |
| Qwen | `qwen-max` | Butuh API Key dari Alibaba Cloud DashScope |
| Claude (Anthropic) | `claude-sonnet-5` | Butuh API Key dari console.anthropic.com |

> 💡 **Kolom Model** di Settings & AI Studio berupa dropdown berisi daftar model bawaan tiap provider — pilih salah satu dari daftarnya.

> 🔑 API Key Anda **hanya disimpan di localStorage browser Anda sendiri** (Personal Mode) — tidak pernah dikirim ke server Ponti Sheets, karena memang tidak ada server-nya.

---

## 15. Cara Export

Buka menu **Export** untuk mengunduh:

- **Database Context** → format JSON, Markdown, atau PDF.
- **Prompt terakhir** → format TXT.
- **Seluruh History** → format JSON.

Anda juga bisa export langsung dari halaman **Database Context** dan **Documentation** lewat tombol yang tersedia di masing-masing halaman.

---

## 16. Cara Build menjadi PWA

Ponti Sheets **sudah PWA secara default** — Anda tidak perlu build tambahan apa pun.

1. Deploy aplikasi ke hosting HTTPS (Netlify, Vercel, GitHub Pages, dll) — PWA butuh koneksi HTTPS (kecuali `localhost`).
2. Buka aplikasi lewat browser (Chrome/Edge/Safari).
3. **Di HP (Android/Chrome)**: akan muncul **banner "Install" otomatis di dalam aplikasi** begitu kriteria instalasi terpenuhi — cukup ketuk tombol **"Install"**. Kalau banner-nya tidak muncul/sudah ditutup, tetap bisa lewat menu ⋮ browser → "Add to Home Screen" / "Install App".
4. **Di iPhone (Safari)**: Apple sengaja tidak menyediakan prompt otomatis untuk PWA — Ponti Sheets akan menampilkan banner berisi instruksi manual: ketuk ikon **Share**, lalu pilih **"Add to Home Screen"**.
5. **Di desktop (Chrome/Edge)**: klik ikon **"Install"** di address bar (atau menu ⋮ → "Install Ponti Sheets").
6. Aplikasi akan terpasang seperti aplikasi native, bisa dibuka tanpa browser, dan tetap berfungsi offline untuk halaman yang sudah pernah dibuka (berkat `sw.js`).

> 💡 Ikon aplikasi sudah disediakan dalam format PNG di beberapa ukuran (`icon-192.png`, `icon-512.png`, `icon-maskable-512.png` untuk Android adaptive icon, dan `icon-apple-touch-180.png` untuk iOS) — semuanya sudah terdaftar di `manifest.json`, jadi tidak ada langkah tambahan yang perlu Anda lakukan supaya aplikasi bisa di-install.

---

## 17. Cara Build menjadi Android APK

Karena Ponti Sheets adalah PWA, Anda bisa membungkusnya menjadi APK **tanpa mengubah source code sama sekali**, menggunakan salah satu tool berikut:

**Opsi A — [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap) (resmi dari Google, disarankan):**
```bash
npm install -g @bubblewrap/cli
bubblewrap init --manifest=https://domain-anda.com/manifest.json
bubblewrap build
```
Hasilnya berupa file `.apk` (atau `.aab` untuk Play Store) yang siap dipasang di Android.

**Opsi B — [PWABuilder](https://www.pwabuilder.com/):**
1. Buka pwabuilder.com, masukkan URL Ponti Sheets yang sudah di-deploy.
2. Pilih platform **Android**.
3. Unduh paket APK yang dihasilkan.

> Ikon PNG (192×192, 512×512, dan versi maskable) sudah disediakan di `assets/icons/` dan terdaftar di `manifest.json` — tidak perlu digenerate manual lagi. Kalau Anda ingin mengganti dengan branding sendiri, cukup timpa file-file PNG tersebut dengan ukuran yang sama.

---

## 18. Cara Build menjadi Windows EXE

**Opsi A — [PWABuilder](https://www.pwabuilder.com/) (paling mudah):**
1. Masukkan URL Ponti Sheets yang sudah di-deploy.
2. Pilih platform **Windows**.
3. Unduh paket, lalu jalankan installer yang dihasilkan (MSIX).

**Opsi B — [Electron](https://www.electronjs.org/) (untuk kontrol lebih besar):**
```bash
npm install -g electron electron-packager
# Buat wrapper Electron sederhana yang me-load index.html Ponti Sheets
electron-packager . PontiSheets --platform=win32 --arch=x64
```

Kedua opsi ini **tidak mengubah source code utama** — mereka hanya membungkus aplikasi web yang sama menjadi aplikasi desktop.

---

## 19. FAQ

**Q: Saya orang awam & bingung dengan istilah teknis di aplikasi ini, harus mulai dari mana?**
A: Buka menu **📖 Panduan Penggunaan** di sidebar (posisinya persis di bawah Dashboard) — halaman itu ditulis khusus untuk pengguna yang belum familiar dengan istilah teknis, lengkap dengan alur pemakaian singkat dan kamus istilah yang bisa dicari langsung dari dalam aplikasi.

**Q: Apakah data spreadsheet saya dikirim ke server Ponti Sheets?**
A: Tidak. Ponti Sheets tidak memiliki server sama sekali. Semua komunikasi hanya terjadi antara browser Anda dan Google API / API AI Provider yang Anda pilih sendiri.

**Q: Kenapa saya harus login Google sebelum bisa buka Dashboard sama sekali?**
A: Sejak fitur multi-user (Login Gate) ditambahkan, login Google berfungsi ganda: sebagai izin akses Sheets/Drive, DAN sebagai identitas yang menentukan "ruang data" Anda (Settings, API Key, History) — supaya beberapa orang bisa memakai device yang sama tanpa saling melihat data satu sama lain. Karena tidak ada sistem akun terpisah (Ponti Sheets tidak punya server), Google Login-lah yang jadi satu-satunya cara membedakan "siapa yang sedang pakai".

**Q: Apakah data saya benar-benar terpisah dari orang lain yang login di device yang sama?**
A: Ya, secara penyimpanan (localStorage) datanya dipisah per akun Google. Tapi ini bukan enkripsi/keamanan tingkat server — siapa pun yang punya akses ke browser/device yang sama (mis. lewat DevTools) secara teknis bisa melihat data akun lain yang tersimpan di situ. Cocok untuk pemakaian tim kecil/keluarga yang saling percaya, bukan untuk memisahkan data secara aman dari pihak yang tidak dipercaya.

**Q: Apakah saya wajib mengisi semua API Key (OpenAI, Gemini, Qwen, Claude)?**
A: Tidak. Isi hanya provider yang ingin Anda pakai. Anda bisa mengganti provider aktif kapan saja di menu Settings atau Prompt Builder.

**Q: Kenapa beberapa kolom terdeteksi dengan confidence rendah?**
A: Confidence rendah biasanya terjadi karena sample data terlalu sedikit, campuran tipe data dalam satu kolom, atau penamaan kolom yang ambigu. Periksa kembali data & penamaan header Anda untuk hasil lebih akurat.

**Q: Apakah Ponti Sheets bisa mengubah/menghapus isi spreadsheet saya?**
A: Ponti Sheets meminta izin read-write ke Google Sheets — tapi secara perilaku, aplikasi ini **hanya menulis** saat Anda menekan tombol "Generate Google Sheets" di Database Builder atau "Terapkan Perubahan" di Schema Editor. Fitur lain (Analyze, Database Context, ERD, Prompt Builder) tetap murni membaca data Anda dan tidak pernah mengubah apa pun.

**Q: Apa bedanya Database Builder dengan mengunggah spreadsheet yang sudah ada?**
A: Database Builder **membuat** struktur baru dari nol berdasarkan instruksi Anda (cocok kalau belum punya data). Menu Spreadsheet biasa dipakai untuk **menganalisis** struktur yang sudah ada. Keduanya bisa dipakai bergantian — hasil Database Builder pun bisa langsung dianalisis lagi lewat Analysis.

**Q: Bisakah saya menambahkan AI Provider lain selain OpenAI/Gemini/Qwen?**
A: Bisa. Berkat **Adapter Pattern** di folder `assets/js/adapters/`, Anda cukup membuat adapter baru dan mendaftarkannya di `adapter-factory.js` — tidak perlu mengubah kode di halaman lain.

**Q: Apakah aplikasi ini bisa dipakai tim/banyak orang sekaligus?**
A: Untuk saat ini (V1) didesain untuk pemakaian pribadi. Dukungan multi-user direncanakan di Versi 3, dan multi-tenant SaaS penuh di Versi 4.

---

## 20. Troubleshooting

| Masalah | Kemungkinan Penyebab & Solusi |
|---|---|
| Halaman putih / blank saat dibuka | Pastikan Anda membuka lewat web server (`http://localhost:...`), bukan lewat `file://`. ES Module tidak berjalan di `file://`. |
| Tidak bisa masuk sama sekali, selalu diminta login lagi | Sejak update Login Gate, semua halaman wajib login. Kalau layar login terus muncul walau sudah klik "Login dengan Google", cek Console browser (F12) untuk pesan error dari Google (biasanya soal origin/Client ID yang belum cocok). |
| Tombol "Login dengan Google" tidak berfungsi / error Client ID | Kalau Client ID belum diisi, Login Gate akan otomatis menampilkan form untuk mengisinya langsung — isi sesuai panduan di [Cara Login Google](#8-cara-login-google), dan pastikan origin Anda sudah ditambahkan di Google Cloud Console. Kalau sudah pernah diisi tapi errornya tentang izin/salah Client ID, hapus key `ponti_sheets.google_client_id` di DevTools (F12 → Application → Local Storage) lalu reload untuk mengisi ulang dari Login Gate. |
| Client ID hilang setelah update aplikasi | Client ID disimpan sebagai pengaturan **global** terpisah dari file kode maupun Settings per-akun — seharusnya tidak hilang lagi saat update. Jika Anda upgrade dari versi yang jauh lebih lama, Client ID lama Anda akan otomatis terdeteksi & dipindahkan saat pertama kali login. |
| Login sebagai akun A, tapi Settings/History yang muncul kosong/beda | Ini justru berperilaku benar — sejak fitur multi-user, setiap akun Google punya ruang data sendiri. Pastikan Anda login dengan akun Google yang sama seperti sebelumnya (cek nama/avatar di pojok kanan atas topbar). |
| Daftar spreadsheet kosong padahal ada banyak file di Drive | Pastikan Google Sheets API & Google Drive API sudah diaktifkan di Google Cloud Console project Anda. |
| Error "API Key belum diisi" di AI Studio | Buka menu Settings, isi API Key untuk provider yang dipilih, lalu klik Simpan. |
| Error dari OpenAI/Gemini/Qwen/Claude (401/403) | API Key salah, kadaluarsa, atau kuota habis. Periksa dashboard provider terkait. |
| Error dari Claude soal CORS / browser access | Ponti Sheets sudah menyertakan header `anthropic-dangerous-direct-browser-access` supaya API Claude bisa dipanggil langsung dari browser tanpa server perantara — kalau tetap gagal, kemungkinan API Key Anda dibatasi organisasi/policy tertentu di akun Anthropic Anda. |
| Deteksi tipe kolom / PK-FK kurang akurat | Analisis memakai *sample data* (maksimum 50 baris pertama). Pastikan baris awal data representatif dan header kolom jelas. |
| PWA tidak bisa di-install | PWA membutuhkan HTTPS (kecuali di `localhost`). Deploy ke hosting dengan HTTPS aktif, dan pastikan `manifest.json` + service worker (`sw.js`) berhasil dimuat (cek tab Application di DevTools). |
| Banner "Install" tidak muncul di HP Android | Browser (Chrome) baru memicu prompt instalasi setelah kriteria tertentu terpenuhi (kadang butuh kunjungan berulang) — kalau banner tidak muncul, tetap bisa install manual lewat menu ⋮ browser → "Add to Home Screen"/"Install App". Pastikan juga banner belum pernah Anda tutup (tersimpan selama 14 hari sejak ditutup). |
| Tidak ada prompt instalasi otomatis di iPhone | Ini normal — Safari/iOS sengaja tidak menyediakan prompt otomatis untuk PWA apa pun (bukan cuma Ponti Sheets). Install manual lewat ikon Share → "Add to Home Screen", atau ikuti instruksi di banner dalam aplikasi. |
| Data hilang setelah membersihkan cache browser | Seluruh data (history, settings, API key) tersimpan di `localStorage` browser, per akun Google — membersihkan data situs akan menghapus data SEMUA akun di device tersebut. Gunakan fitur Export secara berkala untuk mencadangkan hasil kerja Anda. |

---

## 21. Roadmap

- [x] **V1 — Personal Mode**: analisis spreadsheet, Database Context Engine, Prompt Builder, AI Studio, export, PWA.
- [ ] **V2 — Cloud Sync**: akun pengguna, sinkronisasi riwayat & pengaturan ke cloud.
- [ ] **V3 — Multi User**: kolaborasi, berbagi Database Context antar pengguna.
- [ ] **V4 — Multi Tenant SaaS**: workspace, organization, team, role & permission, subscription & billing, audit log.
- [ ] Template Generator: dukungan penuh **Telegram Bot** & **IoT Automation** (saat ini berstatus *Coming Soon*).
- [ ] Dukungan tambahan AI Provider baru lewat Adapter Pattern.

---

## 22. Changelog

Lihat [CHANGELOG.md](./CHANGELOG.md) untuk daftar perubahan lengkap tiap versi.

---

## 23. License

Proyek ini dirilis di bawah [Lisensi MIT](./LICENSE) — bebas digunakan, dimodifikasi, dan didistribusikan, termasuk untuk keperluan komersial, dengan tetap menyertakan atribusi.

---

<p align="center">Dibangun dengan ❤️ menggunakan HTML, Tailwind-style CSS murni, dan Vanilla JavaScript ES Modules — tanpa framework, tanpa build step, tanpa hardcode.</p>
