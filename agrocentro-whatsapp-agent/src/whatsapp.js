// WhatsApp Cloud API (Meta): envío de mensajes, verificación del webhook y lectura de mensajes entrantes.
import crypto from "node:crypto";
import { log } from "./logger.js";

export class WhatsAppClient {
  constructor({ token, phoneNumberId, apiVersion = "v22.0", fetchImpl = globalThis.fetch }) {
    this.token = token;
    this.phoneNumberId = phoneNumberId;
    this.base = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}`;
    this.fetch = fetchImpl;
  }

  async post(body) {
    const res = await this.fetch(`${this.base}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.token}` },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(`WhatsApp API ${res.status}: ${JSON.stringify(data).slice(0, 400)}`);
      err.status = res.status;
      err.code = data?.error?.code;
      throw err;
    }
    return data;
  }

  // WhatsApp acepta hasta 4096 caracteres por mensaje; partimos en párrafos si hace falta.
  async sendText(to, text) {
    const chunks = splitMessage(text, 3500);
    let last;
    for (const chunk of chunks) {
      last = await this.post({ messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { preview_url: false, body: chunk } });
    }
    return last;
  }

  async sendTemplate(to, name, languageCode = "es", bodyParams = []) {
    const components = bodyParams.length ? [{ type: "body", parameters: bodyParams.map((t) => ({ type: "text", text: String(t) })) }] : undefined;
    return this.post({ messaging_product: "whatsapp", to, type: "template", template: { name, language: { code: languageCode }, ...(components ? { components } : {}) } });
  }

  async markRead(messageId) {
    try {
      await this.post({ messaging_product: "whatsapp", status: "read", message_id: messageId });
    } catch (err) {
      log.warn("No se pudo marcar como leído", { err: err.message });
    }
  }
}

export function splitMessage(text, max = 3500) {
  const t = String(text ?? "").trim();
  if (t.length <= max) return [t];
  const out = [];
  let rest = t;
  while (rest.length > max) {
    let cut = rest.lastIndexOf("\n\n", max);
    if (cut < max * 0.5) cut = rest.lastIndexOf("\n", max);
    if (cut < max * 0.5) cut = rest.lastIndexOf(" ", max);
    if (cut < max * 0.5) cut = max;
    out.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) out.push(rest);
  return out;
}

// Verificación GET del webhook (Meta manda hub.mode, hub.verify_token y hub.challenge).
export function verifyWebhook(query, verifyToken) {
  if (query["hub.mode"] === "subscribe" && query["hub.verify_token"] === verifyToken) {
    return query["hub.challenge"] || "";
  }
  return null;
}

// Firma X-Hub-Signature-256 = "sha256=" + HMAC-SHA256(app secret, cuerpo crudo).
export function isValidSignature(rawBody, signatureHeader, appSecret) {
  if (!appSecret) return true; // sin secreto configurado no se valida (solo para pruebas)
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;
  const given = signatureHeader.slice("sha256=".length).toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(given)) return false;
  const expected = crypto.createHmac("sha256", appSecret).update(rawBody).digest();
  return crypto.timingSafeEqual(Buffer.from(given, "hex"), expected);
}

// Convierte el payload del webhook en una lista plana de mensajes entrantes.
export function extractIncoming(payload) {
  const out = [];
  if (!payload || payload.object !== "whatsapp_business_account") return out;
  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value || {};
      if (change.field !== "messages" || !Array.isArray(value.messages)) continue;
      const names = new Map((value.contacts || []).map((c) => [c.wa_id, c.profile?.name]));
      for (const m of value.messages) {
        const base = { id: m.id, from: m.from, name: names.get(m.from) || "", timestamp: Number(m.timestamp) * 1000, type: m.type, phoneNumberId: value.metadata?.phone_number_id };
        let text = "";
        if (m.type === "text") text = m.text?.body || "";
        else if (m.type === "interactive") text = m.interactive?.button_reply?.title || m.interactive?.list_reply?.title || "";
        else if (m.type === "button") text = m.button?.text || "";
        text = text.trim();
        // Audio, imágenes, stickers, ubicaciones o interactivos sin texto: el bot no los puede leer.
        out.push(text ? { ...base, text } : { ...base, text: "", unsupported: true });
      }
    }
  }
  return out;
}
