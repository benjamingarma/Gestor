-- Módulo 1.5 — Reparto de la ganancia entre socios (plan, decisión 4 y A8).
-- El cálculo de la ganancia y del reparto está en src/dominio/ganancia.ts (con pruebas).
-- Decisiones explicadas en docs/decisiones/modulo-1.5.md.

create table public.reparto_porcentajes (
  negocio_id      uuid not null references public.negocios (id),
  vigente_desde   date not null,
  socio_id        uuid not null references public.socios (id),
  -- Centésimos de punto: 5000 = 50,00 %.
  centesimos      integer not null check (centesimos between 0 and 10000),
  registrado_por  uuid references public.socios (id),
  creado_en       timestamptz not null default now(),
  primary key (negocio_id, vigente_desde, socio_id)
);

comment on table public.reparto_porcentajes is
  'Porcentaje de la ganancia de cada socio, desde una fecha. Cada venta usa el porcentaje vigente en su fecha. Sin filas: partes iguales.';

alter table public.reparto_porcentajes enable row level security;
revoke all on public.reparto_porcentajes from anon, authenticated;
grant select on public.reparto_porcentajes to authenticated;   -- escritura solo por función
create policy "socios leen el reparto" on public.reparto_porcentajes for select to authenticated
  using ((select public.es_socio(negocio_id)));

-- Fija el reparto desde una fecha (hoy o futura: no reescribe la ganancia ya repartida).
-- p_porcentajes: [{"socio_id": "...", "centesimos": 5000}, ...] — todos los socios, suma 10000.
-- Si ya había un reparto para esa misma fecha, se reemplaza.
create or replace function public.configurar_reparto(p_negocio_id uuid, p_vigente_desde date, p_porcentajes jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_suma integer;
  v_socios integer;
  v_cargados integer;
begin
  if not public.es_socio(p_negocio_id) then
    raise exception 'No sos socio de este negocio' using errcode = '42501';
  end if;
  if p_vigente_desde is null or p_vigente_desde < public.hoy_tucuman() then
    raise exception 'El reparto rige desde hoy o una fecha futura: no se cambia la ganancia ya repartida' using errcode = '22023';
  end if;
  if p_porcentajes is null or jsonb_typeof(p_porcentajes) <> 'array' then
    raise exception 'Porcentajes inválidos' using errcode = '22023';
  end if;

  select count(*) into v_socios from public.socios where negocio_id = p_negocio_id;
  begin
    select count(distinct (e->>'socio_id')::uuid), sum((e->>'centesimos')::integer)
      into v_cargados, v_suma
      from jsonb_array_elements(p_porcentajes) e
      join public.socios s on s.id = (e->>'socio_id')::uuid and s.negocio_id = p_negocio_id;
  exception when others then
    raise exception 'Porcentajes inválidos' using errcode = '22023';
  end;
  if v_cargados <> v_socios or jsonb_array_length(p_porcentajes) <> v_socios then
    raise exception 'Hay que indicar el porcentaje de cada socio, una sola vez' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(p_porcentajes) e
              where (e->>'centesimos')::integer not between 0 and 10000) then
    raise exception 'Cada porcentaje debe estar entre 0 y 100' using errcode = '22023';
  end if;
  if v_suma <> 10000 then
    raise exception 'Los porcentajes deben sumar 100 %% (suman %)', round(v_suma / 100.0, 2) using errcode = '22023';
  end if;

  delete from public.reparto_porcentajes where negocio_id = p_negocio_id and vigente_desde = p_vigente_desde;
  insert into public.reparto_porcentajes (negocio_id, vigente_desde, socio_id, centesimos, registrado_por)
  select p_negocio_id, p_vigente_desde, (e->>'socio_id')::uuid, (e->>'centesimos')::integer, public.socio_actual(p_negocio_id)
  from jsonb_array_elements(p_porcentajes) e;
end;
$$;

revoke all on function public.configurar_reparto(uuid, date, jsonb) from public, anon;
grant execute on function public.configurar_reparto(uuid, date, jsonb) to authenticated;

-- =====================================================================================
-- Vistas para el resumen. Agregan en la base (por día) para no traer miles de filas.
-- =====================================================================================

-- Ventas no anuladas por día (hora de Tucumán).
create view public.v_ganancia_diaria
with (security_invoker = true) as
select negocio_id, dia,
       count(*)::integer           as ventas,
       sum(unidades)::integer      as unidades,
       sum(importe)::bigint        as importe,
       sum(costo_ars)::bigint      as costo_ars,
       sum(costo_usd)::bigint      as costo_usd,
       sum(ganancia)::bigint       as ganancia
from public.v_ventas
where anulado_en is null
group by negocio_id, dia;

-- Cobros no anulados por día, medio y socio que recibió la plata.
create view public.v_cobros_diarios
with (security_invoker = true) as
select p.negocio_id, p.fecha as dia, p.medio, p.recibido_por, s.nombre as recibido_por_nombre,
       count(*)::integer as cobros, sum(p.importe)::bigint as total
from public.pagos p
join public.socios s on s.id = p.recibido_por
where p.anulado_en is null
group by p.negocio_id, p.fecha, p.medio, p.recibido_por, s.nombre;

-- Capital desde el inicio (plan, sección 7), en USD y en pesos:
--   invertido en compras = costo de lo vendido + pérdidas por ajustes + stock que queda.
create view public.v_capital
with (security_invoker = true) as
select n.id as negocio_id,
       coalesce(c.usd, 0)::bigint as invertido_usd,
       coalesce(c.ars, 0)::bigint as invertido_ars,
       coalesce(v.usd, 0)::bigint as vendido_usd,
       coalesce(v.ars, 0)::bigint as vendido_ars,
       coalesce(a.usd, 0)::bigint as perdidas_usd,
       coalesce(a.ars, 0)::bigint as perdidas_ars,
       coalesce(m.usd, 0)::bigint as stock_usd,
       coalesce(m.ars, 0)::bigint as stock_ars
from public.negocios n
left join (
  select negocio_id, sum(costo_total_usd) as usd, sum(costo_total_ars) as ars
  from public.compras where anulado_en is null group by negocio_id
) c on c.negocio_id = n.id
left join (
  select i.negocio_id, sum(i.costo_total_usd) as usd, sum(i.costo_total_ars) as ars
  from public.venta_items i join public.ventas ve on ve.id = i.venta_id
  where ve.anulado_en is null group by i.negocio_id
) v on v.negocio_id = n.id
left join (
  select negocio_id, -sum(cantidad * costo_unitario_usd) as usd, -sum(cantidad * costo_unitario_ars) as ars
  from public.movimientos_stock where tipo in ('ajuste', 'anulacion_ajuste') group by negocio_id
) a on a.negocio_id = n.id
left join (
  select negocio_id, sum(cantidad * costo_unitario_usd) as usd, sum(cantidad * costo_unitario_ars) as ars
  from public.movimientos_stock group by negocio_id
) m on m.negocio_id = n.id;

revoke all on public.v_ganancia_diaria, public.v_cobros_diarios, public.v_capital from anon, authenticated;
grant select on public.v_ganancia_diaria, public.v_cobros_diarios, public.v_capital to authenticated;
