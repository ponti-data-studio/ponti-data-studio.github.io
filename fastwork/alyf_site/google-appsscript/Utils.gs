/**
 * Utils.gs
 * Shared helpers: API responses, hashing, sanitization, validation, dates.
 */

// ---------- API RESPONSE HELPERS ----------

function apiSuccess_(message, data) {
  return {
    success: true,
    message: message || 'OK',
    data: (data === undefined ? {} : data)
  };
}

function apiError_(message, errorCode) {
  return {
    success: false,
    message: message || 'Something went wrong. Please try again.',
    errorCode: errorCode || 'ERROR'
  };
}

/**
 * Wraps a server function so unexpected exceptions never leak stack traces
 * to the client. Logs the real error server-side.
 */
function safeCall_(fn) {
  try {
    return fn();
  } catch (err) {
    console.error('safeCall_ error: ' + (err && err.stack ? err.stack : err));
    return apiError_('Something went wrong. Please try again.', 'INTERNAL_ERROR');
  }
}

// ---------- DATE / TIME (ISO 8601 everywhere) ----------

function nowIso_() {
  return Utilities.formatDate(new Date(), 'Etc/UTC', "yyyy-MM-dd'T'HH:mm:ss'Z'");
}

function todayIso_() {
  return Utilities.formatDate(new Date(), 'Etc/UTC', 'yyyy-MM-dd');
}

// ---------- IDS ----------

function generateId_(prefix) {
  const rand = Utilities.getUuid().split('-')[0];
  return (prefix ? prefix + '_' : '') + new Date().getTime().toString(36) + rand;
}

// ---------- PASSWORD HASHING (PBKDF2-style via salted SHA-256 iterations) ----------

/**
 * Generates a random salt (hex string).
 */
function generateSalt_() {
  const bytes = [];
  for (let i = 0; i < 16; i++) bytes.push(Math.floor(Math.random() * 256));
  return bytes.map(function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
}

/**
 * Hashes a password with a salt using repeated SHA-256 (2000 rounds) to slow
 * down brute force. Returns "salt:hash" hex-encoded. Never store plaintext.
 */
function hashPassword_(password, salt) {
  salt = salt || generateSalt_();
  let data = salt + '::' + password;
  const rounds = 2000;
  let digestBytes;
  for (let i = 0; i < rounds; i++) {
    digestBytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, data);
    data = digestBytes.map(function (b) { return ('0' + (b & 0xFF).toString(16)).slice(-2); }).join('');
  }
  return salt + ':' + data;
}

function verifyPassword_(password, storedHash) {
  if (!storedHash || storedHash.indexOf(':') === -1) return false;
  const salt = storedHash.split(':')[0];
  const recomputed = hashPassword_(password, salt);
  return timingSafeEquals_(recomputed, storedHash);
}

function timingSafeEquals_(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= (a.charCodeAt(i) ^ b.charCodeAt(i));
  return diff === 0;
}

// ---------- INPUT SANITIZATION ----------

/**
 * Strips a strict allowlist violation: only <br>, <em>, <strong> tags are
 * permitted (used for fields like the Hero heading). Everything else is
 * escaped/stripped to prevent XSS / HTML injection.
 */
function sanitizeRichText_(input) {
  if (input === null || input === undefined) return '';
  let s = String(input);

  // Remove script/style blocks entirely first.
  s = s.replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '');

  // Escape everything, then re-allow the small tag allowlist.
  const escaped = s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const withAllowlist = escaped
    .replace(/&lt;br\s*\/?&gt;/gi, '<br>')
    .replace(/&lt;em&gt;/gi, '<em>')
    .replace(/&lt;\/em&gt;/gi, '</em>')
    .replace(/&lt;strong&gt;/gi, '<strong>')
    .replace(/&lt;\/strong&gt;/gi, '</strong>');

  return withAllowlist;
}

/**
 * Plain text sanitizer — strips all HTML tags and control characters.
 */
function sanitizePlainText_(input) {
  if (input === null || input === undefined) return '';
  let s = String(input);
  s = s.replace(/<[^>]*>/g, '');
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  return s.trim();
}

/**
 * Validates a URL against an allowlist of safe protocols. Rejects
 * javascript:, data:, vbscript:, and anything else unexpected.
 * If waOnly is true, additionally requires a wa.me link.
 */
function isSafeUrl_(url, opts) {
  opts = opts || {};
  if (!url) return opts.allowEmpty === true;
  const s = String(url).trim();
  const lower = s.toLowerCase();

  const blockedPrefixes = ['javascript:', 'data:', 'vbscript:', 'file:'];
  for (let i = 0; i < blockedPrefixes.length; i++) {
    if (lower.indexOf(blockedPrefixes[i]) === 0) return false;
  }

  if (opts.waOnly) {
    return /^https:\/\/wa\.me\//i.test(s);
  }

  // Allow in-page anchors like #residences
  if (/^#[a-z0-9_-]*$/i.test(s)) return true;

  return /^https?:\/\//i.test(s);
}

function sanitizeUrlOrEmpty_(url, opts) {
  return isSafeUrl_(url, opts) ? String(url).trim() : '';
}

/**
 * Generates a safe, collision-resistant filename. Never trusts the
 * original filename or its extension claim by itself.
 */
function safeFileName_(category, extension) {
  const stamp = Utilities.formatDate(new Date(), 'Etc/UTC', 'yyyyMMdd_HHmmss');
  const rand = Utilities.getUuid().split('-')[0];
  const cat = String(category || 'general').toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'general';
  const ext = String(extension || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  return cat + '_' + stamp + '_' + rand + '.' + ext;
}

// ---------- SHEET HELPERS ----------

/**
 * Reads a sheet into an array of objects keyed by header row.
 */
function sheetToObjects_(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(function (h) { return String(h).trim(); });
  const rows = [];
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    // Skip fully blank rows
    if (row.join('') === '') continue;
    const obj = {};
    for (let c = 0; c < headers.length; c++) {
      obj[headers[c]] = row[c];
    }
    obj.__row = r + 1; // 1-indexed sheet row number
    rows.push(obj);
  }
  return rows;
}

function getHeaderMap_(sheet) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const map = {};
  headers.forEach(function (h, i) { map[String(h).trim()] = i + 1; });
  return map;
}

function findRowById_(sheet, id) {
  const headerMap = getHeaderMap_(sheet);
  const idCol = headerMap['id'];
  if (!idCol) return -1;
  const values = sheet.getRange(1, idCol, sheet.getLastRow(), 1).getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(id)) return i + 1;
  }
  return -1;
}

function truthy_(v) {
  return v === true || v === 'TRUE' || v === 'true' || v === 1 || v === '1';
}
