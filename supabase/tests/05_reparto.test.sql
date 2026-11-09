-- Pruebas del módulo 1.5: configuración del reparto entre socios.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(21);

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

select is((select count(*)::int from reparto_porcentajes), 0, 'sin configurar: no hay filas (la app usa 50/50)');

select lives_ok($$ select configurar_reparto('10000000-0000-0000-0000-000000000001', hoy_tucuman(),
  '[{"socio_id":"20000000-0000-0000-0000-000000000001","centesimos":6000},{"socio_id":"20000000-0000-0000-0000-000000000002","centesimos":4000}]') $$,
  'configurar 60/40 desde hoy');
select results_eq($$ select socio_id, centesimos, registrado_por from reparto_porcentajes order by centesimos desc $$,
  $$ values ('20000000-0000-0000-0000-000000000001'::uuid, 6000, '20000000-0000-0000-0000-000000000001'::uuid),
            ('20000000-0000-0000-0000-000000000002'::uuid, 4000, '20000000-0000-0000-0000-000000000001'::uuid) $$,
  'quedan los dos porcentajes y quién los cargó');

select lives_ok($$ select configurar_reparto('10000000-0000-0000-0000-000000000001', hoy_tucuman(),
  '[{"socio_id":"20000000-0000-0000-0000-000000000001","centesimos":5050},{"socio_id":"20000000-0000-0000-0000-000000000002","centesimos":4950}]') $$,
  'cambiar el mismo día reemplaza (50,50 / 49,50)');
select is((select count(*)::int from reparto_porcentajes), 2, 'no se duplican filas del mismo día');
select lives_ok($$ select configurar_reparto('10000000-0000-0000-0000-000000000001', hoy_tucuman() + 30,
  '[{"socio_id":"20000000-0000-0000-0000-000000000001","centesimos":5000},{"socio_id":"20000000-0000-0000-0000-000000000002","centesimos":5000}]') $$,
  'programar un cambio a futuro');
select is((select count(distinct vigente_desde)::int from reparto_porcentajes), 2, 'quedan dos vigencias');

select throws_like($$ select configurar_reparto('10000000-0000-0000-0000-000000000001', hoy_tucuman() - 1,
  '[{"socio_id":"20000000-0000-0000-0000-000000000001","centesimos":5000},{"socio_id":"20000000-0000-0000-0000-000000000002","centesimos":5000}]') $$,
  '%no se cambia la ganancia ya repartida%', 'no se puede cambiar el reparto hacia atrás');
select throws_like($$ select configurar_reparto('10000000-0000-0000-0000-000000000001', hoy_tucuman(),
  '[{"socio_id":"20000000-0000-0000-0000-000000000001","centesimos":5000},{"socio_id":"20000000-0000-0000-0000-000000000002","centesimos":4000}]') $$,
  '%deben sumar 100%', 'los porcentajes deben sumar 100');
select throws_like($$ select configurar_reparto('10000000-0000-0000-0000-000000000001', hoy_tucuman(),
  '[{"socio_id":"20000000-0000-0000-0000-000000000001","centesimos":10000}]') $$,
  '%cada socio%', 'hay que indicar a todos los socios');
select throws_like($$ select configurar_reparto('10000000-0000-0000-0000-000000000001', hoy_tucuman(),
  '[{"socio_id":"20000000-0000-0000-0000-000000000001","centesimos":11000},{"socio_id":"20000000-0000-0000-0000-000000000002","centesimos":-1000}]') $$,
  '%entre 0 y 100%', 'porcentajes fuera de 0–100: rechazados');
select throws_ok($$ insert into reparto_porcentajes (negocio_id, vigente_desde, socio_id, centesimos)
  values ('10000000-0000-0000-0000-000000000001', current_date, '20000000-0000-0000-0000-000000000001', 1) $$,
  '42501', null, 'el reparto solo se cambia con la función');

-- Vistas del resumen con el escenario del plan ----------------------------------------------
insert into productos (id, negocio_id, marca, modelo) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Vapex', '8000'),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Nubo', '5000');
insert into clientes (id, negocio_id, nombre) values
  ('50000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000001', 'Ana'),
  ('50000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-000000000001', 'Bruno');
select registrar_compra(gen_random_uuid(), '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', date '2026-09-01', 10, 500, 120000);
select registrar_compra(gen_random_uuid(), '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', date '2026-10-01', 20, 500, 140000);
select registrar_compra(gen_random_uuid(), '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', date '2026-10-02', 15, 300, 150000);
select registrar_venta(gen_random_uuid(), '10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-00000000000a',
  '[{"producto_id":"30000000-0000-0000-0000-000000000001","cantidad":12,"precio_unitario":1000000}]', date '2026-10-05');
select registrar_venta(gen_random_uuid(), '10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-00000000000b',
  '[{"producto_id":"30000000-0000-0000-0000-000000000001","cantidad":3,"precio_unitario":1050000},{"producto_id":"30000000-0000-0000-0000-000000000002","cantidad":2,"precio_unitario":800000}]', date '2026-10-06');
select registrar_venta(gen_random_uuid(), '10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-00000000000b',
  '[{"producto_id":"30000000-0000-0000-0000-000000000001","cantidad":3,"precio_unitario":1050000}]', date '2026-10-20');
select registrar_venta('70000000-0000-0000-0000-000000000099', '10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-00000000000a',
  '[{"producto_id":"30000000-0000-0000-0000-000000000002","cantidad":1,"precio_unitario":900000}]', date '2026-10-21');
select anular_venta('70000000-0000-0000-0000-000000000099', 'prueba de anulada');
select registrar_pago(gen_random_uuid(), '50000000-0000-0000-0000-00000000000b', 5000000, 'efectivo', date '2026-10-25', '20000000-0000-0000-0000-000000000002');
select registrar_pago(gen_random_uuid(), '50000000-0000-0000-0000-00000000000b', 5000000, 'mercado_pago', date '2026-10-30');
select registrar_pago(gen_random_uuid(), '50000000-0000-0000-0000-00000000000a', 6000000, 'transferencia', date '2026-10-10');

select results_eq($$ select dia, ventas, importe, costo_ars, ganancia from v_ganancia_diaria order by dia $$,
  $$ values (date '2026-10-05', 1, 12000000::bigint, 7400000::bigint, 4600000::bigint),
            (date '2026-10-06', 1, 4750000::bigint, 3000000::bigint, 1750000::bigint),
            (date '2026-10-20', 1, 3150000::bigint, 2100000::bigint, 1050000::bigint) $$,
  'ganancia por día: las tres ventas del plan; la anulada no aparece');
select is((select sum(ganancia) from v_ganancia_diaria), 7400000::numeric, 'ganancia bruta de octubre: $74.000');
select results_eq($$ select medio, recibido_por_nombre, total from v_cobros_diarios order by dia $$,
  $$ values ('transferencia'::text, 'Benjamín'::text, 6000000::bigint), ('efectivo'::text, 'Papá'::text, 5000000::bigint),
            ('mercado_pago'::text, 'Benjamín'::text, 5000000::bigint) $$,
  'cobros por día, medio y quién recibió la plata ($160.000)');
select results_eq($$ select invertido_usd, vendido_usd, perdidas_usd, stock_usd, invertido_ars, vendido_ars, perdidas_ars, stock_ars from v_capital
                     where negocio_id = '10000000-0000-0000-0000-000000000001' $$,
  $$ values (19500::bigint, 9600::bigint, 0::bigint, 9900::bigint, 26750000::bigint, 12500000::bigint, 0::bigint, 14250000::bigint) $$,
  'capital: invertido USD 195 / $267.500; vendido USD 96 / $125.000; stock USD 99 / $142.500');
select ok((select invertido_usd = vendido_usd + perdidas_usd + stock_usd and invertido_ars = vendido_ars + perdidas_ars + stock_ars
             from v_capital where negocio_id = '10000000-0000-0000-0000-000000000001'),
  'I3: el capital cierra en USD y en pesos');
select is((select count(*)::int from v_capital), 1, 'cada socio ve solo el capital de su negocio');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select is((select count(*)::int from reparto_porcentajes), 0, 'otro negocio no ve el reparto ajeno');
select is((select count(*)::int from v_ganancia_diaria) + (select count(*)::int from v_cobros_diarios), 0,
  'otro negocio no ve ganancias ni cobros ajenos');
select throws_ok($$ select configurar_reparto('10000000-0000-0000-0000-000000000001', hoy_tucuman(),
  '[{"socio_id":"20000000-0000-0000-0000-000000000001","centesimos":5000},{"socio_id":"20000000-0000-0000-0000-000000000002","centesimos":5000}]') $$,
  '42501', null, 'otro negocio no puede cambiar el reparto');

select * from finish();
rollback;
