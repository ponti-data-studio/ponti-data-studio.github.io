import { el } from "../utils/dom.util.js";
import { icon } from "../components/icons.component.js";
import { appState } from "../controllers/app-state.js";
import { databaseContextService } from "../services/database-context.service.js";
import { exportService } from "../services/export.service.js";
import { showToast } from "../components/toast.component.js";

export async function renderDatabaseContextPage(navigate) {
  const state = appState.get();
  const container = el("div", { class: "page page--context" });

  if (!state.analysisResult) {
    container.appendChild(
      el("div", { class: "empty-state-panel" }, [
        el("p", {}, "Belum ada hasil analisis. Jalankan Analysis terlebih dahulu."),
        el("button", { class: "btn btn--primary", onClick: () => navigate("analysis") }, "Ke Halaman Analysis"),
      ])
    );
    return container;
  }

  const { model, relationships } = state.analysisResult;
  const context = databaseContextService.build(model, relationships);
  appState.set({ databaseContext: context });

  container.appendChild(el("div", { class: "page__header" }, [
    el("h2", {}, "Database Context"),
    el("p", { class: "muted" }, "Representasi JSON terstruktur — jantung dari Ponti Sheets, dipakai Prompt Builder & AI Studio."),
  ]));

  container.appendChild(
    el("div", { class: "toolbar" }, [
      el("button", { class: "btn btn--ghost", onClick: () => {
        navigator.clipboard.writeText(JSON.stringify(context, null, 2));
        showToast("JSON disalin ke clipboard", "success");
      }}, [el("span", { html: icon("copy", { size: 14 }) }), "Copy JSON"]),
      el("button", { class: "btn btn--ghost", onClick: () => exportService.toJson(context, `database_context_${model.name}.json`) }, [
        el("span", { html: icon("download", { size: 14 }) }), "Export JSON",
      ]),
      el("button", { class: "btn btn--ghost", onClick: () => exportService.toMarkdown(context, `database_context_${model.name}.md`, `Database Context — ${model.name}`) }, [
        el("span", { html: icon("download", { size: 14 }) }), "Export Markdown",
      ]),
      el("button", { class: "btn btn--ghost", onClick: () => navigate("schema-editor") }, [
        el("span", { html: icon("pencil", { size: 14 }) }), "Edit Struktur",
      ]),
      el("button", { class: "btn btn--ghost", onClick: () => navigate("erd") }, [
        el("span", { html: icon("network", { size: 14 }) }), "Lihat ERD Visual",
      ]),
      el("button", { class: "btn btn--primary", onClick: () => navigate("prompt-builder") }, "Lanjut ke Prompt Builder"),
    ])
  );

  container.appendChild(el("div", { class: "stat-grid stat-grid--compact" }, [
    el("div", { class: "card stat-card" }, [el("div", { class: "stat-card__value" }, context.statistics.totalSheets), el("div", { class: "stat-card__label" }, "Sheets")]),
    el("div", { class: "card stat-card" }, [el("div", { class: "stat-card__value" }, context.statistics.totalColumns), el("div", { class: "stat-card__label" }, "Kolom")]),
    el("div", { class: "card stat-card" }, [el("div", { class: "stat-card__value" }, context.statistics.totalFormulas), el("div", { class: "stat-card__label" }, "Formula")]),
    el("div", { class: "card stat-card" }, [el("div", { class: "stat-card__value" }, context.statistics.totalWarnings), el("div", { class: "stat-card__label" }, "Peringatan")]),
  ]));

  if (context.recommendations.length) {
    container.appendChild(el("div", { class: "card" }, [
      el("h4", {}, "Rekomendasi"),
      el("ul", { class: "recommendation-list" }, context.recommendations.map((r) => el("li", {}, r))),
    ]));
  }

  container.appendChild(
    el("div", { class: "card json-viewer" }, [
      el("pre", {}, el("code", {}, JSON.stringify(context, null, 2))),
    ])
  );

  return container;
}
