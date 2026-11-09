-- Módulo 1.1 — Productos, compras en USD y stock por movimientos.
-- Además: infraestructura común para las tablas de datos del negocio
--   * es_prueba / modo prueba (plan A20)
--   * registrado_por lo completa la base con el socio del usuario logueado (plan A1)
--   * nada se borra (salvo datos de prueba, por el administrador)
-- Decisiones explicadas en docs/decisiones/modulo-1.1.md.

-- =====================================================================================
-- 1. Modo prueba del negocio
-- =====================================================================================
alter table public.negocios
  add column modo_prueba boolean not null default true;

comment on column public.negocios.modo_prueba is
  'Mientras sea verdadero, todo lo que se carga queda marcado es_prueba = true. Se apaga en el pasaje a producción.';

-- =====================================================================================
-- 2. Funciones de apoyo para triggers (comunes a todas las tablas de datos)
-- =====================================================================================

-- Antes de insertar: marca es_prueba según el negocio y completa registrado_por / creado_en.
-- El celular no puede elegir estos valores.
create or replace function public.completar_alta()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_modo_prueba boolean;
  v_socio uuid;
begin
  select n.modo_prueba into v_modo_prueba from public.negocios n where n.id = new.negocio_id;
  if v_modo_prueba is null then
    raise exception 'Negocio inexistente: %', new.negocio_id using errcode = '23503';
  end if;
  new.es_prueba := v_modo_prueba;
  new.creado_en := now();

  if (select auth.uid()) is not null then
    v_socio := public.socio_actual(new.negocio_id);
    if v_socio is null then
      raise exception 'El usuario no es socio de este negocio' using errcode = '42501';
    end if;
    new.registrado_por := v_socio;
  elsif new.registrado_por is null then
    -- Cargas administrativas (SQL Editor / importación) deben indicar el socio.
    raise exception 'Falta registrado_por' using errcode = '23502';
  end if;
  return new;
end;
$$;

-- Nunca se borra nada. Única excepción: datos de prueba, desde borrar_datos_de_prueba().
create or replace function public.impedir_borrado()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(current_setting('gestor.borrando_datos_de_prueba', true), '') = 'si' and old.es_prueba then
    return old;
  end if;
  raise exception 'No se puede borrar en %. Las operaciones se anulan, no se borran.', tg_table_name
    using errcode = '42501';
end;
$$;

-- Columnas que nunca cambian después del alta.
create or replace function public.impedir_cambio_de_alta()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
     or new.negocio_id is distinct from old.negocio_id
     or new.es_prueba is distinct from old.es_prueba
     or new.registrado_por is distinct from old.registrado_por
     or new.creado_en is distinct from old.creado_en then
    raise exception 'No se pueden modificar los datos de alta de %', tg_table_name using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.completar_alta() from public, anon, authenticated;
revoke all on function public.impedir_borrado() from public, anon, authenticated;
revoke all on function public.impedir_cambio_de_alta() from public, anon, authenticated;

-- =====================================================================================
-- 3. Productos (marca + modelo; sin sabor)
-- =====================================================================================
create table public.productos (
  id              uuid primary key default gen_random_uuid(),
  negocio_id      uuid not null references public.negocios (id),
  categoria       text not null default 'vaper' check (categoria in ('vaper')),
  marca           text not null check (length(trim(marca)) between 1 and 60),
  modelo          text not null check (length(trim(modelo)) between 1 and 60),
  precio_general  bigint check (precio_general between 0 and 100000000000),  -- centavos ARS
  activo          boolean not null default true,
  es_prueba       boolean not null default false,
  registrado_por  uuid not null references public.socios (id),
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now(),
  unique (negocio_id, id)
);

comment on table public.productos is 'Catálogo: un producto es marca + modelo (el modelo incluye los puffs).';
comment on column public.productos.categoria is 'Preparado para otros productos; hoy solo vaper.';

create unique index productos_unicos_idx
  on public.productos (negocio_id, categoria, lower(trim(marca)), lower(trim(modelo)));

create or replace function public.productos_al_modificar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.marca := trim(new.marca);
  new.modelo := trim(new.modelo);
  if tg_op = 'UPDATE' then
    new.actualizado_en := now();
  end if;
  return new;
end;
$$;
revoke all on function public.productos_al_modificar() from public, anon, authenticated;

create trigger productos_completar_alta before insert on public.productos
  for each row execute function public.completar_alta();
create trigger productos_normalizar before insert or update on public.productos
  for each row execute function public.productos_al_modificar();
create trigger productos_impedir_cambio_de_alta before update on public.productos
  for each row execute function public.impedir_cambio_de_alta();
create trigger productos_impedir_borrado before delete on public.productos
  for each row execute function public.impedir_borrado();

alter table public.productos enable row level security;
revoke all on public.productos from anon, authenticated;
grant select on public.productos to authenticated;
grant insert (id, negocio_id, marca, modelo, precio_general) on public.productos to authenticated;
grant update (marca, modelo, precio_general, activo) on public.productos to authenticated;

create policy "socios leen productos" on public.productos for select to authenticated
  using ((select public.es_socio(negocio_id)));
create policy "socios crean productos" on public.productos for insert to authenticated
  with check ((select public.es_socio(negocio_id)));
create policy "socios editan productos" on public.productos for update to authenticated
  using ((select public.es_socio(negocio_id)))
  with check ((select public.es_socio(negocio_id)));

-- =====================================================================================
-- 4. Compras (cada compra es un lote para FIFO). Costo en USD, convertido a pesos
--    con el tipo de cambio de la compra. El costo en pesos lo calcula la base y queda fijo.
--    Límites: hasta 10.000 unidades, USD 10.000 por unidad y $100.000 por dólar. Así el total
--    de una compra (máx. ~$10 billones) entra siempre en un número entero exacto de JavaScript.
-- =====================================================================================
create table public.compras (
  id                    uuid primary key,              -- generado en el celular
  negocio_id            uuid not null references public.negocios (id),
  producto_id           uuid not null,
  secuencia             bigint generated always as identity,  -- orden de carga (desempate FIFO)
  fecha                 date not null check (fecha >= date '2020-01-01'),
  cantidad              integer not null check (cantidad between 1 and 10000),
  costo_unitario_usd    bigint  not null check (costo_unitario_usd between 0 and 1000000),    -- centavos USD (máx. USD 10.000/u)
  tipo_cambio           bigint  not null check (tipo_cambio between 1 and 10000000),           -- centavos ARS por USD (máx. $100.000)
  tipo_cambio_estimado  boolean not null default false,
  -- round(USD × TC) al centavo, mitad hacia arriba (misma regla que src/lib/dinero.ts):
  costo_unitario_ars    bigint generated always as ((costo_unitario_usd * tipo_cambio + 50) / 100) stored,
  costo_total_usd       bigint generated always as (cantidad * costo_unitario_usd) stored,
  costo_total_ars       bigint generated always as (cantidad * ((costo_unitario_usd * tipo_cambio + 50) / 100)) stored,
  origen                text not null default 'compra' check (origen in ('compra', 'inventario_inicial')),
  nota                  text check (length(nota) <= 500),
  anulado_en            timestamptz,
  anulado_por           uuid references public.socios (id),
  motivo_anulacion      text,
  es_prueba             boolean not null default false,
  registrado_por        uuid not null references public.socios (id),
  creado_en             timestamptz not null default now(),
  unique (negocio_id, id),
  foreign key (negocio_id, producto_id) references public.productos (negocio_id, id),
  check ((anulado_en is null) = (anulado_por is null)),
  check (anulado_en is null or length(trim(motivo_anulacion)) > 0)
);

comment on table public.compras is 'Compras de mercadería en USD. Cada una es un lote para el costo FIFO.';
comment on column public.compras.tipo_cambio is 'Pesos por dólar (blue) del día de la compra, en centavos.';

create index compras_fifo_idx on public.compras (negocio_id, producto_id, fecha, secuencia);

-- Una compra solo puede cambiar para anularse (una vez).
create or replace function public.compras_solo_anulacion()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.anulado_en is not null then
    raise exception 'La compra ya está anulada' using errcode = '42501';
  end if;
  if (new.producto_id, new.fecha, new.cantidad, new.costo_unitario_usd, new.tipo_cambio,
      new.tipo_cambio_estimado, new.origen, new.nota, new.secuencia)
     is distinct from
     (old.producto_id, old.fecha, old.cantidad, old.costo_unitario_usd, old.tipo_cambio,
      old.tipo_cambio_estimado, old.origen, old.nota, old.secuencia) then
    raise exception 'Una compra no se modifica: se anula y se carga de nuevo' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.compras_solo_anulacion() from public, anon, authenticated;

create trigger compras_completar_alta before insert on public.compras
  for each row execute function public.completar_alta();
create trigger compras_impedir_cambio_de_alta before update on public.compras
  for each row execute function public.impedir_cambio_de_alta();
create trigger compras_solo_anulacion before update on public.compras
  for each row execute function public.compras_solo_anulacion();
create trigger compras_impedir_borrado before delete on public.compras
  for each row execute function public.impedir_borrado();

alter table public.compras enable row level security;
revoke all on public.compras from anon, authenticated;
grant select on public.compras to authenticated;   -- escritura solo por funciones
create policy "socios leen compras" on public.compras for select to authenticated
  using ((select public.es_socio(negocio_id)));

-- =====================================================================================
-- 5. Movimientos de stock: ÚNICA fuente de verdad del stock.
-- =====================================================================================
create table public.movimientos_stock (
  id                  uuid primary key default gen_random_uuid(),
  negocio_id          uuid not null references public.negocios (id),
  compra_id           uuid not null,
  producto_id         uuid not null,
  tipo                text not null check (tipo in
                        ('compra', 'venta', 'ajuste', 'anulacion_compra', 'anulacion_venta', 'anulacion_ajuste')),
  cantidad            integer not null check (cantidad <> 0),
  costo_unitario_usd  bigint not null,
  costo_unitario_ars  bigint not null,
  venta_item_id       uuid,      -- FK en el módulo de ventas
  ajuste_id           uuid,      -- FK en el módulo de ajustes
  fecha               timestamptz not null,
  es_prueba           boolean not null default false,
  registrado_por      uuid not null references public.socios (id),
  creado_en           timestamptz not null default now(),
  foreign key (negocio_id, compra_id) references public.compras (negocio_id, id),
  foreign key (negocio_id, producto_id) references public.productos (negocio_id, id),
  -- Entradas positivas, salidas negativas.
  check (
    (tipo in ('compra', 'anulacion_venta', 'anulacion_ajuste') and cantidad > 0)
    or (tipo in ('venta', 'ajuste', 'anulacion_compra') and cantidad < 0)
  )
);

comment on table public.movimientos_stock is
  'Entradas y salidas de cada compra. Stock = suma de cantidades. Nunca se modifica ni se borra.';

create index movimientos_compra_idx on public.movimientos_stock (compra_id);
create index movimientos_producto_idx on public.movimientos_stock (negocio_id, producto_id);

create or replace function public.impedir_modificacion()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Los movimientos de stock no se modifican' using errcode = '42501';
end;
$$;
revoke all on function public.impedir_modificacion() from public, anon, authenticated;

create trigger movimientos_completar_alta before insert on public.movimientos_stock
  for each row execute function public.completar_alta();
create trigger movimientos_impedir_modificacion before update on public.movimientos_stock
  for each row execute function public.impedir_modificacion();
create trigger movimientos_impedir_borrado before delete on public.movimientos_stock
  for each row execute function public.impedir_borrado();

alter table public.movimientos_stock enable row level security;
revoke all on public.movimientos_stock from anon, authenticated;
grant select on public.movimientos_stock to authenticated;
create policy "socios leen movimientos" on public.movimientos_stock for select to authenticated
  using ((select public.es_socio(negocio_id)));

-- =====================================================================================
-- 6. Funciones de escritura (atómicas e idempotentes)
-- =====================================================================================

-- Fecha de hoy en Tucumán.
create or replace function public.hoy_tucuman()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'America/Argentina/Tucuman')::date;
$$;
grant execute on function public.hoy_tucuman() to authenticated;

-- Registra una compra y su movimiento de entrada.
-- Idempotente: si ya existe una compra con ese id y los mismos datos, devuelve la existente.
create or replace function public.registrar_compra(
  p_id uuid,
  p_negocio_id uuid,
  p_producto_id uuid,
  p_fecha date,
  p_cantidad integer,
  p_costo_unitario_usd bigint,
  p_tipo_cambio bigint,
  p_tipo_cambio_estimado boolean default false,
  p_nota text default null,
  p_origen text default 'compra'
)
returns public.compras
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_compra public.compras;
  v_producto public.productos;
begin
  if not public.es_socio(p_negocio_id) then
    raise exception 'No sos socio de este negocio' using errcode = '42501';
  end if;
  if p_id is null then
    raise exception 'Falta el identificador de la compra' using errcode = '22023';
  end if;

  -- Reintento del mismo pedido: devolver lo ya guardado.
  select * into v_compra from public.compras where id = p_id;
  if found then
    if v_compra.negocio_id = p_negocio_id
       and v_compra.producto_id = p_producto_id
       and v_compra.fecha = p_fecha
       and v_compra.cantidad = p_cantidad
       and v_compra.costo_unitario_usd = p_costo_unitario_usd
       and v_compra.tipo_cambio = p_tipo_cambio then
      return v_compra;
    end if;
    raise exception 'Ya existe otra compra con este identificador' using errcode = '23505';
  end if;

  select * into v_producto from public.productos
   where id = p_producto_id and negocio_id = p_negocio_id;
  if not found then
    raise exception 'Producto inexistente' using errcode = '23503';
  end if;
  if not v_producto.activo then
    raise exception 'El producto está desactivado' using errcode = '22023';
  end if;
  if p_fecha is null or p_fecha > public.hoy_tucuman() then
    raise exception 'La fecha de compra no puede ser futura' using errcode = '22023';
  end if;
  if p_origen not in ('compra', 'inventario_inicial') then
    raise exception 'Origen inválido' using errcode = '22023';
  end if;

  insert into public.compras (id, negocio_id, producto_id, fecha, cantidad, costo_unitario_usd,
                              tipo_cambio, tipo_cambio_estimado, origen, nota)
  values (p_id, p_negocio_id, p_producto_id, p_fecha, p_cantidad, p_costo_unitario_usd,
          p_tipo_cambio, coalesce(p_tipo_cambio_estimado, false), p_origen, nullif(trim(p_nota), ''))
  returning * into v_compra;

  insert into public.movimientos_stock (negocio_id, compra_id, producto_id, tipo, cantidad,
                                        costo_unitario_usd, costo_unitario_ars, fecha)
  values (p_negocio_id, v_compra.id, p_producto_id, 'compra', v_compra.cantidad,
          v_compra.costo_unitario_usd, v_compra.costo_unitario_ars,
          (p_fecha::timestamp + interval '12 hours') at time zone 'America/Argentina/Tucuman');

  return v_compra;
end;
$$;

-- Anula una compra: solo si no salió ninguna unidad de ella. Idempotente.
create or replace function public.anular_compra(p_compra_id uuid, p_motivo text)
returns public.compras
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_compra public.compras;
  v_disponible integer;
  v_socio uuid;
begin
  select * into v_compra from public.compras where id = p_compra_id for update;
  if not found or not public.es_socio(v_compra.negocio_id) then
    raise exception 'Compra inexistente' using errcode = '23503';
  end if;
  if v_compra.anulado_en is not null then
    return v_compra;  -- ya estaba anulada
  end if;
  if p_motivo is null or length(trim(p_motivo)) = 0 then
    raise exception 'Indicá el motivo de la anulación' using errcode = '22023';
  end if;

  select coalesce(sum(cantidad), 0) into v_disponible
    from public.movimientos_stock where compra_id = p_compra_id;
  if v_disponible <> v_compra.cantidad then
    raise exception 'No se puede anular: ya salieron % unidades de esta compra',
      v_compra.cantidad - v_disponible using errcode = '22023';
  end if;

  v_socio := public.socio_actual(v_compra.negocio_id);

  update public.compras
     set anulado_en = now(), anulado_por = v_socio, motivo_anulacion = trim(p_motivo)
   where id = p_compra_id
   returning * into v_compra;

  insert into public.movimientos_stock (negocio_id, compra_id, producto_id, tipo, cantidad,
                                        costo_unitario_usd, costo_unitario_ars, fecha)
  values (v_compra.negocio_id, v_compra.id, v_compra.producto_id, 'anulacion_compra', -v_compra.cantidad,
          v_compra.costo_unitario_usd, v_compra.costo_unitario_ars, now());

  return v_compra;
end;
$$;

revoke all on function public.registrar_compra(uuid, uuid, uuid, date, integer, bigint, bigint, boolean, text, text) from public, anon;
revoke all on function public.anular_compra(uuid, text) from public, anon;
grant execute on function public.registrar_compra(uuid, uuid, uuid, date, integer, bigint, bigint, boolean, text, text) to authenticated;
grant execute on function public.anular_compra(uuid, text) to authenticated;

-- =====================================================================================
-- 7. Vistas de stock (respetan RLS: security_invoker)
-- =====================================================================================

-- Stock de cada compra, valorizado a su costo en USD y en pesos.
create view public.v_stock_compras
with (security_invoker = true) as
select
  c.id                   as compra_id,
  c.negocio_id,
  c.producto_id,
  c.fecha,
  c.secuencia,
  c.cantidad,
  c.costo_unitario_usd,
  c.tipo_cambio,
  c.tipo_cambio_estimado,
  c.costo_unitario_ars,
  c.costo_total_usd,
  c.costo_total_ars,
  c.origen,
  c.nota,
  c.anulado_en,
  c.motivo_anulacion,
  c.es_prueba,
  c.creado_en,
  coalesce(m.disponible, 0)                          as disponible,
  coalesce(m.disponible, 0) * c.costo_unitario_usd   as valor_usd,
  coalesce(m.disponible, 0) * c.costo_unitario_ars   as valor_ars
from public.compras c
left join (
  select compra_id, sum(cantidad)::integer as disponible
  from public.movimientos_stock
  group by compra_id
) m on m.compra_id = c.id;

-- Stock por producto, con el costo de la próxima unidad que va a salir (FIFO).
create view public.v_stock_productos
with (security_invoker = true) as
select
  p.id                    as producto_id,
  p.negocio_id,
  p.marca,
  p.modelo,
  p.precio_general,
  p.activo,
  p.es_prueba,
  coalesce(sum(s.disponible), 0)::integer  as unidades,
  coalesce(sum(s.valor_usd), 0)::bigint    as valor_usd,
  coalesce(sum(s.valor_ars), 0)::bigint    as valor_ars,
  proxima.costo_unitario_usd               as proximo_costo_usd,
  proxima.costo_unitario_ars               as proximo_costo_ars
from public.productos p
left join public.v_stock_compras s on s.producto_id = p.id
left join lateral (
  select sc.costo_unitario_usd, sc.costo_unitario_ars
  from public.v_stock_compras sc
  where sc.producto_id = p.id and sc.disponible > 0
  order by sc.fecha, sc.secuencia
  limit 1
) proxima on true
group by p.id, proxima.costo_unitario_usd, proxima.costo_unitario_ars;

revoke all on public.v_stock_compras, public.v_stock_productos from anon, authenticated;
grant select on public.v_stock_compras, public.v_stock_productos to authenticated;

-- =====================================================================================
-- 8. Datos de prueba (plan A20): contar y borrar. Solo para el administrador.
-- =====================================================================================

-- Cantidad de filas de prueba por tabla. Cada módulo agrega sus tablas acá.
create or replace function public.contar_datos_de_prueba(p_negocio_id uuid)
returns table (tabla text, filas_de_prueba bigint, filas_reales bigint)
language sql
stable
set search_path = ''
as $$
  select 'movimientos_stock', count(*) filter (where es_prueba), count(*) filter (where not es_prueba)
    from public.movimientos_stock where negocio_id = p_negocio_id
  union all
  select 'compras', count(*) filter (where es_prueba), count(*) filter (where not es_prueba)
    from public.compras where negocio_id = p_negocio_id
  union all
  select 'productos', count(*) filter (where es_prueba), count(*) filter (where not es_prueba)
    from public.productos where negocio_id = p_negocio_id;
$$;

-- Borra SOLO las filas marcadas como prueba, en orden (primero las que dependen de otras).
-- Conserva negocio, socios y usuarios. Si una fila real depende de una de prueba, falla y
-- no borra nada (la transacción se deshace entera).
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
              where m.negocio_id = p_negocio_id and not m.es_prueba and p.es_prueba) then
    raise exception 'Hay datos reales que dependen de datos de prueba. No se borró nada.';
  end if;

  perform set_config('gestor.borrando_datos_de_prueba', 'si', true);

  delete from public.movimientos_stock where negocio_id = p_negocio_id and es_prueba;
  get diagnostics v_n = row_count;
  tabla := 'movimientos_stock'; filas_borradas := v_n; return next;

  delete from public.compras where negocio_id = p_negocio_id and es_prueba;
  get diagnostics v_n = row_count;
  tabla := 'compras'; filas_borradas := v_n; return next;

  delete from public.productos where negocio_id = p_negocio_id and es_prueba;
  get diagnostics v_n = row_count;
  tabla := 'productos'; filas_borradas := v_n; return next;

  perform set_config('gestor.borrando_datos_de_prueba', '', true);
end;
$$;

-- Solo el administrador (rol postgres, desde el SQL Editor) puede usarlas.
revoke all on function public.contar_datos_de_prueba(uuid) from public, anon, authenticated;
revoke all on function public.borrar_datos_de_prueba(uuid, text) from public, anon, authenticated;
