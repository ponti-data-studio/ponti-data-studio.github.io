/**
 * Web to App Builder — Builder SPA logic
 */
(function () {
  'use strict';

  var appState = {
    apps: [],
    statistics: null,
    loadedSections: { home: false, apps: false }
  };

  /* ============================================================
   * LOCAL "MY APPS" STORE
   * Since there is no login, the backend Sheet is shared/global data
   * (needed so any visitor can open a PWA by slug). What each person
   * sees in their own Dashboard / My Apps, however, is tracked per
   * browser in localStorage — only apps THIS browser created. This
   * never touches Google Sheets for reading; only createApp/updateApp/
   * deleteApp still go to the backend (required for slug uniqueness
   * and so the PWA works for any visitor, on any device).
   * ========================================================== */
  var LOCAL_APPS_KEY = 'webToAppBuilder_myApps_v1';

  var LocalApps = {
    getAll: function () {
      try {
        var raw = localStorage.getItem(LOCAL_APPS_KEY);
        return raw ? JSON.parse(raw) : [];
      } catch (e) {
        console.warn('localStorage unavailable or corrupted:', e);
        return [];
      }
    },
    saveAll: function (apps) {
      try {
        localStorage.setItem(LOCAL_APPS_KEY, JSON.stringify(apps));
      } catch (e) {
        console.warn('Could not write to localStorage:', e);
      }
    },
    add: function (app) {
      var apps = this.getAll();
      apps.unshift(app);
      this.saveAll(apps);
      return apps;
    },
    update: function (updatedApp) {
      var apps = this.getAll();
      var idx = apps.findIndex(function (a) { return a.ID === updatedApp.ID; });
      if (idx !== -1) apps[idx] = updatedApp;
      this.saveAll(apps);
      return apps;
    },
    remove: function (id) {
      var apps = this.getAll().filter(function (a) { return a.ID !== id; });
      this.saveAll(apps);
      return apps;
    },
    computeStatistics: function (apps) {
      var total = apps.length;
      var active = apps.filter(function (a) { return a.STATUS === 'ACTIVE'; }).length;
      return { total: total, active: active, inactive: total - active };
    }
  };

  function getSiteBaseUrl() {
    // Works correctly whether hosted at a domain root, a GitHub Pages
    // project subpath, or a custom domain — always matches wherever
    // this exact page is actually being served from.
    return window.location.origin + window.location.pathname;
  }

  /* ============================================================
   * BOOTSTRAP — decide Builder mode vs PWA runtime mode
   * ========================================================== */
  function bootstrap() {
    var params = new URLSearchParams(window.location.search);
    var slug = params.get('app');

    if (slug) {
      window.PwaRuntime.init(slug);
    } else {
      initBuilder();
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(function (err) {
        console.log('SW registration failed:', err);
      });
    }
  }

  /* ============================================================
   * SPA NAVIGATION
   * ========================================================== */
  function showSection(sectionId) {
    document.querySelectorAll('.app-section').forEach(function (s) { s.classList.remove('active'); });
    var target = document.getElementById(sectionId);
    if (target) target.classList.add('active');

    document.querySelectorAll('.nav-link').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.section === sectionId);
    });

    closeSidebar();

    if (sectionId === 'homeSection' && !appState.loadedSections.home) loadHomeData();
    if (sectionId === 'appsSection' && !appState.loadedSections.apps) loadAppsData();
  }

  function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarBackdrop').classList.remove('visible');
  }

  function initBuilder() {
    document.querySelectorAll('.nav-link').forEach(function (btn) {
      btn.addEventListener('click', function () { showSection(btn.dataset.section); });
    });

    var menuToggle = document.getElementById('menuToggle');
    var sidebar = document.getElementById('sidebar');
    var backdrop = document.getElementById('sidebarBackdrop');

    menuToggle.addEventListener('click', function () {
      sidebar.classList.toggle('open');
      backdrop.classList.toggle('visible');
    });
    backdrop.addEventListener('click', closeSidebar);

    document.getElementById('ctaCreateBtn').addEventListener('click', function () { showSection('builderSection'); });
    document.getElementById('emptyCreateBtn').addEventListener('click', function () { showSection('builderSection'); });
    document.getElementById('appsEmptyCreateBtn').addEventListener('click', function () { showSection('builderSection'); });
    document.getElementById('resultNewBtn').addEventListener('click', function () {
      resetBuilderForm();
      showSection('builderSection');
    });

    setupLivePreview();
    setupCreateForm();
    setupAppsToolbar();

    document.getElementById('refreshHomeBtn').addEventListener('click', function () { loadHomeData(); });
    document.getElementById('refreshAppsBtn').addEventListener('click', function () { loadAppsData(); });

    updatePreview();
    loadHomeData();
  }

  /* ============================================================
   * TOAST / LOADING / ESCAPE HELPERS
   * ========================================================== */
  function showToast(message, type) {
    var container = document.getElementById('toastContainer');
    var toast = document.createElement('div');
    toast.className = 'toast toast-' + (type || 'info');
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(function () {
      toast.classList.add('toast-hide');
      setTimeout(function () { toast.remove(); }, 300);
    }, 3000);
  }

  function setLoading(elId, isLoading) {
    var el = document.getElementById(elId);
    if (el) el.hidden = !isLoading;
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
  function escapeAttr(str) { return escapeHtml(str); }

  function clientSanitizeSlug(input) {
    return String(input || '')
      .toLowerCase().trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function formatDateHuman(iso) {
    try {
      var d = new Date(iso);
      var months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli',
        'Agustus', 'September', 'Oktober', 'November', 'Desember'];
      return d.getUTCDate() + ' ' + months[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
    } catch (e) { return iso; }
  }

  /* ============================================================
   * DASHBOARD / HOME
   * ========================================================== */
  function loadHomeData() {
    document.getElementById('recentAppsEmpty').hidden = true;
    appState.apps = LocalApps.getAll();
    appState.statistics = LocalApps.computeStatistics(appState.apps);
    appState.loadedSections.home = true;
    renderStatistics();
    renderRecentApps();
  }

  function renderStatistics() {
    if (!appState.statistics) return;
    document.getElementById('statTotal').textContent = appState.statistics.total;
    document.getElementById('statActive').textContent = appState.statistics.active;
    document.getElementById('statInactive').textContent = appState.statistics.inactive;
  }

  function renderRecentApps() {
    var list = document.getElementById('recentAppsList');
    var empty = document.getElementById('recentAppsEmpty');
    list.innerHTML = '';
    var recent = appState.apps.slice(0, 6);
    if (recent.length === 0) { empty.hidden = false; return; }
    empty.hidden = true;
    recent.forEach(function (app) { list.appendChild(buildAppCard(app, true)); });
  }

  /* ============================================================
   * APP CARD (shared by Home + My Apps)
   * ========================================================== */
  function buildAppCard(app, compact) {
    var card = document.createElement('div');
    card.className = 'app-card';

    var pwaUrl = getSiteBaseUrl() + '?app=' + encodeURIComponent(app.SLUG);

    var iconHtml = app.ICON_URL
      ? '<img src="' + escapeAttr(app.ICON_URL) + '" alt="" class="app-card-icon" onerror="this.style.display=\'none\'">'
      : '<div class="app-card-icon-placeholder">📱</div>';

    card.innerHTML =
      '<div class="app-card-top">' +
        iconHtml +
        '<div class="app-card-info">' +
          '<div class="app-card-name">' + escapeHtml(app.APP_NAME) + '</div>' +
          '<div class="app-card-slug">' + escapeHtml(app.SLUG) + '</div>' +
        '</div>' +
        '<span class="badge badge-' + (app.STATUS === 'ACTIVE' ? 'success' : 'muted') + '">' + app.STATUS + '</span>' +
      '</div>' +
      '<div class="app-card-date">' + formatDateHuman(app.CREATED_AT) + '</div>' +
      '<div class="app-card-actions"></div>';

    var actions = card.querySelector('.app-card-actions');

    var openBtn = document.createElement('button');
    openBtn.className = 'btn btn-small btn-secondary';
    openBtn.type = 'button';
    openBtn.textContent = 'Buka';
    openBtn.addEventListener('click', function () { window.open(pwaUrl, '_blank'); });
    actions.appendChild(openBtn);

    var qrBtn = document.createElement('button');
    qrBtn.className = 'btn btn-small btn-secondary';
    qrBtn.type = 'button';
    qrBtn.textContent = 'QR';
    qrBtn.addEventListener('click', function () { openQrModal(app); });
    actions.appendChild(qrBtn);

    if (!compact) {
      var editBtn = document.createElement('button');
      editBtn.className = 'btn btn-small btn-secondary';
      editBtn.type = 'button';
      editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', function () { openEditModal(app); });
      actions.appendChild(editBtn);

      var delBtn = document.createElement('button');
      delBtn.className = 'btn btn-small btn-danger';
      delBtn.type = 'button';
      delBtn.textContent = 'Hapus';
      delBtn.addEventListener('click', function () { openDeleteModal(app); });
      actions.appendChild(delBtn);
    }

    return card;
  }

  /* ============================================================
   * MY APPS
   * ========================================================== */
  function loadAppsData() {
    appState.apps = LocalApps.getAll();
    appState.loadedSections.apps = true;
    renderAppsList();
  }

  function setupAppsToolbar() {
    var searchDebounceTimer = null;
    document.getElementById('appsSearchInput').addEventListener('input', function () {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(renderAppsList, 200);
    });
    document.getElementById('appsStatusFilter').addEventListener('change', renderAppsList);
    document.getElementById('appsSortSelect').addEventListener('change', renderAppsList);
  }

  function renderAppsList() {
    var list = document.getElementById('appsList');
    var empty = document.getElementById('appsEmpty');
    var noResult = document.getElementById('appsNoResult');
    list.innerHTML = '';

    if (appState.apps.length === 0) { empty.hidden = false; noResult.hidden = true; return; }
    empty.hidden = true;

    var query = document.getElementById('appsSearchInput').value.trim().toLowerCase();
    var statusFilter = document.getElementById('appsStatusFilter').value;
    var sortBy = document.getElementById('appsSortSelect').value;

    var filtered = appState.apps.filter(function (app) {
      var matchesQuery = !query ||
        app.APP_NAME.toLowerCase().indexOf(query) !== -1 ||
        app.SLUG.toLowerCase().indexOf(query) !== -1;
      var matchesStatus = !statusFilter || app.STATUS === statusFilter;
      return matchesQuery && matchesStatus;
    });

    filtered.sort(function (a, b) {
      if (sortBy === 'oldest') return new Date(a.CREATED_AT) - new Date(b.CREATED_AT);
      if (sortBy === 'name') return a.APP_NAME.localeCompare(b.APP_NAME);
      return new Date(b.CREATED_AT) - new Date(a.CREATED_AT);
    });

    if (filtered.length === 0) { noResult.hidden = false; return; }
    noResult.hidden = true;

    filtered.forEach(function (app) { list.appendChild(buildAppCard(app, false)); });
  }

  /* ============================================================
   * BUILDER: LIVE PREVIEW (frontend state only, no server calls)
   * ========================================================== */
  var fld = {};

  /* ============================================================
   * ICON PICKER (camera / file upload to Google Drive, or manual URL)
   * Reusable across the Create form and the Edit modal.
   * ========================================================== */
  var ALLOWED_ICON_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
  var MAX_ICON_BYTES = 3 * 1024 * 1024;

  function initIconPicker(opts) {
    function setPreview(url) {
      if (url) {
        opts.previewImg.src = url;
        opts.previewImg.hidden = false;
        opts.previewPlaceholder.hidden = true;
      } else {
        opts.previewImg.hidden = true;
        opts.previewPlaceholder.hidden = false;
      }
    }

    function setStatus(message, isError) {
      if (!opts.statusEl) return;
      opts.statusEl.textContent = message || '';
      opts.statusEl.hidden = !message;
      opts.statusEl.classList.toggle('icon-upload-error', !!isError);
      opts.statusEl.classList.toggle('icon-upload-success', !isError && !!message);
    }

    function commitValue(url) {
      opts.hiddenInput.value = url || '';
      setPreview(url);
      if (opts.onChange) opts.onChange();
    }

    function handleFile(file) {
      if (!file) return;

      if (ALLOWED_ICON_TYPES.indexOf(file.type) === -1) {
        setStatus('Format file tidak didukung. Gunakan PNG, JPG, WEBP, atau GIF.', true);
        return;
      }
      if (file.size > MAX_ICON_BYTES) {
        setStatus('Ukuran file terlalu besar. Maksimal 3 MB.', true);
        return;
      }

      var reader = new FileReader();
      reader.onload = function () {
        var dataUrl = reader.result;
        var base64 = dataUrl.split(',')[1];

        setPreview(dataUrl); // instant local preview while it uploads
        setStatus('Mengupload icon ke Google Drive...', false);

        Api.uploadIcon(file.name, file.type, base64).then(function (res) {
          if (!res.success) {
            setStatus(res.error, true);
            return;
          }
          commitValue(res.data.url);
          setStatus('✓ Icon berhasil diupload.', false);
        });
      };
      reader.onerror = function () {
        setStatus('Gagal membaca file. Coba file lain.', true);
      };
      reader.readAsDataURL(file);
    }

    opts.cameraBtn.addEventListener('click', function () { opts.cameraInput.click(); });
    opts.fileBtn.addEventListener('click', function () { opts.fileInput.click(); });
    opts.cameraInput.addEventListener('change', function () {
      handleFile(this.files[0]);
      this.value = '';
    });
    opts.fileInput.addEventListener('change', function () {
      handleFile(this.files[0]);
      this.value = '';
    });

    if (opts.urlToggleBtn && opts.urlBox) {
      opts.urlToggleBtn.addEventListener('click', function () {
        opts.urlBox.hidden = !opts.urlBox.hidden;
      });
    }
    if (opts.urlInput) {
      opts.urlInput.addEventListener('input', function () {
        setStatus('');
        commitValue(opts.urlInput.value.trim());
      });
    }

    setPreview(opts.hiddenInput.value || '');
  }

  function setupLivePreview() {
    fld.appName = document.getElementById('fldAppName');
    fld.appUrl = document.getElementById('fldAppUrl');
    fld.iconUrl = document.getElementById('fldIconUrl');
    fld.themeColor = document.getElementById('fldThemeColor');
    fld.bgColor = document.getElementById('fldBgColor');
    fld.description = document.getElementById('fldDescription');
    fld.slug = document.getElementById('fldSlug');

    [fld.appName, fld.appUrl, fld.themeColor, fld.bgColor, fld.description, fld.slug]
      .forEach(function (el) { el.addEventListener('input', updatePreview); });

    fld.appName.addEventListener('input', function () {
      if (!fld.slug.dataset.manuallyEdited) {
        fld.slug.value = clientSanitizeSlug(fld.appName.value);
        updatePreview();
      }
    });
    fld.slug.addEventListener('input', function () { fld.slug.dataset.manuallyEdited = 'true'; });

    initIconPicker({
      hiddenInput: fld.iconUrl,
      previewImg: document.getElementById('iconPickerPreviewImg'),
      previewPlaceholder: document.getElementById('iconPickerPreviewPlaceholder'),
      cameraBtn: document.getElementById('iconPickCameraBtn'),
      fileBtn: document.getElementById('iconPickFileBtn'),
      cameraInput: document.getElementById('iconCameraInput'),
      fileInput: document.getElementById('iconFileInput'),
      urlToggleBtn: document.getElementById('iconPickUrlToggle'),
      urlBox: document.getElementById('iconPickerUrlBox'),
      urlInput: document.getElementById('fldIconUrlManual'),
      statusEl: document.getElementById('iconUploadStatus'),
      onChange: updatePreview
    });
  }

  function updatePreview() {
    var previewName = document.getElementById('previewName');
    var previewDesc = document.getElementById('previewDesc');
    var previewIcon = document.getElementById('previewIcon');
    var previewIconPlaceholder = document.getElementById('previewIconPlaceholder');
    var pwaPreviewBox = document.getElementById('pwaPreviewBox');
    var pwaUrlPreview = document.getElementById('pwaUrlPreview');

    previewName.textContent = fld.appName.value.trim() || 'Nama Aplikasi';
    previewDesc.textContent = fld.description.value.trim() || 'Deskripsi aplikasi akan tampil di sini.';
    pwaPreviewBox.style.background = fld.bgColor.value || '#FFFFFF';

    var installBtn = pwaPreviewBox.querySelector('.preview-install-btn');
    if (installBtn) installBtn.style.background = fld.themeColor.value || '#2563EB';

    var iconUrl = fld.iconUrl.value.trim();
    if (iconUrl) {
      previewIcon.src = iconUrl;
      previewIcon.hidden = false;
      previewIconPlaceholder.hidden = true;
      previewIcon.onerror = function () {
        previewIcon.hidden = true;
        previewIconPlaceholder.hidden = false;
      };
    } else {
      previewIcon.hidden = true;
      previewIconPlaceholder.hidden = false;
    }

    var slugVal = fld.slug.value.trim();
    pwaUrlPreview.textContent = slugVal ? (getSiteBaseUrl() + '?app=' + slugVal) : '-';
  }

  /* ============================================================
   * BUILDER: CLIENT-SIDE VALIDATION (UX only — server re-validates)
   * ========================================================== */
  function clearFieldErrors() {
    ['AppName', 'AppUrl', 'IconUrl', 'Slug'].forEach(function (f) {
      var el = document.getElementById('err' + f);
      if (el) el.textContent = '';
    });
  }
  function setFieldError(fieldKey, message) {
    var el = document.getElementById('err' + fieldKey);
    if (el) el.textContent = message;
  }

  function validateFormClientSide() {
    clearFieldErrors();
    var valid = true;
    var name = fld.appName.value.trim();
    var url = fld.appUrl.value.trim();
    var icon = fld.iconUrl.value.trim();
    var slug = fld.slug.value.trim();

    if (!name) { setFieldError('AppName', 'Nama aplikasi wajib diisi.'); valid = false; }

    if (!url) {
      setFieldError('AppUrl', 'URL Google Apps Script wajib diisi.'); valid = false;
    } else if (!/^https:\/\/script\.google\.com\/macros\/s\/[a-zA-Z0-9_-]+\/exec(\?.*)?$/i.test(url)) {
      setFieldError('AppUrl', 'URL Google Apps Script tidak valid.'); valid = false;
    }

    if (!icon) {
      setFieldError('IconUrl', 'URL icon wajib diisi.'); valid = false;
    } else if (!/^https:\/\//i.test(icon)) {
      setFieldError('IconUrl', 'URL icon tidak valid. Periksa kembali URL icon.'); valid = false;
    }

    if (!slug) {
      setFieldError('Slug', 'Slug wajib diisi.'); valid = false;
    } else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      setFieldError('Slug', 'Format slug tidak valid.'); valid = false;
    }

    return valid;
  }

  /* ============================================================
   * BUILDER: SUBMIT (CREATE)
   * ========================================================== */
  function setupCreateForm() {
    var form = document.getElementById('createAppForm');
    var btn = document.getElementById('createAppBtn');

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!validateFormClientSide()) return;

      var data = {
        APP_NAME: fld.appName.value.trim(),
        APP_URL: fld.appUrl.value.trim(),
        ICON_URL: fld.iconUrl.value.trim(),
        THEME_COLOR: fld.themeColor.value,
        BACKGROUND_COLOR: fld.bgColor.value,
        DESCRIPTION: fld.description.value.trim(),
        SLUG: fld.slug.value.trim()
      };

      btn.disabled = true;
      btn.textContent = 'Membuat PWA...';

      Api.createApp(data).then(function (res) {
        btn.disabled = false;
        btn.textContent = 'BUAT PWA';

        if (!res.success) {
          showToast(res.error, 'error');
          if (res.error && res.error.toLowerCase().indexOf('slug') !== -1) {
            setFieldError('Slug', res.error);
          }
          return;
        }

        LocalApps.add(res.data);
        appState.apps = LocalApps.getAll();
        appState.statistics = LocalApps.computeStatistics(appState.apps);
        appState.loadedSections.home = true;
        appState.loadedSections.apps = true;
        renderStatistics();
        renderRecentApps();
        renderAppsList();

        showResult(res.data);
        showSection('resultSection');
      });
    });
  }

  function resetBuilderForm() {
    document.getElementById('createAppForm').reset();
    fld.themeColor.value = '#2563EB';
    fld.bgColor.value = '#FFFFFF';
    fld.iconUrl.value = '';
    delete fld.slug.dataset.manuallyEdited;
    clearFieldErrors();

    document.getElementById('iconPickerPreviewImg').hidden = true;
    document.getElementById('iconPickerPreviewPlaceholder').hidden = false;
    document.getElementById('iconPickerUrlBox').hidden = true;
    var statusEl = document.getElementById('iconUploadStatus');
    statusEl.hidden = true;
    statusEl.textContent = '';

    updatePreview();
  }

  /* ============================================================
   * RESULT SECTION
   * ========================================================== */
  function showResult(app) {
    var pwaUrl = getSiteBaseUrl() + '?app=' + encodeURIComponent(app.SLUG);
    document.getElementById('resultAppName').textContent = app.APP_NAME;
    document.getElementById('resultPwaUrl').textContent = pwaUrl;

    var iconEl = document.getElementById('resultAppIcon');
    if (app.ICON_URL) { iconEl.src = app.ICON_URL; iconEl.hidden = false; } else { iconEl.hidden = true; }

    document.getElementById('resultOpenBtn').onclick = function () { window.open(pwaUrl, '_blank'); };
    document.getElementById('resultCopyBtn').onclick = function () { copyToClipboard(pwaUrl); };
    document.getElementById('resultQrBtn').onclick = function () { openQrModal(app); };

    var shareBtn = document.getElementById('resultShareBtn');
    if (navigator.share) {
      shareBtn.hidden = false;
      shareBtn.onclick = function () {
        navigator.share({ title: app.APP_NAME, text: 'Buka ' + app.APP_NAME, url: pwaUrl }).catch(function () {});
      };
    } else {
      shareBtn.hidden = true;
    }
  }

  /* ============================================================
   * CLIPBOARD
   * ========================================================== */
  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(function () { showToast('Link berhasil disalin.', 'success'); })
        .catch(function () { fallbackCopy(text); });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      showToast('Link berhasil disalin.', 'success');
    } catch (e) {
      showToast('Gagal menyalin link.', 'error');
    }
    document.body.removeChild(textarea);
  }

  /* ============================================================
   * MODALS (generic)
   * ========================================================== */
  var modalOverlay, modalContainer;

  function openModal(html) {
    modalOverlay = modalOverlay || document.getElementById('modalOverlay');
    modalContainer = modalContainer || document.getElementById('modalContainer');
    modalContainer.innerHTML = html;
    modalOverlay.hidden = false;
  }
  function closeModal() {
    modalOverlay.hidden = true;
    modalContainer.innerHTML = '';
  }

  document.addEventListener('DOMContentLoaded', function () {
    modalOverlay = document.getElementById('modalOverlay');
    modalContainer = document.getElementById('modalContainer');
    modalOverlay.addEventListener('click', function (e) { if (e.target === modalOverlay) closeModal(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !modalOverlay.hidden) closeModal(); });
  });

  /* ============================================================
   * QR CODE MODAL
   * ========================================================== */
  function openQrModal(app) {
    var pwaUrl = getSiteBaseUrl() + '?app=' + encodeURIComponent(app.SLUG);
    openModal(
      '<div class="modal-header"><h3>QR Code</h3><button class="icon-btn" id="qrCloseBtn" type="button" aria-label="Tutup">&times;</button></div>' +
      '<div class="modal-body qr-modal-body">' +
        '<div id="qrCodeCanvas" class="qr-canvas"></div>' +
        '<p class="qr-app-name">' + escapeHtml(app.APP_NAME) + '</p>' +
        '<p class="muted">Scan QR Code untuk membuka aplikasi.</p>' +
        '<div class="modal-actions">' +
          '<button class="btn btn-secondary" id="qrDownloadBtn" type="button">Download QR</button>' +
          '<button class="btn btn-secondary" id="qrCopyBtn" type="button">Copy Link</button>' +
          '<button class="btn btn-ghost" id="qrCloseBtn2" type="button">Close</button>' +
        '</div>' +
      '</div>'
    );

    var qrContainer = document.getElementById('qrCodeCanvas');
    try {
      if (typeof QRCode !== 'undefined') {
        new QRCode(qrContainer, { text: pwaUrl, width: 200, height: 200 });
      } else {
        qrContainer.textContent = 'QR Code tidak dapat dimuat.';
      }
    } catch (e) {
      qrContainer.textContent = 'QR Code tidak dapat dimuat.';
    }

    document.getElementById('qrCloseBtn').addEventListener('click', closeModal);
    document.getElementById('qrCloseBtn2').addEventListener('click', closeModal);
    document.getElementById('qrCopyBtn').addEventListener('click', function () { copyToClipboard(pwaUrl); });
    document.getElementById('qrDownloadBtn').addEventListener('click', function () {
      var el = qrContainer.querySelector('img') || qrContainer.querySelector('canvas');
      if (!el) { showToast('QR Code belum siap.', 'error'); return; }
      var dataUrl = el.tagName === 'CANVAS' ? el.toDataURL('image/png') : el.src;
      var link = document.createElement('a');
      link.href = dataUrl;
      link.download = app.SLUG + '-qrcode.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  }

  /* ============================================================
   * EDIT MODAL
   * ========================================================== */
  function openEditModal(app) {
    openModal(
      '<div class="modal-header"><h3>Edit Aplikasi</h3><button class="icon-btn" id="editCloseBtn" type="button" aria-label="Tutup">&times;</button></div>' +
      '<div class="modal-body">' +
        '<form id="editAppForm">' +
          '<div class="form-group"><label for="editAppName">Nama Aplikasi</label>' +
          '<input type="text" id="editAppName" value="' + escapeAttr(app.APP_NAME) + '" required></div>' +

          '<div class="form-group"><label for="editAppUrlReadonly">Google Apps Script Web App URL</label>' +
          '<input type="text" id="editAppUrlReadonly" value="' + escapeAttr(app.APP_URL) + '" disabled></div>' +

          '<div class="form-group"><label>App Icon</label>' +
          '<div class="icon-picker">' +
            '<div class="icon-picker-preview" id="editIconPickerPreview">' +
              '<img id="editIconPickerPreviewImg" src="' + escapeAttr(app.ICON_URL) + '" alt="" ' + (app.ICON_URL ? '' : 'hidden') + '>' +
              '<span class="icon-picker-preview-placeholder" id="editIconPickerPreviewPlaceholder"' + (app.ICON_URL ? ' hidden' : '') + '>🖼️</span>' +
            '</div>' +
            '<div class="icon-picker-body">' +
              '<div class="icon-picker-actions">' +
                '<button type="button" class="btn btn-secondary btn-small" id="editIconPickCameraBtn">📷 Ambil Foto</button>' +
                '<button type="button" class="btn btn-secondary btn-small" id="editIconPickFileBtn">🖼️ Pilih File</button>' +
                '<button type="button" class="btn btn-ghost btn-small" id="editIconPickUrlToggle">Gunakan URL</button>' +
              '</div>' +
              '<div class="icon-picker-url" id="editIconPickerUrlBox" hidden>' +
                '<input type="url" id="editIconUrlManual" placeholder="https://example.com/icon.png" value="' + escapeAttr(app.ICON_URL) + '">' +
              '</div>' +
              '<p class="icon-upload-status" id="editIconUploadStatus" hidden></p>' +
            '</div>' +
          '</div>' +
          '<input type="hidden" id="editIconUrl" value="' + escapeAttr(app.ICON_URL) + '" required>' +
          '<input type="file" id="editIconCameraInput" accept="image/*" capture="environment" hidden>' +
          '<input type="file" id="editIconFileInput" accept="image/*" hidden>' +
          '</div>' +

          '<div class="form-row">' +
            '<div class="form-group"><label for="editThemeColor">Theme Color</label>' +
            '<input type="color" id="editThemeColor" value="' + escapeAttr(app.THEME_COLOR) + '"></div>' +
            '<div class="form-group"><label for="editBgColor">Background Color</label>' +
            '<input type="color" id="editBgColor" value="' + escapeAttr(app.BACKGROUND_COLOR) + '"></div>' +
          '</div>' +

          '<div class="form-group"><label for="editDescription">Description</label>' +
          '<textarea id="editDescription" rows="3">' + escapeHtml(app.DESCRIPTION || '') + '</textarea></div>' +

          '<div class="form-group"><label for="editSlug">Slug</label>' +
          '<input type="text" id="editSlug" value="' + escapeAttr(app.SLUG) + '" required>' +
          '<div class="field-error" id="editSlugError"></div></div>' +

          '<div class="form-group"><label for="editStatus">Status</label>' +
          '<select id="editStatus">' +
            '<option value="ACTIVE"' + (app.STATUS === 'ACTIVE' ? ' selected' : '') + '>ACTIVE</option>' +
            '<option value="INACTIVE"' + (app.STATUS === 'INACTIVE' ? ' selected' : '') + '>INACTIVE</option>' +
          '</select></div>' +

          '<div class="modal-actions">' +
            '<button type="button" class="btn btn-ghost" id="editCancelBtn">Batal</button>' +
            '<button type="submit" class="btn btn-primary" id="editSaveBtn">Simpan Perubahan</button>' +
          '</div>' +
        '</form>' +
      '</div>'
    );

    document.getElementById('editCloseBtn').addEventListener('click', closeModal);
    document.getElementById('editCancelBtn').addEventListener('click', closeModal);

    initIconPicker({
      hiddenInput: document.getElementById('editIconUrl'),
      previewImg: document.getElementById('editIconPickerPreviewImg'),
      previewPlaceholder: document.getElementById('editIconPickerPreviewPlaceholder'),
      cameraBtn: document.getElementById('editIconPickCameraBtn'),
      fileBtn: document.getElementById('editIconPickFileBtn'),
      cameraInput: document.getElementById('editIconCameraInput'),
      fileInput: document.getElementById('editIconFileInput'),
      urlToggleBtn: document.getElementById('editIconPickUrlToggle'),
      urlBox: document.getElementById('editIconPickerUrlBox'),
      urlInput: document.getElementById('editIconUrlManual'),
      statusEl: document.getElementById('editIconUploadStatus')
    });

    document.getElementById('editAppForm').addEventListener('submit', function (e) {
      e.preventDefault();
      document.getElementById('editSlugError').textContent = '';

      var slugVal = clientSanitizeSlug(document.getElementById('editSlug').value.trim());
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slugVal)) {
        document.getElementById('editSlugError').textContent = 'Format slug tidak valid.';
        return;
      }

      var updateData = {
        APP_NAME: document.getElementById('editAppName').value.trim(),
        ICON_URL: document.getElementById('editIconUrl').value.trim(),
        THEME_COLOR: document.getElementById('editThemeColor').value,
        BACKGROUND_COLOR: document.getElementById('editBgColor').value,
        DESCRIPTION: document.getElementById('editDescription').value.trim(),
        SLUG: slugVal,
        STATUS: document.getElementById('editStatus').value
      };

      var saveBtn = document.getElementById('editSaveBtn');
      saveBtn.disabled = true;
      saveBtn.textContent = 'Menyimpan...';

      Api.updateApp(app.ID, updateData).then(function (res) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Simpan Perubahan';

        if (!res.success) {
          document.getElementById('editSlugError').textContent = res.error;
          return;
        }

        LocalApps.update(res.data);
        appState.apps = LocalApps.getAll();
        appState.statistics = LocalApps.computeStatistics(appState.apps);

        closeModal();
        renderAppsList();
        renderRecentApps();
        renderStatistics();
        showToast('Perubahan berhasil disimpan.', 'success');
      });
    });
  }

  /* ============================================================
   * DELETE MODAL
   * ========================================================== */
  function openDeleteModal(app) {
    openModal(
      '<div class="modal-header"><h3>Hapus aplikasi ini?</h3></div>' +
      '<div class="modal-body">' +
        '<p><strong>Aplikasi:</strong> ' + escapeHtml(app.APP_NAME) + '</p>' +
        '<p class="muted">Konfigurasi aplikasi akan dihapus.</p>' +
        '<div class="modal-actions">' +
          '<button class="btn btn-ghost" id="deleteCancelBtn" type="button">Batal</button>' +
          '<button class="btn btn-danger" id="deleteConfirmBtn" type="button">Hapus</button>' +
        '</div>' +
      '</div>'
    );

    document.getElementById('deleteCancelBtn').addEventListener('click', closeModal);
    document.getElementById('deleteConfirmBtn').addEventListener('click', function () {
      var btn = document.getElementById('deleteConfirmBtn');
      btn.disabled = true;
      btn.textContent = 'Menghapus...';

      Api.deleteApp(app.ID).then(function (res) {
        if (!res.success) {
          showToast(res.error, 'error');
          btn.disabled = false;
          btn.textContent = 'Hapus';
          return;
        }

        LocalApps.remove(app.ID);
        appState.apps = LocalApps.getAll();
        appState.statistics = LocalApps.computeStatistics(appState.apps);

        closeModal();
        renderAppsList();
        renderRecentApps();
        renderStatistics();
        showToast('Aplikasi berhasil dihapus.', 'success');
      });
    });
  }

  /* ============================================================
   * INIT
   * ========================================================== */
  document.addEventListener('DOMContentLoaded', bootstrap);

})();
