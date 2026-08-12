/**
 * transactions.js - Riwayat Transaksi, Pelanggan, Pengeluaran
 */

const Transactions = (() => {
  let allTransactions = [];
  let trxEventsBound = false;

  // ---------- TRANSACTIONS ----------

  async function initTransactionsPage() {
    allTransactions = await DB.getAll(DB.STORES.transactions);
    renderTransactionList();
    if (!trxEventsBound) {
      trxEventsBound = true;
      UI.el('trxSearchInput').addEventListener('input', UI.debounce(renderTransactionList, 250));
      UI.el('trxDateFrom').addEventListener('change', renderTransactionList);
      UI.el('trxDateTo').addEventListener('change', renderTransactionList);
      UI.el('trxPaymentFilter').addEventListener('change', renderTransactionList);
    }
  }

  function getFilteredTransactions() {
    let list = [...allTransactions];
    const search = (UI.el('trxSearchInput')?.value || '').toLowerCase().trim();
    const dateFrom = UI.el('trxDateFrom')?.value;
    const dateTo = UI.el('trxDateTo')?.value;
    const paymentFilter = UI.el('trxPaymentFilter')?.value;

    if (search) {
      list = list.filter((t) => t.transactionNumber.toLowerCase().includes(search));
    }
    if (dateFrom) {
      list = list.filter((t) => new Date(t.createdAt) >= new Date(`${dateFrom}T00:00:00`));
    }
    if (dateTo) {
      list = list.filter((t) => new Date(t.createdAt) <= new Date(`${dateTo}T23:59:59`));
    }
    if (paymentFilter) {
      list = list.filter((t) => t.paymentMethod === paymentFilter);
    }
    list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return list;
  }

  async function renderTransactionList() {
    const container = UI.el('trxListContainer');
    const list = getFilteredTransactions();
    const settings = await Settings.getStoreSettings();
    const currency = settings.currency || 'Rp';
    const canManage = Auth.hasRole('ADMIN');

    if (list.length === 0) {
      container.innerHTML = `<div class="card p-5 text-center text-muted"><i class="bi bi-receipt fs-1 d-block mb-2"></i>Belum ada transaksi</div>`;
      return;
    }

    const rows = list.map((t) => `
      <tr>
        <td>${UI.escapeHtml(t.transactionNumber)}</td>
        <td>${UI.formatDate(t.createdAt, true)}</td>
        <td>${UI.escapeHtml(t.cashierName || '-')}</td>
        <td>${paymentLabel(t.paymentMethod)}</td>
        <td>${UI.formatCurrency(t.total, currency)}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-secondary btn-detail" data-id="${t.id}"><i class="bi bi-eye"></i></button>
          ${canManage ? `<button class="btn btn-sm btn-outline-danger btn-delete-trx" data-id="${t.id}"><i class="bi bi-trash"></i></button>` : ''}
        </td>
      </tr>`).join('');

    const cards = list.map((t) => `
      <div class="data-card-item">
        <div class="d-flex justify-content-between"><strong>${UI.escapeHtml(t.transactionNumber)}</strong><span>${UI.formatCurrency(t.total, currency)}</span></div>
        <div class="text-muted small">${UI.formatDate(t.createdAt, true)} · ${UI.escapeHtml(t.cashierName || '-')} · ${paymentLabel(t.paymentMethod)}</div>
        <div class="d-flex gap-2 mt-2">
          <button class="btn btn-sm btn-outline-secondary flex-fill btn-detail" data-id="${t.id}"><i class="bi bi-eye"></i> Detail</button>
          ${canManage ? `<button class="btn btn-sm btn-outline-danger btn-delete-trx" data-id="${t.id}"><i class="bi bi-trash"></i></button>` : ''}
        </div>
      </div>`).join('');

    container.innerHTML = `
      <div class="data-table-wrapper card p-0">
        <table class="pos-table">
          <thead><tr><th>No. Transaksi</th><th>Tanggal</th><th>Kasir</th><th>Metode</th><th>Total</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="data-card-list">${cards}</div>
    `;

    UI.qsa('.btn-detail', container).forEach((btn) => btn.addEventListener('click', () => showTransactionDetail(Number(btn.dataset.id))));
    UI.qsa('.btn-delete-trx', container).forEach((btn) => btn.addEventListener('click', () => confirmDeleteTransaction(Number(btn.dataset.id))));
  }

  function paymentLabel(method) {
    const labels = { cash: 'Cash', transfer: 'Transfer', qris: 'QRIS', debit: 'Debit', kredit: 'Kredit', ewallet: 'E-Wallet' };
    return labels[method] || method || '-';
  }

  async function showTransactionDetail(id) {
    const transaction = await DB.get(DB.STORES.transactions, id);
    if (!transaction) {
      UI.showError('Transaksi tidak ditemukan.');
      return;
    }
    const items = await DB.getAllByIndex(DB.STORES.transaction_items, 'transactionId', id);
    const settings = await Settings.getStoreSettings();
    const currency = settings.currency || 'Rp';

    let customerName = 'Walk-in Customer';
    if (transaction.customerId) {
      const customer = await DB.get(DB.STORES.customers, Number(transaction.customerId));
      if (customer) customerName = customer.name;
    }

    const itemRows = items.map((i) => `
      <tr><td>${UI.escapeHtml(i.productName)}</td><td>${i.qty}</td><td>${UI.formatCurrency(i.price, currency)}</td><td>${UI.formatCurrency(i.lineTotal, currency)}</td></tr>
    `).join('');

    const bodyHtml = `
      <div class="mb-2"><strong>${UI.escapeHtml(transaction.transactionNumber)}</strong></div>
      <div class="text-muted small mb-3">${UI.formatDate(transaction.createdAt, true)} · Kasir: ${UI.escapeHtml(transaction.cashierName || '-')} · ${UI.escapeHtml(customerName)}</div>
      <div class="data-table-wrapper">
        <table class="pos-table">
          <thead><tr><th>Produk</th><th>Qty</th><th>Harga</th><th>Subtotal</th></tr></thead>
          <tbody>${itemRows}</tbody>
        </table>
      </div>
      <hr>
      <div class="d-flex justify-content-between"><span>Subtotal</span><span>${UI.formatCurrency(transaction.subtotal, currency)}</span></div>
      <div class="d-flex justify-content-between"><span>Diskon</span><span>-${UI.formatCurrency(transaction.discount, currency)}</span></div>
      <div class="d-flex justify-content-between"><span>Pajak</span><span>${UI.formatCurrency(transaction.tax, currency)}</span></div>
      <div class="d-flex justify-content-between fs-5 fw-bold"><span>TOTAL</span><span>${UI.formatCurrency(transaction.total, currency)}</span></div>
      <div class="d-flex justify-content-between mt-2"><span>${paymentLabel(transaction.paymentMethod)}</span><span>${UI.formatCurrency(transaction.paidAmount, currency)}</span></div>
      ${transaction.paymentMethod === 'cash' ? `<div class="d-flex justify-content-between"><span>Kembalian</span><span>${UI.formatCurrency(transaction.change, currency)}</span></div>` : ''}
      <button class="btn btn-primary w-100 mt-3" id="reprintReceiptBtn"><i class="bi bi-receipt me-1"></i>Cetak Ulang Struk</button>
    `;

    Products.showGenericModal('Detail Transaksi', bodyHtml);

    UI.el('reprintReceiptBtn').addEventListener('click', async () => {
      transaction.items = items;
      await POS_showReceiptExternal(transaction);
    });
  }

  // Wrapper untuk memanggil fungsi showReceipt dari modul POS (tidak diekspos langsung, jadi dibuat ulang tampilannya via transaksi tersimpan)
  async function POS_showReceiptExternal(transaction) {
    // Re-use logic dengan trik: panggil openCheckoutModal tidak relevan, jadi kita render manual sederhana
    const settings = await Settings.getStoreSettings();
    const currency = settings.currency || 'Rp';
    let customerName = 'Walk-in Customer';
    if (transaction.customerId) {
      const customer = await DB.get(DB.STORES.customers, Number(transaction.customerId));
      if (customer) customerName = customer.name;
    }
    const lines = [
      centerText(settings.storeName || 'TOKO SAYA', 32),
      settings.storeAddress ? centerText(settings.storeAddress, 32) : '',
      '',
      transaction.transactionNumber,
      UI.formatDate(transaction.createdAt, true),
      `Kasir: ${transaction.cashierName || '-'}`,
      `Customer: ${customerName}`,
      '-'.repeat(32),
      ...transaction.items.map((i) => `${i.productName}\n  ${i.qty} x ${UI.formatNumber(i.price)}`),
      '-'.repeat(32),
      `Subtotal: ${UI.formatNumber(transaction.subtotal)}`,
      `Diskon: -${UI.formatNumber(transaction.discount)}`,
      `Pajak: ${UI.formatNumber(transaction.tax)}`,
      `TOTAL: ${UI.formatNumber(transaction.total)}`,
      '',
      centerText(settings.receiptFooter || 'TERIMA KASIH', 32)
    ].filter(Boolean).join('\n');

    UI.el('receiptContent').textContent = lines;
    const modal = new bootstrap.Modal(UI.el('receiptModal'));
    modal.show();
    UI.el('receiptPrintBtn').onclick = () => window.print();
    void currency;
  }

  function centerText(text, width) {
    if (!text) return '';
    const clean = text.length > width ? text.slice(0, width) : text;
    const padding = Math.max(0, Math.floor((width - clean.length) / 2));
    return ' '.repeat(padding) + clean;
  }

  async function confirmDeleteTransaction(id) {
    const confirmed = await UI.confirm({
      title: 'Hapus Transaksi?',
      text: 'Transaksi yang dihapus tidak dapat dikembalikan. Stok produk tidak akan otomatis dikembalikan.',
      confirmButtonText: 'Ya, Hapus Permanen'
    });
    if (!confirmed) return;
    try {
      const items = await DB.getAllByIndex(DB.STORES.transaction_items, 'transactionId', id);
      for (const item of items) {
        await DB.remove(DB.STORES.transaction_items, item.id);
      }
      await DB.remove(DB.STORES.transactions, id);
      allTransactions = await DB.getAll(DB.STORES.transactions);
      renderTransactionList();
      UI.success('Transaksi berhasil dihapus.');
    } catch (err) {
      console.error('confirmDeleteTransaction error:', err);
      UI.showError('Gagal menghapus transaksi.');
    }
  }

  // ---------- CUSTOMERS ----------

  let allCustomers = [];
  let customerEventsBound = false;

  async function initCustomersPage() {
    allCustomers = await DB.getAll(DB.STORES.customers);
    renderCustomerList();
    if (!customerEventsBound) {
      customerEventsBound = true;
      UI.el('customerSearchInput').addEventListener('input', UI.debounce(renderCustomerList, 250));
      UI.el('customerAddBtn').addEventListener('click', () => openCustomerForm());
    }
  }

  function renderCustomerList() {
    const container = UI.el('customerListContainer');
    const search = (UI.el('customerSearchInput')?.value || '').toLowerCase().trim();
    let list = [...allCustomers];
    if (search) {
      list = list.filter((c) => c.name.toLowerCase().includes(search) || (c.phone && c.phone.includes(search)));
    }

    if (list.length === 0) {
      container.innerHTML = `<div class="card p-5 text-center text-muted"><i class="bi bi-people fs-1 d-block mb-2"></i>Belum ada pelanggan</div>`;
      return;
    }

    const rows = list.map((c) => `
      <tr>
        <td>${UI.escapeHtml(c.name)}</td>
        <td>${UI.escapeHtml(c.phone || '-')}</td>
        <td>${UI.escapeHtml(c.email || '-')}</td>
        <td>${UI.formatNumber(c.totalTransactions || 0)}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-secondary btn-edit-cust" data-id="${c.id}"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-sm btn-outline-danger btn-delete-cust" data-id="${c.id}"><i class="bi bi-trash"></i></button>
        </td>
      </tr>`).join('');

    container.innerHTML = `
      <div class="data-table-wrapper card p-0">
        <table class="pos-table">
          <thead><tr><th>Nama</th><th>No. HP</th><th>Email</th><th>Total Transaksi</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="data-card-list">
        ${list.map((c) => `
          <div class="data-card-item">
            <strong>${UI.escapeHtml(c.name)}</strong>
            <div class="text-muted small">${UI.escapeHtml(c.phone || '-')} · ${UI.escapeHtml(c.email || '-')}</div>
            <div class="d-flex gap-2 mt-2">
              <button class="btn btn-sm btn-outline-secondary flex-fill btn-edit-cust" data-id="${c.id}"><i class="bi bi-pencil"></i> Edit</button>
              <button class="btn btn-sm btn-outline-danger btn-delete-cust" data-id="${c.id}"><i class="bi bi-trash"></i></button>
            </div>
          </div>`).join('')}
      </div>
    `;

    UI.qsa('.btn-edit-cust', container).forEach((btn) => btn.addEventListener('click', () => openCustomerForm(Number(btn.dataset.id))));
    UI.qsa('.btn-delete-cust', container).forEach((btn) => btn.addEventListener('click', () => confirmDeleteCustomer(Number(btn.dataset.id))));
  }

  function openCustomerForm(editingId) {
    const customer = editingId ? allCustomers.find((c) => c.id === editingId) : null;
    const bodyHtml = `
      <form id="customerForm">
        <div class="mb-3">
          <label class="form-label">Nama *</label>
          <input type="text" class="form-control" id="cuName" value="${UI.escapeHtml(customer?.name || '')}" required>
        </div>
        <div class="mb-3">
          <label class="form-label">Nomor HP</label>
          <input type="text" class="form-control" id="cuPhone" value="${UI.escapeHtml(customer?.phone || '')}">
        </div>
        <div class="mb-3">
          <label class="form-label">Email</label>
          <input type="email" class="form-control" id="cuEmail" value="${UI.escapeHtml(customer?.email || '')}">
        </div>
        <div class="mb-3">
          <label class="form-label">Alamat</label>
          <textarea class="form-control" id="cuAddress" rows="2">${UI.escapeHtml(customer?.address || '')}</textarea>
        </div>
        <div id="cuErrorBox" class="alert alert-danger py-2 d-none"></div>
        <button type="submit" class="btn btn-primary w-100">Simpan Pelanggan</button>
      </form>
    `;
    Products.showGenericModal(editingId ? 'Edit Pelanggan' : 'Tambah Pelanggan', bodyHtml);

    UI.el('customerForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const errorBox = UI.el('cuErrorBox');
      errorBox.classList.add('d-none');
      const name = UI.el('cuName').value.trim();
      if (!name) {
        errorBox.textContent = 'Nama pelanggan wajib diisi.';
        errorBox.classList.remove('d-none');
        return;
      }
      try {
        const payload = {
          name,
          phone: UI.el('cuPhone').value.trim(),
          email: UI.el('cuEmail').value.trim(),
          address: UI.el('cuAddress').value.trim(),
          isGuestData: Auth.isGuest(),
          updatedAt: new Date().toISOString()
        };
        if (editingId) {
          payload.id = editingId;
          payload.totalTransactions = customer.totalTransactions || 0;
          payload.totalSpent = customer.totalSpent || 0;
          payload.createdAt = customer.createdAt;
          await DB.put(DB.STORES.customers, payload);
        } else {
          payload.totalTransactions = 0;
          payload.totalSpent = 0;
          payload.createdAt = new Date().toISOString();
          await DB.add(DB.STORES.customers, payload);
        }
        allCustomers = await DB.getAll(DB.STORES.customers);
        bootstrap.Modal.getInstance(UI.el('genericModal'))?.hide();
        renderCustomerList();
        UI.success('Pelanggan berhasil disimpan.');
      } catch (err) {
        errorBox.textContent = err.message || 'Gagal menyimpan pelanggan.';
        errorBox.classList.remove('d-none');
      }
    });
  }

  async function confirmDeleteCustomer(id) {
    const confirmed = await UI.confirm({ title: 'Hapus Pelanggan?', text: 'Data pelanggan ini akan dihapus permanen.' });
    if (!confirmed) return;
    try {
      await DB.remove(DB.STORES.customers, id);
      allCustomers = await DB.getAll(DB.STORES.customers);
      renderCustomerList();
      UI.success('Pelanggan berhasil dihapus.');
    } catch (err) {
      UI.showError('Gagal menghapus pelanggan.');
    }
  }

  // ---------- EXPENSES ----------

  let allExpenses = [];
  let expenseEventsBound = false;
  const EXPENSE_CATEGORIES = ['Operasional', 'Listrik', 'Air', 'Internet', 'Transportasi', 'Gaji', 'Maintenance', 'Lainnya'];

  async function initExpensesPage(params) {
    allExpenses = await DB.getAll(DB.STORES.expenses);
    renderExpenseList();
    if (!expenseEventsBound) {
      expenseEventsBound = true;
      UI.el('expenseSearchInput').addEventListener('input', UI.debounce(renderExpenseList, 250));
      UI.el('expenseAddBtn').addEventListener('click', () => openExpenseForm());
    }
    if (params && params.get && params.get('action') === 'new') {
      openExpenseForm();
    }
  }

  async function renderExpenseList() {
    const container = UI.el('expenseListContainer');
    const search = (UI.el('expenseSearchInput')?.value || '').toLowerCase().trim();
    const settings = await Settings.getStoreSettings();
    const currency = settings.currency || 'Rp';
    let list = [...allExpenses].sort((a, b) => new Date(b.date) - new Date(a.date));
    if (search) {
      list = list.filter((e) => e.description.toLowerCase().includes(search) || e.category.toLowerCase().includes(search));
    }

    if (list.length === 0) {
      container.innerHTML = `<div class="card p-5 text-center text-muted"><i class="bi bi-wallet2 fs-1 d-block mb-2"></i>Belum ada pengeluaran</div>`;
      return;
    }

    const rows = list.map((e) => `
      <tr>
        <td>${UI.formatDate(e.date)}</td>
        <td>${UI.escapeHtml(e.category)}</td>
        <td>${UI.escapeHtml(e.description)}</td>
        <td>${UI.formatCurrency(e.amount, currency)}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-secondary btn-edit-exp" data-id="${e.id}"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-sm btn-outline-danger btn-delete-exp" data-id="${e.id}"><i class="bi bi-trash"></i></button>
        </td>
      </tr>`).join('');

    container.innerHTML = `
      <div class="data-table-wrapper card p-0">
        <table class="pos-table">
          <thead><tr><th>Tanggal</th><th>Kategori</th><th>Deskripsi</th><th>Nominal</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="data-card-list">
        ${list.map((e) => `
          <div class="data-card-item">
            <div class="d-flex justify-content-between"><strong>${UI.escapeHtml(e.category)}</strong><span>${UI.formatCurrency(e.amount, currency)}</span></div>
            <div class="text-muted small">${UI.formatDate(e.date)} · ${UI.escapeHtml(e.description)}</div>
            <div class="d-flex gap-2 mt-2">
              <button class="btn btn-sm btn-outline-secondary flex-fill btn-edit-exp" data-id="${e.id}"><i class="bi bi-pencil"></i> Edit</button>
              <button class="btn btn-sm btn-outline-danger btn-delete-exp" data-id="${e.id}"><i class="bi bi-trash"></i></button>
            </div>
          </div>`).join('')}
      </div>
    `;

    UI.qsa('.btn-edit-exp', container).forEach((btn) => btn.addEventListener('click', () => openExpenseForm(Number(btn.dataset.id))));
    UI.qsa('.btn-delete-exp', container).forEach((btn) => btn.addEventListener('click', () => confirmDeleteExpense(Number(btn.dataset.id))));
  }

  function openExpenseForm(editingId) {
    const expense = editingId ? allExpenses.find((e) => e.id === editingId) : null;
    const categoryOptions = EXPENSE_CATEGORIES.map((c) => `<option value="${c}" ${expense?.category === c ? 'selected' : ''}>${c}</option>`).join('');
    const todayStr = new Date().toISOString().slice(0, 10);

    const bodyHtml = `
      <form id="expenseForm">
        <div class="mb-3">
          <label class="form-label">Tanggal *</label>
          <input type="date" class="form-control" id="exDate" value="${expense?.date || todayStr}" required>
        </div>
        <div class="mb-3">
          <label class="form-label">Kategori *</label>
          <select class="form-select" id="exCategory" required>${categoryOptions}</select>
        </div>
        <div class="mb-3">
          <label class="form-label">Deskripsi *</label>
          <input type="text" class="form-control" id="exDescription" value="${UI.escapeHtml(expense?.description || '')}" required>
        </div>
        <div class="mb-3">
          <label class="form-label">Nominal *</label>
          <input type="number" min="0" class="form-control" id="exAmount" value="${expense?.amount ?? 0}" required>
        </div>
        <div class="mb-3">
          <label class="form-label">Catatan</label>
          <textarea class="form-control" id="exNotes" rows="2">${UI.escapeHtml(expense?.notes || '')}</textarea>
        </div>
        <div id="exErrorBox" class="alert alert-danger py-2 d-none"></div>
        <button type="submit" class="btn btn-primary w-100">Simpan Pengeluaran</button>
      </form>
    `;
    Products.showGenericModal(editingId ? 'Edit Pengeluaran' : 'Tambah Pengeluaran', bodyHtml);

    UI.el('expenseForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const errorBox = UI.el('exErrorBox');
      errorBox.classList.add('d-none');
      const amount = UI.money(UI.el('exAmount').value);
      if (amount < 0) {
        errorBox.textContent = 'Nominal tidak boleh negatif.';
        errorBox.classList.remove('d-none');
        return;
      }
      try {
        const payload = {
          date: UI.el('exDate').value,
          category: UI.el('exCategory').value,
          description: UI.el('exDescription').value.trim(),
          amount,
          notes: UI.el('exNotes').value.trim(),
          userId: Auth.getSession() ? Auth.getSession().id : null,
          isGuestData: Auth.isGuest()
        };
        if (editingId) {
          payload.id = editingId;
          payload.createdAt = expense.createdAt;
          await DB.put(DB.STORES.expenses, payload);
        } else {
          payload.createdAt = new Date().toISOString();
          await DB.add(DB.STORES.expenses, payload);
        }
        allExpenses = await DB.getAll(DB.STORES.expenses);
        bootstrap.Modal.getInstance(UI.el('genericModal'))?.hide();
        renderExpenseList();
        UI.success('Pengeluaran berhasil disimpan.');
      } catch (err) {
        errorBox.textContent = err.message || 'Gagal menyimpan pengeluaran.';
        errorBox.classList.remove('d-none');
      }
    });
  }

  async function confirmDeleteExpense(id) {
    const confirmed = await UI.confirm({ title: 'Hapus Pengeluaran?', text: 'Data pengeluaran ini akan dihapus permanen.' });
    if (!confirmed) return;
    try {
      await DB.remove(DB.STORES.expenses, id);
      allExpenses = await DB.getAll(DB.STORES.expenses);
      renderExpenseList();
      UI.success('Pengeluaran berhasil dihapus.');
    } catch (err) {
      UI.showError('Gagal menghapus pengeluaran.');
    }
  }

  return {
    initTransactionsPage,
    initCustomersPage,
    initExpensesPage,
    EXPENSE_CATEGORIES
  };
})();
