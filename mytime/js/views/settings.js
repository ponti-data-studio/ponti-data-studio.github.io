/**
 * Mytime — views/settings.js
 * Keamanan, sinkronisasi & konflik, kategori, preferensi, bobot skor, pengelolaan data.
 */
(function () {
  'use strict';
  var TI = window.TI;
  var U = TI.util, h = U.h, C = TI.calc;
  var APP_VERSION = '1.0.0';
  var ENTITY_LABEL = {
    tasks: 'Tasks', timeEntries: 'Time entries', goals: 'Goals', habits: 'Habits', habitLogs: 'Habit logs', focusSessions: 'Focus sessions',
    journal: 'Journal', categories: 'Categories', timeBudgets: 'Time budgets', dailySnapshots: 'Daily reviews', weeklySnapshots: 'Weekly reviews', settings: 'Settings'
  };
  var TYPE_LABEL = { GROWTH: 'Pengembangan diri', PRODUCTIVE: 'Produktif', RECOVERY: 'Pemulihan', LEISURE: 'Hiburan', DISTRACTION: 'Distraksi' };

  function setSetting(key, value) {
    var existing = TI.repo.get('settings', key);
    return TI.repo.save('settings', Object.assign({}, existing || {}, { Key: key, Value: String(value) }));
  }

  function section(title, children) {
    return h('div', null, TI.ui.blockTitle(title), Array.isArray(children) ? h('div', { class: 'list' }, children) : children);
  }
  function row(icon, title, meta, onClick, side) {
    return h(onClick ? 'button' : 'div', {
      type: onClick ? 'button' : null, class: 'item' + (onClick ? ' tap' : ''), onclick: onClick || null,
      style: onClick ? { width: '100%', border: '0', borderTop: '1px solid var(--line)', textAlign: 'left', font: 'inherit' } : null
    }, icon ? h('span', { class: 'icon', style: { color: 'var(--primary)' } }, TI.icon(icon, 20)) : null,
      h('div', { class: 'item-main' }, h('div', { class: 'item-title', text: title }), meta ? h('div', { class: 'item-meta', text: meta }) : null), side || null);
  }

  // ---------------------------------------------------------------- sinkronisasi & konflik
  function describeRecord(entity, rec) {
    if (!rec) return '(record tidak ditemukan)';
    return rec.Title || rec.Name || rec.Activity || rec.Key || rec.Date || rec.WeekStart || rec[TI.ENTITIES[entity]];
  }

  function openSyncSheet() {
    var s = TI.ui.sheet({ title: 'Sinkronisasi', content: h('div', { class: 'empty', text: 'Memuat…' }),
      actions: [{ label: 'Sinkronkan sekarang', kind: 'primary', icon: 'refresh-cw', onClick: function () {
        if (navigator.onLine === false && !TI.api.isGasHosted()) { TI.ui.toast('Perangkat sedang offline', 'info'); return false; }
        return TI.sync.run().then(function () { fill(); return false; });
      } }] });
    function fill() {
      Promise.all([TI.db.getAll('queue'), TI.repo.listConflicts(), TI.db.getMeta('lastSyncAt', null)]).then(function (r) {
        var queue = r[0], conflicts = r[1], last = r[2];
        var st = TI.sync.getState();
        var pending = queue.filter(function (q) { return q.status === 'PENDING' || q.status === 'SYNCING'; });
        var failed = queue.filter(function (q) { return q.status === 'FAILED'; });
        var labels = { online: 'Online', offline: 'Offline', syncing: 'Syncing', synced: 'Synced', error: 'Sync Error' };
        var body = h('div', { class: 'stack' },
          h('div', { class: 'stat-grid' },
            h('div', { class: 'stat' }, h('div', { class: 'v', text: labels[st.status] || st.status }), h('div', { class: 'k', text: 'Status' })),
            h('div', { class: 'stat' }, h('div', { class: 'v', text: String(pending.length) }), h('div', { class: 'k', text: 'Menunggu dikirim' })),
            h('div', { class: 'stat' }, h('div', { class: 'v', text: String(failed.length) }), h('div', { class: 'k', text: 'Ditolak server' })),
            h('div', { class: 'stat' }, h('div', { class: 'v', text: String(conflicts.length) }), h('div', { class: 'k', text: 'Konflik' }))),
          h('p', { class: 'small muted', text: (last ? 'Sinkron terakhir: ' + new Date(last).toLocaleString('id-ID') + '. ' : 'Belum pernah sinkron di perangkat ini. ') +
            (st.lastError ? st.lastError : 'Perubahan selalu disimpan di perangkat dulu, lalu dikirim saat online.') }));

        if (conflicts.length) {
          body.appendChild(h('h3', { text: 'Konflik — pilih versi yang dipakai' }));
          conflicts.forEach(function (c) {
            var local = TI.repo.listAll(c.entity).filter(function (x) { return x[TI.ENTITIES[c.entity]] === c.id; })[0];
            var fields = Object.keys(c.server).filter(function (k) {
              return TI.repo.META_FIELDS.indexOf(k) === -1 && ['ServerVersion', 'ServerUpdatedAt', 'CreatedAt', 'UpdatedAt'].indexOf(k) === -1 &&
                local && String(local[k]) !== String(c.server[k]);
            });
            var diff = function (src) { return fields.map(function (k) { return k + ': ' + String(src ? src[k] : '').slice(0, 300); }).join('\n') || '(tidak ada perbedaan isi)'; };
            body.appendChild(h('div', { class: 'panel' },
              h('div', { class: 'item-title', text: ENTITY_LABEL[c.entity] + ': ' + describeRecord(c.entity, local || c.server) }),
              h('div', { class: 'compare', style: { marginTop: '8px' } },
                h('div', null, h('div', { class: 'xs muted', text: 'Versi di perangkat ini' + (local && local.Deleted ? ' (dihapus)' : '') }), h('pre', { text: diff(local) })),
                h('div', null, h('div', { class: 'xs muted', text: 'Versi di server' + (c.server.Deleted ? ' (dihapus)' : '') }), h('pre', { text: diff(c.server) }))),
              h('div', { class: 'row', style: { marginTop: '10px' } },
                h('button', { type: 'button', class: 'btn sm grow', onclick: function () { TI.repo.resolveConflict(c.key, 'server').then(fill); } }, 'Pakai versi server'),
                h('button', { type: 'button', class: 'btn sm primary grow', onclick: function () { TI.repo.resolveConflict(c.key, 'mine').then(fill); } }, 'Pakai versi saya'))));
          });
        }
        if (failed.length) {
          body.appendChild(h('h3', { text: 'Ditolak server' }));
          body.appendChild(h('div', { class: 'list' }, failed.map(function (q) {
            var rec = TI.repo.listAll(q.entity).filter(function (x) { return x[TI.ENTITIES[q.entity]] === q.id; })[0];
            return h('div', { class: 'item' }, h('div', { class: 'item-main' }, h('div', { class: 'item-title', text: ENTITY_LABEL[q.entity] + ': ' + describeRecord(q.entity, rec) }),
              h('div', { class: 'item-meta' }, h('span', { class: 'warn', text: q.lastError }))),
              rec && !rec.ServerVersion ? h('button', { type: 'button', class: 'btn sm ghost danger', onclick: function () {
                TI.ui.confirm('Buang data ini?', 'Data ini belum pernah tersimpan di server dan akan dihapus dari perangkat.', { danger: true, confirmText: 'Buang' })
                  .then(function (ok) { if (ok) TI.repo.remove(q.entity, q.id).then(function () { TI.sync.refreshCounts(); fill(); }); });
              } }, 'Buang') : null);
          })));
          body.appendChild(h('p', { class: 'xs muted', text: 'Perbaiki data terkait (mis. edit task) lalu sinkronkan lagi. Data lokal tidak dihapus otomatis.' }));
          body.appendChild(h('button', { type: 'button', class: 'btn block', onclick: function () { TI.sync.retryFailed().then(fill); } }, 'Coba kirim ulang'));
        }
        U.clear(s.body).appendChild(body);
      });
    }
    fill();
    return s;
  }

  // ---------------------------------------------------------------- data
  function download(filename, text, mime) {
    var blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = h('a', { href: url, download: filename, style: { display: 'none' } });
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1000);
  }

  function csvCell(v) {
    var s = v === null || v === undefined ? '' : (typeof v === 'object' ? JSON.stringify(v) : String(v));
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // cegah formula injection di Excel/Sheets
    if (/[",\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  }
  function toCsv(records) {
    if (!records.length) return '';
    var cols = Object.keys(TI.repo.stripMeta(records[0])).filter(function (k) { return k.charAt(0) !== '_'; });
    return '﻿' + [cols.join(',')].concat(records.map(function (r) { return cols.map(function (c) { return csvCell(r[c]); }).join(','); })).join('\r\n');
  }

  function exportCsvSheet() {
    var sel = TI.forms.select(Object.keys(ENTITY_LABEL).map(function (k) { return { value: k, label: ENTITY_LABEL[k] + ' (' + TI.repo.list(k).length + ')' }; }), 'timeEntries');
    TI.ui.sheet({ title: 'Export CSV', content: h('div', null, TI.forms.field('Data', sel, 'File CSV dibuat dari data di perangkat ini.')),
      actions: [{ label: 'Unduh CSV', kind: 'primary', icon: 'download', onClick: function () {
        var recs = TI.repo.list(sel.value);
        if (!recs.length) { TI.ui.toast('Tidak ada data untuk diekspor', 'info'); return false; }
        download('time-investment-' + sel.value + '-' + U.today() + '.csv', toCsv(recs), 'text/csv;charset=utf-8');
        TI.ui.toast('CSV diunduh');
        return true;
      } }] });
  }

  function backupLocal() {
    var entities = {};
    Object.keys(TI.ENTITIES).forEach(function (e) { entities[e] = TI.repo.listAll(e).map(TI.repo.stripMeta); });
    download('time-investment-backup-' + U.today() + '.json', JSON.stringify({ app: 'time-investment', format: 1, source: 'local', exportedAt: U.nowIso(), entities: entities }, null, 2), 'application/json');
    TI.ui.toast('Backup lokal diunduh');
  }

  function backupServer() {
    TI.ui.loading('Mengambil data dari server…');
    TI.api.call('data.export', {}, { timeout: 60000 }).then(function (d) {
      TI.ui.closeLoading();
      download('time-investment-server-backup-' + U.today() + '.json', JSON.stringify({ app: 'time-investment', format: 1, source: 'server', exportedAt: d.exportedAt, entities: d.entities }, null, 2), 'application/json');
      TI.ui.toast('Backup server diunduh');
    }, function (e) { TI.ui.closeLoading(); TI.ui.alertError(e); });
  }

  var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  function validateBackup(obj) {
    if (!obj || obj.app !== 'time-investment' || !obj.entities || typeof obj.entities !== 'object') throw new Error('File bukan backup Mytime.');
    var out = {}, total = 0;
    Object.keys(obj.entities).forEach(function (e) {
      if (!TI.ENTITIES[e]) return;
      var list = obj.entities[e];
      if (!Array.isArray(list)) throw new Error('Format ' + e + ' tidak valid.');
      var idf = TI.ENTITIES[e];
      var valid = list.filter(function (r) {
        if (!r || typeof r !== 'object' || Array.isArray(r)) return false;
        var id = String(r[idf] || '');
        return idf === 'Key' ? /^[A-Za-z0-9_.]{1,64}$/.test(id) : UUID_RE.test(id);
      }).map(function (r) {
        var clean = {};
        Object.keys(r).forEach(function (k) { if (typeof r[k] !== 'object' || r[k] === null) clean[k] = r[k]; });
        clean[idf] = idf === 'Key' ? clean[idf] : String(clean[idf]).toLowerCase();
        delete clean.ServerVersion; delete clean.ServerUpdatedAt;
        return clean;
      });
      if (valid.length !== list.length) throw new Error(ENTITY_LABEL[e] + ': ' + (list.length - valid.length) + ' record memiliki ID tidak valid.');
      out[e] = valid; total += valid.length;
    });
    if (!total) throw new Error('Backup tidak berisi data.');
    return { entities: out, total: total };
  }

  function importBackup() {
    var file = h('input', { type: 'file', accept: 'application/json,.json', class: 'sr-only' });
    document.body.appendChild(file);
    file.addEventListener('change', function () {
      var f = file.files && file.files[0];
      file.remove();
      if (!f) return;
      if (f.size > 20 * 1024 * 1024) { TI.ui.alertError(new Error('File terlalu besar (maks. 20 MB).')); return; }
      f.text().then(function (txt) {
        var parsed = validateBackup(JSON.parse(txt));
        var summary = Object.keys(parsed.entities).map(function (e) { return ENTITY_LABEL[e] + ': ' + parsed.entities[e].length; }).join(', ');
        return TI.ui.confirm('Import ' + parsed.total + ' record?', summary + '. Record dengan ID yang sama akan diperbarui; perbedaan dengan server ditangani sebagai konflik, bukan ditimpa diam-diam.', { confirmText: 'Import' })
          .then(function (ok) {
            if (!ok) return;
            var order = ['categories', 'settings', 'goals', 'tasks', 'habits', 'timeBudgets', 'timeEntries', 'habitLogs', 'focusSessions', 'journal', 'dailySnapshots', 'weeklySnapshots'];
            var chain = Promise.resolve(0);
            order.forEach(function (e) { if (parsed.entities[e]) chain = chain.then(function (n) { return TI.repo.importRecords(e, parsed.entities[e]).then(function (m) { return n + m; }); }); });
            return chain.then(function (n) {
              TI.bus.emit('data', { entities: Object.keys(TI.ENTITIES) });
              TI.sync.schedule(300);
              TI.ui.toast(n + ' record diimpor, akan disinkronkan');
            });
          });
      }).catch(function (e) { TI.ui.alertError(e instanceof SyntaxError ? new Error('File bukan JSON yang valid.') : e, 'Import gagal'); });
    });
    file.click();
  }

  function clearLocal() {
    TI.db.getAll('queue').then(function (q) {
      var pending = q.length;
      var text = pending
        ? 'Ada ' + pending + ' perubahan yang BELUM tersinkron dan akan hilang. Data di server tidak terpengaruh.'
        : 'Semua data di perangkat ini dihapus. Data di server tidak terpengaruh dan akan diunduh ulang saat online.';
      return TI.ui.confirm('Hapus data lokal?', text, { danger: true, confirmText: 'Hapus data lokal' }).then(function (ok) {
        if (!ok) return;
        return TI.timer.stop().then(TI.repo.clearAllLocal).then(function () {
          TI.ui.toast('Data lokal dihapus');
          location.reload();
        });
      });
    });
  }

  function resetServerSheet() {
    var F = TI.forms;
    var pin = F.input({ type: 'password', inputmode: 'numeric', autocomplete: 'current-password', maxlength: '12' });
    var phrase = F.input({ type: 'text', autocomplete: 'off', placeholder: 'HAPUS SEMUA DATA' });
    var content = h('div', null,
      h('div', { class: 'banner' }, TI.icon('triangle-alert'), h('div', { class: 'grow', text: 'Semua task, goal, waktu, habit, jurnal, dan review di Google Sheets akan dikosongkan. Kategori dan pengaturan default dibuat ulang. Tindakan ini tidak dapat dibatalkan. Buat backup dulu.' })),
      F.field('PIN', pin), F.field('Ketik HAPUS SEMUA DATA', phrase));
    TI.ui.sheet({ title: 'Reset data server', content: content, actions: [{ label: 'Reset server', kind: 'danger solid', onClick: function () {
      F.clearErrors(content);
      if (!/^\d{4,12}$/.test(pin.value)) return F.setError(pin, 'Masukkan PIN.');
      if (phrase.value.trim() !== 'HAPUS SEMUA DATA') return F.setError(phrase, 'Frasa konfirmasi tidak sesuai.');
      return TI.api.call('data.resetServer', { pin: pin.value, confirm: phrase.value.trim() }, { timeout: 90000 }).then(function () {
        return TI.timer.stop().then(TI.repo.clearAllLocal).then(function () {
          TI.ui.toast('Server di-reset');
          setTimeout(function () { location.reload(); }, 600);
        });
      }, function (e) { pin.value = ''; F.setError(e.extra && e.extra.field === 'confirm' ? phrase : pin, e.message); return false; });
    } }] });
  }

  // ---------------------------------------------------------------- preferensi
  function weightsSheet() {
    var F = TI.forms;
    var w = C.parseWeights(TI.repo.setting('scoreWeights', ''));
    var inputs = {};
    var content = h('div', null,
      h('p', { class: 'small muted', style: { marginBottom: '12px' }, text: 'Bobot relatif tiap komponen (0–100). Total tidak harus 100; skor dinormalisasi terhadap komponen yang datanya tersedia. Isi 0 untuk mengabaikan komponen.' }),
      h('div', { class: 'grid-2' }, Object.keys(C.DEFAULT_WEIGHTS).map(function (k) {
        inputs[k] = F.input({ type: 'number', inputmode: 'numeric', min: '0', max: '100', value: String(w[k]) });
        return F.field(C.COMPONENT_LABELS[k], inputs[k]);
      })));
    TI.ui.sheet({ title: 'Bobot Future Self Score', content: content, actions: [
      { label: 'Default', onClick: function () { Object.keys(inputs).forEach(function (k) { inputs[k].value = String(C.DEFAULT_WEIGHTS[k]); }); return false; } },
      { label: 'Simpan bobot', kind: 'primary', onClick: function () {
        F.clearErrors(content);
        var out = {}, sum = 0;
        var bad = Object.keys(inputs).filter(function (k) {
          var v = Number(inputs[k].value);
          if (!isFinite(v) || v < 0 || v > 100 || Math.floor(v) !== v) { F.setError(inputs[k], '0–100'); return true; }
          out[k] = v; sum += v; return false;
        });
        if (bad.length) return false;
        if (sum === 0) return F.setError(inputs.goalProgress, 'Minimal satu komponen harus berbobot.');
        return setSetting('scoreWeights', JSON.stringify(out)).then(function () { TI.ui.toast('Bobot disimpan'); });
      } }] });
  }

  // ---------------------------------------------------------------- render
  function render(el) {
    U.clear(el);
    var st = TI.sync.getState();
    var autoLock = TI.repo.setting('autoLockMinutes', '15');
    var lockSel = TI.forms.select([{ value: '0', label: 'Tidak pernah' }, { value: '1', label: '1 menit' }, { value: '5', label: '5 menit' }, { value: '15', label: '15 menit' }, { value: '30', label: '30 menit' }, { value: '60', label: '1 jam' }, { value: '240', label: '4 jam' }], autoLock, { 'aria-label': 'Kunci otomatis', style: { width: 'auto' } });
    lockSel.addEventListener('change', function () { setSetting('autoLockMinutes', lockSel.value).then(function () { TI.ui.toast('Kunci otomatis diperbarui'); }); });
    var weekSel = TI.forms.select([{ value: '1', label: 'Senin' }, { value: '0', label: 'Minggu' }], TI.repo.setting('weekStartsOn', '1'), { 'aria-label': 'Awal minggu', style: { width: 'auto' } });
    weekSel.addEventListener('change', function () { setSetting('weekStartsOn', weekSel.value).then(function () { TI.ui.toast('Awal minggu diperbarui'); }); });
    var distInput = TI.forms.input({ type: 'number', inputmode: 'numeric', min: '0', max: '1440', step: '5', value: TI.repo.setting('dailyDistractionTargetMinutes', '60'), 'aria-label': 'Batas distraksi harian (menit)', style: { width: '96px' } });
    distInput.addEventListener('change', function () {
      var v = Number(distInput.value);
      if (!isFinite(v) || v < 0 || v > 1440 || Math.floor(v) !== v) { TI.ui.toast('Isi 0–1440 menit', 'error'); return; }
      setSetting('dailyDistractionTargetMinutes', String(v)).then(function () { TI.ui.toast('Batas distraksi diperbarui'); });
    });

    var cats = TI.repo.list('categories').sort(function (a, b) { return (a.SortOrder || 0) - (b.SortOrder || 0); });
    var catList = h('div', { class: 'list' }, cats.map(function (c) {
      var flags = [TYPE_LABEL[c.Type]];
      if (c.FutureBuilding) flags.push('membangun masa depan');
      if (!c.CountsActive) flags.push('bukan waktu aktif');
      if (!c.Active) flags.push('nonaktif');
      return h('div', { class: 'item tap', onclick: function () { TI.forms.category(c); } }, TI.ui.categoryDot(c),
        h('div', { class: 'item-main' }, h('div', { class: 'item-title' + (c.Active ? '' : ' done'), text: c.Name }), h('div', { class: 'item-meta', text: flags.join(', ') })), TI.icon('chevron-right', 18));
    }));

    var installBtn = TI.installPrompt ? row('download', 'Instal aplikasi', 'Tambahkan Mytime ke layar utama', function () {
      var p = TI.installPrompt; TI.installPrompt = null;
      p.prompt(); p.userChoice.finally(function () { render(el); });
    }) : null;
    var mode = TI.api.isGasHosted() ? 'Disajikan dari Google Apps Script (tanpa mode offline penuh)' : (navigator.serviceWorker && navigator.serviceWorker.controller ? 'PWA dengan cache offline aktif' : 'Web app (cache offline belum aktif)');

    U.append(el, [
      section('Keamanan', [
        row('shield-check', 'Ganti PIN', 'Disarankan 6 digit', function () { TI.auth.changePinSheet(false); }),
        h('div', { class: 'item' }, h('span', { class: 'icon', style: { color: 'var(--primary)' } }, TI.icon('lock', 20)), h('div', { class: 'item-main' }, h('div', { class: 'item-title', text: 'Kunci otomatis' }), h('div', { class: 'item-meta', text: 'Membuka kunci butuh koneksi internet' })), lockSel),
        row('lock', 'Kunci sekarang', null, function () { TI.auth.lock('manual'); }),
        row('log-out', 'Logout', 'Data lokal tetap tersimpan kecuali kamu memilih menghapusnya', function () {
          Swal.fire({ title: 'Logout?', input: 'checkbox', inputValue: 0, inputPlaceholder: 'Hapus juga data lokal di perangkat ini', showCancelButton: true, confirmButtonText: 'Logout', cancelButtonText: 'Batal', reverseButtons: true })
            .then(function (r) { if (r.isConfirmed) TI.auth.logout(!!r.value); });
        }),
        row('log-out', 'Logout semua perangkat', 'Mencabut semua sesi aktif', function () {
          TI.ui.confirm('Logout semua perangkat?', 'Semua perangkat termasuk yang ini harus memasukkan PIN lagi.', { danger: true, confirmText: 'Logout semua' })
            .then(function (ok) { if (ok) TI.auth.logoutAll().catch(TI.ui.alertError); });
        })
      ]),
      section('Sinkronisasi', [
        row('cloud-check', 'Status: ' + ({ online: 'Online', offline: 'Offline', syncing: 'Syncing', synced: 'Synced', error: 'Sync Error' }[st.status] || st.status),
          st.pending + ' menunggu, ' + st.failed + ' ditolak, ' + st.conflicts + ' konflik', openSyncSheet, TI.icon('chevron-right', 18))
      ]),
      TI.ui.blockTitle('Kategori', { label: 'Tambah', onClick: function () { TI.forms.category(); } }),
      catList,
      h('p', { class: 'xs muted', style: { marginTop: '8px' }, text: 'Atur apakah kategori termasuk pengembangan diri, pemulihan, hiburan, atau distraksi. Aktivitas yang tidak menghasilkan uang tetap bisa bernilai.' }),
      section('Preferensi', [
        h('div', { class: 'item' }, h('div', { class: 'item-main' }, h('div', { class: 'item-title', text: 'Awal minggu' })), weekSel),
        h('div', { class: 'item' }, h('div', { class: 'item-main' }, h('div', { class: 'item-title', text: 'Batas distraksi harian' }), h('div', { class: 'item-meta', text: 'Menit per hari, untuk perbandingan' })), distInput),
        row('sliders-horizontal', 'Bobot Future Self Score', 'Sesuaikan dengan prioritas hidupmu', weightsSheet),
        row('wallet', 'Time Budget', 'Target jam per minggu tiap kategori', function () { TI.ui.showSection('budget'); })
      ]),
      section('Data', [
        row('download', 'Export CSV', 'Per jenis data, dari perangkat ini', exportCsvSheet),
        row('download', 'Backup data lokal (JSON)', 'Berfungsi juga saat offline', backupLocal),
        row('cloud-upload', 'Backup dari server (JSON)', 'Membutuhkan koneksi', backupServer),
        row('upload', 'Import backup', 'Data divalidasi lalu disinkronkan', importBackup),
        row('trash-2', 'Hapus data lokal', 'Tidak menghapus data di server', clearLocal),
        row('triangle-alert', 'Reset data server', 'Operasi terpisah dengan konfirmasi PIN', resetServerSheet)
      ]),
      !TI.api.isGasHosted() ? section('Koneksi backend', [
        row('settings', 'URL Web App', TI.api.getApiUrl() || 'Belum diatur', function () {
          TI.ui.confirm('Ubah URL backend?', 'Kamu akan logout dan perlu memasukkan PIN pada backend baru. Data lokal yang belum tersinkron tetap tersimpan.', { confirmText: 'Ubah' })
            .then(function (ok) { if (ok) { TI.api.setApiUrl(''); TI.api.saveSession(null); location.reload(); } });
        })
      ]) : null,
      section('Tentang', [installBtn, row('info', 'Mytime ' + APP_VERSION, mode)].filter(Boolean)),
      h('p', { class: 'xs muted', style: { marginTop: '12px', textAlign: 'center' }, text: 'Invest Your Time. Build Your Future.' })
    ]);
  }

  TI.views.settings = {
    deps: ['settings', 'categories'], render: render, openSyncSheet: openSyncSheet, toCsv: toCsv, validateBackup: validateBackup,
    onShow: function () { TI.ui.loadSectionData('settings', {}, true); }
  };
  var lastSig = '';
  TI.bus.on('sync', function (st) {
    var sig = [st.status, st.pending, st.failed, st.conflicts].join('|');
    if (sig === lastSig) return;
    lastSig = sig;
    if (TI.ui.current() === 'settings' && !document.querySelector('.sheet-backdrop') && !(document.activeElement && document.activeElement.matches('input, select'))) {
      TI.ui.loadSectionData('settings', {}, true);
    }
  });
  TI.bus.on('installable', function () { if (TI.ui.current() === 'settings') TI.ui.loadSectionData('settings', {}, true); });
})();
