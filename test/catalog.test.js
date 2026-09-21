import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Catalog, evalSiteScript, normalizeSiteGuides } from "../src/catalog.js";

const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data");
const catalog = Catalog.load(dataDir);

test("carga los 128 productos del sitio", () => {
  assert.equal(catalog.products.length, 128);
  assert.equal(catalog.get(1).name, "Engordina");
  assert.equal(catalog.get(999), null);
});

test("busca por sinónimos nicaragüenses y sin tildes", () => {
  const chanchos = catalog.search("comida para chanchos").map((r) => r.nombre);
  assert.ok(chanchos.includes("Jamonina"));
  assert.ok(chanchos.includes("Neopigg 1"));
  const desp = catalog.search("desparasitante para perros").map((r) => r.nombre);
  assert.equal(desp[0].includes("Endal") || desp[0].includes("Fripets") || desp[0].includes("Fipronex"), true);
  assert.equal(catalog.search("neopigg 2")[0].nombre, "Neopigg 2");
  assert.equal(catalog.search("posturína")[0].nombre.startsWith("Posturina"), true);
});

test("filtra por tipo y especie", () => {
  const vet = catalog.search("aves", { type: "medicinas" });
  assert.ok(vet.every((r) => r.tipo === "Productos veterinarios"));
  const equinos = catalog.search("alimento", { category: "equinos" });
  assert.ok(equinos.every((r) => r.especie === "Caballos"));
});

test("la ficha incluye análisis, presentación y aviso veterinario cuando corresponde", () => {
  const d = catalog.details(2);
  assert.equal(d.nombre, "Iniciarina");
  assert.equal(d.periodo, "Días 8 a 21");
  assert.equal(d.analisis_garantizado.proteina_min_pct, 22);
  assert.ok(d.presentaciones.includes("Saco 100 lb (45.4 kg)"));
  const vet = catalog.details(200);
  assert.equal(vet.es_veterinario, true);
  assert.ok(vet.aviso_veterinario.includes("veterinario"));
});

test("sin precios cargados responde 'por confirmar'; con precio lo muestra", () => {
  assert.match(catalog.priceText(1), /por confirmar/i);
  const c2 = new Catalog({ ...catalog, products: catalog.products, guides: catalog.guides, programs: catalog.programs, store: catalog.store, prices: { moneda: "C$", precios: [{ id: 1, producto: "Engordina", presentacion: "Saco 100 lb (45.4 kg)", precio: 1850 }, { id: 1, producto: "Engordina", presentacion: "Libra", precio: null }] } });
  assert.match(c2.priceText(1), /1[.,]?850/);
  assert.equal(c2.hasPrice(1), true);
  assert.deepEqual(c2.presentations(1), ["Saco 100 lb (45.4 kg)", "Libra"]);
});

test("evalúa archivos de datos del sitio en un sandbox y normaliza fichas", () => {
  const w = evalSiteScript(`window.AGROCENTRO_PRODUCTS = [{ id: 1, name: "Engordina", image: "x.webp", type: "alimentos", category: "aves" }];`);
  assert.equal(w.AGROCENTRO_PRODUCTS[0].name, "Engordina");
  const guides = normalizeSiteGuides(
    {
      1: { stage: "Engorde", period: "Día 22 en adelante", form: "Pellet", presentation: ["Saco 100 lb"], analysis: [["Humedad", "13.00 %"], ["Proteína", "19.00 %"], ["Grasa", "4.00 %"], ["Fibra", "5.00 %"], ["Energía metabolizable", "2950 kcal/kg"], ["Calcio", "0.60–1.00 %"], ["Sal", "0.10–0.45 %"], ["Fósforo", "0.50 %"]] },
    },
    { 1: { notas: "previo" } },
  );
  assert.equal(guides["1"].etapa, "Engorde");
  assert.equal(guides["1"].presentacion, "Saco 100 lb");
  assert.equal(guides["1"].analisis.proteina, 19);
  assert.equal(guides["1"].analisis.energia_tipo, "EM");
  assert.equal(guides["1"].notas, "previo");
});
