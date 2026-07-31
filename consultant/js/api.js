/** api.js — HTTP client ke backend GAS. Retry hanya untuk error jaringan. */
const Api = {
  async post(action, payload) {
    if (!APP_CONFIG.API_URL || APP_CONFIG.API_URL.indexOf('http') !== 0) {
      throw new Error('API_URL belum diisi di js/config.js');
    }
    const body = JSON.stringify({
      action: action,
      token: localStorage.getItem('aca_token') || '',
      payload: payload || {}
    });
    let lastErr = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      let res;
      try {
        // text/plain menghindari CORS preflight (batasan Apps Script)
        res = await fetch(APP_CONFIG.API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: body
        });
      } catch (netErr) { // error jaringan → retry dengan backoff
        lastErr = new Error('Gagal terhubung ke server. Periksa koneksi internet.');
        await new Promise(function (r) { setTimeout(r, 700 * (attempt + 1)); });
        continue;
      }
      const data = await res.json();
      if (data.ok) return data.data;
      if (data.error === 'UNAUTHORIZED') { AuthPage.forceLogout(); }
      throw new Error(data.message || data.error || 'Terjadi kesalahan'); // error aplikasi → jangan retry
    }
    throw lastErr || new Error('Gagal terhubung ke server');
  }
};
