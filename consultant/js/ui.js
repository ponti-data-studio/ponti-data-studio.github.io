/** ui.js — state global, shell (sidebar/topbar), router, tema, toast, komponen bersama */
const App = {
  user: null,
  projects: [],
  current: null,           // data lengkap project aktif (hasil projects.get)
  settings: null,
  get currentProjectId() { return localStorage.getItem('aca_project') || ''; },
  set currentProjectId(v) { v ? localStorage.setItem('aca_project', v) : localStorage.removeItem('aca_project'); }
};

const UI = {
  routes: {},
  NAV: [
    { id: 'dashboard',    ic: '◫', label: 'Dashboard' },
    { id: 'projects',     ic: '▤', label: 'Projects' },
    { id: 'consultation', ic: '✦', label: 'Consultation' },
    { id: 'knowledge',    ic: '◆', label: 'Knowledge' },
    { id: 'requirement',  ic: '≣', label: 'Generated Requirement' },
    { id: 'settings',     ic: '⚙', label: 'Settings' }
  ],

  toast(icon, title) {
    Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 2600,
      timerProgressBar: true, customClass: { popup: 'aca-toast' } }).fire({ icon: icon, title: title });
  },

  loading(title) {
    Swal.fire({ title: title || 'Memproses…', allowOutsideClick: false, allowEscapeKey: false,
      didOpen: function () { Swal.showLoading(); } });
  },
  closeLoading() { Swal.close(); },

  error(err) { Swal.fire({ icon: 'error', title: 'Ups', text: String(err && err.message || err) }); },

  theme(mode) {
    const m = mode || localStorage.getItem('aca_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', m);
    localStorage.setItem('aca_theme', m);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', m === 'dark' ? '#0C1120' : '#F3F5FA');
  },
  toggleTheme() {
    this.theme((localStorage.getItem('aca_theme') || 'dark') === 'dark' ? 'light' : 'dark');
  },

  /* ---------- Shell + Router ---------- */
  renderShell() {
    const root = document.getElementById('app');
    root.innerHTML = '';
    const nav = this.NAV.map(function (n) {
      return '<button class="nav-item" data-route="' + n.id + '">' +
        '<span class="ic">' + n.ic + '</span><span class="txt">' + n.label + '</span></button>';
    }).join('');
    root.appendChild(U.el(
      '<div class="shell">' +
      '  <aside class="sidebar">' +
      '    <div class="brand"><img src="icons/icon.svg" alt="">' +
      '      <b>AI Consultant<small>Assistant</small></b></div>' + nav +
      '    <div class="spacer"></div>' +
      '    <button class="nav-item" id="themeBtn"><span class="ic">◐</span><span class="txt">Ganti tema</span></button>' +
      '    <div class="userbox"><b>' + U.esc(App.user.name || App.user.username) + '</b>' +
      '      <a href="#" id="logoutBtn">Keluar</a></div>' +
      '  </aside>' +
      '  <main class="main" id="view"></main>' +
      '</div>'));
    root.querySelectorAll('[data-route]').forEach(function (b) {
      b.addEventListener('click', function () { location.hash = '#/' + b.dataset.route; });
    });
    root.querySelector('#themeBtn').addEventListener('click', function () { UI.toggleTheme(); });
    root.querySelector('#logoutBtn').addEventListener('click', function (e) {
      e.preventDefault(); AuthPage.logout();
    });
  },

  async route() {
    if (!App.user) { AuthPage.render(); return; }
    if (!document.getElementById('view')) this.renderShell();
    const name = (location.hash.replace('#/', '') || 'dashboard').split('?')[0];
    const page = this.routes[name] || this.routes.dashboard;
    document.querySelectorAll('.nav-item[data-route]').forEach(function (b) {
      b.classList.toggle('active', b.dataset.route === name);
    });
    const view = document.getElementById('view');
    view.innerHTML = '<div class="empty"><div class="big">⏳</div>Memuat…</div>';
    try { await page(view); }
    catch (err) { view.innerHTML = ''; view.appendChild(U.el('<div class="card"><h2>Terjadi kesalahan</h2><p class="muted">' + U.esc(err.message || err) + '</p></div>')); }
    view.focus && view.focus();
  },

  /* ---------- Komponen bersama ---------- */

  topbar(title, sub, actionsHtml) {
    return '<div class="topbar"><h1>' + title + '</h1>' + (actionsHtml || '') +
      (sub ? '<div class="sub">' + sub + '</div>' : '') + '</div>';
  },

  /** Dropdown pemilih project — dipakai Consultation, Knowledge, Requirement */
  projectPicker(onChange) {
    const opts = App.projects.map(function (p) {
      return '<option value="' + p.id + '"' + (p.id === App.currentProjectId ? ' selected' : '') + '>' +
        U.esc(p.clientName) + (p.company ? ' — ' + U.esc(p.company) : '') + '</option>';
    }).join('');
    const sel = U.el('<select class="input" style="max-width:290px" aria-label="Pilih project">' +
      '<option value="">— Pilih project —</option>' + opts + '</select>');
    sel.addEventListener('change', async function () {
      App.currentProjectId = sel.value; App.current = null;
      if (sel.value) await UI.loadCurrent();
      onChange && onChange();
    });
    return sel;
  },

  async loadCurrent(force) {
    if (!App.currentProjectId) { App.current = null; return null; }
    if (App.current && App.current.project.id === App.currentProjectId && !force) return App.current;
    App.current = await Api.post('projects.get', { id: App.currentProjectId });
    return App.current;
  },

  phaseChip(phase) {
    if (phase === 'FINAL') return '<span class="chip ok">FINAL — dokumen siap</span>';
    if (phase === 'DRAFT') return '<span class="chip accent">DRAFT — requirement boleh disusun</span>';
    return '<span class="chip warn">DISCOVERY — gali informasi lagi</span>';
  },

  /** Elemen tanda tangan: ring coverage keseluruhan */
  covRing(pct) {
    const r = 50, C = 2 * Math.PI * r, off = C * (1 - (pct || 0) / 100);
    return '<div class="covring" role="img" aria-label="Coverage ' + pct + ' persen">' +
      '<svg width="118" height="118" viewBox="0 0 118 118">' +
      '<defs><linearGradient id="covgrad" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="#2FD4B8"/><stop offset="1" stop-color="#4F63E7"/></linearGradient></defs>' +
      '<circle class="track" cx="59" cy="59" r="' + r + '" fill="none" stroke-width="10"/>' +
      '<circle class="val" cx="59" cy="59" r="' + r + '" fill="none" stroke-width="10" ' +
      'stroke-dasharray="' + C + '" stroke-dashoffset="' + off + '"/></svg>' +
      '<div class="pct">' + (pct || 0) + '<span style="font-size:.55em">%</span></div></div>';
  },

  covBars(covMap) {
    const cats = ['Business Context', 'Problem', 'Workflow', 'Users', 'Role', 'Feature', 'Dashboard',
      'Report', 'Automation', 'Notification', 'Integration', 'Database', 'Platform', 'Security'];
    return cats.map(function (c) {
      const v = Math.round(covMap && covMap[c] || 0);
      return '<div class="covbar' + (v < 50 ? ' low' : '') + '"><div class="t"><b>' + c + '</b><span>' + v + '%</span></div>' +
        '<div class="bar"><div class="fill" style="width:' + v + '%"></div></div></div>';
    }).join('');
  }
};

window.addEventListener('hashchange', function () { UI.route(); });
