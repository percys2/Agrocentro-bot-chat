// Prueba el servidor HTTP con un modelo y un transporte simulados.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

process.env.WHATSAPP_VERIFY_TOKEN = "verificame";
process.env.WHATSAPP_APP_SECRET = "secreto";
process.env.WHATSAPP_PHONE_NUMBER_ID = "111";
process.env.OWNER_PHONE = "50599990000";
process.env.RUNTIME_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "agro-srv-"));

const { buildApp, createServer } = await import("../src/server.js");
const { createStores } = await import("../src/store.js");

const sent = [];
const app = buildApp({
  client: { async createMessage() { return { stop_reason: "end_turn", content: [{ type: "text", text: "Hola, ¿en qué le puedo ayudar?" }], usage: {} }; } },
  transport: { async sendText(to, body) { sent.push({ to, body }); }, async markRead() {} },
  stores: createStores(process.env.RUNTIME_DIR),
});
const server = createServer(app);
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;

test("GET /health responde", async () => {
  const res = await fetch(`${base}/health`);
  assert.equal(res.status, 200);
  const j = await res.json();
  assert.equal(j.productos, 128);
});

test("GET /webhook verifica el token", async () => {
  const ok = await fetch(`${base}/webhook?hub.mode=subscribe&hub.verify_token=verificame&hub.challenge=abc123`);
  assert.equal(await ok.text(), "abc123");
  const bad = await fetch(`${base}/webhook?hub.mode=subscribe&hub.verify_token=otro&hub.challenge=abc123`);
  assert.equal(bad.status, 403);
});

test("POST /webhook exige firma válida y responde al cliente", async () => {
  const payload = JSON.stringify({
    object: "whatsapp_business_account",
    entry: [{ changes: [{ field: "messages", value: { metadata: { phone_number_id: "111" }, contacts: [{ wa_id: "50588887777", profile: { name: "Ana" } }], messages: [{ id: "wamid.s1", from: "50588887777", timestamp: "1700000000", type: "text", text: { body: "Hola" } }] } }] }],
  });
  const unsigned = await fetch(`${base}/webhook`, { method: "POST", headers: { "content-type": "application/json" }, body: payload });
  assert.equal(unsigned.status, 401);

  const sig = "sha256=" + crypto.createHmac("sha256", "secreto").update(payload).digest("hex");
  const res = await fetch(`${base}/webhook`, { method: "POST", headers: { "content-type": "application/json", "x-hub-signature-256": sig }, body: payload });
  assert.equal(res.status, 200);
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, "50588887777");
  assert.match(sent[0].body, /ayudar/);
});

test.after(() => server.close());
