/**
 * data-quality.service.js
 * Mendeteksi masalah kualitas data: duplicate, empty, invalid format,
 * missing PK/FK, broken relation.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^(\+?62|0)8[0-9]{7,12}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$|^\d{1,2}\/\d{1,2}\/\d{2,4}$/;

export function checkDuplicates(values = []) {
  const seen = new Map();
  const duplicates = [];
  values.forEach((v, idx) => {
    if (v === null || v === undefined || String(v).trim() === "") return;
    const key = String(v).trim().toLowerCase();
    if (seen.has(key)) duplicates.push({ row: idx + 1, value: v });
    else seen.set(key, idx);
  });
  return duplicates;
}

export function checkEmpty(values = []) {
  return values
    .map((v, idx) => ({ row: idx + 1, value: v }))
    .filter((item) => item.value === null || item.value === undefined || String(item.value).trim() === "");
}

export function checkInvalidFormat(values = [], type) {
  const validator = type === "email" ? EMAIL_RE : type === "phone" ? PHONE_RE : type === "date" ? DATE_RE : null;
  if (!validator) return [];
  return values
    .map((v, idx) => ({ row: idx + 1, value: v }))
    .filter((item) => item.value !== null && item.value !== undefined && String(item.value).trim() !== "" && !validator.test(String(item.value).trim()));
}

/**
 * Menjalankan seluruh pemeriksaan kualitas data untuk satu SheetModel
 * yang sudah punya `columns` (dengan type & sampleData per kolom).
 */
export function runDataQualityChecks(sheet) {
  const warnings = [];

  const hasPk = sheet.columns.some((c) => c.isPrimaryKey);
  if (!hasPk) {
    warnings.push({ level: "warning", message: `Sheet "${sheet.name}" tidak memiliki kolom yang terdeteksi sebagai Primary Key.` });
  }

  sheet.columns.forEach((col) => {
    const colValues = sheet.sampleData.map((row) => row[col.index]);

    if (col.isPrimaryKey) {
      const dupes = checkDuplicates(colValues);
      if (dupes.length) {
        warnings.push({ level: "error", message: `Kolom "${col.name}" adalah Primary Key tapi memiliki ${dupes.length} nilai duplikat (sample).` });
      }
    }

    const empties = checkEmpty(colValues);
    if (empties.length > 0 && empties.length === colValues.length) {
      warnings.push({ level: "warning", message: `Kolom "${col.name}" kosong pada seluruh sample data.` });
    }

    if (col.type === "email") {
      const invalid = checkInvalidFormat(colValues, "email");
      if (invalid.length) warnings.push({ level: "warning", message: `Kolom "${col.name}" memiliki ${invalid.length} nilai email tidak valid (sample).` });
    }
    if (col.type === "phone") {
      const invalid = checkInvalidFormat(colValues, "phone");
      if (invalid.length) warnings.push({ level: "warning", message: `Kolom "${col.name}" memiliki ${invalid.length} nomor telepon tidak valid (sample).` });
    }
    if (col.type === "date" || col.type === "datetime") {
      const invalid = checkInvalidFormat(colValues, "date");
      if (invalid.length) warnings.push({ level: "info", message: `Kolom "${col.name}" memiliki ${invalid.length} nilai tanggal dengan format tidak konsisten (sample).` });
    }

    if (col.isForeignKey && !col.referencesSheet) {
      warnings.push({ level: "warning", message: `Kolom "${col.name}" terlihat seperti Foreign Key tapi relasinya belum ditemukan (broken relation).` });
    }
  });

  return warnings;
}
