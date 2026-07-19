/**
 * app-state.js
 * Store state terpusat yang sangat ringan (pub/sub manual, tanpa
 * framework). Menjaga agar setiap page/controller punya satu sumber
 * kebenaran (single source of truth) untuk data lintas halaman:
 * session login, spreadsheet aktif, hasil analisis, database context, dll.
 */

const state = {
  route: "dashboard",
  session: null,
  theme: "dark",
  spreadsheets: [],
  activeSpreadsheet: null, // { id, name }
  analysisResult: null,    // { model, relationships }
  databaseContext: null,   // hasil databaseContextService.build()
  blueprint: null,         // hasil Database Builder (blueprint ternormalisasi + stats)
  lastPrompt: null,
  settings: null,
};

const listeners = new Set();

export const appState = {
  get() {
    return state;
  },
  set(partial) {
    Object.assign(state, partial);
    listeners.forEach((fn) => fn(state));
  },
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
