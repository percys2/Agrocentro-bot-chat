// Orquesta un mensaje entrante: dedupe, sesión, comandos del dueño, agente, respuesta y avisos.
// Es independiente del transporte: el webhook de WhatsApp y el simulador de consola usan el mismo handler.
import { trimHistory } from "./agent.js";
import { handleAdminCommand, looksLikeAdminCommand } from "./admin.js";
import { rememberProcessed } from "./store.js";
import { log } from "./logger.js";

const HANDOFF_WINDOW_MS = 2 * 3600 * 1000;
const ACK_EVERY_MS = 15 * 60 * 1000;
const ZONAS = ["Masaya", "Granada", "Veracruz", "Diriomo", "Masatepe", "Las Flores"];

export function createHandler({ config, catalog, orders, stores, agent, transport }) {
  const queues = new Map();

  function sessionFor(phone, name) {
    const s = stores.sessions.get(phone) || { phone, messages: [], zona: null };
    if (name && !s.name) s.name = name;
    const ttl = config.session.ttlHours * 3600 * 1000;
    if (s.updatedAt && Date.now() - s.updatedAt > ttl) {
      s.messages = []; // conversación vieja: empezar limpia
      s.zona = null; // resetear zona también
    }
    return s;
  }

  function saveSession(s) {
    s.updatedAt = Date.now();
    stores.sessions.set(s.phone, s);
  }

  async function notifyOwner(text) {
    if (!config.ownerPhone) {
      log.warn("OWNER_PHONE no configurado; aviso no enviado", { text: text.slice(0, 120) });
      return false;
    }
    try {
      await transport.sendText(config.ownerPhone, text);
      return true;
    } catch (err) {
      // Fuera de la ventana de 24 h Meta rechaza texto libre; si hay plantilla aprobada, se usa.
      if (config.whatsapp.ownerTemplate && transport.sendTemplate) {
        try {
          await transport.sendTemplate(config.ownerPhone, config.whatsapp.ownerTemplate, config.whatsapp.ownerTemplateLang, [text.replace(/\s+/g, " ").slice(0, 900)]);
          return true;
        } catch (err2) {
          log.error("No se pudo avisar al dueño ni por plantilla", { err: err2.message });
          return false;
        }
      }
      log.error("No se pudo avisar al dueño", { err: err.message, hint: "Escribile 'hola' al bot desde el número del dueño para abrir la ventana de 24 h, o configurá OWNER_ALERT_TEMPLATE." });
      return false;
    }
  }

  async function processEvents(events, customer) {
    for (const ev of events) {
      if (ev.type === "order_created") {
        await notifyOwner(orders.formatForOwner(ev.order));
      } else if (ev.type === "handoff") {
        const s = sessionFor(customer.phone, customer.name);
        s.handoffUntil = Date.now() + HANDOFF_WINDOW_MS;
        saveSession(s);
        await notifyOwner(`Cliente pide asesor · ${customer.name || "sin nombre"} · wa.me/${customer.phone}\nMotivo: ${ev.motivo}\n${ev.resumen}`);
      } else if (ev.type === "client_data_saved") {
        const s = sessionFor(customer.phone, customer.name);
        if (!s.clientData) s.clientData = {};
        s.clientData = { ...s.clientData, ...ev };
        delete s.clientData.type; // No guardar el type del evento
        saveSession(s);
      }
    }
  }

  async function handleCustomer(msg) {
    const customer = { phone: msg.from, name: msg.name };
    const session = sessionFor(msg.from, msg.name);

    if (session.pausedUntil && session.pausedUntil > Date.now()) {
      log.info("Bot pausado para este número; mensaje ignorado", { from: msg.from });
      return;
    }

    if (msg.unsupported) {
      await transport.sendText(msg.from, `Por ahora solo puedo leer mensajes de texto. Escríbame su consulta por escrito, o si prefiere llame o escriba al ${catalog.store.telefono_humano}.`);
      await notifyOwner(`${customer.name || msg.from} (wa.me/${msg.from}) mandó un mensaje de tipo "${msg.type}" que el bot no puede leer.`);
      return;
    }

    // Conversación en manos de un asesor: se reenvía y se acusa recibo sin insistir.
    if (session.handoffUntil && session.handoffUntil > Date.now()) {
      await notifyOwner(`Mensaje de ${customer.name || msg.from} (wa.me/${msg.from}) mientras espera asesor:\n${msg.text}`);
      if (!session.lastAckAt || Date.now() - session.lastAckAt > ACK_EVERY_MS) {
        await transport.sendText(msg.from, "Recibido. Un asesor le responde en breve.");
        session.lastAckAt = Date.now();
        saveSession(session);
      }
      return;
    }

    // Si no tiene zona, preguntar primero
    if (!session.zona) {
      // Verificar si el mensaje es una zona válida (por nombre o número)
      let zonaDelMensaje;

      // Intentar por número (1-6)
      const num = parseInt(msg.text.trim());
      if (num >= 1 && num <= ZONAS.length) {
        zonaDelMensaje = ZONAS[num - 1];
      } else {
        // Intentar por nombre
        zonaDelMensaje = ZONAS.find(z => msg.text.toLowerCase().includes(z.toLowerCase()));
      }

      if (zonaDelMensaje) {
        session.zona = zonaDelMensaje;
        saveSession(session);
        // Proceder con el resto del mensaje
      } else {
        // Preguntar por zona con botones numerados
        const opcionesFormato = ZONAS.map((z, i) => `${i + 1}. ${z}`).join("\n");
        await transport.sendText(msg.from, `Hola 👋 ¿De dónde escribís?\n\n${opcionesFormato}\n\nEscribe el número o el nombre de tu zona.`);
        return;
      }
    }

    const started = Date.now();
    // Enriquecer customer con los datos guardados en la sesión
    const enrichedCustomer = { ...customer, clientData: session.clientData || {} };
    const { reply, messages, events, usage } = await agent.respond({ customer: enrichedCustomer, history: session.messages, text: msg.text, zona: session.zona });
    session.messages = trimHistory(messages, config.session.maxTurns);
    saveSession(session);
    log.info("respuesta", { from: msg.from, ms: Date.now() - started, tools: events.filter((e) => e.type === "tool_call").map((e) => e.name), usage });

    try {
      await transport.sendText(msg.from, reply);
    } catch (err) {
      log.error("No se pudo responder al cliente", { to: msg.from, err: err.message });
    }
    await processEvents(events, customer); // el aviso al dueño sale aunque falle la respuesta al cliente
    return reply;
  }

  async function handleOwner(msg) {
    const { reply, customerMessages } = handleAdminCommand({ text: msg.text, orders, sessions: stores.sessions, catalog });
    for (const cm of customerMessages) {
      try {
        await transport.sendText(cm.to, cm.text);
      } catch (err) {
        log.error("No se pudo avisar al cliente", { to: cm.to, err: err.message });
      }
    }
    await transport.sendText(msg.from, reply);
    return reply;
  }

  async function handleIncoming(msg) {
    if (msg.id && !rememberProcessed(stores.processed, msg.id)) {
      log.debug("mensaje repetido ignorado", { id: msg.id });
      return;
    }
    if (transport.markRead && msg.id) transport.markRead(msg.id).catch(() => {});

    const isOwner = config.ownerPhone && msg.from === config.ownerPhone;
    try {
      if (isOwner && looksLikeAdminCommand(msg.text)) return await handleOwner(msg);
      return await handleCustomer(msg);
    } catch (err) {
      log.error("error atendiendo mensaje", { from: msg.from, err: err.stack || err.message });
      try {
        await transport.sendText(msg.from, `Disculpe, tuve un problema para responder. Puede escribir al ${catalog.store.telefono_humano} y un asesor le atiende.`);
      } catch {}
      await notifyOwner(`Error atendiendo a wa.me/${msg.from}: ${err.message}`);
    }
  }

  // Serializa los mensajes de un mismo número para no cruzar respuestas.
  function enqueue(msg) {
    const prev = queues.get(msg.from) || Promise.resolve();
    const next = prev.then(() => handleIncoming(msg)).catch(() => {});
    queues.set(msg.from, next);
    next.finally(() => {
      if (queues.get(msg.from) === next) queues.delete(msg.from);
    });
    return next;
  }

  return { handleIncoming, enqueue, notifyOwner };
}
