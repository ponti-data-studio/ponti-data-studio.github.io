/**
 * ============================================================
 * Web App to PWA Builder
 * Utils.gs — Validation, sanitization, formatting helpers
 * ============================================================
 */

function generateId() {
  return Utilities.getUuid();
}

/** ISO 8601 UTC timestamp, e.g. 2026-09-18T10:30:00Z */
function getIsoTimestamp() {
  return Utilities.formatDate(new Date(), 'UTC', "yyyy-MM-dd'T'HH:mm:ss'Z'");
}

/** yyyy-MM-dd date only */
function getDateOnly(date) {
  return Utilities.formatDate(date, 'UTC', 'yyyy-MM-dd');
}

/**
 * Sanitizes a raw string into a slug-safe string:
 * lowercase, spaces -> hyphens, strips invalid characters,
 * collapses repeated hyphens, trims leading/trailing hyphens.
 * Does NOT guarantee uniqueness — check separately.
 */
function sanitizeSlug(input) {
  if (!input) return '';
  var s = String(input).toLowerCase().trim();
  s = s.replace(/[^a-z0-9\s-]/g, '');
  s = s.replace(/\s+/g, '-');
  s = s.replace(/-+/g, '-');
  s = s.replace(/^-+|-+$/g, '');
  return s;
}

var SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function isValidSlugFormat(slug) {
  return typeof slug === 'string' &&
    slug.length > 0 &&
    slug.length <= 60 &&
    SLUG_REGEX.test(slug);
}

/**
 * Strict validation for a Google Apps Script Web App URL.
 * Must be HTTPS and match /macros/s/.../exec
 */
function validateAppUrl(url) {
  if (!url || typeof url !== 'string') return false;
  var trimmed = url.trim();
  if (!/^https:\/\//i.test(trimmed)) return false;
  return /^https:\/\/script\.google\.com\/macros\/s\/[a-zA-Z0-9_-]+\/exec(\?.*)?$/i.test(trimmed);
}

function isValidHttpsUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return /^https:\/\/\S+$/i.test(url.trim());
}

function isValidHexColor(color) {
  return typeof color === 'string' && /^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/.test(color.trim());
}

/**
 * Normalizes raw incoming app data into a clean, predictable shape.
 * Applies defaults for colors and trims all string fields.
 */
function normalizeAppData(data) {
  data = data || {};
  return {
    APP_NAME: (data.APP_NAME || '').toString().trim(),
    APP_URL: (data.APP_URL || '').toString().trim(),
    ICON_URL: (data.ICON_URL || '').toString().trim(),
    THEME_COLOR: (data.THEME_COLOR || '#2563EB').toString().trim(),
    BACKGROUND_COLOR: (data.BACKGROUND_COLOR || '#FFFFFF').toString().trim(),
    DESCRIPTION: (data.DESCRIPTION || '').toString().trim(),
    SLUG: sanitizeSlug(data.SLUG || '')
  };
}

/**
 * Full server-side validation. Client-side validation exists for UX only —
 * this is the source of truth and must never be skipped.
 * @param {boolean} isUpdate - when true, skips APP_URL requirement (read-only field on update)
 */
function validateAppData(data, isUpdate) {
  if (!data.APP_NAME) {
    return { valid: false, message: 'Nama aplikasi wajib diisi.' };
  }
  if (data.APP_NAME.length > 100) {
    return { valid: false, message: 'Nama aplikasi terlalu panjang.' };
  }

  if (!isUpdate) {
    if (!data.APP_URL) {
      return { valid: false, message: 'URL Google Apps Script wajib diisi.' };
    }
    if (!validateAppUrl(data.APP_URL)) {
      return { valid: false, message: 'URL Google Apps Script tidak valid.' };
    }
  }

  if (!data.ICON_URL) {
    return { valid: false, message: 'URL icon wajib diisi.' };
  }
  if (!isValidHttpsUrl(data.ICON_URL)) {
    return { valid: false, message: 'URL icon tidak valid. Periksa kembali URL icon.' };
  }

  if (!isValidHexColor(data.THEME_COLOR)) {
    return { valid: false, message: 'Theme color tidak valid.' };
  }
  if (!isValidHexColor(data.BACKGROUND_COLOR)) {
    return { valid: false, message: 'Background color tidak valid.' };
  }

  if (!data.SLUG) {
    return { valid: false, message: 'Slug wajib diisi.' };
  }
  if (!isValidSlugFormat(data.SLUG)) {
    return { valid: false, message: 'Format slug tidak valid. Gunakan huruf kecil, angka, dan tanda hubung (-).' };
  }

  return { valid: true };
}

/**
 * Converts internal/technical errors into safe, user-friendly messages.
 * Technical details are logged via console.error, never shown to the user.
 */
function friendlyError(err) {
  var msg = err && err.message ? err.message : String(err);
  if (msg.indexOf('DATABASE_NOT_CONFIGURED') !== -1) {
    return 'Database belum dikonfigurasi. Set DATABASE_SPREADSHEET_ID pada Script Properties.';
  }
  if (msg.indexOf('SHEET_NOT_INITIALIZED') !== -1) {
    return 'Database belum diinisialisasi. Jalankan setupDatabase() terlebih dahulu.';
  }
  return 'Terjadi kesalahan. Silakan coba lagi.';
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDateHuman(isoString) {
  try {
    var date = new Date(isoString);
    var months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli',
      'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    return date.getUTCDate() + ' ' + months[date.getUTCMonth()] + ' ' + date.getUTCFullYear();
  } catch (e) {
    return isoString;
  }
}
