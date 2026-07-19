import { el } from "../utils/dom.util.js";
import { icon } from "../components/icons.component.js";
import { appState } from "../controllers/app-state.js";
import { computeErdLayout } from "../services/erd-layout.service.js";
import { exportService } from "../services/export.service.js";
import { showToast } from "../components/toast.component.js";

const TYPE_COLOR = {
  isPrimaryKey: "var(--accent)",
  isForeignKey: "var(--info)",
  normal: "var(--text-secondary)",
};

const ROW_H = 24;
function headerOffset() { return 40 + ROW_H / 2; }

function escapeXml(str = "") {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildNodeSvg(node) {
  const rows = node.columns.map((c) => {
    const y = headerOffset() + c.rowIndex * ROW_H;
    const dotColor = c.isPrimaryKey ? TYPE_COLOR.isPrimaryKey : c.isForeignKey ? TYPE_COLOR.isForeignKey : "transparent";
    const textColor = c.isPrimaryKey ? TYPE_COLOR.isPrimaryKey : c.isForeignKey ? TYPE_COLOR.isForeignKey : TYPE_COLOR.normal;
    const label = c.isPrimaryKey ? "PK" : c.isForeignKey ? "FK" : "";
    return `
      <g>
        <circle cx="${node.x + 16}" cy="${node.y + y}" r="3.5" style="fill:${dotColor}" />
        <text x="${node.x + 28}" y="${node.y + y + 4}" style="font: 12px var(--font-mono); fill:${textColor};">${escapeXml(c.name)}</text>
        <text x="${node.x + node.width - 12}" y="${node.y + y + 4}" text-anchor="end" style="font: 10.5px var(--font-mono); fill:var(--text-tertiary);">${escapeXml(c.type)}${label ? " · " + label : ""}</text>
      </g>`;
  }).join("");

  const hiddenRow = node.hiddenCount > 0
    ? `<text x="${node.x + 16}" y="${node.y + headerOffset() + node.columns.length * ROW_H + 2}" style="font: 11px var(--font-ui); fill:var(--text-tertiary); font-style:italic;">+${node.hiddenCount} kolom lainnya</text>`
    : "";

  return `
    <g class="erd-node">
      <rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" rx="10"
        style="fill:var(--bg-card); stroke:var(--border); stroke-width:1.5;" />
      <rect x="${node.x}" y="${node.y}" width="${node.width}" height="36" rx="10"
        style="fill:var(--bg-hover);" />
      <rect x="${node.x}" y="${node.y + 18}" width="${node.width}" height="18"
        style="fill:var(--bg-hover);" />
      <line x1="${node.x}" y1="${node.y + 36}" x2="${node.x + node.width}" y2="${node.y + 36}" style="stroke:var(--border);" />
      <text x="${node.x + 16}" y="${node.y + 23}" style="font: 700 13px var(--font-ui); fill:var(--text-primary);">${escapeXml(node.sheet)}</text>
      <text x="${node.x + node.width - 12}" y="${node.y + 23}" text-anchor="end" style="font: 11px var(--font-ui); fill:var(--text-tertiary);">${node.rowCount} baris</text>
      ${rows}
      ${hiddenRow}
    </g>`;
}

function buildEdgeSvg(edge, idx) {
  const { fromPoint: p1, toPoint: p2 } = edge;
  const dx = Math.max(60, Math.abs(p2.x - p1.x) / 2);
  const c1x = p1.x + (p2.x >= p1.x ? dx : -dx);
  const c2x = p2.x + (p2.x >= p1.x ? -dx : dx);
  const midX = (p1.x + p2.x) / 2;
  const midY = (p1.y + p2.y) / 2;

  return `
    <g class="erd-edge">
      <path d="M ${p1.x} ${p1.y} C ${c1x} ${p1.y}, ${c2x} ${p2.y}, ${p2.x} ${p2.y}"
        fill="none" style="stroke:var(--text-tertiary); stroke-width:1.5;" marker-end="url(#erd-arrow)" />
      <circle cx="${midX}" cy="${midY}" r="8" style="fill:var(--bg-base); stroke:var(--border);" />
      <text x="${midX}" y="${midY + 4}" text-anchor="middle" style="font: 9px var(--font-ui); fill:var(--text-tertiary);">${idx + 1}</text>
    </g>`;
}

function buildFullSvg(layout) {
  const nodesSvg = layout.nodes.map(buildNodeSvg).join("");
  const edgesSvg = layout.edges.map(buildEdgeSvg).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${layout.canvasWidth} ${layout.canvasHeight}" width="${layout.canvasWidth}" height="${layout.canvasHeight}">
    <defs>
      <marker id="erd-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" style="fill:var(--text-tertiary);" />
      </marker>
    </defs>
    <g class="erd-edges">${edgesSvg}</g>
    <g class="erd-nodes">${nodesSvg}</g>
  </svg>`;
}

export async function renderErdPage(navigate) {
  const state = appState.get();
  const container = el("div", { class: "page page--erd" });

  if (!state.databaseContext) {
    container.appendChild(
      el("div", { class: "empty-state-panel" }, [
        el("p", {}, "Belum ada Database Context. Jalankan Analysis & buka Database Context terlebih dahulu."),
        el("button", { class: "btn btn--primary", onClick: () => navigate("database-context") }, "Ke Database Context"),
      ])
    );
    return container;
  }

  const ctx = state.databaseContext;

  if (ctx.sheets.length === 0) {
    container.appendChild(el("p", { class: "empty-state" }, "Tidak ada sheet untuk divisualisasikan."));
    return container;
  }

  const perRow = 3;
  const layout = computeErdLayout(ctx, perRow);

  container.appendChild(el("div", { class: "page__header" }, [
    el("h2", {}, "Entity Relationship Diagram"),
    el("p", { class: "muted" }, `Visualisasi struktur & relasi antar sheet untuk "${ctx.spreadsheet.name}". ${layout.edges.length} relasi terdeteksi.`),
  ]));

  let zoom = 1;
  const canvasWrap = el("div", { class: "erd-canvas-wrap" });
  const canvasInner = el("div", { class: "erd-canvas-inner", html: buildFullSvg(layout) });
  canvasWrap.appendChild(canvasInner);

  function applyZoom() {
    canvasInner.style.transform = `scale(${zoom})`;
  }

  const zoomOutBtn = el("button", { class: "icon-btn erd-zoom-btn", onClick: () => { zoom = Math.max(0.4, zoom - 0.15); applyZoom(); } }, "–");
  const zoomInBtn = el("button", { class: "icon-btn erd-zoom-btn", onClick: () => { zoom = Math.min(2, zoom + 0.15); applyZoom(); } }, "+");
  const zoomResetBtn = el("button", { class: "btn btn--ghost btn--sm", onClick: () => { zoom = 1; applyZoom(); } }, "Reset");

  const exportSvgBtn = el("button", { class: "btn btn--ghost btn--sm", onClick: () => {
    exportService.toSvg(buildFullSvg(layout), `erd_${ctx.spreadsheet.name}.svg`);
    showToast("ERD diexport sebagai SVG", "success");
  }}, [el("span", { html: icon("download", { size: 13 }) }), "Export SVG"]);

  container.appendChild(
    el("div", { class: "toolbar erd-toolbar" }, [
      el("div", { class: "erd-zoom-controls" }, [zoomOutBtn, zoomResetBtn, zoomInBtn]),
      el("div", { class: "toolbar__spacer" }),
      exportSvgBtn,
    ])
  );

  container.appendChild(
    el("div", { class: "erd-legend" }, [
      el("span", { class: "erd-legend__item" }, [el("span", { class: "erd-dot erd-dot--pk" }), "Primary Key"]),
      el("span", { class: "erd-legend__item" }, [el("span", { class: "erd-dot erd-dot--fk" }), "Foreign Key"]),
      el("span", { class: "erd-legend__item" }, [el("span", { class: "erd-line" }), "Relasi (FK → PK)"]),
    ])
  );

  container.appendChild(canvasWrap);

  if (layout.edges.length === 0) {
    container.appendChild(
      el("p", { class: "hint" }, "Tidak ada relasi antar sheet yang terdeteksi secara otomatis — kotak sheet tetap ditampilkan sebagai referensi struktur.")
    );
  }

  return container;
}
