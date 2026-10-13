/**
 * Mytime — views/habits.js
 * Habit tracker: centang harian, riwayat, completion rate mingguan & bulanan.
 * Satu tanggal hanya dihitung sekali; streak hanya informasi tambahan.
 */
(function () {
  'use strict';
  var TI = window.TI;
  var U = TI.util, h = U.h, C = TI.calc;

  function ws() { return Number(TI.repo.setting('weekStartsOn', '1')); }

  /** Tandai/batalkan habit pada tanggal tertentu (idempoten per tanggal). */
  function toggle(habit, date) {
    var logs = TI.repo.list('habitLogs').filter(function (l) { return l.HabitID === habit.HabitID && l.Date === date; });
    var done = logs.filter(function (l) { return l.Status === 'DONE'; });
    if (done.length) {
      return Promise.all(done.map(function (l) { return TI.repo.remove('habitLogs', l.HabitLogID); }));
    }
    var skipped = logs[0];
    if (skipped) return TI.repo.save('habitLogs', Object.assign({}, skipped, { Status: 'DONE' }));
    return TI.repo.save('habitLogs', { HabitID: habit.HabitID, Date: date, Status: 'DONE', Notes: '' });
  }
  TI.habitActions = { toggle: toggle };

  function weekDots(habit, logs, today) {
    var done = C.habitDoneDates(habit.HabitID, logs);
    var days = U.dateRange(U.addDays(today, -6), today);
    return h('span', { class: 'week-dots', 'aria-label': days.filter(function (d) { return done[d]; }).length + ' dari 7 hari terakhir' },
      days.map(function (d) { return h('span', { class: done[d] ? 'on' : '', title: U.fmtDateShort(d) }); }));
  }

  function freqLabel(hb) { return hb.Frequency === 'WEEKLY' ? hb.Target + '× per minggu' : 'Setiap hari'; }

  function openDetail(habitId) {
    var hb = TI.repo.get('habits', habitId);
    if (!hb) return;
    var month = U.startOfMonth(U.today());
    var s = TI.ui.sheet({ title: hb.Name, content: function () { return body(); },
      actions: [{ label: 'Edit habit', kind: 'primary', icon: 'pencil', onClick: function () { setTimeout(function () { TI.forms.habit(TI.repo.get('habits', habitId)); }, 220); return true; } }] });
    function body() {
      var today = U.today();
      var logs = TI.repo.list('habitLogs');
      var done = C.habitDoneDates(hb.HabitID, logs);
      var r7 = C.habitStats(hb, logs, U.addDays(today, -6), today, ws());
      var r30 = C.habitStats(hb, logs, U.addDays(today, -29), today, ws());
      var monthEnd = U.addDays(U.startOfMonth(U.addDays(month, 32)), -1);
      var rm = C.habitStats(hb, logs, month, monthEnd < today ? monthEnd : today, ws());
      // Grid bulan
      var first = U.parseLocalDate(month);
      var lead = (first.getDay() - ws() + 7) % 7;
      var grid = h('div', { class: 'month-grid' });
      var dows = ws() === 1 ? ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'] : ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
      dows.forEach(function (d) { grid.appendChild(h('div', { class: 'dow', text: d })); });
      for (var i = 0; i < lead; i++) grid.appendChild(h('div', { class: 'day out' }));
      U.dateRange(month, monthEnd).forEach(function (d) {
        var future = d > today;
        grid.appendChild(h('button', {
          type: 'button', class: 'day' + (done[d] ? ' on' : '') + (d === today ? ' today' : ''), disabled: future,
          'aria-pressed': String(!!done[d]), 'aria-label': U.fmtDateLong(d) + (done[d] ? ', selesai' : ''),
          onclick: function () { toggle(hb, d).then(function () { U.clear(s.body).appendChild(body()); }); }
        }, String(Number(d.slice(8)))));
      });
      var monthName = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(first);
      function stat(v, k) { return h('div', { class: 'stat' }, h('div', { class: 'v', text: v === null ? '–' : v + '%' }), h('div', { class: 'k', text: k })); }
      return h('div', { class: 'stack' },
        h('p', { class: 'muted small', text: freqLabel(hb) + (hb.Description ? '. ' + hb.Description : '') }),
        h('div', { class: 'stat-grid' }, stat(r7.rate, '7 hari'), stat(r30.rate, '30 hari'), stat(rm.rate, monthName),
          h('div', { class: 'stat' }, h('div', { class: 'v', text: String(r7.streak) }), h('div', { class: 'k', text: 'Rangkaian hari' }))),
        h('div', { class: 'row between' },
          h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Bulan sebelumnya', onclick: function () { month = U.startOfMonth(U.addDays(month, -1)); U.clear(s.body).appendChild(body()); } }, TI.icon('chevron-left')),
          h('h3', { text: monthName }),
          h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Bulan berikutnya', disabled: monthEnd >= today, onclick: function () { month = U.addDays(monthEnd, 1); U.clear(s.body).appendChild(body()); } }, TI.icon('chevron-right'))),
        grid,
        h('p', { class: 'xs muted', text: 'Ketuk tanggal untuk menandai atau membatalkan. Melewatkan satu hari tidak menghapus progresmu — lanjutkan saja besok.' }));
    }
  }

  function render(el) {
    U.clear(el);
    var today = U.today();
    var habits = TI.repo.list('habits');
    var logs = TI.repo.list('habitLogs');
    var active = habits.filter(function (x) { return x.Active; }).sort(function (a, b) { return String(a.CreatedAt).localeCompare(String(b.CreatedAt)); });
    var inactive = habits.filter(function (x) { return !x.Active; });
    var todayDone = active.filter(function (x) { return C.habitDoneDates(x.HabitID, logs)[today]; }).length;
    var week = C.habitsCompletion(habits, logs, U.startOfWeek(today, ws()), today, ws());
    var month = C.habitsCompletion(habits, logs, U.startOfMonth(today), today, ws());

    if (!active.length) {
      U.append(el, [h('div', { class: 'list' }, TI.ui.emptyState('repeat', 'Kebiasaan kecil yang konsisten memberi dampak besar. Mulai dengan satu habit.', { label: 'Tambah habit', onClick: function () { TI.forms.habit(); } }))]);
    } else {
      U.append(el, [
        h('div', { class: 'stat-grid' },
          h('div', { class: 'stat' }, h('div', { class: 'v', text: todayDone + '/' + active.length }), h('div', { class: 'k', text: 'Selesai hari ini' })),
          h('div', { class: 'stat' }, h('div', { class: 'v', text: week.rate === null ? '–' : week.rate + '%' }), h('div', { class: 'k', text: 'Minggu ini' })),
          h('div', { class: 'stat' }, h('div', { class: 'v', text: month.rate === null ? '–' : month.rate + '%' }), h('div', { class: 'k', text: 'Bulan ini' }))),
        TI.ui.blockTitle('Hari ini'),
        h('div', { class: 'list' }, active.map(function (hb) {
          var done = !!C.habitDoneDates(hb.HabitID, logs)[today];
          var r = C.habitStats(hb, logs, U.addDays(today, -6), today, ws());
          return h('div', { class: 'item' },
            h('button', { type: 'button', class: 'check' + (done ? ' on' : ''), 'aria-pressed': String(done), 'aria-label': (done ? 'Batalkan: ' : 'Tandai selesai: ') + hb.Name,
              onclick: function () { toggle(hb, today); } }, h('span', { class: 'box' }, TI.icon('check', 16))),
            h('div', { class: 'item-main', style: { cursor: 'pointer' }, onclick: function () { openDetail(hb.HabitID); } },
              h('div', { class: 'item-title', text: hb.Name }),
              h('div', { class: 'item-meta' }, h('span', { text: freqLabel(hb) }), weekDots(hb, logs, today), h('span', { class: 'num', text: r.rate === null ? '' : r.rate + '% (7 hari)' }))));
        }))
      ]);
    }
    if (inactive.length) {
      U.append(el, [TI.ui.blockTitle('Nonaktif'), h('div', { class: 'list' }, inactive.map(function (hb) {
        return h('div', { class: 'item tap', onclick: function () { TI.forms.habit(hb); } }, h('div', { class: 'item-main' }, h('div', { class: 'item-title', text: hb.Name }), h('div', { class: 'item-meta', text: freqLabel(hb) })));
      }))]);
    }
    U.append(el, [
      h('p', { class: 'xs muted', style: { marginTop: '10px' }, text: 'Completion rate menghitung setiap tanggal sekali saja. Konsistensi lebih penting daripada rangkaian tanpa putus.' }),
      h('button', { type: 'button', class: 'btn block', style: { marginTop: '12px' }, onclick: function () { TI.forms.habit(); } }, TI.icon('plus', 18), 'Tambah habit')
    ]);
  }

  TI.views.habits = { deps: ['habits', 'habitLogs'], render: render, openDetail: openDetail };
})();
