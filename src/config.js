// Configuración por variables de entorno. Copiá .env.example a .env o definilas en el hosting.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, "..");

// Carga .env si existe (sin dependencias).
function loadDotEnv() {
  const file = path.join(ROOT, ".env");
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
loadDotEnv();

const env = (name, fallback) => {
  const v = process.env[name];
  return v === undefined || v === "" ? fallback : v;
};

export const config = {
  port: Number(env("PORT", 3000)),
  dataDir: env("DATA_DIR", path.join(ROOT, "data")),
  runtimeDir: env("RUNTIME_DIR", path.join(ROOT, "data", "runtime")),

  anthropic: {
    apiKey: env("ANTHROPIC_API_KEY", ""),
    model: env("ANTHROPIC_MODEL", "claude-sonnet-5"),
    maxTokens: Number(env("ANTHROPIC_MAX_TOKENS", 1024)),
    baseUrl: env("ANTHROPIC_BASE_URL", "https://api.anthropic.com"),
  },

  whatsapp: {
    token: env("WHATSAPP_TOKEN", ""),
    phoneNumberId: env("WHATSAPP_PHONE_NUMBER_ID", ""),
    verifyToken: env("WHATSAPP_VERIFY_TOKEN", "agrocentro-verify"),
    appSecret: env("WHATSAPP_APP_SECRET", ""),
    apiVersion: env("WHATSAPP_API_VERSION", "v22.0"),
    // Plantilla aprobada para avisarle al dueño fuera de la ventana de 24 h (opcional).
    ownerTemplate: env("OWNER_ALERT_TEMPLATE", ""),
    ownerTemplateLang: env("OWNER_ALERT_TEMPLATE_LANG", "es"),
  },

  // Número del dueño/asesor en formato internacional sin "+", ej. 50582403490.
  ownerPhone: env("OWNER_PHONE", ""),

  // Sesiones: cuántos mensajes recordar y cuánto tiempo.
  session: {
    maxTurns: Number(env("SESSION_MAX_TURNS", 24)),
    ttlHours: Number(env("SESSION_TTL_HOURS", 24)),
  },

  // Fuente de datos: "snapshot" usa data/*.json; "site" intenta leer los .js del sitio al arrancar.
  dataSource: env("DATA_SOURCE", "snapshot"),
  siteBaseUrl: env("SITE_BASE_URL", "https://www.agrocentronica.com"),

  logLevel: env("LOG_LEVEL", "info"),
};

export function assertRuntimeConfig() {
  const missing = [];
  if (!config.anthropic.apiKey) missing.push("ANTHROPIC_API_KEY");
  if (!config.whatsapp.token) missing.push("WHATSAPP_TOKEN");
  if (!config.whatsapp.phoneNumberId) missing.push("WHATSAPP_PHONE_NUMBER_ID");
  if (!config.whatsapp.appSecret) missing.push("WHATSAPP_APP_SECRET (sin él cualquiera podría mandar mensajes falsos al webhook)");
  if (missing.length) {
    throw new Error(`Faltan variables de entorno: ${missing.join(", ")}. Revisá .env.example.`);
  }
}
