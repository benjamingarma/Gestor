#!/usr/bin/env bash
# Backup de los datos de la app (módulo 1.9): solo el esquema public y solo datos (la estructura está en
# supabase/migrations). Sin las cuentas de login (esquema auth): al restaurar se vuelven a vincular (plan T19).
#
#   volcar.sh <url-de-la-base> > datos.dump
#
# PG_DUMP permite elegir el pg_dump (tiene que ser de la versión 17, como la base).
# Escribe el backup por la salida estándar y la huella de control (cantidades y totales, sin datos) por la de errores.
set -euo pipefail
URL="${1:?Falta la URL de la base}"
PG_DUMP="${PG_DUMP:-pg_dump}"
PSQL="${PSQL:-psql}"
DIR="$(cd "$(dirname "$0")" && pwd)"

$PG_DUMP --dbname="$URL" --format=custom --data-only --schema=public --no-owner --no-privileges
$PSQL "$URL" -qAt -v ON_ERROR_STOP=1 < "$DIR/huella.sql" >&2
