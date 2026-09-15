/**
 * Collections.gs
 * Manages the COLLECTIONS sheet (Jakarta, Bekasi & Karawang, Bali, and any
 * future property collections the admin adds — category is a free-form
 * slug, not hard-coded to three).
 */

function getCollections(token) {
  return safeCall_(function () {
    const session = requireAuth_(token);
    if (!session) return apiError_('Unauthorized request.', 'UNAUTHORIZED');

    const rows = sheetToObjects_(getSheet_(CONFIG.SHEETS.COLLECTIONS)).map(function (r) {
      return {
        id: r.id, category: r.category, title: r.title, description: r.description,
        image_url: r.image_url, media_id: r.media_id, tag: r.tag, cta_text: r.cta_text,
        cta_url: r.cta_url, sort_order: r.sort_order, is_active: truthy_(r.is_active)
      };
    }).sort(function (a, b) { return (a.sort_order || 0) - (b.sort_order || 0); });

    return apiSuccess_('OK', { collections: rows });
  });
}

function saveCollection(token, item) {
  return safeCall_(function () {
    const session = requireAuth_(token, [CONFIG.ROLES.SUPER_ADMIN, CONFIG.ROLES.EDITOR]);
    if (!session) return apiError_('Unauthorized request.', 'UNAUTHORIZED');
    if (!item || !item.title || !item.category) {
      return apiError_('Collection name and category are required.', 'INVALID_INPUT');
    }

    const title = sanitizePlainText_(item.title);
    const category = sanitizePlainText_(item.category).toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const description = sanitizePlainText_(item.description || '');
    const tag = sanitizePlainText_(item.tag || '');
    const ctaText = sanitizePlainText_(item.cta_text || '');
    const ctaUrl = sanitizeUrlOrEmpty_(item.cta_url, { allowEmpty: true });

    if (item.cta_url && !ctaUrl) {
      return apiError_('CTA URL is not allowed. Use a valid http(s) link (e.g. https://wa.me/...).', 'INVALID_URL');
    }

    const sheet = getSheet_(CONFIG.SHEETS.COLLECTIONS);
    const headerMap = getHeaderMap_(sheet);
    let row = item.id ? findRowById_(sheet, item.id) : -1;

    if (row === -1) {
      const id = generateId_('col');
      sheet.appendRow([
        id, category, title, description, item.image_url || '', tag, ctaText, ctaUrl,
        item.sort_order || (sheet.getLastRow()), item.is_active !== undefined ? !!item.is_active : true, nowIso_()
      ]);
      writeAudit_(session.username, 'UPDATE_CONTENT', 'COLLECTIONS', id, 'Created collection ' + title);
    } else {
      sheet.getRange(row, headerMap['category']).setValue(category);
      sheet.getRange(row, headerMap['title']).setValue(title);
      sheet.getRange(row, headerMap['description']).setValue(description);
      if (item.image_url !== undefined) sheet.getRange(row, headerMap['image_url']).setValue(item.image_url);
      if (item.media_id !== undefined && headerMap['media_id']) sheet.getRange(row, headerMap['media_id']).setValue(item.media_id);
      sheet.getRange(row, headerMap['tag']).setValue(tag);
      sheet.getRange(row, headerMap['cta_text']).setValue(ctaText);
      sheet.getRange(row, headerMap['cta_url']).setValue(ctaUrl);
      if (item.sort_order !== undefined) sheet.getRange(row, headerMap['sort_order']).setValue(item.sort_order);
      if (item.is_active !== undefined) sheet.getRange(row, headerMap['is_active']).setValue(!!item.is_active);
      sheet.getRange(row, headerMap['updated_at']).setValue(nowIso_());
      writeAudit_(session.username, 'UPDATE_CONTENT', 'COLLECTIONS', item.id, 'Updated collection ' + title);
    }

    clearPublicCache();
    return apiSuccess_('Changes published successfully.');
  });
}

function deleteCollection(token, id) {
  return safeCall_(function () {
    const session = requireAuth_(token, [CONFIG.ROLES.SUPER_ADMIN]);
    if (!session) return apiError_('Unauthorized request.', 'UNAUTHORIZED');

    const sheet = getSheet_(CONFIG.SHEETS.COLLECTIONS);
    const row = findRowById_(sheet, id);
    if (row === -1) return apiError_('Collection not found.', 'NOT_FOUND');

    sheet.deleteRow(row);
    writeAudit_(session.username, 'DELETE_CONTENT', 'COLLECTIONS', id, 'Deleted collection');
    clearPublicCache();
    return apiSuccess_('Collection deleted.');
  });
}
