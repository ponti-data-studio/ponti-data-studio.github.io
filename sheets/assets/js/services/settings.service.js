import { getStorage, readLegacyGlobalKey } from "../storage/storage.factory.js";
import { APP_CONFIG } from "../config/app.config.js";

const SETTINGS_KEY = "settings";
const GOOGLE_CLIENT_ID_KEY = "google_client_id"; // key GLOBAL (tidak per-user), lihat local.driver.js

const DEFAULTS = {
  theme: APP_CONFIG.defaultTheme,
  activeProvider: "openai",
  apiKeys: { openai: "", gemini: "", qwen: "", claude: "" },
  models: { openai: "", gemini: "", qwen: "", claude: "" },
};

export const settingsService = {
  async get() {
    const stored = await getStorage().get(SETTINGS_KEY);
    return { ...DEFAULTS, ...(stored || {}), apiKeys: { ...DEFAULTS.apiKeys, ...(stored?.apiKeys || {}) } };
  },

  async update(partial) {
    const current = await this.get();
    const updated = { ...current, ...partial };
    await getStorage().set(SETTINGS_KEY, updated);
    return updated;
  },

  async setApiKey(providerId, key) {
    const current = await this.get();
    current.apiKeys[providerId] = key;
    await getStorage().set(SETTINGS_KEY, current);
    return current;
  },

  /**
   * Google Client ID bersifat GLOBAL (satu untuk seluruh instance Ponti Sheets
   * ini, bukan per-akun) — dibutuhkan supaya bisa diisi SEBELUM ada yang login
   * sama sekali (dari Login Gate), dan sama untuk semua orang yang memakai
   * deployment ini. Disimpan terpisah dari blob Settings biasa.
   */
  async getGoogleClientId() {
    const direct = await getStorage().get(GOOGLE_CLIENT_ID_KEY);
    if (direct) return direct;

    // Migrasi sekali-jalan: versi lama menyimpan ini di dalam blob Settings biasa
    // (jadi ikut ter-namespace per-user) — angkat ke key global kalau ketemu.
    const legacy = await getStorage().get(SETTINGS_KEY);
    if (legacy?.googleClientId) {
      await getStorage().set(GOOGLE_CLIENT_ID_KEY, legacy.googleClientId);
      return legacy.googleClientId;
    }

    // Fallback tambahan khusus untuk pengguna yang upgrade dari versi SEBELUM
    // fitur multi-user ada sama sekali — supaya tetap ketemu walau belum ada
    // yang login (dicek langsung di Login Gate).
    const veryLegacy = readLegacyGlobalKey(SETTINGS_KEY);
    if (veryLegacy?.googleClientId) {
      await getStorage().set(GOOGLE_CLIENT_ID_KEY, veryLegacy.googleClientId);
      return veryLegacy.googleClientId;
    }

    return "";
  },

  async setGoogleClientId(value) {
    await getStorage().set(GOOGLE_CLIENT_ID_KEY, value || "");
    return value;
  },
};
