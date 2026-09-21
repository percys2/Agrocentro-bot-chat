// Simulador de consola: hablá con el agente como si fueras un cliente, sin WhatsApp.
// Requiere ANTHROPIC_API_KEY. Uso: npm run chat   (o: node scripts/chat.js --phone 50588887777 --name "Juan")
// Escribí "/dueño" para simular que escribe el dueño (comandos), "/reset" para empezar de cero, "/salir" para terminar.
import readline from "node:readline";
import path from "node:path";
import { config } from "../src/config.js";
import { Catalog } from "../src/catalog.js";
import { Orders } from "../src/orders.js";
import { createStores } from "../src/store.js";
import { ClaudeClient } from "../src/claude.js";
import { Agent } from "../src/agent.js";
import { buildSystemPrompt } from "../src/prompt.js";
import { createHandler } from "../src/handler.js";

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};

if (!config.anthropic.apiKey) {
  console.error("Falta ANTHROPIC_API_KEY (ponela en .env).");
  process.exit(1);
}

const phone = opt("phone", "50511112222");
const name = opt("name", "Cliente de prueba");
const ownerPhone = config.ownerPhone || "50599990000";
config.ownerPhone = ownerPhone;

const catalog = Catalog.load(config.dataDir, { source: config.dataSource });
const stores = createStores(path.join(config.runtimeDir, "simulador"));
const orders = new Orders(stores.orders, catalog);
const client = new ClaudeClient({ ...config.anthropic });
const agent = new Agent({ client, catalog, orders, systemPrompt: buildSystemPrompt({ catalog, dataDir: config.dataDir }) });

const gray = (s) => `\x1b[90m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;

const transport = {
  async sendText(to, text) {
    if (to === ownerPhone) console.log(yellow(`\n[→ dueño ${to}]\n${text}\n`));
    else console.log(green(`\nAgente: ${text}\n`));
  },
  async sendTemplate(to, tpl, lang, params) {
    console.log(yellow(`\n[→ dueño ${to} · plantilla ${tpl}] ${params.join(" ")}\n`));
  },
};

const handler = createHandler({ config, catalog, orders, stores, agent, transport });
console.log(gray(`Modelo: ${config.anthropic.model} · productos: ${catalog.products.length} · vos sos ${name} (${phone}). Dueño simulado: ${ownerPhone}.`));
console.log(gray('Comandos: "/dueño confirmar 1", "/reset", "/salir"\n'));

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
let seq = 0;
const ask = () =>
  rl.question("Vos: ", async (line) => {
    const text = line.trim();
    if (!text) return ask();
    if (text === "/salir") return rl.close();
    if (text === "/reset") {
      stores.sessions.delete(phone);
      console.log(gray("Conversación reiniciada."));
      return ask();
    }
    const asOwner = text.startsWith("/dueño") || text.startsWith("/dueno");
    const body = asOwner ? text.replace(/^\/due[ñn]o\s*/, "") : text;
    seq += 1;
    await handler.handleIncoming({ id: `sim-${Date.now()}-${seq}`, from: asOwner ? ownerPhone : phone, name: asOwner ? "Dueño" : name, type: "text", text: body });
    ask();
  });
ask();
