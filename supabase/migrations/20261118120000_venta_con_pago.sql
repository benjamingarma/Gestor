-- Pago en la pantalla de venta (pedido de los socios, 18/11/2026).
-- Decisiones: docs/decisiones/pago-en-venta-y-ganancia-cobrada.md (PR 2A: solo base; la pantalla es el PR 2B).
--
-- Qué agrega (sin tocar las funciones que ya usa la app):
--   1. pagos.venta_id: qué pago se registró junto con qué venta. Es INFORMATIVO: la aplicación de los pagos a las
--      deudas sigue siendo FIFO por cliente (plan A4) y no mira esta columna.
--   2. registrar_pago_de_venta: registra el pago de una venta (mismo cliente, mismo día que la venta). Idempotente.
--   3. registrar_venta_con_pago: venta (cliente existente o nuevo) + pago opcional en UNA sola transacción
--      ("Pagó todo" / "Pago parcial" con pago; "Deuda" sin pago). Si el pago falla, la venta tampoco queda.
--   4. anular_venta_y_pagos: anula la venta y, si se pide, los pagos que se registraron con ella, juntos
--      ("Deshacer" de la confirmación y "se devolvió la plata" al anular desde el historial).

-- =====================================================================================
-- 1. Columna pagos.venta_id
-- =====================================================================================
alter table public.pagos add column venta_id uuid;
alter table public.pagos
  add constraint pagos_venta_fk foreign key (negocio_id, venta_id) references public.ventas (negocio_id, id);
create index pagos_venta_idx on public.pagos (venta_id) where venta_id is not null;

comment on column public.pagos.venta_id is
  'Venta con la que se registró este pago (pantalla de venta). Informativo: el pago se aplica igual a las deudas más viejas del cliente.';

-- La vista de pagos suma la venta al final (create or replace exige mantener las columnas anteriores en orden).
create or replace view public.v_pagos
with (security_invoker = true) as
select p.id as pago_id, p.negocio_id, p.cliente_id, c.nombre as cliente_nombre, p.secuencia, p.fecha, p.importe,
       p.medio, p.recibido_por, s.nombre as recibido_por_nombre, p.nota, p.anulado_en, p.motivo_anulacion,
       p.registrado_por, r.nombre as registrado_por_nombre, p.creado_en, p.es_prueba,
       p.venta_id
from public.pagos p
join public.clientes c on c.id = p.cliente_id
join public.socios s on s.id = p.recibido_por
join public.socios r on r.id = p.registrado_por;

-- =====================================================================================
-- 2. Pago de una venta
-- =====================================================================================
create function public.registrar_pago_de_venta(
  p_id           uuid,
  p_venta_id     uuid,
  p_importe      bigint,
  p_medio        text,
  p_recibido_por uuid default null
)
returns public.pagos
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venta    public.ventas;
  v_pago     public.pagos;
  v_receptor uuid;
begin
  if p_id is null then
    raise exception 'Falta el identificador del pago' using errcode = '22023';
  end if;
  select * into v_venta from public.ventas where id = p_venta_id;
  if not found or not public.es_socio(v_venta.negocio_id) then
    raise exception 'Venta inexistente' using errcode = '23503';
  end if;

  -- Quién recibió: si no se dice, el socio que lo carga. Se resuelve antes del reintento para compararlo.
  v_receptor := coalesce(p_recibido_por, public.socio_actual(v_venta.negocio_id));

  -- Reintento (doble toque): devuelve el mismo pago solo si coincide en todo.
  select * into v_pago from public.pagos where id = p_id;
  if found then
    if v_pago.venta_id is distinct from p_venta_id or v_pago.importe <> p_importe or v_pago.medio is distinct from p_medio then
      raise exception 'Ya existe otro pago con este identificador' using errcode = '23505';
    end if;
    if v_pago.recibido_por is distinct from v_receptor then
      raise exception 'Este pago ya se registró con otro socio como quien recibió el dinero' using errcode = '23505';
    end if;
    return v_pago;
  end if;

  if v_venta.anulado_en is not null then
    raise exception 'La venta está anulada' using errcode = '22023';
  end if;
  if p_importe is null or p_importe <= 0 then
    raise exception 'El monto del pago debe ser mayor que cero' using errcode = '22023';
  end if;
  if p_medio is null or p_medio not in ('efectivo', 'transferencia', 'mercado_pago') then
    raise exception 'Elegí cómo pagó' using errcode = '22023';
  end if;
  if not exists (select 1 from public.socios where id = v_receptor and negocio_id = v_venta.negocio_id) then
    raise exception 'El socio que recibió el dinero no es de este negocio' using errcode = '22023';
  end if;

  -- Mismo cliente y mismo día (hora de Tucumán) que la venta.
  insert into public.pagos (id, negocio_id, cliente_id, fecha, importe, medio, recibido_por, venta_id)
  values (p_id, v_venta.negocio_id, v_venta.cliente_id,
          (v_venta.fecha at time zone 'America/Argentina/Tucuman')::date,
          p_importe, p_medio, v_receptor, p_venta_id)
  on conflict (id) do nothing
  returning * into v_pago;
  if v_pago.id is null then
    -- Otra llamada simultánea lo insertó primero: se devuelve ese, si es el mismo pago.
    select * into v_pago from public.pagos where id = p_id;
    if v_pago.venta_id is distinct from p_venta_id or v_pago.importe <> p_importe or v_pago.medio <> p_medio then
      raise exception 'Ya existe otro pago con este identificador' using errcode = '23505';
    end if;
    if v_pago.recibido_por is distinct from v_receptor then
      raise exception 'Este pago ya se registró con otro socio como quien recibió el dinero' using errcode = '23505';
    end if;
  end if;
  return v_pago;
end;
$$;

comment on function public.registrar_pago_de_venta(uuid, uuid, bigint, text, uuid) is
  'Registra el pago de una venta (mismo cliente y mismo día). Se aplica como cualquier pago, a las deudas más viejas. Idempotente.';

-- =====================================================================================
-- 3. Venta + pago en una sola operación
-- =====================================================================================
create function public.registrar_venta_con_pago(
  p_venta_id         uuid,
  p_negocio_id       uuid,
  p_cliente_id       uuid,
  p_items            jsonb,
  p_pago_id          uuid default null,     -- null y p_pago_importe null = "Deuda" (sin pago)
  p_pago_importe     bigint default null,
  p_pago_medio       text default null,
  p_pago_recibido_por uuid default null,
  p_fecha            date default null,
  p_vendido_por      uuid default null,
  p_nota             text default null,
  p_cliente_nuevo    jsonb default null     -- {"nombre": ..., "telefono": ..., "direccion": ...} si es cliente nuevo
)
returns public.ventas
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_venta public.ventas;
begin
  if p_pago_importe is not null and p_pago_id is null then
    raise exception 'Falta el identificador del pago' using errcode = '22023';
  end if;

  -- Las mismas funciones de siempre (FIFO, stock, cliente nuevo sin duplicados).
  if p_cliente_nuevo is not null then
    v_venta := public.registrar_venta_cliente_nuevo(p_venta_id, p_negocio_id, p_cliente_id,
      p_cliente_nuevo ->> 'nombre', p_cliente_nuevo ->> 'telefono', p_items, p_fecha, p_vendido_por, p_nota,
      p_cliente_nuevo ->> 'direccion');
  else
    v_venta := public.registrar_venta(p_venta_id, p_negocio_id, p_cliente_id, p_items, p_fecha, p_vendido_por, p_nota);
  end if;

  -- Si el pago falla, se deshace toda la transacción (tampoco queda la venta).
  if p_pago_importe is not null then
    perform public.registrar_pago_de_venta(p_pago_id, v_venta.id, p_pago_importe, p_pago_medio, p_pago_recibido_por);
  end if;
  return v_venta;
end;
$$;

comment on function public.registrar_venta_con_pago(uuid, uuid, uuid, jsonb, uuid, bigint, text, uuid, date, uuid, text, jsonb) is
  'Venta (cliente existente o nuevo) y su pago opcional en una sola transacción. Idempotente ante reintentos.';

-- =====================================================================================
-- 4. Anular la venta y los pagos que se registraron con ella
-- =====================================================================================
create function public.anular_venta_y_pagos(p_venta_id uuid, p_motivo text, p_anular_pagos boolean default true)
returns public.ventas
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venta public.ventas;
  v_pago  record;
begin
  v_venta := public.anular_venta(p_venta_id, p_motivo);   -- valida socio y motivo; idempotente
  if p_anular_pagos then
    for v_pago in
      select id from public.pagos where venta_id = p_venta_id and anulado_en is null order by secuencia for update
    loop
      perform public.anular_pago(v_pago.id, p_motivo);
    end loop;
  end if;
  return v_venta;
end;
$$;

comment on function public.anular_venta_y_pagos(uuid, text, boolean) is
  'Anula una venta y, si p_anular_pagos, los pagos registrados con ella (se devolvió la plata). Todo junto o nada.';

-- =====================================================================================
-- Permisos
-- =====================================================================================
revoke all on function public.registrar_pago_de_venta(uuid, uuid, bigint, text, uuid) from public, anon;
revoke all on function public.registrar_venta_con_pago(uuid, uuid, uuid, jsonb, uuid, bigint, text, uuid, date, uuid, text, jsonb) from public, anon;
revoke all on function public.anular_venta_y_pagos(uuid, text, boolean) from public, anon;
grant execute on function public.registrar_pago_de_venta(uuid, uuid, bigint, text, uuid) to authenticated;
grant execute on function public.registrar_venta_con_pago(uuid, uuid, uuid, jsonb, uuid, bigint, text, uuid, date, uuid, text, jsonb) to authenticated;
grant execute on function public.anular_venta_y_pagos(uuid, text, boolean) to authenticated;
