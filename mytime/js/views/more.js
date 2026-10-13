/**
 * Mytime — views/more.js
 */
(function () {
  'use strict';
  var TI = window.TI;
  var U = TI.util, h = U.h;
  var HINTS = {
    track: 'Timer dan catatan waktu manual',
    habits: 'Kebiasaan harian & mingguan',
    budget: 'Target jam per minggu tiap kategori',
    calendar: 'Tenggat, target, dan agenda',
    analytics: 'Grafik, skor, distraksi, simulator',
    review: 'Evaluasi harian & mingguan',
    journal: 'Refleksi harian (opsional)',
    settings: 'Keamanan, kategori, sinkronisasi, data'
  };

  function render(el) {
    U.clear(el);
    var S = TI.ui.SECTIONS;
    el.appendChild(h('div', { class: 'list more-list' }, TI.ui.MORE_ORDER.map(function (k) {
      return h('button', { type: 'button', class: 'item tap', style: { width: '100%', border: '0', borderTop: '1px solid var(--line)', textAlign: 'left', font: 'inherit' }, onclick: function () { TI.ui.showSection(k, k === 'review' ? { tab: 'weekly' } : null); } },
        TI.icon(S[k].icon), h('div', { class: 'item-main' }, h('div', { class: 'item-title', text: k === 'review' ? 'Weekly Review' : S[k].title }), h('div', { class: 'item-meta', text: HINTS[k] })),
        TI.icon('chevron-right', 18));
    })));
    el.appendChild(h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '28px' } },
      h('button', { type: 'button', class: 'btn ghost', onclick: function () { TI.auth.lock('manual'); } }, TI.icon('lock', 18), 'Kunci aplikasi')));
    el.appendChild(h('p', { class: 'xs muted', style: { textAlign: 'center', marginTop: '8px' }, text: 'Waktu adalah aset yang tidak bisa dikembalikan. Gunakan waktu hari ini untuk membangun kehidupan yang ingin kamu miliki di masa depan.' }));
  }

  TI.views.more = { deps: [], render: render };
})();
