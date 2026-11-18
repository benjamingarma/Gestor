-- Solo comentarios (no cambia datos, tablas ni funciones).
-- Decisión de los socios del 18/11/2026: el pago registrado desde la pantalla de venta se aplica primero a ESA
-- venta; lo que sobra y los pagos sueltos siguen yendo a las deudas más viejas (plan A4).
-- La aplicación se calcula en la app (src/dominio/cuentaCorriente.ts, aplicarCreditos); la base no la guarda.
-- Corrige los comentarios de 20261118120000_venta_con_pago.sql, que decían que venta_id era solo informativo.

comment on table public.pagos is
  'Cobros a cuenta del cliente. El pago de una venta (venta_id) se aplica primero a esa venta; el resto, a las deudas más viejas.';

comment on column public.pagos.venta_id is
  'Venta con la que se registró este pago (pantalla de venta). El pago se aplica primero a esa venta; lo que sobra, o todo si la venta se anula, va a las deudas más viejas del cliente.';

comment on function public.registrar_pago_de_venta(uuid, uuid, bigint, text, uuid) is
  'Registra el pago de una venta (mismo cliente y mismo día). Se aplica primero a esa venta y lo que sobra a las deudas más viejas. Idempotente.';
