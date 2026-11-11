# Maquetas del módulo 1.7 — Simplificación del diseño

**Aprobadas por los socios el 10/11/2026.** Son la especificación visual del módulo: cada pantalla nueva tiene que
respetar su jerarquía, textos, orden, espacios y los dos temas. Cualquier diferencia se avisa en el PR.

Los números son **inventados** y no coinciden entre sí. En la app todo sale de la base de datos.

## Cómo verlas
- Imágenes: `imagenes/celular-claro.png`, `imagenes/celular-oscuro.png`, `imagenes/pc-claro.png`, `imagenes/pc-oscuro.png`
  (y cada pantalla de PC suelta: `imagenes/pc-<inicio|venta|cobro>-<claro|oscuro>.png`).
- HTML: abrir `movil.html` (todas las pantallas de celular; `?p=inicio,venta` para elegir) o `pc.html?p=inicio|venta|cobro`
  en el navegador. El tema sigue al del sistema.
- Regenerar las imágenes: `node docs/maquetas/renderizar.mjs` (Playwright).
- `base.css` tiene los colores (tokens) de los dos temas; `pantallas.js` arma cada pantalla.

## Estructura de navegación aprobada
- **Celular:** barra inferior de 5 ítems — Inicio · Clientes · **Vender** (central, destacado) · Cobrar · Más.
- **PC:** barra lateral — botón Vender arriba; Inicio, Clientes, Cobrar; grupo "Gestión" con todo lo de "Más".
- **Más:**
  - Negocio: Resumen y ganancia · Stock y productos · Compras.
  - Historial y correcciones: Ventas (ver y anular) · Cobros (ver y anular) · Regalos, pérdidas y roturas.
  - Configuración: Reparto entre socios · Cerrar sesión.
- Las pantallas de venta y de cobro (3b) ocupan toda la pantalla en el celular (sin barra inferior), con × para cerrar y
  el botón de guardar fijo abajo.

## Pantallas
1. **Inicio:** Nos deben (con Cobrar) → A visitar hoy (con Vender por cliente) → el mes (Vendido, Cobrado, Ganancia neta
   separados + aviso "La ganancia no es plata disponible") → Capital en mercadería. En PC: dos columnas + "Quién debe plata".
2. **Venta:** cliente → productos con − / + (precio propuesto y su origen: especial, último que pagó o general; stock que
   queda) → total y ganancia estimada → "Hoy · vendió X · sin nota — Cambiar" → Guardar venta.
3. **Cobrar:** (celular) lista de quién debe con buscador → cobro en una pantalla: monto grande con atajos ("Todo"),
   medio de pago y quién recibió preseleccionados con el último usado, "Le queda debiendo" en vivo, Guardar.
4. **Confirmación al guardar:** ✓ animado, monto y resumen, "Listo" y "Deshacer (anular)".
5. **Más:** ver arriba.
6. **Gráfico del mes en Inicio** (propuesta del 11/11/2026, **pendiente de aprobación**): el resumen del mes pasa a ser
   la **última sección** del Inicio (en PC, a todo el ancho debajo de las dos columnas). Arriba, una **torta** con lo
   vendido en el mes partido en **Ganancia** (vendido − costo de la mercadería) y **Costo de la mercadería**, con los
   montos y porcentajes escritos al lado y la cuenta "$ vendido − $ costo = $ ganancia, se haya cobrado o no".
   Debajo, como antes: Vendido, Cobrado, Ganancia neta, el aviso "La ganancia no es plata disponible" y
   "Ver resumen completo ›". Sin ventas en el mes, o con ventas por debajo del costo, la torta se reemplaza por un
   mensaje (pantalla `1b`). Colores de la torta (`--graf-ganancia`, `--graf-costo`) validados para daltonismo y
   contraste en los dos temas.

## Decisiones de los socios (10/11/2026)
1. La app pasa a llamarse **McStock**.
2. "Deshacer (anular)" queda en la confirmación, **solo justo después de guardar** y pidiendo el motivo.
3. "Repetir última venta" (ficha del cliente) se hace en un **PR aparte, al final**, después de los cuatro PR del plan.

## Reglas de estilo
- Identidad propia: verde de la app, íconos dibujados a mano. Nada de la marca, colores ni íconos de otras apps.
- Números grandes, tarjetas, buen espaciado, una acción principal por pantalla.
- Animaciones solo con CSS (150–200 ms), se apagan con "reducir movimiento"; sin librerías pesadas.
- Mismo contraste y legibilidad en tema claro y oscuro; la app sigue el tema del dispositivo (sin selector).
