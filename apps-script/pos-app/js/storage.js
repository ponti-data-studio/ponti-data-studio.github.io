/**
 * storage.js - Wrapper localStorage
 * HANYA untuk data kecil: theme, session flag, preference, konfigurasi ringan.
 * Data bisnis utama WAJIB menggunakan IndexedDB (lihat db.js).
 */

const Storage = (() => {
  const PREFIX = 'pos_kasir_';

  function isAvailable() {
    try {
      const testKey = `${PREFIX}__test__`;
      localStorage.setItem(testKey, '1');
      localStorage.removeItem(testKey);
      return true;
    } catch (err) {
      console.error('localStorage tidak tersedia:', err);
      return false;
    }
  }

  function set(key, value) {
    if (!isAvailable()) return false;
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
      return true;
    } catch (err) {
      console.error('Storage.set error:', err);
      return false;
    }
  }

  function get(key, fallback = null) {
    if (!isAvailable()) return fallback;
    try {
      const raw = localStorage.getItem(PREFIX + key);
      if (raw === null) return fallback;
      return JSON.parse(raw);
    } catch (err) {
      console.error('Storage.get error:', err);
      return fallback;
    }
  }

  function remove(key) {
    if (!isAvailable()) return;
    localStorage.removeItem(PREFIX + key);
  }

  return { set, get, remove, isAvailable };
})();
