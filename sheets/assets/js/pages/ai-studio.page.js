import { el, clear } from "../utils/dom.util.js";
import { icon } from "../components/icons.component.js";
import { appState } from "../controllers/app-state.js";
import { settingsService } from "../services/settings.service.js";
import { createAIAdapter } from "../adapters/adapter-factory.js";
import { historyService } from "../services/history.service.js";
import { tokenEstimatorService } from "../services/token-estimator.service.js";
import { showToast } from "../components/toast.component.js";
import { AI_PROVIDERS } from "../config/app.config.js";

function flashCopied(btn) {
  const original = btn.innerHTML;
  btn.innerHTML = `${icon("check", { size: 14 })} Disalin`;
  btn.disabled = true;
  setTimeout(() => {
    btn.innerHTML = original;
    btn.disabled = false;
  }, 1500);
}

export async function renderAIStudioPage(navigate) {
  const state = appState.get();
  const container = el("div", { class: "page page--ai-studio" });

  if (!state.lastPrompt) {
    container.appendChild(
      el("div", { class: "empty-state-panel" }, [
        el("p", {}, "Belum ada prompt yang disusun. Buka Prompt Builder terlebih dahulu."),
        el("button", { class: "btn btn--primary", onClick: () => navigate("prompt-builder") }, "Ke Prompt Builder"),
      ])
    );
    return container;
  }

  const settings = await settingsService.get();
  const providerId = state.lastPrompt.request.provider;
  const providerConfig = AI_PROVIDERS[providerId];
  const hasKey = !!settings.apiKeys[providerId];
  const modelName = settings.models[providerId] || providerConfig.defaultModel;
  const estimate = tokenEstimatorService.estimate(state.lastPrompt.text, providerId);

  container.appendChild(
    el("div", { class: "page__header ai-studio-header" }, [
      el("div", {}, [
        el("h2", {}, "AI Studio"),
        el("p", { class: "muted" }, "Generate aplikasi langsung dari Database Context Anda."),
      ]),
      el("div", { class: "ai-studio-header__meta" }, [
        el("span", { class: "provider-chip" }, [
          el("span", { html: icon("sparkles", { size: 13 }) }),
          `${providerConfig.label} · ${modelName}`,
        ]),
      ]),
    ])
  );

  if (!hasKey) {
    container.appendChild(
      el("div", { class: "card warning-panel" }, [
        el("span", { html: icon("alert", { size: 18 }) }),
        el("div", { class: "warning-panel__body" }, [
          el("div", {}, `API Key untuk ${providerConfig.label} belum diisi.`),
          el("button", { class: "btn btn--ghost btn--sm", onClick: () => navigate("settings") }, "Isi di Settings"),
        ]),
      ])
    );
  }

  // ---- Ringkasan prompt (collapsible, supaya fokus utama tetap di response) ----
  const promptToggleBtn = el("button", { class: "prompt-summary__toggle" }, [
    el("span", { html: icon("wand-2", { size: 14 }) }),
    el("span", {}, "Lihat Prompt Terkirim"),
  ]);
  const copyPromptBtn = el("button", { class: "btn btn--ghost btn--sm" }, [
    el("span", { html: icon("copy", { size: 13 }) }), "Copy Prompt",
  ]);
  const promptBody = el("pre", { class: "prompt-box" }, el("code", {}, state.lastPrompt.text));
  const promptDetails = el("div", { class: "prompt-summary__details", style: "display:none" }, [
    el("div", { class: "prompt-summary__actions" }, [copyPromptBtn]),
    promptBody,
  ]);

  copyPromptBtn.addEventListener("click", async () => {
    await navigator.clipboard.writeText(state.lastPrompt.text);
    showToast("Prompt disalin ke clipboard", "success");
    flashCopied(copyPromptBtn);
  });

  promptToggleBtn.addEventListener("click", () => {
    const isHidden = promptDetails.style.display === "none";
    promptDetails.style.display = isHidden ? "block" : "none";
    promptToggleBtn.classList.toggle("prompt-summary__toggle--open", isHidden);
  });

  container.appendChild(
    el("div", { class: "card prompt-summary" }, [
      el("div", { class: "prompt-summary__row" }, [
        promptToggleBtn,
        el("div", { class: "prompt-summary__stats" }, [
          el("span", { class: "token-chip" }, `${estimate.charCount.toLocaleString("id-ID")} karakter`),
          el("span", { class: "token-chip" }, `~${estimate.inputTokens.toLocaleString("id-ID")} token`),
          el("span", { class: "token-chip" }, `~$${estimate.estimatedCostUsd}`),
        ]),
      ]),
      promptDetails,
    ])
  );

  // ---- Kartu Response (fokus utama halaman) ----
  const generateBtn = el("button", { class: "btn btn--primary", disabled: !hasKey ? "true" : undefined }, [
    el("span", { html: icon("sparkles", { size: 14 }) }), "Generate",
  ]);
  const copyResponseBtn = el("button", { class: "btn btn--ghost btn--sm", style: "display:none" }, [
    el("span", { html: icon("copy", { size: 13 }) }), "Copy Response",
  ]);
  const responseBody = el(
    "div",
    { class: "response-body" },
    el("p", { class: "muted" }, 'Klik "Generate" untuk memanggil AI berdasarkan prompt di atas.')
  );

  const responseCard = el("div", { class: "card response-card" }, [
    el("div", { class: "response-header" }, [
      el("h3", {}, "Response AI"),
      el("div", { class: "response-header__actions" }, [copyResponseBtn, generateBtn]),
    ]),
    responseBody,
  ]);
  container.appendChild(responseCard);

  let lastResponseText = "";

  copyResponseBtn.addEventListener("click", async () => {
    await navigator.clipboard.writeText(lastResponseText);
    showToast("Response disalin ke clipboard", "success");
    flashCopied(copyResponseBtn);
  });

  generateBtn.addEventListener("click", async () => {
    generateBtn.disabled = true;
    copyResponseBtn.style.display = "none";
    clear(responseBody);
    responseBody.appendChild(
      el("div", { class: "progress-panel" }, [
        el("span", { class: "spinner" }),
        el("span", {}, `Menghubungi ${providerConfig.label}... (perkiraan ~${estimate.estimatedSeconds}s)`),
      ])
    );

    try {
      const adapter = createAIAdapter(providerId, {
        apiKey: settings.apiKeys[providerId],
        model: modelName,
      });
      const result = await adapter.complete(state.lastPrompt.text);
      lastResponseText = result.text;

      clear(responseBody);
      responseBody.appendChild(el("pre", { class: "response-text" }, el("code", {}, result.text)));
      copyResponseBtn.style.display = "inline-flex";
      generateBtn.innerHTML = `${icon("sparkles", { size: 14 })} Generate Ulang`;

      await historyService.add({
        spreadsheetName: appState.get().activeSpreadsheet?.name,
        templateId: state.lastPrompt.request.templateId,
        provider: providerId,
        prompt: state.lastPrompt.text,
        response: result.text,
        tokenEstimate: estimate.inputTokens,
      });
      showToast("Response berhasil disimpan ke History", "success");
    } catch (err) {
      clear(responseBody);
      responseBody.appendChild(el("p", { class: "error-state" }, err.message));
      showToast("Gagal memanggil AI Provider", "error");
    } finally {
      generateBtn.disabled = false;
    }
  });

  return container;
}
