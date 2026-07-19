import { sheetsService } from "./sheets.service.js";
import { hexToSheetsColor } from "../utils/color.util.js";
import { shiftFormulaRow } from "../utils/formula-shift.util.js";
import {
  translateValidation, translateConditionType, parseSimpleA1Range, sanitizeNamedRangeName,
} from "./sheets-format.util.js";
import { logger } from "../utils/logger.util.js";

/**
 * sheets-writer.service.js
 * -----------------------------------------------------------------------
 * "Google Sheets Generator" — menerjemahkan Database Blueprint (hasil AI)
 * menjadi spreadsheet Google Sheets nyata: membuat sheet, menulis header +
 * dummy data + formula, mengatur freeze row, filter, tab color, data
 * validation, conditional formatting, named range, protected range, dan
 * auto-resize kolom. Dipanggil HANYA saat pengguna menekan tombol
 * "Generate Google Sheets" di Database Builder.
 * -----------------------------------------------------------------------
 */

function buildSheetValues(sheet) {
  const header = sheet.columns.map((c) => c.name);
  const rows = sheet.dummyData.map((rowObj, i) =>
    sheet.columns.map((c) => {
      if (c.formula) return shiftFormulaRow(c.formula, i + 2);
      const value = rowObj[c.name] ?? rowObj[c.label] ?? c.defaultValue ?? "";
      return value === null ? "" : value;
    })
  );
  return [header, ...rows];
}

export const sheetsWriterService = {
  /**
   * @param {object} blueprint - hasil normalizeBlueprint()
   * @param {(progress:{step:string,label:string}) => void} onProgress
   * @returns {Promise<{ spreadsheetId: string, spreadsheetUrl: string }>}
   */
  async generate(blueprint, onProgress = () => {}) {
    onProgress({ step: "create", label: "Membuat spreadsheet baru..." });
    const created = await sheetsService.createSpreadsheet({
      title: blueprint.project.name,
      timeZone: "Asia/Jakarta",
    });
    const spreadsheetId = created.spreadsheetId;
    const defaultSheetId = created.sheets?.[0]?.properties?.sheetId ?? 0;

    // ---- Phase 1: struktur sheet (rename sheet default + tambah sheet lain) ----
    onProgress({ step: "structure", label: "Menyiapkan struktur sheet..." });
    const structureRequests = [];
    const sheetIdBySheetName = {};

    blueprint.sheets.forEach((sheet, idx) => {
      const gridProps = {
        rowCount: Math.max(1000, sheet.dummyData.length + 50),
        columnCount: Math.max(26, sheet.columns.length + 5),
        frozenRowCount: sheet.freezeRow || 0,
      };
      const tabColor = sheet.tabColor ? hexToSheetsColor(sheet.tabColor) : undefined;

      if (idx === 0) {
        sheetIdBySheetName[sheet.name] = defaultSheetId;
        const fieldsToUpdate = ["title", "gridProperties"];
        if (tabColor) fieldsToUpdate.push("tabColor");
        structureRequests.push({
          updateSheetProperties: {
            properties: { sheetId: defaultSheetId, title: sheet.name, gridProperties: gridProps, ...(tabColor ? { tabColor } : {}) },
            fields: fieldsToUpdate.join(","),
          },
        });
      } else {
        structureRequests.push({
          addSheet: { properties: { title: sheet.name, gridProperties: gridProps, ...(tabColor ? { tabColor } : {}) } },
        });
      }
    });

    const structureResponse = await sheetsService.batchUpdate(spreadsheetId, structureRequests);
    let addSheetReplyIdx = 0;
    blueprint.sheets.forEach((sheet, idx) => {
      if (idx === 0) return;
      const reply = structureResponse.replies?.[idx]?.addSheet || structureResponse.replies?.filter((r) => r.addSheet)[addSheetReplyIdx];
      sheetIdBySheetName[sheet.name] = reply?.properties?.sheetId;
      addSheetReplyIdx += 1;
    });

    // ---- Phase 2: tulis header + dummy data + formula ----
    onProgress({ step: "data", label: "Menulis header, formula, dan dummy data..." });
    for (const sheet of blueprint.sheets) {
      const values = buildSheetValues(sheet);
      if (values.length === 0) continue;
      // eslint-disable-next-line no-await-in-loop
      await sheetsService.updateValues(spreadsheetId, `'${sheet.name}'!A1`, values, "USER_ENTERED");
    }

    // ---- Phase 3: formatting (filter, validation, conditional format, protected, named range, auto width) ----
    onProgress({ step: "formatting", label: "Menerapkan filter, validasi, dan pemformatan..." });
    const formatRequests = [];

    blueprint.sheets.forEach((sheet) => {
      const sheetId = sheetIdBySheetName[sheet.name];
      if (sheetId === undefined) return;
      const lastRow = Math.max(sheet.dummyData.length + 1, 2);
      const lastCol = sheet.columns.length;

      if (sheet.filter) {
        formatRequests.push({
          setBasicFilter: {
            filter: { range: { sheetId, startRowIndex: 0, endRowIndex: lastRow, startColumnIndex: 0, endColumnIndex: lastCol } },
          },
        });
      }

      sheet.columns.forEach((col, colIdx) => {
        const rule = translateValidation(col);
        if (!rule) return;
        formatRequests.push({
          setDataValidation: {
            range: { sheetId, startRowIndex: 1, endRowIndex: Math.max(lastRow, 200), startColumnIndex: colIdx, endColumnIndex: colIdx + 1 },
            rule,
          },
        });
      });

      sheet.conditionalFormats.forEach((cf) => {
        const colIdx = sheet.columns.findIndex((c) => c.name === cf.column);
        if (colIdx === -1) return;
        const valueIsNumeric = typeof cf.value === "number" || !Number.isNaN(Number(cf.value));
        formatRequests.push({
          addConditionalFormatRule: {
            rule: {
              ranges: [{ sheetId, startRowIndex: 1, endRowIndex: Math.max(lastRow, 200), startColumnIndex: colIdx, endColumnIndex: colIdx + 1 }],
              booleanRule: {
                condition: { type: translateConditionType(cf.condition, valueIsNumeric), values: [{ userEnteredValue: String(cf.value) }] },
                format: { backgroundColor: hexToSheetsColor(cf.backgroundColor) },
              },
            },
            index: 0,
          },
        });
      });

      if (sheet.protected) {
        formatRequests.push({
          addProtectedRange: {
            protectedRange: {
              range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: lastCol },
              description: "Header dilindungi otomatis oleh Ponti Sheets",
              warningOnly: true,
            },
          },
        });
      }

      formatRequests.push({
        autoResizeDimensions: { dimensions: { sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: lastCol } },
      });
    });

    (blueprint.namedRanges || []).forEach((nr) => {
      const sheetId = sheetIdBySheetName[nr.sheet];
      const parsedRange = parseSimpleA1Range(nr.range);
      if (sheetId === undefined || !parsedRange) return;
      formatRequests.push({
        addNamedRange: {
          namedRange: { name: sanitizeNamedRangeName(nr.name), range: { sheetId, ...parsedRange } },
        },
      });
    });

    if (formatRequests.length > 0) {
      try {
        await sheetsService.batchUpdate(spreadsheetId, formatRequests);
      } catch (err) {
        // Formatting bersifat "nice-to-have" — kalau sebagian request gagal (mis. nama
        // named range bentrok), data inti (header/dummy data) tetap sudah tersimpan.
        logger.warn("sheets-writer", "Sebagian formatting gagal diterapkan", err);
      }
    }

    onProgress({ step: "done", label: "Spreadsheet berhasil dibuat." });
    return {
      spreadsheetId,
      spreadsheetUrl: created.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    };
  },
};
