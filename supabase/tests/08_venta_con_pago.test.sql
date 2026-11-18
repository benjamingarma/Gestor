-- Pruebas de la venta con pago (PR 2A, 18/11/2026): registrar_venta_con_pago, registrar_pago_de_venta y
-- anular_venta_y_pagos. Una sola operación (si falla el pago no queda la venta), reintentos, cliente nuevo,
-- deuda previa, saldo a favor, Deshacer conjunto y permisos.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(57);

-- ---------------------------------------------------------------------------------
-- Permisos de las funciones
-- ---------------------------------------------------------------------------------
select is((select prosecdef from pg_proc where oid = 'public.registrar_venta_con_pago(uuid,uuid,uuid,jsonb,uuid,bigint,text,uuid,date,uuid,text,jsonb)'::regprocedure),
  false, 'registrar_venta_con_pago es SECURITY INVOKER (el cliente nuevo pasa por RLS como siempre)');
select ok(not has_function_privilege('anon', 'public.registrar_venta_con_pago(uuid,uuid,uuid,jsonb,uuid,bigint,text,uuid,date,uuid,text,jsonb)', 'execute'),
  'el anónimo no puede registrar ventas con pago');
select ok(not has_function_privilege('anon', 'public.registrar_pago_de_venta(uuid,uuid,bigint,text,uuid)', 'execute'),
  'el anónimo no puede registrar pagos de ventas');
select ok(not has_function_privilege('anon', 'public.anular_venta_y_pagos(uuid,text,boolean)', 'execute'),
  'el anónimo no puede anular');
select ok(has_function_privilege('authenticated', 'public.registrar_venta_con_pago(uuid,uuid,uuid,jsonb,uuid,bigint,text,uuid,date,uuid,text,jsonb)', 'execute')
      and has_function_privilege('authenticated', 'public.anular_venta_y_pagos(uuid,text,boolean)', 'execute'),
  'un usuario logueado sí');

-- ---------------------------------------------------------------------------------
-- Datos base: negocio 1 en modo prueba, negocio 2 de otro socio, negocio 3 en modo real
-- ---------------------------------------------------------------------------------
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'socio.a@pgtap.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b1', 'otro@pgtap.test',    'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c1', 'real@pgtap.test',    'authenticated', 'authenticated');
insert into negocios (id, nombre) values
  ('10000000-0000-0000-0000-000000000001', 'Negocio de prueba'),
  ('10000000-0000-0000-0000-000000000002', 'Otro negocio');
insert into negocios (id, nombre, modo_prueba) values ('10000000-0000-0000-0000-000000000003', 'Negocio real', false);
insert into socios (id, negocio_id, nombre, user_id, orden) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Benjamín', '00000000-0000-0000-0000-0000000000a1', 1),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Papá', null, 2),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 'Otro socio', '00000000-0000-0000-0000-0000000000b1', 1),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000003', 'Socio real', '00000000-0000-0000-0000-0000000000c1', 1);

-- Atajos: unidades en stock y saldo de un cliente.
create function public._stock() returns int language sql as
  $$ select coalesce(sum(cantidad), 0)::int from public.movimientos_stock where producto_id = '30000000-0000-0000-0000-000000000001' $$;
create function public._saldo(p uuid) returns bigint language sql as
  $$ select saldo from public.v_cuentas_clientes where cliente_id = p $$;
grant execute on function public._stock(), public._saldo(uuid) to authenticated;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
insert into productos (id, negocio_id, marca, modelo, precio_general) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Vapex', '8000', 1000000);
insert into clientes (id, negocio_id, nombre) values
  ('50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Bruno'),
  ('50000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Ana'),
  ('50000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'Carla');
select registrar_compra('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001', date '2026-10-01', 30, 500, 140000);


-- ---------------------------------------------------------------------------------
-- "Pagó todo": venta $ 21.000 (2 × $ 10.500) y pago de $ 21.000 en efectivo que recibió Papá
-- ---------------------------------------------------------------------------------
select lives_ok($$ select registrar_venta_con_pago('60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000001', '[{"producto_id":"30000000-0000-0000-0000-000000000001","cantidad":2,"precio_unitario":1050000}]',
  '70000000-0000-0000-0000-000000000001', 2100000, 'efectivo', '20000000-0000-0000-0000-000000000002') $$,
  'Pagó todo: venta y pago juntos');
select results_eq($$ select cliente_id, fecha, importe, medio, recibido_por, venta_id, es_prueba, registrado_por
                       from pagos where id = '70000000-0000-0000-0000-000000000001' $$,
  $$ values ('50000000-0000-0000-0000-000000000001'::uuid, hoy_tucuman(), 2100000::bigint, 'efectivo',
             '20000000-0000-0000-0000-000000000002'::uuid, '60000000-0000-0000-0000-000000000001'::uuid, true,
             '20000000-0000-0000-0000-000000000001'::uuid) $$,
  'el pago queda del mismo cliente, del día de la venta, con medio, quién recibió, la venta, es_prueba y quién lo cargó');
select is(_saldo('50000000-0000-0000-0000-000000000001'), 0::bigint, 'Pagó todo: Bruno queda al día (debe $ 0)');
select is((select venta_id from v_pagos where pago_id = '70000000-0000-0000-0000-000000000001'),
  '60000000-0000-0000-0000-000000000001'::uuid, 'v_pagos muestra la venta del pago');

-- Reintento (doble toque): misma venta, un solo pago.
select lives_ok($$ select registrar_venta_con_pago('60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000001', '[{"producto_id":"30000000-0000-0000-0000-000000000001","cantidad":2,"precio_unitario":1050000}]',
  '70000000-0000-0000-0000-000000000001', 2100000, 'efectivo', '20000000-0000-0000-0000-000000000002') $$,
  'reintentar la misma venta con pago no falla');
select results_eq($$ select (select count(*)::int from ventas where id = '60000000-0000-0000-0000-000000000001'),
                            (select count(*)::int from pagos where venta_id = '60000000-0000-0000-0000-000000000001'), _stock() $$,
  $$ values (1, 1, 28) $$, 'el reintento no duplica la venta, el pago ni la salida de stock');
select throws_ok($$ select registrar_venta_con_pago('60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000001', '[{"producto_id":"30000000-0000-0000-0000-000000000001","cantidad":2,"precio_unitario":1050000}]',
  '70000000-0000-0000-0000-000000000001', 999, 'efectivo') $$,
  '23505', null, 'el mismo identificador de pago con otro monto se rechaza');
select throws_ok($$ select registrar_venta_con_pago('60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000001', '[{"producto_id":"30000000-0000-0000-0000-000000000001","cantidad":2,"precio_unitario":1050000}]',
  '70000000-0000-0000-0000-000000000001', 2100000, 'efectivo', '20000000-0000-0000-0000-000000000001') $$,
  '23505', 'Este pago ya se registró con otro socio como quien recibió el dinero',
  'el reintento con otro socio que recibió se rechaza con un aviso claro');
select throws_ok($$ select registrar_venta_con_pago('60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000001', '[{"producto_id":"30000000-0000-0000-0000-000000000001","cantidad":2,"precio_unitario":1050000}]',
  '70000000-0000-0000-0000-000000000001', 2100000, 'efectivo') $$,
  '23505', 'Este pago ya se registró con otro socio como quien recibió el dinero',
  'el reintento sin decir quién recibió (queda el que carga, Benjamín) tampoco pasa si el original lo recibió Papá');
select results_eq($$ select count(*)::int, min(recibido_por::text) from pagos where venta_id = '60000000-0000-0000-0000-000000000001' $$,
  $$ values (1, '20000000-0000-0000-0000-000000000002') $$,
  'después de los reintentos rechazados sigue habiendo un solo pago, el que recibió Papá');

-- ---------------------------------------------------------------------------------
-- "Pago parcial" y "Deuda"
-- ---------------------------------------------------------------------------------
select lives_ok($$ select registrar_venta_con_pago('60000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000002', '[{"producto_id":"30000000-0000-0000-0000-000000000001","cantidad":2,"precio_unitario":1050000}]',
  '70000000-0000-0000-0000-000000000002', 500000, 'transferencia') $$,
  'Pago parcial: venta $ 21.000 con pago de $ 5.000');
select is(_saldo('50000000-0000-0000-0000-000000000002'), 1600000::bigint, 'Pago parcial: Ana queda debiendo $ 16.000');
select is((select recibido_por from pagos where id = '70000000-0000-0000-0000-000000000002'),
  '20000000-0000-0000-0000-000000000001'::uuid, 'sin decir quién recibió, queda el socio que la cargó');

select lives_ok($$ select registrar_venta_con_pago('60000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000003', '[{"producto_id":"30000000-0000-0000-0000-000000000001","cantidad":1,"precio_unitario":1000000}]') $$,
  'Deuda: venta sin pago');
select results_eq($$ select _saldo('50000000-0000-0000-0000-000000000003'),
                            (select count(*)::int from pagos where cliente_id = '50000000-0000-0000-0000-000000000003') $$,
  $$ values (1000000::bigint, 0) $$, 'Deuda: Carla debe $ 10.000 y no hay ningún pago');

-- ---------------------------------------------------------------------------------
-- Deuda previa, pago mayor que la venta y saldo a favor
-- ---------------------------------------------------------------------------------
-- Carla debe $ 10.000. Nueva venta de $ 10.000 y "Pagó todo" ($ 10.000): el pago va a la deuda más vieja
-- (FIFO, plan A4), pero el saldo total es el mismo: sigue debiendo $ 10.000.
select registrar_venta_con_pago('60000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000003', '[{"producto_id":"30000000-0000-0000-0000-000000000001","cantidad":1,"precio_unitario":1000000}]',
  '70000000-0000-0000-0000-000000000004', 1000000, 'efectivo');
select is(_saldo('50000000-0000-0000-0000-000000000003'), 1000000::bigint,
  'con deuda previa, Pagó todo de la venta nueva deja el saldo anterior ($ 10.000)');
-- Pago parcial mayor que la venta (decisión 2): venta $ 10.000, paga $ 15.000 → baja también lo viejo.
select lives_ok($$ select registrar_venta_con_pago('60000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000003', '[{"producto_id":"30000000-0000-0000-0000-000000000001","cantidad":1,"precio_unitario":1000000}]',
  '70000000-0000-0000-0000-000000000005', 1500000, 'mercado_pago') $$,
  'el pago puede ser mayor que la venta (paga también parte de lo que debía)');
select is(_saldo('50000000-0000-0000-0000-000000000003'), 500000::bigint, 'Carla queda debiendo $ 5.000');
-- Saldo a favor: Bruno paga $ 5.000 por adelantado; venta de $ 21.000 con "Pagó todo" = $ 16.000.
select registrar_pago('70000000-0000-0000-0000-000000000006', '50000000-0000-0000-0000-000000000001', 500000, 'efectivo');
select registrar_venta_con_pago('60000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000001', '[{"producto_id":"30000000-0000-0000-0000-000000000001","cantidad":2,"precio_unitario":1050000}]',
  '70000000-0000-0000-0000-000000000007', 1600000, 'efectivo');
select is(_saldo('50000000-0000-0000-0000-000000000001'), 0::bigint,
  'con $ 5.000 a favor, una venta de $ 21.000 pagada con $ 16.000 queda al día');

-- Fecha pasada: el pago queda del mismo día que la venta.
select registrar_venta_con_pago('60000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000002', '[{"producto_id":"30000000-0000-0000-0000-000000000001","cantidad":1,"precio_unitario":1000000}]',
  '70000000-0000-0000-0000-000000000008', 1000000, 'efectivo', null, date '2026-11-01');
select is((select fecha from pagos where id = '70000000-0000-0000-0000-000000000008'), date '2026-11-01',
  'venta cargada con fecha pasada: el pago queda con esa fecha');

-- ---------------------------------------------------------------------------------
-- Una sola operación: si el pago falla, la venta tampoco queda
-- ---------------------------------------------------------------------------------
select throws_ok($$ select registrar_venta_con_pago('60000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000002', '[{"producto_id":"30000000-0000-0000-0000-000000000001","cantidad":3,"precio_unitario":1000000}]',
  '70000000-0000-0000-0000-000000000010', 1000000, 'cheque') $$,
  '22023', 'Elegí cómo pagó', 'medio de pago inválido: error');
select throws_ok($$ select registrar_venta_con_pago('60000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000002', '[{"producto_id":"30000000-0000-0000-0000-000000000001","cantidad":3,"precio_unitario":1000000}]',
  '70000000-0000-0000-0000-000000000011', 0, 'efectivo') $$,
  '22023', null, 'pago de $ 0: error');
select throws_ok($$ select registrar_venta_con_pago('60000000-0000-0000-0000-000000000012', '10000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000002', '[{"producto_id":"30000000-0000-0000-0000-000000000001","cantidad":3,"precio_unitario":1000000}]',
  '70000000-0000-0000-0000-000000000012', 1000000, 'efectivo', '20000000-0000-0000-0000-000000000003') $$,
  '22023', null, 'recibió un socio de otro negocio: error');
select throws_ok($$ select registrar_venta_con_pago('60000000-0000-0000-0000-000000000013', '10000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000002', '[{"producto_id":"30000000-0000-0000-0000-000000000001","cantidad":3,"precio_unitario":1000000}]',
  null, 1000000, 'efectivo') $$,
  '22023', null, 'pago sin identificador: error');
select results_eq($$ select (select count(*)::int from ventas where id in ('60000000-0000-0000-0000-000000000010', '60000000-0000-0000-0000-000000000011',
                                                                         '60000000-0000-0000-0000-000000000012', '60000000-0000-0000-0000-000000000013')),
                            (select count(*)::int from pagos where id in ('70000000-0000-0000-0000-000000000010', '70000000-0000-0000-0000-000000000011',
                                                                         '70000000-0000-0000-0000-000000000012')) $$,
  $$ values (0, 0) $$, 'ninguno de los intentos fallidos dejó venta ni pago');
select is(_stock(), 20, 'ni movieron el stock (30 − 2 − 2 − 1 − 1 − 1 − 2 − 1 = 20)');

-- Venta que falla (sin stock) con pago: no queda el pago.
select throws_ok($$ select registrar_venta_con_pago('60000000-0000-0000-0000-000000000014', '10000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000002', '[{"producto_id":"30000000-0000-0000-0000-000000000001","cantidad":999,"precio_unitario":1000000}]',
  '70000000-0000-0000-0000-000000000014', 1000000, 'efectivo') $$,
  null, null, 'venta sin stock suficiente: error');
select is((select count(*)::int from pagos where id = '70000000-0000-0000-0000-000000000014'), 0, 'y el pago tampoco queda');

-- ---------------------------------------------------------------------------------
-- Cliente nuevo con pago
-- ---------------------------------------------------------------------------------
select lives_ok($$ select registrar_venta_con_pago('60000000-0000-0000-0000-000000000020', '10000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000020', '[{"producto_id":"30000000-0000-0000-0000-000000000001","cantidad":1,"precio_unitario":1000000}]',
  '70000000-0000-0000-0000-000000000020', 400000, 'efectivo', null, null, null, null,
  '{"nombre":"  Diego  Paz ","telefono":"381 555-0000","direccion":"San Martín 450"}') $$,
  'cliente nuevo con pago parcial');
select results_eq($$ select c.nombre, c.direccion, _saldo(c.id), p.cliente_id = c.id
                       from clientes c join pagos p on p.id = '70000000-0000-0000-0000-000000000020'
                      where c.id = '50000000-0000-0000-0000-000000000020' $$,
  $$ values ('Diego Paz', 'San Martín 450', 600000::bigint, true) $$,
  'el cliente nuevo queda creado, con el pago a su nombre, debiendo $ 6.000');
select throws_ok($$ select registrar_venta_con_pago('60000000-0000-0000-0000-000000000021', '10000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000021', '[{"producto_id":"30000000-0000-0000-0000-000000000001","cantidad":1,"precio_unitario":1000000}]',
  '70000000-0000-0000-0000-000000000021', 400000, 'trueque', null, null, null, null, '{"nombre":"Elena"}') $$,
  '22023', null, 'cliente nuevo con pago que falla: error');
select is((select count(*)::int from clientes where id = '50000000-0000-0000-0000-000000000021'), 0,
  'y no queda el cliente nuevo (ni la venta)');
select throws_ok($$ select registrar_venta_con_pago('60000000-0000-0000-0000-000000000022', '10000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000022', '[{"producto_id":"30000000-0000-0000-0000-000000000001","cantidad":1,"precio_unitario":1000000}]',
  '70000000-0000-0000-0000-000000000022', 400000, 'efectivo', null, null, null, null, '{"nombre":"BRUNO"}') $$,
  '23505', null, 'cliente nuevo con nombre repetido: se rechaza igual que antes');

-- ---------------------------------------------------------------------------------
-- Pago de una venta suelto: venta anulada, otro negocio
-- ---------------------------------------------------------------------------------
select throws_ok($$ select registrar_pago_de_venta('70000000-0000-0000-0000-000000000030', '60000000-0000-0000-0000-0000000000ff', 1000, 'efectivo') $$,
  '23503', null, 'pago de una venta que no existe: error');

-- ---------------------------------------------------------------------------------
-- Deshacer: anular la venta y su pago juntos
-- ---------------------------------------------------------------------------------
select throws_ok($$ select anular_venta_y_pagos('60000000-0000-0000-0000-000000000002', '  ') $$,
  '22023', null, 'sin motivo no se anula');
select results_eq($$ select (select anulado_en is null from ventas where id = '60000000-0000-0000-0000-000000000002'),
                            (select anulado_en is null from pagos where id = '70000000-0000-0000-0000-000000000002') $$,
  $$ values (true, true) $$, 'y no quedó anulado nada');
select lives_ok($$ select anular_venta_y_pagos('60000000-0000-0000-0000-000000000002', 'Lo cargué mal') $$,
  'Deshacer: anula la venta de Ana y su pago');
select results_eq($$ select (select motivo_anulacion from ventas where id = '60000000-0000-0000-0000-000000000002'),
                            (select motivo_anulacion from pagos where id = '70000000-0000-0000-0000-000000000002'),
                            _saldo('50000000-0000-0000-0000-000000000002') $$,
  $$ values ('Lo cargué mal', 'Lo cargué mal', 0::bigint) $$,
  'venta y pago anulados con el mismo motivo; la cuenta de Ana vuelve a como estaba (la otra venta está paga)');
select lives_ok($$ select anular_venta_y_pagos('60000000-0000-0000-0000-000000000002', 'otra vez') $$,
  'anular dos veces no falla');
select is((select motivo_anulacion from pagos where id = '70000000-0000-0000-0000-000000000002'), 'Lo cargué mal',
  'y no cambia la primera anulación');

-- Anular desde el historial sin devolver la plata: el pago queda a cuenta (saldo a favor).
select anular_venta_y_pagos('60000000-0000-0000-0000-000000000001', 'Devolvió los productos', false);
select results_eq($$ select (select anulado_en is not null from ventas where id = '60000000-0000-0000-0000-000000000001'),
                            (select anulado_en is null from pagos where id = '70000000-0000-0000-0000-000000000001'),
                            _saldo('50000000-0000-0000-0000-000000000001') $$,
  $$ values (true, true, -2100000::bigint) $$,
  'sin devolver la plata: la venta se anula, el pago sigue y a Bruno le quedan $ 21.000 a favor');

-- La columna no se cambia a mano.
select throws_ok($$ update pagos set venta_id = null where id = '70000000-0000-0000-0000-000000000004' $$,
  '42501', null, 'un usuario no puede cambiar la venta de un pago');

-- ---------------------------------------------------------------------------------
-- Otro negocio, modo real y anónimo
-- ---------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select throws_ok($$ select registrar_pago_de_venta('70000000-0000-0000-0000-000000000040', '60000000-0000-0000-0000-000000000004', 1000, 'efectivo') $$,
  '23503', null, 'un socio de otro negocio no puede registrar pagos en mis ventas');
select throws_ok($$ select anular_venta_y_pagos('60000000-0000-0000-0000-000000000004', 'Intruso') $$,
  '23503', null, 'ni anularlas');
select is((select count(*)::int from v_pagos), 0, 'ni ve mis pagos');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
insert into productos (id, negocio_id, marca, modelo, precio_general) values
  ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', 'Real', '1', 1000000);
insert into clientes (id, negocio_id, nombre) values
  ('50000000-0000-0000-0000-000000000050', '10000000-0000-0000-0000-000000000003', 'Cliente real');
select registrar_compra('40000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003',
  '30000000-0000-0000-0000-000000000003', date '2026-10-01', 5, 500, 140000);
select registrar_venta_con_pago('60000000-0000-0000-0000-000000000050', '10000000-0000-0000-0000-000000000003',
  '50000000-0000-0000-0000-000000000050', '[{"producto_id":"30000000-0000-0000-0000-000000000003","cantidad":1,"precio_unitario":1000000}]',
  '70000000-0000-0000-0000-000000000050', 1000000, 'efectivo');
select results_eq($$ select es_prueba, registrado_por from pagos where id = '70000000-0000-0000-0000-000000000050' $$,
  $$ values (false, '20000000-0000-0000-0000-000000000004'::uuid) $$,
  'en un negocio fuera de modo prueba, el pago queda como dato real');

-- ---------------------------------------------------------------------------------
-- Borrado de datos de prueba (A20, ensayo del módulo 1.9): también limpia las ventas con pago, los pagos
-- registrados con una venta (pagos.venta_id) y los clientes creados desde la venta. Lo real no se toca.
-- ---------------------------------------------------------------------------------
reset role;
select set_config('request.jwt.claims', '', true);
create temp table _antes as
  select (select count(*) from pagos where negocio_id = '10000000-0000-0000-0000-000000000001' and venta_id is not null) as pagos_de_venta,
         (select count(*) from ventas where negocio_id = '10000000-0000-0000-0000-000000000001' and anulado_en is not null) as anuladas,
         (select count(*) from clientes where negocio_id = '10000000-0000-0000-0000-000000000001') as clientes;
select ok((select pagos_de_venta > 0 and anuladas > 0 and clientes > 3 from _antes),
  'antes del borrado hay pagos de ventas, ventas anuladas y clientes creados desde la venta (la prueba no es en vacío)');
select lives_ok($$ select * from borrar_datos_de_prueba('10000000-0000-0000-0000-000000000001', 'BORRAR DATOS DE PRUEBA') $$,
  'el borrado de datos de prueba corre aunque haya pagos registrados con una venta');
select results_eq($$ select (select count(*) from ventas where negocio_id = '10000000-0000-0000-0000-000000000001')
                          + (select count(*) from venta_items where negocio_id = '10000000-0000-0000-0000-000000000001')
                          + (select count(*) from pagos where negocio_id = '10000000-0000-0000-0000-000000000001')
                          + (select count(*) from clientes where negocio_id = '10000000-0000-0000-0000-000000000001')
                          + (select count(*) from movimientos_stock where negocio_id = '10000000-0000-0000-0000-000000000001')
                          + (select count(*) from compras where negocio_id = '10000000-0000-0000-0000-000000000001')
                          + (select count(*) from productos where negocio_id = '10000000-0000-0000-0000-000000000001') $$,
  $$ values (0::bigint) $$, 'después del borrado no queda ningún dato de prueba (ventas, renglones, pagos, clientes, stock, compras, productos)');
select results_eq($$ select (select count(*) from negocios where id = '10000000-0000-0000-0000-000000000001'),
                            (select count(*) from socios where negocio_id = '10000000-0000-0000-0000-000000000001') $$,
  $$ values (1::bigint, 2::bigint) $$, 'se conservan el negocio y sus socios');
select results_eq($$ select (select count(*) from ventas where id = '60000000-0000-0000-0000-000000000050'),
                            (select count(*) from pagos where id = '70000000-0000-0000-0000-000000000050' and venta_id is not null) $$,
  $$ values (1::bigint, 1::bigint) $$, 'la venta con pago real del otro negocio queda intacta');

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select throws_ok($$ select registrar_venta_con_pago('60000000-0000-0000-0000-000000000060', '10000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000001', '[]') $$,
  '42501', null, 'el anónimo no puede llamarla');

select * from finish();
rollback;
