# Changelog

Semua perubahan penting pada proyek ini didokumentasikan di file ini.
Format mengacu pada [Keep a Changelog](https://keepachangelog.com/) dan proyek ini
mengikuti [Semantic Versioning](https://semver.org/).

## [1.0.0] - Versi 1 — Personal Mode

### Ditambahkan
- Presentation Layer: Dashboard, Spreadsheet, Analysis, Database Context, Prompt Builder,
  AI Studio, Documentation, History, Export, dan Settings.
- Google OAuth login (Google Identity Services) dengan izin read-only ke Sheets & Drive.
- **Analysis Engine**: deteksi tipe kolom (15 tipe), Primary Key & Foreign Key dengan
  confidence score, ekstraksi formula asli beserta metadata, pemeriksaan kualitas data,
  dan deteksi jenis bisnis otomatis (14 kategori).
- **Database Context Engine**: menghasilkan `database_context.json` yang ringkas namun kaya
  informasi (metadata, kolom, relasi, business rules, statistik, rekomendasi).
- **Prompt Builder**: penyusunan prompt otomatis dari Database Context + Business Rules +
  Formula + Relationship + Template + instruksi pengguna, dilengkapi Smart Prompt Optimizer
  (context compression, JSON optimization) dan Token Estimator.
- **AI Studio**: Adapter Pattern untuk OpenAI, Google Gemini, dan Qwen — mudah ditambah
  provider baru.
- **Template Generator**: template Web App (Google Apps Script), Android APK (PWA), dan
  Windows EXE (PWA) berstatus tersedia; Telegram Bot & IoT Automation berstatus Coming Soon.
- **Export**: Markdown, JSON, TXT, dan PDF (via print).
- **History**: penyimpanan riwayat prompt & response secara lokal.
- **PWA**: dukungan offline, installable, caching lewat Service Worker.
- Command Palette (⌘K / Ctrl+K) untuk navigasi cepat.
- Dark mode & Light mode.
- Storage Layer berbasis abstraksi (Local Driver) yang siap diganti driver cloud tanpa
  mengubah Business Layer.

### Arsitektur
- Pemisahan Presentation / Business / Data / AI / Storage / Configuration / Authentication
  Layer sejak awal, disiapkan untuk roadmap Cloud Sync (V2), Multi User (V3), dan
  Multi Tenant SaaS (V4).

---

## [Unreleased] — Rencana Versi Mendatang

Lihat bagian [Roadmap](./README.md#21-roadmap) di README untuk rencana lengkap V2–V4.

### Ditambahkan (1.5.0) — 🔒 Multi-User / Login Gate
- **Login Gate wajib**: seluruh halaman (termasuk Dashboard) sekarang mengharuskan login Google terlebih dahulu — tidak ada lagi akses tanpa login. Login Google berfungsi ganda: izin akses Sheets/Drive API, DAN identitas aplikasi.
- **Data terpisah per akun Google**: Settings, API Key AI, dan History sekarang otomatis terpisah per akun Google yang login (disimpan dengan namespace `user_{id}.*` di localStorage) — beberapa orang bisa memakai device/browser yang sama tanpa saling melihat data satu sama lain.
- **Google Client ID jadi pengaturan global**: dipisah dari Settings per-akun, supaya bisa diisi langsung dari Login Gate (form inline muncul otomatis kalau belum dikonfigurasi) tanpa perlu login dulu untuk mengaksesnya — menghindari jalan buntu ayam-telur.
- **Migrasi data lama otomatis (sekali jalan)**: pengguna yang sudah lama pakai Ponti Sheets sebelum fitur ini (Settings, API Key, History-nya) tidak kehilangan data — otomatis dipindahkan ke akun Google pertama yang login setelah update, ditandai dengan flag supaya tidak terulang untuk akun berikutnya.
- Logout sekarang mengembalikan ke Login Gate sepenuhnya (bukan cuma pindah halaman), memastikan shell aplikasi tidak "nyangkut" dalam kondisi seolah masih login.

### Diperbaiki (1.5.0)
- **Router**: mencegah listener `hashchange`/keydown menumpuk kalau aplikasi di-boot ulang berkali-kali dalam satu sesi browser (mis. siklus logout → login berulang) — sebelumnya berpotensi memicu render halaman berkali-kali lipat setelah beberapa kali ganti akun.
- **README**: memperbaiki klaim usang "izin read-only" di bagian Cara Login Google yang sebenarnya sudah berubah jadi read-write sejak Database Builder ditambahkan.

### Ditambahkan (1.2.0)
- **🛠️ Schema Editor (baru)** — edit struktur database Google Sheets yang **sudah ada** langsung dari Ponti Sheets:
  - **Schema Reader**: membaca struktur live spreadsheet (header, tipe kolom, data validation, formula contoh, conditional formatting, protected range, named range, tab color, freeze row, filter) menjadi model yang bisa diedit.
  - **Editor tabel per-kolom**: tambah/hapus/rename/reorder kolom & sheet, ubah tipe data, formula, validasi (list/number/date/checkbox/email/phone), relasi Foreign Key (dengan dropdown FK asli via data validation ONE_OF_RANGE), conditional formatting, named range, tab color, freeze row, filter, dan protect header — semua inline-editable dalam satu halaman.
  - **Sync Engine**: menulis perubahan balik ke Google Sheets asli sambil mempertahankan data yang tidak berubah; sheet yang strukturnya berubah ditulis ulang penuh (aman dari kesalahan index), sheet yang tidak berubah tidak disentuh.
  - **Layar konfirmasi destruktif**: setiap penghapusan sheet/kolom menampilkan daftar persis apa yang akan hilang dan wajib dikonfirmasi eksplisit sebelum diterapkan.
  - Terintegrasi dengan alur lama — setelah berhasil, bisa langsung "Analisis Ulang" tanpa upload ulang.

### Diubah (1.2.0)
- Refactor internal: helper Sheets API (validasi, conditional format, named range, penggeseran formula) dipindah ke modul bersama (`sheets-format.util.js`, `formula-shift.util.js`) supaya dipakai bersama oleh Database Builder & Schema Editor (DRY).

### Ditambahkan (1.1.0)
- **✨ Database Builder (baru)** — modul AI untuk merancang & membuat struktur database Google Sheets/Excel dari nol berdasarkan instruksi pengguna:
  - **Blueprint Engine**: prompt AI strict-JSON-only + parser/normalizer (`database_blueprint.json`) yang toleran terhadap format respons AI yang tidak sempurna.
  - **Preview Blueprint**: ringkasan statistik, kartu per sheet (kolom, tipe data, PK/FK, formula, validasi), business rules, dan rekomendasi.
  - **Google Sheets Generator**: membuat spreadsheet baru nyata lewat Google Sheets API — header, formula asli, dummy data berelasi, freeze row, filter, tab color, data validation, conditional formatting, protected range, dan named range.
  - **Excel Generator**: membuat file `.xlsx` (via ExcelJS, dimuat dari CDN saat dibutuhkan) dengan fitur setara — multi-sheet, formula, freeze pane, filter, data validation, conditional formatting, auto width kolom.
  - 6 template bawaan (POS, CRM, HRIS, Inventory Management, Restoran, Sekolah) + mode Custom bebas.
  - Terintegrasi penuh dengan fitur lama — hasil "Generate Google Sheets" bisa langsung dianalisis lewat tombol "Analisis Sekarang" tanpa upload ulang.

### Diubah (1.1.0)
- **Izin OAuth Google diperluas** dari read-only menjadi read-write (`spreadsheets` scope) — dibutuhkan agar Database Builder bisa membuat spreadsheet baru. Fitur lain tetap berperilaku read-only.

### Dihapus (post-1.0.0)
- **Deteksi Jenis Bisnis otomatis** (di Analysis, Database Context, Documentation) — dihapus karena dianggap tidak terlalu penting/akurat. `business-detector.service.js` dihapus, field `businessType` tidak lagi ada di `database_context.json`.
- **Template Bisnis** (POS/CRM/HRIS/Inventory Management/Restoran/Sekolah/Custom) di Database Builder — dihapus. Sekarang cukup tulis instruksi bebas di kolom teks; AI tetap bisa memahami jenis bisnis dari instruksi Anda tanpa perlu memilih template.

### Ditambahkan (post-1.0.0)
- **Loading skeleton setelah login Google**: tombol "Login dengan Google" sekarang menampilkan spinner + status "Menghubungkan ke Google..." selama proses OAuth berlangsung, dan daftar spreadsheet menampilkan placeholder shimmer (bukan teks "Memuat..." polos) selagi diambil dari Google Drive.
- **Schema Editor**: tombol **"Buka Google Sheets"** di toolbar untuk langsung membuka spreadsheet aslinya di tab baru.
- **Schema Editor — Persistensi Tipe Kolom (perbaikan mendasar)**: tipe data, Primary Key, Foreign Key, label, dan deskripsi kolom kini disimpan sebagai **Developer Metadata** tersembunyi di spreadsheet-nya sendiri, bukan ditebak ulang dari data setiap kali dibuka. Sebelumnya, tipe seperti Currency/URL/UUID/Percentage/JSON/Array selalu "kembali" jadi tipe generik (Number/Text) setelah reload karena Google Sheets tidak punya konsep tipe kolom asli — sekarang apa pun yang di-set akan selalu diingat persis oleh Ponti Sheets.
- **Schema Editor**: mengubah **tipe data** atau **formula** sebuah kolom sekarang selalu memicu penulisan ulang data (sebelumnya, ubah tipe data saja tanpa tambah/hapus kolom tidak memicu apa-apa). Data yang sudah ada juga otomatis **dikonversi ke tipe barunya** — contoh: teks "15.000" jadi angka 15000 kalau diubah ke Number, "Ya"/"Tidak" jadi TRUE/FALSE kalau diubah ke Checkbox, tanggal berbagai format dinormalisasi ke YYYY-MM-DD. Kalau sebuah nilai tidak bisa dikonversi (format tidak dikenali), nilai aslinya dipertahankan apa adanya supaya tidak ada data hilang.

### Diperbaiki (post-1.0.0)
- **Dark mode**: teks nama spreadsheet di menu Spreadsheet, teks di kartu quick-action Dashboard, dan ikon tombol hamburger menu di HP sempat tampil **hitam** di mode gelap (elemen `<button>` tanpa warna teks eksplisit ikut memakai warna default browser, bukan warna tema aplikasi). Sekarang semuanya eksplisit mengikuti tema aktif.
- **Router (bug fundamental, penyebab "harus refresh dulu")**: browser tidak memicu event `hashchange` kalau URL hash-nya SAMA dengan yang sedang dibuka — jadi kalau Anda "pindah" ke halaman yang sebenarnya sedang Anda buka juga (contoh paling umum: klik Login di halaman Spreadsheet, lalu kode mencoba pindah ke halaman Spreadsheet lagi setelah berhasil login), halaman tidak pernah ter-render ulang secara otomatis meski data-nya (mis. status login) sudah berubah — harus refresh manual. Sekarang navigasi ke route yang sama tetap memicu render ulang secara manual.
- **Schema Editor (bug kritis, penyebab validasi/format "tidak berubah")**: `schemaSyncService.apply()` mengembalikan bentuk `{ blueprint, warnings }`, tapi halaman Schema Editor masih memperlakukan hasilnya seolah objek blueprint langsung — menyebabkan proses reload state di halaman gagal diam-diam setelah Terapkan Perubahan, walau sebagian perubahan sudah tersimpan di backend. Sekarang bentuknya di-unwrap dengan benar.
- **Schema Editor**: setiap KATEGORI formatting (validasi, filter, conditional formatting, protected range, auto-resize, named range) sekarang dikirim sebagai batchUpdate **terpisah**, bukan digabung jadi satu paket besar. Sebelumnya, Google Sheets batchUpdate bersifat all-or-nothing — kalau satu request kecil di dalamnya gagal (mis. named range dengan nama bentrok), SEMUA request lain dalam paket yang sama ikut dibatalkan tanpa terkecuali, termasuk validasi yang sebenarnya valid. Sekarang tiap kategori berdiri sendiri, dan kalau ada kategori yang gagal, Anda akan melihat **peringatan detail** di halaman (bukan gagal diam-diam) sementara kategori lain yang berhasil tetap tersimpan.
- **Schema Editor (bug)**: memilih tipe validasi **"List"** atau **"Number"** tidak tersimpan kalau pengguna tidak sempat mengetik apa pun di kolom opsi/min/max tambahannya — validasi baru benar-benar dicatat begitu ada input yang diketik. Sekarang validasi langsung dicatat begitu tipe dipilih dari dropdown, tidak perlu mengetik apa pun lagi supaya perubahannya tersimpan saat "Terapkan Perubahan".
- **Analysis & Database Context tidak konsisten dengan Schema Editor**: sebelumnya, Analysis Engine selalu MENEBAK ULANG tipe kolom, Primary Key, dan Foreign Key dari data mentah lewat heuristik — mengabaikan tipe/PK/FK yang sudah Anda tentukan persis lewat Schema Editor. Sekarang Analysis (dan otomatis Database Context, ERD, Documentation yang berasal darinya) SELALU mengikuti apa yang sudah tersimpan dari Schema Editor terlebih dahulu, baru jatuh ke tebakan heuristik untuk kolom yang belum pernah diatur. Klik "Analyze" ulang setelah mengedit di Schema Editor untuk melihat hasilnya konsisten.
- **Schema Editor (bug)**: menghapus formula sebuah kolom sempat "kembali muncul" setelah diterapkan — penyebabnya, data lama diambil dalam mode yang mengembalikan teks formula asli (bukan hasil hitungannya), jadi teks formula lama ikut tertulis ulang dan otomatis dieksekusi lagi oleh Google Sheets. Sekarang saat formula dihapus, nilai HASIL HITUNGAN terakhirnya dipakai sebagai nilai statis, bukan teks formulanya.
- **Schema Editor (kritis, akar masalah "Gagal menerapkan perubahan struktur")**: `schemaSyncService.apply()` sempat mengembalikan objek pembungkus `{ blueprint, spreadsheetUrl }` alih-alih isi blueprint-nya langsung — padahal perubahan sudah tersimpan sukses ke Google Sheets, halaman gagal menampilkan ulang hasilnya karena struktur datanya tidak sesuai. Sekarang dikembalikan dengan benar.
- **Schema Editor & Database Builder (kritis)**: memperbaiki bug yang membuat "Terapkan Perubahan" SELALU gagal untuk sheet yang tidak punya warna tab kustom (kasus paling umum) — field mask sempat menyebut "tabColor" padahal nilainya kosong, yang ditolak Google API. Sekarang field mask dibangun dinamis, hanya menyebut field yang benar-benar punya nilai.
- **Schema Editor**: memperbaiki 3 bug pada Sync Engine — (1) rename sheet + perubahan kolom sekaligus sempat gagal karena kode masih mencoba membaca data dari nama sheet lama yang sudah tidak ada; (2) menghapus filter pada sheet yang memang belum pernah punya filter sempat ditolak Google API; (3) dropdown Foreign Key sempat selalu mengasumsikan Primary Key berada di kolom A, sekarang mencari posisi kolom PK yang sebenarnya.
- **Database Builder**: memperbaiki error "Unsupported locale: id_ID" saat membuat spreadsheet baru — Google Sheets API tidak menerima locale tersebut lewat endpoint `create`, jadi properti locale dihapus dan dibiarkan mengikuti default akun Google pengguna (timezone Asia/Jakarta tetap diterapkan).
- **Mobile UX dirombak**: drawer sidebar kini punya backdrop gelap (tap di luar untuk menutup) dan otomatis menutup setelah memilih menu; target sentuh tombol/ikon diperbesar (~40px); input tidak lagi memicu auto-zoom di Safari iOS; tabel lebar bisa di-scroll horizontal alih-alih memaksa kolom mengecil; toast & command palette menyesuaikan lebar layar; padding memperhitungkan safe-area notch/home-indicator; warna address bar (theme-color) ikut berubah sesuai tema.
- **Google Client ID** kini disimpan lewat menu **Settings → Google OAuth** (localStorage), bukan lagi di-hardcode di `app.config.js`. Ini mencegah Client ID hilang setiap kali Anda mengganti/update file aplikasi. `app.config.js` tetap didukung sebagai fallback opsional untuk deployment permanen.
- **Prompt Builder**: menghapus field "Development Mode" (disederhanakan), tombol Copy Prompt kini memberi feedback visual.
- **AI Studio**: layout dirapikan — prompt terkirim kini collapsible/ringkas (default tersembunyi), Response AI jadi fokus utama halaman, ditambahkan tombol Copy Response & indikator provider/model aktif.
- **Menu ERD (baru)**: visualisasi diagram relasi antar sheet (Entity Relationship Diagram) berbasis SVG, lengkap dengan kontrol zoom, legenda PK/FK, dan export ke file `.svg`. Dapat diakses dari sidebar maupun tautan cepat di halaman Database Context & Documentation.
