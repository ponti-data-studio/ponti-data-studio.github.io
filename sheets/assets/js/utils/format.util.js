/**
 * format.util.js — helper format angka, tanggal, dan string.
 */

export function formatNumber(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return "-";
  return new Intl.NumberFormat("id-ID").format(n);
}

export function formatCurrency(n, currency = "IDR") {
  if (n === null || n === undefined || Number.isNaN(n)) return "-";
  try {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency }).format(n);
  } catch {
    return `${currency} ${formatNumber(n)}`;
  }
}

export function formatDate(date) {
  if (!date) return "-";
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(d);
}

export function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let val = bytes;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i += 1;
  }
  return `${val.toFixed(val < 10 ? 1 : 0)} ${units[i]}`;
}

export function truncate(str = "", max = 80) {
  if (str.length <= max) return str;
  return `${str.slice(0, max - 1)}…`;
}

export function slugify(str = "") {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function uid(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
