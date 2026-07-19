import { el } from "../utils/dom.util.js";
import { icon } from "./icons.component.js";

export function renderTopbar({ title, subtitle, theme, session, onToggleTheme, onLogout, onOpenPalette, onToggleSidebar }) {
  return el("header", { class: "topbar" }, [
    el("button", { class: "topbar__menu-btn", onClick: onToggleSidebar, "aria-label": "Toggle menu", html: icon("menu", { size: 18 }) }),
    el("div", { class: "topbar__title-group" }, [
      el("h1", { class: "topbar__title" }, title),
      subtitle ? el("p", { class: "topbar__subtitle" }, subtitle) : null,
    ]),
    el("div", { class: "topbar__spacer" }),
    el("button", { class: "topbar__search", onClick: onOpenPalette }, [
      el("span", { html: icon("command", { size: 14 }) }),
      el("span", {}, "Cari perintah..."),
      el("kbd", { class: "kbd kbd--sm" }, "⌘K"),
    ]),
    el("button", { class: "icon-btn", onClick: onToggleTheme, "aria-label": "Toggle tema", html: icon(theme === "dark" ? "sun" : "moon", { size: 18 }) }),
    session
      ? el("div", { class: "topbar__user" }, [
          el("img", { class: "topbar__avatar", src: session.profile?.picture || "", alt: "avatar" }),
          el("span", { class: "topbar__user-name" }, session.profile?.name || session.profile?.email || "User"),
          el("button", { class: "icon-btn", onClick: onLogout, "aria-label": "Keluar", html: icon("logout", { size: 16 }) }),
        ])
      : null,
  ]);
}
