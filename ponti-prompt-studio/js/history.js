/* =========================================================
   history.js — prompt history CRUD + rendering
   ========================================================= */
(function (global) {
  "use strict";

  function makeId() {
    return "hist_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
  }

  function addHistoryItem(cfg, json) {
    const list = PPS_Store.getHistory();

    // Prevent duplicate consecutive entries (same config content)
    if (list.length && list[0].json === json) return list[0];

    const item = {
      id: makeId(),
      projectName: cfg.productName || cfg.headline || "Untitled Prompt",
      brand: cfg.brandName || "-",
      headline: cfg.headline || "-",
      style: cfg.stylePreset || "-",
      aspectRatio: cfg.aspectRatio || "-",
      createdAt: new Date().toISOString(),
      json,
      config: cfg,
    };
    list.unshift(item);
    PPS_Store.setHistory(list); // setHistory trims to 50
    return item;
  }

  function getHistory() {
    return PPS_Store.getHistory();
  }

  function deleteHistoryItem(id) {
    const list = PPS_Store.getHistory().filter((h) => h.id !== id);
    PPS_Store.setHistory(list);
  }

  function clearHistory() {
    PPS_Store.setHistory([]);
  }

  function formatDate(iso) {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) + " " + d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
    } catch (e) {
      return iso;
    }
  }

  function renderHistoryTable() {
    const tbody = document.getElementById("historyTableBody");
    const list = getHistory();
    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty-state">Belum ada riwayat prompt.</td></tr>`;
      return;
    }
    tbody.innerHTML = "";
    list.forEach((item) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${PPS_UI.escapeHtml(item.projectName)}</td>
        <td>${PPS_UI.escapeHtml(item.brand)}</td>
        <td>${PPS_UI.escapeHtml(item.headline)}</td>
        <td>${PPS_UI.escapeHtml(item.style)}</td>
        <td>${PPS_UI.escapeHtml(item.aspectRatio)}</td>
        <td>${formatDate(item.createdAt)}</td>
        <td class="history-actions">
          <button class="icon-btn" data-action="view" title="Lihat">👁</button>
          <button class="icon-btn" data-action="copy" title="Copy">⧉</button>
          <button class="icon-btn" data-action="edit" title="Edit">✎</button>
          <button class="icon-btn" data-action="delete" title="Hapus">🗑</button>
        </td>
      `;
      tr.querySelector('[data-action="view"]').addEventListener("click", () => {
        PPS_UI.renderCodeViewer(item.json);
        document.getElementById("fullscreenCode").textContent = item.json;
        document.getElementById("fullscreenOverlay").classList.remove("d-none");
      });
      tr.querySelector('[data-action="copy"]').addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(item.json);
          PPS_UI.toast("Copied!", "success");
        } catch (e) {
          PPS_UI.toast("Gagal menyalin.", "error");
        }
      });
      tr.querySelector('[data-action="edit"]').addEventListener("click", () => {
        PPS_Generator.applyConfigToForm(item.config);
        PPS_UI.goto("generator");
        PPS_Generator.generatePrompt({ silent: true });
      });
      tr.querySelector('[data-action="delete"]').addEventListener("click", async () => {
        const ok = await PPS_UI.confirmDialog("Hapus riwayat ini?", "Tindakan ini tidak dapat dibatalkan.", "Ya, hapus");
        if (ok) {
          deleteHistoryItem(item.id);
          renderHistoryTable();
          renderDashboardStats();
        }
      });
      tbody.appendChild(tr);
    });
  }

  function renderDashboardStats() {
    const totalPrompts = getHistory().length;
    const totalTemplates = PPS_Templates.getCustomTemplates().length + PPS_Templates.getBuiltinTemplates().length;
    const totalProjects = PPS_Store.getProjects().length;
    const totalHistory = getHistory().length;

    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };
    set("statTotalPrompts", totalPrompts);
    set("statTotalTemplates", totalTemplates);
    set("statTotalProjects", totalProjects);
    set("statTotalHistory", totalHistory);

    const recentWrap = document.getElementById("recentActivityList");
    const recent = getHistory().slice(0, 5);
    if (!recent.length) {
      recentWrap.innerHTML = `<p class="empty-state">Belum ada aktivitas. Mulai dengan membuat prompt pertama Anda.</p>`;
      return;
    }
    recentWrap.innerHTML = "";
    recent.forEach((item) => {
      const row = document.createElement("div");
      row.className = "recent-item";
      row.innerHTML = `<span>${PPS_UI.escapeHtml(item.projectName)} — <span class="text-muted-sm">${PPS_UI.escapeHtml(item.style)}</span></span><span class="text-muted-sm">${formatDate(item.createdAt)}</span>`;
      recentWrap.appendChild(row);
    });
  }

  global.PPS_History = {
    addHistoryItem,
    getHistory,
    deleteHistoryItem,
    clearHistory,
    renderHistoryTable,
    renderDashboardStats,
    formatDate,
  };
})(window);
