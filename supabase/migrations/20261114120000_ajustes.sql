-- Módulo 1.6 — Ajustes de stock: regalo, pérdida y rotura (plan, decisión 5, A9, A11 y sección 6.6).
-- Solo salidas. Cada ajuste sale por FIFO, guarda su costo en USD y en pesos de la compra de origen
-- (copia histórica, nunca se recalcula) y ese costo en pesos resta de la ganancia.
-- Decisiones explicadas en docs/decisiones/modulo-1.6.md.

-- =====================================================================================
-- 1. Tabla
-- =====================================================================================
create table public.ajustes_stock (
  id                uuid primary key,               -- generado en el celular
  negocio_id        uuid not null references public.negocios (id),
  producto_id       uuid not null,
  secuencia         bigint generated always as identity,   -- orden de carga (desempate)
  fecha             date not null,                  -- día en Tucumán (afecta el período de la pérdida)
  cantidad          integer not null check (cantidad between 1 and 10000),
  motivo            text not null check (motivo in ('regalo', 'perdida', 'rotura')),
  costo_total_ars   bigint not null check (costo_total_ars >= 0),   -- suma FIFO, histórico (lo calcula la base)
  costo_total_usd   bigint not null check (costo_total_usd >= 0),
  nota              text check (length(nota) <= 500),
  anulado_en        timestamptz,
  anulado_por       uuid references public.socios (id),
  motivo_anulacion  text,
  es_prueba         boolean not null default false,
  registrado_por    uuid not null references public.socios (id),
  creado_en         timestamptz not null default now(),
  unique (negocio_id, id),
  foreign key (negocio_id, producto_id) references public.productos (negocio_id, id),
  check ((anulado_en is null) = (anulado_por is null)),
  check (anulado_en is null or length(trim(motivo_anulacion)) > 0)
);

comment on table public.ajustes_stock is
  'Salidas de stock sin venta (regalo, pérdida, rotura). Su costo FIFO resta de la ganancia. No se borran ni se editan: se anulan.';
comment on column public.ajustes_stock.costo_total_ars is 'Costo FIFO en pesos de las unidades que salieron, fijado al registrar el ajuste.';

create index ajustes_producto_idx on public.ajustes_stock (producto_id, fecha desc);
create index ajustes_fecha_idx on public.ajustes_stock (negocio_id, fecha desc);

-- Los movimientos de ajuste apuntan a su ajuste (igual que los de venta a su renglón).
alter table public.movimientos_stock
  add constraint movimientos_ajuste_fk foreign key (ajuste_id) references public.ajustes_stock (id),
  add constraint movimientos_ajuste_con_ajuste check ((tipo in ('ajuste', 'anulacion_ajuste')) = (ajuste_id is not null));

create index movimientos_ajuste_idx on public.movimientos_stock (ajuste_id);

create trigger ajustes_completar_alta before insert on public.ajustes_stock
  for each row execute function public.completar_alta();
create trigger ajustes_impedir_cambio_de_alta before update on public.ajustes_stock
  for each row execute function public.impedir_cambio_de_alta();
create trigger ajustes_solo_anulacion before update on public.ajustes_stock
  for each row execute function public.solo_anulacion_generica();
create trigger ajustes_impedir_borrado before delete on public.ajustes_stock
  for each row execute function public.impedir_borrado();

alter table public.ajustes_stock enable row level security;
revoke all on public.ajustes_stock from anon, authenticated;
grant select on public.ajustes_stock to authenticated;   -- escritura solo por funciones
create policy "socios leen ajustes" on public.ajustes_stock for select to authenticated
  using ((select public.es_socio(negocio_id)));

-- =====================================================================================
-- 2. Registrar ajuste (FIFO) — atómico e idempotente
-- =====================================================================================
create or replace function public.registrar_ajuste(
  p_id uuid,
  p_negocio_id uuid,
  p_producto_id uuid,
  p_cantidad integer,
  p_motivo text,
  p_fecha date default null,
  p_nota text default null
)
returns public.ajustes_stock
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ajuste public.ajustes_stock;
  v_producto public.productos;
  v_hoy date := public.hoy_tucuman();
  v_fecha date := coalesce(p_fecha, public.hoy_tucuman());
  v_instante timestamptz;
  v_compra record;
  v_restante integer;
  v_tomar integer;
  v_costo_ars bigint := 0;
  v_costo_usd bigint := 0;
  v_consumos jsonb := '[]'::jsonb;
  v_consumo jsonb;
begin
  if not public.es_socio(p_negocio_id) then
    raise exception 'No sos socio de este negocio' using errcode = '42501';
  end if;
  if p_id is null then
    raise exception 'Falta el identificador del ajuste' using errcode = '22023';
  end if;

  -- Reintento del mismo pedido: devolver el ajuste ya guardado.
  select * into v_ajuste from public.ajustes_stock where id = p_id;
  if found then
    if v_ajuste.negocio_id = p_negocio_id and v_ajuste.producto_id = p_producto_id
       and v_ajuste.cantidad = p_cantidad and v_ajuste.motivo = p_motivo then
      return v_ajuste;
    end if;
    raise exception 'Ya existe otro ajuste con este identificador' using errcode = '23505';
  end if;

  if p_motivo is null or p_motivo not in ('regalo', 'perdida', 'rotura') then
    raise exception 'Elegí el motivo: regalo, pérdida o rotura' using errcode = '22023';
  end if;
  if p_cantidad is null or p_cantidad < 1 or p_cantidad > 10000 then
    raise exception 'Cantidad inválida' using errcode = '22023';
  end if;
  if v_fecha > v_hoy then
    raise exception 'La fecha del ajuste no puede ser futura' using errcode = '22023';
  end if;
  if v_fecha < date '2020-01-01' then
    raise exception 'La fecha del ajuste es demasiado vieja' using errcode = '22023';
  end if;

  select * into v_producto from public.productos where id = p_producto_id and negocio_id = p_negocio_id;
  if not found then
    raise exception 'Producto inexistente' using errcode = '23503';
  end if;
  -- Un producto desactivado SÍ se puede ajustar: es la forma de dar de baja lo que quedó.

  -- Bloquea las compras del producto (FIFO) hasta terminar la transacción, igual que una venta.
  perform 1 from public.compras
   where producto_id = p_producto_id and anulado_en is null
   order by fecha, secuencia
   for update;

  v_restante := p_cantidad;
  for v_compra in
    select c.id, c.costo_unitario_ars, c.costo_unitario_usd,
           (select coalesce(sum(m.cantidad), 0) from public.movimientos_stock m where m.compra_id = c.id)::integer as disponible
    from public.compras c
    where c.producto_id = p_producto_id and c.anulado_en is null
    order by c.fecha, c.secuencia
  loop
    exit when v_restante = 0;
    continue when v_compra.disponible <= 0;
    v_tomar := least(v_restante, v_compra.disponible);
    v_restante := v_restante - v_tomar;
    v_costo_ars := v_costo_ars + v_tomar * v_compra.costo_unitario_ars;
    v_costo_usd := v_costo_usd + v_tomar * v_compra.costo_unitario_usd;
    v_consumos := v_consumos || jsonb_build_object(
      'compra_id', v_compra.id, 'cantidad', v_tomar,
      'ars', v_compra.costo_unitario_ars, 'usd', v_compra.costo_unitario_usd);
  end loop;

  if v_restante > 0 then
    raise exception 'No hay stock suficiente de % %: pediste %, hay %',
      v_producto.marca, v_producto.modelo, p_cantidad, p_cantidad - v_restante using errcode = '22023';
  end if;

  insert into public.ajustes_stock (id, negocio_id, producto_id, fecha, cantidad, motivo,
                                    costo_total_ars, costo_total_usd, nota)
  values (p_id, p_negocio_id, p_producto_id, v_fecha, p_cantidad, p_motivo,
          v_costo_ars, v_costo_usd, nullif(trim(p_nota), ''))
  returning * into v_ajuste;

  v_instante := case
    when v_fecha = v_hoy then now()
    else (v_fecha::timestamp + interval '12 hours') at time zone 'America/Argentina/Tucuman'
  end;

  for v_consumo in select * from jsonb_array_elements(v_consumos)
  loop
    insert into public.movimientos_stock (negocio_id, compra_id, producto_id, tipo, cantidad,
                                          costo_unitario_usd, costo_unitario_ars, ajuste_id, fecha)
    values (p_negocio_id, (v_consumo->>'compra_id')::uuid, p_producto_id, 'ajuste',
            -(v_consumo->>'cantidad')::integer, (v_consumo->>'usd')::bigint, (v_consumo->>'ars')::bigint,
            p_id, v_instante);
  end loop;

  return v_ajuste;
end;
$$;

-- Anula un ajuste: cada unidad vuelve a la compra de la que salió, con su costo original.
create or replace function public.anular_ajuste(p_ajuste_id uuid, p_motivo text)
returns public.ajustes_stock
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ajuste public.ajustes_stock;
begin
  select * into v_ajuste from public.ajustes_stock where id = p_ajuste_id for update;
  if not found or not public.es_socio(v_ajuste.negocio_id) then
    raise exception 'Ajuste inexistente' using errcode = '23503';
  end if;
  if v_ajuste.anulado_en is not null then
    return v_ajuste;
  end if;
  if p_motivo is null or length(trim(p_motivo)) = 0 then
    raise exception 'Indicá el motivo de la anulación' using errcode = '22023';
  end if;

  update public.ajustes_stock
     set anulado_en = now(), anulado_por = public.socio_actual(v_ajuste.negocio_id),
         motivo_anulacion = trim(p_motivo)
   where id = p_ajuste_id
   returning * into v_ajuste;

  insert into public.movimientos_stock (negocio_id, compra_id, producto_id, tipo, cantidad,
                                        costo_unitario_usd, costo_unitario_ars, ajuste_id, fecha)
  select m.negocio_id, m.compra_id, m.producto_id, 'anulacion_ajuste', -m.cantidad,
         m.costo_unitario_usd, m.costo_unitario_ars, m.ajuste_id, now()
  from public.movimientos_stock m
  where m.ajuste_id = p_ajuste_id and m.tipo = 'ajuste';

  return v_ajuste;
end;
$$;

revoke all on function public.registrar_ajuste(uuid, uuid, uuid, integer, text, date, text) from public, anon;
revoke all on function public.anular_ajuste(uuid, text) from public, anon;
grant execute on function public.registrar_ajuste(uuid, uuid, uuid, integer, text, date, text) to authenticated;
grant execute on function public.anular_ajuste(uuid, text) to authenticated;

-- =====================================================================================
-- 3. Vistas
-- =====================================================================================

-- Ajustes con el nombre del producto y de quién lo cargó / anuló.
create view public.v_ajustes
with (security_invoker = true) as
select
  a.id               as ajuste_id,
  a.negocio_id,
  a.producto_id,
  p.marca,
  p.modelo,
  a.fecha            as dia,
  a.secuencia,
  a.cantidad,
  a.motivo,
  a.costo_total_ars,
  a.costo_total_usd,
  a.nota,
  a.anulado_en,
  a.motivo_anulacion,
  a.es_prueba,
  a.registrado_por,
  s.nombre           as registrado_por_nombre,
  a.creado_en
from public.ajustes_stock a
join public.productos p on p.id = a.producto_id
join public.socios s on s.id = a.registrado_por;

-- Pérdidas por ajustes no anulados, por día (para el resumen; filas chicas).
create view public.v_perdidas_diarias
with (security_invoker = true) as
select negocio_id, fecha as dia,
       count(*)::integer             as ajustes,
       sum(cantidad)::integer        as unidades,
       sum(costo_total_ars)::bigint  as costo_ars,
       sum(costo_total_usd)::bigint  as costo_usd
from public.ajustes_stock
where anulado_en is null
group by negocio_id, fecha;

revoke all on public.v_ajustes, public.v_perdidas_diarias from anon, authenticated;
grant select on public.v_ajustes, public.v_perdidas_diarias to authenticated;

-- =====================================================================================
-- 4. Datos de prueba: sumar ajustes_stock (plan A20).
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
  union all select 'ajustes_stock', count(*) filter (where es_prueba), count(*) filter (where not es_prueba) from public.ajustes_stock where negocio_id = p_negocio_id
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
     or exists (select 1 from public.movimientos_stock m join public.ajustes_stock a on a.id = m.ajuste_id
              where m.negocio_id = p_negocio_id and not m.es_prueba and a.es_prueba)
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
     or exists (select 1 from public.ajustes_stock a join public.productos p on p.id = a.producto_id
              where a.negocio_id = p_negocio_id and not a.es_prueba and p.es_prueba)
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
  delete from public.ajustes_stock where negocio_id = p_negocio_id and es_prueba;
  get diagnostics v_n = row_count; tabla := 'ajustes_stock'; filas_borradas := v_n; return next;
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
