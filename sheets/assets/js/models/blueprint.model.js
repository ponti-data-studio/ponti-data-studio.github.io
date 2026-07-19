/**
 * blueprint.model.js
 * -----------------------------------------------------------------------
 * Model & normalizer untuk `database_blueprint.json` yang dihasilkan AI
 * pada fitur Database Builder. Karena responsnya datang dari AI (yang
 * kadang tidak 100% konsisten), `normalizeBlueprint()` mengisi nilai
 * default untuk field yang hilang supaya seluruh Generator (Sheets/Excel)
 * bisa mengasumsikan struktur yang selalu lengkap.
 *
 * Setiap sheet & kolom juga diberi `_key` (identitas stabil, bukan nama)
 * supaya Schema Editor bisa membedakan "kolom yang di-rename" dari
 * "kolom dihapus + kolom baru ditambah" saat melakukan diff perubahan.
 * -----------------------------------------------------------------------
 */

let keyCounter = 0;
export function generateKey(prefix = "k") {
  keyCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${keyCounter}`;
}

function normalizeColumn(raw, idx) {
  return {
    _key: raw?._key || generateKey("col"),
    name: raw?.name || `Kolom${idx + 1}`,
    label: raw?.label || raw?.name || `Kolom${idx + 1}`,
    description: raw?.description || "",
    type: raw?.type || "text",
    required: !!raw?.required,
    isPrimaryKey: !!raw?.isPrimaryKey || !!raw?.is_primary_key,
    isForeignKey: !!raw?.isForeignKey || !!raw?.is_foreign_key,
    referencesSheet: raw?.referencesSheet || raw?.references_sheet || null,
    referencesColumn: raw?.referencesColumn || raw?.references_column || null,
    defaultValue: raw?.defaultValue ?? raw?.default_value ?? null,
    formula: raw?.formula || null,
    // formulaIsLive: true = tulis sebagai formula aktif (nilai ikut berubah otomatis);
    // false = "bekukan" jadi nilai hasil hitungannya saat ini (statis, formula tidak ditulis).
    formulaIsLive: raw?.formulaIsLive !== undefined ? !!raw.formulaIsLive : true,
    validation: raw?.validation || null,
    sampleData: Array.isArray(raw?.sampleData) ? raw.sampleData : Array.isArray(raw?.sample_data) ? raw.sample_data : [],
  };
}

function normalizeSheet(raw, idx) {
  const columns = Array.isArray(raw?.columns) ? raw.columns.map(normalizeColumn) : [];
  return {
    _key: raw?._key || generateKey("sheet"),
    name: raw?.name || `Sheet${idx + 1}`,
    description: raw?.description || "",
    tabColor: raw?.tabColor || raw?.tab_color || null,
    freezeRow: Number.isFinite(raw?.freezeRow) ? raw.freezeRow : Number.isFinite(raw?.freeze_row) ? raw.freeze_row : 1,
    filter: raw?.filter !== undefined ? !!raw.filter : true,
    columns,
    dummyData: Array.isArray(raw?.dummyData) ? raw.dummyData : Array.isArray(raw?.dummy_data) ? raw.dummy_data : [],
    conditionalFormats: Array.isArray(raw?.conditionalFormats) ? raw.conditionalFormats : Array.isArray(raw?.conditional_formats) ? raw.conditional_formats : [],
    protected: !!raw?.protected,
    // sheetId = ID asli Google Sheets (ada isinya kalau sheet ini dibaca dari
    // spreadsheet yang sudah ada; undefined kalau sheet baru dibuat di editor)
    sheetId: raw?.sheetId !== undefined ? raw.sheetId : undefined,
    lastRow: Number.isFinite(raw?.lastRow) ? raw.lastRow : 1,
  };
}

export function normalizeBlueprint(raw) {
  const project = raw?.project || {};
  const sheets = Array.isArray(raw?.sheets) ? raw.sheets.map(normalizeSheet) : [];
  const namedRangesRaw = Array.isArray(raw?.namedRanges) ? raw.namedRanges : Array.isArray(raw?.named_ranges) ? raw.named_ranges : [];

  return {
    project: {
      name: project.name || "Database Tanpa Nama",
      description: project.description || "",
    },
    sheets,
    relationships: Array.isArray(raw?.relationships) ? raw.relationships : [],
    namedRanges: namedRangesRaw.map((nr) => ({
      _key: nr._key || generateKey("nr"),
      name: nr.name || "",
      sheet: nr.sheet || "",
      range: nr.range || "",
      namedRangeId: nr.namedRangeId,
    })),
    businessRules: Array.isArray(raw?.businessRules) ? raw.businessRules : Array.isArray(raw?.business_rules) ? raw.business_rules : [],
    documentation: raw?.documentation || {},
    recommendations: Array.isArray(raw?.recommendations) ? raw.recommendations : [],
  };
}

export function computeBlueprintStats(blueprint) {
  return {
    sheetCount: blueprint.sheets.length,
    columnCount: blueprint.sheets.reduce((sum, s) => sum + s.columns.length, 0),
    relationshipCount: blueprint.relationships.length,
    formulaCount: blueprint.sheets.reduce((sum, s) => sum + s.columns.filter((c) => c.formula).length, 0),
    dummyDataRowCount: blueprint.sheets.reduce((sum, s) => sum + s.dummyData.length, 0),
    validationCount: blueprint.sheets.reduce((sum, s) => sum + s.columns.filter((c) => c.validation).length, 0),
    conditionalFormatCount: blueprint.sheets.reduce((sum, s) => sum + s.conditionalFormats.length, 0),
  };
}
