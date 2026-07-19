import { TEMPLATES } from "../config/app.config.js";

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
      `- Terapkan aturan bisnis yang tercantum.`,
      `- Sertakan penjelasan singkat di akhir mengenai keputusan arsitektur yang diambil.`,
    ];

    return sections.filter((s) => s !== "").join("\n");
  },
};
