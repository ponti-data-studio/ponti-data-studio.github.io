/**
 * Views that are NOT plain CRUD tables: dashboard, module overviews,
 * CRM pipeline board, reports hub, settings pages, and the user guide.
 */
const Views = (() => {
  let revenueChartInstance = null;

  function kpiCard(icon, label, value, delta) {
    return `
      <div class="card-surface kpi-card">
        <div class="kpi-icon"><i class="bi ${icon}"></i></div>
        <div class="kpi-label">${label}</div>
        <div class="kpi-value">${value}</div>
        ${delta ? `<div class="kpi-delta ${delta.up ? 'up' : 'down'}"><i class="bi bi-arrow-${delta.up ? 'up' : 'down'}-short"></i>${delta.text}</div>` : ''}
      </div>`;
  }

  async function dashboard(container) {
    const [products, invoices, purchaseOrders, branches, employees, customers, activityLog] = await Promise.all([
      DataService.list('products'), DataService.list('invoices'), DataService.list('purchaseOrders'),
      DataService.list('branches'), DataService.list('employees'), DataService.list('customers'), DataService.list('activityLog'),
    ]);

    const lowStock = products.filter((p) => p.stockQty <= p.minStock && p.stockQty > 0);
    const outOfStock = products.filter((p) => p.stockQty === 0);
    const unpaidInvoices = invoices.filter((i) => i.status === 'Pending');
    const activePO = purchaseOrders.filter((p) => p.status === 'Approved' || p.status === 'Pending');
    const bestProduct = [...products].sort((a, b) => b.price * (b.stockQty || 1) - a.price * (a.stockQty || 1))[0];

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Dashboard</h1>
          <div class="page-subtitle">Ringkasan performa bisnis PT Ponti Digital Nusantara — diperbarui hari ini</div>
        </div>
      </div>

      <div class="kpi-grid">
        ${kpiCard('bi-graph-up', 'Revenue', 'Rp 485.250.000', { up: true, text: '+8,2% dari bulan lalu' })}
        ${kpiCard('bi-piggy-bank', 'Profit', 'Rp 127.500.000', { up: true, text: '+5,4% dari bulan lalu' })}
        ${kpiCard('bi-cart-check', 'Sales', '1.284 transaksi', { up: true, text: '+112 transaksi' })}
        ${kpiCard('bi-people', 'Customers', '428', { up: true, text: '+16 customer baru' })}
        ${kpiCard('bi-exclamation-circle', 'Outstanding', 'Rp 38.500.000', { up: false, text: '12 invoice belum lunas' })}
      </div>

      <div class="dash-grid">
        <div>
          <div class="card-surface section-card">
            <h6><i class="bi bi-bar-chart-line me-1"></i>Revenue Trend (6 Bulan Terakhir)</h6>
            <canvas id="revenueChart" height="170"></canvas>
          </div>

          <div class="card-surface section-card">
            <h6><i class="bi bi-clipboard-data me-1"></i>Business Overview</h6>
            <div class="row g-3">
              <div class="col-md-6">
                <ul class="mini-list">
                  <li><span class="mini-title">Produk Terlaris</span><span class="mini-sub">${bestProduct ? Fmt.escapeHtml(bestProduct.name) : '-'}</span></li>
                  <li><span class="mini-title">Cabang Performa Terbaik</span><span class="mini-sub">${branches[0] ? Fmt.escapeHtml(branches[0].name) : '-'}</span></li>
                  <li><span class="mini-title">Sales Terbaik</span><span class="mini-sub">${employees[0] ? Fmt.escapeHtml(employees[0].name) : '-'}</span></li>
                </ul>
              </div>
              <div class="col-md-6">
                <ul class="mini-list">
                  <li><span class="mini-title">Stok Menipis</span><span class="mini-sub">${lowStock.length + outOfStock.length} produk</span></li>
                  <li><span class="mini-title">Invoice Belum Dibayar</span><span class="mini-sub">${unpaidInvoices.length} invoice</span></li>
                  <li><span class="mini-title">Purchase Order Aktif</span><span class="mini-sub">${activePO.length} PO</span></li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div class="card-surface section-card">
            <h6><i class="bi bi-activity me-1"></i>Recent Activity</h6>
            <div id="recentActivityList">${renderActivity(activityLog)}</div>
          </div>
          <div class="card-surface section-card">
            <h6><i class="bi bi-building me-1"></i>Ringkasan Perusahaan</h6>
            <ul class="mini-list">
              <li><span class="mini-title">Total Cabang</span><span class="mini-sub">${branches.length}</span></li>
              <li><span class="mini-title">Total Karyawan</span><span class="mini-sub">${employees.length}</span></li>
              <li><span class="mini-title">Total Customer Aktif</span><span class="mini-sub">${customers.filter((c) => c.status === 'Aktif').length}</span></li>
            </ul>
          </div>
        </div>
      </div>
    `;

    const ctx = document.getElementById('revenueChart');
    if (revenueChartInstance) revenueChartInstance.destroy();
    revenueChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun'],
        datasets: [{
          label: 'Revenue',
          data: [312000000, 338500000, 356200000, 401800000, 447300000, 485250000],
          borderColor: '#0E7C7B',
          backgroundColor: 'rgba(14,124,123,0.12)',
          tension: 0.35,
          fill: true,
          pointRadius: 3,
          pointBackgroundColor: '#0E7C7B',
        }],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => Fmt.rupiah(c.parsed.y) } } },
        scales: { y: { ticks: { callback: (v) => 'Rp ' + (v / 1000000) + 'jt' } } },
      },
    });
  }

  function renderActivity(log) {
    const sorted = [...log].sort((a, b) => (b.ts || '').localeCompare(a.ts || '')).slice(0, 8);
    if (!sorted.length) return `<p class="text-muted small mb-0">Belum ada aktivitas.</p>`;
    return sorted.map((a) => `
      <div class="activity-item">
        <div class="activity-icon"><i class="bi ${a.icon || 'bi-check2-circle'}"></i></div>
        <div>
          <div>${Fmt.escapeHtml(a.text)}</div>
          <div class="activity-time">${Fmt.timeAgo(a.ts)}</div>
        </div>
      </div>`).join('');
  }

  async function companyProfile(container) {
    const list = await DataService.list('companyProfile');
    const comp = list[0] || {};
    container.innerHTML = `
      <div class="page-header">
        <div><h1 class="page-title">Company Profile</h1><div class="page-subtitle">Informasi identitas perusahaan</div></div>
        <button class="btn btn-primary btn-sm" id="editCompanyBtn"><i class="bi bi-pencil"></i> Edit</button>
      </div>
      <div class="card-surface section-card">
        <div class="row g-3">
          ${['name:Nama Perusahaan', 'legalForm:Bentuk Badan Usaha', 'industry:Industri', 'npwp:NPWP', 'phone:Telepon', 'email:Email', 'founded:Tanggal Berdiri', 'address:Alamat'].map((pair) => {
            const [key, label] = pair.split(':');
            let val = comp[key] || '-';
            if (key === 'founded') val = Fmt.date(val);
            return `<div class="col-md-6"><div class="text-muted small">${label}</div><div class="fw-semibold">${Fmt.escapeHtml(val)}</div></div>`;
          }).join('')}
        </div>
      </div>
    `;
    document.getElementById('editCompanyBtn').onclick = () => {
      document.getElementById('appModalTitle').textContent = 'Edit Company Profile';
      const fields = [
        ['name', 'Nama Perusahaan', 'text'], ['legalForm', 'Bentuk Badan Usaha', 'text'], ['industry', 'Industri', 'text'],
        ['npwp', 'NPWP', 'text'], ['phone', 'Telepon', 'text'], ['email', 'Email', 'email'],
        ['founded', 'Tanggal Berdiri', 'date'], ['address', 'Alamat', 'textarea'],
      ];
      document.getElementById('appModalBody').innerHTML = `
        <form id="companyForm">
          <div class="form-grid cols-2">
            ${fields.map(([k, l, t]) => t === 'textarea'
              ? `<div class="mb-0" style="grid-column:1/-1"><label class="form-label">${l}</label><textarea class="form-control" id="cf_${k}" rows="2">${Fmt.escapeHtml(comp[k] || '')}</textarea></div>`
              : `<div class="mb-0"><label class="form-label">${l}</label><input type="${t}" class="form-control" id="cf_${k}" value="${Fmt.escapeHtml(comp[k] || '')}"></div>`).join('')}
          </div>
          <div class="d-flex gap-2 justify-content-end mt-4">
            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Batal</button>
            <button type="submit" class="btn btn-primary">Simpan</button>
          </div>
        </form>`;
      const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('appModal'));
      modal.show();
      document.getElementById('companyForm').onsubmit = async (e) => {
        e.preventDefault();
        const payload = {};
        fields.forEach(([k]) => { payload[k] = document.getElementById(`cf_${k}`).value; });
        if (comp.id) await DataService.update('companyProfile', comp.id, payload);
        else await DataService.add('companyProfile', { id: 'comp-1', ...payload });
        modal.hide();
        toastSuccess('Profil perusahaan diperbarui');
        companyProfile(container);
      };
    };
  }

  async function inventoryOverview(container) {
    const products = await DataService.list('products');
    const totalStock = products.reduce((s, p) => s + Number(p.stockQty || 0), 0);
    const lowStock = products.filter((p) => p.stockQty > 0 && p.stockQty <= p.minStock);
    const outStock = products.filter((p) => p.stockQty === 0);
    const stockValue = products.reduce((s, p) => s + Number(p.stockQty || 0) * Number(p.cost || 0), 0);

    container.innerHTML = `
      <div class="page-header"><div><h1 class="page-title">Inventory Overview</h1><div class="page-subtitle">Ringkasan stok seluruh gudang</div></div></div>
      <div class="kpi-grid">
        ${kpiCard('bi-box-seam', 'Total Products', Fmt.number(products.length))}
        ${kpiCard('bi-stack', 'Total Stock', Fmt.number(totalStock) + ' unit')}
        ${kpiCard('bi-exclamation-triangle', 'Low Stock', Fmt.number(lowStock.length) + ' produk')}
        ${kpiCard('bi-x-octagon', 'Out of Stock', Fmt.number(outStock.length) + ' produk')}
        ${kpiCard('bi-cash-stack', 'Stock Value', Fmt.rupiah(stockValue))}
      </div>
      <div class="card-surface section-card">
        <h6><i class="bi bi-exclamation-triangle text-warning me-1"></i>Produk Perlu Perhatian</h6>
        ${[...outStock, ...lowStock].length === 0 ? '<p class="text-muted small mb-0">Semua stok dalam kondisi aman.</p>' : `
        <ul class="mini-list">
          ${[...outStock, ...lowStock].map((p) => `<li><span class="mini-title">${Fmt.escapeHtml(p.name)}</span><span class="mini-sub">${p.stockQty === 0 ? '<b class="text-danger">Habis</b>' : `Sisa ${p.stockQty} (min ${p.minStock})`}</span></li>`).join('')}
        </ul>`}
      </div>
      <div class="d-flex flex-wrap gap-2">
        <button class="btn btn-outline-primary btn-sm" data-nav="entity:products">Kelola Products</button>
        <button class="btn btn-outline-primary btn-sm" data-nav="entity:stockMovements">Stock Movement</button>
        <button class="btn btn-outline-primary btn-sm" data-nav="entity:stockOpname">Stock Opname</button>
      </div>
    `;
    bindNavButtons(container);
  }

  async function financeOverview(container) {
    const [incomes, expenses, cashBank, invoices, supplierInvoices] = await Promise.all([
      DataService.list('incomes'), DataService.list('expenses'), DataService.list('cashBank'),
      DataService.list('invoices'), DataService.list('supplierInvoices'),
    ]);
    const totalIncome = incomes.reduce((s, i) => s + Number(i.amount || 0), 0);
    const totalExpense = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
    const grossProfit = totalIncome - totalExpense * 0.4;
    const netProfit = totalIncome - totalExpense;
    const cashBalance = cashBank.reduce((s, c) => s + Number(c.balance || 0), 0);
    const receivables = invoices.reduce((s, i) => s + Math.max(0, Number(i.total || 0) - Number(i.paid || 0)), 0);
    const payables = supplierInvoices.filter((s) => s.status !== 'Completed').reduce((s, i) => s + Number(i.total || 0), 0);

    container.innerHTML = `
      <div class="page-header"><div><h1 class="page-title">Finance Overview</h1><div class="page-subtitle">Ringkasan keuangan perusahaan</div></div></div>
      <div class="kpi-grid">
        ${kpiCard('bi-graph-up-arrow', 'Revenue', Fmt.rupiah(totalIncome))}
        ${kpiCard('bi-graph-down-arrow', 'Expense', Fmt.rupiah(totalExpense))}
        ${kpiCard('bi-cash', 'Gross Profit', Fmt.rupiah(grossProfit))}
        ${kpiCard('bi-piggy-bank', 'Net Profit', Fmt.rupiah(netProfit))}
        ${kpiCard('bi-bank', 'Cash Balance', Fmt.rupiah(cashBalance))}
      </div>
      <div class="kpi-grid" style="grid-template-columns:repeat(2,1fr)">
        ${kpiCard('bi-arrow-down-circle', 'Receivables', Fmt.rupiah(receivables))}
        ${kpiCard('bi-arrow-up-circle', 'Payables', Fmt.rupiah(payables))}
      </div>
      <div class="d-flex flex-wrap gap-2">
        <button class="btn btn-outline-primary btn-sm" data-nav="entity:incomes">Income</button>
        <button class="btn btn-outline-primary btn-sm" data-nav="entity:expenses">Expenses</button>
        <button class="btn btn-outline-primary btn-sm" data-nav="receivables">Receivables</button>
        <button class="btn btn-outline-primary btn-sm" data-nav="payables">Payables</button>
        <button class="btn btn-outline-primary btn-sm" data-nav="entity:cashBank">Cash &amp; Bank</button>
      </div>
    `;
    bindNavButtons(container);
  }

  async function receivables(container) {
    const invoices = await DataService.list('invoices');
    const rows = invoices.map((i) => ({ ...i, outstanding: Math.max(0, Number(i.total || 0) - Number(i.paid || 0)) })).filter((i) => i.outstanding > 0);
    container.innerHTML = `
      <div class="page-header"><div><h1 class="page-title">Receivables</h1><div class="page-subtitle">Piutang customer yang belum lunas</div></div></div>
      ${rows.length === 0 ? '<div class="empty-state card-surface"><i class="bi bi-check-circle"></i><h6>Tidak ada piutang</h6><p class="mb-0">Semua invoice sudah lunas.</p></div>' : `
      <div class="data-table-wrap">
        <table class="data-table">
          <thead><tr><th>No. Invoice</th><th>Customer</th><th>Jatuh Tempo</th><th>Total</th><th>Terbayar</th><th>Sisa</th></tr></thead>
          <tbody>${rows.map((r) => `<tr><td>${r.number}</td><td>${Fmt.escapeHtml(r.customer)}</td><td>${Fmt.date(r.dueDate)}</td><td>${Fmt.rupiah(r.total)}</td><td>${Fmt.rupiah(r.paid)}</td><td class="text-danger fw-semibold">${Fmt.rupiah(r.outstanding)}</td></tr>`).join('')}</tbody>
        </table>
      </div>`}
    `;
  }

  async function payables(container) {
    const rows = (await DataService.list('supplierInvoices')).filter((s) => s.status !== 'Completed' && s.status !== 'Cancelled');
    container.innerHTML = `
      <div class="page-header"><div><h1 class="page-title">Payables</h1><div class="page-subtitle">Hutang ke supplier yang belum dibayar</div></div></div>
      ${rows.length === 0 ? '<div class="empty-state card-surface"><i class="bi bi-check-circle"></i><h6>Tidak ada hutang tertunda</h6></div>' : `
      <div class="data-table-wrap">
        <table class="data-table">
          <thead><tr><th>No. Invoice</th><th>Supplier</th><th>Tanggal</th><th>Total</th><th>Status</th></tr></thead>
          <tbody>${rows.map((r) => `<tr><td>${r.number}</td><td>${Fmt.escapeHtml(r.supplier)}</td><td>${Fmt.date(r.date)}</td><td>${Fmt.rupiah(r.total)}</td><td>${statusBadge(r.status)}</td></tr>`).join('')}</tbody>
        </table>
      </div>`}
    `;
  }

  async function hrOverview(container) {
    const [attendance, leaves, overtime] = await Promise.all([DataService.list('attendance'), DataService.list('leaves'), DataService.list('overtime')]);
    const today = attendance.filter((a) => a.date === '2026-09-08');
    const present = today.filter((a) => a.status === 'Hadir').length;
    const late = today.filter((a) => a.status === 'Terlambat').length;
    const absent = today.filter((a) => a.status === 'Absen').length;
    const onLeave = leaves.filter((l) => l.status === 'Approved').length;
    const totalOT = overtime.reduce((s, o) => s + Number(o.hours || 0), 0);

    container.innerHTML = `
      <div class="page-header"><div><h1 class="page-title">HR Overview</h1><div class="page-subtitle">Ringkasan kehadiran hari ini</div></div></div>
      <div class="kpi-grid">
        ${kpiCard('bi-person-check', 'Present', Fmt.number(present))}
        ${kpiCard('bi-person-x', 'Absent', Fmt.number(absent))}
        ${kpiCard('bi-alarm', 'Late', Fmt.number(late))}
        ${kpiCard('bi-airplane', 'Leave', Fmt.number(onLeave))}
        ${kpiCard('bi-clock-history', 'Overtime', totalOT + ' jam')}
      </div>
      <div class="d-flex flex-wrap gap-2">
        <button class="btn btn-outline-primary btn-sm" data-nav="entity:attendance">Attendance</button>
        <button class="btn btn-outline-primary btn-sm" data-nav="entity:leaves">Leave</button>
        <button class="btn btn-outline-primary btn-sm" data-nav="entity:overtime">Overtime</button>
        <button class="btn btn-outline-primary btn-sm" data-nav="payrollSummary">Payroll Summary</button>
      </div>
    `;
    bindNavButtons(container);
  }

  async function payrollSummary(container) {
    const employees = (await DataService.list('employees')).filter((e) => e.status !== 'Non-Aktif');
    const baseByPosition = { 'Manager': 12000000, 'Supervisor': 8000000, 'Staff': 5500000 };
    function estimate(pos) {
      const key = Object.keys(baseByPosition).find((k) => pos.includes(k)) || 'Staff';
      return baseByPosition[key];
    }
    const rows = employees.map((e) => ({ ...e, salary: estimate(e.position) }));
    const total = rows.reduce((s, r) => s + r.salary, 0);
    container.innerHTML = `
      <div class="page-header">
        <div><h1 class="page-title">Payroll Summary</h1><div class="page-subtitle">Estimasi payroll bulan berjalan (demo)</div></div>
        <button class="btn btn-outline-secondary btn-sm" onclick="window.print()"><i class="bi bi-printer"></i> Print</button>
      </div>
      <div class="kpi-grid" style="grid-template-columns:repeat(2,1fr)">
        ${kpiCard('bi-people', 'Total Karyawan Aktif', Fmt.number(rows.length))}
        ${kpiCard('bi-cash-stack', 'Total Estimasi Payroll', Fmt.rupiah(total))}
      </div>
      <div class="data-table-wrap">
        <table class="data-table">
          <thead><tr><th>Nama</th><th>Jabatan</th><th>Departemen</th><th>Estimasi Gaji</th></tr></thead>
          <tbody>${rows.map((r) => `<tr><td>${Fmt.escapeHtml(r.name)}</td><td>${Fmt.escapeHtml(r.position)}</td><td>${Fmt.escapeHtml(r.department)}</td><td>${Fmt.rupiah(r.salary)}</td></tr>`).join('')}</tbody>
        </table>
      </div>
      <p class="text-muted small mt-2">*Angka bersifat estimasi demo, bukan data payroll aktual.</p>
    `;
  }

  async function crm(container) {
    const leads = await DataService.list('leads');
    const stages = ['Lead', 'Contacted', 'Negotiation', 'Proposal', 'Won', 'Lost'];
    const totalLeads = leads.length;
    const won = leads.filter((l) => l.stage === 'Won');
    const lost = leads.filter((l) => l.stage === 'Lost');
    const conversion = totalLeads ? Math.round((won.length / totalLeads) * 100) : 0;
    const pipelineValue = leads.filter((l) => l.stage !== 'Won' && l.stage !== 'Lost').reduce((s, l) => s + Number(l.value || 0), 0);

    container.innerHTML = `
      <div class="page-header">
        <div><h1 class="page-title">CRM Pipeline</h1><div class="page-subtitle">Lead → Contacted → Negotiation → Proposal → Won/Lost</div></div>
        <button class="btn btn-primary btn-sm" id="addLeadBtn"><i class="bi bi-plus-lg"></i> Tambah Lead</button>
      </div>
      <div class="kpi-grid" style="grid-template-columns:repeat(2,1fr)">
        ${kpiCard('bi-funnel', 'Total Leads', Fmt.number(totalLeads))}
        ${kpiCard('bi-percent', 'Conversion Rate', conversion + '%')}
        ${kpiCard('bi-wallet2', 'Pipeline Value', Fmt.rupiah(pipelineValue))}
        ${kpiCard('bi-trophy', 'Won Deals', Fmt.number(won.length))}
      </div>
      <div class="pipeline-board" id="pipelineBoard"></div>
    `;
    const board = document.getElementById('pipelineBoard');
    board.innerHTML = stages.map((stage) => {
      const items = leads.filter((l) => l.stage === stage);
      return `
        <div class="pipeline-col">
          <div class="pipeline-col-head"><span>${stage}</span><span class="text-muted">${items.length}</span></div>
          ${items.map((l) => `
            <div class="pipeline-card" data-id="${l.id}">
              <div class="lead-name">${Fmt.escapeHtml(l.name)}</div>
              <div class="text-muted mb-1">${Fmt.escapeHtml(l.contact)} · ${Fmt.escapeHtml(l.owner)}</div>
              <div class="lead-value">${Fmt.rupiah(l.value)}</div>
            </div>`).join('') || '<p class="text-muted small mb-0">Kosong</p>'}
        </div>`;
    }).join('');
    board.querySelectorAll('.pipeline-card').forEach((card) => {
      card.onclick = () => CRUD.viewDetail('leads', card.getAttribute('data-id'));
    });
    document.getElementById('addLeadBtn').onclick = () => CRUD.openForm('leads');
    document.addEventListener('data-changed', function handler(e) {
      if (e.detail.entityKey === 'leads') { crm(container); document.removeEventListener('data-changed', handler); }
    });
  }

  const REPORTS = [
    { key: 'salesOrders', title: 'Sales Report', icon: 'bi-cart-check' },
    { key: 'purchaseOrders', title: 'Purchase Report', icon: 'bi-bag-check' },
    { key: 'stockMovements', title: 'Inventory Report', icon: 'bi-boxes' },
    { key: 'expenses', title: 'Finance Report', icon: 'bi-cash-stack' },
    { key: 'attendance', title: 'HR Report', icon: 'bi-person-workspace' },
    { key: 'customers', title: 'Customer Report', icon: 'bi-person-badge' },
    { key: 'leads', title: 'Business Performance', icon: 'bi-graph-up' },
  ];

  async function reports(container, sub) {
    if (!sub) {
      container.innerHTML = `
        <div class="page-header"><div><h1 class="page-title">Reports</h1><div class="page-subtitle">Pilih laporan yang ingin dilihat</div></div></div>
        <div class="row g-3">
          ${REPORTS.map((r) => `
            <div class="col-6 col-md-4 col-lg-3">
              <button class="card-surface w-100 h-100 border-0 p-3 text-start js-report-open" data-key="${r.key}" data-title="${r.title}" style="cursor:pointer">
                <div class="kpi-icon mb-2"><i class="bi ${r.icon}"></i></div>
                <div class="fw-semibold small">${r.title}</div>
              </button>
            </div>`).join('')}
        </div>
      `;
      container.querySelectorAll('.js-report-open').forEach((btn) => {
        btn.onclick = () => App.navigateTo(`reports:${btn.dataset.key}`);
      });
      return;
    }
    const meta = REPORTS.find((r) => r.key === sub) || REPORTS[0];
    const cfg = ENTITIES[sub];
    const all = await DataService.list(sub);
    container.innerHTML = `
      <div class="page-header">
        <div><h1 class="page-title"><i class="bi ${meta.icon} me-1"></i>${meta.title}</h1><div class="page-subtitle">${all.length} data tercatat</div></div>
        <div class="d-flex gap-2">
          <button class="btn btn-outline-secondary btn-sm" id="reportPrintBtn"><i class="bi bi-printer"></i> Print</button>
          <button class="btn btn-outline-primary btn-sm" id="reportExportBtn"><i class="bi bi-download"></i> Export CSV</button>
        </div>
      </div>
      <div class="toolbar">
        <div class="search-box"><i class="bi bi-search"></i><input class="form-control" id="reportSearch" placeholder="Cari..."></div>
        <input type="date" class="form-control" id="reportDateFrom" style="max-width:160px">
        <input type="date" class="form-control" id="reportDateTo" style="max-width:160px">
        <button class="btn btn-outline-secondary btn-sm" id="reportBackBtn"><i class="bi bi-arrow-left"></i> Kembali</button>
      </div>
      <div id="reportTableWrap"></div>
    `;
    document.getElementById('reportBackBtn').onclick = () => App.navigateTo('reports');
    const dateKey = cfg.fields.find((f) => f.type === 'date')?.key || 'date';

    function renderTable() {
      const q = document.getElementById('reportSearch').value.toLowerCase();
      const from = document.getElementById('reportDateFrom').value;
      const to = document.getElementById('reportDateTo').value;
      let rows = all.filter((r) => (!q || (cfg.search || []).some((f) => String(r[f] || '').toLowerCase().includes(q))));
      if (from) rows = rows.filter((r) => (r[dateKey] || '') >= from);
      if (to) rows = rows.filter((r) => (r[dateKey] || '') <= to);
      const wrap = document.getElementById('reportTableWrap');
      if (!rows.length) { wrap.innerHTML = `<div class="empty-state card-surface"><i class="bi bi-inbox"></i><h6>Tidak ada data</h6></div>`; return; }
      wrap.innerHTML = `
        <div class="data-table-wrap">
          <table class="data-table">
            <thead><tr>${cfg.columns.map((c) => `<th>${c.label}</th>`).join('')}</tr></thead>
            <tbody>${rows.map((r) => `<tr>${cfg.columns.map((c) => `<td>${c.currency ? Fmt.rupiah(r[c.key]) : c.date ? Fmt.date(r[c.key]) : c.badge ? statusBadge(r[c.key]) : Fmt.escapeHtml(r[c.key] ?? '-')}</td>`).join('')}</tr>`).join('')}</tbody>
          </table>
        </div>`;
    }
    ['reportSearch', 'reportDateFrom', 'reportDateTo'].forEach((id) => document.getElementById(id).addEventListener('input', renderTable));
    renderTable();
    document.getElementById('reportPrintBtn').onclick = () => window.print();
    document.getElementById('reportExportBtn').onclick = () => CRUD.exportCsv(sub);
  }

  function bindNavButtons(container) {
    container.querySelectorAll('[data-nav]').forEach((el) => {
      el.onclick = () => App.navigateTo(el.getAttribute('data-nav'));
    });
  }

  function settingsProfile(container) {
    const user = App.getCurrentUser();
    container.innerHTML = `
      <div class="page-header"><div><h1 class="page-title">Profile</h1><div class="page-subtitle">Informasi akun Anda</div></div></div>
      <div class="card-surface section-card" style="max-width:520px">
        <div class="d-flex align-items-center gap-3 mb-4">
          <span class="user-avatar" style="width:56px;height:56px;font-size:1.4rem">${user.name[0]}</span>
          <div><div class="fw-bold">${Fmt.escapeHtml(user.name)}</div><div class="text-muted small">${Fmt.escapeHtml(user.role)}</div></div>
        </div>
        <div class="mb-3"><label class="form-label">Username</label><input class="form-control" value="${Fmt.escapeHtml(user.username)}" disabled></div>
        <div class="mb-3"><label class="form-label">Email</label><input class="form-control" value="${Fmt.escapeHtml(user.email || '-')}" disabled></div>
        <div class="mb-0"><label class="form-label">Role</label><input class="form-control" value="${Fmt.escapeHtml(user.role)}" disabled></div>
        <p class="text-muted small mt-3 mb-0">Mode demo: profil tidak dapat diedit. Pada versi production, halaman ini terhubung ke sistem autentikasi perusahaan.</p>
      </div>
    `;
  }

  function rolePermission(container) {
    container.innerHTML = `
      <div class="page-header"><div><h1 class="page-title">Role &amp; Permission</h1><div class="page-subtitle">Simulasi Role-Based Access Control</div></div></div>
      ${Object.entries(ROLE_ACCESS).map(([role, info]) => `
        <div class="card-surface access-card d-flex justify-content-between align-items-center flex-wrap gap-2">
          <div><div class="role-name">${role}</div><div class="text-muted small">${info.label}</div></div>
          ${role === App.getCurrentUser().role ? '<span class="status-badge badge-status-approved">Role Aktif Anda</span>' : ''}
        </div>`).join('')}
      <p class="text-muted small mt-2">Pada mode demo, role disimulasikan melalui akun demo yang dipilih saat login.</p>
    `;
  }

  function settingsAppearance(container) {
    const prefs = JSON.parse(localStorage.getItem('ponti_erp_prefs') || '{}');
    container.innerHTML = `
      <div class="page-header"><div><h1 class="page-title">Appearance</h1><div class="page-subtitle">Preferensi tampilan aplikasi</div></div></div>
      <div class="card-surface section-card" style="max-width:480px">
        <div class="form-check form-switch mb-3">
          <input class="form-check-input" type="checkbox" id="compactModeSwitch" ${prefs.compact ? 'checked' : ''}>
          <label class="form-check-label" for="compactModeSwitch">Compact table rows</label>
        </div>
        <div class="mb-0">
          <label class="form-label">Warna Aksen</label>
          <div class="d-flex gap-2">
            ${['#0E7C7B', '#1F4C73', '#B5720B', '#6C3EC9'].map((c) => `<button class="btn p-0 border" data-color="${c}" style="width:32px;height:32px;border-radius:8px;background:${c}"></button>`).join('')}
          </div>
        </div>
      </div>
    `;
    document.getElementById('compactModeSwitch').onchange = (e) => {
      prefs.compact = e.target.checked;
      localStorage.setItem('ponti_erp_prefs', JSON.stringify(prefs));
      toastSuccess('Preferensi disimpan');
    };
    container.querySelectorAll('[data-color]').forEach((btn) => {
      btn.onclick = () => { document.documentElement.style.setProperty('--teal-600', btn.dataset.color); toastSuccess('Warna aksen diperbarui'); };
    });
  }

  function settingsNotifications(container) {
    const prefs = JSON.parse(localStorage.getItem('ponti_erp_notif_prefs') || '{"invoice":true,"stock":true,"leave":false}');
    const items = [
      ['invoice', 'Invoice jatuh tempo'], ['stock', 'Peringatan stok menipis'], ['leave', 'Pengajuan cuti baru'],
    ];
    container.innerHTML = `
      <div class="page-header"><div><h1 class="page-title">Notification Settings</h1><div class="page-subtitle">Atur notifikasi yang ingin Anda terima</div></div></div>
      <div class="card-surface section-card" style="max-width:480px">
        ${items.map(([k, l]) => `
          <div class="form-check form-switch mb-3">
            <input class="form-check-input" type="checkbox" id="notif_${k}" ${prefs[k] ? 'checked' : ''}>
            <label class="form-check-label" for="notif_${k}">${l}</label>
          </div>`).join('')}
      </div>
    `;
    items.forEach(([k]) => {
      document.getElementById(`notif_${k}`).onchange = (e) => {
        prefs[k] = e.target.checked;
        localStorage.setItem('ponti_erp_notif_prefs', JSON.stringify(prefs));
        toastSuccess('Pengaturan notifikasi disimpan');
      };
    });
  }

  function settingsData(container) {
    container.innerHTML = `
      <div class="page-header"><div><h1 class="page-title">Data Management</h1><div class="page-subtitle">Kelola data demo aplikasi</div></div></div>
      <div class="card-surface section-card" style="max-width:520px">
        <h6>Reset Demo Data</h6>
        <p class="text-muted small">Mengembalikan seluruh data ke kondisi awal demo. Semua perubahan yang telah Anda buat akan hilang.</p>
        <button class="btn btn-outline-danger" id="resetDataBtn"><i class="bi bi-arrow-counterclockwise me-1"></i>Reset Demo Data</button>
      </div>
    `;
    document.getElementById('resetDataBtn').onclick = async () => {
      const ok = await Swal.fire({
        icon: 'warning', title: 'Reset semua data demo?',
        text: 'Tindakan ini akan menghapus semua perubahan dan mengembalikan data awal.',
        showCancelButton: true, confirmButtonText: 'Ya, Reset', cancelButtonText: 'Batal',
        confirmButtonColor: '#C0392B', reverseButtons: true,
      }).then((r) => r.isConfirmed);
      if (!ok) return;
      Swal.fire({ title: 'Mereset data...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      await DataService.seedIfNeeded(true);
      Swal.close();
      toastSuccess('Data demo berhasil direset');
      App.navigateTo('dashboard');
    };
  }

  function panduan(container) {
    const sections = [
      ['mengenal', '1. Mengenal Ponti-ERP', `<p>Ponti-ERP adalah aplikasi untuk membantu pemilik bisnis mengelola penjualan, pembelian, stok barang, keuangan, karyawan, dan pelanggan dalam satu tempat. Semua modul saling terhubung mengikuti alur kerja bisnis sehari-hari.</p>`],
      ['login', '2. Cara Login', `<p>Masukkan <b>Username</b> dan <b>Password</b> Anda, lalu tekan tombol <b>Masuk</b>. Jika hanya ingin mencoba aplikasi, tekan tombol <b>Login sebagai Akun Demo</b> — sistem akan otomatis mengisi data login untuk Anda.</p>`],
      ['dashboard', '3. Dashboard', `<p>Dashboard menampilkan ringkasan bisnis: total pendapatan (Revenue), keuntungan (Profit), jumlah transaksi penjualan, jumlah pelanggan, dan tagihan yang belum dibayar (Outstanding). Grafik menunjukkan tren pendapatan 6 bulan terakhir.</p>`],
      ['customer', '4. Mengelola Customer', `<p>Buka menu <b>Sales &gt; Customers</b>, tekan tombol <b>Tambah Customer</b>, isi data yang diminta, lalu tekan <b>Simpan</b>. Anda juga dapat mencari, mengedit, atau menghapus data customer dari daftar.</p>`],
      ['penjualan', '5. Membuat Penjualan', `<p>Alur penjualan mengikuti tahapan: <b>Quotation</b> (penawaran) → <b>Sales Order</b> (pesanan disetujui) → <b>Invoice</b> (tagihan) → <b>Payment</b> (pembayaran diterima). Setiap tahap memiliki menu sendiri di bawah <b>Sales</b>.</p>`],
      ['pembelian', '6. Mengelola Pembelian', `<p>Alur pembelian: <b>Purchase Request</b> (permintaan barang) → persetujuan → <b>Purchase Order</b> (pesanan ke supplier) → <b>Goods Receipt</b> (barang diterima) → <b>Supplier Invoice</b> (tagihan dari supplier).</p>`],
      ['stok', '7. Mengelola Stok', `<p>Menu <b>Inventory</b> menampilkan seluruh produk dan jumlah stoknya. Gunakan <b>Stock Movement</b> untuk melihat riwayat barang masuk/keluar, dan <b>Stock Opname</b> untuk mencatat hasil pengecekan stok fisik.</p>`],
      ['finance', '8. Finance', `<p>Catat pemasukan pada menu <b>Income</b> dan pengeluaran pada menu <b>Expenses</b>. Halaman <b>Finance Overview</b> menampilkan ringkasan keuntungan, saldo kas, piutang, dan hutang secara otomatis.</p>`],
      ['hr', '9. HR', `<p>Menu <b>HR</b> menampilkan data karyawan, kehadiran harian (<b>Attendance</b>), pengajuan cuti (<b>Leave</b>), dan lembur (<b>Overtime</b>).</p>`],
      ['reports', '10. Reports', `<p>Menu <b>Reports</b> menyediakan berbagai laporan siap pakai. Gunakan kolom pencarian dan filter tanggal untuk mempersempit data, lalu tekan <b>Print</b> atau <b>Export CSV</b> untuk menyimpan laporan.</p>`],
      ['offline', '11. Offline Mode', `<p>Ponti-ERP tetap dapat digunakan meski tanpa koneksi internet karena data disimpan langsung di perangkat Anda (mode demo). Indikator kecil di bagian atas menunjukkan status 🟢 Online atau 🟠 Offline Mode.</p>`],
    ];
    container.innerHTML = `
      <div class="page-header"><div><h1 class="page-title"><i class="bi bi-book me-1"></i>Panduan Penggunaan</h1><div class="page-subtitle">Panduan sederhana untuk semua pengguna</div></div></div>
      <div class="row g-3">
        <div class="col-lg-3 d-none d-lg-block">
          <div class="card-surface section-card" style="position:sticky;top:76px">
            <h6>Daftar Isi</h6>
            <ul class="guide-toc">${sections.map(([id, title]) => `<li><a href="#g-${id}">${title}</a></li>`).join('')}</ul>
          </div>
        </div>
        <div class="col-lg-9">
          <div class="guide-note mb-3">Ponti-ERP merupakan aplikasi demo yang dapat dikembangkan dan disesuaikan dengan kebutuhan perusahaan. Setiap perusahaan memiliki workflow yang berbeda — modul, fitur, hak akses, laporan, approval, dan integrasi dapat disesuaikan berdasarkan kebutuhan bisnis.</div>
          ${sections.map(([id, title, body]) => `<div class="card-surface section-card guide-section" id="g-${id}"><h5>${title}</h5>${body}</div>`).join('')}
          <div class="guide-note">Aplikasi ini merupakan demo portfolio Ponti Data ID. Data yang digunakan adalah data simulasi dan bukan data perusahaan sungguhan.</div>
        </div>
      </div>
    `;
  }

  return {
    dashboard, companyProfile, inventoryOverview, financeOverview, receivables, payables,
    hrOverview, payrollSummary, crm, reports, settingsProfile, rolePermission,
    settingsAppearance, settingsNotifications, settingsData, panduan,
  };
})();
