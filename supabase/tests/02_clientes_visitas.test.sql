-- Pruebas del módulo 1.2: clientes, visitas, archivo y borrado de datos de prueba.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(42);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'socio.a@pgtap.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b1', 'otro@pgtap.test',    'authenticated', 'authenticated');
insert into negocios (id, nombre) values
  ('10000000-0000-0000-0000-000000000001', 'Negocio de prueba'),
  ('10000000-0000-0000-0000-000000000002', 'Otro negocio');
insert into socios (id, negocio_id, nombre, user_id, orden) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Socio A', '00000000-0000-0000-0000-0000000000a1', 1),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 'Otro socio', '00000000-0000-0000-0000-0000000000b1', 1);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

-- Clientes ---------------------------------------------------------------------------------
select lives_ok($$
  insert into clientes (id, negocio_id, nombre, telefono, notas) values
    ('50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '  Ana   Gómez ', ' 381 555-1234 ', '  '),
    ('50000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Bruno', null, 'Paga los viernes')
$$, 'el socio crea clientes');

select results_eq(
  $$select nombre, telefono, notas, intervalo_visita_dias, es_prueba, registrado_por
      from clientes where id = '50000000-0000-0000-0000-000000000001'$$,
  $$values ('Ana Gómez'::text, '381 555-1234'::text, null::text, 14, true, '20000000-0000-0000-0000-000000000001'::uuid)$$,
  'normaliza espacios, notas vacías quedan nulas, intervalo 14 por defecto, marcado como prueba y con quién lo registró'
);

select throws_ok($$
  insert into clientes (id, negocio_id, nombre) values (gen_random_uuid(), '10000000-0000-0000-0000-000000000001', 'ana gómez')
$$, '23505', null, 'no se repite el nombre (sin importar mayúsculas)');
select throws_ok($$
  insert into clientes (id, negocio_id, nombre, intervalo_visita_dias) values (gen_random_uuid(), '10000000-0000-0000-0000-000000000001', 'Carla', 0)
$$, '23514', null, 'el intervalo debe ser al menos 1 día');
select throws_ok($$
  insert into clientes (id, negocio_id, nombre) values (gen_random_uuid(), '10000000-0000-0000-0000-000000000001', '   ')
$$, '23514', null, 'el nombre es obligatorio');
select throws_ok($$
  insert into clientes (id, negocio_id, nombre, ultima_visita_inicial) values (gen_random_uuid(), '10000000-0000-0000-0000-000000000001', 'Carla', '2026-01-01')
$$, '42501', null, 'la visita inicial solo la carga la importación');
select throws_ok($$
  insert into clientes (id, negocio_id, nombre) values (gen_random_uuid(), '10000000-0000-0000-0000-000000000002', 'Carla')
$$, '42501', null, 'no se crean clientes en otro negocio');

select lives_ok($$
  update clientes set intervalo_visita_dias = 7, telefono = '3815551234' where id = '50000000-0000-0000-0000-000000000002'
$$, 'se edita intervalo y teléfono');
select is((select intervalo_visita_dias from clientes where id = '50000000-0000-0000-0000-000000000002'), 7, 'intervalo actualizado');
select throws_ok($$
  update clientes set archivado_en = now() where id = '50000000-0000-0000-0000-000000000002'
$$, '42501', null, 'archivar solo con la función');
select throws_ok($$
  delete from clientes where id = '50000000-0000-0000-0000-000000000002'
$$, '42501', null, 'los clientes no se borran');

-- Archivar ------------------------------------------------------------------------------------
select ok((archivar_cliente('50000000-0000-0000-0000-000000000002', true)).archivado_en is not null, 'archivar');
select ok((archivar_cliente('50000000-0000-0000-0000-000000000002', true)).archivado_en is not null, 'archivar dos veces no falla');
select ok((archivar_cliente('50000000-0000-0000-0000-000000000002', false)).archivado_en is null, 'desarchivar');

-- Visitas --------------------------------------------------------------------------------------
select is((select ultima_visita from v_clientes where cliente_id = '50000000-0000-0000-0000-000000000001'), null::date,
  'sin visitas, la última visita es nula');
select is((select fecha_alta from v_clientes where cliente_id = '50000000-0000-0000-0000-000000000001'), hoy_tucuman(),
  'la fecha de alta es hoy (hora de Tucumán)');

select lives_ok($$
  select marcar_visitado('60000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', date '2026-10-15', 'Pasé y no estaba')
$$, 'marcar visita con fecha pasada');
select lives_ok($$
  select marcar_visitado('60000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000001', date '2026-10-20')
$$, 'marcar otra visita');
select lives_ok($$
  select marcar_visitado('60000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000001', date '2026-10-01')
$$, 'cargar tarde una visita más vieja');
select results_eq(
  $$select ultima_visita, ultima_visita_id from v_clientes where cliente_id = '50000000-0000-0000-0000-000000000001'$$,
  $$values (date '2026-10-20', '60000000-0000-0000-0000-000000000002'::uuid)$$,
  'la última visita es la de fecha más reciente, no la última cargada'
);
select is((select registrado_por from visitas where id = '60000000-0000-0000-0000-000000000001'),
  '20000000-0000-0000-0000-000000000001'::uuid, 'la visita registra qué socio la marcó');

select lives_ok($$
  select marcar_visitado('60000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000001', date '2026-10-20')
$$, 'reenviar la misma visita no falla');
select is((select count(*)::int from visitas), 3, 'el reenvío no duplica');
select throws_ok($$
  select marcar_visitado('60000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000001', date '2026-10-21')
$$, '23505', null, 'mismo id con otra fecha: rechazado');
select throws_ok($$
  select marcar_visitado(gen_random_uuid(), '50000000-0000-0000-0000-000000000001', hoy_tucuman() + 1)
$$, '22023', null, 'visita con fecha futura: rechazada');
select lives_ok($$
  select marcar_visitado('60000000-0000-0000-0000-000000000004', '50000000-0000-0000-0000-000000000002')
$$, 'sin fecha, la visita es de hoy');
select is((select fecha from visitas where id = '60000000-0000-0000-0000-000000000004'), hoy_tucuman(), 'fecha de hoy en Tucumán');

select throws_ok($$
  insert into visitas (id, negocio_id, cliente_id, fecha) values (gen_random_uuid(), '10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '2026-10-01')
$$, '42501', null, 'no se insertan visitas directo');
select throws_ok($$
  update visitas set fecha = '2026-10-25' where id = '60000000-0000-0000-0000-000000000002'
$$, '42501', null, 'las visitas no se modifican');
select throws_ok($$
  delete from visitas
$$, '42501', null, 'las visitas no se borran');

-- Anular visita -------------------------------------------------------------------------------------
select lives_ok($$ select anular_visita('60000000-0000-0000-0000-000000000002') $$, 'anular una visita marcada por error');
select is((select ultima_visita from v_clientes where cliente_id = '50000000-0000-0000-0000-000000000001'), date '2026-10-15',
  'al anularla, la última visita vuelve a la anterior');
select lives_ok($$ select anular_visita('60000000-0000-0000-0000-000000000002') $$, 'anular dos veces no falla');
select is((select anulado_por from visitas where id = '60000000-0000-0000-0000-000000000002'),
  '20000000-0000-0000-0000-000000000001'::uuid, 'queda registrado quién la anuló');

-- Otro negocio --------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select is((select count(*)::int from clientes), 0, 'otro negocio no ve clientes ajenos');
select is((select count(*)::int from v_clientes), 0, 'otro negocio no ve la vista de clientes ajena');
select is((select count(*)::int from visitas), 0, 'otro negocio no ve visitas ajenas');
select throws_ok($$ select marcar_visitado(gen_random_uuid(), '50000000-0000-0000-0000-000000000001') $$,
  '23503', null, 'no puede marcar visitas en clientes ajenos');
select throws_ok($$ select archivar_cliente('50000000-0000-0000-0000-000000000001', true) $$,
  '23503', null, 'no puede archivar clientes ajenos');

-- Anónimo ---------------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select throws_ok($$ select * from clientes $$, '42501', null, 'el anónimo no ve clientes');
select throws_ok($$ select marcar_visitado(gen_random_uuid(), '50000000-0000-0000-0000-000000000001') $$,
  '42501', null, 'el anónimo no marca visitas');

-- Borrado de datos de prueba --------------------------------------------------------------------------
reset role;
select set_config('request.jwt.claims', '', true);
select results_eq(
  $$select tabla, filas_borradas from borrar_datos_de_prueba('10000000-0000-0000-0000-000000000001', 'BORRAR DATOS DE PRUEBA')$$,
  $$values ('visitas'::text, 4::bigint), ('movimientos_stock'::text, 0::bigint), ('compras'::text, 0::bigint),
           ('clientes'::text, 2::bigint), ('productos'::text, 0::bigint)$$,
  'el borrado de datos de prueba incluye clientes y visitas'
);

select * from finish();
rollback;
