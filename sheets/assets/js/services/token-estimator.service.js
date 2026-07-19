import { AI_PROVIDERS } from "../config/app.config.js";

/**
 * token-estimator.service.js
 * Estimasi kasar jumlah token, biaya, dan waktu respon.
 * Rasio ~4 karakter per token (rata-rata Bahasa Inggris/Indonesia campuran)
 * dipakai sebagai pendekatan tanpa perlu tokenizer resmi tiap provider.
 */

const CHARS_PER_TOKEN = 4;

export const tokenEstimatorService = {
  estimate(promptText, providerId, expectedOutputTokens = 1500) {
    const charCount = promptText.length;
    const inputTokens = Math.ceil(charCount / CHARS_PER_TOKEN);
    const provider = AI_PROVIDERS[providerId];

    const inputCost = provider ? (inputTokens / 1000) * provider.pricePer1kInputUsd : 0;
    const outputCost = provider ? (expectedOutputTokens / 1000) * provider.pricePer1kOutputUsd : 0;

    // Estimasi waktu respon kasar: ~40 token/detik untuk model cepat
    const estimatedSeconds = Math.max(2, Math.round((inputTokens + expectedOutputTokens) / 40));

    return {
      charCount,
      inputTokens,
      expectedOutputTokens,
      estimatedCostUsd: Math.round((inputCost + outputCost) * 10000) / 10000,
      estimatedSeconds,
    };
  },
};
