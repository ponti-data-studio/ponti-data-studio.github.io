/**
 * Mytime — sync.js
 * Mesin sinkronisasi: push antrean → pull perubahan server → perbarui indikator.
 * Kegagalan apa pun tidak menghapus data lokal; operasi dikembalikan ke PENDING dan dicoba lagi (backoff).
 */
(function () {
  'use strict';
  var TI = window.TI = window.TI || {};

  var BATCH = 50;
  var state = {
    status: navigator.onLine === false ? 'offline' : 'online', // online | offline | syncing | synced | error
    pending: 0, failed: 0, conflicts: 0, lastSyncAt: null, lastError: ''
  };
  var running = null;
  var timer = null;
  var backoffMs = 0;
  var intervalId = null;

  function setState(patch) {
    Object.assign(state, patch);
    TI.bus.emit('sync', Object.assign({}, state));
  }

  function refreshCounts() {
    return Promise.all([TI.db.getAll('queue'), TI.db.count('conflicts')]).then(function (r) {
      var q = r[0];
      setState({
        pending: q.filter(function (x) { return x.status === 'PENDING' || x.status === 'SYNCING'; }).length,
        failed: q.filter(function (x) { return x.status === 'FAILED'; }).length,
        conflicts: r[1]
      });
      return state;
    });
  }

  function canSync() {
    var s = TI.api.getSession();
    return TI.api.isConfigured() && s && s.token && !(TI.auth && TI.auth.isLocked());
  }

  function schedule(delay) {
    clearTimeout(timer);
    refreshCounts();
    if (!canSync()) return;
    timer = setTimeout(function () { run(); }, delay === undefined ? 1500 : delay);
  }

  function revert(items) {
    items.forEach(function (q) { if (q.status === 'SYNCING') q.status = 'PENDING'; });
    return TI.db.bulkPut('queue', items);
  }

  /** Satu putaran push. @return {Promise<number>} jumlah operasi yang diproses */
  function pushOnce() {
    return TI.db.getAll('queue').then(function (all) {
      var pending = all.filter(function (q) { return q.status === 'PENDING'; })
        .sort(function (a, b) { return a.createdAt - b.createdAt; });
      if (!pending.length) return 0;
      var seen = {};
      var batch = [];
      pending.forEach(function (q) {
        if (batch.length >= BATCH || seen[q.key]) return;
        seen[q.key] = true;
        batch.push(q);
      });
      var dropped = [];
      var ops = [];
      var sent = {};
      batch.forEach(function (q) {
        var rec = TI.repo.listAll(q.entity).filter(function (r) { return r[TI.repo.idField(q.entity)] === q.id; })[0];
        if (!rec) { dropped.push(q.opId); return; }
        sent[q.opId] = rec.LocalUpdatedAt;
        ops.push({
          opId: q.opId, entity: q.entity, op: q.op, id: q.id,
          record: TI.repo.stripMeta(rec), baseVersion: rec.ServerVersion || null
        });
        q.status = 'SYNCING';
        q.attempts = (q.attempts || 0) + 1;
      });
      var live = batch.filter(function (q) { return dropped.indexOf(q.opId) === -1; });
      return Promise.all(dropped.map(function (id) { return TI.db.del('queue', id); }))
        .then(function () { return TI.db.bulkPut('queue', live); })
        .then(function () {
          if (!ops.length) return dropped.length;
          return TI.api.call('sync.push', { ops: ops }, { timeout: 45000 }).then(function (res) {
            var byOp = {};
            res.results.forEach(function (r) { if (r.opId) byOp[String(r.opId).toLowerCase()] = r; });
            var chain = Promise.resolve();
            live.forEach(function (q) {
              var r = byOp[q.opId];
              chain = chain.then(function () {
                if (!r) { q.status = 'PENDING'; return TI.db.put('queue', q); }
                if (r.status === 'OK') {
                  return TI.db.del('queue', q.opId)
                    .then(function () { return TI.db.getAllByIndex('queue', 'key', q.key); })
                    .then(function (rest) { return TI.repo.applyPushOk(q.entity, q.id, r, sent[q.opId], rest.length > 0); });
                }
                if (r.status === 'CONFLICT') {
                  return TI.repo.setConflict(q.entity, q.id, r.server);
                }
                // INVALID: simpan alasan, jangan hapus data lokal.
                q.status = 'FAILED';
                q.lastError = (r.error && r.error.message) || 'Ditolak server.';
                return TI.db.put('queue', q).then(function () {
                  return TI.repo.markRecord(q.entity, q.id, { SyncStatus: 'FAILED', SyncError: q.lastError });
                });
              });
            });
            return chain.then(function () {
              if (res.epoch) return checkEpoch(res.epoch);
            }).then(function () { return live.length; });
          }, function (err) {
            return revert(live).then(function () { throw err; });
          });
        });
    });
  }

  function checkEpoch(epoch) {
    return TI.db.getMeta('epoch', null).then(function (known) {
      if (!known) return TI.db.setMeta('epoch', String(epoch));
      if (String(known) === String(epoch)) return;
      // Server di-reset dari perangkat lain/operasi admin.
      return TI.repo.rebaseAfterServerReset().then(function (kept) {
        return Promise.all([TI.db.setMeta('epoch', String(epoch)), TI.db.setMeta('pullCursor', 0)]).then(function () {
          TI.bus.emit('server-reset', { kept: kept });
          throw Object.assign(new Error('epoch-changed'), { code: 'EPOCH_CHANGED' });
        });
      });
    });
  }

  function pullAll() {
    var changed = {};
    function page() {
      return TI.db.getMeta('pullCursor', 0).then(function (since) {
        return TI.api.call('sync.pull', { since: since }, { timeout: 45000 }).then(function (res) {
          return checkEpoch(res.epoch).then(function () {
            var chain = Promise.resolve();
            res.records.forEach(function (item) {
              if (!TI.ENTITIES[item.entity]) return;
              chain = chain.then(function () {
                return TI.repo.applyPulled(item.entity, item.record).then(function (c) { if (c) changed[item.entity] = true; });
              });
            });
            return chain.then(function () { return TI.db.setMeta('pullCursor', res.cursor); })
              .then(function () { return res.hasMore ? page() : null; });
          });
        });
      });
    }
    return page().then(function () { return Object.keys(changed); });
  }

  function run() {
    if (running) return running;
    if (!canSync()) { refreshCounts(); return Promise.resolve(state); }
    if (navigator.onLine === false && !TI.api.isGasHosted()) {
      setState({ status: 'offline' });
      return refreshCounts();
    }
    setState({ status: 'syncing', lastError: '' });
    var rounds = 0;
    function pushLoop() {
      return pushOnce().then(function (n) {
        rounds++;
        if (n > 0 && rounds < 20) return pushLoop();
      });
    }
    function cycle(attempt) {
      return pushLoop().then(pullAll).catch(function (err) {
        if (err && err.code === 'EPOCH_CHANGED' && attempt < 2) return cycle(attempt + 1);
        throw err;
      });
    }
    running = cycle(0)
      .then(function (changedEntities) {
        backoffMs = 0;
        var now = new Date().toISOString();
        TI.db.setMeta('lastSyncAt', now);
        if (changedEntities && changedEntities.length) TI.bus.emit('data', { entities: changedEntities, source: 'pull' });
        return refreshCounts().then(function () {
          setState({ status: (state.failed || state.conflicts) ? 'error' : 'synced', lastSyncAt: now,
            lastError: state.conflicts ? 'Ada konflik yang perlu dipilih.' : (state.failed ? 'Ada perubahan yang ditolak server.' : '') });
          if (state.pending > 0) schedule(500);
        });
      })
      .catch(function (err) {
        TI.bus.emit('data', { entities: Object.keys(TI.ENTITIES), source: 'pull' });
        return refreshCounts().then(function () {
          if (err && err.code === 'AUTH_REQUIRED') {
            setState({ status: 'error', lastError: 'Sesi berakhir. Masukkan PIN untuk melanjutkan sinkronisasi.' });
            TI.bus.emit('auth-required', err);
            return;
          }
          if (TI.api.isConnectivityError(err)) {
            setState({ status: navigator.onLine === false ? 'offline' : 'error', lastError: err.message });
          } else {
            setState({ status: 'error', lastError: (err && err.message) || 'Sinkronisasi gagal.' });
            if (!(err instanceof TI.ApiError)) console.error(err);
          }
          backoffMs = Math.min(backoffMs ? backoffMs * 2 : 5000, 300000);
          clearTimeout(timer);
          timer = setTimeout(run, backoffMs);
        });
      })
      .then(function () { running = null; return state; }, function (e) { running = null; throw e; });
    return running;
  }

  /** Coba kirim ulang operasi yang ditolak (mis. setelah memperbaiki data). */
  function retryFailed() {
    return TI.db.getAll('queue').then(function (all) {
      var failed = all.filter(function (q) { return q.status === 'FAILED'; });
      failed.forEach(function (q) { q.status = 'PENDING'; q.attempts = 0; q.opId = q.opId; });
      return TI.db.bulkPut('queue', failed);
    }).then(function () { return run(); });
  }

  function start() {
    window.addEventListener('online', function () { setState({ status: 'online' }); schedule(300); });
    window.addEventListener('offline', function () { setState({ status: 'offline' }); });
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') schedule(300); });
    clearInterval(intervalId);
    intervalId = setInterval(function () { if (document.visibilityState === 'visible') run(); }, 120000);
    refreshCounts();
  }

  TI.sync = { start: start, run: run, schedule: schedule, refreshCounts: refreshCounts, retryFailed: retryFailed, getState: function () { return Object.assign({}, state); } };
})();
