-- Datos INVENTADOS para desarrollo local (se cargan con `npx supabase db reset`).
-- Nunca poner acá datos reales de clientes ni contraseñas.
insert into public.negocios (id, nombre)
values ('11111111-1111-4111-8111-111111111111', 'Negocio de prueba')
on conflict (id) do nothing;

insert into public.socios (id, negocio_id, nombre, orden)
values
  ('22222222-2222-4222-8222-222222222221', '11111111-1111-4111-8111-111111111111', 'Socio A (prueba)', 1),
  ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'Socio B (prueba)', 2)
on conflict (id) do nothing;
