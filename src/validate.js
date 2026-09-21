// Validaciones de datos del cliente antes de guardarlos
// Retorna { ok: true } o { ok: false, errores: [...] }

export function validateClientData({
  nombre,
  animal_tipo,
  animal_cantidad,
  animal_edad_dias,
  animal_edad_semanas,
  animal_edad_meses,
  animal_fecha_nacimiento,
  sucursal_preferida,
  dias_alimento
}) {
  const errores = [];

  // Validar nombre si viene
  if (nombre !== undefined && nombre !== null) {
    const nombreTrimmed = String(nombre).trim();
    if (!nombreTrimmed) {
      errores.push("El nombre no puede estar vacío.");
    } else if (nombreTrimmed.split(/\s+/).length < 2) {
      errores.push(`Necesito nombre completo (ej. "Juan Pérez"), no solo "${nombreTrimmed}".`);
    }
  }

  // Validar animal_cantidad si viene
  if (animal_cantidad !== undefined && animal_cantidad !== null) {
    const cant = Number(animal_cantidad);
    if (!Number.isInteger(cant)) {
      errores.push(`La cantidad debe ser un número entero, no "${animal_cantidad}".`);
    } else if (cant <= 0) {
      errores.push(`La cantidad debe ser mayor a 0, no ${cant}.`);
    } else if (cant > 100000) {
      errores.push(`La cantidad parece demasiada (${cant}). ¿Es correcto?`);
    }
  }

  // Validar edades si vienen
  if (animal_edad_dias !== undefined && animal_edad_dias !== null) {
    const edad = Number(animal_edad_dias);
    if (!Number.isInteger(edad)) {
      errores.push(`La edad en días debe ser un número entero, no "${animal_edad_dias}".`);
    } else if (edad < 0) {
      errores.push(`La edad no puede ser negativa (${edad} días).`);
    } else if (edad > 3650) {
      // ~10 años en días
      errores.push(`La edad parece muy grande (${edad} días = ~${Math.floor(edad / 365)} años). ¿Es correcto?`);
    }
  }

  if (animal_edad_semanas !== undefined && animal_edad_semanas !== null) {
    const edad = Number(animal_edad_semanas);
    if (!Number.isInteger(edad)) {
      errores.push(`La edad en semanas debe ser un número entero, no "${animal_edad_semanas}".`);
    } else if (edad < 0) {
      errores.push(`La edad no puede ser negativa (${edad} semanas).`);
    } else if (edad > 520) {
      // ~10 años en semanas
      errores.push(`La edad parece muy grande (${edad} semanas = ~${Math.floor(edad / 52)} años). ¿Es correcto?`);
    }
  }

  if (animal_edad_meses !== undefined && animal_edad_meses !== null) {
    const edad = Number(animal_edad_meses);
    if (!Number.isInteger(edad)) {
      errores.push(`La edad en meses debe ser un número entero, no "${animal_edad_meses}".`);
    } else if (edad < 0) {
      errores.push(`La edad no puede ser negativa (${edad} meses).`);
    } else if (edad > 120) {
      // ~10 años en meses
      errores.push(`La edad parece muy grande (${edad} meses = ~${Math.floor(edad / 12)} años). ¿Es correcto?`);
    }
  }

  // Validar fecha_nacimiento si viene
  if (animal_fecha_nacimiento !== undefined && animal_fecha_nacimiento !== null) {
    if (typeof animal_fecha_nacimiento !== "string") {
      errores.push(`La fecha debe ser texto en formato AAAA-MM-DD, no "${animal_fecha_nacimiento}".`);
    } else {
      const regex = /^\d{4}-\d{2}-\d{2}$/;
      if (!regex.test(animal_fecha_nacimiento)) {
        errores.push(`La fecha debe ser AAAA-MM-DD (ej. 2026-01-15), no "${animal_fecha_nacimiento}".`);
      } else {
        const fecha = new Date(animal_fecha_nacimiento + "T00:00:00Z");
        const hoy = new Date();
        if (fecha > hoy) {
          errores.push(`La fecha de nacimiento no puede ser en el futuro: ${animal_fecha_nacimiento}.`);
        }
        // Avisar si parece muy vieja (>10 años)
        const diasDiferencia = (hoy - fecha) / (1000 * 60 * 60 * 24);
        if (diasDiferencia > 3650) {
          errores.push(`La fecha parece muy antigua (hace ~${Math.floor(diasDiferencia / 365)} años). ¿Es correcto?`);
        }
      }
    }
  }

  // Validar dias_alimento si viene
  if (dias_alimento !== undefined && dias_alimento !== null) {
    const dias = Number(dias_alimento);
    if (!Number.isInteger(dias)) {
      errores.push(`Los días deben ser un número entero, no "${dias_alimento}".`);
    } else if (dias <= 0) {
      errores.push(`Los días deben ser mayor a 0, no ${dias}.`);
    } else if (dias > 365) {
      errores.push(`¿${dias} días? Eso es más de un año. ¿Es correcto?`);
    }
  }

  // Validar sucursal si viene
  if (sucursal_preferida !== undefined && sucursal_preferida !== null) {
    const sucursalesValidas = ["Masaya", "Granada", "Veracruz", "Diriomo", "Masatepe", "Las Flores"];
    if (!sucursalesValidas.includes(sucursal_preferida)) {
      errores.push(`La sucursal debe ser una de: ${sucursalesValidas.join(", ")}, no "${sucursal_preferida}".`);
    }
  }

  // Validar coherencia: si se da tipo de animal, se recomienda edad
  if (animal_tipo && !animal_edad_dias && !animal_edad_semanas && !animal_edad_meses && !animal_fecha_nacimiento) {
    // No es error, pero sí una advertencia suave - se omite en esta versión
    // Podría ser: errores.push("Para poder recomendar alimento correctamente, también necesito la edad del animal.");
  }

  return {
    ok: errores.length === 0,
    errores: errores.length > 0 ? errores : undefined
  };
}

// Helper: formatea los errores para mostrar al usuario
export function formatValidationErrors(errores) {
  if (!errores || errores.length === 0) return "";
  return errores.map((e, i) => `${i + 1}. ${e}`).join("\n");
}
