# Restaurar un backup (módulo 1.9)

> Para un desastre real: se perdió o se rompió la base de Supabase. **No hace falta para el uso diario.**
> El procedimiento está probado automáticamente en cada cambio del repositorio (CI, "Prueba de backup y
> restauración", `scripts/backup/prueba-restauracion.sh`) con datos inventados.

## Qué tiene un backup
- Archivo `gestor-AAAA-MM-DD.7z`, cerrado con la contraseña del backup (`BACKUP_PASSWORD`, la que guardaron los
  socios fuera de GitHub). Se guardan los de los últimos 90 días (GitHub > Actions > "Backup diario" > Artifacts).
- Adentro: `gestor-AAAA-MM-DD.dump` (todos los datos del esquema `public`, formato de `pg_dump`) y `huella.txt`
  (cantidad de filas por tabla y totales de ventas, pagos, saldos, stock y capital al momento del backup).
- **No** tiene la estructura de las tablas (está en `supabase/migrations`) ni las cuentas de login (esquema `auth`):
  las cuentas se crean de nuevo y se vinculan a sus socios (paso 5). Como cada operación guarda el **socio** y no la
  cuenta de login, no se pierde quién hizo qué (plan A1 y T19).

## Pasos (los hace quien mantiene el sistema, con los socios)
1. **Base nueva:** crear un proyecto nuevo en Supabase (región São Paulo) y copiar su cadena de conexión
   "Session pooler" (`postgresql://postgres.xxxx:CONTRASEÑA@aws-0-sa-east-1.pooler.supabase.com:5432/postgres`).
2. **Estructura:** aplicar las migraciones del repositorio a la base nueva:
   `npx supabase db push --db-url "<cadena del paso 1>"`.
3. **Abrir el backup:** descargar el `.7z` del día elegido y abrirlo con 7-Zip y la contraseña del backup.
4. **Cargar los datos** (con PostgreSQL 17 instalado, `pg_restore` y `psql`):
   `bash scripts/backup/restaurar.sh "<cadena del paso 1>" < gestor-AAAA-MM-DD.dump`
   - Solo restaura en una base **sin datos** y lo hace todo en una transacción: si algo falla, no queda nada a medias.
   - Los datos se cargan tal cual se respaldaron, sin recalcular nada.
5. **Cuentas de login:** en Supabase > Authentication > Users crear las cuentas de los socios (mismo email) y
   vincularlas con `supabase/admin/vincular-socio.sql` (una vez por socio).
6. **Controles:** correr `scripts/backup/huella.sql` en Supabase > SQL Editor y compararlo con `huella.txt` del
   backup: tiene que dar **exactamente igual** (filas por tabla, numeración, ventas, pagos, saldos, stock y capital).
7. **Conectar la app:** en Vercel > Settings > Environment Variables cambiar `SUPABASE_URL` y
   `SUPABASE_PUBLISHABLE_KEY` por los del proyecto nuevo y volver a publicar. En GitHub, actualizar los secretos
   `SUPABASE_DB_URL`, `SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY` (migraciones, backup y anti-pausa).
8. Entrar a la app con cada socio y revisar Inicio, Deudores y Stock.

Lo que se haya cargado **después** del último backup (entre las 4:30 y el momento del problema) no está en el backup y
hay que volver a cargarlo a mano.
