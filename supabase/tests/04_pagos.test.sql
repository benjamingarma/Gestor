-- Pruebas del módulo 1.4: pagos, saldos iniciales y totales de cuenta corriente.
-- Escenario de la sección 6.5 del plan.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(37);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'socio.a@pgtap.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b1', 'otro@pgtap.test',    'authenticated', 'authenticated');
insert into negocios (id, nombre) values
  ('10000000-0000-0000-0000-000000000001', 'Negocio de prueba'),
  ('10000000-0000-0000-0000-000000000002', 'Otro negocio');
insert into socios (id, negocio_id, nombre, user_id, orden) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Benjamín', '00000000-0000-0000-0000-0000000000a1', 1),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Papá', null, 2),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 'Otro socio', '00000000-0000-0000-0000-0000000000b1', 1);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

insert into productos (id, negocio_id, marca, modelo) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Vapex', '8000'),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Nubo', '5000');
insert into clientes (id, negocio_id, nombre) values
  ('50000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000001', 'Ana'),
  ('50000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-000000000001', 'Bruno');
select registrar_compra(gen_random_uuid(), '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', date '2026-09-01', 10, 500, 120000);
select registrar_compra(gen_random_uuid(), '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', date '2026-10-01', 20, 500, 140000);
select registrar_compra(gen_random_uuid(), '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', date '2026-10-02', 15, 300, 150000);
select registrar_venta('70000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-00000000000a',
  '[{"producto_id":"30000000-0000-0000-0000-000000000001","cantidad":12,"precio_unitario":1000000}]', date '2026-10-05');
select registrar_venta('70000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-00000000000b',
  '[{"producto_id":"30000000-0000-0000-0000-000000000001","cantidad":3,"precio_unitario":1050000},
    {"producto_id":"30000000-0000-0000-0000-000000000002","cantidad":2,"precio_unitario":800000}]', date '2026-10-06');
select registrar_venta('70000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-00000000000b',
  '[{"producto_id":"30000000-0000-0000-0000-000000000001","cantidad":3,"precio_unitario":1050000}]', date '2026-10-20');

-- Saldos iniciales -------------------------------------------------------------------------
select lives_ok($$ select registrar_saldo_inicial('80000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-00000000000b',
  'deuda', 2000000, date '2026-09-01', 'Del cuaderno') $$, 'cargar deuda del papel de Bruno ($20.000)');
select results_eq($$ select tipo, importe, registrado_por, es_prueba from saldos_iniciales $$,
  $$ values ('deuda'::text, 2000000::bigint, '20000000-0000-0000-0000-000000000001'::uuid, true) $$, 'saldo inicial guardado');
select lives_ok($$ select registrar_saldo_inicial('80000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-00000000000b',
  'deuda', 2000000, date '2026-09-01') $$, 'reenviar el mismo saldo no falla');
select is((select count(*)::int from saldos_iniciales), 1, 'y no lo duplica');
select throws_like($$ select registrar_saldo_inicial(gen_random_uuid(), '50000000-0000-0000-0000-00000000000b', 'deuda', 100, hoy_tucuman() + 1) $$,
  '%futura%', 'saldo inicial con fecha futura: rechazado');
select throws_ok($$ select registrar_saldo_inicial(gen_random_uuid(), '50000000-0000-0000-0000-00000000000b', 'deuda', 0, date '2026-09-01') $$,
  '23514', null, 'saldo inicial de $0: rechazado');

select results_eq($$ select total_ventas, deuda_inicial, total_pagos, saldo from v_cuentas_clientes where cliente_id = '50000000-0000-0000-0000-00000000000b' $$,
  $$ values (7900000::bigint, 2000000::bigint, 0::bigint, 9900000::bigint) $$, 'Bruno debe $99.000 (V2 + V3 + papel)');

-- Pagos ----------------------------------------------------------------------------------------
select lives_ok($$ select registrar_pago('90000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-00000000000b', 5000000,
  'efectivo', date '2026-10-25', '20000000-0000-0000-0000-000000000002') $$, 'Pago 1: $50.000 en efectivo, lo recibió Papá');
select results_eq($$ select importe, medio, recibido_por, registrado_por, fecha, es_prueba from pagos where id = '90000000-0000-0000-0000-000000000001' $$,
  $$ values (5000000::bigint, 'efectivo'::text, '20000000-0000-0000-0000-000000000002'::uuid, '20000000-0000-0000-0000-000000000001'::uuid, date '2026-10-25', true) $$,
  'el pago guarda medio, quién recibió la plata y quién lo cargó');
select is((select saldo from v_cuentas_clientes where cliente_id = '50000000-0000-0000-0000-00000000000b'), 4900000::bigint, 'Bruno debe $49.000');

select lives_ok($$ select registrar_pago('90000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-00000000000b', 5000000,
  'mercado_pago', date '2026-10-30') $$, 'Pago 2: $50.000 por Mercado Pago (recibió el socio logueado)');
select is((select recibido_por from pagos where id = '90000000-0000-0000-0000-000000000002'), '20000000-0000-0000-0000-000000000001'::uuid,
  'sin indicar, recibió el socio logueado');
select results_eq($$ select total_pagos, saldo, ultimo_pago from v_cuentas_clientes where cliente_id = '50000000-0000-0000-0000-00000000000b' $$,
  $$ values (10000000::bigint, -100000::bigint, date '2026-10-30') $$, 'Bruno queda con $1.000 a favor');

select lives_ok($$ select registrar_pago('90000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-00000000000a', 6000000, 'transferencia', date '2026-10-10') $$,
  'Ana paga $60.000 por transferencia');
select is((select saldo from v_cuentas_clientes where cliente_id = '50000000-0000-0000-0000-00000000000a'), 6000000::bigint, 'Ana debe $60.000');

-- Control I4: suma de saldos = deudas − créditos
select is((select sum(saldo) from v_cuentas_clientes where negocio_id = '10000000-0000-0000-0000-000000000001'),
  (select sum(importe) from v_ventas where anulado_en is null) + 2000000 - 16000000::numeric,
  'I4: suma de saldos = ventas + deudas del papel − pagos ($199.000 + $20.000 − $160.000 = $59.000)');

-- Idempotencia y validaciones ---------------------------------------------------------------
select lives_ok($$ select registrar_pago('90000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-00000000000a', 6000000, 'transferencia', date '2026-10-10') $$,
  'reenviar el mismo pago no falla');
select is((select count(*)::int from pagos), 3, 'y no lo duplica');
select throws_ok($$ select registrar_pago('90000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-00000000000a', 1, 'efectivo') $$,
  '23505', null, 'mismo id con otros datos: rechazado');
select throws_like($$ select registrar_pago(gen_random_uuid(), '50000000-0000-0000-0000-00000000000a', 0, 'efectivo') $$,
  '%mayor que cero%', 'pago de $0: rechazado');
select throws_ok($$ select registrar_pago(gen_random_uuid(), '50000000-0000-0000-0000-00000000000a', 100, 'cheque') $$,
  '23514', null, 'medio de pago desconocido: rechazado');
select throws_like($$ select registrar_pago(gen_random_uuid(), '50000000-0000-0000-0000-00000000000a', 100, 'efectivo', hoy_tucuman() + 1) $$,
  '%futura%', 'pago con fecha futura: rechazado');
select throws_like($$ select registrar_pago(gen_random_uuid(), '50000000-0000-0000-0000-00000000000a', 100, 'efectivo', null, '20000000-0000-0000-0000-000000000003') $$,
  '%no es de este negocio%', 'receptor de otro negocio: rechazado');

-- Inmutabilidad -------------------------------------------------------------------------------
select throws_ok($$ insert into pagos (id, negocio_id, cliente_id, fecha, importe, medio, recibido_por)
  values (gen_random_uuid(), '10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-00000000000a', current_date, 1, 'efectivo', '20000000-0000-0000-0000-000000000001') $$,
  '42501', null, 'no se insertan pagos directo');
select throws_ok($$ update pagos set importe = 1 $$, '42501', null, 'los pagos no se modifican');
select throws_ok($$ delete from pagos $$, '42501', null, 'los pagos no se borran');

-- Anulaciones ------------------------------------------------------------------------------------
select throws_like($$ select anular_pago('90000000-0000-0000-0000-000000000002', '') $$, '%motivo%', 'anular un pago exige motivo');
select lives_ok($$ select anular_pago('90000000-0000-0000-0000-000000000002', 'Se cargó dos veces') $$, 'anular el Pago 2');
select is((select saldo from v_cuentas_clientes where cliente_id = '50000000-0000-0000-0000-00000000000b'), 4900000::bigint,
  'al anular el Pago 2, Bruno vuelve a deber $49.000');
select lives_ok($$ select anular_pago('90000000-0000-0000-0000-000000000002', 'otra vez') $$, 'anular dos veces no falla');

-- Anular una venta ya cobrada: el pago queda como saldo a favor (A15)
select lives_ok($$ select anular_venta('70000000-0000-0000-0000-000000000001', 'Error') $$, 'anular la venta de Ana ya cobrada en parte');
select is((select saldo from v_cuentas_clientes where cliente_id = '50000000-0000-0000-0000-00000000000a'), -6000000::bigint,
  'los $60.000 que pagó Ana quedan a su favor');

select lives_ok($$ select anular_saldo_inicial('80000000-0000-0000-0000-000000000001', 'Ya lo había pagado') $$, 'anular la deuda del papel');
select is((select saldo from v_cuentas_clientes where cliente_id = '50000000-0000-0000-0000-00000000000b'), 2900000::bigint,
  'sin la deuda del papel, Bruno debe $29.000');

-- Otro negocio ---------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select is((select count(*)::int from pagos) + (select count(*)::int from saldos_iniciales) + (select count(*)::int from v_cuentas_clientes), 0,
  'otro negocio no ve pagos, saldos ni cuentas ajenas');
select throws_ok($$ select registrar_pago(gen_random_uuid(), '50000000-0000-0000-0000-00000000000a', 100, 'efectivo') $$,
  '23503', null, 'no puede cobrar a clientes ajenos');

reset role;
select set_config('request.jwt.claims', '', true);
select results_eq(
  $$ select tabla, filas_borradas from borrar_datos_de_prueba('10000000-0000-0000-0000-000000000001', 'BORRAR DATOS DE PRUEBA')
      where tabla in ('pagos', 'saldos_iniciales') $$,
  $$ values ('pagos'::text, 3::bigint), ('saldos_iniciales'::text, 1::bigint) $$,
  'el borrado de datos de prueba incluye pagos y saldos iniciales'
);

select * from finish();
rollback;
