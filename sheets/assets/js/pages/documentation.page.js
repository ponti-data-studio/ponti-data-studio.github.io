import { el } from "../utils/dom.util.js";
import { appState } from "../controllers/app-state.js";
import { exportService } from "../services/export.service.js";

function buildErdText(context) {
  const lines = [];
  context.relationships.forEach((r) => lines.push(`${r.from}  ──►  ${r.to}   (${r.type})`));
  return lines.length ? lines.join("\n") : "Tidak ada relasi antar sheet yang terdeteksi.";
}

export async function renderDocumentationPage(navigate) {
  const state = appState.get();
  const container = el("div", { class: "page page--documentation" });

  if (!state.databaseContext) {
    container.appendChild(
      el("div", { class: "empty-state-panel" }, [
        el("p", {}, "Belum ada Database Context untuk didokumentasikan."),
        el("button", { class: "btn btn--primary", onClick: () => navigate("database-context") }, "Ke Database Context"),
      ])
    );
    return container;
  }

  const ctx = state.databaseContext;

  container.appendChild(el("div", { class: "page__header" }, [
    el("h2", {}, "Dokumentasi Otomatis"),
    el("p", { class: "muted" }, `Dihasilkan dari struktur "${ctx.spreadsheet.name}"`),
  ]));

  container.appendChild(el("div", { class: "toolbar" }, [
    el("button", { class: "btn btn--ghost", onClick: () => exportService.toMarkdown(ctx, `dokumentasi_${ctx.spreadsheet.name}.md`, `Dokumentasi — ${ctx.spreadsheet.name}`) }, "Export Markdown"),
  ]));

  container.appendChild(el("div", { class: "card" }, [
    el("h3", {}, "1. Data Dictionary"),
    ...ctx.sheets.map((s) => el("div", { class: "doc-block" }, [
      el("h4", {}, s.name),
      el("table", { class: "data-table" }, [
        el("thead", {}, el("tr", {}, ["Kolom", "Tipe", "Keterangan"].map((h) => el("th", {}, h)))),
        el("tbody", {}, s.columns.map((c) => el("tr", {}, [
          el("td", {}, c.name),
          el("td", {}, c.type),
          el("td", {}, [c.isPrimaryKey && "Primary Key", c.isForeignKey && `Foreign Key${c.referencesSheet ? ` → ${c.referencesSheet}.${c.referencesColumn}` : ""}`].filter(Boolean).join(", ") || "-"),
        ]))),
      ]),
    ])),
  ]));

  container.appendChild(el("div", { class: "card" }, [
    el("h3", {}, "2. Entity Relationship (ERD Teks)"),
    el("pre", { class: "erd-box" }, buildErdText(ctx)),
    el("button", { class: "btn btn--ghost btn--sm", onClick: () => navigate("erd") }, "Lihat Versi Visual →"),
  ]));

  container.appendChild(el("div", { class: "card" }, [
    el("h3", {}, "3. Business Process & Rules"),
    el("ul", {}, ctx.businessRules.map((r) => el("li", {}, r))),
  ]));

  container.appendChild(el("div", { class: "card" }, [
    el("h3", {}, "4. Feature List (disarankan)"),
    el("ul", {}, [
      "Autentikasi & login Google",
      ...ctx.sheets.map((s) => `CRUD untuk data "${s.name}"`),
      "Dashboard ringkasan data",
      "Export laporan",
    ].map((f) => el("li", {}, f))),
  ]));

  container.appendChild(el("div", { class: "card" }, [
    el("h3", {}, "5. System Requirement"),
    el("ul", {}, [
      "Akun Google dengan akses ke spreadsheet sumber",
      "Koneksi internet untuk sinkronisasi data",
      "Browser modern (Chrome, Edge, Firefox terbaru)",
    ].map((f) => el("li", {}, f))),
  ]));

  return container;
}
