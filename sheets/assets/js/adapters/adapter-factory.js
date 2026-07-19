import { OpenAIAdapter } from "./openai.adapter.js";
import { GeminiAdapter } from "./gemini.adapter.js";
import { QwenAdapter } from "./qwen.adapter.js";

/**
 * adapter-factory.js
 * Untuk menambah provider AI baru: buat adapter baru (extends
 * AIProviderAdapter) lalu daftarkan mapping-nya di sini.
 */
const registry = {
  openai: OpenAIAdapter,
  gemini: GeminiAdapter,
  qwen: QwenAdapter,
};

export function createAIAdapter(providerId, { apiKey, model } = {}) {
  const AdapterClass = registry[providerId];
  if (!AdapterClass) {
    throw new Error(`AI Provider "${providerId}" belum didukung.`);
  }
  return new AdapterClass({ apiKey, model });
}

export function getRegisteredProviders() {
  return Object.keys(registry);
}
