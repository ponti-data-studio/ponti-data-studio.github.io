/* =========================================================
   templates.js — built-in template presets + custom template CRUD
   ========================================================= */
(function (global) {
  "use strict";

  function baseConfig(overrides) {
    return Object.assign(
      {
        brandName: "Ponti Data ID",
        productName: "",
        headline: "Aplikasi LMS/Ujian",
        subheadline: "",
        description: "",
        cta: "",
        imageCount: 1,
        productPosition: "Left",
        composition: "Single Hero Product",
        integration:
          "Blend the product(s) seamlessly into the environment with accurate shadows and reflections matching the lighting style.",
        positionLock: false,
        features: ["Support HP-Tab-PC", "Anti-Cheat", "Responsive Design", "Support Offline"],
        uiElements: "None",
        includeCta: true,
        stylePreset: "Minimal Clean",
        primaryColor: "#0cacd0",
        secondaryColor: "#ffffff",
        lighting: "Diffused Softbox",
        aesthetic:
          "Ample negative space, very clean background, Apple-like product presentation, modern sans-serif typography feel, uncluttered",
        typography:
          "Leave clear negative space for typography. The generated image should either include sleek modern typography for the headline/features, or provide clean areas where text can be overlaid perfectly later.",
        compositionRules: [
          "Rule of thirds for balanced layout",
          "Clear visual hierarchy focusing on the product(s) first, then headline",
          "Ensure background does not overpower the product(s)",
        ],
        negativePrompt:
          "ugly, deformed, noisy, blurry, distorted, out of focus, bad anatomy, bad typography, warped products, misspelled words, cluttered background, watermarks, signatures, text artifacts, low resolution",
        aspectRatio: "16:9",
        quality: "High",
        photorealism: "Ultra-realistic, 8k resolution",
      },
      overrides
    );
  }

  const BUILTIN_TEMPLATES = [
    {
      id: "commercial-banner",
      name: "Commercial Banner",
      description: "Banner promosi produk umum, seimbang untuk web & landing page.",
      category: "Commercial",
      config: baseConfig({}),
    },
    {
      id: "product-advertisement",
      name: "Product Advertisement",
      description: "Iklan produk dengan fokus hero product tunggal.",
      category: "Advertisement",
      config: baseConfig({
        composition: "Single Hero Product",
        stylePreset: "E-commerce",
        aspectRatio: "1:1",
        includeCta: true,
      }),
    },
    {
      id: "landing-page-hero",
      name: "Landing Page Hero",
      description: "Visual hero section lebar untuk landing page website.",
      category: "Web",
      config: baseConfig({
        aspectRatio: "16:9",
        composition: "Center Hero",
        productPosition: "Center",
        uiElements: "Dashboard Preview",
        stylePreset: "Modern Tech",
      }),
    },
    {
      id: "social-media-ad",
      name: "Social Media Advertisement",
      description: "Format persegi/vertikal untuk Instagram & Facebook Ads.",
      category: "Social",
      config: baseConfig({
        aspectRatio: "4:5",
        composition: "Floating Product",
        stylePreset: "Modern Tech",
        uiElements: "Feature Icons",
      }),
    },
    {
      id: "ecommerce-product",
      name: "E-Commerce Product",
      description: "Tampilan produk bersih untuk marketplace / katalog.",
      category: "Commercial",
      config: baseConfig({
        aspectRatio: "1:1",
        composition: "Single Hero Product",
        stylePreset: "E-commerce",
        productPosition: "Center",
        includeCta: false,
      }),
    },
    {
      id: "corporate-banner",
      name: "Corporate Banner",
      description: "Gaya korporat formal untuk presentasi & website bisnis.",
      category: "Corporate",
      config: baseConfig({
        stylePreset: "Premium Corporate",
        lighting: "Studio Lighting",
        aspectRatio: "16:9",
      }),
    },
    {
      id: "luxury-product",
      name: "Luxury Product",
      description: "Estetika mewah dengan pencahayaan studio premium.",
      category: "Luxury",
      config: baseConfig({
        stylePreset: "Luxury",
        lighting: "Luxury Studio",
        primaryColor: "#0cacd0",
        secondaryColor: "#0f0f0f",
        photorealism: "Ultra-realistic, 8k resolution",
      }),
    },
    {
      id: "tech-product",
      name: "Tech Product",
      description: "Produk teknologi dengan nuansa futuristik & modern.",
      category: "Technology",
      config: baseConfig({
        stylePreset: "Futuristic",
        lighting: "Neon Lighting",
        uiElements: "Glassmorphism Panels",
      }),
    },
    {
      id: "app-promotion",
      name: "App Promotion",
      description: "Promosi aplikasi mobile/web dengan mockup UI.",
      category: "App",
      config: baseConfig({
        uiElements: "Product UI Mockup",
        stylePreset: "Apple-inspired",
        aspectRatio: "9:16",
      }),
    },
    {
      id: "youtube-thumbnail",
      name: "YouTube Thumbnail",
      description: "Format 16:9 dengan komposisi editorial berani.",
      category: "Media",
      config: baseConfig({
        aspectRatio: "16:9",
        composition: "Editorial Composition",
        stylePreset: "Cinematic",
        lighting: "Cinematic Lighting",
      }),
    },
  ];

  function getBuiltinTemplates() {
    return BUILTIN_TEMPLATES;
  }

  function getBuiltinById(id) {
    return BUILTIN_TEMPLATES.find((t) => t.id === id) || null;
  }

  function getCustomTemplates() {
    return PPS_Store.getTemplates();
  }

  function saveCustomTemplate({ name, description, category, config }) {
    const list = getCustomTemplates();
    const tpl = {
      id: "custom-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
      name: name || "Untitled Template",
      description: description || "",
      category: category || "Custom",
      config,
      createdAt: new Date().toISOString(),
    };
    list.unshift(tpl);
    PPS_Store.setTemplates(list);
    return tpl;
  }

  function updateCustomTemplate(id, patch) {
    const list = getCustomTemplates();
    const idx = list.findIndex((t) => t.id === id);
    if (idx === -1) return false;
    list[idx] = Object.assign({}, list[idx], patch);
    PPS_Store.setTemplates(list);
    return true;
  }

  function deleteCustomTemplate(id) {
    const list = getCustomTemplates().filter((t) => t.id !== id);
    PPS_Store.setTemplates(list);
  }

  function duplicateCustomTemplate(id) {
    const list = getCustomTemplates();
    const tpl = list.find((t) => t.id === id);
    if (!tpl) return null;
    const copy = Object.assign({}, tpl, {
      id: "custom-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
      name: tpl.name + " (Copy)",
      createdAt: new Date().toISOString(),
    });
    list.unshift(copy);
    PPS_Store.setTemplates(list);
    return copy;
  }

  global.PPS_Templates = {
    getBuiltinTemplates,
    getBuiltinById,
    getCustomTemplates,
    saveCustomTemplate,
    updateCustomTemplate,
    deleteCustomTemplate,
    duplicateCustomTemplate,
    baseConfig,
  };
})(window);
