import { sheetsService } from "./sheets.service.js";
import { detectColumnType, detectPrimaryKey, detectForeignKeyCandidate } from "./column-type-detector.service.js";
import { analyzeFormulas, columnIndexToLetter } from "./formula-analyzer.service.js";
import { runDataQualityChecks } from "./data-quality.service.js";
import { SheetModel, ColumnModel, SpreadsheetModel, RelationshipModel } from "../models/spreadsheet.model.js";
import { SCHEMA_METADATA_KEY, parseSchemaMetadataSnapshot } from "./schema-metadata.util.js";
import { logger } from "../utils/logger.util.js";

const SAMPLE_ROW_LIMIT = 50;

/** Ubah named range mentah dari Google Sheets API (sheetId + index numerik) jadi
 *  bentuk siap-pakai {name, sheet, range} dengan notasi A1 yang manusiawi. */
function buildNamedRangesSummary(meta) {
  const sheetNameById = new Map((meta.sheets || []).map((s) => [s.properties.sheetId, s.properties.title]));

  return (meta.namedRanges || [])
    .map((nr) => {
      const r = nr.range || {};
      const sheetName = sheetNameById.get(r.sheetId) || "";
      let range = "";
      if (r.startColumnIndex !== undefined && r.startRowIndex !== undefined) {
        const endColIdx = (r.endColumnIndex ?? r.startColumnIndex + 1) - 1;
        const endRowNum = r.endRowIndex ?? r.startRowIndex + 1;
        range = `${columnIndexToLetter(r.startColumnIndex)}${r.startRowIndex + 1}:${columnIndexToLetter(endColIdx)}${endRowNum}`;
      }
      return { name: nr.name, sheet: sheetName, range };
    })
    .filter((nr) => nr.sheet && nr.range);
}

/**
 * analysis.service.js
 * -----------------------------------------------------------------------
 * Orkestrator utama proses "Analyze Spreadsheet". Memanggil sheetsService
 * untuk ambil data mentah, lalu mendelegasikan ke service spesialis
 * (type detector, formula analyzer, data quality) untuk menghasilkan
 * SpreadsheetModel yang lengkap.
 *
 * PENTING: kalau spreadsheet ini pernah disunting lewat Schema Editor,
 * tipe/PK/FK kolom yang SUDAH DITENTUKAN PENGGUNA di sana (tersimpan
 * sebagai Developer Metadata) selalu diikuti di sini — bukan ditebak
 * ulang dari heuristik — supaya Analysis/Database Context/ERD konsisten
 * dengan apa yang sudah diatur user, bukan "lupa" lagi.
 * -----------------------------------------------------------------------
 */

function buildColumnsFromGrid(headerRow, dataRows, savedColumns = {}, formulaSampleRow = []) {
  return headerRow.map((headerName, colIdx) => {
    const columnValues = dataRows.map((row) => row[colIdx]);
    const saved = savedColumns[headerName || `col_${colIdx}`];

    const sampleFormulaCell = formulaSampleRow[colIdx];
    const isLiveFormula = typeof sampleFormulaCell === "string" && sampleFormulaCell.startsWith("=");

    // PENTING: kalau formula sudah "dibekukan" (formulaIsLive:false) lewat Schema Editor,
    // sel di Google Sheets TIDAK lagi berisi formula — formula aslinya hanya bisa diketahui
    // dari metadata tersimpan, tidak bisa dideteksi lagi dari isi sel yang sekarang.
    let formula = null;
    let formulaIsLive = true;
    if (saved?.formulaIsLive === false) {
      formula = saved.formula || null;
      formulaIsLive = false;
    } else if (isLiveFormula) {
      formula = sampleFormulaCell;
      formulaIsLive = true;
    } else if (saved?.formula) {
      formula = saved.formula;
      formulaIsLive = saved.formulaIsLive !== false;
    }

    if (saved) {
      // Ikuti persis apa yang sudah diatur user di Schema Editor — jangan tebak ulang.
      const requiredField = saved.required || { value: "unknown", condition: null };
      return new ColumnModel({
        name: headerName || `Kolom${colIdx + 1}`,
        index: colIdx,
        type: saved.type,
        isPrimaryKey: !!saved.isPrimaryKey,
        isForeignKey: !!saved.isForeignKey,
        referencesSheet: saved.referencesSheet || null,
        referencesColumn: saved.referencesColumn || null,
        confidence: 1,
        sampleValues: [...new Set(columnValues.filter((v) => v !== null && v !== ""))].slice(0, 5),
        warnings: [],
        formula,
        formulaIsLive,
        required: requiredField,
        editable: saved.editable || { value: "unknown", condition: null },
        show: saved.show || { value: "unknown", condition: null },
      });
    }

    const { type, confidence: typeConfidence } = detectColumnType(columnValues);
    const pk = detectPrimaryKey(headerName || `col_${colIdx}`, columnValues);
    const fkCandidate = detectForeignKeyCandidate(headerName || "");

    return new ColumnModel({
      name: headerName || `Kolom${colIdx + 1}`,
      index: colIdx,
      type,
      isPrimaryKey: pk.isPrimaryKey,
      isForeignKey: fkCandidate,
      confidence: Math.max(typeConfidence, pk.confidence),
      sampleValues: [...new Set(columnValues.filter((v) => v !== null && v !== ""))].slice(0, 5),
      warnings: [],
      formula,
      formulaIsLive,
    });
  });
}

/** Coba temukan sheet & kolom PK yang direferensikan oleh sebuah kolom FK */
function resolveForeignKeyTargets(sheets) {
  const relationships = [];
  const pkIndex = new Map(); // "columnBaseName" -> { sheet, column }

  for (const sheet of sheets) {
    for (const col of sheet.columns) {
      if (col.isPrimaryKey) {
        const base = col.name.toLowerCase().replace(/^id_?/, "").replace(/_id$|_code$/, "");
        pkIndex.set(base || sheet.name.toLowerCase(), { sheet: sheet.name, column: col.name });
        pkIndex.set(col.name.toLowerCase(), { sheet: sheet.name, column: col.name });
      }
    }
  }

  for (const sheet of sheets) {
    for (const col of sheet.columns) {
      if (!col.isForeignKey) continue;

      // Kalau referencesSheet/referencesColumn SUDAH diatur user lewat Schema Editor
      // (dari saved metadata), langsung pakai itu — jangan ditebak ulang.
      if (col.referencesSheet && col.referencesColumn) {
        relationships.push(
          new RelationshipModel({
            fromSheet: sheet.name,
            fromColumn: col.name,
            toSheet: col.referencesSheet,
            toColumn: col.referencesColumn,
            confidence: 1,
            type: "many-to-one",
          })
        );
        continue;
      }

      const base = col.name.toLowerCase().replace(/^id_?/, "").replace(/_id$|_code$/, "");
      const target = pkIndex.get(base) || pkIndex.get(col.name.toLowerCase());
      if (target && target.sheet !== sheet.name) {
        col.referencesSheet = target.sheet;
        col.referencesColumn = target.column;
        relationships.push(
          new RelationshipModel({
            fromSheet: sheet.name,
            fromColumn: col.name,
            toSheet: target.sheet,
            toColumn: target.column,
            confidence: 0.75,
            type: "many-to-one",
          })
        );
      }
    }
  }

  return relationships;
}

export const analysisService = {
  /**
   * Menjalankan analisis penuh terhadap sebuah spreadsheet Google.
   * @param {string} spreadsheetId
   * @returns {Promise<{ model: SpreadsheetModel, relationships: RelationshipModel[] }>}
   */
  async analyzeSpreadsheet(spreadsheetId, onProgress = () => {}) {
    onProgress({ step: "metadata", label: "Mengambil metadata spreadsheet..." });
    const meta = await sheetsService.getSpreadsheetMetadata(spreadsheetId);

    const metadataSearch = await sheetsService.searchDeveloperMetadata(spreadsheetId, SCHEMA_METADATA_KEY);
    const savedSnapshot = parseSchemaMetadataSnapshot(metadataSearch);

    const sheets = [];

    for (const sheetMeta of meta.sheets) {
      const title = sheetMeta.properties.title;
      onProgress({ step: "sheet", label: `Menganalisis sheet "${title}"...` });

      const rowCount = sheetMeta.properties.gridProperties?.rowCount || 0;
      const colCount = sheetMeta.properties.gridProperties?.columnCount || 0;
      const range = `${title}!A1:${columnCountToLetter(colCount)}${Math.min(rowCount, SAMPLE_ROW_LIMIT + 1)}`;

      let formulaGrid = [];
      let valueGrid = [];
      try {
        [formulaGrid, valueGrid] = await Promise.all([
          sheetsService.getValues(spreadsheetId, range),
          sheetsService.getDisplayValues(spreadsheetId, range),
        ]);
      } catch (err) {
        logger.warn("analysis", `Gagal mengambil data sheet "${title}"`, err);
      }

      const headerRow = (valueGrid[0] || []).map((h) => String(h ?? "").trim());
      const dataRows = valueGrid.slice(1);

      const savedColumns = savedSnapshot?.sheets?.[title]?.columns || {};
      const formulaSampleRow = formulaGrid[1] || [];
      const columns = buildColumnsFromGrid(headerRow, dataRows, savedColumns, formulaSampleRow);

      const formulas = analyzeFormulas(title, formulaGrid);

      const sheetModel = new SheetModel({
        name: title,
        rowCount,
        columnCount: colCount,
        columns,
        sampleData: dataRows.slice(0, SAMPLE_ROW_LIMIT),
        formulas,
        mergedCells: sheetMeta.merges || [],
        frozenRows: sheetMeta.properties.gridProperties?.frozenRowCount || 0,
        frozenColumns: sheetMeta.properties.gridProperties?.frozenColumnCount || 0,
        filters: sheetMeta.basicFilter ? [sheetMeta.basicFilter] : [],
        conditionalFormats: sheetMeta.conditionalFormats || [],
        protectedRanges: sheetMeta.protectedRanges || [],
        developerMetadata: sheetMeta.developerMetadata || [],
        namedRanges: meta.namedRanges || [],
      });

      sheets.push(sheetModel);
    }

    onProgress({ step: "relationships", label: "Mendeteksi relasi antar sheet..." });
    const relationships = resolveForeignKeyTargets(sheets);

    onProgress({ step: "quality", label: "Memeriksa kualitas data..." });
    sheets.forEach((sheet) => {
      sheet.qualityWarnings = runDataQualityChecks(sheet);
    });

    const model = new SpreadsheetModel({
      id: meta.spreadsheetId,
      name: meta.properties.title,
      locale: meta.properties.locale,
      timezone: meta.properties.timeZone,
      sheets,
      namedRanges: buildNamedRangesSummary(meta),
    });

    onProgress({ step: "done", label: "Analisis selesai." });
    return { model, relationships };
  },
};

function columnCountToLetter(count) {
  let letter = "";
  let n = count - 1;
  while (n >= 0) {
    letter = String.fromCharCode((n % 26) + 65) + letter;
    n = Math.floor(n / 26) - 1;
  }
  return letter || "Z";
}
