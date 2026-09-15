/**
 * Settings.gs
 * Manages the SETTINGS sheet — global key/value site settings such as
 * social links, contact info, and copyright text.
 */

const SETTINGS_URL_KEYS_ = ['instagram_url', 'whatsapp_number', 'contact_email'];

function getSettings(token) {
  return safeCall_(function () {
    const session = requireAuth_(token);
    if (!session) return apiError_('Unauthorized request.', 'UNAUTHORIZED');

    const rows = sheetToObjects_(getSheet_(CONFIG.SHEETS.SETTINGS)).map(function (r) {
      return { key: r.key, value: r.value, description: r.description };
    });
    return apiSuccess_('OK', { settings: rows });
  });
}

function saveSettings(token, settingsMap) {
  return safeCall_(function () {
    const session = requireAuth_(token, [CONFIG.ROLES.SUPER_ADMIN]);
    if (!session) return apiError_('Unauthorized request.', 'UNAUTHORIZED');
    if (!settingsMap || typeof settingsMap !== 'object') {
      return apiError_('Invalid settings payload.', 'INVALID_INPUT');
    }

    const sheet = getSheet_(CONFIG.SHEETS.SETTINGS);
    const headerMap = getHeaderMap_(sheet);
    const rows = sheetToObjects_(sheet);

    for (const key in settingsMap) {
      if (!settingsMap.hasOwnProperty(key)) continue;
      let value = settingsMap[key];

      if (key === 'instagram_url' || key === 'whatsapp_number') {
        const cleaned = sanitizeUrlOrEmpty_(value, { allowEmpty: true, waOnly: key === 'whatsapp_number' });
        if (value && !cleaned) {
          return apiError_('Invalid URL for ' + key + '.', 'INVALID_URL');
        }
        value = cleaned;
      } else if (key === 'contact_email') {
        value = sanitizePlainText_(value);
        if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          return apiError_('Invalid contact email.', 'INVALID_INPUT');
        }
      } else {
        value = sanitizePlainText_(value);
      }

      const existing = rows.filter(function (r) { return r.key === key; })[0];
      if (existing) {
        sheet.getRange(existing.__row, headerMap['value']).setValue(value);
        sheet.getRange(existing.__row, headerMap['updated_at']).setValue(nowIso_());
      } else {
        sheet.appendRow([key, value, '', nowIso_()]);
      }
    }

    writeAudit_(session.username, 'UPDATE_SETTING', 'SETTINGS', '', 'Updated site settings');
    clearPublicCache();
    return apiSuccess_('Settings saved successfully.');
  });
}
