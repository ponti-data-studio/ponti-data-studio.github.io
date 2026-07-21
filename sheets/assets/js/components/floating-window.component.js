import { el } from "../utils/dom.util.js";
import { icon } from "./icons.component.js";

/**
 * floating-window.component.js
 * -----------------------------------------------------------------------
 * Jendela mengambang generik: bisa digeser & diperbesar/diperkecil (di
 * desktop), diminimalkan, dan ditutup. Di mobile otomatis jadi modal
 * layar-penuh (drag/resize tidak masuk akal di layar sempit).
 *
 * Dipakai untuk hal-hal seperti panel "Minta Saran AI" di Schema Editor
 * yang perlu tetap terlihat sambil pengguna mengerjakan hal lain, dan
 * TIDAK boleh tertutup tidak sengaja (klik di luar area / tombol Esc).
 * -----------------------------------------------------------------------
 */

const MOBILE_BREAKPOINT = 768;
const MIN_WIDTH = 340;
const MIN_HEIGHT = 200;

function isMobileViewport() {
  return window.innerWidth < MOBILE_BREAKPOINT;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * @param {object} opts
 * @param {string} opts.title
 * @param {string} [opts.iconName]
 * @param {number} [opts.initialWidth]
 * @param {number} [opts.initialHeight]
 * @param {() => boolean} [opts.canClose] - dipanggil saat tombol close/Esc
 *   ditekan; kembalikan false untuk MENOLAK penutupan (mis. tampilkan
 *   konfirmasi sendiri). Kalau tidak diisi, selalu boleh ditutup.
 * @param {(reason: "close"|"minimize") => void} [opts.onClose] - dipanggil setelah window
 *   benar-benar tertutup. "reason" membedakan apakah pengguna menutup lewat tombol ✕
 *   ("close" — anggap sesi selesai) atau tombol minimize ("minimize" — cuma disembunyikan
 *   sementara, state harus tetap dipertahankan oleh pemanggil).
 * @returns {{ root: HTMLElement, bodyHost: HTMLElement, close: () => void, closeForce: () => void, isOpen: () => boolean, flash: () => void }}
 */
export function createFloatingWindow({
  title, iconName = "sparkles", initialWidth = 560, initialHeight = 560,
  canClose = () => true, onClose = () => {},
} = {}) {
  const mobile = isMobileViewport();

  const root = el("div", { class: `floating-window${mobile ? " floating-window--mobile" : ""}` });
  const titlebar = el("div", { class: "floating-window__titlebar" });
  const titleEl = el("span", { class: "floating-window__title" }, [
    el("span", { html: icon(iconName, { size: 14 }) }),
    el("span", {}, title),
  ]);
  const minimizeBtn = el("button", { class: "floating-window__btn", title: "Sembunyikan (buka lagi lewat tombol di halaman)", "aria-label": "Minimalkan" }, "─");
  const closeBtn = el("button", { class: "floating-window__btn floating-window__btn--close", title: "Tutup", "aria-label": "Tutup" }, "✕");
  const controls = el("div", { class: "floating-window__controls" }, [minimizeBtn, closeBtn]);
  titlebar.append(titleEl, controls);

  const bodyHost = el("div", { class: "floating-window__body" });
  const resizeHandle = el("div", { class: "floating-window__resize-handle" });

  root.append(titlebar, bodyHost);
  if (!mobile) root.appendChild(resizeHandle);

  // ---- Posisi & ukuran awal (di tengah viewport, tidak melebihi layar) ----
  if (!mobile) {
    const w = Math.min(initialWidth, window.innerWidth - 40);
    const h = Math.min(initialHeight, window.innerHeight - 40);
    const left = Math.max(20, (window.innerWidth - w) / 2);
    const top = Math.max(20, (window.innerHeight - h) / 2);
    Object.assign(root.style, {
      width: `${w}px`, height: `${h}px`, left: `${left}px`, top: `${top}px`,
    });
  }

  let open = true;
  function closeForce(reason = "close") {
    if (!open) return;
    open = false;
    root.remove();
    document.removeEventListener("keydown", onKeydown);
    onClose(reason);
  }
  function close() {
    if (canClose()) closeForce("close");
  }
  // Tombol X dan Minimize SELALU bisa menutup (jalan keluar eksplisit) — beda
  // dari Esc/penutupan tidak sengaja lainnya yang tetap dijaga oleh canClose().
  // Keduanya sama-sama menyembunyikan window secara visual, TAPI diberi alasan
  // ("close" vs "minimize") berbeda ke onClose() — supaya pemanggil bisa
  // membedakan: "close" berarti sesi ini benar-benar selesai (boleh reset state),
  // "minimize" berarti cuma disembunyikan sementara (state harus tetap utuh
  // supaya bisa dibuka lagi persis dari kondisi terakhir).
  closeBtn.addEventListener("click", () => closeForce("close"));
  minimizeBtn.addEventListener("click", () => closeForce("minimize"));

  function onKeydown(e) {
    if (e.key === "Escape") close();
  }
  document.addEventListener("keydown", onKeydown);

  function flash() {
    root.classList.add("floating-window--flash");
    setTimeout(() => root.classList.remove("floating-window--flash"), 500);
  }

  // ---- Geser (drag) lewat titlebar — desktop saja ----
  if (!mobile) {
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;

    titlebar.addEventListener("pointerdown", (e) => {
      if (e.target.closest(".floating-window__btn")) return; // jangan drag saat klik tombol
      dragging = true;
      titlebar.setPointerCapture(e.pointerId);
      startX = e.clientX;
      startY = e.clientY;
      startLeft = root.offsetLeft;
      startTop = root.offsetTop;
    });
    titlebar.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const newLeft = clamp(startLeft + (e.clientX - startX), 0, window.innerWidth - 80);
      const newTop = clamp(startTop + (e.clientY - startY), 0, window.innerHeight - 40);
      root.style.left = `${newLeft}px`;
      root.style.top = `${newTop}px`;
    });
    titlebar.addEventListener("pointerup", () => { dragging = false; });
    titlebar.addEventListener("pointercancel", () => { dragging = false; });

    // ---- Perbesar/perkecil (resize) lewat handle pojok kanan-bawah ----
    let resizing = false;
    let resizeStartX = 0;
    let resizeStartY = 0;
    let resizeStartW = 0;
    let resizeStartH = 0;

    resizeHandle.addEventListener("pointerdown", (e) => {
      resizing = true;
      resizeHandle.setPointerCapture(e.pointerId);
      resizeStartX = e.clientX;
      resizeStartY = e.clientY;
      resizeStartW = root.offsetWidth;
      resizeStartH = root.offsetHeight;
      e.preventDefault();
    });
    resizeHandle.addEventListener("pointermove", (e) => {
      if (!resizing) return;
      const maxW = window.innerWidth - root.offsetLeft - 10;
      const maxH = window.innerHeight - root.offsetTop - 10;
      const newW = clamp(resizeStartW + (e.clientX - resizeStartX), MIN_WIDTH, maxW);
      const newH = clamp(resizeStartH + (e.clientY - resizeStartY), MIN_HEIGHT, maxH);
      root.style.width = `${newW}px`;
      root.style.height = `${newH}px`;
    });
    resizeHandle.addEventListener("pointerup", () => { resizing = false; });
    resizeHandle.addEventListener("pointercancel", () => { resizing = false; });
  }

  return { root, bodyHost, close, closeForce, isOpen: () => open, flash };
}
