import { GOOGLE_CONFIG } from "../config/app.config.js";
import { logger } from "../utils/logger.util.js";
import { getStorage, setActiveUserNamespace, migrateLegacyDataIfNeeded } from "../storage/storage.factory.js";
import { settingsService } from "./settings.service.js";

/**
 * google-auth.service.js
 * -----------------------------------------------------------------------
 * Menangani login Google (OAuth 2.0) memakai Google Identity Services
 * (GIS) token client, lalu Google Sheets API v4 & Drive API dipakai
 * langsung dari sisi client (tanpa server sendiri).
 *
 * SEJAK FITUR MULTI-USER: login Google juga berfungsi sebagai identitas
 * APLIKASI (bukan cuma izin akses Sheets/Drive) — setiap akun Google yang
 * login otomatis mendapat "ruang data" sendiri (Settings, API Key,
 * History) lewat storage namespace berbasis ID akun (`profile.sub`).
 * Lihat storage/local.driver.js untuk detail pemisahannya.
 *
 * Client ID sendiri bersifat GLOBAL (satu untuk semua akun di deployment
 * ini) dan disimpan lewat settingsService.getGoogleClientId() — BUKAN
 * di-hardcode di app.config.js, supaya tidak hilang setiap kali Anda
 * mengganti/update file aplikasi.
 *
 * Cara pakai (lihat README.md → "Cara Login Google" untuk detail):
 * 1. Buat OAuth Client ID di Google Cloud Console (tipe: Web application).
 * 2. Tambahkan origin aplikasi Anda ke "Authorized JavaScript origins".
 * 3. Isi Google Client ID di Login Gate (atau menu Settings) aplikasi ini.
 * -----------------------------------------------------------------------
 */

const SESSION_KEY = "auth.session";
let tokenClient = null;
let gisLoaded = false;

function loadGisScript() {
  return new Promise((resolve, reject) => {
    if (gisLoaded || window.google?.accounts?.oauth2) {
      gisLoaded = true;
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => { gisLoaded = true; resolve(); };
    script.onerror = () => reject(new Error("Gagal memuat Google Identity Services"));
    document.head.appendChild(script);
  });
}

async function fetchUserProfile(accessToken) {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("Gagal mengambil profil Google");
  return res.json();
}

function userIdFromProfile(profile) {
  return profile?.sub || profile?.email || null;
}

/**
 * Client ID diprioritaskan dari penyimpanan global (lihat settingsService).
 * Jika kosong, fallback ke GOOGLE_CONFIG.clientId di app.config.js (opsional,
 * untuk developer yang memang ingin hardcode saat self-hosting permanen).
 */
async function resolveClientId() {
  const fromSettings = (await settingsService.getGoogleClientId())?.trim();
  if (fromSettings) return fromSettings;
  if (!GOOGLE_CONFIG.clientId.startsWith("GANTI_DENGAN")) return GOOGLE_CONFIG.clientId;
  return "";
}

export const googleAuthService = {
  async isConfigured() {
    const clientId = await resolveClientId();
    return !!clientId;
  },

  async getSession() {
    const session = await getStorage().get(SESSION_KEY);
    const userId = userIdFromProfile(session?.profile);
    setActiveUserNamespace(userId);
    if (userId) await migrateLegacyDataIfNeeded(userId);
    return session;
  },

  async login() {
    const clientId = await resolveClientId();
    if (!clientId) {
      throw new Error(
        "Google Client ID belum dikonfigurasi. Isi Google Client ID di layar login sesuai panduan di README.md."
      );
    }

    await loadGisScript();

    return new Promise((resolve, reject) => {
      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: GOOGLE_CONFIG.scopes,
        callback: async (tokenResponse) => {
          try {
            if (tokenResponse.error) {
              throw new Error(tokenResponse.error);
            }
            const profile = await fetchUserProfile(tokenResponse.access_token);
            const session = {
              accessToken: tokenResponse.access_token,
              expiresAt: Date.now() + (tokenResponse.expires_in || 3600) * 1000,
              profile,
            };

            const userId = userIdFromProfile(profile);
            setActiveUserNamespace(userId);
            await migrateLegacyDataIfNeeded(userId);
            await getStorage().set(SESSION_KEY, session);

            logger.info("google-auth", "Login berhasil", { email: profile.email });
            resolve(session);
          } catch (err) {
            logger.error("google-auth", "Login gagal", err);
            reject(err);
          }
        },
      });
      tokenClient.requestAccessToken({ prompt: "consent" });
    });
  },

  async logout() {
    const session = await this.getSession();
    if (session?.accessToken && window.google?.accounts?.oauth2) {
      window.google.accounts.oauth2.revoke(session.accessToken, () => {});
    }
    await getStorage().remove(SESSION_KEY);
    setActiveUserNamespace(null);
    logger.info("google-auth", "Logout berhasil");
  },

  async getValidAccessToken() {
    const session = await this.getSession();
    if (!session) throw new Error("Anda belum login. Silakan login dengan akun Google.");
    if (Date.now() >= session.expiresAt) {
      throw new Error("Sesi login sudah kedaluwarsa. Silakan login ulang.");
    }
    return session.accessToken;
  },
};
