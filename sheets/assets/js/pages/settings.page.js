import { el } from "../utils/dom.util.js";
import { AI_PROVIDERS, APP_CONFIG } from "../config/app.config.js";
import { settingsService } from "../services/settings.service.js";
import { appState } from "../controllers/app-state.js";
import { getStorage } from "../storage/storage.factory.js";
import { showToast } from "../components/toast.component.js";

function field(label, inputNode, hint) {
  return el("label", { class: "field" }, [
    el("span", { class: "field__label" }, label),
    inputNode,
    hint ? el("span", { class: "field__hint" }, hint) : null,
  ]);
}

export async function renderSettingsPage(applyTheme) {
  const settings = await settingsService.get();
  const googleClientId = await settingsService.getGoogleClientId();
  const container = el("div", { class: "page page--settings" });

  container.appendChild(el("div", { class: "page__header" }, [
    el("h2", {}, "Settings"),
    el("p", { class: "muted" }, "Kelola tema, bahasa, provider AI, API key, dan storage lokal Anda."),
  ]));

  // --- Tampilan ---
  const themeSelect = el("select", {}, ["dark", "light"].map((t) => el("option", { value: t }, t === "dark" ? "Gelap (Dark)" : "Terang (Light)")));
  themeSelect.value = settings.theme;
  themeSelect.addEventListener("change", async () => {
    const updated = await settingsService.update({ theme: themeSelect.value });
    appState.set({ theme: updated.theme });
    applyTheme(updated.theme);
  });

  const langSelect = el("select", {}, ["id", "en"].map((l) => el("option", { value: l }, l === "id" ? "Bahasa Indonesia" : "English")));
  langSelect.value = settings.language;
  langSelect.addEventListener("change", async () => {
    await settingsService.update({ language: langSelect.value });
    showToast("Bahasa disimpan. (Catatan: multi-bahasa penuh direncanakan di versi mendatang)", "info");
  });

  container.appendChild(el("div", { class: "card" }, [
    el("h3", {}, "Tampilan"),
    field("Tema", themeSelect),
    field("Bahasa", langSelect),
  ]));

  // --- Google OAuth ---
  const clientIdInput = el("input", { type: "text", placeholder: "xxxxxxxx.apps.googleusercontent.com", value: googleClientId || "" });
  const clientIdSaveBtn = el("button", { class: "btn btn--ghost btn--sm", onClick: async () => {
    await settingsService.setGoogleClientId(clientIdInput.value.trim());
    showToast("Google Client ID disimpan", "success");
  }}, "Simpan");

  container.appendChild(el("div", { class: "card" }, [
    el("h3", {}, "Google OAuth"),
    field(
      "Google Client ID",
      el("div", { class: "input-with-button" }, [clientIdInput, clientIdSaveBtn]),
      "Berlaku untuk SEMUA akun yang login di instalasi ini (bukan per-akun) — disimpan lokal di browser, tidak akan hilang saat Anda mengganti/update file aplikasi. Panduan membuatnya ada di README.md bagian \"Cara Login Google\"."
    ),
  ]));

  // --- AI Provider ---
  const providerSelect = el("select", {}, Object.values(AI_PROVIDERS).map((p) => el("option", { value: p.id }, p.label)));
  providerSelect.value = settings.activeProvider;
  providerSelect.addEventListener("change", async () => {
    await settingsService.update({ activeProvider: providerSelect.value });
  });

  const providerCard = el("div", { class: "card" }, [
    el("h3", {}, "AI Provider"),
    field("Provider Aktif (default)", providerSelect),
  ]);

  Object.values(AI_PROVIDERS).forEach((provider) => {
    const keyInput = el("input", { type: "password", placeholder: provider.keyPlaceholder, value: settings.apiKeys[provider.id] || "" });
    const modelSelect = el("select", {}, provider.models.map((m) => el("option", { value: m }, m)));
    modelSelect.value = settings.models[provider.id] || provider.defaultModel;

    const saveBtn = el("button", { class: "btn btn--ghost btn--sm", onClick: async () => {
      await settingsService.setApiKey(provider.id, keyInput.value);
      await settingsService.update({ models: { ...settings.models, [provider.id]: modelSelect.value } });
      showToast(`API Key ${provider.label} disimpan (lokal, di perangkat Anda)`, "success");
    }}, "Simpan");

    providerCard.appendChild(
      el("div", { class: "provider-row" }, [
        el("div", { class: "provider-row__label" }, provider.label),
        field("API Key", keyInput, "Disimpan hanya di perangkat Anda (localStorage), tidak dikirim ke server manapun."),
        field("Model", modelSelect),
        saveBtn,
      ])
    );
  });

  container.appendChild(providerCard);

  // --- Storage ---
  const storageCard = el("div", { class: "card" }, [
    el("h3", {}, "Storage"),
    el("p", { class: "muted" }, `Mode storage saat ini: ${APP_CONFIG.storageDriver} (semua data disimpan di browser ini, terpisah per akun Google yang login).`),
    el("button", { class: "btn btn--danger", onClick: async () => {
      if (confirm("Ini akan menghapus SEMUA data lokal akun Anda yang SEDANG login (history, settings, API key) — tidak memengaruhi akun Google lain yang mungkin login di device ini. Lanjutkan?")) {
        await getStorage().clearAll();
        showToast("Data lokal akun ini dihapus. Memuat ulang...", "info");
        setTimeout(() => window.location.reload(), 1000);
      }
    }}, "Hapus Data Akun Ini"),
  ]);
  container.appendChild(storageCard);

  return container;
}
