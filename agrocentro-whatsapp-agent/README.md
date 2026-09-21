# Agente de WhatsApp · AgroCentro Nica

Un asistente que atiende el WhatsApp de la tienda: responde qué alimento le toca a cada animal y cuánto necesita (con los programas de la Guía de uso del sitio), informa productos y precios del catálogo, toma pedidos para retiro en Diriomo o Masatepe y se los pasa al dueño para confirmar. Cuando algo se sale de lo que sabe, avisa a un asesor.

Está hecho con Node 20+ sin dependencias (ni `npm install`), la API de Claude y la WhatsApp Cloud API de Meta.

## Cómo funciona

```
Cliente (WhatsApp) ──► Meta Cloud API ──► POST /webhook ──► handler
                                                              │
                                     ┌────────────────────────┴───────────────────────┐
                                     │ 1. sesión del número (historial de 24 h)       │
                                     │ 2. agente: Claude + herramientas               │
                                     │      buscar_productos · ficha_producto         │
                                     │      recomendar_alimento · crear_pedido        │
                                     │      consultar_pedido · pasar_a_humano         │
                                     │ 3. respuesta al cliente                        │
                                     │ 4. avisos al dueño (pedido nuevo, asesor)      │
                                     └────────────────────────────────────────────────┘
Dueño (su WhatsApp) ──► "confirmar 12" / "listo 12" / "rechazar 12 motivo" ──► aviso al cliente
```

Reglas fijas del agente: solo productos del catálogo; precios solo de `data/prices.json` (si falta, dice "por confirmar"); nunca promete existencias; nunca da dosis de productos veterinarios; los pedidos quedan pendientes hasta que el dueño los confirma.

## Archivos

| Ruta | Qué es |
|---|---|
| `src/server.js` | Servidor HTTP: `GET /webhook` (verificación), `POST /webhook` (mensajes), `GET /health` |
| `src/handler.js` | Orquesta cada mensaje: dedupe, sesión, comandos del dueño, agente, avisos |
| `src/agent.js` | Bucle del agente (modelo ↔ herramientas) |
| `src/tools.js` | Definición y ejecución de las herramientas |
| `src/prompt.js` | Prompt de sistema (reglas, estilo) + guía + índice del catálogo |
| `src/feeding.js` | Programas de alimentación y calculadoras (código determinista) |
| `src/catalog.js` | Catálogo, fichas, búsqueda, precios |
| `src/orders.js` · `src/admin.js` | Pedidos y comandos del dueño |
| `src/whatsapp.js` · `src/claude.js` | Clientes de las dos APIs |
| `data/products.json` · `data/feed-guides.json` · `data/programs.json` | Datos tomados del sitio (catálogo, fichas, programas) |
| `data/faq.md` | Base de conocimiento (la Guía de uso). Editable |
| `data/prices.json` | Lista de precios. **Vos la llenás** |
| `data/store.json` | Sucursales, horario, teléfono |
| `scripts/chat.js` | Simulador de consola para probar sin WhatsApp |
| `scripts/sync-site-data.js` | Refresca catálogo y fichas desde agrocentronica.com |
| `scripts/init-prices.js` | Regenera `prices.json` conservando los precios ya cargados |
| `test/` | Pruebas (`npm test`) |

## 1. Probarlo en la computadora (sin WhatsApp)

1. Instalá Node 20 o más nuevo.
2. Copiá `.env.example` a `.env` y poné tu `ANTHROPIC_API_KEY` (console.anthropic.com → API keys). Lo demás puede quedar vacío para el simulador.
3. `npm run chat` y escribí como si fueras un cliente:

```
Vos: tengo 100 pollos de 10 dias, que les doy y cuantos sacos ocupo
Vos: quiero 3 sacos de engordina para recoger en masatepe
Vos: /dueño pedidos
Vos: /dueño confirmar 1 pase después de las 2
```

`/dueño ...` simula que escribe el dueño; `/reset` reinicia la conversación; `/salir` termina. Los avisos que le llegarían al dueño se imprimen en amarillo.

## 2. Cargar los precios

Abrí `data/prices.json`. Cada fila es producto + presentación; escribí el precio en córdobas como número o dejá `null` para que el agente diga "precio por confirmar". Podés agregar filas con otras presentaciones (por ejemplo "Media libra"). Después de editar, reiniciá el servidor.

Si el sitio cambia de productos: `npm run sync-site` (baja el catálogo y las fichas del sitio) y luego `npm run init-prices` (agrega las filas nuevas sin borrar precios).

## 3. Conectar con WhatsApp (API de Meta, número de prueba)

1. Entrá a developers.facebook.com → Mis apps → Crear app → tipo **Negocios** (Business). Nombre: "AgroCentro Bot".
2. En el panel de la app, agregá el producto **WhatsApp** → Configurar. Meta crea una cuenta de WhatsApp Business de prueba con un **número de prueba** gratuito.
3. En **WhatsApp → API Setup** (Configuración de la API):
   - Copiá el **Token de acceso temporal** → `WHATSAPP_TOKEN` (dura 24 h; ver más abajo cómo hacer uno permanente).
   - Copiá el **Phone number ID** → `WHATSAPP_PHONE_NUMBER_ID`.
   - En "Para" (To) → Administrar lista de números → agregá tu celular y verificalo con el código que te manda WhatsApp. Ese número será `OWNER_PHONE` (formato `505XXXXXXXX`). Podés agregar hasta 5 números de prueba (el tuyo, el de la tienda, algún cliente de confianza).
   - Mandá el mensaje de prueba "hello_world" desde ese panel para confirmar que llega.
4. En **Configuración de la app → Básica** copiá el **Identificador secreto de la app** → `WHATSAPP_APP_SECRET`.
5. Desplegá el servidor (paso 4) y anotá su URL pública, por ejemplo `https://agrocentro-bot.up.railway.app`.
6. En **WhatsApp → Configuración → Webhook** → Editar: URL de devolución `https://TU-URL/webhook`, token de verificación = el valor de `WHATSAPP_VERIFY_TOKEN` → Verificar y guardar. Luego en "Administrar" campos del webhook suscribí **messages**.
7. Desde tu celular escribile al número de prueba. El bot responde.

Token permanente (para no renovar cada 24 h): business.facebook.com → Configuración del negocio → Usuarios → **Usuarios del sistema** → crear uno (rol administrador) → Agregar activos → tu app (control total) → **Generar token** con los permisos `whatsapp_business_messaging` y `whatsapp_business_management`. Ese token va en `WHATSAPP_TOKEN`.

Pasar a producción: cuando el bot esté probado, en API Setup agregás un número real (uno que no esté registrado en la app de WhatsApp) y Meta pide verificar el negocio. Conviene un número dedicado al bot y dejar el 8240 3490 para atención humana: así "pasar a un asesor" es simplemente decirle al cliente que escriba ahí, y a vos te llega el aviso con su número.

## 4. Desplegar (Railway, la opción más simple)

1. Subí esta carpeta a un repositorio de GitHub.
2. En railway.app → New Project → Deploy from GitHub repo → elegí el repo. Railway detecta Node y usa `npm start`.
3. En **Variables** pegá el contenido de tu `.env` (sin el `PORT`; Railway lo pone solo).
4. En **Settings → Networking → Generate Domain** obtenés la URL pública.
5. Para que pedidos y sesiones sobrevivan a los redeploys: **Volumes → Add volume**, montado en `/data`, y agregá la variable `RUNTIME_DIR=/data`.
6. `GET https://TU-URL/health` debe responder `{"ok":true,...}`.

Render, Fly.io o cualquier VPS con Node funcionan igual: `npm start` y las variables de entorno.

## 5. Comandos del dueño (desde tu WhatsApp al número del bot)

| Escribís | Pasa |
|---|---|
| `pedidos` | Lista los pendientes |
| `pedido 12` | Detalle del #12 |
| `confirmar 12 [nota]` | Marca confirmado y le avisa al cliente (la nota va en el mensaje) |
| `listo 12 [nota]` | Avisa al cliente que puede pasar a retirar |
| `rechazar 12 motivo` | Avisa que no se pudo atender |
| `entregado 12` | Cierra el pedido |
| `pausar 505XXXXXXXX` / `reanudar ...` | El bot deja de responderle a ese número (para atenderlo vos) |
| `estado` | Resumen del día |
| `ayuda` | Esta lista |

Cualquier otro texto tuyo se atiende como si fueras un cliente, así que podés probar el bot desde tu propio teléfono.

Ventana de 24 horas: Meta solo deja mandar texto libre a un número que escribió en las últimas 24 h. Para que te lleguen los avisos de pedidos, escribile algo al bot cada día (un "hola" basta) o creá una plantilla aprobada con un parámetro `{{1}}` y ponela en `OWNER_ALERT_TEMPLATE`. Los clientes no tienen ese problema porque siempre escriben primero.

## Costos aproximados

- Claude Sonnet 5: US$2 por millón de tokens de entrada y US$10 de salida. El prompt fijo (guía + catálogo, unos 5 000 tokens) se cachea, así que cada mensaje cuesta alrededor de US$0.003–0.01. Cien mensajes al día rondan US$0.50–1.00 diarios. Con `ANTHROPIC_MODEL=claude-haiku-4-5-20251001` sale a la mitad.
- WhatsApp Cloud API: responder a clientes que escriben primero no tiene costo por conversación según la política vigente de Meta; los mensajes que inicia el negocio con plantilla sí se cobran por mensaje. Verificalo en la página de precios de Meta antes de lanzar.
- Hosting: Railway/Render tienen planes de unos US$5 al mes.

## Límites de esta versión y siguientes pasos

- Solo texto. Las notas de voz reciben un aviso ("por ahora solo leo texto") y vos recibís la notificación. Siguiente paso natural: transcribirlas y atenderlas igual.
- Existencias: el agente no las conoce; los pedidos quedan "sujetos a existencias" hasta que confirmás. Se puede agregar una lista de agotados por sucursal.
- Sin bandeja de entrada propia: el número del bot no tiene la app de WhatsApp. La atención humana se hace desde el 8240 3490 (por eso conviene un número dedicado al bot).
- El historial de cada cliente dura 24 h de inactividad y luego empieza limpio.

## Pruebas

`npm test` corre 30 pruebas: catálogo y búsqueda, programas de alimentación y cálculos, pedidos, bucle del agente con un modelo simulado, flujo completo cliente → dueño → cliente, webhook (firma, verificación, mensajes) y servidor.
