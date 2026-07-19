/**
 * color.util.js — konversi warna untuk Google Sheets API (RGB float 0-1)
 * dan ExcelJS (ARGB hex), plus fallback nama warna umum yang mungkin
 * dikembalikan AI (mis. "red", "yellow") alih-alih kode hex.
 */

const NAMED_COLORS = {
  red: "#EF4444", yellow: "#F59E0B", green: "#22C55E", blue: "#3B82F6",
  orange: "#F97316", purple: "#A855F7", gray: "#9CA3AF", grey: "#9CA3AF",
  pink: "#EC4899", teal: "#14B8A6", indigo: "#6366F1", white: "#FFFFFF",
  black: "#111111",
};

export function resolveColorHex(input, fallback = "#6366F1") {
  if (!input) return fallback;
  const trimmed = String(input).trim();
  if (/^#?[0-9a-fA-F]{6}$/.test(trimmed)) {
    return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  }
  const named = NAMED_COLORS[trimmed.toLowerCase()];
  return named || fallback;
}

/** Untuk Google Sheets API: objek {red, green, blue} dengan skala 0-1 */
export function hexToSheetsColor(hex) {
  const clean = resolveColorHex(hex).replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  return { red: r, green: g, blue: b };
}

/** Kebalikan dari hexToSheetsColor: dari objek {red,green,blue} (0-1) API ke hex */
export function sheetsColorToHex(colorObj) {
  if (!colorObj) return null;
  const to255 = (v) => Math.round((v || 0) * 255).toString(16).padStart(2, "0");
  return `#${to255(colorObj.red)}${to255(colorObj.green)}${to255(colorObj.blue)}`.toUpperCase();
}

/** Untuk ExcelJS: string ARGB "FFRRGGBB" */
export function hexToArgb(hex) {
  const clean = resolveColorHex(hex).replace("#", "").toUpperCase();
  return `FF${clean}`;
}
