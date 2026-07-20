import { sheetsService } from "./sheets.service.js";
import { normalizeBlueprint, generateKey } from "../models/blueprint.model.js";
import { sheetsColorToHex } from "../utils/color.util.js";
import { SCHEMA_METADATA_KEY, parseSchemaMetadataSnapshot } from "./schema-metadata.util.js";

/**
 * schema-reader.service.js
 * -----------------------------------------------------------------------
 * Membaca struktur AKTUAL sebuah Google Sheets yang sudah ada (bukan
 * membuat baru) menjadi bentuk "blueprint" yang sama dengan Database
 * Builder, supaya Schema Editor bisa memakai UI/model yang sama. Dipakai
 * HANYA oleh Schema Editor.
 * -----------------------------------------------------------------------
 */

const HEADER_ROW_INDEX = 0;
const SAMPLE_ROW_INDEX = 1;

function cellValueToPlain(cell) {
  if (!cell) return "";
  const uev = cell.userEnteredValue;
  if (uev?.formulaValue) return uev.formulaValue;
  if (uev?.stringValue !== undefined) return uev.stringValue;
  if (uev?.numberValue !== undefined) return uev.numberValue;
  if (uev?.boolValue !== undefined) return uev.boolValue;
  return cell.formattedValue ?? "";
}

function parseValidationFromApi(dataValidation) {
  if (!dataValidation?.condition) return null;
  const { type, values } = dataValidation.condition;
  const vals = (values || []).map((v) => v.userEnteredValue);

  switch (type) {
    case "ONE_OF_LIST":
      return { type: "list", options: vals, min: null, max: null };
    case "ONE_OF_RANGE":
      return { type: "list", options: [], min: null, max: null }; // FK dropdown; opsi asli ada di range, bukan literal
    case "NUMBER_BETWEEN":
      return { type: "number", options: null, min: Number(vals[0]), max: Number(vals[1]) };
    case "NUMBER_GREATER_THAN_EQ":
      return { type: "number", options: null, min: Number(vals[0]), max: null };
    case "NUMBER_LESS_THAN_EQ":
      return { type: "number", options: null, min: null, max: Number(vals[0]) };
    case "DATE_IS_VALID":
      return { type: "date", options: null, min: null, max: null };
    case "BOOLEAN":
      return { type: "checkbox", options: null, min: null, max: null };
    case "TEXT_IS_EMAIL":
      return { type: "email", options: null, min: null, max: null };
    case "CUSTOM_FORMULA":
      return { type: "phone", options: null, min: null, max: null };
    default:
      return null;
  }
}

function guessColumnType(validation, sampleValue) {
  if (validation?.type === "number") return "number";
  if (validation?.type === "date") return "date";
  if (validation?.type === "checkbox") return "boolean";
  if (validation?.type === "email") return "email";
  if (validation?.type === "phone") return "phone";
  if (typeof sampleValue === "number") return "number";
  if (typeof sampleValue === "boolean") return "boolean";
  return "text";
}

function mapConditionalFormats(apiRules, columns) {
  return (apiRules || [])
    .map((rule) => {
      const range = rule.ranges?.[0];
      if (!range) return null;
      const column = columns[range.startColumnIndex];
      if (!column) return null;
      const cond = rule.booleanRule?.condition;
      const bg = rule.booleanRule?.format?.backgroundColor;
      if (!cond) return null;
      const conditionMap = {
        NUMBER_LESS: "less_than", NUMBER_GREATER: "greater_than", NUMBER_EQ: "equal",
        TEXT_EQ: "text_equals", TEXT_CONTAINS: "text_contains",
      };
      return {
        column: column.name,
        condition: conditionMap[cond.type] || "text_contains",
        value: cond.values?.[0]?.userEnteredValue ?? "",
        backgroundColor: sheetsColorToHex(bg) || "#EF4444",
        description: "",
      };
    })
    .filter(Boolean);
}

export const schemaReaderService = {
  /**
   * @param {string} spreadsheetId
   * @returns {Promise<{ blueprint: object, spreadsheetUrl: string }>}
   */
  async readSchema(spreadsheetId) {
    const meta = await sheetsService.getSpreadsheetMetadata(spreadsheetId);
    const metadataSearch = await sheetsService.searchDeveloperMetadata(spreadsheetId, SCHEMA_METADATA_KEY);
    const savedSnapshot = parseSchemaMetadataSnapshot(metadataSearch);

    const sheetsRaw = await Promise.all(
      (meta.sheets || []).map(async (s) => {
        const title = s.properties.title;
        const sheetId = s.properties.sheetId;

        const [gridData, lastRow] = await Promise.all([
          sheetsService.getHeaderAndSampleRow(spreadsheetId, title),
          sheetsService.getLastRowCount(spreadsheetId, title),
        ]);

        const rows = gridData.sheets?.[0]?.data?.[0]?.rowData || [];
        const headerCells = rows[HEADER_ROW_INDEX]?.values || [];
        const sampleCells = rows[SAMPLE_ROW_INDEX]?.values || [];

        const savedColumns = savedSnapshot?.sheets?.[title]?.columns || {};

        const columns = headerCells
          .map((cell, idx) => {
            const name = cellValueToPlain(cell);
            if (!name) return null; // kolom kosong di akhir, abaikan
            const sampleCell = sampleCells[idx];
            const sampleValue = cellValueToPlain(sampleCell);
            const validation = parseValidationFromApi(sampleCell?.dataValidation);
            const isFormula = typeof sampleValue === "string" && sampleValue.startsWith("=");
            const saved = savedColumns[name];

            // PENTING: kalau formula sudah "dibekukan" (formulaIsLive:false), sel di Google
            // Sheets TIDAK lagi berisi formula (cuma nilai hasil hitungannya) — jadi formula
            // aslinya HANYA bisa diketahui dari metadata tersimpan, tidak bisa dideteksi lagi
            // dari isi sel. Kalau belum pernah di-set lewat Schema Editor, jatuh ke deteksi biasa.
            let formula = null;
            let formulaIsLive = true;
            if (saved?.formulaIsLive === false) {
              formula = saved.formula || null;
              formulaIsLive = false;
            } else if (isFormula) {
              formula = sampleValue;
              formulaIsLive = true;
            } else if (saved?.formula) {
              formula = saved.formula;
              formulaIsLive = saved.formulaIsLive !== false;
            }

            return {
              _key: generateKey("col"),
              name,
              label: saved?.label || name,
              description: saved?.description || "",
              // Kalau ada metadata tersimpan, PAKAI itu (persis seperti yang di-set
              // user) — jangan tebak ulang. Kalau tidak ada (kolom baru / spreadsheet
              // belum pernah disentuh Schema Editor), baru jatuh ke heuristik.
              type: saved?.type || guessColumnType(validation, sampleValue),
              required: saved ? !!saved.required : false,
              isPrimaryKey: saved ? !!saved.isPrimaryKey : (/^(id_|kode_)/i.test(name) || idx === 0),
              isForeignKey: saved ? !!saved.isForeignKey : false,
              referencesSheet: saved?.referencesSheet || null,
              referencesColumn: saved?.referencesColumn || null,
              defaultValue: null,
              formula,
              formulaIsLive,
              validation,
              sampleData: [],
            };
          })
          .filter(Boolean);

        return {
          _key: generateKey("sheet"),
          name: title,
          description: "",
          tabColor: sheetsColorToHex(s.properties.tabColor),
          freezeRow: s.properties.gridProperties?.frozenRowCount || 0,
          filter: !!s.basicFilter,
          columns,
          dummyData: [],
          conditionalFormats: mapConditionalFormats(s.conditionalFormats, columns),
          protected: (s.protectedRanges || []).some(
            (pr) => pr.range?.startRowIndex === 0 && pr.range?.endRowIndex === 1 && (pr.range?.sheetId ?? sheetId) === sheetId
          ),
          sheetId,
          lastRow,
        };
      })
    );

    const blueprint = normalizeBlueprint({
      project: { name: meta.properties?.title || "Database", description: "" },
      sheets: sheetsRaw,
      relationships: [],
      namedRanges: (meta.namedRanges || []).map((nr) => ({
        name: nr.name,
        sheet: sheetsRaw.find((s) => s.sheetId === nr.range?.sheetId)?.name || "",
        range: "", // range asli dalam bentuk index, tidak direkonstruksi ke A1 untuk ditampilkan (cukup untuk identifikasi)
        namedRangeId: nr.namedRangeId,
      })),
      businessRules: [],
      documentation: {},
      recommendations: [],
    });

    return {
      blueprint,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    };
  },
};
