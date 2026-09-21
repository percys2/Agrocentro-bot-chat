// Herramientas que el modelo puede llamar. Cada una es una función determinista sobre los datos de la tienda.
import { recommend } from "./feeding.js";
import { ORDER_STATUS } from "./orders.js";
import { validateClientData, formatValidationErrors } from "./validate.js";
import { GUIAS_CRIANZA, obtenerAlimentoPorEdad, calcularAlimentoTotal } from "./guias-crianza.js";

export const TOOL_DEFINITIONS = [
  {
    name: "buscar_productos",
    description:
      "Busca productos del catálogo de AgroCentro Nica por nombre, uso o especie. Devuelve id, nombre, tipo, especie, etapa, presentaciones y precio (o 'por confirmar'). Usala antes de afirmar que un producto existe o de dar un precio.",
    input_schema: {
      type: "object",
      properties: {
        consulta: { type: "string", description: "Palabras clave, ej. 'engordina', 'alimento para lechones', 'desparasitante perros', 'bomba fumigadora'" },
        tipo: { type: "string", enum: ["alimentos", "medicinas", "herramientas"], description: "Filtrar por tipo (opcional)" },
        especie: { type: "string", enum: ["aves", "cerdos", "equinos", "perros", "gatos", "conejos", "otros"], description: "Filtrar por especie (opcional)" },
      },
      required: ["consulta"],
    },
  },
  {
    name: "ficha_producto",
    description: "Devuelve la ficha completa de un producto por id: uso, etapa y periodo, forma, presentación, análisis garantizado, precio y notas. Para productos veterinarios incluye el aviso de que la dosis la indica un veterinario.",
    input_schema: {
      type: "object",
      properties: { id: { type: "integer", description: "Id del producto (de buscar_productos o del índice del catálogo)" } },
      required: ["id"],
    },
  },
  {
    name: "recomendar_alimento",
    description:
      "Indica qué alimento corresponde según especie y edad, el próximo cambio de etapa, y calcula cuánto alimento y cuántos sacos se necesitan si se da la cantidad de animales. Usa los programas oficiales de la Guía de uso. Siempre usala para responder '¿qué le doy?', '¿cuánto come?' o '¿cuántos sacos necesito?'.",
    input_schema: {
      type: "object",
      properties: {
        especie: { type: "string", enum: ["pollo_engorde", "gallina_ponedora", "pollo_criollo", "gallo", "cerdo", "cerda_reproductora", "caballo", "perro", "gato", "conejo", "ganado"], description: "Tipo de animal" },
        edad_dias: { type: "number", description: "Edad en días (pollos y cerdos)" },
        edad_semanas: { type: "number", description: "Edad en semanas (gallinas ponedoras)" },
        edad_meses: { type: "number", description: "Edad en meses (perros y gatos)" },
        fecha_nacimiento: { type: "string", description: "Fecha de nacimiento o llegada de los pollitos/lechones, formato AAAA-MM-DD. Permite dar fechas de cambio de alimento." },
        cantidad: { type: "integer", description: "Cantidad de animales, para calcular sacos" },
        dias: { type: "integer", description: "Días a cubrir (gallinas ponedoras). Por defecto 30" },
        consumo_g_dia: { type: "number", description: "Consumo por gallina al día en gramos si el cliente lo conoce (por defecto 112)" },
        programa_cerdos: { type: "string", enum: ["optimo", "plus"], description: "Programa NeoPigg (por defecto óptimo)" },
        linea_cerdos: { type: "string", enum: ["estandar", "estandar_lean", "pignova"], description: "Línea de engorde desde el día 71 (por defecto estándar)" },
        etapa_cerda: { type: "string", enum: ["gestacion", "lactancia"], description: "Etapa de la cerda reproductora" },
        detalle: { type: "string", description: "Texto libre útil: 'patio' o 'granja' para gallinas, 'criolla', uso del caballo (paseo, deporte, yegua preñada), etc." },
      },
      required: ["especie"],
    },
  },
  {
    name: "crear_pedido",
    description:
      "Registra un pedido para retiro en sucursal y lo deja PENDIENTE hasta que un asesor lo confirme. Llamala solo cuando ya tengás nombre del cliente, sucursal y la lista de productos con cantidad y presentación, y el cliente haya dicho que sí al resumen. No promete existencias ni precios no confirmados.",
    input_schema: {
      type: "object",
      properties: {
        nombre_cliente: { type: "string", description: "Nombre con el que retira" },
        sucursal: { type: "string", enum: ["Masaya", "Granada", "Veracruz", "Diriomo", "Masatepe", "Las Flores"], description: "Sucursal de retiro" },
        items: {
          type: "array",
          description: "Productos del pedido",
          items: {
            type: "object",
            properties: {
              producto_id: { type: "integer" },
              cantidad: { type: "number", description: "Cantidad de unidades de la presentación (ej. 3 sacos, 10 libras)" },
              presentacion: { type: "string", description: "Presentación tal como aparece en la ficha o lista de precios, ej. 'Saco 100 lb', 'Libra', 'Unidad'" },
            },
            required: ["producto_id", "cantidad"],
          },
        },
        notas: { type: "string", description: "Indicaciones del cliente (hora de retiro, referencia, etc.)" },
      },
      required: ["nombre_cliente", "sucursal", "items"],
    },
  },
  {
    name: "consultar_pedido",
    description: "Consulta el estado de los pedidos del cliente que está escribiendo (por número o los más recientes).",
    input_schema: {
      type: "object",
      properties: { numero: { type: "integer", description: "Número de pedido (opcional; sin número devuelve los últimos del cliente)" } },
    },
  },
  {
    name: "pasar_a_humano",
    description:
      "Avisa a un asesor de la tienda para que atienda la conversación. Usala cuando el cliente pide hablar con una persona, cuando pregunta algo fuera del catálogo o de la guía (envíos, crédito, reclamos, un animal enfermo, precios no cargados), o cuando no estés seguro. Después de llamarla, decile al cliente que un asesor le escribirá y dale el número 8240 3490 por si prefiere escribir directo.",
    input_schema: {
      type: "object",
      properties: {
        motivo: { type: "string", description: "Por qué se pasa: 'pide humano', 'precio sin cargar', 'animal enfermo', 'reclamo', 'envío a domicilio', etc." },
        resumen: { type: "string", description: "Resumen de una o dos líneas de lo que el cliente necesita, para el asesor" },
      },
      required: ["motivo", "resumen"],
    },
  },
  {
    name: "guardar_datos_cliente",
    description:
      "Guarda datos del cliente en la sesión: nombre, animales que tiene (tipo, cantidad, edad, fecha de nacimiento), sucursal preferida. Usala después de cada pieza de información que el cliente da. Ej: cliente dice 'tengo 50 ponedoras' → llamá esta herramienta con tipo='gallina_ponedora', cantidad=50.",
    input_schema: {
      type: "object",
      properties: {
        nombre: { type: "string", description: "Nombre del cliente (si lo dió)" },
        animal_tipo: { type: "string", enum: ["pollo_engorde", "gallina_ponedora", "pollo_criollo", "cerdo", "cerda_reproductora", "caballo", "perro", "gato", "conejo", "ganado"], description: "Tipo de animal que el cliente tiene (si lo mencionó)" },
        animal_cantidad: { type: "integer", description: "Cantidad de ese animal (si lo dió)" },
        animal_edad_dias: { type: "integer", description: "Edad en días del animal (si es pollo o lechon)" },
        animal_edad_meses: { type: "integer", description: "Edad en meses (perros, gatos)" },
        animal_fecha_nacimiento: { type: "string", description: "Fecha de nacimiento AAAA-MM-DD (si el cliente la sabe)" },
        sucursal_preferida: { type: "string", enum: ["Masaya", "Granada", "Veracruz", "Diriomo", "Masatepe", "Las Flores"], description: "Sucursal donde prefiere retirar" },
        dias_alimento: { type: "integer", description: "Cuántos días de alimento quiere (ej 30, 15)" },
      },
    },
  },
  {
    name: "guia_crianza",
    description:
      "Devuelve la guía completa de crianza para una especie: qué alimento en cada fase, consumo esperado, pesos, y cronograma. Usala para mostrar toda la cronología de crianza (ej 'show me the phases for chickens') o para calcular cuánto alimento necesita para N animales de una edad específica.",
    input_schema: {
      type: "object",
      properties: {
        especie: {
          type: "string",
          enum: ["pollo_engorde", "gallina_ponedora", "cerdo_lechon", "cerdo_engorde"],
          description: "Tipo de animal",
        },
        edad_dias: { type: "integer", description: "Edad en días (opcional; si se da devuelve qué fase toca y qué alimento)" },
        cantidad_animales: { type: "integer", description: "Cantidad de animales (opcional; calcula total de alimento y sacos)" },
      },
      required: ["especie"],
    },
  },
];

// Helper: mezcla datos guardados del cliente con input actual
function mergeWithClientData(input, clientData) {
  if (!clientData) return input;
  const merged = { ...input };

  // Para recomendar_alimento: llenar especie, cantidad, edad si no están en el input
  if (!merged.especie && clientData.animal_tipo) merged.especie = clientData.animal_tipo;
  if (!merged.cantidad && clientData.animal_cantidad) merged.cantidad = clientData.animal_cantidad;
  if (!merged.edad_dias && clientData.animal_edad_dias) merged.edad_dias = clientData.animal_edad_dias;
  if (!merged.edad_semanas && clientData.animal_edad_dias) {
    // Convertir días a semanas para gallinas
    merged.edad_semanas = Math.floor(clientData.animal_edad_dias / 7);
  }
  if (!merged.edad_meses && clientData.animal_edad_meses) merged.edad_meses = clientData.animal_edad_meses;
  if (!merged.fecha_nacimiento && clientData.animal_fecha_nacimiento) merged.fecha_nacimiento = clientData.animal_fecha_nacimiento;
  if (!merged.dias && clientData.dias_alimento) merged.dias = clientData.dias_alimento;

  // Para crear_pedido: llenar sucursal si no está en el input
  if (!merged.sucursal && clientData.sucursal_preferida) merged.sucursal = clientData.sucursal_preferida;

  return merged;
}

// Crea el ejecutor de herramientas para una conversación concreta.
export function createToolExecutor({ catalog, orders, customer, events, zona }) {
  const emit = (type, payload) => events?.push({ type, ...payload });
  const clientData = customer?.clientData || {};

  // Zonas con cobertura de precios
  const ZONAS_COBERTURA = ["Masaya", "Granada", "Veracruz", "Diriomo", "Masatepe", "Las Flores"];
  const puedeVerPrecios = zona && ZONAS_COBERTURA.includes(zona);

  const executors = {
    buscar_productos({ consulta, tipo, especie }) {
      const results = catalog.search(consulta, { type: tipo, category: especie, limit: 8 });
      if (!results.length) return { resultados: [], nota: "No hay productos que coincidan en el catálogo. No inventar productos; ofrecer pasar la consulta a un asesor." };

      // Si no está en zona, ocultar precios
      if (!puedeVerPrecios) {
        return {
          resultados: results.map(r => ({ ...r, precio: "por confirmar" })),
          nota: "Para precios específicos, un asesor te contactará."
        };
      }
      return { resultados: results };
    },

    ficha_producto({ id }) {
      const d = catalog.details(id);
      if (!d) return { error: `No existe el producto id ${id}` };

      // Si no está en zona, ocultar precio y pasar a humano automáticamente
      if (!puedeVerPrecios) {
        emit("handoff", {
          motivo: "consulta de precio fuera de zona",
          resumen: `Cliente fuera de zona (${zona || "sin zona"}) preguntó por: ${d.nombre}`
        });
        return {
          ...d,
          precio: "por confirmar",
          nota_precio: "Para precios específicos, un asesor te contactará."
        };
      }
      return d;
    },

    recomendar_alimento(input) {
      const merged = mergeWithClientData(input, clientData);
      return recommend(catalog.programs, merged);
    },

    crear_pedido({ nombre_cliente, sucursal, items, notas }) {
      // Usar sucursal guardada si el cliente no la especifica
      const sucursalFinal = sucursal || clientData.sucursal_preferida;

      // Validaciones antes de crear el pedido
      const errores = [];

      // Validar nombre: no vacío y al menos 2 palabras (nombre + apellido)
      if (!nombre_cliente || !nombre_cliente.trim()) {
        errores.push("El nombre del cliente es obligatorio.");
      } else {
        const palabras = nombre_cliente.trim().split(/\s+/).length;
        if (palabras < 2) {
          errores.push(`Necesito nombre completo (ej. "Juan Pérez"), no solo "${nombre_cliente}".`);
        }
      }

      // Validar sucursal: todas las 6 sucursales de cobertura
      const sucursalesValidas = ["Masaya", "Granada", "Veracruz", "Diriomo", "Masatepe", "Las Flores"];
      if (!sucursalFinal || !sucursalesValidas.includes(sucursalFinal)) {
        errores.push(`La sucursal debe ser una de: ${sucursalesValidas.join(", ")}, no "${sucursalFinal || "nada"}".`);
      }

      // Validar items: no vacío
      if (!items || !Array.isArray(items) || items.length === 0) {
        errores.push("El pedido debe tener al menos un producto.");
      } else {
        // Validar cada item
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (!item.producto_id) errores.push(`Producto ${i + 1}: falta el ID del producto.`);
          if (!item.cantidad || item.cantidad <= 0) errores.push(`Producto ${i + 1}: la cantidad debe ser un número mayor a 0.`);
          if (!item.presentacion || !item.presentacion.trim()) errores.push(`Producto ${i + 1}: falta la presentación (ej. "Saco 100 lb", "Libra").`);
        }
      }

      // Si hay errores, devolverlos al modelo
      if (errores.length > 0) {
        return {
          ok: false,
          errores: errores,
          hint: "Revisá los datos y pedile al cliente que confirme antes de volver a intentar."
        };
      }

      // Si todo es válido, crear el pedido
      const res = orders.create({ cliente_telefono: customer.phone, cliente_nombre: nombre_cliente, sucursal: sucursalFinal, items, notas });
      if (!res.ok) return { ok: false, errores: res.errores };
      emit("order_created", { order: res.order });
      return {
        ok: true,
        numero: res.order.numero,
        estado: ORDER_STATUS[res.order.estado],
        resumen: orders.formatForCustomer(res.order),
        siguiente_paso: "Decile al cliente que el pedido quedó registrado y que un asesor lo confirma en breve (existencias y precio si falta). No prometer hora de entrega.",
      };
    },

    consultar_pedido({ numero }) {
      if (numero) {
        const o = orders.get(numero);
        if (!o || o.cliente_telefono !== customer.phone) return { error: `No encuentro el pedido #${numero} de este cliente` };
        return { pedido: publicOrder(o) };
      }
      const list = orders.byCustomer(customer.phone).slice(-3).map(publicOrder);
      return list.length ? { pedidos: list } : { pedidos: [], nota: "Este cliente no tiene pedidos registrados" };
    },

    pasar_a_humano({ motivo, resumen }) {
      emit("handoff", { motivo, resumen });
      return { ok: true, mensaje_para_cliente: `Un asesor le escribirá en breve. Si prefiere, puede escribir directo al ${catalog.store.telefono_humano}. Horario: ${catalog.store.horario}` };
    },

    guardar_datos_cliente({ nombre, animal_tipo, animal_cantidad, animal_edad_dias, animal_edad_semanas, animal_edad_meses, animal_fecha_nacimiento, sucursal_preferida, dias_alimento }) {
      // Validar todos los datos antes de guardarlos
      const validacion = validateClientData({
        nombre,
        animal_tipo,
        animal_cantidad,
        animal_edad_dias,
        animal_edad_semanas,
        animal_edad_meses,
        animal_fecha_nacimiento,
        sucursal_preferida,
        dias_alimento
      });

      if (!validacion.ok) {
        const erroresFormato = formatValidationErrors(validacion.errores);
        return {
          ok: false,
          errores: validacion.errores,
          mensaje_para_cliente: `Hay un problema con los datos:\n${erroresFormato}\n\nPodés intentar de nuevo o pasar a un asesor.`
        };
      }

      // Si pasa validación, guardar
      const datos = {};
      if (nombre) datos.nombre = nombre;
      if (animal_tipo) datos.animal_tipo = animal_tipo;
      if (animal_cantidad) datos.animal_cantidad = animal_cantidad;
      if (animal_edad_dias) datos.animal_edad_dias = animal_edad_dias;
      if (animal_edad_semanas) datos.animal_edad_semanas = animal_edad_semanas;
      if (animal_edad_meses) datos.animal_edad_meses = animal_edad_meses;
      if (animal_fecha_nacimiento) datos.animal_fecha_nacimiento = animal_fecha_nacimiento;
      if (sucursal_preferida) datos.sucursal_preferida = sucursal_preferida;
      if (dias_alimento) datos.dias_alimento = dias_alimento;

      if (Object.keys(datos).length === 0) {
        return { ok: false, error: "No hay datos para guardar" };
      }

      emit("client_data_saved", datos);
      return {
        ok: true,
        guardado: Object.keys(datos),
        mensaje_para_cliente: "Datos anotados ✓"
      };
    },

    guia_crianza({ especie, edad_dias, cantidad_animales }) {
      const guia = GUIAS_CRIANZA[especie];
      if (!guia) {
        return {
          error: `No hay guía para "${especie}". Especies disponibles: pollo_engorde, gallina_ponedora, cerdo_lechon, cerdo_engorde`
        };
      }

      // Si pide solo la guía general
      if (!edad_dias && !cantidad_animales) {
        return {
          ok: true,
          especie: guia.nombre,
          guia: guia
        };
      }

      // Si da edad, calcular qué fase/alimento toca
      let resultado = { ok: true, especie: guia.nombre };

      if (edad_dias) {
        const alimento = obtenerAlimentoPorEdad(especie, edad_dias);
        if (alimento) {
          resultado.edad_actual = edad_dias;
          resultado.fase_actual = alimento.fase;
          resultado.alimento = alimento.alimento;
          resultado.dias_inicio_fase = alimento.dias_inicio;
          resultado.dias_fin_fase = alimento.dias_fin;
        } else {
          resultado.error = `Edad fuera de rango para ${guia.nombre}`;
        }
      }

      // Si da cantidad, calcular consumo
      if (cantidad_animales && edad_dias) {
        const consumo = calcularAlimentoTotal(especie, cantidad_animales, edad_dias);
        if (consumo) {
          resultado.cantidad_animales = cantidad_animales;
          resultado.consumo_por_animal_lb = consumo.consumo_por_animal_lb;
          resultado.total_alimento_lb = consumo.total_lb;
          resultado.sacos_100_lb = consumo.sacos_de_100_lb;
        }
      }

      return resultado;
    },
  };

  return async function execute(name, input) {
    const fn = executors[name];
    if (!fn) return { error: `Herramienta desconocida: ${name}` };
    try {
      return await fn(input || {});
    } catch (err) {
      return { error: `La herramienta ${name} falló: ${err.message}` };
    }
  };
}

function publicOrder(o) {
  return {
    numero: o.numero,
    estado: ORDER_STATUS[o.estado] || o.estado,
    sucursal: o.sucursal,
    creado: o.creado,
    items: o.items.map((l) => `${l.cantidad} × ${l.producto} (${l.presentacion})`),
    total_estimado: o.total_estimado,
    nota_dueno: o.nota_dueno || undefined,
  };
}
