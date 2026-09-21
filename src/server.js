// Servidor HTTP (sin dependencias): webhook de WhatsApp + salud.
import http from "node:http";
import { URL, fileURLToPath } from "node:url";
import { config, assertRuntimeConfig } from "./config.js";
import { Catalog } from "./catalog.js";
import { Orders } from "./orders.js";
import { createStores } from "./store.js";
import { ClaudeClient } from "./claude.js";
import { Agent } from "./agent.js";
import { buildSystemPrompt } from "./prompt.js";
import { WhatsAppClient, verifyWebhook, isValidSignature, extractIncoming } from "./whatsapp.js";
import { createHandler } from "./handler.js";
import { log } from "./logger.js";

export function buildApp(overrides = {}) {
  const catalog = overrides.catalog || Catalog.load(config.dataDir, { source: config.dataSource });
  const stores = overrides.stores || createStores(config.runtimeDir);
  const orders = new Orders(stores.orders, catalog);
  const client = overrides.client || new ClaudeClient({ ...config.anthropic });
  const agent = new Agent({ client, catalog, orders, systemPrompt: buildSystemPrompt({ catalog, dataDir: config.dataDir }) });
  const wa = overrides.transport || new WhatsAppClient({ ...config.whatsapp });
  const handler = createHandler({ config, catalog, orders, stores, agent, transport: wa });
  return { catalog, stores, orders, agent, handler, wa };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export function createServer(app) {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    const send = (status, body, type = "text/plain") => {
      res.writeHead(status, { "content-type": type });
      res.end(body);
    };

    try {
      if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
        return send(200, JSON.stringify({ ok: true, productos: app.catalog.products.length, modelo: config.anthropic.model }), "application/json");
      }

      if (req.method === "GET" && url.pathname === "/webhook") {
        const challenge = verifyWebhook(Object.fromEntries(url.searchParams), config.whatsapp.verifyToken);
        return challenge !== null ? send(200, challenge) : send(403, "Token de verificación incorrecto");
      }

      if (req.method === "POST" && url.pathname === "/webhook") {
        const raw = await readBody(req);
        if (!isValidSignature(raw, req.headers["x-hub-signature-256"], config.whatsapp.appSecret)) {
          log.warn("firma inválida en webhook");
          return send(401, "Firma inválida");
        }
        let payload;
        try {
          payload = JSON.parse(raw.toString("utf8"));
        } catch {
          return send(400, "JSON inválido");
        }
        // Meta espera un 200 rápido; el procesamiento sigue en segundo plano.
        send(200, "EVENT_RECEIVED");
        for (const msg of extractIncoming(payload)) {
          if (msg.phoneNumberId && msg.phoneNumberId !== config.whatsapp.phoneNumberId) continue;
          app.handler.enqueue(msg);
        }
        return;
      }

      send(404, "No encontrado");
    } catch (err) {
      log.error("error en servidor", { err: err.stack || err.message });
      if (!res.headersSent) send(500, "Error interno");
    }
  });
}

if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) {
  assertRuntimeConfig();
  const app = buildApp();
  const server = createServer(app);
  server.listen(config.port, "0.0.0.0", () => {
    log.info("agente escuchando", { port: config.port, productos: app.catalog.products.length, modelo: config.anthropic.model, fuente: config.dataSource });
  });
}
