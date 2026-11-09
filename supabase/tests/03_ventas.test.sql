-- Pruebas del módulo 1.3: ventas con varios productos, FIFO, precios especiales y anulación.
-- Escenario de la sección 6 del plan (V1, V2, V3) y controles del capital (sección 7).
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(70);

-- ---------------------------------------------------------------------------------
-- Datos base
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

-- ---------------------------------------------------------------------------------
-- Precios especiales
-- ---------------------------------------------------------------------------------
select lives_ok($$ select fijar_precio_especial('50000000-0000-0000-0000-00000000000b', '30000000-0000-0000-0000-000000000001', 1100000) $$,
  'fijar precio especial');
select lives_ok($$ select fijar_precio_especial('50000000-0000-0000-0000-00000000000b', '30000000-0000-0000-0000-000000000001', 1050000) $$,
  'cambiar precio especial');
select results_eq($$ select precio, registrado_por, es_prueba from precios_especiales $$,
  $$ values (1050000::bigint, '20000000-0000-0000-0000-000000000001'::uuid, true) $$,
  'queda un solo precio especial (Bruno, P1: $10.500), con quién lo cargó');
select lives_ok($$ select fijar_precio_especial('50000000-0000-0000-0000-00000000000a', '30000000-0000-0000-0000-000000000002', 700000) $$,
  'otro precio especial');
select lives_ok($$ select fijar_precio_especial('50000000-0000-0000-0000-00000000000a', '30000000-0000-0000-0000-000000000002', null) $$,
  'quitar un precio especial');
select is((select count(*)::int from precios_especiales), 1, 'el precio quitado ya no está');
select throws_ok($$ insert into precios_especiales (negocio_id, cliente_id, producto_id, precio)
  values ('10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-00000000000a', '30000000-0000-0000-0000-000000000001', 1) $$,
  '42501', null, 'los precios especiales se cargan solo con la función');

-- ---------------------------------------------------------------------------------
-- V1 (05/10): Ana, 12 × P1 a $10.000. Consume C1 entera (TC $1.200) + 2 de C2 (TC $1.400).
-- ---------------------------------------------------------------------------------
select lives_ok($$
  select registrar_venta('70000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
    '50000000-0000-0000-0000-00000000000a',
    '[{"producto_id":"30000000-0000-0000-0000-000000000001","cantidad":12,"precio_unitario":1000000}]',
    date '2026-10-05')
$$, 'V1: venta que cruza dos compras con distinto tipo de cambio');

select results_eq(
  $$ select importe, costo_ars, costo_usd, ganancia, unidades from v_ventas where venta_id = '70000000-0000-0000-0000-000000000001' $$,
  $$ values (12000000::bigint, 7400000::bigint, 6000::bigint, 4600000::bigint, 12) $$,
  'V1: importe $120.000, costo $74.000 (USD 60), ganancia $46.000'
);
select results_eq(
  $$ select m.compra_id, m.cantidad, m.costo_unitario_ars, m.costo_unitario_usd
       from movimientos_stock m join venta_items i on i.id = m.venta_item_id
      where i.venta_id = '70000000-0000-0000-0000-000000000001' order by m.costo_unitario_ars $$,
  $$ values ('40000000-0000-0000-0000-000000000001'::uuid, -10, 600000::bigint, 500::bigint),
            ('40000000-0000-0000-0000-000000000002'::uuid, -2, 700000::bigint, 500::bigint) $$,
  'V1: 10 unidades salen de C1 a $6.000 y 2 de C2 a $7.000'
);
select results_eq(
  $$ select compra_id, disponible from v_stock_compras where producto_id = '30000000-0000-0000-0000-000000000001' order by fecha $$,
  $$ values ('40000000-0000-0000-0000-000000000001'::uuid, 0), ('40000000-0000-0000-0000-000000000002'::uuid, 18) $$,
  'stock P1 después de V1: C1 = 0, C2 = 18'
);
select results_eq(
  $$ select vendido_por, registrado_por, es_prueba, (fecha at time zone 'America/Argentina/Tucuman')::date from ventas
      where id = '70000000-0000-0000-0000-000000000001' $$,
  $$ values ('20000000-0000-0000-0000-000000000001'::uuid, '20000000-0000-0000-0000-000000000001'::uuid, true, date '2026-10-05') $$,
  'V1: vendió y registró el socio logueado, marcada como prueba, fecha 05/10 en Tucumán'
);

-- Idempotencia ---------------------------------------------------------------------------------
select lives_ok($$
  select registrar_venta('70000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
    '50000000-0000-0000-0000-00000000000a',
    '[{"producto_id":"30000000-0000-0000-0000-000000000001","cantidad":12,"precio_unitario":1000000}]',
    date '2026-10-05')
$$, 'reenviar V1 no falla');
select is((select count(*)::int from ventas), 1, 'el reenvío no duplica la venta');
select is((select count(*)::int from movimientos_stock where tipo = 'venta'), 2, 'el reenvío no vuelve a descontar stock');
select throws_ok($$
  select registrar_venta('70000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
    '50000000-0000-0000-0000-00000000000a',
    '[{"producto_id":"30000000-0000-0000-0000-000000000001","cantidad":11,"precio_unitario":1000000}]')
$$, '23505', null, 'mismo id con otros datos: rechazado');

-- ---------------------------------------------------------------------------------
-- V2 (06/10): Bruno, P1 × 3 a $10.500 + P2 × 2 a $8.000. Vendió Papá.
-- ---------------------------------------------------------------------------------
select lives_ok($$
  select registrar_venta('70000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001',
    '50000000-0000-0000-0000-00000000000b',
    '[{"producto_id":"30000000-0000-0000-0000-000000000002","cantidad":2,"precio_unitario":800000},
      {"producto_id":"30000000-0000-0000-0000-000000000001","cantidad":3,"precio_unitario":1050000}]',
    date '2026-10-06', '20000000-0000-0000-0000-000000000002')
$$, 'V2: venta con dos productos');
select results_eq(
  $$ select importe, costo_ars, costo_usd, ganancia, vendido_por_nombre from v_ventas where venta_id = '70000000-0000-0000-0000-000000000002' $$,
  $$ values (4750000::bigint, 3000000::bigint, 2100::bigint, 1750000::bigint, 'Papá'::text) $$,
  'V2: $47.500, costo $30.000 (USD 21), ganancia $17.500, vendió Papá'
);
select results_eq(
  $$ select renglon, cantidad, precio_unitario, costo_total_ars, costo_total_usd from venta_items
      where venta_id = '70000000-0000-0000-0000-000000000002' order by renglon $$,
  $$ values (1, 2, 800000::bigint, 900000::bigint, 600::bigint), (2, 3, 1050000::bigint, 2100000::bigint, 1500::bigint) $$,
  'V2: cada renglón guarda su precio y su costo FIFO, en el orden en que se cargó'
);

-- V3 (20/10): Bruno, 3 × P1 a $10.500.
select lives_ok($$
  select registrar_venta('70000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001',
    '50000000-0000-0000-0000-00000000000b',
    '[{"producto_id":"30000000-0000-0000-0000-000000000001","cantidad":3,"precio_unitario":1050000}]',
    date '2026-10-20')
$$, 'V3');
select results_eq(
  $$ select importe, costo_ars, ganancia from v_ventas where venta_id = '70000000-0000-0000-0000-000000000003' $$,
  $$ values (3150000::bigint, 2100000::bigint, 1050000::bigint) $$,
  'V3: $31.500, costo $21.000, ganancia $10.500'
);

-- Totales (sección 6.7 sin ajustes) y cierre del capital (sección 7) --------------------------
select results_eq(
  $$ select sum(importe), sum(costo_ars), sum(costo_usd), sum(ganancia) from v_ventas where anulado_en is null $$,
  $$ values (19900000::numeric, 12500000::numeric, 9600::numeric, 7400000::numeric) $$,
  'ventas $199.000, costo $125.000 (USD 96), ganancia bruta $74.000'
);
select results_eq(
  $$ select sum(valor_usd), sum(valor_ars) from v_stock_productos $$,
  $$ values (9900::numeric, 14250000::numeric) $$,
  'stock que queda: USD 99 / $142.500 (C2 12 × $7.000 + C3 13 × $4.500)'
);
select is(
  (select sum(costo_total_usd) from compras where anulado_en is null),
  (select sum(costo_usd) from v_ventas where anulado_en is null) + (select sum(valor_usd) from v_stock_productos),
  'I3 en USD: invertido (195) = costo vendido (96) + stock (99)'
);
select is(
  (select sum(costo_total_ars) from compras where anulado_en is null),
  (select sum(costo_ars) from v_ventas where anulado_en is null) + (select sum(valor_ars) from v_stock_productos),
  'I3 en pesos: invertido ($267.500) = costo vendido ($125.000) + stock ($142.500)'
);
select is(
  (select count(*)::int from venta_items i
    where i.costo_total_ars <> (select -sum(m.cantidad * m.costo_unitario_ars) from movimientos_stock m where m.venta_item_id = i.id and m.tipo = 'venta')
       or i.costo_total_usd <> (select -sum(m.cantidad * m.costo_unitario_usd) from movimientos_stock m where m.venta_item_id = i.id and m.tipo = 'venta')
       or i.cantidad <> (select -sum(m.cantidad) from movimientos_stock m where m.venta_item_id = i.id and m.tipo = 'venta')),
  0, 'I2: cantidad y costo (USD y pesos) de cada renglón = suma de sus movimientos'
);

-- Precio propuesto: último precio pagado por cliente y producto
select results_eq(
  $$ select cliente_id, producto_id, precio_unitario, dia from v_ultimo_precio_cliente order by cliente_id, producto_id $$,
  $$ values ('50000000-0000-0000-0000-00000000000a'::uuid, '30000000-0000-0000-0000-000000000001'::uuid, 1000000::bigint, date '2026-10-05'),
            ('50000000-0000-0000-0000-00000000000b'::uuid, '30000000-0000-0000-0000-000000000001'::uuid, 1050000::bigint, date '2026-10-20'),
            ('50000000-0000-0000-0000-00000000000b'::uuid, '30000000-0000-0000-0000-000000000002'::uuid, 800000::bigint, date '2026-10-06') $$,
  'último precio que pagó cada cliente por cada producto'
);
select is((select ultima_venta from v_clientes where cliente_id = '50000000-0000-0000-0000-00000000000b'), date '2026-10-20',
  'la última venta cuenta para la próxima visita del cliente');

-- ---------------------------------------------------------------------------------
-- Validaciones
-- ---------------------------------------------------------------------------------
select throws_like($$
  select registrar_venta(gen_random_uuid(), '10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-00000000000a',
    '[{"producto_id":"30000000-0000-0000-0000-000000000002","cantidad":1,"precio_unitario":800000},
      {"producto_id":"30000000-0000-0000-0000-000000000001","cantidad":13,"precio_unitario":1000000}]')
$$, '%No hay stock suficiente de Vapex 8000: pediste 13, hay 12%', 'stock insuficiente: mensaje claro');
select is((select count(*)::int from ventas), 3, 'stock insuficiente: no se grabó la venta');
select results_eq(
  $$ select sum(disponible)::int from v_stock_compras where producto_id = '30000000-0000-0000-0000-000000000002' $$,
  array[13], 'stock insuficiente: el otro producto de la misma venta no se descontó (todo o nada)'
);
select throws_like($$
  select registrar_venta(gen_random_uuid(), '10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-00000000000a',
    '[{"producto_id":"30000000-0000-0000-0000-000000000001","cantidad":1,"precio_unitario":1},
      {"producto_id":"30000000-0000-0000-0000-000000000001","cantidad":1,"precio_unitario":1}]')
$$, '%producto repetido%', 'producto repetido en la misma venta: rechazado');
select throws_like($$
  select registrar_venta(gen_random_uuid(), '10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-00000000000a', '[]')
$$, '%entre 1 y 50%', 'venta sin productos: rechazada');
select throws_like($$
  select registrar_venta(gen_random_uuid(), '10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-00000000000a',
    '[{"producto_id":"30000000-0000-0000-0000-000000000001","cantidad":0,"precio_unitario":1}]')
$$, '%Cantidad inválida%', 'cantidad cero: rechazada');
select throws_like($$
  select registrar_venta(gen_random_uuid(), '10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-00000000000a',
    '[{"producto_id":"30000000-0000-0000-0000-000000000001","cantidad":1,"precio_unitario":-5}]')
$$, '%Precio inválido%', 'precio negativo: rechazado');
select throws_like($$
  select registrar_venta(gen_random_uuid(), '10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-00000000000a',
    '[{"producto_id":"30000000-0000-0000-0000-000000000001","cantidad":1,"precio_unitario":100}]', hoy_tucuman() + 1)
$$, '%no puede ser futura%', 'fecha futura: rechazada');
select throws_like($$
  select registrar_venta(gen_random_uuid(), '10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-00000000000a',
    '[{"producto_id":"30000000-0000-0000-0000-000000000001","cantidad":1,"precio_unitario":100}]', null,
    '20000000-0000-0000-0000-000000000003')
$$, '%no es de este negocio%', 'vendedor de otro negocio: rechazado');
select lives_ok($$
  select registrar_venta('70000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-00000000000a',
    '[{"producto_id":"30000000-0000-0000-0000-000000000002","cantidad":1,"precio_unitario":0}]')
$$, 'precio $0 permitido (ej: bonificación)');
select ok((select (fecha at time zone 'America/Argentina/Tucuman')::date = hoy_tucuman() from ventas where id = '70000000-0000-0000-0000-000000000009'),
  'sin fecha, la venta es de hoy');
select lives_ok($$ select anular_venta('70000000-0000-0000-0000-000000000009', 'era de prueba') $$, 'anular la venta de $0');

select lives_ok($$ select archivar_cliente('50000000-0000-0000-0000-00000000000a', true) $$, 'archivar a Ana');
select throws_like($$
  select registrar_venta(gen_random_uuid(), '10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-00000000000a',
    '[{"producto_id":"30000000-0000-0000-0000-000000000002","cantidad":1,"precio_unitario":100}]')
$$, '%archivado%', 'no se vende a un cliente archivado');
select lives_ok($$ select archivar_cliente('50000000-0000-0000-0000-00000000000a', false) $$, 'desarchivar a Ana');

-- Costo congelado: una compra cargada después con fecha anterior no cambia ventas pasadas.
select registrar_compra('40000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001', date '2026-08-01', 5, 400, 100000);
select is((select costo_ars from v_ventas where venta_id = '70000000-0000-0000-0000-000000000001'), 7400000::bigint,
  'el costo de V1 no cambia aunque aparezca una compra más vieja');

-- Inmutabilidad --------------------------------------------------------------------------------
select throws_ok($$ insert into ventas (id, negocio_id, cliente_id, fecha, vendido_por)
  values (gen_random_uuid(), '10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-00000000000a', now(), '20000000-0000-0000-0000-000000000001') $$,
  '42501', null, 'no se insertan ventas directo');
select throws_ok($$ update ventas set fecha = now() where id = '70000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'las ventas no se modifican');
select throws_ok($$ update venta_items set precio_unitario = 1 $$, '42501', null, 'los renglones no se modifican');
select throws_ok($$ delete from ventas where id = '70000000-0000-0000-0000-000000000001' $$, '42501', null, 'las ventas no se borran');
select throws_ok($$ delete from venta_items $$, '42501', null, 'los renglones no se borran');

-- ---------------------------------------------------------------------------------
-- Anulación
-- ---------------------------------------------------------------------------------
select throws_like($$ select anular_venta('70000000-0000-0000-0000-000000000001', ' ') $$, '%motivo%', 'anular exige motivo');
select lives_ok($$ select anular_venta('70000000-0000-0000-0000-000000000001', 'Error de carga') $$, 'anular V1');
select results_eq(
  $$ select compra_id, disponible from v_stock_compras where producto_id = '30000000-0000-0000-0000-000000000001' and fecha >= '2026-09-01' order by fecha $$,
  $$ values ('40000000-0000-0000-0000-000000000001'::uuid, 10), ('40000000-0000-0000-0000-000000000002'::uuid, 14) $$,
  'al anular V1, cada unidad vuelve a su compra de origen (C1 = 10, C2 = 12 + 2)'
);
select results_eq(
  $$ select m.compra_id, m.cantidad, m.costo_unitario_ars from movimientos_stock m join venta_items i on i.id = m.venta_item_id
      where i.venta_id = '70000000-0000-0000-0000-000000000001' and m.tipo = 'anulacion_venta' order by m.costo_unitario_ars $$,
  $$ values ('40000000-0000-0000-0000-000000000001'::uuid, 10, 600000::bigint), ('40000000-0000-0000-0000-000000000002'::uuid, 2, 700000::bigint) $$,
  'la devolución usa el costo original de cada compra'
);
select lives_ok($$ select anular_venta('70000000-0000-0000-0000-000000000001', 'otra vez') $$, 'anular dos veces no falla');
select is((select count(*)::int from movimientos_stock where tipo = 'anulacion_venta'), 3, 'anular dos veces no duplica la devolución (2 de V1 + 1 de la de $0)');
select results_eq($$ select anulado_por, motivo_anulacion from ventas where id = '70000000-0000-0000-0000-000000000001' $$,
  $$ values ('20000000-0000-0000-0000-000000000001'::uuid, 'Error de carga'::text) $$, 'queda quién anuló y por qué');
select is((select ultima_venta from v_clientes where cliente_id = '50000000-0000-0000-0000-00000000000a'), null::date,
  'las ventas anuladas no cuentan como última venta (Ana tiene sus dos ventas anuladas)'
);
select is((select count(*)::int from v_ultimo_precio_cliente where cliente_id = '50000000-0000-0000-0000-00000000000a'), 0,
  'las ventas anuladas no cuentan para el último precio');

-- Venta posterior a la anulación: FIFO toma primero la compra más vieja con stock (C0 del 01/08, después C1).
select lives_ok($$
  select registrar_venta('70000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001',
    '50000000-0000-0000-0000-00000000000a',
    '[{"producto_id":"30000000-0000-0000-0000-000000000001","cantidad":7,"precio_unitario":1000000}]')
$$, 'venta nueva después de anular');
select results_eq(
  $$ select m.compra_id, -m.cantidad from movimientos_stock m join venta_items i on i.id = m.venta_item_id
      where i.venta_id = '70000000-0000-0000-0000-000000000004' order by m.costo_unitario_ars $$,
  $$ values ('40000000-0000-0000-0000-000000000004'::uuid, 5), ('40000000-0000-0000-0000-000000000001'::uuid, 2) $$,
  'FIFO: 5 de la compra más vieja (01/08) y 2 de C1 (devueltas por la anulación)'
);
select is((select costo_ars from v_ventas where venta_id = '70000000-0000-0000-0000-000000000004'), 5 * 400000 + 2 * 600000::bigint,
  'costo: 5 × $4.000 + 2 × $6.000');
select throws_like($$ select anular_compra('40000000-0000-0000-0000-000000000001', 'x') $$, '%ya salieron%',
  'no se anula una compra de la que salieron unidades vendidas');

-- ---------------------------------------------------------------------------------
-- Otro negocio y anónimo
-- ---------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select is((select count(*)::int from ventas), 0, 'otro negocio no ve ventas ajenas');
select is((select count(*)::int from v_ventas), 0, 'otro negocio no ve la vista de ventas ajena');
select is((select count(*)::int from precios_especiales), 0, 'otro negocio no ve precios especiales ajenos');
select throws_ok($$
  select registrar_venta(gen_random_uuid(), '10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-00000000000a',
    '[{"producto_id":"30000000-0000-0000-0000-000000000001","cantidad":1,"precio_unitario":1}]')
$$, '42501', null, 'no puede vender en un negocio ajeno');
select throws_ok($$ select anular_venta('70000000-0000-0000-0000-000000000002', 'x') $$, '23503', null, 'no puede anular ventas ajenas');
select throws_ok($$ select fijar_precio_especial('50000000-0000-0000-0000-00000000000a', '30000000-0000-0000-0000-000000000001', 1) $$,
  '23503', null, 'no puede fijar precios a clientes ajenos');

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select throws_ok($$ select * from v_ventas $$, '42501', null, 'el anónimo no ve ventas');

-- ---------------------------------------------------------------------------------
-- Borrado de datos de prueba
-- ---------------------------------------------------------------------------------
reset role;
select set_config('request.jwt.claims', '', true);
select results_eq(
  $$ select tabla, filas_borradas from borrar_datos_de_prueba('10000000-0000-0000-0000-000000000001', 'BORRAR DATOS DE PRUEBA') $$,
  $$ values ('visitas'::text, 0::bigint), ('pagos'::text, 0::bigint), ('saldos_iniciales'::text, 0::bigint), ('movimientos_stock'::text, 15::bigint), ('venta_items'::text, 6::bigint),
            ('ventas'::text, 5::bigint), ('ajustes_stock'::text, 0::bigint), ('precios_especiales'::text, 1::bigint), ('compras'::text, 4::bigint),
            ('clientes'::text, 2::bigint), ('productos'::text, 2::bigint) $$,
  'el borrado de datos de prueba incluye ventas, renglones y precios especiales'
);

select * from finish();
rollback;
