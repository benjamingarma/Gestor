-- Pruebas de seguridad del módulo 1.0.
-- Escenario inventado: dos negocios, cada uno con sus socios. Un usuario sin socio.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(21);

-- Datos de prueba (como administrador) ---------------------------------------------
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'socio.a@ejemplo.test',  'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a2', 'socio.b@ejemplo.test',  'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b1', 'otro@ejemplo.test',     'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c1', 'intruso@ejemplo.test',  'authenticated', 'authenticated');

insert into negocios (id, nombre) values
  ('10000000-0000-0000-0000-000000000001', 'Negocio de prueba'),
  ('10000000-0000-0000-0000-000000000002', 'Otro negocio');

insert into socios (id, negocio_id, nombre, user_id, orden) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Socio A', '00000000-0000-0000-0000-0000000000a1', 1),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Socio B', null, 2),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 'Otro socio', '00000000-0000-0000-0000-0000000000b1', 1);

-- Reglas generales (valen para todas las tablas, también las de módulos futuros) ---
select is(
  (select count(*)::int from pg_tables where schemaname = 'public' and not rowsecurity),
  0,
  'todas las tablas de public tienen RLS activada'
);

select is(
  (select count(*)::int
     from information_schema.role_table_grants
    where table_schema = 'public' and grantee = 'anon'),
  0,
  'el rol anónimo no tiene permisos sobre ninguna tabla'
);

select is(
  (select count(*)::int
     from information_schema.role_table_grants
    where table_schema = 'public' and grantee = 'authenticated'
      and privilege_type = 'DELETE'
      and table_name in ('negocios', 'socios')),
  0,
  'nadie puede borrar negocios ni socios desde la app'
);

-- Usuario anónimo ----------------------------------------------------------------
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select throws_ok('select * from negocios', '42501', null, 'anónimo no puede leer negocios');
select throws_ok('select * from socios',   '42501', null, 'anónimo no puede leer socios');
select ok(ping() is not null, 'anónimo puede llamar a ping() (mantener el proyecto activo)');
select throws_ok(
  $$select es_socio('10000000-0000-0000-0000-000000000001')$$, '42501', null,
  'anónimo no puede ejecutar es_socio()'
);

-- Socio A (vinculado al negocio 1) ----------------------------------------------------
reset role;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

select results_eq(
  'select nombre from negocios',
  array['Negocio de prueba'],
  'el socio A ve solo su negocio'
);
select results_eq(
  'select nombre from socios order by orden',
  array['Socio A', 'Socio B'],
  'el socio A ve los dos socios de su negocio (también el que no tiene cuenta)'
);
select ok(es_socio('10000000-0000-0000-0000-000000000001'), 'es_socio() verdadero en su negocio');
select ok(not es_socio('10000000-0000-0000-0000-000000000002'), 'es_socio() falso en otro negocio');
select is(
  socio_actual('10000000-0000-0000-0000-000000000001'),
  '20000000-0000-0000-0000-000000000001'::uuid,
  'socio_actual() devuelve el socio del usuario logueado'
);
select is(socio_actual('10000000-0000-0000-0000-000000000002'), null, 'socio_actual() es NULL en otro negocio');

select throws_ok(
  $$insert into negocios (nombre) values ('Negocio trucho')$$, '42501', null,
  'un socio no puede crear negocios'
);
select throws_ok(
  $$insert into socios (negocio_id, nombre, orden)
    values ('10000000-0000-0000-0000-000000000001', 'Tercer socio', 3)$$, '42501', null,
  'un socio no puede agregar socios'
);
select throws_ok(
  $$update socios set user_id = '00000000-0000-0000-0000-0000000000c1'
    where id = '20000000-0000-0000-0000-000000000002'$$, '42501', null,
  'un socio no puede vincular cuentas a otro socio'
);
select throws_ok(
  $$delete from socios where id = '20000000-0000-0000-0000-000000000002'$$, '42501', null,
  'un socio no puede borrar socios'
);

-- Socio del otro negocio ---------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select results_eq('select nombre from negocios', array['Otro negocio'], 'el otro socio no ve el negocio 1');
select is(
  (select count(*)::int from socios where negocio_id = '10000000-0000-0000-0000-000000000001'),
  0,
  'el otro socio no ve los socios del negocio 1'
);

-- Usuario autenticado que no es socio de nada ------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select is((select count(*)::int from negocios), 0, 'un usuario sin socio no ve ningún negocio');
select is((select count(*)::int from socios),   0, 'un usuario sin socio no ve ningún socio');

select * from finish();
rollback;
