import { APP_CONFIG } from "../config/app.config.js";
import { localDriver } from "./local.driver.js";

/**
 * storage.factory.js
 * Titik tunggal untuk mendapatkan storage driver aktif.
 * Ketika versi Cloud Sync (v2) dibangun, cukup tambahkan RemoteDriver
 * dan daftarkan di sini — tidak ada file lain yang perlu diubah.
 */
const drivers = {
  local: localDriver,
  // remote: remoteDriver,       // v2 Cloud Sync
  // multiUser: multiUserDriver, // v3 Multi User
  // saas: saasDriver,           // v4 Multi Tenant SaaS
};

export function getStorage() {
  return drivers[APP_CONFIG.storageDriver] || localDriver;
}

/** Dipanggil google-auth.service.js setiap kali status login diketahui/berubah,
 *  supaya seluruh data (Settings, API Key, History, dsb) otomatis terpisah per
 *  akun Google — mendukung banyak orang memakai device yang sama. Aman dipanggil
 *  meski driver aktif tidak mendukungnya (mis. driver v2 Cloud Sync nanti). */
export function setActiveUserNamespace(userId) {
  const driver = getStorage();
  if (typeof driver.setActiveUserNamespace === "function") driver.setActiveUserNamespace(userId);
}

export async function migrateLegacyDataIfNeeded(userId) {
  const driver = getStorage();
  if (typeof driver.migrateLegacyDataIfNeeded === "function") await driver.migrateLegacyDataIfNeeded(userId);
}

/** Dipakai settings.service.js untuk mengangkat Google Client ID lama (sebelum
 *  multi-user) supaya tetap ketemu walau belum ada yang login sama sekali. */
export function readLegacyGlobalKey(key) {
  const driver = getStorage();
  if (typeof driver.readLegacyGlobalKey === "function") return driver.readLegacyGlobalKey(key);
  return null;
}
