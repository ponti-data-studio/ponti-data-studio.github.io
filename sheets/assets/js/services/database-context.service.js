/**
 * database-context.service.js
 * -----------------------------------------------------------------------
 * INTI APLIKASI. Mengubah hasil analysis.service.js menjadi
 * `database_context.json` — representasi ringkas namun kaya informasi
 * yang akan dipakai Prompt Builder untuk membangun prompt AI.
 * -----------------------------------------------------------------------
 */

function buildBusinessRules(sheets, relationships) {
  const rules = [];
  sheets.forEach((sheet) => {
    const pk = sheet.columns.find((c) => c.isPrimaryKey);
    if (pk) rules.push(`Setiap baris pada "${sheet.name}" harus memiliki nilai unik pada kolom "${pk.name}".`);
    sheet.columns
      .filter((c) => c.required?.value === "true")
      .forEach((c) => {
        const conditionNote = c.required.condition ? ` (bersyarat: ${c.required.condition})` : "";
        rules.push(`Kolom "${c.name}" pada sheet "${sheet.name}" wajib diisi (tidak boleh kosong)${conditionNote}.`);
      });
  });
  relationships.forEach((rel) => {
    rules.push(`Setiap "${rel.fromColumn}" pada "${rel.fromSheet}" harus merujuk ke "${rel.toColumn}" yang valid pada "${rel.toSheet}".`);
  });
  return rules;
}

function buildStatistics(sheets) {
  return {
    totalSheets: sheets.length,
    totalColumns: sheets.reduce((sum, s) => sum + s.columns.length, 0),
    totalFormulas: sheets.reduce((sum, s) => sum + s.formulas.length, 0),
    totalRowsEstimated: sheets.reduce((sum, s) => sum + s.rowCount, 0),
    totalWarnings: sheets.reduce((sum, s) => sum + (s.qualityWarnings?.length || 0), 0),
  };
}

function buildRecommendations(sheets) {
  const recs = [];
  sheets.forEach((sheet) => {
    if (!sheet.columns.some((c) => c.isPrimaryKey)) {
      recs.push(`Pertimbangkan menambahkan kolom ID unik pada sheet "${sheet.name}" sebagai Primary Key.`);
    }
  });
  return recs;
}

export const databaseContextService = {
  /**
   * @param {import("../models/spreadsheet.model.js").SpreadsheetModel} model
   * @param {import("../models/spreadsheet.model.js").RelationshipModel[]} relationships
   */
  build(model, relationships) {
    const context = {
      meta: {
        generatedAt: new Date().toISOString(),
        generator: "Ponti Sheets Database Context Engine",
        version: "1.0.0",
      },
      spreadsheet: {
        id: model.id,
        name: model.name,
        locale: model.locale,
        timezone: model.timezone,
      },
      sheets: model.sheets.map((sheet) => ({
        name: sheet.name,
        rowCount: sheet.rowCount,
        columnCount: sheet.columnCount,
        columns: sheet.columns.map((c) => ({
          name: c.name,
          type: c.type,
          isPrimaryKey: c.isPrimaryKey,
          isForeignKey: c.isForeignKey,
          referencesSheet: c.referencesSheet,
          referencesColumn: c.referencesColumn,
          confidence: c.confidence,
          sampleValues: c.sampleValues,
          formula: c.formula,
          formulaIsLive: c.formulaIsLive,
          required: c.required,
          editable: c.editable,
          show: c.show,
        })),
        formulas: sheet.formulas.map((f) => ({
          cell: f.cell, formula: f.formula, name: f.name,
          description: f.description, dependencies: f.dependencies,
        })),
        sampleData: sheet.sampleData.slice(0, 10),
        warnings: sheet.qualityWarnings || [],
      })),
      relationships: relationships.map((r) => ({
        from: `${r.fromSheet}.${r.fromColumn}`,
        to: `${r.toSheet}.${r.toColumn}`,
        type: r.type,
        confidence: r.confidence,
      })),
      namedRanges: (model.namedRanges || []).map((nr) => ({
        name: nr.name, sheet: nr.sheet, range: nr.range,
      })),
      businessRules: buildBusinessRules(model.sheets, relationships),
      statistics: buildStatistics(model.sheets),
      recommendations: buildRecommendations(model.sheets),
    };

    return context;
  },
};
