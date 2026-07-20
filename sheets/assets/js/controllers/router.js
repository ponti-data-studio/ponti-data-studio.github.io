/**
 * router.js — router hash sederhana (#/route) tanpa dependency.
 * Cukup untuk SPA single-page dengan 10 menu utama.
 */

const VALID_ROUTES = new Set([
  "dashboard", "database-builder", "spreadsheet", "analysis", "database-context", "schema-editor", "erd",
  "prompt-builder", "ai-studio", "documentation", "history", "export", "settings", "guide",
]);

const routeListeners = [];

export function getCurrentRoute() {
  const hash = window.location.hash.replace("#/", "").trim();
  return VALID_ROUTES.has(hash) ? hash : "dashboard";
}

export function navigateTo(route) {
  if (!VALID_ROUTES.has(route)) route = "dashboard";
  const targetHash = `#/${route}`;

  if (window.location.hash === targetHash) {
    // PENTING: browser TIDAK memicu event "hashchange" kalau hash-nya sama persis
    // dengan yang sekarang — jadi kalau kita navigate ke route yang SAMA dengan yang
    // sedang dibuka (mis. dari halaman Spreadsheet yang menampilkan form login, lalu
    // "pindah" ke halaman Spreadsheet lagi setelah login berhasil), halaman tidak akan
    // pernah ter-render ulang secara otomatis meski data state-nya sudah berubah (mis.
    // session login) — pengguna harus refresh manual baru datanya muncul. Untuk kasus
    // ini, panggil listener-nya langsung tanpa menunggu event hashchange.
    routeListeners.forEach((cb) => cb(route));
  } else {
    window.location.hash = targetHash;
  }
}

export function onRouteChange(callback) {
  routeListeners.push(callback);
  window.addEventListener("hashchange", () => callback(getCurrentRoute()));
}
