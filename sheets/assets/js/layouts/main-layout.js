import { el, clear } from "../utils/dom.util.js";
import { renderSidebar } from "../components/sidebar.component.js";
import { renderTopbar } from "../components/topbar.component.js";
import { openCommandPalette } from "../components/command-palette.component.js";
import { mountInstallPrompt } from "../components/install-prompt.component.js";
import { MENU_ITEMS } from "../config/app.config.js";
import { googleAuthService } from "../services/google-auth.service.js";
import { appState } from "../controllers/app-state.js";
import { showToast } from "../components/toast.component.js";

const MOBILE_BREAKPOINT = 900;

export function buildMainLayout({ navigate, applyTheme, onSessionEnded = () => {} }) {
  const root = el("div", { class: "app-shell" });
  const sidebarHost = el("div", { class: "sidebar-host" });
  const mainHost = el("div", { class: "main-host" });
  const topbarHost = el("div", { class: "topbar-host" });
  const bannerHost = el("div", { class: "banner-host" });
  const contentHost = el("main", { class: "content-host", id: "content-host" });

  function closeMobileSidebar() {
    document.body.classList.remove("sidebar-collapsed");
  }

  const sidebarBackdrop = el("div", { class: "sidebar-backdrop", onClick: closeMobileSidebar });

  mainHost.append(topbarHost, bannerHost, contentHost);
  root.append(sidebarHost, sidebarBackdrop, mainHost);

  // Dipasang SEKALI saja saat shell dibangun (bukan per-route) — supaya banner
  // "Install App" tidak sempat hilang-muncul lagi setiap pindah halaman.
  mountInstallPrompt(bannerHost);

  // Navigasi lewat sidebar/command palette otomatis menutup drawer di layar HP,
  // supaya pengguna tidak perlu tap dua kali (buka menu -> pilih -> harus tutup manual).
  function navigateAndCloseMobile(route) {
    if (window.innerWidth <= MOBILE_BREAKPOINT) closeMobileSidebar();
    navigate(route);
  }

  function renderSidebarNode(activeRoute) {
    clear(sidebarHost);
    sidebarHost.appendChild(renderSidebar(activeRoute, navigateAndCloseMobile));
  }

  function renderTopbarNode(activeRoute) {
    const state = appState.get();
    const menuItem = MENU_ITEMS.find((m) => m.id === activeRoute);
    clear(topbarHost);
    topbarHost.appendChild(
      renderTopbar({
        title: menuItem?.label || "Dashboard",
        subtitle: null,
        theme: state.theme,
        session: state.session,
        onToggleTheme: async () => {
          const nextTheme = state.theme === "dark" ? "light" : "dark";
          applyTheme(nextTheme);
        },
        onLogout: async () => {
          await googleAuthService.logout();
          appState.set({ session: null, activeSpreadsheet: null, analysisResult: null, databaseContext: null });
          showToast("Anda telah logout", "info");
          if (window.innerWidth <= MOBILE_BREAKPOINT) closeMobileSidebar();
          onSessionEnded();
        },
        onOpenPalette: () => openCommandPalette(navigateAndCloseMobile),
        onToggleSidebar: () => document.body.classList.toggle("sidebar-collapsed"),
      })
    );
  }

  return {
    root,
    contentHost,
    renderSidebarNode,
    renderTopbarNode,
  };
}
