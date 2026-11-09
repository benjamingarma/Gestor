-- Pruebas del módulo 1.1: productos, compras en USD, stock por movimientos,
-- marcado y borrado de datos de prueba. Escenario de la sección 6 del plan.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(63);

-- ---------------------------------------------------------------------------------
-- Datos base (como administrador)
-- ---------------------------------------------------------------------------------
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'socio.a@ejemplo.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b1', 'otro@ejemplo.test',    'authenticated', 'authenticated');

insert into negocios (id, nombre) values
  ('10000000-0000-0000-0000-000000000001', 'Negocio de prueba'),
  ('10000000-0000-0000-0000-000000000002', 'Otro negocio');

insert into socios (id, negocio_id, nombre, user_id, orden) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Socio A', '00000000-0000-0000-0000-0000000000a1', 1),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Socio B', null, 2),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 'Otro socio', '00000000-0000-0000-0000-0000000000b1', 1);

select ok((select modo_prueba from negocios where id = '10000000-0000-0000-0000-000000000001'),
  'un negocio nuevo arranca en modo prueba');

-- ---------------------------------------------------------------------------------
-- Socio A
-- ---------------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

-- Productos ----------------------------------------------------------------------------
select lives_ok($$
  insert into productos (id, negocio_id, marca, modelo, precio_general) values
    ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '  Vapex ', '8000', 1000000),
    ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Nubo', '5000', 800000)
$$, 'el socio crea productos');

select results_eq(
  $$select marca, registrado_por, es_prueba from productos where id = '30000000-0000-0000-0000-000000000001'$$,
  $$values ('Vapex'::text, '20000000-0000-0000-0000-000000000001'::uuid, true)$$,
  'la base normaliza la marca, completa quién lo registró y lo marca como prueba'
);

select throws_ok($$
  insert into productos (negocio_id, marca, modelo) values ('10000000-0000-0000-0000-000000000001', 'VAPEX', ' 8000 ')
$$, '23505', null, 'no se puede repetir marca + modelo (sin importar mayúsculas ni espacios)');

select throws_ok($$
  insert into productos (negocio_id, marca, modelo, es_prueba) values ('10000000-0000-0000-0000-000000000001', 'X', 'Y', false)
$$, '42501', null, 'el celular no puede elegir es_prueba');

select throws_ok($$
  insert into productos (negocio_id, marca, modelo, registrado_por)
  values ('10000000-0000-0000-0000-000000000001', 'X', 'Y', '20000000-0000-0000-0000-000000000002')
$$, '42501', null, 'el celular no puede elegir quién registró');

select throws_ok($$
  insert into productos (negocio_id, marca, modelo) values ('10000000-0000-0000-0000-000000000002', 'X', 'Y')
$$, '42501', null, 'no se pueden crear productos en otro negocio');

select lives_ok($$
  update productos set precio_general = 1050000 where id = '30000000-0000-0000-0000-000000000001'
$$, 'se puede cambiar el precio general');
select is((select precio_general from productos where id = '30000000-0000-0000-0000-000000000001'),
  1050000::bigint, 'el precio general quedó actualizado');
update productos set precio_general = 1000000 where id = '30000000-0000-0000-0000-000000000001';

select throws_ok($$
  update productos set negocio_id = '10000000-0000-0000-0000-000000000002' where id = '30000000-0000-0000-0000-000000000001'
$$, '42501', null, 'no se puede mover un producto a otro negocio');

select throws_ok($$
  delete from productos where id = '30000000-0000-0000-0000-000000000002'
$$, '42501', null, 'los productos no se borran (se desactivan)');

-- Compras (sección 6.1 del plan) ------------------------------------------------------
-- C1: inventario inicial, 10 × USD 5,00 a $1.200 (estimado)
select lives_ok($$
  select registrar_compra('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001', date '2026-09-01', 10, 500, 120000, true, 'Stock del papel', 'inventario_inicial')
$$, 'C1: compra de inventario inicial con tipo de cambio estimado');
-- C2: 20 × USD 5,00 a $1.400
select lives_ok($$
  select registrar_compra('40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001', date '2026-10-01', 20, 500, 140000)
$$, 'C2: compra normal');
-- C3: 15 × USD 3,00 a $1.500
select lives_ok($$
  select registrar_compra('40000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000002', date '2026-10-02', 15, 300, 150000)
$$, 'C3: compra de otro producto');

select results_eq(
  $$select costo_unitario_ars, costo_total_usd, costo_total_ars from compras order by secuencia$$,
  $$values (600000::bigint, 5000::bigint, 6000000::bigint),
           (700000::bigint, 10000::bigint, 14000000::bigint),
           (450000::bigint, 4500::bigint, 6750000::bigint)$$,
  'costo en pesos = USD × tipo de cambio de cada compra; totales en USD y pesos'
);

select is((select sum(costo_total_usd) from compras), 19500::numeric, 'invertido: USD 195');
select is((select sum(costo_total_ars) from compras), 26750000::numeric, 'invertido: $267.500');

select results_eq(
  $$select tipo_cambio_estimado, origen, registrado_por from compras where id = '40000000-0000-0000-0000-000000000001'$$,
  $$values (true, 'inventario_inicial'::text, '20000000-0000-0000-0000-000000000001'::uuid)$$,
  'C1 queda marcada como tipo de cambio estimado e inventario inicial'
);

-- Redondeo de la conversión
select lives_ok($$
  insert into productos (id, negocio_id, marca, modelo)
  values ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'Redondeo', 'Test')
$$, 'producto para probar redondeo');
select lives_ok($$
  select registrar_compra('40000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000003', date '2026-10-03', 3, 499, 123750)
$$, 'compra USD 4,99 × $1.237,50');
select results_eq(
  $$select costo_unitario_ars, costo_total_ars from compras where id = '40000000-0000-0000-0000-000000000004'$$,
  $$values (617513::bigint, 1852539::bigint)$$,
  '$6.175,125 se redondea a $6.175,13; el total es 3 × el unitario redondeado'
);

-- Stock -----------------------------------------------------------------------------------
select results_eq(
  $$select unidades, valor_usd, valor_ars, proximo_costo_usd, proximo_costo_ars
      from v_stock_productos where producto_id = '30000000-0000-0000-0000-000000000001'$$,
  $$values (30, 15000::bigint, 20000000::bigint, 500::bigint, 600000::bigint)$$,
  'P1: 30 unidades, USD 150 / $200.000; la próxima unidad sale de C1 a $6.000'
);
select results_eq(
  $$select unidades, valor_usd, valor_ars from v_stock_productos where producto_id = '30000000-0000-0000-0000-000000000002'$$,
  $$values (15, 4500::bigint, 6750000::bigint)$$,
  'P2: 15 unidades, USD 45 / $67.500'
);
select is((select count(*)::int from movimientos_stock where tipo = 'compra'), 4, 'cada compra generó un movimiento de entrada');
select results_eq(
  $$select m.cantidad, m.costo_unitario_usd, m.costo_unitario_ars from movimientos_stock m
     where m.compra_id = '40000000-0000-0000-0000-000000000002'$$,
  $$values (20, 500::bigint, 700000::bigint)$$,
  'el movimiento copia cantidad y costo de su compra'
);
select is(
  (select (fecha at time zone 'America/Argentina/Tucuman')::date from movimientos_stock
    where compra_id = '40000000-0000-0000-0000-000000000002'),
  date '2026-10-01',
  'el movimiento cae en el día de la compra (hora de Tucumán)'
);

-- Idempotencia --------------------------------------------------------------------------
select is(
  (select (registrar_compra('40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001', date '2026-10-01', 20, 500, 140000)).secuencia),
  (select secuencia from compras where id = '40000000-0000-0000-0000-000000000002'),
  'reenviar la misma compra devuelve la que ya existe'
);
select is((select count(*)::int from compras), 4, 'el reenvío no duplicó la compra');
select is((select count(*)::int from movimientos_stock), 4, 'el reenvío no duplicó el movimiento');
select throws_ok($$
  select registrar_compra('40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001', date '2026-10-01', 21, 500, 140000)
$$, '23505', null, 'mismo identificador con otros datos: rechazado');

-- Validaciones ---------------------------------------------------------------------------
select throws_ok($$
  select registrar_compra(gen_random_uuid(), '10000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001', hoy_tucuman() + 1, 1, 500, 140000)
$$, '22023', null, 'fecha futura: rechazada');
select throws_ok($$
  select registrar_compra(gen_random_uuid(), '10000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001', date '2026-10-01', 1, 500, 0)
$$, '23514', null, 'tipo de cambio cero: rechazado');
select throws_ok($$
  select registrar_compra(gen_random_uuid(), '10000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001', date '2026-10-01', 0, 500, 140000)
$$, '23514', null, 'cantidad cero: rechazada');
select throws_ok($$
  select registrar_compra(gen_random_uuid(), '10000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001', date '2026-10-01', 1, -1, 140000)
$$, '23514', null, 'costo negativo: rechazado');

select throws_ok($$
  select registrar_compra(gen_random_uuid(), '10000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001', date '2026-10-01', 10001, 500, 140000)
$$, '23514', null, 'más de 10.000 unidades en una compra: rechazado');
select throws_ok($$
  select registrar_compra(gen_random_uuid(), '10000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001', date '2026-10-01', 1, 500, 10000001)
$$, '23514', null, 'tipo de cambio mayor a $100.000: rechazado');

-- Inmutabilidad -----------------------------------------------------------------------------
select throws_ok($$
  insert into compras (id, negocio_id, producto_id, fecha, cantidad, costo_unitario_usd, tipo_cambio)
  values (gen_random_uuid(), '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', date '2026-10-01', 1, 1, 1)
$$, '42501', null, 'no se insertan compras directo (solo con registrar_compra)');
select throws_ok($$
  update compras set cantidad = 99 where id = '40000000-0000-0000-0000-000000000002'
$$, '42501', null, 'las compras no se modifican');
select throws_ok($$
  delete from compras where id = '40000000-0000-0000-0000-000000000002'
$$, '42501', null, 'las compras no se borran');
select throws_ok($$
  insert into movimientos_stock (negocio_id, compra_id, producto_id, tipo, cantidad, costo_unitario_usd, costo_unitario_ars, fecha)
  values ('10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 'ajuste', -1, 500, 700000, now())
$$, '42501', null, 'no se insertan movimientos directo');
select throws_ok($$
  delete from movimientos_stock
$$, '42501', null, 'los movimientos no se borran');

-- Anulación ------------------------------------------------------------------------------------
select throws_ok($$
  select anular_compra('40000000-0000-0000-0000-000000000004', '  ')
$$, '22023', null, 'anular exige motivo');
select lives_ok($$
  select anular_compra('40000000-0000-0000-0000-000000000004', 'Error de carga')
$$, 'se anula una compra sin salidas');
select results_eq(
  $$select disponible, anulado_en is not null, motivo_anulacion from v_stock_compras
     where compra_id = '40000000-0000-0000-0000-000000000004'$$,
  $$values (0, true, 'Error de carga'::text)$$,
  'la compra anulada queda con stock 0 y el motivo registrado'
);
select results_eq(
  $$select tipo, cantidad from movimientos_stock where compra_id = '40000000-0000-0000-0000-000000000004' order by creado_en, cantidad desc$$,
  $$values ('compra'::text, 3), ('anulacion_compra'::text, -3)$$,
  'la anulación es un movimiento compensatorio; la entrada original sigue ahí'
);
select lives_ok($$
  select anular_compra('40000000-0000-0000-0000-000000000004', 'Otra vez')
$$, 'anular dos veces no falla');
select is((select count(*)::int from movimientos_stock where compra_id = '40000000-0000-0000-0000-000000000004'),
  2, 'anular dos veces no duplica el movimiento');
select is((select anulado_por from compras where id = '40000000-0000-0000-0000-000000000004'),
  '20000000-0000-0000-0000-000000000001'::uuid, 'queda registrado qué socio anuló');

-- Otro negocio ------------------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select is((select count(*)::int from productos), 0, 'otro negocio no ve productos ajenos');
select is((select count(*)::int from compras), 0, 'otro negocio no ve compras ajenas');
select is((select count(*)::int from v_stock_productos), 0, 'otro negocio no ve el stock ajeno');
select throws_ok($$
  select registrar_compra(gen_random_uuid(), '10000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001', date '2026-10-01', 1, 500, 140000)
$$, '42501', null, 'no puede comprar en un negocio ajeno');
select throws_ok($$
  select anular_compra('40000000-0000-0000-0000-000000000001', 'intento')
$$, '23503', null, 'no puede anular compras ajenas');

-- Anónimo ---------------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select throws_ok($$
  select registrar_compra(gen_random_uuid(), '10000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001', date '2026-10-01', 1, 500, 140000)
$$, '42501', null, 'el anónimo no puede registrar compras');

-- ---------------------------------------------------------------------------------
-- Como administrador: salidas, controles y borrado de datos de prueba
-- ---------------------------------------------------------------------------------
reset role;
select set_config('request.jwt.claims', '', true);

-- Simula una salida de C1 (en el módulo de ventas la hará la función de venta).
insert into movimientos_stock (negocio_id, compra_id, producto_id, tipo, cantidad, costo_unitario_usd, costo_unitario_ars, fecha, registrado_por)
values ('10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001',
        'venta', -2, 500, 600000, now(), '20000000-0000-0000-0000-000000000001');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select throws_like($$
  select anular_compra('40000000-0000-0000-0000-000000000001', 'intento')
$$, '%ya salieron 2 unidades%', 'no se anula una compra de la que ya salieron unidades');
reset role;
select set_config('request.jwt.claims', '', true);

-- Control I7: el costo en pesos de cada compra y de todos sus movimientos es el de la regla.
select is(
  (select count(*)::int from compras where costo_unitario_ars <> (costo_unitario_usd * tipo_cambio + 50) / 100),
  0, 'I7: toda compra cumple costo_ars = round(usd × tc)');
select is(
  (select count(*)::int from movimientos_stock m join compras c on c.id = m.compra_id
    where m.costo_unitario_ars <> c.costo_unitario_ars or m.costo_unitario_usd <> c.costo_unitario_usd),
  0, 'I7: todo movimiento usa exactamente el costo de su compra');

-- Fuera de modo prueba, lo nuevo queda como dato real.
update negocios set modo_prueba = false where id = '10000000-0000-0000-0000-000000000001';
insert into productos (id, negocio_id, marca, modelo, registrado_por)
values ('30000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000001', 'Real', 'Uno',
        '20000000-0000-0000-0000-000000000001');
select is((select es_prueba from productos where id = '30000000-0000-0000-0000-000000000009'), false,
  'sin modo prueba, lo nuevo queda marcado como real');

-- Borrado de datos de prueba
select throws_like($$
  select * from borrar_datos_de_prueba('10000000-0000-0000-0000-000000000001', 'si')
$$, '%BORRAR DATOS DE PRUEBA%', 'el borrado exige la frase de confirmación');

-- Si un dato real depende de uno de prueba, no se borra nada.
savepoint antes_de_dependencia;
insert into compras (id, negocio_id, producto_id, fecha, cantidad, costo_unitario_usd, tipo_cambio, registrado_por)
values ('40000000-0000-0000-0000-000000000099', '10000000-0000-0000-0000-000000000001',
        '30000000-0000-0000-0000-000000000001', date '2026-11-01', 1, 500, 150000,
        '20000000-0000-0000-0000-000000000001');
select throws_like($$
  select * from borrar_datos_de_prueba('10000000-0000-0000-0000-000000000001', 'BORRAR DATOS DE PRUEBA')
$$, '%datos reales que dependen%', 'si un dato real usa un producto de prueba, no se borra nada');
rollback to savepoint antes_de_dependencia;

select results_eq(
  $$select tabla, filas_borradas from borrar_datos_de_prueba('10000000-0000-0000-0000-000000000001', 'BORRAR DATOS DE PRUEBA')$$,
  $$values ('movimientos_stock'::text, 6::bigint), ('compras'::text, 4::bigint), ('productos'::text, 3::bigint)$$,
  'borra todas las filas de prueba, en orden'
);
select results_eq(
  $$select marca from productos where negocio_id = '10000000-0000-0000-0000-000000000001'$$,
  array['Real'],
  'los datos reales quedan'
);
select results_eq(
  $$select (select count(*)::int from negocios where id::text like '10000000-%'),
           (select count(*)::int from socios where id::text like '20000000-%'),
           (select count(*)::int from auth.users where email like '%@ejemplo.test')$$,
  $$values (2, 3, 2)$$,
  'negocio, socios y usuarios se conservan'
);

select * from finish();
rollback;
