/**
 * column-type-detector.service.js
 * -----------------------------------------------------------------------
 * Mendeteksi tipe kolom berdasarkan sample data (heuristic, tanpa AI),
 * supaya Database Context Engine tetap cepat & bisa jalan offline.
 * Tipe yang didukung sesuai spesifikasi produk (lihat COLUMN_TYPES).
 * -----------------------------------------------------------------------
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^(\+?62|0)8[0-9]{7,12}$/;
const URL_RE = /^(https?:\/\/)[^\s]+$/i;
const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i;
const FILE_EXT_RE = /\.(pdf|docx?|xlsx?|pptx?|zip|csv|txt)(\?.*)?$/i;
const GPS_RE = /^-?\d{1,3}\.\d+\s*,\s*-?\d{1,3}\.\d+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$|^\d{1,2}\/\d{1,2}\/\d{2,4}$|^\d{1,2}-\d{1,2}-\d{2,4}$/;
const DATETIME_RE = /\d{1,2}:\d{2}(:\d{2})?/;
const BOOLEAN_VALUES = new Set(["true", "false", "yes", "no", "ya", "tidak", "1", "0", "benar", "salah"]);
const CURRENCY_SYMBOLS = /^(Rp|IDR|USD|\$|€|Rp\.)\s?-?[\d.,]+$/i;

function isNumeric(value) {
  if (typeof value === "number") return true;
  if (typeof value !== "string") return false;
  const cleaned = value.replace(/[.,]/g, "");
  return cleaned.length > 0 && !Number.isNaN(Number(cleaned)) && !DATE_RE.test(value);
}

function classifyValue(raw) {
  if (raw === null || raw === undefined || raw === "") return null; // empty, skip
  const value = String(raw).trim();

  if (value.startsWith("=")) return "formula"; // handled separately by formula analyzer
  if (CURRENCY_SYMBOLS.test(value)) return "currency";
  if (EMAIL_RE.test(value)) return "email";
  if (PHONE_RE.test(value)) return "phone";
  if (GPS_RE.test(value)) return "gps";
  if (URL_RE.test(value) && IMAGE_EXT_RE.test(value)) return "image_url";
  if (URL_RE.test(value) && FILE_EXT_RE.test(value)) return "file_url";
  if (URL_RE.test(value)) return "url";
  if (BOOLEAN_VALUES.has(value.toLowerCase())) return "boolean";
  if (DATE_RE.test(value) && DATETIME_RE.test(value)) return "datetime";
  if (DATE_RE.test(value)) return "date";
  if ((value.startsWith("{") && value.endsWith("}")) || (value.startsWith("[") && value.endsWith("]"))) {
    try { JSON.parse(value); return value.startsWith("[") ? "array" : "json"; } catch { /* fallthrough */ }
  }
  if (isNumeric(value)) return "number";
  return "text";
}

/**
 * Deteksi tipe dominan sebuah kolom dari kumpulan sample value.
 * @param {Array<any>} values - nilai mentah 1 kolom (tanpa header)
 * @returns {{ type: string, confidence: number, nullable: boolean }}
 */
export function detectColumnType(values = []) {
  const nonEmpty = values.filter((v) => v !== null && v !== undefined && String(v).trim() !== "");
  const nullable = nonEmpty.length < values.length;

  if (nonEmpty.length === 0) {
    return { type: "unknown", confidence: 0, nullable: true };
  }

  const counts = {};
  for (const raw of nonEmpty) {
    const type = classifyValue(raw) || "text";
    counts[type] = (counts[type] || 0) + 1;
  }

  const [topType, topCount] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  const confidence = Math.round((topCount / nonEmpty.length) * 100) / 100;

  return { type: topType === "formula" ? "text" : topType, confidence, nullable };
}

export function detectPrimaryKey(columnName, values = []) {
  const nonEmpty = values.filter((v) => v !== null && v !== undefined && String(v).trim() !== "");
  if (nonEmpty.length === 0) return { isPrimaryKey: false, confidence: 0 };

  const unique = new Set(nonEmpty.map(String));
  const uniquenessRatio = unique.size / nonEmpty.length;
  const nameHints = /^(id|.*_id|kode|.*_code|no|nomor)$/i.test(columnName.trim());
  const noEmpty = nonEmpty.length === values.length;

  let confidence = uniquenessRatio;
  if (nameHints) confidence = Math.min(1, confidence + 0.15);
  if (!noEmpty) confidence -= 0.2;

  confidence = Math.max(0, Math.min(1, Math.round(confidence * 100) / 100));
  return { isPrimaryKey: confidence >= 0.8 && uniquenessRatio >= 0.98, confidence };
}

export function detectForeignKeyCandidate(columnName) {
  // Kolom dianggap kandidat FK jika namanya mengikuti pola *_id / id_* / kode_*
  return /^(.+_id|id_.+|.+_code|kode_.+)$/i.test(columnName.trim()) && !/^id$/i.test(columnName.trim());
}
