/**
 * Mytime — views/analytics.js
 * Filter rentang, grafik (Chart.js, dimuat saat dibutuhkan), Future Self Score, Time Investment Ratio,
 * analisis distraksi, simulator waktu masa depan, dan riwayat review.
 */
(function () {
  'use strict';
  var TI = window.TI;
  var U = TI.util, h = U.h, C = TI.calc;
  var range = 'week';
  var custom = { from: null, to: null };
  var charts = [];
  var sim = { learning: 60, business: 0, career: 0, health: 30, other: 0 };
  var reduceMinutes = 20;

  var RANGES = [
    { value: 'today', label: 'Today' }, { value: 'week', label: 'This Week' }, { value: 'month', label: 'This Month' },
    { value: 'last30', label: 'Last 30 Days' }, { value: 'year', label: 'This Year' }, { value: 'custom', label: 'Custom' }
  ];

  function wso() { return Number(TI.repo.setting('weekStartsOn', '1')); }

  function resolveRange(today) {
    switch (range) {
      case 'today': return { from: today, to: today };
      case 'month': return { from: U.startOfMonth(today), to: today };
      case 'last30': return { from: U.addDays(today, -29), to: today };
      case 'year': return { from: U.startOfYear(today), to: today };
      case 'custom':
        if (custom.from && custom.to && custom.from <= custom.to) return { from: custom.from, to: custom.to };
        return { from: U.addDays(today, -6), to: today };
      default: return { from: U.startOfWeek(today, wso()), to: today };
    }
  }

  function makeBuckets(from, to) {
    var days = U.diffDays(from, to) + 1;
    var out = [];
    if (days <= 31) {
      U.dateRange(from, to).forEach(function (d) { out.push({ from: d, to: d, label: days <= 7 ? new Intl.DateTimeFormat('id-ID', { weekday: 'short' }).format(U.parseLocalDate(d)) : String(Number(d.slice(8))) }); });
    } else if (days <= 120) {
      for (var w = U.startOfWeek(from, wso()); w <= to; w = U.addDays(w, 7)) {
        var bf = w < from ? from : w, bt = U.addDays(w, 6) > to ? to : U.addDays(w, 6);
        out.push({ from: bf, to: bt, label: U.fmtDateShort(bf) });
      }
    } else {
      for (var m = U.startOfMonth(from); m <= to; m = U.startOfMonth(U.addDays(m, 32))) {
        var mEnd = U.addDays(U.startOfMonth(U.addDays(m, 32)), -1);
        out.push({ from: m < from ? from : m, to: mEnd > to ? to : mEnd, label: new Intl.DateTimeFormat('id-ID', { month: 'short' }).format(U.parseLocalDate(m)) });
      }
    }
    return out;
  }

  function sumDays(agg, b, key) {
    var s = 0;
    U.dateRange(b.from, b.to).forEach(function (d) { if (agg.byDay[d]) s += agg.byDay[d][key]; });
    return s;
  }

  function destroyCharts() { charts.forEach(function (c) { try { c.destroy(); } catch (e) { /* abaikan */ } }); charts = []; }

  function chartPanel(title, summary, build, tall) {
    var canvas = h('canvas', { role: 'img', 'aria-label': title + '. ' + summary });
    var box = h('div', { class: 'chart-box' + (tall ? ' tall' : '') }, canvas);
    var panel = h('div', { class: 'panel', style: { marginTop: '12px' } },
      h('div', { class: 'panel-head' }, h('h2', { text: title })), box, h('p', { class: 'xs muted', style: { marginTop: '8px' }, text: summary }));
    TI.ui.loadChart().then(function (Chart) {
      if (!document.body.contains(canvas)) return;
      Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
      Chart.defaults.color = '#64748B';
      charts.push(new Chart(canvas, build()));
    }, function () {
      U.clear(box).appendChild(h('p', { class: 'small muted', text: 'Grafik tidak dapat dimuat. Ringkasan: ' + summary }));
    });
    return panel;
  }

  /** Sumbu Y dalam menit dengan langkah "bulat" (15m, 30m, 1j, 2j, …) agar label tidak berulang. */
  function minutesAxis(values, stacked) {
    var max = 0;
    if (stacked) {
      values[0].forEach(function (_, i) { var s = 0; values.forEach(function (arr) { s += arr[i] || 0; }); max = Math.max(max, s); });
    } else values.forEach(function (v) { max = Math.max(max, v || 0); });
    var steps = [5, 10, 15, 30, 60, 120, 180, 240, 360, 480, 600, 900, 1200, 1800, 2400, 3000, 6000, 12000];
    var step = steps.filter(function (st) { return max / st <= 5; })[0] || 24000;
    return { beginAtZero: true, stacked: !!stacked, max: Math.max(step, Math.ceil(max / step) * step),
      ticks: { stepSize: step, callback: function (v) { return U.fmtMinutes(v); } } };
  }
  function minutesTooltip(ctx) { return ' ' + ctx.dataset.label + ': ' + U.fmtMinutes(ctx.parsed.y !== undefined ? ctx.parsed.y : ctx.parsed); }

  function stat(v, k) { return h('div', { class: 'stat' }, h('div', { class: 'v', text: v }), h('div', { class: 'k', text: k })); }

  function scorePanel(data, today) {
    var res = C.futureSelfScore(data, today, { weights: TI.repo.setting('scoreWeights', ''), weekStartsOn: wso() });
    return h('div', { class: 'panel', style: { marginTop: '12px' } },
      h('div', { class: 'panel-head' }, h('h2', { text: 'Future Self Score (7 hari terakhir)' }), h('b', { class: 'num', text: res.available ? res.score + '/100' : '–' })),
      res.available ? h('p', { class: 'small', style: { marginBottom: '8px' }, text: res.label }) : h('p', { class: 'small muted', style: { marginBottom: '8px' }, text: res.message }),
      h('div', { class: 'bar-rows' }, res.components.map(function (c) {
        return h('div', { class: 'br' }, h('span', { class: 'name', text: c.label + ' (' + c.weight + '%)' }),
          c.value === null ? h('span', { class: 'xs muted', text: 'Belum tersedia' }) : TI.ui.progressBar(c.value),
          h('span', { class: 'v', text: c.value === null ? '' : String(c.value) }));
      })),
      h('p', { class: 'xs muted', style: { marginTop: '8px' }, text: 'Indikator internal aplikasi, bukan penilaian ilmiah atau ukuran nilai diri. Komponen tanpa data tidak dihitung sebagai nol.' }));
  }

  function distractionPanel(data, today) {
    var target = Number(TI.repo.setting('dailyDistractionTargetMinutes', '60'));
    var d = C.distractionSummary(data, today, { weekStartsOn: wso(), dailyTargetMinutes: target });
    var projOut = h('p', { class: 'small', style: { marginTop: '8px' } });
    var slider = h('input', { type: 'range', min: '5', max: '120', step: '5', value: String(reduceMinutes), 'aria-label': 'Menit pengurangan per hari', style: { width: '100%', minHeight: '44px' } });
    function upd() {
      reduceMinutes = Number(slider.value);
      projOut.textContent = 'Jika kamu mengurangi ' + reduceMinutes + ' menit distraksi per hari, kamu dapat mengalokasikan kembali sekitar ' +
        C.projectionHoursPerYear(reduceMinutes).toLocaleString('id-ID') + ' jam per tahun.';
    }
    slider.addEventListener('input', upd);
    upd();
    var vs = d.weekTarget === null ? '' : (d.week <= d.weekTarget ? 'Masih dalam batas ' + U.fmtMinutes(d.weekTarget) + ' minggu ini.' : 'Melebihi batas ' + U.fmtMinutes(d.weekTarget) + ' minggu ini sebesar ' + U.fmtMinutes(d.week - d.weekTarget) + '.');
    return h('div', { class: 'panel', style: { marginTop: '12px' } },
      h('div', { class: 'panel-head' }, h('h2', { text: 'Analisis distraksi' })),
      h('div', { class: 'stat-grid' }, stat(U.fmtMinutes(d.today), 'Hari ini'), stat(U.fmtMinutes(d.week), 'Minggu ini'),
        stat(target ? U.fmtMinutes(target) : '–', 'Batas harian'), stat(d.top[0] ? d.top[0].name : '–', 'Terbesar minggu ini')),
      d.week > 0 ? h('p', { class: 'small', style: { marginTop: '10px' }, text: 'Kamu mencatat ' + U.fmtMinutes(d.week, true) + ' distraksi minggu ini. ' + vs }) : h('p', { class: 'small muted', style: { marginTop: '10px' }, text: 'Belum ada distraksi tercatat minggu ini. Catat dengan kategori Distraction agar polanya terlihat.' }),
      d.top.length > 1 ? h('div', { class: 'bar-rows', style: { marginTop: '8px' } }, d.top.map(function (a) {
        return h('div', { class: 'br' }, h('span', { class: 'name', text: a.name }), TI.ui.progressBar(a.minutes / d.top[0].minutes * 100, { color: '#EF4444' }), h('span', { class: 'v', text: U.fmtMinutes(a.minutes) }));
      })) : null,
      h('div', { style: { marginTop: '14px' } }, h('label', { class: 'small', style: { fontWeight: 600 }, text: 'Simulasi pengurangan' }), slider, projOut,
        h('p', { class: 'xs muted', text: 'Proyeksi mengasumsikan pola yang sama berlangsung konsisten selama 365 hari.' })),
      h('p', { class: 'xs muted', style: { marginTop: '6px' }, text: 'Hiburan yang disengaja tidak dihitung sebagai distraksi. Batas harian dapat diubah di Settings.' }));
  }

  function simulatorPanel() {
    var F = TI.forms;
    var out = h('div');
    var labels = { learning: 'Belajar', business: 'Bisnis', career: 'Karier', health: 'Kesehatan', other: 'Aktivitas lain' };
    var inputs = {};
    Object.keys(labels).forEach(function (k) {
      inputs[k] = F.input({ type: 'number', inputmode: 'numeric', min: '0', max: '1440', step: '5', value: String(sim[k]), 'aria-label': labels[k] + ' (menit per hari)' });
      inputs[k].addEventListener('input', calc);
    });
    function calc() {
      U.clear(out);
      var rows = [];
      var total = 0;
      Object.keys(labels).forEach(function (k) {
        var v = Math.max(0, Math.min(1440, Number(inputs[k].value) || 0));
        sim[k] = v; total += v;
        if (v > 0) rows.push([labels[k], C.simulate(v)]);
      });
      if (!rows.length) { out.appendChild(h('p', { class: 'small muted', text: 'Isi menit per hari untuk melihat proyeksi.' })); return; }
      rows.push(['Total', C.simulate(total)]);
      var fmt = function (m) { return U.fmtHours(m, 0) + ' jam'; };
      out.appendChild(h('div', { class: 'list', style: { marginTop: '12px' } }, rows.map(function (r) {
        return h('div', { class: 'item' }, h('div', { class: 'item-main' }, h('div', { class: 'item-title', text: r[0] + ' — ' + U.fmtMinutes(r[1].perDay, true) + '/hari' }),
          h('div', { class: 'item-meta num' }, h('span', { text: fmt(r[1].perWeek) + '/minggu' }), h('span', { text: '±' + fmt(r[1].perMonth) + '/bulan' }), h('span', { text: fmt(r[1].perYear) + '/tahun' }))));
      })));
      if (total > 1440) out.appendChild(h('p', { class: 'small', style: { color: 'var(--danger)', marginTop: '8px' }, text: 'Total melebihi 24 jam per hari.' }));
    }
    calc();
    return h('div', { class: 'panel', style: { marginTop: '12px' } },
      h('div', { class: 'panel-head' }, h('h2', { text: 'Future Time Simulator' })),
      h('p', { class: 'small muted', text: 'Menit per hari yang ingin kamu alokasikan:' }),
      h('div', { class: 'grid-2', style: { marginTop: '10px' } }, Object.keys(labels).map(function (k) { return F.field(labels[k] + ' (menit)', inputs[k]); })),
      out,
      h('p', { class: 'xs muted', style: { marginTop: '8px' }, text: 'Ini proyeksi matematis jika alokasi dijalankan setiap hari (bulan ≈ 30,4 hari), bukan kepastian hasil.' }));
  }

  function historyPanel() {
    var snaps = TI.repo.list('weeklySnapshots').sort(function (a, b) { return b.WeekStart.localeCompare(a.WeekStart); }).slice(0, 8);
    if (!snaps.length) return null;
    return h('div', { style: { marginTop: '12px' } }, TI.ui.blockTitle('Riwayat review mingguan'),
      h('div', { class: 'list' }, snaps.map(function (s) {
        var stats = {};
        try { stats = JSON.parse(s.StatsJSON || '{}'); } catch (e) { /* abaikan */ }
        return h('div', { class: 'item tap', onclick: function () { TI.ui.showSection('review', { tab: 'weekly', week: s.WeekStart }); } },
          h('div', { class: 'item-main' }, h('div', { class: 'item-title', text: 'Minggu ' + U.fmtDateShort(s.WeekStart) }),
            h('div', { class: 'item-meta' }, stats.total !== undefined ? h('span', { text: U.fmtMinutes(stats.total) + ' tercatat' }) : null,
              stats.ratio !== undefined && stats.ratio !== null ? h('span', { text: 'Rasio ' + stats.ratio + '%' }) : null)),
          TI.icon('chevron-right', 18));
      })));
  }

  function render(el) {
    destroyCharts();
    U.clear(el);
    var today = U.today();
    var data = TI.repo.snapshot();
    var r = resolveRange(today);
    var agg = C.aggregate(data, r.from, r.to);
    var ratio = C.investmentRatio(agg.buckets);
    var focus = C.focusSummary(data.focusSessions, r.from, r.to);
    var buckets = makeBuckets(r.from, r.to);
    var cats = C.categoryMap(data.categories);

    el.appendChild(TI.ui.chips(RANGES, range, function (v) { range = v; render(el); }));
    if (range === 'custom') {
      var f = TI.forms.input({ type: 'date', value: custom.from || U.addDays(today, -6), max: today });
      var t = TI.forms.input({ type: 'date', value: custom.to || today, max: today });
      el.appendChild(h('div', { class: 'panel', style: { marginTop: '6px' } }, h('div', { class: 'field-row' }, TI.forms.field('Dari', f), TI.forms.field('Sampai', t)),
        h('button', { type: 'button', class: 'btn primary block', style: { marginTop: '12px' }, onclick: function () {
          if (!f.value || !t.value || f.value > t.value) { TI.ui.toast('Rentang tanggal tidak valid', 'error'); return; }
          if (U.diffDays(f.value, t.value) > 731) { TI.ui.toast('Maksimal 2 tahun', 'error'); return; }
          custom = { from: f.value, to: t.value }; render(el);
        } }, 'Terapkan')));
    }
    el.appendChild(h('p', { class: 'small muted', style: { margin: '6px 0 10px' }, text: U.fmtDateLong(r.from) + (r.from !== r.to ? ' sampai ' + U.fmtDateLong(r.to) : '') }));

    el.appendChild(h('div', { class: 'stat-grid' },
      stat(U.fmtMinutes(agg.buckets.total), 'Waktu tercatat'),
      stat(ratio ? ratio.ratio + '%' : '–', 'Time Investment Ratio*'),
      stat(U.fmtMinutes(focus.minutes), 'Jam fokus'),
      stat(U.fmtMinutes(agg.buckets.distraction), 'Distraksi')));
    el.appendChild(h('p', { class: 'xs muted', style: { marginTop: '6px' }, text: '*Estimasi berdasarkan waktu yang tercatat: waktu membangun masa depan ÷ waktu aktif (pemulihan tidak dihitung sebagai waktu aktif secara default).' }));

    if (agg.entriesCount === 0) {
      el.appendChild(h('div', { class: 'list', style: { marginTop: '12px' } }, TI.ui.emptyState('chart-column', 'Belum ada waktu tercatat di rentang ini.', { label: 'Catat waktu', onClick: function () { TI.forms.timeEntry(); } })));
    } else {
      // Distribusi waktu
      var dist = Object.keys(agg.byCategory).map(function (id) { return { cat: cats[id], m: agg.byCategory[id] }; }).filter(function (x) { return x.m > 0; }).sort(function (a, b) { return b.m - a.m; });
      var top = dist[0];
      el.appendChild(chartPanel('Time Distribution', 'Terbesar: ' + (top.cat ? top.cat.Name : 'Lainnya') + ' ' + U.fmtMinutes(top.m, true) + ' dari total ' + U.fmtMinutes(agg.buckets.total, true) + '.', function () {
        return { type: 'doughnut', data: { labels: dist.map(function (x) { return x.cat ? x.cat.Name : 'Lainnya'; }), datasets: [{ label: 'Waktu', data: dist.map(function (x) { return x.m; }), backgroundColor: dist.map(function (x) { return x.cat ? x.cat.Color : '#94A3B8'; }), borderWidth: 2, borderColor: '#fff' }] },
          options: { maintainAspectRatio: false, cutout: '62%', plugins: { legend: { position: 'right', labels: { boxWidth: 10, boxHeight: 10 } }, tooltip: { callbacks: { label: function (c) { return ' ' + c.label + ': ' + U.fmtMinutes(c.parsed); } } } } } };
      }));

      // Tren investasi waktu
      var fb = buckets.map(function (b) { return sumDays(agg, b, 'futureBuilding'); });
      var act = buckets.map(function (b) { return Math.max(0, sumDays(agg, b, 'active') - sumDays(agg, b, 'futureBuilding')); });
      var rec = buckets.map(function (b) { return sumDays(agg, b, 'recovery'); });
      el.appendChild(chartPanel('Time Investment Trend', 'Total waktu membangun masa depan: ' + U.fmtMinutes(agg.buckets.futureBuilding, true) + '.', function () {
        return { type: 'bar', data: { labels: buckets.map(function (b) { return b.label; }), datasets: [
          { label: 'Membangun masa depan', data: fb, backgroundColor: '#1E4FD8', stack: 's' },
          { label: 'Aktif lainnya', data: act, backgroundColor: '#CBD5E1', stack: 's' },
          { label: 'Pemulihan', data: rec, backgroundColor: '#99E2D8', stack: 's' }] },
          options: { maintainAspectRatio: false, scales: { x: { stacked: true, grid: { display: false } }, y: minutesAxis([fb, act, rec], true) }, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, boxHeight: 10 } }, tooltip: { callbacks: { label: minutesTooltip } } } } };
      }, true));

      // Distraksi
      var dis = buckets.map(function (b) { return sumDays(agg, b, 'distraction'); });
      el.appendChild(chartPanel('Distraction Trend', 'Total distraksi: ' + U.fmtMinutes(agg.buckets.distraction, true) + '.', function () {
        return { type: 'bar', data: { labels: buckets.map(function (b) { return b.label; }), datasets: [{ label: 'Distraksi', data: dis, backgroundColor: '#F87171', borderRadius: 4 }] },
          options: { maintainAspectRatio: false, scales: { x: { grid: { display: false } }, y: minutesAxis(dis) }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: minutesTooltip } } } } };
      }));
    }

    // Fokus
    var focusData = buckets.map(function (b) { return C.focusSummary(data.focusSessions, b.from, b.to).minutes; });
    el.appendChild(chartPanel('Focus Hours', focus.sessions + ' sesi, ' + U.fmtMinutes(focus.minutes, true) + (focus.quality !== null ? ', kualitas ' + focus.quality + '/100' : '') + '.', function () {
      return { type: 'bar', data: { labels: buckets.map(function (b) { return b.label; }), datasets: [{ label: 'Fokus', data: focusData, backgroundColor: '#7C3AED', borderRadius: 4 }] },
        options: { maintainAspectRatio: false, scales: { x: { grid: { display: false } }, y: minutesAxis(focusData) }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: minutesTooltip } } } } };
    }));

    // Task completion
    var completedBy = buckets.map(function (b) {
      return data.tasks.filter(function (t) {
        if (t.Status !== 'COMPLETED' || !t.CompletedAt) return false;
        var d = U.localDate(Date.parse(t.CompletedAt));
        return d >= b.from && d <= b.to;
      }).length;
    });
    var totalDone = completedBy.reduce(function (s, v) { return s + v; }, 0);
    el.appendChild(chartPanel('Task Completion', totalDone + ' task selesai di rentang ini.', function () {
      return { type: 'bar', data: { labels: buckets.map(function (b) { return b.label; }), datasets: [{ label: 'Task selesai', data: completedBy, backgroundColor: '#15803D', borderRadius: 4 }] },
        options: { maintainAspectRatio: false, scales: { x: { grid: { display: false } }, y: { beginAtZero: true, ticks: { precision: 0 } } }, plugins: { legend: { display: false } } } };
    }));

    // Habit consistency
    if (data.habits.some(function (x) { return x.Active; })) {
      var habitRates = buckets.map(function (b) { return C.habitsCompletion(data.habits, data.habitLogs, b.from, b.to, wso()).rate; });
      var overall = C.habitsCompletion(data.habits, data.habitLogs, r.from, r.to, wso()).rate;
      el.appendChild(chartPanel('Habit Consistency', 'Completion rate keseluruhan: ' + (overall === null ? '–' : overall + '%') + '.', function () {
        return { type: 'line', data: { labels: buckets.map(function (b) { return b.label; }), datasets: [{ label: 'Completion rate', data: habitRates, borderColor: '#0D9488', backgroundColor: 'rgba(13,148,136,.12)', fill: true, tension: .3, spanGaps: true, pointRadius: 3 }] },
          options: { maintainAspectRatio: false, scales: { x: { grid: { display: false } }, y: { min: 0, max: 100, ticks: { callback: function (v) { return v + '%'; } } } }, plugins: { legend: { display: false } } } };
      }));
    }

    // Goal progress (bar DOM: aktual vs diharapkan)
    var goals = C.activeGoals(data.goals);
    if (goals.length) {
      el.appendChild(h('div', { class: 'panel', style: { marginTop: '12px' } },
        h('div', { class: 'panel-head' }, h('h2', { text: 'Goal Progress' })),
        h('div', { class: 'bar-rows' }, goals.map(function (g) {
          var st = C.goalStats(g, data, today);
          return h('div', { class: 'br' }, h('span', { class: 'name', text: g.Name }), TI.ui.progressBar(st.progress, { marker: st.expectedProgress }),
            h('span', { class: 'v', text: st.progress + '%' }));
        })),
        h('p', { class: 'xs muted', style: { marginTop: '8px' }, text: 'Bar = progres aktual, garis = progres yang diharapkan menurut tanggal. Waktu yang diinvestasikan ditampilkan terpisah di halaman goal.' })));
    }

    el.appendChild(scorePanel(data, today));
    el.appendChild(distractionPanel(data, today));
    el.appendChild(h('button', { type: 'button', class: 'btn block', style: { marginTop: '12px' }, onclick: function () { TI.ui.showSection('budget'); } }, TI.icon('wallet', 18), 'Lihat Time Budget'));
    el.appendChild(simulatorPanel());
    var hist = historyPanel();
    if (hist) el.appendChild(hist);
  }

  TI.views.analytics = { deps: null, render: render, onHide: destroyCharts };
})();
