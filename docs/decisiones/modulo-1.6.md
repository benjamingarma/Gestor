# Decisiones técnicas — Módulo 1.6 (Ajustes de stock: regalo, pérdida y rotura)

Las reglas de negocio vienen del plan (decisión 5, A2, A3, A9, A11, secciones 5, 6.6 y 7). Acá se explica cómo se
implementaron y qué se descartó.

## 1. Tabla `ajustes_stock` (plan 4.3)
- Un ajuste = un producto, una cantidad (1 a 10.000), un motivo (`regalo`, `perdida`, `rotura`), una fecha (solo el
  día, en hora de Tucumán, como compras y pagos), una nota opcional y su costo total en USD y en pesos.
- **Solo salidas** (A9): no hay ajustes de entrada porque habría que inventar un costo. Si se cargó mal una compra,
  se anula la compra.
- Id generado en el celular (UUID); `registrado_por`, `es_prueba` y `creado_en` los pone la base (`completar_alta`).
- No se borra ni se edita: solo se anula, una vez (`solo_anulacion_generica`, `impedir_borrado`).
- RLS: cada socio ve los ajustes de su negocio; nadie escribe directo, solo por las funciones.

## 2. Costo FIFO y copia histórica
- `registrar_ajuste` hace exactamente lo mismo que `registrar_venta` con un renglón: bloquea las compras del producto
  (`for update`), consume de la más vieja a la más nueva y guarda un movimiento `ajuste` por cada compra tocada, con
  el costo en USD y en pesos **de esa compra**. El costo total queda congelado en el ajuste.
- **Alternativa descartada:** reutilizar `registrar_venta` con un "cliente ficticio" y precio 0. Mezclaba pérdidas
  con ventas (contaría como venta, ensuciaría la cuenta corriente y el "vendido").
- Concurrencia (A11): una venta y un ajuste simultáneos de la última unidad → se graba uno solo. Probado con dos
  conexiones reales en `supabase/tests/concurrencia.sh`.
- Los movimientos `ajuste`/`anulacion_ajuste` ahora **exigen** `ajuste_id` (regla en la tabla), igual que los de
  venta exigen su renglón.

## 3. Anulación
- `anular_ajuste` devuelve cada unidad a la compra de la que salió, con su costo original (movimientos
  `anulacion_ajuste`). Anular dos veces no duplica nada. El ajuste anulado queda en el historial y deja de contar.

## 4. Cómo resta de la ganancia
- Ganancia neta = ganancia de las ventas − Σ costo en pesos de los ajustes **no anulados** del período, por la
  **fecha del ajuste** (plan, sección 5). Cada pérdida se reparte con el porcentaje vigente en su fecha (igual que
  las ventas), así que la suma de las partes sigue siendo exactamente la neta.
- La base agrega por día (`v_perdidas_diarias`) y el resumen la lee paginada (como las ventas), así nunca se corta
  por el límite de 1000 filas.
- El capital (`v_capital`, ya existente) toma las pérdidas de los movimientos. Una prueba verifica que coinciden con
  las de la tabla de ajustes, y que el capital cierra: invertido = vendido + pérdidas + stock, en USD y en pesos.

## 5. Pantallas
- Ficha del producto → botón **"− Regalo, pérdida o rotura"** (solo si hay stock) → formulario con tres botones
  grandes para el motivo, cantidad, fecha y nota. Antes de guardar muestra cuánto se va a restar de la ganancia
  (misma simulación FIFO que la venta, `simularFifo`); la base recalcula al guardar y es la que manda.
- La ficha del producto lista sus ajustes, con la opción de anular cada uno.
- `/ajustes`: todos los ajustes de un mes (o de todo el historial), con el total restado y unidades por motivo. Se
  llega tocando "− Pérdidas por ajustes de stock" en el resumen.
- El resumen ya tenía la fila; ahora recibe las pérdidas reales.

## 6. Decisiones menores (para confirmar con los socios)
- **Se puede ajustar un producto desactivado** (a diferencia de la venta): es la forma de dar de baja lo que quedó de
  un producto que ya no se trabaja.
- El regalo no guarda a qué cliente fue (el plan no lo pide); se puede anotar en la nota.

## 7. Pruebas
- pgTAP `06_ajustes.test.sql` (53): validaciones, A1 del plan ($7.000 / USD 5 de C2, stock C2 = 11), ajuste que
  cruza dos compras, idempotencia, anulación y re-consumo FIFO, producto desactivado, inmutabilidad (también para el
  administrador), RLS entre negocios y anónimo, ganancia neta $67.000, capital 195 = 96 + 5 + 94 USD y
  $267.500 = $125.000 + $7.000 + $135.500, borrado de datos de prueba.
- Vitest `ajustes.test.ts` (13, con fast-check): validación, costo FIFO del ajuste (y que partir un ajuste en dos
  cuesta lo mismo), pérdidas en la ganancia por período y por vigencia del reparto.
- Prueba de concurrencia: venta contra ajuste de la última unidad.
- Prueba de humo: 21 pantallas (suma el formulario de ajuste y `/ajustes`).
