/**
 * Config.gs
 * Central configuration for ALYF CMS.
 * Do NOT scatter IDs elsewhere in the codebase — everything reads from here.
 *
 * This project is a CONTAINER-BOUND Apps Script: it lives inside the
 * ALYF_CMS_DATABASE Google Sheet itself (created via the Sheet's
 * Extensions > Apps Script menu), so the database is always
 * "the spreadsheet this script is attached to" — there is no separate
 * spreadsheet ID to configure or lose track of.
 *
 * MEDIA_ROOT_FOLDER_ID is the only ID still resolved from Script
 * Properties at runtime (set automatically by setupDatabase()), since the
 * Drive media folder is a separate resource from the bound spreadsheet.
 */

const CONFIG = {
  APP_NAME: 'ALYF CMS',
  SPREADSHEET_NAME: 'ALYF_CMS_DATABASE',
  MEDIA_ROOT_FOLDER_NAME: 'ALYF_CMS_MEDIA',

  // Session / security
  SESSION_DURATION_SECONDS: 3600,        // 1 hour
  SESSION_CACHE_PREFIX: 'sess_',
  LOGIN_RATE_LIMIT_MAX_ATTEMPTS: 5,
  LOGIN_RATE_LIMIT_WINDOW_SECONDS: 300,  // 5 minutes
  UPLOAD_RATE_LIMIT_MAX: 20,
  UPLOAD_RATE_LIMIT_WINDOW_SECONDS: 300,
  DELETE_RATE_LIMIT_MAX: 20,
  DELETE_RATE_LIMIT_WINDOW_SECONDS: 300,

  // Uploads
  MAX_UPLOAD_SIZE: 5 * 1024 * 1024, // 5 MB
  ALLOWED_MIME_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
  ALLOWED_EXTENSIONS: ['jpg', 'jpeg', 'png', 'webp'],

  // Public content cache
  PUBLIC_CACHE_KEY: 'public_content_v1',
  PUBLIC_CACHE_SECONDS: 300, // 5 minutes

  // Sheet names
  SHEETS: {
    USERS: 'USERS',
    CONTENT: 'CONTENT',
    COLLECTIONS: 'COLLECTIONS',
    EXPERIENCE: 'EXPERIENCE',
    FEATURES: 'FEATURES',
    AMENITIES: 'AMENITIES',
    SETTINGS: 'SETTINGS',
    AUDIT_LOG: 'AUDIT_LOG',
    MEDIA: 'MEDIA'
  },

  ROLES: {
    SUPER_ADMIN: 'SUPER_ADMIN',
    EDITOR: 'EDITOR',
    VIEWER: 'VIEWER'
  }
};

/**
 * Returns the CMS spreadsheet — the Google Sheet this script is bound to
 * (i.e. the one you opened Extensions > Apps Script from). Works both when
 * triggered from the Sheets UI and when triggered as a deployed Web App,
 * since a container-bound script's container never changes.
 */
function getSpreadsheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error(
      'This script must be bound to the ALYF_CMS_DATABASE Google Sheet. ' +
      'Open the Sheet, go to Extensions > Apps Script, and run setupDatabase() from there.'
    );
  }
  return ss;
}

/**
 * Returns the root Drive folder used for media storage.
 */
function getMediaRootFolder_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('MEDIA_ROOT_FOLDER_ID');
  if (!id) {
    throw new Error('CMS not initialized. Run setupDatabase() first.');
  }
  return DriveApp.getFolderById(id);
}

function getSheet_(sheetName) {
  const ss = getSpreadsheet_();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('Sheet not found: ' + sheetName);
  }
  return sheet;
}
