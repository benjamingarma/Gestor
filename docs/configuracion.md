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

## 3. Netlify
1. Add new site > Import from Git > el repositorio. Rama de producción: `main`.
2. Site configuration > Environment variables:
   - `SUPABASE_URL` = Project URL (Supabase > Project Settings > API)
   - `SUPABASE_PUBLISHABLE_KEY` = Publishable key (`sb_publishable_...`). **Nunca** la secret/service_role.
3. Deploy previews: activados para pull requests (vienen por defecto). Cada PR tiene su link para probar.
4. En Supabase > Authentication > URL Configuration: poner la URL de Netlify como Site URL.

## 4. Tarea anti-pausa (GitHub Actions)
GitHub > Settings > Secrets and variables > Actions > New repository secret:
- `SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY` (los mismos de Netlify).
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

Este mismo secreto lo va a usar el backup diario del módulo 1.8. Si alguna vez se filtra, repetí el paso 1
(cambiar la contraseña invalida la cadena vieja) y actualizá el secreto.

## Desarrollo local (opcional, necesita Docker)
```bash
npm install
npm run db:start
npx supabase status
```
Copiá `.env.example` a `.env.local` con `API_URL` y `PUBLISHABLE_KEY` de `supabase status`, y después
`npm run dev`. Pruebas: `npm run verificar` (lint + tipos + Vitest) y `npm run test:db` (pgTAP).
