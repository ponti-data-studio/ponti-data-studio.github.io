import { downloadBlob } from "../utils/download.util.js";
import { resolveColorHex, hexToArgb } from "../utils/color.util.js";
import { shiftFormulaRow } from "../utils/formula-shift.util.js";

/**
 * excel-writer.service.js
 * -----------------------------------------------------------------------
 * "Excel Generator" — membangun file .xlsx dari Database Blueprint,
 * lengkap dengan multiple sheet, formula, freeze pane, filter, data
 * validation, conditional formatting, dan auto width kolom.
 *
 * Memakai library ExcelJS yang dimuat dinamis dari CDN (bukan lewat npm),
 * konsisten dengan prinsip "tanpa build step" pada Ponti Sheets — hanya
 * dimuat saat pengguna benar-benar menekan tombol "Generate Excel".
 * -----------------------------------------------------------------------
 */

const EXCELJS_CDN_URL = "https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js";
let exceljsLoaded = false;

function loadExcelJs() {
  return new Promise((resolve, reject) => {
    if (exceljsLoaded || window.ExcelJS) {
      exceljsLoaded = true;
      resolve(window.ExcelJS);
      return;
    }
    const script = document.createElement("script");
    script.src = EXCELJS_CDN_URL;
    script.async = true;
    script.onload = () => {
      exceljsLoaded = true;
      resolve(window.ExcelJS);
    };
    script.onerror = () => reject(new Error("Gagal memuat library ExcelJS dari CDN. Periksa koneksi internet Anda."));
    document.head.appendChild(script);
  });
}

function applyValidation(cell, column) {
  const v = column.validation;
  if (!v || !v.type || v.type === "none") return;

  switch (v.type) {
    case "list":
      if (Array.isArray(v.options) && v.options.length > 0) {
        cell.dataValidation = { type: "list", allowBlank: true, formulae: [`"${v.options.join(",")}"`] };
      }
      break;
    case "number":
      if (v.min !== null && v.min !== undefined && v.max !== null && v.max !== undefined) {
        cell.dataValidation = { type: "whole", operator: "between", formulae: [v.min, v.max], allowBlank: true };
      } else if (v.min !== null && v.min !== undefined) {
        cell.dataValidation = { type: "decimal", operator: "greaterThanOrEqual", formulae: [v.min], allowBlank: true };
      }
      break;
    case "date":
      cell.dataValidation = { type: "date", operator: "greaterThan", formulae: [new Date(1900, 0, 1)], allowBlank: true };
      break;
    case "checkbox":
      cell.dataValidation = { type: "list", allowBlank: true, formulae: ['"TRUE,FALSE"'] };
      break;
    case "email":
      cell.dataValidation = {
        type: "custom", allowBlank: true,
        formulae: [`ISNUMBER(MATCH("*@*.*",${cell.address},0))`],
      };
      break;
    default:
      break;
  }
}

function applyConditionalFormats(worksheet, sheet, headerRowCount) {
  sheet.conditionalFormats.forEach((cf) => {
    const colIdx = sheet.columns.findIndex((c) => c.name === cf.column);
    if (colIdx === -1) return;
    const colLetter = worksheet.getColumn(colIdx + 1).letter;
    const range = `${colLetter}${headerRowCount + 1}:${colLetter}1000`;
    const valueIsNumeric = typeof cf.value === "number" || !Number.isNaN(Number(cf.value));

    const operatorMap = {
      less_than: "lessThan", greater_than: "greaterThan", equal: "equal",
      text_contains: "containsText", text_equals: "equal",
    };

    worksheet.addConditionalFormatting({
      ref: range,
      rules: [
        {
          type: valueIsNumeric && cf.condition !== "text_contains" ? "cellIs" : "containsText",
          operator: operatorMap[cf.condition] || "containsText",
          text: !valueIsNumeric ? String(cf.value) : undefined,
          formulae: valueIsNumeric && cf.condition !== "text_contains" ? [String(cf.value)] : undefined,
          style: { fill: { type: "pattern", pattern: "solid", bgColor: { argb: hexToArgb(cf.backgroundColor) } } },
        },
      ],
    });
  });
}

export const excelWriterService = {
  /**
   * @param {object} blueprint - hasil normalizeBlueprint()
   * @returns {Promise<void>} memicu unduhan file .xlsx
   */
  async generate(blueprint, onProgress = () => {}) {
    onProgress({ step: "load-lib", label: "Memuat library Excel..." });
    const ExcelJS = await loadExcelJs();

    onProgress({ step: "build", label: "Menyusun workbook..." });
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Ponti Sheets";
    workbook.created = new Date();

    blueprint.sheets.forEach((sheet) => {
      const worksheet = workbook.addWorksheet(sheet.name.slice(0, 31), {
        properties: { tabColor: sheet.tabColor ? { argb: hexToArgb(sheet.tabColor) } : undefined },
        views: sheet.freezeRow > 0 ? [{ state: "frozen", ySplit: sheet.freezeRow }] : [],
      });

      worksheet.columns = sheet.columns.map((c) => ({
        header: c.name,
        key: c.name,
        width: Math.max(12, Math.min(32, c.name.length + 6)),
      }));

      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
      headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: hexToArgb(resolveColorHex(sheet.tabColor, "#6366F1")) } };
      headerRow.alignment = { vertical: "middle" };

      if (sheet.filter) {
        worksheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columns.length } };
      }

      sheet.dummyData.forEach((rowObj, i) => {
        const rowIndex = i + 2;
        const rowValues = {};
        sheet.columns.forEach((c) => {
          if (c.formula) {
            rowValues[c.name] = { formula: shiftFormulaRow(c.formula, rowIndex).replace(/^=/, "") };
          } else {
            rowValues[c.name] = rowObj[c.name] ?? rowObj[c.label] ?? c.defaultValue ?? "";
          }
        });
        const row = worksheet.addRow(rowValues);

        sheet.columns.forEach((c, colIdx) => {
          if (c.validation) applyValidation(row.getCell(colIdx + 1), c);
        });
      });

      applyConditionalFormats(worksheet, sheet, 1);
    });

    onProgress({ step: "write", label: "Menulis file .xlsx..." });
    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `${blueprint.project.name.replace(/[^a-z0-9]+/gi, "_") || "database"}.xlsx`;
    downloadBlob(filename, buffer, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    onProgress({ step: "done", label: "File Excel berhasil dibuat." });
    return { filename };
  },
};
