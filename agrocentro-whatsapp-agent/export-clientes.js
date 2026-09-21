#!/usr/bin/env node
/**
 * Exporta datos de clientes desde sessions.json a un archivo CSV (compatible con Excel)
 * Uso: node export-clientes.js
 * Genera: clientes-[fecha].csv
 */

import fs from "node:fs";
import path from "node:path";

const DATA_DIR = process.env.DATA_DIR || "./data";
const SESSIONS_FILE = path.join(DATA_DIR, "sessions.json");

function loadSessions() {
  if (!fs.existsSync(SESSIONS_FILE)) {
    console.error(`❌ Archivo no encontrado: ${SESSIONS_FILE}`);
    process.exit(1);
  }

  try {
    const data = JSON.parse(fs.readFileSync(SESSIONS_FILE, "utf8"));
    return data;
  } catch (err) {
    console.error(`❌ Error al leer sesiones: ${err.message}`);
    process.exit(1);
  }
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

function prepareData(sessions) {
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

  for (const [phone, session] of Object.entries(sessions)) {
    const cd = session.clientData || {};
    const lastUpdate = session.updatedAt ? formatDate(session.updatedAt) : "";
    const msgCount = session.messages ? session.messages.length : 0;

    // Si tiene datos de animales, una fila por animal
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
        cd.sucursal_preferida || session.zona || "",
        cd.dias_alimento || "",
        lastUpdate,
        msgCount,
      ]);
    } else {
      // Si no tiene animales, igual aparece (para contactos)
      rows.push([
        phone,
        session.name || cd.nombre || "",
        "",
        "",
        "",
        "",
        cd.sucursal_preferida || session.zona || "",
        "",
        lastUpdate,
        msgCount,
      ]);
    }
  }

  return rows;
}

function exportToCSV(rows) {
  const csv = rows
    .map((row) =>
      row
        .map((cell) => {
          const str = String(cell || "");
          // Escapar comillas y envolver si hay comas o comillas
          if (str.includes(",") || str.includes('"') || str.includes("\n")) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        })
        .join(",")
    )
    .join("\n");

  const filename = `clientes-${new Date().toISOString().split("T")[0]}.csv`;
  fs.writeFileSync(filename, csv, "utf8");
  console.log(`✅ Archivo creado: ${filename}`);
  console.log(`📊 Total de clientes: ${rows.length - 1}`);
  console.log(`💡 Abrilo en Excel, Google Sheets o cualquier programa de hojas de cálculo`);
}

// Main
const sessions = loadSessions();
const data = prepareData(sessions);

if (data.length === 1) {
  console.log("⚠️  No hay clientes registrados aún.");
} else {
  exportToCSV(data);
}
