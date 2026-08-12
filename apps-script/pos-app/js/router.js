/**
 * router.js - Router SPA berbasis hash (#/page)
 */

const Router = (() => {
  const PAGE_TITLES = {
    dashboard: 'Dashboard',
    pos: 'Kasir / POS',
    transactions: 'Riwayat Transaksi',
    products: 'Produk',
    stock: 'Manajemen Stok',
    customers: 'Pelanggan',
    expenses: 'Pengeluaran',
    reports: 'Laporan',
    settings: 'Pengaturan'
  };

  // Halaman yang diizinkan untuk role tertentu. Jika tidak ada di list, berarti semua role bisa akses.
  const ROLE_RESTRICTED_PAGES = {
    settings: ['ADMIN'],
    stock: ['ADMIN', 'CASHIER']
  };

  const onPageChangeCallbacks = {};
  let currentPage = null;

  function onEnter(page, callback) {
    if (!onPageChangeCallbacks[page]) onPageChangeCallbacks[page] = [];
    onPageChangeCallbacks[page].push(callback);
  }

  function getCurrentRoute() {
    const hash = window.location.hash || '#/dashboard';
    const [pathPart, queryPart] = hash.replace('#/', '').split('?');
    const page = pathPart || 'dashboard';
    const params = new URLSearchParams(queryPart || '');
    return { page, params };
  }

  function canAccess(page) {
    const session = Auth.getSession();
    if (!session) return false;
    const allowedRoles = ROLE_RESTRICTED_PAGES[page];
    if (!allowedRoles) return true;
    return allowedRoles.includes(session.role);
  }

  function navigateTo(hash) {
    window.location.hash = hash;
  }

  async function renderRoute() {
    const { page, params } = getCurrentRoute();
    const validPage = PAGE_TITLES[page] ? page : 'dashboard';

    if (!canAccess(validPage)) {
      UI.warn('Anda tidak memiliki akses ke halaman ini.');
      navigateTo('#/dashboard');
      return;
    }

    UI.qsa('.app-page').forEach((sec) => sec.classList.remove('active'));
    const target = UI.el(`page-${validPage}`);
    if (target) target.classList.add('active');

    UI.qsa('.nav-link-item, .bottom-nav-item').forEach((link) => {
      link.classList.toggle('active', link.dataset.page === validPage);
    });

    const titleEl = UI.el('topbarTitle');
    if (titleEl) titleEl.textContent = PAGE_TITLES[validPage] || 'POS Kasir';
    document.title = `${PAGE_TITLES[validPage] || ''} - POS Kasir`;

    currentPage = validPage;

    closeMobileSidebar();
    closeMobileCart();

    const callbacks = onPageChangeCallbacks[validPage] || [];
    for (const cb of callbacks) {
      try {
        await cb(params);
      } catch (err) {
        console.error(`Error saat memuat halaman ${validPage}:`, err);
        UI.showError('Gagal memuat halaman. Silakan coba lagi.');
      }
    }
  }

  function closeMobileSidebar() {
    const sidebar = UI.el('appSidebar');
    const overlay = UI.el('sidebarOverlay');
    if (sidebar) sidebar.classList.remove('show');
    if (overlay) overlay.classList.remove('show');
  }

  function closeMobileCart() {
    const cartPanel = UI.el('posCartPanel');
    if (cartPanel) cartPanel.classList.remove('show');
  }

  function getCurrentPage() {
    return currentPage;
  }

  function init() {
    window.addEventListener('hashchange', renderRoute);

    UI.qsa('[data-nav]').forEach((elm) => {
      elm.addEventListener('click', () => {
        navigateTo(elm.dataset.nav);
      });
    });
  }

  return { init, onEnter, renderRoute, navigateTo, getCurrentRoute, getCurrentPage, closeMobileCart };
})();
