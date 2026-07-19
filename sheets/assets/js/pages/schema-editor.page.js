import { el, clear } from "../utils/dom.util.js";
import { icon } from "../components/icons.component.js";
import { appState } from "../controllers/app-state.js";
import { BLUEPRINT_COLUMN_TYPES } from "../config/app.config.js";
import { generateKey } from "../models/blueprint.model.js";
import { schemaReaderService } from "../services/schema-reader.service.js";
import { schemaDiffService } from "../services/schema-diff.service.js";
import { schemaSyncService } from "../services/schema-sync.service.js";
import { googleAuthService } from "../services/google-auth.service.js";
import { showToast } from "../components/toast.component.js";

function newColumn() {
  return {
    _key: generateKey("col"), name: "kolom_baru", label: "kolom_baru", description: "",
    type: "text", required: false, isPrimaryKey: false, isForeignKey: false,
    referencesSheet: null, referencesColumn: null, defaultValue: null, formula: null,
    validation: null, sampleData: [],
  };
}

function newSheet(existingNames) {
  let name = "Sheet_Baru";
  let n = 1;
  while (existingNames.includes(name)) { n += 1; name = `Sheet_Baru_${n}`; }
  return {
    _key: generateKey("sheet"), name, description: "", tabColor: "#6366F1", freezeRow: 1, filter: true,
    columns: [{ ...newColumn(), name: "id", label: "id", isPrimaryKey: true, required: true }],
    dummyData: [], conditionalFormats: [], protected: false, sheetId: undefined, lastRow: 1,
  };
}

function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }

/** Checkbox yang ditampilkan sebagai "chip" kecil (mis. badge PK/FK) — lebih gampang
 *  dipindai matanya dibanding checkbox polos + label panjang di dalam tabel sempit. */
function chipToggle(label, checked, variant, onChange) {
  const input = el("input", { type: "checkbox", class: "chip-toggle__input", checked: checked ? "true" : undefined });
  input.addEventListener("change", () => onChange(input.checked));
  const wrap = el("label", { class: `chip-toggle ${variant ? `chip-toggle--${variant}` : ""}` }, [
    input,
    el("span", { class: "chip-toggle__label" }, label),
  ]);
  return { wrap, input };
}

export async function renderSchemaEditorPage(navigate) {
  const state = appState.get();
  const container = el("div", { class: "page page--schema-editor" });

  container.appendChild(el("div", { class: "page__header" }, [
    el("h2", {}, "Schema Editor"),
    el("p", { class: "muted" }, "Edit struktur database Google Sheets Anda yang sudah ada — tambah/hapus/rename kolom & sheet, ubah formula, validasi, relasi, dan lainnya."),
  ]));

  if (!state.activeSpreadsheet) {
    container.appendChild(
      el("div", { class: "empty-state-panel" }, [
        el("p", {}, "Pilih spreadsheet terlebih dahulu sebelum mengedit strukturnya."),
        el("button", { class: "btn btn--primary", onClick: () => navigate("spreadsheet") }, "Pilih Spreadsheet"),
      ])
    );
    return container;
  }

  const session = await googleAuthService.getSession();
  if (!session) {
    container.appendChild(
      el("div", { class: "empty-state-panel" }, [
        el("p", {}, "Silakan login dengan Google terlebih dahulu."),
        el("button", { class: "btn btn--primary", onClick: () => navigate("spreadsheet") }, "Login"),
      ])
    );
    return container;
  }

  const bodyHost = el("div", {});
  container.appendChild(bodyHost);

  let original = null;
  let edited = null;
  // UI-only: sheet mana yang sedang diciutkan (collapsed). Tidak pernah dikirim ke
  // Google Sheets — murni state tampilan, supaya fokus ke satu sheet lebih mudah di desktop.
  const collapsedSheets = new Set();

  async function loadSchema() {
    clear(bodyHost);
    bodyHost.appendChild(
      el("div", { class: "card progress-panel" }, [el("span", { class: "spinner" }), el("span", {}, "Membaca struktur spreadsheet saat ini...")])
    );
    try {
      const result = await schemaReaderService.readSchema(state.activeSpreadsheet.id);
      original = result.blueprint;
      edited = deepClone(original);
      renderEditor();
    } catch (err) {
      clear(bodyHost);
      bodyHost.appendChild(
        el("div", { class: "card error-state-panel" }, [
          el("p", { class: "error-state" }, `Gagal membaca struktur: ${err.message}`),
          el("button", { class: "btn btn--ghost", onClick: loadSchema }, "Coba Lagi"),
        ])
      );
    }
  }

  function renderColumnRow(sheet, col, onStructuralChange, getTbody) {
    const nameInput = el("input", { type: "text", value: col.name });
    nameInput.addEventListener("input", () => { col.name = nameInput.value; col.label = nameInput.value; });

    const typeSelect = el("select", {}, BLUEPRINT_COLUMN_TYPES.map((t) => el("option", { value: t, selected: t === col.type ? "true" : undefined }, t)));
    typeSelect.addEventListener("change", () => { col.type = typeSelect.value; });

    const { wrap: pkWrap } = chipToggle("PK", col.isPrimaryKey, "pk", (checked) => { col.isPrimaryKey = checked; });

    const { wrap: fkWrap, input: fkCheck } = chipToggle("FK", col.isForeignKey, "fk", (checked) => {
      col.isForeignKey = checked;
      fkSelectsWrap.style.display = checked ? "" : "none";
      if (!checked) { col.referencesSheet = null; col.referencesColumn = null; }
      else refreshFkSheetOptions();
    });
    const fkSheetSelect = el("select", {});
    const fkColSelect = el("select", {});
    const fkSelectsWrap = el("div", { class: "fk-selects", style: col.isForeignKey ? "" : "display:none" }, [fkSheetSelect, fkColSelect]);

    function refreshFkSheetOptions() {
      clear(fkSheetSelect);
      fkSheetSelect.appendChild(el("option", { value: "" }, "-- pilih sheet --"));
      edited.sheets.filter((s) => s._key !== sheet._key).forEach((s) => {
        fkSheetSelect.appendChild(el("option", { value: s.name, selected: s.name === col.referencesSheet ? "true" : undefined }, s.name));
      });
      refreshFkColOptions();
    }
    function refreshFkColOptions() {
      clear(fkColSelect);
      const targetSheet = edited.sheets.find((s) => s.name === fkSheetSelect.value);
      (targetSheet?.columns || []).forEach((c) => {
        fkColSelect.appendChild(el("option", { value: c.name, selected: c.name === col.referencesColumn ? "true" : undefined }, c.name));
      });
      col.referencesColumn = fkColSelect.value || null;
    }
    refreshFkSheetOptions();
    fkSheetSelect.addEventListener("change", () => { col.referencesSheet = fkSheetSelect.value || null; refreshFkColOptions(); });
    fkColSelect.addEventListener("change", () => { col.referencesColumn = fkColSelect.value || null; });

    const { wrap: requiredWrap } = chipToggle("Wajib", col.required, null, (checked) => { col.required = checked; });

    const formulaInput = el("input", { type: "text", placeholder: "kosongkan jika bukan kolom formula", value: col.formula || "" });
    formulaInput.addEventListener("input", () => { col.formula = formulaInput.value.trim() || null; });

    const formulaLiveCheck = el("input", { type: "checkbox", checked: col.formulaIsLive !== false ? "true" : undefined });
    formulaLiveCheck.addEventListener("change", () => { col.formulaIsLive = formulaLiveCheck.checked; });
    const formulaLiveLabel = el("label", {
      class: "formula-live-toggle",
      title: "Dicentang: formula sungguhan ditulis (nilai ikut berubah otomatis). Tidak dicentang: hasil hitungannya saja yang disimpan sebagai nilai tetap.",
    }, [
      formulaLiveCheck,
      el("span", {}, "Formula aktif"),
      el("span", { class: "formula-live-toggle__info", html: icon("alert", { size: 12 }) }),
    ]);

    // ---- Validasi ----
    const validationTypeSelect = el("select", {}, ["none", "list", "number", "date", "checkbox", "email", "phone"].map((t) =>
      el("option", { value: t, selected: (col.validation?.type || "none") === t ? "true" : undefined }, t)
    ));
    const validationExtra = el("div", { class: "validation-extra" });

    function renderValidationExtra() {
      clear(validationExtra);
      const t = validationTypeSelect.value;
      if (t === "list") {
        const currentOptions = col.validation?.type === "list" ? col.validation.options : [];
        const optionsInput = el("input", { type: "text", placeholder: "opsi dipisah koma, mis: Pending,Paid,Cancelled", value: (currentOptions || []).join(",") });
        const sync = () => {
          col.validation = { type: "list", options: optionsInput.value.split(",").map((s) => s.trim()).filter(Boolean), min: null, max: null };
        };
        optionsInput.addEventListener("input", sync);
        sync(); // PENTING: set langsung juga, bukan cuma saat diketik — kalau tidak,
        // memilih "list" tanpa mengetik apa pun tidak akan pernah tersimpan.
        validationExtra.appendChild(optionsInput);
      } else if (t === "number") {
        const currentMin = col.validation?.type === "number" ? col.validation.min : null;
        const currentMax = col.validation?.type === "number" ? col.validation.max : null;
        const minInput = el("input", { type: "number", placeholder: "min", value: currentMin ?? "" });
        const maxInput = el("input", { type: "number", placeholder: "max", value: currentMax ?? "" });
        const sync = () => {
          col.validation = { type: "number", options: null, min: minInput.value === "" ? null : Number(minInput.value), max: maxInput.value === "" ? null : Number(maxInput.value) };
        };
        minInput.addEventListener("input", sync);
        maxInput.addEventListener("input", sync);
        sync(); // sama seperti di atas — set langsung, jangan tunggu diketik
        validationExtra.append(minInput, maxInput);
      } else if (t === "none") {
        col.validation = null;
      } else {
        col.validation = { type: t, options: null, min: null, max: null };
      }
    }
    validationTypeSelect.addEventListener("change", renderValidationExtra);
    renderValidationExtra();

    const upBtn = el("button", { class: "icon-btn icon-btn--sm", title: "Naik" }, "↑");
    const downBtn = el("button", { class: "icon-btn icon-btn--sm", title: "Turun" }, "↓");
    const deleteBtn = el("button", { class: "icon-btn icon-btn--sm icon-btn--danger", title: "Hapus kolom" }, [el("span", { html: icon("trash", { size: 13 }) })]);
    const dragHandle = el("button", { class: "icon-btn icon-btn--sm drag-handle", title: "Geser untuk mengurutkan" }, "⠿");

    upBtn.addEventListener("click", () => {
      const idx = sheet.columns.findIndex((c) => c._key === col._key);
      if (idx > 0) { [sheet.columns[idx - 1], sheet.columns[idx]] = [sheet.columns[idx], sheet.columns[idx - 1]]; onStructuralChange(); }
    });
    downBtn.addEventListener("click", () => {
      const idx = sheet.columns.findIndex((c) => c._key === col._key);
      if (idx < sheet.columns.length - 1) { [sheet.columns[idx + 1], sheet.columns[idx]] = [sheet.columns[idx], sheet.columns[idx + 1]]; onStructuralChange(); }
    });
    deleteBtn.addEventListener("click", () => {
      if (!confirm(`Hapus kolom "${col.name}"? Data pada kolom ini akan hilang permanen saat perubahan diterapkan.`)) return;
      sheet.columns = sheet.columns.filter((c) => c._key !== col._key);
      onStructuralChange();
    });

    const row = el("tr", { "data-key": col._key }, [
      el("td", { "data-label": "Nama" }, nameInput),
      el("td", { "data-label": "Tipe" }, typeSelect),
      el("td", { class: "cell-center", "data-label": "PK" }, pkWrap),
      el("td", { class: "fk-cell", "data-label": "FK" }, [el("div", { class: "cell-stack" }, [fkWrap, fkSelectsWrap])]),
      el("td", { class: "cell-center", "data-label": "Wajib" }, requiredWrap),
      el("td", { class: "formula-cell", "data-label": "Formula" }, [el("div", { class: "cell-stack" }, [formulaInput, formulaLiveLabel])]),
      el("td", { class: "validation-cell", "data-label": "Validasi" }, [el("div", { class: "cell-stack" }, [validationTypeSelect, validationExtra])]),
      el("td", { class: "cell-actions", "data-label": "" }, [
        el("div", { class: "cell-actions-row" }, [
          el("div", { class: "cell-actions__group" }, [dragHandle, upBtn, downBtn]),
          el("div", { class: "cell-actions__divider" }),
          deleteBtn,
        ]),
      ]),
    ]);

    makeRowDraggable(dragHandle, row, getTbody, (orderedKeys) => {
      const byKey = new Map(sheet.columns.map((c) => [c._key, c]));
      sheet.columns = orderedKeys.map((k) => byKey.get(k)).filter(Boolean);
    });

    return row;
  }

  /** Membuat sebuah baris tabel bisa "digeser" naik-turun lewat drag handle-nya (mouse & sentuhan) */
  function makeRowDraggable(handle, row, getTbody, onReorderCommit) {
    let dragging = false;

    handle.addEventListener("pointerdown", (e) => {
      dragging = true;
      handle.setPointerCapture(e.pointerId);
      row.classList.add("row-dragging");
      e.preventDefault();
    });

    handle.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const tbody = getTbody();
      if (!tbody) return;
      const rowRect = row.getBoundingClientRect();
      const pointerY = e.clientY;
      const siblings = Array.from(tbody.children).filter((r) => r !== row);

      for (const other of siblings) {
        const rect = other.getBoundingClientRect();
        const mid = rect.top + rect.height / 2;
        if (rowRect.top > rect.top && pointerY < mid) {
          tbody.insertBefore(row, other);
          break;
        }
        if (rowRect.top < rect.top && pointerY > mid) {
          tbody.insertBefore(row, other.nextSibling);
          break;
        }
      }
    });

    function endDrag() {
      if (!dragging) return;
      dragging = false;
      row.classList.remove("row-dragging");
      const tbody = getTbody();
      if (!tbody) return;
      const orderedKeys = Array.from(tbody.children).map((r) => r.dataset.key);
      onReorderCommit(orderedKeys);
    }

    handle.addEventListener("pointerup", endDrag);
    handle.addEventListener("pointercancel", endDrag);
  }

  function renderConditionalFormatRow(sheet, cf, onStructuralChange) {
    const colSelect = el("select", {}, sheet.columns.map((c) => el("option", { value: c.name, selected: c.name === cf.column ? "true" : undefined }, c.name)));
    colSelect.addEventListener("change", () => { cf.column = colSelect.value; });
    const condSelect = el("select", {}, ["less_than", "greater_than", "equal", "text_contains", "text_equals"].map((c) =>
      el("option", { value: c, selected: c === cf.condition ? "true" : undefined }, c)
    ));
    condSelect.addEventListener("change", () => { cf.condition = condSelect.value; });
    const valueInput = el("input", { type: "text", value: cf.value ?? "", placeholder: "nilai pembanding" });
    valueInput.addEventListener("input", () => { cf.value = valueInput.value; });
    const colorInput = el("input", { type: "color", value: cf.backgroundColor || "#EF4444" });
    colorInput.addEventListener("input", () => { cf.backgroundColor = colorInput.value; });
    const descInput = el("input", { type: "text", value: cf.description || "", placeholder: "keterangan (opsional)" });
    descInput.addEventListener("input", () => { cf.description = descInput.value; });
    const deleteBtn = el("button", { class: "icon-btn icon-btn--sm icon-btn--danger" }, [el("span", { html: icon("trash", { size: 13 }) })]);
    deleteBtn.addEventListener("click", () => {
      sheet.conditionalFormats = sheet.conditionalFormats.filter((x) => x !== cf);
      onStructuralChange();
    });

    return el("tr", {}, [
      el("td", {}, colSelect), el("td", {}, condSelect), el("td", {}, valueInput),
      el("td", {}, colorInput), el("td", {}, descInput), el("td", { class: "cell-actions" }, deleteBtn),
    ]);
  }

  function renderSheetCard(sheet, sheetIdx, totalSheets, onStructuralChange) {
    const isCollapsed = collapsedSheets.has(sheet._key);

    const nameInput = el("input", { type: "text", class: "sheet-name-input", value: sheet.name });
    nameInput.addEventListener("input", () => { sheet.name = nameInput.value; });
    const colorInput = el("input", { type: "color", title: "Warna tab", value: sheet.tabColor || "#6366F1" });
    colorInput.addEventListener("input", () => { sheet.tabColor = colorInput.value; });
    const freezeInput = el("input", { type: "number", min: "0", max: "5", value: String(sheet.freezeRow ?? 1) });
    freezeInput.addEventListener("input", () => { sheet.freezeRow = Number(freezeInput.value) || 0; });
    const { wrap: filterWrap } = chipToggle("Filter", sheet.filter, null, (checked) => { sheet.filter = checked; });
    const { wrap: protectedWrap } = chipToggle("Protect Header", sheet.protected, null, (checked) => { sheet.protected = checked; });

    const collapseBtn = el("button", {
      class: "icon-btn icon-btn--sm schema-collapse-btn",
      title: isCollapsed ? "Perluas sheet ini" : "Ciutkan sheet ini",
    }, isCollapsed ? "▸" : "▾");
    collapseBtn.addEventListener("click", () => {
      if (collapsedSheets.has(sheet._key)) collapsedSheets.delete(sheet._key);
      else collapsedSheets.add(sheet._key);
      onStructuralChange();
    });

    const upBtn = el("button", { class: "icon-btn icon-btn--sm", title: "Pindah sheet ke atas", disabled: sheetIdx === 0 ? "true" : undefined }, "↑");
    const downBtn = el("button", { class: "icon-btn icon-btn--sm", title: "Pindah sheet ke bawah", disabled: sheetIdx === totalSheets - 1 ? "true" : undefined }, "↓");
    const deleteSheetBtn = el("button", { class: "btn btn--ghost btn--sm icon-btn--danger-text" }, [el("span", { html: icon("trash", { size: 13 }) }), "Hapus Sheet"]);
    const addColBtn = el("button", { class: "btn btn--ghost btn--sm" }, [el("span", { html: icon("plus", { size: 13 }) }), "Tambah Kolom"]);
    const addCfBtn = el("button", { class: "btn btn--ghost btn--sm" }, [el("span", { html: icon("plus", { size: 13 }) }), "Tambah Conditional Format"]);

    upBtn.addEventListener("click", () => {
      const idx = edited.sheets.findIndex((s) => s._key === sheet._key);
      if (idx > 0) { [edited.sheets[idx - 1], edited.sheets[idx]] = [edited.sheets[idx], edited.sheets[idx - 1]]; onStructuralChange(); }
    });
    downBtn.addEventListener("click", () => {
      const idx = edited.sheets.findIndex((s) => s._key === sheet._key);
      if (idx < edited.sheets.length - 1) { [edited.sheets[idx + 1], edited.sheets[idx]] = [edited.sheets[idx], edited.sheets[idx + 1]]; onStructuralChange(); }
    });
    deleteSheetBtn.addEventListener("click", () => {
      if (!confirm(`Hapus sheet "${sheet.name}" beserta seluruh isinya? Tindakan ini permanen setelah diterapkan.`)) return;
      edited.sheets = edited.sheets.filter((s) => s._key !== sheet._key);
      onStructuralChange();
    });
    addColBtn.addEventListener("click", () => { sheet.columns.push(newColumn()); onStructuralChange(); });
    addCfBtn.addEventListener("click", () => {
      sheet.conditionalFormats.push({ column: sheet.columns[0]?.name || "", condition: "less_than", value: 0, backgroundColor: "#EF4444", description: "" });
      onStructuralChange();
    });

    const card = el("div", { class: "card sheet-card schema-sheet-card", id: `schema-sheet-${sheet._key}` });

    const header = el("div", { class: "schema-sheet-card__header" }, [
      el("div", { class: "schema-sheet-card__title-row" }, [
        collapseBtn,
        nameInput,
        el("span", { class: "schema-sheet-card__summary" }, `${sheet.columns.length} kolom · ${sheet.conditionalFormats.length} conditional format`),
        el("div", { class: "schema-sheet-card__order-actions" }, [upBtn, downBtn, deleteSheetBtn]),
      ]),
      el("div", { class: "schema-sheet-card__meta-row" }, [
        el("label", { class: "tab-color-swatch", title: "Warna tab" }, [colorInput]),
        el("label", { class: "freeze-row-field", title: "Freeze row" }, [
          el("span", {}, "Freeze"), freezeInput,
        ]),
        filterWrap,
        protectedWrap,
      ]),
    ]);
    card.appendChild(header);

    if (isCollapsed) {
      card.classList.add("schema-sheet-card--collapsed");
      return card;
    }

    let colTbody = null;
    const colRows = sheet.columns.map((col) => renderColumnRow(sheet, col, onStructuralChange, () => colTbody));
    colTbody = el("tbody", {}, colRows);
    const cfRows = sheet.conditionalFormats.map((cf) => renderConditionalFormatRow(sheet, cf, onStructuralChange));

    card.append(
      el("div", { class: "schema-section-heading" }, [
        el("span", { class: "schema-section-heading__icon", html: icon("table", { size: 14 }) }),
        el("h4", {}, "Kolom"),
      ]),
      el("p", { class: "field__hint schema-column-hint" }, "Geser ikon ⠿ untuk mengurutkan ulang kolom, atau pakai tombol ↑/↓."),
      el("div", { class: "schema-column-table-wrap" }, [
        el("table", { class: "data-table schema-column-table" }, [
          el("thead", {}, el("tr", {}, ["Nama", "Tipe", "PK", "FK", "Wajib", "Formula", "Validasi", ""].map((h) => el("th", {}, h)))),
          colTbody,
        ]),
      ]),
      addColBtn,
      el("div", { class: "schema-section-heading schema-section-heading--spaced" }, [
        el("span", { class: "schema-section-heading__icon", html: icon("wand-2", { size: 14 }) }),
        el("h4", {}, "Conditional Formatting"),
      ]),
      sheet.conditionalFormats.length
        ? el("table", { class: "data-table" }, [
            el("thead", {}, el("tr", {}, ["Kolom", "Kondisi", "Nilai", "Warna", "Keterangan", ""].map((h) => el("th", {}, h)))),
            el("tbody", {}, cfRows),
          ])
        : el("p", { class: "muted schema-empty-hint" }, "Belum ada conditional formatting untuk sheet ini."),
      addCfBtn,
    );

    return card;
  }

  function renderNamedRangesSection(onStructuralChange) {
    const addBtn = el("button", { class: "btn btn--ghost btn--sm" }, [el("span", { html: icon("plus", { size: 13 }) }), "Tambah Named Range"]);
    addBtn.addEventListener("click", () => {
      edited.namedRanges.push({ _key: generateKey("nr"), name: "range_baru", sheet: edited.sheets[0]?.name || "", range: "A2:A100" });
      onStructuralChange();
    });

    const rows = edited.namedRanges.map((nr) => {
      const nameInput = el("input", { type: "text", value: nr.name });
      nameInput.addEventListener("input", () => { nr.name = nameInput.value; });
      const sheetSelect = el("select", {}, edited.sheets.map((s) => el("option", { value: s.name, selected: s.name === nr.sheet ? "true" : undefined }, s.name)));
      sheetSelect.addEventListener("change", () => { nr.sheet = sheetSelect.value; });
      const rangeInput = el("input", { type: "text", value: nr.range, placeholder: "A2:A100" });
      rangeInput.addEventListener("input", () => { nr.range = rangeInput.value; });
      const deleteBtn = el("button", { class: "icon-btn icon-btn--sm icon-btn--danger" }, [el("span", { html: icon("trash", { size: 13 }) })]);
      deleteBtn.addEventListener("click", () => { edited.namedRanges = edited.namedRanges.filter((x) => x !== nr); onStructuralChange(); });
      return el("tr", {}, [el("td", {}, nameInput), el("td", {}, sheetSelect), el("td", {}, rangeInput), el("td", { class: "cell-actions" }, deleteBtn)]);
    });

    return el("div", { class: "card" }, [
      el("div", { class: "schema-section-heading" }, [
        el("span", { class: "schema-section-heading__icon", html: icon("book-open", { size: 14 }) }),
        el("h3", {}, "Named Ranges"),
      ]),
      el("p", { class: "field__hint" }, "Dipakai sebagai sumber dropdown/VLOOKUP di Google Sheets — opsional, tambahkan hanya jika Anda butuh."),
      edited.namedRanges.length
        ? el("table", { class: "data-table" }, [el("thead", {}, el("tr", {}, ["Nama", "Sheet", "Range", ""].map((h) => el("th", {}, h)))), el("tbody", {}, rows)])
        : el("p", { class: "muted schema-empty-hint" }, "Belum ada named range."),
      addBtn,
    ]);
  }

  function renderEditor() {
    clear(bodyHost);

    function onStructuralChange() { renderEditor(); }

    const openSheetBtn = el("a", {
      class: "btn btn--ghost", href: `https://docs.google.com/spreadsheets/d/${state.activeSpreadsheet.id}/edit`,
      target: "_blank", rel: "noopener",
    }, [el("span", { html: icon("external-link", { size: 14 }) }), "Buka Google Sheets"]);
    const reloadBtn = el("button", { class: "btn btn--ghost" }, [el("span", { html: icon("history", { size: 14 }) }), "Muat Ulang dari Google Sheets"]);
    reloadBtn.addEventListener("click", () => {
      if (!confirm("Semua editan yang belum diterapkan akan hilang dan diganti dengan struktur terbaru dari Google Sheets. Lanjutkan?")) return;
      loadSchema();
    });
    const applyBtn = el("button", { class: "btn btn--primary" }, [el("span", { html: icon("check", { size: 14 }) }), "Terapkan Perubahan ke Google Sheets"]);

    bodyHost.append(
      el("div", { class: "toolbar schema-editor-toolbar card" }, [openSheetBtn, reloadBtn, el("div", { class: "toolbar__spacer" }), applyBtn])
    );

    // Navigasi cepat antar sheet + tombol ciutkan/perluas semua — berguna terutama
    // di desktop saat spreadsheet punya banyak sheet dan halaman jadi panjang.
    if (edited.sheets.length > 1) {
      const navPills = edited.sheets.map((sheet) =>
        el("button", { class: "schema-nav-pill", type: "button", onClick: () => {
          if (collapsedSheets.has(sheet._key)) {
            collapsedSheets.delete(sheet._key);
            onStructuralChange();
          }
          document.getElementById(`schema-sheet-${sheet._key}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
        }}, [
          sheet.name,
          el("span", { class: "schema-nav-pill__count" }, String(sheet.columns.length)),
        ])
      );
      const collapseAllBtn = el("button", { class: "btn btn--ghost btn--sm" }, "Ciutkan Semua");
      collapseAllBtn.addEventListener("click", () => {
        edited.sheets.forEach((s) => collapsedSheets.add(s._key));
        onStructuralChange();
      });
      const expandAllBtn = el("button", { class: "btn btn--ghost btn--sm" }, "Perluas Semua");
      expandAllBtn.addEventListener("click", () => {
        collapsedSheets.clear();
        onStructuralChange();
      });

      bodyHost.appendChild(
        el("div", { class: "schema-quick-nav" }, [
          el("div", { class: "schema-quick-nav__pills" }, navPills),
          el("div", { class: "schema-quick-nav__actions" }, [collapseAllBtn, expandAllBtn]),
        ])
      );
    }

    const resultHost = el("div", {});
    bodyHost.appendChild(resultHost);

    edited.sheets.forEach((sheet, idx) => {
      bodyHost.appendChild(renderSheetCard(sheet, idx, edited.sheets.length, onStructuralChange));
    });

    // Tombol "Tambah Sheet Baru" sengaja diletakkan di BAWAH (setelah semua kartu sheet),
    // bukan di toolbar atas — supaya tidak perlu bolak-balik scroll ke atas saat sedang
    // bekerja di bagian bawah halaman dengan banyak sheet.
    const addSheetBtn = el("button", { class: "btn btn--ghost schema-add-sheet-btn" }, [el("span", { html: icon("plus", { size: 14 }) }), "Tambah Sheet Baru"]);
    addSheetBtn.addEventListener("click", () => {
      edited.sheets.push(newSheet(edited.sheets.map((s) => s.name)));
      onStructuralChange();
    });
    bodyHost.appendChild(addSheetBtn);

    bodyHost.appendChild(renderNamedRangesSection(onStructuralChange));

    applyBtn.addEventListener("click", () => runApply(resultHost));
  }

  async function runApply(resultHost) {
    const diff = schemaDiffService.compute(original, edited);

    const proceed = () => doApply(resultHost);

    if (diff.hasDestructive) {
      clear(resultHost);
      const warningItems = [];
      diff.deletedSheets.forEach((s) => warningItems.push(`Sheet "${s.name}" beserta seluruh isinya akan DIHAPUS PERMANEN.`));
      diff.columnChanges.forEach((c) => {
        c.deletedCols.forEach((col) => warningItems.push(`Kolom "${col.name}" di sheet "${c.sheetName}" akan DIHAPUS PERMANEN (data ikut hilang).`));
      });

      const confirmCheck = el("input", { type: "checkbox", id: "confirm-destructive" });
      const confirmApplyBtn = el("button", { class: "btn btn--primary", disabled: "true" }, "Ya, Terapkan Sekarang");
      confirmCheck.addEventListener("change", () => { confirmApplyBtn.disabled = !confirmCheck.checked; });
      confirmApplyBtn.addEventListener("click", proceed);

      resultHost.appendChild(
        el("div", { class: "card warning-panel" }, [
          el("h4", {}, "⚠️ Perubahan ini akan menghapus data"),
          el("ul", { class: "recommendation-list" }, warningItems.map((w) => el("li", {}, w))),
          el("label", { class: "field field--inline" }, [confirmCheck, el("span", {}, "Saya paham data terkait akan hilang permanen")]),
          confirmApplyBtn,
        ])
      );
    } else {
      doApply(resultHost);
    }
  }

  async function doApply(resultHost) {
    clear(resultHost);
    const progressLabel = el("span", {}, "Menerapkan perubahan...");
    resultHost.appendChild(el("div", { class: "card progress-panel" }, [el("span", { class: "spinner" }), progressLabel]));

    let applyResult;
    try {
      applyResult = await schemaSyncService.apply(state.activeSpreadsheet.id, original, edited, (p) => { progressLabel.textContent = p.label; });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[Schema Editor] Gagal menerapkan perubahan:", err);
      clear(resultHost);
      resultHost.appendChild(
        el("div", { class: "card error-state-panel" }, [
          el("p", { class: "error-state" }, `Gagal menerapkan perubahan: ${err?.message || String(err) || "Error tidak diketahui (lihat Console browser untuk detail)."}`),
          el("button", { class: "btn btn--ghost", onClick: () => runApply(resultHost) }, "Coba Lagi"),
        ])
      );
      showToast("Gagal menerapkan perubahan struktur", "error");
      return;
    }

    const refreshed = applyResult?.blueprint;
    const warnings = applyResult?.warnings || [];

    if (!refreshed || !Array.isArray(refreshed.sheets)) {
      // eslint-disable-next-line no-console
      console.error("[Schema Editor] Bentuk hasil apply() tidak sesuai dugaan:", applyResult);
      clear(resultHost);
      resultHost.appendChild(el("p", { class: "error-state" }, "Perubahan mungkin sudah tersimpan, tapi terjadi kesalahan internal saat memuat hasilnya. Silakan klik \"Muat Ulang dari Google Sheets\"."));
      showToast("Gagal memuat ulang struktur setelah menyimpan", "error");
      return;
    }

    // Perubahan sudah TERSIMPAN di Google Sheets di titik ini. Re-render halaman
    // dipisah ke try/catch sendiri supaya kalau ada bug saat menampilkan ulang,
    // pesan errornya tidak "hilang" ke elemen yang sudah tidak ada di halaman.
    try {
      original = refreshed;
      edited = deepClone(refreshed);
      renderEditor();

      if (warnings.length > 0) {
        showToast(`Perubahan diterapkan, tapi ${warnings.length} bagian gagal — lihat detail di halaman`, "error");
        const warnHost = el("div", { class: "card warning-panel" }, [
          el("h4", {}, "⚠️ Sebagian perubahan gagal diterapkan"),
          el("ul", { class: "recommendation-list" }, warnings.map((w) => el("li", {}, w))),
          el("p", { class: "muted" }, "Bagian lain yang tidak disebutkan di atas sudah berhasil tersimpan. Coba \"Terapkan Perubahan\" lagi untuk mencoba ulang bagian yang gagal."),
        ]);
        bodyHost.insertBefore(warnHost, bodyHost.children[1] || null);
      } else {
        showToast("Struktur database berhasil diperbarui", "success");
      }
    } catch (renderErr) {
      // eslint-disable-next-line no-console
      console.error("[Schema Editor] Perubahan tersimpan, tapi gagal menampilkan ulang halaman:", renderErr);
      showToast("Perubahan tersimpan, tapi halaman gagal dimuat ulang — silakan refresh halaman", "error");
    }
  }

  await loadSchema();
  return container;
}
