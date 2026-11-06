-- Vincula una cuenta de login (creada en Supabase > Authentication > Users) con un socio.
-- Ejecutar en Supabase > SQL Editor, reemplazando los dos valores entre comillas.
-- Es idempotente: se puede correr de nuevo sin problemas.
update public.socios
set user_id = (select id from auth.users where email = lower('EMAIL_DEL_SOCIO'))
where nombre = 'NOMBRE_DEL_SOCIO';

-- Verificación: debe mostrar el socio con su email.
select s.nombre, u.email
from public.socios s
left join auth.users u on u.id = s.user_id
order by s.orden;
