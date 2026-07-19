import { el } from "../utils/dom.util.js";

/**
 * skeleton.component.js
 * Placeholder shimmer loading, dipakai saat data sedang diambil (mis.
 * daftar spreadsheet setelah login) supaya terasa lebih responsif
 * dibanding teks "Memuat..." polos.
 */

/** Satu baris skeleton menyerupai bentuk .spreadsheet-item (ikon + 2 baris teks) */
export function renderSkeletonItem() {
  return el("div", { class: "skeleton-item" }, [
    el("div", { class: "skeleton skeleton-item__icon" }),
    el("div", { class: "skeleton-item__lines" }, [
      el("div", { class: "skeleton skeleton-item__line skeleton-item__line--wide" }),
      el("div", { class: "skeleton skeleton-item__line skeleton-item__line--narrow" }),
    ]),
  ]);
}

/** Daftar beberapa skeleton item sekaligus */
export function renderSkeletonList(count = 5) {
  return el("div", { class: "skeleton-list" }, Array.from({ length: count }, () => renderSkeletonItem()));
}
