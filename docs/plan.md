# Plan del sistema de gestión — Versión 1

> Estado: **borrador para aprobar**. No se programa ninguna funcionalidad hasta que
> los socios aprueben este plan y respondan las preguntas de la sección 7.

---

## 1. Análisis de requisitos

### 1.1 Contexto
- Negocio de venta de vapers de dos socios (padre e hijo) en Tucumán.
- Hoy se lleva en papel. La app lo reemplaza y se usa casi siempre desde el celular,
  muchas veces en la calle, en la casa del cliente.
- Volumen esperado chico: decenas o pocos cientos de clientes, decenas de productos,
  algunas ventas por día. Esto permite priorizar simplicidad sobre optimización.

### 1.2 Usuarios
- Dos usuarios (los socios), cada uno con su propio login por email.
- Comparten **un único espacio de datos**: lo que carga uno lo ve el otro al instante.
- No hay roles distintos en la v1: los dos pueden hacer todo.
- Nadie más puede registrarse ni ver datos.

### 1.3 Requisitos funcionales (v1)

| # | Módulo | Qué tiene que hacer |
|---|--------|---------------------|
| 1 | Clientes | Alta/edición con nombre, teléfono, notas e intervalo de visita (días, por defecto 14). Búsqueda rápida. Próxima visita = última compra o visita + intervalo. Lista de atrasados. |
| 2 | Stock | Cada compra a proveedor es un **lote**: producto/sabor, cantidad, costo por unidad, fecha. Stock disponible = suma de movimientos (entradas, salidas por venta, ajustes). |
| 3 | Ventas | Cliente, lote, cantidad, precio de venta por unidad (puede variar por cliente). Se guarda copia histórica del precio y del costo. Pocos toques. |
| 4 | Cuentas corrientes | Pagos parciales. Por cliente: total vendido, total cobrado, saldo pendiente y ganancia. |
| 5 | Ganancia neta | Total y repartida entre socios con porcentaje configurable (50/50 por defecto). Mostrar ganancia total y ganancia ya cobrada. |
| 6 | Resumen | Ganancia, cuánto nos deben, a quién hay que visitar, quién debe plata. |

### 1.4 Requisitos no funcionales
- **Mobile-first**: botones grandes, formularios cortos, una mano. Registrar una venta en
  pocos toques (objetivo: ≤ 5 toques para una venta típica a un cliente frecuente).
- **Online**, pero preparado para offline en el futuro:
  - IDs de ventas (y pagos y movimientos) como UUID generados en el celular.
  - Stock como movimientos, nunca como un número que se sobrescribe.
  - Operaciones de escritura **idempotentes** (si se reenvía la misma venta con el mismo UUID
    no se duplica).
- **Seguridad**: Row Level Security en todas las tablas, con pruebas automáticas de las políticas.
- **Pruebas automáticas obligatorias** para toda la lógica de dinero y de stock.
- **Sin credenciales en el código**: todo por variables de entorno.
- **Hosting en Netlify** (plan gratis permite uso comercial).
- Moneda ARS, formato `$ 12.345,50`, fechas `dd/mm/aaaa`, zona horaria Tucumán.

### 1.5 Fuera de alcance (v1)
Proveedores, gastos, finanzas avanzadas, dashboard complejo, modo offline, reportes
exportables, múltiples negocios, roles/permisos diferenciados.

### 1.6 Definiciones (para hablar todos de lo mismo)
- **Ventas (facturado)**: suma de `cantidad × precio de venta` de las ventas no anuladas.
- **Costo de lo vendido**: suma de `cantidad × costo unitario histórico` de esas ventas.
- **Ganancia (devengada)**: ventas − costo de lo vendido. Existe desde el momento de la venta,
  se haya cobrado o no.
- **Cobrado**: suma de pagos recibidos no anulados.
- **Saldo pendiente (deuda)**: ventas − cobrado, por cliente. Negativo = saldo a favor del cliente.
- **Ganancia cobrada (realizada)**: la parte de la ganancia que ya entró en efectivo
  (ver decisión D2).

---

## 2. Decisiones de negocio que hay que definir

Para cada una propongo una opción, pero **la decisión es de ustedes**.

### D1. ¿Qué costo se usa cuando hay dos compras del mismo producto a precios distintos?
Ejemplo: compraron 10 "Sabor Uva" a $5.000 y después 10 a $6.000. Venden 1.

| Opción | Cómo funciona | Pro | Contra |
|---|---|---|---|
| **A. Lote elegido (identificación específica)** | La venta dice de qué lote sale; se usa el costo de ese lote. | Exacto, es lo que pidieron ("lote de stock"). | Elegir lote en cada venta suma un toque. |
| **B. FIFO automático** | Sale del lote más viejo con stock. | Cero toques extra; costo realista. | Si en la práctica agarran del lote nuevo, el costo no coincide con la realidad física (solo afecta el número, no el dinero). |
| **C. Costo promedio ponderado** | Costo = promedio de lo que hay en stock. | Suaviza diferencias. | Más difícil de explicar y de auditar a mano. |

**Propuesta: A + B combinadas.** La venta siempre queda asociada a un lote (A), pero la app
**preselecciona el lote más viejo con stock** (FIFO) y solo hace falta tocarlo si quieren otro.
Si una venta pide más unidades de las que quedan en ese lote, se parte automáticamente en
dos renglones (uno por lote), cada uno con su costo.

### D2. ¿Cuándo se considera realizada la ganancia?
- **Devengada**: al momento de la venta (aunque no se haya cobrado).
- **Percibida / cobrada**: cuando entra la plata.

El pedido es mostrar las dos ("ganancia total y la ya cobrada"). Lo que hay que definir es
**cómo se calcula la parte cobrada cuando un pago es parcial**. Opciones:

| Opción | Ejemplo: venta $10.000, costo $6.000 (ganancia $4.000). Paga $5.000. |
|---|---|
| **A. Proporcional** | Cobró el 50% → ganancia cobrada $2.000. |
| **B. Primero recupera el costo** | Los $5.000 cubren costo → ganancia cobrada $0. Recién con los siguientes $1.000 empieza a haber ganancia. |
| **C. Primero la ganancia** | Ganancia cobrada $4.000 (poco prudente). |

**Propuesta: A (proporcional)**. Es simple, justa y fácil de explicar.

### D3. ¿A qué venta se aplica un pago?
La cuenta corriente es por cliente. Un pago puede no corresponder a una venta puntual.
**Propuesta:** el pago se registra contra el **cliente** (no contra una venta) y, para calcular
la ganancia cobrada, se imputa automáticamente a las **ventas más antiguas primero** (FIFO).
Opcionalmente se puede indicar "este pago es de tal venta" si lo necesitan.

### D4. Reparto entre socios
- ¿El reparto se aplica sobre la ganancia devengada, la cobrada, o las dos? (Propuesta: se
  muestran las dos repartidas.)
- ¿El porcentaje es uno solo para todo el historial, o puede cambiar en el tiempo y cada
  período usa el suyo? (Propuesta: guardar el porcentaje con fecha de vigencia; cada venta
  usa el porcentaje vigente en su fecha. Así cambiarlo no reescribe el pasado.)
- ¿Los socios ponen capital distinto para comprar mercadería? ¿Se registran retiros de
  plata? (Propuesta v1: **no**; solo se calcula cuánto le corresponde a cada uno.)

### D5. Ajustes de stock (pérdidas, roturas, regalos, consumo propio)
- ¿Un ajuste negativo (se rompió, se perdió, se regaló) **resta de la ganancia** el costo de
  esas unidades? (Propuesta: sí, como "pérdida de stock", mostrada aparte.)
- ¿Un regalo a un cliente es una venta a precio $0 (queda en su historial) o un ajuste?

### D6. Anulaciones, devoluciones y errores
- Propuesta: ventas y pagos **no se editan ni se borran**; se **anulan** (queda registro de
  quién y cuándo) y el stock vuelve con un movimiento inverso.
- ¿Existen devoluciones de producto (cliente devuelve un vaper)? ¿Vuelve al stock?
- ¿Cuánto tiempo hacia atrás se puede anular? (Propuesta: siempre, con confirmación.)

### D7. Venta con varios productos
Un cliente puede llevar 3 sabores distintos en la misma visita.
**Propuesta:** una venta tiene **varios renglones** (producto/lote, cantidad, precio). Así es una
sola operación por visita y una sola fecha.

### D8. Precio por cliente
- ¿Hay un precio de lista general y algunos clientes tienen precio especial?
- **Propuesta:** la app recuerda el **último precio** que pagó ese cliente por ese producto y
  lo propone; si no hay, propone un precio de lista del producto. Siempre editable.

### D9. Pagos
- ¿Medios de pago a distinguir (efectivo, transferencia, Mercado Pago)? (Propuesta: campo
  opcional "medio".)
- ¿Puede un cliente pagar de más y quedar con saldo a favor? (Propuesta: sí, se permite y se
  muestra.)
- ¿Se cobra en el mismo momento de la venta muchas veces? (Propuesta: en la pantalla de venta,
  botón "Pagó todo" / "Pagó $___" para no tener que ir a otra pantalla.)

### D10. Visitas y recordatorios
- ¿Una visita sin compra reinicia el contador? (El pedido dice "última compra o visita": sí.)
- ¿Cuándo se considera "atrasado"? (Propuesta: hoy > próxima visita. Mostrar también
  "para hoy" y "próximos 3 días".)
- ¿Clientes inactivos/archivados que no aparezcan en los recordatorios?

### D11. Stock negativo
Online no debería pasar, pero en el futuro offline sí (dos socios venden la última unidad a la vez).
**Propuesta:** la app **no deja** vender más de lo disponible estando online, y el modelo de datos
**tolera** stock negativo (se muestra como alerta) para no romper el futuro modo offline.

### D12. Productos
- ¿Cómo se identifican? ¿Marca + modelo + sabor? ¿Puffs? (Propuesta: `nombre` libre +
  `sabor`, más un campo opcional `marca`.)
- ¿Hay productos que no son vapers (repuestos, líquidos, cargadores)? No cambia el modelo.

---

## 3. Modelo de datos propuesto

### 3.1 Principios
1. **Hechos inmutables**: ventas, pagos y movimientos se insertan; no se modifican. Las
   correcciones se hacen con anulaciones/movimientos compensatorios.
2. **Dinero en centavos (`bigint`)**: evita errores de redondeo de los decimales.
   Ej.: $12.345,50 se guarda como `1234550`.
3. **UUID generados en el cliente** para ventas, renglones, pagos, movimientos y visitas.
4. **Copias históricas**: cada renglón de venta guarda `precio_unitario` y `costo_unitario`.
5. **Todo cuelga de un `negocio_id`**: aunque hoy hay un solo negocio, hace muy simple y segura la
   regla de RLS ("solo ves filas de negocios de los que sos miembro").
6. Columnas de auditoría en todas las tablas: `creado_por` (usuario), `creado_en`.

### 3.2 Tablas

```
negocios
  id               uuid PK
  nombre           text
  creado_en        timestamptz

miembros                       -- quién puede ver/usar cada negocio
  negocio_id       uuid FK negocios
  user_id          uuid FK auth.users
  nombre_socio     text        -- "Papá", "Benjamín"
  PK (negocio_id, user_id)

reparto_socios                 -- porcentaje con vigencia (D4)
  id               uuid PK
  negocio_id       uuid FK
  user_id          uuid FK
  porcentaje       numeric(5,2)   -- 50.00
  vigente_desde    date
  -- regla: para cada fecha, la suma de porcentajes = 100

clientes
  id                     uuid PK
  negocio_id             uuid FK
  nombre                 text NOT NULL
  telefono               text
  notas                  text
  intervalo_visita_dias  int NOT NULL DEFAULT 14  CHECK (> 0)
  activo                 boolean DEFAULT true
  creado_por, creado_en

visitas                        -- visita sin compra (la compra ya cuenta como visita)
  id               uuid PK (cliente)
  negocio_id, cliente_id
  fecha            timestamptz
  nota             text
  creado_por, creado_en

productos
  id               uuid PK
  negocio_id       uuid FK
  nombre           text NOT NULL     -- "Elfbar 5000"
  sabor            text              -- "Uva"
  precio_lista     bigint            -- centavos, opcional (D8)
  activo           boolean

lotes                          -- cada compra de mercadería
  id               uuid PK
  negocio_id, producto_id
  fecha_compra     date
  cantidad_inicial int  CHECK (> 0)
  costo_unitario   bigint  CHECK (>= 0)   -- centavos
  nota             text
  creado_por, creado_en

movimientos_stock              -- la ÚNICA fuente de verdad del stock
  id               uuid PK (cliente)
  negocio_id, lote_id
  tipo             text  CHECK IN ('compra','venta','anulacion_venta','ajuste')
  cantidad         int   CHECK (<> 0)   -- + entra, − sale
  venta_item_id    uuid NULL FK          -- si viene de una venta
  motivo           text                  -- para ajustes
  fecha            timestamptz
  creado_por, creado_en

ventas
  id               uuid PK (generado en el celular)
  negocio_id, cliente_id
  fecha            timestamptz
  nota             text
  anulada_en       timestamptz NULL
  anulada_por      uuid NULL
  motivo_anulacion text
  creado_por, creado_en

venta_items
  id               uuid PK (cliente)
  venta_id         uuid FK
  negocio_id
  lote_id          uuid FK
  cantidad         int    CHECK (> 0)
  precio_unitario  bigint CHECK (>= 0)  -- copia histórica
  costo_unitario   bigint CHECK (>= 0)  -- copia histórica, la pone el servidor desde el lote

pagos
  id               uuid PK (cliente)
  negocio_id, cliente_id
  fecha            timestamptz
  monto            bigint CHECK (> 0)
  medio            text NULL
  venta_id         uuid NULL           -- opcional (D3)
  nota             text
  anulado_en, anulado_por, motivo_anulacion
  creado_por, creado_en
```

### 3.3 Datos calculados (no se guardan, se derivan)
- **Stock por lote** = `SUM(movimientos_stock.cantidad) GROUP BY lote_id` (vista SQL `v_stock_lotes`).
- **Stock por producto** = suma de sus lotes.
- **Por cliente**: total vendido, costo, ganancia, cobrado, saldo, última compra, última visita,
  próxima visita, días de atraso.
- **Globales**: ganancia devengada, ganancia cobrada, reparto por socio, total adeudado.

### 3.4 Operaciones atómicas en la base
Registrar una venta toca 3 tablas (`ventas`, `venta_items`, `movimientos_stock`). Para que nunca
quede a medias se hace con **una función de Postgres** (`registrar_venta`) llamada por RPC, que:
1. Recibe el UUID de la venta generado en el celular.
2. Si ya existe esa venta, no hace nada y devuelve OK (**idempotencia**, clave para el offline futuro).
3. Copia el `costo_unitario` del lote (no se confía en el valor que manda el celular).
4. Verifica que haya stock suficiente (D11).
5. Inserta venta, renglones y movimientos en una transacción.

Lo mismo para `anular_venta`, `registrar_pago`, `anular_pago`, `registrar_lote` (lote + movimiento
de entrada) y `ajustar_stock`.

---

## 4. Arquitectura

### 4.1 Vista general
```
Celular (navegador)
   │  Next.js (App Router) + TypeScript — UI mobile-first
   │  Lógica de dinero en módulo puro TypeScript: src/dominio/
   ▼
Netlify (hosting de Next.js, funciones serverless)
   │  @supabase/ssr: sesión por cookie, consultas con el usuario logueado
   ▼
Supabase
   ├─ Auth (email; registro público desactivado, solo los 2 socios)
   ├─ PostgreSQL con RLS en todas las tablas
   ├─ Funciones SQL (RPC) para operaciones atómicas
   └─ Vistas para stock y saldos
```

### 4.2 Decisiones técnicas y por qué

| Decisión | Por qué | Alternativa descartada |
|---|---|---|
| **Next.js App Router + Server Components** | Las pantallas de lectura se arman en el servidor (rápido en celulares de gama media). | SPA pura: más JS en el celular. |
| **Supabase client con la sesión del usuario (nunca la `service_role` en la app)** | La RLS protege de verdad: aunque haya un bug en la app, la base no deja ver/escribir datos ajenos. | Usar `service_role` en el servidor: saltea RLS. |
| **Lógica de dinero en TypeScript puro (`src/dominio/`)** | Funciones sin base de datos ni UI → fáciles de probar con muchas pruebas rápidas, y reutilizables cuando haya modo offline. | Todo en SQL: más difícil de probar y de reutilizar offline. |
| **Integridad en la base (CHECKs, FKs, funciones RPC)** | La base no acepta datos inválidos aunque la app falle. | Validar solo en la app. |
| **Centavos como enteros** | Sin errores de redondeo. Se formatea a `$` solo al mostrar. | `numeric`/`float` en JS. |
| **Vitest** para lógica de dinero | Rápido, nativo TypeScript. | Jest: más configuración. |
| **pgTAP con Supabase CLI** (`supabase test db`) para RLS y funciones SQL | Prueba las políticas en una base real local, con usuarios simulados. | Probar RLS a mano. |
| **Migraciones SQL versionadas** (`supabase/migrations/`) | El esquema está en el repo y se aplica igual en prueba y en producción. | Crear tablas a mano en el panel. |
| **Tailwind CSS** | Rápido para hacer UI mobile con botones grandes, sin librería pesada. | Librerías de componentes completas. |
| **Zod** para validar formularios/entradas | Mismos esquemas en cliente y servidor. | Validación manual. |
| **GitHub Actions** | Corre lint, tipos, Vitest y pgTAP en cada PR; no se mergea en rojo. | Probar solo local. |

### 4.3 Seguridad (RLS)
- RLS activada en **todas** las tablas, sin excepción.
- Función auxiliar `es_miembro(negocio_id)` (`security definer`, `stable`) que consulta `miembros`.
- Políticas:
  - `SELECT` / `INSERT`: solo si `es_miembro(negocio_id)`.
  - `UPDATE`: solo donde tiene sentido (clientes, productos, campos de anulación vía función).
  - `DELETE`: **no permitido** en ventas, renglones, pagos y movimientos (inmutables).
  - `miembros` y `negocios`: solo lectura para la app; se administran con SQL/migración.
- Registro público desactivado en Supabase Auth; los dos socios se dan de alta por invitación.
- **Pruebas de RLS** (pgTAP): un usuario miembro ve y escribe; un usuario autenticado no miembro
  no ve nada y no puede insertar; un anónimo no ve nada; nadie puede borrar ventas/pagos/movimientos;
  no se puede insertar con `negocio_id` ajeno.

### 4.4 Variables de entorno
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```
La `anon key` es pública por diseño (la seguridad la da la RLS). La `service_role key` **no** se usa
en la app; solo, si hace falta, en scripts locales de siembra de datos de prueba, desde `.env.local`.
Se configuran en `.env.local` (ignorado por git) y en el panel de Netlify. En el repo va solo
`.env.example`.

### 4.5 Entornos
- **Local**: Supabase CLI con Docker (base local para pruebas pgTAP) + datos inventados (`seed.sql`).
- **Prueba**: proyecto Supabase de prueba, datos inventados, deploy preview de Netlify por PR.
- **Producción**: proyecto Supabase separado, se crea recién cuando la v1 esté aprobada.

### 4.6 Estructura de carpetas
```
/src
  /app            páginas (clientes, ventas, stock, cuentas, resumen, login)
  /componentes    UI reutilizable (botones grandes, buscador, teclado de montos)
  /dominio        lógica pura de dinero y stock (+ *.test.ts)
  /datos          acceso a Supabase (consultas y llamadas RPC)
  /lib            formato de moneda/fechas, cliente Supabase
/supabase
  /migrations     esquema, RLS, funciones
  /tests          pruebas pgTAP
  seed.sql        datos inventados
/docs
  plan.md
```

### 4.7 Preparación para offline (sin implementarlo)
- UUID generados en el cliente (`crypto.randomUUID()`).
- Funciones RPC idempotentes (reenviar = no duplicar).
- Stock por movimientos, tolerante a negativos (D11).
- Lógica de cálculo en TypeScript puro, ejecutable sin servidor.
- Fechas de las operaciones tomadas del celular (`fecha`) separadas de `creado_en` (servidor).

---

## 5. Plan de implementación por etapas

Cada etapa: una rama, un PR, pruebas en verde, revisión y aprobación de ustedes antes de seguir.

> Nota de orden: pidieron **clientes y ventas primero**. Una venta necesita saber de qué lote sale
> (para el costo), así que antes de ventas hace falta una carga **mínima** de productos y lotes. El
> resto del módulo de stock (ajustes, historial) queda para después.

### Etapa 0 — Base del proyecto
- Next.js + TypeScript + Tailwind, ESLint, Vitest.
- Supabase CLI, primera migración: `negocios`, `miembros`, `es_miembro()`, RLS.
- Login por email, cierre de sesión, protección de rutas.
- `.env.example`, `.gitignore`, GitHub Actions (lint, tipos, Vitest, pgTAP).
- Deploy en Netlify contra el proyecto Supabase de prueba.
- Utilidades de dinero (centavos ↔ `$ 12.345,50`) y fechas con pruebas.
- **Pruebas**: RLS de `negocios`/`miembros`; formato de moneda.
- **Listo cuando**: los dos socios entran desde el celular a una pantalla vacía y un tercero no puede.

### Etapa 1 — Clientes y visitas
- Alta/edición/archivo de clientes, buscador por nombre/teléfono.
- Registrar visita sin compra.
- Cálculo de próxima visita y atrasados (función pura en `dominio/`).
- Lista "A visitar": atrasados, hoy, próximos días. Botón para llamar/WhatsApp.
- **Pruebas**: cálculo de próxima visita (sin visitas, solo compra, solo visita, ambas, intervalos
  distintos, cambio de día en zona horaria de Tucumán); RLS de `clientes` y `visitas`.

### Etapa 2 — Productos y lotes (mínimo para vender)
- Alta de productos (nombre, sabor, precio de lista opcional).
- Cargar lote (producto, cantidad, costo unitario, fecha) → crea movimiento de entrada.
- Ver stock disponible por producto y por lote.
- **Pruebas**: stock como suma de movimientos; RPC `registrar_lote`; RLS.

### Etapa 3 — Ventas
- Flujo rápido: cliente (buscador / últimos) → producto(s) → cantidad → precio propuesto → confirmar.
- Lote preseleccionado por FIFO (D1), partición automática entre lotes.
- Copia histórica de precio y costo; UUID en el cliente; RPC idempotente.
- Anular venta (stock vuelve).
- Historial de ventas por cliente.
- **Pruebas**: totales y ganancia de una venta; partición FIFO; idempotencia (misma venta dos veces);
  stock insuficiente; anulación (stock y totales vuelven); costo histórico no cambia si cambia el lote;
  RLS y prohibición de borrar.

### Etapa 4 — Pagos y cuentas corrientes
- Registrar pago (también desde la pantalla de venta: "Pagó todo / Pagó $___").
- Anular pago.
- Cuenta corriente del cliente: ventas, pagos, saldo, línea de tiempo.
- Lista "Quién debe plata" ordenada por monto o antigüedad.
- **Pruebas**: saldo con pagos parciales; pago mayor a la deuda (saldo a favor); imputación FIFO de
  pagos a ventas (D3); anulaciones; ventas anuladas no suman deuda; RLS.

### Etapa 5 — Ganancia y reparto entre socios
- Ganancia devengada y cobrada (D2), total y por período (mes actual / anterior / todo).
- Reparto por socio con porcentaje configurable y vigencia (D4).
- Pérdidas por ajustes de stock, si se decide en D5.
- **Pruebas**: ganancia proporcional con pagos parciales; reparto 50/50 y otros porcentajes; cambio de
  porcentaje en el tiempo; redondeo de centavos (que la suma de las partes dé exactamente el total).

### Etapa 6 — Pantalla de resumen
- Tarjetas: ganancia (total / cobrada / por socio), total que nos deben, a quién visitar hoy,
  top deudores. Cada tarjeta lleva a su lista.
- **Pruebas**: el resumen usa las mismas funciones de `dominio/` (sin cálculos duplicados).

### Etapa 7 — Ajustes de stock y pulido
- Ajustes (pérdida, rotura, regalo, conteo físico) con motivo.
- Historial de movimientos por producto.
- Mejoras de usabilidad tras usarla unas semanas.

### Etapa 8 — Pasaje a producción
- Proyecto Supabase de producción, backups, alta de los dos usuarios reales.
- Carga inicial de datos reales (clientes, stock actual y deudas actuales del papel — ver pregunta 13).

---

## 6. Riesgos y cómo se mitigan
- **Errores de cálculo de dinero** → lógica pura con pruebas, centavos enteros, una sola implementación.
- **Fuga de datos** → RLS probada, sin `service_role` en la app, registro público desactivado.
- **Carga lenta en la calle** → server components, páginas livianas, pocas consultas.
- **Doble envío de una venta** (doble toque, mala señal) → UUID del cliente + RPC idempotente.
- **Plan gratuito de Supabase pausa proyectos inactivos** (≈1 semana sin uso) → con uso diario no
  pasa; considerar plan pago o un ping programado en producción.

---

## 7. Preguntas para los socios (antes de seguir)

Ver la lista completa en el mensaje de cierre de esta tarea; se copia acá para que quede registrada.

1. **Costo con lotes a distinto precio (D1)**: ¿están de acuerdo con "lote más viejo preseleccionado,
   se puede cambiar"? ¿O prefieren elegir el lote siempre, o costo promedio?
2. **Ganancia cobrada con pagos parciales (D2)**: ¿proporcional, o primero se recupera el costo?
3. **Imputación de pagos (D3)**: ¿los pagos son "a cuenta" del cliente (se aplican a lo más viejo), o
   necesitan decir a qué venta corresponde cada pago?
4. **Reparto (D4)**: ¿se reparte la ganancia devengada, la cobrada, o mostramos las dos? Si cambian el
   porcentaje, ¿aplica solo de ahí en adelante? ¿Necesitan registrar aportes de capital o retiros de
   cada socio (aunque sea más adelante)?
5. **Pérdidas y regalos (D5)**: ¿un vaper roto/perdido/regalado descuenta su costo de la ganancia? ¿Los
   regalos a clientes se registran como venta a $0?
6. **Anulaciones y devoluciones (D6)**: ¿les sirve "anular" en vez de borrar? ¿Hay devoluciones de
   producto que vuelvan al stock?
7. **Varios productos por venta (D7)**: ¿un cliente suele llevar varios productos distintos en la
   misma visita?
8. **Precios (D8)**: ¿tienen un precio de lista por producto con excepciones por cliente? ¿Les sirve que
   la app proponga el último precio que pagó ese cliente?
9. **Pagos (D9)**: ¿quieren distinguir efectivo / transferencia / Mercado Pago? ¿Pasa que un cliente
   pague de más y quede a favor?
10. **Visitas (D10)**: ¿"atrasado" es a partir del día siguiente a la fecha prevista? ¿Quieren poder
    archivar clientes que ya no compran?
11. **Productos (D12)**: ¿cómo los nombran hoy en el papel? (marca, modelo, puffs, sabor). ¿Venden cosas
    que no son vapers?
12. **Quién vendió**: ¿importa registrar cuál de los dos socios hizo cada venta/cobro (por ejemplo, para
    saber quién tiene la plata en mano)? El sistema guarda quién lo cargó; ¿hace falta mostrarlo?
13. **Datos actuales**: al pasar a producción, ¿hay deudas y stock en el papel que haya que cargar como
    saldo inicial? ¿Aproximadamente cuántos clientes y productos tienen?
14. **Login**: ¿prefieren entrar con email + contraseña, o con un link mágico que llega al email cada
    tanto? (Propuesta: email + contraseña, sesión que dura mucho en el celular.)
15. **Cuentas**: ¿ya tienen cuenta de GitHub, Supabase y Netlify, o las creamos? ¿Quién es el dueño de
    cada una?
