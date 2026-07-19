import { sheetsService } from "./sheets.service.js";
import { schemaReaderService } from "./schema-reader.service.js";
import { SCHEMA_METADATA_KEY, buildSchemaMetadataSnapshot, getExistingMetadataId } from "./schema-metadata.util.js";
import { hexToSheetsColor } from "../utils/color.util.js";
import { shiftFormulaRow } from "../utils/formula-shift.util.js";
import { coerceValueToType } from "../utils/type-coerce.util.js";
import { columnIndexToLetter } from "./formula-analyzer.service.js";
import {
  translateValidation, translateForeignKeyValidation, translateConditionType,
  parseSimpleA1Range, sanitizeNamedRangeName,
} from "./sheets-format.util.js";
import { logger } from "../utils/logger.util.js";

/**
 * schema-sync.service.js
 * -----------------------------------------------------------------------
 * "Schema Editor Sync Engine" — menerapkan perubahan yang dibuat pengguna
 * di Schema Editor (tambah/hapus/rename/reorder sheet & kolom, ubah
 * formula/validasi/conditional format/named range/dst) ke spreadsheet
 * Google Sheets yang SUDAH ADA, dengan tetap mempertahankan data yang
 * tidak berubah.
 *
 * STRATEGI: alih-alih mencoba insertDimension/deleteDimension/moveDimension
 * yang gampang salah index kalau banyak perubahan sekaligus, sheet yang
 * strukturnya berubah (kolom ditambah/dihapus/di-reorder) ditulis ULANG
 * datanya secara utuh (header + seluruh baris data lama dipetakan ke
 * posisi kolom baru) dalam SATU kali panggilan values.update — data pada
 * kolom yang tidak berubah tetap dipertahankan persis, dan data pada
 * kolom yang dihapus akan ikut hilang (sudah diberi peringatan tegas
 * lewat layar konfirmasi sebelum tombol ini ditekan).
 * -----------------------------------------------------------------------
 */

function generateClientSheetId(existingIds) {
  let id;
  do {
    id = 100000000 + Math.floor(Math.random() * 900000000);
  } while (existingIds.has(id));
  existingIds.add(id);
  return id;
}

async function rewriteSheetData(spreadsheetId, sheet, originalSheet) {
  let baseRows = [];
  let displayRows = [];
  if (originalSheet && originalSheet.lastRow > 1) {
    // PENTING: pakai sheet.name (nama TERKINI), bukan originalSheet.name — kalau sheet
    // ini juga di-rename, Phase A sudah menerapkan nama baru ke Google Sheets duluan,
    // jadi nama lama sudah tidak ada lagi dan akan gagal kalau dipakai di sini.
    const range = `'${sheet.name}'!A2:ZZ${originalSheet.lastRow}`;
    [baseRows, displayRows] = await Promise.all([
      sheetsService.getValues(spreadsheetId, range), // teks formula asli (kalau ada formula)
      sheetsService.getDisplayValues(spreadsheetId, range), // hasil HITUNGAN/nilai tampilan, bukan teks formula
    ]);
  }

  const origColIndexByKey = new Map((originalSheet?.columns || []).map((c, i) => [c._key, i]));

  const header = sheet.columns.map((c) => c.name);
  let dataRows;

  if (!originalSheet && sheet.dummyData.length > 0) {
    // Sheet baru yang dibuat langsung dengan contoh data (mis. lewat form tambah sheet)
    dataRows = sheet.dummyData.map((rowObj, i) =>
      sheet.columns.map((c) => (c.formula ? shiftFormulaRow(c.formula, i + 2) : rowObj[c.name] ?? rowObj[c.label] ?? c.defaultValue ?? ""))
    );
  } else {
    dataRows = baseRows.map((row, rIdx) =>
      sheet.columns.map((c) => {
        // PENTING: di penulisan tahap ini, kolom berformula SELALU ditulis sebagai
        // formula aktif dulu (termasuk yang di-set "bukan formula aktif" oleh user) —
        // supaya Google Sheets sempat MENGHITUNG nilainya. Kalau formulaIsLive:false,
        // hasil hitungan itu akan "dibekukan" jadi nilai statis di tahap berikutnya
        // (lihat freezeStaticFormulaColumns di bawah).
        if (c.formula) return shiftFormulaRow(c.formula, rIdx + 2);

        const origIdx = origColIndexByKey.get(c._key);
        if (origIdx === undefined) return c.defaultValue ?? "";

        const origCol = originalSheet?.columns[origIdx];
        // PENTING: kalau kolom ini TADINYA berformula tapi formula-nya baru dihapus
        // pengguna, JANGAN pakai teks formula mentah dari baseRows (getValues dengan
        // valueRenderOption=FORMULA) — itu akan menulis ulang teks "=..." yang sama
        // dan otomatis dieksekusi lagi oleh Google Sheets seolah tidak pernah dihapus.
        // Pakai nilai HASIL HITUNGAN terakhirnya (displayRows) sebagai nilai statis.
        const rawValue = origCol?.formula ? (displayRows[rIdx]?.[origIdx] ?? "") : (row[origIdx] ?? "");

        // Kalau tipe kolom ini BARU diubah, konversi data lama supaya sesuai tipe barunya
        // (mis. teks "15.000" -> angka 15000 kalau diubah jadi Number).
        if (origCol && origCol.type !== c.type) {
          return coerceValueToType(rawValue, c.type);
        }
        return rawValue;
      })
    );
  }

  const values = [header, ...dataRows];
  await sheetsService.updateValues(spreadsheetId, `'${sheet.name}'!A1`, values, "USER_ENTERED");

  // Kalau kolom menyusut, bersihkan sisa kolom lama di sebelah kanan supaya tidak ada data "hantu"
  const origColCount = originalSheet?.columns.length || 0;
  if (origColCount > sheet.columns.length) {
    const fromLetter = columnIndexToLetter(sheet.columns.length);
    const toLetter = columnIndexToLetter(origColCount - 1);
    const lastRowNum = Math.max(values.length, 2);
    await sheetsService.clearRange(spreadsheetId, `'${sheet.name}'!${fromLetter}1:${toLetter}${lastRowNum}`);
  }

  // Kolom berformula yang di-set "bukan formula aktif" (checkbox tidak dicentang) —
  // formula-nya SUDAH ditulis & dihitung Google Sheets di atas, sekarang "dibekukan"
  // jadi nilai statis (hasil hitungan saat ini), formula-nya sendiri tidak disimpan.
  const staticFormulaCols = sheet.columns
    .map((c, idx) => ({ c, idx }))
    .filter(({ c }) => c.formula && c.formulaIsLive === false);

  if (staticFormulaCols.length > 0 && dataRows.length > 0) {
    const lastRowNum = dataRows.length + 1;
    for (const { c, idx } of staticFormulaCols) {
      const colLetter = columnIndexToLetter(idx);
      const range = `'${sheet.name}'!${colLetter}2:${colLetter}${lastRowNum}`;
      // eslint-disable-next-line no-await-in-loop
      const computed = await sheetsService.getDisplayValues(spreadsheetId, range);
      if (computed.length > 0) {
        // eslint-disable-next-line no-await-in-loop
        await sheetsService.updateValues(spreadsheetId, range, computed, "USER_ENTERED");
      }
    }
  }

  return values.length; // total baris (termasuk header) setelah ditulis
}

export const schemaSyncService = {
  /**
   * @param {string} spreadsheetId
   * @param {object} original - schema hasil schemaReaderService.readSchema() saat editor dibuka
   * @param {object} edited - schema hasil editan pengguna (bentuk sama)
   * @param {(p:{step:string,label:string}) => void} onProgress
   */
  async apply(spreadsheetId, original, edited, onProgress = () => {}) {
    const originalSheetByKey = new Map(original.sheets.map((s) => [s._key, s]));
    const existingIds = new Set(original.sheets.map((s) => s.sheetId).filter((id) => id !== undefined));

    // Tetapkan sheetId final untuk SETIAP sheet (termasuk yang baru) di awal,
    // supaya seluruh request berikutnya (termasuk index urutan sheet) bisa
    // dikirim dalam susunan yang konsisten tanpa menunggu reply bertahap.
    const sheetIdByKey = new Map();
    edited.sheets.forEach((sheet) => {
      const orig = originalSheetByKey.get(sheet._key);
      sheetIdByKey.set(sheet._key, orig ? orig.sheetId : generateClientSheetId(existingIds));
    });

    // ---- Phase A: struktur sheet (tambah/hapus/rename/reorder/tab color/freeze) ----
    onProgress({ step: "structure", label: "Menyinkronkan struktur sheet..." });
    const structureRequests = [];

    const deletedSheets = original.sheets.filter((s) => !edited.sheets.some((e) => e._key === s._key));
    deletedSheets.forEach((s) => structureRequests.push({ deleteSheet: { sheetId: s.sheetId } }));

    edited.sheets.forEach((sheet, idx) => {
      const orig = originalSheetByKey.get(sheet._key);
      const sheetId = sheetIdByKey.get(sheet._key);
      const gridProperties = {
        frozenRowCount: sheet.freezeRow || 0,
        rowCount: Math.max(1000, (sheet.dummyData?.length || 0) + 50),
        columnCount: Math.max(26, sheet.columns.length + 5),
      };
      const tabColor = sheet.tabColor ? hexToSheetsColor(sheet.tabColor) : undefined;

      if (!orig) {
        structureRequests.push({
          addSheet: { properties: { sheetId, title: sheet.name, index: idx, gridProperties, ...(tabColor ? { tabColor } : {}) } },
        });
      } else {
        // PENTING: field mask "fields" hanya boleh menyebut properti yang benar-benar
        // ada nilainya di body. Kalau sheet tidak punya tabColor kustom (paling umum),
        // tabColor bernilai undefined dan JSON.stringify menghilangkan key-nya — tapi
        // kalau "tabColor" tetap disebut di fields mask, Google API menolak request-nya.
        // Jadi mask dibangun dinamis sesuai field yang memang punya nilai.
        const fieldsToUpdate = ["title", "index", "gridProperties.frozenRowCount"];
        if (tabColor) fieldsToUpdate.push("tabColor");
        structureRequests.push({
          updateSheetProperties: {
            properties: { sheetId, title: sheet.name, index: idx, gridProperties, ...(tabColor ? { tabColor } : {}) },
            fields: fieldsToUpdate.join(","),
          },
        });
      }
    });

    if (structureRequests.length > 0) {
      await sheetsService.batchUpdate(spreadsheetId, structureRequests);
    }

    // ---- Phase B: tulis ulang data untuk sheet yang kolomnya berubah (atau sheet baru) ----
    onProgress({ step: "data", label: "Menulis ulang data sheet yang strukturnya berubah..." });
    const finalRowCountByKey = new Map();

    for (const sheet of edited.sheets) {
      const orig = originalSheetByKey.get(sheet._key);
      const origColByKey = orig ? new Map(orig.columns.map((c) => [c._key, c])) : null;
      const columnsChanged =
        !orig ||
        orig.columns.length !== sheet.columns.length ||
        orig.columns.some((c, i) => c._key !== sheet.columns[i]?._key) ||
        sheet.columns.some((c) => {
          const o = origColByKey?.get(c._key);
          // Kolom berformula SELALU ditulis ulang (formula ter-update di semua baris).
          // Kolom yang tipe datanya diubah juga ditulis ulang (data lama dikonversi ke tipe baru).
          // Kolom yang formulanya baru ditambah/dihapus/diedit juga memicu tulis ulang.
          return c.formula || !o || o.type !== c.type || (o.formula || null) !== (c.formula || null);
        });

      if (columnsChanged) {
        // eslint-disable-next-line no-await-in-loop
        const rowCount = await rewriteSheetData(spreadsheetId, sheet, orig);
        finalRowCountByKey.set(sheet._key, rowCount);
      } else if (orig.name !== sheet.name) {
        // hanya rename kolom (tanpa tambah/hapus/reorder) -> cukup update baris header saja
        // eslint-disable-next-line no-await-in-loop
        await sheetsService.updateValues(spreadsheetId, `'${sheet.name}'!A1`, [sheet.columns.map((c) => c.name)], "USER_ENTERED");
        finalRowCountByKey.set(sheet._key, orig.lastRow);
      } else {
        const renamedCols = sheet.columns.some((c, i) => c.name !== orig.columns[i]?.name);
        if (renamedCols) {
          // eslint-disable-next-line no-await-in-loop
          await sheetsService.updateValues(spreadsheetId, `'${sheet.name}'!A1`, [sheet.columns.map((c) => c.name)], "USER_ENTERED");
        }
        finalRowCountByKey.set(sheet._key, orig.lastRow);
      }
    }

    // ---- Refresh metadata (sheetId pasti, conditionalFormats & protectedRanges & namedRanges terkini) ----
    onProgress({ step: "refresh", label: "Mengambil metadata terbaru..." });
    const freshMeta = await sheetsService.getSpreadsheetMetadata(spreadsheetId);
    const freshSheetByName = new Map((freshMeta.sheets || []).map((s) => [s.properties.title, s]));

    const sheetIdByName = {};
    const lastRowBySheetName = {};
    const columnsBySheetName = {};
    edited.sheets.forEach((sheet) => {
      sheetIdByName[sheet.name] = sheetIdByKey.get(sheet._key);
      lastRowBySheetName[sheet.name] = finalRowCountByKey.get(sheet._key) || 2;
      columnsBySheetName[sheet.name] = sheet.columns;
    });

    // ---- Phase C: setiap KATEGORI formatting dikirim sebagai batchUpdate TERPISAH. ----
    // PENTING: Google Sheets batchUpdate bersifat all-or-nothing — kalau SATU request
    // di dalamnya gagal, SEMUA request dalam batch itu ikut dibatalkan tanpa terkecuali.
    // Sebelumnya semua kategori (validasi, filter, conditional format, protected range,
    // named range) digabung jadi satu batch besar, jadi satu masalah kecil di mana pun
    // bisa diam-diam membatalkan validasi Anda juga. Sekarang tiap kategori berdiri
    // sendiri, supaya validasi tetap tersimpan walau kategori lain bermasalah.
    const warnings = [];

    async function runBatch(label, requests) {
      if (requests.length === 0) return;
      try {
        await sheetsService.batchUpdate(spreadsheetId, requests);
      } catch (err) {
        logger.warn("schema-sync", `Gagal menerapkan ${label}`, err);
        warnings.push(`${label}: ${err.message}`);
      }
    }

    // -- Validasi (termasuk dropdown FK) — PALING PENTING, dikirim & diproses lebih dulu --
    onProgress({ step: "validation", label: "Menerapkan data validation..." });
    const validationRequests = [];
    edited.sheets.forEach((sheet) => {
      const sheetId = sheetIdByKey.get(sheet._key);
      const lastRow = Math.max(lastRowBySheetName[sheet.name], 2);
      sheet.columns.forEach((col, colIdx) => {
        const fkRule = translateForeignKeyValidation(col, sheetIdByName, lastRowBySheetName, columnsBySheetName);
        const rule = fkRule || translateValidation(col);
        validationRequests.push({
          setDataValidation: {
            range: { sheetId, startRowIndex: 1, endRowIndex: Math.max(lastRow, 200), startColumnIndex: colIdx, endColumnIndex: colIdx + 1 },
            rule: rule || null, // null = hapus validasi kalau tipe diubah jadi "none"
          },
        });
      });
    });
    await runBatch("data validation", validationRequests);

    // -- Filter --
    onProgress({ step: "filter", label: "Menerapkan filter..." });
    const filterRequests = [];
    edited.sheets.forEach((sheet) => {
      const sheetId = sheetIdByKey.get(sheet._key);
      const lastRow = Math.max(lastRowBySheetName[sheet.name], 2);
      const lastCol = sheet.columns.length;
      const freshSheetForFilter = freshSheetByName.get(sheet.name);
      const hasExistingFilter = !!freshSheetForFilter?.basicFilter;

      if (sheet.filter) {
        filterRequests.push({
          setBasicFilter: {
            filter: { range: { sheetId, startRowIndex: 0, endRowIndex: lastRow, startColumnIndex: 0, endColumnIndex: lastCol } },
          },
        });
      } else if (hasExistingFilter) {
        filterRequests.push({ clearBasicFilter: { sheetId } });
      }
    });
    await runBatch("filter", filterRequests);

    // -- Conditional Formatting: hapus semua rule lama dulu (batch sendiri), baru tambah yang baru --
    onProgress({ step: "conditional-format", label: "Menerapkan conditional formatting..." });
    const cfDeleteRequests = [];
    edited.sheets.forEach((sheet) => {
      const freshSheet = freshSheetByName.get(sheet.name);
      const existingCount = freshSheet?.conditionalFormats?.length || 0;
      for (let i = existingCount - 1; i >= 0; i -= 1) {
        cfDeleteRequests.push({ deleteConditionalFormatRule: { sheetId: sheetIdByKey.get(sheet._key), index: i } });
      }
    });
    await runBatch("hapus conditional formatting lama", cfDeleteRequests);

    const cfAddRequests = [];
    edited.sheets.forEach((sheet) => {
      const sheetId = sheetIdByKey.get(sheet._key);
      const lastRow = Math.max(lastRowBySheetName[sheet.name], 2);
      sheet.conditionalFormats.forEach((cf) => {
        const colIdx = sheet.columns.findIndex((c) => c.name === cf.column);
        if (colIdx === -1) return;
        const valueIsNumeric = typeof cf.value === "number" || !Number.isNaN(Number(cf.value));
        cfAddRequests.push({
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
    });
    await runBatch("tambah conditional formatting baru", cfAddRequests);

    // -- Protected Range (header) --
    onProgress({ step: "protected-range", label: "Menerapkan protected range..." });
    const protectedDeleteRequests = [];
    const protectedAddRequests = [];
    edited.sheets.forEach((sheet) => {
      const sheetId = sheetIdByKey.get(sheet._key);
      const lastCol = sheet.columns.length;
      const freshSheet = freshSheetByName.get(sheet.name);
      (freshSheet?.protectedRanges || [])
        .filter((pr) => pr.range?.startRowIndex === 0 && pr.range?.endRowIndex === 1)
        .forEach((pr) => protectedDeleteRequests.push({ deleteProtectedRange: { protectedRangeId: pr.protectedRangeId } }));
      if (sheet.protected) {
        protectedAddRequests.push({
          addProtectedRange: {
            protectedRange: {
              range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: lastCol },
              description: "Header dilindungi otomatis oleh Ponti Sheets",
              warningOnly: true,
            },
          },
        });
      }
    });
    await runBatch("hapus protected range lama", protectedDeleteRequests);
    await runBatch("tambah protected range", protectedAddRequests);

    // -- Auto-resize kolom --
    onProgress({ step: "auto-resize", label: "Menyesuaikan lebar kolom..." });
    const autoResizeRequests = edited.sheets.map((sheet) => ({
      autoResizeDimensions: { dimensions: { sheetId: sheetIdByKey.get(sheet._key), dimension: "COLUMNS", startIndex: 0, endIndex: sheet.columns.length } },
    }));
    await runBatch("auto-resize kolom", autoResizeRequests);

    // ---- Phase D: named ranges (diff by namedRangeId) ----
    onProgress({ step: "named-ranges", label: "Menerapkan named ranges..." });
    const namedRangeRequests = [];
    const existingNamedRanges = freshMeta.namedRanges || [];
    const editedByRangeId = new Map(edited.namedRanges.filter((nr) => nr.namedRangeId).map((nr) => [nr.namedRangeId, nr]));

    existingNamedRanges.forEach((nr) => {
      if (!editedByRangeId.has(nr.namedRangeId)) {
        namedRangeRequests.push({ deleteNamedRange: { namedRangeId: nr.namedRangeId } });
      }
    });
    edited.namedRanges.forEach((nr) => {
      const sheetId = sheetIdByName[nr.sheet];
      const parsedRange = parseSimpleA1Range(nr.range);
      if (sheetId === undefined || !parsedRange) return;
      if (nr.namedRangeId) {
        namedRangeRequests.push({
          updateNamedRange: {
            namedRange: { namedRangeId: nr.namedRangeId, name: sanitizeNamedRangeName(nr.name), range: { sheetId, ...parsedRange } },
            fields: "name,range",
          },
        });
      } else {
        namedRangeRequests.push({
          addNamedRange: { namedRange: { name: sanitizeNamedRangeName(nr.name), range: { sheetId, ...parsedRange } } },
        });
      }
    });
    await runBatch("named ranges", namedRangeRequests);

    // ---- Phase E: simpan snapshot tipe/PK/FK sebagai Developer Metadata ----
    // Supaya pembacaan berikutnya tidak perlu menebak ulang tipe kolom dari data
    // mentah (yang tidak akurat untuk currency/url/uuid/percentage/json/array/dst).
    onProgress({ step: "metadata", label: "Menyimpan info tipe kolom..." });
    try {
      const snapshot = buildSchemaMetadataSnapshot(edited);
      const metadataValue = JSON.stringify(snapshot);
      const existingSearch = await sheetsService.searchDeveloperMetadata(spreadsheetId, SCHEMA_METADATA_KEY);
      const existingId = getExistingMetadataId(existingSearch);

      const metadataRequest = existingId
        ? {
            updateDeveloperMetadata: {
              dataFilters: [{ developerMetadataLookup: { metadataId: existingId } }],
              developerMetadata: { metadataId: existingId, metadataKey: SCHEMA_METADATA_KEY, metadataValue, visibility: "DOCUMENT" },
              fields: "metadataValue",
            },
          }
        : {
            createDeveloperMetadata: {
              developerMetadata: {
                metadataKey: SCHEMA_METADATA_KEY, metadataValue, visibility: "DOCUMENT",
                location: { spreadsheet: true },
              },
            },
          };

      await sheetsService.batchUpdate(spreadsheetId, [metadataRequest]);
    } catch (err) {
      // Kalau ini gagal, fitur tetap berjalan (hanya jatuh ke tebakan heuristik lagi
      // di pembacaan berikutnya) — jangan sampai menggagalkan keseluruhan proses apply.
      logger.warn("schema-sync", "Gagal menyimpan metadata tipe kolom", err);
      warnings.push(`Metadata tipe kolom: ${err.message}`);
    }

    onProgress({ step: "reload", label: "Memuat ulang struktur terbaru..." });
    const refreshed = await schemaReaderService.readSchema(spreadsheetId);

    onProgress({ step: "done", label: "Perubahan berhasil diterapkan." });
    return { blueprint: refreshed.blueprint, warnings };
  },
};
