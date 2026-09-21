// Refresca los datos del agente desde el sitio agrocentronica.com (catálogo y fichas).
// Guarda copias crudas en data/site/ y regenera data/products.json y data/feed-guides.json.
// Uso: npm run sync-site
import fs from "node:fs";
import path from "node:path";
import { config } from "../src/config.js";
import { evalSiteScript, normalizeSiteGuides } from "../src/catalog.js";

const base = config.siteBaseUrl.replace(/\/$/, "");
const siteDir = path.join(config.dataDir, "site");
fs.mkdirSync(siteDir, { recursive: true });

async function fetchText(p) {
  const res = await fetch(`${base}${p}?t=${Date.now()}`);
  if (!res.ok) throw new Error(`${p}: HTTP ${res.status}`);
  return res.text();
}

const catalogJs = await fetchText("/data/catalog-data.js");
const guidesJs = await fetchText("/data/feed-guides.js");
fs.writeFileSync(path.join(siteDir, "catalog-data.js"), catalogJs);
fs.writeFileSync(path.join(siteDir, "feed-guides.js"), guidesJs);

const w1 = evalSiteScript(catalogJs);
const products = (w1.AGROCENTRO_PRODUCTS || []).map(({ image, ...rest }) => rest);
if (!products.length) throw new Error("El catálogo del sitio vino vacío; no se tocan los snapshots.");

const productsFile = path.join(config.dataDir, "products.json");
const prev = JSON.parse(fs.readFileSync(productsFile, "utf8"));
fs.writeFileSync(productsFile, JSON.stringify({ _fuente: `Snapshot de ${base}/data/catalog-data.js (${new Date().toISOString().slice(0, 10)})`, products }, null, 2));

const guidesFile = path.join(config.dataDir, "feed-guides.json");
const prevGuides = JSON.parse(fs.readFileSync(guidesFile, "utf8"));
const w2 = evalSiteScript(guidesJs);
const guides = normalizeSiteGuides(w2.AGROCENTRO_FEED_GUIDES || {}, prevGuides.guides);
fs.writeFileSync(guidesFile, JSON.stringify({ _fuente: `${prevGuides._fuente.split(".")[0]}. Refrescado ${new Date().toISOString().slice(0, 10)}`, guides }, null, 2));

const added = products.filter((p) => !prev.products.some((q) => q.id === p.id)).map((p) => `${p.id} ${p.name}`);
const removed = prev.products.filter((p) => !products.some((q) => q.id === p.id)).map((p) => `${p.id} ${p.name}`);
console.log(`Productos: ${products.length} (nuevos: ${added.length ? added.join(", ") : "ninguno"}; retirados: ${removed.length ? removed.join(", ") : "ninguno"}). Fichas: ${Object.keys(guides).length}.`);
console.log("Si hay productos nuevos, corré `npm run init-prices` para agregarlos a la lista de precios.");
