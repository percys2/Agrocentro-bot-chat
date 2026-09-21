// Scheduler: notifica a clientes cuando sus pedidos están listos
// Ejecuta cada X minutos para revisar pedidos en estado "listo"

export function createScheduler({ orders, catalog, transport, log }) {
  let running = false;
  let intervalId = null;

  async function checkReadyOrders() {
    try {
      // Obtener todos los pedidos en estado "listo"
      const readyOrders = orders.list({ estado: "listo" });

      for (const order of readyOrders) {
        // Verificar si ya notificamos al cliente
        if (order.notificado_cliente) {
          continue; // Ya fue notificado, saltar
        }

        // Construir mensaje para el cliente
        const mensaje = construirMensajeListoParaRetiro(order, catalog);

        // Enviar mensaje
        try {
          await transport.sendText(order.cliente_telefono, mensaje);
          log.info("Recordatorio enviado", {
            numero_pedido: order.numero,
            cliente: order.cliente_nombre,
            telefono: order.cliente_telefono,
            sucursal: order.sucursal,
          });

          // Marcar como notificado
          order.notificado_cliente = true;
          order.fecha_notificacion = new Date().toISOString();
          orders.col.update("items", (items = {}) => ({ ...items, [order.numero]: order }));
        } catch (err) {
          log.error("Error enviando recordatorio", {
            numero_pedido: order.numero,
            cliente_telefono: order.cliente_telefono,
            error: err.message,
          });
          // No marcar como notificado para reintentar después
        }
      }
    } catch (err) {
      log.error("Error en scheduler de pedidos listos", { error: err.message });
    }
  }

  return {
    start(intervalMs = 60000) {
      // Por defecto, revisar cada minuto
      if (running) {
        log.warn("Scheduler ya está corriendo");
        return;
      }

      running = true;
      log.info("Scheduler iniciado", { intervalo_ms: intervalMs });

      // Ejecutar inmediatamente
      checkReadyOrders().catch(() => {});

      // Luego ejecutar periódicamente
      intervalId = setInterval(() => {
        checkReadyOrders().catch(() => {});
      }, intervalMs);
    },

    stop() {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
      running = false;
      log.info("Scheduler detenido");
    },

    isRunning() {
      return running;
    },

    // Para testing: ejecutar manualmente una vez
    async checkNow() {
      await checkReadyOrders();
    },
  };
}

function construirMensajeListoParaRetiro(order, catalog) {
  return `¡Excelente noticia! Tu pedido #${order.numero} está listo para retiro en ${order.sucursal}.

Productos:
${order.items.map((l) => `- ${l.cantidad} × ${l.producto}`).join("\n")}

Horario de atención: ${catalog.store.horario}

Presentate cuando quieras. Si tenés dudas, llamá al ${catalog.store.telefono_humano}.`;
}
