// Test Phase 3: Validaciones robustas de datos del cliente
import { validateClientData, formatValidationErrors } from "./src/validate.js";

console.log("=== PHASE 3 TEST: Validaciones Robustas ===\n");

// Test 1: Cantidad negativa
console.log("TEST 1: Cantidad negativa (debe rechazar)");
const test1 = validateClientData({ animal_cantidad: -50 });
console.log("  Input: animal_cantidad = -50");
console.log("  Resultado:", test1.ok ? "✓ PASÓ" : "✗ RECHAZADO");
console.log("  Errores:", test1.errores);
console.log();

// Test 2: Edad en el futuro
console.log("TEST 2: Fecha de nacimiento en el futuro (debe rechazar)");
const futureDate = new Date();
futureDate.setDate(futureDate.getDate() + 10);
const futureString = futureDate.toISOString().split("T")[0];
const test2 = validateClientData({ animal_fecha_nacimiento: futureString });
console.log(`  Input: animal_fecha_nacimiento = ${futureString}`);
console.log("  Resultado:", test2.ok ? "✓ PASÓ" : "✗ RECHAZADO");
console.log("  Errores:", test2.errores);
console.log();

// Test 3: Edad válida (debe aceptar)
console.log("TEST 3: Edad válida (debe aceptar)");
const test3 = validateClientData({
  animal_tipo: "gallina_ponedora",
  animal_cantidad: 50,
  animal_edad_semanas: 20,
  animal_fecha_nacimiento: "2025-01-15"
});
console.log("  Input: tipo=gallina_ponedora, cantidad=50, edad=20 semanas, fecha=2025-01-15");
console.log("  Resultado:", test3.ok ? "✓ PASÓ" : "✗ RECHAZADO");
if (!test3.ok) console.log("  Errores:", test3.errores);
console.log();

// Test 4: Cantidad demasiada grande
console.log("TEST 4: Cantidad muy grande (advertencia)");
const test4 = validateClientData({ animal_cantidad: 999999 });
console.log("  Input: animal_cantidad = 999999");
console.log("  Resultado:", test4.ok ? "✓ PASÓ" : "✗ RECHAZADO");
console.log("  Errores:", test4.errores);
console.log();

// Test 5: Nombre incompleto
console.log("TEST 5: Nombre sin apellido (debe rechazar)");
const test5 = validateClientData({ nombre: "Juan" });
console.log("  Input: nombre = 'Juan'");
console.log("  Resultado:", test5.ok ? "✓ PASÓ" : "✗ RECHAZADO");
console.log("  Errores:", test5.errores);
console.log();

// Test 6: Nombre completo (debe aceptar)
console.log("TEST 6: Nombre completo (debe aceptar)");
const test6 = validateClientData({ nombre: "Juan Pérez López" });
console.log("  Input: nombre = 'Juan Pérez López'");
console.log("  Resultado:", test6.ok ? "✓ PASÓ" : "✗ RECHAZADO");
if (!test6.ok) console.log("  Errores:", test6.errores);
console.log();

// Test 7: Fecha en formato incorrecto
console.log("TEST 7: Fecha en formato incorrecto (debe rechazar)");
const test7 = validateClientData({ animal_fecha_nacimiento: "15/01/2025" });
console.log("  Input: animal_fecha_nacimiento = '15/01/2025'");
console.log("  Resultado:", test7.ok ? "✓ PASÓ" : "✗ RECHAZADO");
console.log("  Errores:", test7.errores);
console.log();

// Test 8: Sucursal inválida
console.log("TEST 8: Sucursal inválida (debe rechazar)");
const test8 = validateClientData({ sucursal_preferida: "Managua" });
console.log("  Input: sucursal_preferida = 'Managua'");
console.log("  Resultado:", test8.ok ? "✓ PASÓ" : "✗ RECHAZADO");
console.log("  Errores:", test8.errores);
console.log();

// Test 9: Sucursal válida
console.log("TEST 9: Sucursal válida (debe aceptar)");
const test9 = validateClientData({ sucursal_preferida: "Granada" });
console.log("  Input: sucursal_preferida = 'Granada'");
console.log("  Resultado:", test9.ok ? "✓ PASÓ" : "✗ RECHAZADO");
if (!test9.ok) console.log("  Errores:", test9.errores);
console.log();

// Test 10: Días de alimento muy grandes
console.log("TEST 10: Días de alimento > 365 (advertencia)");
const test10 = validateClientData({ dias_alimento: 400 });
console.log("  Input: dias_alimento = 400");
console.log("  Resultado:", test10.ok ? "✓ PASÓ" : "✗ RECHAZADO");
console.log("  Errores:", test10.errores);
console.log();

// Test 11: Datos múltiples válidos (debe aceptar todo)
console.log("TEST 11: Datos múltiples válidos (debe aceptar)");
const test11 = validateClientData({
  nombre: "Carlos López",
  animal_tipo: "pollo_engorde",
  animal_cantidad: 200,
  animal_edad_dias: 25,
  sucursal_preferida: "Masaya",
  dias_alimento: 30
});
console.log("  Input: nombre, tipo, cantidad, edad, sucursal, días");
console.log("  Resultado:", test11.ok ? "✓ PASÓ" : "✗ RECHAZADO");
if (!test11.ok) console.log("  Errores:", test11.errores);
console.log();

// Test 12: Formato de errores
console.log("TEST 12: Formato de errores para mostrar al usuario");
const test12 = validateClientData({
  animal_cantidad: -50,
  animal_edad_dias: 999999,
  nombre: "María"
});
if (!test12.ok) {
  console.log("  Errores encontrados:");
  console.log(formatValidationErrors(test12.errores));
}
console.log();

console.log("=== RESUMEN ===");
console.log("✓ Validaciones implementadas:");
console.log("  - animal_cantidad: positiva, número entero, no > 100k");
console.log("  - animal_edad_dias/semanas/meses: positivos, no > límite razonable");
console.log("  - animal_fecha_nacimiento: formato AAAA-MM-DD, no en el futuro");
console.log("  - nombre: mínimo 2 palabras");
console.log("  - sucursal_preferida: una de las 6 válidas");
console.log("  - dias_alimento: positivo, no > 365");
console.log();
console.log("✓ Flujo en guardar_datos_cliente:");
console.log("  1. Validar todos los datos");
console.log("  2. Si hay errores: devolver lista formateada al usuario");
console.log("  3. Si pasan validación: guardar datos y emitir evento");
console.log();
