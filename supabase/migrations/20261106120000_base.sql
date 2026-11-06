-- Módulo 1.0 — Base: negocio compartido, socios y seguridad (RLS).
--
-- Decisiones (ver docs/decisiones/modulo-1.0.md):
-- * Todo dato del negocio cuelga de un negocio_id. La regla de seguridad es una sola:
--   "solo ves filas de un negocio del que sos socio".
-- * socios.user_id es opcional: un socio puede existir antes de tener cuenta de login.
-- * negocios y socios se administran con SQL (no desde la app): la app solo los lee.

-- Tablas -------------------------------------------------------------------------

create table public.negocios (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null check (length(trim(nombre)) > 0),
  creado_en  timestamptz not null default now()
);

comment on table public.negocios is 'Espacio de datos compartido. Hoy existe uno solo.';

create table public.socios (
  id          uuid primary key default gen_random_uuid(),
  negocio_id  uuid not null references public.negocios (id),
  nombre      text not null check (length(trim(nombre)) > 0),
  user_id     uuid unique references auth.users (id),
  orden       int  not null default 1,
  creado_en   timestamptz not null default now(),
  unique (negocio_id, orden)
);

comment on table public.socios is
  'Socios del negocio. user_id vincula al socio con su cuenta de login (puede ser NULL).';
comment on column public.socios.orden is
  'Orden fijo de los socios; se usa para desempatar el redondeo del reparto.';

create index socios_user_id_idx on public.socios (user_id);

-- Funciones de seguridad --------------------------------------------------------

-- ¿El usuario logueado es socio de este negocio?
-- security definer: consulta socios sin pasar por RLS (evita recursión en las políticas).
create or replace function public.es_socio(p_negocio_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.socios s
    where s.negocio_id = p_negocio_id
      and s.user_id = (select auth.uid())
  );
$$;

-- Socio vinculado al usuario logueado en un negocio (NULL si no es socio).
-- Las próximas tablas lo usan para completar "registrado_por" sin confiar en el cliente.
create or replace function public.socio_actual(p_negocio_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.id
  from public.socios s
  where s.negocio_id = p_negocio_id
    and s.user_id = (select auth.uid());
$$;

revoke all on function public.es_socio(uuid) from public, anon;
revoke all on function public.socio_actual(uuid) from public, anon;
grant execute on function public.es_socio(uuid) to authenticated;
grant execute on function public.socio_actual(uuid) to authenticated;

-- Consulta liviana para que el proyecto gratuito de Supabase no se pause por inactividad.
-- No lee ninguna tabla: solo devuelve la hora del servidor.
create or replace function public.ping()
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select now();
$$;

revoke all on function public.ping() from public;
grant execute on function public.ping() to anon, authenticated;

-- Row Level Security -------------------------------------------------------------

alter table public.negocios enable row level security;
alter table public.socios   enable row level security;

-- Defensa en profundidad: además de RLS, el rol anónimo no tiene ningún permiso,
-- y el rol autenticado solo puede leer (las altas se hacen por SQL de administración).
revoke all on public.negocios from anon, authenticated;
revoke all on public.socios   from anon, authenticated;
grant select on public.negocios to authenticated;
grant select on public.socios   to authenticated;

create policy "socios leen su negocio"
  on public.negocios for select
  to authenticated
  using ((select public.es_socio(id)));

create policy "socios leen los socios de su negocio"
  on public.socios for select
  to authenticated
  using ((select public.es_socio(negocio_id)));

-- Permisos por defecto para las tablas y funciones que creen las próximas migraciones:
-- nada para el rol anónimo y ninguna función ejecutable "por defecto" para todos.
-- Cada migración otorga explícitamente lo que haga falta.
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon;
