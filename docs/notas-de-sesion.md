# Notas para retomar el trabajo

> Para leer al empezar una sesión nueva, junto con `CLAUDE.md` (reglas), `docs/plan.md` (plan y estado,
> sección 12) y `docs/decisiones/modulo-*.md` (decisiones de cada módulo).
> Última actualización: 11/11/2026. Módulo 1.7: PR 1 a 4 y "venta a cliente nuevo" (PR A, A2 y B) mergeados; no hay
> PRs abiertos. Siguen "Repetir última venta" y la prueba del papá (sección 6). El sabor quedó descartado y el
> gráfico del mes en Inicio se posterga hasta tener datos reales (plan 12.5).

## 1. Dónde estamos

- Terminados y mergeados en `main`: módulos 1.0 a 1.6 (PR #1 a #10 de `benjamingarma/Gestor`).
- **En curso: 1.7 Simplificación del diseño.** Mergeados: PR 1 a 4 (#11, #12, #14, #15), documentación (#13) y
  **venta a un cliente nuevo** (#16 migración, #18 migración de dirección, #17 pantalla). **No hay PRs abiertos.**
  Verificado el 11/11/2026 en GitHub: CI de `main` en verde en `fddcb15` (log: 225 Vitest, 356 pgTAP, concurrencia 3/3,
  humo 29 pantallas y 32 totales) y las dos migraciones nuevas aplicadas a Supabase (log de "Aplicar migraciones").
- **Siguen, en este orden** (detalle en la sección 6): (a) "Repetir última venta", (b) cierre del 1.7 con la prueba
  del papá cuando vuelva de viaje. Después: 1.8 Importación CSV, 1.9 Backups y restauración, 1.10 Pasaje a producción
  y, con datos reales, el gráfico del margen real en Inicio (plan 12.5). **Sabor: descartado (11/11).**
- Maquetas aprobadas en `docs/maquetas/` (leer su README antes de tocar pantallas). Decisiones de la venta a cliente
  nuevo en `docs/decisiones/modulo-1.7-venta-cliente-nuevo.md`.
- Repositorio privado, rama por defecto `main`. Se trabaja con una rama `claude/...` y un PR por tarea; los socios
  prueban en el deploy preview de **Vercel** y **mergean ellos** (nunca mergear sin su aprobación).
- **En curso (18/11/2026): pago en la venta, ganancia según lo cobrado y lenguaje** (plan 12.6, decisiones en
  `docs/decisiones/pago-en-venta-y-ganancia-cobrada.md`, glosario en `docs/glosario.md`). PRs en orden: 1 lenguaje,
  2A migración de venta con pago, 2B pantalla, 3 ganancia cobrada. "Repetir última venta" mergeado (#22, 17/11).
  PR 1 (lenguaje) mergeado (#23). PR 2A mergeado (#24, 18/11): migración `20261118120000_venta_con_pago.sql`
  aplicada (log verificado: listó solo esa). **Cambio de los socios (18/11): el pago de la pantalla de venta se aplica
  a esa venta** (camino B; tabla de ejemplos en el documento de decisiones). PR 2B-1 abierto: `aplicarCreditos` con
  `ventaId` + migración solo de comentarios `20261118130000_imputacion_pago_de_venta.sql` (243 Vitest). Siguen 2B-2
  pantalla y 3 ganancia cobrada. **Decidido para el 2B-2 (18/11):** si el cliente ya debía, la confirmación muestra
  "Esta venta: pagada (o debe $ X) · Deuda anterior $ Y" en vez de un solo "Debe $ Y". 2B-1 mergeado (#25,
  migración de comentarios aplicada; log verificado). PR 2B-2 abierto: selector "¿Pagó?" en la venta, línea en vivo,
  confirmación con "Esta venta / Deuda anterior", Deshacer y Anular con `anular_venta_y_pagos` ("Se le devolvió la
  plata", marcado por defecto). Sin migración. **2B-2 mergeado (#26).** PR 3 abierto (ganancia según lo cobrado, sin migración):
  `src/dominio/gananciaCobrada.ts` + desglose en Inicio y Resumen (`src/componentes/DesgloseGanancia.tsx`). PR 3 mergeado (#27)
  y arreglo de "Nos deben" en el celular (#28). **18/11: lo cobrado del papel trae ganancia estimada del 50 % fijo**
  (una sola ganancia neta; PR abierto). Pendiente de confirmar por los socios: una venta de $ 0 con costo reconoce su
  pérdida el día de la venta.
- **Hosting: Vercel (plan Hobby) desde el 17/11/2026** (Netlify pausó los deploys a producción por créditos del plan
  gratis; se borraron el proyecto de Netlify y `netlify.toml`). Cada merge a `main` publica solo. Los previews de
  Vercel piden login de Vercel (Deployment Protection). Pasos en `docs/configuracion.md`, sección 3.
- Al mergear, las migraciones se aplican solas a Supabase (`.github/workflows/migraciones.yml`, secreto
  `SUPABASE_DB_URL`). Después de cada merge con migración, revisar el log: el paso "Migraciones pendientes" tiene que
  listar solo la migración nueva.
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
| 1.6 | Rotura/regalo/pérdida desde la ficha, resumen descuenta, anulación (aprobado 10/11) | 307 pgTAP, 176 Vitest, concurrencia venta contra ajuste, humo (21 pantallas) |
| 1.7 PR 1 | Navegación, Más, nuevo Inicio (aprobado 10/11) | 307 pgTAP, 192 Vitest, humo (23 pantallas + 15 totales contra la base) |
| 1.7 PR 2 | Venta en una pantalla, caja de precio, confirmación y deshacer (aprobado 10/11) | 307 pgTAP, 200 Vitest, humo (25 pantallas + venta de punta a punta) |
| 1.7 PR 3 | Cobro en una pantalla, confirmación y deshacer (mergeado 10/11) | 307 pgTAP, 212 Vitest, humo (29 pantallas + cobro de punta a punta + 32 totales contra la base, con y sin el cobro) |
| 1.7 PR 4 | Resto de pantallas con el estilo de las maquetas (mergeado 10/11) | 307 pgTAP, 212 Vitest, humo (29 pantallas + 32 totales + control de ancho en el celular) |
| 1.7 cliente nuevo | Venta a cliente nuevo, "Crear cliente nuevo" arriba, dirección (mergeado 11/11; falta la prueba del papá) | 356 pgTAP, concurrencia 3/3 (doble toque a cliente nuevo), 225 Vitest, humo (sección 6: cliente nuevo, duplicado, venta que falla sin dejar cliente, dirección en la ficha) |

Todos los números del ejemplo del plan (sección 6) están verificados en pgTAP y en Vitest: V1 $74.000 / USD 60,
ventas $199.000, ganancia $74.000, capital USD 195 = 96 + 99 y $267.500 = $125.000 + $142.500 (con A1 del 1.6:
195 = 96 + 5 + 94 y $267.500 = $125.000 + $7.000 + $135.500, ganancia neta $67.000), cuenta de Bruno
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
9. **CI roto por un YAML inválido (1.6).** El nombre de un paso de `ci.yml` tenía `: ` sin comillas; GitHub rechazó el
   archivo entero y **no corrió ninguna prueba** en el PR #9 ni en `main` (se arregló en el PR #10). Reglas:
   - antes de subir un cambio en `.github/workflows/`, validarlo con un parser YAML y con `actionlint`;
   - un PR no está listo hasta ver su CI en verde **en GitHub** y comprobar en el log que las pruebas corrieron
     (no alcanza con que pasen en el entorno local).

10. **Descargas de imágenes de Docker bloqueadas o limitadas (11/2026).** `supabase start` falló porque los CDN de
    ECR y GHCR dan 403 por el proxy y Docker Hub devolvió "429 Too Many Requests". Se resolvió bajando las imágenes que
    faltaban directo de Docker Hub (`docker pull kong:2.8.1`, `docker pull postgrest/postgrest:v16.5`), reintentando
    con espera. En el CI también apareció "toomanyrequests" alguna vez.
11. **El contenedor de la sesión se reinició varias veces** y Docker quedó apagado (la base local y la app también).
    Antes de correr pruebas: `docker info`; si falla, levantar `dockerd`, `npm run db:start` y volver a arrancar la app.
12. **Selectores de Playwright en la prueba de humo:** `text=…:visible` toma ":visible" como parte del texto (no filtra);
    usar `locator(sel).filter({ visible: true })`. `isVisible()` no espera: para esperar un aviso usar `waitFor()`.
13. **Reemplazos de clases en bloque (PR 4):** `text-xl font-bold` se usaba para títulos y para números grandes; el
    reemplazo achicó números. Revisar las capturas después de cada reemplazo masivo.
14. **pgTAP: un precio de $ 0 es válido** en `registrar_venta` (regalo). Para probar una venta que falla, usar un precio
    negativo o falta de stock. En psql, `bool || texto` da `true`/`false`, no `t`/`f`.
15. **Push forzado rechazado por el entorno** (`--force-with-lease`). No hace falta cuando la rama remota ya está
    contenida en `main` (es un avance normal): reiniciar la rama desde `origin/main` y hacer `git push` común.
16. **El deploy preview usa la base real y las migraciones se aplican recién al mergear.** Una pantalla que depende de
    una migración nueva no se puede probar en el preview antes de mergear. Solución usada: **dos PR** (A: solo migración
    y pruebas; B: pantalla) y, si la pantalla se sube antes de aplicar la migración, mantenerla compatible y que la
    prueba de humo detecte si la base ya tiene la migración (se sacó todo al aplicarla). Un commit intermedio del PR B
    (`e81e5d5`) quedó con la prueba de humo en rojo por eso; el siguiente lo corrigió.
17. **Conflicto al traer `main` a una rama de PR:** pasó en `docs/decisiones/…` (las dos ramas agregaron una sección al
    final). Se resolvió con un commit de merge conservando las dos partes (nunca reescribir historia).
18. **`next build` con caché** puede decir "Compiled in 500ms": para estar seguro de que la build tiene el cambio,
    buscar un texto nuevo en `.next/static` antes de sacar capturas.

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
- Movimientos de stock: los de tipo `venta`/`anulacion_venta` exigen `venta_item_id` y, desde el 1.6, los de
  `ajuste`/`anulacion_ajuste` exigen `ajuste_id` (reglas en la tabla). La prueba `01` ya usa `registrar_ajuste`.
- Pérdidas por ajustes: la ganancia las toma de `v_perdidas_diarias` (tabla `ajustes_stock`, por la fecha del ajuste)
  y el capital de `v_capital` (movimientos). Una prueba pgTAP verifica que las dos den lo mismo.
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
- `pkill -f "next start"` **no** mata el servidor de Next (el proceso se llama `next-server`): usar `pkill -f next-server`
  antes de volver a arrancar, o se sigue viendo la versión vieja (pasó en el 1.7).
- Si el contenedor de la sesión se reinicia, Docker queda apagado: volver a levantar `dockerd` y la base.
- Comandos de shell con paréntesis anidados (`( ... || ( ... & ) )`) pueden ser bloqueados por el control de
  seguridad aunque no borren nada: escribirlos en pasos simples.
- Capturas para comparar con la maqueta: datos inventados cargados con un script (usuario `@ejemplo.test`, socios
  renombrados a Benjamín/Papá solo en la base local), Playwright a 390×844 (celular) y 1366×768 (PC), `colorScheme`
  claro y oscuro. Para que la barra inferior fija quede abajo, no usar `fullPage`: agrandar la ventana al alto de la
  página. Las comparaciones se guardan en `docs/maquetas/comparaciones/prN-.../`.
- Capturas sin maqueta (PR 4): antes → después con los mismos datos inventados e IDs fijos (base reseteada antes de cada
  tanda), en `docs/maquetas/comparaciones/pr4-pantallas/`.
- Comprobar que una prueba nueva detecta el error: romper a propósito la función en la base local (por ejemplo, versión
  "en dos pasos" o sin `on conflict`), ver que la prueba falla y volver a `npx supabase db reset`.
- Comandos: `npm run verificar` (lint + tipos + Vitest), `npx supabase test db` (pgTAP),
  `bash supabase/tests/concurrencia.sh`, `npm run humo` (con la app corriendo y `API_URL`/`SECRET_KEY` en el entorno).

## 5. Pendientes e ideas que quedaron anotadas (no pedidas todavía)
- Avisos de GitHub Actions: `actions/checkout@v4` y `actions/setup-node@v4` usan Node 20 (obsoleto; hoy solo avisa).
- Supabase CLI 3.0.0 → hay 3.1.0 (aviso en el CI).
- Historial de ventas "ver más" sin filtro de mes (hoy: por mes, o las últimas 5 en la ficha del cliente).
- Costo de reposición frente a la suba del dólar (plan T4): no se muestra; solo el capital en USD. Relacionado con el
  gráfico del margen (plan 12.5).
- Margen por producto en el Resumen, para saber cuáles dejan poco y ajustar precios (idea del 11/11, no pedida).
- Etapa 2: historial de visitas y recordatorios, devoluciones y reposiciones de fallados, retiros por socio.
- Si alguna vez hay más de un negocio o más de dos socios, revisar pantallas que asumen dos (el reparto ya soporta N).

## 6. Módulo 1.7 — Simplificación del diseño (estado al 11/11/2026)

Especificación visual: `docs/maquetas/` (README, HTML, imágenes en claro/oscuro, celular/PC). Plan de PRs en
`docs/plan.md` 12.3. Las pantallas no cambian la lógica de dinero. Las únicas migraciones del módulo son las de
"venta a cliente nuevo" (pedido aparte de los socios, ver más abajo).

### Forma de trabajo pedida por los socios (vale para cada PR que falta)
1. Respetar la maqueta: jerarquía, textos, orden, espacios, navegación y los dos temas. **No agregar ni sacar
   elementos sin avisar.** Si la pantalla no tiene maqueta: mismo estilo, sin cambiar qué muestra.
2. Antes de pedir que prueben: capturas reales (celular y PC, claro y oscuro) al lado de la maqueta (o antes → después),
   guardarlas en `docs/maquetas/comparaciones/`, y listar cada diferencia con su motivo en el PR.
3. CI en verde **en GitHub** y revisar en el log que las pruebas corrieron (cantidad de Vitest y pgTAP, líneas OK de la
   prueba de humo). Prueba de humo actualizada con lo nuevo.
4. Los socios prueban en el deploy preview y mergean ellos. No mergear nunca. Después del merge, confirmar el CI de `main`
   (y, si hubo migración, el log de "Aplicar migraciones").
5. **Migraciones: avisar ANTES de escribirlas y explicar por qué**; si se puede reutilizar lo existente, mejor.
6. Mantener siempre separados ganancia, cobrado y plata disponible, con sus avisos ("La ganancia no es plata
   disponible", saldo a favor, origen del precio).
7. Al terminar, decir qué probar desde el celular y si el deploy preview alcanza o hay que mergear antes.

### PRs
| # | Contenido | Estado |
|---|---|---|
| 1 (#11) | Maquetas en `docs/maquetas/`; nombre **McStock**; barra inferior (Inicio · Clientes · **Vender** · Cobrar · Más) y barra lateral en PC; pantalla Más; nuevo Inicio; `/buscar`; `dominio/tablero.ts` (mismos totales en Inicio y Resumen); humo compara totales de Inicio/Resumen/Cobros/Ventas/Stock contra la base | ✅ mergeado |
| 2 (#12) | Venta en una sola pantalla (`dominio/carrito.ts`), caja de precio siempre visible, confirmación con ✓ (`componentes/Confirmacion.tsx`) y Deshacer; humo hace una venta por la pantalla y la deshace | ✅ mergeado |
| — (#13) | Documentación del estado del 1.7 | ✅ mergeado |
| 3 (#14) | **Cobro**: `/cobrar` (lista de quién debe con buscador), `/cobrar/[cliente]` (cobro en una pantalla; en PC con la lista a la izquierda), `/cobros/[id]/guardado` (confirmación con Deshacer). Lógica de pantalla en `dominio/cobro.ts`. `/clientes/[id]/cobrar` quedó como redirección. "Cobrar" de la barra y del Inicio lleva a `/cobrar`. Humo: cobro de punta a punta y totales con y sin el cobro | ✅ mergeado |
| 4 (#15) | Resto de pantallas con el estilo de las maquetas **sin agregar ni sacar elementos** (no tienen maqueta): componentes comunes (`Encabezado`, `Boton`/`BotonEnlace` con `estiloBoton`, `Campo`, `Aviso`, `SelectorMes`, `ListaVentas`, etiquetas de visita y cobro) y clases de cada pantalla; animaciones CSS (`boton-toque`, `aviso-aparecer`, `pantalla-entrar`, details); "Toca visitar hoy" → "Le toca hoy"; "1 unidades" → "1 unidad"; humo controla que nada se salga del ancho del celular. Capturas antes → después en `comparaciones/pr4-pantallas/` | ✅ mergeado |
| A (#16) | Venta a cliente nuevo, migración `20261115120000_venta_cliente_nuevo.sql`: `registrar_venta_cliente_nuevo` y `nombre_para_comparar`; pgTAP `07` y tercera parte de `concurrencia.sh` | ✅ mergeado y aplicado a Supabase |
| A2 (#18) | Dirección del cliente, migración `20261116120000_clientes_direccion.sql`: columna `clientes.direccion` (opcional, ≤ 200), `v_clientes` con dirección al final, `registrar_venta_cliente_nuevo` con `p_direccion` | ✅ mergeado y aplicado a Supabase |
| B (#17) | Pantalla: "Crear cliente nuevo" siempre primera opción del buscador de cliente en "Nueva venta"; nombre, teléfono y dirección opcionales; aviso de duplicado con "Usar a X"; "Cliente nuevo" con precios generales sin perder lo cargado; dirección también en "Nuevo cliente", "Editar cliente" y la ficha; `dominio/clienteNuevo.ts`; humo sección 6. Capturas en `comparaciones/venta-cliente-nuevo/` | ✅ mergeado |

### Descartado y postergado (11/11/2026)
- **Sabor opcional en productos: descartado** por los socios. El producto sigue siendo marca + modelo; no hay migración
  ni columna "sabor" en la plantilla CSV del 1.8.
- **Gráfico del mes en Inicio: postergado** hasta trabajar con datos reales (después del 1.10). Qué se habló, en
  `docs/plan.md` 12.5:
  - Se propusieron gráficos de vendido vs. cobrado, compras del mes y una torta "vendido = costo + ganancia" (llegó a
    haber maqueta, revertida en la rama `claude/dreamy-thompson-vvav70`). Los socios los descartaron: "se van por las
    ramas". **Las compras quedan como están; no profundizar resúmenes de compras.**
  - Lo que de verdad quieren saber: ellos apartan **la mitad** de lo que entra para reponer y sospechan que el costo
    real es más. El gráfico tiene que mostrar el **margen real** contra esa regla ("de cada $100, $63 es costo: faltan
    $13 para reponer"). Preguntas abiertas en el plan 12.5.
  - Si se retoma, decisiones técnicas ya pensadas: SVG propio dibujado en el servidor (sin librería, sin JS en el
    celular), números siempre escritos, animación CSS con "reducir movimiento", mismos datos de
    `v_ganancia_diaria`/`armarTablero` y marcas `data-dato` para la prueba de humo. Colores validados para daltonismo
    y contraste: ganancia `#13866d` (claro) / `#2f9e85` (oscuro), costo `#5d6ed8` / `#8b84ec`.

### Pendientes (en este orden)
**(a) "Repetir última venta" en la ficha del cliente** (era el PR 5 del plan). **Maqueta aprobada el 17/11/2026 y PR
abierto** (rama `claude/dreamy-thompson-vvav70`). Decisiones de los socios: el precio propuesto sigue la regla de siempre
(especial → último que pagó → general) y, si no coincide con el de la última venta, se muestra "La última vez: $ X"; la
tarjeta "Última venta" aparece en toda venta (ellos siempre miran la venta anterior para decidir el precio). Técnico:
`armarRepeticion`, `juntarRenglones`, `ultimoPrecioDistinto` en `dominio/carrito.ts` (Vitest + fast-check),
`ultimaVentaDeCliente` en `datos/ventas.ts` (última venta no anulada por fecha y secuencia), acción `leerUltimaVenta`
(se llama al elegir otro cliente en la pantalla), `componentes/UltimaVenta.tsx`; humo sección 7. Sin migraciones.
- Arma una venta nueva con los mismos productos y cantidades de la última venta no anulada, **con los precios de hoy**
  (la regla de siempre: especial → último que pagó → general), **todo editable** antes de guardar, y **aviso si falta
  stock** de algún producto (sin pasar del stock disponible). Se guarda por la pantalla de venta normal.

**(b) Cierre del módulo 1.7 con la prueba del papá** cuando vuelva de viaje: recorrido de venta, cobro y cliente nuevo
desde su celular. Recién ahí se da el 1.7 por terminado.

### Después del 1.7
1.8 Importación CSV → 1.9 Backups y restauración → 1.10 Pasaje a producción → gráfico del margen real (plan 12.5).

### Decisiones tomadas (socios, 10 y 11/11/2026)
- La app se llama **McStock**.
- "Deshacer (anular)" en la confirmación: **solo justo después de guardar** (implementado: 10 minutos) y pidiendo motivo.
  Igual en la venta y en el cobro.
- **Caja de precio en la venta**: siempre visible en cada producto agregado (como antes del 1.7), con el precio
  sugerido (especial → último que pagó → general) y "Propuesto: …" debajo.
- Inicio muestra hasta 5 clientes en "A visitar hoy" y "Quién debe plata", con "Ver los N ›" si hay más.
- **Venta a cliente nuevo** (detalle en `docs/decisiones/modulo-1.7-venta-cliente-nuevo.md`):
  - Se pide nombre (obligatorio), teléfono y dirección (opcionales); visitas y notas se completan desde la ficha.
  - **Nombre duplicado** (sin mayúsculas, tildes ni espacios de más, incluidos los archivados): se avisa con el mismo
    mensaje de "Nuevo cliente" (agregar barrio o apellido) y se ofrece **"Usar a X"**. **No hay "Crear igual".** Si el
    existente está archivado, se ofrece ir a su ficha (a un archivado no se le puede vender).
  - **"Crear cliente nuevo" es siempre la primera opción** de la lista, sin tener que escribir (pedido del 11/11).
  - **Dirección como campo propio** (`clientes.direccion`), no dentro de Notas (elegido el 11/11).
  - Se hizo en dos PR (migración primero, pantalla después) para poder probar todo en el deploy preview.

### Decisiones técnicas
- **`registrar_venta_cliente_nuevo`** (migraciones `20261115120000` y `20261116120000`):
  - **Qué hace:** en **una sola transacción**, crea el cliente (nombre limpio, teléfono y dirección opcionales,
    valores por defecto) y llama a la **misma `registrar_venta` de siempre** (FIFO, costos y stock sin cambios).
  - **Por qué hizo falta una migración:** los clientes **no se pueden borrar** (trigger `impedir_borrado`) y la app
    llama a la base de a una operación por vez; crear el cliente antes, o en dos pasos al guardar, podía dejar
    clientes huérfanos si la venta fallaba o se cancelaba.
  - **Sin huérfanos:** si la venta falla (sin stock, precio inválido…), la transacción entera se deshace y el cliente
    tampoco queda. La pantalla no guarda nada hasta "Guardar venta".
  - **Doble toque:** cliente y venta llevan UUID generados en el celular. Un reintento devuelve la misma venta
    (`registrar_venta` es idempotente); dos llamadas simultáneas: la segunda espera a la primera
    (`insert … on conflict (id) do nothing`) y recibe la misma venta. Probado con dos conexiones reales.
  - **Duplicados:** compara con `nombre_para_comparar` (igual que `normalizar()` de `src/lib/texto.ts`); devuelve
    `23505` con `hint = cliente_duplicado` y el id del existente en `detail`, para que la pantalla ofrezca "Usar a X"
    también si otro socio creó el nombre mientras se cargaba la venta.
  - **Permisos:** `SECURITY INVOKER` (sin privilegios elevados): el alta pasa por la RLS "socios crean clientes", los
    permisos por columna y `completar_alta` (`es_prueba` según el modo del negocio, `registrado_por` del socio).
    `revoke` a `public`/`anon`. Hay pruebas de otro negocio, modo real y anónimo.
- La versión de `registrar_venta_cliente_nuevo` sin dirección se reemplazó (drop + create) porque ninguna pantalla la
  usaba todavía. **Desde ahora la usa la app: cualquier cambio de firma tiene que ser compatible** (agregar parámetros
  con valor por defecto al final, o una función nueva).
- Colores de la maqueta como tokens en `globals.css` (claro y oscuro, sin selector de tema). Íconos propios en
  `componentes/Iconos.tsx`. Piezas comunes en `componentes/UI.tsx` (Tarjeta, Chip, AvisoInfo, Avatar). Botones con
  `estiloBoton()` de `componentes/Boton.tsx`.
- `componentes/menu.ts` tiene la estructura de navegación (sirve al servidor y al cliente: **no** importar datos desde
  un archivo `"use client"` en una página de servidor, falla con 500). `esPantallaCompleta` oculta la barra inferior
  en venta, cobro y sus confirmaciones.
- Interlineado de las pantallas nuevas: `leading-[1.2]`; las pantallas adaptadas en el PR 4 usan `leading-[1.25]`.
- Animaciones solo CSS en `globals.css` (`confirmacion-check`, `confirmacion-texto`, `boton-toque`, `aviso-aparecer`,
  `pantalla-entrar`, details) y bloque global de `prefers-reduced-motion`.
- Las pantallas marcan sus totales con `data-dato` / `data-centavos`; la prueba de humo los compara contra la base.
  Al agregar una pantalla que muestre esos totales (por ejemplo los gráficos del Inicio), marcarlos igual. Otras marcas
  para la prueba de humo: `data-queda` (cobro), `data-saldo-cliente` (confirmación de cobro), `data-falta-cobrar` (Ventas).
- "Deuda más vieja" de Inicio y de `/cobrar`: `deudasMasViejas` en `datos/cuentas.ts` (lee sin paginar, mismo riesgo de
  1000 filas anotado en la sección 3).
- "Nueva venta" ya no exige tener clientes cargados (solo productos con stock).

### Diferencias con la maqueta que quedaron (aceptadas o pendientes)
- Franja MODO PRUEBA arriba (intencional, se va en el 1.10).
- "Ver los N ›" en listas largas del Inicio (no está en la maqueta). Capital en mercadería del Inicio es tocable
  (lleva a Stock). Cerrar sesión muestra el email completo.
- Inicio en PC, "Quién debe plata": las filas llevan a la cuenta del cliente y "Ver todos" a `/cobros` (historial), no
  a `/cobrar`. Quedó así; cambiarlo si los socios lo piden.
- Venta: productos en orden alfabético fijo (en la maqueta los agregados iban arriba; se dejó fijo para que la lista no
  salte bajo el dedo). Caja de precio (pedido de los socios). Confirmación de venta con "Ahora debe $ X". Buscador de
  cliente cuando la venta no viene con cliente.
- Venta a cliente nuevo (no estaba en la maqueta): opción "Crear cliente nuevo" con círculo punteado como primera fila,
  tarjeta "Cliente nuevo" en el lugar del buscador, aviso amarillo de duplicado con "Usar a X", y "Cliente nuevo ·
  teléfono · dirección" en lugar de "Debe $ X".
- Cobro: botones rápidos fijos $ 20.000 y $ 50.000 (solo los menores a la deuda; "Todo" si debe); si el socio nunca
  cobró, no se preselecciona medio; con monto mayor a la deuda aparece el aviso de saldo a favor; en PC, `/cobrar` sin
  cliente muestra un texto a la derecha; "Listo" vuelve al Inicio (o a la venta si el cobro se hizo desde una venta).
  **Preguntas abiertas a los socios:** si les sirven esos montos rápidos y si está bien elegir el medio a mano cuando
  el socio nunca cobró.
- Confirmaciones (venta y cobro) centradas en la pantalla; en la maqueta, un poco más arriba. El monto del cobro no
  muestra el cursor fijo de la maqueta (es una caja de texto real).
- Pantallas del PR 4 (sin maqueta): ventas de la ficha y de Ventas en una sola tarjeta con separadores; etiquetas
  Atrasado / Le toca hoy / Debe / Pagada con colores suaves; en PC siguen en una columna centrada y conservan
  "‹ Volver" aunque está la barra lateral.
