/** consultation.js — halaman inti 2 panel:
 *  KIRI: timeline percakapan + paste chat + upload/drag-drop file
 *  KANAN: hasil analisis AI (coverage, missing info, suggested reply, dst) */
const Consult = { attachments: [], messages: [] };

UI.routes.consultation = async function (view) {
  if (!App.projects.length) App.projects = await Api.post('projects.list', {});
  view.innerHTML = UI.topbar('Consultation', 'Paste chat client atau upload file, lalu biarkan AI menganalisis');
  const bar = view.querySelector('.topbar');
  bar.insertBefore(UI.projectPicker(function () { UI.route(); }), bar.querySelector('.sub'));

  if (!App.currentProjectId) {
    view.appendChild(U.el('<div class="card empty"><div class="big">✦</div>Pilih project dulu di atas,<br>atau buat project baru di menu Projects.</div>'));
    return;
  }
  await UI.loadCurrent();
  Consult.attachments = [];
  Consult.messages = [];

  const grid = U.el('<div class="consult"><div id="colL"></div><div id="colR"></div></div>');
  view.appendChild(grid);
  Consult.renderLeft(grid.querySelector('#colL'));
  Consult.renderRight(grid.querySelector('#colR'));
};

Consult.renderLeft = function (col) {
  const msgs = App.current.messages || [];
  col.innerHTML =
    '<div class="card"><h2><span class="ic">💬</span>Conversation Timeline</h2>' +
    '  <div class="timeline" id="timeline">' + (msgs.length ? '' :
      '<div class="empty small">Belum ada percakapan.<br>Paste chat pertama client di bawah.</div>') + '</div></div>' +
    '<div class="card"><h2><span class="ic">📥</span>Data baru dari client</h2>' +
    '  <p class="small muted" style="margin:0 0 10px">Client kirim beberapa pesan beruntun? Tambahkan satu per satu agar tetap terpisah,' +
    '  atau langsung paste semuanya jadi satu lalu klik Analisis.</p>' +
    '  <div id="queue"></div>' +
    '  <div class="field"><textarea class="input" id="chatInput" rows="4" placeholder="Paste satu pesan/chat client di sini…"></textarea></div>' +
    '  <div class="row" style="margin:-6px 0 10px"><button class="btn ghost sm" id="addMsg">+ Tambah pesan lain (jangan gabung dulu)</button></div>' +
    '  <div class="dropzone" id="dropzone">Tarik file ke sini (boleh lebih dari satu sekaligus) atau <u>klik untuk memilih</u><br>' +
    '    <span class="small">Screenshot · Gambar · PDF · Excel · CSV · TXT (maks 8 MB / file)</span></div>' +
    '  <input type="file" id="fileInput" multiple hidden accept=".png,.jpg,.jpeg,.webp,.gif,.pdf,.xlsx,.xls,.csv,.txt,.md,.json">' +
    '  <div class="attach" id="attach"></div>' +
    '  <div class="row" style="margin-top:14px">' +
    '    <button class="btn primary" id="analyzeBtn">✦ Analisis dengan AI</button>' +
    '    <button class="btn ghost sm" id="noteBtn" title="Catat balasan yang sudah Anda kirim ke client">+ Catat balasan terkirim</button>' +
    '  </div></div>';

  const tl = col.querySelector('#timeline');
  msgs.forEach(function (m) {
    const cls = m.kind === 'file' ? 'file' : (m.source === 'ai' ? 'ai' : m.source === 'consultant' ? 'consultant' : 'client');
    const who = m.source === 'ai' ? 'Draft AI' : m.source === 'consultant' ? 'Anda' : 'Client';
    tl.appendChild(U.el('<div class="bubble ' + cls + '"><div class="meta">' + who +
      (m.fileName ? ' · 📎 ' + U.esc(m.fileName) : '') + ' · ' + U.fmtDate(m.createdAt) + '</div>' +
      U.esc(String(m.content).slice(0, 900)) + (String(m.content).length > 900 ? '…' : '') + '</div>'));
  });
  tl.scrollTop = tl.scrollHeight;

  // Upload & drag-drop
  const dz = col.querySelector('#dropzone'), fi = col.querySelector('#fileInput');
  dz.addEventListener('click', function () { fi.click(); });
  fi.addEventListener('change', function () { Consult.addFiles(fi.files, col); fi.value = ''; });
  ['dragover', 'dragenter'].forEach(function (ev) {
    dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.add('over'); });
  });
  ['dragleave', 'drop'].forEach(function (ev) {
    dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.remove('over'); });
  });
  dz.addEventListener('drop', function (e) { Consult.addFiles(e.dataTransfer.files, col); });

  col.querySelector('#analyzeBtn').addEventListener('click', function () { Consult.analyze(col); });
  col.querySelector('#noteBtn').addEventListener('click', function () { Consult.addNote(); });
  col.querySelector('#addMsg').addEventListener('click', function () { Consult.queueMessage(col); });
  Consult.renderQueue(col);
};

Consult.queueMessage = function (col) {
  const box = col.querySelector('#chatInput');
  const v = box.value.trim();
  if (!v) { UI.toast('warning', 'Tulis/paste pesan dulu sebelum menambah'); return; }
  Consult.messages.push(v);
  box.value = '';
  Consult.renderQueue(col);
  box.focus();
};

Consult.renderQueue = function (col) {
  const wrap = col.querySelector('#queue');
  if (!Consult.messages.length) { wrap.innerHTML = ''; return; }
  wrap.innerHTML = '<p class="small muted" style="margin:0 0 6px">' + Consult.messages.length + ' pesan siap dianalisis:</p>';
  Consult.messages.forEach(function (m, i) {
    const row = U.el('<div class="qitem"><span class="n">' + (i + 1) + '</span>' +
      '<span class="tx">' + U.esc(m.slice(0, 160)) + (m.length > 160 ? '…' : '') + '</span>' +
      '<button class="iconbtn" title="Hapus">✕</button></div>');
    row.querySelector('button').addEventListener('click', function () {
      Consult.messages.splice(i, 1); Consult.renderQueue(col);
    });
    wrap.appendChild(row);
  });
};

Consult.addFiles = async function (fileList, col) {
  for (const f of Array.from(fileList || [])) {
    try {
      const parsed = await FileParser.parse(f);
      Consult.attachments.push(parsed);
    } catch (err) { UI.toast('error', err.message); }
  }
  Consult.renderAttach(col);
};

Consult.renderAttach = function (col) {
  const wrap = col.querySelector('#attach');
  wrap.innerHTML = '';
  Consult.attachments.forEach(function (a, i) {
    const prev = a.kind === 'image' ? '<img src="' + a.dataUrl + '" alt="">' : '';
    const chip = U.el('<span class="chip">' + prev + ' ' +
      (a.kind === 'image' ? '🖼' : a.kind === 'pdf' ? '📄' : '📊') + ' ' + U.esc(a.name) +
      ' <button class="iconbtn" title="Hapus lampiran">✕</button></span>');
    chip.querySelector('button').addEventListener('click', function () {
      Consult.attachments.splice(i, 1); Consult.renderAttach(col);
    });
    wrap.appendChild(chip);
  });
};

Consult.analyze = async function (col) {
  const box = col.querySelector('#chatInput');
  const current = box.value.trim();
  const texts = Consult.messages.slice();
  if (current) texts.push(current); // ikut sertakan yang belum ditambahkan ke antrian
  if (!texts.length && !Consult.attachments.length) { UI.toast('warning', 'Paste chat atau lampirkan file dulu'); return; }
  UI.loading('AI sedang menganalisis ' + texts.length + ' pesan & ' + Consult.attachments.length + ' lampiran…');
  try {
    App.current = await Api.post('chat.analyze', {
      projectId: App.currentProjectId, texts: texts, files: Consult.attachments
    });
    Consult.attachments = [];
    Consult.messages = [];
    UI.closeLoading(); UI.toast('success', 'Analisis selesai');
    UI.route();
  } catch (err) { UI.closeLoading(); UI.error(err); }
};

Consult.addNote = async function () {
  const { value } = await Swal.fire({
    title: 'Balasan yang Anda kirim', input: 'textarea',
    inputPlaceholder: 'Paste balasan final yang sudah dikirim ke client (untuk memory AI)…',
    showCancelButton: true, confirmButtonText: 'Simpan', cancelButtonText: 'Batal'
  });
  if (!value) return;
  try {
    await Api.post('chat.note', { projectId: App.currentProjectId, content: value });
    App.current = null; await UI.loadCurrent(); UI.toast('success', 'Tersimpan ke timeline'); UI.route();
  } catch (err) { UI.error(err); }
};

/* ---------- Panel kanan: hasil analisis ---------- */
Consult.renderRight = function (col) {
  const d = App.current, a = d.analysis;
  if (!a) {
    col.innerHTML = '<div class="card empty"><div class="big">✦</div><b>Belum ada analisis</b><br>' +
      '<span class="small">Paste chat client di panel kiri lalu klik “Analisis dengan AI”.<br>' +
      'Hasilnya — coverage, draft balasan, dan pertanyaan lanjutan — muncul di sini.</span></div>';
    return;
  }
  const contradictions = (a.contradictions || []).filter(Boolean);
  col.innerHTML =
    (contradictions.length ?
      '<div class="warnbanner"><b>⚠ Informasi bertentangan terdeteksi</b><ul style="margin:6px 0 0 18px;padding:0">' +
      contradictions.map(function (c) { return '<li>' + U.esc(c) + '</li>'; }).join('') + '</ul></div>' : '') +

    '<div class="card"><h2><span class="ic">◔</span>Requirement Coverage</h2>' +
    '  <div class="row" style="gap:18px;align-items:center;margin-bottom:12px">' + UI.covRing(d.overall) +
    '    <div>' + UI.phaseChip(d.phase) +
    '      <p class="small muted" style="margin:8px 0 0">' +
             (d.phase === 'DISCOVERY' ? 'Coverage di bawah 80% — fokus menggali informasi lewat pertanyaan lanjutan.' :
              d.phase === 'DRAFT' ? 'Coverage 80–95% — Anda sudah boleh menyusun requirement di menu Generated Requirement.' :
              'Coverage ≥95% — dokumen final & database prompt siap digenerate.') + '</p>' +
    '      <p class="small muted" style="margin:4px 0 0">Confidence AI: <b>' + (a.confidence || 0) + '%</b></p></div></div>' +
    '  <details><summary class="small" style="cursor:pointer;color:var(--muted)">Rincian 14 kategori</summary>' +
    '  <div style="margin-top:10px">' + UI.covBars(d.coverage) + '</div></details></div>' +

    '<div class="card"><h2><span class="ic">✉</span>Suggested Reply</h2>' +
    '  <textarea class="input" id="replyBox" rows="7">' + U.esc(a.suggestedReply || '') + '</textarea>' +
    '  <div class="row" style="margin-top:10px">' +
    '    <button class="btn primary sm" id="copyReply">📋 Copy</button>' +
    '    <button class="btn sm" data-style="regenerate">↻ Regenerate</button>' +
    '    <button class="btn ghost sm" data-style="formal">Lebih Formal</button>' +
    '    <button class="btn ghost sm" data-style="santai">Lebih Santai</button>' +
    '    <button class="btn ghost sm" data-style="singkat">Lebih Singkat</button>' +
    '    <button class="btn ghost sm" data-style="detail">Lebih Detail</button></div>' +
    '  <p class="small muted" style="margin:8px 0 0">Draft dapat diedit langsung. AI tidak pernah mengirim pesan otomatis — Anda yang copy & kirim.</p></div>' +

    '<div class="card"><h2><span class="ic">❔</span>Next Questions</h2><div id="nq"></div></div>' +
    '<div class="card"><h2><span class="ic">🕳</span>Missing Information</h2>' +
    '  <ul style="margin:0;padding-left:18px" class="small">' +
        (a.missingInformation || []).map(function (m) { return '<li style="margin-bottom:4px">' + U.esc(m) + '</li>'; }).join('') +
        ((a.missingInformation || []).length ? '' : '<li>Tidak ada — informasi sudah lengkap 🎉</li>') + '</ul></div>' +

    '<div class="card"><h2><span class="ic">◆</span>Important Facts</h2><div id="facts"></div>' +
    '  <button class="btn ghost sm" id="addFact" style="margin-top:8px">+ Tambah fakta manual</button></div>' +

    '<div class="card"><h2><span class="ic">⇶</span>Detected Workflow</h2>' +
    '  <ol style="margin:0;padding-left:18px" class="small">' +
        (a.workflow || []).map(function (w) { return '<li style="margin-bottom:4px">' + U.esc(w) + '</li>'; }).join('') +
        ((a.workflow || []).length ? '' : '<li>Belum terdeteksi</li>') + '</ol></div>' +

    '<div class="card"><h2><span class="ic">▣</span>Detected Entities & Summary</h2>' +
    '  <div class="row" style="margin-bottom:10px">' +
        (a.entities || []).map(function (e) { return '<span class="chip accent">' + U.esc(e) + '</span>'; }).join('') + '</div>' +
    '  <p class="small muted" style="margin:0">' + U.esc(a.summary || '') + '</p></div>';

  // Suggested reply actions
  col.querySelector('#copyReply').addEventListener('click', async function () {
    await ExportService.copy(col.querySelector('#replyBox').value, 'Balasan disalin — tinggal kirim ke client');
    const r = await Swal.fire({ icon: 'question', title: 'Tandai sebagai terkirim?',
      text: 'Simpan balasan ini ke timeline agar AI mengingatnya.',
      showCancelButton: true, confirmButtonText: 'Ya, simpan', cancelButtonText: 'Nanti' });
    if (r.isConfirmed) {
      await Api.post('chat.note', { projectId: App.currentProjectId, content: col.querySelector('#replyBox').value });
      App.current = null; await UI.loadCurrent(); UI.route();
    }
  });
  col.querySelectorAll('[data-style]').forEach(function (b) {
    b.addEventListener('click', async function () {
      UI.loading('Menyusun ulang draft…');
      try {
        const txt = await Api.post('chat.reply', { projectId: App.currentProjectId, style: b.dataset.style });
        col.querySelector('#replyBox').value = txt;
        App.current = null; // timeline berubah
        UI.closeLoading(); UI.toast('success', 'Draft baru siap');
      } catch (err) { UI.closeLoading(); UI.error(err); }
    });
  });

  // Next questions
  const nq = col.querySelector('#nq');
  const qs = (a.nextQuestions || []).slice(0, 5);
  nq.innerHTML = qs.length ? '' : '<p class="small muted">Tidak ada pertanyaan tersisa.</p>';
  qs.forEach(function (q, i) {
    const item = U.el('<div class="qitem"><span class="n">Q' + (i + 1) + '</span><span>' + U.esc(q) + '</span>' +
      '<button class="btn ghost sm">📋</button></div>');
    item.querySelector('button').addEventListener('click', function () { ExportService.copy(q, 'Pertanyaan disalin'); });
    nq.appendChild(item);
  });

  // Facts
  Consult.renderFacts(col.querySelector('#facts'));
  col.querySelector('#addFact').addEventListener('click', function () { Knowledge.factForm(null, function () { UI.route(); }); });
};

Consult.renderFacts = function (wrap) {
  const facts = App.current.facts || [];
  wrap.innerHTML = facts.length ? '' : '<p class="small muted">Belum ada fakta.</p>';
  facts.forEach(function (f) {
    const line = U.el('<div class="factline"><span class="chip cat">' + U.esc(f.category) + '</span>' +
      '<span class="tx">' + U.esc(f.fact) + '</span>' +
      '<span class="acts"><button class="iconbtn" title="Edit">✎</button>' +
      '<button class="iconbtn" title="Hapus">✕</button></span></div>');
    line.querySelectorAll('button')[0].addEventListener('click', function () {
      Knowledge.factForm(f, function () { UI.route(); });
    });
    line.querySelectorAll('button')[1].addEventListener('click', async function () {
      await Api.post('fact.update', { id: f.id, category: f.category, fact: f.fact, status: 'removed' });
      App.current = null; await UI.loadCurrent(); UI.toast('success', 'Fakta dihapus'); UI.route();
    });
    wrap.appendChild(line);
  });
};
