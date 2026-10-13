/**
 * Mytime — ui.js
 * Router SPA (showSection/hideSection/loadSectionData/refreshSection), navigasi, bottom sheet,
 * notifikasi SweetAlert2, indikator sinkronisasi, dock timer, FAB.
 */
(function () {
  'use strict';
  var TI = window.TI = window.TI || {};
  var U = TI.util, h = U.h;
  TI.views = TI.views || {};

  var SECTIONS = {
    home: { title: 'Home', icon: 'house', nav: true },
    tasks: { title: 'Tasks', icon: 'list-checks', nav: true },
    focus: { title: 'Focus', icon: 'timer', nav: true },
    goals: { title: 'Goals', icon: 'target', nav: true },
    more: { title: 'More', icon: 'ellipsis', nav: true },
    track: { title: 'Time Tracking', icon: 'clock', parent: 'more' },
    habits: { title: 'Habits', icon: 'repeat', parent: 'more' },
    budget: { title: 'Time Budget', icon: 'wallet', parent: 'more' },
    calendar: { title: 'Calendar', icon: 'calendar-days', parent: 'more' },
    analytics: { title: 'Analytics', icon: 'chart-column', parent: 'more' },
    review: { title: 'Review', icon: 'clipboard-check', parent: 'more' },
    journal: { title: 'Journal', icon: 'book-open', parent: 'more' },
    settings: { title: 'Settings', icon: 'settings', parent: 'more' }
  };
  var MORE_ORDER = ['track', 'habits', 'budget', 'calendar', 'analytics', 'review', 'journal', 'settings'];

  var currentSection = null;
  var currentParams = {};
  var loaded = {};
  var stale = {};

  // ---------------------------------------------------------------- notifikasi (SweetAlert2)
  var Toast = null;
  function toast(message, icon) {
    if (!window.Swal) return;
    Toast = Toast || Swal.mixin({ toast: true, position: 'top', timer: 2400, showConfirmButton: false, timerProgressBar: false });
    Toast.fire({ icon: icon || 'success', title: message });
  }
  function confirmDialog(title, text, opts) {
    opts = opts || {};
    return Swal.fire({
      title: title, text: text, icon: opts.icon || (opts.danger ? 'warning' : 'question'),
      showCancelButton: true, confirmButtonText: opts.confirmText || 'Ya', cancelButtonText: opts.cancelText || 'Batal',
      reverseButtons: true, focusCancel: !!opts.danger,
      confirmButtonColor: opts.danger ? '#DC2626' : undefined
    }).then(function (r) { return !!r.isConfirmed; });
  }
  function alertError(err, title) {
    var msg = (err && err.message) || String(err || 'Terjadi kesalahan.');
    return Swal.fire({ icon: 'error', title: title || 'Tidak berhasil', text: msg, confirmButtonText: 'Tutup' });
  }
  function alertInfo(title, text) {
    return Swal.fire({ icon: 'info', title: title, text: text, confirmButtonText: 'Mengerti' });
  }
  function loading(title) {
    Swal.fire({ title: title || 'Memproses…', allowOutsideClick: false, allowEscapeKey: false, didOpen: function () { Swal.showLoading(); } });
  }
  function closeLoading() { if (Swal.isVisible()) Swal.close(); }

  // ---------------------------------------------------------------- bottom sheet
  var openSheets = [];
  function sheet(opts) {
    var backdrop = h('div', { class: 'sheet-backdrop', role: 'presentation' });
    var titleId = 'sh-' + U.uuid().slice(0, 8);
    var body = h('div', { class: 'sheet-body' });
    var foot = h('div', { class: 'sheet-foot' });
    var closeBtn = h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Tutup' }, TI.icon('x'));
    var box = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId },
      h('div', { class: 'sheet-head' }, h('h2', { id: titleId, text: opts.title || '' }), closeBtn),
      body);
    if (opts.content) U.append(body, typeof opts.content === 'function' ? opts.content(body) : opts.content);
    var api = { el: box, body: body, close: close, setBusy: setBusy };
    var buttons = [];
    (opts.actions || []).forEach(function (a) {
      var b = h('button', { type: 'button', class: 'btn ' + (a.kind || '') }, a.icon ? TI.icon(a.icon, 18) : null, a.label);
      b.addEventListener('click', function () {
        if (b.disabled) return;
        var r = a.onClick ? a.onClick(api) : true;
        if (r && typeof r.then === 'function') {
          setBusy(true);
          r.then(function (keep) { setBusy(false); if (keep !== false) close(); }, function (e) { setBusy(false); if (e) alertError(e); });
        } else if (r !== false) close();
      });
      buttons.push(b);
      foot.appendChild(b);
    });
    if (buttons.length) box.appendChild(foot);
    backdrop.appendChild(box);

    function setBusy(v) { buttons.forEach(function (b) { b.disabled = v; }); }
    var closed = false;
    function close(fromPop) {
      if (closed) return;
      closed = true;
      backdrop.classList.remove('open');
      setTimeout(function () { backdrop.remove(); }, 180);
      openSheets = openSheets.filter(function (s) { return s !== api; });
      document.removeEventListener('keydown', onKey);
      if (!fromPop && api._id && history.state && history.state.sheet === sheetId) { try { history.back(); } catch (e) { /* abaikan */ } }
      if (opts.onClose) opts.onClose();
      if (prevFocus && prevFocus.focus) prevFocus.focus();
    }
    api._popClose = function () { close(true); };
    api._id = null;
    function onKey(e) {
      if (e.key === 'Escape' && openSheets[openSheets.length - 1] === api && !Swal.isVisible()) close();
      if (e.key === 'Tab') trapFocus(e, box);
    }
    closeBtn.addEventListener('click', function () { close(); });
    backdrop.addEventListener('click', function (e) { if (e.target === backdrop) close(); });
    document.addEventListener('keydown', onKey);
    var prevFocus = document.activeElement;
    var sheetId = U.uuid();
    api._id = sheetId;
    try { history.pushState({ sheet: sheetId }, '', location.href); } catch (e) { api._id = null; /* mis. dibatasi sandbox */ }
    document.body.appendChild(backdrop);
    openSheets.push(api);
    requestAnimationFrame(function () {
      backdrop.classList.add('open');
      var first = box.querySelector('[autofocus]') || closeBtn;
      if (first && window.matchMedia('(min-width: 720px)').matches) first.focus(); else closeBtn.focus({ preventScroll: true });
    });
    return api;
  }
  function trapFocus(e, root) {
    var f = U.$all('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])', root);
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  function closeAllSheets() { openSheets.slice().forEach(function (s) { s._popClose(); }); }

  /** Pilihan cepat (action sheet). items: [{label, icon, onClick, hint}] */
  function actionSheet(title, items) {
    var s = sheet({ title: title, content: function () {
      return h('div', { class: 'list' }, items.map(function (it) {
        return h('button', {
          type: 'button', class: 'item tap', style: { width: '100%', border: '0', textAlign: 'left', font: 'inherit' },
          onclick: function () { s.close(); setTimeout(it.onClick, 60); }
        }, h('span', { class: 'icon', style: { color: 'var(--primary)' } }, TI.icon(it.icon)),
          h('div', { class: 'item-main' }, h('div', { class: 'item-title', text: it.label }), it.hint ? h('div', { class: 'item-meta', text: it.hint }) : null));
      }));
    } });
    return s;
  }

  // Keyboard mobile: ukuran viewport visual untuk sheet, dan scroll input ke tengah.
  function trackViewport() {
    var vv = window.visualViewport;
    function upd() { document.documentElement.style.setProperty('--vvh', (vv ? vv.height : window.innerHeight) + 'px'); }
    upd();
    if (vv) vv.addEventListener('resize', upd);
    document.addEventListener('focusin', function (e) {
      var t = e.target;
      if (!t || !t.matches || !t.matches('input, textarea, select')) return;
      setTimeout(function () { if (t.scrollIntoView) t.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 300);
    });
  }

  // ---------------------------------------------------------------- router
  function parseHash() {
    var raw = (location.hash || '').replace(/^#\/?/, '');
    var parts = raw.split('?');
    var name = SECTIONS[parts[0]] ? parts[0] : 'home';
    var params = {};
    if (parts[1]) parts[1].split('&').forEach(function (kv) {
      var p = kv.split('=');
      if (p[0]) params[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || '');
    });
    return { name: name, params: params };
  }

  function showSection(name, params) {
    var q = params && Object.keys(params).length
      ? '?' + Object.keys(params).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); }).join('&') : '';
    var target = '#/' + name + q;
    if (location.hash === target) { activate(name, params || {}); return; }
    location.hash = target; // memicu hashchange → activate (tanpa reload)
  }

  function hideSection(name) {
    var el = document.getElementById('sec-' + name);
    if (el) el.classList.remove('active');
    var v = TI.views[name];
    if (v && v.onHide) v.onHide();
  }

  function loadSectionData(name, params, force) {
    var v = TI.views[name];
    var el = document.getElementById('sec-' + name);
    if (!v || !el) return;
    if (!loaded[name] || stale[name] || force) {
      loaded[name] = true;
      stale[name] = false;
      try { v.render(el, params || {}); }
      catch (e) { console.error(e); U.clear(el).appendChild(h('div', { class: 'empty' }, 'Bagian ini gagal dimuat. Coba Refresh.')); }
    } else if (v.onShow) v.onShow(params || {});
  }

  /** Refresh manual: sinkronkan lalu render ulang section aktif. */
  function refreshSection(name) {
    name = name || currentSection;
    var btn = U.$('#refreshBtn');
    if (btn) btn.disabled = true;
    var done = function () {
      if (btn) btn.disabled = false;
      loadSectionData(name, currentParams, true);
    };
    if (TI.sync && TI.api.getSession()) TI.sync.run().then(done, done); else done();
  }

  function activate(name, params) {
    closeAllSheets();
    if (currentSection && currentSection !== name) hideSection(currentSection);
    var paramsChanged = JSON.stringify(params) !== JSON.stringify(currentParams);
    currentSection = name;
    currentParams = params;
    var meta = SECTIONS[name];
    U.$('#pageTitle').textContent = meta.title;
    document.title = meta.title + ' — Mytime';
    var back = U.$('#backBtn');
    back.classList.toggle('hidden', !meta.parent);
    U.$all('[data-nav]').forEach(function (b) {
      var target = b.dataset.nav;
      var on = target === name || (meta.parent && target === meta.parent && b.classList.contains('nav-btn'));
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    var el = document.getElementById('sec-' + name);
    el.classList.add('active');
    loadSectionData(name, params, paramsChanged && loaded[name]);
    updateTimerDock();
    window.scrollTo(0, 0);
  }

  /** Render ulang section yang relevan ketika data berubah. */
  var pendingEntities = {};
  var flushData = U.debounce(function () {
    var ents = Object.keys(pendingEntities);
    pendingEntities = {};
    Object.keys(loaded).forEach(function (name) {
      var v = TI.views[name];
      if (!v) return;
      var deps = v.deps || null;
      var relevant = !deps || ents.some(function (e) { return deps.indexOf(e) !== -1; });
      if (!relevant) return;
      if (name === currentSection) {
        if (v.onData && v.onData(ents) === false) return;
        loadSectionData(name, currentParams, true);
      } else stale[name] = true;
    });
  }, 120);

  function renderNav() {
    var bottom = U.clear(U.$('#bottomNav'));
    Object.keys(SECTIONS).filter(function (k) { return SECTIONS[k].nav; }).forEach(function (k) {
      bottom.appendChild(h('button', { type: 'button', class: 'nav-btn', dataset: { nav: k }, onclick: function () { showSection(k); } },
        TI.icon(SECTIONS[k].icon, 22), h('span', { text: SECTIONS[k].title })));
    });
    var side = U.clear(U.$('#sidebar'));
    side.appendChild(h('div', { class: 'brand' }, brandMark(), h('div', null, h('div', { class: 'brand-name', text: 'Mytime' }), h('div', { class: 'brand-tag', text: 'Invest Your Time. Build Your Future.' }))));
    ['home', 'tasks', 'focus', 'goals'].concat(['sep'], MORE_ORDER).forEach(function (k) {
      if (k === 'sep') { side.appendChild(h('div', { class: 'side-sep' })); return; }
      side.appendChild(h('button', { type: 'button', class: 'side-btn', dataset: { nav: k }, onclick: function () { showSection(k); } },
        TI.icon(SECTIONS[k].icon), h('span', { text: SECTIONS[k].title })));
    });
  }

  function brandMark() {
    var m = h('span', { class: 'brand-mark', 'aria-hidden': 'true' });
    m.appendChild(TI.icon('hourglass', 18));
    return m;
  }

  // ---------------------------------------------------------------- indikator sinkronisasi
  var SYNC_LABEL = { online: 'Online', offline: 'Offline', syncing: 'Syncing', synced: 'Synced', error: 'Sync Error' };
  function renderSyncChip(st) {
    var chip = U.$('#syncChip');
    if (!chip) return;
    chip.dataset.status = st.status;
    var label = SYNC_LABEL[st.status] || 'Online';
    if (st.pending && st.status !== 'syncing') label += ' (' + st.pending + ')';
    chip.querySelector('.slabel').textContent = label;
    chip.title = st.lastError || (st.pending ? st.pending + ' perubahan menunggu sinkronisasi' : 'Semua perubahan tersimpan');
  }

  // ---------------------------------------------------------------- dock timer
  function updateTimerDock() {
    var dock = U.$('#timerDock');
    if (!dock) return;
    var t = TI.timer.get();
    var hide = !t || currentSection === 'track' || currentSection === 'focus';
    dock.classList.toggle('hidden', hide);
    if (hide) return;
    U.clear(dock);
    dock.classList.toggle('paused', !t.runningSince);
    var secs = TI.timer.elapsedMs(t) / 1000;
    var label = t.kind === 'FOCUS'
      ? U.fmtClock(Math.max(0, t.plannedMinutes * 60 - secs))
      : U.fmtClock(secs);
    U.append(dock, [
      h('span', { class: 'pulse' }),
      h('span', { class: 't-label' }, h('b', { text: t.activity }), h('span', { class: 'xs', style: { opacity: .75 }, text: t.kind === 'FOCUS' ? (TI.timer.isDone(t) ? 'Sesi fokus selesai' : 'Sisa waktu fokus') : (t.runningSince ? 'Sedang dicatat' : 'Dijeda') })),
      h('span', { class: 't-time', text: label })
    ]);
  }

  // ---------------------------------------------------------------- chart.js (dimuat saat dibutuhkan)
  var chartPromise = null;
  function loadChart() {
    if (window.Chart) return Promise.resolve(window.Chart);
    if (chartPromise) return chartPromise;
    chartPromise = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = (window.TI_CONFIG && window.TI_CONFIG.CHART_JS_URL) || 'vendor/chart.umd.min.js';
      s.onload = function () { resolve(window.Chart); };
      s.onerror = function () { chartPromise = null; reject(new Error('Grafik tidak dapat dimuat.')); };
      document.head.appendChild(s);
    });
    return chartPromise;
  }

  // ---------------------------------------------------------------- komponen kecil bersama
  function emptyState(iconName, text, action) {
    return h('div', { class: 'empty' }, TI.icon(iconName, 32), h('p', { text: text }),
      action ? h('button', { type: 'button', class: 'btn primary', onclick: action.onClick }, action.label) : null);
  }
  function progressBar(pct, opts) {
    opts = opts || {};
    var p = U.clamp(Number(pct) || 0, 0, 100);
    var bar = h('div', { class: 'progress' + (opts.lg ? ' lg' : ''), role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(Math.round(p)), 'aria-label': opts.label || 'Progres' },
      h('div', { class: 'fill' + (opts.tone ? ' ' + opts.tone : ''), style: { width: p + '%', background: opts.color || null } }));
    if (opts.marker !== undefined && opts.marker !== null) {
      bar.appendChild(h('div', { class: 'marker', style: { left: 'calc(' + U.clamp(opts.marker, 0, 100) + '% - 1px)' }, title: 'Progres yang diharapkan' }));
    }
    return bar;
  }
  function blockTitle(text, action) {
    return h('div', { class: 'block-title' }, h('h2', { text: text }),
      action ? h('button', { type: 'button', class: 'link-btn', onclick: action.onClick }, action.label) : null);
  }
  function chips(options, value, onChange, counts) {
    return h('div', { class: 'chips', role: 'group' }, options.map(function (o) {
      return h('button', { type: 'button', class: 'chip', 'aria-pressed': String(o.value === value), onclick: function () { onChange(o.value); } },
        o.label, counts && counts[o.value] !== undefined ? h('span', { class: 'count', text: String(counts[o.value]) }) : null);
    }));
  }
  function segmented(options, value, onChange) {
    return h('div', { class: 'seg', role: 'group' }, options.map(function (o) {
      return h('button', { type: 'button', 'aria-pressed': String(o.value === value), onclick: function (e) {
        U.$all('button', e.currentTarget.parentNode).forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
        e.currentTarget.setAttribute('aria-pressed', 'true');
        onChange(o.value);
      } }, o.label);
    }));
  }
  function categoryDot(cat) {
    return h('span', { class: 'dot', style: { background: (cat && cat.Color) || '#94A3B8' } });
  }

  function init() {
    renderNav();
    trackViewport();
    U.$('#backBtn').appendChild(TI.icon('chevron-left', 22));
    U.$('#backBtn').addEventListener('click', function () { showSection(SECTIONS[currentSection].parent || 'home'); });
    U.$('#refreshBtn').appendChild(TI.icon('refresh-cw'));
    U.$('#refreshBtn').addEventListener('click', function () { refreshSection(); });
    U.$('#fab').appendChild(TI.icon('plus', 26));
    U.$('#fab').addEventListener('click', openCreateMenu);
    U.$('#timerDock').addEventListener('click', function () {
      var t = TI.timer.get();
      showSection(t && t.kind === 'FOCUS' ? 'focus' : 'track');
    });
    U.$('#syncChip').addEventListener('click', function () { TI.views.settings.openSyncSheet(); });
    window.addEventListener('hashchange', function () { var r = parseHash(); activate(r.name, r.params); });
    window.addEventListener('popstate', function (e) {
      // Tombol back menutup sheet teratas tanpa pindah halaman.
      var top = openSheets[openSheets.length - 1];
      if (top && (!e.state || e.state.sheet !== top._id)) top._popClose();
    });
    TI.bus.on('data', function (p) { (p.entities || []).forEach(function (e) { pendingEntities[e] = true; }); flushData(); });
    TI.bus.on('sync', renderSyncChip);
    TI.bus.on('timer', updateTimerDock);
    TI.bus.on('timer-tick', updateTimerDock);
    renderSyncChip(TI.sync.getState());
  }

  function openCreateMenu() {
    actionSheet('Tambah', [
      { label: 'Task baru', icon: 'list-checks', onClick: function () { TI.forms.task(); } },
      { label: 'Catat waktu manual', icon: 'clock', hint: 'Aktivitas yang sudah dilakukan', onClick: function () { TI.forms.timeEntry(); } },
      { label: 'Mulai timer', icon: 'play', hint: 'Catat aktivitas yang sedang dilakukan', onClick: function () { showSection('track'); } },
      { label: 'Sesi fokus', icon: 'timer', onClick: function () { showSection('focus'); } },
      { label: 'Goal baru', icon: 'target', onClick: function () { TI.forms.goal(); } },
      { label: 'Habit baru', icon: 'repeat', onClick: function () { TI.forms.habit(); } },
      { label: 'Jurnal hari ini', icon: 'book-open', onClick: function () { showSection('journal'); } }
    ]);
  }

  function start() {
    var r = parseHash();
    activate(r.name, r.params);
  }

  TI.ui = {
    SECTIONS: SECTIONS, MORE_ORDER: MORE_ORDER, init: init, start: start,
    showSection: showSection, hideSection: hideSection, loadSectionData: loadSectionData, refreshSection: refreshSection,
    current: function () { return currentSection; }, params: function () { return currentParams; },
    toast: toast, confirm: confirmDialog, alertError: alertError, alertInfo: alertInfo, loading: loading, closeLoading: closeLoading,
    sheet: sheet, actionSheet: actionSheet, closeAllSheets: closeAllSheets, loadChart: loadChart,
    emptyState: emptyState, progressBar: progressBar, blockTitle: blockTitle, chips: chips, segmented: segmented,
    categoryDot: categoryDot, brandMark: brandMark, updateTimerDock: updateTimerDock,
    markAllStale: function () { Object.keys(loaded).forEach(function (k) { stale[k] = true; }); }
  };
})();
