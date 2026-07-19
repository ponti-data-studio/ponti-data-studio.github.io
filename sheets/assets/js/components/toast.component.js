import { el, qs } from "../utils/dom.util.js";
import { icon } from "./icons.component.js";

function ensureContainer() {
  let container = qs("#toast-container");
  if (!container) {
    container = el("div", { id: "toast-container", class: "toast-container" });
    document.body.appendChild(container);
  }
  return container;
}

const ICONS_BY_TYPE = { success: "check", error: "alert", info: "sparkles", warning: "alert" };

export function showToast(message, type = "info", duration = 3500) {
  const container = ensureContainer();
  const node = el("div", { class: `toast toast--${type}` }, [
    el("span", { class: "toast__icon", html: icon(ICONS_BY_TYPE[type] || "sparkles", { size: 16 }) }),
    el("span", { class: "toast__message" }, message),
  ]);
  container.appendChild(node);
  requestAnimationFrame(() => node.classList.add("toast--visible"));
  setTimeout(() => {
    node.classList.remove("toast--visible");
    setTimeout(() => node.remove(), 250);
  }, duration);
}
