/**
 * Mytime — timer.js
 * Satu timer aktif (tracking atau fokus) yang durasinya dihitung dari timestamp, bukan dari
 * jumlah tick setInterval. Status disimpan di IndexedDB sehingga pulih setelah aplikasi ditutup,
 * browser masuk background, atau perangkat dikunci. BroadcastChannel menjaga tab lain sinkron.
 *
 * Bentuk state: { id, kind: 'TRACK'|'FOCUS', activity, categoryId, goalId, taskId, plannedMinutes,
 *                 startedAt, segments: [{s, e}], runningSince: ms|null, notified }
 */
(function () {
  'use strict';
  var TI = window.TI = window.TI || {};
  var KEY = 'activeTimer';
  var current = null;
  var tickId = null;
  var channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('ti-timer') : null;

  function closedMs(t) {
    return t.segments.reduce(function (s, seg) { return s + (seg.e - seg.s); }, 0);
  }

  /** Waktu aktif (ms). Untuk fokus, berhenti di durasi yang direncanakan. */
  function elapsedMs(t, now) {
    if (!t) return 0;
    now = now || Date.now();
    var ms = closedMs(t) + (t.runningSince ? Math.max(0, now - t.runningSince) : 0);
    if (t.kind === 'FOCUS' && t.plannedMinutes) ms = Math.min(ms, t.plannedMinutes * 60000);
    return ms;
  }

  /** Untuk fokus yang sudah mencapai durasi rencana: kapan tepatnya selesai. */
  function effectiveEndMs(t, now) {
    now = now || Date.now();
    if (t.runningSince) {
      if (t.kind === 'FOCUS' && t.plannedMinutes) {
        var remain = t.plannedMinutes * 60000 - closedMs(t);
        return Math.min(now, t.runningSince + Math.max(0, remain));
      }
      return now;
    }
    var last = t.segments[t.segments.length - 1];
    return last ? last.e : t.startedAt;
  }

  function isDone(t) {
    return !!t && t.kind === 'FOCUS' && t.plannedMinutes && elapsedMs(t) >= t.plannedMinutes * 60000;
  }

  function persist() {
    var p = current ? TI.db.setMeta(KEY, current) : TI.db.delMeta(KEY);
    return p.then(function () {
      if (channel) channel.postMessage({ type: 'changed' });
      emit();
    });
  }

  function emit() { TI.bus.emit('timer', current ? Object.assign({}, current) : null); }

  function restore() {
    return TI.db.getMeta(KEY, null).then(function (t) {
      current = t;
      ensureTick();
      emit();
      return current;
    });
  }

  function ensureTick() {
    clearInterval(tickId);
    if (!current) return;
    // Tick hanya memperbarui tampilan; durasi selalu dihitung dari timestamp.
    tickId = setInterval(function () {
      TI.bus.emit('timer-tick', current);
      if (isDone(current) && !current.notified) {
        current.notified = true;
        persist();
        TI.bus.emit('focus-complete', current);
      }
    }, 1000);
  }

  function start(opts) {
    if (current) return Promise.reject(Object.assign(new Error('Masih ada timer yang berjalan. Selesaikan dulu.'), { code: 'TIMER_ACTIVE' }));
    var now = Date.now();
    current = {
      id: TI.util.uuid(), kind: opts.kind || 'TRACK', activity: opts.activity, categoryId: opts.categoryId,
      goalId: opts.goalId || '', taskId: opts.taskId || '', plannedMinutes: opts.plannedMinutes || null,
      startedAt: now, segments: [], runningSince: now, notified: false
    };
    ensureTick();
    return persist().then(function () { return current; });
  }

  function pause() {
    if (!current || !current.runningSince) return Promise.resolve(current);
    var end = effectiveEndMs(current);
    current.segments.push({ s: current.runningSince, e: end });
    current.runningSince = null;
    return persist().then(function () { return current; });
  }

  function resume() {
    if (!current || current.runningSince) return Promise.resolve(current);
    if (isDone(current)) return Promise.resolve(current);
    current.runningSince = Date.now();
    return persist().then(function () { return current; });
  }

  /**
   * Hentikan timer dan kembalikan ringkasannya (tanpa menyimpan entry — dilakukan pemanggil).
   * @return {{timer, startMs, endMs, minutes}}
   */
  function stop() {
    if (!current) return Promise.resolve(null);
    var t = current;
    var endMs = effectiveEndMs(t);
    var ms = elapsedMs(t, endMs);
    var summary = { timer: t, startMs: t.startedAt, endMs: endMs, minutes: Math.round(ms / 60000), seconds: Math.round(ms / 1000) };
    current = null;
    clearInterval(tickId);
    return persist().then(function () { return summary; });
  }

  function update(fields) {
    if (!current) return Promise.resolve(null);
    Object.assign(current, fields);
    return persist().then(function () { return current; });
  }

  if (channel) {
    channel.onmessage = function () { restore(); };
  }

  TI.timer = {
    restore: restore, start: start, pause: pause, resume: resume, stop: stop, update: update,
    get: function () { return current; }, elapsedMs: elapsedMs, isDone: isDone, effectiveEndMs: effectiveEndMs
  };
})();
