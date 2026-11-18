#!/usr/bin/env bash
# Prueba de backup y restauración (módulo 1.9), con datos INVENTADOS y la base local de Supabase (CI).
#   1. Base limpia + datos de prueba -> huella de control (filas por tabla y totales).
#   2. Backup (volcar.sh) -> cerrado con contraseña (7-Zip, AES-256, igual que el backup diario).
#   3. Una contraseña equivocada NO lo abre.
#   4. Base vacía (solo migraciones) -> se abre el backup con la contraseña buena -> restaurar.sh.
#   5. La huella después de restaurar es idéntica a la de antes.
# Usa pg_dump/psql de dentro del contenedor de la base (versión 17, igual que la base).
set -euo pipefail
cd "$(dirname "$0")/../.."
CONTENEDOR="${CONTENEDOR:-supabase_db_gestor}"
URL_INTERNA="postgresql://postgres:postgres@127.0.0.1:5432/postgres"
export PG_DUMP="docker exec -i $CONTENEDOR pg_dump" PG_RESTORE="docker exec -i $CONTENEDOR pg_restore" PSQL="docker exec -i $CONTENEDOR psql"
TMP="$(mktemp -d)"
CLAVE="clave-de-prueba-$RANDOM-$RANDOM"
SUPABASE_YES=1 npx supabase db reset > /dev/null
$PSQL "$URL_INTERNA" -q < scripts/backup/datos-prueba.sql > /dev/null
$PSQL "$URL_INTERNA" -qAt < scripts/backup/huella.sql > "$TMP/antes.txt"

bash scripts/backup/volcar.sh "$URL_INTERNA" > "$TMP/datos.dump" 2> "$TMP/huella-volcado.txt"
diff -q "$TMP/antes.txt" "$TMP/huella-volcado.txt" > /dev/null || { echo "FALLA: la huella del backup no coincide con la de la base"; exit 1; }
(cd "$TMP" && 7z a -bd -bso0 -p"$CLAVE" -mhe=on backup.7z datos.dump)
rm "$TMP/datos.dump"

if (cd "$TMP" && 7z x -bd -bso0 -bse0 -y -p"otra-clave" -o"$TMP/mala" backup.7z) 2> /dev/null; then
  echo "FALLA: el backup se abrió con una contraseña equivocada"; exit 1
fi
echo "OK: con una contraseña equivocada el backup no se abre"

SUPABASE_YES=1 npx supabase db reset --no-seed > /dev/null
(cd "$TMP" && 7z x -bd -bso0 -y -p"$CLAVE" backup.7z)
bash scripts/backup/restaurar.sh "$URL_INTERNA" < "$TMP/datos.dump"
$PSQL "$URL_INTERNA" -qAt < scripts/backup/huella.sql > "$TMP/despues.txt"

if diff "$TMP/antes.txt" "$TMP/despues.txt"; then
  echo "OK: backup -> contraseña -> restauración: $(wc -l < "$TMP/antes.txt") controles idénticos ($(grep -c '^filas\.' "$TMP/antes.txt") tablas, ventas, pagos, saldos, stock y capital)"
else
  echo "FALLA: lo restaurado no coincide con lo respaldado (diferencias arriba)"; exit 1
fi
if bash scripts/backup/restaurar.sh "$URL_INTERNA" < "$TMP/datos.dump" 2> "$TMP/err.txt"; then
  echo "FALLA: se pudo restaurar encima de una base con datos"; exit 1
fi
echo "OK: no restaura encima de una base que ya tiene datos ($(cat "$TMP/err.txt"))"
