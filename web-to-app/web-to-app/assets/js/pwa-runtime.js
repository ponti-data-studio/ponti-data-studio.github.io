/**
 * Web to App Builder — PWA runtime mode
 * Handles ?app=slug: fetches the app config from the backend API and
 * renders the wrapper + iframe + install flow entirely client-side.
 *
 * Manifest note: since this page is served from a static host, we can
 * dynamically rewrite the <link rel="manifest"> href to a Blob URL built
 * from this app's own config (name/icon/colors) — giving each customer
 * app a distinct, correct install identity without any backend HTML
 * rendering. This is applied before install-eligibility is evaluated by
 * the browser.
 */
(function (global) {
  'use strict';

  function qs(id) { return document.getElementById(id); }

  var HEX_COLOR_RE = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;

  function showError(title, message) {
    qs('pwaLoadingScreen') && (qs('pwaLoadingScreen').hidden = true);
    qs('pwaWrapper').hidden = true;
    var screen = qs('pwaErrorScreen');
    screen.hidden = false;
    qs('pwaErrorTitle').textContent = title;
    qs('pwaErrorMessage').textContent = message;
  }

  function getPwaUrl(slug) {
    return window.location.origin + window.location.pathname + '?app=' + encodeURIComponent(slug);
  }

  function buildManifestObject(app, pwaUrl) {
    var shortName = app.APP_NAME.length > 12 ? app.APP_NAME.substring(0, 12) : app.APP_NAME;
    return {
      name: app.APP_NAME,
      short_name: shortName,
      description: app.DESCRIPTION || app.APP_NAME,
      start_url: pwaUrl,
      scope: pwaUrl,
      display: 'standalone',
      orientation: 'portrait',
      theme_color: app.THEME_COLOR,
      background_color: app.BACKGROUND_COLOR,
      icons: [
        { src: app.ICON_URL, sizes: '192x192', type: 'image/png' },
        { src: app.ICON_URL, sizes: '512x512', type: 'image/png' }
      ]
    };
  }

  function applyDynamicManifest(app, pwaUrl) {
    try {
      var manifest = buildManifestObject(app, pwaUrl);
      var blob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      qs('manifestLink').setAttribute('href', url);
    } catch (err) {
      console.warn('Dynamic manifest could not be applied:', err);
    }
  }

  function isConfigValid(app) {
    return !!(
      app.APP_NAME &&
      app.ICON_URL &&
      app.APP_URL &&
      HEX_COLOR_RE.test(app.THEME_COLOR || '') &&
      HEX_COLOR_RE.test(app.BACKGROUND_COLOR || '')
    );
  }

  function renderApp(app) {
    var pwaUrl = getPwaUrl(app.SLUG);

    document.title = app.APP_NAME;
    qs('themeColorMeta').setAttribute('content', app.THEME_COLOR);
    applyDynamicManifest(app, pwaUrl);

    qs('pwaHeaderIcon').src = app.ICON_URL;
    qs('pwaHeaderTitle').textContent = app.APP_NAME;
    qs('pwaHeader').style.background = app.THEME_COLOR;
    qs('pwaLoadingScreen').style.background = app.BACKGROUND_COLOR;
    qs('pwaLoadingIcon').src = app.ICON_URL;

    var iframe = qs('pwaIframe');
    iframe.title = app.APP_NAME;
    iframe.src = app.APP_URL;

    qs('pwaErrorScreen').hidden = true;
    qs('pwaWrapper').hidden = false;

    iframe.addEventListener('load', function () {
      qs('pwaLoadingScreen').hidden = true;
    });

    window.addEventListener('offline', function () { qs('pwaOfflineScreen').style.display = 'flex'; });
    window.addEventListener('online', function () { qs('pwaOfflineScreen').style.display = 'none'; });

    var deferredPrompt = null;
    var installBtn = qs('pwaInstallBtn');

    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferredPrompt = e;
      installBtn.hidden = false;
    });

    installBtn.addEventListener('click', function () {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      deferredPrompt.userChoice.finally(function () {
        deferredPrompt = null;
        installBtn.hidden = true;
      });
    });

    window.addEventListener('appinstalled', function () {
      installBtn.hidden = true;
      deferredPrompt = null;
    });
  }

  function init(slug) {
    qs('builderRoot').hidden = true;
    qs('pwaRoot').hidden = false;
    document.title = 'Memuat...';

    global.Api.getAppBySlug(slug).then(function (res) {
      if (!res.success) {
        showError('Terjadi kesalahan.', 'Silakan coba lagi.');
        return;
      }
      var app = res.data;
      if (!app) {
        showError('Aplikasi tidak ditemukan.', 'Aplikasi dengan URL tersebut tidak tersedia. Periksa kembali URL aplikasi.');
        return;
      }
      if (app.STATUS !== 'ACTIVE') {
        showError('Aplikasi sedang tidak tersedia.', 'Aplikasi ini sedang tidak aktif.');
        return;
      }
      if (!isConfigValid(app)) {
        showError('Konfigurasi aplikasi tidak valid.', 'Silakan hubungi administrator.');
        return;
      }
      renderApp(app);
    }).catch(function () {
      showError('Terjadi kesalahan.', 'Silakan coba lagi.');
    });
  }

  global.PwaRuntime = { init: init };
})(window);
