-- Módulo 1.3 — Ventas con varios productos, costo FIFO, precios especiales y anulación.
-- Decisiones explicadas en docs/decisiones/modulo-1.3.md.

-- =====================================================================================
-- 1. Precios especiales por cliente y producto (configuración, no operación)
-- =====================================================================================
create table public.precios_especiales (
  negocio_id      uuid not null references public.negocios (id),
  cliente_id      uuid not null,
  producto_id     uuid not null,
  precio          bigint not null check (precio between 0 and 10000000000),   -- centavos ARS
  es_prueba       boolean not null default false,
  registrado_por  uuid not null references public.socios (id),
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now(),
  primary key (cliente_id, producto_id),
  foreign key (negocio_id, cliente_id) references public.clientes (negocio_id, id),
  foreign key (negocio_id, producto_id) references public.productos (negocio_id, id)
);

comment on table public.precios_especiales is
  'Precio vigente que se le propone a un cliente para un producto. El precio histórico de cada venta está en venta_items.';

create trigger precios_especiales_completar_alta before insert on public.precios_especiales
  for each row execute function public.completar_alta();

alter table public.precios_especiales enable row level security;
revoke all on public.precios_especiales from anon, authenticated;
grant select on public.precios_especiales to authenticated;   -- escritura solo por función
create policy "socios leen precios especiales" on public.precios_especiales for select to authenticated
  using ((select public.es_socio(negocio_id)));

-- Fija (o quita, con p_precio null) el precio especial de un cliente para un producto.
create or replace function public.fijar_precio_especial(p_cliente_id uuid, p_producto_id uuid, p_precio bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio uuid;
begin
  select negocio_id into v_negocio from public.clientes where id = p_cliente_id;
  if v_negocio is null or not public.es_socio(v_negocio) then
    raise exception 'Cliente inexistente' using errcode = '23503';
  end if;
  if not exists (select 1 from public.productos where id = p_producto_id and negocio_id = v_negocio) then
    raise exception 'Producto inexistente' using errcode = '23503';
  end if;

  if p_precio is null then
    delete from public.precios_especiales where cliente_id = p_cliente_id and producto_id = p_producto_id;
    return;
  end if;

  insert into public.precios_especiales (negocio_id, cliente_id, producto_id, precio)
  values (v_negocio, p_cliente_id, p_producto_id, p_precio)
  on conflict (cliente_id, producto_id)
  do update set precio = excluded.precio, actualizado_en = now();
end;
$$;
revoke all on function public.fijar_precio_especial(uuid, uuid, bigint) from public, anon;
grant execute on function public.fijar_precio_especial(uuid, uuid, bigint) to authenticated;

-- =====================================================================================
-- 2. Ventas y renglones
-- =====================================================================================
create table public.ventas (
  id                uuid primary key,               -- generado en el celular
  negocio_id        uuid not null references public.negocios (id),
  cliente_id        uuid not null,
  secuencia         bigint generated always as identity,   -- orden de carga (desempate)
  fecha             timestamptz not null,
  vendido_por       uuid not null references public.socios (id),
  nota              text check (length(nota) <= 500),
  anulado_en        timestamptz,
  anulado_por       uuid references public.socios (id),
  motivo_anulacion  text,
  es_prueba         boolean not null default false,
  registrado_por    uuid not null references public.socios (id),
  creado_en         timestamptz not null default now(),
  unique (negocio_id, id),
  foreign key (negocio_id, cliente_id) references public.clientes (negocio_id, id),
  check ((anulado_en is null) = (anulado_por is null)),
  check (anulado_en is null or length(trim(motivo_anulacion)) > 0)
);

create index ventas_cliente_idx on public.ventas (cliente_id, fecha desc);
create index ventas_fecha_idx on public.ventas (negocio_id, fecha desc);

create table public.venta_items (
  id               uuid primary key default gen_random_uuid(),
  negocio_id       uuid not null references public.negocios (id),
  venta_id         uuid not null,
  renglon          integer not null check (renglon between 1 and 50),
  producto_id      uuid not null,
  cantidad         integer not null check (cantidad between 1 and 10000),
  precio_unitario  bigint not null check (precio_unitario between 0 and 10000000000),  -- centavos ARS, histórico
  costo_total_ars  bigint not null check (costo_total_ars >= 0),   -- suma FIFO, histórico (lo calcula la base)
  costo_total_usd  bigint not null check (costo_total_usd >= 0),
  es_prueba        boolean not null default false,
  registrado_por   uuid not null references public.socios (id),
  creado_en        timestamptz not null default now(),
  unique (venta_id, producto_id),
  unique (venta_id, renglon),
  foreign key (negocio_id, venta_id) references public.ventas (negocio_id, id),
  foreign key (negocio_id, producto_id) references public.productos (negocio_id, id)
);

comment on column public.venta_items.precio_unitario is 'Precio de venta por unidad en el momento de la venta (no cambia nunca).';
comment on column public.venta_items.costo_total_ars is 'Costo FIFO en pesos de las unidades vendidas, fijado al vender.';

-- Los movimientos de venta apuntan a su renglón.
alter table public.movimientos_stock
  add constraint movimientos_venta_item_fk foreign key (venta_item_id) references public.venta_items (id),
  add constraint movimientos_venta_con_renglon check ((tipo in ('venta', 'anulacion_venta')) = (venta_item_id is not null));

create index movimientos_venta_item_idx on public.movimientos_stock (venta_item_id);

-- Una venta solo cambia para anularse, una vez.
create or replace function public.ventas_solo_anulacion()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.anulado_en is not null then
    raise exception 'La venta ya está anulada' using errcode = '42501';
  end if;
  if (new.cliente_id, new.fecha, new.vendido_por, new.nota, new.secuencia)
     is distinct from (old.cliente_id, old.fecha, old.vendido_por, old.nota, old.secuencia) then
    raise exception 'Una venta no se modifica: se anula y se carga de nuevo' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.ventas_solo_anulacion() from public, anon, authenticated;

create trigger ventas_completar_alta before insert on public.ventas
  for each row execute function public.completar_alta();
create trigger ventas_impedir_cambio_de_alta before update on public.ventas
  for each row execute function public.impedir_cambio_de_alta();
create trigger ventas_solo_anulacion before update on public.ventas
  for each row execute function public.ventas_solo_anulacion();
create trigger ventas_impedir_borrado before delete on public.ventas
  for each row execute function public.impedir_borrado();

create trigger venta_items_completar_alta before insert on public.venta_items
  for each row execute function public.completar_alta();
create trigger venta_items_impedir_modificacion before update on public.venta_items
  for each row execute function public.impedir_modificacion();
create trigger venta_items_impedir_borrado before delete on public.venta_items
  for each row execute function public.impedir_borrado();

alter table public.ventas enable row level security;
alter table public.venta_items enable row level security;
revoke all on public.ventas, public.venta_items from anon, authenticated;
grant select on public.ventas, public.venta_items to authenticated;   -- escritura solo por funciones
create policy "socios leen ventas" on public.ventas for select to authenticated
  using ((select public.es_socio(negocio_id)));
create policy "socios leen renglones" on public.venta_items for select to authenticated
  using ((select public.es_socio(negocio_id)));

-- =====================================================================================
-- 3. Registrar venta (FIFO) — atómica e idempotente
-- =====================================================================================
-- p_items: [{"producto_id": "...", "cantidad": 3, "precio_unitario": 1050000}, ...]
create or replace function public.registrar_venta(
  p_id uuid,
  p_negocio_id uuid,
  p_cliente_id uuid,
  p_items jsonb,
  p_fecha date default null,
  p_vendido_por uuid default null,
  p_nota text default null
)
returns public.ventas
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venta public.ventas;
  v_cliente public.clientes;
  v_hoy date := public.hoy_tucuman();
  v_fecha timestamptz;
  v_vendedor uuid;
  v_item record;
  v_compra record;
  v_restante integer;
  v_tomar integer;
  v_costo_ars bigint;
  v_costo_usd bigint;
  v_item_id uuid;
  v_disponible_total integer;
  v_producto public.productos;
  v_existentes jsonb;
  v_nuevos jsonb;
  v_consumos jsonb;
  v_consumo jsonb;
begin
  if not public.es_socio(p_negocio_id) then
    raise exception 'No sos socio de este negocio' using errcode = '42501';
  end if;
  if p_id is null then
    raise exception 'Falta el identificador de la venta' using errcode = '22023';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 50 then
    raise exception 'La venta debe tener entre 1 y 50 productos' using errcode = '22023';
  end if;

  -- Datos normalizados de lo que se quiere vender (para validar e idempotencia).
  begin
    select jsonb_agg(jsonb_build_object(
             'producto_id', (e->>'producto_id')::uuid,
             'cantidad', (e->>'cantidad')::integer,
             'precio_unitario', (e->>'precio_unitario')::bigint)
           order by (e->>'producto_id')::uuid)
      into v_nuevos
      from jsonb_array_elements(p_items) e;
  exception when others then
    raise exception 'Datos de productos inválidos' using errcode = '22023';
  end;

  -- Reintento del mismo pedido: devolver la venta ya guardada.
  select * into v_venta from public.ventas where id = p_id;
  if found then
    select jsonb_agg(jsonb_build_object('producto_id', producto_id, 'cantidad', cantidad,
                                        'precio_unitario', precio_unitario) order by producto_id)
      into v_existentes from public.venta_items where venta_id = p_id;
    if v_venta.negocio_id = p_negocio_id and v_venta.cliente_id = p_cliente_id and v_existentes = v_nuevos then
      return v_venta;
    end if;
    raise exception 'Ya existe otra venta con este identificador' using errcode = '23505';
  end if;

  select * into v_cliente from public.clientes where id = p_cliente_id and negocio_id = p_negocio_id;
  if not found then
    raise exception 'Cliente inexistente' using errcode = '23503';
  end if;
  if v_cliente.archivado_en is not null then
    raise exception 'El cliente está archivado. Desarchivalo para venderle.' using errcode = '22023';
  end if;

  if p_fecha is not null and p_fecha > v_hoy then
    raise exception 'La fecha de la venta no puede ser futura' using errcode = '22023';
  end if;
  if p_fecha is not null and p_fecha < date '2020-01-01' then
    raise exception 'La fecha de la venta es demasiado vieja' using errcode = '22023';
  end if;
  v_fecha := case
    when p_fecha is null or p_fecha = v_hoy then now()
    else (p_fecha::timestamp + interval '12 hours') at time zone 'America/Argentina/Tucuman'
  end;

  v_vendedor := coalesce(p_vendido_por, public.socio_actual(p_negocio_id));
  if not exists (select 1 from public.socios where id = v_vendedor and negocio_id = p_negocio_id) then
    raise exception 'El socio que vendió no es de este negocio' using errcode = '22023';
  end if;

  if (select count(distinct e->>'producto_id') from jsonb_array_elements(p_items) e) <> jsonb_array_length(p_items) then
    raise exception 'Hay un producto repetido en la venta: sumá las cantidades en un solo renglón' using errcode = '22023';
  end if;

  insert into public.ventas (id, negocio_id, cliente_id, fecha, vendido_por, nota)
  values (p_id, p_negocio_id, p_cliente_id, v_fecha, v_vendedor, nullif(trim(p_nota), ''))
  returning * into v_venta;

  -- Se procesan los productos ordenados por id: así dos ventas simultáneas bloquean
  -- siempre en el mismo orden y no se traban entre sí.
  for v_item in
    select (e->>'producto_id')::uuid      as producto_id,
           (e->>'cantidad')::integer      as cantidad,
           (e->>'precio_unitario')::bigint as precio_unitario,
           ord::integer                   as renglon
    from jsonb_array_elements(p_items) with ordinality as t(e, ord)
    order by (e->>'producto_id')::uuid
  loop
    if v_item.cantidad is null or v_item.cantidad < 1 or v_item.cantidad > 10000 then
      raise exception 'Cantidad inválida' using errcode = '22023';
    end if;
    if v_item.precio_unitario is null or v_item.precio_unitario < 0 or v_item.precio_unitario > 10000000000 then
      raise exception 'Precio inválido' using errcode = '22023';
    end if;

    select * into v_producto from public.productos
     where id = v_item.producto_id and negocio_id = p_negocio_id;
    if not found then
      raise exception 'Producto inexistente' using errcode = '23503';
    end if;
    if not v_producto.activo then
      raise exception 'El producto % % está desactivado', v_producto.marca, v_producto.modelo using errcode = '22023';
    end if;

    -- Bloquea las compras del producto (FIFO) hasta terminar la transacción.
    perform 1 from public.compras
     where producto_id = v_item.producto_id and anulado_en is null
     order by fecha, secuencia
     for update;

    v_restante := v_item.cantidad;
    v_costo_ars := 0;
    v_costo_usd := 0;
    v_consumos := '[]'::jsonb;

    for v_compra in
      select c.id, c.costo_unitario_ars, c.costo_unitario_usd,
             (select coalesce(sum(m.cantidad), 0) from public.movimientos_stock m where m.compra_id = c.id)::integer as disponible
      from public.compras c
      where c.producto_id = v_item.producto_id and c.anulado_en is null
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
      v_disponible_total := v_item.cantidad - v_restante;
      raise exception 'No hay stock suficiente de % %: pediste %, hay %',
        v_producto.marca, v_producto.modelo, v_item.cantidad, v_disponible_total using errcode = '22023';
    end if;

    insert into public.venta_items (negocio_id, venta_id, renglon, producto_id, cantidad, precio_unitario,
                                    costo_total_ars, costo_total_usd)
    values (p_negocio_id, p_id, v_item.renglon, v_item.producto_id, v_item.cantidad, v_item.precio_unitario,
            v_costo_ars, v_costo_usd)
    returning id into v_item_id;

    for v_consumo in select * from jsonb_array_elements(v_consumos)
    loop
      insert into public.movimientos_stock (negocio_id, compra_id, producto_id, tipo, cantidad,
                                            costo_unitario_usd, costo_unitario_ars, venta_item_id, fecha)
      values (p_negocio_id, (v_consumo->>'compra_id')::uuid, v_item.producto_id, 'venta',
              -(v_consumo->>'cantidad')::integer, (v_consumo->>'usd')::bigint, (v_consumo->>'ars')::bigint,
              v_item_id, v_fecha);
    end loop;
  end loop;

  return v_venta;
end;
$$;

-- Anula una venta: cada unidad vuelve a la compra de la que salió, con su costo original.
create or replace function public.anular_venta(p_venta_id uuid, p_motivo text)
returns public.ventas
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venta public.ventas;
begin
  select * into v_venta from public.ventas where id = p_venta_id for update;
  if not found or not public.es_socio(v_venta.negocio_id) then
    raise exception 'Venta inexistente' using errcode = '23503';
  end if;
  if v_venta.anulado_en is not null then
    return v_venta;
  end if;
  if p_motivo is null or length(trim(p_motivo)) = 0 then
    raise exception 'Indicá el motivo de la anulación' using errcode = '22023';
  end if;

  update public.ventas
     set anulado_en = now(), anulado_por = public.socio_actual(v_venta.negocio_id),
         motivo_anulacion = trim(p_motivo)
   where id = p_venta_id
   returning * into v_venta;

  insert into public.movimientos_stock (negocio_id, compra_id, producto_id, tipo, cantidad,
                                        costo_unitario_usd, costo_unitario_ars, venta_item_id, fecha)
  select m.negocio_id, m.compra_id, m.producto_id, 'anulacion_venta', -m.cantidad,
         m.costo_unitario_usd, m.costo_unitario_ars, m.venta_item_id, now()
  from public.movimientos_stock m
  join public.venta_items i on i.id = m.venta_item_id
  where i.venta_id = p_venta_id and m.tipo = 'venta';

  return v_venta;
end;
$$;

revoke all on function public.registrar_venta(uuid, uuid, uuid, jsonb, date, uuid, text) from public, anon;
revoke all on function public.anular_venta(uuid, text) from public, anon;
grant execute on function public.registrar_venta(uuid, uuid, uuid, jsonb, date, uuid, text) to authenticated;
grant execute on function public.anular_venta(uuid, text) to authenticated;

-- =====================================================================================
-- 4. Vistas
-- =====================================================================================

-- Totales de cada venta. (Cobrado y saldo se suman en el módulo 1.4.)
create view public.v_ventas
with (security_invoker = true) as
select
  v.id               as venta_id,
  v.negocio_id,
  v.cliente_id,
  c.nombre           as cliente_nombre,
  v.fecha,
  (v.fecha at time zone 'America/Argentina/Tucuman')::date as dia,
  v.secuencia,
  v.vendido_por,
  s.nombre           as vendido_por_nombre,
  v.nota,
  v.anulado_en,
  v.motivo_anulacion,
  v.es_prueba,
  coalesce(t.unidades, 0)::integer   as unidades,
  coalesce(t.importe, 0)::bigint     as importe,
  coalesce(t.costo_ars, 0)::bigint   as costo_ars,
  coalesce(t.costo_usd, 0)::bigint   as costo_usd,
  (coalesce(t.importe, 0) - coalesce(t.costo_ars, 0))::bigint as ganancia
from public.ventas v
join public.clientes c on c.id = v.cliente_id
join public.socios s on s.id = v.vendido_por
left join (
  select venta_id, sum(cantidad) as unidades, sum(cantidad * precio_unitario) as importe,
         sum(costo_total_ars) as costo_ars, sum(costo_total_usd) as costo_usd
  from public.venta_items group by venta_id
) t on t.venta_id = v.id;

-- Último precio que pagó cada cliente por cada producto (ventas no anuladas).
create view public.v_ultimo_precio_cliente
with (security_invoker = true) as
select distinct on (v.cliente_id, i.producto_id)
  v.negocio_id, v.cliente_id, i.producto_id, i.precio_unitario,
  (v.fecha at time zone 'America/Argentina/Tucuman')::date as dia
from public.venta_items i
join public.ventas v on v.id = i.venta_id
where v.anulado_en is null
order by v.cliente_id, i.producto_id, v.fecha desc, v.secuencia desc;

-- La vista de clientes suma la última venta (para la próxima visita).
create or replace view public.v_clientes
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
  (select max((ve.fecha at time zone 'America/Argentina/Tucuman')::date)
     from public.ventas ve
    where ve.cliente_id = c.id and ve.anulado_en is null) as ultima_venta
from public.clientes c
left join lateral (
  select vi.fecha as ultima_visita, vi.id as ultima_visita_id
  from public.visitas vi
  where vi.cliente_id = c.id and vi.anulado_en is null
  order by vi.fecha desc, vi.creado_en desc
  limit 1
) v on true;

revoke all on public.v_ventas, public.v_ultimo_precio_cliente from anon, authenticated;
grant select on public.v_ventas, public.v_ultimo_precio_cliente to authenticated;

-- =====================================================================================
-- 5. Datos de prueba: sumar ventas, renglones y precios especiales (plan A20).
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
  select 'venta_items', count(*) filter (where es_prueba), count(*) filter (where not es_prueba)
    from public.venta_items where negocio_id = p_negocio_id
  union all
  select 'ventas', count(*) filter (where es_prueba), count(*) filter (where not es_prueba)
    from public.ventas where negocio_id = p_negocio_id
  union all
  select 'precios_especiales', count(*) filter (where es_prueba), count(*) filter (where not es_prueba)
    from public.precios_especiales where negocio_id = p_negocio_id
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
              where pe.negocio_id = p_negocio_id and not pe.es_prueba and (c.es_prueba or p.es_prueba)) then
    raise exception 'Hay datos reales que dependen de datos de prueba. No se borró nada.';
  end if;

  perform set_config('gestor.borrando_datos_de_prueba', 'si', true);

  delete from public.visitas where negocio_id = p_negocio_id and es_prueba;
  get diagnostics v_n = row_count; tabla := 'visitas'; filas_borradas := v_n; return next;

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
