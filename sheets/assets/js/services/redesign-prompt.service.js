/**
 * redesign-prompt.service.js
 * -----------------------------------------------------------------------
 * "Minta Saran AI" di Schema Editor — AI mereview struktur database yang
 * SUDAH ADA (bukan membuat baru seperti Database Builder) dan memberi
 * saran perbaikan konkret: PK/FK yang hilang, tipe data yang salah,
 * penamaan yang tidak konsisten, normalisasi (split sheet), dan potensi
 * sheet yang bisa digabung.
 * -----------------------------------------------------------------------
 */

function compressForReview(blueprint) {
  return {
    project: blueprint.project,
    sheets: blueprint.sheets.map((s) => ({
      name: s.name,
      columns: s.columns.map((c) => ({
        name: c.name, type: c.type, pk: c.isPrimaryKey, fk: c.isForeignKey,
        ref: c.referencesSheet ? `${c.referencesSheet}.${c.referencesColumn}` : null,
        formula: c.formula || null,
      })),
      sampleData: s.dummyData.slice(0, 5),
      rowCount: s.lastRow,
    })),
    relationships: blueprint.relationships,
  };
}

export const redesignPromptService = {
  build(blueprint) {
    const compressed = compressForReview(blueprint);

    const sections = [
      `# PERAN`,
      `Kamu adalah Database Architect AI senior yang bertugas MEREVIEW struktur database Google Sheets yang SUDAH ADA dan memberi saran perbaikan konkret — bukan membuat struktur baru dari nol.`,
      ``,
      `# STRUKTUR DATABASE SAAT INI (JSON)`,
      "```json",
      JSON.stringify(compressed),
      "```",
      ``,
      `# TUGAS`,
      `Analisis struktur di atas dan berikan saran perbaikan yang mencakup (kalau relevan):`,
      `1. Primary Key yang hilang, atau Foreign Key yang hilang/salah arah.`,
      `2. Tipe data kolom yang tidak sesuai dengan isinya (mis. tanggal disimpan sebagai teks).`,
      `3. Penamaan kolom/sheet yang tidak konsisten atau ambigu.`,
      `4. Normalisasi — data yang berulang/redundan di banyak baris yang sebaiknya dipisah (split) ke sheet baru dengan relasi FK.`,
      `5. Sheet-sheet yang punya struktur sangat mirip dan berpotensi digabung (merge) — HANYA sebagai rekomendasi tertulis, JANGAN buat ini otomatis diterapkan.`,
      ``,
      `# ATURAN OUTPUT (WAJIB DIPATUHI)`,
      `1. Balas HANYA dengan satu objek JSON valid, tanpa teks lain, tanpa markdown code fence.`,
      `2. Schema JSON:`,
      "```",
      `{ "suggestions": [ { "id": "string unik", "category": "pk_fk|type|naming|normalization|structure", "title": "judul singkat", "reason": "kenapa disarankan", "impact": "low|medium|high", "action": {...} atau null } ] }`,
      "```",
      `3. Field "action" HANYA diisi kalau saran ini bisa diterapkan otomatis oleh sistem, memakai SALAH SATU bentuk berikut PERSIS:`,
      `   - {"type":"set_pk","sheet":"NamaSheet","column":"nama_kolom","value":true}`,
      `   - {"type":"set_fk","sheet":"NamaSheet","column":"nama_kolom","referencesSheet":"SheetLain","referencesColumn":"kolom_pk_sheet_lain"}`,
      `   - {"type":"set_type","sheet":"NamaSheet","column":"nama_kolom","newType":"text|number|currency|boolean|date|datetime|email|phone|url|gps|image_url|file_url|json|array"}`,
      `   - {"type":"rename_column","sheet":"NamaSheet","column":"nama_kolom_lama","newName":"nama_baru"}`,
      `   - {"type":"rename_sheet","sheet":"NamaSheetLama","newName":"NamaBaru"}`,
      `   - {"type":"add_column","sheet":"NamaSheet","columnName":"kolom_baru","type":"text","isPrimaryKey":false}`,
      `   - {"type":"split_sheet","sourceSheet":"NamaSheet","extractColumns":["kolom1","kolom2"],"newSheetName":"SheetBaru","newPkName":"id_baru"}`,
      `4. Untuk saran kategori "structure" yang berupa rekomendasi PENGGABUNGAN sheet (merge) atau saran umum lain yang TIDAK bisa diterapkan otomatis dengan aman, isi "action":null — cukup jelaskan di "reason", biarkan pengguna menindaklanjuti manual.`,
      `5. Untuk "split_sheet": "extractColumns" HARUS kolom yang benar-benar ada & berulang nilainya di "sourceSheet" (indikasi butuh normalisasi), "newPkName" harus nama kolom ID baru yang belum dipakai.`,
      `6. Sertakan MAKSIMAL 15 saran, urutkan dari "impact" tertinggi ke terendah. Kalau strukturnya memang sudah cukup baik di suatu aspek, JANGAN memaksakan saran yang tidak perlu di aspek itu — array "suggestions" boleh berisi sedikit, atau bahkan kosong sama sekali kalau memang tidak ada yang perlu diperbaiki.`,
      `7. Jangan mengulang saran yang secara struktur sudah benar (mis. jangan sarankan set_pk untuk kolom yang "pk" sudah true).`,
    ];

    return sections.join("\n");
  },
};
