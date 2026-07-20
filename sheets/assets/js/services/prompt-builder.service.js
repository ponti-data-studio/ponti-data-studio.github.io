import { TEMPLATES, COLUMN_TYPES } from "../config/app.config.js";

/**
 * prompt-builder.service.js
 * Menyusun prompt final dari: Database Context + Business Rules +
 * Formula + Relationship + Template + Instruksi User, lalu melewatinya
 * ke Smart Prompt Optimizer sebelum ditampilkan/dikirim ke AI Studio.
 */

function compressContext(databaseContext) {
  // Context Compression: buang field yang tidak esensial untuk prompt,
  // dan batasi sampleData supaya tidak boros token.
  return {
    spreadsheet: databaseContext.spreadsheet,
    sheets: databaseContext.sheets.map((s) => ({
      name: s.name,
      columns: s.columns.map((c) => ({
        name: c.name, type: c.type, pk: c.isPrimaryKey, fk: c.isForeignKey,
        ref: c.referencesSheet ? `${c.referencesSheet}.${c.referencesColumn}` : null,
        nullable: c.nullable,
        // PENTING: field ini sempat "hilang" di sini walau sudah ada di Database
        // Context — jangan dihapus lagi kalau nanti context-nya diubah.
        formula: c.formula || null,
        live: c.formula ? !!c.formulaIsLive : null,
      })),
      sampleData: s.sampleData.slice(0, 3),
      formulas: s.formulas.slice(0, 15).map((f) => ({ cell: f.cell, formula: f.formula, name: f.name })),
    })),
    relationships: databaseContext.relationships,
    businessRules: databaseContext.businessRules,
  };
}

/** JSON Optimization + Duplicate Removal: hilangkan whitespace & duplikat string berulang */
function optimizeJson(obj) {
  return JSON.stringify(obj); // JSON.stringify tanpa spasi sudah minified
}

export const promptBuilderService = {
  /**
   * @param {import("../models/prompt.model.js").PromptRequestModel} request
   */
  build(request) {
    const template = TEMPLATES[request.templateId];
    if (!template) throw new Error(`Template "${request.templateId}" tidak ditemukan.`);

    const compressed = compressContext(request.databaseContext);
    const optimizedContextJson = optimizeJson(compressed);

    const sections = [
      `# PERAN`,
      `Kamu adalah Senior Software Engineer yang membangun aplikasi berdasarkan struktur database nyata dari Google Sheets berikut.`,
      ``,
      `# TARGET OUTPUT`,
      `Template: ${template.label}`,
      `Gaya pemrograman: ${request.programmingStyle}`,
      `Output yang diharapkan: ${template.outputs.join(", ") || "-"}`,
      ``,
      `# LEGEND FIELD DATABASE CONTEXT (WAJIB DIPAHAMI SEBELUM MEMBACA JSON DI BAWAH)`,
      `JSON di bawah memakai singkatan supaya hemat token. Arti tiap field per kolom:`,
      `- "pk": true = kolom ini Primary Key (ID unik, wajib berbeda & tidak kosong tiap baris).`,
      `- "fk": true = kolom ini Foreign Key (nilainya merujuk ke Primary Key sheet lain).`,
      `- "ref": kalau "fk":true, ini berisi "NamaSheet.NamaKolom" yang direferensikan kolom ini.`,
      `- "nullable": true = kolom ini boleh kosong/tidak wajib diisi.`,
      `- "formula": rumus asli Google Sheets kolom ini kalau ada (mis. "=B2*C2"), null kalau bukan kolom formula.`,
      `- "live": true = formula AKTIF (Google Sheets menghitung ulang otomatis setiap data berubah) — kalau kamu membangun logika aplikasi, ANGGAP nilai kolom ini SELALU dihitung ulang dari kolom lain, jangan simpan sebagai input manual. false = formula sudah "dibekukan" jadi nilai statis — perlakukan seperti kolom data biasa (boleh jadi input manual), meski field "formula" masih menunjukkan rumus asal-usulnya untuk konteks. null = kolom ini memang bukan kolom formula sama sekali.`,
      `- "type" kemungkinan nilai: ${COLUMN_TYPES.join(", ")} — "gps" berarti koordinat lokasi, "image_url"/"file_url" berarti tautan ke gambar/berkas, "unknown" berarti Ponti Sheets tidak yakin tipe datanya dan kamu boleh menyimpulkan sendiri dari nama kolom & sample data.`,
      `- Pada objek "relationships": "from"/"to" berformat "NamaSheet.NamaKolom", "type" adalah jenis relasi (mis. "many-to-one"), "confidence" (0–1) seberapa yakin Ponti Sheets terhadap relasi ini — kalau confidence rendah (<0.6), pertimbangkan untuk tidak terlalu kaku mengikutinya kalau terlihat janggal.`,
      ``,
      `# DATABASE CONTEXT (JSON)`,
      "```json",
      optimizedContextJson,
      "```",
      ``,
      `# ATURAN BISNIS`,
      ...(compressed.businessRules.length ? compressed.businessRules.map((r) => `- ${r}`) : ["- Tidak ada aturan eksplisit terdeteksi."]),
      ``,
      `# INSTRUKSI TAMBAHAN DARI USER`,
      request.userInstruction?.trim() || "- (tidak ada)",
      ``,
      request.additionalRequirement?.trim()
        ? `# REQUIREMENT TAMBAHAN\n${request.additionalRequirement.trim()}`
        : "",
      ``,
      `# KETENTUAN`,
      `- Gunakan struktur kolom, tipe data, primary key, dan foreign key persis seperti pada Database Context di atas.`,
      `- Jangan mengasumsikan kolom yang tidak ada dalam context.`,
      `- Untuk kolom dengan "live":true, jangan buat form input manual untuk kolom itu — hitung otomatis sesuai formula-nya.`,
      `- Terapkan aturan bisnis yang tercantum.`,
      `- Sertakan penjelasan singkat di akhir mengenai keputusan arsitektur yang diambil.`,
    ];

    return sections.filter((s) => s !== "").join("\n");
  },
};
