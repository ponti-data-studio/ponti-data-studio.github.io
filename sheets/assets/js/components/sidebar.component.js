import { el } from "../utils/dom.util.js";
import { icon } from "./icons.component.js";
import { MENU_ITEMS, APP_CONFIG } from "../config/app.config.js";

export function renderSidebar(activeRoute, onNavigate) {
  const nav = el("nav", { class: "sidebar__nav" },
    MENU_ITEMS.map((item) =>
      el("button", {
        class: `sidebar__item ${activeRoute === item.id ? "sidebar__item--active" : ""}`,
        "data-route": item.id,
        onClick: () => onNavigate(item.id),
      }, [
        el("span", { class: "sidebar__icon", html: icon(item.icon, { size: 18 }) }),
        el("span", { class: "sidebar__label" }, item.label),
      ])
    )
  );

  return el("aside", { class: "sidebar", id: "sidebar" }, [
    el("div", { class: "sidebar__brand" }, [
      el("div", { class: "sidebar__logo" }, "PS"),
      el("div", {}, [
        el("div", { class: "sidebar__brand-name" }, APP_CONFIG.name),
        el("div", { class: "sidebar__brand-tag" }, "AI-Ready Database"),
      ]),
    ]),
    nav,
    el("div", { class: "sidebar__footer" }, [
      el("kbd", { class: "kbd" }, "⌘"),
      el("kbd", { class: "kbd" }, "K"),
      el("span", { class: "sidebar__footer-text" }, "Command Palette"),
    ]),
  ]);
}
