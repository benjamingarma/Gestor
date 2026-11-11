-- Dirección del cliente (pedido de los socios del 11/11/2026): campo propio, opcional.
-- Se carga al crear el cliente desde "Nueva venta", en "Nuevo cliente" y se edita desde la ficha.
-- No cambia la lógica de dinero. Decisiones en docs/decisiones/modulo-1.7-venta-cliente-nuevo.md.

-- 1. Columna nueva (opcional, hasta 200 caracteres). Los clientes existentes quedan sin dirección.
alter table public.clientes add column direccion text check (length(direccion) <= 200);
comment on column public.clientes.direccion is 'Dirección del cliente (opcional).';

-- Se puede cargar y editar con los mismos permisos que el resto de los datos del cliente (RLS de siempre).
grant insert (direccion) on public.clientes to authenticated;
grant update (direccion) on public.clientes to authenticated;

-- 2. Normalización: igual que teléfono y notas (sin espacios de más; vacía = sin dirección).
create or replace function public.clientes_al_modificar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.nombre := regexp_replace(trim(new.nombre), '\s+', ' ', 'g');
  new.telefono := nullif(trim(new.telefono), '');
  new.notas := nullif(trim(new.notas), '');
  new.direccion := nullif(regexp_replace(trim(new.direccion), '\s+', ' ', 'g'), '');
  if tg_op = 'UPDATE' then
    new.actualizado_en := now();
  end if;
  return new;
end;
$$;

-- 3. La vista de clientes suma la dirección AL FINAL (create or replace view exige mantener el orden).
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
    where ve.cliente_id = c.id and ve.anulado_en is null) as ultima_venta,
  c.direccion
from public.clientes c
left join lateral (
  select vi.fecha as ultima_visita, vi.id as ultima_visita_id
  from public.visitas vi
  where vi.cliente_id = c.id and vi.anulado_en is null
  order by vi.fecha desc, vi.creado_en desc
  limit 1
) v on true;

-- 4. Venta a cliente nuevo: ahora también recibe la dirección (opcional, al final).
-- La pantalla todavía no usa la versión anterior (el PR de la pantalla no se mergeó), así que se reemplaza.
-- Mismo comportamiento y mismos permisos que antes: SECURITY INVOKER, RLS, completar_alta, registrar_venta.
drop function public.registrar_venta_cliente_nuevo(uuid, uuid, uuid, text, text, jsonb, date, uuid, text);

create function public.registrar_venta_cliente_nuevo(
  p_venta_id    uuid,
  p_negocio_id  uuid,
  p_cliente_id  uuid,     -- generado en el celular, igual que el de la venta
  p_nombre      text,
  p_telefono    text,
  p_items       jsonb,
  p_fecha       date default null,
  p_vendido_por uuid default null,
  p_nota        text default null,
  p_direccion   text default null
)
returns public.ventas
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_nombre    text := regexp_replace(trim(coalesce(p_nombre, '')), '\s+', ' ', 'g');
  v_telefono  text := nullif(trim(coalesce(p_telefono, '')), '');
  v_direccion text := nullif(regexp_replace(trim(coalesce(p_direccion, '')), '\s+', ' ', 'g'), '');
  v_cliente   public.clientes;
  v_existente public.clientes;
begin
  if not public.es_socio(p_negocio_id) then
    raise exception 'No sos socio de este negocio' using errcode = '42501';
  end if;
  if p_venta_id is null or p_cliente_id is null then
    raise exception 'Faltan los identificadores de la venta o del cliente' using errcode = '22023';
  end if;
  if length(v_nombre) not between 1 and 80 then
    raise exception 'Escribí el nombre del cliente (hasta 80 caracteres)' using errcode = '22023';
  end if;
  if length(v_telefono) > 40 then
    raise exception 'El teléfono puede tener hasta 40 caracteres' using errcode = '22023';
  end if;
  if length(v_direccion) > 200 then
    raise exception 'La dirección puede tener hasta 200 caracteres' using errcode = '22023';
  end if;

  select * into v_cliente from public.clientes where id = p_cliente_id;
  if found then
    -- Reintento (doble toque, conexión que se cortó): el cliente ya se creó junto con esta venta.
    if v_cliente.negocio_id <> p_negocio_id
       or public.nombre_para_comparar(v_cliente.nombre) <> public.nombre_para_comparar(v_nombre) then
      raise exception 'Ya existe otro cliente con este identificador' using errcode = '23505';
    end if;
  else
    -- Nombre repetido (sin mayúsculas ni tildes): no se crea otro; se devuelve el existente en DETAIL.
    select * into v_existente
      from public.clientes
     where negocio_id = p_negocio_id
       and public.nombre_para_comparar(nombre) = public.nombre_para_comparar(v_nombre)
     limit 1;
    if found then
      raise exception 'Ya existe un cliente con ese nombre. Agregale algo para distinguirlo (ej: barrio o apellido).'
        using errcode = '23505', detail = v_existente.id::text, hint = 'cliente_duplicado';
    end if;
    insert into public.clientes (id, negocio_id, nombre, telefono, direccion)
    values (p_cliente_id, p_negocio_id, v_nombre, v_telefono, v_direccion)
    on conflict (id) do nothing;
  end if;

  -- La misma función de siempre. Si falla, toda la transacción se deshace y el cliente tampoco queda.
  return public.registrar_venta(p_venta_id, p_negocio_id, p_cliente_id, p_items, p_fecha, p_vendido_por, p_nota);
end;
$$;

comment on function public.registrar_venta_cliente_nuevo(uuid, uuid, uuid, text, text, jsonb, date, uuid, text, text) is
  'Crea un cliente nuevo (con teléfono y dirección opcionales) y su primera venta en una sola transacción. Idempotente.';

revoke all on function public.registrar_venta_cliente_nuevo(uuid, uuid, uuid, text, text, jsonb, date, uuid, text, text) from public, anon;
grant execute on function public.registrar_venta_cliente_nuevo(uuid, uuid, uuid, text, text, jsonb, date, uuid, text, text) to authenticated;
