// Recomendaciones de alimentación y calculadoras. Todo sale de data/programs.json (la Guía de uso del sitio).
// Es código determinista: el modelo solo redacta lo que estas funciones devuelven.

const SACK_LB = 100;
const SACK_KG = 45.4;

function ceilSacks(lb, sackLb = SACK_LB) {
  return Math.ceil(lb / sackLb - 1e-9);
}

function round(n, d = 1) {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function ageDays({ edad_dias, edad_semanas, edad_meses, fecha_nacimiento }) {
  if (Number.isFinite(edad_dias)) return Math.max(1, Math.round(edad_dias));
  if (Number.isFinite(edad_semanas)) return Math.max(1, Math.round(edad_semanas * 7));
  if (Number.isFinite(edad_meses)) return Math.max(1, Math.round(edad_meses * 30.4));
  if (fecha_nacimiento) {
    const born = new Date(fecha_nacimiento + "T12:00:00");
    if (!Number.isNaN(born.getTime())) {
      const diff = Math.floor((Date.now() - born.getTime()) / 86400000) + 1;
      return Math.max(1, diff);
    }
  }
  return null;
}

function stageCalendar(stages, fecha_nacimiento) {
  if (!fecha_nacimiento) return undefined;
  return stages.map((s) => ({ producto: s.producto, desde: addDays(fecha_nacimiento, s.dia_inicio - 1), hasta: addDays(fecha_nacimiento, s.dia_fin - 1) }));
}

export function recommend(programs, input = {}) {
  const especie = String(input.especie || "").toLowerCase();
  const n = Number.isFinite(Number(input.cantidad)) && Number(input.cantidad) > 0 ? Number(input.cantidad) : null;
  switch (especie) {
    case "pollo_engorde":
      return broiler(programs, input, n);
    case "gallina_ponedora":
      return layers(programs, input, n);
    case "cerdo":
      return pigs(programs, input, n);
    case "cerda_reproductora":
      return sows(programs, input);
    case "caballo":
      return horses(programs, input);
    case "pollo_criollo":
    case "gallo":
    case "conejo":
      return simpleSpecies(programs, especie);
    case "perro":
    case "gato":
      return pets(programs, especie, input);
    case "ganado":
    case "oveja":
    case "cabra":
      return { especie, resultado: programs.otras_especies.ganado_ovejas_cabras.nota, pasar_a_asesor: true };
    default:
      return { error: `Especie no reconocida: "${input.especie}". Usá pollo_engorde, gallina_ponedora, pollo_criollo, gallo, cerdo, cerda_reproductora, caballo, perro, gato, conejo o ganado.` };
  }
}

function broiler(programs, input, n) {
  const P = programs.pollo_engorde;
  const dia = ageDays(input);
  const stages = P.etapas;
  const current = dia ? stages.find((s) => dia >= s.dia_inicio && dia <= s.dia_fin) || (dia > 42 ? stages[stages.length - 1] : null) : null;
  const out = {
    especie: "pollo de engorde",
    programa: stages.map((s) => `${s.producto}: días ${s.dia_inicio}–${s.dia_fin}${s.dia_fin === 42 ? " (hasta la venta)" : ""} · ${s.lb_por_pollo} lb por pollo`),
    total_lb_por_pollo: P.total_lb_por_pollo,
    nota: P.descripcion,
  };
  if (dia) {
    out.edad_dias = dia;
    out.alimento_actual = current ? `${current.producto} (producto id ${current.producto_id})` : "Sin etapa definida";
    const next = stages.find((s) => s.dia_inicio > dia);
    out.proximo_cambio = next ? `Pasar a ${next.producto} el día ${next.dia_inicio}${input.fecha_nacimiento ? ` (${addDays(input.fecha_nacimiento, next.dia_inicio - 1)})` : ""}, con transición de 3 a 5 días` : "Ya está en la última etapa (Engordina hasta la venta)";
  }
  if (n) {
    const porEtapa = stages.map((s) => {
      const lb = round(s.lb_por_pollo * n, 1);
      return { producto: s.producto, dias: `${s.dia_inicio}–${s.dia_fin}`, lb_total: lb, sacos_100lb: ceilSacks(lb) };
    });
    const totalLb = round(P.total_lb_por_pollo * n, 1);
    out.calculo = {
      pollos: n,
      por_etapa: porEtapa,
      total_lb: totalLb,
      total_sacos_100lb: ceilSacks(totalLb),
      aclaracion: "Base 10 lb por pollo a 42 días; el consumo real puede ser mayor según clima, genética y manejo. Sacos redondeados hacia arriba por etapa.",
    };
    out.calendario = stageCalendar(stages, input.fecha_nacimiento);
  }
  out.manejo = P.manejo;
  return out;
}

function layers(programs, input, n) {
  const L = programs.gallina_ponedora;
  const semanas = Number.isFinite(input.edad_semanas) ? input.edad_semanas : Number.isFinite(input.edad_dias) ? input.edad_dias / 7 : Number.isFinite(input.edad_meses) ? input.edad_meses * 4.345 : null;
  const criolla = /criolla|criollo/i.test(String(input.detalle || input.linea || ""));
  const sistema = /granja/i.test(String(input.detalle || input.sistema || "")) ? "granja" : /patio/i.test(String(input.detalle || input.sistema || "")) ? "patio" : null;
  const out = { especie: "gallina ponedora", productos: L.productos.map((p) => `${p.producto} (id ${p.producto_id}): ${p.uso}`), curva: L.descripcion };
  if (semanas !== null) {
    out.edad_semanas = round(semanas, 1);
    if (semanas < 18) {
      out.alimento_actual = "Etapa de levante (0–17 semanas): consume unos 6 kg en total por gallina en esa etapa. El alimento de levante se coordina con un asesor; desde las 18 semanas pasa a Posturina.";
      out.pasar_a_asesor = true;
    } else if (criolla) {
      out.alimento_actual = "Ponedora Criollita (id 11) durante todo el ciclo de postura";
    } else if (sistema === "granja") {
      out.alimento_actual = semanas <= 59 ? "Posturina HP (id 39): de las 19–21 semanas hasta la semana 59" : "Pasó la semana 59: Posturina HP cubre hasta la 59; consultar con un asesor cómo seguir";
    } else if (sistema === "patio") {
      out.alimento_actual = "Posturina Fase 1 (id 38): desde las 18 semanas y todo el ciclo";
    } else {
      out.alimento_actual = "Posturina Fase 1 (id 38) si son gallinas de patio, todo el ciclo; Posturina HP (id 39) si es granja, de las 19–21 semanas a la 59. Preguntar si es patio o granja.";
    }
  }
  const g = Number.isFinite(Number(input.consumo_g_dia)) && Number(input.consumo_g_dia) > 0 ? Number(input.consumo_g_dia) : L.consumo_g_dia_default;
  if (n) {
    const dias = Number.isFinite(Number(input.dias)) && Number(input.dias) > 0 ? Number(input.dias) : 30;
    const kgTotal = (n * g * dias) / 1000;
    const kgDia = (n * g) / 1000;
    out.calculo = {
      gallinas: n,
      consumo_g_por_gallina_dia: g,
      dias,
      kg_por_dia: round(kgDia, 2),
      lb_por_dia: round(kgDia * 2.2046, 1),
      kg_total: round(kgTotal, 1),
      sacos_100lb: Math.ceil(kgTotal / SACK_KG - 1e-9),
      dias_por_saco: round(SACK_KG / kgDia, 1),
      aclaracion: `Con ${g} g por gallina al día (rango normal 100–120 g según la línea). Un saco de 100 lb (45.4 kg) rinde ${Math.floor((SACK_KG * 1000) / g)} raciones diarias.`,
    };
  }
  out.manejo = L.manejo;
  return out;
}

function pigs(programs, input, n) {
  const C = programs.cerdo;
  const programa = /plus/i.test(String(input.programa_cerdos || "")) ? "plus" : "optimo";
  const lineaKey = /nova/i.test(String(input.linea_cerdos || "")) ? "pignova" : /lean/i.test(String(input.linea_cerdos || "")) ? "estandar_lean" : "estandar";
  const pre = C.neopigg[programa];
  const linea = C.lineas[lineaKey];
  const stages = [...pre, ...linea.etapas];
  const dia = ageDays(input);
  const out = {
    especie: "cerdo de engorde",
    programa_neopigg: `${programa === "plus" ? "Plus" : "Óptimo"} (hasta el día 70)`,
    linea: `${linea.nombre} (días 71–154, cerdo de ${linea.peso_final_lb} lb)`,
    etapas: stages.map((s) => `${s.producto} (id ${s.producto_id}): días ${s.dia_inicio}–${s.dia_fin} · ${s.lb_por_cerdo} lb por cerdo`),
    lineas_disponibles: Object.values(C.lineas).map((l) => `${l.nombre}: ${l.etapas.map((e) => `${e.producto} ${e.dia_inicio}–${e.dia_fin}`).join(", ")} → ${l.peso_final_lb} lb`),
    nota: C.descripcion,
  };
  if (dia) {
    out.edad_dias = dia;
    if (dia < 5) out.alimento_actual = "Antes del día 5 el lechón solo mama; desde el día 5 empieza a probar Neopigg 1 junto a la cerda";
    else if (dia > 154) out.alimento_actual = "Pasó los 154 días (edad típica de venta). Si sigue en engorde, continuar con el alimento de finalización de su línea y consultar con un asesor";
    else {
      const current = stages.find((s) => dia >= s.dia_inicio && dia <= s.dia_fin);
      out.alimento_actual = current ? `${current.producto} (id ${current.producto_id}), etapa días ${current.dia_inicio}–${current.dia_fin}` : "Sin etapa definida";
      const next = stages.find((s) => s.dia_inicio > dia);
      out.proximo_cambio = next ? `Pasar a ${next.producto} el día ${next.dia_inicio}${input.fecha_nacimiento ? ` (${addDays(input.fecha_nacimiento, next.dia_inicio - 1)})` : ""}, con transición de 3 a 5 días` : "Última etapa hasta la venta";
    }
  }
  if (n) {
    const porEtapa = stages.map((s) => {
      const lb = round(s.lb_por_cerdo * n, 1);
      const sack = C.sacos[String(s.producto_id)] || C.sacos.default;
      return { producto: s.producto, dias: `${s.dia_inicio}–${s.dia_fin}`, lb_total: lb, saco: `${sack.lb} lb (${sack.kg} kg)`, sacos: ceilSacks(lb, sack.lb) };
    });
    const totalLb = round(porEtapa.reduce((a, e) => a + e.lb_total, 0), 1);
    out.calculo = { cerdos: n, por_etapa: porEtapa, total_lb: totalLb, aclaracion: "Cantidades del programa por cerdo; el desperdicio va aparte. Neopigg 1 viene en saco de 44 lb y Neopigg 2 y 3 en saco de 55.1 lb; el resto en saco de 100 lb." };
    out.calendario = stageCalendar(stages, input.fecha_nacimiento);
  }
  return out;
}

function sows(programs, input) {
  const etapa = /lact/i.test(String(input.etapa_cerda || "")) ? "lactancia" : /gest/i.test(String(input.etapa_cerda || "")) ? "gestacion" : null;
  const list = programs.cerdo.cerdas;
  const out = { especie: "cerda reproductora", productos: list.map((p) => `${p.producto} (id ${p.producto_id}) en ${p.etapa}: ${p.uso}`), nota: "Gestación y lactancia llevan alimentos distintos." };
  if (etapa) {
    const p = list.find((x) => x.etapa === etapa);
    out.alimento_actual = `${p.producto} (id ${p.producto_id}): ${p.uso}`;
  } else {
    out.pregunta = "¿La cerda está gestante o lactando?";
  }
  return out;
}

function horses(programs, input) {
  const H = programs.caballo;
  const uso = String(input.detalle || input.uso || "").toLowerCase();
  const out = { especie: "caballo", productos: H.productos.map((p) => `${p.producto} (id ${p.producto_id}): ${p.uso}. Ración: ${p.racion}`), manejo: H.manejo };
  if (/deport|carrera|intens|trabajo fuerte|entren/.test(uso)) out.sugerencia = "Omalina 200 (id 7)";
  else if (/yegua|pre[ñn]ad|gest|lact|potro|potranca/.test(uso)) out.sugerencia = "Omalina 300 (id 8)";
  else if (/paseo|livian|ligero|descanso|recre/.test(uso)) out.sugerencia = "Omalina 100 (id 6)";
  else out.pregunta = "¿El caballo es de paseo o trabajo liviano, de deporte o trabajo intenso, o es yegua gestante/lactante o potro? ¿Cuánto pesa aproximadamente?";
  return out;
}

function simpleSpecies(programs, especie) {
  const map = { pollo_criollo: programs.otras_especies.pollo_criollo, gallo: programs.otras_especies.gallo, conejo: programs.otras_especies.conejo };
  const p = map[especie];
  return { especie: especie.replace("_", " "), alimento_actual: `${p.producto} (id ${p.producto_id}): ${p.uso}` };
}

function pets(programs, especie, input) {
  const O = programs.otras_especies[especie];
  const meses = Number.isFinite(Number(input.edad_meses)) ? Number(input.edad_meses) : Number.isFinite(input.edad_semanas) ? input.edad_semanas / 4.33 : null;
  const out = { especie, nota: O.nota };
  if (especie === "perro") {
    if (meses !== null) {
      const cachorro = meses < 18;
      out.etapa = cachorro ? "cachorro (menor de 18 meses)" : "adulto (18 meses o más)";
      out.productos_ids = cachorro ? O.cachorro : O.adulto;
    } else {
      out.pregunta = "¿Es cachorro (menos de 18 meses) o adulto?";
      out.productos_ids = { cachorro: O.cachorro, adulto: O.adulto };
    }
  } else {
    out.productos_ids = O.adulto;
    if (meses !== null && meses < 12) {
      out.etapa = "gatito (menor de 12 meses)";
      out.pasar_a_asesor = true;
      out.nota = "Los productos del catálogo son para gatos adultos; para gatitos consultar con un asesor.";
    } else out.etapa = "adulto";
  }
  return out;
}
