/**
 * Mytime — views/focus.js (Focus Mode)
 * Pilih task/aktivitas → durasi → fokus (pause/resume) → selesai → nilai fokus → simpan
 * sebagai FocusSession + TimeEntry (Source FOCUS) agar jam fokus tidak dihitung dua kali.
 * Catatan: Focus Mode tidak dapat memblokir aplikasi lain.
 */
(function () {
  'use strict';
  var TI = window.TI;
  var U = TI.util, h = U.h, C = TI.calc;
  var chosenMinutes = 25;
  var ringEls = null;
  var prompting = false;
  var autoPromptedFor = null;
  var RATINGS = [
    { value: 'FULL', label: 'Fully Focused', hint: 'Hampir tanpa gangguan' },
    { value: 'PARTIAL', label: 'Partially Focused', hint: 'Beberapa kali teralihkan' },
    { value: 'DISTRACTED', label: 'Frequently Distracted', hint: 'Sering teralihkan' }
  ];

  TI.bus.on('timer-tick', function (t) { if (ringEls && t && t.kind === 'FOCUS') updateRing(t); });
  TI.bus.on('timer', function () { if (TI.ui.current() === 'focus' && !prompting) TI.ui.loadSectionData('focus', {}, true); });

  function updateRing(t) {
    var total = t.plannedMinutes * 60;
    var el = TI.timer.elapsedMs(t) / 1000;
    var left = Math.max(0, total - el);
    ringEls.clock.textContent = U.fmtClock(left);
    ringEls.arc.setAttribute('stroke-dashoffset', String(ringEls.len * (1 - Math.min(1, el / total))));
  }

  function ring(t) {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 200 200');
    svg.setAttribute('aria-hidden', 'true');
    var r = 90, len = 2 * Math.PI * r;
    function circle(attrs) {
      var c = document.createElementNS(ns, 'circle');
      Object.keys(attrs).forEach(function (k) { c.setAttribute(k, attrs[k]); });
      svg.appendChild(c);
      return c;
    }
    circle({ cx: 100, cy: 100, r: r, fill: 'none', stroke: '#EEF2F7', 'stroke-width': 10 });
    var arc = circle({ cx: 100, cy: 100, r: r, fill: 'none', stroke: '#1E4FD8', 'stroke-width': 10, 'stroke-linecap': 'round', 'stroke-dasharray': len, 'stroke-dashoffset': len });
    var clock = h('div', { class: 'clock', role: 'timer' });
    ringEls = { arc: arc, clock: clock, len: len };
    var wrap = h('div', { class: 'ring-wrap' }, svg, h('div', { class: 'ring-center' }, clock,
      h('div', { class: 'small muted', text: TI.timer.isDone(t) ? 'Selesai' : (t.runningSince ? 'Sisa waktu' : 'Dijeda') })));
    updateRing(t);
    return wrap;
  }

  function notifyDone(t) {
    try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch (e) { /* abaikan */ }
    try {
      if (document.visibilityState !== 'visible' && window.Notification && Notification.permission === 'granted') {
        new Notification('Sesi fokus selesai', { body: t.activity, icon: 'icons/icon-192.png', tag: 'ti-focus' });
      }
    } catch (e) { /* beberapa browser tidak mendukung Notification di halaman */ }
  }

  /** Dialog akhir sesi: nilai fokus + catatan, lalu simpan. */
  function promptFinish() {
    var t = TI.timer.get();
    if (!t || t.kind !== 'FOCUS' || prompting) return;
    prompting = true;
    var reachedPlan = TI.timer.isDone(t);
    if (reachedPlan) autoPromptedFor = t.id;
    if (reachedPlan) notifyDone(t);
    var rating = '';
    var notes = TI.forms.textarea({ maxlength: '2000', placeholder: 'Opsional: apa yang membantu atau mengganggu?' });
    var opts = h('div', { class: 'rating-opts', role: 'group', 'aria-label': 'Kualitas fokus' }, RATINGS.map(function (r) {
      return h('button', { type: 'button', class: 'rating-opt', 'aria-pressed': 'false', onclick: function (e) {
        U.$all('.rating-opt', opts).forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
        e.currentTarget.setAttribute('aria-pressed', 'true');
        rating = r.value;
      } }, h('span', { class: 'grow' }, h('div', { text: r.label }), h('div', { class: 'xs muted', style: { fontWeight: 500 }, text: r.hint })));
    }));
    var minutesNow = Math.round(TI.timer.elapsedMs(t) / 60000);
    var s = TI.ui.sheet({
      title: reachedPlan ? 'Sesi fokus selesai' : 'Akhiri sesi fokus?',
      content: h('div', { class: 'stack' },
        h('p', { class: 'muted', text: t.activity + ' — ' + U.fmtMinutes(minutesNow, true) + (reachedPlan ? '' : ' dari ' + t.plannedMinutes + ' menit') }),
        h('div', { class: 'lbl small', style: { fontWeight: 600 }, text: 'Bagaimana fokusmu?' }), opts, notes),
      onClose: function () { prompting = false; TI.ui.loadSectionData('focus', {}, true); },
      actions: [
        !reachedPlan ? { label: 'Lanjutkan', onClick: function () { return true; } } : null,
        { label: 'Simpan sesi', kind: 'primary', onClick: function () { return save(rating, notes.value.trim()); } }
      ].filter(Boolean)
    });
    return s;
  }

  function save(rating, notes) {
    return TI.timer.stop().then(function (sum) {
      if (!sum) return;
      var t = sum.timer;
      if (sum.minutes < 1) { TI.ui.toast('Kurang dari 1 menit, tidak disimpan', 'info'); return; }
      var cat = TI.repo.get('categories', t.categoryId);
      var focusId = U.uuid(), entryId = U.uuid();
      var startIso = U.toIso(sum.startMs);
      var endIso = U.toIso(Math.max(sum.endMs, sum.startMs + 60000));
      var session = {
        FocusSessionID: focusId, TaskID: t.taskId || '', GoalID: t.goalId || '', CategoryID: t.categoryId || '', Activity: t.activity,
        StartTimestamp: startIso, EndTimestamp: endIso, PlannedMinutes: t.plannedMinutes, DurationMinutes: sum.minutes,
        Status: sum.minutes >= t.plannedMinutes ? 'COMPLETED' : 'ENDED_EARLY', FocusRating: rating, TimeEntryID: entryId, Notes: notes
      };
      var entry = {
        TimeEntryID: entryId, Date: U.localDate(sum.startMs), StartTime: startIso, EndTime: endIso, DurationMinutes: sum.minutes,
        Activity: t.activity, CategoryID: t.categoryId, GoalID: t.goalId || '', TaskID: t.taskId || '',
        ProductivityType: cat ? cat.Type : '', Source: 'FOCUS', FocusSessionID: focusId, Notes: ''
      };
      return TI.repo.save('focusSessions', session).then(function () { return TI.repo.save('timeEntries', entry); })
        .then(function () { TI.ui.toast('Sesi fokus disimpan: ' + U.fmtMinutes(sum.minutes, true)); });
    });
  }

  function idleView() {
    var F = TI.forms;
    var task = F.select(F.taskOptions(''), '');
    var activity = F.input({ type: 'text', placeholder: 'Atau tulis aktivitas', maxlength: '200', autocomplete: 'off' });
    var cat = F.select(F.categoryOptions(F.defaultCategoryId()), F.defaultCategoryId());
    var goal = F.select(F.goalOptions(''), '');
    task.addEventListener('change', function () {
      var t = TI.repo.get('tasks', task.value);
      if (!t) return;
      activity.value = t.Title;
      if (t.CategoryID) cat.value = t.CategoryID;
      if (t.GoalID) goal.value = t.GoalID;
    });
    var custom = F.input({ type: 'number', inputmode: 'numeric', min: '1', max: '600', placeholder: 'Menit', value: [25, 50, 90].indexOf(chosenMinutes) === -1 ? String(chosenMinutes) : '' });
    var customField = F.field('Durasi custom (menit)', custom);
    customField.classList.toggle('hidden', [25, 50, 90].indexOf(chosenMinutes) !== -1);
    var durs = h('div', { class: 'dur-grid', role: 'group', 'aria-label': 'Durasi fokus' },
      [25, 50, 90, 'custom'].map(function (m) {
        var isCustom = m === 'custom';
        var pressed = isCustom ? [25, 50, 90].indexOf(chosenMinutes) === -1 : chosenMinutes === m;
        return h('button', { type: 'button', class: 'dur-btn', 'aria-pressed': String(pressed), onclick: function (e) {
          U.$all('.dur-btn', durs).forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
          e.currentTarget.setAttribute('aria-pressed', 'true');
          customField.classList.toggle('hidden', !isCustom);
          if (isCustom) { custom.focus(); } else chosenMinutes = m;
        } }, isCustom ? 'Custom' : String(m), h('small', { text: isCustom ? 'menit' : 'menit' }));
      }));
    var form = h('form', { class: 'panel', novalidate: true },
      F.field('Task', task), F.field('Aktivitas', activity),
      h('div', { class: 'field-row' }, F.field('Kategori', cat), F.field('Goal', goal)),
      h('div', { class: 'field' }, h('span', { class: 'lbl', text: 'Durasi' }), durs), customField,
      h('button', { type: 'submit', class: 'btn primary block', style: { marginTop: '18px' } }, TI.icon('play', 18), 'Mulai fokus'));
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      F.clearErrors(form);
      var name = activity.value.trim();
      if (!name) { F.setError(activity, 'Pilih task atau tulis aktivitas.'); return; }
      if (!customField.classList.contains('hidden')) {
        var m = Number(custom.value);
        if (!isFinite(m) || m < 1 || m > 600 || Math.floor(m) !== m) { F.setError(custom, 'Isi 1–600 menit.'); return; }
        chosenMinutes = m;
      }
      if (window.Notification && Notification.permission === 'default') { try { Notification.requestPermission(); } catch (er) { /* abaikan */ } }
      TI.timer.start({ kind: 'FOCUS', activity: name, categoryId: cat.value, taskId: task.value, goalId: goal.value, plannedMinutes: chosenMinutes })
        .catch(function (er) {
          TI.ui.confirm('Timer lain sedang berjalan', 'Selesaikan timer pencatatan dulu sebelum mulai fokus.', { confirmText: 'Buka timer' })
            .then(function (ok) { if (ok) TI.ui.showSection('track'); });
          if (er.code !== 'TIMER_ACTIVE') console.error(er);
        });
    });
    return form;
  }

  function runningView(t) {
    var done = TI.timer.isDone(t);
    return h('div', { class: 'panel clock-card' },
      h('div', { class: 'clock-activity', style: { marginTop: 0 }, text: t.activity }),
      ring(t),
      h('div', { class: 'clock-actions' },
        done ? null : (t.runningSince
          ? h('button', { type: 'button', class: 'btn', onclick: function () { TI.timer.pause(); } }, TI.icon('pause', 18), 'Pause')
          : h('button', { type: 'button', class: 'btn', onclick: function () { TI.timer.resume(); } }, TI.icon('play', 18), 'Resume')),
        h('button', { type: 'button', class: 'btn primary', onclick: promptFinish }, TI.icon('check', 18), done ? 'Simpan sesi' : 'Selesaikan')),
      h('button', { type: 'button', class: 'link-btn', style: { color: 'var(--muted)' }, onclick: function () {
        TI.ui.confirm('Batalkan sesi fokus?', 'Waktu sesi ini tidak akan disimpan.', { danger: true, confirmText: 'Batalkan sesi' })
          .then(function (ok) { if (ok) TI.timer.stop(); });
      } }, 'Batalkan sesi'));
  }

  function history() {
    var today = U.today();
    var ws = U.startOfWeek(today, Number(TI.repo.setting('weekStartsOn', '1')));
    var sessions = TI.repo.list('focusSessions');
    var td = C.focusSummary(sessions, today, today);
    var wk = C.focusSummary(sessions, ws, today);
    var recent = sessions.filter(function (s) { return U.localDate(Date.parse(s.StartTimestamp)) >= ws; })
      .sort(function (a, b) { return String(b.StartTimestamp).localeCompare(String(a.StartTimestamp)); }).slice(0, 10);
    var label = {}; RATINGS.forEach(function (r) { label[r.value] = r.label; });
    return h('div', null,
      TI.ui.blockTitle('Fokus minggu ini'),
      h('div', { class: 'stat-grid' },
        stat(U.fmtMinutes(td.minutes), 'Hari ini'),
        stat(U.fmtMinutes(wk.minutes), 'Minggu ini'),
        stat(String(wk.sessions), 'Sesi'),
        stat(wk.quality === null ? '–' : wk.quality + '/100', 'Kualitas fokus')),
      recent.length ? h('div', { class: 'list', style: { marginTop: '12px' } }, recent.map(function (s) {
        return h('div', { class: 'item' }, h('div', { class: 'item-main' },
          h('div', { class: 'item-title', text: s.Activity }),
          h('div', { class: 'item-meta' }, h('span', { text: U.relativeDay(U.localDate(Date.parse(s.StartTimestamp)), today) + ' ' + U.isoToLocalHHmm(s.StartTimestamp) }),
            s.FocusRating ? h('span', { text: label[s.FocusRating] }) : null,
            s.Status === 'ENDED_EARLY' ? h('span', { text: 'diakhiri lebih awal' }) : null)),
          h('span', { class: 'item-side', text: U.fmtMinutes(s.DurationMinutes) }));
      })) : null);
  }
  function stat(v, k) { return h('div', { class: 'stat' }, h('div', { class: 'v', text: v }), h('div', { class: 'k', text: k })); }

  function render(el) {
    ringEls = null;
    U.clear(el);
    var t = TI.timer.get();
    var main;
    if (t && t.kind === 'FOCUS') main = runningView(t);
    else if (t) main = h('div', { class: 'banner info' }, TI.icon('clock'), h('div', { class: 'grow', text: 'Timer pencatatan "' + t.activity + '" sedang berjalan. Selesaikan dulu untuk memulai sesi fokus.' }),
      h('button', { type: 'button', class: 'btn sm', onclick: function () { TI.ui.showSection('track'); } }, 'Buka'));
    else main = idleView();
    U.append(el, [main,
      h('p', { class: 'xs muted', style: { marginTop: '10px' }, text: 'Focus Mode mencatat waktu fokusmu, tetapi tidak memblokir aplikasi atau notifikasi lain. Aktifkan mode Jangan Ganggu di perangkat bila perlu.' }),
      history()]);
    if (t && t.kind === 'FOCUS' && TI.timer.isDone(t) && autoPromptedFor !== t.id) {
      autoPromptedFor = t.id;
      setTimeout(promptFinish, 50);
    }
  }

  TI.views.focus = { deps: ['focusSessions', 'tasks', 'categories', 'goals'], render: render, promptFinish: promptFinish,
    onHide: function () { ringEls = null; },
    onData: function () { return !TI.timer.get(); } };
})();
