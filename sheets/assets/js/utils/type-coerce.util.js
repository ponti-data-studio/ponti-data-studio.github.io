/**
 * type-coerce.util.js
 * Mengonversi nilai data yang SUDAH ADA supaya sesuai dengan tipe kolom
 * yang BARU diubah lewat Schema Editor. Google Sheets sendiri tidak punya
 * konsep "tipe kolom" (semua sel cuma teks/angka/formula), jadi konversi
 * ini murni dilakukan di sisi Ponti Sheets sebelum data ditulis balik.
 *
 * Prinsip: kalau nilai gagal dikonversi (format tidak dikenali), nilai
 * ASLI dipertahankan apa adanya — lebih aman daripada menghapus data
 * yang mungkin sebenarnya valid tapi formatnya di luar dugaan.
 */

const TRUE_WORDS = ["true", "ya", "yes", "1", "benar", "aktif", "lunas", "selesai"];
const FALSE_WORDS = ["false", "tidak", "no", "0", "salah", "nonaktif", "belum", "belum lunas"];

function parseIndonesianNumber(str) {
  const cleaned = str.replace(/[^\d,.-]/g, "");
  if (!cleaned) return NaN;
  // Format Indonesia: titik = pemisah ribuan, koma = desimal (mis. "15.000,50")
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  let normalized = cleaned;
  if (lastComma > lastDot) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else {
    normalized = cleaned.replace(/,/g, "");
  }
  return parseFloat(normalized);
}

function toDateString(str, withTime) {
  const parsed = new Date(str);
  if (Number.isNaN(parsed.getTime())) return null;
  const yyyy = parsed.getFullYear();
  const mm = String(parsed.getMonth() + 1).padStart(2, "0");
  const dd = String(parsed.getDate()).padStart(2, "0");
  if (!withTime) return `${yyyy}-${mm}-${dd}`;
  const hh = String(parsed.getHours()).padStart(2, "0");
  const min = String(parsed.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

/**
 * @param {*} value - nilai sel yang sudah ada (dari sheet lama)
 * @param {string} type - tipe kolom BARU (hasil edit di Schema Editor)
 * @returns nilai yang sudah dikonversi, atau nilai asli kalau gagal/tidak relevan
 */
export function coerceValueToType(value, type) {
  if (value === null || value === undefined || value === "") return value ?? "";
  if (typeof value === "string" && value.startsWith("=")) return value; // formula, jangan diutak-atik

  const str = String(value).trim();

  switch (type) {
    case "number":
    case "currency":
    case "percentage":
    case "auto_number": {
      const num = parseIndonesianNumber(str);
      return Number.isNaN(num) ? value : num;
    }
    case "boolean": {
      const lower = str.toLowerCase();
      if (TRUE_WORDS.includes(lower)) return true;
      if (FALSE_WORDS.includes(lower)) return false;
      return value;
    }
    case "date": {
      return toDateString(str, false) ?? value;
    }
    case "datetime": {
      return toDateString(str, true) ?? value;
    }
    case "text":
    case "email":
    case "phone":
    case "url":
    case "gps":
    case "image_url":
    case "file_url":
    case "json":
    case "array":
    case "uuid":
    default:
      return str;
  }
}
