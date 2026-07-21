import { el, clear } from "../utils/dom.util.js";
import { icon } from "../components/icons.component.js";
import { appState } from "../controllers/app-state.js";
import { settingsService } from "../services/settings.service.js";
import { createAIAdapter } from "../adapters/adapter-factory.js";
import { historyService } from "../services/history.service.js";
import { tokenEstimatorService } from "../services/token-estimator.service.js";
import { showToast } from "../components/toast.component.js";
import { AI_PROVIDERS } from "../config/app.config.js";
import { loadPrism, parseCodeSegments } from "../utils/syntax-highlight.util.js";

function flashCopied(btn) {
  const original = btn.innerHTML;
  btn.innerHTML = `${icon("check", { size: 14 })} Disalin`;
  btn.disabled = true;
  setTimeout(() => {
    btn.innerHTML = original;
    btn.disabled = false;
  }, 1500);
}

/** Render teks response AI dengan blok kode di-syntax-highlight (Prism.js),
 *  teks biasa di luar blok kode ditampilkan apa adanya. Prism dimuat malas
 *  (baru diunduh dari CDN begitu response pertama benar-benar butuh
 *  highlighting) supaya tidak membebani load awal halaman. */
async function renderHighlightedResponse(container, text) {
  clear(container);
  const segments = parseCodeSegments(text);

  segments.forEach((seg) => {
    if (seg.type === "code") {
      const codeEl = el("code", { class: `language-${seg.language}` }, seg.content);
      container.appendChild(el("pre", { class: "response-code-block" }, codeEl));
    } else if (seg.content.trim()) {
      container.appendChild(el("p", { class: "response-text-segment" }, seg.content));
    }
  });

  const hasCode = segments.some((s) => s.type === "code");
  if (!hasCode) return;

  try {
    const Prism = await loadPrism();
    Prism.highlightAllUnder(container);
  } catch {
    // Offline / CDN gagal dimuat — kode tetap tampil apa adanya, cuma tanpa
    // warna sintaks. Bukan kegagalan fatal, jadi sengaja tidak melempar error.
  }
}

function renderAssistantTurn(text, meta) {
  const copyBtn = el("button", { class: "btn btn--ghost btn--sm" }, [el("span", { html: icon("copy", { size: 12 }) }), "Copy"]);
  copyBtn.addEventListener("click", async () => {
    await navigator.clipboard.writeText(text);
    showToast("Response disalin ke clipboard", "success");
    flashCopied(copyBtn);
  });

  const body = el("div", { class: "response-body" });
  renderHighlightedResponse(body, text);

  return el("div", { class: "chat-turn chat-turn--assistant" }, [
    el("div", { class: "chat-turn__header" }, [
      el("span", { class: "chat-turn__label" }, [el("span", { html: icon("sparkles", { size: 12 }) }), meta ? `AI · ${meta}` : "AI"]),
      copyBtn,
    ]),
    body,
  ]);
}

function renderUserTurn(text) {
  return el("div", { class: "chat-turn chat-turn--user" }, [
    el("div", { class: "chat-turn__header" }, [el("span", { class: "chat-turn__label" }, "Anda")]),
    el("p", { class: "chat-turn__text" }, text),
  ]);
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

  // ---- Provider & Model BEBAS dipilih langsung di sini (untuk efisiensi token) ----
  // Default-nya mengikuti pilihan di Prompt Builder, tapi bisa diganti kapan saja —
  // termasuk di TENGAH percakapan (mis. mulai pakai model besar untuk generate
  // pertama, lalu pindah ke model murah untuk revisi-revisi kecil berikutnya).
  let providerId = state.lastPrompt.request.provider;
  let modelName = settings.models[providerId] || AI_PROVIDERS[providerId].defaultModel;

  container.appendChild(
    el("div", { class: "page__header ai-studio-header" }, [
      el("div", {}, [
        el("h2", {}, "AI Studio"),
        el("p", { class: "muted" }, "Generate aplikasi langsung dari Database Context Anda — bisa lanjut minta revisi tanpa mengulang dari awal."),
      ]),
    ])
  );

  const providerSelect = el("select", {}, Object.values(AI_PROVIDERS).map((p) =>
    el("option", { value: p.id, selected: p.id === providerId ? "true" : undefined }, p.label)
  ));
  const modelSelect = el("select", { class: "ai-studio-model-input" });

  const keyWarningHost = el("div", {});

  function refreshModelOptions() {
    clear(modelSelect);
    AI_PROVIDERS[providerSelect.value].models.forEach((m) =>
      modelSelect.appendChild(el("option", { value: m, selected: m === modelName ? "true" : undefined }, m))
    );
  }
  refreshModelOptions();

  function hasKeyFor(pid) { return !!settings.apiKeys[pid]; }

  function refreshKeyWarning() {
    clear(keyWarningHost);
    if (!hasKeyFor(providerId)) {
      keyWarningHost.appendChild(
        el("div", { class: "card warning-panel" }, [
          el("span", { html: icon("alert", { size: 18 }) }),
          el("div", { class: "warning-panel__body" }, [
            el("div", {}, `API Key untuk ${AI_PROVIDERS[providerId].label} belum diisi.`),
            el("button", { class: "btn btn--ghost btn--sm", onClick: () => navigate("settings") }, "Isi di Settings"),
          ]),
        ])
      );
    }
    generateBtn.disabled = !hasKeyFor(providerId);
    followUpSendBtn.disabled = !hasKeyFor(providerId) || followUpComposer.style.display === "none";
  }

  providerSelect.addEventListener("change", () => {
    providerId = providerSelect.value;
    modelName = settings.models[providerId] || AI_PROVIDERS[providerId].defaultModel;
    refreshModelOptions();
    refreshKeyWarning();
    updateEstimateDisplay();
  });
  modelSelect.addEventListener("change", () => {
    modelName = modelSelect.value || AI_PROVIDERS[providerId].defaultModel;
  });

  container.appendChild(
    el("div", { class: "card ai-studio-provider-picker" }, [
      el("div", { class: "ai-studio-provider-picker__row" }, [
        el("label", { class: "field field--inline-compact" }, [el("span", { class: "field__label" }, "AI Provider"), providerSelect]),
        el("label", { class: "field field--inline-compact" }, [el("span", { class: "field__label" }, "Model"), modelSelect]),
      ]),
      el("p", { class: "field__hint" }, "Bebas diganti kapan saja, termasuk di tengah percakapan — mis. pakai model besar untuk generate pertama, lalu model yang lebih murah untuk revisi-revisi kecil supaya hemat token."),
    ])
  );
  container.appendChild(keyWarningHost);

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

  const statsHost = el("div", { class: "prompt-summary__stats" });
  function updateEstimateDisplay() {
    const estimate = tokenEstimatorService.estimate(state.lastPrompt.text, providerId);
    clear(statsHost);
    statsHost.append(
      el("span", { class: "token-chip" }, `${estimate.charCount.toLocaleString("id-ID")} karakter`),
      el("span", { class: "token-chip" }, `~${estimate.inputTokens.toLocaleString("id-ID")} token`),
      el("span", { class: "token-chip" }, `~$${estimate.estimatedCostUsd}`),
    );
    return estimate;
  }

  container.appendChild(
    el("div", { class: "card prompt-summary" }, [
      el("div", { class: "prompt-summary__row" }, [promptToggleBtn, statsHost]),
      promptDetails,
    ])
  );
  updateEstimateDisplay();

  // ---- Riwayat Percakapan (multi-turn) ----
  // `conversation` adalah riwayat LENGKAP yang dikirim ke AI setiap kali
  // (termasuk prompt awal yang panjang) — supaya AI ingat konteks sebelumnya
  // saat pengguna minta revisi. `threadHost` cuma menampilkan turn AI +
  // pesan lanjutan pengguna (bukan prompt awal, itu sudah ada di atas).
  let conversation = [{ role: "user", content: state.lastPrompt.text }];

  const generateBtn = el("button", { class: "btn btn--primary" }, [
    el("span", { html: icon("sparkles", { size: 14 }) }), "Generate",
  ]);

  const threadHost = el("div", { class: "chat-thread" }, [
    el("p", { class: "muted" }, 'Klik "Generate" untuk memanggil AI berdasarkan prompt di atas.'),
  ]);

  const followUpInput = el("textarea", {
    rows: 2, class: "chat-followup__input",
    placeholder: 'Contoh: "Ubah warna tombol jadi biru" atau "Tambahkan validasi email di form login"...',
  });
  const followUpSendBtn = el("button", { class: "btn btn--primary btn--sm", disabled: "true" }, [
    el("span", { html: icon("send", { size: 13 }) }), "Kirim",
  ]);
  const followUpComposer = el("div", { class: "chat-followup", style: "display:none" }, [
    followUpInput,
    followUpSendBtn,
  ]);

  const responseCard = el("div", { class: "card response-card" }, [
    el("div", { class: "response-header" }, [
      el("h3", {}, "Response AI"),
      el("div", { class: "response-header__actions" }, [generateBtn]),
    ]),
    threadHost,
    followUpComposer,
  ]);
  container.appendChild(responseCard);

  refreshKeyWarning();

  async function saveToHistory(userMessage, aiResponseText) {
    try {
      await historyService.add({
        spreadsheetName: appState.get().activeSpreadsheet?.name,
        templateId: state.lastPrompt.request.templateId,
        provider: providerId,
        prompt: userMessage,
        response: aiResponseText,
        tokenEstimate: tokenEstimatorService.estimate(userMessage, providerId).inputTokens,
      });
    } catch {
      // History gagal tersimpan bukan alasan untuk menggagalkan seluruh alur —
      // response AI-nya sendiri tetap berhasil & tetap ditampilkan ke pengguna.
    }
  }

  async function callAI(userMessageForHistory, { isFirstTurn }) {
    followUpSendBtn.disabled = true;
    followUpInput.disabled = true;
    generateBtn.disabled = true;
    providerSelect.disabled = true;
    modelSelect.disabled = true;

    const callProviderId = providerId;
    const callModelName = modelName;
    const callProviderLabel = AI_PROVIDERS[callProviderId].label;

    const progressPanel = el("div", { class: "progress-panel" }, [
      el("span", { class: "spinner" }),
      el("span", {}, isFirstTurn ? `Menghubungi ${callProviderLabel}...` : `${callProviderLabel} sedang memproses revisi Anda...`),
    ]);
    threadHost.appendChild(progressPanel);

    try {
      const adapter = createAIAdapter(callProviderId, { apiKey: settings.apiKeys[callProviderId], model: callModelName });
      const result = await adapter.complete(conversation);
      conversation.push({ role: "assistant", content: result.text });

      progressPanel.remove();
      threadHost.appendChild(renderAssistantTurn(result.text, `${callProviderLabel} · ${callModelName}`));

      followUpComposer.style.display = "flex";
      generateBtn.innerHTML = `${icon("history", { size: 14 })} Mulai Percakapan Baru`;
      showToast(isFirstTurn ? "Response berhasil disimpan ke History" : "Revisi diterapkan", "success");

      await saveToHistory(userMessageForHistory, result.text);
    } catch (err) {
      progressPanel.remove();
      threadHost.appendChild(el("p", { class: "error-state" }, err.message));
      showToast("Gagal memanggil AI Provider", "error");
      // Percakapan yang gagal jangan ikut "nyangkut" di riwayat yang dikirim
      // ke AI berikutnya — buang pesan user terakhir yang belum terjawab.
      conversation.pop();
    } finally {
      followUpSendBtn.disabled = !hasKeyFor(providerId);
      followUpInput.disabled = false;
      generateBtn.disabled = !hasKeyFor(providerId);
      providerSelect.disabled = false;
      modelSelect.disabled = false;
    }
  }

  generateBtn.addEventListener("click", () => {
    // Sudah pernah generate sebelumnya -> tombol ini jadi "mulai percakapan
    // baru" (reset total), bukan lagi generate turn pertama.
    if (conversation.length > 1) {
      if (!confirm("Ini akan menghapus seluruh riwayat percakapan di halaman ini (riwayat yang sudah tersimpan di menu History tidak terhapus) dan mulai dari prompt awal lagi. Lanjutkan?")) return;
      conversation = [{ role: "user", content: state.lastPrompt.text }];
      followUpComposer.style.display = "none";
      generateBtn.innerHTML = `${icon("sparkles", { size: 14 })} Generate`;
    }
    clear(threadHost);
    callAI(state.lastPrompt.text, { isFirstTurn: true });
  });

  followUpSendBtn.addEventListener("click", () => {
    const msg = followUpInput.value.trim();
    if (!msg) return;
    conversation.push({ role: "user", content: msg });
    threadHost.appendChild(renderUserTurn(msg));
    followUpInput.value = "";
    callAI(msg, { isFirstTurn: false });
  });
  followUpInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) followUpSendBtn.click();
  });

  return container;
}
