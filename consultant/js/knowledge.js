/** knowledge.js — fact base per project (memory yang bisa diedit manual) */
UI.routes.knowledge = async function (view) {
  if (!App.projects.length) App.projects = await Api.post('projects.list', {});
  view.innerHTML = UI.topbar('Knowledge', 'Fakta terstruktur yang diingat AI untuk project ini — semua dapat diedit');
  const bar = view.querySelector('.topbar');
  bar.insertBefore(UI.projectPicker(function () { UI.route(); }), bar.querySelector('.sub'));

  if (!App.currentProjectId) {
    view.appendChild(U.el('<div class="card empty"><div class="big">◆</div>Pilih project untuk melihat knowledge base-nya.</div>'));
    return;
  }
  await UI.loadCurrent();
  const facts = App.current.facts || [];

  const card = U.el('<div class="card"><h2><span class="ic">◆</span>Important Facts (' + facts.length + ')</h2>' +
    '<div id="kfacts"></div>' +
    '<button class="btn primary sm" id="kadd" style="margin-top:12px">+ Tambah fakta</button></div>');
  view.appendChild(card);

  const groups = {};
  facts.forEach(function (f) { (groups[f.category] = groups[f.category] || []).push(f); });
  const wrap = card.querySelector('#kfacts');
  if (!facts.length) wrap.innerHTML = '<p class="muted small">Belum ada fakta — fakta terisi otomatis dari hasil analisis, atau tambahkan manual.</p>';
  Object.keys(groups).sort().forEach(function (cat) {
    wrap.appendChild(U.el('<h3 style="margin-top:14px">' + U.esc(cat) + '</h3>'));
    groups[cat].forEach(function (f) {
      const line = U.el('<div class="factline"><span class="tx">' + U.esc(f.fact) + '</span>' +
        '<span class="small muted">' + (f.source === 'manual' ? 'manual' : 'AI') + '</span>' +
        '<span class="acts"><button class="iconbtn" title="Edit">✎</button>' +
        '<button class="iconbtn" title="Hapus">✕</button></span></div>');
      line.querySelectorAll('button')[0].addEventListener('click', function () { Knowledge.factForm(f, function () { UI.route(); }); });
      line.querySelectorAll('button')[1].addEventListener('click', async function () {
        await Api.post('fact.update', { id: f.id, category: f.category, fact: f.fact, status: 'removed' });
        App.current = null; UI.toast('success', 'Fakta dihapus'); UI.route();
      });
      wrap.appendChild(line);
    });
  });
  card.querySelector('#kadd').addEventListener('click', function () { Knowledge.factForm(null, function () { UI.route(); }); });
};

const Knowledge = {
  async factForm(f, done) {
    const isEdit = !!(f && f.id);
    const { value } = await Swal.fire({
      title: isEdit ? 'Edit fakta' : 'Tambah fakta',
      html: '<input id="fc" class="swal2-input" placeholder="Kategori (Users, Feature, …)" value="' + U.esc(f ? f.category : '') + '">' +
            '<textarea id="ff" class="swal2-textarea" placeholder="Fakta">' + U.esc(f ? f.fact : '') + '</textarea>',
      showCancelButton: true, confirmButtonText: 'Simpan', cancelButtonText: 'Batal',
      preConfirm: function () {
        const cat = document.getElementById('fc').value.trim() || 'General';
        const fact = document.getElementById('ff').value.trim();
        if (!fact) { Swal.showValidationMessage('Fakta tidak boleh kosong'); return false; }
        return { category: cat, fact: fact };
      }
    });
    if (!value) return;
    try {
      if (isEdit) await Api.post('fact.update', { id: f.id, category: value.category, fact: value.fact, status: 'active' });
      else await Api.post('fact.add', { projectId: App.currentProjectId, category: value.category, fact: value.fact });
      App.current = null; await UI.loadCurrent();
      UI.toast('success', 'Fakta disimpan');
      done && done();
    } catch (err) { UI.error(err); }
  }
};
