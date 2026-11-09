# Decisiones técnicas — Módulo 1.4 (Pagos y cuenta corriente)

## 1. La aplicación de los pagos se calcula, no se guarda (plan A4)
- `src/dominio/cuentaCorriente.ts`: deudas (saldos del papel + ventas no anuladas) y créditos (pagos no anulados +
  saldos del papel a favor). Los créditos cubren las deudas de la más vieja a la más nueva.
- Orden: por día; el mismo día, el saldo del papel antes que las ventas; después, orden de carga.
- Como solo importa el TOTAL de créditos, el resultado no depende del orden en que se cargan los pagos, y anular
  un pago o una venta reacomoda todo solo. Probado con fast-check: nunca se cobra de más, FIFO estricto, dividir un
  pago en varios da lo mismo, y saldo = deudas − créditos.
- **Descartado**: guardar a qué venta va cada pago (habría que rehacer las imputaciones con cada anulación).

## 2. Totales en la base, detalle en TypeScript
- `v_cuentas_clientes` suma ventas, deudas del papel, pagos y saldos a favor por cliente (incluye archivados): da
  el saldo para "quién debe", el inicio y la ficha. El saldo es una suma, así que no depende del FIFO.
- El cobrado y saldo de **cada venta** se calcula con la función de TypeScript (una sola implementación).

## 3. Pagos
- `registrar_pago`: idempotente por UUID del celular; importe > 0; medio efectivo / transferencia / Mercado Pago;
  "recibió la plata" = un socio (por defecto el logueado); fecha hoy o pasada.
- `anular_pago`: con motivo; no se borra. Pagos y saldos usan un trigger genérico que solo permite completar los
  datos de anulación, una vez.
- Un pago mayor a la deuda queda como saldo a favor y se aplica solo a la próxima venta.
- Anular una venta ya cobrada deja lo cobrado a favor o aplicado a otra deuda (plan A15).

## 4. Saldos del papel (plan A5)
- `saldos_iniciales` (deuda o a favor) se cargan a mano desde la cuenta del cliente; la importación del 1.7 va a
  usar la misma tabla. Cuentan en la cuenta corriente pero nunca como venta ni como ganancia.

## 5. Pantallas
- Ficha del cliente: saldo (debe / a favor / al día) con "Cobrar" y "Ver cuenta"; sus ventas con "Pagada" / "Debe $X".
- Cobrar: importe (con "Pagó todo"), botones grandes de medio, quién recibió y vista previa de cómo queda.
- Cuenta corriente: deudas en orden de aplicación con cobrado y saldo, cobros (quién recibió y quién cargó),
  saldos del papel; anular cobros y saldos.
- Detalle de venta: cobrado, saldo pendiente y "Registrar cobro" con el saldo de la venta sugerido.
- `/cobros`: "Nos deben" y "saldos a favor", quién debe (de mayor a menor, incluidos archivados) y últimos cobros.
- Inicio: "Nos deben $X".

## 6. Filtro por mes en el historial de ventas (pedido de los socios)
- `/ventas?mes=AAAA-MM` muestra **todas** las ventas de ese mes (hora de Tucumán), sin el límite de 100.
  Por defecto, el mes actual. Selector con flechas para ir al mes anterior/siguiente (desde el primer mes con ventas).
- Resumen del mes: vendido, cantidad de ventas y unidades, ganancia generada y cuánto falta cobrar de esas ventas.

## 7. Datos de prueba
- `pagos` y `saldos_iniciales` tienen `es_prueba` y entran en el conteo y el borrado.
