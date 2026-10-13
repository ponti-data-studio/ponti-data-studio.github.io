/**
 * Mytime — views/tasks.js
 * Daftar task dengan pencarian, filter (Today/Upcoming/Overdue/Completed/All), dan urutan.
 */
(function () {
  'use strict';
  var TI = window.TI;
  var U = TI.util, h = U.h, C = TI.calc;
  var state = { filter: 'today', query: '', sort: 'priority' };
  try { Object.assign(state, JSON.parse(localStorage.getItem('ti.tasks.view') || '{}'), { query: '' }); } catch (e) { /* default */ }
  var listHost = null;
  var chipsHost = null;

  var FILTERS = [
    { value: 'today', label: 'Today' }, { value: 'upcoming', label: 'Upcoming' }, { value: 'overdue', label: 'Overdue' },
    { value: 'completed', label: 'Completed' }, { value: 'all', label: 'All Tasks' }
  ];

  function persist() {
    try { localStorage.setItem('ti.tasks.view', JSON.stringify({ filter: state.filter, sort: state.sort })); } catch (e) { /* abaikan */ }
  }

  function taskItem(t, today, cats, goals) {
    var done = t.Status === 'COMPLETED';
    var overdue = C.isOpenTask(t) && t.DueDate && t.DueDate < today;
    var cat = cats[t.CategoryID];
    var goal = goals[t.GoalID];
    var statusBadge = t.Status === 'IN_PROGRESS' ? h('span', { class: 'badge', text: 'Sedang dikerjakan' })
      : t.Status === 'CANCELLED' ? h('span', { class: 'badge', text: 'Dibatalkan' }) : null;
    var syncBadge = t.SyncStatus === 'FAILED' ? h('span', { class: 'badge err', text: 'Ditolak server' })
      : t.SyncStatus === 'CONFLICT' ? h('span', { class: 'badge warn', text: 'Konflik' }) : null;
    return h('div', { class: 'item' },
      h('button', { type: 'button', class: 'check' + (done ? ' on' : ''), 'aria-pressed': String(done),
        'aria-label': (done ? 'Tandai belum selesai: ' : 'Tandai selesai: ') + t.Title,
        disabled: t.Status === 'CANCELLED',
        onclick: function () { TI.forms.setTaskDone(t, !done); } }, h('span', { class: 'box' }, TI.icon('check', 16))),
      h('div', { class: 'item-main', style: { cursor: 'pointer' }, onclick: function () { TI.forms.task(t); } },
        h('div', { class: 'item-title' + (done || t.Status === 'CANCELLED' ? ' done' : ''), text: t.Title }),
        h('div', { class: 'item-meta' },
          t.DueDate ? h('span', { class: overdue ? 'warn' : '', text: overdue ? 'Lewat tenggat ' + U.fmtDateShort(t.DueDate) : U.relativeDay(t.DueDate, today) }) : null,
          !done ? h('span', { class: 'badge p-' + t.Priority, text: TI.forms.PRIORITY_LABEL[t.Priority] }) : null,
          statusBadge, syncBadge,
          cat ? h('span', { class: 'row', style: { gap: '4px' } }, TI.ui.categoryDot(cat), h('span', { text: cat.Name })) : null,
          goal ? h('span', { text: '→ ' + goal.Name }) : null,
          t.EstimatedMinutes ? h('span', { text: '±' + U.fmtMinutes(t.EstimatedMinutes) }) : null)),
      !done && t.Status !== 'CANCELLED' ? h('button', { type: 'button', class: 'star-btn' + (t.Starred ? ' on' : ''), 'aria-pressed': String(!!t.Starred),
        'aria-label': t.Starred ? 'Hapus dari prioritas hari ini' : 'Jadikan prioritas hari ini',
        onclick: function () { TI.repo.save('tasks', Object.assign({}, t, { Starred: !t.Starred })); } }, TI.icon('star', 20)) : null);
  }

  function renderList() {
    if (!listHost) return;
    var today = U.today();
    var all = TI.repo.list('tasks');
    var counts = {};
    FILTERS.forEach(function (f) { counts[f.value] = C.filterTasks(all, f.value, today).length; });
    U.clear(chipsHost).appendChild(TI.ui.chips(FILTERS, state.filter, function (v) { state.filter = v; persist(); renderList(); }, counts));
    var list = C.sortTasks(C.filterTasks(all, state.filter, today, state.query), state.filter === 'completed' ? 'created' : state.sort);
    if (state.filter === 'completed') list.sort(function (a, b) { return String(b.CompletedAt).localeCompare(String(a.CompletedAt)); });
    var cats = C.categoryMap(TI.repo.list('categories'));
    var goals = {};
    TI.repo.list('goals').forEach(function (g) { goals[g.GoalID] = g; });
    U.clear(listHost);
    if (!list.length) {
      var msg = state.query ? 'Tidak ada task yang cocok dengan “' + state.query + '”.' : {
        today: 'Tidak ada task bertenggat hari ini.', upcoming: 'Belum ada task terjadwal ke depan.',
        overdue: 'Tidak ada task yang lewat tenggat.', completed: 'Belum ada task selesai.', all: 'Belum ada task. Tambahkan yang pertama.'
      }[state.filter];
      listHost.appendChild(h('div', { class: 'list' }, TI.ui.emptyState('list-checks', msg,
        state.query ? null : { label: 'Tambah task', onClick: function () { TI.forms.task(null, state.filter === 'today' ? { DueDate: today } : null); } })));
      return;
    }
    if (state.filter === 'overdue') {
      listHost.appendChild(h('p', { class: 'small muted', style: { margin: '0 0 10px' }, text: 'Task ini melewati tenggat. Jadwalkan ulang, kerjakan, atau batalkan bila sudah tidak relevan.' }));
    }
    listHost.appendChild(h('div', { class: 'list' }, list.map(function (t) { return taskItem(t, today, cats, goals); })));
  }

  function render(el) {
    U.clear(el);
    var search = h('input', { type: 'search', class: 'input', placeholder: 'Cari task', value: state.query, 'aria-label': 'Cari task', enterkeyhint: 'search' });
    search.addEventListener('input', U.debounce(function () { state.query = search.value; renderList(); }, 150));
    var sort = TI.forms.select([
      { value: 'priority', label: 'Urut: Prioritas' }, { value: 'due', label: 'Urut: Tenggat' },
      { value: 'created', label: 'Urut: Terbaru' }, { value: 'title', label: 'Urut: Judul' }
    ], state.sort, { 'aria-label': 'Urutkan task', style: { width: 'auto', flex: 'none' } });
    sort.addEventListener('change', function () { state.sort = sort.value; persist(); renderList(); });
    chipsHost = h('div', { style: { marginTop: '12px' } });
    listHost = h('div', { style: { marginTop: '6px' } });
    U.append(el, [
      h('div', { class: 'row' }, h('div', { class: 'grow' }, search), sort),
      chipsHost, listHost,
      h('button', { type: 'button', class: 'btn block', style: { marginTop: '16px' }, onclick: function () { TI.forms.task(null, state.filter === 'today' ? { DueDate: U.today() } : null); } }, TI.icon('plus', 18), 'Tambah task')
    ]);
    renderList();
  }

  TI.views.tasks = {
    deps: ['tasks', 'categories', 'goals'], render: render,
    onData: function () { renderList(); return false; }
  };
})();
