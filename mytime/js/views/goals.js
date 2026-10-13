/**
 * Mytime — views/goals.js
 * GOAL → TASK → TIME ENTRY → MEASURABLE PROGRESS.
 * Waktu yang diinvestasikan dan progres aktual selalu ditampilkan terpisah.
 */
(function () {
  'use strict';
  var TI = window.TI;
  var U = TI.util, h = U.h, C = TI.calc;
  var filter = 'ACTIVE';
  var FILTERS = [{ value: 'ACTIVE', label: 'Aktif' }, { value: 'PAUSED', label: 'Dijeda' }, { value: 'COMPLETED', label: 'Tercapai' }, { value: 'ARCHIVED', label: 'Arsip' }, { value: 'ALL', label: 'Semua' }];

  function matches(g) {
    if (filter === 'ALL') return true;
    if (filter === 'ARCHIVED') return !!g.Archived;
    return !g.Archived && g.Status === filter;
  }

  function goalCard(g, data, today) {
    var st = C.goalStats(g, data, today);
    var cat = TI.repo.get('categories', g.CategoryID);
    var behind = st.expectedProgress !== null && g.Status === 'ACTIVE' && st.progress + 10 < st.expectedProgress;
    return h('div', { class: 'item tap', onclick: function () { openDetail(g.GoalID); } },
      h('div', { class: 'item-main' },
        h('div', { class: 'row between' }, h('span', { class: 'item-title', text: g.Name }), h('span', { class: 'item-side', text: st.progress + '%' })),
        h('div', { style: { margin: '8px 0 6px' } }, TI.ui.progressBar(st.progress, { marker: g.Status === 'ACTIVE' ? st.expectedProgress : null, tone: g.Status === 'COMPLETED' ? 'ok' : '', label: 'Progres ' + g.Name })),
        h('div', { class: 'item-meta' },
          cat ? h('span', { class: 'row', style: { gap: '4px' } }, TI.ui.categoryDot(cat), h('span', { text: cat.Name })) : null,
          h('span', { text: U.fmtMinutes(st.investedMinutes) + ' diinvestasikan' }),
          st.tasksTotal ? h('span', { text: st.tasksDone + '/' + st.tasksTotal + ' task' }) : null,
          g.TargetDate ? h('span', { text: st.daysLeft >= 0 ? 'Target ' + U.fmtDateShort(g.TargetDate) : 'Target ' + U.fmtDateShort(g.TargetDate) + ' terlewati' }) : null,
          behind ? h('span', { class: 'warn', text: 'Di bawah progres yang diharapkan' }) : null)));
  }

  function openDetail(goalId) {
    var g = TI.repo.get('goals', goalId);
    if (!g) return;
    var data = TI.repo.snapshot();
    var today = U.today();
    var st = C.goalStats(g, data, today);
    var tasks = data.tasks.filter(function (t) { return t.GoalID === g.GoalID; });
    tasks = C.sortTasks(tasks, 'priority').sort(function (a, b) { return (a.Status === 'COMPLETED') - (b.Status === 'COMPLETED'); });
    var entries = data.timeEntries.filter(function (e) { return e.GoalID === g.GoalID; })
      .sort(function (a, b) { return String(b.StartTime).localeCompare(String(a.StartTime)); }).slice(0, 5);

    var progVal = h('b', { class: 'num', text: st.progress + '%' });
    var slider = h('input', { type: 'range', min: '0', max: '100', step: '5', value: String(st.progress), 'aria-label': 'Progres aktual', style: { width: '100%', minHeight: '44px' } });
    slider.addEventListener('input', function () { progVal.textContent = slider.value + '%'; });
    var saveProg = h('button', { type: 'button', class: 'btn sm', onclick: function () {
      TI.repo.save('goals', Object.assign({}, g, { Progress: Number(slider.value) })).then(function () { TI.ui.toast('Progres diperbarui'); g = TI.repo.get('goals', goalId); });
    } }, 'Simpan progres');

    function statBox(v, k) { return h('div', { class: 'stat' }, h('div', { class: 'v', text: v }), h('div', { class: 'k', text: k })); }
    var content = h('div', { class: 'stack' },
      g.Description ? h('p', { text: g.Description, style: { whiteSpace: 'pre-wrap' } }) : null,
      h('div', { class: 'stat-grid' },
        statBox(st.progress + '%', 'Progres aktual'),
        statBox(st.expectedProgress === null ? '–' : st.expectedProgress + '%', 'Progres yang diharapkan'),
        statBox(U.fmtMinutes(st.investedMinutes), 'Waktu diinvestasikan'),
        statBox(st.tasksTotal ? st.tasksDone + '/' + st.tasksTotal : '–', 'Task selesai')),
      h('p', { class: 'xs muted', text: 'Waktu yang diinvestasikan bukan bukti goal pasti tercapai. Perbarui progres aktual berdasarkan hasil nyata.' }),
      h('div', { class: 'panel' },
        h('div', { class: 'row between' }, h('span', { class: 'small', style: { fontWeight: 600 }, text: 'Perbarui progres aktual' }), progVal),
        slider, h('div', { class: 'row', style: { justifyContent: 'flex-end' } }, saveProg)),
      h('div', { class: 'row between' }, h('h3', { text: 'Task terkait' }),
        h('button', { type: 'button', class: 'link-btn', onclick: function () { TI.forms.task(null, { GoalID: g.GoalID, CategoryID: g.CategoryID }); } }, 'Tambah task')),
      tasks.length ? h('div', { class: 'list' }, tasks.map(function (t) {
        var done = t.Status === 'COMPLETED';
        return h('div', { class: 'item' },
          h('button', { type: 'button', class: 'check' + (done ? ' on' : ''), 'aria-pressed': String(done), 'aria-label': 'Selesai: ' + t.Title, onclick: function (e) {
            TI.forms.setTaskDone(t, !done);
            e.currentTarget.classList.toggle('on');
          } }, h('span', { class: 'box' }, TI.icon('check', 16))),
          h('div', { class: 'item-main' }, h('div', { class: 'item-title' + (done ? ' done' : ''), text: t.Title }),
            t.DueDate ? h('div', { class: 'item-meta', text: U.relativeDay(t.DueDate, today) }) : null));
      })) : h('p', { class: 'small muted', text: 'Belum ada task. Pecah goal menjadi langkah konkret.' }),
      entries.length ? h('h3', { text: 'Waktu terakhir' }) : null,
      entries.length ? h('div', { class: 'list' }, entries.map(function (e) {
        return h('div', { class: 'item' }, h('div', { class: 'item-main' }, h('div', { class: 'item-title', text: e.Activity }),
          h('div', { class: 'item-meta', text: U.fmtDateShort(e.Date) })), h('span', { class: 'item-side', text: U.fmtMinutes(e.DurationMinutes) }));
      })) : null,
      g.EvaluationNotes ? h('div', null, h('h3', { text: 'Catatan evaluasi' }), h('p', { class: 'small', style: { whiteSpace: 'pre-wrap', marginTop: '6px' }, text: g.EvaluationNotes })) : null);

    TI.ui.sheet({
      title: g.Name, content: content,
      actions: [
        { label: g.Archived ? 'Keluarkan dari arsip' : 'Arsipkan', icon: 'archive', onClick: function () {
          return TI.repo.save('goals', Object.assign({}, TI.repo.get('goals', goalId), { Archived: !g.Archived }))
            .then(function () { TI.ui.toast(g.Archived ? 'Goal dikeluarkan dari arsip' : 'Goal diarsipkan'); });
        } },
        { label: 'Edit', kind: 'primary', icon: 'pencil', onClick: function () { setTimeout(function () { TI.forms.goal(TI.repo.get('goals', goalId)); }, 220); return true; } }
      ]
    });
  }

  function render(el) {
    U.clear(el);
    var data = TI.repo.snapshot();
    var today = U.today();
    var all = data.goals;
    var counts = {};
    FILTERS.forEach(function (f) { var keep = filter; filter = f.value; counts[f.value] = all.filter(matches).length; filter = keep; });
    var list = all.filter(matches).sort(function (a, b) {
      return (C.PRIORITY_RANK[b.Priority] || 0) - (C.PRIORITY_RANK[a.Priority] || 0) || String(a.TargetDate || '9999').localeCompare(String(b.TargetDate || '9999'));
    });
    U.append(el, [
      TI.ui.chips(FILTERS, filter, function (v) { filter = v; render(el); }, counts),
      list.length
        ? h('div', { class: 'list', style: { marginTop: '6px' } }, list.map(function (g) { return goalCard(g, data, today); }))
        : h('div', { class: 'list', style: { marginTop: '6px' } }, TI.ui.emptyState('target', filter === 'ACTIVE' ? 'Belum ada goal aktif. Goal membantu memberi arah pada waktu yang kamu investasikan.' : 'Tidak ada goal di kategori ini.',
          filter === 'ACTIVE' ? { label: 'Buat goal', onClick: function () { TI.forms.goal(); } } : null)),
      h('p', { class: 'xs muted', style: { marginTop: '10px' }, text: 'Garis tegak pada progress bar menunjukkan progres yang diharapkan berdasarkan waktu berjalan antara tanggal mulai dan target.' }),
      h('button', { type: 'button', class: 'btn block', style: { marginTop: '12px' }, onclick: function () { TI.forms.goal(); } }, TI.icon('plus', 18), 'Goal baru')
    ]);
  }

  TI.views.goals = { deps: ['goals', 'tasks', 'timeEntries', 'categories'], render: render, openDetail: openDetail };
})();
