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
   * @param {string} prompt - prompt final yang akan dikirim
   * @returns {Promise<{ text: string, raw: any }>}
   */
  // eslint-disable-next-line no-unused-vars
  async complete(prompt) {
    throw new Error("complete() belum diimplementasikan oleh adapter ini");
  }

  validateApiKey() {
    if (!this.apiKey || !this.apiKey.trim()) {
      throw new Error("API Key belum diisi. Silakan isi di menu Settings.");
    }
  }
}
