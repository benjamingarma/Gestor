-- Crea el negocio y sus dos socios (sin cuentas todavía). Se corre UNA vez por proyecto,
-- en Supabase > SQL Editor, después de aplicar las migraciones.
-- Cambiá los nombres si querés; el orden define el desempate del redondeo del reparto.
with negocio as (
  insert into public.negocios (nombre) values ('NOMBRE_DEL_NEGOCIO') returning id
)
insert into public.socios (negocio_id, nombre, orden)
select id, 'Benjamín', 1 from negocio
union all
select id, 'Papá', 2 from negocio;
