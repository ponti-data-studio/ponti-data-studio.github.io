/**
 * formula-shift.util.js — menggeser referensi baris pada formula template
 * (ditulis AI/pengguna memakai baris contoh ke-2) ke baris tujuan yang
 * sebenarnya saat menulis banyak baris data sekaligus.
 */

export function shiftFormulaRow(formula, targetRow, templateRow = 2) {
  const re = new RegExp(`([A-Za-z]{1,3})(\\$?)${templateRow}\\b`, "g");
  return formula.replace(re, (_m, col, dollar) => `${col}${dollar}${targetRow}`);
}
