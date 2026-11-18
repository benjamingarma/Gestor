# Configuración de los servicios (proyecto de PRUEBA)

Pasos que hace Benjamín una sola vez. Nada de esto pone claves en el código.
Mientras estemos en desarrollo: **proyecto de prueba y datos inventados**.

## 1. GitHub
1. Repositorio **privado** (ya lo es). Así las tareas programadas no se desactivan solas y nadie ve los logs.
2. Settings > General > Default branch: cambiar a **`main`**.
3. Settings > Branches > Add rule para `main`: "Require a pull request before merging" y
   "Require status checks to pass" (elegir los dos trabajos de **CI** después de la primera corrida).

## 2. Supabase (proyecto de prueba)
1. Crear proyecto nuevo (plan gratis), región **São Paulo** (la más cercana). Guardar la contraseña de la base en
   un gestor de contraseñas.
2. Authentication > Sign In / Providers: **desactivar "Allow new users to sign up"**. Email habilitado.
   Authentication > Policies/Password: largo mínimo 10, letras y números.
3. Las migraciones se aplican solas al mergear a `main` (ver "Migraciones automáticas" abajo).
4. SQL Editor: correr `supabase/admin/crear-negocio.sql` (cambiando el nombre del negocio).
5. Authentication > Users > Add user > Create new user: tu email y una contraseña (marcar "Auto confirm").
6. SQL Editor: correr `supabase/admin/vincular-socio.sql` con tu email y `Benjamín`.
   Para tu papá, lo mismo cuando tenga cuenta (con `Papá`).

## 3. Vercel (hosting; desde el 17/11/2026, antes Netlify)
1. **Importar el repo.** En vercel.com: **Add New… > Project > Import Git Repository**. Si es la primera vez, conectar
   GitHub y darle acceso al repositorio `Gestor`. Vercel detecta **Next.js** solo: dejar Framework Preset, Root
   Directory (`./`) y Build Command como vienen. No hace falta ningún archivo de configuración en el repo.
2. **Variables de entorno.** En **Settings > Environment Variables** (o en la pantalla de importación, antes de Deploy):
   - `SUPABASE_URL` = Project URL (Supabase > Project Settings > API)
   - `SUPABASE_PUBLISHABLE_KEY` = Publishable key (`sb_publishable_...`). **Nunca** la secret/service_role.

   En cada una, marcar los tres entornos: **Production, Preview y Development**. Si falta Preview, los deploy previews
   de los PR arrancan pero no pueden conectarse a Supabase. Cambiar una variable no afecta lo ya publicado: toma efecto
   en el próximo deploy (o en **Deployments > ⋯ > Redeploy**).
3. **Versión de Node.** **Settings > Build and Deployment > Node.js Version: 22.x** (la misma que usa el CI). Vercel
   avisa "The project's values take effect on its next deployment": es normal, se aplica en el próximo deploy.
4. **Rama de producción: `main`** (viene así). Cada merge a `main` **publica solo** en producción. Cada PR tiene su
   **deploy preview** (link en el PR, en el check de Vercel) para probar antes de mergear.
5. **Supabase > Authentication > URL Configuration > Site URL:** poner la URL de producción de Vercel
   (`https://<proyecto>.vercel.app`). La app entra con email y contraseña, así que **no hace falta cargar Redirect
   URLs**, ni para producción ni para los previews: la Site URL solo se usa en los emails que manda Supabase (por
   ejemplo, si se resetea una contraseña desde el panel).
6. **Previews protegidos.** En el plan Hobby, Vercel protege los deploy previews con su propio login (Settings >
   Deployment Protection > Vercel Authentication): para abrirlos hay que estar logueado en Vercel con una cuenta que
   tenga acceso al proyecto. La URL de producción es pública (igual pide el login de la app). Si alguien sin cuenta
   de Vercel (por ejemplo, el papá) tiene que probar un preview, se puede apagar esa protección para los previews: la
   app sigue pidiendo su propio login y la seguridad de los datos la da RLS. Decisión de los socios.

## 4. Tarea anti-pausa (GitHub Actions)
GitHub > Settings > Secrets and variables > Actions > New repository secret:
- `SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY` (los mismos que en Vercel).
Probala a mano: Actions > "Mantener activo Supabase" > Run workflow. Debe mostrar "Supabase respondió: ...".

## 5. Migraciones automáticas (una sola vez, desde la PC)
Al mergear un PR que cambia la base, GitHub Actions aplica solo las migraciones nuevas a Supabase
(`.github/workflows/migraciones.yml`). Necesita **un solo secreto**: `SUPABASE_DB_URL`.

1. **Contraseña de la base sin símbolos.** Supabase > tu proyecto > **Project Settings** > **Database** >
   **Reset database password** > **Generate a password**. Si la generada tiene símbolos (`@ : / ? # %`),
   generá otra hasta que sea solo letras y números. Copiala. (La app no usa esta contraseña: cambiarla no rompe nada.)
2. **Cadena de conexión.** Botón **Connect** (arriba en el proyecto) > pestaña **Connection String** >
   tipo **URI** > sección **Session pooler**. Copiá la línea; se parece a
   `postgresql://postgres.abcdefghijklmnop:[YOUR-PASSWORD]@aws-0-sa-east-1.pooler.supabase.com:5432/postgres`
3. **Armala.** En un bloc de notas, reemplazá `[YOUR-PASSWORD]` (con los corchetes) por la contraseña del paso 1.
4. **Cargala en GitHub.** Repositorio > **Settings** > **Secrets and variables** > **Actions** >
   **New repository secret**. Name: `SUPABASE_DB_URL`. Secret: la línea del paso 3. **Add secret**.
   Borrá la línea del bloc de notas.
5. **Probala.** GitHub > **Actions** > "Aplicar migraciones a Supabase" > **Run workflow** (rama `main`).
   Tiene que terminar en verde. Como la migración del módulo 1.0 ya está aplicada, dice que no hay nada nuevo.

Este mismo secreto lo usa el backup diario (módulo 1.9, sección 6). Si alguna vez se filtra, repetí el paso 1
(cambiar la contraseña invalida la cadena vieja) y actualizá el secreto.

## 6. Backup diario (módulo 1.9, una sola vez)

Todos los días a las 4:30 (hora de Tucumán) GitHub copia los datos de la app, los cierra con una contraseña y los
guarda 90 días (`.github/workflows/backup.yml`). Usa el mismo secreto `SUPABASE_DB_URL` de las migraciones y uno nuevo:

1. **Elegir la contraseña del backup**: larga (mínimo 16 caracteres; mejor una frase de 4 o 5 palabras). **Guardarla
   fuera de GitHub** (gestor de contraseñas del celular y una copia en papel): sin ella los backups no se pueden abrir,
   y GitHub no deja volver a verla.
2. GitHub > el repositorio > Settings > Secrets and variables > Actions > **New repository secret**:
   nombre `BACKUP_PASSWORD`, valor: la contraseña.
3. Probarlo: pestaña **Actions** > "Backup diario" > **Run workflow**. Tiene que terminar en verde; el registro muestra
   solo cantidades de filas y totales (nunca datos de clientes).
4. **Prueba de la contraseña (una sola vez, importante):** en esa ejecución, abajo, en **Artifacts**, descargar
   `gestor-AAAA-MM-DD`. Adentro hay un `.7z`: abrirlo con [7-Zip](https://www.7-zip.org/) (gratis) y escribir la
   contraseña guardada. Si muestra `gestor-AAAA-MM-DD.dump` y `huella.txt`, la contraseña guardada es la correcta.
   No hace falta hacer nada más con esos archivos.

Para restaurar un backup (si un día se pierde la base): `docs/restauracion.md`.

## Desarrollo local (opcional, necesita Docker)
```bash
npm install
npm run db:start
npx supabase status
```
Copiá `.env.example` a `.env.local` con `API_URL` y `PUBLISHABLE_KEY` de `supabase status`, y después
`npm run dev`. Pruebas: `npm run verificar` (lint + tipos + Vitest) y `npm run test:db` (pgTAP).
