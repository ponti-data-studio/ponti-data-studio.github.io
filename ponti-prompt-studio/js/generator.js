/* =========================================================
   generator.js — form state, JSON generation engine
   ========================================================= */
(function (global) {
  "use strict";

  const PLACEMENT_TEMPLATES = {
    Left: "Place the main product composition clearly on the LEFT side. Reserve the RIGHT for headline, features list and CTA. Maintain balance and rhythm.",
    Right: "Place the main product composition clearly on the RIGHT side. Reserve the LEFT for headline, features list and CTA. Maintain balance and rhythm.",
    Center: "Place the main product composition in the CENTER as the dominant focal point. Keep sufficient negative space around the product for supporting information.",
  };

  const SMART_NEGATIVE_BY_STYLE = {
    "E-commerce": ["cheap composition", "amateur design", "poor product presentation"],
    "Premium Corporate": ["cheap composition", "amateur design", "poor product presentation"],
    Luxury: ["cheap materials", "oversaturated colors", "amateur luxury aesthetic"],
    Futuristic: ["outdated interface", "primitive technology", "excessive clutter"],
    "Modern Tech": ["outdated interface", "primitive technology", "excessive clutter"],
  };

  const ASPECT_LABELS = {
    "1:1": "1:1 (Square)",
    "4:5": "4:5 (Portrait / Social)",
    "9:16": "9:16 (Story / Reels / Mobile)",
    "16:9": "16:9 (Landing Page / Web Banner)",
    "3:4": "3:4 (Portrait)",
    "4:3": "4:3 (Standard)",
    "21:9": "21:9 (Ultrawide / Cinematic)",
  };

  let uploadedImages = []; // {id, name, dataUrl}
  let featureItems = [];
  let ruleItems = [];

  /* ---------------- Repeater rendering ---------------- */
  function renderRepeater(containerEl, items, onChange, placeholder) {
    containerEl.innerHTML = "";
    items.forEach((val, idx) => {
      const row = document.createElement("div");
      row.className = "repeater-row";
      row.draggable = true;
      row.dataset.idx = idx;
      row.innerHTML = `
        <span class="repeater-drag" title="Seret untuk mengurutkan">⠿</span>
        <input type="text" class="form-control" value="${PPS_UI.escapeHtml(val)}" placeholder="${placeholder}">
        <button type="button" class="repeater-remove" aria-label="Hapus item">✕</button>
      `;
      const input = row.querySelector("input");
      input.addEventListener("input", () => {
        items[idx] = input.value;
        onChange();
      });
      row.querySelector(".repeater-remove").addEventListener("click", () => {
        items.splice(idx, 1);
        renderRepeater(containerEl, items, onChange, placeholder);
        onChange();
      });
      row.addEventListener("dragstart", () => row.classList.add("dragging"));
      row.addEventListener("dragend", () => row.classList.remove("dragging"));
      row.addEventListener("dragover", (e) => {
        e.preventDefault();
        const dragging = containerEl.querySelector(".dragging");
        if (!dragging || dragging === row) return;
        const rows = Array.from(containerEl.children);
        const draggingIdx = rows.indexOf(dragging);
        const targetIdx = rows.indexOf(row);
        if (draggingIdx < targetIdx) row.after(dragging);
        else row.before(dragging);
      });
      row.addEventListener("drop", () => {
        const newOrder = Array.from(containerEl.children).map((r) => r.querySelector("input").value);
        items.length = 0;
        items.push(...newOrder);
        onChange();
      });
      containerEl.appendChild(row);
    });
  }

  function addRepeaterItem(items, containerEl, onChange, placeholder, defaultVal = "") {
    items.push(defaultVal);
    renderRepeater(containerEl, items, onChange, placeholder);
    onChange();
  }

  /* ---------------- Field getters/setters ---------------- */
  function $(id) {
    return document.getElementById(id);
  }

  function collectFormConfig() {
    return {
      brandName: $("f_brandName").value.trim(),
      productName: $("f_productName").value.trim(),
      headline: $("f_headline").value.trim(),
      subheadline: $("f_subheadline").value.trim(),
      description: $("f_description").value.trim(),
      cta: $("f_cta").value.trim(),
      imageCount: parseInt($("f_imageCount").value, 10) || 1,
      productPosition: $("f_productPosition").value,
      composition: $("f_composition").value,
      placementRule: $("f_placementRule").value.trim(),
      integration: $("f_integration").value.trim(),
      positionLock: $("f_positionLock").checked,
      features: featureItems.filter((f) => f && f.trim()),
      uiElements: $("f_uiElements").value,
      includeCta: $("f_includeCta").checked,
      stylePreset: $("f_stylePreset").value,
      primaryColor: $("f_primaryColor").value.trim(),
      secondaryColor: $("f_secondaryColor").value.trim(),
      lighting: $("f_lighting").value,
      aesthetic: $("f_aesthetic").value.trim(),
      typography: $("f_typography").value.trim(),
      compositionRules: ruleItems.filter((r) => r && r.trim()),
      negativePrompt: $("f_negativePrompt").value.trim(),
      aspectRatio: $("f_aspectRatio").value,
      quality: $("f_quality").value,
      photorealism: $("f_photorealism").value,
    };
  }

  function applyConfigToForm(cfg) {
    $("f_brandName").value = cfg.brandName || "";
    $("f_productName").value = cfg.productName || "";
    $("f_headline").value = cfg.headline || "";
    $("f_subheadline").value = cfg.subheadline || "";
    $("f_description").value = cfg.description || "";
    $("f_cta").value = cfg.cta || "";
    $("f_imageCount").value = cfg.imageCount || 1;
    $("f_productPosition").value = cfg.productPosition || "Left";
    $("f_composition").value = cfg.composition || "Single Hero Product";
    $("f_placementRule").value = cfg.placementRule || PLACEMENT_TEMPLATES[cfg.productPosition || "Left"];
    $("f_integration").value = cfg.integration || "";
    $("f_positionLock").checked = !!cfg.positionLock;
    $("f_uiElements").value = cfg.uiElements || "None";
    $("f_includeCta").checked = cfg.includeCta !== false;
    $("f_stylePreset").value = cfg.stylePreset || "Minimal Clean";
    $("f_primaryColor").value = cfg.primaryColor || "#0cacd0";
    $("f_primaryColorPicker").value = cfg.primaryColor || "#0cacd0";
    $("f_secondaryColor").value = cfg.secondaryColor || "#ffffff";
    $("f_secondaryColorPicker").value = cfg.secondaryColor || "#ffffff";
    $("f_lighting").value = cfg.lighting || "Diffused Softbox";
    $("f_aesthetic").value = cfg.aesthetic || "";
    $("f_typography").value = cfg.typography || "";
    $("f_negativePrompt").value = cfg.negativePrompt || "";
    $("f_aspectRatio").value = cfg.aspectRatio || "16:9";
    $("f_quality").value = cfg.quality || "High";
    $("f_photorealism").value = cfg.photorealism || "Ultra-realistic, 8k resolution";

    featureItems = Array.isArray(cfg.features) ? cfg.features.slice() : [];
    ruleItems = Array.isArray(cfg.compositionRules) ? cfg.compositionRules.slice() : [];
    renderRepeater($("featureRepeater"), featureItems, scheduleAutoGenerate, "Contoh: Anti-Cheat");
    renderRepeater($("ruleRepeater"), ruleItems, scheduleAutoGenerate, "Contoh: Rule of thirds for balanced layout");
  }

  /* ---------------- Placement rule auto-fill ---------------- */
  function updatePlacementRuleFromPosition() {
    const pos = $("f_productPosition").value;
    const field = $("f_placementRule");
    // Only auto-overwrite if field is empty or still matches a known template (avoid clobbering manual edits)
    const current = field.value.trim();
    const isKnownTemplate = Object.values(PLACEMENT_TEMPLATES).includes(current) || current === "";
    if (isKnownTemplate) {
      field.value = PLACEMENT_TEMPLATES[pos] || "";
    }
  }

  /* ---------------- Smart negative prompt ---------------- */
  function generateSmartNegativePrompt() {
    const field = $("f_negativePrompt");
    const style = $("f_stylePreset").value;
    const current = field.value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const additions = SMART_NEGATIVE_BY_STYLE[style] || [];
    const merged = current.slice();
    additions.forEach((term) => {
      if (!merged.some((m) => m.toLowerCase() === term.toLowerCase())) merged.push(term);
    });
    field.value = merged.join(", ");
    scheduleAutoGenerate();
    PPS_UI.toast("Negative prompt diperbarui untuk gaya: " + style, "success");
  }

  /* ---------------- Build final JSON structure ---------------- */
  function buildPromptObject(cfg) {
    const aspectLabel = ASPECT_LABELS[cfg.aspectRatio] || cfg.aspectRatio;
    const subjectParts = [];
    subjectParts.push(
      `A professional promotional banner for ${cfg.brandName || "the brand"}`
    );
    if (cfg.productName) subjectParts.push(`featuring ${cfg.productName}`);

    return {
      task_type: "commercial_banner_generation",
      system_directive:
        "You are an elite Commercial Art Director and Graphic Designer. Create a premium product promotional banner based on the exact specifications below. Ensure the provided product image(s) are seamlessly integrated.",
      model_parameters: {
        aspect_ratio: aspectLabel,
        style_preset: cfg.stylePreset,
        quality: cfg.quality.toLowerCase(),
        photorealism: cfg.photorealism,
      },
      prompt_structure: {
        subject: subjectParts.join(" "),
        branding_elements: {
          brand_name: cfg.brandName,
          headline: cfg.headline,
          subheadline: cfg.subheadline,
          description: cfg.description,
          call_to_action: cfg.includeCta ? cfg.cta : "",
        },
        product_visual_layout: {
          expected_images_count: cfg.imageCount,
          product_position: cfg.productPosition,
          composition_style: cfg.composition,
          placement_rule: cfg.placementRule + (cfg.positionLock ? " POSITION LOCK: The composition MUST strictly follow the requested visual positioning." : ""),
          integration_and_blending: cfg.integration,
        },
        information_layout: {
          features: cfg.features,
          ui_elements: cfg.uiElements,
          include_cta: cfg.includeCta,
          cta_rule: cfg.includeCta ? "" : "Keep the layout free of CTA buttons unless explicitly required.",
        },
        visual_style_details: {
          style_preset: cfg.stylePreset,
          primary_accent_color: cfg.primaryColor,
          secondary_background: cfg.secondaryColor,
          color_harmony: "Create a cohesive color grading using these specific hex colors as the dominant palette.",
          lighting_setup: cfg.lighting,
          aesthetic_keywords: cfg.aesthetic,
        },
        typography_instructions: cfg.typography,
        composition_rules: cfg.compositionRules,
        negative_prompt: cfg.negativePrompt,
      },
    };
  }

  /* ---------------- Generate / render pipeline ---------------- */
  let autoGenTimer = null;
  function scheduleAutoGenerate() {
    const settings = PPS_Store.getSettings();
    if (!settings.autoGenerate) return;
    clearTimeout(autoGenTimer);
    autoGenTimer = setTimeout(() => generatePrompt({ silent: true }), 220);
  }

  function generatePrompt(opts = {}) {
    const cfg = collectFormConfig();
    const promptObj = buildPromptObject(cfg);
    const json = JSON.stringify(promptObj, null, 2);
    PPS_UI.renderCodeViewer(json);

    const charCountEl = $("charCount");
    if (charCountEl) charCountEl.textContent = json.length + " chars";
    const lastGenEl = $("lastGenerated");
    const now = new Date();
    if (lastGenEl) lastGenEl.textContent = "Diperbarui " + now.toLocaleTimeString("id-ID");

    PPS_Store.setLastPrompt({ config: cfg, json, updatedAt: now.toISOString() });

    if (!opts.silent) {
      const settings = PPS_Store.getSettings();
      if (settings.saveHistory) {
        global.PPS_History.addHistoryItem(cfg, json);
      }
      PPS_UI.toast("Prompt berhasil dibuat", "success");
    }
    return { cfg, json };
  }

  /* ---------------- Copy / Download ---------------- */
  async function copyJsonToClipboard() {
    const lastPrompt = PPS_Store.getLastPrompt();
    if (!lastPrompt || !lastPrompt.json) {
      PPS_UI.toast("Belum ada JSON untuk disalin. Generate dulu.", "warning");
      return;
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(lastPrompt.json);
      } else {
        // fallback for unsupported browsers
        const ta = document.createElement("textarea");
        ta.value = lastPrompt.json;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      PPS_UI.toast("Copied!", "success");
    } catch (e) {
      PPS_UI.toast("Gagal menyalin ke clipboard. Salin manual dari panel JSON.", "error");
    }
  }

  function downloadJson() {
    const lastPrompt = PPS_Store.getLastPrompt();
    if (!lastPrompt || !lastPrompt.json) {
      PPS_UI.toast("Belum ada JSON untuk diunduh. Generate dulu.", "warning");
      return;
    }
    try {
      const blob = new Blob([lastPrompt.json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const dateStr = new Date().toISOString().slice(0, 10);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ponti-prompt-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      PPS_UI.toast("File JSON berhasil diunduh", "success");
    } catch (e) {
      PPS_UI.toast("Gagal mengunduh file JSON.", "error");
    }
  }

  function clearJson() {
    PPS_UI.renderCodeViewer("");
    $("charCount").textContent = "0 chars";
    $("lastGenerated").textContent = "";
  }

  /* ---------------- Image upload handling ---------------- */
  function renderImagePreviews() {
    const wrap = $("imagePreviewList");
    wrap.innerHTML = "";
    uploadedImages.forEach((img) => {
      const item = document.createElement("div");
      item.className = "image-preview-item";
      item.innerHTML = `<img src="${img.dataUrl}" alt="${PPS_UI.escapeHtml(img.name)}"><button type="button" class="remove-img" aria-label="Hapus gambar">✕</button>`;
      item.querySelector(".remove-img").addEventListener("click", () => {
        uploadedImages = uploadedImages.filter((i) => i.id !== img.id);
        PPS_ImageStore.remove(img.id);
        renderImagePreviews();
      });
      wrap.appendChild(item);
    });
  }

  function handleFiles(fileList) {
    const allowed = ["image/png", "image/jpeg", "image/webp"];
    Array.from(fileList).forEach((file) => {
      if (!allowed.includes(file.type)) {
        PPS_UI.toast(`File "${file.name}" bukan format yang didukung (PNG/JPG/WEBP).`, "error");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const id = "img_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
        const dataUrl = reader.result;
        uploadedImages.push({ id, name: file.name, dataUrl });
        PPS_ImageStore.save(id, dataUrl);
        renderImagePreviews();
      };
      reader.onerror = () => PPS_UI.toast(`Gagal membaca file "${file.name}".`, "error");
      reader.readAsDataURL(file);
    });
  }

  function resetForm() {
    applyConfigToForm(PPS_Templates.baseConfig({}));
    uploadedImages = [];
    renderImagePreviews();
    scheduleAutoGenerate();
  }

  global.PPS_Generator = {
    PLACEMENT_TEMPLATES,
    renderRepeater,
    addRepeaterItem,
    collectFormConfig,
    applyConfigToForm,
    updatePlacementRuleFromPosition,
    generateSmartNegativePrompt,
    generatePrompt,
    scheduleAutoGenerate,
    copyJsonToClipboard,
    downloadJson,
    clearJson,
    handleFiles,
    renderImagePreviews,
    resetForm,
    getFeatureItems: () => featureItems,
    getRuleItems: () => ruleItems,
  };
})(window);
