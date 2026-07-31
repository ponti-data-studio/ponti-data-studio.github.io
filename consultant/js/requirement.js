/** requirement.js — Generated Requirement: dokumen 13 seksi + Database Prompt, edit & export */
UI.routes.requirement = async function (view) {
  if (!App.projects.length) App.projects = await Api.post('projects.list', {});
  view.innerHTML = UI.topbar('Generated Requirement', 'Dokumen requirement & prompt teknis — tergenerate saat coverage memenuhi syarat');
  const bar = view.querySelector('.topbar');
  bar.insertBefore(UI.projectPicker(function () { UI.route(); }), bar.querySelector('.sub'));

  if (!App.currentProjectId) {
    view.appendChild(U.el('<div class="card empty"><div class="big">≣</div>Pilih project terlebih dahulu.</div>'));
    return;
  }
  const d = await UI.loadCurrent();
  const overall = d.overall, phase = d.phase, locked = overall < 80;

  view.appendChild(U.el('<div class="card"><div class="row" style="gap:18px">' + UI.covRing(overall) +
    '<div>' + UI.phaseChip(phase) +
    '<p class="small muted" style="margin:8px 0 0">' + (locked ?
      'Coverage minimal <b>80%</b> untuk menyusun requirement (saat ini ' + overall + '%). Lanjutkan menggali informasi di halaman Consultation.' :
      overall >= 95 ? 'Coverage ≥95% — dokumen final & database prompt siap digenerate.' :
      'Coverage 80–95% — Anda boleh mulai menyusun draft requirement.') + '</p>' +
    '<div class="row" style="margin-top:12px">' +
    '<button class="btn primary" id="genReq"' + (locked ? ' disabled' : '') + '>≣ Generate Requirement</button>' +
    '<button class="btn" id="genDb"' + (locked ? ' disabled' : '') + '>⌗ Generate Database Prompt</button>' +
    '</div></div></div></div>'));

  view.querySelector('#genReq').addEventListener('click', function () { ReqPage.generate('req.generate'); });
  view.querySelector('#genDb').addEventListener('click', function () { ReqPage.generate('req.dbPrompt'); });

  const docs = (d.requirements || []).slice().reverse();
  const list = U.el('<div class="doclist"><h2 style="margin:18px 0 10px">Dokumen (' + docs.length + ')</h2></div>');
  view.appendChild(list);
  if (!docs.length) list.appendChild(U.el('<div class="card empty small">Belum ada dokumen tergenerate.</div>'));
  docs.forEach(function (doc) {
    const item = U.el('<div class="card pitem"><div class="info"><b>' +
      (doc.type === 'dbPrompt' ? '⌗ ' : '≣ ') + U.esc(doc.title) + '</b>' +
      '<span>' + U.fmtDate(doc.createdAt) + '</span></div>' +
      '<button class="iconbtn" title="Hapus">✕</button></div>');
    item.addEventListener('click', function (e) {
      if (e.target.closest('.iconbtn')) return;
      ReqPage.open(doc);
    });
    item.querySelector('.iconbtn').addEventListener('click', async function () {
      const r = await Swal.fire({ icon: 'warning', title: 'Hapus dokumen ini?', showCancelButton: true,
        confirmButtonText: 'Hapus', cancelButtonText: 'Batal', confirmButtonColor: '#DC2626' });
      if (!r.isConfirmed) return;
      await Api.post('req.delete', { id: doc.id });
      App.current = null; UI.toast('success', 'Dokumen dihapus'); UI.route();
    });
    list.appendChild(item);
  });
};

const ReqPage = {
  async generate(action) {
    UI.loading('AI sedang menyusun dokumen…\nIni bisa memakan waktu 30–60 detik');
    try {
      await Api.post(action, { projectId: App.currentProjectId });
      App.current = null;
      UI.closeLoading(); UI.toast('success', 'Dokumen berhasil dibuat'); UI.route();
    } catch (err) { UI.closeLoading(); UI.error(err); }
  },

  open(doc) {
    const view = document.getElementById('view');
    view.innerHTML = UI.topbar(U.esc(doc.title), 'Edit dokumen di bawah, simpan, lalu export sesuai kebutuhan',
      '<button class="btn ghost sm" id="backBtn">← Kembali</button>');
    view.appendChild(U.el('<div class="card">' +
      '<div class="row" style="margin-bottom:12px">' +
      '  <button class="btn primary sm" id="saveDoc">💾 Simpan perubahan</button>' +
      '  <button class="btn sm" id="expCopy">📋 Copy</button>' +
      '  <button class="btn sm" id="expMd">⬇ Markdown</button>' +
      '  <button class="btn sm" id="expDoc">⬇ Word</button>' +
      '  <button class="btn sm" id="expPdf">🖨 PDF</button></div>' +
      '<textarea class="input mono doc-editor" id="docBody">' + U.esc(doc.content) + '</textarea></div>'));

    const body = function () { return view.querySelector('#docBody').value; };
    view.querySelector('#backBtn').addEventListener('click', function () { UI.route(); });
    view.querySelector('#saveDoc').addEventListener('click', async function () {
      UI.loading('Menyimpan…');
      try {
        await Api.post('req.update', { id: doc.id, title: doc.title, content: body() });
        App.current = null; UI.closeLoading(); UI.toast('success', 'Dokumen disimpan');
      } catch (err) { UI.closeLoading(); UI.error(err); }
    });
    view.querySelector('#expCopy').addEventListener('click', function () { ExportService.copy(body(), 'Dokumen disalin'); });
    view.querySelector('#expMd').addEventListener('click', function () { ExportService.markdown(doc.title, body()); });
    view.querySelector('#expDoc').addEventListener('click', function () { ExportService.word(doc.title, body()); });
    view.querySelector('#expPdf').addEventListener('click', function () { ExportService.pdf(doc.title, body()); });
  }
};
