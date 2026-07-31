/** app.js — bootstrap aplikasi + registrasi service worker */
(function () {
  UI.theme();               // terapkan tema tersimpan
  AuthPage.restore();       // pulihkan sesi dari localStorage
  UI.route();               // render halaman awal (login atau dashboard)

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function (e) {
        console.warn('Service worker gagal terdaftar:', e);
      });
    });
  }
})();
