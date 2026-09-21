// Prueba el bucle del agente y el flujo completo (cliente → pedido → aviso al dueño → confirmación) con un modelo simulado.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Catalog } from "../src/catalog.js";
import { Orders } from "../src/orders.js";
import { createStores } from "../src/store.js";
import { Agent, trimHistory } from "../src/agent.js";
import { buildSystemPrompt } from "../src/prompt.js";
import { createHandler } from "../src/handler.js";
import { TOOL_DEFINITIONS } from "../src/tools.js";

const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data");

// Modelo falso: devuelve respuestas programadas en orden; captura lo que recibe.
function fakeClient(script) {
  const calls = [];
  return {
    calls,
    async createMessage(req) {
      calls.push(req);
      const next = script.shift();
      if (!next) throw new Error("el script del modelo falso se quedó sin respuestas");
      return next;
    },
  };
}

const text = (t) => ({ stop_reason: "end_turn", content: [{ type: "text", text: t }], usage: { input_tokens: 10, output_tokens: 5 } });
const toolUse = (id, name, input) => ({ stop_reason: "tool_use", content: [{ type: "tool_use", id, name, input }], usage: { input_tokens: 10, output_tokens: 5 } });

function setup(script) {
  const runtimeDir = fs.mkdtempSync(path.join(os.tmpdir(), "agro-test-"));
  const config = {
    ownerPhone: "50599990000",
    session: { maxTurns: 24, ttlHours: 24 },
    whatsapp: { ownerTemplate: "" },
  };
  const catalog = Catalog.load(dataDir);
  const stores = createStores(runtimeDir);
  const orders = new Orders(stores.orders, catalog);
  const client = fakeClient(script);
  const agent = new Agent({ client, catalog, orders, systemPrompt: buildSystemPrompt({ catalog, dataDir }) });
  const sent = [];
  const transport = { async sendText(to, body) { sent.push({ to, body }); } };
  const handler = createHandler({ config, catalog, orders, stores, agent, transport });
  return { config, catalog, stores, orders, client, agent, sent, handler };
}

test("el prompt de sistema incluye guía, catálogo y reglas", () => {
  const catalog = Catalog.load(dataDir);
  const p = buildSystemPrompt({ catalog, dataDir });
  assert.match(p, /Preiniciarina Plus LA \(días 1 a 7\)/);
  assert.match(p, /ÍNDICE DEL CATÁLOGO/);
  assert.match(p, /Nunca inventés productos/);
  assert.ok(p.length < 60000);
});

test("las herramientas tienen esquema válido", () => {
  for (const t of TOOL_DEFINITIONS) {
    assert.ok(t.name && t.description && t.input_schema?.type === "object", t.name);
  }
});

test("el agente ejecuta herramientas y devuelve el texto final", async () => {
  const { agent, client } = setup([
    toolUse("tu_1", "recomendar_alimento", { especie: "pollo_engorde", edad_dias: 10, cantidad: 100 }),
    text("Con 10 días les toca Iniciarina hasta el día 21."),
  ]);
  const res = await agent.respond({ customer: { phone: "50511112222", name: "Ana" }, history: [], text: "Tengo 100 pollos de 10 días, ¿qué les doy?" });
  assert.equal(res.reply, "Con 10 días les toca Iniciarina hasta el día 21.");
  assert.equal(res.events.filter((e) => e.type === "tool_call").length, 1);
  // La segunda llamada al modelo lleva el tool_result con el cálculo real.
  const toolResult = res.messages.find((m) => m.role === "user" && Array.isArray(m.content) && m.content[0]?.type === "tool_result").content[0];
  assert.equal(client.calls.length, 2);
  assert.match(toolResult.content, /Iniciarina/);
  assert.match(toolResult.content, /"total_sacos_100lb":10/);
  // El prompt de sistema va marcado para caché y las herramientas se envían.
  assert.equal(client.calls[0].tools.length, TOOL_DEFINITIONS.length);
});

test("flujo completo: pedido → aviso al dueño → confirmación al cliente", async () => {
  const { handler, sent, orders, stores, config } = setup([
    toolUse("tu_1", "crear_pedido", { nombre_cliente: "Ana López", sucursal: "Masatepe", items: [{ producto_id: 1, cantidad: 3, presentacion: "Saco 100 lb (45.4 kg)" }] }),
    text("Listo, su pedido #1 quedó registrado. Un asesor lo confirma en breve."),
  ]);
  await handler.handleIncoming({ id: "m1", from: "50511112222", name: "Ana", type: "text", text: "Sí, dejalo registrado" });

  // Respuesta al cliente y aviso al dueño.
  assert.equal(sent[0].to, "50511112222");
  assert.match(sent[0].body, /pedido #1/);
  assert.equal(sent[1].to, config.ownerPhone);
  assert.match(sent[1].body, /Pedido #1 nuevo · Masatepe/);
  assert.match(sent[1].body, /3 × Engordina/);
  assert.equal(orders.get(1).estado, "pendiente");

  // El dueño confirma desde su WhatsApp: no pasa por el modelo.
  await handler.handleIncoming({ id: "m2", from: config.ownerPhone, name: "Percy", type: "text", text: "confirmar 1 Pase después de las 2 pm" });
  assert.equal(orders.get(1).estado, "confirmado");
  const toCustomer = sent.find((s) => s.to === "50511112222" && /confirmado/.test(s.body));
  assert.ok(toCustomer);
  assert.match(toCustomer.body, /Pase después de las 2 pm/);

  // Mensaje repetido (Meta reenvía el webhook) se ignora.
  const before = sent.length;
  await handler.handleIncoming({ id: "m2", from: config.ownerPhone, name: "Percy", type: "text", text: "confirmar 1" });
  assert.equal(sent.length, before);

  // Sesión guardada con historial.
  const session = stores.sessions.get("50511112222");
  assert.ok(session.messages.length >= 2);
});

test("pasar_a_humano avisa al dueño y luego solo reenvía mensajes", async () => {
  const { handler, sent, config } = setup([
    toolUse("tu_1", "pasar_a_humano", { motivo: "reclamo", resumen: "Saco con moho" }),
    text("Un asesor le escribirá en breve."),
  ]);
  await handler.handleIncoming({ id: "h1", from: "50511113333", name: "Luis", type: "text", text: "El saco vino con moho, quiero hablar con alguien" });
  assert.match(sent.find((s) => s.to === config.ownerPhone).body, /Cliente pide asesor/);
  await handler.handleIncoming({ id: "h2", from: "50511113333", name: "Luis", type: "text", text: "¿Hola?" });
  const last = sent[sent.length - 1];
  assert.equal(last.to, "50511113333");
  assert.match(last.body, /Recibido/);
  assert.match(sent[sent.length - 2].body, /mientras espera asesor/);
});

test("mensajes no soportados (audio) reciben aviso y se notifica al dueño", async () => {
  const { handler, sent, config } = setup([]);
  await handler.handleIncoming({ id: "a1", from: "50511114444", name: "Rosa", type: "audio", text: "", unsupported: true });
  assert.match(sent[0].body, /solo puedo leer mensajes de texto/);
  assert.equal(sent[1].to, config.ownerPhone);
});

test("trimHistory corta solo en mensajes de usuario con texto", () => {
  const msgs = [
    { role: "user", content: "a" },
    { role: "assistant", content: [{ type: "tool_use", id: "1", name: "x", input: {} }] },
    { role: "user", content: [{ type: "tool_result", tool_use_id: "1", content: "{}" }] },
    { role: "assistant", content: [{ type: "text", text: "b" }] },
    { role: "user", content: "c" },
    { role: "assistant", content: [{ type: "text", text: "d" }] },
  ];
  const t = trimHistory(msgs, 3);
  assert.equal(t.length, 2);
  assert.equal(t[0].content, "c");
});

test("un tool_use cortado por max_tokens no queda en el historial", async () => {
  const { agent } = setup([
    { stop_reason: "max_tokens", content: [{ type: "text", text: "Déjeme revisar" }, { type: "tool_use", id: "tu_x", name: "buscar_productos", input: {} }], usage: {} },
  ]);
  const res = await agent.respond({ customer: { phone: "50511110000" }, history: [], text: "hola" });
  const last = res.messages[res.messages.length - 1];
  assert.equal(last.role, "assistant");
  assert.ok(last.content.every((b) => b.type === "text"));
  assert.equal(res.reply, "Déjeme revisar");
});

test("trimHistory nunca devuelve vacío con historial lleno de herramientas", () => {
  const msgs = [{ role: "user", content: "a" }];
  for (let i = 0; i < 10; i += 1) {
    msgs.push({ role: "assistant", content: [{ type: "tool_use", id: `t${i}`, name: "x", input: {} }] });
    msgs.push({ role: "user", content: [{ type: "tool_result", tool_use_id: `t${i}`, content: "{}" }] });
  }
  msgs.push({ role: "assistant", content: [{ type: "text", text: "fin" }] });
  const t = trimHistory(msgs, 5);
  assert.ok(t.length > 0);
  assert.equal(t[0].role, "user");
  assert.equal(typeof t[0].content, "string");
});
