/**
 * pos.js - Halaman Kasir (POS)
 */

const POS = (() => {
  let cart = []; // { productId, name, price, qty, stock, unit }
  let discountType = 'nominal';
  let discountValue = 0;
  let taxRate = 0;
  let selectedCustomerId = '';
  let settings = null;
  let bestsellerMap = {};

  function getSettings() { return settings; }

  async function init(params) {
    settings = await Settings.getStoreSettings();
    taxRate = UI.safeNumber(settings.taxRate);
    UI.el('posTaxRateLabel').textContent = taxRate;

    await Products.loadCategories();
    await Products.loadProducts();
    await computeBestsellers();
    renderCategoryOptions();
    await renderCustomerOptions();
    renderProductGrid();
    renderCart();

    bindEventsOnce();
  }

  let eventsBound = false;
  function bindEventsOnce() {
    if (eventsBound) return;
    eventsBound = true;

    UI.el('posSearchInput').addEventListener('input', UI.debounce(() => {
      Products.setFilter({ search: UI.el('posSearchInput').value.trim() });
      renderProductGrid();
    }, 250));

    UI.el('posCategoryFilter').addEventListener('change', (e) => {
      Products.setFilter({ categoryId: e.target.value });
      renderProductGrid();
    });

    UI.el('posSortSelect').addEventListener('change', (e) => {
      Products.setFilter({ sort: e.target.value });
      renderProductGrid();
    });

    UI.el('posClearCartBtn').addEventListener('click', async () => {
      if (cart.length === 0) return;
      const confirmed = await UI.confirm({ title: 'Kosongkan Keranjang?', text: 'Semua item akan dihapus.' });
      if (confirmed) {
        cart = [];
        renderCart();
      }
    });

    UI.el('posDiscountType').addEventListener('change', (e) => {
      discountType = e.target.value;
      renderCartSummary();
    });

    UI.el('posDiscountValue').addEventListener('input', (e) => {
      discountValue = UI.safeNumber(e.target.value);
      renderCartSummary();
    });

    UI.el('posCustomerSelect').addEventListener('change', (e) => {
      selectedCustomerId = e.target.value;
    });

    UI.el('posPayBtn').addEventListener('click', openCheckoutModal);

    UI.el('posFloatingCartBtn').addEventListener('click', () => {
      UI.el('posCartPanel').classList.add('show');
    });

    const closeBtn = UI.el('posCartCloseBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        UI.el('posCartPanel').classList.remove('show');
      });
    }
  }

  async function computeBestsellers() {
    try {
      const items = await DB.getAll(DB.STORES.transaction_items);
      bestsellerMap = {};
      items.forEach((item) => {
        bestsellerMap[item.productId] = (bestsellerMap[item.productId] || 0) + UI.safeNumber(item.qty);
      });
    } catch (err) {
      console.error('computeBestsellers error:', err);
      bestsellerMap = {};
    }
  }

  function renderCategoryOptions() {
    const select = UI.el('posCategoryFilter');
    const categories = Products.getCachedCategories();
    select.innerHTML = '<option value="">Semua Kategori</option>' +
      categories.map((c) => `<option value="${c.id}">${UI.escapeHtml(c.name)}</option>`).join('');
  }

  async function renderCustomerOptions() {
    const customers = await DB.getAll(DB.STORES.customers);
    const select = UI.el('posCustomerSelect');
    select.innerHTML = '<option value="">Walk-in Customer</option>' +
      customers.map((c) => `<option value="${c.id}">${UI.escapeHtml(c.name)}</option>`).join('');
  }

  function renderProductGrid() {
    const grid = UI.el('posProductGrid');
    let list = Products.getFilteredProducts();
    list = list.filter((p) => p.active !== false);

    const sortSelect = UI.el('posSortSelect');
    if (sortSelect && sortSelect.value === 'bestseller') {
      list.sort((a, b) => (bestsellerMap[b.id] || 0) - (bestsellerMap[a.id] || 0));
    }

    if (list.length === 0) {
      grid.innerHTML = `<div class="text-center text-muted py-5" style="grid-column:1/-1;">
        <i class="bi bi-inbox fs-1 d-block mb-2"></i>Produk tidak ditemukan
      </div>`;
      return;
    }

    grid.innerHTML = list.map((p) => {
      const outOfStock = p.stock <= 0;
      const photoHtml = p.photo
        ? `<img src="${p.photo}" alt="${UI.escapeHtml(p.name)}">`
        : `<i class="bi bi-box-seam"></i>`;
      return `
        <div class="pos-product-card ${outOfStock ? 'disabled' : ''}" data-id="${p.id}">
          <div class="pos-product-img">${photoHtml}</div>
          <div class="pos-product-name">${UI.escapeHtml(p.name)}</div>
          <div class="pos-product-price">${UI.formatCurrency(p.sellPrice, settings.currency || 'Rp')}</div>
          <div class="pos-product-stock">${outOfStock ? 'Stok habis' : `Stok: ${UI.formatNumber(p.stock)} ${UI.escapeHtml(p.unit || '')}`}</div>
        </div>`;
    }).join('');

    UI.qsa('.pos-product-card', grid).forEach((card) => {
      card.addEventListener('click', () => {
        if (card.classList.contains('disabled')) return;
        addToCart(Number(card.dataset.id));
      });
    });
  }

  function addToCart(productId) {
    const product = Products.getCachedProducts().find((p) => p.id === productId);
    if (!product) {
      UI.showError('Produk tidak ditemukan.');
      return;
    }
    if (product.stock <= 0) {
      UI.warn('Stok produk habis.');
      return;
    }

    const existing = cart.find((item) => item.productId === productId);
    if (existing) {
      if (existing.qty + 1 > product.stock) {
        UI.warn('Jumlah melebihi stok yang tersedia.');
        return;
      }
      existing.qty += 1;
    } else {
      cart.push({
        productId,
        name: product.name,
        price: UI.money(product.sellPrice),
        qty: 1,
        stock: product.stock,
        unit: product.unit || 'pcs'
      });
    }
    renderCart();
  }

  function changeQty(productId, delta) {
    const item = cart.find((i) => i.productId === productId);
    if (!item) return;
    const newQty = item.qty + delta;
    if (newQty <= 0) {
      cart = cart.filter((i) => i.productId !== productId);
    } else if (newQty > item.stock) {
      UI.warn('Jumlah melebihi stok yang tersedia.');
      return;
    } else {
      item.qty = newQty;
    }
    renderCart();
  }

  function removeFromCart(productId) {
    cart = cart.filter((i) => i.productId !== productId);
    renderCart();
  }

  function calculateTotals() {
    const subtotal = cart.reduce((sum, item) => sum + UI.money(item.price) * UI.safeNumber(item.qty), 0);

    let discountAmount = 0;
    if (discountType === 'percent') {
      discountAmount = Math.round(subtotal * (Math.min(100, Math.max(0, discountValue)) / 100));
    } else {
      discountAmount = Math.min(UI.money(discountValue), subtotal);
    }
    discountAmount = Math.max(0, discountAmount);

    const taxedBase = Math.max(0, subtotal - discountAmount);
    const taxAmount = Math.round(taxedBase * (UI.safeNumber(taxRate) / 100));
    const total = Math.max(0, taxedBase + taxAmount);

    return { subtotal, discountAmount, taxAmount, total };
  }

  function renderCart() {
    const container = UI.el('posCartItems');
    const emptyEl = UI.el('posCartEmpty');

    if (cart.length === 0) {
      container.innerHTML = '';
      container.appendChild(emptyEl);
      emptyEl.style.display = 'block';
    } else {
      emptyEl.style.display = 'none';
      container.innerHTML = cart.map((item) => `
        <div class="pos-cart-item" data-id="${item.productId}">
          <div class="pos-cart-item-info">
            <div class="pos-cart-item-name">${UI.escapeHtml(item.name)}</div>
            <div class="pos-cart-item-price">${UI.formatCurrency(item.price, settings.currency || 'Rp')} x ${item.qty}</div>
          </div>
          <div class="pos-cart-qty-control">
            <button type="button" data-action="dec" aria-label="Kurangi">-</button>
            <span>${item.qty}</span>
            <button type="button" data-action="inc" aria-label="Tambah">+</button>
          </div>
          <button type="button" class="pos-cart-item-remove" data-action="remove" aria-label="Hapus item"><i class="bi bi-trash"></i></button>
        </div>
      `).join('');

      UI.qsa('.pos-cart-item', container).forEach((row) => {
        const productId = Number(row.dataset.id);
        row.querySelector('[data-action="dec"]').addEventListener('click', () => changeQty(productId, -1));
        row.querySelector('[data-action="inc"]').addEventListener('click', () => changeQty(productId, 1));
        row.querySelector('[data-action="remove"]').addEventListener('click', () => removeFromCart(productId));
      });
    }

    const totalCount = cart.reduce((sum, item) => sum + item.qty, 0);
    UI.el('posFloatingCartCount').textContent = totalCount;

    renderCartSummary();
  }

  function renderCartSummary() {
    const { subtotal, discountAmount, taxAmount, total } = calculateTotals();
    const currency = settings.currency || 'Rp';
    UI.el('posSubtotal').textContent = UI.formatCurrency(subtotal, currency);
    UI.el('posTaxAmount').textContent = UI.formatCurrency(taxAmount, currency);
    UI.el('posTotal').textContent = UI.formatCurrency(total, currency);
    void discountAmount;
  }

  // ---------- CHECKOUT ----------

  function openCheckoutModal() {
    if (cart.length === 0) {
      UI.warn('Keranjang masih kosong.');
      return;
    }
    const { subtotal, discountAmount, taxAmount, total } = calculateTotals();
    const currency = settings.currency || 'Rp';

    const bodyHtml = `
      <div class="mb-3">
        <div class="d-flex justify-content-between"><span>Subtotal</span><strong>${UI.formatCurrency(subtotal, currency)}</strong></div>
        <div class="d-flex justify-content-between text-danger"><span>Diskon</span><strong>-${UI.formatCurrency(discountAmount, currency)}</strong></div>
        <div class="d-flex justify-content-between"><span>Pajak</span><strong>${UI.formatCurrency(taxAmount, currency)}</strong></div>
        <hr>
        <div class="d-flex justify-content-between fs-5"><span>TOTAL</span><strong id="checkoutTotalDisplay">${UI.formatCurrency(total, currency)}</strong></div>
      </div>
      <div class="mb-3">
        <label class="form-label">Metode Pembayaran</label>
        <select class="form-select" id="checkoutPaymentMethod">
          <option value="cash">Cash</option>
          <option value="transfer">Transfer</option>
          <option value="qris">QRIS</option>
          <option value="debit">Debit</option>
          <option value="kredit">Kredit</option>
          <option value="ewallet">E-Wallet</option>
        </select>
      </div>
      <div id="cashPaymentFields">
        <div class="mb-3">
          <label class="form-label">Uang Diterima</label>
          <input type="number" min="0" class="form-control" id="checkoutPaidAmount" placeholder="0">
        </div>
        <div class="d-flex justify-content-between">
          <span>Kembalian</span>
          <strong id="checkoutChangeDisplay">${UI.formatCurrency(0, currency)}</strong>
        </div>
      </div>
      <div id="checkoutErrorBox" class="alert alert-danger py-2 d-none mt-2"></div>
      <button class="btn btn-primary w-100 mt-3" id="checkoutConfirmBtn"><i class="bi bi-check-circle me-1"></i>Konfirmasi Pembayaran</button>
    `;

    showModal('Checkout', bodyHtml, 'modal-dialog');

    const paymentSelect = UI.el('checkoutPaymentMethod');
    const cashFields = UI.el('cashPaymentFields');
    const paidInput = UI.el('checkoutPaidAmount');
    const changeDisplay = UI.el('checkoutChangeDisplay');

    paymentSelect.addEventListener('change', () => {
      cashFields.style.display = paymentSelect.value === 'cash' ? 'block' : 'none';
    });

    paidInput.addEventListener('input', () => {
      const paid = UI.money(paidInput.value);
      const change = Math.max(0, paid - total);
      changeDisplay.textContent = UI.formatCurrency(change, currency);
    });

    UI.el('checkoutConfirmBtn').addEventListener('click', () => processCheckout(total));
  }

  async function processCheckout(total) {
    const errorBox = UI.el('checkoutErrorBox');
    errorBox.classList.add('d-none');

    const paymentMethod = UI.el('checkoutPaymentMethod').value;
    let paidAmount = total;
    let change = 0;

    if (paymentMethod === 'cash') {
      paidAmount = UI.money(UI.el('checkoutPaidAmount').value);
      if (paidAmount < total) {
        errorBox.textContent = 'Uang diterima tidak boleh lebih kecil dari total.';
        errorBox.classList.remove('d-none');
        return;
      }
      change = paidAmount - total;
    }

    const confirmBtn = UI.el('checkoutConfirmBtn');
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Memproses...';

    try {
      const transaction = await createTransaction({ paymentMethod, paidAmount, change, total });
      bootstrap.Modal.getInstance(UI.el('genericModal'))?.hide();
      await showReceipt(transaction);

      cart = [];
      discountValue = 0;
      UI.el('posDiscountValue').value = 0;
      renderCart();
      await Products.loadProducts();
      renderProductGrid();
      UI.success('Transaksi berhasil disimpan.');
    } catch (err) {
      console.error('processCheckout error:', err);
      errorBox.textContent = err.message || 'Transaksi gagal diproses.';
      errorBox.classList.remove('d-none');
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = '<i class="bi bi-check-circle me-1"></i>Konfirmasi Pembayaran';
    }
  }

  async function generateTransactionNumber() {
    const settingsData = await Settings.getStoreSettings();
    const format = settingsData.trxFormat || 'TRX-{YYYYMMDD}-{0000}';
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}${mm}${dd}`;

    const todayTransactions = await DB.getAll(DB.STORES.transactions);
    const countToday = todayTransactions.filter((t) => {
      const tDate = new Date(t.createdAt);
      return tDate.getFullYear() === yyyy && tDate.getMonth() === now.getMonth() && tDate.getDate() === now.getDate();
    }).length;

    const seq = String(countToday + 1).padStart(4, '0');
    let number = format.replace('{YYYYMMDD}', dateStr).replace('{0000}', seq);

    // Pastikan unik walau ada race condition sederhana
    let attempt = 0;
    let candidate = number;
    while (attempt < 50) {
      const existing = await DB.getAllByIndex(DB.STORES.transactions, 'transactionNumber', candidate);
      if (existing.length === 0) return candidate;
      attempt += 1;
      candidate = `${number}-${attempt}`;
    }
    return `${number}-${Date.now()}`;
  }

  async function createTransaction({ paymentMethod, paidAmount, change, total }) {
    if (cart.length === 0) throw new Error('Keranjang kosong.');

    const session = Auth.getSession();
    const { subtotal, discountAmount, taxAmount } = calculateTotals();
    const transactionNumber = await generateTransactionNumber();
    const isGuestData = !!(session && session.isGuest);

    const transactionPayload = {
      transactionNumber,
      createdAt: new Date().toISOString(),
      cashierId: session ? session.id : null,
      cashierName: session ? session.name : '-',
      customerId: selectedCustomerId || null,
      subtotal: UI.money(subtotal),
      discount: UI.money(discountAmount),
      tax: UI.money(taxAmount),
      total: UI.money(total),
      paymentMethod,
      paidAmount: UI.money(paidAmount),
      change: UI.money(change),
      status: 'completed',
      isGuestData
    };

    const transactionId = await DB.add(DB.STORES.transactions, transactionPayload);
    transactionPayload.id = transactionId;

    const items = [];
    for (const cartItem of cart) {
      const itemPayload = {
        transactionId,
        productId: cartItem.productId,
        productName: cartItem.name,
        price: UI.money(cartItem.price),
        qty: UI.safeNumber(cartItem.qty),
        lineTotal: UI.money(cartItem.price) * UI.safeNumber(cartItem.qty)
      };
      await DB.add(DB.STORES.transaction_items, itemPayload);
      items.push(itemPayload);

      if (!isGuestData) {
        await Products.reduceStockForSale(cartItem.productId, cartItem.qty, transactionNumber, session ? session.id : null);
      }
    }

    if (selectedCustomerId) {
      try {
        const customer = await DB.get(DB.STORES.customers, Number(selectedCustomerId));
        if (customer) {
          customer.totalTransactions = (customer.totalTransactions || 0) + 1;
          customer.totalSpent = (customer.totalSpent || 0) + UI.money(total);
          await DB.put(DB.STORES.customers, customer);
        }
      } catch (err) {
        console.error('Gagal update statistik customer:', err);
      }
    }

    transactionPayload.items = items;
    return transactionPayload;
  }

  // ---------- RECEIPT ----------

  async function showReceipt(transaction) {
    const storeSettings = await Settings.getStoreSettings();
    const currency = storeSettings.currency || 'Rp';
    let customerName = 'Walk-in Customer';
    if (transaction.customerId) {
      const customer = await DB.get(DB.STORES.customers, Number(transaction.customerId));
      if (customer) customerName = customer.name;
    }

    const itemLines = (transaction.items || []).map((item) => {
      const name = item.productName.length > 18 ? item.productName.slice(0, 18) : item.productName;
      const qtyPrice = `${item.qty} x ${UI.formatNumber(item.price)}`;
      const lineTotal = UI.formatNumber(item.lineTotal);
      return `${name}\n  ${qtyPrice}${' '.repeat(Math.max(1, 20 - qtyPrice.length))}${lineTotal}`;
    }).join('\n');

    const receiptText = [
      centerText(storeSettings.storeName || 'TOKO SAYA', 32),
      storeSettings.storeAddress ? centerText(storeSettings.storeAddress, 32) : '',
      '',
      transaction.transactionNumber,
      UI.formatDate(transaction.createdAt, true),
      `Kasir: ${transaction.cashierName || '-'}`,
      `Customer: ${customerName}`,
      '-'.repeat(32),
      itemLines,
      '-'.repeat(32),
      lineItem('Subtotal', UI.formatNumber(transaction.subtotal)),
      transaction.discount > 0 ? lineItem('Diskon', '-' + UI.formatNumber(transaction.discount)) : '',
      transaction.tax > 0 ? lineItem('Pajak', UI.formatNumber(transaction.tax)) : '',
      lineItem('TOTAL', UI.formatNumber(transaction.total)),
      '',
      lineItem(paymentMethodLabel(transaction.paymentMethod), UI.formatNumber(transaction.paidAmount)),
      transaction.paymentMethod === 'cash' ? lineItem('Kembalian', UI.formatNumber(transaction.change)) : '',
      '',
      centerText(storeSettings.receiptFooter || 'TERIMA KASIH', 32)
    ].filter((line) => line !== '').join('\n');

    UI.el('receiptContent').textContent = receiptText;
    void currency;

    const modal = new bootstrap.Modal(UI.el('receiptModal'));
    modal.show();

    UI.el('receiptPrintBtn').onclick = () => window.print();
  }

  function centerText(text, width) {
    if (!text) return '';
    const clean = text.length > width ? text.slice(0, width) : text;
    const padding = Math.max(0, Math.floor((width - clean.length) / 2));
    return ' '.repeat(padding) + clean;
  }

  function lineItem(label, value, width = 32) {
    const space = Math.max(1, width - label.length - value.length);
    return `${label}${' '.repeat(space)}${value}`;
  }

  function paymentMethodLabel(method) {
    const labels = { cash: 'Cash', transfer: 'Transfer', qris: 'QRIS', debit: 'Debit', kredit: 'Kredit', ewallet: 'E-Wallet' };
    return labels[method] || method;
  }

  function showModal(title, bodyHtml, size) {
    UI.el('genericModalTitle').textContent = title;
    UI.el('genericModalBody').innerHTML = bodyHtml;
    const dialog = UI.el('genericModalDialog');
    dialog.className = `modal-dialog modal-dialog-scrollable ${size || ''}`;
    const modal = new bootstrap.Modal(UI.el('genericModal'));
    modal.show();
  }

  return { init, getSettings };
})();
