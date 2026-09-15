/**
 * Content.gs
 * Manages the CONTENT (key/value), EXPERIENCE, and FEATURES sheets, plus
 * the public read-only content API consumed by the alyf.site landing page.
 */

// ---------- PUBLIC API (no auth — published content only) ----------

/**
 * Returns everything the public landing page needs, built entirely from
 * is_active = TRUE rows. Never includes users, audit logs, settings
 * secrets, or any internal metadata. Cached briefly via CacheService.
 */
function getPublishedContent() {
  return safeCall_(function () {
    const cache = CacheService.getScriptCache();
    const cached = cache.get(CONFIG.PUBLIC_CACHE_KEY);
    if (cached) return apiSuccess_('OK', JSON.parse(cached));

    const data = buildPublishedContentPayload_();
    cache.put(CONFIG.PUBLIC_CACHE_KEY, JSON.stringify(data), CONFIG.PUBLIC_CACHE_SECONDS);
    return apiSuccess_('OK', data);
  });
}

function buildPublishedContentPayload_() {
  const content = {};
  getSheet_(CONFIG.SHEETS.CONTENT) && sheetToObjects_(getSheet_(CONFIG.SHEETS.CONTENT))
    .filter(function (r) { return truthy_(r.is_active); })
    .forEach(function (r) {
      if (!content[r.section]) content[r.section] = {};
      content[r.section][r.content_key] = {
        type: r.content_type,
        value: r.value,
        media_url: r.media_url,
        target_url: r.target_url,
        alt_text: r.alt_text
      };
    });

  const experience = sheetToObjects_(getSheet_(CONFIG.SHEETS.EXPERIENCE))
    .filter(function (r) { return truthy_(r.is_active); })
    .sort(function (a, b) { return (a.sort_order || 0) - (b.sort_order || 0); })
    .map(function (r) {
      return { slot: r.slot, title: r.title, image_url: r.image_url, alt_text: r.alt_text };
    });

  const features = sheetToObjects_(getSheet_(CONFIG.SHEETS.FEATURES))
    .filter(function (r) { return truthy_(r.is_active); })
    .sort(function (a, b) { return (a.sort_order || 0) - (b.sort_order || 0); })
    .map(function (r) {
      return { number: r.number, title: r.title, description: r.description };
    });

  const amenities = sheetToObjects_(getSheet_(CONFIG.SHEETS.AMENITIES))
    .filter(function (r) { return truthy_(r.is_active); })
    .sort(function (a, b) { return (a.sort_order || 0) - (b.sort_order || 0); })
    .map(function (r) { return r.amenity; });

  const collections = sheetToObjects_(getSheet_(CONFIG.SHEETS.COLLECTIONS))
    .filter(function (r) { return truthy_(r.is_active); })
    .sort(function (a, b) { return (a.sort_order || 0) - (b.sort_order || 0); })
    .map(function (r) {
      return {
        category: r.category, title: r.title, description: r.description,
        image_url: r.image_url, tag: r.tag, cta_text: r.cta_text, cta_url: r.cta_url
      };
    });

  const settingsRows = sheetToObjects_(getSheet_(CONFIG.SHEETS.SETTINGS));
  const settings = {};
  settingsRows.forEach(function (r) { settings[r.key] = r.value; });

  return {
    content: content,
    experience: experience,
    features: features,
    amenities: amenities,
    collections: collections,
    settings: settings,
    generated_at: nowIso_()
  };
}

function clearPublicCache() {
  CacheService.getScriptCache().remove(CONFIG.PUBLIC_CACHE_KEY);
  return apiSuccess_('Cache cleared.');
}

// ---------- ADMIN: CONTENT (key/value fields, e.g. Hero) ----------

/**
 * Returns full homepage content (including inactive rows) for the admin UI.
 */
function getHomepageContent(token) {
  return safeCall_(function () {
    const session = requireAuth_(token);
    if (!session) return apiError_('Unauthorized request.', 'UNAUTHORIZED');

    const content = sheetToObjects_(getSheet_(CONFIG.SHEETS.CONTENT)).map(function (r) {
      return {
        id: r.id, section: r.section, content_key: r.content_key, content_type: r.content_type,
        value: r.value, media_url: r.media_url, media_id: r.media_id, target_url: r.target_url,
        alt_text: r.alt_text, sort_order: r.sort_order, is_active: truthy_(r.is_active)
      };
    });

    const experience = sheetToObjects_(getSheet_(CONFIG.SHEETS.EXPERIENCE)).map(function (r) {
      return {
        id: r.id, slot: r.slot, title: r.title, image_url: r.image_url, media_id: r.media_id,
        alt_text: r.alt_text, sort_order: r.sort_order, is_active: truthy_(r.is_active)
      };
    });

    const features = sheetToObjects_(getSheet_(CONFIG.SHEETS.FEATURES)).map(function (r) {
      return {
        id: r.id, number: r.number, title: r.title, description: r.description,
        sort_order: r.sort_order, is_active: truthy_(r.is_active)
      };
    });

    const amenities = sheetToObjects_(getSheet_(CONFIG.SHEETS.AMENITIES)).map(function (r) {
      return { id: r.id, amenity: r.amenity, sort_order: r.sort_order, is_active: truthy_(r.is_active) };
    });

    return apiSuccess_('OK', { content: content, experience: experience, features: features, amenities: amenities });
  });
}

/**
 * Saves one CONTENT row (e.g. hero_title). content_type governs sanitization:
 * "html" allows the strict <br>/<em>/<strong> allowlist; everything else is
 * treated as plain text. target_url is protocol-validated.
 */
function saveContent(token, item) {
  return safeCall_(function () {
    const session = requireAuth_(token, [CONFIG.ROLES.SUPER_ADMIN, CONFIG.ROLES.EDITOR]);
    if (!session) return apiError_('Unauthorized request.', 'UNAUTHORIZED');
    if (!item || !item.section || !item.content_key) {
      return apiError_('Missing required fields.', 'INVALID_INPUT');
    }

    const sheet = getSheet_(CONFIG.SHEETS.CONTENT);
    const headerMap = getHeaderMap_(sheet);
    const rows = sheetToObjects_(sheet);
    let existing = item.id ? rows.filter(function (r) { return r.id === item.id; })[0] : null;
    if (!existing) {
      existing = rows.filter(function (r) { return r.section === item.section && r.content_key === item.content_key; })[0];
    }

    const contentType = ['text', 'html', 'image', 'link'].indexOf(item.content_type) !== -1 ? item.content_type : 'text';
    const value = contentType === 'html' ? sanitizeRichText_(item.value) : sanitizePlainText_(item.value);
    const targetUrl = sanitizeUrlOrEmpty_(item.target_url, { allowEmpty: true });
    const altText = sanitizePlainText_(item.alt_text || '');

    if (item.target_url && !targetUrl) {
      return apiError_('The link URL is not allowed. Use http(s):// links only.', 'INVALID_URL');
    }

    if (existing) {
      const row = existing.__row;
      sheet.getRange(row, headerMap['content_type']).setValue(contentType);
      sheet.getRange(row, headerMap['value']).setValue(value);
      if (item.media_url !== undefined) sheet.getRange(row, headerMap['media_url']).setValue(item.media_url);
      if (item.media_id !== undefined && headerMap['media_id']) sheet.getRange(row, headerMap['media_id']).setValue(item.media_id);
      sheet.getRange(row, headerMap['target_url']).setValue(targetUrl);
      sheet.getRange(row, headerMap['alt_text']).setValue(altText);
      if (item.sort_order !== undefined) sheet.getRange(row, headerMap['sort_order']).setValue(item.sort_order);
      if (item.is_active !== undefined) sheet.getRange(row, headerMap['is_active']).setValue(!!item.is_active);
      sheet.getRange(row, headerMap['updated_at']).setValue(nowIso_());
      sheet.getRange(row, headerMap['updated_by']).setValue(session.username);
    } else {
      sheet.appendRow([
        generateId_('cnt'), item.section, item.content_key, contentType, value,
        item.media_url || '', targetUrl, altText, item.sort_order || 0,
        item.is_active !== undefined ? !!item.is_active : true, nowIso_(), session.username
      ]);
    }

    writeAudit_(session.username, 'UPDATE_CONTENT', 'CONTENT', item.section + '.' + item.content_key, 'Updated ' + item.content_key);
    clearPublicCache();

    return apiSuccess_('Changes published successfully.');
  });
}

// ---------- ADMIN: EXPERIENCE ----------

function saveExperienceItem(token, item) {
  return safeCall_(function () {
    const session = requireAuth_(token, [CONFIG.ROLES.SUPER_ADMIN, CONFIG.ROLES.EDITOR]);
    if (!session) return apiError_('Unauthorized request.', 'UNAUTHORIZED');
    if (!item || !item.slot) return apiError_('Missing slot.', 'INVALID_INPUT');

    const sheet = getSheet_(CONFIG.SHEETS.EXPERIENCE);
    const headerMap = getHeaderMap_(sheet);
    const title = sanitizePlainText_(item.title || '');
    const altText = sanitizePlainText_(item.alt_text || '');

    let row = item.id ? findRowById_(sheet, item.id) : -1;
    if (row === -1) {
      sheet.appendRow([
        generateId_('exp'), item.slot, title, item.image_url || '', item.media_id || '',
        altText, item.sort_order || 0, item.is_active !== undefined ? !!item.is_active : true, nowIso_()
      ]);
    } else {
      sheet.getRange(row, headerMap['title']).setValue(title);
      if (item.image_url !== undefined) sheet.getRange(row, headerMap['image_url']).setValue(item.image_url);
      if (item.media_id !== undefined && headerMap['media_id']) sheet.getRange(row, headerMap['media_id']).setValue(item.media_id);
      sheet.getRange(row, headerMap['alt_text']).setValue(altText);
      if (item.sort_order !== undefined) sheet.getRange(row, headerMap['sort_order']).setValue(item.sort_order);
      if (item.is_active !== undefined) sheet.getRange(row, headerMap['is_active']).setValue(!!item.is_active);
      sheet.getRange(row, headerMap['updated_at']).setValue(nowIso_());
    }

    writeAudit_(session.username, 'UPDATE_CONTENT', 'EXPERIENCE', item.slot, 'Updated experience card ' + item.slot);
    clearPublicCache();
    return apiSuccess_('Changes published successfully.');
  });
}

// ---------- ADMIN: FEATURES (Why ALYF) ----------

function saveFeature(token, item) {
  return safeCall_(function () {
    const session = requireAuth_(token, [CONFIG.ROLES.SUPER_ADMIN, CONFIG.ROLES.EDITOR]);
    if (!session) return apiError_('Unauthorized request.', 'UNAUTHORIZED');
    if (!item || !item.title) return apiError_('Title is required.', 'INVALID_INPUT');

    const sheet = getSheet_(CONFIG.SHEETS.FEATURES);
    const headerMap = getHeaderMap_(sheet);
    const title = sanitizePlainText_(item.title);
    const description = sanitizePlainText_(item.description || '');
    const number = sanitizePlainText_(item.number || '');

    let row = item.id ? findRowById_(sheet, item.id) : -1;
    if (row === -1) {
      sheet.appendRow([
        generateId_('feat'), number, title, description,
        item.sort_order || 0, item.is_active !== undefined ? !!item.is_active : true, nowIso_()
      ]);
    } else {
      sheet.getRange(row, headerMap['number']).setValue(number);
      sheet.getRange(row, headerMap['title']).setValue(title);
      sheet.getRange(row, headerMap['description']).setValue(description);
      if (item.sort_order !== undefined) sheet.getRange(row, headerMap['sort_order']).setValue(item.sort_order);
      if (item.is_active !== undefined) sheet.getRange(row, headerMap['is_active']).setValue(!!item.is_active);
      sheet.getRange(row, headerMap['updated_at']).setValue(nowIso_());
    }

    writeAudit_(session.username, 'UPDATE_CONTENT', 'FEATURES', item.id || title, 'Saved feature ' + title);
    clearPublicCache();
    return apiSuccess_('Changes published successfully.');
  });
}

function deleteFeature(token, id) {
  return safeCall_(function () {
    const session = requireAuth_(token, [CONFIG.ROLES.SUPER_ADMIN]);
    if (!session) return apiError_('Unauthorized request.', 'UNAUTHORIZED');
    const sheet = getSheet_(CONFIG.SHEETS.FEATURES);
    const row = findRowById_(sheet, id);
    if (row === -1) return apiError_('Feature not found.', 'NOT_FOUND');
    sheet.deleteRow(row);
    writeAudit_(session.username, 'DELETE_CONTENT', 'FEATURES', id, 'Deleted feature');
    clearPublicCache();
    return apiSuccess_('Feature deleted.');
  });
}

// ---------- ADMIN: AMENITIES ----------

function saveAmenity(token, item) {
  return safeCall_(function () {
    const session = requireAuth_(token, [CONFIG.ROLES.SUPER_ADMIN, CONFIG.ROLES.EDITOR]);
    if (!session) return apiError_('Unauthorized request.', 'UNAUTHORIZED');
    if (!item || !item.amenity) return apiError_('Amenity text is required.', 'INVALID_INPUT');

    const sheet = getSheet_(CONFIG.SHEETS.AMENITIES);
    const headerMap = getHeaderMap_(sheet);
    const amenity = sanitizePlainText_(item.amenity);

    let row = item.id ? findRowById_(sheet, item.id) : -1;
    if (row === -1) {
      sheet.appendRow([generateId_('amn'), amenity, item.sort_order || 0, item.is_active !== undefined ? !!item.is_active : true, nowIso_()]);
    } else {
      sheet.getRange(row, headerMap['amenity']).setValue(amenity);
      if (item.sort_order !== undefined) sheet.getRange(row, headerMap['sort_order']).setValue(item.sort_order);
      if (item.is_active !== undefined) sheet.getRange(row, headerMap['is_active']).setValue(!!item.is_active);
      sheet.getRange(row, headerMap['updated_at']).setValue(nowIso_());
    }

    writeAudit_(session.username, 'UPDATE_CONTENT', 'AMENITIES', item.id || amenity, 'Saved amenity');
    clearPublicCache();
    return apiSuccess_('Changes published successfully.');
  });
}

function deleteAmenity(token, id) {
  return safeCall_(function () {
    const session = requireAuth_(token, [CONFIG.ROLES.SUPER_ADMIN]);
    if (!session) return apiError_('Unauthorized request.', 'UNAUTHORIZED');
    const sheet = getSheet_(CONFIG.SHEETS.AMENITIES);
    const row = findRowById_(sheet, id);
    if (row === -1) return apiError_('Amenity not found.', 'NOT_FOUND');
    sheet.deleteRow(row);
    writeAudit_(session.username, 'DELETE_CONTENT', 'AMENITIES', id, 'Deleted amenity');
    clearPublicCache();
    return apiSuccess_('Amenity deleted.');
  });
}

/**
 * Reorders a list of ids for a given sheet by writing fresh sort_order
 * values in the order supplied by the client (drag-and-drop UI).
 */
function reorderItems(token, sheetKey, orderedIds) {
  return safeCall_(function () {
    const session = requireAuth_(token, [CONFIG.ROLES.SUPER_ADMIN, CONFIG.ROLES.EDITOR]);
    if (!session) return apiError_('Unauthorized request.', 'UNAUTHORIZED');

    const allowed = ['FEATURES', 'AMENITIES', 'EXPERIENCE', 'COLLECTIONS'];
    if (allowed.indexOf(sheetKey) === -1) return apiError_('Invalid module.', 'INVALID_INPUT');

    const sheet = getSheet_(CONFIG.SHEETS[sheetKey]);
    const headerMap = getHeaderMap_(sheet);
    orderedIds.forEach(function (id, index) {
      const row = findRowById_(sheet, id);
      if (row !== -1) sheet.getRange(row, headerMap['sort_order']).setValue(index + 1);
    });

    writeAudit_(session.username, 'UPDATE_CONTENT', sheetKey, '', 'Reordered items');
    clearPublicCache();
    return apiSuccess_('Order updated.');
  });
}
