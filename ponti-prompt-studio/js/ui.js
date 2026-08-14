/* =========================================================
   ui.js — toasts, theme switching, view routing, JSON highlight
   ========================================================= */
(function (global) {
  "use strict";

  /* ---------------- Toast / Alert (SweetAlert2 with safe fallback) ---------------- */
  function toast(message, icon = "success") {
    if (typeof Swal !== "undefined") {
      Swal.fire({
        toast: true,
        position: "top-end",
        showConfirmButton: false,
        timer: 2200,
        timerProgressBar: true,
        icon,
        title: message,
      });
    } else {
      // Minimal fallback toast (no CDN)
      const el = document.createElement("div");
      el.className = "pps-fallback-toast";
      el.textContent = message;
      el.style.cssText =
        "position:fixed;top:16px;right:16px;background:#151c21;color:#fff;padding:10px 16px;" +
        "border-radius:10px;font-size:13px;z-index:9999;box-shadow:0 8px 24px rgba(0,0,0,.3);";
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 2200);
    }
  }

  function confirmDialog(title, text, confirmText = "Ya, lanjutkan", opts = {}) {
    if (typeof Swal !== "undefined") {
      return Swal.fire({
        title,
        text,
        icon: opts.icon || "warning",
        showCancelButton: true,
        confirmButtonText: confirmText,
        cancelButtonText: "Batal",
        confirmButtonColor: "#0cacd0",
        reverseButtons: true,
      }).then((r) => r.isConfirmed);
    }
    return Promise.resolve(window.confirm(`${title}\n${text}`));
  }

  async function promptDialog(title, inputLabel, defaultValue = "") {
    if (typeof Swal !== "undefined") {
      const r = await Swal.fire({
        title,
        input: "text",
        inputLabel,
        inputValue: defaultValue,
        showCancelButton: true,
        confirmButtonText: "Simpan",
        cancelButtonText: "Batal",
        confirmButtonColor: "#0cacd0",
      });
      return r.isConfirmed ? r.value : null;
    }
    return window.prompt(`${title}\n${inputLabel}`, defaultValue);
  }

  /* ---------------- Theme handling ---------------- */
  function applyTheme(mode, customAccent) {
    const root = document.documentElement;
    let effective = mode;
    if (mode === "system") {
      effective = global.matchMedia && global.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    root.setAttribute("data-theme", effective);
    const label = document.getElementById("themeToggleLabel");
    if (label) label.textContent = effective === "dark" ? "Light Mode" : "Dark Mode";
    if (customAccent) {
      root.style.setProperty("--accent", customAccent);
    } else {
      root.style.setProperty("--accent", "#0cacd0");
    }
  }

  function toggleThemeQuick() {
    const settings = PPS_Store.getSettings();
    const current = document.documentElement.getAttribute("data-theme");
    const next = current === "dark" ? "light" : "dark";
    settings.appearance = next;
    PPS_Store.setSettings(settings);
    applyTheme(next, settings.accentColor === "custom" ? settings.customAccent : null);
    const sel = document.getElementById("s_appearance");
    if (sel) sel.value = next;
  }

  /* ---------------- Routing ---------------- */
  const ROUTES = ["dashboard", "generator", "templates", "projects", "history", "settings"];

  function goto(route) {
    if (ROUTES.indexOf(route) === -1) route = "dashboard";
    ROUTES.forEach((r) => {
      const view = document.getElementById("view-" + r);
      if (view) view.classList.toggle("d-none", r !== route);
    });
    document.querySelectorAll(".nav-item").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.route === route);
    });
    global.location.hash = route;
    document.getElementById("mainContent").scrollTop = 0;
    global.scrollTo({ top: 0, behavior: "instant" in document.documentElement.style ? "instant" : "auto" });

    // close mobile offcanvas if open
    const off = document.getElementById("mobileSidebar");
    if (off && typeof bootstrap !== "undefined") {
      const inst = bootstrap.Offcanvas.getInstance(off);
      if (inst) inst.hide();
    }
    global.dispatchEvent(new CustomEvent("pps:route", { detail: { route } }));
  }

  /* ---------------- JSON syntax highlight (no external lib) ---------------- */
  function escapeHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function highlightJson(jsonString) {
    const escaped = escapeHtml(jsonString);
    return escaped.replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(\.\d+)?([eE][+-]?\d+)?)/g,
      (match) => {
        let cls = "tok-num";
        if (/^"/.test(match)) {
          cls = /:$/.test(match) ? "tok-key" : "tok-str";
        } else if (/true|false/.test(match)) {
          cls = "tok-bool";
        } else if (/null/.test(match)) {
          cls = "tok-punc";
        }
        return `<span class="${cls}">${match}</span>`;
      }
    );
  }

  function renderCodeViewer(jsonString) {
    const linesWrap = document.getElementById("codeLines");
    const content = document.getElementById("codeContent");
    if (!linesWrap || !content) return;
    const lineCount = jsonString ? jsonString.split("\n").length : 1;
    let lineNumbers = "";
    for (let i = 1; i <= lineCount; i++) lineNumbers += i + "\n";
    linesWrap.textContent = lineNumbers;
    content.innerHTML = jsonString ? highlightJson(jsonString) : "";
  }

  /* ---------------- CDN availability check ---------------- */
  function checkCdnAndFallback() {
    const bootstrapLoaded = typeof bootstrap !== "undefined";
    const swalLoaded = typeof Swal !== "undefined";
    const bsCssLoaded = Array.from(document.styleSheets).some((s) => {
      try {
        return s.href && s.href.indexOf("bootstrap") !== -1 && s.cssRules && s.cssRules.length > 0;
      } catch (e) {
        return false;
      }
    });
    if (!bootstrapLoaded || !swalLoaded || !bsCssLoaded) {
      const notice = document.getElementById("cdnFallbackNotice");
      if (notice) notice.classList.remove("d-none");
    }
  }

  global.PPS_UI = {
    toast,
    confirmDialog,
    promptDialog,
    applyTheme,
    toggleThemeQuick,
    goto,
    ROUTES,
    highlightJson,
    renderCodeViewer,
    escapeHtml,
    checkCdnAndFallback,
  };
})(window);
