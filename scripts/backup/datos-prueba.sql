-- Datos INVENTADOS para la prueba de backup y restauración (CI, módulo 1.9). Se cargan sobre supabase/seed.sql.
-- Cubren todas las tablas: productos, compras (una con tipo de cambio estimado), clientes, precios especiales,
-- visitas, ventas (una anulada, una con pago, una a cliente nuevo), pagos, saldos del papel y ajustes de stock.
\set ON_ERROR_STOP 1
insert into auth.users (id, email, aud, role) values ('00000000-0000-4000-8000-0000000000b1', 'backup@prueba.test', 'authenticated', 'authenticated')
  on conflict (id) do nothing;
update public.socios set user_id = '00000000-0000-4000-8000-0000000000b1' where id = '22222222-2222-4222-8222-222222222221';

begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b1","role":"authenticated"}', true);
insert into public.productos (id, negocio_id, marca, modelo, precio_general) values
  ('b0000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Backup', 'A', 1000000),
  ('b0000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'Backup', 'B', 1500000);
insert into public.clientes (id, negocio_id, nombre, telefono) values
  ('b1000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Cliente backup 1', '381 000-0001'),
  ('b1000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'Cliente backup 2', null);
select public.registrar_compra('b2000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'b0000000-0000-4000-8000-000000000001',
  date '2026-09-01', 20, 500, 140000, false, null, 'inventario_inicial');
select public.registrar_compra('b2000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'b0000000-0000-4000-8000-000000000002',
  date '2026-10-01', 10, 799, 123750, true, 'tipo de cambio estimado', 'compra');
select public.fijar_precio_especial('b1000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 900000);
select public.registrar_saldo_inicial('b3000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000002', 'deuda', 800000, date '2026-08-15', 'del papel');
select public.registrar_venta_con_pago('b4000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'b1000000-0000-4000-8000-000000000001',
  '[{"producto_id":"b0000000-0000-4000-8000-000000000001","cantidad":3,"precio_unitario":900000}]',
  'b5000000-0000-4000-8000-000000000001', 1000000, 'transferencia', null, date '2026-11-10');
select public.registrar_venta_con_pago('b4000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'b1000000-0000-4000-8000-000000000002',
  '[{"producto_id":"b0000000-0000-4000-8000-000000000002","cantidad":2,"precio_unitario":1500000},{"producto_id":"b0000000-0000-4000-8000-000000000001","cantidad":1,"precio_unitario":1000000}]',
  null, null, null, null, date '2026-11-12');
select public.registrar_venta_con_pago('b4000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'b1000000-0000-4000-8000-000000000003',
  '[{"producto_id":"b0000000-0000-4000-8000-000000000001","cantidad":1,"precio_unitario":1000000}]',
  'b5000000-0000-4000-8000-000000000003', 400000, 'efectivo', null, null, null, null, '{"nombre":"Cliente backup nuevo","telefono":null,"direccion":"Calle 1"}');
select public.anular_venta('b4000000-0000-4000-8000-000000000003', 'prueba de anulación');
select public.registrar_pago('b5000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000002', 1200000, 'efectivo', date '2026-11-15', null, null);
select public.registrar_ajuste('b6000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'b0000000-0000-4000-8000-000000000002', 1, 'rotura', null, null);
commit;
