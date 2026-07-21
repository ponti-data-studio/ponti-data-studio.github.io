/**
 * redesign-parser.service.js
 * Mem-parsing & memvalidasi response AI untuk "Minta Saran AI" — toleran
 * terhadap format yang sedikit meleset (sama seperti blueprint-parser).
 */

const VALID_CATEGORIES = new Set(["pk_fk", "type", "naming", "normalization", "structure"]);
const VALID_ACTION_TYPES = new Set([
  "set_pk", "set_fk", "set_type", "rename_column", "rename_sheet", "add_column", "split_sheet",
]);

function extractJsonSubstring(text) {
  const withoutFences = text.replace(/```json/gi, "").replace(/```/g, "");
  const start = withoutFences.indexOf("{");
  const end = withoutFences.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("AI tidak menghasilkan JSON yang bisa ditemukan dalam response.");
  }
  return withoutFences.slice(start, end + 1);
}

function normalizeSuggestion(raw, idx) {
  const action = raw?.action && VALID_ACTION_TYPES.has(raw.action.type) ? raw.action : null;
  return {
    id: raw?.id || `s${idx + 1}`,
    category: VALID_CATEGORIES.has(raw?.category) ? raw.category : "structure",
    title: raw?.title || "Saran tanpa judul",
    reason: raw?.reason || "",
    impact: ["low", "medium", "high"].includes(raw?.impact) ? raw.impact : "medium",
    action,
  };
}

export const redesignParserService = {
  parse(rawText) {
    const jsonStr = extractJsonSubstring(rawText);
    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (err) {
      throw new Error(`AI menghasilkan JSON yang tidak valid (${err.message}). Coba klik "Minta Saran Ulang".`);
    }

    const rawSuggestions = Array.isArray(parsed?.suggestions) ? parsed.suggestions : [];

    const suggestions = rawSuggestions.map(normalizeSuggestion);
    const impactWeight = { high: 0, medium: 1, low: 2 };
    suggestions.sort((a, b) => impactWeight[a.impact] - impactWeight[b.impact]);

    return suggestions;
  },
};
