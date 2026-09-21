// Catálogo: productos, fichas de alimentación, programas y precios.
// Fuente por defecto: data/*.json (snapshot del sitio). `npm run sync-site` los refresca desde agrocentronica.com.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

export const TYPE_LABELS = { alimentos: "Alimentos balanceados", medicinas: "Productos veterinarios", herramientas: "Herramientas" };
export const CATEGORY_LABELS = { aves: "Aves", cerdos: "Cerdos", equinos: "Caballos", perros: "Perros", gatos: "Gatos", conejos: "Conejos", otros: "Otros" };

export function normalize(text) {
  return String(text ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ñ\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Sinónimos frecuentes en Nicaragua → palabras del catálogo.
const SYNONYMS = {
  concentrado: ["alimentos"],
  comida: ["alimentos"],
  alimento: ["alimentos"],
  saco: ["alimentos"],
  pollo: ["aves", "pollo"],
  pollos: ["aves", "pollo"],
  pollito: ["aves", "pollo"],
  pollitos: ["aves", "pollo"],
  gallina: ["aves", "ponedora", "posturina"],
  gallinas: ["aves", "ponedora", "posturina"],
  ponedora: ["posturina", "ponedora"],
  ponedoras: ["posturina", "ponedora"],
  gallo: ["gallos"],
  chancho: ["cerdos"],
  chanchos: ["cerdos"],
  cerdo: ["cerdos"],
  cochino: ["cerdos"],
  lechon: ["cerdos", "neopigg"],
  lechones: ["cerdos", "neopigg"],
  cerda: ["cerdos", "criacerdina", "lacticerdina"],
  caballo: ["equinos"],
  caballos: ["equinos"],
  yegua: ["equinos", "omalina"],
  perro: ["perros"],
  perros: ["perros"],
  cachorro: ["perros", "cachorro"],
  gato: ["gatos"],
  gatos: ["gatos"],
  conejo: ["conejos"],
  conejos: ["conejos"],
  desparasitante: ["antiparasitario"],
  desparasitar: ["antiparasitario"],
  vitamina: ["vitaminas", "vitamina"],
  vitaminas: ["vitaminas", "vitamina"],
  antibiotico: ["antibacteriano", "antibiotico"],
  medicina: ["medicinas"],
  medicinas: ["medicinas"],
  veterinaria: ["medicinas"],
  herramienta: ["herramientas"],
  bomba: ["bomba"],
  fumigadora: ["fumigadora", "bomba"],
};

const STOPWORDS = new Set("de del la el los las un una unos unas y o u que con por para en al a se es son mi mis tu su sus lo le les como cual cuales cuanto cuanta cuantos cuantas que quiero necesito busco tengo tiene tienen hay dias dia semanas semana meses mes edad tipo algo alguna algun sobre me nos ya no si".split(" "));

function expandTokens(query) {
  const base = normalize(query)
    .split(" ")
    .filter((t) => t && !STOPWORDS.has(t));
  const out = new Set(base);
  for (const t of base) for (const s of SYNONYMS[t] || []) out.add(s);
  return [...out];
}

export class Catalog {
  constructor({ products, guides, programs, prices, store }) {
    this.products = products;
    this.guides = guides || {};
    this.programs = programs;
    this.prices = prices || { moneda: "C$", precios: [] };
    this.store = store;
    this.byId = new Map(products.map((p) => [Number(p.id), p]));
    this.searchIndex = products.map((p) => ({
      id: Number(p.id),
      name: normalize(p.name),
      text: normalize([p.name, p.description, p.instructions, p.category, p.type, TYPE_LABELS[p.type], CATEGORY_LABELS[p.category], this.guides[String(p.id)]?.etapa, this.guides[String(p.id)]?.periodo].join(" ")),
    }));
  }

  static load(dataDir, { source = "snapshot" } = {}) {
    const read = (f) => JSON.parse(fs.readFileSync(path.join(dataDir, f), "utf8"));
    let products = read("products.json").products;
    let guides = read("feed-guides.json").guides;
    const programs = read("programs.json");
    const store = read("store.json");
    const pricesFile = path.join(dataDir, "prices.json");
    const prices = fs.existsSync(pricesFile) ? JSON.parse(fs.readFileSync(pricesFile, "utf8")) : { moneda: store.moneda || "C$", precios: [] };

    // Si hay copias crudas del sitio (data/site/*.js) y se pidió, se usan como fuente.
    if (source === "site") {
      const siteDir = path.join(dataDir, "site");
      const catalogJs = path.join(siteDir, "catalog-data.js");
      const guidesJs = path.join(siteDir, "feed-guides.js");
      if (fs.existsSync(catalogJs)) {
        const w = evalSiteScript(fs.readFileSync(catalogJs, "utf8"));
        if (Array.isArray(w.AGROCENTRO_PRODUCTS) && w.AGROCENTRO_PRODUCTS.length) products = w.AGROCENTRO_PRODUCTS.map(stripImage);
      }
      if (fs.existsSync(guidesJs)) {
        const w = evalSiteScript(fs.readFileSync(guidesJs, "utf8"));
        if (w.AGROCENTRO_FEED_GUIDES) guides = normalizeSiteGuides(w.AGROCENTRO_FEED_GUIDES, guides);
      }
    }
    return new Catalog({ products, guides, programs, prices, store });
  }

  get(id) {
    return this.byId.get(Number(id)) || null;
  }

  guide(id) {
    return this.guides[String(id)] || null;
  }

  pricesFor(id) {
    return (this.prices.precios || []).filter((p) => Number(p.id) === Number(id));
  }

  priceText(id) {
    const rows = this.pricesFor(id).filter((p) => p.precio !== null && p.precio !== undefined && p.precio !== "");
    if (!rows.length) return "Precio por confirmar con un asesor";
    const cur = this.prices.moneda || "C$";
    return rows.map((r) => `${r.presentacion}: ${cur} ${formatMoney(r.precio)}`).join(" · ");
  }

  hasPrice(id) {
    return this.pricesFor(id).some((p) => p.precio !== null && p.precio !== undefined && p.precio !== "");
  }

  presentations(id) {
    const rows = this.pricesFor(id);
    if (rows.length) return rows.map((r) => r.presentacion);
    const g = this.guide(id);
    if (g?.presentacion) return [g.presentacion];
    const p = this.get(id);
    return p?.type === "alimentos" ? ["Saco"] : ["Unidad"];
  }

  search(query, { type, category, limit = 8 } = {}) {
    const tokens = expandTokens(query);
    const scored = [];
    for (const entry of this.searchIndex) {
      const p = this.byId.get(entry.id);
      if (type && p.type !== type) continue;
      if (category && p.category !== category) continue;
      let score = 0;
      for (const t of tokens) {
        const short = t.length < 3; // tokens cortos ("2", "hp") solo cuentan como palabra completa
        if (entry.name === t) score += 12;
        else if (entry.name.split(" ").includes(t)) score += 8;
        else if (!short && entry.name.includes(t)) score += 5;
        else if (short ? entry.text.split(" ").includes(t) : entry.text.includes(t)) score += 2;
      }
      if (score > 0) scored.push({ score, p });
    }
    scored.sort((a, b) => b.score - a.score || a.p.name.localeCompare(b.p.name));
    return scored.slice(0, limit).map((s) => this.summary(s.p));
  }

  summary(p) {
    const g = this.guide(p.id);
    return {
      id: p.id,
      nombre: p.name,
      tipo: TYPE_LABELS[p.type] || p.type,
      especie: CATEGORY_LABELS[p.category] || p.category,
      descripcion: p.description,
      etapa: g?.etapa,
      periodo: g?.periodo,
      presentaciones: this.presentations(p.id),
      precio: this.priceText(p.id),
    };
  }

  details(id) {
    const p = this.get(id);
    if (!p) return null;
    const g = this.guide(id);
    return {
      ...this.summary(p),
      instrucciones: p.instructions,
      forma: g?.forma,
      notas: g?.notas,
      analisis_garantizado: g?.analisis
        ? {
            humedad_max_pct: g.analisis.humedad,
            proteina_min_pct: g.analisis.proteina,
            grasa_min_pct: g.analisis.grasa,
            fibra_max_pct: g.analisis.fibra,
            energia_min_kcal_kg: g.analisis.energia,
            energia_tipo: g.analisis.energia_tipo === "ED" ? "digestible" : "metabolizable",
            calcio_pct: g.analisis.calcio,
            sal_pct: g.analisis.sal,
            fosforo_min_pct: g.analisis.fosforo,
          }
        : undefined,
      es_veterinario: p.type === "medicinas",
      aviso_veterinario: p.type === "medicinas" ? "La selección, dosis y precauciones las define un médico veterinario con la etiqueta de la presentación exacta. No dar dosis." : undefined,
    };
  }

  // Lista compacta para el prompt: "id · nombre (especie)" agrupada por tipo.
  compactIndex() {
    const groups = {};
    for (const p of this.products) {
      const key = TYPE_LABELS[p.type] || p.type;
      (groups[key] ||= []).push(`${p.id} ${p.name}${p.type === "alimentos" ? ` (${CATEGORY_LABELS[p.category] || p.category})` : ""}`);
    }
    return Object.entries(groups)
      .map(([k, list]) => `${k}: ${list.join("; ")}`)
      .join("\n");
  }
}

export function formatMoney(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return String(n);
  return num.toLocaleString("es-NI", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function stripImage(p) {
  const { image, ...rest } = p;
  return rest;
}

// Ejecuta un archivo de datos del sitio (window.X = ...) en un contexto aparte y devuelve el objeto window.
// node:vm aísla variables pero no es una barrera de seguridad: solo se usa con archivos del propio sitio.
export function evalSiteScript(source) {
  const window = {};
  const context = vm.createContext({ window, self: window, globalThis: window, console: { log() {}, warn() {}, error() {} } });
  vm.runInContext(source, context, { timeout: 2000 });
  return window;
}

const ANALYSIS_KEYS = ["humedad", "proteina", "grasa", "fibra", "energia", "calcio", "sal", "fosforo"];

// Convierte las fichas del sitio (forma libre) a la forma compacta usada aquí; conserva lo que ya había si algo falta.
export function normalizeSiteGuides(siteGuides, fallback = {}) {
  const out = { ...fallback };
  for (const [id, ficha] of Object.entries(siteGuides || {})) {
    if (!ficha || typeof ficha !== "object") continue;
    const prev = fallback[id] || {};
    const analisis = parseAnalysis(ficha.analysis) || prev.analisis;
    out[id] = {
      etapa: textOf(ficha.stage) || prev.etapa,
      periodo: textOf(ficha.period) || prev.periodo,
      forma: textOf(ficha.form) || prev.forma,
      presentacion: Array.isArray(ficha.presentation) ? ficha.presentation.map(textOf).join(" · ") : textOf(ficha.presentation) || prev.presentacion,
      notas: textOf(ficha.extra?.feeding || ficha.extra?.instructions || ficha.use) || prev.notas,
      ...(analisis ? { analisis } : {}),
    };
  }
  return out;
}

function textOf(v) {
  if (v === null || v === undefined) return "";
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (Array.isArray(v)) return v.map(textOf).filter(Boolean).join(", ");
  if (typeof v === "object") return textOf(v.label ?? v.name ?? v.value ?? "");
  return String(v);
}

function parseAnalysis(rows) {
  if (!Array.isArray(rows) || rows.length < 5) return null;
  const values = rows.map((r) => {
    if (r && typeof r === "object" && !Array.isArray(r)) return r.value ?? r.valor ?? r[1];
    if (Array.isArray(r)) return r[1];
    return r;
  });
  const out = {};
  ANALYSIS_KEYS.forEach((k, i) => {
    const v = values[i];
    if (v === undefined || v === null) return;
    const num = typeof v === "number" ? v : Number(String(v).replace(/[^0-9.]/g, ""));
    out[k] = ["calcio", "sal"].includes(k) ? String(v) : Number.isFinite(num) && !String(v).includes("–") ? num : String(v);
  });
  const energyText = textOf(rows[4]);
  out.energia_tipo = /digest/i.test(energyText) ? "ED" : "EM";
  return out;
}
