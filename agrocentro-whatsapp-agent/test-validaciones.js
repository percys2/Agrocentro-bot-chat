// Test de validaciones de crear_pedido SIN llamar a Claude
import { createToolExecutor } from "./src/tools.js";

// Mock del catálogo mínimo
const mockCatalog = {
  store: { telefono_humano: "8240-3490", horario: "8am-5pm" },
  search: () => [{ id: 1, nombre: "Engordina", precio: "C$450" }]
};

// Mock de órdenes
const mockOrders = {
  create: (data) => ({ ok: true, order: { numero: 123, estado: 1 } }),
  formatForCustomer: () => "Pedido #123"
};

// Mock de cliente
const mockCustomer = { phone: "50511223344", name: "Cliente Test" };

// Crear ejecutor
const execute = createToolExecutor({
  catalog: mockCatalog,
  orders: mockOrders,
  customer: mockCustomer,
  events: [],
  zona: "Diriomo"
});

console.log("🧪 TESTEANDO VALIDACIONES DE crear_pedido\n");

// TEST 1: Nombre incompleto (solo 1 palabra)
console.log("❌ TEST 1: Nombre incompleto ('Juan')");
const test1 = await execute("crear_pedido", {
  nombre_cliente: "Juan",
  sucursal: "Diriomo",
  items: [{ producto_id: 1, cantidad: 2, presentacion: "Saco 100 lb" }]
});
console.log("Resultado:", test1);
console.log("");

// TEST 2: Nombre válido (2+ palabras)
console.log("✅ TEST 2: Nombre completo ('Juan Pérez')");
const test2 = await execute("crear_pedido", {
  nombre_cliente: "Juan Pérez",
  sucursal: "Diriomo",
  items: [{ producto_id: 1, cantidad: 2, presentacion: "Saco 100 lb" }]
});
console.log("Resultado:", test2);
console.log("");

// TEST 3: Sucursal inválida
console.log("❌ TEST 3: Sucursal inválida ('Chicago')");
const test3 = await execute("crear_pedido", {
  nombre_cliente: "Juan Pérez",
  sucursal: "Chicago",
  items: [{ producto_id: 1, cantidad: 2, presentacion: "Saco 100 lb" }]
});
console.log("Resultado:", test3);
console.log("");

// TEST 4: Todas las sucursales válidas
console.log("✅ TEST 4: Probando las 6 sucursales válidas");
const sucursales = ["Masaya", "Granada", "Veracruz", "Diriomo", "Masatepe", "Las Flores"];
for (const sucursal of sucursales) {
  const test = await execute("crear_pedido", {
    nombre_cliente: "Juan Pérez",
    sucursal: sucursal,
    items: [{ producto_id: 1, cantidad: 2, presentacion: "Saco 100 lb" }]
  });
  console.log(`  ${sucursal}: ${test.ok ? "✅ OK" : "❌ ERROR"}`);
}
console.log("");

// TEST 5: Items vacío
console.log("❌ TEST 5: Pedido sin productos");
const test5 = await execute("crear_pedido", {
  nombre_cliente: "Juan Pérez",
  sucursal: "Diriomo",
  items: []
});
console.log("Resultado:", test5);
console.log("");

// TEST 6: Cantidad inválida (0)
console.log("❌ TEST 6: Producto con cantidad 0");
const test6 = await execute("crear_pedido", {
  nombre_cliente: "Juan Pérez",
  sucursal: "Diriomo",
  items: [{ producto_id: 1, cantidad: 0, presentacion: "Saco 100 lb" }]
});
console.log("Resultado:", test6);
console.log("");

// TEST 7: Presentación vacía
console.log("❌ TEST 7: Producto sin presentación");
const test7 = await execute("crear_pedido", {
  nombre_cliente: "Juan Pérez",
  sucursal: "Diriomo",
  items: [{ producto_id: 1, cantidad: 2, presentacion: "" }]
});
console.log("Resultado:", test7);
console.log("");

console.log("✅ TESTS COMPLETADOS");
