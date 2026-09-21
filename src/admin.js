// Comandos del dueño/asesor desde su propio WhatsApp. Son deterministas (no pasan por el modelo).
import fs from "node:fs";
import path from "node:path";
import { ORDER_STATUS } from "./orders.js";
import { formatMoney } from "./catalog.js";

const HELP = [
  "Comandos:",
  "- pedidos → pendientes",
  "- pedido 12 → detalle del #12",
  "- confirmar 12 [nota] → avisa al cliente que está confirmado",
  "- listo 12 [nota] → avisa que puede pasar a retirar",
  "- rechazar 12 motivo → avisa que no se pudo atender",
  "- entregado 12 → cierra el pedido",
  "- pausar 50588887777 → el bot deja de responderle a ese número (24 h)",
  "- reanudar 50588887777 → el bot vuelve a responder",
  "- estado → resumen del día",
  "",
  "CLIENTES:",
  "- clientes → resumen por zona",
  "- exportar → todos los clientes en CSV",
  "- exportar masaya → solo Masaya",
  "- exportar pollos → solo pollos de engorde",
  "- historial 50612345678 → conversación con ese número",
].join("\n");

const ANIMAL_ALIASES = {
  pollo: "pollo_engorde",
  pollos: "pollo_engorde",
  pollitos: "pollo_engorde",
  gallina: "gallina_ponedora",
  gallinas: "gallina_ponedora",
  ponedora: "gallina_ponedora",
  ponedoras: "gallina_ponedora",
  cerdo: "cerdo_lechon",
  cerdos: "cerdo_lechon",
  lechon: "cerdo_lechon",
  lechones: "cerdo_lechon",
  "cerdo engorde": "cerdo_engorde",
};

function normalizarFiltro(filtro) {
  if (!filtro) return null;
  const norm = filtro.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return ANIMAL_ALIASES[norm] || norm; // retorna nombre normalizado o el alias
}

function formatDate(ms) {
  if (!ms) return "";
  const d = new Date(ms);
  return d.toLocaleDateString("es-NI", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function exportarClientes(sessions, filtroZona = null, filtroAnimal = null) {
  const rows = [
    [
      "Teléfono",
      "Nombre",
      "Tipo Animal",
      "Cantidad",
      "Edad (días/meses)",
      "Fecha Nacimiento",
      "Sucursal Preferida",
      "Días Alimento",
      "Última Interacción",
      "Mensajes",
    ],
  ];

  const animalNorm = filtroAnimal ? normalizarFiltro(filtroAnimal) : null;
  const allSessions = sessions.all();

  for (const [phone, session] of Object.entries(allSessions)) {
    const cd = session.clientData || {};
    const zona = cd.sucursal_preferida || session.zona;

    // Aplicar filtros
    if (filtroZona && zona !== filtroZona) continue;
    if (animalNorm && cd.animal_tipo !== animalNorm) continue;

    const lastUpdate = session.updatedAt ? formatDate(session.updatedAt) : "";
    const msgCount = session.messages ? session.messages.length : 0;

    if (cd.animal_tipo) {
      const edad =
        cd.animal_edad_dias || cd.animal_edad_meses
          ? `${cd.animal_edad_dias || cd.animal_edad_meses}${cd.animal_edad_dias ? "d" : "m"}`
          : "";

      rows.push([
        phone,
        session.name || cd.nombre || "",
        cd.animal_tipo,
        cd.animal_cantidad || "",
        edad,
        cd.animal_fecha_nacimiento || "",
        zona || "",
        cd.dias_alimento || "",
        lastUpdate,
        msgCount,
      ]);
    } else if (!filtroAnimal) {
      // Si hay filtro de animal, no incluir clientes sin animales
      rows.push([
        phone,
        session.name || cd.nombre || "",
        "",
        "",
        "",
        "",
        zona || "",
        "",
        lastUpdate,
        msgCount,
      ]);
    }
  }

  const csv = rows
    .map((row) =>
      row
        .map((cell) => {
          const str = String(cell || "");
          if (str.includes(",") || str.includes('"') || str.includes("\n")) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        })
        .join(",")
    )
    .join("\n");

  const exportsDir = path.join(process.cwd(), "exports");
  if (!fs.existsSync(exportsDir)) {
    fs.mkdirSync(exportsDir, { recursive: true });
  }

  let suffix = "";
  if (filtroZona) suffix = `-${filtroZona}`;
  if (filtroAnimal) suffix += `-${filtroAnimal}`;

  const filename = `clientes${suffix}-${new Date().toISOString().split("T")[0]}.csv`;
  const filepath = path.join(exportsDir, filename);
  fs.writeFileSync(filepath, csv, "utf8");

  return { filename, filepath, count: rows.length - 1 };
}

function resumenClientes(sessions) {
  const zonas = {};
  const animales = {};

  const allSessions = sessions.all();
  for (const session of Object.values(allSessions)) {
    const cd = session.clientData || {};
    const zona = cd.sucursal_preferida || session.zona || "Sin zona";
    const animal = cd.animal_tipo || "Sin animal";

    zonas[zona] = (zonas[zona] || 0) + 1;
    animales[animal] = (animales[animal] || 0) + 1;
  }

  let texto = "📊 RESUMEN DE CLIENTES\n\n";
  texto += "POR ZONA:\n";
  Object.entries(zonas)
    .sort((a, b) => b[1] - a[1])
    .forEach(([zona, count]) => {
      texto += `  ${zona}: ${count}\n`;
    });

  texto += "\nPOR ANIMAL:\n";
  Object.entries(animales)
    .sort((a, b) => b[1] - a[1])
    .forEach(([animal, count]) => {
      const nombre = animal === "Sin animal" ? animal : animal.replace(/_/g, " ");
      texto += `  ${nombre}: ${count}\n`;
    });

  texto += `\nTotal: ${Object.values(zonas).reduce((a, b) => a + b, 0)} clientes`;

  return texto;
}

function obtenerHistorial(sessions, phone) {
  const session = sessions.get(phone);
  if (!session) {
    return `No hay sesión para ${phone}`;
  }

  let texto = `📱 HISTORIAL: ${session.name || phone}\n`;
  texto += `Zona: ${session.zona || "sin zona"}\n`;
  texto += `Última interacción: ${formatDate(session.updatedAt)}\n`;
  texto += `Mensajes: ${(session.messages || []).length}\n\n`;

  if (session.clientData) {
    const cd = session.clientData;
    texto += "DATOS GUARDADOS:\n";
    if (cd.animal_tipo) texto += `  Animal: ${cd.animal_tipo.replace(/_/g, " ")}\n`;
    if (cd.animal_cantidad) texto += `  Cantidad: ${cd.animal_cantidad}\n`;
    if (cd.animal_edad_dias) texto += `  Edad: ${cd.animal_edad_dias} días\n`;
    if (cd.sucursal_preferida) texto += `  Sucursal: ${cd.sucursal_preferida}\n`;
  }

  texto += "\n ÚLTIMOS MENSAJES:\n";
  const msgs = (session.messages || []).slice(-5).reverse();
  for (const msg of msgs) {
    const rol = msg.role === "user" ? "Cliente" : "Bot";
    const preview = msg.content.slice(0, 60);
    texto += `${rol}: ${preview}${msg.content.length > 60 ? "..." : ""}\n`;
  }

  return texto;
}

export function handleAdminCommand({ text, orders, sessions, catalog }) {
  const raw = String(text || "").trim();
  const norm = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  const [cmd, arg, ...restArr] = norm.split(/\s+/);
  const rest = raw.split(/\s+/).slice(2).join(" ").trim();
  const cur = catalog.prices.moneda || "C$";
  const customerMessages = [];

  const orderOr = (n) => {
    const o = orders.get(Number(arg));
    return o || null;
  };

  switch (cmd) {
    case "ayuda":
    case "help":
    case "?":
      return { reply: HELP, customerMessages };

    case "pedidos": {
      const list = orders.list({ estado: "pendiente" });
      if (!list.length) return { reply: "No hay pedidos pendientes.", customerMessages };
      return { reply: list.map((o) => `#${o.numero} · ${o.sucursal} · ${o.cliente_nombre} · ${o.items.length} producto(s)${o.total_estimado !== null ? ` · ${cur} ${formatMoney(o.total_estimado)}` : ""}`).join("\n"), customerMessages };
    }

    case "pedido": {
      const o = orderOr();
      if (!o) return { reply: `No encuentro el pedido #${arg || "?"}.`, customerMessages };
      return { reply: `${orders.formatForOwner(o)}\nEstado: ${ORDER_STATUS[o.estado]}`, customerMessages };
    }

    case "confirmar":
    case "confirmado": {
      const o = orderOr();
      if (!o) return { reply: `No encuentro el pedido #${arg || "?"}.`, customerMessages };
      orders.setStatus(o.numero, "confirmado", rest);
      customerMessages.push({ to: o.cliente_telefono, text: `Su pedido #${o.numero} quedó confirmado para retiro en ${o.sucursal}.${rest ? `\n${rest}` : ""}\nLe avisamos por aquí cuando esté listo. Horario: ${catalog.store.horario}` });
      return { reply: `Pedido #${o.numero} confirmado. Le avisé a ${o.cliente_nombre}.`, customerMessages };
    }

    case "listo": {
      const o = orderOr();
      if (!o) return { reply: `No encuentro el pedido #${arg || "?"}.`, customerMessages };
      orders.setStatus(o.numero, "listo", rest);
      // No enviar mensaje aquí; el scheduler se encargará de notificar al cliente.
      // Esto es más robusto: si falla la API, el scheduler reintentará.
      return { reply: `Pedido #${o.numero} marcado como listo. El sistema notificará a ${o.cliente_nombre} automáticamente en unos segundos.`, customerMessages };
    }

    case "rechazar":
    case "cancelar": {
      const o = orderOr();
      if (!o) return { reply: `No encuentro el pedido #${arg || "?"}.`, customerMessages };
      orders.setStatus(o.numero, "rechazado", rest);
      customerMessages.push({ to: o.cliente_telefono, text: `Sobre su pedido #${o.numero}: no pudimos atenderlo por ahora.${rest ? ` ${rest}` : ""}\nSi desea, escríbanos al ${catalog.store.telefono_humano} para buscar una alternativa.` });
      return { reply: `Pedido #${o.numero} rechazado. Le avisé a ${o.cliente_nombre}.`, customerMessages };
    }

    case "entregado": {
      const o = orderOr();
      if (!o) return { reply: `No encuentro el pedido #${arg || "?"}.`, customerMessages };
      orders.setStatus(o.numero, "entregado", rest);
      return { reply: `Pedido #${o.numero} cerrado como entregado.`, customerMessages };
    }

    case "pausar":
    case "reanudar": {
      const phone = (arg || "").replace(/\D/g, "");
      if (!phone) return { reply: `Indicá el número, ej. "${cmd} 50588887777".`, customerMessages };
      const s = sessions.get(phone) || { phone, messages: [] };
      s.pausedUntil = cmd === "pausar" ? Date.now() + 24 * 3600 * 1000 : 0;
      sessions.set(phone, s);
      return { reply: cmd === "pausar" ? `Listo: el bot no le responde a ${phone} por 24 horas (o hasta "reanudar ${phone}").` : `El bot vuelve a responderle a ${phone}.`, customerMessages };
    }

    case "estado": {
      const all = orders.list();
      const localDay = (d) => new Date(d).toLocaleDateString("en-CA", { timeZone: "America/Managua" });
      const today = localDay(new Date());
      const hoy = all.filter((o) => localDay(o.creado) === today);
      const pend = all.filter((o) => o.estado === "pendiente").length;
      const activos = Object.values(sessions.all()).filter((s) => s.updatedAt && Date.now() - s.updatedAt < 24 * 3600 * 1000).length;
      return { reply: `Hoy: ${hoy.length} pedido(s) nuevo(s). Pendientes: ${pend}. Conversaciones en 24 h: ${activos}.`, customerMessages };
    }

    case "exportar": {
      try {
        const zonas = ["Masaya", "Granada", "Veracruz", "Diriomo", "Masatepe", "Las Flores"];
        const filtroZona = arg && zonas.some(z => z.toLowerCase() === arg.toLowerCase())
          ? zonas.find(z => z.toLowerCase() === arg.toLowerCase())
          : null;
        const filtroAnimal = arg && !filtroZona ? arg : null;
        const { filename, filepath, count } = exportarClientes(sessions, filtroZona, filtroAnimal);
        let desc = "";
        if (filtroZona) desc = ` de ${filtroZona}`;
        if (filtroAnimal) desc = ` con ${filtroAnimal}`;
        return {
          reply: `✅ Exportado: ${filename}\n📊 ${count} cliente(s)${desc}\n📁 Ubicación: exports/${filename}\n\nAbrilo en Excel o Google Sheets.`,
          customerMessages
        };
      } catch (err) {
        return { reply: `❌ Error al exportar: ${err.message}`, customerMessages };
      }
    }

    case "clientes": {
      const resumen = resumenClientes(sessions);
      return { reply: resumen, customerMessages };
    }

    case "historial": {
      if (!arg) return { reply: "Indicá el número, ej. 'historial 50612345678'.", customerMessages };
      const phone = arg.replace(/\D/g, "");
      const historial = obtenerHistorial(sessions, phone);
      return { reply: historial, customerMessages };
    }

    default:
      return { reply: `No entendí "${raw}".\n${HELP}`, customerMessages };
  }
}

export function looksLikeAdminCommand(text) {
  const first = String(text || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/\s+/)[0];
  return ["ayuda", "help", "?", "pedidos", "pedido", "confirmar", "confirmado", "listo", "rechazar", "cancelar", "entregado", "pausar", "reanudar", "estado", "exportar", "clientes", "historial"].includes(first);
}
