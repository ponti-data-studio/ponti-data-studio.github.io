/**
 * Mytime — views/journal.js
 * Jurnal harian opsional. Isi jurnal tidak ditampilkan di insight atau audit log.
 */
(function () {
  'use strict';
  var TI = window.TI;
  var U = TI.util, h = U.h;
  var date = null;
  var dirty = false;
  var QUESTIONS = [
    ['Accomplishments', 'Apa yang berhasil saya selesaikan hari ini?'],
    ['Lessons', 'Apa yang saya pelajari?'],
    ['Distractions', 'Apa yang paling banyak mengganggu fokus?'],
    ['Improvements', 'Apa yang perlu saya perbaiki?'],
    ['Gratitude', 'Apa yang saya syukuri hari ini?'],
    ['TomorrowPriorities', 'Apa tiga prioritas untuk besok?']
  ];

  function entryFor(d) { return TI.repo.list('journal').filter(function (j) { return j.Date === d; })[0] || null; }

  function render(el, params) {
    var today = U.today();
    if (params && params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) && params.date <= today) { date = params.date; params.date = null; }
    date = date || today;
    dirty = false;
    U.clear(el);
    var existing = entryFor(date);
    var inputs = {};
    var nav = h('div', { class: 'row between' },
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Hari sebelumnya', onclick: function () { go(U.addDays(date, -1)); } }, TI.icon('chevron-left')),
      h('h2', { text: date === today ? 'Hari ini' : U.fmtDateLong(date) }),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Hari berikutnya', disabled: date >= today, onclick: function () { go(U.addDays(date, 1)); } }, TI.icon('chevron-right')));
    function go(d) {
      if (dirty) {
        TI.ui.confirm('Buang perubahan?', 'Jurnal yang belum disimpan akan hilang.', { confirmText: 'Buang', danger: true }).then(function (ok) { if (ok) { date = d; render(el, {}); } });
      } else { date = d; render(el, {}); }
    }
    var form = h('form', { class: 'panel', novalidate: true, style: { marginTop: '8px' } }, QUESTIONS.map(function (q) {
      var t = TI.forms.textarea({ value: existing ? existing[q[0]] : '', maxlength: '5000', rows: q[0] === 'TomorrowPriorities' ? '4' : '3', placeholder: q[0] === 'TomorrowPriorities' ? '1.\n2.\n3.' : '' });
      t.addEventListener('input', function () { dirty = true; });
      inputs[q[0]] = t;
      return TI.forms.field(q[1], t);
    }), h('button', { type: 'submit', class: 'btn primary block', style: { marginTop: '16px' } }, existing ? 'Simpan perubahan' : 'Simpan jurnal'));
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var rec = Object.assign({}, entryFor(date) || {}, { Date: date });
      var any = false;
      QUESTIONS.forEach(function (q) { rec[q[0]] = inputs[q[0]].value.trim(); if (rec[q[0]]) any = true; });
      if (!any && !entryFor(date)) { TI.ui.toast('Isi minimal satu pertanyaan', 'info'); return; }
      TI.repo.save('journal', rec).then(function () { dirty = false; TI.ui.toast('Jurnal disimpan'); }, TI.ui.alertError);
    });

    var recent = TI.repo.list('journal').filter(function (j) { return j.Date !== date; })
      .sort(function (a, b) { return b.Date.localeCompare(a.Date); }).slice(0, 14);
    U.append(el, [
      nav,
      h('p', { class: 'small muted', text: 'Jurnal bersifat opsional. Jawab yang terasa relevan saja.' }),
      form,
      existing ? h('button', { type: 'button', class: 'btn ghost danger block', style: { marginTop: '8px' }, onclick: function () {
        TI.ui.confirm('Hapus jurnal tanggal ini?', '', { danger: true, confirmText: 'Hapus' }).then(function (ok) {
          if (ok) TI.repo.remove('journal', existing.JournalID).then(function () { TI.ui.toast('Jurnal dihapus'); });
        });
      } }, TI.icon('trash-2', 18), 'Hapus jurnal ini') : null,
      recent.length ? TI.ui.blockTitle('Jurnal sebelumnya') : null,
      recent.length ? h('div', { class: 'list' }, recent.map(function (j) {
        var filled = QUESTIONS.filter(function (q) { return j[q[0]]; }).length;
        return h('div', { class: 'item tap', onclick: function () { go(j.Date); } }, h('div', { class: 'item-main' },
          h('div', { class: 'item-title', text: U.fmtDateLong(j.Date) }), h('div', { class: 'item-meta', text: filled + ' dari 6 pertanyaan terisi' })), TI.icon('chevron-right', 18));
      })) : null,
      h('p', { class: 'xs muted', style: { marginTop: '12px' }, text: 'Isi jurnal disimpan di perangkat ini dan di Google Sheets milikmu. Isinya tidak dicatat di audit log maupun ditampilkan di insight.' })
    ]);
  }

  TI.views.journal = { deps: ['journal'], render: render, onData: function () { return dirty ? false : undefined; } };
})();
