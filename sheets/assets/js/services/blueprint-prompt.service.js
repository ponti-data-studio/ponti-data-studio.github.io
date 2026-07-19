import { BLUEPRINT_COLUMN_TYPES, BLUEPRINT_FORMULA_EXAMPLES } from "../config/app.config.js";

/**
 * blueprint-prompt.service.js
 * -----------------------------------------------------------------------
 * Ponti Sheets TIDAK mengirim instruksi user mentah-mentah ke AI. Fungsi
 * ini membangun prompt "profesional" yang memaksa AI membalas HANYA
 * dengan JSON sesuai schema Database Blueprint — tanpa teks bebas,
 * tanpa markdown fences, tanpa penjelasan.
 * -----------------------------------------------------------------------
 */

const SCHEMA_EXAMPLE = `{
  "project": { "name": "", "description": "" },
  "sheets": [
    {
      "name": "", "description": "", "tabColor": "#RRGGBB",
      "freezeRow": 1, "filter": true,
      "columns": [
        {
          "name": "", "label": "", "description": "", "type": "text",
          "required": true, "isPrimaryKey": false, "isForeignKey": false,
          "referencesSheet": null, "referencesColumn": null,
          "defaultValue": null, "formula": null,
          "validation": { "type": "list", "options": ["A", "B"], "min": null, "max": null },
          "sampleData": []
        }
      ],
      "dummyData": [ { "NamaKolom": "nilai" } ],
      "conditionalFormats": [
        { "column": "", "condition": "less_than", "value": 0, "backgroundColor": "#EF4444", "description": "" }
      ],
      "protected": false
    }
  ],
  "relationships": [ { "from": "SheetA.kolom", "to": "SheetB.kolom", "type": "many-to-one" } ],
  "namedRanges": [ { "name": "", "sheet": "", "range": "A2:A100" } ],
  "businessRules": [ "" ],
  "documentation": { "summary": "", "flowProcess": "" },
  "recommendations": [ "" ]
}`;

export const blueprintPromptService = {
  build({ userInstruction, retry = false }) {
    const sections = [
      `# PERAN`,
      `Kamu adalah Database Architect AI. Tugasmu: merancang struktur database Google Sheets yang lengkap, realistis, dan siap pakai, berdasarkan permintaan pengguna.`,
      ``,
      `# PERMINTAAN PENGGUNA`,
      userInstruction?.trim() || "Buatkan struktur database yang sesuai berdasarkan konteks yang tersedia.",
      ``,
      `# ATURAN OUTPUT (WAJIB DIPATUHI)`,
      `1. Balas HANYA dengan satu objek JSON valid. DILARANG menambahkan teks penjelasan, markdown code fence, atau komentar apa pun di luar JSON.`,
      `2. JSON harus mengikuti schema berikut PERSIS (nama field harus sama persis):`,
      "```",
      SCHEMA_EXAMPLE,
      "```",
      `3. Buat minimal 3 sheet yang saling berelasi (kecuali diminta lebih sedikit oleh pengguna).`,
      `4. Setiap sheet WAJIB punya minimal 1 kolom dengan isPrimaryKey: true, bernama seperti "id_xxx" atau "kode_xxx".`,
      `5. Kolom Foreign Key WAJIB mengisi referencesSheet & referencesColumn yang valid (harus cocok dengan Primary Key di sheet lain).`,
      `6. Tipe data kolom (field "type") HANYA boleh salah satu dari: ${BLUEPRINT_COLUMN_TYPES.join(", ")}.`,
      `7. Sertakan minimal 5 baris "dummyData" REALISTIS per sheet, dan data antar sheet HARUS saling berelasi secara konsisten (nilai Foreign Key di satu sheet harus benar-benar ada sebagai Primary Key di sheet yang direferensikan).`,
      `8. Untuk kolom yang butuh formula (mis. subtotal, total, status otomatis), isi field "formula" dengan FORMULA ASLI Google Sheets (bukan hasil hitungnya), contoh gaya: ${BLUEPRINT_FORMULA_EXAMPLES.slice(0, 8).join(", ")}, dst. Gunakan referensi relatif seperti "=B2*C2".`,
      `9. Isi "validation" untuk kolom yang butuh validasi (dropdown/list, email, phone, number, date, checkbox) — untuk tipe "list" sertakan array "options".`,
      `10. Isi "conditionalFormats" yang masuk akal untuk bisnis ini (contoh: stok di bawah minimum berwarna merah, status lunas berwarna hijau).`,
      `11. Isi "namedRanges" untuk sheet-sheet penting yang kemungkinan dipakai sebagai sumber dropdown (VLOOKUP/data validation) di sheet lain.`,
      `12. Isi "businessRules" dengan aturan bisnis yang relevan (mis. "Stok tidak boleh minus", "Nomor invoice dibuat otomatis").`,
      `13. Isi "documentation.summary" dan "documentation.flowProcess" secara singkat namun informatif.`,
      `14. Isi "recommendations" dengan saran perbaikan/pengembangan struktur ke depan.`,
    ];

    if (retry) {
      sections.push(
        ``,
        `# PENTING (PERCOBAAN ULANG)`,
        `Balasan sebelumnya BUKAN JSON valid atau tidak sesuai schema. Kali ini, balas HANYA dengan JSON murni — karakter pertama responsmu harus "{" dan karakter terakhir harus "}". Jangan tulis apa pun selain JSON.`
      );
    }

    return sections.filter((s) => s !== "").join("\n");
  },
};
