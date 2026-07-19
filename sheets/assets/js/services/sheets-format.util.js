/**
 * sheets-format.util.js
 * Helper murni (tanpa network call) untuk menerjemahkan konsep blueprint
 * (validation, conditional format, named range) menjadi struktur request
 * Google Sheets API. Dipakai bersama oleh sheets-writer.service.js
 * (Database Builder) dan schema-sync.service.js (Schema Editor) — DRY.
 */

import { columnIndexToLetter } from "./formula-analyzer.service.js";

export function translateValidation(column) {
  const v = column.validation;
  if (!v || !v.type || v.type === "none") return null;

  switch (v.type) {
    case "list":
      if (!Array.isArray(v.options) || v.options.length === 0) return null;
      return {
        condition: { type: "ONE_OF_LIST", values: v.options.map((o) => ({ userEnteredValue: String(o) })) },
        showCustomUi: true, strict: false,
      };
    case "number": {
      if (v.min !== null && v.min !== undefined && v.max !== null && v.max !== undefined) {
        return { condition: { type: "NUMBER_BETWEEN", values: [{ userEnteredValue: String(v.min) }, { userEnteredValue: String(v.max) }] }, strict: true };
      }
      if (v.min !== null && v.min !== undefined) {
        return { condition: { type: "NUMBER_GREATER_THAN_EQ", values: [{ userEnteredValue: String(v.min) }] }, strict: true };
      }
      if (v.max !== null && v.max !== undefined) {
        return { condition: { type: "NUMBER_LESS_THAN_EQ", values: [{ userEnteredValue: String(v.max) }] }, strict: true };
      }
      return null;
    }
    case "date":
      return { condition: { type: "DATE_IS_VALID" }, strict: true };
    case "checkbox":
      return { condition: { type: "BOOLEAN" }, showCustomUi: true };
    case "email":
      return { condition: { type: "TEXT_IS_EMAIL" }, strict: false };
    case "phone":
      return {
        condition: { type: "CUSTOM_FORMULA", values: [{ userEnteredValue: '=REGEXMATCH(INDIRECT("RC",FALSE),"^(\\+?62|0)8[0-9]{7,12}$")' }] },
        strict: false,
      };
    default:
      return null;
  }
}

/** Dropdown FK "asli" — merujuk langsung ke range Primary Key sheet lain, otomatis ter-update kalau data sumbernya bertambah */
export function translateForeignKeyValidation(column, sheetIdByName, lastRowBySheetName, columnsBySheetName) {
  if (!column.isForeignKey || !column.referencesSheet) return null;
  const targetSheetId = sheetIdByName[column.referencesSheet];
  if (targetSheetId === undefined) return null;
  const targetLastRow = Math.max(lastRowBySheetName[column.referencesSheet] || 2, 2);

  // Cari huruf kolom PK yang sebenarnya di sheet tujuan — JANGAN asumsikan selalu kolom A,
  // karena Primary Key bisa berada di posisi kolom mana pun.
  const targetColumns = columnsBySheetName?.[column.referencesSheet] || [];
  const targetColIdx = Math.max(
    0,
    targetColumns.findIndex((c) => c.name === column.referencesColumn || c.isPrimaryKey)
  );
  const colLetter = columnIndexToLetter(targetColIdx);

  return {
    condition: {
      type: "ONE_OF_RANGE",
      values: [{ userEnteredValue: `='${column.referencesSheet}'!${colLetter}2:${colLetter}${targetLastRow}` }],
    },
    showCustomUi: true, strict: false,
  };
}

export function translateConditionType(condition, valueIsNumeric) {
  const map = {
    less_than: valueIsNumeric ? "NUMBER_LESS" : "TEXT_CONTAINS",
    greater_than: "NUMBER_GREATER",
    equal: valueIsNumeric ? "NUMBER_EQ" : "TEXT_EQ",
    text_contains: "TEXT_CONTAINS",
    text_equals: "TEXT_EQ",
  };
  return map[condition] || "TEXT_CONTAINS";
}

export function parseSimpleA1Range(rangeStr) {
  const m = String(rangeStr || "").trim().match(/^([A-Za-z]+)(\d+):([A-Za-z]+)(\d+)$/);
  if (!m) return null;
  const colToIdx = (letters) => letters.toUpperCase().split("").reduce((acc, ch) => acc * 26 + (ch.charCodeAt(0) - 64), 0) - 1;
  return {
    startColumnIndex: colToIdx(m[1]),
    endColumnIndex: colToIdx(m[3]) + 1,
    startRowIndex: parseInt(m[2], 10) - 1,
    endRowIndex: parseInt(m[4], 10),
  };
}

export function sanitizeNamedRangeName(name) {
  const cleaned = String(name || "range").replace(/[^A-Za-z0-9_]/g, "_").replace(/^[^A-Za-z_]/, "_");
  return cleaned.slice(0, 60) || "range";
}
