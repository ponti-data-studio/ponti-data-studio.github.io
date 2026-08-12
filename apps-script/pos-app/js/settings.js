/**
 * settings.js - Pengaturan Toko, Manajemen User, Backup/Restore
 */

const Settings = (() => {
  const SETTINGS_KEY = 'store_settings';
  let cachedSettings = null;
  let settingsEventsBound = false;

  const DEFAULT_SETTINGS = {
    key: SETTINGS_KEY,
    storeName: 'Toko Saya',
    storePhone: '',
    storeEmail: '',
    storeAddress: '',
    currency: 'Rp',
    taxRate: 0,
    trxFormat: 'TRX-{YYYYMMDD}-{0000}',
    storeLogo: '',
    receiptFooter: 'TERIMA KASIH'
  };

  async function getStoreSettings() {
    if (cachedSettings) return cachedSettings;
    try {
      const stored = await DB.get(DB.STORES.settings, SETTINGS_KEY);
      cachedSettings = stored || { ...DEFAULT_SETTINGS };
      return cachedSettings;
    } catch (err) {
      console.error('getStoreSettings error:', err);
      return { ...DEFAULT_SETTINGS };
    }
  }

  async function saveStoreSettings(data) {
    const payload = { key: SETTINGS_KEY, ...DEFAULT_SETTINGS, ...cachedSettings, ...data };
    await DB.put(DB.STORES.settings, payload);
    cachedSettings = payload;
    return payload;
  }

  // ---------- STORE SETTINGS PAGE ----------

  async function initSettingsPage() {
    const settings = await getStoreSettings();
    UI.el('settingStoreName').value = settings.storeName || '';
    UI.el('settingStorePhone').value = settings.storePhone || '';
    UI.el('settingStoreEmail').value = settings.storeEmail || '';
    UI.el('settingCurrency').value = settings.currency || 'Rp';
    UI.el('settingStoreAddress').value = settings.storeAddress || '';
    UI.el('settingTaxRate').value = settings.taxRate || 0;
    UI.el('settingTrxFormat').value = settings.trxFormat || 'TRX-{YYYYMMDD}-{0000}';
    UI.el('settingReceiptFooter').value = settings.receiptFooter || 'TERIMA KASIH';

    const isAdmin = Auth.hasRole('ADMIN');
    UI.qsa('#settingsTab .nav-link[data-settings-tab="users"]').forEach((el) => {
      el.parentElement.style.display = isAdmin ? '' : 'none';
    });

    if (isAdmin) {
      await renderUserList();
    }

    if (!settingsEventsBound) {
      settingsEventsBound = true;
      bindSettingsEvents();
    }
  }

  let logoData = null;

  function bindSettingsEvents() {
    UI.qsa('#settingsTab .nav-link').forEach((tab) => {
      tab.addEventListener('click', () => {
        UI.qsa('#settingsTab .nav-link').forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        const target = tab.dataset.settingsTab;
        UI.el('settingsTabStore').classList.toggle('d-none', target !== 'store');
        UI.el('settingsTabUsers').classList.toggle('d-none', target !== 'users');
        UI.el('settingsTabBackup').classList.toggle('d-none', target !== 'backup');
      });
    });

    UI.el('settingStoreLogo').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => { logoData = reader.result; };
      reader.readAsDataURL(file);
    });

    UI.el('storeSettingsForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const data = {
          storeName: UI.el('settingStoreName').value.trim() || 'Toko Saya',
          storePhone: UI.el('settingStorePhone').value.trim(),
          storeEmail: UI.el('settingStoreEmail').value.trim(),
          currency: UI.el('settingCurrency').value.trim() || 'Rp',
          storeAddress: UI.el('settingStoreAddress').value.trim(),
          taxRate: UI.safeNumber(UI.el('settingTaxRate').value),
          trxFormat: UI.el('settingTrxFormat').value.trim() || 'TRX-{YYYYMMDD}-{0000}',
          receiptFooter: UI.el('settingReceiptFooter').value.trim() || 'TERIMA KASIH'
        };
        if (logoData) data.storeLogo = logoData;
        await saveStoreSettings(data);
        UI.success('Pengaturan toko berhasil disimpan.');
      } catch (err) {
        console.error('save settings error:', err);
        UI.showError('Gagal menyimpan pengaturan.');
      }
    });

    UI.el('userAddBtn').addEventListener('click', () => openUserForm());
    UI.el('backupBtn').addEventListener('click', performBackup);
    UI.el('restoreBtn').addEventListener('click', performRestore);
  }

  // ---------- USER MANAGEMENT ----------

  async function renderUserList() {
    const container = UI.el('userListContainer');
    const users = await DB.getAll(DB.STORES.users);
    const currentUserId = Auth.getSession()?.id;

    const rows = users.map((u) => `
      <tr>
        <td>${UI.escapeHtml(u.username)}</td>
        <td>${UI.escapeHtml(u.name)}</td>
        <td><span class="badge badge-role text-bg-${u.role === 'ADMIN' ? 'primary' : 'secondary'}">${u.role}</span></td>
        <td>${u.active ? '<span class="badge text-bg-success">Aktif</span>' : '<span class="badge text-bg-secondary">Nonaktif</span>'}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-secondary btn-edit-user" data-id="${u.id}"><i class="bi bi-pencil"></i></button>
          ${String(u.id) !== String(currentUserId) ? `<button class="btn btn-sm btn-outline-danger btn-delete-user" data-id="${u.id}"><i class="bi bi-trash"></i></button>` : ''}
        </td>
      </tr>`).join('');

    container.innerHTML = `
      <div class="data-table-wrapper card p-0">
        <table class="pos-table">
          <thead><tr><th>Username</th><th>Nama</th><th>Role</th><th>Status</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="data-card-list">
        ${users.map((u) => `
          <div class="data-card-item">
            <div class="d-flex justify-content-between"><strong>${UI.escapeHtml(u.username)}</strong><span class="badge badge-role text-bg-${u.role === 'ADMIN' ? 'primary' : 'secondary'}">${u.role}</span></div>
            <div class="text-muted small">${UI.escapeHtml(u.name)}</div>
            <div class="d-flex gap-2 mt-2">
              <button class="btn btn-sm btn-outline-secondary flex-fill btn-edit-user" data-id="${u.id}"><i class="bi bi-pencil"></i> Edit</button>
              ${String(u.id) !== String(currentUserId) ? `<button class="btn btn-sm btn-outline-danger btn-delete-user" data-id="${u.id}"><i class="bi bi-trash"></i></button>` : ''}
            </div>
          </div>`).join('')}
      </div>
    `;

    UI.qsa('.btn-edit-user', container).forEach((btn) => btn.addEventListener('click', () => openUserForm(Number(btn.dataset.id))));
    UI.qsa('.btn-delete-user', container).forEach((btn) => btn.addEventListener('click', () => confirmDeleteUser(Number(btn.dataset.id))));
  }

  function openUserForm(editingId) {
    DB.get(DB.STORES.users, editingId).then((user) => {
      const bodyHtml = `
        <form id="userForm">
          <div class="mb-3">
            <label class="form-label">Username *</label>
            <input type="text" class="form-control" id="ufUsername" value="${UI.escapeHtml(user?.username || '')}" ${editingId ? 'readonly' : ''} required>
          </div>
          <div class="mb-3">
            <label class="form-label">Nama Lengkap *</label>
            <input type="text" class="form-control" id="ufName" value="${UI.escapeHtml(user?.name || '')}" required>
          </div>
          <div class="mb-3">
            <label class="form-label">Role *</label>
            <select class="form-select" id="ufRole" required>
              <option value="ADMIN" ${user?.role === 'ADMIN' ? 'selected' : ''}>ADMIN</option>
              <option value="CASHIER" ${!user || user?.role === 'CASHIER' ? 'selected' : ''}>CASHIER</option>
            </select>
          </div>
          <div class="mb-3">
            <label class="form-label">Password ${editingId ? '(kosongkan jika tidak diubah)' : '*'}</label>
            <input type="password" class="form-control" id="ufPassword" ${editingId ? '' : 'required'}>
          </div>
          <div class="form-check mb-3">
            <input type="checkbox" class="form-check-input" id="ufActive" ${!user || user.active ? 'checked' : ''}>
            <label class="form-check-label" for="ufActive">Status Aktif</label>
          </div>
          <div id="ufErrorBox" class="alert alert-danger py-2 d-none"></div>
          <button type="submit" class="btn btn-primary w-100">Simpan User</button>
        </form>
      `;
      Products.showGenericModal(editingId ? 'Edit User' : 'Tambah User', bodyHtml);

      UI.el('userForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const errorBox = UI.el('ufErrorBox');
        errorBox.classList.add('d-none');
        try {
          const username = UI.el('ufUsername').value.trim();
          const name = UI.el('ufName').value.trim();
          const role = UI.el('ufRole').value;
          const password = UI.el('ufPassword').value;

          if (!username || !name) throw new Error('Username dan nama wajib diisi.');

          if (!editingId) {
            const existing = await DB.getAllByIndex(DB.STORES.users, 'username', username);
            if (existing.length > 0) throw new Error('Username sudah digunakan.');
            if (!password) throw new Error('Password wajib diisi untuk user baru.');
          }

          const payload = { username, name, role, active: UI.el('ufActive').checked };

          if (editingId) {
            payload.id = editingId;
            payload.passwordHash = user.passwordHash;
            payload.passwordSalt = user.passwordSalt;
            payload.createdAt = user.createdAt;
            if (password) {
              const hashed = await Auth.hashPassword(password);
              payload.passwordHash = hashed.hash;
              payload.passwordSalt = hashed.salt;
            }
            await DB.put(DB.STORES.users, payload);
          } else {
            const hashed = await Auth.hashPassword(password);
            payload.passwordHash = hashed.hash;
            payload.passwordSalt = hashed.salt;
            payload.createdAt = new Date().toISOString();
            await DB.add(DB.STORES.users, payload);
          }

          bootstrap.Modal.getInstance(UI.el('genericModal'))?.hide();
          await renderUserList();
          UI.success('User berhasil disimpan.');
        } catch (err) {
          errorBox.textContent = err.message;
          errorBox.classList.remove('d-none');
        }
      });
    });
  }

  async function confirmDeleteUser(id) {
    const confirmed = await UI.confirm({ title: 'Hapus User?', text: 'User ini tidak akan bisa login kembali.' });
    if (!confirmed) return;
    try {
      await DB.remove(DB.STORES.users, id);
      await renderUserList();
      UI.success('User berhasil dihapus.');
    } catch (err) {
      UI.showError('Gagal menghapus user.');
    }
  }

  // ---------- BACKUP / RESTORE ----------

  async function performBackup() {
    try {
      const data = await DB.exportAll();
      const json = JSON.stringify(data, null, 2);
      Products.downloadFile(json, `backup_pos_${Date.now()}.json`, 'application/json');
      UI.success('Backup berhasil diunduh.');
    } catch (err) {
      console.error('performBackup error:', err);
      UI.showError('Gagal membuat backup.');
    }
  }

  async function performRestore() {
    const fileInput = UI.el('restoreFileInput');
    const file = fileInput.files[0];
    if (!file) {
      UI.warn('Pilih file backup terlebih dahulu.');
      return;
    }

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data || typeof data !== 'object' || !data.__meta) {
        throw new Error('File backup tidak valid atau bukan hasil export dari aplikasi ini.');
      }

      const confirmed = await UI.confirm({
        title: 'Restore Database?',
        text: 'Seluruh data saat ini akan digantikan dengan data dari file backup. Tindakan ini tidak dapat dibatalkan.',
        confirmButtonText: 'Ya, Restore'
      });
      if (!confirmed) return;

      await DB.importAll(data);
      cachedSettings = null;
      UI.success('Restore berhasil. Aplikasi akan dimuat ulang.');
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      console.error('performRestore error:', err);
      UI.showError(err.message || 'Gagal melakukan restore.');
    }
  }

  return {
    getStoreSettings,
    saveStoreSettings,
    initSettingsPage
  };
})();
