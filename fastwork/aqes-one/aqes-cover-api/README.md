# 🎨 AQES One — Cover Generator API

API Python (Flask + Pillow) yang menumpuk biodata santri **presisi di atas gambar cover** — sesuatu yang **tidak bisa** dilakukan Google Docs/Slides lewat Apps Script (sudah terbukti lewat banyak percobaan sebelumnya). Hasilnya berupa satu gambar JPEG utuh yang tinggal ditempel Apps Script sebagai cover rapor.

Fitur ini **opsional** — kalau tidak diaktifkan, AQES One tetap jalan normal memakai cover fallback bawaan (gambar besar + biodata teks di bawahnya).

---

## Isi Folder

```
aqes-cover-api/
├── app.py                 ← kode API Flask
├── requirements.txt
├── Procfile                ← untuk deploy ke Render/Railway/Heroku-like
├── .env.example
├── fonts/                   ← font Poppins (Bold, SemiBold, Medium, Regular)
│   └── Poppins-*.ttf
└── assets/
    └── default-template.jpg ← cover cadangan jika Admin belum upload cover sendiri
```

---

## Cara Kerja Singkat

```
Apps Script (Rapor.gs)
   │  POST /cover  { nama, nis, marhalah, kelompok, ... }
   │  header: X-API-Key
   ▼
Python API (app.py)
   │  1. Ambil gambar cover (dari template_url / default)
   │  2. Gambar teks biodata presisi di atasnya (Pillow)
   │  3. (Opsional) tempel foto santri bulat jika foto_url dikirim
   ▼
Kembalikan 1 gambar JPEG utuh
   │
   ▼
Apps Script tempel gambar itu langsung sebagai cover — SELESAI,
tidak perlu lagi teks tambahan karena semua sudah menyatu di gambar.
```

---

## 1. Uji Coba Lokal (opsional, sebelum deploy)

```bash
cd aqes-cover-api
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# edit .env, isi COVER_API_KEY dengan kunci rahasia Anda sendiri

export $(cat .env | xargs)      # Windows (PowerShell): lihat catatan di bawah
python3 app.py
```

Uji dengan `curl`:
```bash
curl -X POST http://localhost:5000/cover \
  -H "X-API-Key: isi-sesuai-.env" \
  -H "Content-Type: application/json" \
  -d '{
    "nama": "Naushad Ahmad Ysmi",
    "nis": "AA-24-003",
    "marhalah": "Tahsin",
    "kelompok": "Tahsin Online",
    "tipe": "monthly",
    "bulan_label": "August 2026",
    "tahun_akademik": "2026/2027",
    "semester": "1"
  }' --output test.jpg
```
Buka `test.jpg` — harus terlihat nama & detail santri tertumpuk rapi di cover.

> 💻 **Windows PowerShell**: ganti baris `export $(cat .env | xargs)` dengan mengisi env var manual:
> `$env:COVER_API_KEY="isi-kunci-anda"` sebelum menjalankan `python3 app.py`.

---

## 2. Deploy Gratis ke Render.com

Render punya free tier yang cukup untuk kebutuhan ini (aplikasi "tidur" setelah 15 menit tidak dipakai, otomatis bangun lagi saat ada request — jeda beberapa detik di request pertama, wajar untuk tier gratis).

1. Buat akun di **https://render.com** (bisa pakai akun GitHub/Google).
2. Upload folder `aqes-cover-api/` ini ke repository GitHub baru (atau pakai GitHub Desktop/upload manual via web GitHub).
3. Di Render: **New → Web Service** → hubungkan ke repository GitHub tadi.
4. Isi pengaturan:
   - **Name**: `aqes-cover-api` (bebas)
   - **Region**: Singapore (paling dekat ke Indonesia)
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn app:app --bind 0.0.0.0:$PORT`
5. Di bagian **Environment Variables**, tambahkan:
   - `COVER_API_KEY` = (buat kunci rahasia acak, panjang, contoh: hasil dari https://randomkeygen.com)
6. Klik **Create Web Service** → tunggu proses build (~2-3 menit).
7. Setelah selesai, salin URL yang diberikan Render, contoh:
   ```
   https://aqes-cover-api.onrender.com
   ```

### Alternatif hosting gratis lain
- **Railway.app** — mirip Render, tinggal hubungkan repo GitHub.
- **PythonAnywhere** — punya free tier khusus Python/Flask, tidak perlu Docker/Procfile.
- **Google Cloud Run** — free tier generous, tapi setup sedikit lebih teknis (perlu `gcloud` CLI).

---

## 3. Aktifkan di AQES One

Buka **`Code.gs`** di editor Apps Script, cari bagian `CONFIG`, isi 2 baris ini:

```javascript
COVER_API_URL: 'https://aqes-cover-api.onrender.com/cover',  // + /cover di akhir!
COVER_API_KEY: 'kunci-rahasia-yang-sama-persis-dengan-di-Render'
```

Simpan → **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy**.

Generate rapor seperti biasa — cover sekarang otomatis memakai hasil dari API ini. Kalau API sedang tidak bisa diakses (server tidur/error), sistem **otomatis fallback** ke cover bawaan — generate rapor tidak akan pernah gagal karena API ini.

---

## 4. Format Request/Response

**Endpoint**: `POST /cover`
**Header wajib**: `X-API-Key: <kunci rahasia>`

**Body (JSON):**
| Field | Wajib | Keterangan |
|---|---|---|
| `nama` | ✅ | Nama santri |
| `nis` | | Nomor induk santri |
| `marhalah` | | Nama marhalah |
| `kelompok` | | Nama kelompok |
| `tipe` | | `monthly` atau `semester` |
| `bulan_label` | | Contoh: "August 2026" |
| `tahun_akademik` | | Contoh: "2026/2027" |
| `semester` | | Contoh: "1" |
| `warna_utama` | | Hex warna nama, default `#064e3b` |
| `warna_aksen` | | Hex warna label periode, default `#0d9488` |
| `template_url` | | URL gambar cover kustom (dikirim otomatis oleh Rapor.gs dari upload Admin); jika kosong pakai `assets/default-template.jpg` |
| `foto_url` | | URL foto santri (jika ada), akan ditempel bulat di atas nama |

**Response sukses**: gambar `image/jpeg` langsung (bukan JSON).
**Response gagal**: JSON `{ "success": false, "message": "..." }` dengan HTTP status sesuai (400/401/dst).

---

## 5. Kustomisasi Tata Letak

Semua posisi teks diatur lewat dictionary `LAYOUT` di `app.py` (dalam persentase, bukan pixel tetap, jadi otomatis menyesuaikan resolusi gambar cover apa pun):

```python
LAYOUT = {
    "photo_center_y_pct": 0.335,   # titik tengah foto bulat
    "photo_diameter_pct": 0.16,    # diameter foto relatif lebar gambar
    "block_start_y_pct": 0.42,     # awal blok nama & detail
    "line_gap_px_pct": 0.010,      # jarak antar baris
    "max_text_width_pct": 0.82,    # lebar maksimum blok teks
}
```

Ubah angka-angka ini kalau desain cover Anda punya area kosong di posisi berbeda, lalu deploy ulang (Render otomatis re-deploy setiap kali Anda push perubahan ke GitHub).

---

## 6. Keamanan

- `X-API-Key` **wajib** disertakan di setiap request — tanpa itu API menolak (401).
- Jangan taruh `COVER_API_KEY` asli di kode yang di-commit ke GitHub publik — selalu lewat Environment Variables di hosting.
- API ini tidak menyimpan data apa pun (stateless) — setiap request diproses lalu hasil gambar langsung dikembalikan, tidak ada database di sisi API.

---

## 7. Troubleshooting

| Gejala | Penyebab & Solusi |
|---|---|
| Rapor tetap pakai cover fallback (bukan hasil API) | Cek `CONFIG.COVER_API_URL` di `Code.gs` sudah diisi dan diakhiri `/cover`. Cek `Executions` log di Apps Script untuk pesan error dari `Rapor_fetchCompositeCover`. |
| Request pertama lambat (~10-30 detik) | Wajar di Render free tier — server "tidur" setelah 15 menit tidak dipakai. Request berikutnya akan cepat. |
| Error 401 dari API | `COVER_API_KEY` di `Code.gs` tidak sama persis dengan yang di Environment Variables hosting. |
| Nama santri terpotong/terlalu kecil | Font otomatis mengecil sampai muat (`_fit_font`), tapi ada batas minimum 14px — untuk nama yang SANGAT panjang, pertimbangkan menambah `max_text_width_pct` di `LAYOUT`. |
| Foto tidak muncul | Pastikan `foto_url` bisa diakses publik (bukan link yang butuh login Google). |
