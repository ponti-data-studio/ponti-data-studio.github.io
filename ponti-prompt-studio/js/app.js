/* =========================================================
   app.js — bootstraps the application, wires all UI events
   ========================================================= */
(function () {
  "use strict";

  function $(id) {
    return document.getElementById(id);
  }

  /* ---------------- INIT THEME + SETTINGS ---------------- */
  function initSettings() {
    const settings = PPS_Store.getSettings();
    PPS_UI.applyTheme(settings.appearance, settings.accentColor === "custom" ? settings.customAccent : null);

    $("s_appearance").value = settings.appearance;
    $("s_accentColor").value = settings.accentColor;
    $("s_customAccent").value = settings.customAccent;
    $("customAccentRow").style.display = settings.accentColor === "custom" ? "" : "none";
    $("s_autoGenerate").checked = settings.autoGenerate;
    $("s_saveHistory").checked = settings.saveHistory;

    // populate default template dropdown
    const defTplSelect = $("s_defaultTemplate");
    defTplSelect.innerHTML = "";
    PPS_Templates.getBuiltinTemplates().forEach((t) => {
      const opt = document.createElement("option");
      opt.value = t.id;
      opt.textContent = t.name;
      defTplSelect.appendChild(opt);
    });
    defTplSelect.value = settings.defaultTemplate || "commercial-banner";
  }

  function saveSettingsFromUI() {
    const settings = {
      appearance: $("s_appearance").value,
      accentColor: $("s_accentColor").value,
      customAccent: $("s_customAccent").value,
      autoGenerate: $("s_autoGenerate").checked,
      saveHistory: $("s_saveHistory").checked,
      defaultTemplate: $("s_defaultTemplate").value,
    };
    PPS_Store.setSettings(settings);
    PPS_UI.applyTheme(settings.appearance, settings.accentColor === "custom" ? settings.customAccent : null);
  }

  function wireSettingsEvents() {
    ["s_appearance", "s_accentColor", "s_customAccent", "s_autoGenerate", "s_saveHistory", "s_defaultTemplate"].forEach((id) => {
      $(id).addEventListener("change", () => {
        $("customAccentRow").style.display = $("s_accentColor").value === "custom" ? "" : "none";
        saveSettingsFromUI();
      });
    });

    $("btnExportData").addEventListener("click", () => {
      try {
        const data = PPS_Store.exportAll();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `ponti-prompt-studio-backup-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        PPS_UI.toast("Data berhasil diekspor", "success");
      } catch (e) {
        PPS_UI.toast("Gagal mengekspor data.", "error");
      }
    });

    $("btnImportData").addEventListener("click", () => $("importFileInput").click());
    $("importFileInput").addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const data = JSON.parse(reader.result);
          PPS_Store.importAll(data);
          const ok = await PPS_UI.confirmDialog("Import berhasil", "Muat ulang halaman untuk menerapkan seluruh data?", "Muat Ulang", { icon: "success" });
          if (ok) location.reload();
        } catch (err) {
          PPS_UI.toast("File import tidak valid atau rusak.", "error");
        }
      };
      reader.readAsText(file);
      e.target.value = "";
    });

    $("btnClearAllData").addEventListener("click", async () => {
      const ok = await PPS_UI.confirmDialog(
        "Hapus semua data lokal?",
        "Seluruh history, template kustom, project, dan pengaturan akan dihapus permanen dari perangkat ini.",
        "Ya, hapus semua"
      );
      if (!ok) return;
      PPS_Store.clearAll();
      PPS_ImageStore.clear();
      PPS_UI.toast("Semua data lokal telah dihapus", "success");
      setTimeout(() => location.reload(), 800);
    });
  }

  /* ---------------- TEMPLATES PAGE ---------------- */
  function renderTemplatesPage() {
    const builtinGrid = $("builtinTemplateGrid");
    builtinGrid.innerHTML = "";
    PPS_Templates.getBuiltinTemplates().forEach((tpl) => {
      const card = document.createElement("div");
      card.className = "entity-card";
      card.innerHTML = `
        <span class="badge-tag">${PPS_UI.escapeHtml(tpl.category)}</span>
        <h3>${PPS_UI.escapeHtml(tpl.name)}</h3>
        <p class="meta">${PPS_UI.escapeHtml(tpl.description)}</p>
        <div class="card-actions">
          <button class="btn btn-accent btn-sm" data-use>Use Template</button>
        </div>
      `;
      card.querySelector("[data-use]").addEventListener("click", () => useTemplate(tpl.config));
      builtinGrid.appendChild(card);
    });

    const customGrid = $("customTemplateGrid");
    const customTemplates = PPS_Templates.getCustomTemplates();
    if (!customTemplates.length) {
      customGrid.innerHTML = `<p class="empty-state">Belum ada template kustom. Simpan konfigurasi dari halaman Generator.</p>`;
      return;
    }
    customGrid.innerHTML = "";
    customTemplates.forEach((tpl) => {
      const card = document.createElement("div");
      card.className = "entity-card";
      card.innerHTML = `
        <span class="badge-tag">${PPS_UI.escapeHtml(tpl.category || "Custom")}</span>
        <h3>${PPS_UI.escapeHtml(tpl.name)}</h3>
        <p class="meta">${PPS_UI.escapeHtml(tpl.description || "-")}</p>
        <div class="card-actions">
          <button class="btn btn-accent btn-sm" data-use>Use</button>
          <button class="btn btn-outline-soft btn-sm" data-edit>Edit</button>
          <button class="btn btn-outline-soft btn-sm" data-dup>Duplicate</button>
          <button class="btn btn-outline-danger btn-sm" data-del>Delete</button>
        </div>
      `;
      card.querySelector("[data-use]").addEventListener("click", () => useTemplate(tpl.config));
      card.querySelector("[data-edit]").addEventListener("click", async () => {
        const newName = await PPS_UI.promptDialog("Edit nama template", "Nama Template", tpl.name);
        if (newName) {
          PPS_Templates.updateCustomTemplate(tpl.id, { name: newName });
          renderTemplatesPage();
          PPS_History.renderDashboardStats();
        }
      });
      card.querySelector("[data-dup]").addEventListener("click", () => {
        PPS_Templates.duplicateCustomTemplate(tpl.id);
        renderTemplatesPage();
        PPS_History.renderDashboardStats();
        PPS_UI.toast("Template diduplikasi", "success");
      });
      card.querySelector("[data-del]").addEventListener("click", async () => {
        const ok = await PPS_UI.confirmDialog("Hapus template ini?", tpl.name, "Ya, hapus");
        if (ok) {
          PPS_Templates.deleteCustomTemplate(tpl.id);
          renderTemplatesPage();
          PPS_History.renderDashboardStats();
        }
      });
      customGrid.appendChild(card);
    });
  }

  function useTemplate(config) {
    PPS_Generator.applyConfigToForm(config);
    PPS_UI.goto("generator");
    PPS_Generator.generatePrompt({ silent: true });
    PPS_UI.toast("Template diterapkan ke Generator", "success");
  }

  /* ---------------- PROJECTS PAGE ---------------- */
  function renderProjectsPage() {
    const grid = $("projectGrid");
    const projects = PPS_Store.getProjects();
    if (!projects.length) {
      grid.innerHTML = `<p class="empty-state">Belum ada project. Buat project pertama Anda.</p>`;
      return;
    }
    grid.innerHTML = "";
    projects.forEach((proj) => {
      const card = document.createElement("div");
      card.className = "entity-card";
      card.innerHTML = `
        <h3>${PPS_UI.escapeHtml(proj.name)}</h3>
        <p class="meta">Brand: ${PPS_UI.escapeHtml(proj.brand || "-")} • ${(proj.prompts || []).length} prompt</p>
        <p class="meta">Dibuat: ${PPS_History.formatDate(proj.createdAt)}</p>
        <div class="card-actions">
          <button class="btn btn-accent btn-sm" data-attach>Tambah Prompt Aktif</button>
          <button class="btn btn-outline-danger btn-sm" data-del>Delete</button>
        </div>
      `;
      card.querySelector("[data-attach]").addEventListener("click", () => {
        const lastPrompt = PPS_Store.getLastPrompt();
        if (!lastPrompt) {
          PPS_UI.toast("Belum ada prompt aktif. Generate prompt terlebih dahulu.", "warning");
          return;
        }
        proj.prompts = proj.prompts || [];
        proj.prompts.unshift({ json: lastPrompt.json, addedAt: new Date().toISOString() });
        const list = PPS_Store.getProjects().map((p) => (p.id === proj.id ? proj : p));
        PPS_Store.setProjects(list);
        renderProjectsPage();
        PPS_UI.toast("Prompt ditambahkan ke project", "success");
      });
      card.querySelector("[data-del]").addEventListener("click", async () => {
        const ok = await PPS_UI.confirmDialog("Hapus project ini?", proj.name, "Ya, hapus");
        if (ok) {
          PPS_Store.setProjects(PPS_Store.getProjects().filter((p) => p.id !== proj.id));
          renderProjectsPage();
          PPS_History.renderDashboardStats();
        }
      });
      grid.appendChild(card);
    });
  }

  function wireProjectEvents() {
    $("btnNewProject").addEventListener("click", async () => {
      const name = await PPS_UI.promptDialog("Project Baru", "Nama Project", "Ponti Data ID Campaign");
      if (!name) return;
      const cfg = PPS_Generator.collectFormConfig();
      const projects = PPS_Store.getProjects();
      projects.unshift({
        id: "proj_" + Date.now(),
        name,
        brand: cfg.brandName,
        campaign: cfg.productName,
        createdAt: new Date().toISOString(),
        prompts: [],
      });
      PPS_Store.setProjects(projects);
      renderProjectsPage();
      PPS_History.renderDashboardStats();
      PPS_UI.toast("Project berhasil dibuat", "success");
    });
  }

  /* ---------------- GENERATOR PAGE WIRING ---------------- */
  function wireGeneratorEvents() {
    const form = $("generatorForm");

    // auto-generate on any input change
    form.addEventListener("input", (e) => {
      if (e.target.id === "f_productPosition") return; // handled by change
      PPS_Generator.scheduleAutoGenerate();
    });

    $("f_productPosition").addEventListener("change", () => {
      PPS_Generator.updatePlacementRuleFromPosition();
      PPS_Generator.scheduleAutoGenerate();
    });

    // color pickers sync with hex text fields
    const syncColor = (pickerId, textId) => {
      $(pickerId).addEventListener("input", () => {
        $(textId).value = $(pickerId).value;
        PPS_Generator.scheduleAutoGenerate();
      });
      $(textId).addEventListener("input", () => {
        const v = $(textId).value;
        if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) $(pickerId).value = v;
      });
    };
    syncColor("f_primaryColorPicker", "f_primaryColor");
    syncColor("f_secondaryColorPicker", "f_secondaryColor");

    // repeaters
    $("btnAddFeature").addEventListener("click", () => {
      PPS_Generator.addRepeaterItem(PPS_Generator.getFeatureItems(), $("featureRepeater"), PPS_Generator.scheduleAutoGenerate, "Contoh: Anti-Cheat");
    });
    $("btnAddRule").addEventListener("click", () => {
      PPS_Generator.addRepeaterItem(PPS_Generator.getRuleItems(), $("ruleRepeater"), PPS_Generator.scheduleAutoGenerate, "Contoh: Rule of thirds for balanced layout");
    });

    // negative prompt smart button
    $("btnSmartNegative").addEventListener("click", PPS_Generator.generateSmartNegativePrompt);

    // generate / reset
    $("btnGeneratePrompt").addEventListener("click", () => PPS_Generator.generatePrompt());
    form.addEventListener("submit", (e) => e.preventDefault());
    $("btnResetForm").addEventListener("click", async () => {
      const ok = await PPS_UI.confirmDialog("Reset form?", "Semua isian akan kembali ke default template.", "Ya, reset");
      if (ok) PPS_Generator.resetForm();
    });

    // copy/download/clear/fullscreen
    $("btnCopyJson").addEventListener("click", PPS_Generator.copyJsonToClipboard);
    $("btnDownloadJson").addEventListener("click", PPS_Generator.downloadJson);
    $("btnClearJson").addEventListener("click", PPS_Generator.clearJson);
    $("btnFullscreenJson").addEventListener("click", () => {
      const lastPrompt = PPS_Store.getLastPrompt();
      $("fullscreenCode").textContent = lastPrompt ? lastPrompt.json : "";
      $("fullscreenOverlay").classList.remove("d-none");
    });
    $("btnCloseFullscreen").addEventListener("click", () => $("fullscreenOverlay").classList.add("d-none"));

    // save as template
    $("btnSaveAsTemplate").addEventListener("click", async () => {
      const name = await PPS_UI.promptDialog("Simpan sebagai Template", "Nama Template", $("f_productName").value || "Template Saya");
      if (!name) return;
      const cfg = PPS_Generator.collectFormConfig();
      PPS_Templates.saveCustomTemplate({ name, description: cfg.headline, category: "Custom", config: cfg });
      PPS_UI.toast("Template berhasil disimpan", "success");
      renderTemplatesPage();
    });

    // image upload / dropzone
    const dropzone = $("dropzone");
    const fileInput = $("f_imageInput");
    $("btnBrowseFiles").addEventListener("click", (e) => {
      e.stopPropagation();
      fileInput.click();
    });
    dropzone.addEventListener("click", () => fileInput.click());
    dropzone.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        fileInput.click();
      }
    });
    fileInput.addEventListener("change", (e) => PPS_Generator.handleFiles(e.target.files));
    ["dragenter", "dragover"].forEach((evt) =>
      dropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        dropzone.classList.add("dragover");
      })
    );
    ["dragleave", "drop"].forEach((evt) =>
      dropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        dropzone.classList.remove("dragover");
      })
    );
    dropzone.addEventListener("drop", (e) => {
      if (e.dataTransfer && e.dataTransfer.files.length) PPS_Generator.handleFiles(e.dataTransfer.files);
    });
  }

  /* ---------------- HISTORY PAGE WIRING ---------------- */
  function wireHistoryEvents() {
    $("btnClearHistory").addEventListener("click", async () => {
      const ok = await PPS_UI.confirmDialog("Kosongkan seluruh riwayat?", "Tindakan ini tidak dapat dibatalkan.", "Ya, kosongkan");
      if (ok) {
        PPS_History.clearHistory();
        PPS_History.renderHistoryTable();
        PPS_History.renderDashboardStats();
        PPS_UI.toast("Riwayat berhasil dikosongkan", "success");
      }
    });
  }

  /* ---------------- NAVIGATION WIRING ---------------- */
  function wireNavigation() {
    document.querySelectorAll("[data-route]").forEach((btn) => {
      btn.addEventListener("click", () => PPS_UI.goto(btn.dataset.route));
    });
    document.querySelectorAll("[data-goto]").forEach((btn) => {
      btn.addEventListener("click", () => PPS_UI.goto(btn.dataset.goto));
    });

    window.addEventListener("pps:route", (e) => {
      const route = e.detail.route;
      if (route === "dashboard") PPS_History.renderDashboardStats();
      if (route === "templates") renderTemplatesPage();
      if (route === "projects") renderProjectsPage();
      if (route === "history") PPS_History.renderHistoryTable();
    });

    // mobile topbar
    const openBtn = $("btnOpenSidebar");
    if (openBtn && typeof bootstrap !== "undefined") {
      openBtn.addEventListener("click", () => {
        const off = bootstrap.Offcanvas.getOrCreateInstance($("mobileSidebar"));
        off.show();
      });
    }
    $("btnThemeToggleDesktop").addEventListener("click", () => {
      PPS_UI.toggleThemeQuick();
      initSettings();
    });
    $("btnThemeToggleMobile").addEventListener("click", () => {
      PPS_UI.toggleThemeQuick();
      initSettings();
    });
  }

  /* ---------------- FULLSCREEN OVERLAY ---------------- */
  function wireFullscreenEsc() {
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") $("fullscreenOverlay").classList.add("d-none");
    });
  }

  /* ---------------- BOOTSTRAP ---------------- */
  function init() {
    PPS_UI.checkCdnAndFallback();
    initSettings();
    wireSettingsEvents();
    wireNavigation();
    wireGeneratorEvents();
    wireHistoryEvents();
    wireProjectEvents();
    wireFullscreenEsc();

    // Load default template (section 30) on first open, or last prompt config if available
    const lastPrompt = PPS_Store.getLastPrompt();
    if (lastPrompt && lastPrompt.config) {
      PPS_Generator.applyConfigToForm(lastPrompt.config);
    } else {
      const settings = PPS_Store.getSettings();
      const defTpl = PPS_Templates.getBuiltinById(settings.defaultTemplate) || PPS_Templates.getBuiltinById("commercial-banner");
      PPS_Generator.applyConfigToForm(defTpl.config);
    }
    PPS_Generator.updatePlacementRuleFromPosition();
    PPS_Generator.generatePrompt({ silent: true });

    renderTemplatesPage();
    renderProjectsPage();
    PPS_History.renderHistoryTable();
    PPS_History.renderDashboardStats();

    // initial route from hash
    const initialRoute = (location.hash || "#dashboard").replace("#", "");
    PPS_UI.goto(PPS_UI.ROUTES.includes(initialRoute) ? initialRoute : "dashboard");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
