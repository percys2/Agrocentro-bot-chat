// Cliente mínimo de la API de mensajes de Claude usando fetch (sin SDK). Reintenta en 429/5xx.
import { log } from "./logger.js";

export class ClaudeClient {
  constructor({ apiKey, model, maxTokens = 1024, baseUrl = "https://api.anthropic.com", fetchImpl = globalThis.fetch, timeoutMs = 60000 }) {
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY vacío");
    this.apiKey = apiKey;
    this.timeoutMs = timeoutMs;
    this.model = model;
    this.maxTokens = maxTokens;
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.fetch = fetchImpl;
  }

  async createMessage({ system, systemExtra, messages, tools, temperature = 0.3, maxRetries = 3 }) {
    // El prompt de sistema fijo se marca para caché (es largo: guía + catálogo y no cambia).
    // Lo variable (fecha, hora, nombre del cliente) va en un bloque aparte después del marcador.
    const systemBlocks = [{ type: "text", text: system, cache_control: { type: "ephemeral" } }];
    if (systemExtra) systemBlocks.push({ type: "text", text: systemExtra });
    const body = {
      model: this.model,
      max_tokens: this.maxTokens,
      temperature,
      system: systemBlocks,
      tools,
      messages,
    };
    let attempt = 0;
    for (;;) {
      attempt += 1;
      let res;
      try {
        res = await this.fetch(`${this.baseUrl}/v1/messages`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": this.apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(this.timeoutMs),
        });
      } catch (err) {
        // Tiempo agotado o red caída: se reintenta como si fuera un 5xx.
        if (attempt <= maxRetries) {
          log.warn("Claude API sin respuesta, reintento", { err: err.name, attempt });
          await new Promise((r) => setTimeout(r, Math.min(8000, 500 * 2 ** attempt)));
          continue;
        }
        throw new Error(`Claude API sin respuesta: ${err.message}`);
      }
      if (res.ok) return res.json();
      const text = await res.text().catch(() => "");
      const retryable = res.status === 429 || res.status === 529 || res.status >= 500;
      if (retryable && attempt <= maxRetries) {
        const wait = Math.min(8000, 500 * 2 ** attempt);
        log.warn("Claude API reintento", { status: res.status, attempt, wait });
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      throw new Error(`Claude API ${res.status}: ${text.slice(0, 500)}`);
    }
  }
}
