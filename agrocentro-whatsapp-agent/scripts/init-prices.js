// Genera data/prices.json con todos los productos y sus presentaciones, sin precios (null).
// Llená los precios en ese archivo. Si ya existe, agrega los productos nuevos sin borrar los precios cargados.
import fs from "node:fs";
import path from "node:path";
import { config } from "../src/config.js";
import { Catalog } from "../src/catalog.js";

const file = path.join(config.dataDir, "prices.json");
const catalog = Catalog.load(config.dataDir);
const existing = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : { moneda: catalog.store.moneda || "C$", precios: [] };
const byKey = new Map(existing.precios.map((p) => [`${p.id}|${p.presentacion}`, p]));

function presentationsFor(p) {
  const g = catalog.guide(p.id);
  if (p.type === "alimentos") {
    const saco = g?.presentacion || "Saco 100 lb (45.4 kg)";
    // Los sacos de 100 lb se venden también por libra; las bolsas pequeñas y sacos de mascotas, por unidad.
    return /100 lb/.test(saco) ? [saco, "Libra"] : [saco];
  }
  return ["Unidad"];
}

const rows = [];
for (const p of catalog.products) {
  for (const pres of presentationsFor(p)) {
    const key = `${p.id}|${pres}`;
    rows.push(byKey.get(key) || { id: p.id, producto: p.name, presentacion: pres, precio: null });
  }
}

const out = {
  _instrucciones: "Escribí el precio en córdobas como número (ej. 1850 o 20.5). Dejá null si no querés que el agente lo diga: entonces responde 'precio por confirmar'. Podés agregar filas con otras presentaciones.",
  moneda: existing.moneda || "C$",
  actualizado: new Date().toISOString().slice(0, 10),
  precios: rows,
};
fs.writeFileSync(file, JSON.stringify(out, null, 2));
console.log(`Listo: ${rows.length} filas en ${file} (${rows.filter((r) => r.precio !== null).length} con precio).`);
