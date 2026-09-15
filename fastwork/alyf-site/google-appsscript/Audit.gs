/**
 * Audit.gs
 * Every meaningful admin action is written to the AUDIT_LOG sheet.
 * Never logs passwords or other sensitive authentication material.
 */

function writeAudit_(user, action, module, targetId, description) {
  try {
    const sheet = getSheet_(CONFIG.SHEETS.AUDIT_LOG);
    sheet.appendRow([
      generateId_('log'),
      user || 'unknown',
      action || '',
      module || '',
      targetId || '',
      description || '',
      nowIso_(),
      Session.getTemporaryActiveUserKey() || ''
    ]);
  } catch (err) {
    console.error('Failed to write audit log: ' + err);
  }
}

/**
 * Returns the most recent audit log entries (newest first).
 * Requires an authenticated session; any active role may view.
 */
function getAuditLogs(token, limit) {
  return safeCall_(function () {
    const session = requireAuth_(token);
    if (!session) return apiError_('Unauthorized request.', 'UNAUTHORIZED');

    const sheet = getSheet_(CONFIG.SHEETS.AUDIT_LOG);
    const rows = sheetToObjects_(sheet);
    rows.sort(function (a, b) { return new Date(b.timestamp) - new Date(a.timestamp); });

    const capped = rows.slice(0, limit && limit > 0 ? limit : 100).map(function (r) {
      return {
        id: r.id,
        user: r.user,
        action: r.action,
        module: r.module,
        target_id: r.target_id,
        description: r.description,
        timestamp: r.timestamp
      };
    });

    return apiSuccess_('OK', { logs: capped });
  });
}
