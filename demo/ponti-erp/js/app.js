/**
 * App bootstrap: authentication (DEMO MODE — local check only; replace
 * with a real backend/auth service in production), navigation router,
 * sidebar/bottom-nav rendering, PWA install handling, offline indicator.
 */
const App = (() => {
  const SESSION_KEY = 'ponti_erp_session';
  let currentUser = null;
  let currentView = 'dashboard';
  let deferredInstallPrompt = null;

  const VIEW_TITLES = {
    dashboard: 'Dashboard', companyProfile: 'Company Profile', inventoryOverview: 'Inventory Overview',
    financeOverview: 'Finance Overview', receivables: 'Receivables', payables: 'Payables',
    hrOverview: 'HR Overview', payrollSummary: 'Payroll Summary', crm: 'CRM', reports: 'Reports',
    settingsProfile: 'Profile', rolePermission: 'Role & Permission', settingsAppearance: 'Appearance',
    settingsNotifications: 'Notification Settings', settingsData: 'Data Management', panduan: 'Panduan Penggunaan',
  };

  function getCurrentUser() { return currentUser; }

  /* ---------------- INIT ---------------- */
  async function init() {
    await DataService.seedIfNeeded(false);
    setupConnectivity();
    setupInstallPrompt();
    registerServiceWorker();

    const saved = localStorage.getItem(SESSION_KEY);
    setTimeout(async () => {
      document.getElementById('splashScreen').remove();
      if (saved) {
        currentUser = JSON.parse(saved);
        await showApp();
      } else {
        document.getElementById('loginScreen').classList.remove('d-none');
      }
    }, 900);

    setupLoginForm();
  }

  /* ---------------- LOGIN (DEMO MODE) ---------------- */
  function setupLoginForm() {
    const form = document.getElementById('loginForm');
    const showPwCheck = document.getElementById('showPasswordCheck');
    const pwInput = document.getElementById('loginPassword');
    const toggleBtn = document.getElementById('togglePasswordBtn');

    function togglePw() {
      const show = pwInput.type === 'password';
      pwInput.type = show ? 'text' : 'password';
      showPwCheck.checked = show;
      toggleBtn.innerHTML = `<i class="bi bi-eye${show ? '-slash' : ''}"></i>`;
    }
    showPwCheck.onchange = togglePw;
    toggleBtn.onclick = togglePw;

    document.getElementById('demoLoginBtn').onclick = () => {
      document.getElementById('loginUsername').value = 'demo';
      document.getElementById('loginPassword').value = 'demo123';
      attemptLogin('demo', 'demo123');
    };

    form.onsubmit = (e) => {
      e.preventDefault();
      const username = document.getElementById('loginUsername').value.trim();
      const password = document.getElementById('loginPassword').value;
      if (!username || !password) { form.classList.add('was-validated'); return; }
      attemptLogin(username, password);
    };
  }

  /**
   * DEMO MODE AUTHENTICATION NOTICE:
   * This check runs entirely in the browser against locally seeded data.
   * It exists ONLY to demonstrate the login flow for this portfolio demo.
   * In a production deployment this function must be replaced by a call
   * to a real backend / authentication service (e.g. OAuth, JWT session
   * issued by a server) — never ship local/plaintext credential checks
   * to production.
   */
  async function attemptLogin(username, password) {
    const users = await DataService.list('users');
    const match = users.find((u) => u.username === username);
    const validDemoPassword = username === 'demo' && password === 'demo123';
    const validRolePassword = match && password === `${username}123`; // demo-only convenience for role simulation
    if (match && (validDemoPassword || validRolePassword)) {
      currentUser = match;
      localStorage.setItem(SESSION_KEY, JSON.stringify(currentUser));
      Swal.fire({ icon: 'success', title: 'Login berhasil', text: `Selamat datang, ${match.name}`, timer: 1400, showConfirmButton: false })
        .then(() => showApp());
    } else {
      Swal.fire({ icon: 'error', title: 'Login gagal', text: 'Username atau password salah.' });
    }
  }

  function logout() {
    Swal.fire({
      icon: 'question', title: 'Keluar dari aplikasi?', showCancelButton: true,
      confirmButtonText: 'Ya, Logout', cancelButtonText: 'Batal', confirmButtonColor: '#C0392B', reverseButtons: true,
    }).then((r) => {
      if (!r.isConfirmed) return;
      localStorage.removeItem(SESSION_KEY);
      currentUser = null;
      document.getElementById('appShell').classList.add('d-none');
      document.getElementById('loginScreen').classList.remove('d-none');
      document.getElementById('loginForm').reset();
      Swal.fire({ icon: 'success', title: 'Berhasil logout', timer: 1200, showConfirmButton: false });
    });
  }

  /* ---------------- APP SHELL ---------------- */
  async function showApp() {
    document.getElementById('loginScreen').classList.add('d-none');
    document.getElementById('appShell').classList.remove('d-none');
    document.getElementById('userAvatar').textContent = currentUser.name[0].toUpperCase();
    document.getElementById('userNameLabel').textContent = currentUser.name;
    document.getElementById('userRoleLabel').textContent = `Role: ${currentUser.role}`;

    if (!document.querySelector('.demo-mode-badge')) {
      const badge = document.createElement('div');
      badge.className = 'demo-mode-badge';
      badge.innerHTML = '<i class="bi bi-lightning-charge-fill"></i> DEMO MODE';
      document.body.appendChild(badge);
    }

    renderSidebar();
    renderBottomNav();
    document.getElementById('logoutBtn').onclick = logout;
    document.querySelectorAll('[data-nav]').forEach((el) => { el.onclick = () => navigateTo(el.getAttribute('data-nav')); });

    document.getElementById('hamburgerBtn').onclick = openDrawer;
    document.getElementById('drawerOverlay').onclick = closeDrawer;

    document.addEventListener('data-changed', (e) => {
      // Refresh current view if the changed entity is what's showing
      if (currentView === `entity:${e.detail.entityKey}`) navigateTo(currentView, true);
    });

    navigateTo('dashboard');
  }

  function allowedMenus() {
    const access = ROLE_ACCESS[currentUser.role];
    return access.menus === 'all' ? null : access.menus;
  }

  function renderSidebar() {
    const allowed = allowedMenus();
    const nav = document.getElementById('sidebarNav');
    nav.innerHTML = MENU.filter((m) => !allowed || allowed.includes(m.key) || m.key === 'panduan' || m.key === 'dashboard').map((m) => {
      if (m.children) {
        return `
          <div class="nav-group" data-group="${m.key}">
            <button class="nav-group-toggle"><i class="bi ${m.icon} menu-icon"></i><span>${m.label}</span><i class="bi bi-chevron-down chev"></i></button>
            <ul class="nav-children">
              ${m.children.map((c) => `<li><a href="javascript:void(0)" data-view="${c.view}">${c.label}</a></li>`).join('')}
            </ul>
          </div>`;
      }
      return `<a href="javascript:void(0)" class="nav-item-link" data-view="${m.view}"><i class="bi ${m.icon}"></i><span>${m.label}</span></a>`;
    }).join('');

    nav.querySelectorAll('.nav-group-toggle').forEach((btn) => {
      btn.onclick = () => btn.closest('.nav-group').classList.toggle('open');
    });
    nav.querySelectorAll('[data-view]').forEach((el) => {
      el.onclick = () => { navigateTo(el.getAttribute('data-view')); closeDrawer(); };
    });
  }

  function renderBottomNav() {
    const nav = document.getElementById('bottomNav');
    nav.innerHTML = BOTTOM_NAV.map((b) => `
      <button class="bottom-nav-item" data-view="${b.view}"><i class="bi ${b.icon}"></i><span>${b.label}</span></button>
    `).join('');
    nav.querySelectorAll('[data-view]').forEach((btn) => {
      btn.onclick = () => {
        const view = btn.getAttribute('data-view');
        if (view === 'menu') openMoreMenu(); else navigateTo(view);
      };
    });
  }

  function openMoreMenu() {
    const body = document.getElementById('moreMenuBody');
    body.innerHTML = `<ul class="settings-menu-list">${MENU.map((m) => {
      if (m.children) {
        return m.children.map((c) => `<li><a href="javascript:void(0)" data-view="${c.view}"><i class="bi bi-dot"></i>${m.label} · ${c.label}<i class="bi bi-chevron-right chev-r"></i></a></li>`).join('');
      }
      return `<li><a href="javascript:void(0)" data-view="${m.view}"><i class="bi ${m.icon}"></i>${m.label}<i class="bi bi-chevron-right chev-r"></i></a></li>`;
    }).join('')}</ul>`;
    const sheet = bootstrap.Offcanvas.getOrCreateInstance(document.getElementById('moreMenuSheet'));
    sheet.show();
    body.querySelectorAll('[data-view]').forEach((el) => {
      el.onclick = () => { navigateTo(el.getAttribute('data-view')); sheet.hide(); };
    });
  }

  function openDrawer() { document.getElementById('sidebar').classList.add('open'); document.getElementById('drawerOverlay').classList.add('show'); }
  function closeDrawer() { document.getElementById('sidebar').classList.remove('open'); document.getElementById('drawerOverlay').classList.remove('show'); }

  /* ---------------- ROUTER ---------------- */
  async function navigateTo(view, silent) {
    currentView = view;
    if (!silent) window.scrollTo({ top: 0, behavior: 'instant' });
    const content = document.getElementById('content');

    // active states
    document.querySelectorAll('.nav-item-link, .nav-children a').forEach((el) => el.classList.toggle('active', el.getAttribute('data-view') === view));
    document.querySelectorAll('.bottom-nav-item').forEach((el) => el.classList.toggle('active', el.getAttribute('data-view') === view));
    const activeChild = document.querySelector(`.nav-children a[data-view="${view}"]`);
    if (activeChild) activeChild.closest('.nav-group').classList.add('open');

    let title = VIEW_TITLES[view] || 'Dashboard';

    if (view.startsWith('entity:')) {
      const key = view.split(':')[1];
      title = ENTITIES[key]?.title || title;
      document.getElementById('topbarTitle').textContent = title;
      content.innerHTML = `<div class="skeleton" style="height:300px"></div>`;
      await CRUD.renderList(content, key);
      return;
    }
    if (view.startsWith('reports:')) {
      title = 'Reports';
      document.getElementById('topbarTitle').textContent = title;
      await Views.reports(content, view.split(':')[1]);
      return;
    }

    document.getElementById('topbarTitle').textContent = title;
    content.innerHTML = `<div class="skeleton" style="height:300px"></div>`;

    const map = {
      dashboard: Views.dashboard, companyProfile: Views.companyProfile, inventoryOverview: Views.inventoryOverview,
      financeOverview: Views.financeOverview, receivables: Views.receivables, payables: Views.payables,
      hrOverview: Views.hrOverview, payrollSummary: Views.payrollSummary, crm: Views.crm, reports: Views.reports,
      settingsProfile: Views.settingsProfile, rolePermission: Views.rolePermission, settingsAppearance: Views.settingsAppearance,
      settingsNotifications: Views.settingsNotifications, settingsData: Views.settingsData, panduan: Views.panduan,
    };
    const fn = map[view] || Views.dashboard;
    await fn(content);
  }

  /* ---------------- CONNECTIVITY ---------------- */
  function setupConnectivity() {
    function update() {
      const indicator = document.getElementById('connIndicator');
      const label = document.getElementById('connLabel');
      if (!indicator) return;
      if (navigator.onLine) { indicator.classList.remove('offline'); label.textContent = 'Online'; }
      else { indicator.classList.add('offline'); label.textContent = 'Offline Mode'; }
    }
    window.addEventListener('online', update);
    window.addEventListener('offline', () => {
      update();
      Swal.fire({ icon: 'info', title: 'Offline Mode', text: 'Koneksi internet terputus. Data demo tetap dapat digunakan.', timer: 2200, showConfirmButton: false, toast: true, position: 'top-end' });
    });
    document.addEventListener('DOMContentLoaded', update);
    setTimeout(update, 950);
  }

  /* ---------------- PWA INSTALL ---------------- */
  function setupInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredInstallPrompt = e;
      const btn = document.getElementById('installBtn');
      btn.classList.remove('d-none');
      btn.classList.add('d-flex');
      btn.onclick = async () => {
        btn.classList.add('d-none');
        deferredInstallPrompt.prompt();
        await deferredInstallPrompt.userChoice;
        deferredInstallPrompt = null;
      };
    });
    window.addEventListener('appinstalled', () => {
      document.getElementById('installBtn').classList.add('d-none');
      toastSuccess('Ponti-ERP berhasil diinstall');
    });
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js').catch(() => {
          // Fail silently in demo mode if SW registration is blocked (e.g. file:// protocol)
        });
      });
    }
  }

  return { init, navigateTo, getCurrentUser };
})();

document.addEventListener('DOMContentLoaded', App.init);
