-- Módulo 1.4 — Pagos, saldos iniciales y cuenta corriente.
-- La aplicación de los pagos a las deudas más viejas (FIFO) se calcula en
-- src/dominio/cuentaCorriente.ts (plan A4); acá se guardan los hechos y los totales.
-- Decisiones explicadas en docs/decisiones/modulo-1.4.md.

-- =====================================================================================
-- 1. Pagos (cobros)
-- =====================================================================================
create table public.pagos (
  id                uuid primary key,              -- generado en el celular
  negocio_id        uuid not null references public.negocios (id),
  cliente_id        uuid not null,
  secuencia         bigint generated always as identity,
  fecha             date not null check (fecha >= date '2020-01-01'),
  importe           bigint not null check (importe between 1 and 100000000000),   -- centavos ARS
  medio             text not null check (medio in ('efectivo', 'transferencia', 'mercado_pago')),
  recibido_por      uuid not null references public.socios (id),
  nota              text check (length(nota) <= 500),
  anulado_en        timestamptz,
  anulado_por       uuid references public.socios (id),
  motivo_anulacion  text,
  es_prueba         boolean not null default false,
  registrado_por    uuid not null references public.socios (id),
  creado_en         timestamptz not null default now(),
  foreign key (negocio_id, cliente_id) references public.clientes (negocio_id, id),
  check ((anulado_en is null) = (anulado_por is null)),
  check (anulado_en is null or length(trim(motivo_anulacion)) > 0)
);

comment on table public.pagos is 'Cobros a cuenta del cliente. Se aplican solos a las deudas más viejas.';
comment on column public.pagos.recibido_por is 'Socio que tiene la plata.';

create index pagos_cliente_idx on public.pagos (cliente_id, fecha);
create index pagos_fecha_idx on public.pagos (negocio_id, fecha desc);

-- =====================================================================================
-- 2. Saldos iniciales (deudas y saldos a favor que vienen del papel, plan A5)
--    Cuentan en la cuenta corriente, nunca como venta ni como ganancia.
-- =====================================================================================
create table public.saldos_iniciales (
  id                uuid primary key,              -- generado en el celular / importación
  negocio_id        uuid not null references public.negocios (id),
  cliente_id        uuid not null,
  tipo              text not null check (tipo in ('deuda', 'a_favor')),
  importe           bigint not null check (importe between 1 and 100000000000),
  fecha             date not null check (fecha >= date '2000-01-01'),
  nota              text check (length(nota) <= 500),
  importacion_id    uuid,                          -- FK en el módulo de importación
  anulado_en        timestamptz,
  anulado_por       uuid references public.socios (id),
  motivo_anulacion  text,
  es_prueba         boolean not null default false,
  registrado_por    uuid not null references public.socios (id),
  creado_en         timestamptz not null default now(),
  foreign key (negocio_id, cliente_id) references public.clientes (negocio_id, id),
  check ((anulado_en is null) = (anulado_por is null)),
  check (anulado_en is null or length(trim(motivo_anulacion)) > 0)
);

create index saldos_iniciales_cliente_idx on public.saldos_iniciales (cliente_id);

-- Solo cambian para anularse, una vez.
create or replace function public.solo_anulacion_generica()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_viejo jsonb := to_jsonb(old) - 'anulado_en' - 'anulado_por' - 'motivo_anulacion';
  v_nuevo jsonb := to_jsonb(new) - 'anulado_en' - 'anulado_por' - 'motivo_anulacion';
begin
  if old.anulado_en is not null then
    raise exception 'Ya está anulado' using errcode = '42501';
  end if;
  if v_viejo is distinct from v_nuevo then
    raise exception 'No se modifica: se anula y se carga de nuevo' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.solo_anulacion_generica() from public, anon, authenticated;

create trigger pagos_completar_alta before insert on public.pagos
  for each row execute function public.completar_alta();
create trigger pagos_solo_anulacion before update on public.pagos
  for each row execute function public.solo_anulacion_generica();
create trigger pagos_impedir_borrado before delete on public.pagos
  for each row execute function public.impedir_borrado();

create trigger saldos_iniciales_completar_alta before insert on public.saldos_iniciales
  for each row execute function public.completar_alta();
create trigger saldos_iniciales_solo_anulacion before update on public.saldos_iniciales
  for each row execute function public.solo_anulacion_generica();
create trigger saldos_iniciales_impedir_borrado before delete on public.saldos_iniciales
  for each row execute function public.impedir_borrado();

alter table public.pagos enable row level security;
alter table public.saldos_iniciales enable row level security;
revoke all on public.pagos, public.saldos_iniciales from anon, authenticated;
grant select on public.pagos, public.saldos_iniciales to authenticated;   -- escritura solo por funciones
create policy "socios leen pagos" on public.pagos for select to authenticated
  using ((select public.es_socio(negocio_id)));
create policy "socios leen saldos iniciales" on public.saldos_iniciales for select to authenticated
  using ((select public.es_socio(negocio_id)));

-- =====================================================================================
-- 3. Funciones de escritura (idempotentes)
-- =====================================================================================
create or replace function public.registrar_pago(
  p_id uuid,
  p_cliente_id uuid,
  p_importe bigint,
  p_medio text,
  p_fecha date default null,
  p_recibido_por uuid default null,
  p_nota text default null
)
returns public.pagos
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cliente public.clientes;
  v_pago public.pagos;
  v_fecha date := coalesce(p_fecha, public.hoy_tucuman());
  v_receptor uuid;
begin
  if p_id is null then
    raise exception 'Falta el identificador del pago' using errcode = '22023';
  end if;
  select * into v_cliente from public.clientes where id = p_cliente_id;
  if not found or not public.es_socio(v_cliente.negocio_id) then
    raise exception 'Cliente inexistente' using errcode = '23503';
  end if;

  select * into v_pago from public.pagos where id = p_id;
  if found then
    if v_pago.cliente_id = p_cliente_id and v_pago.importe = p_importe and v_pago.medio = p_medio then
      return v_pago;
    end if;
    raise exception 'Ya existe otro pago con este identificador' using errcode = '23505';
  end if;

  if v_fecha > public.hoy_tucuman() then
    raise exception 'La fecha del cobro no puede ser futura' using errcode = '22023';
  end if;
  if p_importe is null or p_importe <= 0 then
    raise exception 'El importe debe ser mayor que cero' using errcode = '22023';
  end if;
  v_receptor := coalesce(p_recibido_por, public.socio_actual(v_cliente.negocio_id));
  if not exists (select 1 from public.socios where id = v_receptor and negocio_id = v_cliente.negocio_id) then
    raise exception 'El socio que recibió el dinero no es de este negocio' using errcode = '22023';
  end if;

  insert into public.pagos (id, negocio_id, cliente_id, fecha, importe, medio, recibido_por, nota)
  values (p_id, v_cliente.negocio_id, p_cliente_id, v_fecha, p_importe, p_medio, v_receptor, nullif(trim(p_nota), ''))
  returning * into v_pago;
  return v_pago;
end;
$$;

create or replace function public.anular_pago(p_pago_id uuid, p_motivo text)
returns public.pagos
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pago public.pagos;
begin
  select * into v_pago from public.pagos where id = p_pago_id for update;
  if not found or not public.es_socio(v_pago.negocio_id) then
    raise exception 'Pago inexistente' using errcode = '23503';
  end if;
  if v_pago.anulado_en is not null then
    return v_pago;
  end if;
  if p_motivo is null or length(trim(p_motivo)) = 0 then
    raise exception 'Indicá el motivo de la anulación' using errcode = '22023';
  end if;
  update public.pagos
     set anulado_en = now(), anulado_por = public.socio_actual(v_pago.negocio_id), motivo_anulacion = trim(p_motivo)
   where id = p_pago_id
   returning * into v_pago;
  return v_pago;
end;
$$;

create or replace function public.registrar_saldo_inicial(
  p_id uuid,
  p_cliente_id uuid,
  p_tipo text,
  p_importe bigint,
  p_fecha date,
  p_nota text default null
)
returns public.saldos_iniciales
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cliente public.clientes;
  v_saldo public.saldos_iniciales;
begin
  if p_id is null then
    raise exception 'Falta el identificador' using errcode = '22023';
  end if;
  select * into v_cliente from public.clientes where id = p_cliente_id;
  if not found or not public.es_socio(v_cliente.negocio_id) then
    raise exception 'Cliente inexistente' using errcode = '23503';
  end if;

  select * into v_saldo from public.saldos_iniciales where id = p_id;
  if found then
    if v_saldo.cliente_id = p_cliente_id and v_saldo.tipo = p_tipo and v_saldo.importe = p_importe then
      return v_saldo;
    end if;
    raise exception 'Ya existe otro saldo con este identificador' using errcode = '23505';
  end if;

  if p_fecha is null or p_fecha > public.hoy_tucuman() then
    raise exception 'La fecha no puede ser futura' using errcode = '22023';
  end if;
  if p_tipo not in ('deuda', 'a_favor') then
    raise exception 'Tipo inválido' using errcode = '22023';
  end if;

  insert into public.saldos_iniciales (id, negocio_id, cliente_id, tipo, importe, fecha, nota)
  values (p_id, v_cliente.negocio_id, p_cliente_id, p_tipo, p_importe, p_fecha, nullif(trim(p_nota), ''))
  returning * into v_saldo;
  return v_saldo;
end;
$$;

create or replace function public.anular_saldo_inicial(p_id uuid, p_motivo text)
returns public.saldos_iniciales
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_saldo public.saldos_iniciales;
begin
  select * into v_saldo from public.saldos_iniciales where id = p_id for update;
  if not found or not public.es_socio(v_saldo.negocio_id) then
    raise exception 'Saldo inexistente' using errcode = '23503';
  end if;
  if v_saldo.anulado_en is not null then
    return v_saldo;
  end if;
  if p_motivo is null or length(trim(p_motivo)) = 0 then
    raise exception 'Indicá el motivo de la anulación' using errcode = '22023';
  end if;
  update public.saldos_iniciales
     set anulado_en = now(), anulado_por = public.socio_actual(v_saldo.negocio_id), motivo_anulacion = trim(p_motivo)
   where id = p_id
   returning * into v_saldo;
  return v_saldo;
end;
$$;

revoke all on function public.registrar_pago(uuid, uuid, bigint, text, date, uuid, text) from public, anon;
revoke all on function public.anular_pago(uuid, text) from public, anon;
revoke all on function public.registrar_saldo_inicial(uuid, uuid, text, bigint, date, text) from public, anon;
revoke all on function public.anular_saldo_inicial(uuid, text) from public, anon;
grant execute on function public.registrar_pago(uuid, uuid, bigint, text, date, uuid, text) to authenticated;
grant execute on function public.anular_pago(uuid, text) to authenticated;
grant execute on function public.registrar_saldo_inicial(uuid, uuid, text, bigint, date, text) to authenticated;
grant execute on function public.anular_saldo_inicial(uuid, text) to authenticated;

-- =====================================================================================
-- 4. Vistas
-- =====================================================================================

-- Totales de la cuenta corriente de cada cliente (también archivados).
-- saldo > 0: nos debe · saldo < 0: tiene saldo a favor.
create view public.v_cuentas_clientes
with (security_invoker = true) as
select
  c.id   as cliente_id,
  c.negocio_id,
  c.nombre,
  c.archivado_en,
  coalesce(v.total, 0)::bigint                                       as total_ventas,
  coalesce(si.deuda, 0)::bigint                                      as deuda_inicial,
  coalesce(p.total, 0)::bigint                                       as total_pagos,
  coalesce(si.a_favor, 0)::bigint                                    as a_favor_inicial,
  (coalesce(v.total, 0) + coalesce(si.deuda, 0) - coalesce(p.total, 0) - coalesce(si.a_favor, 0))::bigint as saldo,
  p.ultimo_pago
from public.clientes c
left join (
  select v.cliente_id, sum(i.cantidad * i.precio_unitario) as total
  from public.ventas v join public.venta_items i on i.venta_id = v.id
  where v.anulado_en is null
  group by v.cliente_id
) v on v.cliente_id = c.id
left join (
  select cliente_id,
         sum(importe) filter (where tipo = 'deuda')   as deuda,
         sum(importe) filter (where tipo = 'a_favor') as a_favor
  from public.saldos_iniciales where anulado_en is null
  group by cliente_id
) si on si.cliente_id = c.id
left join (
  select cliente_id, sum(importe) as total, max(fecha) as ultimo_pago
  from public.pagos where anulado_en is null
  group by cliente_id
) p on p.cliente_id = c.id;

-- Pagos con nombres, para listados.
create view public.v_pagos
with (security_invoker = true) as
select p.id as pago_id, p.negocio_id, p.cliente_id, c.nombre as cliente_nombre, p.secuencia, p.fecha, p.importe,
       p.medio, p.recibido_por, s.nombre as recibido_por_nombre, p.nota, p.anulado_en, p.motivo_anulacion,
       p.registrado_por, r.nombre as registrado_por_nombre, p.creado_en, p.es_prueba
from public.pagos p
join public.clientes c on c.id = p.cliente_id
join public.socios s on s.id = p.recibido_por
join public.socios r on r.id = p.registrado_por;

revoke all on public.v_cuentas_clientes, public.v_pagos from anon, authenticated;
grant select on public.v_cuentas_clientes, public.v_pagos to authenticated;

-- =====================================================================================
-- 5. Datos de prueba: sumar pagos y saldos iniciales (plan A20)
-- =====================================================================================
create or replace function public.contar_datos_de_prueba(p_negocio_id uuid)
returns table (tabla text, filas_de_prueba bigint, filas_reales bigint)
language sql
stable
set search_path = ''
as $$
  select 'visitas', count(*) filter (where es_prueba), count(*) filter (where not es_prueba) from public.visitas where negocio_id = p_negocio_id
  union all select 'pagos', count(*) filter (where es_prueba), count(*) filter (where not es_prueba) from public.pagos where negocio_id = p_negocio_id
  union all select 'saldos_iniciales', count(*) filter (where es_prueba), count(*) filter (where not es_prueba) from public.saldos_iniciales where negocio_id = p_negocio_id
  union all select 'movimientos_stock', count(*) filter (where es_prueba), count(*) filter (where not es_prueba) from public.movimientos_stock where negocio_id = p_negocio_id
  union all select 'venta_items', count(*) filter (where es_prueba), count(*) filter (where not es_prueba) from public.venta_items where negocio_id = p_negocio_id
  union all select 'ventas', count(*) filter (where es_prueba), count(*) filter (where not es_prueba) from public.ventas where negocio_id = p_negocio_id
  union all select 'precios_especiales', count(*) filter (where es_prueba), count(*) filter (where not es_prueba) from public.precios_especiales where negocio_id = p_negocio_id
  union all select 'compras', count(*) filter (where es_prueba), count(*) filter (where not es_prueba) from public.compras where negocio_id = p_negocio_id
  union all select 'clientes', count(*) filter (where es_prueba), count(*) filter (where not es_prueba) from public.clientes where negocio_id = p_negocio_id
  union all select 'productos', count(*) filter (where es_prueba), count(*) filter (where not es_prueba) from public.productos where negocio_id = p_negocio_id;
$$;

create or replace function public.borrar_datos_de_prueba(p_negocio_id uuid, p_confirmacion text)
returns table (tabla text, filas_borradas bigint)
language plpgsql
set search_path = ''
as $$
declare
  v_nombre text;
  v_n bigint;
begin
  select nombre into v_nombre from public.negocios where id = p_negocio_id;
  if v_nombre is null then
    raise exception 'Negocio inexistente';
  end if;
  if p_confirmacion is distinct from 'BORRAR DATOS DE PRUEBA' then
    raise exception 'Para confirmar, escribí exactamente: BORRAR DATOS DE PRUEBA';
  end if;

  -- Ninguna fila real puede apuntar a una de prueba.
  if exists (select 1 from public.movimientos_stock m join public.compras c on c.id = m.compra_id
              where m.negocio_id = p_negocio_id and not m.es_prueba and c.es_prueba)
     or exists (select 1 from public.movimientos_stock m join public.productos p on p.id = m.producto_id
              where m.negocio_id = p_negocio_id and not m.es_prueba and p.es_prueba)
     or exists (select 1 from public.movimientos_stock m join public.venta_items i on i.id = m.venta_item_id
              where m.negocio_id = p_negocio_id and not m.es_prueba and i.es_prueba)
     or exists (select 1 from public.compras c join public.productos p on p.id = c.producto_id
              where c.negocio_id = p_negocio_id and not c.es_prueba and p.es_prueba)
     or exists (select 1 from public.visitas v join public.clientes c on c.id = v.cliente_id
              where v.negocio_id = p_negocio_id and not v.es_prueba and c.es_prueba)
     or exists (select 1 from public.ventas v join public.clientes c on c.id = v.cliente_id
              where v.negocio_id = p_negocio_id and not v.es_prueba and c.es_prueba)
     or exists (select 1 from public.venta_items i join public.ventas v on v.id = i.venta_id
              where i.negocio_id = p_negocio_id and not i.es_prueba and v.es_prueba)
     or exists (select 1 from public.venta_items i join public.productos p on p.id = i.producto_id
              where i.negocio_id = p_negocio_id and not i.es_prueba and p.es_prueba)
     or exists (select 1 from public.precios_especiales pe
                  join public.clientes c on c.id = pe.cliente_id
                  join public.productos p on p.id = pe.producto_id
              where pe.negocio_id = p_negocio_id and not pe.es_prueba and (c.es_prueba or p.es_prueba))
     or exists (select 1 from public.pagos p join public.clientes c on c.id = p.cliente_id
              where p.negocio_id = p_negocio_id and not p.es_prueba and c.es_prueba)
     or exists (select 1 from public.saldos_iniciales s join public.clientes c on c.id = s.cliente_id
              where s.negocio_id = p_negocio_id and not s.es_prueba and c.es_prueba) then
    raise exception 'Hay datos reales que dependen de datos de prueba. No se borró nada.';
  end if;

  perform set_config('gestor.borrando_datos_de_prueba', 'si', true);

  delete from public.visitas where negocio_id = p_negocio_id and es_prueba;
  get diagnostics v_n = row_count; tabla := 'visitas'; filas_borradas := v_n; return next;
  delete from public.pagos where negocio_id = p_negocio_id and es_prueba;
  get diagnostics v_n = row_count; tabla := 'pagos'; filas_borradas := v_n; return next;
  delete from public.saldos_iniciales where negocio_id = p_negocio_id and es_prueba;
  get diagnostics v_n = row_count; tabla := 'saldos_iniciales'; filas_borradas := v_n; return next;
  delete from public.movimientos_stock where negocio_id = p_negocio_id and es_prueba;
  get diagnostics v_n = row_count; tabla := 'movimientos_stock'; filas_borradas := v_n; return next;
  delete from public.venta_items where negocio_id = p_negocio_id and es_prueba;
  get diagnostics v_n = row_count; tabla := 'venta_items'; filas_borradas := v_n; return next;
  delete from public.ventas where negocio_id = p_negocio_id and es_prueba;
  get diagnostics v_n = row_count; tabla := 'ventas'; filas_borradas := v_n; return next;
  delete from public.precios_especiales where negocio_id = p_negocio_id and es_prueba;
  get diagnostics v_n = row_count; tabla := 'precios_especiales'; filas_borradas := v_n; return next;
  delete from public.compras where negocio_id = p_negocio_id and es_prueba;
  get diagnostics v_n = row_count; tabla := 'compras'; filas_borradas := v_n; return next;
  delete from public.clientes where negocio_id = p_negocio_id and es_prueba;
  get diagnostics v_n = row_count; tabla := 'clientes'; filas_borradas := v_n; return next;
  delete from public.productos where negocio_id = p_negocio_id and es_prueba;
  get diagnostics v_n = row_count; tabla := 'productos'; filas_borradas := v_n; return next;

  perform set_config('gestor.borrando_datos_de_prueba', '', true);
end;
$$;

revoke all on function public.contar_datos_de_prueba(uuid) from public, anon, authenticated;
revoke all on function public.borrar_datos_de_prueba(uuid, text) from public, anon, authenticated;
