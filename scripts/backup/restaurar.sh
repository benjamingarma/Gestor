#!/usr/bin/env bash
# Restaura un backup hecho con volcar.sh (módulo 1.9) en una base que ya tiene la estructura (migraciones aplicadas)
# y no tiene datos. Todo en una sola transacción: si algo falla, no queda nada a medias.
#
#   restaurar.sh <url-de-la-base> < datos.dump
#
# Los datos se cargan tal cual se respaldaron (session_replication_role = replica: sin reprocesar disparadores ni
# controles fila por fila, que ya se cumplían cuando se guardaron). PG_RESTORE y PSQL permiten elegir los programas
# (versión 17, como la base).
set -euo pipefail
URL="${1:?Falta la URL de la base}"
PG_RESTORE="${PG_RESTORE:-pg_restore}"
PSQL="${PSQL:-psql}"

con_datos=$($PSQL "$URL" -qAt -c "select count(*) from public.negocios" < /dev/null)  # sin leer la entrada (es el backup)
if [ "$con_datos" != "0" ]; then
  echo "La base de destino ya tiene datos (negocios: $con_datos). Se restaura solo en una base vacía." >&2
  exit 1
fi
# pg_restore convierte el backup a SQL y psql lo ejecuta en UNA transacción, con el modo "replica" activado al principio
# (Supabase lo permite como comando, no como parámetro de conexión).
{ echo "set session_replication_role = replica;"; $PG_RESTORE --data-only --no-owner --no-privileges --file=-; } \
  | $PSQL "$URL" --single-transaction -q -v ON_ERROR_STOP=1 > /dev/null

# Las cuentas de login no viajan en el backup (plan T19): los socios quedan sin cuenta vinculada hasta que se vuelvan a
# vincular con supabase/admin/vincular-socio.sql (paso del procedimiento de restauración).
$PSQL "$URL" -qAt -v ON_ERROR_STOP=1 -c "update public.socios s set user_id = null
  where user_id is not null and not exists (select 1 from auth.users u where u.id = s.user_id)" < /dev/null > /dev/null
echo "Restauración terminada. Falta volver a vincular las cuentas de los socios (supabase/admin/vincular-socio.sql)." >&2
