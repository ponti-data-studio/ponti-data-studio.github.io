/**
 * Code.gs
 * Web app entry point (doGet), first-run database/folder setup, and the
 * admin dashboard summary endpoint.
 *
 * ROUTING
 * -------
 * This single Apps Script Web App serves two very different consumers:
 *
 *  1. The Admin CMS UI itself, rendered as HtmlService pages, reached at
 *     the deployment /exec URL with ?route=admin|login (or no route, which
 *     defaults to the login/admin gate below).
 *
 *  2. The PUBLIC, unauthenticated JSON content API consumed by the static
 *     alyf.site landing page, reached with ?api=content. This never
 *     touches HtmlService and never returns anything but published
 *     (is_active = TRUE) data — see getPublishedContent() in Content.gs.
 *
 * Apps Script does not provide real path-based routing (no native
 * "/admin" folder) — see the deployment guide for how alyf.site/admin is
 * mapped to this Web App's /exec URL via DNS/reverse proxy or a redirect.
 */

function doGet(e) {
  const params = e && e.parameter ? e.parameter : {};

  // ---- Public JSON API for the static landing page ----
  if (params.api === 'content') {
    const result = getPublishedContent();
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // ---- Admin UI (HtmlService) ----
  const route = params.route || 'admin';
  let page;
  if (route === 'login') {
    page = HtmlService.createTemplateFromFile('Login').evaluate();
  } else {
    // Admin.html itself performs a client-side session check (validateSession)
    // and redirects to the login view if there is no valid token. The server
    // never trusts the route parameter for authorization — every privileged
    // action re-checks the session token via requireAuth_().
    page = HtmlService.createTemplateFromFile('Admin').evaluate();
  }

  return page
    .setTitle('ALYF · Content Management System')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

/**
 * Allows Admin.html to pull in Styles.html / Scripts.html as includes.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ---------- FIRST-RUN SETUP ----------

/**
 * Creates the spreadsheet (if missing), all sheets with headers, the Drive
 * media folder tree, default content rows, and required Script Properties.
 * Safe to run multiple times — it will not duplicate sheets/folders/rows
 * that already exist.
 */
function setupDatabase() {
  const props = PropertiesService.getScriptProperties();

  // --- Spreadsheet: this script is bound to it, so we work in-place. ---
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error(
      'No active spreadsheet found. Run setupDatabase() from the Apps Script ' +
      'editor opened via the ALYF_CMS_DATABASE Sheet\'s Extensions > Apps Script menu.'
    );
  }
  // Rename the spreadsheet only if it still has its default generic name,
  // so we never clobber a name the client has already chosen.
  if (/^(Untitled spreadsheet|Spreadsheet tanpa judul)$/i.test(ss.getName().trim())) {
    ss.rename(CONFIG.SPREADSHEET_NAME);
  }

  ensureSheet_(ss, CONFIG.SHEETS.USERS, ['id', 'username', 'password_hash', 'name', 'role', 'status', 'created_at', 'updated_at', 'last_login']);
  ensureSheet_(ss, CONFIG.SHEETS.CONTENT, ['id', 'section', 'content_key', 'content_type', 'value', 'media_url', 'target_url', 'alt_text', 'sort_order', 'is_active', 'updated_at', 'updated_by', 'media_id']);
  ensureSheet_(ss, CONFIG.SHEETS.COLLECTIONS, ['id', 'category', 'title', 'description', 'image_url', 'tag', 'cta_text', 'cta_url', 'sort_order', 'is_active', 'updated_at', 'media_id']);
  ensureSheet_(ss, CONFIG.SHEETS.EXPERIENCE, ['id', 'slot', 'title', 'image_url', 'alt_text', 'sort_order', 'is_active', 'updated_at', 'media_id']);
  ensureSheet_(ss, CONFIG.SHEETS.FEATURES, ['id', 'number', 'title', 'description', 'sort_order', 'is_active', 'updated_at']);
  ensureSheet_(ss, CONFIG.SHEETS.AMENITIES, ['id', 'amenity', 'sort_order', 'is_active', 'updated_at']);
  ensureSheet_(ss, CONFIG.SHEETS.SETTINGS, ['key', 'value', 'description', 'updated_at']);
  ensureSheet_(ss, CONFIG.SHEETS.AUDIT_LOG, ['id', 'user', 'action', 'module', 'target_id', 'description', 'timestamp', 'ip_or_session']);
  ensureSheet_(ss, CONFIG.SHEETS.MEDIA, ['id', 'filename', 'file_id', 'url', 'category', 'alt_text', 'file_size', 'mime_type', 'uploaded_at', 'uploaded_by', 'used_in']);

  // Remove the default "Sheet1" if it's still empty and unused.
  const sheet1 = ss.getSheetByName('Sheet1');
  if (sheet1 && ss.getSheets().length > 1 && sheet1.getLastRow() === 0) {
    ss.deleteSheet(sheet1);
  }

  // --- Drive media folder tree ---
  let rootFolder;
  const existingFolderId = props.getProperty('MEDIA_ROOT_FOLDER_ID');
  if (existingFolderId) {
    try { rootFolder = DriveApp.getFolderById(existingFolderId); } catch (e) { rootFolder = null; }
  }
  if (!rootFolder) {
    const rootIter = DriveApp.getFoldersByName(CONFIG.MEDIA_ROOT_FOLDER_NAME);
    rootFolder = rootIter.hasNext() ? rootIter.next() : DriveApp.createFolder(CONFIG.MEDIA_ROOT_FOLDER_NAME);
    props.setProperty('MEDIA_ROOT_FOLDER_ID', rootFolder.getId());
  }
  ensureMediaFolders_(rootFolder);
  props.setProperty('google_drive_folder_id', rootFolder.getId());

  // --- Default content rows (only inserted if the CONTENT sheet is empty) ---
  seedDefaultContent_(ss);

  return apiSuccess_('Database and media folders are ready.', {
    spreadsheetName: ss.getName(),
    spreadsheetUrl: ss.getUrl(),
    mediaFolderId: rootFolder.getId(),
    mediaFolderUrl: rootFolder.getUrl()
  });
}

function ensureSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }
  return sheet;
}

function seedDefaultContent_(ss) {
  const contentSheet = ss.getSheetByName(CONFIG.SHEETS.CONTENT);
  if (contentSheet.getLastRow() <= 1) {
    const rows = [
      ['hero', 'hero_eyebrow', 'text', 'Elevated boarding houses', '', '', '', 1, true],
      ['hero', 'hero_title', 'html', 'Live well.<br><em>Stay ALYF.</em>', '', '#residences', '', 2, true],
      ['hero', 'hero_description', 'text', 'Luxurious, thoughtfully managed residences across Jabodetabek & Bali — combining the privacy of home with the ease of modern hospitality.', '', '', '', 3, true],
      ['hero', 'hero_button_text', 'text', 'Explore ALYF', '', '', '', 4, true],
      ['hero', 'hero_image', 'image', '', '', '', 'Elegant modern residence interior', 5, true],
      ['intro', 'intro_eyebrow', 'text', 'A better way to stay', '', '', '', 1, true],
      ['intro', 'intro_title', 'html', 'Not just a room.<br>A more <em>considered</em> way to live.', '', '', '', 2, true],
      ['intro', 'intro_body_1', 'text', 'ALYF reimagines the traditional boarding house for a new generation of professionals who value privacy, design, convenience and a sense of place.', '', '', '', 3, true],
      ['intro', 'intro_body_2', 'text', 'Every residence is curated to feel calm, polished and effortless — so coming home feels like arriving somewhere intentionally made for you.', '', '', '', 4, true],
      ['footer', 'footer_tagline', 'text', 'Luxurious boarding houses and elevated co-living & villa for modern life across Jabodetabek & Bali.', '', '', '', 1, true],
      ['footer', 'copyright_text', 'text', '© 2026 ALYF. All rights reserved.', '', '', '', 2, true]
    ];
    rows.forEach(function (r) {
      contentSheet.appendRow([
        generateId_('cnt'), r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8], nowIso_(), 'system'
      ]);
    });
  }

  const expSheet = ss.getSheetByName(CONFIG.SHEETS.EXPERIENCE);
  if (expSheet.getLastRow() <= 1) {
    [
      ['experience_01', '01 · Refined common spaces', 'Luxury lounge interior', 1],
      ['experience_02', '02 · Restful private rooms', 'Modern bedroom', 2],
      ['experience_03', '03 · Thoughtful details', 'Contemporary building and living space', 3]
    ].forEach(function (r) {
      expSheet.appendRow([generateId_('exp'), r[0], r[1], '', r[2], r[3], true, nowIso_(), '']);
    });
  }

  const featSheet = ss.getSheetByName(CONFIG.SHEETS.FEATURES);
  if (featSheet.getLastRow() <= 1) {
    [
      ['01', 'Move-in ready', 'Thoughtfully furnished rooms and shared spaces, ready for you from day one.'],
      ['02', 'Made for modern routines', 'Spaces for rest, focus, connection and everything in between.'],
      ['03', 'Managed with care', 'A hospitality-minded living experience designed to reduce everyday friction.'],
      ['04', 'Connected to the city', 'Residences across Jabodetabek & Bali selected around access, convenience and lifestyle.']
    ].forEach(function (r, i) {
      featSheet.appendRow([generateId_('feat'), r[0], r[1], r[2], i + 1, true, nowIso_()]);
    });
  }

  const colSheet = ss.getSheetByName(CONFIG.SHEETS.COLLECTIONS);
  if (colSheet.getLastRow() <= 1) {
    [
      ['jakarta', 'Jakarta', 'City-connected living for professionals who want convenience without compromising on design.', 'Jabodetabek Collection', 'Enquire availability', 'https://wa.me/6285198635145', 1],
      ['bekasi_karawang', 'Bekasi & Karawang', 'Contemporary stays within reach of business districts, lifestyle hubs and key transport links.', 'Jabodetabek Collection', 'Enquire availability', 'https://wa.me/6285198635145', 2],
      ['bali', 'Bali', 'Elevated tropical living with thoughtfully curated residences and villas designed for a more effortless island stay.', 'Bali Collection', 'Explore Bali stays', 'https://wa.me/6285198635145', 3]
    ].forEach(function (r) {
      colSheet.appendRow([generateId_('col'), r[0], r[1], r[2], '', r[3], r[4], r[5], r[6], true, nowIso_()]);
    });
  }

  const amenSheet = ss.getSheetByName(CONFIG.SHEETS.AMENITIES);
  if (amenSheet.getLastRow() <= 1) {
    ['High-speed WiFi', 'Housekeeping', 'Laundry service', 'Co-working lounge', 'Security 24/7', '24/7 Security', 'Rooftop access', 'On-call maintenance'].forEach(function (a, i) {
      amenSheet.appendRow([generateId_('amn'), a, i + 1, true, nowIso_()]);
    });
  }

  const setSheet = ss.getSheetByName(CONFIG.SHEETS.SETTINGS);
  if (setSheet.getLastRow() <= 1) {
    [
      ['site_name', 'ALYF', 'Public site name'],
      ['site_description', 'Luxurious boarding houses, elevated co-living and villas across Jabodetabek & Bali.', 'Meta description'],
      ['instagram_url', 'https://www.instagram.com/alyf.homes/', 'Instagram profile link'],
      ['whatsapp_number', 'https://wa.me/6285198635145', 'WhatsApp contact link'],
      ['contact_email', '', 'Public contact email'],
      ['copyright_text', '© 2026 ALYF. All rights reserved.', 'Footer copyright line']
    ].forEach(function (r) {
      setSheet.appendRow([r[0], r[1], r[2], nowIso_()]);
    });
  }
}

/**
 * Creates (or resets) the first SUPER_ADMIN account with a temporary
 * password that must be changed on first login. Intended to be run once
 * from the Apps Script editor by the developer — never expose this as a
 * client-callable function, and never hard-code a production password.
 *
 * Usage: edit tempPassword below (or pass one in), run once, then delete/
 * rotate it immediately and tell the client to change it after first login.
 */
function initializeAdmin(username, tempPassword, name) {
  username = username || 'admin';
  tempPassword = tempPassword || Utilities.getUuid().slice(0, 12);
  name = name || 'ALYF Admin';

  const sheet = getSheet_(CONFIG.SHEETS.USERS);
  const existing = sheetToObjects_(sheet).filter(function (u) {
    return String(u.username).toLowerCase() === username.toLowerCase();
  })[0];

  if (existing) {
    Logger.log('Admin user "%s" already exists. No changes made.', username);
    return apiError_('Admin user already exists.', 'ALREADY_EXISTS');
  }

  sheet.appendRow([
    generateId_('usr'), username, hashPassword_(tempPassword), name,
    CONFIG.ROLES.SUPER_ADMIN, 'ACTIVE', nowIso_(), nowIso_(), ''
  ]);

  Logger.log('Created admin user "%s" with temporary password: %s', username, tempPassword);
  Logger.log('IMPORTANT: share this password securely and change it after first login.');

  return apiSuccess_('Admin account created. Check the execution log for the temporary password.');
}

// ---------- DASHBOARD ----------

function getDashboardData(token) {
  return safeCall_(function () {
    const session = requireAuth_(token);
    if (!session) return apiError_('Unauthorized request.', 'UNAUTHORIZED');

    const content = sheetToObjects_(getSheet_(CONFIG.SHEETS.CONTENT));
    const media = sheetToObjects_(getSheet_(CONFIG.SHEETS.MEDIA));
    const collections = sheetToObjects_(getSheet_(CONFIG.SHEETS.COLLECTIONS));
    const audit = sheetToObjects_(getSheet_(CONFIG.SHEETS.AUDIT_LOG));

    const publishedContentCount = content.filter(function (r) { return truthy_(r.is_active); }).length;
    const activeCollections = collections.filter(function (r) { return truthy_(r.is_active); }).length;

    const allTimestamps = content.map(function (r) { return r.updated_at; })
      .concat(collections.map(function (r) { return r.updated_at; }))
      .filter(Boolean)
      .map(function (t) { return new Date(t); })
      .sort(function (a, b) { return b - a; });

    const lastUpdated = allTimestamps.length ? Utilities.formatDate(allTimestamps[0], 'Etc/UTC', 'dd MMM yyyy, HH:mm') + ' UTC' : '—';

    audit.sort(function (a, b) { return new Date(b.timestamp) - new Date(a.timestamp); });
    const recentActivity = audit.slice(0, 8).map(function (r) {
      return { user: r.user, action: r.action, module: r.module, description: r.description, timestamp: r.timestamp };
    });

    return apiSuccess_('OK', {
      summary: {
        publishedContent: publishedContentCount,
        totalImages: media.length,
        activeCollections: activeCollections,
        lastUpdated: lastUpdated
      },
      recentActivity: recentActivity
    });
  });
}
