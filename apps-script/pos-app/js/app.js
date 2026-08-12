/**
 * app.js - Bootstrap Aplikasi POS Kasir
 */

(() => {
  let deferredInstallPrompt = null;

  document.addEventListener('DOMContentLoaded', async () => {
    try {
      await bootstrap_();
    } catch (err) {
      console.error('Fatal bootstrap error:', err);
      UI.showError('Aplikasi gagal dimuat. Silakan refresh halaman.', 'Gagal Memuat Aplikasi');
    }
  });

  async function bootstrap_() {
    registerServiceWorker();
    initOfflineIndicator();
    initThemeToggle();
    initInstallPrompt();

    if (!DB.isIndexedDBSupported()) {
      UI.showError('Browser Anda tidak mendukung IndexedDB. Aplikasi tidak dapat berjalan dengan baik.', 'Browser Tidak Didukung');
      return;
    }

    await DB.openDB();
    await Auth.ensureDefaultUsers();
    await ensureDefaultCategories();

    Router.init();
    registerPageHandlers();

    if (Auth.isLoggedIn()) {
      showApp();
      await Router.renderRoute();
    } else {
      showLogin();
    }

    bindLoginEvents();
    bindShellEvents();

    Auth.onSessionTimeout(() => {
      UI.warn('Sesi berakhir karena tidak ada aktivitas. Silakan login kembali.');
      showLogin();
    });
    Auth.registerActivityListeners();
  }

  // ---------- SERVICE WORKER ----------

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then((reg) => {
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if (!newWorker) return;
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'activated') {
                UI.info('Aplikasi telah diperbarui.');
              }
            });
          });
        })
        .catch((err) => console.error('Service worker registration failed:', err));
    });
  }

  // ---------- OFFLINE INDICATOR ----------

  function initOfflineIndicator() {
    updateConnectionStatus();
    window.addEventListener('online', updateConnectionStatus);
    window.addEventListener('offline', updateConnectionStatus);
  }

  function updateConnectionStatus() {
    const isOnline = navigator.onLine;
    const bar = UI.el('offlineStatusBar');
    const badge = UI.el('connectionBadge');

    if (badge) {
      badge.textContent = isOnline ? ' Online' : ' Offline';
      badge.className = `connection-badge ${isOnline ? 'online' : 'offline'}`;
    }

    if (bar) {
      bar.textContent = isOnline
        ? 'Online — Semua data tetap tersimpan secara lokal.'
        : 'Mode Offline — Data tersimpan di perangkat.';
      bar.className = `offline-status-bar show ${isOnline ? 'online' : 'offline'}`;
      clearTimeout(bar._hideTimer);
      bar._hideTimer = setTimeout(() => bar.classList.remove('show'), 3000);
    }
  }

  // ---------- THEME ----------

  function initThemeToggle() {
    const savedTheme = Storage.get('theme', 'system');
    applyTheme(savedTheme);

    const btn = UI.el('themeToggleBtn');
    if (btn) {
      btn.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-bs-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        Storage.set('theme', next);
      });
    }
  }

  function applyTheme(theme) {
    let resolved = theme;
    if (theme === 'system') {
      resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-bs-theme', resolved);
    const btn = UI.el('themeToggleBtn');
    if (btn) {
      const icon = btn.querySelector('i');
      if (icon) icon.className = resolved === 'dark' ? 'bi bi-sun' : 'bi bi-moon-stars';
    }
  }

  // ---------- INSTALL PWA PROMPT ----------

  function initInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredInstallPrompt = e;
      const dismissed = Storage.get('install_prompt_dismissed', false);
      if (!dismissed) {
        UI.el('installBanner').classList.remove('d-none');
      }
    });

    window.addEventListener('appinstalled', () => {
      UI.el('installBanner').classList.add('d-none');
      deferredInstallPrompt = null;
      UI.success('Aplikasi berhasil di-install.');
    });

    const dismissBtn = UI.el('installDismissBtn');
    const installBtn = UI.el('installNowBtn');

    if (dismissBtn) {
      dismissBtn.addEventListener('click', () => {
        UI.el('installBanner').classList.add('d-none');
        Storage.set('install_prompt_dismissed', true);
      });
    }

    if (installBtn) {
      installBtn.addEventListener('click', async () => {
        if (!deferredInstallPrompt) return;
        deferredInstallPrompt.prompt();
        const { outcome } = await deferredInstallPrompt.userChoice;
        if (outcome === 'accepted') {
          UI.el('installBanner').classList.add('d-none');
        } else {
          Storage.set('install_prompt_dismissed', true);
        }
        deferredInstallPrompt = null;
      });
    }
  }

  // ---------- DEFAULT DATA ----------

  async function ensureDefaultCategories() {
    try {
      const categories = await DB.getAll(DB.STORES.categories);
      if (categories.length > 0) return;
      const defaults = ['Makanan', 'Minuman', 'Snack', 'Elektronik', 'Fashion', 'Lainnya'];
      for (const name of defaults) {
        await DB.add(DB.STORES.categories, {
          name, description: '', status: 'active', createdAt: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error('ensureDefaultCategories error:', err);
    }
  }

  async function loadDemoData() {
    try {
      const existingProducts = await DB.getAll(DB.STORES.products);
      if (existingProducts.length > 0) {
        const confirmed = await UI.confirm({
          title: 'Data Sudah Ada',
          text: 'Sudah ada data produk di aplikasi. Tetap tambahkan data demo?',
          confirmButtonText: 'Ya, Tambahkan'
        });
        if (!confirmed) return;
      }

      const categories = await DB.getAll(DB.STORES.categories);
      const catId = (name) => (categories.find((c) => c.name === name) || categories[0] || {}).id || null;

      const demoProducts = [
        { name: 'Nasi Goreng Spesial', category: 'Makanan', cost: 8000, price: 18000, stock: 40 },
        { name: 'Mie Ayam', category: 'Makanan', cost: 6000, price: 15000, stock: 35 },
        { name: 'Ayam Geprek', category: 'Makanan', cost: 9000, price: 20000, stock: 30 },
        { name: 'Es Teh Manis', category: 'Minuman', cost: 2000, price: 5000, stock: 60 },
        { name: 'Kopi Susu', category: 'Minuman', cost: 4000, price: 12000, stock: 50 },
        { name: 'Jus Alpukat', category: 'Minuman', cost: 6000, price: 15000, stock: 25 },
        { name: 'Keripik Singkong', category: 'Snack', cost: 5000, price: 10000, stock: 45 },
        { name: 'Kacang Atom', category: 'Snack', cost: 4000, price: 8000, stock: 3 },
        { name: 'Kabel Charger USB-C', category: 'Elektronik', cost: 15000, price: 30000, stock: 20 },
        { name: 'Earphone Kabel', category: 'Elektronik', cost: 20000, price: 45000, stock: 15 },
        { name: 'Kaos Polos', category: 'Fashion', cost: 25000, price: 55000, stock: 18 },
        { name: 'Topi Baseball', category: 'Fashion', cost: 20000, price: 45000, stock: 2 }
      ];

      const insertedProducts = [];
      for (const p of demoProducts) {
        const id = await DB.add(DB.STORES.products, {
          sku: `SKU-${UI.generateId()}`,
          barcode: '',
          name: p.name,
          categoryId: catId(p.category),
          costPrice: p.cost,
          sellPrice: p.price,
          stock: p.stock,
          minStock: 5,
          unit: 'pcs',
          photo: '',
          active: true,
          isGuestData: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        insertedProducts.push({ id, ...p });
        await DB.add(DB.STORES.stock_movements, {
          productId: id, type: 'STOCK_IN', quantity: p.stock, stockBefore: 0, stockAfter: p.stock,
          reference: 'Data demo', userId: null, createdAt: new Date().toISOString()
        });
      }

      const demoCustomers = ['Budi Santoso', 'Siti Aminah', 'Andi Wijaya', 'Rina Sari', 'Joko Susilo'];
      const insertedCustomers = [];
      for (const name of demoCustomers) {
        const id = await DB.add(DB.STORES.customers, {
          name, phone: `08${Math.floor(100000000 + Math.random() * 899999999)}`, email: '', address: '',
          totalTransactions: 0, totalSpent: 0, isGuestData: false, createdAt: new Date().toISOString()
        });
        insertedCustomers.push(id);
      }

      const users = await DB.getAll(DB.STORES.users);
      const cashier = users.find((u) => u.role === 'CASHIER') || users[0];

      for (let i = 0; i < 8; i += 1) {
        const daysAgo = Math.floor(Math.random() * 6);
        const date = new Date();
        date.setDate(date.getDate() - daysAgo);

        const itemCount = 1 + Math.floor(Math.random() * 3);
        let subtotal = 0;
        const items = [];
        for (let j = 0; j < itemCount; j += 1) {
          const product = insertedProducts[Math.floor(Math.random() * insertedProducts.length)];
          const qty = 1 + Math.floor(Math.random() * 3);
          const lineTotal = product.price * qty;
          subtotal += lineTotal;
          items.push({ productId: product.id, productName: product.name, price: product.price, qty, lineTotal });
        }
        const total = subtotal;
        const trxId = await DB.add(DB.STORES.transactions, {
          transactionNumber: `TRX-DEMO-${Date.now()}${i}`,
          createdAt: date.toISOString(),
          cashierId: cashier ? cashier.id : null,
          cashierName: cashier ? cashier.name : 'Kasir Demo',
          customerId: insertedCustomers[Math.floor(Math.random() * insertedCustomers.length)],
          subtotal, discount: 0, tax: 0, total,
          paymentMethod: ['cash', 'qris', 'transfer'][Math.floor(Math.random() * 3)],
          paidAmount: total, change: 0, status: 'completed', isGuestData: false
        });
        for (const item of items) {
          await DB.add(DB.STORES.transaction_items, { transactionId: trxId, ...item });
        }
      }

      const demoExpenses = [
        { category: 'Listrik', description: 'Tagihan listrik bulan ini', amount: 350000 },
        { category: 'Internet', description: 'Wifi toko', amount: 300000 },
        { category: 'Operasional', description: 'Beli plastik & kemasan', amount: 150000 }
      ];
      for (const exp of demoExpenses) {
        await DB.add(DB.STORES.expenses, {
          date: new Date().toISOString().slice(0, 10),
          category: exp.category, description: exp.description, amount: exp.amount,
          notes: '', userId: cashier ? cashier.id : null, isGuestData: false, createdAt: new Date().toISOString()
        });
      }

      UI.success('Data demo berhasil ditambahkan.');
    } catch (err) {
      console.error('loadDemoData error:', err);
      UI.showError('Gagal memuat data demo.');
    }
  }

  // ---------- LOGIN ----------

  function bindLoginEvents() {
    const form = UI.el('loginForm');
    const guestBtn = UI.el('guestLoginBtn');
    const toggleBtn = UI.el('togglePasswordBtn');
    const demoBtn = UI.el('loadDemoDataBtn');

    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        const input = UI.el('loginPassword');
        const icon = toggleBtn.querySelector('i');
        if (input.type === 'password') {
          input.type = 'text';
          icon.className = 'bi bi-eye-slash';
        } else {
          input.type = 'password';
          icon.className = 'bi bi-eye';
        }
      });
    }

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const errorBox = UI.el('loginError');
        errorBox.classList.add('d-none');
        const submitBtn = UI.el('loginSubmitBtn');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Memproses...';

        try {
          const username = UI.el('loginUsername').value.trim();
          const password = UI.el('loginPassword').value;
          const result = await Auth.login(username, password);
          if (!result.success) {
            errorBox.textContent = result.message;
            errorBox.classList.remove('d-none');
          } else {
            showApp();
            await Router.renderRoute();
          }
        } catch (err) {
          console.error('Login submit error:', err);
          errorBox.textContent = 'Terjadi kesalahan sistem. Silakan coba lagi.';
          errorBox.classList.remove('d-none');
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = 'MASUK';
        }
      });
    }

    if (guestBtn) {
      guestBtn.addEventListener('click', async () => {
        Auth.loginAsGuest();
        showApp();
        await Router.renderRoute();
        UI.info('Anda masuk sebagai Guest. Data yang dibuat bersifat sementara.');
      });
    }

    if (demoBtn) {
      demoBtn.addEventListener('click', loadDemoData);
    }
  }

  // ---------- APP SHELL ----------

  function showApp() {
    UI.el('loginScreen').classList.add('d-none');
    UI.el('appShell').classList.remove('d-none');
    updateUserInfo();
    applyRoleVisibility();
  }

  function showLogin() {
    UI.el('appShell').classList.add('d-none');
    UI.el('loginScreen').classList.remove('d-none');
    UI.el('loginForm').reset();
  }

  function updateUserInfo() {
    const session = Auth.getSession();
    if (!session) return;
    UI.el('topbarUserName').textContent = session.name;
    UI.el('topbarUserRole').textContent = session.role;
  }

  function applyRoleVisibility() {
    const session = Auth.getSession();
    if (!session) return;
    const isAdmin = session.role === 'ADMIN';

    UI.qsa('.nav-link-item[data-page="settings"]').forEach((el) => {
      el.style.display = isAdmin ? '' : 'none';
    });
  }

  function bindShellEvents() {
    const infoBtn = UI.el('appInfoBtn');
    if (infoBtn) {
      infoBtn.addEventListener('click', () => {
        const modal = new bootstrap.Modal(UI.el('aboutModal'));
        modal.show();
      });
    }

    UI.el('mobileMenuBtn').addEventListener('click', () => {
      UI.el('appSidebar').classList.add('show');
      UI.el('sidebarOverlay').classList.add('show');
    });

    UI.el('sidebarOverlay').addEventListener('click', () => {
      UI.el('appSidebar').classList.remove('show');
      UI.el('sidebarOverlay').classList.remove('show');
    });

    UI.el('sidebarLogoutBtn').addEventListener('click', handleLogout);
    UI.el('moreMenuLogoutBtn').addEventListener('click', () => {
      const offcanvasEl = UI.el('moreMenuOffcanvas');
      const instance = bootstrap.Offcanvas.getInstance(offcanvasEl);
      if (instance) instance.hide();
      handleLogout();
    });

    UI.el('bottomNavMore').addEventListener('click', (e) => {
      e.preventDefault();
      const offcanvas = new bootstrap.Offcanvas(UI.el('moreMenuOffcanvas'));
      offcanvas.show();
    });

    document.querySelectorAll('#moreMenuOffcanvas a[href^="#/"]').forEach((link) => {
      link.addEventListener('click', () => {
        const instance = bootstrap.Offcanvas.getInstance(UI.el('moreMenuOffcanvas'));
        if (instance) instance.hide();
      });
    });

    UI.qsa('.pos-cart-panel .pos-cart-header').forEach(() => {});
    document.addEventListener('click', (e) => {
      // Tutup cart mobile jika klik di luar panel saat panel terbuka
      const cartPanel = UI.el('posCartPanel');
      const floatingBtn = UI.el('posFloatingCartBtn');
      if (!cartPanel || !cartPanel.classList.contains('show')) return;
      if (cartPanel.contains(e.target) || (floatingBtn && floatingBtn.contains(e.target))) return;
    });
  }

  async function handleLogout() {
    const confirmed = await UI.confirm({ title: 'Logout?', text: 'Anda akan keluar dari aplikasi.', icon: 'question', confirmButtonColor: '#4f46e5' });
    if (!confirmed) return;
    Auth.logout();
    showLogin();
    window.location.hash = '#/dashboard';
  }

  // ---------- PAGE HANDLERS REGISTRATION ----------

  function registerPageHandlers() {
    Router.onEnter('dashboard', () => Reports.initDashboard());
    Router.onEnter('pos', (params) => POS.init(params));
    Router.onEnter('transactions', () => Transactions.initTransactionsPage());
    Router.onEnter('products', (params) => Products.initPage(params));
    Router.onEnter('stock', () => Products.initStockPage());
    Router.onEnter('customers', () => Transactions.initCustomersPage());
    Router.onEnter('expenses', (params) => Transactions.initExpensesPage(params));
    Router.onEnter('reports', () => Reports.initReportsPage());
    Router.onEnter('settings', () => Settings.initSettingsPage());
  }
})();
