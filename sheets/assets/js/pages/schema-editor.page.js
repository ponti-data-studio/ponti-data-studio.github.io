import { el, clear } from "../utils/dom.util.js";
import { icon } from "../components/icons.component.js";
import { appState } from "../controllers/app-state.js";
import { BLUEPRINT_COLUMN_TYPES, AI_PROVIDERS } from "../config/app.config.js";
import { generateKey } from "../models/blueprint.model.js";
import { schemaReaderService } from "../services/schema-reader.service.js";
import { schemaDiffService } from "../services/schema-diff.service.js";
import { schemaSyncService } from "../services/schema-sync.service.js";
import { googleAuthService } from "../services/google-auth.service.js";
import { settingsService } from "../services/settings.service.js";
import { createAIAdapter } from "../adapters/adapter-factory.js";
import { redesignPromptService } from "../services/redesign-prompt.service.js";
import { redesignParserService } from "../services/redesign-parser.service.js";
import { applySimpleSuggestion, applySplitSheetSuggestion } from "../services/redesign-apply.service.js";
import { createFloatingWindow } from "../components/floating-window.component.js";
import { showToast } from "../components/toast.component.js";

function newTriState(value = "unknown", condition = null) {
  return { value, condition };
}

function newColumn() {
  return {
    _key: generateKey("col"), name: "kolom_baru", label: "kolom_baru", description: "",
    type: "text",
    required: newTriState(), editable: newTriState(), show: newTriState(),
    isPrimaryKey: false, isForeignKey: false,
    referencesSheet: null, referencesColumn: null, defaultValue: null,
    formula: null, formulaIsLive: false,
    validation: null, sampleData: [],
  };
}

function newSheet(existingNames) {
  let name = "Sheet_Baru";
  let n = 1;
  while (existingNames.includes(name)) { n += 1; name = `Sheet_Baru_${n}`; }
  return {
    _key: generateKey("sheet"), name, description: "", tabColor: "#6366F1", freezeRow: 1, filter: true,
    columns: [{ ...newColumn(), name: "id", label: "id", isPrimaryKey: true, required: newTriState("true") }],
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

/**
 * Field tri-state ("Unknown" / "TRUE" / "FALSE") + keterangan kondisional opsional
 * yang cuma muncul kalau nilainya TRUE — dipakai untuk Required, Editable, dan Show.
 * Default "Unknown" berarti AI yang menyimpulkan sendiri saat membangun aplikasi.
 * Kalau TRUE dan keterangan diisi (mis. "Wajib jika kondisi A = TRUE"), berarti TRUE
 * bersyarat; kalau keterangan kosong, berarti TRUE mutlak/tanpa syarat.
 */
function triStateField(col, fieldName, exampleText) {
  if (!col[fieldName]) col[fieldName] = newTriState();
  const current = col[fieldName];

  const select = el("select", {}, [
    el("option", { value: "unknown", selected: current.value === "unknown" ? "true" : undefined }, "Unknown (AI menentukan)"),
    el("option", { value: "true", selected: current.value === "true" ? "true" : undefined }, "TRUE"),
    el("option", { value: "false", selected: current.value === "false" ? "true" : undefined }, "FALSE"),
  ]);
  const condInput = el("input", {
    type: "text",
    placeholder: `Keterangan opsional, mis: "${exampleText}"`,
    value: current.condition || "",
    style: current.value === "true" ? "" : "display:none",
  });

  select.addEventListener("change", () => {
    col[fieldName] = newTriState(select.value, select.value === "true" ? (condInput.value.trim() || null) : null);
    condInput.style.display = select.value === "true" ? "" : "none";
  });
  condInput.addEventListener("input", () => {
    col[fieldName].condition = condInput.value.trim() || null;
  });

  return el("div", { class: "cell-stack tri-state-field" }, [select, condInput]);
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

  // "Minta Saran AI" — state modal-nya sengaja disimpan DI SINI (bukan di dalam
  // renderEditor()) supaya bertahan utuh lintas re-render halaman (mis. saat
  // pengguna reorder kolom sementara modal saran masih terbuka).
  let redesignState = null; // { suggestions, appliedIds, manualCheckedIds, terapkanClicked, selesaiClicked }
  let redesignWindowCtrl = null;
  // Referensi tombol toolbar "Minta Saran AI"/"Buka Kotak Saran" YANG SEDANG AKTIF —
  // diperbarui setiap renderEditor() berjalan. Disimpan di sini (bukan lokal di dalam
  // renderEditor()) supaya fungsi di luar (mis. setelah fetch AI selesai) tetap bisa
  // memperbarui label tombol yang BENAR-BENAR sedang tampil di halaman saat itu, tanpa
  // menunggu render ulang penuh lebih dulu.
  let aiSuggestBtnRef = null;

  function updateAiSuggestBtnLabel() {
    if (!aiSuggestBtnRef) return;
    clear(aiSuggestBtnRef);
    aiSuggestBtnRef.append(
      el("span", { html: icon("wand-sparkle", { size: 14 }) }),
      document.createTextNode(redesignState ? " Buka Kotak Saran" : " Minta Saran AI")
    );
  }

  /** Re-render seluruh halaman sambil mempertahankan posisi scroll — dipakai
   *  sebagai satu-satunya sumber kebenaran untuk "onStructuralChange", supaya
   *  kode di luar renderEditor() (mis. modal Saran AI) tetap bisa memicu
   *  render ulang tanpa perlu closure yang berpotensi basi. */
  function triggerRerender() {
    const scrollY = window.scrollY;
    renderEditor();
    window.scrollTo(0, scrollY);
  }

  const IMPACT_WEIGHT = { high: 0, medium: 1, low: 2 };
  const IMPACT_LABEL = { high: "Prioritas Tinggi", medium: "Prioritas Sedang", low: "Prioritas Rendah" };

  /** Buka (atau bikin baru) jendela mengambang "Saran Perbaikan AI". Kalau
   *  belum pernah ada saran sama sekali, langsung minta ke AI; kalau sudah
   *  ada dari sebelumnya, tampilkan lagi tanpa perlu minta ulang. */
  function openRedesignWindow() {
    const ctrl = createFloatingWindow({
      title: "Saran Perbaikan AI",
      iconName: "wand-sparkle",
      initialWidth: 640,
      initialHeight: 640,
      canClose: () => {
        // Digerbang cuma untuk jalur "tidak sengaja" (Esc) — tombol X di titlebar
        // SELALU bisa menutup terlepas dari status ini (lihat floating-window.component.js).
        if (!redesignState) return true; // belum ada apa-apa yang perlu "dijaga"
        const needsTerapkan = redesignState.suggestions.some((s) => s.action && s.action.type !== "split_sheet");
        const needsSelesai = redesignState.suggestions.some((s) => !s.action);
        const terapkanOk = !needsTerapkan || redesignState.terapkanClicked;
        const selesaiOk = !needsSelesai || redesignState.selesaiClicked;
        return terapkanOk && selesaiOk;
      },
      onClose: (reason) => {
        redesignWindowCtrl = null;
        // Minimize cuma menyembunyikan sementara — state HARUS tetap utuh supaya
        // "Buka Kotak Saran" membukanya lagi persis dari kondisi terakhir. Hanya
        // penutupan sungguhan (✕, atau auto-close setelah kedua tombol Terapkan
        // & Selesai diklik) yang dianggap "sesi ini selesai" dan boleh direset.
        if (reason === "minimize") return;
        redesignState = null;
        updateAiSuggestBtnLabel();
      },
    });
    redesignWindowCtrl = ctrl;
    document.body.appendChild(ctrl.root);

    if (redesignState) {
      renderRedesignContent(ctrl);
    } else {
      fetchAndRenderSuggestions(ctrl);
    }
  }

  async function fetchAndRenderSuggestions(ctrl) {
    clear(ctrl.bodyHost);
    ctrl.bodyHost.appendChild(
      el("div", { class: "progress-panel" }, [el("span", { class: "spinner" }), el("span", {}, "AI sedang menganalisis struktur database Anda...")])
    );
    try {
      const settings = await settingsService.get();
      const providerId = settings.activeProvider;
      if (!settings.apiKeys[providerId]) {
        throw new Error(`API Key untuk ${AI_PROVIDERS[providerId].label} belum diisi. Buka menu Settings terlebih dahulu.`);
      }
      const prompt = redesignPromptService.build(edited);
      const adapter = createAIAdapter(providerId, {
        apiKey: settings.apiKeys[providerId],
        model: settings.models[providerId] || AI_PROVIDERS[providerId].defaultModel,
      });
      const result = await adapter.complete(prompt);
      const suggestions = redesignParserService.parse(result.text);

      redesignState = {
        suggestions, appliedIds: new Set(), manualCheckedIds: new Set(),
        terapkanClicked: false, selesaiClicked: false,
      };
      updateAiSuggestBtnLabel();
      renderRedesignContent(ctrl);
    } catch (err) {
      clear(ctrl.bodyHost);
      ctrl.bodyHost.appendChild(
        el("div", { class: "error-state-panel" }, [
          el("p", { class: "error-state" }, err.message),
          el("button", { class: "btn btn--ghost", onClick: () => fetchAndRenderSuggestions(ctrl) }, "Coba Lagi"),
        ])
      );
      showToast("Gagal mendapatkan saran AI", "error");
    }
  }

  /** Render isi jendela saran: dipisah jelas jadi "Bisa Diperbaiki Otomatis"
   *  dan "Perlu Anda Perbaiki Manual", diurutkan dari prioritas tertinggi,
   *  dengan bahasa yang mudah dipahami orang awam. */
  function renderRedesignContent(ctrl) {
    clear(ctrl.bodyHost);

    if (!redesignState.suggestions.length) {
      ctrl.bodyHost.append(
        el("p", {}, "AI tidak menemukan hal signifikan yang perlu diperbaiki — struktur database Anda sudah cukup baik. 👍"),
        el("button", { class: "btn btn--ghost", onClick: () => fetchAndRenderSuggestions(ctrl) }, [el("span", { html: icon("wand-sparkle", { size: 13 }) }), "Minta Saran Ulang"])
      );
      return;
    }

    const sorted = [...redesignState.suggestions].sort((a, b) => IMPACT_WEIGHT[a.impact] - IMPACT_WEIGHT[b.impact]);
    const automated = sorted.filter((s) => s.action && s.action.type !== "split_sheet");
    const splits = sorted.filter((s) => s.action?.type === "split_sheet");
    const manual = sorted.filter((s) => !s.action);

    ctrl.bodyHost.appendChild(
      el("div", { class: "redesign-intro" }, [
        el("p", {}, `AI menemukan ${redesignState.suggestions.length} saran untuk struktur database Anda, sudah diurutkan dari yang paling penting.`),
        el("p", { class: "muted" }, "Bagian \"Bisa Diperbaiki Otomatis\" akan langsung dikerjakan Ponti Sheets. Bagian \"Perlu Anda Perbaiki Manual\" perlu Anda kerjakan sendiri (biasanya langsung di Google Sheets) — centang kotaknya satu per satu setelah selesai mengerjakannya."),
      ])
    );

    function suggestionCard({ s, right }) {
      return el("div", { class: `redesign-card redesign-card--${s.impact}` }, [
        el("div", { class: "redesign-card__top" }, [
          el("span", { class: `badge ai-suggestion__impact ai-suggestion__impact--${s.impact}` }, IMPACT_LABEL[s.impact] || s.impact),
          el("strong", {}, s.title),
        ]),
        el("p", { class: "redesign-card__reason" }, s.reason),
        right,
      ]);
    }

    // ---- Bagian Otomatis ----
    const autoItemsCount = automated.length + splits.length;
    if (autoItemsCount > 0) {
      const autoSection = el("div", { class: "redesign-section" }, [
        el("h4", { class: "redesign-section__title redesign-section__title--auto" }, [
          el("span", { html: icon("check", { size: 13 }) }), `Bisa Diperbaiki Otomatis (${autoItemsCount})`,
        ]),
        el("p", { class: "field__hint" }, "Centang yang Anda mau, lalu klik tombol \"Terapkan\" di bawah — perubahan langsung masuk ke tabel kolom, dan baru benar-benar tersimpan ke Google Sheets setelah Anda klik \"Terapkan Perubahan ke Google Sheets\" seperti biasa."),
      ]);

      automated.forEach((s) => {
        const isApplied = redesignState.appliedIds.has(s.id);
        const checkbox = el("input", { type: "checkbox", checked: isApplied ? undefined : "true", disabled: isApplied ? "true" : undefined });
        checkbox.dataset.suggestionId = s.id;
        checkbox.classList.add("redesign-auto-checkbox");
        const rightSide = isApplied
          ? el("span", { class: "redesign-card__applied" }, [el("span", { html: icon("check", { size: 12 }) }), "Sudah diterapkan"])
          : el("label", { class: "redesign-card__checklabel" }, [checkbox, "Terapkan saran ini"]);
        autoSection.appendChild(suggestionCard({ s, right: rightSide }));
      });

      splits.forEach((s) => {
        const isApplied = redesignState.appliedIds.has(s.id);
        const splitBtn = el("button", { class: "btn btn--primary btn--sm", disabled: isApplied ? "true" : undefined }, isApplied ? "Sudah Diterapkan" : "Terapkan Split Ini Sekarang");
        if (!isApplied) {
          splitBtn.addEventListener("click", async () => {
            if (!confirm(`Ini akan MEMBUAT SHEET BARU "${s.action.newSheetName}" dan MENULIS ULANG data di sheet "${s.action.sourceSheet}" secara LANGSUNG ke Google Sheets (bukan cuma editan lokal). Pastikan Anda sudah menerapkan/menyimpan editan lain sebelumnya. Lanjutkan?`)) return;
            splitBtn.disabled = true;
            splitBtn.textContent = "Memproses...";
            try {
              const sourceSheetMeta = edited.sheets.find((sh) => sh.name === s.action.sourceSheet);
              if (!sourceSheetMeta) throw new Error(`Sheet "${s.action.sourceSheet}" tidak ditemukan.`);
              const res = await applySplitSheetSuggestion(state.activeSpreadsheet.id, sourceSheetMeta, s.action);
              redesignState.appliedIds.add(s.id);
              showToast(`Sheet "${res.createdSheetName}" berhasil dibuat dengan ${res.rowCount} baris unik`, "success");
              await loadSchema(); // ini me-render ulang halaman utama (toolbar, tabel kolom, dst)
              renderRedesignContent(ctrl); // jendela saran yang SAMA cukup di-refresh isinya, bukan dibuka baru
            } catch (err) {
              showToast(`Gagal menerapkan split: ${err.message}`, "error");
              splitBtn.disabled = false;
              splitBtn.textContent = "Terapkan Split Ini Sekarang";
            }
          });
        }
        autoSection.appendChild(suggestionCard({
          s,
          right: el("div", {}, [
            el("p", { class: "field__hint" }, `Pindahkan kolom: ${s.action.extractColumns.join(", ")} → sheet baru "${s.action.newSheetName}". Ini langsung menulis ke Google Sheets (tidak ditahan sebagai editan biasa).`),
            splitBtn,
          ]),
        }));
      });

      ctrl.bodyHost.appendChild(autoSection);
    }

    // ---- Bagian Manual ----
    if (manual.length > 0) {
      const manualSection = el("div", { class: "redesign-section" }, [
        el("h4", { class: "redesign-section__title redesign-section__title--manual" }, [
          el("span", { html: icon("alert", { size: 13 }) }), `Perlu Anda Perbaiki Manual (${manual.length})`,
        ]),
        el("p", { class: "field__hint" }, "Ini tidak bisa dikerjakan otomatis karena berisiko kalau salah — perlu keputusan Anda. Kerjakan sendiri (biasanya langsung di Google Sheets), lalu centang kotaknya sebagai tanda sudah selesai."),
      ]);

      manual.forEach((s) => {
        const isChecked = redesignState.manualCheckedIds.has(s.id);
        const checkbox = el("input", { type: "checkbox", checked: isChecked ? "true" : undefined });
        const textWrap = el("div", { class: `redesign-manual__text${isChecked ? " redesign-manual__text--done" : ""}` }, [
          el("strong", {}, s.title),
          el("p", { class: "redesign-card__reason" }, s.reason),
        ]);
        checkbox.addEventListener("change", () => {
          if (checkbox.checked) redesignState.manualCheckedIds.add(s.id);
          else redesignState.manualCheckedIds.delete(s.id);
          textWrap.classList.toggle("redesign-manual__text--done", checkbox.checked);
          updateSelesaiState();
        });
        manualSection.appendChild(
          el("label", { class: `redesign-card redesign-card--${s.impact} redesign-card--manual` }, [
            el("div", { class: "redesign-card__top" }, [
              el("span", { class: `badge ai-suggestion__impact ai-suggestion__impact--${s.impact}` }, IMPACT_LABEL[s.impact] || s.impact),
              checkbox,
              el("span", { class: "field__hint" }, "Sudah saya kerjakan"),
            ]),
            textWrap,
          ])
        );
      });

      ctrl.bodyHost.appendChild(manualSection);
    }

    // ---- Footer: dua tombol (Terapkan & Selesai) ----
    const terapkanBtn = el("button", {
      class: "btn btn--primary",
      disabled: (redesignState.terapkanClicked || autoItemsCount === 0) ? "true" : undefined,
    }, redesignState.terapkanClicked ? [el("span", { html: icon("check", { size: 13 }) }), " Sudah Diterapkan"] : "Terapkan (Otomatis)");
    const selesaiBtn = el("button", { class: "btn btn--ghost" }, redesignState.selesaiClicked ? [el("span", { html: icon("check", { size: 13 }) }), " Sudah Ditandai Selesai"] : "Selesai (Manual)");

    function updateSelesaiState() {
      // Sengaja TIDAK mensyaratkan semua kotak manual harus dicentang dulu —
      // pengguna boleh menekan "Selesai" kapan saja untuk menandai sesi ini
      // sudah ditindaklanjuti, walau belum semua item manual ia kerjakan.
      selesaiBtn.disabled = redesignState.selesaiClicked;
    }
    updateSelesaiState();

    function maybeAutoClose() {
      const needsTerapkan = automated.length > 0;
      const needsSelesai = manual.length > 0;
      const terapkanOk = !needsTerapkan || redesignState.terapkanClicked;
      const selesaiOk = !needsSelesai || redesignState.selesaiClicked;
      if (terapkanOk && selesaiOk) {
        showToast("Semua saran sudah ditindaklanjuti", "success");
        ctrl.closeForce();
      }
    }

    terapkanBtn.addEventListener("click", () => {
      let count = 0;
      ctrl.bodyHost.querySelectorAll(".redesign-auto-checkbox").forEach((checkbox) => {
        if (!checkbox.checked) return;
        const s = automated.find((x) => x.id === checkbox.dataset.suggestionId);
        if (!s || redesignState.appliedIds.has(s.id)) return;
        if (applySimpleSuggestion(edited, s.action)) {
          redesignState.appliedIds.add(s.id);
          count += 1;
        }
      });
      // Sekali diklik, langsung dikunci — tidak bisa diklik ulang berkali-kali,
      // menandakan dengan jelas "bagian ini sudah ditindaklanjuti".
      redesignState.terapkanClicked = true;
      terapkanBtn.disabled = true;
      showToast(
        count > 0
          ? `${count} saran diterapkan ke editan — jangan lupa klik "Terapkan Perubahan ke Google Sheets" untuk menyimpannya`
          : "Tidak ada saran yang dicentang untuk diterapkan",
        count > 0 ? "success" : "info"
      );
      triggerRerender();
      renderRedesignContent(ctrl);
      maybeAutoClose();
    });

    selesaiBtn.addEventListener("click", () => {
      if (manual.length === 0) {
        showToast("Tidak ada saran manual untuk ditandai", "info");
      } else {
        showToast("Perbaikan manual ditandai selesai", "success");
      }
      // Sekali diklik, langsung dikunci — sama seperti tombol Terapkan.
      redesignState.selesaiClicked = true;
      selesaiBtn.disabled = true;
      maybeAutoClose();
    });

    ctrl.bodyHost.appendChild(
      el("div", { class: "redesign-footer" }, [
        el("p", { class: "field__hint redesign-footer__hint" }, "Sudah selesai menerapkan yang otomatis dan mengerjakan yang manual? Klik kedua tombol di bawah ini — jendela ini akan tertutup sendiri kalau semuanya sudah beres."),
        el("div", { class: "redesign-footer__actions" }, [terapkanBtn, selesaiBtn]),
      ])
    );
  }

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

    // ---- Required / Editable / Show (tri-state + keterangan kondisional) ----
    const requiredField = triStateField(col, "required", "Wajib jika kondisi A = TRUE");
    const editableField = triStateField(col, "editable", "Edit ini jika kondisi A = TRUE");
    const showField = triStateField(col, "show", "Tampilkan jika kondisi A = TRUE");

    // ---- Formula ----
    const formulaInput = el("input", { type: "text", placeholder: "kosongkan jika bukan kolom formula", value: col.formula || "" });

    const formulaLiveCheck = el("input", {
      type: "checkbox",
      checked: (col.formula && col.formulaIsLive !== false) ? "true" : undefined,
      disabled: col.formula ? undefined : "true",
    });
    formulaLiveCheck.addEventListener("change", () => { col.formulaIsLive = formulaLiveCheck.checked; });

    formulaInput.addEventListener("input", () => {
      const wasEmpty = !col.formula;
      col.formula = formulaInput.value.trim() || null;

      if (!col.formula) {
        // Tidak ada formula -> checkbox "Formula aktif" WAJIB tidak tercentang & terkunci,
        // tidak masuk akal ada formula "aktif" tanpa formulanya.
        formulaLiveCheck.checked = false;
        formulaLiveCheck.disabled = true;
        col.formulaIsLive = false;
      } else {
        formulaLiveCheck.disabled = false;
        if (wasEmpty) {
          // Formula baru saja diisi (dari kosong) -> otomatis dicentang aktif
          formulaLiveCheck.checked = true;
          col.formulaIsLive = true;
        }
      }
    });

    const formulaLiveLabel = el("label", {
      class: "formula-live-toggle",
      title: "Dicentang: formula sungguhan ditulis (nilai ikut berubah otomatis). Tidak dicentang: hasil hitungannya saja yang disimpan sebagai nilai tetap. Tidak bisa dicentang kalau belum ada formula.",
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
      el("td", { class: "tri-cell", "data-label": "Required" }, requiredField),
      el("td", { class: "tri-cell", "data-label": "Editable" }, editableField),
      el("td", { class: "tri-cell", "data-label": "Show" }, showField),
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
      el("p", { class: "field__hint schema-column-hint" }, "Geser ikon ⠿ untuk mengurutkan ulang kolom, atau pakai tombol ↑/↓. Required/Editable/Show: pilih \"Unknown\" supaya AI yang menyimpulkan sendiri, atau tentukan manual + keterangan opsional (mis. \"Wajib jika kondisi A = TRUE\")."),
      el("div", { class: "schema-column-table-wrap" }, [
        el("table", { class: "data-table schema-column-table" }, [
          el("thead", {}, el("tr", {}, ["Nama", "Tipe", "PK", "FK", "Required", "Editable", "Show", "Formula", "Validasi", ""].map((h) => el("th", {}, h)))),
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

    // #7: setiap perubahan struktural (tambah/hapus sheet/kolom, dll) me-render ulang
    // seluruh halaman — tanpa ini, browser cenderung scroll balik ke atas karena DOM-nya
    // dibangun ulang dari nol. triggerRerender() (didefinisikan di luar) yang menangani
    // simpan & kembalikan posisi scroll-nya.
    const onStructuralChange = triggerRerender;

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
    const aiSuggestBtn = el("button", { class: "btn btn--ghost" });
    aiSuggestBtnRef = aiSuggestBtn;
    updateAiSuggestBtnLabel();
    aiSuggestBtn.addEventListener("click", () => {
      // "Modal saran hanya boleh satu" — kalau sudah ada yang terbuka, jangan buat
      // baru; cukup beri highlight sekilas supaya pengguna sadar sudah ada.
      if (redesignWindowCtrl && redesignWindowCtrl.isOpen()) {
        redesignWindowCtrl.flash();
        return;
      }
      openRedesignWindow();
    });

    bodyHost.append(
      el("div", { class: "toolbar schema-editor-toolbar card" }, [openSheetBtn, reloadBtn, aiSuggestBtn, el("div", { class: "toolbar__spacer" }), applyBtn])
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

    applyBtn.addEventListener("click", () => runApply(resultHost, applyBtn));
  }

  function runApply(resultHost, applyBtn) {
    const diff = schemaDiffService.compute(original, edited);

    const proceed = (confirmBtn) => {
      confirmBtn.disabled = true;
      doApply(resultHost, applyBtn);
    };

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
      confirmApplyBtn.addEventListener("click", () => proceed(confirmApplyBtn));

      resultHost.appendChild(
        el("div", { class: "card warning-panel" }, [
          el("h4", {}, "⚠️ Perubahan ini akan menghapus data"),
          el("ul", { class: "recommendation-list" }, warningItems.map((w) => el("li", {}, w))),
          el("label", { class: "field field--inline" }, [confirmCheck, el("span", {}, "Saya paham data terkait akan hilang permanen")]),
          confirmApplyBtn,
        ])
      );
    } else {
      doApply(resultHost, applyBtn);
    }
  }

  async function doApply(resultHost, applyBtn) {
    // #1: kunci tombol Apply + tampilkan loading selagi proses berjalan, supaya
    // tidak bisa diklik dua kali sebelum selesai menyimpan perubahan.
    applyBtn.disabled = true;
    const applyBtnOriginalHtml = applyBtn.innerHTML;
    clear(applyBtn);
    applyBtn.append(el("span", { class: "spinner" }), el("span", {}, "Menerapkan..."));

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
          el("button", { class: "btn btn--ghost", onClick: () => runApply(resultHost, applyBtn) }, "Coba Lagi"),
        ])
      );
      showToast("Gagal menerapkan perubahan struktur", "error");
      applyBtn.disabled = false;
      applyBtn.innerHTML = applyBtnOriginalHtml;
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
      applyBtn.disabled = false;
      applyBtn.innerHTML = applyBtnOriginalHtml;
      return;
    }

    // Perubahan sudah TERSIMPAN di Google Sheets di titik ini. Re-render halaman
    // dipisah ke try/catch sendiri supaya kalau ada bug saat menampilkan ulang,
    // pesan errornya tidak "hilang" ke elemen yang sudah tidak ada di halaman.
    // (renderEditor() akan membuat instance applyBtn yang baru & fresh, jadi tombol
    // lama yang sedang loading ini tidak perlu direset manual lagi di jalur sukses.)
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
