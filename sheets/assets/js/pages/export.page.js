import { el } from "../utils/dom.util.js";
import { icon } from "../components/icons.component.js";
import { appState } from "../controllers/app-state.js";
import { exportService } from "../services/export.service.js";
import { historyService } from "../services/history.service.js";
import { showToast } from "../components/toast.component.js";

function exportCard(title, desc, actions) {
  return el("div", { class: "card export-card" }, [
    el("h3", {}, title),
    el("p", { class: "muted" }, desc),
    el("div", { class: "export-card__actions" }, actions),
  ]);
}

export async function renderExportPage() {
  const state = appState.get();
  const container = el("div", { class: "page page--export" });

  container.appendChild(el("div", { class: "page__header" }, [
    el("h2", {}, "Export"),
    el("p", { class: "muted" }, "Unduh hasil kerja Anda dalam berbagai format: Markdown, JSON, TXT, atau PDF."),
  ]));

  const btn = (label, iconName, onClick, disabled = false) =>
    el("button", { class: "btn btn--ghost", disabled: disabled ? "true" : undefined, onClick }, [
      el("span", { html: icon(iconName, { size: 14 }) }), label,
    ]);

  container.appendChild(
    exportCard(
      "Database Context",
      state.databaseContext ? "Export struktur database hasil analisis." : "Belum tersedia — jalankan Analysis & buka Database Context terlebih dahulu.",
      [
        btn("JSON", "download", () => exportService.toJson(state.databaseContext, "database_context.json"), !state.databaseContext),
        btn("Markdown", "download", () => exportService.toMarkdown(state.databaseContext, "database_context.md"), !state.databaseContext),
        btn("PDF", "download", () => exportService.toPdfViaPrint(`<h1>Database Context</h1><pre>${JSON.stringify(state.databaseContext, null, 2)}</pre>`), !state.databaseContext),
      ]
    )
  );

  container.appendChild(
    exportCard(
      "Prompt Terakhir",
      state.lastPrompt ? "Export prompt terakhir yang disusun di Prompt Builder." : "Belum ada prompt — buka Prompt Builder terlebih dahulu.",
      [
        btn("TXT", "download", () => exportService.toTxt(state.lastPrompt?.text || "", "prompt.txt"), !state.lastPrompt),
      ]
    )
  );

  const historyBtn = btn("Export Semua History (JSON)", "download", async () => {
    const entries = await historyService.getAll();
    exportService.toJson(entries, "ponti_sheets_history.json");
    showToast("History diexport", "success");
  });
  container.appendChild(exportCard("History", "Export seluruh riwayat prompt & response.", [historyBtn]));

  return container;
}
