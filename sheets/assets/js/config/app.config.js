/**
 * app.config.js
 * -----------------------------------------------------------------------
 * Konfigurasi pusat aplikasi Ponti Sheets.
 * Semua nilai yang dulunya "hardcode" harus ditaruh di sini agar
 * gampang diubah tanpa menyentuh logic di file lain.
 * -----------------------------------------------------------------------
 */

export const APP_CONFIG = {
  name: "Ponti Sheets",
  tagline: "Transform Your Spreadsheet into an AI-Ready Database.",
  version: "1.0.0",
  mode: "personal", // personal | cloud | multi-user | saas (roadmap v1-v4)
  storageDriver: "local", // local (v1) -> remote (v2+) tanpa mengubah interface
  defaultTheme: "dark",
  supportedLanguages: ["id", "en"],
  supportedThemes: ["dark", "light"],
};

export const GOOGLE_CONFIG = {
  // Client ID sebaiknya diisi lewat menu Settings aplikasi (localStorage), bukan di sini.
  // Nilai di bawah ini hanya dipakai sebagai fallback opsional. Lihat google-auth.service.js.
  clientId: "1064547295258-taeuv30teq4hrh5v5i2rj8k2hmisp119.apps.googleusercontent.com",
  // CATATAN PERMISSION: sejak fitur "Database Builder" ditambahkan, scope Sheets diubah
  // dari read-only menjadi read-write ("spreadsheets") karena Ponti Sheets perlu bisa
  // MEMBUAT spreadsheet baru lewat Google Sheets API. Scope ini secara teknis juga
  // memberi izin menulis ke spreadsheet lain milik pengguna (bukan hanya yang dibuat
  // Ponti Sheets) — namun aplikasi ini hanya benar-benar menulis saat pengguna secara
  // eksplisit menekan tombol "Generate Google Sheets" di Database Builder. Fitur
  // Analyze/Database Context/ERD/Prompt Builder tetap murni membaca (read-only secara
  // perilaku), walau secara scope OAuth kini punya kapabilitas tulis.
  scopes: [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/userinfo.email",
  ].join(" "),
  discoveryDocs: [
    "https://sheets.googleapis.com/$discovery/rest?version=v4",
  ],
};

export const AI_PROVIDERS = {
  openai: {
    id: "openai",
    label: "OpenAI",
    defaultModel: "gpt-4o-mini",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "o3-mini"],
    endpoint: "https://api.openai.com/v1/chat/completions",
    pricePer1kInputUsd: 0.0025,
    pricePer1kOutputUsd: 0.01,
    keyPlaceholder: "sk-...",
  },
  gemini: {
    id: "gemini",
    label: "Google Gemini",
    defaultModel: "gemini-3.5-flash",
    models: ["gemini-3.1-pro-preview", "gemini-3.5-flash", "gemini-2.5-flash-lite"],
    endpoint: "https://generativelanguage.googleapis.com/v1beta/models",
    pricePer1kInputUsd: 0.0001,
    pricePer1kOutputUsd: 0.0004,
    keyPlaceholder: "AIza...",
  },
  qwen: {
    id: "qwen",
    label: "Qwen (Alibaba Cloud)",
    defaultModel: "qwen-max",
    models: ["qwen-max", "qwen-plus", "qwen-turbo"],
    endpoint:
      "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
    pricePer1kInputUsd: 0.0016,
    pricePer1kOutputUsd: 0.0064,
    keyPlaceholder: "sk-...",
  },
  claude: {
    id: "claude",
    label: "Claude (Anthropic)",
    defaultModel: "claude-sonnet-5",
    models: ["claude-sonnet-5", "claude-opus-4-8", "claude-haiku-4-5-20251001"],
    endpoint: "https://api.anthropic.com/v1/messages",
    pricePer1kInputUsd: 0.003,
    pricePer1kOutputUsd: 0.015,
    keyPlaceholder: "sk-ant-...",
  },
};

export const MENU_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: "layout-dashboard" },
  { id: "guide", label: "Panduan Penggunaan", icon: "help-circle" },
  { id: "database-builder", label: "Database Builder", icon: "cube" },
  { id: "spreadsheet", label: "Spreadsheet", icon: "table" },
  { id: "analysis", label: "Analysis", icon: "search-check" },
  { id: "database-context", label: "Database Context", icon: "database" },
  { id: "schema-editor", label: "Schema Editor", icon: "pencil" },
  { id: "erd", label: "ERD", icon: "network" },
  { id: "prompt-builder", label: "Prompt Builder", icon: "wand-2" },
  { id: "ai-studio", label: "AI Studio", icon: "sparkles" },
  { id: "documentation", label: "Documentation", icon: "book-open" },
  { id: "history", label: "History", icon: "history" },
  { id: "export", label: "Export", icon: "download" },
  { id: "settings", label: "Settings", icon: "settings" },
];

export const COLUMN_TYPES = [
  "text", "number", "currency", "boolean", "date", "datetime",
  "email", "phone", "gps", "image_url", "file_url", "json",
  "array", "url", "unknown",
];

/** Tipe data yang boleh dipakai AI saat membangun Database Blueprint (lebih luas
 *  dari COLUMN_TYPES di atas karena blueprint dibuat dari nol, bukan dideteksi). */
export const BLUEPRINT_COLUMN_TYPES = [
  "text", "number", "currency", "boolean", "date", "datetime", "time",
  "email", "phone", "url", "gps", "image_url", "file_url", "json",
  "array", "percentage", "auto_number", "uuid",
];

export const BLUEPRINT_FORMULA_EXAMPLES = [
  "SUM", "SUMIF", "COUNTIF", "QUERY", "FILTER", "UNIQUE", "SORT",
  "INDEX", "MATCH", "XLOOKUP", "VLOOKUP", "ARRAYFORMULA", "IF", "IFS",
  "TEXT", "LEFT", "RIGHT", "MID", "REGEXMATCH", "REGEXEXTRACT", "TODAY", "NOW",
];

export const TEMPLATES = {
  gas_webapp: {
    id: "gas_webapp",
    label: "Web App (Google Apps Script)",
    outputs: ["Source Code", "CRUD", "Dashboard", "Sheets Integration", "Responsive UI", "README", "Deployment Guide"],
    status: "available",
  },
  pwa_apk: {
    id: "pwa_apk",
    label: "Android APK (PWA)",
    outputs: ["Installable", "Offline", "Responsive", "Manifest", "Service Worker"],
    status: "available",
  },
  pwa_exe: {
    id: "pwa_exe",
    label: "Windows EXE (PWA)",
    outputs: ["Desktop Ready", "Responsive", "Shortcut", "Installer Ready"],
    status: "available",
  },
  telegram_bot: {
    id: "telegram_bot",
    label: "Telegram Bot",
    outputs: [],
    status: "coming_soon",
  },
  iot_automation: {
    id: "iot_automation",
    label: "IoT Automation",
    outputs: [],
    status: "coming_soon",
  },
};

export default APP_CONFIG;
