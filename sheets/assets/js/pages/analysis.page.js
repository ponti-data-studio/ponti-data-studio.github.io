import { el, clear } from "../utils/dom.util.js";
import { icon } from "../components/icons.component.js";
import { appState } from "../controllers/app-state.js";
import { analysisService } from "../services/analysis.service.js";
import { showToast } from "../components/toast.component.js";

function columnBadge(col) {
  const badges = [];
  if (col.isPrimaryKey) badges.push(el("span", { class: "badge badge--pk" }, "PK"));
  if (col.isForeignKey) badges.push(el("span", { class: "badge badge--fk" }, col.referencesSheet ? `FK → ${col.referencesSheet}` : "FK?"));
  return badges;
}

function renderSheetCard(sheet) {
  const rows = sheet.columns.map((c) =>
    el("tr", {}, [
      el("td", {}, c.name),
      el("td", {}, el("span", { class: "badge badge--type" }, c.type)),
      el("td", {}, columnBadge(c)),
      el("td", {}, `${Math.round(c.confidence * 100)}%`),
      el("td", {}, c.nullable ? "Ya" : "Tidak"),
    ])
  );

  const warnings = (sheet.qualityWarnings || []).map((w) =>
    el("li", { class: `quality-item quality-item--${w.level}` }, w.message)
  );

  const formulas = sheet.formulas.slice(0, 10).map((f) =>
    el("li", { class: "formula-item" }, [
      el("code", {}, f.formula),
      el("span", { class: "formula-item__meta" }, ` — ${f.name} (${f.cell})`),
    ])
  );

  return el("div", { class: "card sheet-card" }, [
    el("div", { class: "sheet-card__header" }, [
      el("h3", {}, sheet.name),
      el("span", { class: "muted" }, `${sheet.rowCount} baris × ${sheet.columnCount} kolom`),
    ]),
    el("table", { class: "data-table" }, [
      el("thead", {}, el("tr", {}, ["Kolom", "Tipe", "Key", "Confidence", "Nullable"].map((h) => el("th", {}, h)))),
      el("tbody", {}, rows),
    ]),
    formulas.length ? el("div", { class: "sheet-card__section" }, [
      el("h4", {}, `Formula Terdeteksi (${sheet.formulas.length})`),
      el("ul", { class: "formula-list" }, formulas),
    ]) : null,
    warnings.length ? el("div", { class: "sheet-card__section" }, [
      el("h4", {}, "Data Quality"),
      el("ul", { class: "quality-list" }, warnings),
    ]) : el("p", { class: "muted" }, "Tidak ada masalah kualitas data terdeteksi pada sample."),
  ]);
}

export async function renderAnalysisPage(navigate) {
  const state = appState.get();
  const container = el("div", { class: "page page--analysis" });

  if (!state.activeSpreadsheet) {
    container.appendChild(
      el("div", { class: "empty-state-panel" }, [
        el("p", {}, "Belum ada spreadsheet yang dipilih."),
        el("button", { class: "btn btn--primary", onClick: () => navigate("spreadsheet") }, "Pilih Spreadsheet"),
      ])
    );
    return container;
  }

  container.appendChild(el("div", { class: "page__header" }, [
    el("h2", {}, `Analisis: ${state.activeSpreadsheet.name}`),
    el("p", { class: "muted" }, "Deteksi tipe kolom, primary/foreign key, formula, dan kualitas data."),
  ]));

  const progressHost = el("div", { class: "progress-panel card" }, [
    el("span", { class: "spinner" }),
    el("span", { class: "progress-label" }, "Memulai analisis..."),
  ]);
  const resultsHost = el("div", { class: "analysis-results" });

  container.appendChild(progressHost);
  container.appendChild(resultsHost);

  try {
    const result = await analysisService.analyzeSpreadsheet(state.activeSpreadsheet.id, (p) => {
      clear(progressHost);
      progressHost.appendChild(el("span", { class: "spinner" }));
      progressHost.appendChild(el("span", { class: "progress-label" }, p.label));
    });

    appState.set({ analysisResult: result });
    progressHost.remove();

    result.model.sheets.forEach((sheet) => resultsHost.appendChild(renderSheetCard(sheet)));

    resultsHost.appendChild(
      el("div", { class: "page__footer-actions" }, [
        el("button", { class: "btn btn--primary", onClick: () => navigate("database-context") }, [
          "Lanjut ke Database Context ",
          el("span", { html: icon("database", { size: 16 }) }),
        ]),
      ])
    );
  } catch (err) {
    progressHost.remove();
    resultsHost.appendChild(el("p", { class: "error-state" }, `Analisis gagal: ${err.message}`));
    showToast("Analisis gagal, cek koneksi/izin akses.", "error");
  }

  return container;
}
