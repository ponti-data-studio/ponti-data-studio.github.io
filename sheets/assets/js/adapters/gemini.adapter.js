import { AIProviderAdapter } from "./ai-provider.adapter.js";
import { AI_PROVIDERS } from "../config/app.config.js";

export class GeminiAdapter extends AIProviderAdapter {
  async complete(promptOrMessages) {
    this.validateApiKey();
    const cfg = AI_PROVIDERS.gemini;
    const model = this.model || cfg.defaultModel;
    const url = `${cfg.endpoint}/${model}:generateContent?key=${this.apiKey}`;

    // Gemini pakai format "contents"/"parts", dan role AI-nya "model" (bukan
    // "assistant" seperti provider lain) — konversi dari bentuk seragam dulu.
    const messages = this.normalizeMessages(promptOrMessages);
    const contents = messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      throw new Error(`Gemini API error (${res.status}): ${errBody}`);
    }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
    return { text, raw: data };
  }
}
