-- Pruebas de registrar_venta_cliente_nuevo (venta a un cliente nuevo, módulo 1.7).
-- Cliente nuevo + venta, nombre repetido, venta que falla sin dejar cliente, reintentos y permisos.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(49);

-- Devuelve 'ok' o "sqlstate|hint|detail" del error (para mirar qué cliente se ofrece usar).
create function public._prueba_error(p_sql text) returns text language plpgsql as $$
declare v_detalle text; v_pista text;
begin
  execute p_sql;
  return 'ok';
exception when others then
  get stacked diagnostics v_detalle = pg_exception_detail, v_pista = pg_exception_hint;
  return sqlstate || '|' || coalesce(v_pista, '') || '|' || coalesce(v_detalle, '');
end;
$$;
grant execute on function public._prueba_error(text) to authenticated, anon;

-- ---------------------------------------------------------------------------------
-- La función no usa privilegios elevados
-- ---------------------------------------------------------------------------------
select is((select prosecdef from pg_proc where oid = 'public.registrar_venta_cliente_nuevo(uuid,uuid,uuid,text,text,jsonb,date,uuid,text,text)'::regprocedure),
  false, 'registrar_venta_cliente_nuevo es SECURITY INVOKER (corre con los permisos de quien la llama)');
select ok(not has_function_privilege('anon', 'public.registrar_venta_cliente_nuevo(uuid,uuid,uuid,text,text,jsonb,date,uuid,text,text)', 'execute'),
  'el anónimo no puede ejecutarla');
select ok(has_function_privilege('authenticated', 'public.registrar_venta_cliente_nuevo(uuid,uuid,uuid,text,text,jsonb,date,uuid,text,text)', 'execute'),
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

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
insert into productos (id, negocio_id, marca, modelo, precio_general) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Vapex', '8000', 1000000);
insert into clientes (id, negocio_id, nombre) values
  ('50000000-0000-0000-0000-00000000000f', '10000000-0000-0000-0000-000000000001', 'Fabián');
select registrar_compra('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001', date '2026-10-01', 10, 500, 140000);

-- ---------------------------------------------------------------------------------
-- Cliente nuevo + venta
-- ---------------------------------------------------------------------------------
select lives_ok($$ select registrar_venta_cliente_nuevo('60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000001', '  Carla   Gómez ', ' 381 555-1234 ',
  '[{"producto_id":"30000000-0000-0000-0000-000000000001","cantidad":2,"precio_unitario":1050000}]') $$,
  'venta a un cliente nuevo');
select results_eq($$ select negocio_id, nombre, telefono, notas, intervalo_visita_dias, archivado_en is null, es_prueba, registrado_por
                       from clientes where id = '50000000-0000-0000-0000-000000000001' $$,
  $$ values ('10000000-0000-0000-0000-000000000001'::uuid, 'Carla Gómez', '381 555-1234', null::text, 14, true, true,
             '20000000-0000-0000-0000-000000000001'::uuid) $$,
  'el cliente queda con nombre y teléfono limpios, valores por defecto, es_prueba del negocio y quién lo cargó');
select results_eq($$ select cliente_id, importe, unidades from v_ventas where venta_id = '60000000-0000-0000-0000-000000000001' $$,
  $$ values ('50000000-0000-0000-0000-000000000001'::uuid, 2100000::bigint, 2) $$,
  'la venta queda a nombre del cliente nuevo ($ 21.000, 2 u)');
select is((select saldo from v_cuentas_clientes where cliente_id = '50000000-0000-0000-0000-000000000001'), 2100000::bigint,
  'la cuenta del cliente nuevo muestra solo esa venta');
select is((select count(*)::int from movimientos_stock where producto_id = '30000000-0000-0000-0000-000000000001' and tipo = 'venta'), 1,
  'la venta descuenta stock por la función de siempre (FIFO)');
select is((select costo_ars from v_ventas where venta_id = '60000000-0000-0000-0000-000000000001'), 1400000::bigint,
  'costo FIFO igual que una venta común (2 × USD 5 × $1.400)');

-- Dirección (opcional): se guarda limpia; vacía queda sin dirección; más de 200 caracteres se rechaza.
select lives_ok($$ select registrar_venta_cliente_nuevo('60000000-0000-0000-0000-000000000070', '10000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000070', 'Julia', null,
  '[{"producto_id":"30000000-0000-0000-0000-000000000001","cantidad":1,"precio_unitario":1000000}]',
  p_direccion => '  San Martín   450,  Yerba Buena ') $$,
  'venta a un cliente nuevo con dirección');
select is((select direccion from clientes where id = '50000000-0000-0000-0000-000000000070'), 'San Martín 450, Yerba Buena',
  'la dirección queda sin espacios de más');
select is((select direccion from v_clientes where cliente_id = '50000000-0000-0000-0000-000000000070'), 'San Martín 450, Yerba Buena',
  'y se ve en la vista de clientes');
select lives_ok($$ select registrar_venta_cliente_nuevo('60000000-0000-0000-0000-000000000071', '10000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000071', 'Karina', null,
  '[{"producto_id":"30000000-0000-0000-0000-000000000001","cantidad":1,"precio_unitario":1000000}]', p_direccion => '   ') $$,
  'dirección en blanco');
select is((select direccion from clientes where id = '50000000-0000-0000-0000-000000000071'), null, 'dirección en blanco queda sin dirección');
select throws_ok($$ select registrar_venta_cliente_nuevo('60000000-0000-0000-0000-000000000072', '10000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000072', 'Lucas', null,
  '[{"producto_id":"30000000-0000-0000-0000-000000000001","cantidad":1,"precio_unitario":1000000}]', p_direccion => repeat('x', 201)) $$,
  '22023', 'La dirección puede tener hasta 200 caracteres', 'dirección de más de 200 caracteres');
select is((select count(*)::int from clientes where id = '50000000-0000-0000-0000-000000000072'), 0, 'y ese cliente no queda creado');
-- Desde la ficha: el socio carga o cambia la dirección de un cliente existente.
update clientes set direccion = ' Av. Mate de Luna  1200 ' where id = '50000000-0000-0000-0000-00000000000f';
select is((select direccion from clientes where id = '50000000-0000-0000-0000-00000000000f'), 'Av. Mate de Luna 1200',
  'un socio puede cargar la dirección de un cliente existente (normalizada)');
select throws_ok($$ insert into clientes (id, negocio_id, nombre, direccion)
  values ('50000000-0000-0000-0000-000000000073', '10000000-0000-0000-0000-000000000001', 'Mario', repeat('x', 201)) $$,
  '23514', null, 'la tabla tampoco acepta direcciones de más de 200 caracteres');

-- Sin teléfono: queda vacío.
select lives_ok($$ select registrar_venta_cliente_nuevo('60000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000002', 'Diego', '   ',
  '[{"producto_id":"30000000-0000-0000-0000-000000000001","cantidad":1,"precio_unitario":1000000}]') $$,
  'venta a un cliente nuevo sin teléfono');
select is((select telefono from clientes where id = '50000000-0000-0000-0000-000000000002'), null, 'teléfono vacío queda sin teléfono');

-- ---------------------------------------------------------------------------------
-- Doble toque / reintento: un solo cliente y una sola venta
-- ---------------------------------------------------------------------------------
select is((select (registrar_venta_cliente_nuevo('60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000001', 'Carla Gómez', '381 555-1234',
  '[{"producto_id":"30000000-0000-0000-0000-000000000001","cantidad":2,"precio_unitario":1050000}]')).id),
  '60000000-0000-0000-0000-000000000001'::uuid, 'el reintento devuelve la misma venta');
select is((select count(*)::int from clientes where nombre_para_comparar(nombre) = 'carla gomez'), 1, 'después del reintento hay un solo cliente');
select is((select count(*)::int from ventas where cliente_id = '50000000-0000-0000-0000-000000000001'), 1, 'y una sola venta');
select is((select count(*)::int from movimientos_stock where producto_id = '30000000-0000-0000-0000-000000000001' and tipo = 'venta'), 4,
  'el reintento no descuenta stock otra vez (4 ventas: Carla, Julia, Karina y Diego)');
select throws_ok($$ select registrar_venta_cliente_nuevo('60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000001', 'Carla Gómez', null,
  '[{"producto_id":"30000000-0000-0000-0000-000000000001","cantidad":3,"precio_unitario":1050000}]') $$,
  '23505', 'Ya existe otra venta con este identificador', 'el mismo identificador con otros productos no pisa la venta');
select throws_ok($$ select registrar_venta_cliente_nuevo('60000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000001', 'Otro nombre', null,
  '[{"producto_id":"30000000-0000-0000-0000-000000000001","cantidad":1,"precio_unitario":1000000}]') $$,
  '23505', 'Ya existe otro cliente con este identificador', 'un identificador de cliente usado con otro nombre se rechaza');

-- ---------------------------------------------------------------------------------
-- Nombre repetido (sin mayúsculas ni tildes): no crea otro y ofrece el existente
-- ---------------------------------------------------------------------------------
select is(_prueba_error($$ select registrar_venta_cliente_nuevo('60000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000010', 'fabian', null,
  '[{"producto_id":"30000000-0000-0000-0000-000000000001","cantidad":1,"precio_unitario":1000000}]') $$),
  '23505|cliente_duplicado|50000000-0000-0000-0000-00000000000f', '"fabian" choca con "Fabián" y devuelve su id para ofrecer usarlo');
select is(_prueba_error($$ select registrar_venta_cliente_nuevo('60000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000011', '  FABIÁN  ', null,
  '[{"producto_id":"30000000-0000-0000-0000-000000000001","cantidad":1,"precio_unitario":1000000}]') $$),
  '23505|cliente_duplicado|50000000-0000-0000-0000-00000000000f', '"  FABIÁN  " también');
select is(_prueba_error($$ select registrar_venta_cliente_nuevo('60000000-0000-0000-0000-000000000012', '10000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000012', 'carla  GOMEZ', null,
  '[{"producto_id":"30000000-0000-0000-0000-000000000001","cantidad":1,"precio_unitario":1000000}]') $$),
  '23505|cliente_duplicado|50000000-0000-0000-0000-000000000001', 'y un cliente creado por esta misma función ("carla  GOMEZ" = "Carla Gómez")');
select throws_ok($$ select registrar_venta_cliente_nuevo('60000000-0000-0000-0000-000000000013', '10000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000013', 'Fabian', null,
  '[{"producto_id":"30000000-0000-0000-0000-000000000001","cantidad":1,"precio_unitario":1000000}]') $$,
  '23505', 'Ya existe un cliente con ese nombre. Agregale algo para distinguirlo (ej: barrio o apellido).',
  'el mensaje es el mismo de la pantalla Nuevo cliente');
select is((select count(*)::int from clientes where id in ('50000000-0000-0000-0000-000000000010', '50000000-0000-0000-0000-000000000011',
  '50000000-0000-0000-0000-000000000012', '50000000-0000-0000-0000-000000000013')), 0, 'ningún cliente repetido quedó creado');
select is((select count(*)::int from ventas where id in ('60000000-0000-0000-0000-000000000010', '60000000-0000-0000-0000-000000000011',
  '60000000-0000-0000-0000-000000000012', '60000000-0000-0000-0000-000000000013')), 0, 'ni ninguna venta');
select lives_ok($$ select registrar_venta_cliente_nuevo('60000000-0000-0000-0000-000000000014', '10000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000014', 'Fabián Centro', null,
  '[{"producto_id":"30000000-0000-0000-0000-000000000001","cantidad":1,"precio_unitario":1000000}]') $$,
  'con el barrio agregado, sí se crea');

-- ---------------------------------------------------------------------------------
-- Venta que falla: no queda cliente huérfano
-- ---------------------------------------------------------------------------------
select throws_ok($$ select registrar_venta_cliente_nuevo('60000000-0000-0000-0000-000000000020', '10000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000020', 'Hernán', null,
  '[{"producto_id":"30000000-0000-0000-0000-000000000001","cantidad":99,"precio_unitario":1000000}]') $$,
  null, null, 'venta sin stock suficiente falla');
select is((select count(*)::int from clientes where id = '50000000-0000-0000-0000-000000000020'), 0, 'y el cliente nuevo no queda creado');
select throws_ok($$ select registrar_venta_cliente_nuevo('60000000-0000-0000-0000-000000000021', '10000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000021', 'Hernán', null, '[]') $$,
  '22023', null, 'venta sin productos falla');
select throws_ok($$ select registrar_venta_cliente_nuevo('60000000-0000-0000-0000-000000000022', '10000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000022', 'Hernán', null,
  '[{"producto_id":"30000000-0000-0000-0000-000000000001","cantidad":1,"precio_unitario":-1}]') $$,
  null, null, 'venta con precio negativo falla');
select is((select count(*)::int from clientes where nombre_para_comparar(nombre) = 'hernan'), 0, 'ningún "Hernán" huérfano después de tres ventas fallidas');
select is((select count(*)::int from ventas where id in ('60000000-0000-0000-0000-000000000020', '60000000-0000-0000-0000-000000000021',
  '60000000-0000-0000-0000-000000000022')), 0, 'ni ventas a medias');
select lives_ok($$ select registrar_venta_cliente_nuevo('60000000-0000-0000-0000-000000000023', '10000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000023', 'Hernán', null,
  '[{"producto_id":"30000000-0000-0000-0000-000000000001","cantidad":1,"precio_unitario":1000000}]') $$,
  'después de corregir, la misma venta se guarda bien');

-- Datos inválidos del cliente
select throws_ok($$ select registrar_venta_cliente_nuevo('60000000-0000-0000-0000-000000000030', '10000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000030', '   ', null,
  '[{"producto_id":"30000000-0000-0000-0000-000000000001","cantidad":1,"precio_unitario":1000000}]') $$,
  '22023', 'Escribí el nombre del cliente (hasta 80 caracteres)', 'nombre vacío');
select throws_ok($$ select registrar_venta_cliente_nuevo('60000000-0000-0000-0000-000000000031', '10000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000031', repeat('x', 81), null,
  '[{"producto_id":"30000000-0000-0000-0000-000000000001","cantidad":1,"precio_unitario":1000000}]') $$,
  '22023', 'Escribí el nombre del cliente (hasta 80 caracteres)', 'nombre de más de 80 caracteres');
select throws_ok($$ select registrar_venta_cliente_nuevo('60000000-0000-0000-0000-000000000032', '10000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000032', 'Iván', repeat('1', 41),
  '[{"producto_id":"30000000-0000-0000-0000-000000000001","cantidad":1,"precio_unitario":1000000}]') $$,
  '22023', 'El teléfono puede tener hasta 40 caracteres', 'teléfono de más de 40 caracteres');

-- ---------------------------------------------------------------------------------
-- Permisos: solo en tu negocio; es_prueba según el modo del negocio
-- ---------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select throws_ok($$ select registrar_venta_cliente_nuevo('60000000-0000-0000-0000-000000000040', '10000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000040', 'Intruso', null,
  '[{"producto_id":"30000000-0000-0000-0000-000000000001","cantidad":1,"precio_unitario":1000000}]') $$,
  '42501', 'No sos socio de este negocio', 'un socio de otro negocio no puede crear clientes ni ventas en el mío');
select is(_prueba_error($$ select registrar_venta_cliente_nuevo('60000000-0000-0000-0000-000000000041', '10000000-0000-0000-0000-000000000002',
  '50000000-0000-0000-0000-000000000041', 'Fabián', null,
  '[{"producto_id":"30000000-0000-0000-0000-000000000001","cantidad":1,"precio_unitario":1000000}]') $$) like '23503|%',
  true, 'en su negocio no ve mis clientes (no hay duplicado) ni puede vender mis productos');
select is((select count(*)::int from clientes where id in ('50000000-0000-0000-0000-000000000040', '50000000-0000-0000-0000-000000000041')), 0,
  'ninguno de los dos intentos dejó cliente');
update clientes set direccion = 'Hackeada' where id = '50000000-0000-0000-0000-00000000000f';
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is((select direccion from clientes where id = '50000000-0000-0000-0000-00000000000f'), 'Av. Mate de Luna 1200',
  'un socio de otro negocio no puede cambiar la dirección de mis clientes');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
insert into productos (id, negocio_id, marca, modelo, precio_general) values
  ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', 'Real', '1', 1000000);
select registrar_compra('40000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003',
  '30000000-0000-0000-0000-000000000003', date '2026-10-01', 5, 500, 140000);
select registrar_venta_cliente_nuevo('60000000-0000-0000-0000-000000000050', '10000000-0000-0000-0000-000000000003',
  '50000000-0000-0000-0000-000000000050', 'Cliente real', null,
  '[{"producto_id":"30000000-0000-0000-0000-000000000003","cantidad":1,"precio_unitario":1000000}]');
select results_eq($$ select es_prueba, registrado_por from clientes where id = '50000000-0000-0000-0000-000000000050' $$,
  $$ values (false, '20000000-0000-0000-0000-000000000004'::uuid) $$,
  'en un negocio fuera de modo prueba, el cliente queda como dato real (es_prueba = false)');

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select throws_ok($$ select registrar_venta_cliente_nuevo('60000000-0000-0000-0000-000000000060', '10000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000060', 'Anónimo', null, '[]') $$,
  '42501', null, 'el anónimo no puede llamarla');

select * from finish();
rollback;
