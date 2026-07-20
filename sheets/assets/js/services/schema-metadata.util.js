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

/** Menyimpan objek tri-state {value, condition} apa adanya, dengan default aman */
function snapshotTriState(field) {
  if (field && typeof field === "object") {
    return { value: field.value || "unknown", condition: field.value === "true" ? (field.condition || null) : null };
  }
  return { value: "unknown", condition: null };
}

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
        // "Required", "Editable", "Show" — tri-state {value, condition}: value
        // "true"/"false"/"unknown", condition = keterangan kondisional opsional
        // (hanya berlaku kalau value "true"). Kalau "unknown", AI yang menyimpulkan
        // sendiri saat membangun aplikasi.
        required: snapshotTriState(c.required),
        editable: snapshotTriState(c.editable),
        show: snapshotTriState(c.show),
        isPrimaryKey: !!c.isPrimaryKey,
        isForeignKey: !!c.isForeignKey,
        referencesSheet: c.referencesSheet || null,
        referencesColumn: c.referencesColumn || null,
        formula: c.formula || null,
        // formulaIsLive: true = formula aktif (nilai ikut berubah otomatis di Google Sheets);
        // false = sudah "dibekukan" jadi nilai statis — formula-nya sendiri sudah tidak ada
        // lagi di sel manapun, jadi HARUS diingat lewat metadata ini, tidak bisa ditebak
        // ulang dari isi sel (yang cuma berupa nilai biasa, tidak ada tanda ia bekas formula).
        formulaIsLive: c.formula ? c.formulaIsLive !== false : false,
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
