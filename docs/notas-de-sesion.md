# Notas para retomar el trabajo

> Para leer al empezar una sesión nueva, junto con `CLAUDE.md` (reglas), `docs/plan.md` (plan y estado,
> sección 12) y `docs/decisiones/modulo-*.md` (decisiones de cada módulo).
> Última actualización: 10/11/2026, con los PR 1 y 2 del módulo 1.7 mergeados (sigue el PR 3: cobro).

## 1. Dónde estamos

- Terminados y mergeados en `main`: módulos 1.0 a 1.6 (PR #1 a #10 de `benjamingarma/Gestor`).
- **En curso: 1.7 Simplificación del diseño** — PR 1 y 2 mergeados (#11, #12); **sigue el PR 3 (cobro)**, que
  todavía no se empezó: esperar el OK de los socios. Estado detallado en la sección 6. Maquetas aprobadas en
  `docs/maquetas/` (leer su README antes de tocar pantallas). Después: 1.8 Importación CSV, 1.9 Backups y restauración, 1.10 Pasaje a producción.
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
| 1.6 | Rotura/regalo/pérdida desde la ficha, resumen descuenta, anulación (aprobado 10/11) | 307 pgTAP, 176 Vitest, concurrencia venta contra ajuste, humo (21 pantallas) |
| 1.7 PR 1 | Navegación, Más, nuevo Inicio (aprobado 10/11) | 307 pgTAP, 192 Vitest, humo (23 pantallas + 15 totales contra la base) |
| 1.7 PR 2 | Venta en una pantalla, caja de precio, confirmación y deshacer (aprobado 10/11) | 307 pgTAP, 200 Vitest, humo (25 pantallas + venta de punta a punta) |

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
- Comandos: `npm run verificar` (lint + tipos + Vitest), `npx supabase test db` (pgTAP),
  `bash supabase/tests/concurrencia.sh`, `npm run humo` (con la app corriendo y `API_URL`/`SECRET_KEY` en el entorno).

## 5. Pendientes e ideas que quedaron anotadas (no pedidas todavía)
- Avisos de GitHub Actions: `actions/checkout@v4` y `actions/setup-node@v4` usan Node 20 (obsoleto; hoy solo avisa).
- Supabase CLI 3.0.0 → hay 3.1.0 (aviso en el CI).
- Historial de ventas "ver más" sin filtro de mes (hoy: por mes, o las últimas 5 en la ficha del cliente).
- Costo de reposición frente a la suba del dólar (plan T4): no se muestra; solo el capital en USD.
- Etapa 2: historial de visitas y recordatorios, devoluciones y reposiciones de fallados, retiros por socio.
- Si alguna vez hay más de un negocio o más de dos socios, revisar pantallas que asumen dos (el reparto ya soporta N).

## 6. Módulo 1.7 — Simplificación del diseño (estado al 10/11/2026)

Especificación visual: `docs/maquetas/` (README, HTML, imágenes en claro/oscuro, celular/PC). Plan de PRs en
`docs/plan.md` 12.3. **Sin migraciones ni cambios en la lógica de dinero en todo el módulo.**

### Forma de trabajo pedida por los socios (vale para cada PR que falta)
1. Respetar la maqueta: jerarquía, textos, orden, espacios, navegación y los dos temas. **No agregar ni sacar
   elementos sin avisar.**
2. Antes de pedir que prueben: capturas reales (celular y PC, claro y oscuro) al lado de la maqueta, guardarlas en
   `docs/maquetas/comparaciones/`, y listar cada diferencia con su motivo en el PR.
3. CI en verde **en GitHub** y revisar en el log que las pruebas corrieron (cantidad de Vitest y pgTAP, líneas OK de la
   prueba de humo). Prueba de humo actualizada con las rutas nuevas.
4. Los socios prueban en el deploy preview y mergean ellos. No mergear nunca. Después del merge, confirmar el CI de `main`.
5. Mantener siempre separados ganancia, cobrado y plata disponible, con sus avisos ("La ganancia no es plata
   disponible", saldo a favor, origen del precio).

### PRs
| # | Contenido | Estado |
|---|---|---|
| 1 (#11) | Maquetas en `docs/maquetas/`; nombre **McStock**; barra inferior (Inicio · Clientes · **Vender** · Cobrar · Más) y barra lateral en PC; pantalla Más; nuevo Inicio; `/buscar`; `dominio/tablero.ts` (mismos totales en Inicio y Resumen); humo compara totales de Inicio/Resumen/Cobros/Ventas/Stock contra la base | ✅ mergeado |
| 2 (#12) | Venta en una sola pantalla (`dominio/carrito.ts`), caja de precio siempre visible, confirmación con ✓ (`componentes/Confirmacion.tsx`) y Deshacer; humo hace una venta por la pantalla y la deshace | ✅ mergeado |
| 3 | **Cobro**: `/cobrar` (lista de quién debe con buscador) + cobro en una pantalla (monto grande con "Todo", medio y quién recibe preseleccionados con el último cobro de ese socio, "Le queda debiendo" en vivo, aviso de saldo a favor) + confirmación con Deshacer. Cambiar "Cobrar" de la barra y del Inicio de `/cobros` a `/cobrar` (`componentes/menu.ts`) | ⏭ siguiente, sin empezar |
| 4 | Resto de pantallas adaptadas al estilo (clientes, ficha, productos, compras, ventas, cobros, resumen, ajustes, reparto), animaciones sutiles y humo con rutas nuevas | pendiente |
| 5 | "Repetir última venta" en la ficha del cliente (PR aparte, al final) | pendiente |

### Decisiones tomadas (socios, 10/11/2026)
- La app se llama **McStock**.
- "Deshacer (anular)" en la confirmación: **solo justo después de guardar** (implementado: 10 minutos) y pidiendo motivo.
- "Repetir última venta": sí, en un PR aparte al final.
- **Caja de precio en la venta**: siempre visible en cada producto agregado (como antes del 1.7), con el precio
  sugerido (especial → último que pagó → general) y "Propuesto: …" debajo. Confirmado que quede así.
- Inicio muestra hasta 5 clientes en "A visitar hoy" y "Quién debe plata", con "Ver los N ›" si hay más.

### Decisiones técnicas
- Colores de la maqueta como tokens en `globals.css` (claro y oscuro, sin selector de tema). Íconos propios en
  `componentes/Iconos.tsx`. Piezas comunes en `componentes/UI.tsx` (Tarjeta, Chip, AvisoInfo, Avatar).
- `componentes/menu.ts` tiene la estructura de navegación (sirve al servidor y al cliente: **no** importar datos desde
  un archivo `"use client"` en una página de servidor, falla con 500). `esPantallaCompleta` oculta la barra inferior
  en venta, confirmación y cobro.
- Interlineado de las pantallas nuevas: `leading-[1.2]` (Tailwind trae 1.5 y se veía más alto que la maqueta).
- Animaciones solo CSS en `globals.css` (`confirmacion-check`, `confirmacion-texto`) y bloque global de
  `prefers-reduced-motion`.
- Las pantallas marcan sus totales con `data-dato` / `data-centavos`; la prueba de humo los compara contra la base.
  Al agregar una pantalla que muestre esos totales, marcarlos igual.
- "Deuda más vieja" de Inicio: `deudasMasViejas` en `datos/cuentas.ts` (usa la cuenta corriente existente; lee sin
  paginar, mismo riesgo de 1000 filas anotado en la sección 3).

### Diferencias con la maqueta que quedaron (aceptadas o pendientes)
- Franja MODO PRUEBA arriba (intencional, se va en el 1.10).
- "Cobrar" (barra, botón de Nos deben) lleva a la lista vieja `/cobros` hasta el PR 3.
- Pantallas viejas con navegación nueva pero diseño viejo hasta el PR 4; en Clientes sigue "Toca visitar hoy" (Inicio
  dice "Le toca hoy").
- "Ver los N ›" en listas largas del Inicio (no está en la maqueta).
- Capital en mercadería del Inicio es tocable (lleva a Stock). Cerrar sesión muestra el email completo.
- Venta: productos en orden alfabético fijo (en la maqueta los agregados iban arriba; se dejó fijo para que la lista
  no salte bajo el dedo; si los socios lo piden, cambiarlo). Caja de precio (pedido de los socios). Confirmación de
  venta con "Ahora debe $ X". Buscador de cliente cuando la venta no viene con cliente.
