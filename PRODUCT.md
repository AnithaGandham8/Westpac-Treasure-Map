# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Clientes de Westpac que exploran tiendas y ofertas de recompensa, y quieren ver sus beneficios y administrar una meta de ahorro en una experiencia móvil tipo demostración.

## Product Purpose

Treasure Map presenta recompensas de Westpac a través de un mapa interactivo de Gold Coast. Permite descubrir comercios, entender ofertas, acumular monedas/recompensas y dirigirlas a metas. Las áreas Discover, Pot y Missions amplían la exploración hacia búsqueda asistida por IA, gestión de objetivos y retos personales.

## Positioning

El mecanismo distintivo es hacer visibles y accionables recompensas que Westpac ya ofrece: el mapa localiza comercios y ofertas, mientras las monedas y la meta muestran cómo las recompensas contribuyen a un objetivo personal. La función Me vs Me propone retos basados en patrones de gasto no esencial, con reglas de bienestar y protección antifraude.

## Operating Context

Prototipo web para móvil con una navegación inferior de cinco destinos. Rewards es la sección implementada y abre una pantalla inicial de tarjetas para Map, Discover, Pot y Missions; cada sección ofrece un control para volver a esa pantalla. Overview, Payments, Products e Inbox se muestran como opciones sin acción. Se presenta en un marco de teléfono y tiene controles de demostración externos para alternar escenarios. El mapa está dibujado localmente para Gold Coast; la app puede abrirse como HTML estático o servirse localmente.

## Capabilities and Constraints

- Mapa SVG offline con pan, zoom, selección de áreas, vuelo a zona, comercios, marcadores y ofertas.
- Power-up de tarjeta, hoja de oferta, uso de oferta, recompensas, contador de monedas y feedback animado.
- Discover con feed, filtros por categoría, búsqueda de metas con IA y fallback local.
- Pot con ledger, metas, selección de meta activa, creación, edición de precio y eliminación sujeta a reglas del motor.
- Missions / Me vs Me con objetivo adaptativo, recompensas limitadas por cash-flow, controles antifraude y modos Ask first/automático.
- Escenarios de demo en URL y selector visual; reset del estado.
- Orden de carga: `data.js` → `engine.js` → `ai.js` → `app.js` → `missions.js`.
- El motor JavaScript es fuente de verdad para importes y reglas. El modelo de IA no recibe transacciones; los endpoints reciben solo información agregada/permitida según la implementación actual.
- Los hooks `window.App` y los contratos de DOM (IDs, atributos `data-*` y clases consultadas por scripts) son dependencias funcionales y no se deben romper durante cambios visuales.
- Mantener compatibilidad con Cloudflare Pages/GitHub Pages y apertura estática; sin claves de API ni backend obligatorio nuevo.

## Brand Commitments

Nombre del producto: Treasure Map. Marca anfitriona: Westpac. La dirección visual solicitada adopta los tokens Westpac Together documentados en `../LOOK-AND-FEEL.md`; el mapa y el concepto de exploración/recompensas siguen siendo parte esencial del producto.

## Evidence on Hand

- Implementación en `index.html`, `styles.css`, `theme.css`, `app.js`, `engine.js`, `data.js`, `ai.js`, `missions.js`.
- Datos de demostración en `data.js` (comercios Gold Coast, tarjeta, transacciones y escenarios).
- Reglas funcionales documentadas en `README.md`.
- Sin evidencia de clientes reales, ahorros reales, asociaciones comerciales verificadas ni resultados financieros reales; no deben inventarse ni presentarse como tales.

## Product Principles

1. Hacer fáciles de encontrar y entender las recompensas disponibles.
2. Conectar cada recompensa con una meta personal de forma transparente.
3. Mantener el control y las decisiones de recompensa en manos del cliente.
4. Evitar que los retos personales incentiven privación financiera o manipulación de gasto.
5. Mantener el mapa y el modo de demostración útiles aun sin red o IA.
