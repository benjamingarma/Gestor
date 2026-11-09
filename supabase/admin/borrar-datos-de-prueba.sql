-- =====================================================================================
-- BORRAR DATOS DE PRUEBA (plan A20). Se ensaya en el módulo 1.9 y se usa en el 1.10.
-- Borra SOLO las filas marcadas como prueba (compras, movimientos, productos y, a medida
-- que existan, clientes, ventas, pagos...). Conserva negocio, socios y usuarios.
--
-- Cómo usarlo, en Supabase > SQL Editor:
--   PASO 1: correr solo el bloque "1. Ver qué se va a borrar" y revisar los números.
--   PASO 2: correr el bloque "2. Borrar". Es todo o nada: si algo falla, no se borra nada.
--   PASO 3 (solo en el pasaje a producción): correr "3. Salir del modo prueba".
-- =====================================================================================

-- 1. Ver qué se va a borrar ------------------------------------------------------------
select n.nombre as negocio, n.modo_prueba, d.*
from public.negocios n
cross join lateral public.contar_datos_de_prueba(n.id) d
order by n.nombre, d.tabla;

-- 2. Borrar ----------------------------------------------------------------------------------
-- Reemplazá NOMBRE_DEL_NEGOCIO y dejá la frase de confirmación tal cual.
-- begin;
-- select * from public.borrar_datos_de_prueba(
--   (select id from public.negocios where nombre = 'NOMBRE_DEL_NEGOCIO'),
--   'BORRAR DATOS DE PRUEBA'
-- );
-- commit;

-- 3. Salir del modo prueba (desde acá, todo lo que se cargue es real) -------------------------
-- update public.negocios set modo_prueba = false where nombre = 'NOMBRE_DEL_NEGOCIO';
