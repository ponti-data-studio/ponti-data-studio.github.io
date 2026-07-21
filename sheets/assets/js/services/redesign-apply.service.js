import { sheetsService } from "./sheets.service.js";
import { columnIndexToLetter } from "./formula-analyzer.service.js";
import { generateKey } from "../models/blueprint.model.js";

/**
 * redesign-apply.service.js
 * -----------------------------------------------------------------------
 * Menerapkan saran dari "Minta Saran AI" di Schema Editor.
 *
 * Saran SEDERHANA (set_pk, set_fk, set_type, rename_column, rename_sheet,
 * add_column) cuma mengubah METADATA — jadi cukup dimutasi langsung ke
 * objek `edited` yang sudah dikelola Schema Editor, sama seperti kalau
 * pengguna mengedit manual. Perubahan itu baru benar-benar tersimpan ke
 * Google Sheets saat pengguna klik "Terapkan Perubahan" seperti biasa —
 * jadi tetap lewat layar konfirmasi & Sync Engine yang sudah teruji.
 *
 * Saran "split_sheet" BEDA SENDIRI: ini memindahkan DATA sungguhan (bukan
 * cuma struktur), jadi ditulis LANGSUNG ke Google Sheets saat diterapkan
 * (fetch data asli, deduplikasi, buat sheet baru, update sheet asal) —
 * tidak bisa "ditahan" dulu sebagai editan biasa karena butuh nilai FK
 * yang berbeda-beda per baris, bukan satu nilai default yang sama.
 * -----------------------------------------------------------------------
 */

function newColumnLike(template) {
  return {
    _key: generateKey("col"), name: template.name, label: template.name, description: "",
    type: template.type || "text",
    required: { value: "unknown", condition: null },
    editable: { value: "unknown", condition: null },
    show: { value: "unknown", condition: null },
    isPrimaryKey: !!template.isPrimaryKey, isForeignKey: !!template.isForeignKey,
    referencesSheet: template.referencesSheet || null, referencesColumn: template.referencesColumn || null,
    defaultValue: null, formula: null, formulaIsLive: false,
    validation: null, sampleData: [],
  };
}

/** Terapkan satu saran SEDERHANA (metadata-only) ke objek `edited` — sinkron, tidak menyentuh Google Sheets. */
export function applySimpleSuggestion(edited, action) {
  switch (action.type) {
    case "set_pk": {
      const sheet = edited.sheets.find((s) => s.name === action.sheet);
      const col = sheet?.columns.find((c) => c.name === action.column);
      if (col) col.isPrimaryKey = !!action.value;
      return true;
    }
    case "set_fk": {
      const sheet = edited.sheets.find((s) => s.name === action.sheet);
      const col = sheet?.columns.find((c) => c.name === action.column);
      if (col) {
        col.isForeignKey = true;
        col.referencesSheet = action.referencesSheet;
        col.referencesColumn = action.referencesColumn;
      }
      return true;
    }
    case "set_type": {
      const sheet = edited.sheets.find((s) => s.name === action.sheet);
      const col = sheet?.columns.find((c) => c.name === action.column);
      if (col) col.type = action.newType;
      return true;
    }
    case "rename_column": {
      const sheet = edited.sheets.find((s) => s.name === action.sheet);
      const col = sheet?.columns.find((c) => c.name === action.column);
      if (col) { col.name = action.newName; col.label = action.newName; }
      return true;
    }
    case "rename_sheet": {
      const sheet = edited.sheets.find((s) => s.name === action.sheet);
      if (sheet) sheet.name = action.newName;
      return true;
    }
    case "add_column": {
      const sheet = edited.sheets.find((s) => s.name === action.sheet);
      if (sheet) {
        sheet.columns.push(newColumnLike({ name: action.columnName, type: action.type, isPrimaryKey: action.isPrimaryKey }));
      }
      return true;
    }
    default:
      return false;
  }
}

/**
 * Terapkan saran "split_sheet" LANGSUNG ke Google Sheets (bukan ke objek
 * `edited` di memori) — karena butuh membaca data asli, mendeduplikasi,
 * lalu menulis sheet baru + memperbarui sheet asal dengan nilai FK yang
 * berbeda per baris.
 *
 * @returns {Promise<{ createdSheetName: string, rowCount: number }>}
 */
export async function applySplitSheetSuggestion(spreadsheetId, sourceSheetMeta, action) {
  const { sourceSheet: sourceSheetName, extractColumns, newSheetName, newPkName } = action;
  const lastRow = sourceSheetMeta.lastRow;

  if (lastRow <= 1) {
    throw new Error(`Sheet "${sourceSheetName}" tidak punya data untuk dipisah.`);
  }

  const extractColIndexes = extractColumns.map((name) => sourceSheetMeta.columns.findIndex((c) => c.name === name));
  if (extractColIndexes.some((idx) => idx === -1)) {
    throw new Error(`Salah satu kolom (${extractColumns.join(", ")}) tidak ditemukan di sheet "${sourceSheetName}".`);
  }

  const range = `'${sourceSheetName}'!A2:ZZ${lastRow}`;
  const rows = await sheetsService.getDisplayValues(spreadsheetId, range);

  // Deduplikasi kombinasi nilai kolom yang diekstrak -> jadi baris unik di sheet baru
  const uniqueMap = new Map();
  const dedupedRows = [];
  const fkValuePerSourceRow = [];
  let pkCounter = 1;
  const pkPrefix = newPkName.replace(/[^a-zA-Z]/g, "").slice(0, 3).toUpperCase() || "ID";

  rows.forEach((row) => {
    const values = extractColIndexes.map((idx) => row[idx] ?? "");
    const key = JSON.stringify(values);
    if (!uniqueMap.has(key)) {
      const pkValue = `${pkPrefix}${String(pkCounter).padStart(3, "0")}`;
      uniqueMap.set(key, pkValue);
      const dummyRow = { [newPkName]: pkValue };
      extractColumns.forEach((colName, i) => { dummyRow[colName] = values[i]; });
      dedupedRows.push(dummyRow);
      pkCounter += 1;
    }
    fkValuePerSourceRow.push(uniqueMap.get(key));
  });

  // 1) Buat sheet baru berisi data unik hasil ekstraksi
  const newSheetColumns = [
    newColumnLike({ name: newPkName, isPrimaryKey: true }),
    ...extractColumns.map((colName) => {
      const origCol = sourceSheetMeta.columns.find((c) => c.name === colName);
      return newColumnLike({ name: colName, type: origCol?.type || "text" });
    }),
  ];

  const structureResp = await sheetsService.batchUpdate(spreadsheetId, [
    { addSheet: { properties: { title: newSheetName } } },
  ]);
  const newSheetId = structureResp.replies?.[0]?.addSheet?.properties?.sheetId;

  const newSheetValues = [
    newSheetColumns.map((c) => c.name),
    ...dedupedRows.map((r) => newSheetColumns.map((c) => r[c.name] ?? "")),
  ];
  await sheetsService.updateValues(spreadsheetId, `'${newSheetName}'!A1`, newSheetValues, "USER_ENTERED");

  // 2) Update sheet asal: ganti kolom yang diekstrak dengan satu kolom FK baru,
  //    nilainya berbeda per baris sesuai hasil deduplikasi di atas.
  const keptColumns = sourceSheetMeta.columns.filter((c) => !extractColumns.includes(c.name));
  const fkColumnName = newPkName;
  const sourceHeader = [...keptColumns.map((c) => c.name), fkColumnName];
  const sourceRows = rows.map((row, i) => {
    const keptValues = keptColumns.map((c) => {
      const origIdx = sourceSheetMeta.columns.findIndex((oc) => oc.name === c.name);
      return row[origIdx] ?? "";
    });
    return [...keptValues, fkValuePerSourceRow[i]];
  });
  await sheetsService.updateValues(spreadsheetId, `'${sourceSheetName}'!A1`, [sourceHeader, ...sourceRows], "USER_ENTERED");

  // Bersihkan sisa kolom lama yang sekarang di luar lebar baru (kalau kolom menyusut)
  const oldColCount = sourceSheetMeta.columns.length;
  const newColCount = sourceHeader.length;
  if (oldColCount > newColCount) {
    const fromLetter = columnIndexToLetter(newColCount);
    const toLetter = columnIndexToLetter(oldColCount - 1);
    await sheetsService.clearRange(spreadsheetId, `'${sourceSheetName}'!${fromLetter}1:${toLetter}${lastRow}`);
  }

  return { createdSheetName: newSheetName, newSheetId, rowCount: dedupedRows.length };
}
