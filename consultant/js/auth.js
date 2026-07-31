/** auth.js — halaman login & sesi */
const AuthPage = {
  render() {
    const root = document.getElementById('app');
    root.innerHTML = '';
    root.appendChild(U.el(
      '<div class="login-wrap"><form class="card login-card" id="loginForm">' +
      '  <div class="brand"><img src="icons/icon.svg" alt=""><b>AI Consultant<small>Assistant</small></b></div>' +
      '  <p class="muted small" style="text-align:center">Copilot analisis kebutuhan client<br>untuk konsultan aplikasi Google Sheets</p>' +
      '  <div class="field"><label for="lu">Username</label>' +
      '    <input class="input" id="lu" autocomplete="username" required></div>' +
      '  <div class="field"><label for="lp">Password</label>' +
      '    <input class="input" id="lp" type="password" autocomplete="current-password" required></div>' +
      '  <button class="btn primary" style="width:100%;justify-content:center" type="submit">Masuk</button>' +
      '</form></div>'));
    root.querySelector('#loginForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      UI.loading('Memeriksa akun…');
      try {
        const res = await Api.post('login', {
          username: root.querySelector('#lu').value.trim(),
          password: root.querySelector('#lp').value
        });
        localStorage.setItem('aca_token', res.token);
        localStorage.setItem('aca_user', JSON.stringify(res.user));
        App.user = res.user;
        UI.closeLoading();
        UI.renderShell();
        location.hash = '#/dashboard';
        UI.route();
      } catch (err) { UI.closeLoading(); UI.error(err); }
    });
  },

  restore() {
    const t = localStorage.getItem('aca_token');
    const u = localStorage.getItem('aca_user');
    if (t && u) { try { App.user = JSON.parse(u); } catch (e) { App.user = null; } }
  },

  async logout() {
    try { await Api.post('logout', {}); } catch (e) { /* abaikan */ }
    this.forceLogout();
  },

  forceLogout() {
    localStorage.removeItem('aca_token');
    localStorage.removeItem('aca_user');
    App.user = null; App.current = null; App.projects = [];
    AuthPage.render();
  }
};
