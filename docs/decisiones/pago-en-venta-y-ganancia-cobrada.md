# Pago en la venta, ganancia según lo cobrado y lenguaje (pedido de los socios, 18/11/2026)

Propuesta presentada el 18/11/2026 con ejemplos numéricos y aprobada el mismo día. Se hace en este orden de PRs:

1. **Lenguaje** (solo textos; glosario en `docs/glosario.md`). Sin migración.
2. **Venta con pago**, en dos partes: **2A** migración (funciones de la base y pruebas) y **2B** pantalla.
   Con migración: el deploy preview de 2A no sirve, se prueba después de mergear.
3. **Ganancia según lo cobrado y su desglose** en Inicio y Resumen. Sin migración (cálculo en `src/dominio/`).

## Decisiones de los socios (18/11/2026)
1. **Selector de pago en la venta sin preselección**: "Pagó todo", "Pago parcial" o "Deuda"; no se puede guardar sin
   elegir. Motivo: con "Pagó todo" preseleccionado, una venta fiada guardada sin mirar borraría la deuda sin que nadie
   lo note (plata perdida); elegir cuesta un solo toque.
2. **Pago parcial con deuda anterior**: el monto puede ser mayor que la venta (paga la venta y parte de lo viejo).
3. **Anulaciones: se recalcula** (opción A). La ganancia cobrada se calcula, no se guarda; si se anula un pago o una
   venta viejos, los meses pasados se reacomodan (como ya pasa hoy con la ganancia y con la decisión A4 del plan).
4. **Saldo a favor**: la ganancia de una venta pagada con saldo a favor cuenta en la **fecha de la venta** que lo usa.
5. **Anular desde el historial una venta que se pagó al vender**: la pantalla de anulación pregunta si se devolvió la
   plata (marcado por defecto). Si se devolvió, se anula también el pago; si no, el pago queda a cuenta del cliente.
6. **Aviso amarillo** nuevo: "La ganancia neta es lo que quedó de lo cobrado después de pagar el costo de la
   mercadería. Todavía no descuenta los retiros de cada socio ni la diferencia si reponer cuesta más (por ejemplo, si
   subió el dólar), que la app todavía no registra."

## Reglas acordadas
- **Pago en la venta**: medio y quién recibió preseleccionados con el último pago que registró ese socio. El botón y la
  confirmación muestran "Cobrado $ X · Debe $ Y" (Y = saldo pendiente total del cliente después de guardar). **Si el
  cliente ya debía de antes (decisión del 18/11/2026):** la confirmación separa la venta de hoy de lo viejo, por ejemplo
  "Esta venta: pagada · Deuda anterior $ 10.000" o "Esta venta: debe $ 8.000 · Deuda anterior $ 10.000", para no dar a
  entender que la venta de hoy quedó debiendo lo que en realidad es deuda vieja. "Pagó todo" cobra solo el total de la venta
  nueva; si tenía saldo a favor, registra el total menos el saldo a favor. Venta y pago en **una sola operación** de la
  base (nunca venta guardada con pago fallido), idempotente ante doble toque; "Deshacer" anula los dos juntos.
- **Imputación del pago de la venta (cambio del 18/11/2026, ver abajo):** el pago registrado en la pantalla de venta
  (`pagos.venta_id`) se aplica **primero a esa venta**; lo que sobra (pago mayor que la venta), los pagos sueltos de
  "Registrar pago", los saldos a favor y el pago de una venta anulada sin devolver la plata van a la deuda más vieja
  (A4). El saldo total del cliente es el mismo que con FIFO puro.
- **Ganancia según lo cobrado**: cada peso cobrado, aplicado según la imputación de arriba, trae su parte de la
  ganancia de esa venta (ganancia × porción ÷ total de la venta), en el **día del pago**; el reparto usa el porcentaje
  vigente ese día; las pérdidas por ajustes restan en la fecha del ajuste; lo aplicado a deudas del papel no genera
  ganancia. Redondeo sobre lo acumulado: al terminar de pagarse una venta, la suma de las porciones es exactamente su
  ganancia. Lo que debe cada cliente y lo cobrado de cada venta son los mismos que muestra la cuenta corriente.
- **Desglose** en Inicio y Resumen: Cobrado − de deudas del papel − costo de la mercadería de lo cobrado − pérdidas por
  ajustes = Ganancia neta (más "quedó como saldo a favor" / "saldo a favor usado en ventas" cuando no son cero).
  "Nos deben" con la ganancia pendiente de cobro y la ganancia generada por las ventas del mes como dato secundario.
- El **capital** (invertido = costo de lo vendido + pérdidas + stock) no cambia: depende de ventas y stock, no de pagos.

## Cambio del 18/11/2026: el pago de la venta se aplica a esa venta (camino B)
La propuesta aprobada decía "el pago se aplica a la deuda más vieja (A4): si el cliente ya debía, 'Pagó todo' cancela
primero lo viejo" (camino A). Con el PR 2A ya hecho, los socios eligieron el camino B. Motivos: la pantalla no debe
mostrar como pendiente una venta que el cliente acaba de pagar, y al anular la venta el pago tiene que volver con ella.
Ejemplo (Beto debe V0 de octubre $ 10.000, costo $ 6.000; compra V1 $ 20.000, costo $ 15.000, el 18/11):

| Caso | A (descartado) | B (elegido) |
|---|---|---|
| "Pagó todo" $ 20.000 | V0 pagada, V1 debe $ 10.000; ganancia nov $ 6.500 | V1 pagada, V0 debe $ 10.000; ganancia nov $ 5.000 |
| Pago parcial $ 12.000 | V1 debe $ 18.000; ganancia $ 4.500 | V1 debe $ 8.000, V0 $ 10.000; ganancia $ 3.000 |
| Pago $ 25.000 | V1 debe $ 5.000; ganancia $ 7.750 | V0 debe $ 5.000; ganancia $ 7.000 |
| Anular V1 devolviendo la plata | Debe $ 10.000; nov a $ 0 | Igual |
| Anular V1 sin devolver | Pago libre: V0 pagada, $ 10.000 a favor; nov $ 4.000 | Igual |

El saldo total es el mismo en los dos; cambian qué venta queda pendiente y la ganancia cobrada del mes. Los ejemplos
aprobados de abajo (Ana, Carlos y el desglose) usan pagos sueltos y no cambian. Implementado en el PR 2B-1:
`aplicarCreditos` (`src/dominio/cuentaCorriente.ts`) y migración de comentarios `20261118130000_imputacion_pago_de_venta.sql`.

## PR 2A: migración `20261118120000_venta_con_pago.sql`
- **`pagos.venta_id`** (opcional, FK a la venta del mismo negocio): qué pago se registró con qué venta. `v_pagos` lo
  suma al final. (Al crearla era informativa; desde el PR 2B-1 decide la imputación, ver arriba.)
- **`registrar_pago_de_venta(p_id, p_venta_id, p_importe, p_medio, p_recibido_por)`** (SECURITY DEFINER, como
  `registrar_pago`): cliente y día (hora de Tucumán) de la venta; rechaza venta anulada, monto ≤ 0, medio inválido y
  socio de otro negocio; idempotente (`on conflict (id) do nothing`): un reintento devuelve el mismo pago solo si
  coincide en todo (venta, monto, medio y quién recibió); si cambia algo, se rechaza.
- **`registrar_venta_con_pago(...)`** (SECURITY INVOKER, como la venta a cliente nuevo): llama a la misma
  `registrar_venta` o `registrar_venta_cliente_nuevo` (con `p_cliente_nuevo` = nombre, teléfono, dirección) y, si hay
  `p_pago_importe`, a `registrar_pago_de_venta`, todo en la misma transacción. "Deuda" = sin pago. Si el pago falla, no
  queda la venta (ni el cliente nuevo). Las funciones anteriores no cambian (la app las sigue usando hasta el PR 2B).
- **`anular_venta_y_pagos(p_venta_id, p_motivo, p_anular_pagos default true)`** (SECURITY DEFINER): `anular_venta` +
  `anular_pago` de cada pago con esa venta, mismo motivo, todo junto. Con `false`, el pago queda a cuenta del cliente.
- `borrar_datos_de_prueba` no cambia: borra los pagos antes que las ventas, y si un pago real apuntara a una venta de
  prueba, la FK frena el borrado entero (no se borra nada).
- Pruebas: `supabase/tests/08_venta_con_pago.test.sql` (52) y cuarta parte de `concurrencia.sh` (doble toque de
  venta con pago a un cliente nuevo: un cliente, una venta, un pago). Con la atomicidad rota a propósito fallan 9.

## Ejemplos numéricos de la propuesta
- Venta $ 10.000, costo $ 6.000 (ganancia $ 4.000): paga $ 5.000 en noviembre → $ 2.000 de ganancia en noviembre.
- Ana: V1 oct $ 10.000 (costo 6.000) y V2 nov $ 20.000 (costo 15.000). Paga $ 15.000 en noviembre → V1 $ 4.000 +
  V2 $ 1.250 = $ 5.250 de ganancia; costo de lo cobrado $ 9.750.
- Carlos: $ 8.000 del papel + V3 $ 12.000 (costo 9.000). Paga $ 10.000 → $ 8.000 al papel (sin ganancia) y $ 2.000 a
  V3 ($ 500 de ganancia).
- Desglose de noviembre con los dos y $ 1.000 de pérdidas: Cobrado $ 25.000 − papel $ 8.000 − costo $ 11.250 −
  pérdidas $ 1.000 = Ganancia neta $ 4.750.

## PR 2B-2: pantalla
- `src/dominio/pagoEnVenta.ts`: `importePagoTodo` (la venta menos el saldo a favor; $ 0 = no se registra pago porque lo
  cubre el saldo a favor) y `comoQueda` (esta venta / deuda anterior / a favor), probados contra `aplicarCreditos`.
- El monto de "Pagó todo" lo calcula la pantalla con el saldo que vio y lo manda: si lo recalculara el servidor, un
  reintento después de guardado daría otro monto y la base lo rechazaría (reintento que no coincide).
- Guardar usa siempre `registrar_venta_con_pago` ("Deuda" = sin pago). Deshacer y Anular usan `anular_venta_y_pagos`;
  Anular pregunta "Se le devolvió la plata" (marcado) solo si la venta tiene pagos registrados con ella.
- Prueba de humo: no se guarda sin elegir, "Pagó todo" con deuda anterior, pago parcial con doble toque, Deshacer anula
  venta y pago, anular sin devolver deja el pago a cuenta (saldo a favor).

## PR 3: ganancia según lo cobrado
- `src/dominio/gananciaCobrada.ts` (`calcularGananciaCobrada`): por cliente, día por día: entran las deudas del día; el
  pago de una venta va a esa venta; el saldo a favor de antes va a lo pendiente (más viejo primero); lo cobrado ese día
  va a lo más viejo y lo que sobra queda a favor. Cada peso aplicado a una venta trae ganancia × acumulado ÷ total −
  lo ya reconocido, en ese día. Lo cobrado de cada venta da igual que `aplicarCreditos` (prueba con fast-check).
- Desglose del período (cierra exacto): Cobrado − de deudas del papel − quedó como saldo a favor + saldo a favor usado
  en ventas − costo de la mercadería de lo cobrado − pérdidas por ajustes = Ganancia neta. El reparto entre socios usa
  `calcularGanancia` con la ganancia cobrada de cada día (porcentaje vigente ese día).
- **A confirmar:** una venta de $ 0 con costo no tiene nada que cobrar; su ganancia (−costo) se reconoce el día de la
  venta (si no, nunca aparecería).
- Prueba de humo: la ganancia neta del mes se calcula aparte en SQL para su escenario (FIFO simple) y se compara con
  Inicio y Resumen.

