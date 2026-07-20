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

### Ditambahkan (1.5.8) — Panduan Penggunaan untuk Orang Awam
- **Menu baru "📖 Panduan Penggunaan"** — halaman bantuan berbahasa sederhana, ditempatkan tepat di bawah Dashboard (dan sebagai quick action pertama di Dashboard) supaya mudah ditemukan pengguna baru. Berisi:
  - Penjelasan singkat "Apa itu Ponti Sheets" tanpa jargon teknis.
  - Alur pemakaian 5 langkah dari login sampai generate aplikasi.
  - **Kamus istilah yang bisa dicari** — mencakup istilah umum (Spreadsheet, Sheet, Database), istilah login (OAuth, Google Client ID, API Key), istilah struktur database (PK, FK, Formula Aktif/Statis, Named Range, Data Validation, Conditional Formatting, ERD, Schema, Metadata), dan istilah AI (Prompt, Token, Blueprint) — semua dijelaskan dengan analogi sehari-hari.
  - Pertanyaan Umum dasar untuk pengguna yang benar-benar baru.
- Dikonfirmasi: input Google Client ID sudah tidak ada lagi di menu Settings (hanya bisa diisi/diganti lewat Login Gate) — README diperbarui menghapus sisa referensi lama soal ini.

### Ditambahkan (1.5.3) — Schema Editor: Desktop UX
- **Toolbar melekat (sticky)** di bagian atas — tombol "Terapkan Perubahan" tetap terlihat walau sedang scroll jauh ke bawah di antara banyak sheet.
- **Sheet bisa diciutkan (collapse)** — klik ikon ▾ di header kartu sheet untuk menyembunyikan detail kolomnya sementara, tampil ringkasan (jumlah kolom & conditional format) saja. Ada juga tombol "Ciutkan Semua" / "Perluas Semua" untuk fokus ke satu sheet dengan cepat.
- **Navigasi cepat antar sheet** — deretan pill nama sheet muncul di atas (kalau spreadsheet punya lebih dari 1 sheet), klik untuk langsung lompat & auto-expand ke sheet tersebut tanpa perlu scroll manual.

### Diubah (1.5.2) — Schema Editor: Polish UI
- **PK / FK / Wajib / Filter / Protect Header** sekarang tampil sebagai chip toggle berwarna (bukan checkbox polos) — PK pakai warna accent, FK pakai warna info, konsisten dengan badge yang sudah dipakai di Analysis/ERD.
- **Header kartu sheet dirombak**: nama sheet jadi input bergaya judul yang lebih menonjol, kontrol Warna Tab/Freeze Row/Filter/Protect Header dikelompokkan rapi dalam satu baris meta, tombol reorder/hapus sheet pindah ke pojok kanan atas.
- **Judul seksi** (Kolom, Conditional Formatting, Named Ranges) diberi ikon supaya lebih mudah dipindai sekilas.
- **Grup aksi kolom** dipisah dengan garis pembatas tipis antara tombol reorder (geser/↑/↓) dan tombol hapus (destruktif), mengurangi risiko salah klik.
- Toolbar atas diberi latar kartu supaya terasa sebagai control bar yang persisten, bukan menyatu dengan konten.

### Ditambahkan (1.5.1) — Schema Editor: Mobile & Interaksi
- **Mobile-friendly**: tabel kolom di Schema Editor otomatis berubah jadi daftar kartu bertumpuk di layar HP (bukan tabel lebar yang di-scroll horizontal).
- **Formula aktif vs statis**: tambah centang di kolom Formula — dicentang = formula sungguhan (nilai ikut berubah otomatis), tidak dicentang = simpan HASIL hitungannya saja sebagai nilai tetap, formula-nya sendiri tidak ditulis.
- **Drag-to-reorder kolom**: geser ikon ⠿ untuk mengurutkan ulang kolom secara langsung (mouse & sentuhan), selain tombol ↑/↓ yang sudah ada.
- Tombol **"Tambah Sheet Baru"** dipindah ke bagian bawah halaman (setelah semua kartu sheet) supaya tidak perlu scroll bolak-balik ke atas.

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

### Ditambahkan (post-1.0.0) — Schema Editor: 7 Revisi
1. **Loading state di tombol "Terapkan Perubahan"** — tombol terkunci & menampilkan spinner selama proses berlangsung, mencegah klik ganda sebelum penyimpanan selesai.
2. **Segitiga tombol ciutkan diperbesar** (▾/▸) supaya lebih mudah dilihat & disentuh.
3. **Formula Aktif otomatis**: checkbox tidak bisa dicentang kalau kolom Formula kosong (otomatis terkunci & tidak tercentang), dan otomatis tercentang begitu formula diisi (tetap bisa dibatalkan manual kalau ingin dibekukan jadi statis).
4. **Field baru "Editable"** (tri-state Unknown/TRUE/FALSE + keterangan kondisional opsional) — masuk ke Database Context sebagai petunjuk untuk AI soal apakah kolom boleh diedit manual di aplikasi yang dibangun.
5. **"Wajib" diganti nama jadi "Required"**, sekarang tri-state (Unknown/TRUE/FALSE) + keterangan kondisional, bukan checkbox biner lagi — juga masuk ke Database Context.
6. **Field baru "Show"** (tri-state + keterangan kondisional) — petunjuk untuk AI soal apakah kolom perlu ditampilkan di UI aplikasi.
7. **Posisi scroll dipertahankan** saat menambah/menghapus sheet, kolom, atau conditional format — halaman tidak lagi lompat ke atas setiap kali tombol ditekan.

Field Required/Editable/Show yang bernilai "Unknown" (default) memberi sinyal eksplisit ke AI untuk menyimpulkan sendiri berdasarkan konteks — sudah dijelaskan lengkap lewat bagian "Legend Field" di Prompt Builder.
- **PWA benar-benar installable di HP** — sebelumnya `manifest.json` cuma mendaftarkan ikon SVG, yang tidak memenuhi kriteria instalasi Chrome/Android (butuh PNG 192px & 512px) dan sama sekali tidak didukung iOS Safari untuk ikon Home Screen. Sekarang disediakan ikon PNG lengkap (192px, 512px, versi maskable untuk adaptive icon Android, dan versi khusus iOS) yang digambar ulang mengikuti desain asli.
- **Banner "Install App" di dalam aplikasi** — muncul otomatis begitu kriteria instalasi terpenuhi di Android/Chrome (tombol Install beneran memicu dialog instal native), atau instruksi manual "Tap Share → Add to Home Screen" di iOS Safari (Apple sengaja tidak menyediakan prompt otomatis di iOS). Bisa ditutup dan tidak akan muncul lagi selama 14 hari.
- **Claude (Anthropic) sebagai AI Provider baru** — bisa dipilih di Settings/Prompt Builder/AI Studio/Database Builder seperti provider lain, lewat Adapter Pattern yang sudah ada (tinggal 1 file baru + 1 baris registry, tidak menyentuh kode lain).
- **Input Model jadi autocomplete, bukan dropdown terkunci** — kolom Model di Settings sekarang kotak isian teks biasa dengan saran autofill (mirip Google Search) yang muncul saat mengetik, tapi tetap bisa diisi nama model apa pun (termasuk model baru yang belum ada di daftar saran).

### Dihapus (post-1.0.0)
- **Pengaturan Bahasa di Settings** — dihapus, aplikasi sepenuhnya berbahasa Indonesia.
- **❓ Menu "Panduan Penggunaan"** (baru) — halaman bantuan dalam bahasa sederhana untuk pengguna awam: alur pemakaian singkat, kamus istilah teknis yang bisa dicari (PK, FK, Formula, Named Range, OAuth, API Key, AI Provider, dll, dijelaskan pakai analogi sehari-hari), dan pertanyaan umum versi sederhana.

### Dihapus (post-1.0.0)
- **Input Google Client ID di menu Settings** — dihapus karena sudah tersedia di layar **Login Gate** (muncul otomatis kalau belum dikonfigurasi), menghindari duplikasi. Untuk mengganti Client ID yang sudah tersimpan, hapus key `ponti_sheets.google_client_id` lewat DevTools browser lalu reload.
- **Loading skeleton setelah login Google**: tombol "Login dengan Google" sekarang menampilkan spinner + status "Menghubungkan ke Google..." selama proses OAuth berlangsung, dan daftar spreadsheet menampilkan placeholder shimmer (bukan teks "Memuat..." polos) selagi diambil dari Google Drive.
- **Schema Editor**: tombol **"Buka Google Sheets"** di toolbar untuk langsung membuka spreadsheet aslinya di tab baru.
- **Schema Editor — Persistensi Tipe Kolom (perbaikan mendasar)**: tipe data, Primary Key, Foreign Key, label, dan deskripsi kolom kini disimpan sebagai **Developer Metadata** tersembunyi di spreadsheet-nya sendiri, bukan ditebak ulang dari data setiap kali dibuka. Sebelumnya, tipe seperti Currency/URL/UUID/Percentage/JSON/Array selalu "kembali" jadi tipe generik (Number/Text) setelah reload karena Google Sheets tidak punya konsep tipe kolom asli — sekarang apa pun yang di-set akan selalu diingat persis oleh Ponti Sheets.
- **Schema Editor**: mengubah **tipe data** atau **formula** sebuah kolom sekarang selalu memicu penulisan ulang data (sebelumnya, ubah tipe data saja tanpa tambah/hapus kolom tidak memicu apa-apa). Data yang sudah ada juga otomatis **dikonversi ke tipe barunya** — contoh: teks "15.000" jadi angka 15000 kalau diubah ke Number, "Ya"/"Tidak" jadi TRUE/FALSE kalau diubah ke Checkbox, tanggal berbagai format dinormalisasi ke YYYY-MM-DD. Kalau sebuah nilai tidak bisa dikonversi (format tidak dikenali), nilai aslinya dipertahankan apa adanya supaya tidak ada data hilang.

### Diperbaiki (post-1.0.0)
- **Named Range belum sampai ke Database Context & Prompt Builder**: datanya sebenarnya sudah diambil dari Google Sheets API sejak lama, tapi terputus sebelum masuk ke `database_context.json` (tersimpan mentah & terduplikasi di tiap sheet, tidak pernah benar-benar dipakai). Sekarang dikonversi ke bentuk siap-pakai `{name, sheet, range}` (notasi A1) di level spreadsheet, ikut masuk ke Database Context, dan dijelaskan ke AI lewat Prompt Builder supaya AI bisa memanfaatkan named range yang sudah ada saat menulis kode/formula.
- **Prompt Builder tidak konsisten dengan Database Context**: field `formula`/`formulaIsLive` yang baru ditambahkan ke Database Context ternyata ikut terhapus lagi saat Prompt Builder mengompres context untuk prompt (fungsi `compressContext` membangun objek kolom baru tanpa field itu). Sekarang ikut terbawa.
- **Prompt Builder — AI berpotensi salah paham field singkatan**: JSON Database Context yang dikirim ke AI memakai singkatan (`pk`, `fk`, `ref`, `live`) tanpa penjelasan sama sekali. Sekarang Prompt Builder otomatis menyertakan bagian "Legend Field" di setiap prompt yang menjelaskan arti tiap singkatan itu ke AI, termasuk daftar kemungkinan nilai `type` dan cara memperlakukan kolom formula aktif vs statis.
- **README**: menghapus referensi field "Development Mode" di bagian Cara Menggunakan Prompt Builder — field itu sudah dihapus dari UI sejak beberapa update lalu tapi dokumentasinya belum ikut diperbarui.
- **Formula aktif/statis belum muncul di Database Context**: centang "Formula Aktif" di Schema Editor sudah tersimpan, tapi belum ikut terbaca oleh Analysis Engine & Database Context (keduanya punya jalur baca terpisah dari Schema Editor). Sekarang info `formula` & `formulaIsLive` disimpan lengkap di metadata, dibaca oleh Analysis Engine, dan ikut muncul di `database_context.json` serta tabel kolom di halaman Analysis (dengan badge "Aktif"/"Statis").
- **Schema Editor (akar masalah kolom Validasi/FK/Formula/Aksi tampak kosong)**: `display: flex` sempat dipasang LANGSUNG di elemen `<td>` supaya beberapa kontrol (dropdown validasi, checkbox FK, dll) tersusun rapi — tapi ini bikin browser salah menghitung lebar kolom tabel (`table-layout: auto` tidak tahu cara mengukur konten flex dengan benar), sehingga kolom itu bisa mengempis nyaris nol lebar dan tampak kosong. Sekarang flex-nya dipindah ke elemen `<div>` pembungkus di DALAM sel, bukan di sel itu sendiri — sel tabel tetap `table-cell` biasa yang diukur dengan benar oleh browser.
- **Schema Editor (bug tampilan)**: tabel Kolom sempat pakai `table-layout: fixed` dengan lebar kolom dipatok persentase — begitu banyak kontrol baru ditambahkan (chip toggle, checkbox formula, dll), beberapa kolom (termasuk Validasi) jadi keremuk nyaris tak terlihat. Diganti dengan strategi lebar minimum per kolom + kontainer scroll horizontal khusus untuk tabelnya saja, supaya tetap rapi di berbagai lebar layar tanpa ada kolom yang "hilang".
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
