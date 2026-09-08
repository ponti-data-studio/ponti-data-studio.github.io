/**
 * Generic CRUD engine.
 * Every module (Customers, Products, Sales Orders, ...) reuses this
 * single engine + the ENTITIES config, instead of hand-written screens.
 */
const CRUD = (() => {
  const PAGE_SIZE = 8;
  const uiState = {}; // per-entity: { search, status, page }

  function getUi(key) {
    if (!uiState[key]) uiState[key] = { search: '', status: '', page: 1 };
    return uiState[key];
  }

  function applyFilters(cfg, rows, ui) {
    let out = rows;
    if (ui.search) {
      const q = ui.search.toLowerCase();
      out = out.filter((r) => (cfg.search || []).some((f) => String(r[f] || '').toLowerCase().includes(q)));
    }
    if (ui.status) {
      const field = cfg.stageField || 'status';
      out = out.filter((r) => r[field] === ui.status);
    }
    return out.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  }

  function cellValue(cfg, col, row) {
    let val = row[col.key];
    if (col.currency) return Fmt.rupiah(val);
    if (col.date) return Fmt.date(val);
    if (col.badge) return statusBadge(val);
    return Fmt.escapeHtml(val ?? '-');
  }

  async function renderList(container, entityKey) {
    const cfg = ENTITIES[entityKey];
    const ui = getUi(entityKey);
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title"><i class="bi ${cfg.icon} me-1"></i> ${cfg.title}</h1>
          <div class="page-subtitle" id="recCount-${entityKey}">Memuat data...</div>
        </div>
        <div class="d-flex gap-2">
          <button class="btn btn-outline-secondary btn-sm" id="exportBtn-${entityKey}"><i class="bi bi-download"></i> <span class="d-none d-sm-inline">Export CSV</span></button>
          <button class="btn btn-primary btn-sm" id="addBtn-${entityKey}"><i class="bi bi-plus-lg"></i> ${cfg.addLabel}</button>
        </div>
      </div>
      <div class="toolbar">
        <div class="search-box">
          <i class="bi bi-search"></i>
          <input type="text" class="form-control" id="searchInput-${entityKey}" placeholder="Cari ${cfg.title.toLowerCase()}..." value="${Fmt.escapeHtml(ui.search)}">
        </div>
        ${(cfg.statusFilter || cfg.stageField) ? `
        <select class="form-select d-none d-md-block" style="max-width:180px" id="statusFilter-${entityKey}">
          <option value="">Semua Status</option>
          ${(cfg.stageField ? ['Lead','Contacted','Negotiation','Proposal','Won','Lost'] : STATUS_OPTIONS).map((s) => `<option value="${s}" ${ui.status === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
        <button class="btn btn-outline-secondary d-md-none" id="filterOpenBtn-${entityKey}"><i class="bi bi-funnel"></i></button>
        ` : ''}
      </div>
      <div id="listBody-${entityKey}"></div>
    `;

    document.getElementById(`addBtn-${entityKey}`).onclick = () => openForm(entityKey);
    document.getElementById(`exportBtn-${entityKey}`).onclick = () => exportCsv(entityKey);
    const searchInput = document.getElementById(`searchInput-${entityKey}`);
    let debounce;
    searchInput.oninput = (e) => {
      clearTimeout(debounce);
      debounce = setTimeout(() => { ui.search = e.target.value; ui.page = 1; renderBody(); }, 220);
    };
    const statusSel = document.getElementById(`statusFilter-${entityKey}`);
    if (statusSel) statusSel.onchange = (e) => { ui.status = e.target.value; ui.page = 1; renderBody(); };
    const filterOpenBtn = document.getElementById(`filterOpenBtn-${entityKey}`);
    if (filterOpenBtn) filterOpenBtn.onclick = () => openMobileFilterSheet(entityKey, cfg, ui, renderBody);

    async function renderBody() {
      const all = await DataService.list(entityKey);
      const filtered = applyFilters(cfg, all, ui);
      const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
      ui.page = Math.min(ui.page, totalPages);
      const pageRows = filtered.slice((ui.page - 1) * PAGE_SIZE, ui.page * PAGE_SIZE);

      document.getElementById(`recCount-${entityKey}`).textContent = `${filtered.length} data ditemukan`;
      const body = document.getElementById(`listBody-${entityKey}`);

      if (filtered.length === 0) {
        body.innerHTML = emptyStateHtml(cfg);
        body.querySelector('.js-empty-add').onclick = () => openForm(entityKey);
        return;
      }

      const headCols = cfg.columns.map((c) => `<th>${c.label}</th>`).join('') + '<th style="width:90px">Aksi</th>';
      const bodyRows = pageRows.map((row) => `
        <tr>
          ${cfg.columns.map((c) => `<td>${cellValue(cfg, c, row)}</td>`).join('')}
          <td>
            <div class="row-actions">
              <button title="Detail" data-act="view" data-id="${row.id}"><i class="bi bi-eye"></i></button>
              <button title="Edit" data-act="edit" data-id="${row.id}"><i class="bi bi-pencil"></i></button>
              <button title="Hapus" class="danger" data-act="delete" data-id="${row.id}"><i class="bi bi-trash"></i></button>
            </div>
          </td>
        </tr>`).join('');

      const cardItems = pageRows.map((row) => {
        const primary = cfg.columns[0];
        const rest = cfg.columns.slice(1, 4);
        return `
        <div class="data-card" data-id="${row.id}">
          <div class="data-card-top">
            <div class="data-card-title">${Fmt.escapeHtml(row[primary.key] ?? '-')}</div>
            ${cfg.columns.find((c) => c.badge) ? statusBadge(row[cfg.columns.find((c) => c.badge).key]) : ''}
          </div>
          <div class="data-card-meta">
            ${rest.filter((c) => !c.badge).map((c) => `<span>${c.label}: <b>${cellValue(cfg, c, row)}</b></span>`).join('')}
          </div>
          <div class="data-card-actions">
            <button data-act="view" data-id="${row.id}"><i class="bi bi-eye"></i> Detail</button>
            <button data-act="edit" data-id="${row.id}"><i class="bi bi-pencil"></i> Edit</button>
            <button class="danger" data-act="delete" data-id="${row.id}"><i class="bi bi-trash"></i> Hapus</button>
          </div>
        </div>`;
      }).join('');

      body.innerHTML = `
        <div class="data-table-wrap">
          <table class="data-table">
            <thead><tr>${headCols}</tr></thead>
            <tbody>${bodyRows}</tbody>
          </table>
        </div>
        <div class="card-list">${cardItems}</div>
        <div class="pagination-bar">
          <span>Halaman ${ui.page} dari ${totalPages}</span>
          <div class="btns">
            <button id="prevPage-${entityKey}" ${ui.page <= 1 ? 'disabled' : ''}><i class="bi bi-chevron-left"></i></button>
            <button id="nextPage-${entityKey}" ${ui.page >= totalPages ? 'disabled' : ''}><i class="bi bi-chevron-right"></i></button>
          </div>
        </div>
      `;

      body.querySelectorAll('[data-act]').forEach((btn) => {
        btn.onclick = () => {
          const id = btn.getAttribute('data-id');
          const act = btn.getAttribute('data-act');
          if (act === 'view') viewDetail(entityKey, id);
          if (act === 'edit') openForm(entityKey, id);
          if (act === 'delete') deleteRecord(entityKey, id, renderBody);
        };
      });
      const prevBtn = document.getElementById(`prevPage-${entityKey}`);
      const nextBtn = document.getElementById(`nextPage-${entityKey}`);
      if (prevBtn) prevBtn.onclick = () => { ui.page--; renderBody(); };
      if (nextBtn) nextBtn.onclick = () => { ui.page++; renderBody(); };
    }

    await renderBody();
  }

  function emptyStateHtml(cfg) {
    return `
      <div class="empty-state card-surface">
        <i class="bi bi-inbox"></i>
        <h6>Belum ada data</h6>
        <p class="mb-3">Data akan muncul setelah Anda menambahkan informasi.</p>
        <button class="btn btn-primary btn-sm js-empty-add"><i class="bi bi-plus-lg"></i> Tambah Data</button>
      </div>`;
  }

  function openMobileFilterSheet(entityKey, cfg, ui, onApply) {
    const body = document.getElementById('filterSheetBody');
    const options = cfg.stageField ? ['Lead', 'Contacted', 'Negotiation', 'Proposal', 'Won', 'Lost'] : STATUS_OPTIONS;
    body.innerHTML = `
      <label class="form-label">Status</label>
      <select class="form-select mb-3" id="mobileStatusSelect">
        <option value="">Semua Status</option>
        ${options.map((s) => `<option value="${s}" ${ui.status === s ? 'selected' : ''}>${s}</option>`).join('')}
      </select>
      <button class="btn btn-primary w-100" id="mobileFilterApply">Terapkan Filter</button>
    `;
    const sheetEl = document.getElementById('filterSheet');
    const sheet = bootstrap.Offcanvas.getOrCreateInstance(sheetEl);
    sheet.show();
    document.getElementById('mobileFilterApply').onclick = () => {
      ui.status = document.getElementById('mobileStatusSelect').value;
      ui.page = 1;
      onApply();
      sheet.hide();
    };
  }

  function buildFieldHtml(field, value) {
    const id = `f_${field.key}`;
    const req = field.required ? 'required' : '';
    const val = value ?? '';
    let input;
    if (field.type === 'select') {
      input = `<select class="form-select" id="${id}" ${req}>
        <option value="">Pilih ${field.label}</option>
        ${field.options.map((o) => `<option value="${o}" ${val === o ? 'selected' : ''}>${o}</option>`).join('')}
      </select>`;
    } else if (field.type === 'textarea') {
      input = `<textarea class="form-control" id="${id}" rows="3" ${req} placeholder="${field.placeholder || ''}">${Fmt.escapeHtml(val)}</textarea>`;
    } else {
      input = `<input type="${field.type}" class="form-control" id="${id}" ${req} placeholder="${field.placeholder || ''}" value="${Fmt.escapeHtml(val)}">`;
    }
    return `<div class="mb-0"><label class="form-label" for="${id}">${field.label}${field.required ? ' <span class="text-danger">*</span>' : ''}</label>${input}<div class="invalid-feedback">${field.label} wajib diisi.</div></div>`;
  }

  async function openForm(entityKey, recordId) {
    const cfg = ENTITIES[entityKey];
    const isEdit = !!recordId;
    let record = {};
    if (isEdit) record = await DataService.get(entityKey, recordId);
    if (isEdit && !record) { toastError('Data tidak ditemukan'); return; }

    if (!isEdit) {
      cfg.fields.forEach((f) => {
        if (f.auto) record[f.key] = `${f.auto}-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900) + 100)}`;
        if (f.type === 'date' && !record[f.key]) record[f.key] = Fmt.todayIso();
      });
    }

    document.getElementById('appModalTitle').textContent = isEdit ? `Edit ${cfg.title}` : cfg.addLabel;
    const half = ['text', 'number', 'date', 'email', 'select'];
    document.getElementById('appModalBody').innerHTML = `
      <form id="crudForm" novalidate>
        <div class="form-grid cols-2">
          ${cfg.fields.map((f) => buildFieldHtml(f, record[f.key])).join('')}
        </div>
        <div class="d-flex gap-2 justify-content-end mt-4">
          <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Batal</button>
          <button type="submit" class="btn btn-primary"><i class="bi bi-check2 me-1"></i>Simpan</button>
        </div>
      </form>
    `;
    const modalEl = document.getElementById('appModal');
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();

    document.getElementById('crudForm').onsubmit = async (e) => {
      e.preventDefault();
      const form = e.target;
      let valid = true;
      const payload = {};
      cfg.fields.forEach((f) => {
        const el = document.getElementById(`f_${f.key}`);
        let v = el.value;
        if (f.required && !v) { el.classList.add('is-invalid'); valid = false; }
        else el.classList.remove('is-invalid');
        if (f.type === 'number') v = v === '' ? 0 : Number(v);
        payload[f.key] = v;
      });
      if (!valid) return;
      try {
        if (isEdit) await DataService.update(entityKey, recordId, payload);
        else await DataService.add(entityKey, payload);
        await DataService.logActivity(`${isEdit ? 'Memperbarui' : 'Menambahkan'} data ${cfg.title.split(' (')[0]}: ${payload[cfg.fields[0].key] || ''}`, cfg.icon);
        modal.hide();
        toastSuccess(isEdit ? 'Data berhasil diperbarui' : 'Data berhasil ditambahkan');
        document.dispatchEvent(new CustomEvent('data-changed', { detail: { entityKey } }));
      } catch (err) {
        toastError('Gagal menyimpan data');
        console.error(err);
      }
    };
  }

  async function viewDetail(entityKey, id) {
    const cfg = ENTITIES[entityKey];
    const record = await DataService.get(entityKey, id);
    if (!record) return toastError('Data tidak ditemukan');
    document.getElementById('appModalTitle').textContent = `Detail ${cfg.title}`;
    const rows = cfg.fields.map((f) => {
      let val = record[f.key];
      if (f.type === 'number' && /total|amount|price|cost|balance|value|paid/i.test(f.key)) val = Fmt.rupiah(val);
      else if (f.type === 'date') val = Fmt.date(val);
      return `<tr><td class="text-muted" style="width:44%">${f.label}</td><td class="fw-semibold">${Fmt.escapeHtml(val ?? '-')}</td></tr>`;
    }).join('');
    document.getElementById('appModalBody').innerHTML = `
      <table class="table table-sm mb-3">${rows}</table>
      <div class="d-flex gap-2 justify-content-end">
        <button class="btn btn-outline-secondary" data-bs-dismiss="modal">Tutup</button>
        <button class="btn btn-primary" id="detailEditBtn"><i class="bi bi-pencil me-1"></i>Edit</button>
      </div>
    `;
    const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('appModal'));
    modal.show();
    document.getElementById('detailEditBtn').onclick = () => { modal.hide(); setTimeout(() => openForm(entityKey, id), 250); };
  }

  async function deleteRecord(entityKey, id, onDone) {
    const cfg = ENTITIES[entityKey];
    const record = await DataService.get(entityKey, id);
    const label = record ? (record[cfg.columns[0].key] || record[cfg.fields[0].key]) : 'data ini';
    const ok = await confirmDelete(label);
    if (!ok) return;
    await DataService.remove(entityKey, id);
    await DataService.logActivity(`Menghapus data ${cfg.title.split(' (')[0]}: ${label}`, 'bi-trash');
    toastSuccess('Data berhasil dihapus');
    if (onDone) onDone();
    document.dispatchEvent(new CustomEvent('data-changed', { detail: { entityKey } }));
  }

  async function exportCsv(entityKey) {
    const cfg = ENTITIES[entityKey];
    const rows = await DataService.list(entityKey);
    if (!rows.length) return toastError('Tidak ada data untuk diexport');
    const headers = cfg.columns.map((c) => c.label);
    const keys = cfg.columns.map((c) => c.key);
    const csvRows = [headers.join(',')].concat(rows.map((r) => keys.map((k) => `"${String(r[k] ?? '').replace(/"/g, '""')}"`).join(',')));
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${entityKey}-export-${Fmt.todayIso()}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toastSuccess('Export CSV berhasil');
  }

  return { renderList, openForm, viewDetail, deleteRecord, exportCsv, getUi };
})();
