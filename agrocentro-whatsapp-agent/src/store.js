// Persistencia mínima en archivos JSON (sesiones, pedidos, mensajes ya procesados).
// Suficiente para una tienda; si el volumen crece, cambiá esta clase por una base de datos
// manteniendo la misma interfaz (get / set / update / all).
import fs from "node:fs";
import path from "node:path";

export class JsonCollection {
  constructor(file, { initial = {} } = {}) {
    this.file = file;
    this.data = initial;
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.file)) {
        this.data = JSON.parse(fs.readFileSync(this.file, "utf8"));
      }
    } catch (err) {
      console.error(`No se pudo leer ${this.file}: ${err.message}. Se empieza vacío.`);
    }
  }

  save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    fs.renameSync(tmp, this.file);
  }

  get(key) {
    return this.data[key];
  }

  set(key, value) {
    this.data[key] = value;
    this.save();
    return value;
  }

  update(key, fn) {
    const next = fn(this.data[key]);
    return this.set(key, next);
  }

  delete(key) {
    delete this.data[key];
    this.save();
  }

  all() {
    return this.data;
  }
}

export function createStores(runtimeDir) {
  return {
    sessions: new JsonCollection(path.join(runtimeDir, "sessions.json")),
    orders: new JsonCollection(path.join(runtimeDir, "orders.json"), { initial: { seq: 0, items: {} } }),
    processed: new JsonCollection(path.join(runtimeDir, "processed.json"), { initial: { ids: [] } }),
  };
}

// Recordá los últimos N ids de mensajes para no responder dos veces si Meta reenvía el webhook.
export function rememberProcessed(processed, id, limit = 2000) {
  const ids = processed.get("ids") || [];
  if (ids.includes(id)) return false;
  ids.push(id);
  if (ids.length > limit) ids.splice(0, ids.length - limit);
  processed.set("ids", ids);
  return true;
}
