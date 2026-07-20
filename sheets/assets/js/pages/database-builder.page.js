import { el, clear } from "../utils/dom.util.js";
import { icon } from "../components/icons.component.js";
import { appState } from "../controllers/app-state.js";
import { AI_PROVIDERS } from "../config/app.config.js";
import { blueprintPromptService } from "../services/blueprint-prompt.service.js";
import { blueprintParserService } from "../services/blueprint-parser.service.js";
import { createAIAdapter } from "../adapters/adapter-factory.js";
import { settingsService } from "../services/settings.service.js";
import { sheetsWriterService } from "../services/sheets-writer.service.js";
import { excelWriterService } from "../services/excel-writer.service.js";
import { googleAuthService } from "../services/google-auth.service.js";
import { showToast } from "../components/toast.component.js";

function field(label, inputNode, hint) {
  return el("label", { class: "field" }, [
    el("span", { class: "field__label" }, label),
    inputNode,
    hint ? el("span", { class: "field__hint" }, hint) : null,
  ]);
}

function formatTriState(field) {
  if (!field || typeof field !== "object") return field ? "Ya" : "Tidak";
  if (field.value === "true") return field.condition ? `Ya (${field.condition})` : "Ya";
  if (field.value === "false") return "Tidak";
  return "Unknown (AI menentukan)";
}

function renderBlueprintSheetCard(sheet) {
  const rows = sheet.columns.map((c) =>
    el("tr", {}, [
      el("td", {}, c.name),
      el("td", {}, el("span", { class: "badge badge--type" }, c.type)),
      el("td", {}, [
        c.isPrimaryKey ? el("span", { class: "badge badge--pk" }, "PK") : null,
        c.isForeignKey ? el("span", { class: "badge badge--fk" }, c.referencesSheet ? `FK → ${c.referencesSheet}` : "FK") : null,
      ]),
      el("td", {}, formatTriState(c.required)),
      el("td", {}, c.formula ? el("code", {}, c.formula) : c.validation ? `Validasi: ${c.validation.type}` : "-"),
    ])
  );

  const previewRows = sheet.dummyData.slice(0, 3);
  const dummyPreview = previewRows.length
    ? el("div", { class: "sheet-card__section" }, [
        el("h4", {}, `Contoh Dummy Data (${sheet.dummyData.length} baris total)`),
        el("table", { class: "data-table" }, [
          el("thead", {}, el("tr", {}, sheet.columns.map((c) => el("th", {}, c.name)))),
          el("tbody", {}, previewRows.map((row) =>
            el("tr", {}, sheet.columns.map((c) => el("td", {}, String(row[c.name] ?? row[c.label] ?? "-"))))
          )),
        ]),
      ])
    : null;

  return el("div", { class: "card sheet-card" }, [
    el("div", { class: "sheet-card__header" }, [
      el("h3", {}, sheet.name),
      el("span", { class: "muted" }, `${sheet.columns.length} kolom · ${sheet.dummyData.length} dummy data`),
    ]),
    sheet.description ? el("p", { class: "muted" }, sheet.description) : null,
    el("table", { class: "data-table" }, [
      el("thead", {}, el("tr", {}, ["Kolom", "Tipe", "Key", "Wajib", "Formula / Validasi"].map((h) => el("th", {}, h)))),
      el("tbody", {}, rows),
    ]),
    dummyPreview,
  ]);
}

export async function renderDatabaseBuilderPage(navigate) {
  const settings = await settingsService.get();
  const container = el("div", { class: "page page--database-builder" });

  container.appendChild(el("div", { class: "page__header" }, [
    el("h2", {}, "Database Builder"),
    el("p", { class: "muted" }, '"Generate Google Sheets Database with AI" — jelaskan kebutuhan Anda, AI akan merancang struktur databasenya.'),
  ]));

  // ---- Form konfigurasi ----
  const providerSelect = el("select", {}, Object.values(AI_PROVIDERS).map((p) => el("option", { value: p.id }, p.label)));
  providerSelect.value = settings.activeProvider;
  const instructionInput = el("textarea", {
    rows: 4,
    placeholder: 'Contoh: "Buatkan struktur database lengkap untuk aplikasi POS Restoran dengan meja dan status pesanan dapur."',
  });

  const generateBtn = el("button", { class: "btn btn--primary" }, [
    el("span", { html: icon("wand-sparkle", { size: 14 }) }), "Generate Blueprint",
  ]);

  const formCard = el("div", { class: "card" }, [
    el("h3", {}, "1. Jelaskan Kebutuhan Database Anda"),
    field("AI Provider", providerSelect),
    field("Instruksi", instructionInput, 'Semakin detail instruksi Anda (jenis bisnis, data apa saja yang perlu disimpan, relasinya), semakin sesuai hasilnya.'),
    el("div", { class: "page__footer-actions" }, [generateBtn]),
  ]);
  container.appendChild(formCard);

  const resultHost = el("div", { class: "db-builder-result" });
  container.appendChild(resultHost);

  async function runGeneration(retry = false) {
    generateBtn.disabled = true;
    clear(resultHost);
    resultHost.appendChild(
      el("div", { class: "card progress-panel" }, [
        el("span", { class: "spinner" }),
        el("span", {}, retry ? "Mencoba lagi membangun blueprint..." : "AI sedang merancang struktur database Anda..."),
      ])
    );

    try {
      const providerId = providerSelect.value;
      const currentSettings = await settingsService.get();
      if (!currentSettings.apiKeys[providerId]) {
        throw new Error(`API Key untuk ${AI_PROVIDERS[providerId].label} belum diisi. Buka menu Settings terlebih dahulu.`);
      }

      const prompt = blueprintPromptService.build({
        userInstruction: instructionInput.value,
        retry,
      });

      const adapter = createAIAdapter(providerId, {
        apiKey: currentSettings.apiKeys[providerId],
        model: currentSettings.models[providerId] || AI_PROVIDERS[providerId].defaultModel,
      });
      const result = await adapter.complete(prompt);
      const { blueprint, stats } = blueprintParserService.parse(result.text);

      appState.set({ blueprint: { blueprint, stats } });
      renderResult(blueprint, stats);
      showToast("Blueprint database berhasil dibuat", "success");
    } catch (err) {
      clear(resultHost);
      resultHost.appendChild(
        el("div", { class: "card error-state-panel" }, [
          el("p", { class: "error-state" }, err.message),
          el("button", { class: "btn btn--ghost", onClick: () => runGeneration(true) }, "Coba Generate Ulang"),
        ])
      );
      showToast("Gagal membangun blueprint", "error");
    } finally {
      generateBtn.disabled = false;
    }
  }

  generateBtn.addEventListener("click", () => runGeneration(false));

  function renderResult(blueprint, stats) {
    clear(resultHost);

    resultHost.appendChild(
      el("div", { class: "card" }, [
        el("div", { class: "db-builder-summary__header" }, [
          el("div", {}, [
            el("h3", {}, blueprint.project.name),
            el("p", { class: "muted" }, blueprint.project.description || "-"),
          ]),
        ]),
        el("div", { class: "stat-grid stat-grid--compact" }, [
          statBox(stats.sheetCount, "Sheet"),
          statBox(stats.columnCount, "Kolom"),
          statBox(stats.relationshipCount, "Relasi"),
          statBox(stats.formulaCount, "Formula"),
          statBox(stats.dummyDataRowCount, "Dummy Data"),
          statBox(stats.validationCount, "Validasi"),
        ]),
      ])
    );

    const generateSheetsBtn = el("button", { class: "btn btn--primary" }, [
      el("span", { html: icon("file-spreadsheet", { size: 14 }) }), "Generate Google Sheets",
    ]);
    const generateExcelBtn = el("button", { class: "btn btn--ghost" }, [
      el("span", { html: icon("download", { size: 14 }) }), "Generate Excel (.xlsx)",
    ]);
    const regenerateBtn = el("button", { class: "btn btn--ghost" }, [
      el("span", { html: icon("wand-sparkle", { size: 14 }) }), "Generate Ulang",
    ]);

    resultHost.appendChild(
      el("div", { class: "toolbar db-builder-toolbar" }, [regenerateBtn, el("div", { class: "toolbar__spacer" }), generateExcelBtn, generateSheetsBtn])
    );

    const actionResultHost = el("div", {});
    resultHost.appendChild(actionResultHost);

    blueprint.sheets.forEach((sheet) => resultHost.appendChild(renderBlueprintSheetCard(sheet)));

    if (blueprint.businessRules.length) {
      resultHost.appendChild(
        el("div", { class: "card" }, [
          el("h4", {}, "Business Rules"),
          el("ul", { class: "recommendation-list" }, blueprint.businessRules.map((r) => el("li", {}, r))),
        ])
      );
    }
    if (blueprint.recommendations.length) {
      resultHost.appendChild(
        el("div", { class: "card" }, [
          el("h4", {}, "Rekomendasi"),
          el("ul", { class: "recommendation-list" }, blueprint.recommendations.map((r) => el("li", {}, r))),
        ])
      );
    }

    regenerateBtn.addEventListener("click", () => runGeneration(false));

    generateExcelBtn.addEventListener("click", async () => {
      generateExcelBtn.disabled = true;
      clear(actionResultHost);
      actionResultHost.appendChild(
        el("div", { class: "card progress-panel" }, [el("span", { class: "spinner" }), el("span", {}, "Menyusun file Excel...")])
      );
      try {
        await excelWriterService.generate(blueprint, (p) => {
          clear(actionResultHost);
          actionResultHost.appendChild(el("div", { class: "card progress-panel" }, [el("span", { class: "spinner" }), el("span", {}, p.label)]));
        });
        clear(actionResultHost);
        actionResultHost.appendChild(
          el("div", { class: "card success-panel" }, [
            el("span", { html: icon("check", { size: 18 }) }),
            el("span", {}, "File Excel (.xlsx) berhasil diunduh. Anda bisa mengimpornya ke Google Sheets kapan saja lalu menganalisisnya di menu Spreadsheet."),
          ])
        );
        showToast("File Excel berhasil dibuat", "success");
      } catch (err) {
        clear(actionResultHost);
        actionResultHost.appendChild(el("p", { class: "error-state" }, err.message));
        showToast("Gagal membuat file Excel", "error");
      } finally {
        generateExcelBtn.disabled = false;
      }
    });

    generateSheetsBtn.addEventListener("click", async () => {
      const session = await googleAuthService.getSession();
      if (!session) {
        showToast("Silakan login dengan Google terlebih dahulu (menu Spreadsheet)", "error");
        return;
      }

      generateSheetsBtn.disabled = true;
      clear(actionResultHost);
      const progressLabel = el("span", {}, "Membuat spreadsheet...");
      actionResultHost.appendChild(el("div", { class: "card progress-panel" }, [el("span", { class: "spinner" }), progressLabel]));

      try {
        const { spreadsheetId, spreadsheetUrl } = await sheetsWriterService.generate(blueprint, (p) => {
          progressLabel.textContent = p.label;
        });

        clear(actionResultHost);
        actionResultHost.appendChild(
          el("div", { class: "card success-panel" }, [
            el("span", { html: icon("check", { size: 18 }) }),
            el("div", {}, [
              el("div", {}, "Spreadsheet berhasil dibuat di Google Sheets Anda."),
              el("div", { class: "success-panel__actions" }, [
                el("a", { href: spreadsheetUrl, target: "_blank", rel: "noopener", class: "btn btn--ghost btn--sm" }, [
                  el("span", { html: icon("external-link", { size: 13 }) }), "Buka di Google Sheets",
                ]),
                el("button", { class: "btn btn--primary btn--sm", onClick: () => {
                  appState.set({ activeSpreadsheet: { id: spreadsheetId, name: blueprint.project.name } });
                  navigate("analysis");
                }}, "Analisis Sekarang"),
              ]),
            ]),
          ])
        );
        showToast("Spreadsheet berhasil dibuat di Google Sheets", "success");
      } catch (err) {
        clear(actionResultHost);
        actionResultHost.appendChild(el("p", { class: "error-state" }, `Gagal membuat spreadsheet: ${err.message}`));
        showToast("Gagal membuat Google Sheets", "error");
      } finally {
        generateSheetsBtn.disabled = false;
      }
    });
  }

  function statBox(value, label) {
    return el("div", { class: "card stat-card" }, [
      el("div", { class: "stat-card__value" }, String(value)),
      el("div", { class: "stat-card__label" }, label),
    ]);
  }

  // Jika sudah ada blueprint tersimpan di state (mis. user berpindah halaman lalu kembali)
  const existing = appState.get().blueprint;
  if (existing) {
    renderResult(existing.blueprint, existing.stats);
  }

  return container;
}
