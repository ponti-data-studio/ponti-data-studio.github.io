/**
 * logger.util.js
 * Centralized logging + error handling. Semua service/controller WAJIB
 * pakai logger ini alih-alih console.log langsung, supaya nanti gampang
 * dialihkan ke remote logging (v2+) tanpa mengubah pemanggil.
 */

const LOG_KEY = "ponti_sheets.logs";
const MAX_LOGS = 300;

function persist(entry) {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    const logs = raw ? JSON.parse(raw) : [];
    logs.push(entry);
    while (logs.length > MAX_LOGS) logs.shift();
    localStorage.setItem(LOG_KEY, JSON.stringify(logs));
  } catch {
    /* storage penuh / tidak tersedia — abaikan secara sengaja */
  }
}

function write(level, scope, message, meta) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    scope,
    message,
    meta: meta ?? null,
  };
  persist(entry);
  const consoleFn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  consoleFn(`[PontiSheets][${scope}]`, message, meta ?? "");
  return entry;
}

export const logger = {
  info: (scope, message, meta) => write("info", scope, message, meta),
  warn: (scope, message, meta) => write("warn", scope, message, meta),
  error: (scope, message, meta) => write("error", scope, message, meta),
  getLogs: () => {
    try {
      return JSON.parse(localStorage.getItem(LOG_KEY) || "[]");
    } catch {
      return [];
    }
  },
  clear: () => localStorage.removeItem(LOG_KEY),
};

/**
 * safeAsync — pembungkus untuk async function agar error tertangani
 * secara konsisten (centralized error handling) tanpa try/catch berulang
 * di setiap controller.
 */
export function safeAsync(scope, fn) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (err) {
      logger.error(scope, err?.message || "Unknown error", { stack: err?.stack });
      throw err;
    }
  };
}
