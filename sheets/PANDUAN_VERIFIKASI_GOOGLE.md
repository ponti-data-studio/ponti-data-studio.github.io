# Panduan Verifikasi Google OAuth (Mode Production + Verified)

> Dokumen terpisah dari `README.md` utama karena topik ini cukup dalam dan teknis — silakan simpan/bagikan file ini kalau Anda (atau tim) berencana membawa Ponti Sheets dari mode **Testing** (maks. 100 user) ke mode **Production + Verified** (tanpa batas user, tanpa peringatan "Unverified App").

---

## Daftar Isi

1. [Kapan Anda Benar-Benar Butuh Ini](#1-kapan-anda-benar-benar-butuh-ini)
2. [⚠️ Hal Paling Penting: Cek Ulang Scope Anda Dulu](#2-️-hal-paling-penting-cek-ulang-scope-anda-dulu)
3. [Persiapan Sebelum Submit](#3-persiapan-sebelum-submit)
4. [Langkah-Langkah Submit Verifikasi](#4-langkah-langkah-submit-verifikasi)
5. [Video Demo: Cara Membuatnya](#5-video-demo-cara-membuatnya)
6. [Kalau Kena Restricted Scope: Proses CASA](#6-kalau-kena-restricted-scope-proses-casa)
7. [Timeline & Estimasi Biaya](#7-timeline--estimasi-biaya)
8. [Setelah Lolos Verifikasi](#8-setelah-lolos-verifikasi)
9. [Kesalahan Umum yang Bikin Ditolak](#9-kesalahan-umum-yang-bikin-ditolak)
10. [FAQ](#10-faq)

---

## 1. Kapan Anda Benar-Benar Butuh Ini

Verifikasi **wajib** dilakukan kalau:
- Aplikasi Anda akan dipakai oleh **lebih dari 100 orang**, ATAU
- Anda ingin menghilangkan layar peringatan **"Google hasn't verified this app"** yang cukup menakutkan buat pengguna awam, ATAU
- Anda ingin sesi login pengguna **tidak lagi kedaluwarsa paksa setiap 7 hari** (ini kebijakan Google khusus untuk app yang belum diverifikasi, di luar kendali kode aplikasi).

Kalau pengguna Ponti Sheets Anda **cuma tim kecil/keluarga (di bawah 100 orang)** dan tidak keberatan login ulang tiap minggu, Anda **tidak wajib** melalui proses ini — mode Testing biasa sudah cukup. Proses verifikasi ini cukup panjang (bisa berminggu-minggu) dan untuk sebagian kasus **berbayar**, jadi pastikan dulu memang butuh sebelum lanjut.

> 💡 **Alternatif lebih cepat**: kalau semua pengguna Anda memakai akun **Google Workspace** dari organisasi yang sama, pertimbangkan mode **"Internal"** di OAuth Consent Screen — tidak ada batas user, tidak ada expired 7 hari, **tidak perlu verifikasi sama sekali**. Cuma berlaku kalau semua orang satu organisasi Workspace, bukan akun Gmail pribadi campur-campur.

---

## 2. ⚠️ Hal Paling Penting: Cek Ulang Scope Anda Dulu

Google mengelompokkan scope OAuth ke 3 tingkat, dan tingkatnya **sangat memengaruhi** seberapa berat proses verifikasinya:

| Tingkat | Butuh Apa | Scope Google Sheets/Drive yang termasuk |
|---|---|---|
| **Non-sensitive** | Verifikasi dasar saja (cepat, gratis) | `drive.file` (cuma file yang dibuat/dipilih lewat app ini) |
| **Sensitive** | Verifikasi Google + justifikasi tertulis + video demo (gratis, ~10 hari kerja) | `spreadsheets`, `spreadsheets.readonly` |
| **Restricted** | Semua syarat Sensitive **DITAMBAH** audit keamanan CASA (berbayar, bisa berminggu-minggu) | `drive.readonly`, `drive` (akses penuh) |

**Ponti Sheets secara default memakai scope berikut** (lihat `assets/js/config/app.config.js` → `GOOGLE_CONFIG.scopes`):

```
https://www.googleapis.com/auth/spreadsheets       ← Sensitive
https://www.googleapis.com/auth/drive.readonly     ← RESTRICTED ⚠️
```

Artinya **kalau Anda submit apa adanya, Anda akan kena jalur Restricted** — proses paling berat & satu-satunya yang berbayar (audit CASA, lihat [bagian 6](#6-kalau-kena-restricted-scope-proses-casa)).

### 💡 Rekomendasi: Pertimbangkan Ganti ke `drive.file`

Scope `drive.readonly` dipakai Ponti Sheets untuk **menampilkan daftar semua spreadsheet** di Google Drive Anda (di menu Spreadsheet, supaya Anda tinggal pilih dari daftar). Kalau scope ini diganti ke `drive.file` (Non-sensitive), Ponti Sheets **hanya bisa melihat spreadsheet yang**:
- Dibuat lewat Ponti Sheets sendiri (mis. dari Database Builder), atau
- Dipilih secara eksplisit oleh Anda lewat **Google Picker** (jendela pilih-file resmi dari Google, bukan daftar otomatis dari Drive).

**Konsekuensinya**: menu "Pilih Spreadsheet" tidak lagi menampilkan daftar otomatis semua file Drive Anda — Anda perlu memilih file lewat jendela Picker Google (mirip saat upload file ke Google Drive dari aplikasi lain). Sedikit langkah ekstra, tapi:
- ✅ Menghindari audit CASA yang berbayar & lama sepenuhnya
- ✅ Proses verifikasi jadi jauh lebih cepat (cuma jalur Sensitive untuk `spreadsheets`)
- ✅ Lebih baik untuk privasi pengguna juga (aplikasi tidak bisa "mengintip" daftar semua file Drive Anda)

**Ini perubahan KODE, bukan cuma pengaturan Google Cloud Console** — kalau Anda mau, saya bisa bantu implementasikan integrasi Google Picker API untuk menggantikan cara pilih spreadsheet saat ini. Beri tahu saya kalau tertarik, ini pekerjaan terpisah dari sekadar mengurus verifikasinya.

Kalau Anda tetap memilih mempertahankan `drive.readonly` (mis. karena kenyamanan daftar otomatis lebih penting), lanjutkan ke bagian berikutnya seperti biasa — cuma perlu diingat akan ada langkah CASA tambahan di bagian 6.

---

## 3. Persiapan Sebelum Submit

Siapkan semua ini **sebelum** mulai submit form verifikasi, supaya prosesnya tidak bolak-balik ditolak karena kurang lengkap:

### 3.1 Domain resmi (bukan localhost)
- Google mewajibkan aplikasi Anda punya **domain sendiri yang sudah diverifikasi kepemilikannya** lewat [Google Search Console](https://search.google.com/search-console).
- Domain ini harus sama dengan yang didaftarkan di **Authorized JavaScript origins** OAuth Client ID Anda (mis. `https://pontidata.id`).

### 3.2 Halaman publik yang wajib ada
Siapkan 3 halaman ini, bisa diakses publik tanpa login, di domain Anda:

1. **Homepage aplikasi** — halaman yang menjelaskan apa itu Ponti Sheets, untuk apa, dan cara pakainya secara umum (bisa memakai isi `README.md` sebagai bahan).
2. **Privacy Policy (Kebijakan Privasi)** — wajib menjelaskan:
   - Data apa yang diakses (spreadsheet Google Sheets pengguna)
   - Untuk apa data itu dipakai (analisis struktur, dikirim ke AI provider pilihan pengguna sendiri)
   - Bagaimana data disimpan (localStorage browser pengguna, TIDAK ada server Ponti Sheets yang menyimpan data)
   - Cara pengguna mencabut akses (lewat [myaccount.google.com/permissions](https://myaccount.google.com/permissions))
3. **Terms of Service (Syarat & Ketentuan)** — opsional tapi disarankan, terutama kalau aplikasi dipakai lebih dari sekadar personal.

> 💡 Karena Ponti Sheets tidak punya server/database sendiri (100% client-side), Privacy Policy Anda sebenarnya cukup sederhana untuk ditulis — inti pesannya adalah "data Anda tidak pernah meninggalkan browser Anda kecuali ke Google API dan API AI provider yang ANDA pilih sendiri". Kejujuran ini justru mempercepat proses review Google.

### 3.3 Branding OAuth Consent Screen
Di Google Cloud Console → **APIs & Services → OAuth consent screen → Branding**, lengkapi:
- **App name**: "Ponti Sheets" (bukan nama teknis/project ID)
- **App logo**: minimal 120×120px, format PNG/JPG (bisa pakai `assets/icons/icon-512.png` yang sudah ada di project ini)
- **App domain**: domain homepage, privacy policy, terms of service
- **Authorized domains**: domain Anda (mis. `pontidata.id`)
- **Developer contact information**: email yang aktif dipantau (Google akan menghubungi lewat sini kalau ada pertanyaan review)

### 3.4 Deklarasi scope yang jujur & minim
Di tab **Data Access**, deklarasikan scope yang BENAR-BENAR dipakai (jangan lebih):
- `https://www.googleapis.com/auth/spreadsheets`
- `https://www.googleapis.com/auth/drive.readonly` (atau `drive.file` kalau sudah diganti, lihat bagian 2)
- `https://www.googleapis.com/auth/userinfo.email`
- `https://www.googleapis.com/auth/userinfo.profile`

---

## 4. Langkah-Langkah Submit Verifikasi

1. Buka **Google Cloud Console → APIs & Services → OAuth consent screen**.
2. Pastikan semua bagian di [bagian 3](#3-persiapan-sebelum-submit) sudah lengkap dan tersimpan (Branding, Audience, Data Access, Contact Information).
3. Klik **"Publish App"** — status berubah dari **Testing** ke **In Production**.
4. Karena Ponti Sheets memakai sensitive/restricted scope, akan muncul tombol/link **"Prepare for Verification"** atau **"Submit for Verification"** — klik itu.
5. Lengkapi form verifikasi:
   - **Justifikasi tiap scope** — jelaskan APA fungsinya dan KENAPA dibutuhkan. Contoh untuk `spreadsheets`:
     > "Ponti Sheets membaca struktur spreadsheet pengguna (nama sheet, kolom, formula) untuk membangun 'database context' yang dipakai menyusun prompt AI. Fitur Database Builder & Schema Editor juga menulis balik struktur baru/perubahan ke spreadsheet atas perintah eksplisit pengguna."
   - **Video demo** — lihat [bagian 5](#5-video-demo-cara-membuatnya).
   - **Link Privacy Policy & Homepage** — isi URL yang sudah disiapkan.
6. Klik **Submit**. Anda akan menerima email konfirmasi dari Google (tim `Trust & Safety` / `OAuth API Compliance`).
7. Tunggu review — biasanya Google akan membalas lewat email dalam beberapa hari kerja, kadang meminta klarifikasi/perbaikan (wajar, jangan panik, cukup jawab & submit ulang).
8. Setelah disetujui, status berubah jadi **Verified** — peringatan "Unverified App" hilang, dan batas 100 user tidak berlaku lagi.

---

## 5. Video Demo: Cara Membuatnya

Google **mewajibkan video** untuk setiap scope sensitive/restricted yang Anda minta. Ini bukan video marketing — ini video **teknis** yang menunjukkan alur OAuth-nya secara langsung. Panduan membuatnya:

1. **Rekam layar** (screen recording, bukan foto/slide) dari awal sampai akhir, tanpa potongan yang menyembunyikan langkah penting.
2. Tunjukkan urutan ini secara berurutan:
   - Buka Ponti Sheets, tunjukkan halaman **Login Gate**.
   - Klik "Login dengan Google" → tunjukkan **layar consent Google** yang meminta izin (termasuk daftar scope yang diminta, jangan dipotong).
   - Setelah login, tunjukkan fitur yang benar-benar MEMAKAI scope tersebut:
     - Untuk `spreadsheets`: buka **Schema Editor**, lakukan satu perubahan kecil, klik "Terapkan Perubahan", lalu tunjukkan hasilnya BENERAN berubah di Google Sheets aslinya (buka tab baru ke spreadsheet-nya).
     - Untuk `drive.readonly`/`drive.file`: tunjukkan menu **Spreadsheet**, daftar file yang muncul.
3. Narasikan dengan suara ATAU teks overlay yang menjelaskan apa yang sedang terjadi di tiap langkah (reviewer Google seringkali bukan penutur Bahasa Indonesia — pertimbangkan narasi/teks dalam **Bahasa Inggris** supaya lebih mudah dinilai).
4. Upload video ke **YouTube** (bisa "Unlisted", tidak perlu publik) atau simpan di **Google Drive** dengan akses "siapa saja yang punya link".
5. Tempel link video itu di form verifikasi.

**Durasi ideal**: 2–5 menit, cukup untuk menunjukkan tiap scope tanpa bertele-tele.

---

## 6. Kalau Kena Restricted Scope: Proses CASA

Kalau Anda TETAP memakai `drive.readonly` (tidak beralih ke `drive.file`), setelah lolos tahap verifikasi biasa, Google akan mengarahkan Anda ke proses tambahan **CASA (Cloud Application Security Assessment)**:

1. Google akan menetapkan **Tier** (biasanya **Tier 2** untuk aplikasi kecil/personal) berdasarkan jumlah pengguna & sensitivitas data.
2. Anda perlu memilih **lab keamanan resmi yang di-approve Google** (daftar tersedia di [Google App Security Improvement Program](https://appdefensealliance.dev/casa)) untuk melakukan audit teknis terhadap aplikasi Anda — mencakup pengecekan kontrol akses, arsitektur, enkripsi, dsb (mengacu standar **OWASP ASVS**).
3. **Berbayar** — kisaran biaya audit Tier 2 umumnya **USD 500–4.500**, tergantung lab yang dipilih & kompleksitas aplikasi.
4. Proses ini perlu **diulang setiap tahun** (revalidasi tahunan), bukan sekali seumur hidup.

> ⚠️ Untuk aplikasi personal/tim kecil seperti Ponti Sheets, biaya & effort CASA ini **kemungkinan besar tidak sepadan** dibanding cukup beralih ke scope `drive.file` (lihat [bagian 2](#2-️-hal-paling-penting-cek-ulang-scope-anda-dulu)) yang membebaskan Anda dari kewajiban ini sepenuhnya. Pertimbangkan matang-matang sebelum melanjutkan ke CASA.

---

## 7. Timeline & Estimasi Biaya

| Skenario | Estimasi Waktu | Estimasi Biaya |
|---|---|---|
| Tetap di mode **Testing** (≤100 user) | Langsung aktif | Gratis |
| Mode **Internal** (Google Workspace) | Langsung aktif | Gratis |
| **Sensitive** scope saja (sudah pindah ke `drive.file`) | ~1–2 minggu (termasuk persiapan) | Gratis |
| **Restricted** scope (tetap pakai `drive.readonly`) | ~1–2 bulan (verifikasi + antre CASA + audit) | USD 500–4.500/tahun |

---

## 8. Setelah Lolos Verifikasi

- Peringatan **"Unverified App"** hilang dari layar consent Google.
- **Tidak ada lagi batas 100 user.**
- Sesi login pengguna **tidak lagi kedaluwarsa paksa dalam 7 hari** — mengikuti masa berlaku token normal (biasanya 1 jam untuk access token, tapi Ponti Sheets akan meminta ulang otomatis lewat tombol Login kalau kedaluwarsa, sesuai perilaku yang sudah ada).
- Anda tetap wajib menjaga kepatuhan (mis. Privacy Policy tetap akurat, tidak menambah scope baru tanpa verifikasi ulang) — Google bisa sewaktu-waktu meninjau ulang app yang sudah terverifikasi kalau ada laporan pelanggaran.

---

## 9. Kesalahan Umum yang Bikin Ditolak

| Kesalahan | Solusi |
|---|---|
| Video demo tidak menunjukkan scope-nya dipakai secara langsung | Rekam ulang, pastikan tiap scope yang diminta benar-benar terlihat dipakai di video |
| Privacy Policy generic/template, tidak spesifik menyebut data apa yang diakses | Tulis ulang spesifik untuk Ponti Sheets — sebutkan Google Sheets, jenis akses (baca/tulis), dan bahwa tidak ada server sendiri |
| Domain belum diverifikasi di Search Console | Verifikasi dulu lewat [search.google.com/search-console](https://search.google.com/search-console) sebelum submit |
| Minta scope yang sebenarnya tidak dipakai | Deklarasikan HANYA scope yang benar-benar dipanggil di kode (`GOOGLE_CONFIG.scopes`) |
| Justifikasi scope terlalu singkat/generic ("untuk fitur aplikasi") | Jelaskan detail: fitur apa, kapan dipanggil, apa yang terjadi kalau tidak diberi izin |

---

## 10. FAQ

**Q: Apakah saya WAJIB verifikasi kalau cuma dipakai tim kecil (di bawah 100 orang)?**
A: Tidak wajib. Mode Testing sudah cukup — konsekuensinya cuma sesi login expired tiap 7 hari dan pengguna harus didaftarkan manual sebagai Test User.

**Q: Kalau saya cuma butuh baca (bukan tulis) spreadsheet, apakah tetap kena Sensitive?**
A: Ya — bahkan `spreadsheets.readonly` (read-only) tetap masuk kategori **Sensitive**, bukan Non-sensitive. Hanya `drive.file` yang benar-benar Non-sensitive di antara scope yang relevan untuk Ponti Sheets.

**Q: Berapa lama proses review sensitive scope (tanpa CASA)?**
A: Google menyebutkan sekitar 10 hari kerja setelah submission lengkap diterima — bisa lebih lama kalau ada bolak-balik klarifikasi.

**Q: Apakah saya bisa "coba-coba" submit dulu, kalau ditolak bisa perbaiki?**
A: Bisa. Google akan memberi feedback spesifik lewat email kalau ada yang kurang — perbaiki sesuai catatan mereka lalu submit ulang, tidak ada batas jumlah percobaan.

**Q: Setelah verified, apakah saya bisa menambah scope baru nanti tanpa verifikasi ulang?**
A: Tidak — menambah scope sensitive/restricted baru di kemudian hari akan memicu proses verifikasi ulang untuk scope tambahan itu.

---

*Dokumen ini dibuat berdasarkan kebijakan Google OAuth yang berlaku saat dokumen ini ditulis. Kebijakan Google bisa berubah — untuk informasi paling akurat & terkini, selalu rujuk ke [developers.google.com/identity/protocols/oauth2/production-readiness](https://developers.google.com/identity/protocols/oauth2/production-readiness).*
