/**
 * Mytime — auth.js
 * Layar PIN, sesi, kunci manual & otomatis, ganti PIN.
 * PIN hanya dikirim ke server untuk diverifikasi; tidak pernah disimpan di perangkat.
 * Membuka kunci selalu diverifikasi server, sehingga layar terkunci tidak dapat dibuka saat offline.
 */
(function () {
  'use strict';
  var TI = window.TI = window.TI || {};
  var U = TI.util, h = U.h;
  var LS_LOCK = 'ti.locked';
  var LS_ACTIVE = 'ti.lastActive';

  var locked = false;
  var idleTimer = null;
  var onUnlocked = null;

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* abaikan */ } }

  function autoLockMinutes() {
    var v = Number(TI.repo.setting('autoLockMinutes', '15'));
    return isFinite(v) ? v : 15;
  }

  function sessionValid() {
    var s = TI.api.getSession();
    return !!(s && s.token && (!s.expiresAt || Date.parse(s.expiresAt) > Date.now()));
  }

  function idleExceeded() {
    var mins = autoLockMinutes();
    if (!mins) return false;
    var last = Number(lsGet(LS_ACTIVE) || 0);
    return last > 0 && Date.now() - last > mins * 60000;
  }

  function markActive() { lsSet(LS_ACTIVE, String(Date.now())); }

  var throttled = 0;
  function onActivity() {
    var now = Date.now();
    if (now - throttled < 5000 || locked) return;
    throttled = now;
    markActive();
  }

  function startIdleWatch() {
    ['pointerdown', 'keydown', 'touchstart', 'wheel'].forEach(function (ev) { document.addEventListener(ev, onActivity, { passive: true }); });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible' && !locked && sessionValid() && idleExceeded()) lock('auto');
      else if (document.visibilityState === 'hidden' && !locked) markActive();
    });
    clearInterval(idleTimer);
    idleTimer = setInterval(function () {
      if (!locked && sessionValid() && idleExceeded()) lock('auto');
    }, 15000);
  }

  function isLocked() { return locked; }

  /** Kunci aplikasi (manual/otomatis). Data lokal & timer tetap berjalan. */
  function lock(reason) {
    if (locked) return;
    locked = true;
    lsSet(LS_LOCK, '1');
    TI.ui.closeAllSheets();
    if (window.Swal && Swal.isVisible()) Swal.close();
    U.$('#app').classList.add('hidden');
    renderPinScreen({ mode: 'unlock', reason: reason });
  }

  // ---------------------------------------------------------------- layar PIN / konfigurasi
  function renderPinScreen(opts) {
    opts = opts || {};
    var root = U.clear(U.$('#auth'));
    root.classList.remove('hidden');
    U.$('#boot').classList.add('hidden');

    if (!TI.api.isConfigured()) { renderConfig(root, opts); return; }

    var unlock = opts.mode === 'unlock';
    var pin = h('input', {
      type: 'password', class: 'pin-input', inputmode: 'numeric', pattern: '[0-9]*', autocomplete: 'current-password',
      maxlength: '12', 'aria-label': 'PIN', id: 'pinInput', name: 'pin'
    });
    var err = h('div', { class: 'err', role: 'alert' });
    var btn = h('button', { type: 'submit', class: 'btn primary block' }, unlock ? 'Buka kunci' : 'Masuk');
    var online = navigator.onLine !== false || TI.api.isGasHosted();
    var heading = unlock ? 'Aplikasi terkunci' : 'Masukkan PIN';
    var lead = unlock
      ? (opts.reason === 'auto' ? 'Dikunci otomatis karena tidak ada aktivitas. Data dan timer tetap aman.' : 'Masukkan PIN untuk melanjutkan.')
      : 'Invest Your Time. Build Your Future.';
    var form = h('form', { novalidate: true, autocomplete: 'off' },
      h('input', { type: 'text', name: 'username', autocomplete: 'username', value: 'time-investment', class: 'sr-only', tabindex: '-1', 'aria-hidden': 'true' }),
      pin, err, btn);
    var offlineNote = h('p', { class: 'small muted', style: { marginTop: '12px', textAlign: 'center' } },
      'Verifikasi PIN memerlukan koneksi internet. Sambungkan perangkat lalu coba lagi.');
    offlineNote.classList.toggle('hidden', online);

    U.append(root, h('div', { class: 'auth' },
      h('div', { class: 'brand' }, TI.ui.brandMark(), h('div', null, h('div', { class: 'brand-name', text: 'Mytime' }))),
      h('h1', { text: heading }),
      h('p', { class: 'lead', text: lead }),
      form, offlineNote,
      h('div', { class: 'foot' },
        !TI.api.isGasHosted() ? h('button', { type: 'button', class: 'link-btn', onclick: function () { renderConfig(root, opts); } }, 'Ubah URL backend') : null)));

    function updateOnline() {
      var on = navigator.onLine !== false || TI.api.isGasHosted();
      offlineNote.classList.toggle('hidden', on);
    }
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      err.textContent = '';
      var value = pin.value.trim();
      if (!/^\d{4,12}$/.test(value)) { err.textContent = 'PIN terdiri dari 4–12 digit angka.'; pin.focus(); return; }
      btn.disabled = true;
      btn.textContent = 'Memeriksa…';
      var oldSession = TI.api.getSession();
      TI.api.call('auth.login', { pin: value }, { noAuth: true }).then(function (data) {
        pin.value = '';
        TI.api.saveSession({ token: data.token, expiresAt: data.expiresAt, mustChangePin: !!data.mustChangePin });
        if (data.epoch) TI.db.getMeta('epoch', null).then(function (known) { if (!known) TI.db.setMeta('epoch', String(data.epoch)); });
        // Cabut token lama (mis. setelah kunci) — best effort.
        if (oldSession && oldSession.token && oldSession.token !== data.token) revokeToken(oldSession.token);
        locked = false;
        lsSet(LS_LOCK, null);
        markActive();
        window.removeEventListener('online', updateOnline);
        window.removeEventListener('offline', updateOnline);
        root.classList.add('hidden');
        U.clear(root);
        if (onUnlocked) onUnlocked({ firstLogin: !unlock, mustChangePin: !!data.mustChangePin });
      }, function (e2) {
        btn.disabled = false;
        btn.textContent = unlock ? 'Buka kunci' : 'Masuk';
        pin.value = '';
        err.textContent = e2.code === 'NOT_CONFIGURED' ? 'Atur URL backend terlebih dulu.' : e2.message;
        pin.focus();
      });
    });
    setTimeout(function () { pin.focus(); }, 50);
  }

  function revokeToken(token) {
    var body = JSON.stringify({ action: 'auth.logout', token: token, payload: {} });
    if (TI.api.isGasHosted()) {
      try { window.google.script.run.apiDispatch(body); } catch (e) { /* abaikan */ }
      return;
    }
    var url = TI.api.getApiUrl();
    if (url) fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: body, redirect: 'follow' }).catch(function () {});
  }

  function renderConfig(root, opts) {
    U.clear(root);
    var url = h('input', { type: 'url', class: 'input', value: TI.api.getApiUrl(), placeholder: 'https://script.google.com/macros/s/…/exec', autocomplete: 'off', inputmode: 'url' });
    var err = h('div', { class: 'err', role: 'alert', style: { textAlign: 'left' } });
    var btn = h('button', { type: 'submit', class: 'btn primary block' }, 'Simpan & lanjutkan');
    var form = h('form', { novalidate: true, style: { marginTop: '24px' } },
      h('label', { class: 'field' }, h('span', { class: 'lbl', text: 'URL Web App Google Apps Script' }), url,
        h('span', { class: 'hint', text: 'Salin dari Deploy → Manage deployments di editor Apps Script. Diakhiri /exec.' })),
      err, btn);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = url.value.trim();
      var msg = TI.api.validateApiUrl(v);
      if (msg) { err.textContent = msg; return; }
      btn.disabled = true; btn.textContent = 'Menghubungkan…';
      var prev = TI.api.getApiUrl();
      TI.api.setApiUrl(v);
      TI.api.call('ping', {}, { noAuth: true, timeout: 20000 }).then(function () {
        renderPinScreen(opts);
      }, function (e2) {
        TI.api.setApiUrl(prev);
        btn.disabled = false; btn.textContent = 'Simpan & lanjutkan';
        err.textContent = 'Tidak dapat terhubung: ' + e2.message;
      });
    });
    U.append(root, h('div', { class: 'auth' },
      h('div', { class: 'brand' }, TI.ui.brandMark(), h('div', null, h('div', { class: 'brand-name', text: 'Mytime' }))),
      h('h1', { text: 'Hubungkan ke backend' }),
      h('p', { class: 'lead', text: 'Aplikasi menyimpan data di Google Sheets milikmu melalui Google Apps Script.' }),
      form,
      TI.api.isConfigured() ? h('div', { class: 'foot' }, h('button', { type: 'button', class: 'link-btn', onclick: function () { renderPinScreen(opts); } }, 'Kembali')) : null));
  }

  // ---------------------------------------------------------------- ganti PIN
  function changePinSheet(forced) {
    var F = TI.forms;
    var cur = F.input({ type: 'password', inputmode: 'numeric', autocomplete: 'current-password', maxlength: '12' });
    var np = F.input({ type: 'password', inputmode: 'numeric', autocomplete: 'new-password', maxlength: '12' });
    var np2 = F.input({ type: 'password', inputmode: 'numeric', autocomplete: 'new-password', maxlength: '12' });
    var content = h('div', null,
      forced ? h('div', { class: 'banner' }, TI.icon('shield-check'), h('div', { class: 'grow', text: 'PIN saat ini masih PIN contoh pengembangan. Ganti dengan PIN pribadi sebelum menyimpan data penting.' })) : null,
      F.field('PIN saat ini', cur),
      F.field('PIN baru', np, 'Minimal 4 digit, disarankan 6 digit. Hindari angka berurutan atau sama.'),
      F.field('Ulangi PIN baru', np2));
    return TI.ui.sheet({
      title: 'Ganti PIN', content: content,
      actions: [{ label: 'Simpan PIN baru', kind: 'primary', onClick: function () {
        F.clearErrors(content);
        if (!/^\d{4,12}$/.test(cur.value)) return F.setError(cur, 'Masukkan PIN saat ini.');
        if (!/^\d{4,12}$/.test(np.value)) return F.setError(np, 'PIN baru harus 4–12 digit angka.');
        if (np.value !== np2.value) return F.setError(np2, 'PIN tidak sama.');
        if (navigator.onLine === false && !TI.api.isGasHosted()) return F.setError(np, 'Butuh koneksi internet untuk mengganti PIN.');
        return TI.api.call('auth.changePin', { currentPin: cur.value, newPin: np.value }).then(function (data) {
          TI.api.saveSession({ token: data.token, expiresAt: data.expiresAt, mustChangePin: false });
          renderPinBanner();
          TI.ui.toast('PIN diganti. Perangkat lain perlu login ulang.');
        }, function (e) {
          cur.value = ''; np.value = ''; np2.value = '';
          if (e.extra && e.extra.field === 'newPin') { F.setError(np, e.message); return false; }
          F.setError(cur, e.message);
          return false;
        });
      } }]
    });
  }

  function renderPinBanner() {
    var host = U.$('#banners');
    var existing = U.$('#pinBanner');
    if (existing) existing.remove();
    var s = TI.api.getSession();
    if (!s || !s.mustChangePin) return;
    host.appendChild(h('div', { class: 'banner', id: 'pinBanner' }, TI.icon('shield-check'),
      h('div', { class: 'grow' }, 'PIN masih PIN contoh. Ganti sebelum dipakai untuk data pribadi.'),
      h('button', { type: 'button', class: 'btn sm', onclick: function () { changePinSheet(true); } }, 'Ganti PIN')));
  }

  /** Verifikasi sesi di server tanpa memblokir tampilan (dipanggil saat online). */
  function verifyInBackground() {
    if (!sessionValid()) return Promise.resolve(false);
    return TI.api.call('auth.verify', {}, { timeout: 20000 }).then(function (data) {
      var s = TI.api.getSession();
      if (s) TI.api.saveSession(Object.assign({}, s, { expiresAt: data.expiresAt, mustChangePin: !!data.mustChangePin }));
      renderPinBanner();
      return true;
    }, function (e) {
      if (e.code === 'AUTH_REQUIRED') { expireSession(); return false; }
      return true; // offline/timeout: tetap pakai sesi lokal
    });
  }

  function expireSession() {
    TI.api.saveSession(null);
    locked = false;
    U.$('#app').classList.add('hidden');
    renderPinScreen({ mode: 'login' });
  }

  function logout(clearLocal) {
    var s = TI.api.getSession();
    var p = s && s.token ? TI.api.call('auth.logout', {}, { timeout: 10000 }).catch(function () {}) : Promise.resolve();
    return p.then(function () {
      TI.api.saveSession(null);
      lsSet(LS_LOCK, null);
      return clearLocal ? TI.repo.clearAllLocal() : null;
    }).then(function () {
      location.hash = '#/home';
      location.reload();
    });
  }

  function logoutAll() {
    return TI.api.call('auth.logoutAll', {}).then(function () {
      TI.api.saveSession(null);
      location.reload();
    });
  }

  /**
   * Tentukan layar awal.
   * @param {Function} cb dipanggil saat pengguna boleh melihat aplikasi
   */
  function boot(cb) {
    onUnlocked = cb;
    startIdleWatch();
    TI.bus.on('auth-required', function () { if (!locked) expireSession(); });
    if (!sessionValid()) { renderPinScreen({ mode: 'login' }); return; }
    if (lsGet(LS_LOCK) === '1' || idleExceeded()) {
      locked = true;
      lsSet(LS_LOCK, '1');
      renderPinScreen({ mode: 'unlock', reason: idleExceeded() ? 'auto' : 'manual' });
      return;
    }
    markActive();
    cb({ firstLogin: false, resumed: true });
  }

  TI.auth = {
    boot: boot, lock: lock, isLocked: isLocked, logout: logout, logoutAll: logoutAll, changePinSheet: changePinSheet,
    renderPinBanner: renderPinBanner, verifyInBackground: verifyInBackground, sessionValid: sessionValid
  };
})();
