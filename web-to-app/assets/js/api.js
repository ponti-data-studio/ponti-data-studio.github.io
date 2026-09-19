/**
 * Web to App Builder — API client
 * Thin wrapper around fetch() for the Google Apps Script backend.
 *
 * Every call here is deliberately kept as a CORS "simple request":
 *   - GET: parameters go in the query string only.
 *   - POST: body is a plain JSON string with NO explicit headers set,
 *     so the browser defaults to "text/plain;charset=UTF-8". Do not
 *     add headers here — Apps Script Web Apps cannot answer a CORS
 *     preflight (OPTIONS) request, so anything that would trigger one
 *     will silently fail in the browser.
 */
(function (global) {
  'use strict';

  function buildUrl(action, extraParams) {
    var url = new URL(global.APP_CONFIG.GAS_API_URL);
    url.searchParams.set('action', action);
    if (extraParams) {
      Object.keys(extraParams).forEach(function (key) {
        var value = extraParams[key];
        if (value !== undefined && value !== null && value !== '') {
          url.searchParams.set(key, value);
        }
      });
    }
    return url.toString();
  }

  function networkErrorResult() {
    return { success: false, error: 'Tidak dapat terhubung ke server. Periksa koneksi Anda.' };
  }

  function apiGet(action, params) {
    return fetch(buildUrl(action, params), { method: 'GET' })
      .then(function (res) { return res.json(); })
      .catch(function (err) {
        console.error('API GET error (' + action + '):', err);
        return networkErrorResult();
      });
  }

  function apiPost(action, payload) {
    var body = JSON.stringify(Object.assign({ action: action }, payload));
    return fetch(global.APP_CONFIG.GAS_API_URL, {
      method: 'POST',
      body: body
    })
      .then(function (res) { return res.json(); })
      .catch(function (err) {
        console.error('API POST error (' + action + '):', err);
        return networkErrorResult();
      });
  }

  global.Api = {
    getApps: function () {
      return apiGet('getApps');
    },
    getStatistics: function () {
      return apiGet('getStatistics');
    },
    getAppBySlug: function (slug) {
      return apiGet('getAppBySlug', { slug: slug });
    },
    isSlugAvailable: function (slug, excludeId) {
      return apiGet('isSlugAvailable', { slug: slug, excludeId: excludeId });
    },
    getManifestUrl: function (slug, pwaUrl) {
      var url = new URL(global.APP_CONFIG.GAS_API_URL);
      url.searchParams.set('action', 'getManifest');
      url.searchParams.set('slug', slug);
      url.searchParams.set('pwaUrl', pwaUrl);
      return url.toString();
    },
    createApp: function (data) {
      return apiPost('createApp', { data: data });
    },
    updateApp: function (id, data) {
      return apiPost('updateApp', { id: id, data: data });
    },
    deleteApp: function (id) {
      return apiPost('deleteApp', { id: id });
    },
    uploadIcon: function (fileName, mimeType, base64Data) {
      return apiPost('uploadIcon', { fileName: fileName, mimeType: mimeType, base64Data: base64Data });
    }
  };
})(window);
