import { StorageInterface } from "./storage.interface.js";
import { logger } from "../utils/logger.util.js";

const NS = "ponti_sheets.";

// Key yang SENGAJA tidak dipisah per akun (namespace) — dibutuhkan untuk
// menentukan SIAPA yang sedang login (auth.session), atau bersifat konfigurasi
// deployment (google_client_id, dipakai bersama oleh siapa pun yang memakai
// instance Ponti Sheets ini, bukan preferensi personal).
const GLOBAL_KEYS = new Set(["auth.session", "google_client_id"]);
const MIGRATION_FLAG_KEY = "legacy_migration_done_v1";

/**
 * LocalDriver — driver storage untuk Ponti Sheets.
 * Semua data disimpan di localStorage milik browser, tidak ada server
 * database. Sejak fitur multi-user (Login Gate) ditambahkan, SEMUA key
 * (kecuali GLOBAL_KEYS di atas) otomatis dipisah per akun Google yang
 * sedang login — supaya beberapa orang bisa memakai device/browser yang
 * sama tanpa saling melihat Settings/API Key/History satu sama lain.
 */
export class LocalDriver extends StorageInterface {
  constructor() {
    super();
    this.activeUserId = null;
  }

  /** Dipanggil google-auth.service.js setiap kali status login diketahui/berubah */
  setActiveUserNamespace(userId) {
    this.activeUserId = userId || null;
  }

  getActiveUserNamespace() {
    return this.activeUserId;
  }

  _userSegment() {
    return this.activeUserId ? `user_${this.activeUserId}` : "user_anon";
  }

  _resolveKey(key) {
    if (GLOBAL_KEYS.has(key)) return NS + key;
    return `${NS}${this._userSegment()}.${key}`;
  }

  async get(key) {
    try {
      const raw = localStorage.getItem(this._resolveKey(key));
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      logger.error("storage", `Gagal membaca key "${key}"`, err);
      return null;
    }
  }

  async set(key, value) {
    try {
      localStorage.setItem(this._resolveKey(key), JSON.stringify(value));
      return true;
    } catch (err) {
      logger.error("storage", `Gagal menulis key "${key}" (mungkin storage penuh)`, err);
      return false;
    }
  }

  async remove(key) {
    localStorage.removeItem(this._resolveKey(key));
    return true;
  }

  /** List selalu beroperasi di dalam namespace user yang SEDANG aktif saja */
  async list(prefix = "") {
    const fullPrefix = `${NS}${this._userSegment()}.${prefix}`;
    const keys = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const rawKey = localStorage.key(i);
      if (rawKey && rawKey.startsWith(fullPrefix)) {
        keys.push(rawKey.slice(`${NS}${this._userSegment()}.`.length));
      }
    }
    return keys;
  }

  /** Hanya menghapus data milik user yang sedang aktif — tidak menyentuh user lain */
  async clearAll() {
    const keys = await this.list("");
    keys.forEach((k) => localStorage.removeItem(this._resolveKey(k)));
    return true;
  }

  /**
   * Migrasi SEKALI JALAN: sebelum fitur multi-user ada, semua data tersimpan
   * tanpa pemisahan per akun. Supaya pengguna yang sudah lama pakai Ponti
   * Sheets (Settings, API Key, History-nya) tidak "hilang" tiba-tiba setelah
   * update ini, data lama tersebut dipindahkan ke akun Google pertama yang
   * login setelah update — HANYA sekali, ditandai lewat flag global supaya
   * tidak terulang (mis. kalau orang KEDUA login di device yang sama nanti,
   * dia tidak akan ikut mewarisi data milik orang pertama).
   */
  async migrateLegacyDataIfNeeded(userId) {
    if (!userId) return;
    const flagKey = NS + MIGRATION_FLAG_KEY;
    if (localStorage.getItem(flagKey)) return;

    const legacyKeys = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const rawKey = localStorage.key(i);
      if (
        rawKey &&
        rawKey.startsWith(NS) &&
        !rawKey.startsWith(`${NS}user_`) &&
        rawKey !== NS + "auth.session" &&
        rawKey !== NS + "google_client_id" &&
        rawKey !== flagKey
      ) {
        legacyKeys.push(rawKey);
      }
    }

    if (legacyKeys.length > 0) {
      legacyKeys.forEach((rawKey) => {
        const shortKey = rawKey.slice(NS.length);
        const value = localStorage.getItem(rawKey);
        const newKey = `${NS}user_${userId}.${shortKey}`;
        if (value !== null && localStorage.getItem(newKey) === null) {
          localStorage.setItem(newKey, value);
        }
      });
      logger.info("storage", `Migrasi ${legacyKeys.length} data lama ke akun aktif selesai.`);
    }

    localStorage.setItem(flagKey, "1");
  }

  /**
   * Baca langsung key versi LAMA (sebelum multi-user, tanpa namespace user
   * sama sekali) — dipakai HANYA supaya Google Client ID yang sudah pernah
   * diisi sebelum update ini tetap ketemu walau belum ada yang login (di
   * Login Gate), tanpa perlu memaksa pengguna lama mengetik ulang.
   */
  readLegacyGlobalKey(key) {
    try {
      const raw = localStorage.getItem(NS + key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
}

export const localDriver = new LocalDriver();
