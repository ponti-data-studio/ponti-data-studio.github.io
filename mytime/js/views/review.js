/**
 * Mytime — views/review.js (Daily & Weekly Review)
 * Ringkasan dari data aktual, tanpa perbandingan palsu bila minggu sebelumnya tidak punya data.
 */
(function () {
  'use strict';
  var TI = window.TI;
  var U = TI.util, h = U.h, C = TI.calc;
  var tab = 'weekly';
  var dayCursor = null;
  var weekCursor = null;
  var dirty = false;

  function wso() { return Number(TI.repo.setting('weekStartsOn', '1')); }
  function metricRow(label, value) {
    return h('li', null, h('span', { class: 'label', text: label }), h('span', { class: 'val', text: value }));
  }

  function textField(label, value, placeholder) {
    var t = TI.forms.textarea({ value: value || '', maxlength: '3000', placeholder: placeholder || '' });
    t.addEventListener('input', function () { dirty = true; });
    return { el: TI.forms.field(label, t), input: t };
  }

  // ---------------------------------------------------------------- harian
  function daily(el) {
    var today = U.today();
    dayCursor = dayCursor || today;
    var data = TI.repo.snapshot();
    var s = C.daySummary(data, dayCursor);
    var b = s.buckets;
    var snap = data.dailySnapshots.filter(function (x) { return x.Date === dayCursor; })[0] || null;

    var nav = h('div', { class: 'row between', style: { marginTop: '12px' } },
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Hari sebelumnya', onclick: function () { dayCursor = U.addDays(dayCursor, -1); dirty = false; render(el); } }, TI.icon('chevron-left')),
      h('h2', { text: dayCursor === today ? 'Hari ini' : U.fmtDateLong(dayCursor) }),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Hari berikutnya', disabled: dayCursor >= today, onclick: function () { dayCursor = U.addDays(dayCursor, 1); dirty = false; render(el); } }, TI.icon('chevron-right')));

    var summaryText;
    if (b.total === 0 && !s.completedTasks.length) summaryText = 'Belum ada aktivitas atau task selesai yang tercatat untuk hari ini. Mencatat sedikit saja sudah cukup untuk mulai melihat pola.';
    else {
      var parts = ['Tercatat ' + U.fmtMinutes(b.total, true) + ' waktu'];
      if (s.ratio) parts.push(s.ratio.ratio + '% waktu aktif untuk membangun masa depan');
      summaryText = parts.join(', ') + '. ' + (s.completedTasks.length ? s.completedTasks.length + ' task selesai. ' : '') +
        (s.pendingTasks.length ? s.pendingTasks.length + ' task masih terbuka — pilih satu yang paling penting untuk besok.' : 'Tidak ada task yang tertunda.') +
        (b.recovery > 0 ? ' Waktu pemulihan ' + U.fmtMinutes(b.recovery, true) + ' juga bagian dari produktivitas.' : '');
    }

    var best = textField('Apa satu hal terbaik yang kamu lakukan hari ini?', snap && snap.BestThing);
    var improve = textField('Apa satu hal yang bisa kamu perbaiki besok?', snap && snap.ImproveTomorrow);
    var save = h('button', { type: 'button', class: 'btn primary block', style: { marginTop: '14px' } }, 'Simpan review harian');
    save.addEventListener('click', function () {
      var stats = { total: b.total, productive: b.productive, learning: b.learning, careerBusiness: b.careerBusiness, health: b.health, spiritual: b.spiritual,
        relationship: b.relationship, recovery: b.recovery, leisure: b.leisure, distraction: b.distraction, completed: s.completedTasks.length, pending: s.pendingTasks.length,
        ratio: s.ratio ? s.ratio.ratio : null };
      var rec = Object.assign({}, snap || {}, { Date: dayCursor, BestThing: best.input.value.trim(), ImproveTomorrow: improve.input.value.trim(), StatsJSON: JSON.stringify(stats) });
      save.disabled = true;
      TI.repo.save('dailySnapshots', rec).then(function () { dirty = false; TI.ui.toast('Review harian disimpan'); }, TI.ui.alertError).then(function () { save.disabled = false; });
    });

    function taskList(list, emptyText) {
      if (!list.length) return h('p', { class: 'small muted', text: emptyText });
      return h('div', { class: 'list' }, list.map(function (t) {
        return h('div', { class: 'item tap', onclick: function () { TI.forms.task(t); } }, h('div', { class: 'item-main' }, h('div', { class: 'item-title' + (t.Status === 'COMPLETED' ? ' done' : ''), text: t.Title }),
          t.DueDate && t.Status !== 'COMPLETED' ? h('div', { class: 'item-meta', text: 'Tenggat ' + U.fmtDateShort(t.DueDate) }) : null));
      }));
    }

    U.append(el, [
      nav,
      h('div', { class: 'insight', style: { marginTop: '8px' } }, TI.icon('info'), h('p', { text: summaryText })),
      h('div', { class: 'panel', style: { marginTop: '12px' } }, h('ul', { class: 'metric-list' }, [
        metricRow('Total waktu tercatat', U.fmtMinutes(b.total)),
        metricRow('Task selesai', String(s.completedTasks.length)),
        metricRow('Task belum selesai', String(s.pendingTasks.length)),
        metricRow('Belajar', U.fmtMinutes(b.learning)),
        metricRow('Bisnis & karier', U.fmtMinutes(b.careerBusiness)),
        metricRow('Kesehatan', U.fmtMinutes(b.health)),
        metricRow('Spiritual', U.fmtMinutes(b.spiritual)),
        metricRow('Hubungan sosial', U.fmtMinutes(b.relationship)),
        metricRow('Pemulihan', U.fmtMinutes(b.recovery)),
        metricRow('Hiburan', U.fmtMinutes(b.leisure)),
        metricRow('Distraksi', U.fmtMinutes(b.distraction))
      ])),
      TI.ui.blockTitle('Task selesai'), taskList(s.completedTasks, 'Belum ada task yang diselesaikan di hari ini.'),
      TI.ui.blockTitle('Task belum selesai'), taskList(s.pendingTasks, 'Tidak ada task tertunda.'),
      TI.ui.blockTitle('Refleksi'),
      h('div', { class: 'panel' }, best.el, improve.el, save),
      h('button', { type: 'button', class: 'btn block', style: { marginTop: '12px' }, onclick: function () { TI.ui.showSection('journal', { date: dayCursor }); } }, TI.icon('book-open', 18), 'Tulis jurnal lengkap')
    ]);
  }

  // ---------------------------------------------------------------- mingguan
  function weekly(el, params) {
    var today = U.today();
    var current = U.startOfWeek(today, wso());
    if (params && params.week && /^\d{4}-\d{2}-\d{2}$/.test(params.week)) { weekCursor = U.startOfWeek(params.week, wso()); params.week = null; }
    weekCursor = weekCursor || current;
    var data = TI.repo.snapshot();
    var cur = C.weekSummary(data, weekCursor, { today: today, weekStartsOn: wso() });
    var prevStart = U.addDays(weekCursor, -7);
    var prev = C.weekSummary(data, prevStart, { weekStartsOn: wso() });
    var cats = C.categoryMap(data.categories);
    var snap = data.weeklySnapshots.filter(function (x) { return x.WeekStart === weekCursor; })[0] || null;
    var b = cur.buckets;

    var nav = h('div', { class: 'row between', style: { marginTop: '12px' } },
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Minggu sebelumnya', onclick: function () { weekCursor = U.addDays(weekCursor, -7); dirty = false; render(el); } }, TI.icon('chevron-left')),
      h('div', { style: { textAlign: 'center' } }, h('h2', { text: weekCursor === current ? 'Minggu ini' : 'Minggu ' + U.fmtDateShort(weekCursor) }),
        h('div', { class: 'small muted', text: U.fmtDateShort(weekCursor) + ' – ' + U.fmtDateShort(cur.weekEnd) })),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Minggu berikutnya', disabled: weekCursor >= current, onclick: function () { weekCursor = U.addDays(weekCursor, 7); dirty = false; render(el); } }, TI.icon('chevron-right')));

    var dist = Object.keys(cur.agg.byCategory).map(function (id) { return { cat: cats[id], m: cur.agg.byCategory[id] }; })
      .filter(function (x) { return x.m > 0; }).sort(function (a, c) { return c.m - a.m; });
    var maxM = dist.length ? dist[0].m : 1;

    var insights = C.weeklyInsights(cur, prev);
    var hasPrev = prev.hasData;
    function cmpRow(label, a, p, fmt, lowerIsBetter) {
      var ch = hasPrev ? C.pctChange(a, p) : null;
      var txt = !hasPrev ? '' : ch === null ? (a > 0 ? 'baru' : '–') : (ch > 0 ? '+' : '') + ch + '%';
      var tone = ch === null || ch === 0 ? '' : ((ch > 0) !== !!lowerIsBetter ? 'ok' : 'warn');
      return h('div', { class: 'item' }, h('div', { class: 'item-main' }, h('div', { class: 'item-title', text: label }),
        h('div', { class: 'item-meta num' }, h('span', { text: 'Minggu ini ' + fmt(a) }), hasPrev ? h('span', { text: 'Minggu lalu ' + fmt(p) }) : null)),
        txt ? h('span', { class: 'badge ' + tone, text: txt }) : null);
    }
    var mins = function (m) { return U.fmtMinutes(m); };
    var compare = hasPrev ? h('div', { class: 'list' }, [
      cmpRow('Total tercatat', b.total, prev.buckets.total, mins),
      cmpRow('Bisnis & karier', b.careerBusiness, prev.buckets.careerBusiness, mins),
      cmpRow('Belajar', b.learning, prev.buckets.learning, mins),
      cmpRow('Kesehatan', b.health, prev.buckets.health, mins),
      cmpRow('Fokus', cur.focus.minutes, prev.focus.minutes, mins),
      cmpRow('Distraksi', b.distraction, prev.buckets.distraction, mins, true),
      cmpRow('Task selesai', cur.completedCount, prev.completedCount, function (v) { return String(v); })
    ]) : h('p', { class: 'small muted', text: 'Belum ada data minggu sebelumnya, jadi perbandingan belum ditampilkan.' });

    var goalRows = cur.goals.map(function (x) {
      var g = TI.repo.get('goals', x.goalId);
      if (!g) return null;
      return h('div', { class: 'item tap', onclick: function () { TI.views.goals.openDetail(g.GoalID); } }, h('div', { class: 'item-main' }, h('div', { class: 'item-title', text: g.Name }),
        h('div', { class: 'item-meta' }, h('span', { text: U.fmtMinutes(x.minutes) + ' minggu ini' }), h('span', { text: 'Progres ' + (Number(g.Progress) || 0) + '%' }))));
    }).filter(Boolean);

    var f1 = textField('What went well?', snap && snap.WentWell, 'Apa yang berjalan baik minggu ini?');
    var f2 = textField('What needs improvement?', snap && snap.NeedsImprovement, 'Apa yang perlu diperbaiki?');
    var f3 = textField('What should I prioritize next week?', snap && snap.NextWeekPriorities, 'Prioritas minggu depan');
    var save = h('button', { type: 'button', class: 'btn primary block', style: { marginTop: '14px' } }, 'Simpan review mingguan');
    save.addEventListener('click', function () {
      var stats = { total: b.total, futureBuilding: b.futureBuilding, distraction: b.distraction, focus: cur.focus.minutes, completed: cur.completedCount,
        completionRate: cur.completionRate, habitRate: cur.habits.rate, ratio: cur.ratio ? cur.ratio.ratio : null,
        byCategory: dist.map(function (x) { return { code: x.cat ? x.cat.Code : '', minutes: x.m }; }) };
      var rec = Object.assign({}, snap || {}, { WeekStart: weekCursor, WentWell: f1.input.value.trim(), NeedsImprovement: f2.input.value.trim(), NextWeekPriorities: f3.input.value.trim(), StatsJSON: JSON.stringify(stats) });
      save.disabled = true;
      TI.repo.save('weeklySnapshots', rec).then(function () { dirty = false; TI.ui.toast('Review mingguan disimpan'); }, TI.ui.alertError).then(function () { save.disabled = false; });
    });

    function stat(v, k) { return h('div', { class: 'stat' }, h('div', { class: 'v', text: v }), h('div', { class: 'k', text: k })); }
    U.append(el, [
      nav,
      insights.length ? h('div', { class: 'insight', style: { marginTop: '8px' } }, TI.icon('info'), h('div', null, insights.map(function (t) { return h('p', { text: t }); }))) : null,
      h('div', { class: 'stat-grid', style: { marginTop: '12px' } },
        stat(U.fmtMinutes(b.total), 'Total tercatat'),
        stat(String(cur.completedCount), 'Task selesai'),
        stat(cur.completionRate === null ? '–' : cur.completionRate + '%', 'Penyelesaian task'),
        stat(cur.habits.rate === null ? '–' : cur.habits.rate + '%', 'Habit completion'),
        stat(U.fmtHours(cur.focus.minutes) + ' j', 'Focus hours'),
        stat(U.fmtHours(b.distraction) + ' j', 'Distraction hours'),
        stat(cur.ratio ? cur.ratio.ratio + '%' : '–', 'Investment ratio'),
        stat(String(cur.goals.length), 'Goal berkembang')),
      TI.ui.blockTitle('Distribusi waktu per kategori'),
      dist.length ? h('div', { class: 'panel bar-rows' }, dist.map(function (x) {
        return h('div', { class: 'br' }, h('span', { class: 'name', text: x.cat ? x.cat.Name : 'Lainnya' }), TI.ui.progressBar(x.m / maxM * 100, { color: x.cat ? x.cat.Color : '#94A3B8' }), h('span', { class: 'v', text: U.fmtMinutes(x.m) }));
      })) : h('p', { class: 'small muted', text: 'Belum ada waktu tercatat minggu ini.' }),
      TI.ui.blockTitle('Goal yang berkembang'),
      goalRows.length ? h('div', { class: 'list' }, goalRows) : h('p', { class: 'small muted', text: 'Belum ada waktu yang dikaitkan ke goal minggu ini.' }),
      TI.ui.blockTitle('Dibandingkan minggu lalu'), compare,
      TI.ui.blockTitle('Refleksi mingguan'),
      h('div', { class: 'panel' }, f1.el, f2.el, f3.el, save)
    ]);
  }

  function render(el, params) {
    params = params || {};
    // Parameter URL hanya dipakai sekali (render ulang karena data tidak mengubah tab yang dipilih).
    if (params.tab === 'daily' || params.tab === 'weekly') { tab = params.tab; params.tab = null; }
    if (params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date)) { dayCursor = params.date; params.date = null; }
    U.clear(el);
    dirty = false;
    el.appendChild(TI.ui.segmented([{ value: 'daily', label: 'Daily Review' }, { value: 'weekly', label: 'Weekly Review' }], tab, function (v) {
      tab = v; render(el, {});
    }));
    if (tab === 'daily') daily(el); else weekly(el, params);
  }

  TI.views.review = {
    deps: null, render: render,
    onData: function () { return dirty ? false : undefined; }
  };
})();
