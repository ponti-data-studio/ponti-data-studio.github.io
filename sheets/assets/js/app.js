import { appState } from "./controllers/app-state.js";
import { getCurrentRoute, navigateTo, onRouteChange } from "./controllers/router.js";
import { buildMainLayout } from "./layouts/main-layout.js";
import { settingsService } from "./services/settings.service.js";
import { googleAuthService } from "./services/google-auth.service.js";
import { openCommandPalette } from "./components/command-palette.component.js";
import { renderLoginGate } from "./components/login-gate.component.js";
import { clear, el } from "./utils/dom.util.js";
import { logger } from "./utils/logger.util.js";

import { renderDashboardPage } from "./pages/dashboard.page.js";
import { renderDatabaseBuilderPage } from "./pages/database-builder.page.js";
import { renderSpreadsheetPage } from "./pages/spreadsheet.page.js";
import { renderAnalysisPage } from "./pages/analysis.page.js";
import { renderDatabaseContextPage } from "./pages/database-context.page.js";
import { renderSchemaEditorPage } from "./pages/schema-editor.page.js";
import { renderErdPage } from "./pages/erd.page.js";
import { renderPromptBuilderPage } from "./pages/prompt-builder.page.js";
import { renderAIStudioPage } from "./pages/ai-studio.page.js";
import { renderDocumentationPage } from "./pages/documentation.page.js";
import { renderHistoryPage } from "./pages/history.page.js";
import { renderExportPage } from "./pages/export.page.js";
import { renderSettingsPage } from "./pages/settings.page.js";
import { renderGuidePage } from "./pages/guide.page.js";

const PAGE_RENDERERS = {
  dashboard: (nav) => renderDashboardPage(nav),
  "database-builder": (nav) => renderDatabaseBuilderPage(nav),
  spreadsheet: (nav) => renderSpreadsheetPage(nav),
  analysis: (nav) => renderAnalysisPage(nav),
  "database-context": (nav) => renderDatabaseContextPage(nav),
  "schema-editor": (nav) => renderSchemaEditorPage(nav),
  erd: (nav) => renderErdPage(nav),
  "prompt-builder": (nav) => renderPromptBuilderPage(nav),
  "ai-studio": (nav) => renderAIStudioPage(nav),
  documentation: (nav) => renderDocumentationPage(nav),
  history: () => renderHistoryPage(),
  export: () => renderExportPage(),
  settings: (nav, applyTheme) => renderSettingsPage(applyTheme),
  guide: () => renderGuidePage(),
};

let refreshTopbar = () => {};

// PENTING: boot() bisa dipanggil BERKALI-KALI selama satu sesi browser
// (logout lalu login lagi memicu boot() ulang) — jadi listener global
// (route change, keydown ⌘K) HARUS didaftarkan cuma SEKALI selamanya,
// bukan setiap kali boot() jalan, supaya tidak menumpuk jadi terpanggil
// berkali-kali. Dicapai lewat indirection: listener asli cuma memanggil
// referensi function yang mutable ini.
let activeRenderRoute = null;
let globalListenersRegistered = false;

function ensureGlobalListenersRegistered() {
  if (globalListenersRegistered) return;
  globalListenersRegistered = true;

  onRouteChange((route) => {
    if (activeRenderRoute) activeRenderRoute(route);
  });

  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      openCommandPalette((r) => navigateTo(r));
    }
  });
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) metaThemeColor.setAttribute("content", theme === "dark" ? "#0a0a0d" : "#f7f7f9");
  appState.set({ theme });
  settingsService.update({ theme });
  refreshTopbar();
}

async function boot() {
  const root = document.getElementById("app");
  const session = await googleAuthService.getSession(); // juga menentukan namespace storage aktif
  const isValidSession = session && Date.now() < session.expiresAt;

  if (!isValidSession) {
    activeRenderRoute = null; // tidak ada route aktif selagi di Login Gate

    // Terapkan tema dulu (pakai namespace "anon" — wajar, belum ada yang login)
    // supaya layar login tidak "kedip" putih/gelap salah tema.
    const anonSettings = await settingsService.get();
    applyTheme(anonSettings.theme);

    clear(root);
    root.appendChild(
      await renderLoginGate(async () => {
        clear(root);
        await boot(); // login berhasil -> boot ulang dari awal, sekarang dengan sesi valid
      })
    );
    return;
  }

  appState.set({ session });
  const settings = await settingsService.get();
  applyTheme(settings.theme);
  appState.set({ settings });

  clear(root);
  const layout = buildMainLayout({
    navigate: (route) => navigateTo(route),
    applyTheme,
    onSessionEnded: () => {
      // Logout / sesi tidak valid lagi -> reset total ke Login Gate, bukan cuma pindah route,
      // supaya shell (sidebar/topbar) yang mengasumsikan sudah login tidak ikut nyangkut.
      clear(root);
      boot();
    },
  });
  root.appendChild(layout.root);
  refreshTopbar = () => layout.renderTopbarNode(appState.get().route);

  async function renderRoute(route) {
    layout.renderSidebarNode(route);
    layout.renderTopbarNode(route);
    clear(layout.contentHost);
    layout.contentHost.appendChild(el("div", { class: "loading-shimmer" }, "Memuat..."));

    try {
      const renderer = PAGE_RENDERERS[route] || PAGE_RENDERERS.dashboard;
      const node = await renderer((r) => navigateTo(r), applyTheme);
      clear(layout.contentHost);
      layout.contentHost.appendChild(node);
      appState.set({ route });
    } catch (err) {
      logger.error("app", `Gagal me-render halaman "${route}"`, err);
      clear(layout.contentHost);
      layout.contentHost.appendChild(
        el("div", { class: "error-state-panel" }, `Terjadi kesalahan saat memuat halaman: ${err.message}`)
      );
    }
  }

  activeRenderRoute = renderRoute;
  ensureGlobalListenersRegistered();
  renderRoute(getCurrentRoute());
}

boot();

// --- PWA: daftarkan service worker ---
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((err) => {
      logger.warn("pwa", "Gagal mendaftarkan service worker", err);
    });
  });
}
