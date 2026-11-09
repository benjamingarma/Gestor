-- Módulo 1.2 — Clientes y visitas básicas.
-- Decisiones explicadas en docs/decisiones/modulo-1.2.md.

-- =====================================================================================
-- 1. Clientes
-- =====================================================================================
create table public.clientes (
  id                     uuid primary key,          -- generado en el celular
  negocio_id             uuid not null references public.negocios (id),
  nombre                 text not null check (length(trim(nombre)) between 1 and 80),
  telefono               text check (length(telefono) <= 40),
  notas                  text check (length(notas) <= 1000),
  intervalo_visita_dias  integer not null default 14 check (intervalo_visita_dias between 1 and 365),
  -- Última visita conocida antes de usar la app (la carga la importación del módulo 1.7).
  ultima_visita_inicial  date,
  archivado_en           timestamptz,
  es_prueba              boolean not null default false,
  registrado_por         uuid not null references public.socios (id),
  creado_en              timestamptz not null default now(),
  actualizado_en         timestamptz not null default now(),
  unique (negocio_id, id)
);

comment on table public.clientes is 'Clientes. No se borran: se archivan.';
comment on column public.clientes.intervalo_visita_dias is 'Cada cuántos días hay que visitarlo (por defecto 14).';

-- El nombre identifica al cliente en la búsqueda y en la importación CSV: no se repite.
create unique index clientes_nombre_unico_idx on public.clientes (negocio_id, lower(trim(nombre)));

create or replace function public.clientes_al_modificar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.nombre := regexp_replace(trim(new.nombre), '\s+', ' ', 'g');
  new.telefono := nullif(trim(new.telefono), '');
  new.notas := nullif(trim(new.notas), '');
  if tg_op = 'UPDATE' then
    new.actualizado_en := now();
  end if;
  return new;
end;
$$;
revoke all on function public.clientes_al_modificar() from public, anon, authenticated;

create trigger clientes_completar_alta before insert on public.clientes
  for each row execute function public.completar_alta();
create trigger clientes_normalizar before insert or update on public.clientes
  for each row execute function public.clientes_al_modificar();
create trigger clientes_impedir_cambio_de_alta before update on public.clientes
  for each row execute function public.impedir_cambio_de_alta();
create trigger clientes_impedir_borrado before delete on public.clientes
  for each row execute function public.impedir_borrado();

alter table public.clientes enable row level security;
revoke all on public.clientes from anon, authenticated;
grant select on public.clientes to authenticated;
grant insert (id, negocio_id, nombre, telefono, notas, intervalo_visita_dias) on public.clientes to authenticated;
grant update (nombre, telefono, notas, intervalo_visita_dias) on public.clientes to authenticated;

create policy "socios leen clientes" on public.clientes for select to authenticated
  using ((select public.es_socio(negocio_id)));
create policy "socios crean clientes" on public.clientes for insert to authenticated
  with check ((select public.es_socio(negocio_id)));
create policy "socios editan clientes" on public.clientes for update to authenticated
  using ((select public.es_socio(negocio_id)))
  with check ((select public.es_socio(negocio_id)));

-- Archivar / desarchivar (la hora la pone el servidor).
create or replace function public.archivar_cliente(p_cliente_id uuid, p_archivar boolean)
returns public.clientes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cliente public.clientes;
begin
  select * into v_cliente from public.clientes where id = p_cliente_id for update;
  if not found or not public.es_socio(v_cliente.negocio_id) then
    raise exception 'Cliente inexistente' using errcode = '23503';
  end if;
  update public.clientes
     set archivado_en = case when p_archivar then coalesce(archivado_en, now()) else null end
   where id = p_cliente_id
   returning * into v_cliente;
  return v_cliente;
end;
$$;
revoke all on function public.archivar_cliente(uuid, boolean) from public, anon;
grant execute on function public.archivar_cliente(uuid, boolean) to authenticated;

-- =====================================================================================
-- 2. Visitas ("marcar como visitado"). Las ventas cuentan como visita por su cuenta
--    (módulo 1.3). Son eventos: no se modifican; una visita marcada por error se anula.
-- =====================================================================================
create table public.visitas (
  id                uuid primary key,              -- generado en el celular
  negocio_id        uuid not null references public.negocios (id),
  cliente_id        uuid not null,
  fecha             date not null check (fecha >= date '2020-01-01'),
  nota              text check (length(nota) <= 300),
  anulado_en        timestamptz,
  anulado_por       uuid references public.socios (id),
  es_prueba         boolean not null default false,
  registrado_por    uuid not null references public.socios (id),
  creado_en         timestamptz not null default now(),
  foreign key (negocio_id, cliente_id) references public.clientes (negocio_id, id),
  check ((anulado_en is null) = (anulado_por is null))
);

create index visitas_cliente_idx on public.visitas (cliente_id, fecha desc);

create or replace function public.visitas_solo_anulacion()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.anulado_en is not null then
    raise exception 'La visita ya está anulada' using errcode = '42501';
  end if;
  if (new.cliente_id, new.fecha, new.nota) is distinct from (old.cliente_id, old.fecha, old.nota) then
    raise exception 'Una visita no se modifica: se anula' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.visitas_solo_anulacion() from public, anon, authenticated;

create trigger visitas_completar_alta before insert on public.visitas
  for each row execute function public.completar_alta();
create trigger visitas_impedir_cambio_de_alta before update on public.visitas
  for each row execute function public.impedir_cambio_de_alta();
create trigger visitas_solo_anulacion before update on public.visitas
  for each row execute function public.visitas_solo_anulacion();
create trigger visitas_impedir_borrado before delete on public.visitas
  for each row execute function public.impedir_borrado();

alter table public.visitas enable row level security;
revoke all on public.visitas from anon, authenticated;
grant select on public.visitas to authenticated;   -- escritura solo por funciones
create policy "socios leen visitas" on public.visitas for select to authenticated
  using ((select public.es_socio(negocio_id)));

-- Marca una visita. Idempotente por id. Fecha: hoy o pasada, nunca futura.
create or replace function public.marcar_visitado(
  p_id uuid,
  p_cliente_id uuid,
  p_fecha date default null,
  p_nota text default null
)
returns public.visitas
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cliente public.clientes;
  v_visita public.visitas;
  v_fecha date := coalesce(p_fecha, public.hoy_tucuman());
begin
  if p_id is null then
    raise exception 'Falta el identificador de la visita' using errcode = '22023';
  end if;
  select * into v_cliente from public.clientes where id = p_cliente_id;
  if not found or not public.es_socio(v_cliente.negocio_id) then
    raise exception 'Cliente inexistente' using errcode = '23503';
  end if;

  select * into v_visita from public.visitas where id = p_id;
  if found then
    if v_visita.cliente_id = p_cliente_id and v_visita.fecha = v_fecha then
      return v_visita;
    end if;
    raise exception 'Ya existe otra visita con este identificador' using errcode = '23505';
  end if;

  if v_fecha > public.hoy_tucuman() then
    raise exception 'La fecha de la visita no puede ser futura' using errcode = '22023';
  end if;

  insert into public.visitas (id, negocio_id, cliente_id, fecha, nota)
  values (p_id, v_cliente.negocio_id, p_cliente_id, v_fecha, nullif(trim(p_nota), ''))
  returning * into v_visita;
  return v_visita;
end;
$$;

-- Anula una visita marcada por error. Idempotente.
create or replace function public.anular_visita(p_visita_id uuid)
returns public.visitas
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_visita public.visitas;
begin
  select * into v_visita from public.visitas where id = p_visita_id for update;
  if not found or not public.es_socio(v_visita.negocio_id) then
    raise exception 'Visita inexistente' using errcode = '23503';
  end if;
  if v_visita.anulado_en is not null then
    return v_visita;
  end if;
  update public.visitas
     set anulado_en = now(), anulado_por = public.socio_actual(v_visita.negocio_id)
   where id = p_visita_id
   returning * into v_visita;
  return v_visita;
end;
$$;

revoke all on function public.marcar_visitado(uuid, uuid, date, text) from public, anon;
revoke all on function public.anular_visita(uuid) from public, anon;
grant execute on function public.marcar_visitado(uuid, uuid, date, text) to authenticated;
grant execute on function public.anular_visita(uuid) to authenticated;

-- =====================================================================================
-- 3. Vista: datos de cada cliente para calcular su próxima visita.
--    Hoy la última visita sale de visitas y de la visita inicial; el módulo 1.3 suma
--    la fecha de la última venta. El cálculo de próxima visita y atraso está en
--    src/dominio/visitas.ts (con pruebas).
-- =====================================================================================
create view public.v_clientes
with (security_invoker = true) as
select
  c.id                         as cliente_id,
  c.negocio_id,
  c.nombre,
  c.telefono,
  c.notas,
  c.intervalo_visita_dias,
  c.ultima_visita_inicial,
  c.archivado_en,
  c.es_prueba,
  (c.creado_en at time zone 'America/Argentina/Tucuman')::date as fecha_alta,
  v.ultima_visita,
  v.ultima_visita_id,
  null::date                   as ultima_venta      -- se completa en el módulo 1.3
from public.clientes c
left join lateral (
  select vi.fecha as ultima_visita, vi.id as ultima_visita_id
  from public.visitas vi
  where vi.cliente_id = c.id and vi.anulado_en is null
  order by vi.fecha desc, vi.creado_en desc
  limit 1
) v on true;

revoke all on public.v_clientes from anon, authenticated;
grant select on public.v_clientes to authenticated;

-- =====================================================================================
-- 4. Datos de prueba: sumar clientes y visitas al conteo y al borrado (plan A20).
-- =====================================================================================
create or replace function public.contar_datos_de_prueba(p_negocio_id uuid)
returns table (tabla text, filas_de_prueba bigint, filas_reales bigint)
language sql
stable
set search_path = ''
as $$
  select 'visitas', count(*) filter (where es_prueba), count(*) filter (where not es_prueba)
    from public.visitas where negocio_id = p_negocio_id
  union all
  select 'movimientos_stock', count(*) filter (where es_prueba), count(*) filter (where not es_prueba)
    from public.movimientos_stock where negocio_id = p_negocio_id
  union all
  select 'compras', count(*) filter (where es_prueba), count(*) filter (where not es_prueba)
    from public.compras where negocio_id = p_negocio_id
  union all
  select 'clientes', count(*) filter (where es_prueba), count(*) filter (where not es_prueba)
    from public.clientes where negocio_id = p_negocio_id
  union all
  select 'productos', count(*) filter (where es_prueba), count(*) filter (where not es_prueba)
    from public.productos where negocio_id = p_negocio_id;
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
     or exists (select 1 from public.compras c join public.productos p on p.id = c.producto_id
              where c.negocio_id = p_negocio_id and not c.es_prueba and p.es_prueba)
     or exists (select 1 from public.movimientos_stock m join public.productos p on p.id = m.producto_id
              where m.negocio_id = p_negocio_id and not m.es_prueba and p.es_prueba)
     or exists (select 1 from public.visitas v join public.clientes c on c.id = v.cliente_id
              where v.negocio_id = p_negocio_id and not v.es_prueba and c.es_prueba) then
    raise exception 'Hay datos reales que dependen de datos de prueba. No se borró nada.';
  end if;

  perform set_config('gestor.borrando_datos_de_prueba', 'si', true);

  delete from public.visitas where negocio_id = p_negocio_id and es_prueba;
  get diagnostics v_n = row_count;
  tabla := 'visitas'; filas_borradas := v_n; return next;

  delete from public.movimientos_stock where negocio_id = p_negocio_id and es_prueba;
  get diagnostics v_n = row_count;
  tabla := 'movimientos_stock'; filas_borradas := v_n; return next;

  delete from public.compras where negocio_id = p_negocio_id and es_prueba;
  get diagnostics v_n = row_count;
  tabla := 'compras'; filas_borradas := v_n; return next;

  delete from public.clientes where negocio_id = p_negocio_id and es_prueba;
  get diagnostics v_n = row_count;
  tabla := 'clientes'; filas_borradas := v_n; return next;

  delete from public.productos where negocio_id = p_negocio_id and es_prueba;
  get diagnostics v_n = row_count;
  tabla := 'productos'; filas_borradas := v_n; return next;

  perform set_config('gestor.borrando_datos_de_prueba', '', true);
end;
$$;

revoke all on function public.contar_datos_de_prueba(uuid) from public, anon, authenticated;
revoke all on function public.borrar_datos_de_prueba(uuid, text) from public, anon, authenticated;
