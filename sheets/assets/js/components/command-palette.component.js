import { el, clear } from "../utils/dom.util.js";
import { icon } from "./icons.component.js";
import { MENU_ITEMS } from "../config/app.config.js";

let overlay = null;

export function openCommandPalette(onNavigate) {
  if (overlay) return;

  const input = el("input", { type: "text", class: "command-palette__input", placeholder: "Ketik perintah atau nama halaman...", autofocus: "true" });
  const resultsHost = el("div", { class: "command-palette__results" });

  function renderResults(query = "") {
    clear(resultsHost);
    const q = query.toLowerCase();
    const matches = MENU_ITEMS.filter((m) => m.label.toLowerCase().includes(q));
    if (matches.length === 0) {
      resultsHost.appendChild(el("div", { class: "command-palette__empty" }, "Tidak ada hasil."));
      return;
    }
    matches.forEach((m, idx) => {
      const item = el("button", { class: `command-palette__item ${idx === 0 ? "command-palette__item--active" : ""}`, onClick: () => {
        onNavigate(m.id);
        close();
      }}, [
        el("span", { html: icon(m.icon, { size: 16 }) }),
        el("span", {}, m.label),
      ]);
      resultsHost.appendChild(item);
    });
  }

  input.addEventListener("input", (e) => renderResults(e.target.value));

  overlay = el("div", { class: "command-palette-overlay", onClick: (e) => { if (e.target === overlay) close(); } }, [
    el("div", { class: "command-palette" }, [
      el("div", { class: "command-palette__header" }, [
        el("span", { html: icon("command", { size: 16 }) }),
        input,
        el("kbd", { class: "kbd kbd--sm" }, "ESC"),
      ]),
      resultsHost,
    ]),
  ]);

  document.body.appendChild(overlay);
  renderResults();
  setTimeout(() => input.focus(), 30);

  document.addEventListener("keydown", handleEscape);
}

function handleEscape(e) {
  if (e.key === "Escape") close();
}

function close() {
  if (overlay) {
    overlay.remove();
    overlay = null;
  }
  document.removeEventListener("keydown", handleEscape);
}
