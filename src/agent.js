// El bucle del agente: manda la conversación al modelo, ejecuta las herramientas que pida, repite hasta que responda con texto.
import { TOOL_DEFINITIONS, createToolExecutor } from "./tools.js";
import { buildContextNote } from "./prompt.js";
import { log } from "./logger.js";

const MAX_TOOL_ROUNDS = 6;
const FALLBACK = "Disculpe, no pude resolver la consulta en este momento. Un asesor le escribirá en breve.";

export class Agent {
  constructor({ client, catalog, orders, systemPrompt }) {
    this.client = client;
    this.catalog = catalog;
    this.orders = orders;
    this.systemPrompt = systemPrompt;
  }

  /**
   * @param {object} p
   * @param {{phone:string,name?:string}} p.customer
   * @param {Array} p.history  mensajes previos [{role, content}] (ya en formato de la API)
   * @param {string} p.text    mensaje nuevo del cliente
   * @param {string} p.zona    zona del cliente para filtrar precios
   * @returns {{ reply: string, messages: Array, events: Array, usage: object }}
   */
  async respond({ customer, history = [], text, zona }) {
    const events = [];
    const execute = createToolExecutor({ catalog: this.catalog, orders: this.orders, customer, events, zona });
    const messages = [...history, { role: "user", content: text }];
    const usage = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
    const systemExtra = buildContextNote({ catalog: this.catalog, customer });
    let reply = "";

    for (let round = 0; round <= MAX_TOOL_ROUNDS; round += 1) {
      const res = await this.client.createMessage({ system: this.systemPrompt, systemExtra, messages, tools: TOOL_DEFINITIONS });
      for (const k of Object.keys(usage)) usage[k] += res.usage?.[k] || 0;

      const content = res.content || [];
      const toolUses = content.filter((b) => b.type === "tool_use");
      const texts = content.filter((b) => b.type === "text").map((b) => b.text.trim()).filter(Boolean);

      if (res.stop_reason !== "tool_use" || !toolUses.length) {
        // Se guardan solo los bloques de texto: un tool_use a medias (por max_tokens) dejaría el historial inválido.
        reply = texts.join("\n\n") || FALLBACK;
        const textBlocks = content.filter((b) => b.type === "text" && b.text.trim());
        messages.push({ role: "assistant", content: textBlocks.length ? textBlocks : [{ type: "text", text: reply }] });
        break;
      }

      if (round === MAX_TOOL_ROUNDS) {
        // Demasiadas vueltas: no se ejecutan más herramientas y se cierra con un mensaje seguro.
        reply = texts.join("\n\n") || FALLBACK;
        messages.push({ role: "assistant", content: [{ type: "text", text: reply }] });
        events.push({ type: "handoff", motivo: "el agente no pudo cerrar la consulta", resumen: text });
        break;
      }

      // Ejecuta todas las herramientas pedidas en esta vuelta y devuelve los resultados.
      messages.push({ role: "assistant", content });
      const results = [];
      for (const tu of toolUses) {
        const started = Date.now();
        const result = await execute(tu.name, tu.input);
        log.debug("tool", { name: tu.name, input: tu.input, ms: Date.now() - started });
        events.push({ type: "tool_call", name: tu.name, input: tu.input, result });
        results.push({ type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(result) });
      }
      messages.push({ role: "user", content: results });
    }

    return { reply, messages, events, usage };
  }
}

// Recorta el historial para que la conversación no crezca sin límite. Mantiene pares completos
// y nunca deja un tool_result sin su tool_use (cortamos solo en mensajes de usuario con texto).
export function trimHistory(messages, maxTurns) {
  if (messages.length <= maxTurns) return messages;
  const isBoundary = (m) => m.role === "user" && typeof m.content === "string";
  const target = messages.length - maxTurns;
  // Primero busca hacia adelante desde el corte; si no hay un mensaje de usuario con texto, hacia atrás.
  let start = -1;
  for (let i = target; i < messages.length; i += 1) if (isBoundary(messages[i])) { start = i; break; }
  if (start === -1) for (let i = target - 1; i >= 0; i -= 1) if (isBoundary(messages[i])) { start = i; break; }
  return start <= 0 ? messages : messages.slice(start);
}
