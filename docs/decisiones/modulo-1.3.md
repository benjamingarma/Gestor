# Decisiones técnicas — Módulo 1.3 (Ventas, FIFO, precios especiales, anulación)

## 1. Un solo PR
Partirlo dejaba una primera mitad sin nada usable desde el celular (base sin pantalla). Se entregó completo.

## 2. El costo FIFO lo calcula la base, al vender (`registrar_venta`)
- Por cada producto: bloquea sus compras (`for update`), recorre las compras de la más vieja a la más nueva
  (fecha y orden de carga) y descuenta lo disponible de cada una. Cada salida es un movimiento con el costo en
  USD y en pesos de **su** compra (cada una con su tipo de cambio). La venta no usa tipo de cambio.
- El costo total (pesos y USD) se guarda en el renglón y no cambia nunca, aunque después se cargue una compra
  con fecha anterior (plan A2).
- Todo o nada: si a un producto le falta stock, no se graba ningún renglón. El mensaje dice cuánto hay.
- Los productos se procesan siempre en el mismo orden (por id) para que dos ventas simultáneas no se traben.
- **Concurrencia**: `supabase/tests/concurrencia.sh` abre dos conexiones que venden la última unidad a la vez:
  se graba una y la otra recibe "No hay stock suficiente". Corre en el CI. Se verificó que sin el bloqueo la
  prueba falla (se vendían 2 y el stock quedaba en −1).
- **Descartado**: calcular el costo en el celular (no ve el stock real ni puede bloquear).

## 3. Idempotencia
- El UUID de la venta se genera en el celular al abrir la pantalla. Reenviar la misma venta (doble toque, mala
  señal) devuelve la ya guardada; mismo UUID con otros datos: error.

## 4. Anulación
- `anular_venta`: exige motivo; marca la venta (quién y cuándo) y devuelve cada unidad **a la misma compra de la
  que salió**, con su costo original (movimientos `anulacion_venta`). Anular dos veces no duplica.
- Una venta anulada no cuenta para la ganancia, ni para el último precio pagado, ni como última visita.
- Después de anular, el FIFO vuelve a usar esas unidades si su compra es la más vieja con stock.

## 5. Reglas de la venta
- Entre 1 y 50 productos distintos (un producto no se repite: se suman las cantidades en un renglón).
- Precio por unidad de $0 en adelante ($0 permitido, por ejemplo una bonificación).
- Fecha: hoy por defecto; se permite una fecha pasada, nunca futura. Cliente archivado: no se le vende.
- "Vendió" = un socio (por defecto el del usuario logueado; se puede elegir el otro). "Cargó" lo pone la base.

## 6. Precios
- `precios_especiales`: precio vigente por cliente y producto (configuración: se cambia o se quita con
  `fijar_precio_especial`). El precio histórico de cada venta queda en `venta_items.precio_unitario`.
- Precio propuesto (`src/dominio/ventas.ts`): especial → último que pagó ese cliente por ese producto (vista
  `v_ultimo_precio_cliente`, sin anuladas) → general. Siempre editable. La pantalla dice de dónde salió.

## 7. Vista previa en el celular
- `simularFifo` (TypeScript) calcula con las compras disponibles el mismo costo que va a calcular la base, para
  mostrar costo y ganancia estimados antes de confirmar. Pruebas: da exactamente los números del plan, y con
  fast-check, vender en dos partes cuesta lo mismo que vender todo junto.
- La base es la autoridad: si entre que se abrió la pantalla y se confirmó alguien vendió, el costo real puede
  diferir del estimado (se muestra el real en el detalle).

## 8. Vistas
- `v_ventas`: importe, costo (pesos y USD), ganancia y unidades por venta. Cobrado y saldo se agregan en 1.4.
- `v_clientes` ahora incluye la última venta: vender cuenta como visita para la próxima visita.

## 9. Ajuste en `movimientos_stock`
- Nueva regla: los movimientos `venta`/`anulacion_venta` siempre apuntan a su renglón, y los demás nunca. La
  prueba del módulo 1.1 que simulaba una salida ahora usa un movimiento de tipo `ajuste`.

## 10. Datos de prueba
- `ventas`, `venta_items` y `precios_especiales` tienen `es_prueba` y entran en el conteo y el borrado.
