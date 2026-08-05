"""
============================================================
AQES One — Cover Generator API
------------------------------------------------------------
Menumpuk biodata santri (nama, NIS, marhalah, kelompok, periode,
dan opsional foto) DI ATAS gambar cover — sesuatu yang tidak bisa
dilakukan Google Docs/Slides lewat Apps Script. Hasilnya berupa
satu gambar JPEG utuh yang tinggal ditempel Apps Script sebagai
cover rapor.

Endpoint utama: POST /cover
Autentikasi   : header X-API-Key (lihat config.py / env COVER_API_KEY)
============================================================
"""
import io
import os
import textwrap
from typing import Optional

import requests
from flask import Flask, request, jsonify, send_file, abort
from PIL import Image, ImageDraw, ImageFont, ImageOps

app = Flask(__name__)

# ---------------------------------------------------------------
# KONFIGURASI
# ---------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FONT_DIR = os.path.join(BASE_DIR, "fonts")
DEFAULT_TEMPLATE = os.path.join(BASE_DIR, "assets", "default-template.jpg")

API_KEY = os.environ.get("COVER_API_KEY", "ganti-dengan-kunci-rahasia-anda")

FONT_BOLD = os.path.join(FONT_DIR, "Poppins-Bold.ttf")
FONT_SEMIBOLD = os.path.join(FONT_DIR, "Poppins-SemiBold.ttf")
FONT_MEDIUM = os.path.join(FONT_DIR, "Poppins-Medium.ttf")
FONT_REGULAR = os.path.join(FONT_DIR, "Poppins-Regular.ttf")

# Warna default (dipakai jika tidak dikirim di request) — selaras
# dengan tema hijau emerald AQES One.
DEFAULT_WARNA_UTAMA = "#064e3b"   # nama santri
DEFAULT_WARNA_AKSEN = "#0d9488"   # label periode

# Posisi vertikal blok biodata. `block_start_y_pct` = titik mulai blok
# (nama dst.) disusun MENGALIR ke bawah dengan jarak dinamis mengikuti
# tinggi teks aktual (bukan persentase tetap) — supaya tidak pernah
# tumpang tindih walau nama santri panjang / font mengecil otomatis.
LAYOUT = {
    "photo_center_y_pct": 0.335,   # titik tengah foto bulat (jika ada)
    "photo_diameter_pct": 0.16,    # diameter foto relatif lebar gambar
    "block_start_y_pct": 0.42,     # awal blok nama & detail
    "line_gap_px_pct": 0.010,      # jarak antar baris, relatif tinggi gambar
    "max_text_width_pct": 0.82,    # lebar maksimum blok teks (agar ada margin kiri-kanan)
}


# ---------------------------------------------------------------
# HELPER
# ---------------------------------------------------------------
def _require_api_key():
    key = request.headers.get("X-API-Key", "")
    if not key or key != API_KEY:
        abort(401, description="X-API-Key tidak valid atau tidak disertakan.")


def _load_template(payload) -> Image.Image:
    """Ambil gambar template: dari template_url (upload Admin) jika ada,
    kalau tidak / gagal diambil, pakai default bawaan API."""
    url = (payload or {}).get("template_url")
    if url:
        try:
            resp = requests.get(url, timeout=10)
            resp.raise_for_status()
            return Image.open(io.BytesIO(resp.content)).convert("RGB")
        except Exception as exc:  # noqa: BLE001 — sengaja tangkap semua, fallback ke default
            app.logger.warning("Gagal ambil template_url (%s), pakai default. Error: %s", url, exc)
    return Image.open(DEFAULT_TEMPLATE).convert("RGB")


def _load_photo(url: str, size: int) -> Optional[Image.Image]:
    """Ambil foto santri (jika ada), crop jadi lingkaran ukuran `size`x`size`."""
    if not url:
        return None
    try:
        resp = requests.get(url, timeout=10)
        resp.raise_for_status()
        img = Image.open(io.BytesIO(resp.content)).convert("RGB")
        img = ImageOps.fit(img, (size, size), Image.LANCZOS)

        mask = Image.new("L", (size, size), 0)
        draw = ImageDraw.Draw(mask)
        draw.ellipse((0, 0, size, size), fill=255)

        circular = Image.new("RGBA", (size, size))
        circular.paste(img, (0, 0), mask)
        return circular
    except Exception as exc:  # noqa: BLE001
        app.logger.warning("Gagal ambil foto santri (%s): %s", url, exc)
        return None


def _fit_font(draw: ImageDraw.ImageDraw, text: str, font_path: str,
              max_width: int, start_size: int, min_size: int = 14) -> ImageFont.FreeTypeFont:
    """Perkecil ukuran font bertahap sampai `text` muat dalam `max_width`."""
    size = start_size
    while size > min_size:
        font = ImageFont.truetype(font_path, size)
        bbox = draw.textbbox((0, 0), text, font=font)
        if bbox[2] - bbox[0] <= max_width:
            return font
        size -= 2
    return ImageFont.truetype(font_path, min_size)


def _draw_centered(draw: ImageDraw.ImageDraw, img_w: int, y: int, text: str,
                    font: ImageFont.FreeTypeFont, fill: str,
                    stroke_width: int = 0, stroke_fill: str = "#ffffff") -> int:
    """Gambar teks rata tengah horizontal di ketinggian `y`.
    Mengembalikan tinggi bounding-box teks (untuk hitung baris berikutnya)."""
    bbox = draw.textbbox((0, 0), text, font=font)
    w = bbox[2] - bbox[0]
    h = bbox[3] - bbox[1]
    x = (img_w - w) / 2
    # Offset supaya bbox[1] (biasanya negatif utk huruf kapital) tidak
    # membuat teks tergambar lebih tinggi dari posisi y yang diminta.
    draw.text((x - bbox[0], y - bbox[1]), text, font=font, fill=fill,
               stroke_width=stroke_width, stroke_fill=stroke_fill)
    return h


def _hex(color: str, fallback: str) -> str:
    if color and color.startswith("#") and len(color) == 7:
        return color
    return fallback


# ---------------------------------------------------------------
# ENDPOINT UTAMA
# ---------------------------------------------------------------
@app.route("/cover", methods=["POST"])
def generate_cover():
    _require_api_key()

    payload = request.get_json(silent=True) or {}
    nama = (payload.get("nama") or "").strip()
    if not nama:
        return jsonify({"success": False, "message": "Field 'nama' wajib diisi."}), 400

    nis = payload.get("nis") or "-"
    marhalah = payload.get("marhalah") or "-"
    kelompok = payload.get("kelompok") or "-"
    tipe = payload.get("tipe") or "monthly"
    bulan_label = payload.get("bulan_label") or ""
    tahun_akademik = payload.get("tahun_akademik") or ""
    semester = payload.get("semester") or ""
    foto_url = payload.get("foto_url")
    warna_utama = _hex(payload.get("warna_utama"), DEFAULT_WARNA_UTAMA)
    warna_aksen = _hex(payload.get("warna_aksen"), DEFAULT_WARNA_AKSEN)

    img = _load_template(payload)
    W, H = img.size
    draw = ImageDraw.Draw(img)
    max_w = int(W * LAYOUT["max_text_width_pct"])

    # ---- Foto santri (opsional) ----
    if foto_url:
        diameter = int(W * LAYOUT["photo_diameter_pct"])
        photo = _load_photo(foto_url, diameter)
        if photo:
            cy = int(H * LAYOUT["photo_center_y_pct"])
            px = int((W - diameter) / 2)
            py = int(cy - diameter / 2)
            # cincin putih tipis di sekeliling foto agar menyatu dengan cover
            ring = int(diameter * 0.04)
            draw.ellipse((px - ring, py - ring, px + diameter + ring, py + diameter + ring),
                         fill="#ffffff")
            img.paste(photo, (px, py), photo)
            draw = ImageDraw.Draw(img)  # refresh draw context setelah paste

    # ---- Biodata santri — mengalir ke bawah dengan jarak dinamis ----
    line_gap = int(H * LAYOUT["line_gap_px_pct"])
    cursor_y = int(H * LAYOUT["block_start_y_pct"])

    # Nama (baris utama, besar & bold)
    font_nama = _fit_font(draw, nama.upper(), FONT_BOLD, max_w, start_size=int(W * 0.075))
    h = _draw_centered(draw, W, cursor_y, nama.upper(), font_nama, warna_utama)
    cursor_y += h + line_gap * 2

    # NIS · Marhalah · Kelompok
    detail_text = f"NIS {nis}  ·  {marhalah}  ·  {kelompok}"
    font_detail = _fit_font(draw, detail_text, FONT_SEMIBOLD, max_w, start_size=int(W * 0.032))
    h = _draw_centered(draw, W, cursor_y, detail_text, font_detail, warna_utama)
    cursor_y += h + line_gap * 2

    # Label periode
    tipe_label = "LAPORAN BULANAN" if tipe == "monthly" else "LAPORAN SEMESTER"
    label_text = f"{tipe_label}  —  {bulan_label}".strip(" —")
    font_label = _fit_font(draw, label_text, FONT_SEMIBOLD, max_w, start_size=int(W * 0.028))
    h = _draw_centered(draw, W, cursor_y, label_text, font_label, warna_aksen)
    cursor_y += h + line_gap

    # Tahun akademik/semester (opsional, baris kecil)
    if tahun_akademik:
        ta_text = f"Tahun Akademik {tahun_akademik}" + (f" · Semester {semester}" if semester else "")
        font_ta = _fit_font(draw, ta_text, FONT_REGULAR, max_w, start_size=int(W * 0.022))
        _draw_centered(draw, W, cursor_y, ta_text, font_ta, "#374151")

    # ---- Output ----
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=92, optimize=True)
    buf.seek(0)
    return send_file(buf, mimetype="image/jpeg", download_name="cover.jpg")


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "AQES One Cover Generator API"})


@app.route("/", methods=["GET"])
def index():
    return jsonify({
        "service": "AQES One Cover Generator API",
        "endpoints": {
            "POST /cover": "Generate cover rapor (perlu header X-API-Key)",
            "GET /health": "Health check"
        }
    })


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
