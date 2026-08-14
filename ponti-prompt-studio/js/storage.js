/* =========================================================
   storage.js — safe LocalStorage wrapper + IndexedDB (images)
   Keys used: pps_settings, pps_history, pps_templates,
              pps_projects, pps_lastPrompt
   ========================================================= */
(function (global) {
  "use strict";

  const KEYS = {
    settings: "pps_settings",
    history: "pps_history",
    templates: "pps_templates",
    projects: "pps_projects",
    lastPrompt: "pps_lastPrompt",
  };

  const DEFAULT_SETTINGS = {
    appearance: "light",
    accentColor: "ponti",
    customAccent: "#0cacd0",
    autoGenerate: true,
    saveHistory: true,
    defaultTemplate: "commercial-banner",
  };

  function isStorageAvailable() {
    try {
      const k = "__pps_test__";
      localStorage.setItem(k, "1");
      localStorage.removeItem(k);
      return true;
    } catch (e) {
      return false;
    }
  }

  const available = isStorageAvailable();
  if (!available) {
    console.warn("LocalStorage tidak tersedia. Ponti Prompt Studio berjalan dalam mode sementara (data tidak akan tersimpan).");
  }

  // In-memory fallback if localStorage is unavailable/corrupted beyond repair
  const memoryFallback = {};

  function safeGet(key, fallback) {
    if (!available) return memoryFallback[key] !== undefined ? memoryFallback[key] : fallback;
    try {
      const raw = localStorage.getItem(key);
      if (raw === null || raw === undefined) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      console.warn(`Data corrupt pada key "${key}", menggunakan nilai default.`, e);
      return fallback;
    }
  }

  function safeSet(key, value) {
    if (!available) {
      memoryFallback[key] = value;
      return false;
    }
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error(`Gagal menyimpan data untuk key "${key}".`, e);
      return false;
    }
  }

  function safeRemove(key) {
    if (!available) {
      delete memoryFallback[key];
      return;
    }
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.error(`Gagal menghapus key "${key}".`, e);
    }
  }

  const Store = {
    KEYS,
    available,

    getSettings() {
      return Object.assign({}, DEFAULT_SETTINGS, safeGet(KEYS.settings, {}));
    },
    setSettings(settings) {
      return safeSet(KEYS.settings, settings);
    },

    getHistory() {
      const h = safeGet(KEYS.history, []);
      return Array.isArray(h) ? h : [];
    },
    setHistory(list) {
      // enforce max 50 items
      const trimmed = Array.isArray(list) ? list.slice(0, 50) : [];
      return safeSet(KEYS.history, trimmed);
    },

    getTemplates() {
      const t = safeGet(KEYS.templates, []);
      return Array.isArray(t) ? t : [];
    },
    setTemplates(list) {
      return safeSet(KEYS.templates, Array.isArray(list) ? list : []);
    },

    getProjects() {
      const p = safeGet(KEYS.projects, []);
      return Array.isArray(p) ? p : [];
    },
    setProjects(list) {
      return safeSet(KEYS.projects, Array.isArray(list) ? list : []);
    },

    getLastPrompt() {
      return safeGet(KEYS.lastPrompt, null);
    },
    setLastPrompt(promptObj) {
      return safeSet(KEYS.lastPrompt, promptObj);
    },

    exportAll() {
      return {
        exportedAt: new Date().toISOString(),
        app: "Ponti Prompt Studio",
        settings: this.getSettings(),
        history: this.getHistory(),
        templates: this.getTemplates(),
        projects: this.getProjects(),
        lastPrompt: this.getLastPrompt(),
      };
    },

    importAll(data) {
      if (!data || typeof data !== "object") throw new Error("Format data import tidak valid.");
      if (data.settings) this.setSettings(data.settings);
      if (Array.isArray(data.history)) this.setHistory(data.history);
      if (Array.isArray(data.templates)) this.setTemplates(data.templates);
      if (Array.isArray(data.projects)) this.setProjects(data.projects);
      if (data.lastPrompt) this.setLastPrompt(data.lastPrompt);
      return true;
    },

    clearAll() {
      Object.values(KEYS).forEach(safeRemove);
    },
  };

  /* ---------------- IndexedDB (image blobs, kept local only) ---------------- */
  const DB_NAME = "ponti_prompt_studio_db";
  const DB_VERSION = 1;
  const STORE_NAME = "images";
  let dbPromise = null;

  function openDb() {
    if (!("indexedDB" in global)) return Promise.resolve(null);
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: "id" });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => {
          console.warn("IndexedDB tidak dapat dibuka. Preview gambar hanya tersimpan sementara di memori.");
          resolve(null);
        };
      } catch (e) {
        resolve(null);
      }
    });
    return dbPromise;
  }

  const ImageStore = {
    async save(id, dataUrl) {
      const db = await openDb();
      if (!db) return false;
      return new Promise((resolve) => {
        try {
          const tx = db.transaction(STORE_NAME, "readwrite");
          tx.objectStore(STORE_NAME).put({ id, dataUrl, savedAt: Date.now() });
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        } catch (e) {
          resolve(false);
        }
      });
    },
    async get(id) {
      const db = await openDb();
      if (!db) return null;
      return new Promise((resolve) => {
        try {
          const tx = db.transaction(STORE_NAME, "readonly");
          const req = tx.objectStore(STORE_NAME).get(id);
          req.onsuccess = () => resolve(req.result ? req.result.dataUrl : null);
          req.onerror = () => resolve(null);
        } catch (e) {
          resolve(null);
        }
      });
    },
    async remove(id) {
      const db = await openDb();
      if (!db) return false;
      return new Promise((resolve) => {
        try {
          const tx = db.transaction(STORE_NAME, "readwrite");
          tx.objectStore(STORE_NAME).delete(id);
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        } catch (e) {
          resolve(false);
        }
      });
    },
    async clear() {
      const db = await openDb();
      if (!db) return false;
      return new Promise((resolve) => {
        try {
          const tx = db.transaction(STORE_NAME, "readwrite");
          tx.objectStore(STORE_NAME).clear();
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        } catch (e) {
          resolve(false);
        }
      });
    },
  };

  global.PPS_Store = Store;
  global.PPS_ImageStore = ImageStore;
  global.PPS_DEFAULT_SETTINGS = DEFAULT_SETTINGS;
})(window);
