import { el, clear } from "../utils/dom.util.js";
import { icon } from "./icons.component.js";

/**
 * install-prompt.component.js
 * -----------------------------------------------------------------------
 * Banner kecil yang mendorong pengguna meng-install Ponti Sheets sebagai
 * PWA (Add to Home Screen) di HP mereka:
 * - Android/Chrome: memakai event `beforeinstallprompt` browser (tombol
 *   "Install" beneran memicu dialog instal native).
 * - iOS Safari: TIDAK mendukung `beforeinstallprompt` sama sekali (ini
 *   keputusan Apple, bukan keterbatasan Ponti Sheets) — jadi ditampilkan
 *   instruksi manual "Tap Share → Add to Home Screen" sebagai gantinya.
 * - Kalau sudah berjalan dalam mode terinstall (standalone), banner tidak
 *   pernah ditampilkan sama sekali.
 * -----------------------------------------------------------------------
 */

const DISMISS_KEY = "ponti_sheets.install_prompt_dismissed_at";
const DISMISS_DURATION_MS = 14 * 24 * 60 * 60 * 1000; // jangan tampil lagi selama 14 hari setelah ditutup

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function isIos() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent) && !window.MSStream;
}

function isRecentlyDismissed() {
  const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
  return Date.now() - dismissedAt < DISMISS_DURATION_MS;
}

function dismiss(banner) {
  localStorage.setItem(DISMISS_KEY, String(Date.now()));
  banner.remove();
}

/**
 * @param {HTMLElement} host - elemen tempat banner disisipkan (biasanya di
 *   awal main-host, di atas konten halaman, supaya tetap terlihat lintas-route)
 */
export function mountInstallPrompt(host) {
  if (isStandalone() || isRecentlyDismissed()) return;

  const banner = el("div", { class: "install-banner" });
  const closeBtn = el("button", { class: "install-banner__close", "aria-label": "Tutup" }, "✕");
  closeBtn.addEventListener("click", () => dismiss(banner));

  let deferredPrompt = null;
  const installBtn = el("button", { class: "btn btn--primary btn--sm" }, "Install");

  function renderAndroidVariant() {
    clear(banner);
    banner.append(
      el("span", { class: "install-banner__icon", html: icon("cube", { size: 18 }) }),
      el("div", { class: "install-banner__text" }, [
        el("strong", {}, "Install Ponti Sheets ke HP Anda"),
        el("span", {}, "Akses lebih cepat, tampil seperti aplikasi asli, bisa dipakai tanpa buka browser dulu."),
      ]),
      installBtn,
      closeBtn
    );
  }

  function renderIosVariant() {
    clear(banner);
    banner.append(
      el("span", { class: "install-banner__icon", html: icon("cube", { size: 18 }) }),
      el("div", { class: "install-banner__text" }, [
        el("strong", {}, "Install Ponti Sheets ke Home Screen"),
        el("span", {}, "Ketuk ikon Share di Safari, lalu pilih \"Add to Home Screen\"."),
      ]),
      closeBtn
    );
  }

  if (isIos()) {
    renderIosVariant();
    host.prepend(banner);
    return;
  }

  // Android/Chrome/Edge: tunggu event beforeinstallprompt sebelum menampilkan
  // banner sama sekali — kalau browser tidak pernah memicunya (mis. kriteria
  // installability belum terpenuhi), banner memang sengaja tidak tampil.
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    renderAndroidVariant();
    if (!banner.isConnected) host.prepend(banner);
  });

  installBtn.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    if (outcome === "accepted") banner.remove();
  });

  window.addEventListener("appinstalled", () => {
    banner.remove();
  });
}
