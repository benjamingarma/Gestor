-- Módulo 1.7 (extra, aprobado por los socios el 10/11/2026): venta a un cliente nuevo.
-- Crea el cliente y la venta en UNA sola transacción: si la venta falla, el cliente tampoco queda
-- (los clientes no se pueden borrar, así que crearlo antes dejaría clientes huérfanos).
--
-- Solo agrega dos funciones. No cambia tablas, columnas, triggers ni la lógica de dinero:
-- la venta la registra la misma public.registrar_venta de siempre (FIFO, costos, stock).
--
-- Permisos: registrar_venta_cliente_nuevo es SECURITY INVOKER (corre con los permisos de quien la
-- llama, sin privilegios elevados). El alta del cliente pasa por lo mismo que la pantalla "Nuevo
-- cliente": RLS ("socios crean clientes": solo en un negocio del que sos socio), los permisos por
-- columna de clientes y el trigger completar_alta (pone es_prueba según el modo del negocio y
-- registrado_por = el socio logueado, sin confiar en lo que mande el celular).

-- Nombre para comparar duplicados: sin espacios de más, sin mayúsculas y sin tildes
-- (igual que normalizar() de src/lib/texto.ts: "  FABIÁN " = "fabian").
create or replace function public.nombre_para_comparar(p_nombre text)
returns text
language sql
immutable
set search_path = ''
as $$
  select translate(
    lower(regexp_replace(trim(coalesce(p_nombre, '')), '\s+', ' ', 'g')),
    'áàäâãéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ',
    'aaaaaeeeeiiiiooooouuuuncaaaaaeeeeiiiiooooouuuunc'
  );
$$;

create or replace function public.registrar_venta_cliente_nuevo(
  p_venta_id    uuid,
  p_negocio_id  uuid,
  p_cliente_id  uuid,     -- generado en el celular, igual que el de la venta
  p_nombre      text,
  p_telefono    text,
  p_items       jsonb,
  p_fecha       date default null,
  p_vendido_por uuid default null,
  p_nota        text default null
)
returns public.ventas
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_nombre    text := regexp_replace(trim(coalesce(p_nombre, '')), '\s+', ' ', 'g');
  v_telefono  text := nullif(trim(coalesce(p_telefono, '')), '');
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

  select * into v_cliente from public.clientes where id = p_cliente_id;
  if found then
    -- Reintento (doble toque, conexión que se cortó): el cliente ya se creó junto con esta venta.
    if v_cliente.negocio_id <> p_negocio_id
       or public.nombre_para_comparar(v_cliente.nombre) <> public.nombre_para_comparar(v_nombre) then
      raise exception 'Ya existe otro cliente con este identificador' using errcode = '23505';
    end if;
  else
    -- Nombre repetido (sin mayúsculas ni tildes): no se crea otro; se devuelve el existente en DETAIL
    -- para que la pantalla ofrezca "Usar a …".
    select * into v_existente
      from public.clientes
     where negocio_id = p_negocio_id
       and public.nombre_para_comparar(nombre) = public.nombre_para_comparar(v_nombre)
     limit 1;
    if found then
      raise exception 'Ya existe un cliente con ese nombre. Agregale algo para distinguirlo (ej: barrio o apellido).'
        using errcode = '23505', detail = v_existente.id::text, hint = 'cliente_duplicado';
    end if;
    -- Dos "Guardar" simultáneos con el mismo identificador: el segundo espera al primero y no
    -- inserta nada (on conflict); después registrar_venta le devuelve la misma venta.
    insert into public.clientes (id, negocio_id, nombre, telefono)
    values (p_cliente_id, p_negocio_id, v_nombre, v_telefono)
    on conflict (id) do nothing;
  end if;

  -- La misma función de siempre. Si falla (sin stock, precio inválido…), toda la transacción se
  -- deshace y el cliente tampoco queda.
  return public.registrar_venta(p_venta_id, p_negocio_id, p_cliente_id, p_items, p_fecha, p_vendido_por, p_nota);
end;
$$;

comment on function public.registrar_venta_cliente_nuevo(uuid, uuid, uuid, text, text, jsonb, date, uuid, text) is
  'Crea un cliente nuevo y su primera venta en una sola transacción (sin clientes huérfanos). Idempotente.';

revoke all on function public.nombre_para_comparar(text) from public, anon;
revoke all on function public.registrar_venta_cliente_nuevo(uuid, uuid, uuid, text, text, jsonb, date, uuid, text) from public, anon;
grant execute on function public.nombre_para_comparar(text) to authenticated;
grant execute on function public.registrar_venta_cliente_nuevo(uuid, uuid, uuid, text, text, jsonb, date, uuid, text) to authenticated;
