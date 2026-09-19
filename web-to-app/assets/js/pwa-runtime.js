/**
 * Web to App Builder — PWA runtime mode
 * Handles ?app=slug: fetches the app config from the backend API and
 * renders the wrapper + iframe + install flow entirely client-side.
 *
 * Manifest note: the <link rel="manifest"> is pointed at a backend
 * (Apps Script) URL that generates this app's manifest fresh on every
 * request — not a Blob URL built in this page's own JS. Blob URLs only
 * stay valid for the lifetime of the document that created them, which
 * is unreliable for OS-level install/icon generation that can happen
 * asynchronously; a real, stable network URL does not have that
 * problem (see applyManifestLink below).
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

  /**
   * Points <link rel="manifest"> at a real backend URL that stays
   * fetchable indefinitely, instead of a Blob URL built in this page's
   * own JS. A Blob URL only lives as long as this tab/document does —
   * if the browser fetches the manifest (and its icon) for the OS-level
   * install shortcut asynchronously, possibly after this tab is gone,
   * a Blob URL fetch fails and the OS falls back to a generic letter
   * icon. A stable network URL does not have that problem.
   */
  function applyManifestLink(app, pwaUrl) {
    try {
      var manifestUrl = global.Api.getManifestUrl(app.SLUG, pwaUrl);
      qs('manifestLink').setAttribute('href', manifestUrl);
    } catch (err) {
      console.warn('Could not set manifest link:', err);
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
    applyManifestLink(app, pwaUrl);

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

    setupInstallBanner(app);
  }

  /**
   * Floating install notification. Two paths:
   *  - Browsers that fire beforeinstallprompt (most Chromium-based
   *    browsers on Android/desktop): banner's Install button triggers
   *    the real native install prompt.
   *  - iOS Safari (never fires beforeinstallprompt): banner instead
   *    shows manual "Add to Home Screen" instructions, since that is
   *    the only install path available there.
   * Dismissing is remembered per-app for the current browser session
   * only, so it doesn't nag on every single page view.
   */
  function setupInstallBanner(app) {
    var banner = qs('pwaInstallBanner');
    var installBtn = qs('pwaInstallBannerInstall');
    var dismissBtn = qs('pwaInstallBannerDismiss');
    var descEl = qs('pwaInstallBannerDesc');
    var iconEl = qs('pwaInstallBannerIcon');

    iconEl.src = app.ICON_URL;
    qs('pwaInstallBannerTitle').textContent = 'Install ' + app.APP_NAME + '?';

    var dismissedKey = 'pwaInstallDismissed_' + app.SLUG;
    var deferredPrompt = null;

    var isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
    var isStandalone = ('standalone' in navigator && navigator.standalone) ||
      window.matchMedia('(display-mode: standalone)').matches;

    if (isStandalone) return; // already installed/running as an app — no need to ask

    function hideBanner() {
      banner.hidden = true;
    }

    function showBanner() {
      try {
        if (sessionStorage.getItem(dismissedKey)) return;
      } catch (e) { /* ignore storage errors, just show it */ }
      banner.hidden = false;
    }

    dismissBtn.addEventListener('click', function () {
      hideBanner();
      try { sessionStorage.setItem(dismissedKey, '1'); } catch (e) {}
    });

    if (isIos) {
      // No native prompt exists on iOS Safari — go straight to instructions.
      descEl.textContent = 'Ketuk ikon Share (kotak dengan panah ke atas) di Safari, lalu pilih "Add to Home Screen".';
      installBtn.textContent = 'Mengerti';
      installBtn.addEventListener('click', hideBanner);
      setTimeout(showBanner, 1200);
      return;
    }

    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferredPrompt = e;
      showBanner();
    });

    installBtn.addEventListener('click', function () {
      if (!deferredPrompt) { hideBanner(); return; }
      deferredPrompt.prompt();
      deferredPrompt.userChoice.finally(function () {
        deferredPrompt = null;
        hideBanner();
      });
    });

    window.addEventListener('appinstalled', function () {
      hideBanner();
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
