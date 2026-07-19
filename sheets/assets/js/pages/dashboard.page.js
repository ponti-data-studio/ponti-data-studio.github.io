import { el } from "../utils/dom.util.js";
import { icon } from "../components/icons.component.js";
import { appState } from "../controllers/app-state.js";
import { historyService } from "../services/history.service.js";
import { formatDate } from "../utils/format.util.js";

export async function renderDashboardPage(navigate) {
  const state = appState.get();
  const history = await historyService.getAll();

  const statCard = (label, value, iconName) =>
    el("div", { class: "card stat-card" }, [
      el("div", { class: "stat-card__icon", html: icon(iconName, { size: 20 }) }),
      el("div", {}, [
        el("div", { class: "stat-card__value" }, String(value)),
        el("div", { class: "stat-card__label" }, label),
      ]),
    ]);

  const quickAction = (label, desc, iconName, route) =>
    el("button", { class: "quick-action", onClick: () => navigate(route) }, [
      el("span", { class: "quick-action__icon", html: icon(iconName, { size: 20 }) }),
      el("div", {}, [
        el("div", { class: "quick-action__label" }, label),
        el("div", { class: "quick-action__desc" }, desc),
      ]),
    ]);

  const wrapper = el("div", { class: "page page--dashboard" }, [
    el("section", { class: "hero-panel" }, [
      el("div", {}, [
        el("h2", { class: "hero-panel__title" }, state.session ? `Selamat datang kembali, ${state.session.profile?.given_name || "👋"}` : "Selamat datang di Ponti Sheets"),
        el("p", { class: "hero-panel__desc" }, "Ubah struktur Google Sheets Anda menjadi konteks siap-AI, lalu bangun aplikasi yang benar-benar sesuai data Anda."),
        el("div", { class: "hero-panel__actions" }, [
          el("button", { class: "btn btn--primary", onClick: () => navigate("spreadsheet") }, "Pilih Spreadsheet"),
          el("button", { class: "btn btn--ghost", onClick: () => navigate("documentation") }, "Lihat Dokumentasi"),
        ]),
      ]),
    ]),

    el("section", { class: "stat-grid" }, [
      statCard("Spreadsheet Aktif", state.activeSpreadsheet ? state.activeSpreadsheet.name : "Belum dipilih", "table"),
      statCard("Sheet Dianalisis", state.analysisResult?.model.sheets.length ?? 0, "database"),
      statCard("Riwayat Prompt", history.length, "history"),
      statCard("Provider AI Aktif", (state.settings?.activeProvider || "openai").toUpperCase(), "sparkles"),
    ]),

    el("section", { class: "section" }, [
      el("h3", { class: "section__title" }, "Alur Kerja Cepat"),
      el("div", { class: "quick-action-grid" }, [
        quickAction("✨ Database Builder", "Bikin database baru dari AI (opsional)", "cube", "database-builder"),
        quickAction("🛠️ Schema Editor", "Edit struktur database yang sudah ada", "pencil", "schema-editor"),
        quickAction("1. Pilih Spreadsheet", "Login Google & pilih sumber data", "table", "spreadsheet"),
        quickAction("2. Analisis", "Deteksi tipe kolom, PK/FK, formula", "search-check", "analysis"),
        quickAction("3. Database Context", "Lihat database_context.json", "database", "database-context"),
        quickAction("4. Prompt Builder", "Susun prompt siap pakai untuk AI", "wand-2", "prompt-builder"),
        quickAction("5. AI Studio", "Generate aplikasi dengan AI", "sparkles", "ai-studio"),
        quickAction("6. Export", "Simpan hasil ke Markdown/JSON/PDF", "download", "export"),
      ]),
    ]),

    el("section", { class: "section" }, [
      el("h3", { class: "section__title" }, "Riwayat Terbaru"),
      history.length === 0
        ? el("p", { class: "empty-state" }, "Belum ada riwayat. Mulai dari Prompt Builder atau AI Studio.")
        : el("div", { class: "list" }, history.slice(0, 5).map((h) =>
            el("div", { class: "list__item" }, [
              el("div", {}, [
                el("div", { class: "list__item-title" }, h.spreadsheetName || "(tanpa nama)"),
                el("div", { class: "list__item-sub" }, `${h.templateId} · ${h.provider} · ${formatDate(h.date)}`),
              ]),
            ])
          )),
    ]),
  ]);

  return wrapper;
}
