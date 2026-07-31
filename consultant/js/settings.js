/** settings.js — API key, model, temperature, max tokens, system prompt, bahasa, tema */
UI.routes.settings = async function (view) {
  const s = await Api.post('settings.get', {});
  App.settings = s;
  view.innerHTML = UI.topbar('Settings', 'Konfigurasi AI & tampilan — tersimpan di Google Sheets, berlaku untuk semua perangkat') +
    '<div class="card"><h2><span class="ic">🤖</span>AI Provider</h2>' +
    '  <div class="field"><label>Provider</label><select class="input" id="sProvider">' +
    '    <option value="openai"' + (s.provider === 'openai' ? ' selected' : '') + '>OpenAI (Responses API)</option></select>' +
    '    <p class="small muted" style="margin:6px 0 0">Arsitektur adapter — provider lain dapat ditambahkan di <span class="mono">AIService.gs</span> tanpa mengubah modul lain.</p></div>' +
    '  <div class="field"><label>API Key ' + (s.hasApiKey ? '<span class="chip ok">tersimpan: ' + U.esc(s.apiKeyMasked) + '</span>' : '<span class="chip warn">belum diisi</span>') + '</label>' +
    '    <input class="input mono" id="sKey" type="password" placeholder="' + (s.hasApiKey ? 'Kosongkan jika tidak ingin mengganti' : 'sk-…') + '"></div>' +
    '  <div class="field"><label>Model</label><input class="input mono" id="sModel" value="' + U.esc(s.model) + '"></div>' +
    '  <div class="row">' +
    '    <div class="field" style="flex:1"><label>Temperature (0–2)</label><input class="input" id="sTemp" type="number" step="0.1" min="0" max="2" value="' + s.temperature + '"></div>' +
    '    <div class="field" style="flex:1"><label>Max Tokens</label><input class="input" id="sMax" type="number" min="500" max="16000" value="' + s.maxTokens + '"></div></div></div>' +

    '<div class="card"><h2><span class="ic">📝</span>System Prompt</h2>' +
    '  <p class="small muted">Otak Business Analyst aplikasi ini. Dapat diubah kapan saja tanpa menyentuh source code.' +
       (s.systemPromptIsDefault ? ' <span class="chip">memakai default</span>' : ' <span class="chip accent">kustom</span>') + '</p>' +
    '  <textarea class="input mono" id="sPrompt" rows="14">' + U.esc(s.systemPrompt) + '</textarea>' +
    '  <div class="row" style="margin-top:8px"><button class="btn ghost sm" id="resetPrompt">↺ Kembalikan ke default</button></div>' +
    '  <p class="small muted" style="margin-top:8px">⚠ Pertahankan instruksi format JSON di bagian akhir prompt — aplikasi bergantung pada struktur tersebut.</p></div>' +

    '<div class="card"><h2><span class="ic">🌐</span>Preferensi</h2>' +
    '  <div class="field"><label>Bahasa balasan AI</label><select class="input" id="sLang">' +
    '    <option value="id"' + (s.language === 'id' ? ' selected' : '') + '>Bahasa Indonesia</option>' +
    '    <option value="en"' + (s.language === 'en' ? ' selected' : '') + '>English</option></select></div>' +
    '  <div class="field"><label>Tema tampilan (perangkat ini)</label>' +
    '    <button class="btn" id="sTheme">◐ Ganti Dark / Light</button></div></div>' +

    '<div class="row"><button class="btn primary" id="saveSettings">💾 Simpan Settings</button></div>';

  view.querySelector('#resetPrompt').addEventListener('click', function () {
    view.querySelector('#sPrompt').value = '';
    UI.toast('info', 'Simpan untuk kembali ke prompt default');
  });
  view.querySelector('#sTheme').addEventListener('click', function () { UI.toggleTheme(); });
  view.querySelector('#saveSettings').addEventListener('click', async function () {
    UI.loading('Menyimpan…');
    try {
      const payload = {
        provider: view.querySelector('#sProvider').value,
        model: view.querySelector('#sModel').value.trim(),
        temperature: view.querySelector('#sTemp').value,
        maxTokens: view.querySelector('#sMax').value,
        language: view.querySelector('#sLang').value,
        systemPrompt: view.querySelector('#sPrompt').value
      };
      const key = view.querySelector('#sKey').value.trim();
      if (key) payload.apiKey = key;
      App.settings = await Api.post('settings.save', payload);
      UI.closeLoading(); UI.toast('success', 'Settings tersimpan'); UI.route();
    } catch (err) { UI.closeLoading(); UI.error(err); }
  });
};
