/**
 * reports.js - Dashboard stats/grafik & Halaman Laporan
 */

const Reports = (() => {
  let charts = {};
  let currentReportTab = 'sales';
  let reportEventsBound = false;

  function destroyChart(key) {
    if (charts[key]) {
      charts[key].destroy();
      delete charts[key];
    }
  }

  function isSameDay(dateA, dateB) {
    return dateA.getFullYear() === dateB.getFullYear() &&
      dateA.getMonth() === dateB.getMonth() &&
      dateA.getDate() === dateB.getDate();
  }

  function startOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - day);
    return d;
  }

  function startOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  // ---------- DASHBOARD ----------

  async function initDashboard() {
    const settings = await Settings.getStoreSettings();
    const currency = settings.currency || 'Rp';

    const [transactions, expenses, products] = await Promise.all([
      DB.getAll(DB.STORES.transactions),
      DB.getAll(DB.STORES.expenses),
      DB.getAll(DB.STORES.products)
    ]);

    const today = new Date();
    const todayTrx = transactions.filter((t) => isSameDay(new Date(t.createdAt), today));
    const todayExpenses = expenses.filter((e) => isSameDay(new Date(e.date), today));

    const salesToday = todayTrx.reduce((sum, t) => sum + UI.safeNumber(t.total), 0);
    const trxCountToday = todayTrx.length;

    const items = await DB.getAll(DB.STORES.transaction_items);
    const todayTrxIds = new Set(todayTrx.map((t) => t.id));
    const itemsToday = items.filter((i) => todayTrxIds.has(i.transactionId));
    const productsSoldToday = itemsToday.reduce((sum, i) => sum + UI.safeNumber(i.qty), 0);

    let estimatedProfitToday = 0;
    itemsToday.forEach((item) => {
      const product = products.find((p) => p.id === item.productId);
      const cost = product ? product.costPrice : 0;
      estimatedProfitToday += (UI.safeNumber(item.price) - UI.safeNumber(cost)) * UI.safeNumber(item.qty);
    });

    const expenseToday = todayExpenses.reduce((sum, e) => sum + UI.safeNumber(e.amount), 0);

    renderStatCards([
      { label: 'Penjualan Hari Ini', value: UI.formatCurrency(salesToday, currency), icon: 'bi-cash-stack', color: '#4f46e5' },
      { label: 'Jumlah Transaksi', value: UI.formatNumber(trxCountToday), icon: 'bi-receipt', color: '#0ea5e9' },
      { label: 'Produk Terjual', value: UI.formatNumber(productsSoldToday), icon: 'bi-box-seam', color: '#16a34a' },
      { label: 'Estimasi Laba', value: UI.formatCurrency(estimatedProfitToday, currency), icon: 'bi-graph-up-arrow', color: '#d97706' },
      { label: 'Pengeluaran Hari Ini', value: UI.formatCurrency(expenseToday, currency), icon: 'bi-wallet2', color: '#dc2626' }
    ]);

    renderSalesWeekChart(transactions);
    await renderSalesCategoryChart(items, products);
    renderTopProductsChart(items, products);
    renderLowStockList(products);

    UI.qsa('.action-card').forEach((card) => {
      card.onclick = () => Router.navigateTo(card.dataset.nav);
    });
  }

  function renderStatCards(stats) {
    const container = UI.el('dashboardStats');
    container.innerHTML = stats.map((s) => `
      <div class="col-6 col-lg-3">
        <div class="stat-card">
          <div class="stat-icon" style="background:${s.color}"><i class="bi ${s.icon}"></i></div>
          <div>
            <div class="stat-value">${s.value}</div>
            <div class="stat-label">${s.label}</div>
          </div>
        </div>
      </div>`).join('');
  }

  function renderSalesWeekChart(transactions) {
    const labels = [];
    const values = [];
    const today = new Date();
    for (let i = 6; i >= 0; i -= 1) {
      const day = new Date(today);
      day.setDate(today.getDate() - i);
      labels.push(day.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' }));
      const total = transactions
        .filter((t) => isSameDay(new Date(t.createdAt), day))
        .reduce((sum, t) => sum + UI.safeNumber(t.total), 0);
      values.push(total);
    }

    const ctx = UI.el('chartSalesWeek');
    if (!ctx || typeof Chart === 'undefined') return;
    destroyChart('salesWeek');
    charts.salesWeek = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Penjualan',
          data: values,
          borderColor: '#4f46e5',
          backgroundColor: 'rgba(79,70,229,0.15)',
          fill: true,
          tension: 0.3
        }]
      },
      options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });
  }

  async function renderSalesCategoryChart(items, products) {
    const categories = await DB.getAll(DB.STORES.categories);
    const totalsByCategory = {};

    items.forEach((item) => {
      const product = products.find((p) => p.id === item.productId);
      const catName = product ? (categories.find((c) => c.id === product.categoryId)?.name || 'Tanpa Kategori') : 'Tanpa Kategori';
      totalsByCategory[catName] = (totalsByCategory[catName] || 0) + UI.safeNumber(item.lineTotal);
    });

    const labels = Object.keys(totalsByCategory);
    const values = Object.values(totalsByCategory);
    const ctx = UI.el('chartSalesCategory');
    if (!ctx || typeof Chart === 'undefined') return;
    destroyChart('salesCategory');

    if (labels.length === 0) {
      charts.salesCategory = new Chart(ctx, { type: 'doughnut', data: { labels: ['Belum ada data'], datasets: [{ data: [1], backgroundColor: ['#e2e8f0'] }] } });
      return;
    }

    charts.salesCategory = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: ['#4f46e5', '#0ea5e9', '#16a34a', '#d97706', '#dc2626', '#8b5cf6', '#ec4899']
        }]
      },
      options: { responsive: true }
    });
  }

  function renderTopProductsChart(items, products) {
    const totalsByProduct = {};
    items.forEach((item) => {
      totalsByProduct[item.productId] = (totalsByProduct[item.productId] || 0) + UI.safeNumber(item.qty);
    });

    const sorted = Object.entries(totalsByProduct).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const labels = sorted.map(([id]) => {
      const product = products.find((p) => String(p.id) === String(id));
      return product ? product.name : 'Produk';
    });
    const values = sorted.map(([, qty]) => qty);

    const ctx = UI.el('chartTopProducts');
    if (!ctx || typeof Chart === 'undefined') return;
    destroyChart('topProducts');

    if (labels.length === 0) {
      charts.topProducts = new Chart(ctx, { type: 'bar', data: { labels: ['Belum ada data'], datasets: [{ data: [0], backgroundColor: '#e2e8f0' }] } });
      return;
    }

    charts.topProducts = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets: [{ label: 'Terjual', data: values, backgroundColor: '#16a34a' }] },
      options: { responsive: true, indexAxis: 'y', plugins: { legend: { display: false } } }
    });
  }

  function renderLowStockList(products) {
    const lowStock = products.filter((p) => p.active !== false && p.stock <= (p.minStock || 0));
    const container = UI.el('lowStockList');
    if (lowStock.length === 0) {
      container.innerHTML = `<div class="text-muted text-center py-4">Semua stok aman</div>`;
      return;
    }
    container.innerHTML = lowStock.map((p) => `
      <div class="low-stock-row">
        <span>${UI.escapeHtml(p.name)}</span>
        <span class="badge text-bg-warning">Stok: ${UI.formatNumber(p.stock)}</span>
      </div>
    `).join('');
  }

  // ---------- REPORTS PAGE ----------

  async function initReportsPage() {
    const today = new Date();
    if (!UI.el('reportDateFrom').value) {
      UI.el('reportDateFrom').value = today.toISOString().slice(0, 10);
      UI.el('reportDateTo').value = today.toISOString().slice(0, 10);
    }

    await renderReportContent();

    if (!reportEventsBound) {
      reportEventsBound = true;
      UI.qsa('#reportsTab .nav-link').forEach((tab) => {
        tab.addEventListener('click', () => {
          UI.qsa('#reportsTab .nav-link').forEach((t) => t.classList.remove('active'));
          tab.classList.add('active');
          currentReportTab = tab.dataset.report;
          renderReportContent();
        });
      });
      UI.el('reportDateFrom').addEventListener('change', renderReportContent);
      UI.el('reportDateTo').addEventListener('change', renderReportContent);
      UI.qsa('[data-range]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const now = new Date();
          let from = now;
          if (btn.dataset.range === 'week') from = startOfWeek(now);
          if (btn.dataset.range === 'month') from = startOfMonth(now);
          UI.el('reportDateFrom').value = from.toISOString().slice(0, 10);
          UI.el('reportDateTo').value = now.toISOString().slice(0, 10);
          renderReportContent();
        });
      });
      UI.el('reportExportBtn').addEventListener('click', exportCurrentReport);
    }
  }

  function getDateRange() {
    const from = UI.el('reportDateFrom').value;
    const to = UI.el('reportDateTo').value;
    return {
      from: from ? new Date(`${from}T00:00:00`) : new Date(0),
      to: to ? new Date(`${to}T23:59:59`) : new Date()
    };
  }

  async function getFilteredData() {
    const { from, to } = getDateRange();
    const [transactions, items, expenses, products, categories] = await Promise.all([
      DB.getAll(DB.STORES.transactions),
      DB.getAll(DB.STORES.transaction_items),
      DB.getAll(DB.STORES.expenses),
      DB.getAll(DB.STORES.products),
      DB.getAll(DB.STORES.categories)
    ]);

    const filteredTrx = transactions.filter((t) => {
      const d = new Date(t.createdAt);
      return d >= from && d <= to;
    });
    const trxIds = new Set(filteredTrx.map((t) => t.id));
    const filteredItems = items.filter((i) => trxIds.has(i.transactionId));
    const filteredExpenses = expenses.filter((e) => {
      const d = new Date(e.date);
      return d >= from && d <= to;
    });

    return { transactions: filteredTrx, items: filteredItems, expenses: filteredExpenses, products, categories };
  }

  async function renderReportContent() {
    const data = await getFilteredData();
    const settings = await Settings.getStoreSettings();
    const currency = settings.currency || 'Rp';
    const container = UI.el('reportContent');

    if (currentReportTab === 'sales') {
      const totalSales = data.transactions.reduce((sum, t) => sum + t.total, 0);
      const totalTrx = data.transactions.length;
      const avgTrx = totalTrx > 0 ? totalSales / totalTrx : 0;
      container.innerHTML = `
        <div class="row g-3 mb-3">
          <div class="col-6 col-md-4"><div class="card p-3"><div class="stat-label">Total Penjualan</div><div class="stat-value">${UI.formatCurrency(totalSales, currency)}</div></div></div>
          <div class="col-6 col-md-4"><div class="card p-3"><div class="stat-label">Jumlah Transaksi</div><div class="stat-value">${UI.formatNumber(totalTrx)}</div></div></div>
          <div class="col-12 col-md-4"><div class="card p-3"><div class="stat-label">Rata-rata / Transaksi</div><div class="stat-value">${UI.formatCurrency(avgTrx, currency)}</div></div></div>
        </div>
        <div class="data-table-wrapper card p-0">
          <table class="pos-table">
            <thead><tr><th>No. Transaksi</th><th>Tanggal</th><th>Metode</th><th>Total</th></tr></thead>
            <tbody>${data.transactions.map((t) => `<tr><td>${UI.escapeHtml(t.transactionNumber)}</td><td>${UI.formatDate(t.createdAt, true)}</td><td>${t.paymentMethod}</td><td>${UI.formatCurrency(t.total, currency)}</td></tr>`).join('') || '<tr><td colspan="4" class="text-center text-muted py-4">Tidak ada data</td></tr>'}</tbody>
          </table>
        </div>
      `;
    } else if (currentReportTab === 'products') {
      const soldMap = {};
      data.items.forEach((i) => { soldMap[i.productId] = (soldMap[i.productId] || 0) + i.qty; });
      const bestSellers = Object.entries(soldMap).sort((a, b) => b[1] - a[1]).slice(0, 10);
      const soldIds = new Set(Object.keys(soldMap).map(Number));
      const unsold = data.products.filter((p) => !soldIds.has(p.id) && p.active !== false);
      const lowStock = data.products.filter((p) => p.stock <= (p.minStock || 0));

      container.innerHTML = `
        <div class="row g-3">
          <div class="col-12 col-lg-4">
            <div class="card p-3">
              <h6 class="card-section-title">Produk Terlaris</h6>
              ${bestSellers.map(([id, qty]) => {
                const p = data.products.find((pr) => pr.id === Number(id));
                return `<div class="low-stock-row"><span>${UI.escapeHtml(p ? p.name : '-')}</span><strong>${UI.formatNumber(qty)}</strong></div>`;
              }).join('') || '<div class="text-muted text-center py-3">Tidak ada data</div>'}
            </div>
          </div>
          <div class="col-12 col-lg-4">
            <div class="card p-3">
              <h6 class="card-section-title">Produk Tidak Laku</h6>
              ${unsold.slice(0, 10).map((p) => `<div class="low-stock-row"><span>${UI.escapeHtml(p.name)}</span></div>`).join('') || '<div class="text-muted text-center py-3">Semua produk terjual</div>'}
            </div>
          </div>
          <div class="col-12 col-lg-4">
            <div class="card p-3">
              <h6 class="card-section-title">Stok Menipis</h6>
              ${lowStock.map((p) => `<div class="low-stock-row"><span>${UI.escapeHtml(p.name)}</span><span class="badge text-bg-warning">${p.stock}</span></div>`).join('') || '<div class="text-muted text-center py-3">Stok aman</div>'}
            </div>
          </div>
        </div>
      `;
    } else if (currentReportTab === 'payments') {
      const totalsByMethod = {};
      data.transactions.forEach((t) => { totalsByMethod[t.paymentMethod] = (totalsByMethod[t.paymentMethod] || 0) + t.total; });
      container.innerHTML = `
        <div class="row g-3">
          ${Object.entries(totalsByMethod).map(([method, total]) => `
            <div class="col-6 col-md-3"><div class="card p-3"><div class="stat-label text-uppercase">${method}</div><div class="stat-value">${UI.formatCurrency(total, currency)}</div></div></div>
          `).join('') || '<div class="col-12 text-center text-muted py-4">Tidak ada data pembayaran</div>'}
        </div>
      `;
    } else if (currentReportTab === 'finance') {
      const totalSales = data.transactions.reduce((sum, t) => sum + t.total, 0);
      let totalCost = 0;
      data.items.forEach((item) => {
        const product = data.products.find((p) => p.id === item.productId);
        totalCost += (product ? product.costPrice : 0) * item.qty;
      });
      const grossProfit = totalSales - totalCost;
      const totalExpenses = data.expenses.reduce((sum, e) => sum + e.amount, 0);
      const netProfit = grossProfit - totalExpenses;

      container.innerHTML = `
        <div class="row g-3">
          <div class="col-6 col-md-3"><div class="card p-3"><div class="stat-label">Total Penjualan</div><div class="stat-value">${UI.formatCurrency(totalSales, currency)}</div></div></div>
          <div class="col-6 col-md-3"><div class="card p-3"><div class="stat-label">Total Modal</div><div class="stat-value">${UI.formatCurrency(totalCost, currency)}</div></div></div>
          <div class="col-6 col-md-3"><div class="card p-3"><div class="stat-label">Estimasi Laba Kotor</div><div class="stat-value">${UI.formatCurrency(grossProfit, currency)}</div></div></div>
          <div class="col-6 col-md-3"><div class="card p-3"><div class="stat-label">Total Pengeluaran</div><div class="stat-value">${UI.formatCurrency(totalExpenses, currency)}</div></div></div>
        </div>
        <div class="card p-3 mt-3">
          <div class="stat-label">Estimasi Laba Bersih</div>
          <div class="stat-value fs-3">${UI.formatCurrency(netProfit, currency)}</div>
          <small class="text-muted">*Estimasi dihitung dari penjualan dikurangi modal produk dan pengeluaran tercatat. Belum memperhitungkan biaya lain yang belum diinput.</small>
        </div>
      `;
    }
  }

  async function exportCurrentReport() {
    const data = await getFilteredData();
    let rows = [];
    let headers = [];
    if (currentReportTab === 'sales') {
      headers = ['NoTransaksi', 'Tanggal', 'Metode', 'Total'];
      rows = data.transactions.map((t) => ({ NoTransaksi: t.transactionNumber, Tanggal: UI.formatDate(t.createdAt, true), Metode: t.paymentMethod, Total: t.total }));
    } else if (currentReportTab === 'finance') {
      headers = ['Tanggal', 'Kategori', 'Deskripsi', 'Nominal'];
      rows = data.expenses.map((e) => ({ Tanggal: e.date, Kategori: e.category, Deskripsi: e.description, Nominal: e.amount }));
    } else {
      headers = ['ProdukId', 'Qty'];
      const soldMap = {};
      data.items.forEach((i) => { soldMap[i.productId] = (soldMap[i.productId] || 0) + i.qty; });
      rows = Object.entries(soldMap).map(([id, qty]) => ({ ProdukId: id, Qty: qty }));
    }
    const csv = Products.toCSV(rows, headers);
    Products.downloadFile(csv, `laporan_${currentReportTab}_${Date.now()}.csv`, 'text/csv;charset=utf-8;');
  }

  return { initDashboard, initReportsPage };
})();
