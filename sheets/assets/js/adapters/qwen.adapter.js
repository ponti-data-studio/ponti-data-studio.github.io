import { AIProviderAdapter } from "./ai-provider.adapter.js";
import { AI_PROVIDERS } from "../config/app.config.js";

export class QwenAdapter extends AIProviderAdapter {
  async complete(promptOrMessages) {
    this.validateApiKey();
    const cfg = AI_PROVIDERS.qwen;
    const res = await fetch(cfg.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model || cfg.defaultModel,
        messages: this.normalizeMessages(promptOrMessages),
      }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      throw new Error(`Qwen API error (${res.status}): ${errBody}`);
    }
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content || "";
    return { text, raw: data };
  }
}
