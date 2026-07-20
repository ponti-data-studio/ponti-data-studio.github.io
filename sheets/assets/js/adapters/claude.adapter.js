import { AIProviderAdapter } from "./ai-provider.adapter.js";
import { AI_PROVIDERS } from "../config/app.config.js";

const ANTHROPIC_API_VERSION = "2023-06-01";

export class ClaudeAdapter extends AIProviderAdapter {
  async complete(prompt) {
    this.validateApiKey();
    const cfg = AI_PROVIDERS.claude;

    const res = await fetch(cfg.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": ANTHROPIC_API_VERSION,
        // Anthropic API tidak mengizinkan panggilan langsung dari browser secara
        // default (CORS) — header ini diperlukan supaya bisa dipanggil client-side
        // seperti provider lain di Ponti Sheets (tanpa server perantara sendiri).
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: this.model || cfg.defaultModel,
        max_tokens: 8192,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      throw new Error(`Claude API error (${res.status}): ${errBody}`);
    }
    const data = await res.json();
    const text = (data?.content || [])
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("");
    return { text, raw: data };
  }
}
