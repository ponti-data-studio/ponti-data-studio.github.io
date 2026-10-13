/**
 * Mytime — api.js
 * Transport ke backend GAS. Otomatis memakai google.script.run bila aplikasi disajikan dari GAS,
 * selain itu fetch POST (text/plain, tanpa CORS preflight) ke URL Web App.
 * Semua kegagalan dinormalisasi menjadi ApiError { code, message, extra }.
 */
(function () {
  'use strict';
  var TI = window.TI = window.TI || {};
  var LS_URL = 'ti.apiUrl';
  var LS_TOKEN = 'ti.session';

  function ApiError(code, message, extra) {
    this.name = 'ApiError';
    this.code = code;
    this.message = message;
    this.extra = extra || {};
  }
  ApiError.prototype = Object.create(Error.prototype);

  function isGasHosted() {
    return !!(window.google && window.google.script && window.google.script.run);
  }

  function getApiUrl() {
    var cfg = (window.TI_CONFIG && window.TI_CONFIG.API_URL) || '';
    var saved = '';
    try { saved = localStorage.getItem(LS_URL) || ''; } catch (e) { /* storage diblokir */ }
    return saved || cfg;
  }
  function setApiUrl(url) {
    try {
      if (url) localStorage.setItem(LS_URL, url); else localStorage.removeItem(LS_URL);
    } catch (e) { /* abaikan */ }
  }
  function isConfigured() { return isGasHosted() || !!getApiUrl(); }

  function validateApiUrl(url) {
    try {
      var u = new URL(url);
      if (u.protocol !== 'https:' && u.hostname !== 'localhost' && u.hostname !== '127.0.0.1') return 'URL harus memakai https://';
      return '';
    } catch (e) { return 'URL tidak valid.'; }
  }

  // Token sesi (bukan PIN) disimpan agar sesi bertahan setelah aplikasi ditutup.
  var session = null;
  function loadSession() {
    try { session = JSON.parse(localStorage.getItem(LS_TOKEN) || 'null'); } catch (e) { session = null; }
    return session;
  }
  function saveSession(s) {
    session = s;
    try {
      if (s) localStorage.setItem(LS_TOKEN, JSON.stringify(s)); else localStorage.removeItem(LS_TOKEN);
    } catch (e) { /* abaikan */ }
  }
  function getSession() { return session || loadSession(); }

  function viaGas(body, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var done = false;
      var timer = setTimeout(function () {
        if (done) return;
        done = true;
        reject(new ApiError('TIMEOUT', 'Server tidak merespons. Coba lagi.'));
      }, timeoutMs);
      window.google.script.run
        .withSuccessHandler(function (text) {
          if (done) return;
          done = true; clearTimeout(timer);
          try { resolve(JSON.parse(text)); } catch (e) { reject(new ApiError('SERVER_ERROR', 'Respons server tidak valid.')); }
        })
        .withFailureHandler(function () {
          if (done) return;
          done = true; clearTimeout(timer);
          reject(new ApiError('NETWORK', 'Tidak dapat terhubung ke server.'));
        })
        .apiDispatch(JSON.stringify(body));
    });
  }

  function viaFetch(body, timeoutMs) {
    var url = getApiUrl();
    if (!url) return Promise.reject(new ApiError('NOT_CONFIGURED', 'URL backend belum diatur.'));
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, timeoutMs);
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
      redirect: 'follow',
      credentials: 'omit',
      cache: 'no-store',
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (res) {
      clearTimeout(timer);
      if (!res.ok) throw new ApiError('SERVER_ERROR', 'Server merespons dengan status ' + res.status + '.');
      return res.text().then(function (text) {
        try { return JSON.parse(text); }
        catch (e) {
          throw new ApiError('SERVER_ERROR', 'Respons bukan JSON. Pastikan Web App di-deploy dengan akses "Anyone" dan URL berakhiran /exec.');
        }
      });
    }, function (err) {
      clearTimeout(timer);
      if (err && err.name === 'AbortError') throw new ApiError('TIMEOUT', 'Server tidak merespons. Coba lagi.');
      throw new ApiError(navigator.onLine === false ? 'OFFLINE' : 'NETWORK',
        navigator.onLine === false ? 'Perangkat sedang offline.' : 'Tidak dapat terhubung ke server.');
    });
  }

  /**
   * Panggil aksi API. Resolve dengan `data`; reject dengan ApiError.
   * @param {string} action
   * @param {Object} payload
   * @param {{timeout?: number, noAuth?: boolean}} opts
   */
  function call(action, payload, opts) {
    opts = opts || {};
    if (navigator.onLine === false && !isGasHosted()) {
      return Promise.reject(new ApiError('OFFLINE', 'Perangkat sedang offline.'));
    }
    var s = getSession();
    var body = { action: action, payload: payload || {} };
    if (!opts.noAuth && s && s.token) body.token = s.token;
    var timeout = opts.timeout || 30000;
    var p = isGasHosted() ? viaGas(body, timeout) : viaFetch(body, timeout);
    return p.then(function (res) {
      if (!res || typeof res !== 'object' || typeof res.success !== 'boolean') {
        throw new ApiError('SERVER_ERROR', 'Respons server tidak dikenali.');
      }
      if (!res.success) {
        var err = res.error || {};
        throw new ApiError(err.code || 'SERVER_ERROR', res.message || 'Terjadi kesalahan.', err);
      }
      return res.data;
    });
  }

  function isConnectivityError(e) {
    return e && (e.code === 'OFFLINE' || e.code === 'NETWORK' || e.code === 'TIMEOUT');
  }

  TI.ApiError = ApiError;
  TI.api = {
    call: call, isGasHosted: isGasHosted, getApiUrl: getApiUrl, setApiUrl: setApiUrl, isConfigured: isConfigured,
    validateApiUrl: validateApiUrl, getSession: getSession, saveSession: saveSession, isConnectivityError: isConnectivityError
  };
})();
