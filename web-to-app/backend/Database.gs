/**
 * ============================================================
 * Web App to PWA Builder
 * Database.gs — Google Sheets as configuration database
 * ============================================================
 */

var APPS_SHEET_NAME = 'Apps';
var APPS_HEADERS = [
  'ID', 'SLUG', 'APP_NAME', 'APP_URL', 'ICON_URL',
  'THEME_COLOR', 'BACKGROUND_COLOR', 'DESCRIPTION',
  'CREATED_AT', 'UPDATED_AT', 'STATUS'
];

/**
 * Returns the database Spreadsheet, based on the Spreadsheet ID stored
 * in Script Properties. Throws DATABASE_NOT_CONFIGURED if not set.
 */
function getDatabaseSpreadsheet() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('DATABASE_SPREADSHEET_ID');
  if (!id) {
    throw new Error('DATABASE_NOT_CONFIGURED');
  }
  return SpreadsheetApp.openById(id);
}

/**
 * Initializes the "Apps" sheet with headers if it does not exist yet.
 * Safe to run multiple times — never duplicates headers or deletes data.
 * Run this once manually from the Apps Script editor after setting
 * DATABASE_SPREADSHEET_ID in Script Properties.
 */
function setupDatabase() {
  var ss = getDatabaseSpreadsheet();
  var sheet = ss.getSheetByName(APPS_SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(APPS_SHEET_NAME);
    sheet.appendRow(APPS_HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, APPS_HEADERS.length).setFontWeight('bold');
    return 'Sheet "Apps" berhasil dibuat dengan header.';
  }

  var lastRow = sheet.getLastRow();
  if (lastRow === 0) {
    sheet.appendRow(APPS_HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, APPS_HEADERS.length).setFontWeight('bold');
    return 'Sheet "Apps" sudah ada tapi kosong. Header ditambahkan.';
  }

  return 'Sheet "Apps" sudah ada. Tidak ada perubahan dilakukan.';
}

function getAppsSheet() {
  var ss = getDatabaseSpreadsheet();
  var sheet = ss.getSheetByName(APPS_SHEET_NAME);
  if (!sheet) {
    throw new Error('SHEET_NOT_INITIALIZED');
  }
  return sheet;
}

function rowToObject(headers, row) {
  var obj = {};
  headers.forEach(function (h, i) {
    obj[h] = row[i];
  });
  return obj;
}

/**
 * Reads all data rows from the Apps sheet. Attaches the internal
 * _row property (1-based actual sheet row number) for update/delete use.
 */
function getAllRows() {
  var sheet = getAppsSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var lastCol = APPS_HEADERS.length;
  var values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var results = [];

  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    if (!row[0]) continue; // skip fully blank rows
    var obj = rowToObject(APPS_HEADERS, row);
    obj._row = i + 2;
    results.push(obj);
  }
  return results;
}

/**
 * Returns all apps, newest first. Used by Dashboard and My Apps.
 */
function getApps() {
  try {
    var rows = getAllRows();
    rows.sort(function (a, b) {
      return new Date(b.CREATED_AT) - new Date(a.CREATED_AT);
    });
    return { success: true, data: rows };
  } catch (err) {
    console.error('getApps error: ' + err);
    return { success: false, error: friendlyError(err) };
  }
}

function getAppById(id) {
  var rows = getAllRows();
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].ID === id) return rows[i];
  }
  return null;
}

function getAppBySlug(slug) {
  if (!slug) return null;
  var rows = getAllRows();
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].SLUG === slug) return rows[i];
  }
  return null;
}

/**
 * Checks slug uniqueness. Pass excludeId when checking during an update
 * so the app being edited doesn't collide with itself.
 */
function isSlugAvailable(slug, excludeId) {
  var existing = getAppBySlug(slug);
  if (!existing) return true;
  if (excludeId && existing.ID === excludeId) return true;
  return false;
}

/**
 * Creates a new PWA app configuration.
 * Uses LockService to guarantee unique ID + unique slug under concurrency.
 */
function createApp(data) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    return { success: false, error: 'Server sedang sibuk. Silakan coba lagi.' };
  }

  try {
    var normalized = normalizeAppData(data);
    var validation = validateAppData(normalized, false);
    if (!validation.valid) {
      return { success: false, error: validation.message };
    }

    if (!isSlugAvailable(normalized.SLUG)) {
      return { success: false, error: 'Slug tersebut sudah digunakan. Silakan pilih slug lain.' };
    }

    var id = generateId();
    var now = getIsoTimestamp();
    var row = [
      id,
      normalized.SLUG,
      normalized.APP_NAME,
      normalized.APP_URL,
      normalized.ICON_URL,
      normalized.THEME_COLOR,
      normalized.BACKGROUND_COLOR,
      normalized.DESCRIPTION || '',
      now,
      now,
      'ACTIVE'
    ];

    var sheet = getAppsSheet();
    sheet.appendRow(row);

    var created = rowToObject(APPS_HEADERS, row);
    return { success: true, data: created };
  } catch (err) {
    console.error('createApp error: ' + err);
    return { success: false, error: friendlyError(err) };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Updates an existing app. APP_URL is intentionally never editable here —
 * it stays read-only to avoid accidentally repointing a live PWA.
 */
function updateApp(id, data) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    return { success: false, error: 'Server sedang sibuk. Silakan coba lagi.' };
  }

  try {
    var existing = getAppById(id);
    if (!existing) {
      return { success: false, error: 'Aplikasi tidak ditemukan.' };
    }

    var merged = {
      APP_NAME: data.APP_NAME !== undefined ? data.APP_NAME : existing.APP_NAME,
      APP_URL: existing.APP_URL, // read-only by design
      ICON_URL: data.ICON_URL !== undefined ? data.ICON_URL : existing.ICON_URL,
      THEME_COLOR: data.THEME_COLOR !== undefined ? data.THEME_COLOR : existing.THEME_COLOR,
      BACKGROUND_COLOR: data.BACKGROUND_COLOR !== undefined ? data.BACKGROUND_COLOR : existing.BACKGROUND_COLOR,
      DESCRIPTION: data.DESCRIPTION !== undefined ? data.DESCRIPTION : existing.DESCRIPTION,
      SLUG: data.SLUG !== undefined ? data.SLUG : existing.SLUG
    };

    var normalized = normalizeAppData(merged);
    var validation = validateAppData(normalized, true);
    if (!validation.valid) {
      return { success: false, error: validation.message };
    }

    if (normalized.SLUG !== existing.SLUG) {
      if (!isSlugAvailable(normalized.SLUG, id)) {
        return { success: false, error: 'Slug tersebut sudah digunakan. Silakan pilih slug lain.' };
      }
    }

    var status = existing.STATUS;
    if (data.STATUS === 'ACTIVE' || data.STATUS === 'INACTIVE') {
      status = data.STATUS;
    }

    var now = getIsoTimestamp();
    var sheet = getAppsSheet();
    var rowNum = existing._row;

    var newRow = [
      existing.ID,
      normalized.SLUG,
      normalized.APP_NAME,
      existing.APP_URL,
      normalized.ICON_URL,
      normalized.THEME_COLOR,
      normalized.BACKGROUND_COLOR,
      normalized.DESCRIPTION || '',
      existing.CREATED_AT,
      now,
      status
    ];

    sheet.getRange(rowNum, 1, 1, APPS_HEADERS.length).setValues([newRow]);
    var updated = rowToObject(APPS_HEADERS, newRow);
    return { success: true, data: updated };
  } catch (err) {
    console.error('updateApp error: ' + err);
    return { success: false, error: friendlyError(err) };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Permanently deletes an app configuration row.
 */
function deleteApp(id) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    return { success: false, error: 'Server sedang sibuk. Silakan coba lagi.' };
  }

  try {
    var existing = getAppById(id);
    if (!existing) {
      return { success: false, error: 'Aplikasi tidak ditemukan.' };
    }
    var sheet = getAppsSheet();
    sheet.deleteRow(existing._row);
    return { success: true, data: { id: id } };
  } catch (err) {
    console.error('deleteApp error: ' + err);
    return { success: false, error: friendlyError(err) };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Returns dashboard statistics computed from live sheet data.
 */
function getStatistics() {
  try {
    var rows = getAllRows();
    var total = rows.length;
    var active = rows.filter(function (r) { return r.STATUS === 'ACTIVE'; }).length;
    var inactive = total - active;
    return { success: true, data: { total: total, active: active, inactive: inactive } };
  } catch (err) {
    console.error('getStatistics error: ' + err);
    return { success: false, error: friendlyError(err) };
  }
}
