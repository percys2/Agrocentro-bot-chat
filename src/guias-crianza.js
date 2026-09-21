// Guías de crianza con información de AgroCentro Nica
// Datos en libras y días de edad

export const GUIAS_CRIANZA = {
  pollo_engorde: {
    nombre: "Pollo de Engorde",
    duracion_total: "42-49 días hasta peso de mercado",
    peso_inicial: 0.11,
    peso_final: 6.2,
    total_alimento_42_dias: 10,
    fases: [
      {
        fase: 0,
        nombre: "Preinicio",
        dias_inicio: 1,
        dias_fin: 7,
        alimento: "Preiniciarina Plus LA",
        consumo_lb: 0.4,
        peso_esperado_min: 0.11,
        peso_esperado_max: 0.5,
      },
      {
        fase: 1,
        nombre: "Inicio",
        dias_inicio: 8,
        dias_fin: 21,
        alimento: "Iniciarina",
        consumo_lb: 2.2,
        peso_esperado_min: 0.5,
        peso_esperado_max: 1.8,
      },
      {
        fase: 2,
        nombre: "Engorde",
        dias_inicio: 22,
        dias_fin: 49,
        alimento: "Engordina",
        consumo_lb: 7.4,
        peso_esperado_min: 1.8,
        peso_esperado_max: 6.2,
      },
    ],
  },

  gallina_ponedora: {
    nombre: "Gallina Ponedora",
    duracion_levante: "17 semanas",
    edad_primera_postura: "120 días",
    peso_adulto: 4.4,
    consumo_diario_postura: "0.25 lb",
    consumo_semanal_postura: 1.75,
    fases: [
      {
        fase: 0,
        nombre: "Levante / Crianza",
        dias_inicio: 1,
        dias_fin: 119,
        alimento: "Iniciador / Recría (según edad)",
        consumo_total_lb: 13.2,
        peso_esperado_min: 0.11,
        peso_esperado_max: 4,
      },
      {
        fase: 1,
        nombre: "Postura / Producción",
        dias_inicio: 120,
        dias_fin: 500,
        alimento: "Ponedora comercial",
        consumo_diario_lb: 0.25,
        consumo_semanal_lb: 1.75,
        peso_esperado: 4.4,
      },
    ],
    nota:
      "Consumo diario: 100-120 g según línea. Un saco de 100 lb alcanza 405 raciones: a 100 gallinas dura 4 días, a 25 dura 16 días.",
  },

  cerdo_lechon: {
    nombre: "Cerdo - Fase Lechón",
    edad_inicio: "5 días de vida",
    edad_fin: "70 días de vida",
    peso_inicial: 1.1,
    peso_final_70_dias: 66,
    total_alimento: 85,
    programas: [
      {
        programa: "Óptimo",
        fases: [
          {
            nombre: "Neopigg 1",
            dias_inicio: 5,
            dias_fin: 27,
            consumo_lb: 3,
          },
          {
            nombre: "Neopigg 2",
            dias_inicio: 28,
            dias_fin: 34,
            consumo_lb: 6,
          },
          {
            nombre: "Neopigg 3",
            dias_inicio: 35,
            dias_fin: 43,
            consumo_lb: 12,
          },
          {
            nombre: "Neopigg 4",
            dias_inicio: 44,
            dias_fin: 70,
            consumo_lb: 64,
          },
        ],
      },
      {
        programa: "Plus",
        fases: [
          {
            nombre: "Neopigg 1",
            dias_inicio: 5,
            dias_fin: 30,
            consumo_lb: 5,
          },
          {
            nombre: "Neopigg 2",
            dias_inicio: 31,
            dias_fin: 39,
            consumo_lb: 10,
          },
          {
            nombre: "Neopigg 3",
            dias_inicio: 40,
            dias_fin: 48,
            consumo_lb: 15,
          },
          {
            nombre: "Neopigg 4",
            dias_inicio: 49,
            dias_fin: 70,
            consumo_lb: 55,
          },
        ],
      },
    ],
  },

  cerdo_engorde: {
    nombre: "Cerdo - Fase Engorde",
    edad_inicio: "71 días",
    edad_fin: "154 días",
    total_alimento: 442,
    programas: [
      {
        nombre: "Línea Estándar",
        peso_final: 224,
        fases: [
          {
            nombre: "Desarrollina",
            dias_inicio: 71,
            dias_fin: 119,
            consumo_lb: 228,
          },
          {
            nombre: "Jamonina",
            dias_inicio: 120,
            dias_fin: 154,
            consumo_lb: 214,
          },
        ],
      },
      {
        nombre: "Línea Pig-Nova",
        peso_final: 245,
        fases: [
          {
            nombre: "Pig-Nova 5",
            dias_inicio: 71,
            dias_fin: 91,
            consumo_lb: 90,
          },
          {
            nombre: "Pig-Nova 6",
            dias_inicio: 92,
            dias_fin: 119,
            consumo_lb: 130,
          },
          {
            nombre: "Pur-A-Lean",
            dias_inicio: 120,
            dias_fin: 154,
            consumo_lb: 222,
          },
        ],
      },
      {
        nombre: "Estándar + Pur-A-Lean",
        peso_final: 232,
        fases: [
          {
            nombre: "Desarrollina",
            dias_inicio: 71,
            dias_fin: 98,
            consumo_lb: 120,
          },
          {
            nombre: "Jamonina",
            dias_inicio: 99,
            dias_fin: 126,
            consumo_lb: 150,
          },
          {
            nombre: "Pur-A-Lean",
            dias_inicio: 127,
            dias_fin: 154,
            consumo_lb: 172,
          },
        ],
      },
    ],
  },
};

// Función para obtener guía por tipo de animal
export function obtenerGuia(tipo_animal) {
  const tipos = {
    pollo: GUIAS_CRIANZA.pollo_engorde,
    "pollo engorde": GUIAS_CRIANZA.pollo_engorde,
    pollo_engorde: GUIAS_CRIANZA.pollo_engorde,
    gallina: GUIAS_CRIANZA.gallina_ponedora,
    "gallina ponedora": GUIAS_CRIANZA.gallina_ponedora,
    gallina_ponedora: GUIAS_CRIANZA.gallina_ponedora,
    ponedora: GUIAS_CRIANZA.gallina_ponedora,
    cerdo: GUIAS_CRIANZA.cerdo_lechon,
    lechon: GUIAS_CRIANZA.cerdo_lechon,
    cerdo_lechon: GUIAS_CRIANZA.cerdo_lechon,
    cerdo_engorde: GUIAS_CRIANZA.cerdo_engorde,
  };

  const tipo_normalizado = String(tipo_animal || "")
    .toLowerCase()
    .trim();
  return tipos[tipo_normalizado] || null;
}

// Función para calcular qué alimento toca en una edad específica
export function obtenerAlimentoPorEdad(tipo_animal, edad_dias) {
  const guia = obtenerGuia(tipo_animal);
  if (!guia) return null;

  const edad = Number(edad_dias);
  if (!Number.isFinite(edad)) return null;

  // Manejar estructura con programas (cerdo_lechon, cerdo_engorde)
  if (guia.programas && !guia.fases) {
    // Buscar en el primer programa (o el primero que coincida)
    for (const programa of guia.programas) {
      if (programa.fases) {
        for (const fase of programa.fases) {
          if (edad >= fase.dias_inicio && edad <= fase.dias_fin) {
            return {
              fase: fase.nombre,
              programa: programa.programa || programa.nombre,
              alimento: fase.nombre,
              dias_inicio: fase.dias_inicio,
              dias_fin: fase.dias_fin,
              edad_actual: edad,
            };
          }
        }
      }
    }
    return null;
  }

  // Manejar estructura con fases directas (pollo_engorde, gallina_ponedora)
  if (guia.fases) {
    for (const fase of guia.fases) {
      if (edad >= fase.dias_inicio && edad <= fase.dias_fin) {
        return {
          fase: fase.nombre,
          alimento: fase.alimento,
          dias_inicio: fase.dias_inicio,
          dias_fin: fase.dias_fin,
          edad_actual: edad,
        };
      }
    }
  }

  return null;
}

// Función para calcular consumo total por cantidad de animales
export function calcularAlimentoTotal(tipo_animal, cantidad_animales, edad_dias) {
  const alimento_info = obtenerAlimentoPorEdad(tipo_animal, edad_dias);
  if (!alimento_info) return null;

  const guia = obtenerGuia(tipo_animal);
  if (!guia) return null;

  let fase_actual = null;

  // Buscar fase en estructura de programas (cerdo_lechon, cerdo_engorde)
  if (guia.programas && !guia.fases) {
    for (const programa of guia.programas) {
      if (programa.fases) {
        fase_actual = programa.fases.find(
          (f) => f.dias_inicio <= edad_dias && edad_dias <= f.dias_fin
        );
        if (fase_actual) break;
      }
    }
  }
  // Buscar fase en estructura de fases directas (pollo_engorde, gallina_ponedora)
  else if (guia.fases) {
    fase_actual = guia.fases.find(
      (f) => f.dias_inicio <= edad_dias && edad_dias <= f.dias_fin
    );
  }

  if (!fase_actual) return null;

  let consumo_por_animal = 0;

  // Manejar diferentes tipos de datos de consumo
  if (fase_actual.consumo_lb) {
    // Para pollo: consumo_lb es el total de la fase
    consumo_por_animal = fase_actual.consumo_lb;
  } else if (fase_actual.consumo_diario_lb) {
    // Para gallina en postura: consumo_diario_lb
    consumo_por_animal = fase_actual.consumo_diario_lb;
  } else if (fase_actual.consumo_semanal_lb) {
    // Para gallina: consumo_semanal_lb (convertir a diario)
    consumo_por_animal = fase_actual.consumo_semanal_lb / 7;
  }

  if (!consumo_por_animal) return null;

  const total = consumo_por_animal * cantidad_animales;
  const sacos_100_lb = Math.ceil(total / 100);

  return {
    fase: fase_actual.nombre,
    alimento: fase_actual.nombre,
    consumo_por_animal_lb: consumo_por_animal,
    cantidad_animales,
    total_lb: total,
    sacos_de_100_lb: sacos_100_lb,
  };
}
