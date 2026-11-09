-- Pruebas del módulo 1.6: ajustes de stock (regalo, pérdida, rotura) con costo FIFO y anulación.
-- Escenario de la sección 6 del plan: V1, V2, V3 y A1 (rotura 28/10, 1 × P1, sale de C2 → $7.000 / USD 5).
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(53);

-- ---------------------------------------------------------------------------------
-- Datos base (mismo escenario que 03_ventas)
-- ---------------------------------------------------------------------------------
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

insert into productos (id, negocio_id, marca, modelo, precio_general) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Vapex', '8000', 1000000),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Nubo', '5000', 800000);
insert into clientes (id, negocio_id, nombre) values
  ('50000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000001', 'Ana'),
  ('50000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-000000000001', 'Bruno');

-- C1: 10 × USD 5 a $1.200 · C2: 20 × USD 5 a $1.400 · C3: 15 × USD 3 a $1.500
select registrar_compra('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001', date '2026-09-01', 10, 500, 120000, true, null, 'inventario_inicial');
select registrar_compra('40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001', date '2026-10-01', 20, 500, 140000);
select registrar_compra('40000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000002', date '2026-10-02', 15, 300, 150000);

select registrar_venta('70000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-00000000000a',
  '[{"producto_id":"30000000-0000-0000-0000-000000000001","cantidad":12,"precio_unitario":1000000}]', date '2026-10-05');
select registrar_venta('70000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-00000000000b',
  '[{"producto_id":"30000000-0000-0000-0000-000000000002","cantidad":2,"precio_unitario":800000},
    {"producto_id":"30000000-0000-0000-0000-000000000001","cantidad":3,"precio_unitario":1050000}]',
  date '2026-10-06', '20000000-0000-0000-0000-000000000002');
select registrar_venta('70000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-00000000000b',
  '[{"producto_id":"30000000-0000-0000-0000-000000000001","cantidad":3,"precio_unitario":1050000}]', date '2026-10-20');

-- ---------------------------------------------------------------------------------
-- Validaciones
-- ---------------------------------------------------------------------------------
select throws_like($$ select registrar_ajuste(gen_random_uuid(), '10000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001', 1, 'robo') $$, '%Elegí el motivo%', 'motivo fuera de regalo/pérdida/rotura: rechazado');
select throws_like($$ select registrar_ajuste(gen_random_uuid(), '10000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001', 0, 'rotura') $$, '%Cantidad inválida%', 'cantidad 0: rechazada');
select throws_like($$ select registrar_ajuste(gen_random_uuid(), '10000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001', -1, 'rotura') $$, '%Cantidad inválida%', 'cantidad negativa (ajuste de entrada): rechazada (A9)');
select throws_like($$ select registrar_ajuste(gen_random_uuid(), '10000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001', 1, 'rotura', hoy_tucuman() + 1) $$, '%no puede ser futura%', 'fecha futura: rechazada');
select throws_like($$ select registrar_ajuste(gen_random_uuid(), '10000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001', 13, 'perdida') $$, '%pediste 13, hay 12%', 'stock insuficiente: rechazado (A11)');
select throws_ok($$ select registrar_ajuste(gen_random_uuid(), '10000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-0000000000ff', 1, 'rotura') $$, '23503', null, 'producto inexistente: rechazado');
select throws_ok($$ select registrar_ajuste(null, '10000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001', 1, 'rotura') $$, '22023', null, 'sin identificador: rechazado');
select is((select count(*)::int from ajustes_stock), 0, 'ningún intento fallido dejó un ajuste');
select is((select count(*)::int from movimientos_stock where tipo = 'ajuste'), 0, 'ningún intento fallido descontó stock');

-- ---------------------------------------------------------------------------------
-- A1 (28/10): rotura, 1 × P1. Sale de C2 → $7.000 / USD 5.
-- ---------------------------------------------------------------------------------
select lives_ok($$ select registrar_ajuste('60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001', 1, 'rotura', date '2026-10-28', 'Se cayó al piso') $$, 'A1: rotura de 1 × P1');
select results_eq(
  $$ select fecha, cantidad, motivo, costo_total_ars, costo_total_usd, nota, registrado_por, es_prueba
       from ajustes_stock where id = '60000000-0000-0000-0000-000000000001' $$,
  $$ values (date '2026-10-28', 1, 'rotura'::text, 700000::bigint, 500::bigint, 'Se cayó al piso'::text,
             '20000000-0000-0000-0000-000000000001'::uuid, true) $$,
  'A1: costo $7.000 / USD 5 (de C2), quién lo cargó, marcado como prueba');
select results_eq(
  $$ select compra_id, tipo, cantidad, costo_unitario_ars, costo_unitario_usd, (fecha at time zone 'America/Argentina/Tucuman')::date
       from movimientos_stock where ajuste_id = '60000000-0000-0000-0000-000000000001' $$,
  $$ values ('40000000-0000-0000-0000-000000000002'::uuid, 'ajuste'::text, -1, 700000::bigint, 500::bigint, date '2026-10-28') $$,
  'A1: un movimiento de salida de C2, con el costo de C2 y la fecha del ajuste');
select results_eq(
  $$ select compra_id, disponible from v_stock_compras where producto_id = '30000000-0000-0000-0000-000000000001' order by fecha $$,
  $$ values ('40000000-0000-0000-0000-000000000001'::uuid, 0), ('40000000-0000-0000-0000-000000000002'::uuid, 11) $$,
  'stock P1 después de A1: C1 = 0, C2 = 11 (plan 6.6)');

-- Idempotencia
select lives_ok($$ select registrar_ajuste('60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001', 1, 'rotura', date '2026-10-28', 'Se cayó al piso') $$, 'reenviar A1 no falla');
select is((select count(*)::int from ajustes_stock), 1, 'el reenvío no duplica el ajuste');
select is((select count(*)::int from movimientos_stock where tipo = 'ajuste'), 1, 'el reenvío no vuelve a descontar stock');
select throws_ok($$ select registrar_ajuste('60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001', 2, 'rotura') $$, '23505', null, 'mismo id con otros datos: rechazado');

-- ---------------------------------------------------------------------------------
-- Ganancia y capital del plan (secciones 6.7 y 7) con A1
-- ---------------------------------------------------------------------------------
select results_eq(
  $$ select dia, ajustes, unidades, costo_ars, costo_usd from v_perdidas_diarias $$,
  $$ values (date '2026-10-28', 1, 1, 700000::bigint, 500::bigint) $$,
  'pérdidas por día: 28/10, 1 ajuste, 1 u, $7.000 / USD 5');
select is(
  (select sum(ganancia) from v_ganancia_diaria) - (select sum(costo_ars) from v_perdidas_diarias),
  6700000::numeric, 'ganancia neta de octubre: $74.000 − $7.000 = $67.000');
select results_eq(
  $$ select invertido_usd, vendido_usd, perdidas_usd, stock_usd, invertido_ars, vendido_ars, perdidas_ars, stock_ars from v_capital
      where negocio_id = '10000000-0000-0000-0000-000000000001' $$,
  $$ values (19500::bigint, 9600::bigint, 500::bigint, 9400::bigint, 26750000::bigint, 12500000::bigint, 700000::bigint, 13550000::bigint) $$,
  'capital (sección 7): 195 = 96 + 5 + 94 USD y $267.500 = $125.000 + $7.000 + $135.500');
select ok((select invertido_usd = vendido_usd + perdidas_usd + stock_usd and invertido_ars = vendido_ars + perdidas_ars + stock_ars
             from v_capital where negocio_id = '10000000-0000-0000-0000-000000000001'),
  'I3: el capital cierra en USD y en pesos con el ajuste');
select is(
  (select perdidas_ars from v_capital where negocio_id = '10000000-0000-0000-0000-000000000001'),
  (select sum(costo_ars) from v_perdidas_diarias)::bigint,
  'las pérdidas del capital (movimientos) = las pérdidas de la ganancia (ajustes)');
select results_eq(
  $$ select marca, modelo, dia, motivo, registrado_por_nombre from v_ajustes $$,
  $$ values ('Vapex'::text, '8000'::text, date '2026-10-28', 'rotura'::text, 'Benjamín'::text) $$,
  'la vista de ajustes trae producto, día, motivo y quién lo cargó');

-- No se puede anular una compra de la que salió un ajuste.
select throws_like($$ select anular_compra('40000000-0000-0000-0000-000000000002', 'intento') $$,
  '%ya salieron%', 'no se anula una compra de la que salió un ajuste');

-- ---------------------------------------------------------------------------------
-- Ajuste que cruza dos compras, anulación y re-consumo (se deshace al final)
-- ---------------------------------------------------------------------------------
savepoint antes_de_a2;
-- C4: 5 × P2 a USD 4 y $1.500 → $6.000 por unidad
select registrar_compra('40000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000002', date '2026-10-25', 5, 400, 150000);
select lives_ok($$ select registrar_ajuste('60000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000002', 14, 'regalo', date '2026-10-29') $$, 'A2: regalo de 14 × P2');
select results_eq(
  $$ select costo_total_ars, costo_total_usd from ajustes_stock where id = '60000000-0000-0000-0000-000000000002' $$,
  $$ values (6450000::bigint, 4300::bigint) $$,
  'A2 cruza dos compras: 13 de C3 ($4.500 / USD 3) + 1 de C4 ($6.000 / USD 4) = $64.500 / USD 43');
select results_eq(
  $$ select compra_id, cantidad from movimientos_stock where ajuste_id = '60000000-0000-0000-0000-000000000002' order by compra_id $$,
  $$ values ('40000000-0000-0000-0000-000000000003'::uuid, -13), ('40000000-0000-0000-0000-000000000004'::uuid, -1) $$,
  'A2: sale primero lo más viejo (FIFO)');
select is(
  (select count(*)::int from ajustes_stock a
    where a.costo_total_ars <> (select -sum(m.cantidad * m.costo_unitario_ars) from movimientos_stock m where m.ajuste_id = a.id and m.tipo = 'ajuste')
       or a.costo_total_usd <> (select -sum(m.cantidad * m.costo_unitario_usd) from movimientos_stock m where m.ajuste_id = a.id and m.tipo = 'ajuste')
       or a.cantidad <> (select -sum(m.cantidad) from movimientos_stock m where m.ajuste_id = a.id and m.tipo = 'ajuste')),
  0, 'I2: cantidad y costo (USD y pesos) de cada ajuste = suma de sus movimientos');

select throws_like($$ select anular_ajuste('60000000-0000-0000-0000-000000000002', '  ') $$,
  '%motivo%', 'anular exige motivo');
select lives_ok($$ select anular_ajuste('60000000-0000-0000-0000-000000000002', 'No era regalo') $$, 'anular A2');
select results_eq(
  $$ select anulado_por, motivo_anulacion, costo_total_ars from ajustes_stock where id = '60000000-0000-0000-0000-000000000002' $$,
  $$ values ('20000000-0000-0000-0000-000000000001'::uuid, 'No era regalo'::text, 6450000::bigint) $$,
  'el ajuste anulado queda en el historial con quién lo anuló, el motivo y su costo original');
select results_eq(
  $$ select compra_id, disponible from v_stock_compras where producto_id = '30000000-0000-0000-0000-000000000002' order by fecha $$,
  $$ values ('40000000-0000-0000-0000-000000000003'::uuid, 13), ('40000000-0000-0000-0000-000000000004'::uuid, 5) $$,
  'al anular, cada unidad vuelve a la compra de la que salió');
select results_eq(
  $$ select compra_id, cantidad, costo_unitario_ars from movimientos_stock
      where ajuste_id = '60000000-0000-0000-0000-000000000002' and tipo = 'anulacion_ajuste' order by compra_id $$,
  $$ values ('40000000-0000-0000-0000-000000000003'::uuid, 13, 450000::bigint), ('40000000-0000-0000-0000-000000000004'::uuid, 1, 600000::bigint) $$,
  'la anulación devuelve con el costo original de cada compra');
select lives_ok($$ select anular_ajuste('60000000-0000-0000-0000-000000000002', 'Otra vez') $$, 'anular dos veces no falla');
select is((select count(*)::int from movimientos_stock where ajuste_id = '60000000-0000-0000-0000-000000000002'), 4,
  'anular dos veces no duplica la devolución');
select is((select sum(costo_ars) from v_perdidas_diarias), 700000::numeric, 'el ajuste anulado no cuenta como pérdida');
select ok((select invertido_ars = vendido_ars + perdidas_ars + stock_ars and invertido_usd = vendido_usd + perdidas_usd + stock_usd
             from v_capital where negocio_id = '10000000-0000-0000-0000-000000000001'),
  'I3: el capital cierra después de anular');
select lives_ok($$ select registrar_ajuste('60000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000002', 1, 'perdida') $$, 'A3: pérdida de 1 × P2 después de la anulación');
select is((select costo_total_ars from ajustes_stock where id = '60000000-0000-0000-0000-000000000003'), 450000::bigint,
  'después de anular, lo devuelto a la compra más vieja sale primero');

-- Producto desactivado: se puede dar de baja lo que quedó.
update productos set activo = false where id = '30000000-0000-0000-0000-000000000002';
select lives_ok($$ select registrar_ajuste(gen_random_uuid(), '10000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000002', 1, 'perdida') $$, 'se puede ajustar un producto desactivado');
rollback to savepoint antes_de_a2;

-- ---------------------------------------------------------------------------------
-- Inmutabilidad
-- ---------------------------------------------------------------------------------
select throws_ok($$ insert into ajustes_stock (id, negocio_id, producto_id, fecha, cantidad, motivo, costo_total_ars, costo_total_usd)
  values (gen_random_uuid(), '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', current_date, 1, 'rotura', 0, 0) $$,
  '42501', null, 'no se insertan ajustes directo (solo con registrar_ajuste)');
select throws_ok($$ update ajustes_stock set cantidad = 5 $$, '42501', null, 'los ajustes no se modifican');
select throws_ok($$ delete from ajustes_stock $$, '42501', null, 'los ajustes no se borran');

reset role;
select set_config('request.jwt.claims', '', true);
select throws_ok($$ update ajustes_stock set costo_total_ars = 1 where id = '60000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'ni el administrador cambia el costo histórico de un ajuste');
select throws_ok($$ delete from ajustes_stock where id = '60000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'ni el administrador borra un ajuste');
select throws_ok($$ insert into movimientos_stock (negocio_id, compra_id, producto_id, tipo, cantidad, costo_unitario_usd, costo_unitario_ars, fecha, registrado_por)
  values ('10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001',
          'ajuste', -1, 500, 700000, now(), '20000000-0000-0000-0000-000000000001') $$,
  '23514', null, 'un movimiento de ajuste sin su ajuste: rechazado');

-- ---------------------------------------------------------------------------------
-- Otro negocio y anónimo
-- ---------------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select is((select count(*)::int from ajustes_stock) + (select count(*)::int from v_ajustes) + (select count(*)::int from v_perdidas_diarias), 0,
  'otro negocio no ve ajustes ni pérdidas ajenas');
select throws_ok($$ select registrar_ajuste(gen_random_uuid(), '10000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001', 1, 'rotura') $$, '42501', null, 'no puede ajustar en un negocio ajeno');
select throws_ok($$ select anular_ajuste('60000000-0000-0000-0000-000000000001', 'x') $$, '23503', null, 'no puede anular ajustes ajenos');

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select throws_ok($$ select * from ajustes_stock $$, '42501', null, 'el anónimo no ve ajustes');
select throws_ok($$ select registrar_ajuste(gen_random_uuid(), '10000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001', 1, 'rotura') $$, '42501', null, 'el anónimo no registra ajustes');

-- ---------------------------------------------------------------------------------
-- Borrado de datos de prueba
-- ---------------------------------------------------------------------------------
reset role;
select set_config('request.jwt.claims', '', true);
select results_eq(
  $$ select tabla, filas_de_prueba from contar_datos_de_prueba('10000000-0000-0000-0000-000000000001') where tabla = 'ajustes_stock' $$,
  $$ values ('ajustes_stock'::text, 1::bigint) $$,
  'el conteo de datos de prueba incluye los ajustes');
select results_eq(
  $$ select tabla, filas_borradas from borrar_datos_de_prueba('10000000-0000-0000-0000-000000000001', 'BORRAR DATOS DE PRUEBA')
      where tabla in ('movimientos_stock', 'ajustes_stock') $$,
  $$ values ('movimientos_stock'::text, 9::bigint), ('ajustes_stock'::text, 1::bigint) $$,
  'el borrado de datos de prueba incluye los ajustes y sus movimientos');

select * from finish();
rollback;
