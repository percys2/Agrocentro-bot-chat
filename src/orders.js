// Pedidos: el agente los crea "pendientes"; el dueño los confirma, rechaza o marca listos desde su WhatsApp.
import { formatMoney } from "./catalog.js";

export const ORDER_STATUS = {
  pendiente: "Pendiente de confirmar",
  confirmado: "Confirmado",
  listo: "Listo para retirar",
  rechazado: "No se pudo atender",
  entregado: "Entregado",
};

export class Orders {
  constructor(collection, catalog) {
    this.col = collection;
    this.catalog = catalog;
  }

  create({ cliente_telefono, cliente_nombre, sucursal, items, notas }) {
    const errores = [];
    if (!cliente_nombre || !String(cliente_nombre).trim()) errores.push("Falta el nombre del cliente");
    const suc = normalizeBranch(sucursal, this.catalog.store);
    if (!suc) errores.push(`Sucursal inválida: "${sucursal}". Opciones: ${this.catalog.store.sucursales.map((s) => s.nombre).join(", ")}`);
    if (!Array.isArray(items) || !items.length) errores.push("El pedido no tiene productos");
    const lineas = [];
    for (const it of items || []) {
      const p = this.catalog.get(it.producto_id);
      if (!p) {
        errores.push(`Producto id ${it.producto_id} no existe en el catálogo`);
        continue;
      }
      const cantidad = Number(it.cantidad);
      if (!Number.isFinite(cantidad) || cantidad <= 0) {
        errores.push(`Cantidad inválida para ${p.name}`);
        continue;
      }
      const presentaciones = this.catalog.presentations(p.id);
      const presentacion = it.presentacion && String(it.presentacion).trim() ? String(it.presentacion).trim() : presentaciones[0];
      const precioRow = this.catalog.pricesFor(p.id).find((r) => Number.isFinite(Number(r.precio)) && r.precio !== null && r.precio !== "" && norm(r.presentacion) === norm(presentacion));
      const precio = precioRow ? Number(precioRow.precio) : null;
      lineas.push({ producto_id: p.id, producto: p.name, presentacion, cantidad, precio_unitario: precio, subtotal: precio !== null ? round2(precio * cantidad) : null });
    }
    if (errores.length) return { ok: false, errores };

    const seq = (this.col.get("seq") || 0) + 1;
    const numero = seq;
    const conPrecio = lineas.every((l) => l.subtotal !== null);
    const total = conPrecio ? round2(lineas.reduce((a, l) => a + l.subtotal, 0)) : null;
    const order = {
      numero,
      estado: "pendiente",
      creado: new Date().toISOString(),
      cliente_telefono,
      cliente_nombre: String(cliente_nombre).trim(),
      sucursal: suc,
      items: lineas,
      total_estimado: total,
      notas: notas ? String(notas).trim() : "",
      historial: [{ estado: "pendiente", fecha: new Date().toISOString() }],
    };
    this.col.set("seq", seq);
    this.col.update("items", (items = {}) => ({ ...items, [numero]: order }));
    return { ok: true, order };
  }

  get(numero) {
    return (this.col.get("items") || {})[String(numero)] || null;
  }

  list({ estado } = {}) {
    const all = Object.values(this.col.get("items") || {});
    return all.filter((o) => !estado || o.estado === estado).sort((a, b) => a.numero - b.numero);
  }

  setStatus(numero, estado, nota) {
    if (!ORDER_STATUS[estado]) throw new Error(`Estado inválido: ${estado}`);
    const order = this.get(numero);
    if (!order) return null;
    order.estado = estado;
    order.historial.push({ estado, fecha: new Date().toISOString(), nota: nota || "" });
    if (nota) order.nota_dueno = nota;
    this.col.update("items", (items = {}) => ({ ...items, [numero]: order }));
    return order;
  }

  byCustomer(telefono) {
    return this.list().filter((o) => o.cliente_telefono === telefono);
  }

  // Texto para el dueño (aviso de pedido nuevo).
  formatForOwner(order) {
    const cur = this.catalog.prices.moneda || "C$";
    const lines = order.items.map((l) => `- ${l.cantidad} × ${l.producto} (${l.presentacion})${l.subtotal !== null ? ` = ${cur} ${formatMoney(l.subtotal)}` : ""}`);
    return [
      `Pedido #${order.numero} nuevo · ${order.sucursal}`,
      `Cliente: ${order.cliente_nombre} · wa.me/${order.cliente_telefono}`,
      ...lines,
      order.total_estimado !== null ? `Total estimado: ${cur} ${formatMoney(order.total_estimado)}` : "Total: por cotizar (faltan precios)",
      order.notas ? `Notas: ${order.notas}` : null,
      "",
      `Respondé "confirmar ${order.numero}", "listo ${order.numero}" o "rechazar ${order.numero} motivo".`,
    ]
      .filter((x) => x !== null)
      .join("\n");
  }

  // Resumen corto para el cliente (lo redacta el agente, pero esto sirve de base).
  formatForCustomer(order) {
    const cur = this.catalog.prices.moneda || "C$";
    const lines = order.items.map((l) => `- ${l.cantidad} × ${l.producto} (${l.presentacion})`);
    return [`Pedido #${order.numero} · Retiro en ${order.sucursal}`, ...lines, order.total_estimado !== null ? `Total estimado: ${cur} ${formatMoney(order.total_estimado)}` : "El precio se confirma al aprobar el pedido"].join("\n");
  }
}

export function normalizeBranch(name, store) {
  const n = norm(name);
  const found = (store?.sucursales || []).find((s) => norm(s.nombre) === n || n.includes(norm(s.nombre)));
  return found ? found.nombre : null;
}

function norm(s) {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
