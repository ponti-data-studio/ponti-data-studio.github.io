/**
 * ai-provider.adapter.js
 * -----------------------------------------------------------------------
 * Kontrak dasar (Adapter Pattern) untuk seluruh AI Provider.
 * Untuk menambah provider baru: buat class baru yang extends
 * AIProviderAdapter, implementasikan `complete()`, lalu daftarkan di
 * adapter-factory.js. Tidak ada file lain yang perlu diubah.
 * -----------------------------------------------------------------------
 */

export class AIProviderAdapter {
  constructor({ apiKey, model } = {}) {
    this.apiKey = apiKey;
    this.model = model;
  }

  /**
   * @param {string|Array<{role: "user"|"assistant", content: string}>} promptOrMessages -
   *   prompt tunggal (single-turn, seperti sebelumnya), ATAU array riwayat
   *   percakapan multi-turn (urut dari paling lama ke paling baru) untuk
   *   fitur "Lanjutkan Percakapan" di AI Studio.
   * @returns {Promise<{ text: string, raw: any }>}
   */
  // eslint-disable-next-line no-unused-vars
  async complete(promptOrMessages) {
    throw new Error("complete() belum diimplementasikan oleh adapter ini");
  }

  /** Menyeragamkan input jadi array {role, content} — dipakai semua adapter
   *  supaya konsisten menangani baik prompt tunggal maupun riwayat multi-turn. */
  normalizeMessages(promptOrMessages) {
    if (Array.isArray(promptOrMessages)) {
      return promptOrMessages.map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content }));
    }
    return [{ role: "user", content: promptOrMessages }];
  }

  validateApiKey() {
    if (!this.apiKey || !this.apiKey.trim()) {
      throw new Error("API Key belum diisi. Silakan isi di menu Settings.");
    }
  }
}
