/**
 * spreadsheet.model.js
 * Model data untuk merepresentasikan struktur Google Spreadsheet
 * setelah dianalisis oleh Analysis Service.
 */

export class ColumnModel {
  constructor({
    name, index, type = "unknown", isPrimaryKey = false,
    isForeignKey = false, referencesSheet = null, referencesColumn = null,
    confidence = 0, nullable = true, sampleValues = [], warnings = [],
    formula = null, formulaIsLive = true,
  } = {}) {
    this.name = name;
    this.index = index;
    this.type = type;
    this.isPrimaryKey = isPrimaryKey;
    this.isForeignKey = isForeignKey;
    this.referencesSheet = referencesSheet;
    this.referencesColumn = referencesColumn;
    this.confidence = confidence;
    this.nullable = nullable;
    this.sampleValues = sampleValues;
    this.warnings = warnings;
    // formula: formula asli kolom ini (kalau ada) — mis. "=B2*C2".
    // formulaIsLive: true = formula aktif (nilai ikut berubah otomatis di Google Sheets);
    // false = sudah "dibekukan" jadi nilai statis lewat Schema Editor (formula-nya sendiri
    // sudah tidak ada lagi di sel, cuma hasil hitungannya).
    this.formula = formula;
    this.formulaIsLive = formulaIsLive;
  }
}

export class FormulaModel {
  constructor({ cell, formula, name, description, dependencies = [] } = {}) {
    this.cell = cell;
    this.formula = formula;
    this.name = name;
    this.description = description;
    this.dependencies = dependencies;
  }
}

export class SheetModel {
  constructor({
    name, rowCount = 0, columnCount = 0, columns = [], sampleData = [],
    formulas = [], mergedCells = [], frozenRows = 0, frozenColumns = 0,
    filters = [], conditionalFormats = [], validations = [],
    namedRanges = [], protectedRanges = [], hiddenRows = [], hiddenColumns = [],
    developerMetadata = [],
  } = {}) {
    this.name = name;
    this.rowCount = rowCount;
    this.columnCount = columnCount;
    this.columns = columns;
    this.sampleData = sampleData;
    this.formulas = formulas;
    this.mergedCells = mergedCells;
    this.frozenRows = frozenRows;
    this.frozenColumns = frozenColumns;
    this.filters = filters;
    this.conditionalFormats = conditionalFormats;
    this.validations = validations;
    this.namedRanges = namedRanges;
    this.protectedRanges = protectedRanges;
    this.hiddenRows = hiddenRows;
    this.hiddenColumns = hiddenColumns;
    this.developerMetadata = developerMetadata;
  }
}

export class RelationshipModel {
  constructor({ fromSheet, fromColumn, toSheet, toColumn, confidence = 0, type = "one-to-many" } = {}) {
    this.fromSheet = fromSheet;
    this.fromColumn = fromColumn;
    this.toSheet = toSheet;
    this.toColumn = toColumn;
    this.confidence = confidence;
    this.type = type;
  }
}

export class SpreadsheetModel {
  constructor({
    id, name, locale = "id_ID", timezone = "Asia/Jakarta",
    owner = null, createdAt = null, modifiedAt = null, sheets = [],
  } = {}) {
    this.id = id;
    this.name = name;
    this.locale = locale;
    this.timezone = timezone;
    this.owner = owner;
    this.createdAt = createdAt;
    this.modifiedAt = modifiedAt;
    this.sheets = sheets;
  }
}
