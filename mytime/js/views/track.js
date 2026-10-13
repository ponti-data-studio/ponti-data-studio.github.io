/**
 * Mytime — views/track.js (Time Tracking)
 * Timer berbasis timestamp (pulih setelah aplikasi ditutup), entry manual, daftar catatan per hari.
 */
(function () {
  'use strict';
  var TI = window.TI;
  var U = TI.util, h = U.h, C = TI.calc;
  var viewDate = null;
  var clockEl = null;

  TI.bus.on('timer-tick', function (t) {
    if (clockEl && t && t.kind === 'TRACK') clockEl.textContent = U.fmtClock(TI.timer.elapsedMs(t) / 1000);
  });
  TI.bus.on('timer', function () { if (TI.ui.current() === 'track') TI.ui.loadSectionData('track', {}, true); });

  /** Simpan hasil timer tracking sebagai time entry. */
  function finishTracking() {
    return TI.timer.stop().then(function (sum) {
      if (!sum) return;
      var t = sum.timer;
      var cat = TI.repo.get('categories', t.categoryId);
      var rec = {
        Date: U.localDate(sum.startMs), StartTime: U.toIso(sum.startMs), EndTime: U.toIso(Math.max(sum.endMs, sum.startMs + 60000)),
        DurationMinutes: sum.minutes, Activity: t.activity, CategoryID: t.categoryId, GoalID: t.goalId || '', TaskID: t.taskId || '',
        ProductivityType: cat ? cat.Type : '', Source: 'TIMER', FocusSessionID: '', Notes: ''
      };
      if (sum.minutes < 1) {
        TI.ui.toast('Kurang dari 1 menit, tidak disimpan', 'info');
        return;
      }
      if (sum.minutes > 8 * 60 || (sum.endMs - sum.startMs) > 47 * 3600000) {
        // Timer yang sangat panjang kemungkinan lupa dihentikan: minta pengguna meninjau dulu.
        if ((sum.endMs - sum.startMs) > 47 * 3600000) {
          rec.EndTime = U.toIso(sum.startMs + 8 * 3600000);
          rec.DurationMinutes = Math.min(rec.DurationMinutes, 480);
        }
        TI.ui.alertInfo('Tinjau catatan waktu', 'Timer berjalan ' + U.fmtMinutes(sum.minutes, true) + '. Periksa jam selesai sebelum menyimpan.')
          .then(function () { TI.forms.timeEntry(null, rec); });
        return;
      }
      return TI.repo.save('timeEntries', rec).then(function () { TI.ui.toast('Tercatat ' + U.fmtMinutes(sum.minutes, true)); });
    });
  }

  function activeCard(t) {
    var cat = TI.repo.get('categories', t.categoryId);
    var task = t.taskId ? TI.repo.get('tasks', t.taskId) : null;
    clockEl = h('div', { class: 'clock', role: 'timer', 'aria-live': 'off', text: U.fmtClock(TI.timer.elapsedMs(t) / 1000) });
    var running = !!t.runningSince;
    return h('div', { class: 'panel clock-card' },
      h('div', { class: 'small muted', text: running ? 'Sedang dicatat' : 'Dijeda' }),
      clockEl,
      h('div', { class: 'clock-activity', text: t.activity }),
      h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '6px' } }, TI.ui.categoryDot(cat), h('span', { class: 'small muted', text: (cat ? cat.Name : '') + (task ? ' — ' + task.Title : '') })),
      h('div', { class: 'clock-actions' },
        running
          ? h('button', { type: 'button', class: 'btn', onclick: function () { TI.timer.pause(); } }, TI.icon('pause', 18), 'Pause')
          : h('button', { type: 'button', class: 'btn', onclick: function () { TI.timer.resume(); } }, TI.icon('play', 18), 'Resume'),
        h('button', { type: 'button', class: 'btn primary', onclick: function () { finishTracking(); } }, TI.icon('square', 18), 'Finish')),
      h('button', { type: 'button', class: 'link-btn', style: { color: 'var(--muted)', marginTop: '6px' }, onclick: function () {
        TI.ui.confirm('Buang timer ini?', 'Waktu yang sudah berjalan tidak akan disimpan.', { danger: true, confirmText: 'Buang' })
          .then(function (ok) { if (ok) TI.timer.stop(); });
      } }, 'Buang timer'));
  }

  function recentActivities() {
    var seen = {};
    var out = [];
    TI.repo.list('timeEntries').sort(function (a, b) { return String(b.StartTime).localeCompare(String(a.StartTime)); }).some(function (e) {
      var k = e.Activity.toLowerCase() + '|' + e.CategoryID;
      if (seen[k] || !TI.repo.get('categories', e.CategoryID)) return false;
      seen[k] = true;
      out.push(e);
      return out.length >= 6;
    });
    return out;
  }

  function startForm() {
    var F = TI.forms;
    var activity = F.input({ type: 'text', placeholder: 'Sedang mengerjakan apa?', maxlength: '200', autocomplete: 'off' });
    var cat = F.select(F.categoryOptions(F.defaultCategoryId()), F.defaultCategoryId());
    var task = F.select(F.taskOptions(''), '');
    var goal = F.select(F.goalOptions(''), '');
    task.addEventListener('change', function () {
      var t = TI.repo.get('tasks', task.value);
      if (!t) return;
      if (!activity.value.trim()) activity.value = t.Title;
      if (t.CategoryID) cat.value = t.CategoryID;
      if (t.GoalID) goal.value = t.GoalID;
    });
    function start(opts) {
      TI.timer.start(Object.assign({ kind: 'TRACK' }, opts)).catch(function (e) { TI.ui.alertError(e); });
    }
    var form = h('form', { class: 'panel', novalidate: true },
      F.field('Aktivitas', activity), F.field('Kategori', cat),
      h('div', { class: 'field-row' }, F.field('Task', task), F.field('Goal', goal)),
      h('button', { type: 'submit', class: 'btn primary block', style: { marginTop: '16px' } }, TI.icon('play', 18), 'Mulai timer'));
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      F.clearErrors(form);
      if (!activity.value.trim()) { F.setError(activity, 'Isi nama aktivitas.'); return; }
      start({ activity: activity.value.trim(), categoryId: cat.value, taskId: task.value, goalId: goal.value });
    });
    var recent = recentActivities();
    var recentBox = recent.length ? h('div', null,
      h('div', { class: 'small muted', style: { margin: '16px 0 8px' }, text: 'Mulai cepat' }),
      h('div', { class: 'row wrap' }, recent.map(function (e) {
        var c = TI.repo.get('categories', e.CategoryID);
        return h('button', { type: 'button', class: 'chip', onclick: function () {
          start({ activity: e.Activity, categoryId: e.CategoryID, taskId: e.TaskID && TI.repo.get('tasks', e.TaskID) && TI.calc.isOpenTask(TI.repo.get('tasks', e.TaskID)) ? e.TaskID : '', goalId: e.GoalID || '' });
        } }, h('span', { class: 'row', style: { gap: '6px' } }, TI.ui.categoryDot(c), h('span', { text: e.Activity })));
      }))) : null;
    return h('div', null, form, recentBox);
  }

  function dayList() {
    var today = U.today();
    viewDate = viewDate || today;
    var entries = TI.repo.list('timeEntries').filter(function (e) {
      var s = U.localDate(Date.parse(e.StartTime)), en = U.localDate(Date.parse(e.EndTime) - 1);
      return s <= viewDate && en >= viewDate;
    }).sort(function (a, b) { return String(a.StartTime).localeCompare(String(b.StartTime)); });
    var agg = C.aggregate({ categories: TI.repo.list('categories'), timeEntries: entries }, viewDate, viewDate);
    var nav = h('div', { class: 'row between', style: { marginTop: '28px' } },
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Hari sebelumnya', onclick: function () { viewDate = U.addDays(viewDate, -1); rerender(); } }, TI.icon('chevron-left')),
      h('div', { style: { textAlign: 'center' } }, h('h2', { text: U.relativeDay(viewDate, today) === 'Hari ini' ? 'Hari ini' : U.fmtDateLong(viewDate) }),
        h('div', { class: 'small muted num', text: 'Total ' + U.fmtMinutes(agg.buckets.total, true) + ' (tanpa hitung ganda)' })),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Hari berikutnya', disabled: viewDate >= today, onclick: function () { viewDate = U.addDays(viewDate, 1); rerender(); } }, TI.icon('chevron-right')));
    var list = entries.length ? h('div', { class: 'list', style: { marginTop: '10px' } }, entries.map(function (e) {
      var c = TI.repo.get('categories', e.CategoryID) || null;
      var paused = e.DurationMinutes < Math.round((Date.parse(e.EndTime) - Date.parse(e.StartTime)) / 60000) - 1;
      return h('div', { class: 'item tap', onclick: function () { TI.forms.timeEntry(e); } },
        TI.ui.categoryDot(c),
        h('div', { class: 'item-main' },
          h('div', { class: 'item-title', text: e.Activity }),
          h('div', { class: 'item-meta' },
            h('span', { class: 'num', text: U.isoToLocalHHmm(e.StartTime) + '–' + U.isoToLocalHHmm(e.EndTime) }),
            h('span', { text: c ? c.Name : 'Kategori dihapus' }),
            e.Source === 'FOCUS' ? h('span', { class: 'badge', text: 'Fokus' }) : null,
            paused ? h('span', { text: 'dengan jeda' }) : null,
            e.SyncStatus === 'FAILED' ? h('span', { class: 'badge err', text: 'Ditolak server' }) : null)),
        h('span', { class: 'item-side', text: U.fmtMinutes(e.DurationMinutes) }));
    })) : h('div', { class: 'list', style: { marginTop: '10px' } }, TI.ui.emptyState('clock', 'Belum ada catatan waktu di hari ini.'));
    return h('div', null, nav, list);
  }

  var host = null;
  function rerender() { if (host) render(host); }

  function render(el) {
    host = el;
    clockEl = null;
    U.clear(el);
    var t = TI.timer.get();
    var top;
    if (t && t.kind === 'TRACK') top = activeCard(t);
    else if (t && t.kind === 'FOCUS') top = h('div', { class: 'banner info' }, TI.icon('timer'), h('div', { class: 'grow', text: 'Sesi fokus sedang berjalan. Timer pencatatan dapat dimulai setelah sesi selesai.' }),
      h('button', { type: 'button', class: 'btn sm', onclick: function () { TI.ui.showSection('focus'); } }, 'Buka'));
    else top = startForm();
    U.append(el, [
      top,
      h('button', { type: 'button', class: 'btn block', style: { marginTop: '12px' }, onclick: function () {
        var d = viewDate && viewDate !== U.today() ? { StartTime: U.localDateTimeToIso(viewDate, '09:00'), EndTime: U.localDateTimeToIso(viewDate, '10:00') } : null;
        TI.forms.timeEntry(null, d);
      } }, TI.icon('plus', 18), 'Tambah waktu manual'),
      dayList()
    ]);
  }

  TI.views.track = {
    deps: ['timeEntries', 'categories', 'tasks', 'goals'], render: render,
    onHide: function () { clockEl = null; }, finishTracking: finishTracking
  };
})();
