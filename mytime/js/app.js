/**
 * Mytime — app.js
 * Urutan boot: IndexedDB → Local Repository → timer → UI → autentikasi → sinkronisasi.
 * Data lokal selalu ditampilkan lebih dulu; sinkronisasi berjalan di background.
 */
(function () {
  'use strict';
  var TI = window.TI;
  var U = TI.util;
  var started = false;
  TI.installPrompt = null;

  function showApp() {
    U.$('#boot').classList.add('hidden');
    U.$('#auth').classList.add('hidden');
    U.$('#app').classList.remove('hidden');
  }

  function onReady(info) {
    showApp();
    TI.auth.renderPinBanner();
    var needsInitialData = TI.repo.list('categories').length === 0;
    var first = needsInitialData
      ? (TI.ui.loading('Mengunduh data…'), TI.sync.run().then(function (st) {
        TI.ui.closeLoading();
        if (TI.repo.list('categories').length === 0) {
          TI.ui.alertInfo('Data belum lengkap', st.lastError || 'Kategori belum terunduh. Pastikan setupApp() sudah dijalankan di Apps Script, lalu tekan Refresh.');
        }
      }, function () { TI.ui.closeLoading(); }))
      : Promise.resolve();
    first.then(function () {
      if (!started) { started = true; TI.ui.start(); }
      else { TI.ui.markAllStale(); TI.ui.loadSectionData(TI.ui.current(), TI.ui.params(), true); }
      if (!needsInitialData) TI.sync.schedule(300);
      if (info && info.resumed) TI.auth.verifyInBackground();
      var s = TI.api.getSession();
      if (s && s.mustChangePin) setTimeout(function () { TI.auth.changePinSheet(true); }, 400);
    });
  }

  var updateRequested = false;
  function registerServiceWorker() {
    if (TI.api.isGasHosted() || !('serviceWorker' in navigator)) return;
    if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return;
    navigator.serviceWorker.register('sw.js').then(function (reg) {
      function promptUpdate(worker) {
        var host = U.$('#banners');
        if (U.$('#updateBanner')) return;
        host.appendChild(U.h('div', { class: 'banner info', id: 'updateBanner' }, TI.icon('download'),
          U.h('div', { class: 'grow' }, 'Versi baru aplikasi tersedia.'),
          U.h('button', { type: 'button', class: 'btn sm', onclick: function () { updateRequested = true; worker.postMessage({ type: 'SKIP_WAITING' }); } }, 'Muat ulang')));
      }
      if (reg.waiting && navigator.serviceWorker.controller) promptUpdate(reg.waiting);
      reg.addEventListener('updatefound', function () {
        var w = reg.installing;
        if (!w) return;
        w.addEventListener('statechange', function () {
          if (w.state === 'installed' && navigator.serviceWorker.controller) promptUpdate(w);
        });
      });
      setInterval(function () { reg.update().catch(function () {}); }, 60 * 60000);
    }).catch(function (e) { console.warn('Service worker gagal didaftarkan:', e); });
    var reloading = false;
    // Reload hanya bila pengguna meminta pembaruan — bukan saat SW pertama kali mengambil alih (clients.claim),
    // yang bisa terjadi di tengah login.
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (reloading || !updateRequested) return;
      reloading = true;
      location.reload();
    });
  }

  function boot() {
    window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); TI.installPrompt = e; TI.bus.emit('installable', true); });
    TI.db.open()
      .then(TI.repo.load)
      .then(TI.timer.restore)
      .then(function () {
        TI.ui.init();
        TI.sync.start();
        TI.bus.on('focus-complete', function () { if (TI.views.focus && !TI.auth.isLocked()) TI.views.focus.promptFinish(); });
        TI.bus.on('server-reset', function (p) {
          TI.ui.alertInfo('Data server telah di-reset', p.kept ? p.kept + ' perubahan lokal yang belum tersinkron akan dikirim ulang.' : 'Data lokal disesuaikan dengan server.');
        });
        if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
        TI.auth.boot(onReady);
        registerServiceWorker();
      })
      .catch(function (err) {
        console.error(err);
        var b = U.$('#boot');
        U.clear(b).appendChild(U.h('div', { class: 'auth' },
          U.h('h1', { text: 'Aplikasi tidak dapat dibuka' }),
          U.h('p', { class: 'lead', text: (err && err.message) || 'Penyimpanan lokal browser tidak tersedia. Nonaktifkan mode privat lalu coba lagi.' }),
          U.h('button', { type: 'button', class: 'btn primary', style: { marginTop: '20px' }, onclick: function () { location.reload(); } }, 'Coba lagi')));
      });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
