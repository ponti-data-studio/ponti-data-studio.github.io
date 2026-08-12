/**
 * products.js - CRUD Produk & Kategori, Import/Export
 */

const Products = (() => {
  let allProducts = [];
  let allCategories = [];
  let filterState = { search: '', categoryId: '', sort: 'name' };

  // ---------- DATA ACCESS ----------

  async function loadCategories() {
    allCategories = await DB.getAll(DB.STORES.categories);
    return allCategories;
  }

  async function loadProducts() {
    allProducts = await DB.getAll(DB.STORES.products);
    return allProducts;
  }

  function getCategoryName(categoryId) {
    const cat = allCategories.find((c) => String(c.id) === String(categoryId));
    return cat ? cat.name : '-';
  }

  function getCachedProducts() { return allProducts; }
  function getCachedCategories() { return allCategories; }

  // ---------- CATEGORY CRUD ----------

  async function saveCategory(data, editingId) {
    if (!data.name || !data.name.trim()) {
      throw new Error('Nama kategori wajib diisi.');
    }
    const payload = {
      name: data.name.trim(),
      description: data.description ? data.description.trim() : '',
      status: data.status || 'active',
      updatedAt: new Date().toISOString()
    };
    if (editingId) {
      payload.id = Number(editingId);
      await DB.put(DB.STORES.categories, payload);
    } else {
      payload.createdAt = new Date().toISOString();
      await DB.add(DB.STORES.categories, payload);
    }
    await loadCategories();
  }

  async function deleteCategory(id) {
    const inUse = allProducts.some((p) => String(p.categoryId) === String(id));
    if (inUse) {
      throw new Error('Kategori tidak dapat dihapus karena masih digunakan oleh produk.');
    }
    await DB.remove(DB.STORES.categories, Number(id));
    await loadCategories();
  }

  // ---------- PRODUCT CRUD ----------

  async function validateProduct(data, editingId) {
    if (!data.name || !data.name.trim()) throw new Error('Nama produk wajib diisi.');
    if (UI.safeNumber(data.sellPrice) < 0) throw new Error('Harga jual tidak boleh negatif.');
    if (UI.safeNumber(data.costPrice) < 0) throw new Error('Harga modal tidak boleh negatif.');
    if (UI.safeNumber(data.stock) < 0) throw new Error('Stok tidak boleh negatif.');

    if (data.sku) {
      const unique = await DB.checkUnique(DB.STORES.products, 'sku', data.sku.trim(), editingId);
      if (!unique) throw new Error('SKU sudah digunakan oleh produk lain.');
    }
    if (data.barcode) {
      const dupBarcode = allProducts.find((p) => p.barcode && p.barcode === data.barcode.trim() && String(p.id) !== String(editingId));
      if (dupBarcode) throw new Error('Barcode sudah digunakan oleh produk lain.');
    }
  }

  async function saveProduct(data, editingId) {
    await validateProduct(data, editingId);

    const payload = {
      sku: data.sku ? data.sku.trim() : `SKU${Date.now()}`,
      barcode: data.barcode ? data.barcode.trim() : '',
      name: data.name.trim(),
      categoryId: data.categoryId ? Number(data.categoryId) : null,
      costPrice: UI.money(data.costPrice),
      sellPrice: UI.money(data.sellPrice),
      stock: UI.safeNumber(data.stock),
      minStock: UI.safeNumber(data.minStock) || 0,
      unit: data.unit ? data.unit.trim() : 'pcs',
      photo: data.photo || '',
      active: data.active !== false,
      isGuestData: !!data.isGuestData,
      updatedAt: new Date().toISOString()
    };

    if (editingId) {
      payload.id = Number(editingId);
      const existing = allProducts.find((p) => String(p.id) === String(editingId));
      payload.createdAt = existing ? existing.createdAt : new Date().toISOString();
      const stockDiff = payload.stock - (existing ? existing.stock : 0);
      await DB.put(DB.STORES.products, payload);
      if (stockDiff !== 0) {
        await recordStockMovement({
          productId: payload.id,
          type: 'ADJUSTMENT',
          quantity: stockDiff,
          stockBefore: existing ? existing.stock : 0,
          stockAfter: payload.stock,
          reference: 'Edit produk',
          userId: Auth.getSession() ? Auth.getSession().id : null
        });
      }
    } else {
      payload.createdAt = new Date().toISOString();
      const newId = await DB.add(DB.STORES.products, payload);
      if (payload.stock > 0) {
        await recordStockMovement({
          productId: newId,
          type: 'STOCK_IN',
          quantity: payload.stock,
          stockBefore: 0,
          stockAfter: payload.stock,
          reference: 'Stok awal produk baru',
          userId: Auth.getSession() ? Auth.getSession().id : null
        });
      }
    }
    await loadProducts();
  }

  async function deleteProduct(id) {
    await DB.remove(DB.STORES.products, Number(id));
    await loadProducts();
  }

  async function recordStockMovement({ productId, type, quantity, stockBefore, stockAfter, reference, userId }) {
    await DB.add(DB.STORES.stock_movements, {
      productId: Number(productId),
      type,
      quantity: UI.safeNumber(quantity),
      stockBefore: UI.safeNumber(stockBefore),
      stockAfter: UI.safeNumber(stockAfter),
      reference: reference || '',
      userId: userId || null,
      createdAt: new Date().toISOString()
    });
  }

  async function adjustStock(productId, newStock, reference) {
    const product = allProducts.find((p) => String(p.id) === String(productId));
    if (!product) throw new Error('Produk tidak ditemukan.');
    const stockBefore = product.stock;
    const stockAfter = UI.safeNumber(newStock);
    if (stockAfter < 0) throw new Error('Stok tidak boleh negatif.');

    product.stock = stockAfter;
    product.updatedAt = new Date().toISOString();
    await DB.put(DB.STORES.products, product);

    await recordStockMovement({
      productId: product.id,
      type: 'ADJUSTMENT',
      quantity: stockAfter - stockBefore,
      stockBefore,
      stockAfter,
      reference: reference || 'Penyesuaian manual',
      userId: Auth.getSession() ? Auth.getSession().id : null
    });

    await loadProducts();
  }

  async function reduceStockForSale(productId, qty, transactionRef, userId) {
    const product = await DB.get(DB.STORES.products, Number(productId));
    if (!product) throw new Error('Produk tidak ditemukan saat mengurangi stok.');
    const stockBefore = product.stock;
    const stockAfter = Math.max(0, stockBefore - qty);
    product.stock = stockAfter;
    await DB.put(DB.STORES.products, product);
    await recordStockMovement({
      productId: product.id,
      type: 'SALE',
      quantity: -qty,
      stockBefore,
      stockAfter,
      reference: transactionRef,
      userId
    });
  }

  // ---------- FILTER / SORT ----------

  function getFilteredProducts(overrideFilter) {
    const filter = overrideFilter || filterState;
    let list = [...allProducts];

    if (filter.search) {
      const term = filter.search.toLowerCase();
      list = list.filter((p) =>
        p.name.toLowerCase().includes(term) ||
        (p.sku && p.sku.toLowerCase().includes(term)) ||
        (p.barcode && p.barcode.toLowerCase().includes(term))
      );
    }

    if (filter.categoryId) {
      list = list.filter((p) => String(p.categoryId) === String(filter.categoryId));
    }

    switch (filter.sort) {
      case 'price':
        list.sort((a, b) => a.sellPrice - b.sellPrice);
        break;
      case 'stock':
        list.sort((a, b) => b.stock - a.stock);
        break;
      case 'bestseller':
        // diurutkan oleh caller (pos.js) berdasarkan data penjualan jika tersedia
        break;
      default:
        list.sort((a, b) => a.name.localeCompare(b.name));
    }

    return list;
  }

  function setFilter(partial) {
    filterState = { ...filterState, ...partial };
  }

  function getLowStockProducts() {
    return allProducts.filter((p) => p.active !== false && p.stock <= (p.minStock || 0));
  }

  // ---------- IMPORT / EXPORT ----------

  function toCSV(rows, headers) {
    const escapeCsv = (val) => {
      const str = String(val === undefined || val === null ? '' : val);
      if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
      return str;
    };
    const lines = [headers.join(',')];
    rows.forEach((row) => {
      lines.push(headers.map((h) => escapeCsv(row[h])).join(','));
    });
    return lines.join('\n');
  }

  function downloadFile(content, filename, mime) {
    try {
      const blob = new Blob([content], { type: mime });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('downloadFile error:', err);
      UI.showError('Gagal mengunduh file.');
    }
  }

  function exportProductsCSV() {
    const rows = allProducts.map((p) => ({
      SKU: p.sku, Barcode: p.barcode, Nama: p.name, Kategori: getCategoryName(p.categoryId),
      HargaModal: p.costPrice, HargaJual: p.sellPrice, Stok: p.stock, MinimumStok: p.minStock, Satuan: p.unit
    }));
    const csv = toCSV(rows, ['SKU', 'Barcode', 'Nama', 'Kategori', 'HargaModal', 'HargaJual', 'Stok', 'MinimumStok', 'Satuan']);
    downloadFile(csv, `produk_${Date.now()}.csv`, 'text/csv;charset=utf-8;');
  }

  function parseCSV(text) {
    const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
    if (lines.length < 2) return { headers: [], rows: [] };
    const headers = lines[0].split(',').map((h) => h.trim());
    const rows = lines.slice(1).map((line) => {
      const values = line.split(',');
      const obj = {};
      headers.forEach((h, i) => { obj[h] = (values[i] || '').trim(); });
      return obj;
    });
    return { headers, rows };
  }

  async function importProductsFromCSV(text) {
    const expectedHeaders = ['SKU', 'Barcode', 'Nama', 'Kategori', 'HargaModal', 'HargaJual', 'Stok', 'MinimumStok', 'Satuan'];
    const { headers, rows } = parseCSV(text);

    const missingHeaders = expectedHeaders.filter((h) => !headers.includes(h));
    if (missingHeaders.length > 0) {
      throw new Error(`Header tidak lengkap. Header wajib: ${expectedHeaders.join(', ')}`);
    }

    const results = { valid: [], errors: [] };
    const seenSku = new Set();
    const seenBarcode = new Set();

    rows.forEach((row, idx) => {
      const lineNo = idx + 2;
      if (!row.Nama) {
        results.errors.push(`Baris ${lineNo}: Nama produk kosong.`);
        return;
      }
      const costPrice = Number(row.HargaModal);
      const sellPrice = Number(row.HargaJual);
      const stock = Number(row.Stok);
      if (Number.isNaN(costPrice) || costPrice < 0) {
        results.errors.push(`Baris ${lineNo}: Harga modal tidak valid.`);
        return;
      }
      if (Number.isNaN(sellPrice) || sellPrice < 0) {
        results.errors.push(`Baris ${lineNo}: Harga jual tidak valid.`);
        return;
      }
      if (Number.isNaN(stock) || stock < 0) {
        results.errors.push(`Baris ${lineNo}: Stok tidak valid.`);
        return;
      }
      if (row.SKU) {
        if (seenSku.has(row.SKU) || allProducts.some((p) => p.sku === row.SKU)) {
          results.errors.push(`Baris ${lineNo}: SKU "${row.SKU}" duplikat.`);
          return;
        }
        seenSku.add(row.SKU);
      }
      if (row.Barcode) {
        if (seenBarcode.has(row.Barcode) || allProducts.some((p) => p.barcode === row.Barcode)) {
          results.errors.push(`Baris ${lineNo}: Barcode "${row.Barcode}" duplikat.`);
          return;
        }
        seenBarcode.add(row.Barcode);
      }

      const category = allCategories.find((c) => c.name.toLowerCase() === (row.Kategori || '').toLowerCase());

      results.valid.push({
        sku: row.SKU || `SKU${Date.now()}${idx}`,
        barcode: row.Barcode || '',
        name: row.Nama,
        categoryId: category ? category.id : null,
        costPrice,
        sellPrice,
        stock,
        minStock: Number(row.MinimumStok) || 0,
        unit: row.Satuan || 'pcs',
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    });

    return results;
  }

  async function commitImport(validRows) {
    for (const row of validRows) {
      const newId = await DB.add(DB.STORES.products, row);
      if (row.stock > 0) {
        await recordStockMovement({
          productId: newId, type: 'STOCK_IN', quantity: row.stock,
          stockBefore: 0, stockAfter: row.stock, reference: 'Import CSV',
          userId: Auth.getSession() ? Auth.getSession().id : null
        });
      }
    }
    await loadProducts();
  }

  // ---------- PAGE CONTROLLER (UI) ----------

  let pageEventsBound = false;
  let currentTab = 'list';

  async function initPage(params) {
    await loadCategories();
    await loadProducts();
    populateCategoryFilterOptions();
    renderProductList();
    renderCategoryList();
    bindPageEventsOnce();
    if (params && params.get && params.get('action') === 'new') {
      openProductForm();
    }
  }

  function populateCategoryFilterOptions() {
    const select = UI.el('productCategoryFilter');
    if (!select) return;
    select.innerHTML = '<option value="">Semua Kategori</option>' +
      allCategories.map((c) => `<option value="${c.id}">${UI.escapeHtml(c.name)}</option>`).join('');
  }

  function bindPageEventsOnce() {
    if (pageEventsBound) return;
    pageEventsBound = true;

    UI.qsa('#productsTab .nav-link').forEach((tab) => {
      tab.addEventListener('click', () => {
        UI.qsa('#productsTab .nav-link').forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        currentTab = tab.dataset.tab;
        UI.el('productsTabList').classList.toggle('d-none', currentTab !== 'list');
        UI.el('productsTabCategories').classList.toggle('d-none', currentTab !== 'categories');
      });
    });

    UI.el('productSearchInput').addEventListener('input', UI.debounce(() => {
      setFilter({ search: UI.el('productSearchInput').value.trim() });
      renderProductList();
    }, 250));

    UI.el('productCategoryFilter').addEventListener('change', (e) => {
      setFilter({ categoryId: e.target.value });
      renderProductList();
    });

    UI.el('productSortSelect').addEventListener('change', (e) => {
      setFilter({ sort: e.target.value });
      renderProductList();
    });

    UI.el('productAddBtn').addEventListener('click', () => openProductForm());
    UI.el('categoryAddBtn').addEventListener('click', () => openCategoryForm());
    UI.el('productExportBtn').addEventListener('click', () => exportProductsCSV());
    UI.el('productImportBtn').addEventListener('click', () => openImportModal());

    if (Auth.isGuest()) {
      ['productAddBtn', 'categoryAddBtn', 'productImportBtn', 'productExportBtn'].forEach((id) => {
        const btn = UI.el(id);
        if (btn) btn.classList.add('d-none');
      });
    }
  }

  async function renderProductList() {
    const container = UI.el('productListContainer');
    const list = getFilteredProducts();
    const storeSettings = await Settings.getStoreSettings();
    const currency = storeSettings.currency || 'Rp';
    const canManage = Auth.hasRole('ADMIN');
    const canEdit = !Auth.isGuest();

    if (list.length === 0) {
      container.innerHTML = `<div class="card p-5 text-center text-muted"><i class="bi bi-box2 fs-1 d-block mb-2"></i>Belum ada produk</div>`;
      return;
    }

    const rows = list.map((p) => {
      const low = p.stock <= (p.minStock || 0);
      return `
      <tr>
        <td>${UI.escapeHtml(p.sku)}</td>
        <td>${UI.escapeHtml(p.name)}</td>
        <td>${UI.escapeHtml(getCategoryName(p.categoryId))}</td>
        <td>${UI.formatCurrency(p.sellPrice, currency)}</td>
        <td>${low ? `<span class="badge text-bg-warning">${UI.formatNumber(p.stock)}</span>` : UI.formatNumber(p.stock)}</td>
        <td>${p.active !== false ? '<span class="badge text-bg-success">Aktif</span>' : '<span class="badge text-bg-secondary">Nonaktif</span>'}</td>
        <td class="text-end">
          ${canEdit ? `<button class="btn btn-sm btn-outline-secondary btn-edit" data-id="${p.id}"><i class="bi bi-pencil"></i></button>` : ''}
          ${canManage ? `<button class="btn btn-sm btn-outline-danger btn-delete" data-id="${p.id}"><i class="bi bi-trash"></i></button>` : ''}
        </td>
      </tr>`;
    }).join('');

    const cards = list.map((p) => {
      const low = p.stock <= (p.minStock || 0);
      return `
      <div class="data-card-item">
        <div class="d-flex justify-content-between">
          <strong>${UI.escapeHtml(p.name)}</strong>
          ${p.active !== false ? '<span class="badge text-bg-success">Aktif</span>' : '<span class="badge text-bg-secondary">Nonaktif</span>'}
        </div>
        <div class="text-muted small">${UI.escapeHtml(p.sku)} · ${UI.escapeHtml(getCategoryName(p.categoryId))}</div>
        <div class="d-flex justify-content-between mt-2">
          <span>${UI.formatCurrency(p.sellPrice, currency)}</span>
          <span class="${low ? 'text-warning fw-bold' : ''}">Stok: ${UI.formatNumber(p.stock)}</span>
        </div>
        <div class="d-flex gap-2 mt-2">
          ${canEdit ? `<button class="btn btn-sm btn-outline-secondary flex-fill btn-edit" data-id="${p.id}"><i class="bi bi-pencil"></i> Edit</button>` : ''}
          ${canManage ? `<button class="btn btn-sm btn-outline-danger btn-delete" data-id="${p.id}"><i class="bi bi-trash"></i></button>` : ''}
        </div>
      </div>`;
    }).join('');

    container.innerHTML = `
      <div class="data-table-wrapper card p-0">
        <table class="pos-table">
          <thead><tr><th>SKU</th><th>Nama</th><th>Kategori</th><th>Harga</th><th>Stok</th><th>Status</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="data-card-list">${cards}</div>
    `;

    UI.qsa('.btn-edit', container).forEach((btn) => btn.addEventListener('click', () => openProductForm(Number(btn.dataset.id))));
    UI.qsa('.btn-delete', container).forEach((btn) => btn.addEventListener('click', () => confirmDeleteProduct(Number(btn.dataset.id))));
  }

  function renderCategoryList() {
    const container = UI.el('categoryListContainer');
    const canEdit = !Auth.isGuest();
    if (allCategories.length === 0) {
      container.innerHTML = `<div class="card p-5 text-center text-muted"><i class="bi bi-tags fs-1 d-block mb-2"></i>Belum ada kategori</div>`;
      return;
    }
    const rows = allCategories.map((c) => `
      <tr>
        <td>${UI.escapeHtml(c.name)}</td>
        <td>${UI.escapeHtml(c.description || '-')}</td>
        <td>${c.status === 'active' ? '<span class="badge text-bg-success">Aktif</span>' : '<span class="badge text-bg-secondary">Nonaktif</span>'}</td>
        <td class="text-end">
          ${canEdit ? `<button class="btn btn-sm btn-outline-secondary btn-edit-cat" data-id="${c.id}"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-sm btn-outline-danger btn-delete-cat" data-id="${c.id}"><i class="bi bi-trash"></i></button>` : ''}
        </td>
      </tr>`).join('');

    container.innerHTML = `
      <div class="data-table-wrapper card p-0">
        <table class="pos-table">
          <thead><tr><th>Nama</th><th>Deskripsi</th><th>Status</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="data-card-list">
        ${allCategories.map((c) => `
          <div class="data-card-item">
            <div class="d-flex justify-content-between"><strong>${UI.escapeHtml(c.name)}</strong>${c.status === 'active' ? '<span class="badge text-bg-success">Aktif</span>' : '<span class="badge text-bg-secondary">Nonaktif</span>'}</div>
            <div class="text-muted small">${UI.escapeHtml(c.description || '-')}</div>
            ${canEdit ? `<div class="d-flex gap-2 mt-2">
              <button class="btn btn-sm btn-outline-secondary flex-fill btn-edit-cat" data-id="${c.id}"><i class="bi bi-pencil"></i> Edit</button>
              <button class="btn btn-sm btn-outline-danger btn-delete-cat" data-id="${c.id}"><i class="bi bi-trash"></i></button>
            </div>` : ''}
          </div>`).join('')}
      </div>
    `;

    UI.qsa('.btn-edit-cat', container).forEach((btn) => btn.addEventListener('click', () => openCategoryForm(Number(btn.dataset.id))));
    UI.qsa('.btn-delete-cat', container).forEach((btn) => btn.addEventListener('click', () => confirmDeleteCategory(Number(btn.dataset.id))));
  }

  function openProductForm(editingId) {
    const product = editingId ? allProducts.find((p) => p.id === editingId) : null;
    const categoryOptions = allCategories.map((c) => `<option value="${c.id}" ${product && String(product.categoryId) === String(c.id) ? 'selected' : ''}>${UI.escapeHtml(c.name)}</option>`).join('');

    const bodyHtml = `
      <form id="productForm">
        <div class="row g-3">
          <div class="col-6">
            <label class="form-label">SKU</label>
            <input type="text" class="form-control" id="pfSku" value="${UI.escapeHtml(product?.sku || '')}" placeholder="Otomatis jika kosong">
          </div>
          <div class="col-6">
            <label class="form-label">Barcode</label>
            <input type="text" class="form-control" id="pfBarcode" value="${UI.escapeHtml(product?.barcode || '')}">
          </div>
          <div class="col-12">
            <label class="form-label">Nama Produk *</label>
            <input type="text" class="form-control" id="pfName" value="${UI.escapeHtml(product?.name || '')}" required>
          </div>
          <div class="col-6">
            <label class="form-label">Kategori</label>
            <select class="form-select" id="pfCategory"><option value="">- Pilih -</option>${categoryOptions}</select>
          </div>
          <div class="col-6">
            <label class="form-label">Satuan</label>
            <input type="text" class="form-control" id="pfUnit" value="${UI.escapeHtml(product?.unit || 'pcs')}">
          </div>
          <div class="col-6">
            <label class="form-label">Harga Modal *</label>
            <input type="number" min="0" class="form-control" id="pfCostPrice" value="${product?.costPrice ?? 0}" required>
          </div>
          <div class="col-6">
            <label class="form-label">Harga Jual *</label>
            <input type="number" min="0" class="form-control" id="pfSellPrice" value="${product?.sellPrice ?? 0}" required>
          </div>
          <div class="col-6">
            <label class="form-label">Stok *</label>
            <input type="number" min="0" class="form-control" id="pfStock" value="${product?.stock ?? 0}" required>
          </div>
          <div class="col-6">
            <label class="form-label">Minimum Stok</label>
            <input type="number" min="0" class="form-control" id="pfMinStock" value="${product?.minStock ?? 0}">
          </div>
          <div class="col-12">
            <label class="form-label">Foto Produk</label>
            <input type="file" accept="image/*" class="form-control" id="pfPhoto">
            ${product?.photo ? `<img src="${product.photo}" class="mt-2" style="width:60px;height:60px;object-fit:cover;border-radius:8px;">` : ''}
          </div>
          <div class="col-12 form-check">
            <input type="checkbox" class="form-check-input" id="pfActive" ${product?.active !== false ? 'checked' : ''}>
            <label class="form-check-label" for="pfActive">Status Aktif</label>
          </div>
        </div>
        <div id="pfErrorBox" class="alert alert-danger py-2 mt-3 d-none"></div>
        <button type="submit" class="btn btn-primary w-100 mt-3">Simpan Produk</button>
      </form>
    `;

    showGenericModal(editingId ? 'Edit Produk' : 'Tambah Produk', bodyHtml);

    let photoData = product?.photo || '';
    UI.el('pfPhoto').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => { photoData = reader.result; };
      reader.readAsDataURL(file);
    });

    UI.el('productForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const errorBox = UI.el('pfErrorBox');
      errorBox.classList.add('d-none');
      try {
        await saveProduct({
          sku: UI.el('pfSku').value,
          barcode: UI.el('pfBarcode').value,
          name: UI.el('pfName').value,
          categoryId: UI.el('pfCategory').value,
          costPrice: UI.el('pfCostPrice').value,
          sellPrice: UI.el('pfSellPrice').value,
          stock: UI.el('pfStock').value,
          minStock: UI.el('pfMinStock').value,
          unit: UI.el('pfUnit').value,
          photo: photoData,
          active: UI.el('pfActive').checked,
          isGuestData: Auth.isGuest()
        }, editingId);
        bootstrap.Modal.getInstance(UI.el('genericModal'))?.hide();
        renderProductList();
        populateCategoryFilterOptions();
        UI.success('Produk berhasil disimpan.');
      } catch (err) {
        errorBox.textContent = err.message;
        errorBox.classList.remove('d-none');
      }
    });
  }

  async function confirmDeleteProduct(id) {
    const confirmed = await UI.confirm({ title: 'Hapus Produk?', text: 'Data produk ini akan dihapus permanen.' });
    if (!confirmed) return;
    try {
      await deleteProduct(id);
      renderProductList();
      UI.success('Produk berhasil dihapus.');
    } catch (err) {
      UI.showError(err.message);
    }
  }

  function openCategoryForm(editingId) {
    const category = editingId ? allCategories.find((c) => c.id === editingId) : null;
    const bodyHtml = `
      <form id="categoryForm">
        <div class="mb-3">
          <label class="form-label">Nama Kategori *</label>
          <input type="text" class="form-control" id="cfName" value="${UI.escapeHtml(category?.name || '')}" required>
        </div>
        <div class="mb-3">
          <label class="form-label">Deskripsi</label>
          <textarea class="form-control" id="cfDescription" rows="2">${UI.escapeHtml(category?.description || '')}</textarea>
        </div>
        <div class="form-check mb-3">
          <input type="checkbox" class="form-check-input" id="cfActive" ${!category || category.status === 'active' ? 'checked' : ''}>
          <label class="form-check-label" for="cfActive">Status Aktif</label>
        </div>
        <div id="cfErrorBox" class="alert alert-danger py-2 d-none"></div>
        <button type="submit" class="btn btn-primary w-100">Simpan Kategori</button>
      </form>
    `;
    showGenericModal(editingId ? 'Edit Kategori' : 'Tambah Kategori', bodyHtml);

    UI.el('categoryForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const errorBox = UI.el('cfErrorBox');
      errorBox.classList.add('d-none');
      try {
        await saveCategory({
          name: UI.el('cfName').value,
          description: UI.el('cfDescription').value,
          status: UI.el('cfActive').checked ? 'active' : 'inactive'
        }, editingId);
        bootstrap.Modal.getInstance(UI.el('genericModal'))?.hide();
        renderCategoryList();
        populateCategoryFilterOptions();
        UI.success('Kategori berhasil disimpan.');
      } catch (err) {
        errorBox.textContent = err.message;
        errorBox.classList.remove('d-none');
      }
    });
  }

  async function confirmDeleteCategory(id) {
    const confirmed = await UI.confirm({ title: 'Hapus Kategori?', text: 'Kategori ini akan dihapus permanen.' });
    if (!confirmed) return;
    try {
      await deleteCategory(id);
      renderCategoryList();
      populateCategoryFilterOptions();
      UI.success('Kategori berhasil dihapus.');
    } catch (err) {
      UI.showError(err.message);
    }
  }

  function openImportModal() {
    const bodyHtml = `
      <p class="text-muted small">Format CSV wajib: <code>SKU,Barcode,Nama,Kategori,HargaModal,HargaJual,Stok,MinimumStok,Satuan</code></p>
      <input type="file" accept=".csv" class="form-control mb-3" id="importFileInput">
      <div id="importPreviewBox"></div>
    `;
    showGenericModal('Import Produk (CSV)', bodyHtml);

    UI.el('importFileInput').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const results = await importProductsFromCSV(text);
        const previewBox = UI.el('importPreviewBox');
        previewBox.innerHTML = `
          <div class="alert alert-info py-2">${results.valid.length} baris valid, ${results.errors.length} baris error.</div>
          ${results.errors.length > 0 ? `<div class="alert alert-warning py-2" style="max-height:150px;overflow-y:auto;">${results.errors.map((e) => `<div>${UI.escapeHtml(e)}</div>`).join('')}</div>` : ''}
          ${results.valid.length > 0 ? `<button class="btn btn-primary w-100" id="confirmImportBtn">Import ${results.valid.length} Produk</button>` : ''}
        `;
        const confirmBtn = UI.el('confirmImportBtn');
        if (confirmBtn) {
          confirmBtn.addEventListener('click', async () => {
            confirmBtn.disabled = true;
            confirmBtn.textContent = 'Mengimpor...';
            try {
              await commitImport(results.valid);
              bootstrap.Modal.getInstance(UI.el('genericModal'))?.hide();
              renderProductList();
              UI.success('Import produk berhasil.');
            } catch (err) {
              UI.showError(err.message);
              confirmBtn.disabled = false;
              confirmBtn.textContent = `Import ${results.valid.length} Produk`;
            }
          });
        }
      } catch (err) {
        UI.showError(err.message);
      }
    });
  }

  function showGenericModal(title, bodyHtml) {
    UI.el('genericModalTitle').textContent = title;
    UI.el('genericModalBody').innerHTML = bodyHtml;
    UI.el('genericModalDialog').className = 'modal-dialog modal-dialog-scrollable';
    const modal = new bootstrap.Modal(UI.el('genericModal'));
    modal.show();
  }

  // ---------- STOCK PAGE ----------

  let stockPageBound = false;

  async function initStockPage() {
    await loadProducts();
    await renderStockMovements();
    if (!stockPageBound) {
      stockPageBound = true;
      UI.el('stockAdjustBtn').addEventListener('click', openStockAdjustForm);
    }
  }

  async function renderStockMovements() {
    const container = UI.el('stockMovementContainer');
    const movements = await DB.getAll(DB.STORES.stock_movements);
    movements.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (movements.length === 0) {
      container.innerHTML = `<div class="card p-5 text-center text-muted"><i class="bi bi-boxes fs-1 d-block mb-2"></i>Belum ada pergerakan stok</div>`;
      return;
    }

    const typeLabels = {
      STOCK_IN: '<span class="badge text-bg-success">Masuk</span>',
      STOCK_OUT: '<span class="badge text-bg-danger">Keluar</span>',
      SALE: '<span class="badge text-bg-primary">Penjualan</span>',
      ADJUSTMENT: '<span class="badge text-bg-warning">Penyesuaian</span>',
      RETURN: '<span class="badge text-bg-info">Retur</span>'
    };

    const rows = movements.slice(0, 200).map((m) => {
      const product = allProducts.find((p) => p.id === m.productId);
      return `<tr>
        <td>${UI.formatDate(m.createdAt, true)}</td>
        <td>${UI.escapeHtml(product ? product.name : 'Produk dihapus')}</td>
        <td>${typeLabels[m.type] || m.type}</td>
        <td>${m.quantity > 0 ? '+' : ''}${UI.formatNumber(m.quantity)}</td>
        <td>${UI.formatNumber(m.stockBefore)} → ${UI.formatNumber(m.stockAfter)}</td>
        <td>${UI.escapeHtml(m.reference || '-')}</td>
      </tr>`;
    }).join('');

    container.innerHTML = `
      <div class="data-table-wrapper card p-0">
        <table class="pos-table">
          <thead><tr><th>Tanggal</th><th>Produk</th><th>Jenis</th><th>Qty</th><th>Stok</th><th>Referensi</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="data-card-list">
        ${movements.slice(0, 200).map((m) => {
          const product = allProducts.find((p) => p.id === m.productId);
          return `<div class="data-card-item">
            <div class="d-flex justify-content-between"><strong>${UI.escapeHtml(product ? product.name : 'Produk dihapus')}</strong>${typeLabels[m.type] || m.type}</div>
            <div class="text-muted small">${UI.formatDate(m.createdAt, true)}</div>
            <div class="d-flex justify-content-between mt-1">
              <span>${m.quantity > 0 ? '+' : ''}${UI.formatNumber(m.quantity)}</span>
              <span>${UI.formatNumber(m.stockBefore)} → ${UI.formatNumber(m.stockAfter)}</span>
            </div>
          </div>`;
        }).join('')}
      </div>
    `;
  }

  function openStockAdjustForm() {
    const productOptions = allProducts.map((p) => `<option value="${p.id}">${UI.escapeHtml(p.name)} (Stok: ${p.stock})</option>`).join('');
    const bodyHtml = `
      <form id="stockAdjustForm">
        <div class="mb-3">
          <label class="form-label">Produk *</label>
          <select class="form-select" id="saProduct" required><option value="">- Pilih Produk -</option>${productOptions}</select>
        </div>
        <div class="mb-3">
          <label class="form-label">Stok Baru *</label>
          <input type="number" min="0" class="form-control" id="saNewStock" required>
        </div>
        <div class="mb-3">
          <label class="form-label">Catatan / Referensi</label>
          <input type="text" class="form-control" id="saReference" placeholder="Contoh: Stok opname">
        </div>
        <div id="saErrorBox" class="alert alert-danger py-2 d-none"></div>
        <button type="submit" class="btn btn-primary w-100">Simpan Penyesuaian</button>
      </form>
    `;
    showGenericModal('Sesuaikan Stok', bodyHtml);

    UI.el('stockAdjustForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const errorBox = UI.el('saErrorBox');
      errorBox.classList.add('d-none');
      try {
        const productId = UI.el('saProduct').value;
        if (!productId) throw new Error('Pilih produk terlebih dahulu.');
        await adjustStock(productId, UI.el('saNewStock').value, UI.el('saReference').value);
        bootstrap.Modal.getInstance(UI.el('genericModal'))?.hide();
        await renderStockMovements();
        UI.success('Stok berhasil disesuaikan.');
      } catch (err) {
        errorBox.textContent = err.message;
        errorBox.classList.remove('d-none');
      }
    });
  }

  return {
    loadCategories, loadProducts, getCategoryName, getCachedProducts, getCachedCategories,
    saveCategory, deleteCategory,
    saveProduct, deleteProduct, adjustStock, reduceStockForSale,
    getFilteredProducts, setFilter, getLowStockProducts,
    exportProductsCSV, importProductsFromCSV, commitImport, downloadFile, toCSV,
    initPage, showGenericModal, initStockPage
  };
})();
