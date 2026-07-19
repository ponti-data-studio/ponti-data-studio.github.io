import { normalizeBlueprint, computeBlueprintStats } from "../models/blueprint.model.js";

/**
 * blueprint-parser.service.js
 * Mem-parsing response mentah AI menjadi Database Blueprint yang valid.
 * AI kadang membungkus JSON dengan ```json ... ``` walau sudah dilarang,
 * atau menambahkan kalimat pembuka/penutup — fungsi ini cukup toleran
 * untuk tetap mengekstrak JSON-nya.
 */

function extractJsonSubstring(text) {
  const withoutFences = text.replace(/```json/gi, "").replace(/```/g, "");
  const start = withoutFences.indexOf("{");
  const end = withoutFences.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("AI tidak menghasilkan JSON yang bisa ditemukan dalam response.");
  }
  return withoutFences.slice(start, end + 1);
}

export const blueprintParserService = {
  parse(rawText) {
    const jsonStr = extractJsonSubstring(rawText);
    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (err) {
      throw new Error(`AI menghasilkan JSON yang tidak valid (${err.message}). Coba klik "Generate Ulang".`);
    }

    const blueprint = normalizeBlueprint(parsed);

    if (blueprint.sheets.length === 0) {
      throw new Error("Blueprint dari AI tidak memiliki sheet sama sekali. Coba perjelas instruksi Anda atau Generate Ulang.");
    }
    const noPkSheets = blueprint.sheets.filter((s) => !s.columns.some((c) => c.isPrimaryKey));
    if (noPkSheets.length > 0) {
      blueprint.recommendations.unshift(
        `Peringatan: sheet ${noPkSheets.map((s) => `"${s.name}"`).join(", ")} tidak memiliki Primary Key eksplisit dari AI — periksa kembali sebelum digenerate.`
      );
    }

    const stats = computeBlueprintStats(blueprint);
    return { blueprint, stats };
  },
};
