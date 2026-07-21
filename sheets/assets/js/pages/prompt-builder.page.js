import { el, clear } from "../utils/dom.util.js";
import { icon } from "../components/icons.component.js";
import { appState } from "../controllers/app-state.js";
import { TEMPLATES, AI_PROVIDERS } from "../config/app.config.js";
import { promptBuilderService } from "../services/prompt-builder.service.js";
import { tokenEstimatorService } from "../services/token-estimator.service.js";
import { PromptRequestModel } from "../models/prompt.model.js";
import { settingsService } from "../services/settings.service.js";
import { showToast } from "../components/toast.component.js";

const VISUAL_STYLE_OPTIONS = [
  "Professional - Bersih, rapi, formal, fokus pada fungsi", "Modern - Minimalis, rounded, animasi halus",
  "Corporate - Formal, warna konservatif, terpercaya", "Elegant - Premium, banyak whitespace, tipografi kuat",
  "Luxury - Warna gelap, emas, eksklusif", "Minimalist - Sedikit elemen, fokus pada konten",
  "Clean - Sangat rapi dan mudah dibaca", "Friendly - Warna cerah, ikon membulat",
  "Playful - Ilustrasi, warna ceria", "Creative - Layout unik, banyak visual",
  "Futuristic - Neon, glow, AI, cyber", "High-Tech - Banyak data, grafik, nuansa teknologi",
  "Industrial - Tegas, sederhana, fokus efisiensi", "Financial - Biru, hijau, penuh grafik",
  "Medical - Putih, biru muda, steril", "Government - Formal, aksesibilitas tinggi",
  "Educational - Mudah dipahami, ikon informatif", "E-Commerce - Fokus produk dan CTA",
  "Gaming - Dinamis, kontras tinggi", "Dark Theme - Dominan warna gelap", "Light Theme - Cerah, bersih",
];

function field(label, inputNode, hint) {
  return el("label", { class: "field" }, [
    el("span", { class: "field__label" }, label),
    inputNode,
    hint ? el("span", { class: "field__hint" }, hint) : null,
  ]);
}

function flashButton(btn, tempLabel) {
  const original = btn.innerHTML;
  btn.innerHTML = tempLabel;
  btn.disabled = true;
  setTimeout(() => {
    btn.innerHTML = original;
    btn.disabled = false;
  }, 1500);
}

export async function renderPromptBuilderPage(navigate) {
  const state = appState.get();
  const container = el("div", { class: "page page--prompt-builder" });

  if (!state.databaseContext) {
    container.appendChild(
      el("div", { class: "empty-state-panel" }, [
        el("p", {}, "Belum ada Database Context. Buka halaman Database Context terlebih dahulu."),
        el("button", { class: "btn btn--primary", onClick: () => navigate("database-context") }, "Ke Database Context"),
      ])
    );
    return container;
  }

  const settings = await settingsService.get();

  container.appendChild(el("div", { class: "page__header" }, [
    el("h2", {}, "Prompt Builder"),
    el("p", { class: "muted" }, "Susun prompt otomatis dari Database Context + Business Rules + Template + Instruksi Anda."),
  ]));

  const layout = el("div", { class: "prompt-builder-layout" });
  container.appendChild(layout);

  const form = el("div", { class: "card prompt-form" });
  const preview = el("div", { class: "card prompt-preview" });
  layout.appendChild(form);
  layout.appendChild(preview);

  const templateSelect = el("select", {}, Object.values(TEMPLATES).map((t) =>
    el("option", { value: t.id, disabled: t.status === "coming_soon" ? "true" : undefined }, `${t.label}${t.status === "coming_soon" ? " (Coming Soon)" : ""}`)
  ));
  const providerSelect = el("select", {}, Object.values(AI_PROVIDERS).map((p) => el("option", { value: p.id }, p.label)));
  providerSelect.value = settings.activeProvider;

  // ---- Visual Style: multi-select berbentuk chip (boleh pilih lebih dari satu) ----
  let selectedStyles = [];
  const styleChipGroup = el("div", { class: "style-chip-group" });

  function renderStyleChips() {
    clear(styleChipGroup);
    VISUAL_STYLE_OPTIONS.forEach((opt) => {
      const shortLabel = opt.split(" - ")[0];
      const isActive = selectedStyles.includes(opt);
      const chip = el("button", {
        type: "button",
        class: `style-chip${isActive ? " style-chip--active" : ""}`,
        title: opt,
      }, shortLabel);
      chip.addEventListener("click", () => {
        selectedStyles = isActive ? selectedStyles.filter((s) => s !== opt) : [...selectedStyles, opt];
        renderStyleChips();
        rebuild();
      });
      styleChipGroup.appendChild(chip);
    });
  }
  renderStyleChips();

  const additionalReq = el("textarea", { rows: 3, placeholder: "Contoh: gunakan Bootstrap 5, sertakan validasi form..." });
  const userInstruction = el("textarea", { rows: 4, placeholder: "Contoh: buatkan aplikasi kasir sederhana dari struktur ini..." });

  form.append(
    el("h3", {}, "Konfigurasi"),
    field("Template", templateSelect),
    field("AI Provider", providerSelect),
    field("Visual Style", styleChipGroup, "Klik untuk memilih — bisa pilih lebih dari satu gaya sekaligus, AI akan menggabungkannya."),
    field("Requirement Tambahan", additionalReq),
    field("Instruksi Anda", userInstruction),
  );

  // Prompt Preview kini bisa diedit langsung (textarea), bukan cuma teks statis.
  const previewBody = el("textarea", { class: "prompt-box prompt-box--editable", spellcheck: "false" });
  const tokenInfo = el("div", { class: "token-info" });
  const copyBtn = el("button", { class: "btn btn--ghost btn--sm" }, [el("span", { html: icon("copy", { size: 14 }) }), "Copy"]);
  const resetBtn = el("button", { class: "btn btn--ghost btn--sm" }, [el("span", { html: icon("history", { size: 14 }) }), "Reset"]);

  preview.append(
    el("div", { class: "prompt-preview__header" }, [
      el("h3", {}, "Prompt Preview"),
      el("div", { class: "prompt-preview__header-actions" }, [resetBtn, copyBtn]),
    ]),
    tokenInfo,
    previewBody,
    el("p", { class: "field__hint" }, "Anda bisa mengedit teks prompt di atas secara langsung sebelum dikirim ke AI Studio. Klik \"Reset\" untuk mengembalikannya ke versi hasil generate otomatis."),
    el("div", { class: "prompt-preview__actions" }, [
      el("button", { class: "btn btn--primary", id: "goto-ai-studio" }, "Kirim ke AI Studio"),
    ])
  );

  // Menyimpan versi "asli" (hasil generate otomatis) terpisah dari isi textarea
  // yang mungkin sudah diedit manual oleh pengguna — dipakai oleh tombol Reset.
  let generatedPrompt = "";
  let currentRequest = null;

  function updateTokenInfo(promptText) {
    const estimate = tokenEstimatorService.estimate(promptText, providerSelect.value);
    clear(tokenInfo);
    tokenInfo.append(
      el("span", { class: "token-chip" }, `${estimate.charCount.toLocaleString("id-ID")} karakter`),
      el("span", { class: "token-chip" }, `~${estimate.inputTokens.toLocaleString("id-ID")} token input`),
      el("span", { class: "token-chip" }, `~$${estimate.estimatedCostUsd}`),
      el("span", { class: "token-chip" }, `~${estimate.estimatedSeconds}s respon`),
    );
  }

  function rebuild() {
    currentRequest = new PromptRequestModel({
      templateId: templateSelect.value,
      provider: providerSelect.value,
      visualStyle: selectedStyles,
      additionalRequirement: additionalReq.value,
      userInstruction: userInstruction.value,
      databaseContext: state.databaseContext,
    });
    generatedPrompt = promptBuilderService.build(currentRequest);

    previewBody.value = generatedPrompt;
    appState.set({ lastPrompt: { text: generatedPrompt, request: currentRequest } });
    updateTokenInfo(generatedPrompt);
  }

  [templateSelect, providerSelect, additionalReq, userInstruction].forEach((elm) => {
    elm.addEventListener("input", rebuild);
    elm.addEventListener("change", rebuild);
  });

  rebuild();

  // Saat pengguna mengedit teks prompt secara manual, simpan versi editan itu
  // sebagai prompt yang akan benar-benar dipakai (bukan versi auto-generate).
  previewBody.addEventListener("input", () => {
    appState.set({ lastPrompt: { text: previewBody.value, request: currentRequest } });
    updateTokenInfo(previewBody.value);
  });

  resetBtn.addEventListener("click", () => {
    previewBody.value = generatedPrompt;
    appState.set({ lastPrompt: { text: generatedPrompt, request: currentRequest } });
    updateTokenInfo(generatedPrompt);
    showToast("Prompt dikembalikan ke versi hasil generate otomatis", "info");
    flashButton(resetBtn, `${icon("check", { size: 14 })} Direset`);
  });

  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(previewBody.value);
      showToast("Prompt disalin ke clipboard", "success");
      flashButton(copyBtn, `${icon("check", { size: 14 })} Disalin`);
    } catch {
      showToast("Gagal menyalin ke clipboard", "error");
    }
  });

  preview.querySelector("#goto-ai-studio").addEventListener("click", () => navigate("ai-studio"));

  return container;
}
