/**
 * Media.gs
 * Handles image upload/replace/delete to Google Drive, and the MEDIA sheet
 * that indexes every uploaded file (category, size, usage, URL).
 */

const CATEGORY_FOLDERS_ = {
  hero: 'hero',
  experience: 'experience',
  jakarta: 'collections/jakarta',
  bekasi_karawang: 'collections/bekasi-karawang',
  bali: 'collections/bali',
  amenities: 'amenities',
  general: 'general'
};

/**
 * Ensures the ALYF_CMS_MEDIA folder tree exists and returns a map of
 * category -> Folder object.
 */
function ensureMediaFolders_(rootFolder) {
  const cache = {};
  function getOrCreate(parent, name) {
    const it = parent.getFoldersByName(name);
    if (it.hasNext()) return it.next();
    return parent.createFolder(name);
  }

  const hero = getOrCreate(rootFolder, 'hero');
  const experience = getOrCreate(rootFolder, 'experience');
  const collections = getOrCreate(rootFolder, 'collections');
  const jakarta = getOrCreate(collections, 'jakarta');
  const bekasi = getOrCreate(collections, 'bekasi-karawang');
  const bali = getOrCreate(collections, 'bali');
  const amenities = getOrCreate(rootFolder, 'amenities');
  const general = getOrCreate(rootFolder, 'general');

  cache.hero = hero;
  cache.experience = experience;
  cache.jakarta = jakarta;
  cache.bekasi_karawang = bekasi;
  cache.bali = bali;
  cache.amenities = amenities;
  cache.general = general;
  return cache;
}

function getCategoryFolder_(category) {
  const root = getMediaRootFolder_();
  const folders = ensureMediaFolders_(root);
  return folders[category] || folders.general;
}

/**
 * Validates a base64 image payload against MIME type, magic bytes, and size.
 * Never trusts the filename or its extension alone.
 */
function validateImageUpload_(base64Data, mimeType, sizeBytes) {
  if (!base64Data) return { valid: false, message: 'No file data received.' };
  if (CONFIG.ALLOWED_MIME_TYPES.indexOf(mimeType) === -1) {
    return { valid: false, message: 'Image must be JPG, JPEG, PNG, or WEBP.' };
  }
  if (sizeBytes > CONFIG.MAX_UPLOAD_SIZE) {
    return { valid: false, message: 'Maximum file size is 5 MB.' };
  }

  // Verify magic bytes match the claimed MIME type (defense in depth —
  // never trust the browser-reported type alone).
  const bytes = Utilities.base64Decode(base64Data);
  const sig = bytes.slice(0, 12).map(function (b) { return b & 0xFF; });
  const isJpeg = sig[0] === 0xFF && sig[1] === 0xD8;
  const isPng = sig[0] === 0x89 && sig[1] === 0x50 && sig[2] === 0x4E && sig[3] === 0x47;
  const isWebp = sig[8] === 0x57 && sig[9] === 0x45 && sig[10] === 0x42 && sig[11] === 0x50;

  const matches =
    (mimeType === 'image/jpeg' && isJpeg) ||
    (mimeType === 'image/png' && isPng) ||
    (mimeType === 'image/webp' && isWebp);

  if (!matches) {
    return { valid: false, message: 'File content does not match a valid image format.' };
  }

  return { valid: true, bytes: bytes };
}

function extFromMime_(mimeType) {
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'jpg';
}

/**
 * Uploads a new image. Returns the media record including a stable URL.
 * category: hero | experience | jakarta | bekasi_karawang | bali | amenities | general
 */
function uploadImage(token, base64Data, mimeType, sizeBytes, category, altText) {
  return safeCall_(function () {
    const session = requireAuth_(token, [CONFIG.ROLES.SUPER_ADMIN, CONFIG.ROLES.EDITOR]);
    if (!session) return apiError_('Unauthorized request.', 'UNAUTHORIZED');

    const rl = checkRateLimit_('upload_' + session.userId, CONFIG.UPLOAD_RATE_LIMIT_MAX, CONFIG.UPLOAD_RATE_LIMIT_WINDOW_SECONDS);
    if (!rl.allowed) return apiError_('Too many uploads. Please slow down.', 'RATE_LIMITED');
    recordRateLimitAttempt_('upload_' + session.userId, CONFIG.UPLOAD_RATE_LIMIT_WINDOW_SECONDS);

    const validation = validateImageUpload_(base64Data, mimeType, sizeBytes);
    if (!validation.valid) return apiError_(validation.message, 'INVALID_FILE');

    const cat = CATEGORY_FOLDERS_.hasOwnProperty(category) ? category : 'general';
    const folder = getCategoryFolder_(cat);
    const filename = safeFileName_(cat, extFromMime_(mimeType));

    const blob = Utilities.newBlob(validation.bytes, mimeType, filename);
    const file = folder.createFile(blob);
    file.setDescription('ALYF CMS managed asset — uploaded ' + nowIso_());

    // Publicly readable (view-only), never writable — required so the
    // static public site can render the image without exposing the Drive.
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    const publicUrl = buildDriveImageUrl_(file.getId());

    const mediaSheet = getSheet_(CONFIG.SHEETS.MEDIA);
    const id = generateId_('media');
    mediaSheet.appendRow([
      id, filename, file.getId(), publicUrl, cat,
      sanitizePlainText_(altText || ''), sizeBytes, mimeType,
      nowIso_(), session.username, ''
    ]);

    writeAudit_(session.username, 'UPLOAD_IMAGE', 'MEDIA', id, 'Uploaded ' + filename + ' (' + cat + ')');
    clearPublicCache();

    return apiSuccess_('Image uploaded successfully.', {
      id: id, url: publicUrl, filename: filename, category: cat
    });
  });
}

/**
 * Replaces the file backing an existing media record (keeps the same
 * media id, so any content referencing it stays valid), and versions the
 * URL with a cache-busting query param.
 */
function replaceImage(token, mediaId, base64Data, mimeType, sizeBytes) {
  return safeCall_(function () {
    const session = requireAuth_(token, [CONFIG.ROLES.SUPER_ADMIN, CONFIG.ROLES.EDITOR]);
    if (!session) return apiError_('Unauthorized request.', 'UNAUTHORIZED');

    const validation = validateImageUpload_(base64Data, mimeType, sizeBytes);
    if (!validation.valid) return apiError_(validation.message, 'INVALID_FILE');

    const sheet = getSheet_(CONFIG.SHEETS.MEDIA);
    const row = findRowById_(sheet, mediaId);
    if (row === -1) return apiError_('Media not found.', 'NOT_FOUND');

    const headerMap = getHeaderMap_(sheet);
    const record = sheetToObjects_(sheet).filter(function (m) { return m.id === mediaId; })[0];
    const oldFileId = record.file_id;
    const category = record.category || 'general';

    let file;
    try {
      file = DriveApp.getFileById(oldFileId);
      file.setContent ? null : null; // Drive API v2 blobs are immutable; recreate instead.
    } catch (e) {
      file = null;
    }

    const folder = getCategoryFolder_(category);
    const filename = safeFileName_(category, extFromMime_(mimeType));
    const blob = Utilities.newBlob(validation.bytes, mimeType, filename);
    const newFile = folder.createFile(blob);
    newFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    // Mark old file obsolete (trash it) rather than leaving orphans.
    if (file) {
      try { file.setTrashed(true); } catch (e) { /* ignore */ }
    }

    const publicUrl = buildDriveImageUrl_(newFile.getId());

    sheet.getRange(row, headerMap['file_id']).setValue(newFile.getId());
    sheet.getRange(row, headerMap['url']).setValue(publicUrl);
    sheet.getRange(row, headerMap['filename']).setValue(filename);
    sheet.getRange(row, headerMap['file_size']).setValue(sizeBytes);
    sheet.getRange(row, headerMap['mime_type']).setValue(mimeType);

    // Propagate the new URL to any CONTENT/COLLECTIONS/EXPERIENCE rows using it.
    propagateMediaUrl_(mediaId, publicUrl);

    writeAudit_(session.username, 'REPLACE_IMAGE', 'MEDIA', mediaId, 'Replaced ' + filename);
    clearPublicCache();

    return apiSuccess_('Image replaced and published.', { id: mediaId, url: publicUrl });
  });
}

/**
 * Updates media_url wherever this media id is referenced, with a fresh
 * cache-busting version so the public site never shows a stale image.
 */
function propagateMediaUrl_(mediaId, newUrl) {
  const versioned = newUrl + (newUrl.indexOf('?') === -1 ? '?' : '&') + 'v=' + new Date().getTime();

  [CONFIG.SHEETS.CONTENT, CONFIG.SHEETS.COLLECTIONS, CONFIG.SHEETS.EXPERIENCE, CONFIG.SHEETS.AMENITIES].forEach(function (sheetName) {
    let sheet;
    try { sheet = getSheet_(sheetName); } catch (e) { return; }
    const headerMap = getHeaderMap_(sheet);
    const mediaCol = headerMap['media_id'];
    const urlCol = headerMap['media_url'] || headerMap['image_url'];
    if (!mediaCol || !urlCol) return;
    const rows = sheetToObjects_(sheet);
    rows.forEach(function (r) {
      if (String(r.media_id) === String(mediaId)) {
        sheet.getRange(r.__row, urlCol).setValue(versioned);
      }
    });
  });
}

/**
 * Returns whether a media id is currently referenced by any content row,
 * so the UI can warn "replace instead of delete" rather than silently
 * breaking an image on the live site.
 */
function isMediaInUse_(mediaId) {
  let inUse = false;
  [CONFIG.SHEETS.CONTENT, CONFIG.SHEETS.COLLECTIONS, CONFIG.SHEETS.EXPERIENCE, CONFIG.SHEETS.AMENITIES].forEach(function (sheetName) {
    if (inUse) return;
    let sheet;
    try { sheet = getSheet_(sheetName); } catch (e) { return; }
    const headerMap = getHeaderMap_(sheet);
    if (!headerMap['media_id']) return;
    const rows = sheetToObjects_(sheet);
    if (rows.some(function (r) { return String(r.media_id) === String(mediaId); })) inUse = true;
  });
  return inUse;
}

function deleteMedia(token, mediaId, force) {
  return safeCall_(function () {
    const session = requireAuth_(token, [CONFIG.ROLES.SUPER_ADMIN]);
    if (!session) return apiError_('Unauthorized request.', 'UNAUTHORIZED');

    const rl = checkRateLimit_('delete_' + session.userId, CONFIG.DELETE_RATE_LIMIT_MAX, CONFIG.DELETE_RATE_LIMIT_WINDOW_SECONDS);
    if (!rl.allowed) return apiError_('Too many delete requests. Please slow down.', 'RATE_LIMITED');
    recordRateLimitAttempt_('delete_' + session.userId, CONFIG.DELETE_RATE_LIMIT_WINDOW_SECONDS);

    if (isMediaInUse_(mediaId) && !force) {
      return apiError_('This image is currently in use. Replace it instead of deleting it.', 'MEDIA_IN_USE');
    }

    const sheet = getSheet_(CONFIG.SHEETS.MEDIA);
    const row = findRowById_(sheet, mediaId);
    if (row === -1) return apiError_('Media not found.', 'NOT_FOUND');

    const record = sheetToObjects_(sheet).filter(function (m) { return m.id === mediaId; })[0];
    try {
      DriveApp.getFileById(record.file_id).setTrashed(true);
    } catch (e) { /* file may already be gone */ }

    sheet.deleteRow(row);
    writeAudit_(session.username, 'DELETE_IMAGE', 'MEDIA', mediaId, 'Deleted ' + record.filename);
    clearPublicCache();

    return apiSuccess_('Image deleted.');
  });
}

function getMediaLibrary(token) {
  return safeCall_(function () {
    const session = requireAuth_(token);
    if (!session) return apiError_('Unauthorized request.', 'UNAUTHORIZED');

    const sheet = getSheet_(CONFIG.SHEETS.MEDIA);
    const rows = sheetToObjects_(sheet).map(function (m) {
      return {
        id: m.id,
        filename: m.filename,
        url: m.url,
        category: m.category,
        alt_text: m.alt_text,
        file_size: m.file_size,
        mime_type: m.mime_type,
        uploaded_at: m.uploaded_at,
        uploaded_by: m.uploaded_by,
        in_use: isMediaInUse_(m.id)
      };
    });
    rows.sort(function (a, b) { return new Date(b.uploaded_at) - new Date(a.uploaded_at); });
    return apiSuccess_('OK', { media: rows });
  });
}

/**
 * Builds a stable, direct-viewable image URL for a Drive file id.
 * Uses the googleusercontent thumbnail endpoint, which renders reliably as
 * an <img src> (unlike the "open" URL, which triggers a viewer page).
 */
function buildDriveImageUrl_(fileId) {
  return 'https://lh3.googleusercontent.com/d/' + fileId + '=s1600';
}
