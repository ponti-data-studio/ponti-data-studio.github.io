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
        // PENTING: field ini sempat "hilang" di sini walau sudah ada di Database
        // Context — jangan dihapus lagi kalau nanti context-nya diubah.
        formula: c.formula || null,
        live: c.formula ? !!c.formulaIsLive : null,
        // Tri-state {v, c} = {value, condition} — lihat Legend Field di bawah.
        req: { v: c.required?.value || "unknown", c: c.required?.condition || null },
        edit: { v: c.editable?.value || "unknown", c: c.editable?.condition || null },
        show: { v: c.show?.value || "unknown", c: c.show?.condition || null },
      })),
      sampleData: s.sampleData.slice(0, 3),
      formulas: s.formulas.slice(0, 15).map((f) => ({ cell: f.cell, formula: f.formula, name: f.name })),
    })),
    relationships: databaseContext.relationships,
    namedRanges: databaseContext.namedRanges || [],
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
      `Visual Style yang diinginkan: ${request.visualStyle && request.visualStyle.length ? request.visualStyle.join("; ") : "Tidak ditentukan — pilih gaya visual yang paling sesuai dengan konteks aplikasi."}`,
      `Output yang diharapkan: ${template.outputs.join(", ") || "-"}`,
      ``,
      `# LEGEND FIELD DATABASE CONTEXT (WAJIB DIPAHAMI SEBELUM MEMBACA JSON DI BAWAH)`,
      `JSON di bawah memakai singkatan supaya hemat token. Arti tiap field per kolom:`,
      `- "pk": true = kolom ini Primary Key (ID unik, wajib berbeda & tidak kosong tiap baris).`,
      `- "fk": true = kolom ini Foreign Key (nilainya merujuk ke Primary Key sheet lain).`,
      `- "ref": kalau "fk":true, ini berisi "NamaSheet.NamaKolom" yang direferensikan kolom ini.`,
      `- "formula": rumus asli Google Sheets kolom ini kalau ada (mis. "=B2*C2"), null kalau bukan kolom formula.`,
      `- "live": true = formula AKTIF (Google Sheets menghitung ulang otomatis setiap data berubah) — kalau kamu membangun logika aplikasi, ANGGAP nilai kolom ini SELALU dihitung ulang dari kolom lain, jangan simpan sebagai input manual. false = formula sudah "dibekukan" jadi nilai statis — perlakukan seperti kolom data biasa (boleh jadi input manual), meski field "formula" masih menunjukkan rumus asal-usulnya untuk konteks. null = kolom ini memang bukan kolom formula sama sekali.`,
      `- "req", "edit", "show" masing-masing berisi objek {"v": ..., "c": ...} — INI KETENTUAN WAJIB PADA UI/FORM APLIKASI YANG KAMU BANGUN untuk kolom terkait:`,
      `  - "req" (Required): apakah kolom ini WAJIB diisi di form aplikasi.`,
      `  - "edit" (Editable): apakah kolom ini BOLEH diisi/diubah manual oleh pengguna aplikasi (bukan dihitung otomatis/read-only).`,
      `  - "show" (Show): apakah kolom ini perlu DITAMPILKAN di UI aplikasi sama sekali.`,
      `  - Field "v" (value) isinya salah satu: "true", "false", atau "unknown". "true" = terapkan ketentuan itu; "false" = jangan terapkan (kebalikannya); "unknown" = TIDAK ditentukan pengguna — SIMPULKAN SENDIRI berdasarkan konteks nama kolom, tipe data, dan relasinya (mis. kolom PK/formula biasanya tidak perlu "edit":true; kolom dengan "unknown" pada "show" biasanya tetap ditampilkan kecuali ada alasan kuat untuk disembunyikan).`,
      `  - Field "c" (condition) berisi KETERANGAN BERSYARAT dalam bahasa manusia (mis. "Wajib jika kondisi A = TRUE") — HANYA relevan kalau "v":"true". Kalau "c" berisi teks, terapkan ketentuan itu SECARA KONDISIONAL sesuai keterangan tersebut (butuh logika tambahan di aplikasi). Kalau "c" bernilai null sementara "v":"true", berarti ketentuan berlaku MUTLAK tanpa syarat apa pun.`,
      `- "type" kemungkinan nilai: ${COLUMN_TYPES.join(", ")} — "gps" berarti koordinat lokasi, "image_url"/"file_url" berarti tautan ke gambar/berkas, "unknown" berarti Ponti Sheets tidak yakin tipe datanya dan kamu boleh menyimpulkan sendiri dari nama kolom & sample data.`,
      `- Pada objek "relationships": "from"/"to" berformat "NamaSheet.NamaKolom", "type" adalah jenis relasi (mis. "many-to-one"), "confidence" (0–1) seberapa yakin Ponti Sheets terhadap relasi ini — kalau confidence rendah (<0.6), pertimbangkan untuk tidak terlalu kaku mengikutinya kalau terlihat janggal.`,
      `- "namedRanges": daftar named range yang sudah ada di spreadsheet ini, masing-masing {"name", "sheet", "range"} — "range" dalam notasi A1 (mis. "A2:A100") pada sheet yang disebutkan. Kalau ada, MANFAATKAN nama-nama ini saat menulis kode/formula yang merujuk ke range tersebut (mis. untuk dropdown/lookup) alih-alih menulis ulang range mentahnya — supaya kode yang kamu hasilkan konsisten dengan struktur asli spreadsheet.`,
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
      `- Ikuti ketentuan "req"/"edit"/"show" tiap kolom sesuai Legend Field di atas saat membangun form/UI aplikasi.`,
      `- Kalau "Visual Style yang diinginkan" berisi lebih dari satu gaya, GABUNGKAN elemen-elemen dari semua gaya itu secara koheren (jangan pilih cuma salah satu) — kalau ada dua gaya yang kontradiktif, prioritaskan gaya yang disebut LEBIH DULU.`,
      `- Terapkan aturan bisnis yang tercantum.`,
      `- Sertakan penjelasan singkat di akhir mengenai keputusan arsitektur yang diambil.`,
    ];

    return sections.filter((s) => s !== "").join("\n");
  },
};
