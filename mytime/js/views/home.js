/**
 * Mytime — views/home.js (Dashboard)
 * Semua angka berasal dari data lokal aktual (calc.js). Tidak ada angka contoh.
 */
(function () {
  'use strict';
  var TI = window.TI;
  var U = TI.util, h = U.h, C = TI.calc;

  function weekStartsOn() { return Number(TI.repo.setting('weekStartsOn', '1')); }

  function dayStrip(data, today) {
    var start = U.dayStartMs(today), end = U.dayEndMs(today);
    var dayLen = end - start;
    var cats = C.categoryMap(data.categories);
    var segs = C.segmentEntries(data.timeEntries, start, end);
    var bar = h('div', { class: 'daystrip-bar', role: 'img', 'aria-label': 'Garis waktu hari ini dari 00:00 sampai 24:00' });
    segs.forEach(function (s) {
      var c = cats[s.entry.CategoryID];
      bar.appendChild(h('div', {
        class: 'daystrip-seg', title: s.entry.Activity + ' (' + U.isoToLocalHHmm(U.toIso(s.start)) + '–' + U.isoToLocalHHmm(U.toIso(s.end)) + ')',
        style: { left: ((s.start - start) / dayLen * 100) + '%', width: ((s.end - s.start) / dayLen * 100) + '%', background: c ? c.Color : '#94A3B8' }
      }));
    });
    var nowPct = (Date.now() - start) / dayLen * 100;
    if (nowPct >= 0 && nowPct <= 100) bar.appendChild(h('div', { class: 'daystrip-now', style: { left: 'calc(' + nowPct + '% - 1px)' }, title: 'Sekarang' }));
    return h('div', { class: 'daystrip' }, bar,
      h('div', { class: 'daystrip-ticks', 'aria-hidden': 'true' }, ['00', '06', '12', '18', '24'].map(function (t) { return h('span', { text: t }); })));
  }

  function legend(agg, data) {
    var cats = C.categoryMap(data.categories);
    var rows = Object.keys(agg.byCategory).map(function (id) { return { cat: cats[id], m: agg.byCategory[id] }; })
      .filter(function (r) { return r.m > 0; }).sort(function (a, b) { return b.m - a.m; }).slice(0, 6);
    if (!rows.length) return null;
    return h('div', { class: 'ledger-legend' }, rows.map(function (r) {
      return h('span', { class: 'legend-item' }, TI.ui.categoryDot(r.cat), h('span', { text: (r.cat ? r.cat.Name : 'Lainnya') + ' ' }), h('b', { class: 'num', text: U.fmtMinutes(r.m) }));
    }));
  }

  function scoreRing(score) {
    var r = 36, c = 2 * Math.PI * r;
    var pct = score === null ? 0 : score / 100;
    var color = score === null ? '#CBD5E1' : score >= 70 ? '#15803D' : score >= 50 ? '#1E4FD8' : '#C2410C';
    var svgNS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 84 84');
    svg.setAttribute('aria-hidden', 'true');
    var bg = document.createElementNS(svgNS, 'circle');
    [['cx', 42], ['cy', 42], ['r', r], ['fill', 'none'], ['stroke', '#EEF2F7'], ['stroke-width', 8]].forEach(function (a) { bg.setAttribute(a[0], a[1]); });
    var fg = document.createElementNS(svgNS, 'circle');
    [['cx', 42], ['cy', 42], ['r', r], ['fill', 'none'], ['stroke', color], ['stroke-width', 8], ['stroke-linecap', 'round'],
      ['stroke-dasharray', c], ['stroke-dashoffset', c * (1 - pct)]].forEach(function (a) { fg.setAttribute(a[0], a[1]); });
    svg.appendChild(bg); svg.appendChild(fg);
    return h('div', { class: 'score-ring' }, svg,
      h('div', { class: 'val' }, h('div', null, score === null ? '–' : String(score), h('small', { text: score === null ? '' : '/100' }))));
  }

  function openScoreDetail(res) {
    TI.ui.sheet({ title: 'Future Self Score', content: h('div', { class: 'stack' },
      h('p', { class: 'muted small', text: 'Skor menunjukkan seberapa konsisten aktivitasmu 7 hari terakhir mendukung tujuan jangka panjang. Ini indikator internal aplikasi — bukan ukuran nilai diri, bukan penilaian ilmiah, dan bukan jaminan hasil.' }),
      res.available ? null : h('div', { class: 'banner info' }, TI.icon('info'), h('div', { class: 'grow', text: res.message + ' Skor muncul setelah minimal 3 hari berdata dan 2 komponen tersedia.' })),
      h('div', { class: 'list' }, res.components.map(function (c) {
        return h('div', { class: 'item' }, h('div', { class: 'item-main' },
          h('div', { class: 'row between' }, h('span', { class: 'item-title', text: c.label }), h('span', { class: 'item-side', text: c.value === null ? 'Belum tersedia' : c.value + '/100' })),
          c.value !== null ? h('div', { style: { margin: '6px 0 4px' } }, TI.ui.progressBar(c.value)) : null,
          h('div', { class: 'item-meta' }, h('span', { text: 'Bobot ' + c.weight + '%. ' + c.detail }))));
      })),
      h('p', { class: 'muted xs', text: 'Pemulihan, spiritual, dan hubungan tetap ditampilkan di progres harian sebagai indikator penting. Bobot dapat diubah di Settings.' })) });
  }

  function habitQuickSheet() {
    var today = U.today();
    var habits = TI.repo.list('habits').filter(function (x) { return x.Active; });
    if (!habits.length) {
      TI.ui.confirm('Belum ada habit', 'Buat habit pertama sekarang?', { confirmText: 'Buat habit' }).then(function (ok) { if (ok) TI.forms.habit(); });
      return;
    }
    var s = TI.ui.sheet({ title: 'Habit hari ini', content: function () { return renderList(); } });
    function renderList() {
      var logs = TI.repo.list('habitLogs');
      return h('div', { class: 'list' }, habits.map(function (hb) {
        var done = C.habitDoneDates(hb.HabitID, logs)[today];
        return h('div', { class: 'item' },
          h('button', { type: 'button', class: 'check' + (done ? ' on' : ''), 'aria-pressed': String(!!done), 'aria-label': (done ? 'Batalkan ' : 'Tandai selesai ') + hb.Name,
            onclick: function () { TI.habitActions.toggle(hb, today).then(function () { U.clear(s.body).appendChild(renderList()); }); } },
          h('span', { class: 'box' }, TI.icon('check', 16))),
          h('div', { class: 'item-main' }, h('div', { class: 'item-title', text: hb.Name })));
      }));
    }
  }

  function render(el) {
    var data = TI.repo.snapshot();
    var today = U.today();
    var ws = weekStartsOn();
    var day = C.daySummary(data, today);
    var b = day.buckets;
    var agg = C.aggregate(data, today, today);
    var score = C.futureSelfScore(data, today, { weights: TI.repo.setting('scoreWeights', ''), weekStartsOn: ws });
    var ratio = day.ratio;

    U.clear(el);
    var greet = h('div', { class: 'greet' }, h('h1', { text: U.greeting() }), h('p', { text: U.fmtDateLong(today) }));

    var ledger = h('div', { class: 'panel ledger' },
      h('div', { class: 'ledger-top' },
        h('div', null,
          h('div', { class: 'small muted', text: 'Waktu tercatat hari ini' }),
          h('div', { class: 'ledger-total' }, String(Math.floor(b.total / 60)), h('small', { text: 'j' }), ' ', String(b.total % 60), h('small', { text: 'm' }))),
        h('div', { style: { textAlign: 'right' } },
          h('div', { class: 'small muted', text: 'Rasio investasi' }),
          h('div', { style: { fontSize: '22px', fontWeight: 700 }, class: 'num', text: ratio ? ratio.ratio + '%' : '–' }))),
      h('div', { class: 'ledger-cap', text: ratio
        ? U.fmtMinutes(ratio.futureMinutes, true) + ' untuk membangun masa depan dari ' + U.fmtMinutes(ratio.activeMinutes, true) + ' waktu aktif (estimasi dari waktu tercatat).'
        : 'Catat aktivitasmu untuk melihat ke mana waktu hari ini diinvestasikan.' }),
      dayStrip(data, today),
      legend(agg, data));

    var scorePanel = h('div', { class: 'panel' },
      h('div', { class: 'score-row' }, scoreRing(score.available ? score.score : null),
        h('div', { class: 'score-copy grow' },
          h('div', { class: 'small muted', text: 'Future Self Score' }),
          h('h3', { text: score.available ? score.label : 'Belum cukup data' }),
          h('p', { class: 'small muted', text: score.available ? 'Konsistensi 7 hari terakhir terhadap tujuan jangka panjangmu.' : 'Skor dihitung setelah ada data minimal 3 hari. Untuk saat ini skor belum akurat.' }),
          h('button', { type: 'button', class: 'link-btn', style: { minHeight: '36px', padding: '6px 0 0' }, onclick: function () { openScoreDetail(score); } }, 'Lihat rincian'))));

    var insight = h('div', { class: 'insight' }, TI.icon('info'), h('p', { text: C.dailyInsight(day) }));

    var quick = h('div', { class: 'quick' }, [
      { label: 'Start Focus', icon: 'timer', fn: function () { TI.ui.showSection('focus'); } },
      { label: 'Add Task', icon: 'plus', fn: function () { TI.forms.task(); } },
      { label: 'Add Time Entry', icon: 'clock', fn: function () { TI.forms.timeEntry(); } },
      { label: 'Complete Habit', icon: 'circle-check', fn: habitQuickSheet },
      { label: 'Daily Review', icon: 'clipboard-check', fn: function () { TI.ui.showSection('review', { tab: 'daily' }); } }
    ].map(function (q) { return h('button', { type: 'button', class: 'quick-btn', onclick: q.fn }, TI.icon(q.icon, 22), h('span', { text: q.label })); }));

    // Most important tasks
    var mits = C.mostImportantTasks(data.tasks, today, 3);
    var mitBox = mits.length ? h('div', { class: 'list' }, mits.map(function (t) {
      var overdue = t.DueDate && t.DueDate < today;
      return h('div', { class: 'item' },
        h('button', { type: 'button', class: 'check', 'aria-label': 'Tandai selesai: ' + t.Title, onclick: function () { TI.forms.setTaskDone(t, true); } }, h('span', { class: 'box' }, TI.icon('check', 16))),
        h('div', { class: 'item-main tap', style: { cursor: 'pointer' }, onclick: function () { TI.forms.task(t); } },
          h('div', { class: 'item-title', text: t.Title }),
          h('div', { class: 'item-meta' },
            t.DueDate ? h('span', { class: overdue ? 'warn' : '', text: overdue ? 'Lewat tenggat ' + U.fmtDateShort(t.DueDate) : U.relativeDay(t.DueDate, today) }) : null,
            h('span', { class: 'badge p-' + t.Priority, text: TI.forms.PRIORITY_LABEL[t.Priority] }),
            t.EstimatedMinutes ? h('span', { text: '±' + U.fmtMinutes(t.EstimatedMinutes) }) : null)));
    })) : h('div', { class: 'list' }, TI.ui.emptyState('list-checks', 'Belum ada task terbuka. Tentukan satu hal penting untuk hari ini.', { label: 'Tambah task', onClick: function () { TI.forms.task(null, { DueDate: today, Starred: true }); } }));

    // Progres hari ini
    var rows = [
      ['Total waktu tercatat', b.total, null],
      ['Waktu produktif', b.productive, '#1E4FD8'],
      ['Belajar', b.learning, '#7C3AED'],
      ['Bisnis & karier', b.careerBusiness, '#0EA5E9'],
      ['Olahraga & kesehatan', b.health, '#16A34A'],
      ['Spiritual', b.spiritual, '#0D9488'],
      ['Hubungan & keluarga', b.relationship, '#DB2777'],
      ['Pemulihan', b.recovery, '#14B8A6'],
      ['Hiburan', b.leisure, '#F59E0B'],
      ['Distraksi', b.distraction, '#EF4444']
    ];
    var progress = h('div', { class: 'panel' }, h('ul', { class: 'metric-list' }, rows.map(function (r) {
      return h('li', null, r[2] ? h('span', { class: 'dot', style: { background: r[2] } }) : TI.icon('clock', 14),
        h('span', { class: 'label', text: r[0] }), h('span', { class: 'val', text: U.fmtMinutes(r[1]) }));
    })));

    // Active goals
    var goals = C.activeGoals(data.goals).slice(0, 3);
    var goalBox = goals.length ? h('div', { class: 'list' }, goals.map(function (g) {
      var st = C.goalStats(g, data, today);
      return h('div', { class: 'item tap', onclick: function () { TI.views.goals.openDetail(g.GoalID); } },
        h('div', { class: 'item-main' },
          h('div', { class: 'row between' }, h('span', { class: 'item-title', text: g.Name }), h('span', { class: 'item-side', text: st.progress + '%' })),
          h('div', { style: { margin: '8px 0 6px' } }, TI.ui.progressBar(st.progress, { marker: st.expectedProgress, label: 'Progres ' + g.Name })),
          h('div', { class: 'item-meta' }, h('span', { text: U.fmtMinutes(st.investedMinutes) + ' diinvestasikan' }),
            st.daysLeft !== null ? h('span', { text: st.daysLeft >= 0 ? st.daysLeft + ' hari lagi' : 'Target terlewati' }) : null)));
    })) : h('div', { class: 'list' }, TI.ui.emptyState('target', 'Goal memberi arah pada waktumu. Mulai dengan satu tujuan.', { label: 'Buat goal', onClick: function () { TI.forms.goal(); } }));

    U.append(el, [
      greet, ledger,
      h('div', { style: { marginTop: '12px' } }, scorePanel),
      h('div', { style: { marginTop: '12px' } }, insight),
      TI.ui.blockTitle('Quick actions'), quick,
      h('div', { class: 'home-cols' },
        h('div', null,
          TI.ui.blockTitle("Today's most important tasks", { label: 'Semua task', onClick: function () { TI.ui.showSection('tasks'); } }), mitBox,
          TI.ui.blockTitle('Active goals', { label: 'Semua goal', onClick: function () { TI.ui.showSection('goals'); } }), goalBox),
        h('div', null,
          TI.ui.blockTitle("Today's progress", { label: 'Analytics', onClick: function () { TI.ui.showSection('analytics'); } }), progress))
    ]);
  }

  TI.views.home = { render: render, deps: null, habitQuickSheet: habitQuickSheet };
  TI.renderDashboard = function () { TI.ui.loadSectionData('home', {}, true); };
})();
