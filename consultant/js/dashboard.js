/** dashboard.js — ringkasan project & coverage */
UI.routes.dashboard = async function (view) {
  App.projects = await Api.post('projects.list', {});
  const P = App.projects;
  const avg = P.length ? Math.round(P.reduce(function (s, p) { return s + Number(p.coverage || 0); }, 0) / P.length) : 0;
  const byPhase = { DISCOVERY: 0, DRAFT: 0, FINAL: 0 };
  P.forEach(function (p) {
    const c = Number(p.coverage || 0);
    byPhase[c >= 95 ? 'FINAL' : c >= 80 ? 'DRAFT' : 'DISCOVERY']++;
  });

  view.innerHTML = UI.topbar('Dashboard', 'Halo, ' + U.esc(App.user.name || App.user.username) + ' — ringkasan seluruh konsultasi berjalan') +
    '<div class="stat-grid">' +
    '  <div class="card stat"><div class="num">' + P.length + '</div><div class="lbl">Total Project</div></div>' +
    '  <div class="card stat"><div class="num">' + avg + '%</div><div class="lbl">Rata-rata Coverage</div></div>' +
    '  <div class="card stat"><div class="num">' + byPhase.DISCOVERY + '</div><div class="lbl">Fase Discovery</div></div>' +
    '  <div class="card stat"><div class="num">' + (byPhase.DRAFT + byPhase.FINAL) + '</div><div class="lbl">Siap Requirement</div></div>' +
    '</div>' +
    '<div class="card"><h2>Project terbaru</h2><div class="plist" id="recent"></div></div>';

  const wrap = view.querySelector('#recent');
  if (!P.length) {
    wrap.innerHTML = '<div class="empty"><div class="big">✦</div>Belum ada project.<br>' +
      '<button class="btn primary" style="margin-top:12px" onclick="location.hash=\'#/projects\'">Buat project pertama</button></div>';
    return;
  }
  P.slice(0, 6).forEach(function (p) {
    const c = Number(p.coverage || 0);
    const item = U.el('<div class="card pitem">' +
      '<div class="info"><b>' + U.esc(p.clientName) + '</b>' +
      '<span>' + U.esc(p.company || p.businessType || '-') + ' · update ' + U.fmtDate(p.updatedAt) + '</span></div>' +
      UI.phaseChip(c >= 95 ? 'FINAL' : c >= 80 ? 'DRAFT' : 'DISCOVERY') +
      '<span class="chip">' + c + '%</span></div>');
    item.addEventListener('click', function () {
      App.currentProjectId = p.id; App.current = null;
      location.hash = '#/consultation';
    });
    wrap.appendChild(item);
  });
};
