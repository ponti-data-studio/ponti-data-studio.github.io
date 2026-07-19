import { el } from "../utils/dom.util.js";
import { icon } from "./icons.component.js";
import { googleAuthService } from "../services/google-auth.service.js";
import { settingsService } from "../services/settings.service.js";
import { showToast } from "./toast.component.js";

/**
 * login-gate.component.js
 * -----------------------------------------------------------------------
 * Layar login WAJIB yang tampil sebelum halaman apa pun (termasuk
 * Dashboard) bisa diakses — dipakai app.js sebagai gerbang multi-user.
 * Login Google di sini berfungsi ganda: (1) izin akses Sheets/Drive API,
 * dan (2) identitas aplikasi supaya Settings/API Key/History setiap
 * orang otomatis terpisah di device/browser yang sama.
 *
 * Kalau Google Client ID belum dikonfigurasi sama sekali (instalasi baru),
 * layar ini juga menyediakan form pengisian Client ID langsung — supaya
 * tidak ada jalan buntu (Settings pun sekarang ada di balik gerbang ini).
 * -----------------------------------------------------------------------
 */

export async function renderLoginGate(onSuccess) {
  const wrap = el("div", { class: "login-gate" });
  const card = el("div", { class: "login-gate__card card" });
  wrap.appendChild(card);

  card.append(
    el("div", { class: "login-gate__brand" }, [
      el("span", { class: "login-gate__brand-icon", html: icon("cube", { size: 22 }) }),
      el("span", { class: "login-gate__brand-name" }, "Ponti Sheets"),
    ]),
    el("h2", {}, "Login untuk melanjutkan"),
    el("p", { class: "muted" }, "Ponti Sheets memakai akun Google Anda untuk mengakses Sheets & Drive, sekaligus supaya Settings, API Key, dan History Anda tetap terpisah dari pengguna lain yang memakai device ini.")
  );

  const isConfigured = await googleAuthService.isConfigured();

  if (!isConfigured) {
    renderClientIdSetup(card, () => renderLoginGate(onSuccess).then((node) => wrap.replaceWith(node)));
    return wrap;
  }

  const loginBtn = el("button", { class: "btn btn--google btn--lg" }, [
    el("span", { html: icon("google", { size: 18 }) }),
    el("span", {}, "Login dengan Google"),
  ]);

  loginBtn.addEventListener("click", async () => {
    const originalContent = loginBtn.innerHTML;
    loginBtn.disabled = true;
    loginBtn.innerHTML = "";
    loginBtn.appendChild(el("span", { class: "spinner" }));
    loginBtn.appendChild(el("span", {}, "Menghubungkan ke Google..."));
    try {
      const session = await googleAuthService.login();
      showToast(`Selamat datang, ${session.profile?.name || session.profile?.email}`, "success");
      await onSuccess(session);
    } catch (err) {
      showToast(err.message, "error");
      loginBtn.disabled = false;
      loginBtn.innerHTML = originalContent;
    }
  });

  card.append(
    loginBtn,
    el("p", { class: "hint" }, "Fitur Analyze/Database Context/ERD/Prompt Builder hanya membaca data Anda. Ponti Sheets hanya benar-benar menulis ke spreadsheet saat Anda menekan tombol \"Generate Google Sheets\" atau \"Terapkan Perubahan\".")
  );

  return wrap;
}

function renderClientIdSetup(card, onSaved) {
  const input = el("input", { type: "text", placeholder: "xxxxxxxx.apps.googleusercontent.com" });
  const saveBtn = el("button", { class: "btn btn--primary" }, "Simpan & Lanjutkan");

  saveBtn.addEventListener("click", async () => {
    const value = input.value.trim();
    if (!value) {
      showToast("Isi Google Client ID terlebih dahulu", "error");
      return;
    }
    await settingsService.setGoogleClientId(value);
    showToast("Google Client ID disimpan", "success");
    onSaved();
  });

  card.append(
    el("div", { class: "login-gate__setup" }, [
      el("p", { class: "hint" }, "Google Client ID belum dikonfigurasi untuk instalasi ini. Isi dulu sebelum bisa login — panduan lengkap ada di README.md bagian \"Cara Login Google\"."),
      el("label", { class: "field" }, [
        el("span", { class: "field__label" }, "Google Client ID"),
        input,
      ]),
      saveBtn,
    ])
  );
}
