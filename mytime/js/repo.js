/**
 * Mytime — repo.js
 * Local Repository: semua baca/tulis aplikasi lewat sini. Data dimuat dari IndexedDB ke memori
 * saat start; setiap perubahan ditulis ke IndexedDB + antrean sinkronisasi dalam SATU transaksi,
 * sehingga data tidak pernah bergantung pada request jaringan.
 *
 * Metadata sinkronisasi per record (lokal saja): SyncStatus, LocalUpdatedAt, ServerUpdatedAt, ServerVersion, SyncError.
 */
(function () {
  'use strict';
  var TI = window.TI = window.TI || {};
  var U = TI.util;
  var META_FIELDS = ['SyncStatus', 'LocalUpdatedAt', 'ServerUpdatedAt', 'ServerVersion', 'SyncError'];

  // ---------------------------------------------------------------- event bus
  var listeners = {};
  TI.bus = {
    on: function (evt, fn) { (listeners[evt] = listeners[evt] || []).push(fn); },
    off: function (evt, fn) { listeners[evt] = (listeners[evt] || []).filter(function (f) { return f !== fn; }); },
    emit: function (evt, payload) {
      (listeners[evt] || []).slice().forEach(function (fn) {
        try { fn(payload); } catch (e) { console.error(e); }
      });
    }
  };

  var cache = {};       // entity -> { id: record }
  var loaded = false;

  function idField(entity) { return TI.ENTITIES[entity]; }
  function keyOf(entity, id) { return entity + ':' + id; }

  function load() {
    var names = Object.keys(TI.ENTITIES);
    return Promise.all(names.map(function (n) { return TI.db.getAll(n); })).then(function (lists) {
      names.forEach(function (n, i) {
        var m = {};
        lists[i].forEach(function (r) { m[r[idField(n)]] = r; });
        cache[n] = m;
      });
      loaded = true;
    });
  }

  /** Record yang belum dihapus. */
  function list(entity) {
    var m = cache[entity] || {};
    return Object.keys(m).map(function (k) { return m[k]; }).filter(function (r) { return !r.Deleted; });
  }
  function listAll(entity) {
    var m = cache[entity] || {};
    return Object.keys(m).map(function (k) { return m[k]; });
  }
  function get(entity, id) {
    var r = (cache[entity] || {})[id];
    return r && !r.Deleted ? r : null;
  }

  /** Snapshot data untuk calc.js. */
  function snapshot() {
    var out = {};
    Object.keys(TI.ENTITIES).forEach(function (e) { out[e] = list(e); });
    return out;
  }

  function settingsMap() {
    var out = {};
    list('settings').forEach(function (s) { out[s.Key] = s.Value; });
    return out;
  }
  function setting(key, fallback) {
    var s = get('settings', key);
    return s ? s.Value : fallback;
  }

  function stripMeta(rec) {
    var out = {};
    Object.keys(rec).forEach(function (k) { if (META_FIELDS.indexOf(k) === -1) out[k] = rec[k]; });
    return out;
  }

  /**
   * Masukkan operasi ke antrean di dalam transaksi yang sama dengan penulisan record.
   * Operasi baru digabung ke operasi yang belum pernah dikirim / yang gagal validasi;
   * operasi yang mungkin sudah sampai di server (pernah dikirim) dipertahankan dengan opId-nya.
   */
  function enqueueInTx(tx, entity, id, op) {
    var store = tx.objectStore('queue');
    var key = keyOf(entity, id);
    return TI.db.reqToPromise(store.index('key').getAll(key)).then(function (items) {
      var mergeable = items.filter(function (q) { return q.status === 'FAILED' || (q.status === 'PENDING' && !q.attempts); })[0];
      if (mergeable) {
        store.delete(mergeable.opId);
        mergeable.opId = U.uuid();   // konten baru → opId baru (idempotensi per konten)
        mergeable.op = op;
        mergeable.status = 'PENDING';
        mergeable.attempts = 0;
        mergeable.lastError = '';
        store.put(mergeable);
        return;
      }
      store.put({ opId: U.uuid(), key: key, entity: entity, id: id, op: op, status: 'PENDING', attempts: 0, lastError: '', createdAt: Date.now() });
    });
  }

  function emitChange(entity) { TI.bus.emit('data', { entities: [entity] }); }

  /**
   * Simpan (buat/ubah) record secara lokal + antrekan sinkronisasi.
   * @return {Promise<Object>} record tersimpan
   */
  function save(entity, record) {
    var idf = idField(entity);
    var now = U.nowIso();
    var rec = Object.assign({}, record);
    if (!rec[idf]) rec[idf] = U.uuid();
    var existing = (cache[entity] || {})[rec[idf]];
    if (existing) {
      META_FIELDS.forEach(function (f) { if (!(f in rec)) rec[f] = existing[f]; });
      rec.CreatedAt = existing.CreatedAt || now;
    } else if (!rec.CreatedAt) rec.CreatedAt = now;
    rec.UpdatedAt = now;
    if (rec.Deleted === undefined) rec.Deleted = false;
    rec.SyncStatus = 'PENDING';
    rec.LocalUpdatedAt = now;
    rec.SyncError = '';
    return TI.db.withStore([entity, 'queue'], 'readwrite', function (tx) {
      tx.objectStore(entity).put(rec);
      return enqueueInTx(tx, entity, rec[idf], 'upsert');
    }).then(function () {
      cache[entity][rec[idf]] = rec;
      emitChange(entity);
      if (TI.sync) TI.sync.schedule();
      return rec;
    });
  }

  /** Hapus (soft delete). Record yang belum pernah sampai ke server dihapus lokal sepenuhnya. */
  function remove(entity, id) {
    var rec = (cache[entity] || {})[id];
    if (!rec) return Promise.resolve();
    var now = U.nowIso();
    return TI.db.withStore([entity, 'queue'], 'readwrite', function (tx) {
      var qs = tx.objectStore('queue');
      return TI.db.reqToPromise(qs.index('key').getAll(keyOf(entity, id))).then(function (items) {
        var neverSent = !rec.ServerVersion && items.every(function (q) { return !q.attempts || q.status === 'FAILED'; });
        if (neverSent) {
          items.forEach(function (q) { qs.delete(q.opId); });
          tx.objectStore(entity).delete(id);
          return 'local';
        }
        var upd = Object.assign({}, rec, { Deleted: true, UpdatedAt: now, LocalUpdatedAt: now, SyncStatus: 'PENDING', SyncError: '' });
        tx.objectStore(entity).put(upd);
        return enqueueInTx(tx, entity, id, 'delete').then(function () { return upd; });
      });
    }).then(function (res) {
      if (res === 'local') delete cache[entity][id];
      else cache[entity][id] = res;
      TI.db.del('conflicts', keyOf(entity, id));
      emitChange(entity);
      if (TI.sync) TI.sync.schedule();
    });
  }

  // ---------------------------------------------------------------- dipakai sync.js

  /**
   * Hasil push OK.
   * - Jika record berubah lagi selama pengiriman, atau masih ada operasi lain untuk record ini,
   *   konten lokal dipertahankan (tetap PENDING) dan hanya versi server yang diperbarui.
   * - Hasil "replay" (opId sudah pernah diproses) tidak membawa konten baru dari server.
   */
  function applyPushOk(entity, id, result, sentLocalUpdatedAt, moreQueued) {
    var local = (cache[entity] || {})[id];
    var server = result.record;
    var rec;
    if (!local) return Promise.resolve();
    var keepLocal = moreQueued || local.LocalUpdatedAt !== sentLocalUpdatedAt;
    if (result.version === null && local.Deleted && !keepLocal) {
      // Dihapus sebelum pernah tersimpan di server.
      delete cache[entity][id];
      return TI.db.del(entity, id);
    }
    if (keepLocal) {
      rec = Object.assign({}, local, {
        ServerVersion: result.version || local.ServerVersion,
        ServerUpdatedAt: result.serverUpdatedAt || local.ServerUpdatedAt
      });
    } else if (server && !result.replay) {
      rec = Object.assign({}, server, {
        SyncStatus: 'SYNCED', LocalUpdatedAt: local.LocalUpdatedAt, ServerUpdatedAt: server.ServerUpdatedAt,
        ServerVersion: server.ServerVersion, SyncError: ''
      });
    } else {
      rec = Object.assign({}, local, {
        SyncStatus: 'SYNCED', SyncError: '',
        ServerVersion: result.version || local.ServerVersion,
        ServerUpdatedAt: result.serverUpdatedAt || local.ServerUpdatedAt
      });
    }
    cache[entity][id] = rec;
    return TI.db.put(entity, rec);
  }

  function markRecord(entity, id, fields) {
    var local = (cache[entity] || {})[id];
    if (!local) return Promise.resolve();
    var rec = Object.assign({}, local, fields);
    cache[entity][id] = rec;
    return TI.db.put(entity, rec);
  }

  /** Terapkan record dari pull. Perubahan lokal yang tertunda tidak ditimpa: ditandai konflik. */
  function applyPulled(entity, server) {
    var id = server[idField(entity)];
    var local = (cache[entity] || {})[id];
    var pending = local && (local.SyncStatus === 'PENDING' || local.SyncStatus === 'FAILED' || local.SyncStatus === 'SYNCING' || local.SyncStatus === 'CONFLICT');
    if (pending) {
      if ((local.ServerVersion || 0) >= server.ServerVersion) return Promise.resolve(false);
      return setConflict(entity, id, server).then(function () { return true; });
    }
    var rec = Object.assign({}, server, {
      SyncStatus: 'SYNCED', LocalUpdatedAt: local ? local.LocalUpdatedAt : server.UpdatedAt,
      ServerUpdatedAt: server.ServerUpdatedAt, ServerVersion: server.ServerVersion, SyncError: ''
    });
    cache[entity][id] = rec;
    return TI.db.put(entity, rec).then(function () { return true; });
  }

  function setConflict(entity, id, server) {
    var key = keyOf(entity, id);
    return TI.db.withStore([entity, 'queue', 'conflicts'], 'readwrite', function (tx) {
      tx.objectStore('conflicts').put({ key: key, entity: entity, id: id, server: server, at: Date.now() });
      var local = cache[entity][id];
      var rec = Object.assign({}, local, { SyncStatus: 'CONFLICT', SyncError: 'Record diubah di tempat lain.' });
      tx.objectStore(entity).put(rec);
      cache[entity][id] = rec;
      var qs = tx.objectStore('queue');
      return TI.db.reqToPromise(qs.index('key').getAll(key)).then(function (items) {
        items.forEach(function (q) { q.status = 'CONFLICT'; qs.put(q); });
      });
    });
  }

  function listConflicts() { return TI.db.getAll('conflicts'); }

  /**
   * Resolusi konflik.
   * 'mine'   → kirim ulang versi lokal dengan base = versi server terbaru (sadar menimpa).
   * 'server' → ganti versi lokal dengan versi server.
   */
  function resolveConflict(key, choice) {
    return TI.db.get('conflicts', key).then(function (c) {
      if (!c) return;
      var entity = c.entity, id = c.id, server = c.server;
      return TI.db.withStore([entity, 'queue', 'conflicts'], 'readwrite', function (tx) {
        var qs = tx.objectStore('queue');
        tx.objectStore('conflicts').delete(key);
        return TI.db.reqToPromise(qs.index('key').getAll(key)).then(function (items) {
          items.forEach(function (q) { qs.delete(q.opId); });
          var rec;
          if (choice === 'mine') {
            var local = cache[entity][id];
            rec = Object.assign({}, local, {
              ServerVersion: server.ServerVersion, ServerUpdatedAt: server.ServerUpdatedAt,
              SyncStatus: 'PENDING', SyncError: '', LocalUpdatedAt: U.nowIso()
            });
            qs.put({ opId: U.uuid(), key: key, entity: entity, id: id, op: local.Deleted ? 'delete' : 'upsert', status: 'PENDING', attempts: 0, lastError: '', createdAt: Date.now() });
          } else {
            rec = Object.assign({}, server, { SyncStatus: 'SYNCED', LocalUpdatedAt: server.UpdatedAt, ServerUpdatedAt: server.ServerUpdatedAt, ServerVersion: server.ServerVersion, SyncError: '' });
          }
          tx.objectStore(entity).put(rec);
          cache[entity][id] = rec;
        });
      });
    }).then(function () {
      TI.bus.emit('data', { entities: Object.keys(TI.ENTITIES) });
      if (TI.sync) TI.sync.schedule(0);
    });
  }

  /** Server di-reset (epoch berubah): buang data yang sudah tersinkron, pertahankan perubahan lokal sebagai record baru. */
  function rebaseAfterServerReset() {
    var names = Object.keys(TI.ENTITIES);
    return TI.db.withStore(names.concat(['queue', 'conflicts']), 'readwrite', function (tx) {
      tx.objectStore('queue').clear();
      tx.objectStore('conflicts').clear();
      var kept = 0;
      names.forEach(function (n) {
        var store = tx.objectStore(n);
        Object.keys(cache[n] || {}).forEach(function (id) {
          var r = cache[n][id];
          if (r.SyncStatus === 'SYNCED' || r.Deleted || n === 'categories' || n === 'settings') {
            store.delete(id); delete cache[n][id];
          } else {
            var upd = Object.assign({}, r, { ServerVersion: 0, ServerUpdatedAt: '', SyncStatus: 'PENDING', SyncError: '' });
            store.put(upd); cache[n][id] = upd; kept++;
            tx.objectStore('queue').put({ opId: U.uuid(), key: keyOf(n, id), entity: n, id: id, op: 'upsert', status: 'PENDING', attempts: 0, lastError: '', createdAt: Date.now() });
          }
        });
      });
      return kept;
    });
  }

  function clearAllLocal() {
    return TI.db.clearAll().then(function () {
      Object.keys(TI.ENTITIES).forEach(function (n) { cache[n] = {}; });
      TI.bus.emit('data', { entities: Object.keys(TI.ENTITIES) });
    });
  }

  /** Import record dari backup (sebagai perubahan lokal yang akan disinkronkan). */
  function importRecords(entity, records) {
    var idf = idField(entity);
    var now = U.nowIso();
    var out = [];
    return TI.db.withStore([entity, 'queue'], 'readwrite', function (tx) {
      var chain = Promise.resolve();
      records.forEach(function (r) {
        var existing = cache[entity][r[idf]];
        var rec = Object.assign({}, stripMeta(r), {
          SyncStatus: 'PENDING', LocalUpdatedAt: now, SyncError: '',
          ServerVersion: existing ? existing.ServerVersion : 0, ServerUpdatedAt: existing ? existing.ServerUpdatedAt : ''
        });
        tx.objectStore(entity).put(rec);
        out.push(rec);
        chain = chain.then(function () { return enqueueInTx(tx, entity, rec[idf], 'upsert'); });
      });
      return chain;
    }).then(function () {
      out.forEach(function (rec) { cache[entity][rec[idf]] = rec; });
      return out.length;
    });
  }

  TI.repo = {
    META_FIELDS: META_FIELDS, load: load, isLoaded: function () { return loaded; },
    list: list, listAll: listAll, get: get, snapshot: snapshot, settingsMap: settingsMap, setting: setting,
    save: save, remove: remove, stripMeta: stripMeta, keyOf: keyOf, idField: idField,
    applyPushOk: applyPushOk, markRecord: markRecord, applyPulled: applyPulled, setConflict: setConflict,
    listConflicts: listConflicts, resolveConflict: resolveConflict, rebaseAfterServerReset: rebaseAfterServerReset,
    clearAllLocal: clearAllLocal, importRecords: importRecords
  };
})();
