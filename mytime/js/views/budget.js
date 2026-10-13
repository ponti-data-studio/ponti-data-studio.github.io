/**
 * Mytime — views/budget.js (Time Budget)
 * Target mingguan per kategori: target, aktual, selisih, persentase pencapaian.
 */
(function () {
  'use strict';
  var TI = window.TI;
  var U = TI.util, h = U.h, C = TI.calc;
  var weekStart = null;

  function render(el) {
    U.clear(el);
    var today = U.today();
    var wso = Number(TI.repo.setting('weekStartsOn', '1'));
    var current = U.startOfWeek(today, wso);
    weekStart = weekStart || current;
    var weekEnd = U.addDays(weekStart, 6);
    var until = weekEnd < today ? weekEnd : today;
    var rows = C.budgetStatus(TI.repo.snapshot(), weekStart, until);
    var totalT = 0, totalA = 0;
    rows.forEach(function (r) { totalT += r.target; totalA += Math.min(r.actual, r.target); });

    var nav = h('div', { class: 'row between' },
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Minggu sebelumnya', onclick: function () { weekStart = U.addDays(weekStart, -7); render(el); } }, TI.icon('chevron-left')),
      h('div', { style: { textAlign: 'center' } }, h('h2', { text: weekStart === current ? 'Minggu ini' : U.fmtDateShort(weekStart) + ' – ' + U.fmtDateShort(weekEnd) }),
        h('div', { class: 'small muted', text: weekStart === current ? U.fmtDateShort(weekStart) + ' – ' + U.fmtDateShort(weekEnd) : '' })),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Minggu berikutnya', disabled: weekStart >= current, onclick: function () { weekStart = U.addDays(weekStart, 7); render(el); } }, TI.icon('chevron-right')));

    var list = rows.length ? h('div', { class: 'list' }, rows.map(function (r) {
      var pct = r.pct || 0;
      var tone = pct >= 100 ? 'ok' : '';
      return h('div', { class: 'item tap', onclick: function () { TI.forms.budget(r.budget); } },
        h('div', { class: 'item-main' },
          h('div', { class: 'row between' }, h('span', { class: 'row', style: { gap: '8px' } }, TI.ui.categoryDot(r.category), h('span', { class: 'item-title', text: r.category.Name })),
            h('span', { class: 'item-side', text: (r.pct === null ? '–' : r.pct + '%') })),
          h('div', { style: { margin: '8px 0 6px' } }, TI.ui.progressBar(pct, { tone: tone, color: tone ? null : r.category.Color, label: 'Pencapaian ' + r.category.Name })),
          h('div', { class: 'item-meta num' },
            h('span', { text: 'Target ' + U.fmtMinutes(r.target) }),
            h('span', { text: 'Aktual ' + U.fmtMinutes(r.actual) }),
            h('span', { text: r.diff >= 0 ? 'Lebih ' + U.fmtMinutes(r.diff) : 'Kurang ' + U.fmtMinutes(-r.diff) }))));
    })) : h('div', { class: 'list' }, TI.ui.emptyState('wallet', 'Tentukan berapa jam per minggu yang ingin kamu investasikan untuk tiap area hidup. Targetmu, aturanmu.', { label: 'Atur target', onClick: function () { TI.forms.budget(); } }));

    U.append(el, [
      nav,
      rows.length ? h('div', { class: 'panel', style: { margin: '12px 0' } },
        h('div', { class: 'row between' }, h('span', { class: 'small muted', text: 'Total target terpenuhi' }), h('b', { class: 'num', text: totalT ? Math.round(totalA / totalT * 100) + '%' : '–' })),
        h('div', { style: { marginTop: '8px' } }, TI.ui.progressBar(totalT ? totalA / totalT * 100 : 0, { lg: true }))) : null,
      list,
      h('p', { class: 'xs muted', style: { marginTop: '10px' }, text: 'Aktual dihitung dari waktu tercatat tanpa hitung ganda. Untuk minggu berjalan, angka dihitung sampai hari ini.' }),
      h('button', { type: 'button', class: 'btn block', style: { marginTop: '12px' }, onclick: function () { TI.forms.budget(); } }, TI.icon('plus', 18), 'Tambah target kategori')
    ]);
  }

  TI.views.budget = { deps: ['timeBudgets', 'timeEntries', 'categories', 'settings'], render: render };
})();
