/**
 * Mytime — views/calendar.js
 * Agenda Today / This Week / Upcoming, plus kalender bulanan.
 * Menampilkan tenggat task, target goal, aktivitas tercatat, habit, dan target mingguan.
 */
(function () {
  'use strict';
  var TI = window.TI;
  var U = TI.util, h = U.h, C = TI.calc;
  var mode = 'today';
  var monthCursor = null;
  var selectedDay = null;

  function itemsForDay(d, data, today) {
    var out = [];
    data.tasks.forEach(function (t) {
      if (t.DueDate !== d || t.Status === 'CANCELLED') return;
      var done = t.Status === 'COMPLETED';
      out.push({ kind: 'task', sort: '0', icon: done ? 'circle-check' : 'circle-dashed', title: t.Title,
        meta: done ? 'Task selesai' : (d < today ? 'Tenggat terlewati' : 'Tenggat task'), warn: !done && d < today, onClick: function () { TI.forms.task(t); } });
    });
    data.goals.forEach(function (g) {
      if (g.TargetDate !== d || g.Archived) return;
      out.push({ kind: 'goal', sort: '1', icon: 'flag', title: g.Name, meta: 'Target goal (' + (Number(g.Progress) || 0) + '%)', onClick: function () { TI.views.goals.openDetail(g.GoalID); } });
    });
    data.timeEntries.filter(function (e) { return U.localDate(Date.parse(e.StartTime)) === d; })
      .sort(function (a, b) { return String(a.StartTime).localeCompare(String(b.StartTime)); })
      .forEach(function (e) {
        out.push({ kind: 'entry', sort: '2' + e.StartTime, icon: 'clock', title: e.Activity,
          meta: U.isoToLocalHHmm(e.StartTime) + '–' + U.isoToLocalHHmm(e.EndTime) + ', ' + U.fmtMinutes(e.DurationMinutes), onClick: function () { TI.forms.timeEntry(e); } });
      });
    var habits = data.habits.filter(function (x) { return x.Active && U.localDate(Date.parse(x.CreatedAt)) <= d; });
    if (habits.length && d <= today) {
      var done = habits.filter(function (x) { return C.habitDoneDates(x.HabitID, data.habitLogs)[d]; }).length;
      out.push({ kind: 'habit', sort: '3', icon: 'repeat', title: 'Habit: ' + done + ' dari ' + habits.length + ' selesai', meta: '', onClick: function () { TI.ui.showSection('habits'); } });
    } else if (habits.length) {
      var daily = habits.filter(function (x) { return x.Frequency === 'DAILY'; }).length;
      if (daily) out.push({ kind: 'habit', sort: '3', icon: 'repeat', title: daily + ' habit harian', meta: 'Dijadwalkan', onClick: function () { TI.ui.showSection('habits'); } });
    }
    return out.sort(function (a, b) { return a.sort < b.sort ? -1 : 1; });
  }

  function agendaDay(d, data, today, opts) {
    opts = opts || {};
    var items = itemsForDay(d, data, today).filter(function (i) { return !opts.only || opts.only.indexOf(i.kind) !== -1; });
    if (!items.length && opts.skipEmpty) return null;
    return h('div', { class: 'agenda-day' },
      h('h3', { text: U.relativeDay(d, today) === 'Hari ini' || U.relativeDay(d, today) === 'Besok' || U.relativeDay(d, today) === 'Kemarin' ? U.relativeDay(d, today) + ', ' + U.fmtDateShort(d) : U.fmtDateLong(d) }),
      items.length ? h('div', { class: 'list' }, items.map(function (i) {
        return h('div', { class: 'item tap', onclick: i.onClick },
          h('span', { class: 'icon', style: { color: i.warn ? 'var(--warning)' : 'var(--primary)' } }, TI.icon(i.icon, 18)),
          h('div', { class: 'item-main' }, h('div', { class: 'item-title', text: i.title }), i.meta ? h('div', { class: 'item-meta' }, h('span', { class: i.warn ? 'warn' : '', text: i.meta })) : null));
      })) : h('p', { class: 'small muted', text: 'Tidak ada agenda.' }));
  }

  function monthView(data, today) {
    monthCursor = monthCursor || U.startOfMonth(today);
    selectedDay = selectedDay || today;
    var wso = Number(TI.repo.setting('weekStartsOn', '1'));
    var first = U.parseLocalDate(monthCursor);
    var monthEnd = U.addDays(U.startOfMonth(U.addDays(monthCursor, 32)), -1);
    var lead = (first.getDay() - wso + 7) % 7;
    var gridStart = U.addDays(monthCursor, -lead);
    var trail = (7 - ((lead + U.diffDays(monthCursor, monthEnd) + 1) % 7)) % 7;
    var gridEnd = U.addDays(monthEnd, trail);
    var dueBy = {}, goalBy = {}, entryBy = {};
    data.tasks.forEach(function (t) { if (t.DueDate && t.Status !== 'CANCELLED') (dueBy[t.DueDate] = dueBy[t.DueDate] || []).push(t); });
    data.goals.forEach(function (g) { if (g.TargetDate && !g.Archived) goalBy[g.TargetDate] = true; });
    data.timeEntries.forEach(function (e) { entryBy[e.Date] = true; });
    var grid = h('div', { class: 'month-grid' });
    (wso === 1 ? ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'] : ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']).forEach(function (d) { grid.appendChild(h('div', { class: 'dow', text: d })); });
    U.dateRange(gridStart, gridEnd).forEach(function (d) {
      var tasks = dueBy[d] || [];
      var open = tasks.filter(C.isOpenTask);
      var dots = h('span', { class: 'cal-dots' },
        open.length ? h('i', { class: d < today ? 'warn' : '' }) : null,
        goalBy[d] ? h('i', { class: 'ok' }) : null,
        entryBy[d] ? h('i', { style: { background: '#94A3B8' } }) : null);
      grid.appendChild(h('button', {
        type: 'button', class: 'cal-day' + (d.slice(0, 7) !== monthCursor.slice(0, 7) ? ' out' : '') + (d === today ? ' today' : ''),
        'aria-pressed': String(d === selectedDay), 'aria-label': U.fmtDateLong(d),
        onclick: function () { selectedDay = d; rerender(); }
      }, h('span', { text: String(Number(d.slice(8))) }), dots));
    });
    var title = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(first);
    return h('div', null,
      h('div', { class: 'panel', style: { marginTop: '12px' } },
        h('div', { class: 'row between', style: { marginBottom: '8px' } },
          h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Bulan sebelumnya', onclick: function () { monthCursor = U.startOfMonth(U.addDays(monthCursor, -1)); rerender(); } }, TI.icon('chevron-left')),
          h('h2', { text: title }),
          h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Bulan berikutnya', onclick: function () { monthCursor = U.addDays(monthEnd, 1); rerender(); } }, TI.icon('chevron-right'))),
        grid,
        h('div', { class: 'row wrap small muted', style: { marginTop: '10px', gap: '6px 14px' } },
          h('span', { class: 'row', style: { gap: '6px' } }, h('span', { class: 'dot', style: { background: 'var(--primary)', borderRadius: '50%' } }), 'Tenggat task'),
          h('span', { class: 'row', style: { gap: '6px' } }, h('span', { class: 'dot', style: { background: 'var(--success)', borderRadius: '50%' } }), 'Target goal'),
          h('span', { class: 'row', style: { gap: '6px' } }, h('span', { class: 'dot', style: { background: '#94A3B8', borderRadius: '50%' } }), 'Waktu tercatat'))),
      agendaDay(selectedDay, data, today));
  }

  var host = null;
  function rerender() { if (host) render(host); }

  function render(el) {
    host = el;
    U.clear(el);
    var data = TI.repo.snapshot();
    var today = U.today();
    var seg = TI.ui.segmented([{ value: 'today', label: 'Today' }, { value: 'week', label: 'This Week' }, { value: 'upcoming', label: 'Upcoming' }, { value: 'month', label: 'Bulan' }],
      mode, function (v) { mode = v; rerender(); });
    el.appendChild(seg);
    if (mode === 'today') {
      el.appendChild(agendaDay(today, data, today));
      var overdue = C.filterTasks(data.tasks, 'overdue', today);
      if (overdue.length) {
        el.appendChild(h('div', { class: 'agenda-day' }, h('h3', { text: 'Lewat tenggat (' + overdue.length + ')' }),
          h('div', { class: 'list' }, C.sortTasks(overdue, 'due').map(function (t) {
            return h('div', { class: 'item tap', onclick: function () { TI.forms.task(t); } }, h('span', { class: 'icon', style: { color: 'var(--warning)' } }, TI.icon('circle-dashed', 18)),
              h('div', { class: 'item-main' }, h('div', { class: 'item-title', text: t.Title }), h('div', { class: 'item-meta' }, h('span', { class: 'warn', text: 'Tenggat ' + U.fmtDateShort(t.DueDate) }))));
          }))));
      }
    } else if (mode === 'week') {
      var ws = U.startOfWeek(today, Number(TI.repo.setting('weekStartsOn', '1')));
      var budgets = C.budgetStatus(data, ws, today);
      if (budgets.length) {
        el.appendChild(h('div', { class: 'panel', style: { marginTop: '12px' } },
          h('div', { class: 'panel-head' }, h('h2', { text: 'Target mingguan' }), h('button', { type: 'button', class: 'link-btn', onclick: function () { TI.ui.showSection('budget'); } }, 'Detail')),
          h('div', { class: 'bar-rows' }, budgets.map(function (r) {
            return h('div', { class: 'br' }, h('span', { class: 'name', text: r.category.Name }), TI.ui.progressBar(r.pct || 0, { color: r.category.Color }), h('span', { class: 'v', text: U.fmtMinutes(r.actual) + '/' + U.fmtMinutes(r.target) }));
          }))));
      }
      U.dateRange(ws, U.addDays(ws, 6)).forEach(function (d) { el.appendChild(agendaDay(d, data, today)); });
    } else if (mode === 'upcoming') {
      var any = false;
      U.dateRange(U.addDays(today, 1), U.addDays(today, 30)).forEach(function (d) {
        var node = agendaDay(d, data, today, { only: ['task', 'goal'], skipEmpty: true });
        if (node) { any = true; el.appendChild(node); }
      });
      if (!any) el.appendChild(h('div', { class: 'list', style: { marginTop: '12px' } }, TI.ui.emptyState('calendar-days', 'Tidak ada tenggat atau target dalam 30 hari ke depan.')));
    } else {
      el.appendChild(monthView(data, today));
    }
  }

  TI.views.calendar = { deps: null, render: render };
})();
