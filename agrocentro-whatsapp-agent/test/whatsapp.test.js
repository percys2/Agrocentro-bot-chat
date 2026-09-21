import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { verifyWebhook, isValidSignature, extractIncoming, splitMessage, WhatsAppClient } from "../src/whatsapp.js";

test("verificación del webhook", () => {
  assert.equal(verifyWebhook({ "hub.mode": "subscribe", "hub.verify_token": "abc", "hub.challenge": "123" }, "abc"), "123");
  assert.equal(verifyWebhook({ "hub.mode": "subscribe", "hub.verify_token": "otro", "hub.challenge": "123" }, "abc"), null);
});

test("firma X-Hub-Signature-256", () => {
  const body = Buffer.from('{"a":1}');
  const sig = "sha256=" + crypto.createHmac("sha256", "secreto").update(body).digest("hex");
  assert.equal(isValidSignature(body, sig, "secreto"), true);
  assert.equal(isValidSignature(body, "sha256=00", "secreto"), false);
  assert.equal(isValidSignature(body, undefined, ""), true); // sin secreto configurado no se valida
});

test("extrae mensajes de texto y marca los no soportados", () => {
  const payload = {
    object: "whatsapp_business_account",
    entry: [
      {
        changes: [
          {
            field: "messages",
            value: {
              metadata: { phone_number_id: "111" },
              contacts: [{ wa_id: "50588887777", profile: { name: "Ana" } }],
              messages: [
                { id: "wamid.1", from: "50588887777", timestamp: "1700000000", type: "text", text: { body: "Hola" } },
                { id: "wamid.2", from: "50588887777", timestamp: "1700000001", type: "audio", audio: { id: "x" } },
              ],
            },
          },
          { field: "messages", value: { statuses: [{ id: "wamid.9", status: "delivered" }] } },
        ],
      },
    ],
  };
  const msgs = extractIncoming(payload);
  assert.equal(msgs.length, 2);
  assert.equal(msgs[0].text, "Hola");
  assert.equal(msgs[0].name, "Ana");
  assert.equal(msgs[0].phoneNumberId, "111");
  assert.equal(msgs[1].unsupported, true);
  assert.deepEqual(extractIncoming({ object: "otro" }), []);
});

test("parte mensajes largos en párrafos", () => {
  const long = Array.from({ length: 40 }, (_, i) => `Párrafo ${i} ${"x".repeat(120)}`).join("\n\n");
  const parts = splitMessage(long, 1000);
  assert.ok(parts.length > 1);
  assert.ok(parts.every((p) => p.length <= 1000));
  assert.equal(parts.join("\n\n").replace(/\s+/g, ""), long.replace(/\s+/g, ""));
});

test("envía texto con el cuerpo que espera la API de Meta", async () => {
  const calls = [];
  const client = new WhatsAppClient({
    token: "tok",
    phoneNumberId: "111",
    fetchImpl: async (url, opts) => {
      calls.push({ url, opts });
      return { ok: true, json: async () => ({ messages: [{ id: "wamid.x" }] }) };
    },
  });
  await client.sendText("50588887777", "Hola");
  assert.equal(calls[0].url, "https://graph.facebook.com/v22.0/111/messages");
  assert.equal(calls[0].opts.headers.authorization, "Bearer tok");
  const body = JSON.parse(calls[0].opts.body);
  assert.equal(body.to, "50588887777");
  assert.equal(body.text.body, "Hola");
  await client.markRead("wamid.1");
  assert.equal(JSON.parse(calls[1].opts.body).status, "read");
});

test("firmas malformadas se rechazan sin lanzar error", () => {
  const body = Buffer.from("{}");
  assert.equal(isValidSignature(body, "sha256=" + "zz".repeat(32), "secreto"), false);
  assert.equal(isValidSignature(body, "sha256=abc", "secreto"), false);
});

test("mensajes interactivos sin texto se marcan como no soportados", () => {
  const payload = { object: "whatsapp_business_account", entry: [{ changes: [{ field: "messages", value: { messages: [{ id: "w1", from: "505", timestamp: "1", type: "interactive", interactive: { type: "nfm_reply" } }, { id: "w2", from: "505", timestamp: "1", type: "text", text: { body: "   " } }] } }] }] };
  const msgs = extractIncoming(payload);
  assert.equal(msgs[0].unsupported, true);
  assert.equal(msgs[1].unsupported, true);
});
