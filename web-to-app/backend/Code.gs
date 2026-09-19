/**
 * ============================================================
 * Web to App Builder — Backend API (Google Apps Script)
 * Code.gs — JSON API router
 * ============================================================
 *
 * This backend is now a PURE JSON API. It renders no HTML at all.
 * The actual UI (Builder + PWA wrapper) lives in a separate static
 * frontend (HTML/CSS/JS) that you can host anywhere — e.g. GitHub Pages —
 * and which talks to this API via fetch().
 *
 * ------------------------------------------------------------
 * CORS constraint — READ THIS before changing request shapes:
 * ------------------------------------------------------------
 * Apps Script Web Apps cannot set custom CORS response headers and
 * cannot properly answer a CORS "preflight" (OPTIONS) request. So every
 * request from the frontend MUST remain a "simple request" under the
 * Fetch/CORS spec, or the browser will block it:
 *
 *   - GET requests (all read operations) — always simple, no problem.
 *   - POST requests (create/update/delete) — the frontend sends the
 *     JSON payload as a plain string with NO explicit Content-Type
 *     header (fetch() then defaults to "text/plain;charset=UTF-8",
 *     which is CORS-safe). Never switch this to
 *     "Content-Type: application/json" or add custom headers — doing
 *     so triggers a preflight this backend cannot answer.
 *
 * Endpoints (GET, via ?action=...):
 *   getApps
 *   getStatistics
 *   getAppBySlug&slug=...
 *   isSlugAvailable&slug=...&excludeId=...   (excludeId optional)
 *
 * Endpoints (POST, JSON body: { action, ...payload }):
 *   { action: "createApp", data: {...} }
 *   { action: "updateApp", id: "...", data: {...} }
 *   { action: "deleteApp", id: "..." }
 * ============================================================
 */

function doGet(e) {
  var params = (e && e.parameter) || {};
  var action = params.action;

  try {
    switch (action) {
      case 'getApps':
        return jsonOutput(getApps());

      case 'getStatistics':
        return jsonOutput(getStatistics());

      case 'getAppBySlug': {
        var app = getAppBySlug(params.slug);
        return jsonOutput({ success: true, data: app || null });
      }

      case 'isSlugAvailable': {
        var available = isSlugAvailable(params.slug, params.excludeId || null);
        return jsonOutput({ success: true, data: { available: available } });
      }

      default:
        return jsonOutput({ success: false, error: 'Aksi tidak dikenal.' });
    }
  } catch (err) {
    console.error('doGet error: ' + err);
    return jsonOutput({ success: false, error: friendlyError(err) });
  }
}

function doPost(e) {
  try {
    var raw = (e && e.postData && e.postData.contents) ? e.postData.contents : '{}';
    var body = JSON.parse(raw);
    var action = body.action;

    switch (action) {
      case 'createApp':
        return jsonOutput(createApp(body.data || {}));

      case 'updateApp':
        return jsonOutput(updateApp(body.id, body.data || {}));

      case 'deleteApp':
        return jsonOutput(deleteApp(body.id));

      default:
        return jsonOutput({ success: false, error: 'Aksi tidak dikenal.' });
    }
  } catch (err) {
    console.error('doPost error: ' + err);
    return jsonOutput({ success: false, error: friendlyError(err) });
  }
}

function jsonOutput(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
