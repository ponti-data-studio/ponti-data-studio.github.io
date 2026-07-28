/**
 * confirm-dialog.util.js
 * -----------------------------------------------------------------------
 * Pengganti window.confirm() bawaan browser, memakai SweetAlert2 yang
 * dimuat dinamis dari CDN (bukan lewat npm) — konsisten dengan prinsip
 * "tanpa build step" Ponti Sheets, sama seperti Prism.js & ExcelJS.
 * Tampilannya otomatis mengikuti tema (dark/dark) aplikasi lewat CSS
 * variables, lihat aturan ".ponti-swal" di components.css.
 * -----------------------------------------------------------------------
 */

const SWAL_CDN_URL = "https://cdn.jsdelivr.net/npm/sweetalert2@11";

let swalLoadPromise = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Gagal memuat script dari ${src}`));
    document.head.appendChild(script);
  });
}

/** Memuat SweetAlert2 dari CDN sekali saja — panggilan berikutnya memakai
 *  instance yang sudah dimuat (di-cache lewat promise). */
export function loadSweetAlert() {
  if (window.Swal) return Promise.resolve(window.Swal);
  if (swalLoadPromise) return swalLoadPromise;
  swalLoadPromise = loadScript(SWAL_CDN_URL)
    .then(() => window.Swal)
    .catch((err) => {
      swalLoadPromise = null; // supaya bisa dicoba lagi kalau gagal (mis. offline)
      throw err;
    });
  return swalLoadPromise;
}

/**
 * Dialog konfirmasi (pengganti window.confirm) — dipakai di SELURUH aplikasi
 * untuk tampilan yang konsisten & lebih ramah dibanding kotak dialog bawaan
 * browser yang kaku.
 * @param {object} opts
 * @param {string} opts.title - judul singkat, mis. "Hapus kolom ini?"
 * @param {string} [opts.text] - penjelasan detail (opsional)
 * @param {boolean} [opts.danger] - true untuk aksi destruktif (hapus dll) —
 *   tombol konfirmasi jadi merah & ikon jadi peringatan, bukan tanda tanya.
 * @param {string} [opts.confirmText]
 * @param {string} [opts.cancelText]
 * @returns {Promise<boolean>} true kalau pengguna menekan tombol konfirmasi.
 */
export async function confirmDialog({
  title, text = "", danger = false,
  confirmText = danger ? "Ya, Hapus" : "Ya, Lanjutkan", cancelText = "Batal",
} = {}) {
  try {
    const Swal = await loadSweetAlert();
    const result = await Swal.fire({
      title, text,
      icon: danger ? "warning" : "question",
      showCancelButton: true,
      confirmButtonText: confirmText,
      cancelButtonText: cancelText,
      reverseButtons: true,
      focusCancel: danger, // untuk aksi berbahaya, fokus default ke Batal (lebih aman)
      customClass: {
        popup: "ponti-swal",
        confirmButton: `ponti-swal__confirm${danger ? " ponti-swal__confirm--danger" : ""}`,
        cancelButton: "ponti-swal__cancel",
      },
      buttonsStyling: false,
    });
    return result.isConfirmed;
  } catch {
    // CDN gagal dimuat (mis. offline) — fallback ke confirm() bawaan browser
    // supaya fitur tetap berfungsi walau tampilannya jadi kurang cantik.
    return window.confirm(text ? `${title}\n\n${text}` : title);
  }
}

/**
 * Dialog notifikasi sederhana (pengganti window.alert) — untuk kasus yang
 * cuma perlu memberi tahu, tanpa perlu konfirmasi Ya/Tidak.
 * @param {object} opts
 * @param {string} opts.title
 * @param {string} [opts.text]
 * @param {"success"|"error"|"warning"|"info"} [opts.icon]
 */
export async function alertDialog({ title, text = "", icon = "info" } = {}) {
  try {
    const Swal = await loadSweetAlert();
    await Swal.fire({
      title, text, icon,
      confirmButtonText: "OK",
      customClass: { popup: "ponti-swal", confirmButton: "ponti-swal__confirm" },
      buttonsStyling: false,
    });
  } catch {
    window.alert(text ? `${title}\n\n${text}` : title);
  }
}
