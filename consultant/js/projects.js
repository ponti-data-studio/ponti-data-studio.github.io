/** projects.js — CRUD project (satu project = satu client) */
UI.routes.projects = async function (view) {
  App.projects = await Api.post('projects.list', {});
  view.innerHTML = UI.topbar('Projects', 'Satu project = satu client',
    '<button class="btn primary" id="newBtn">+ Project baru</button>') +
    '<div class="plist" id="plist"></div>';
  view.querySelector('#newBtn').addEventListener('click', function () { ProjectsPage.form(); });

  const wrap = view.querySelector('#plist');
  if (!App.projects.length) {
    wrap.innerHTML = '<div class="card empty"><div class="big">▤</div>Belum ada project. Mulai dari tombol <b>+ Project baru</b>.</div>';
    return;
  }
  App.projects.forEach(function (p) {
    const c = Number(p.coverage || 0);
    const item = U.el('<div class="card pitem">' +
      '<div class="info"><b>' + U.esc(p.clientName) + '</b>' +
      '<span>' + U.esc(p.company || '-') + ' · ' + U.esc(p.businessType || 'bisnis belum diketahui') +
      ' · ' + U.esc(p.status || '-') + '</span>' +
      (p.notes ? '<span class="small">📝 ' + U.esc(String(p.notes).slice(0, 90)) + '</span>' : '') + '</div>' +
      '<span class="chip">' + c + '%</span>' +
      '<button class="iconbtn" data-act="open" title="Buka konsultasi">✦</button>' +
      '<button class="iconbtn" data-act="edit" title="Edit">✎</button>' +
      '<button class="iconbtn" data-act="del" title="Hapus">🗑</button></div>');
    item.querySelector('[data-act=open]').addEventListener('click', function () {
      App.currentProjectId = p.id; App.current = null; location.hash = '#/consultation';
    });
    item.querySelector('[data-act=edit]').addEventListener('click', function () { ProjectsPage.form(p); });
    item.querySelector('[data-act=del]').addEventListener('click', function () { ProjectsPage.del(p); });
    wrap.appendChild(item);
  });
};

const ProjectsPage = {
  async form(p) {
    p = p || {};
    const { value } = await Swal.fire({
      title: p.id ? 'Edit project' : 'Project baru',
      html:
        '<input id="f1" class="swal2-input" placeholder="Nama client *" value="' + U.esc(p.clientName || '') + '">' +
        '<input id="f2" class="swal2-input" placeholder="Nama perusahaan" value="' + U.esc(p.company || '') + '">' +
        '<input id="f3" class="swal2-input" placeholder="Jenis bisnis" value="' + U.esc(p.businessType || '') + '">' +
        '<input id="f4" class="swal2-input" placeholder="Status (Discovery/On Hold/…)" value="' + U.esc(p.status || 'Discovery') + '">' +
        '<textarea id="f5" class="swal2-textarea" placeholder="Catatan">' + U.esc(p.notes || '') + '</textarea>',
      showCancelButton: true, confirmButtonText: 'Simpan', cancelButtonText: 'Batal',
      preConfirm: function () {
        const v = function (id) { return document.getElementById(id).value.trim(); };
        if (!v('f1')) { Swal.showValidationMessage('Nama client wajib diisi'); return false; }
        return { id: p.id, clientName: v('f1'), company: v('f2'), businessType: v('f3'), status: v('f4'), notes: v('f5') };
      }
    });
    if (!value) return;
    UI.loading('Menyimpan…');
    try {
      const saved = await Api.post('projects.save', value);
      if (!p.id) App.currentProjectId = saved.id;
      App.current = null;
      UI.closeLoading(); UI.toast('success', 'Project disimpan'); UI.route();
    } catch (err) { UI.closeLoading(); UI.error(err); }
  },

  async del(p) {
    const r = await Swal.fire({ icon: 'warning', title: 'Hapus project "' + p.clientName + '"?',
      text: 'Seluruh percakapan, fakta, dan dokumen project ini ikut terhapus permanen.',
      showCancelButton: true, confirmButtonText: 'Hapus', cancelButtonText: 'Batal', confirmButtonColor: '#DC2626' });
    if (!r.isConfirmed) return;
    UI.loading('Menghapus…');
    try {
      await Api.post('projects.delete', { id: p.id });
      if (App.currentProjectId === p.id) { App.currentProjectId = ''; App.current = null; }
      UI.closeLoading(); UI.toast('success', 'Project dihapus'); UI.route();
    } catch (err) { UI.closeLoading(); UI.error(err); }
  }
};
