# Notas para retomar el trabajo

> Para leer al empezar una sesión nueva, junto con `CLAUDE.md` (reglas), `docs/plan.md` (plan y estado,
> sección 12) y `docs/decisiones/modulo-*.md` (decisiones de cada módulo).
> Última actualización: 13/11/2026, al cerrar el módulo 1.5.

## 1. Dónde estamos

- Terminados y mergeados en `main`: módulos 1.0 a 1.5 (PR #1 a #7 de `benjamingarma/Gestor`).
- **Siguiente: 1.6 Ajustes de stock.** Después: 1.7 Simplificación del diseño (nuevo, ver `docs/plan.md` 12.3),
  1.8 Importación CSV, 1.9 Backups y restauración, 1.10 Pasaje a producción.
- Repositorio privado, rama por defecto `main` (verificado el 13/11). Se trabaja con una rama `claude/...` por
  módulo y un PR; los socios prueban en el deploy preview de Netlify y mergean ellos.
- Al mergear, las migraciones se aplican solas a Supabase (`.github/workflows/migraciones.yml`, secreto
  `SUPABASE_DB_URL`). Funciona: los módulos 1.1 a 1.5 se aplicaron así.
- Se prueba en el **mismo proyecto de Supabase que va a ser el real**, en modo prueba: todo lo cargado tiene
  `es_prueba = true` y se borra en el 1.10 con `supabase/admin/borrar-datos-de-prueba.sql` (plan A20).

## 2. Qué se probó

En cada módulo: pruebas automáticas en el entorno de desarrollo, recorrido con navegador automático en
tamaño celular (Pixel 7, `es-AR`, hora de Tucumán) y prueba de los socios desde el celular antes de mergear.

| Módulo | Probado por los socios en el celular | Pruebas automáticas al cerrar |
|---|---|---|
| 1.0 | Login, sesión persistente, cierre de sesión, en producción | 21 pgTAP, 49 Vitest |
| 1.1 | Productos, compras USD con dos tipos de cambio, sugerido, doble toque, anulación | 84 pgTAP, 76 Vitest |
| 1.2 | Atrasados, A visitar, WhatsApp, deshacer visita, archivar | 126 pgTAP, 113 Vitest |
| 1.3 | Venta que consume dos compras a distinto TC, multi-producto, precios especiales, anulación | 196 pgTAP + concurrencia, 126 Vitest |
| 1.4 | Saldo del papel, cobros parciales, saldo a favor, anular cobro, filtro por mes | 233 pgTAP, 145 Vitest |
| 1.5 | Resumen del mes, capital ✓, reparto 60/40 sin alterar el pasado | 254 pgTAP, 163 Vitest, humo (18 pantallas) |

Todos los números del ejemplo del plan (sección 6) están verificados en pgTAP y en Vitest: V1 $74.000 / USD 60,
ventas $199.000, ganancia $74.000, capital USD 195 = 96 + 99 y $267.500 = $125.000 + $142.500, cuenta de Bruno
$99.000 → $49.000 → $1.000 a favor.

## 3. Problemas que aparecieron (y cómo se resolvieron)

1. **Login roto al agregar `reparto_porcentajes` (1.5) — el más grave.** La tabla apunta a `socios` y a
   `negocios`; la consulta de `src/lib/sesion.ts` que embebía `negocios` desde `socios` quedó ambigua para la
   API ("more than one relationship was found") y daba error 500 en todas las pantallas. Se corrigió nombrando la
   relación: `negocios!socios_negocio_id_fkey (...)`. Lo encontró la prueba con navegador, no las pruebas
   automáticas. **Desde entonces existe la prueba de humo** (`scripts/humo.mjs`, trabajo `humo` del CI): levanta la
   app completa, entra y abre 18 pantallas. Se verificó que con la consulta rota falla.
   → **Regla**: cada vez que una tabla nueva tenga dos FK hacia tablas que ya se relacionan, revisar los embeds
   (`tabla ( ... )` en los `.select`) y nombrar la relación. Correr la prueba de humo antes del PR.
2. **Límite de 1000 filas de la API de Supabase** (`max_rows`). Una consulta sin paginar devuelve como máximo
   1000 filas **sin avisar**. El resumen usa vistas agregadas por día y `leerTodo()` (páginas de 1000) en
   `src/datos/resumen.ts`. Riesgo pendiente (bajo con el volumen actual): `cobrosDeVentas` y `cuentaDeCliente`
   (`src/datos/cuentas.ts`) leen todas las ventas y pagos de los clientes pedidos sin paginar; con más de 1000
   ventas de un mismo cliente se cortarían. Si se agregan listados "de todo", paginar.
3. **fast-check encontró límites peligrosos en compras (1.1).** Con los límites originales, el total de una compra
   podía superar el mayor entero exacto de JavaScript. Se bajaron (10.000 u, USD 10.000/u, $100.000/USD) en la
   base y en `src/dominio/compras.ts`.
4. **Pruebas mal planteadas que fast-check destapó.** Redondeo "mitad hacia arriba" (1.0: el intervalo correcto es
   (−0,5; +0,5]) y una prueba del reparto (1.5) que calculaba el valor esperado con decimales de JavaScript y
   fallaba de forma intermitente con montos de billones. Regla: en pruebas de dinero, calcular lo esperado con
   `BigInt`.
5. **"Visitado" no volvía a registrar después de "Deshacer" (1.2).** El formulario conservaba el mismo UUID
   (idempotencia) y la base devolvía la visita anulada. Se resolvió remontando el componente con `key` cuando cambia
   la última visita. Regla: los formularios que generan UUID en el celular se remontan (`key`) después de cada
   operación exitosa que se pueda repetir en la misma pantalla.
6. **Concurrencia de ventas (1.3).** Sin `for update` sobre las compras se vendían dos veces la última unidad
   (stock −1). `supabase/tests/concurrencia.sh` lo prueba con dos conexiones reales y corre en el CI.
7. **Las pruebas pgTAP chocaban con usuarios de desarrollo** (mismo email). Las pruebas usan `@pgtap.test`; la
   prueba de humo, `@humo.test`; los usuarios de desarrollo, `@ejemplo.test`.
8. **Conexión de GitHub Actions a Supabase:** la conexión directa del plan gratis es solo IPv6 y GitHub no tiene IPv6.
   Se usa el "Session pooler" (`SUPABASE_DB_URL`, contraseña sin símbolos para no tener que codificarla en la URL).

## 4. Decisiones técnicas que no están en otros documentos

### Next.js 16
- `src/proxy.ts` reemplaza al viejo `middleware.ts` (renombrado en Next 16).
- `AGENTS.md` (lo generó `create-next-app`): antes de usar APIs de Next, leer `node_modules/next/dist/docs/`.
- `PageProps<"/ruta">` y `LayoutProps` son tipos generados: correr `npx next typegen` antes de `tsc`
  (`npm run tipos` ya lo hace). Al crear una ruta nueva, regenerar.
- `params` y `searchParams` son Promesas (`await params`).
- La regla de lint `react-hooks/immutability` no deja modificar variables externas dentro de callbacks de render
  (usar `map` + `reduce`).
- Patrón de formularios: componente cliente con `useActionState` + acción de servidor que valida, llama a la
  función de la base (`rpc`), hace `revalidatePath` y `redirect(...?ok=...)`; la página muestra el aviso según `ok`.

### Base de datos
- **Nunca editar una migración ya aplicada**: siempre un archivo nuevo. `create or replace view` exige mantener
  las columnas existentes en el mismo orden (pasó con `v_clientes` en el 1.3).
- **Checklist para cada tabla nueva de datos del negocio:**
  1. columnas `negocio_id`, `es_prueba`, `registrado_por` (socio), `creado_en`; UUID del celular si es una operación;
  2. triggers `completar_alta` (pone es_prueba, registrado_por, creado_en) e `impedir_borrado`; si se anula,
     trigger de "solo anulación" (`solo_anulacion_generica` sirve);
  3. RLS + `revoke all ... from anon, authenticated` + `grant` mínimo; escritura de operaciones solo por funciones
     `security definer` idempotentes;
  4. sumarla a `contar_datos_de_prueba` y `borrar_datos_de_prueba` (se reemplazan enteras en la migración nueva,
     con la verificación de "datos reales que dependen de datos de prueba"), y actualizar las listas esperadas de
     esas funciones en `supabase/tests/01` a `04`;
  5. pruebas pgTAP (RLS entre negocios, anónimo, inmutabilidad, idempotencia) y correr la prueba de humo.
- Las pruebas generales de `00_base_rls.test.sql` ("toda tabla tiene RLS" y "el anónimo no tiene permisos")
  cubren automáticamente las tablas nuevas.
- Movimientos de stock: los de tipo `venta`/`anulacion_venta` deben tener `venta_item_id` (regla en la tabla). En el
  1.6, los de `ajuste`/`anulacion_ajuste` deberían exigir `ajuste_id` de la misma forma (hoy no se exige porque la
  tabla de ajustes no existe; la prueba `01` usa un movimiento `ajuste` sin `ajuste_id` para simular una salida:
  habrá que adaptarla).
- La vista `v_capital` ya cuenta las pérdidas por ajustes (`tipo in ('ajuste','anulacion_ajuste')`), y el resumen ya
  tiene la fila "Pérdidas por ajustes": en el 1.6 hay que pasarle las pérdidas a `calcularGanancia` (hoy recibe `[]`
  en `src/app/(app)/resumen/page.tsx`).
- Fechas: los días son texto `AAAA-MM-DD` en hora de Tucumán. Ventas guardan fecha y hora; si se carga una fecha
  pasada, se guarda al mediodía de ese día en Tucumán. Pagos, visitas, compras y saldos del papel guardan solo el día.
- Porcentajes del reparto en centésimos (5000 = 50 %); en pantalla se leen con `parsearImporte`, que da centésimos
  igual que centavos.

### Entorno de desarrollo (contenedor de la sesión)
- Docker no arranca solo: `nohup dockerd > /tmp/dockerd.log 2>&1 &` y esperar a que `docker info` responda.
- `npm run db:start` levanta base + API + login (sin Studio ni otros servicios). Si dice "not ready", esperar a que
  el contenedor `supabase_db_gestor` esté `healthy` y correr `npx supabase db reset`.
- `npx supabase status -o env` da `API_URL`, `PUBLISHABLE_KEY` y `SECRET_KEY` locales (son claves de demostración
  públicas de Supabase local, no secretos reales) para armar `.env.local`.
- Usuario local: crearlo con la API de administración (`/auth/v1/admin/users`, con `SECRET_KEY`) con una
  contraseña aleatoria, y vincularlo con `supabase/admin/vincular-socio.sql`. **La prueba de humo re-vincula el
  Socio A del seed a su propio usuario**: después de correrla en local hay que volver a vincular el usuario de
  desarrollo.
- Playwright: en el contenedor se usa el instalado globalmente (1.63, no instalar otra versión). En CI se instala
  `playwright@1.63.0` con `--no-save`.
- El Chromium automático muestra los `<input type="date">` en formato mm/dd; en celulares en español se ven dd/mm.
- Comandos: `npm run verificar` (lint + tipos + Vitest), `npx supabase test db` (pgTAP),
  `bash supabase/tests/concurrencia.sh`, `npm run humo` (con la app corriendo y `API_URL`/`SECRET_KEY` en el entorno).

## 5. Pendientes e ideas que quedaron anotadas (no pedidas todavía)
- Historial de ventas "ver más" sin filtro de mes (hoy: por mes, o las últimas 5 en la ficha del cliente).
- Costo de reposición frente a la suba del dólar (plan T4): no se muestra; solo el capital en USD.
- Etapa 2: historial de visitas y recordatorios, devoluciones y reposiciones de fallados, retiros por socio.
- Si alguna vez hay más de un negocio o más de dos socios, revisar pantallas que asumen dos (el reparto ya soporta N).
