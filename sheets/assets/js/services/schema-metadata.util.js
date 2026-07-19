/**
 * schema-metadata.util.js
 * -----------------------------------------------------------------------
 * Google Sheets tidak punya konsep "tipe kolom" secara native — semua sel
 * cuma teks/angka/formula. Supaya Schema Editor tidak perlu MENEBAK ULANG
 * tipe/PK/FK setiap kali struktur dibaca (yang tidak akurat untuk tipe
 * seperti currency/url/uuid/percentage/json/array), Ponti Sheets menyimpan
 * "kebenaran" itu sebagai Developer Metadata tersembunyi milik spreadsheet
 * itu sendiri (tidak terlihat di UI Google Sheets, hanya terbaca lewat API).
 *
 * Kalau metadata ini belum ada (spreadsheet belum pernah disentuh Schema
 * Editor), pembacaan tetap jatuh ke heuristik tebakan seperti biasa.
 * -----------------------------------------------------------------------
 */

export const SCHEMA_METADATA_KEY = "ponti_sheets_schema_v1";

/** Snapshot ringkas (hanya field yang tidak bisa ditebak ulang dari data mentah) */
export function buildSchemaMetadataSnapshot(blueprint) {
  const sheets = {};
  blueprint.sheets.forEach((sheet) => {
    const columns = {};
    sheet.columns.forEach((c) => {
      columns[c.name] = {
        type: c.type,
        label: c.label,
        description: c.description,
        required: !!c.required,
        isPrimaryKey: !!c.isPrimaryKey,
        isForeignKey: !!c.isForeignKey,
        referencesSheet: c.referencesSheet || null,
        referencesColumn: c.referencesColumn || null,
      };
    });
    sheets[sheet.name] = { columns };
  });
  return { sheets };
}

export function parseSchemaMetadataSnapshot(searchResult) {
  try {
    const raw = searchResult?.matchedDeveloperMetadata?.[0]?.developerMetadata?.metadataValue;
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function getExistingMetadataId(searchResult) {
  return searchResult?.matchedDeveloperMetadata?.[0]?.developerMetadata?.metadataId;
}
