# Plan del sistema de gestión — Versión 3.6

> Estado: **aprobado** por los socios (versión 2) con las correcciones de la versión 3:
> producto sin sabor, costo de compra en dólares (blue) con tipo de cambio por compra,
> backups sobre el plan gratis de Supabase y fast-check para pruebas.
> Versión 3.1: nuevo orden de módulos aprobado (sección 12), migraciones automáticas al
> mergear a `main` (A19) y datos de prueba marcados y borrables (A20).
> Versión 3.2 (13/11/2026): estado real de avance (módulos 1.0 a 1.5 terminados) y módulo nuevo
> **1.7 Simplificación del diseño**, entre los ajustes de stock y la importación CSV. Por eso la
> importación pasa a ser el 1.8, los backups el 1.9 y el pasaje a producción el 1.10.
> Versión 3.3 (11/11/2026): estado del 1.7 (PR 1 a 4 y venta a cliente nuevo mergeados), pendientes acordados
> del 1.7 y **cambio de decisión: el producto puede tener sabor opcional** (revierte "producto sin sabor",
> decisión 11 y T1; ver 12.3).
> Versión 3.4 (11/11/2026): **el sabor queda descartado** (vuelve a valer "producto sin sabor") y **el gráfico del mes
> en Inicio se posterga** hasta tener datos reales (después del 1.10). Ver 12.3 y 12.5.
> Versión 3.5 (17/11/2026): **el hosting pasa de Netlify a Vercel (plan Hobby)**: Netlify pausó los deploys a
> producción por créditos del plan gratis. Ver 12.4 y `docs/configuracion.md`.
> Versión 3.6 (18/11/2026): **pago en la pantalla de venta**, **ganancia según lo cobrado** (cambia la decisión 2) y
> **lenguaje** ("Deudores", "Registrar pago", "Pagos recibidos"). Ver 12.6, `docs/glosario.md` y
> `docs/decisiones/pago-en-venta-y-ganancia-cobrada.md`.
> Notas para retomar el trabajo en una sesión nueva: `docs/notas-de-sesion.md`.
> Donde las versiones anteriores digan otra cosa, manda esta.

Índice:
1. Objetivo y alcance
2. Decisiones de negocio
3. Ambigüedades técnicas resueltas
4. Modelo de datos y relaciones
5. Reglas de cálculo
6. Ejemplos numéricos
7. Verificación: capital invertido vs. ganancia
8. Contradicciones y tensiones detectadas
9. Arquitectura
10. Backups y continuidad (plan gratis de Supabase)
11. Pruebas
12. Plan de implementación por módulos

---

## 1. Objetivo y alcance

MVP simple, confiable y práctico para el trabajo diario de dos socios. Sin complejidad contable
que no aporte valor real. App web **solo online**, responsive: cómoda en celular y en una
computadora con Windows.

### Etapa 1
Clientes con visitas básicas y atrasados · productos (marca + modelo) y compras en USD con costo
FIFO en pesos · ventas con varios productos · precios generales y especiales · pagos y cuenta
corriente · ganancia con reparto 50/50 configurable · ajustes de stock · anulaciones · medios de
pago · responsables de cada operación · carga inicial por CSV · backups, exportación y prueba de
restauración.

### Etapa 2 (solo se deja el modelo preparado)
Historial de visitas y recordatorios · devoluciones y reposiciones por productos fallados ·
retiros por socio.

### Fuera de alcance
Modo offline y sincronización, mapas, proveedores, gastos, finanzas avanzadas, productos que no
sean vapers (la estructura queda preparada, nada más). Sabores (se pidieron el 11/11/2026 y los socios los
descartaron el mismo día: el producto sigue sin sabor).

### Reglas de implementación
UUID generados en el cliente · operaciones idempotentes · inventario solo por movimientos ·
precios, costos y tipos de cambio históricos congelados · nada financiero ni de inventario se
borra (se anula) · ventas, cobros, deudas, costos, ganancias, capital y retiros separados ·
ramas, un módulo por vez, pruebas obligatorias de dinero e inventario.

---

## 2. Decisiones de negocio

| # | Tema | Decisión |
|---|------|----------|
| 1 | Costo | **FIFO automático** en pesos. Al vender se consumen las compras más antiguas del producto. No se elige lote. El costo de una venta, una vez registrado, no cambia nunca. |
| 1b | Moneda de compra | Se compra en **USD**. Cada compra guarda costo unitario en USD, **tipo de cambio blue de ese día** (cargado a mano; la app sugiere el último usado) y costo unitario en pesos = USD × tipo de cambio. Si no se recuerda el tipo de cambio exacto de una tanda, se carga **estimado** y queda marcado. El costo en pesos queda fijo al cargar la compra. |
| 1c | Moneda de venta | Ventas, precios, cobros, deudas y ganancia: **pesos**. La venta no usa tipo de cambio. |
| 2 | Ganancia | Ganancia = venta en pesos − costo en pesos (FIFO) de lo vendido. No hay ganancia proporcional a lo cobrado. Cada venta muestra: importe, costo, ganancia, cobrado y saldo. |
|  | *Cambio 18/11/2026* | **La ganancia neta del período es la de lo cobrado**: cada peso cobrado (aplicado por FIFO a la deuda más vieja) trae su parte proporcional de la ganancia de esa venta, en el día del pago; lo cobrado de deudas del papel no genera ganancia. La ganancia de cada venta se sigue mostrando como "ganancia generada". Ver 12.6. |
| 3 | Cuenta corriente | Cada pago se carga a cuenta del cliente y se aplica solo a las deudas más viejas (FIFO). Pagos parciales permitidos. Lo que sobra queda como **saldo a favor**. |
| 4 | Reparto | Primero se descuenta el costo; la ganancia se divide según el porcentaje (50/50 por defecto, configurable). Se muestran por separado: ganancia, parte de cada socio, ganancia acumulada y dinero cobrado. No se distribuye dinero. |
| 4b | Capital | Capital invertido y stock se muestran **en USD y en pesos al costo de compra**. El cierre del capital se verifica en las dos monedas. |
| 5 | Pérdidas | Etapa 1: ajuste de stock con motivo (regalo, pérdida, rotura); sale por FIFO, registra su costo en USD y en pesos de la compra de origen y ese costo en pesos resta de la ganancia. Etapa 2: devoluciones/reposiciones. |
| 6 | Anulaciones | Nada se borra. Se anula con registros compensatorios. Una venta anulada devuelve las unidades a sus compras de origen con su costo original. |
| 7 | Ventas | Varios productos por venta, cada uno con cantidad y precio. Total automático. |
| 8 | Precios | Precio general por producto + precio especial por cliente y producto. Propuesto: especial → último pagado por ese cliente → general. Editable. Precio histórico guardado. |
| 9 | Pagos | Efectivo, transferencia, Mercado Pago. Cada pago: cliente, importe, fecha, medio, usuario que lo registró y socio que recibió el dinero. |
| 10 | Visitas | Última visita = la más reciente entre ventas y "marcar como visitado". Intervalo 14 días por defecto. Atrasado desde el día siguiente a la fecha prevista. Clientes archivables. |
| 11 | Productos | Producto = **marca + modelo** (el modelo incluye los puffs, ej. "Elfbar 5000"). **Sin sabor.** Catálogo: marca, modelo, stock, costo y precio general. Estructura preparada para otras categorías. |
|  | *11/11/2026* | Se pidió sabor opcional y los socios lo **descartaron** el mismo día: sigue valiendo "sin sabor". |
| 12 | Responsables | Quién hizo cada venta, quién registró cada pago, quién recibió el dinero, quién cargó cada compra o ajuste. |
| 13 | Carga inicial | ~100 clientes, ~700 unidades (+400 en camino, como compra nueva). Deudas, saldos a favor, precios generales y especiales. CSV con verificación de totales antes de confirmar. No se inventan datos. |
| 14 | Login | Email y contraseña, sesión persistente y segura, un acceso por socio. |
| 15 | Cuentas | GitHub, Supabase y Vercel a nombre de Benjamín; luego acceso de administrador al papá. Ninguna clave en el código ni en el frontend. |
| 16 | Backups | Plan gratis de Supabase. Backup diario automático cifrado fuera de Supabase, exportación a CSV desde la app, tarea que evite la pausa por inactividad, procedimiento de restauración documentado y **probado antes de cargar datos reales**. |

---

## 3. Ambigüedades técnicas resueltas

**A1. Socio ≠ usuario de login.** `socios` es una tabla propia con `user_id` opcional. "Quién vendió" y
"quién recibió el dinero" apuntan a un socio; "quién registró" es el **socio vinculado al usuario logueado**, que lo pone
la base automáticamente (no se puede elegir ni falsificar). Así el papá figura como socio aunque todavía no
tenga cuenta, y las operaciones no dependen de los ids internos de login (importante para restaurar backups).

**A2. Orden FIFO.** Por fecha de compra y, a igual fecha, por orden de carga. El costo se asigna al
registrar la venta o el ajuste y queda congelado; cargar después una compra con fecha anterior no
recalcula nada.

**A3. Fechas.** Por defecto "ahora"; se permite una fecha pasada, nunca futura. La fecha afecta reportes,
visitas y orden de aplicación de pagos, no el costo ya asignado.

**A4. Aplicación de pagos calculada, no guardada.** Créditos del cliente (pagos + saldo inicial a favor)
cubren las deudas de la más vieja a la más nueva. Si se anula algo, se reacomoda solo; el resultado no
depende del orden de carga de los pagos. **Excepción (18/11/2026):** el pago registrado en la pantalla de venta se
aplica primero a esa venta; lo que sobra va a la más vieja (`docs/decisiones/pago-en-venta-y-ganancia-cobrada.md`).

**A5. Deudas y saldos a favor del papel** entran como "saldo inicial": cuentan en la cuenta corriente
(deuda más vieja) pero no como venta. **Cambio del 18/11/2026:** como no se sabe qué stock fue, lo cobrado de una
deuda del papel trae una ganancia **estimada en el 50 % fijo**, que entra en la ganancia neta (sin distinguirla) a
medida que se cobra; el otro 50 % cuenta como costo de lo cobrado. Los saldos a favor del papel no generan ganancia.

**A6. Stock inicial.** Las ~700 unidades se cargan como compras de origen "inventario inicial", una por
tanda, cada una con su costo en USD, su tipo de cambio (o estimado) y su fecha. Las 400 nuevas, como compra
normal.

**A7. Dinero y redondeo con dólares.**
- Pesos en **centavos de peso** (`bigint`). USD en **centavos de dólar** (`bigint`).
- Tipo de cambio en **centavos de peso por dólar** (`bigint`): $1.237,50 = `123750`.
- Costo unitario en pesos = USD × tipo de cambio, **redondeado al centavo** (mitad hacia arriba), calculado
  una sola vez por la base al guardar la compra.
  Ej.: USD 4,99 × $1.237,50 = $6.175,125 → **$6.175,13**.
- Totales de compra: `cantidad × costo unitario` en cada moneda. Así el costo en pesos de cualquier unidad
  es siempre el mismo y el capital cierra exacto al centavo en las dos monedas (sección 7). La diferencia
  contra multiplicar el total en USD por el tipo de cambio es de menos de un centavo por unidad, y la
  pantalla de carga la muestra.

**A8. Reparto con porcentaje configurable** guardado con fecha de vigencia; cada operación usa el % de su
fecha. Redondeo: cada parte hacia abajo en centavos y el sobrante al primer socio; la suma da exacto.

**A9. Ajustes de Etapa 1 solo de salida** (regalo, pérdida, rotura). Errores de compra: se anula la compra
(solo si no tuvo salidas) y se carga de nuevo. No hay ajustes de entrada porque requerirían inventar costo.

**A10. Costo en el catálogo.** Se muestra el costo (USD y pesos) de la próxima unidad FIFO y el valor del
stock a costo en USD y en pesos.

**A11. Stock insuficiente y concurrencia.** No se vende ni ajusta más de lo disponible; la base bloquea las
filas para que dos ventas simultáneas no consuman la misma unidad.

**A12. Visitas como eventos** (tabla `visitas`, solo inserciones); deja listo el historial de Etapa 2.

**A13.** Cliente sin ventas ni visitas: próxima visita desde la fecha de alta (o la última visita del CSV).

**A14.** Clientes archivados: fuera de búsqueda y atrasados; siguen en "quién debe plata" si deben.

**A15.** Anular una venta ya cobrada: el crédito se reaplica o queda como saldo a favor.

**A16. Importación CSV.** Planillas en orden: productos (marca, modelo, precio general) → clientes →
compras/stock inicial (marca, modelo, fecha, cantidad, costo unitario USD, tipo de cambio, estimado sí/no)
→ precios especiales → saldos iniciales. Referencias por nombre exacto (cliente) y marca + modelo
(producto). Cualquier error frena toda la planilla. Cada importación tiene UUID (confirmar dos veces no
duplica). La vista previa muestra filas, unidades, invertido en USD, invertido en pesos, cuántas tandas con
tipo de cambio estimado, total de deudas y de saldos a favor.

**A17. Tipo de cambio sugerido** = el de la última compra cargada (no se consulta ninguna web: el valor lo
pone el socio). Debe ser > 0.

**A18. Fecha de compra obligatoria**, también en el stock inicial, porque define el orden FIFO. Si no se
recuerda exacta, se pone la mejor aproximación; la marca "estimado" cubre el tipo de cambio, que es lo que
afecta el costo.

**A19. Migraciones automáticas.** Al mergear a `main` un cambio en `supabase/migrations/`, GitHub Actions
aplica a Supabase solo las migraciones pendientes (`.github/workflows/migraciones.yml`). Usa un único secreto,
`SUPABASE_DB_URL` (conexión "Session pooler", porque GitHub no tiene IPv6). Nunca carga `seed.sql`. Las
migraciones se prueban antes en el CI de cada PR (base local + pgTAP).

**A20. Un solo proyecto de Supabase: datos de prueba marcados y borrables.** Se prueba en el mismo proyecto que
va a ser el real. Por eso:
- `negocios.modo_prueba` (verdadero hasta el pasaje a producción). Mientras esté activo, la app muestra una
  franja "MODO PRUEBA" y **todo lo que se carga queda marcado** con `es_prueba = true` (lo pone la base, no el
  celular).
- Todas las tablas de datos (productos, compras, movimientos, clientes, ventas, pagos, etc.) tienen la columna
  `es_prueba`. Cada módulo que agrega una tabla la suma al borrado.
- `supabase/admin/borrar-datos-de-prueba.sql`: muestra cuántas filas de prueba hay por tabla y las borra en una
  sola transacción, **conservando negocio, socios y usuarios**. Si alguna fila real dependiera de una de prueba,
  no borra nada. Después desactiva `modo_prueba`.
- Es la única excepción a "nunca borrar": solo la puede correr el administrador desde el SQL Editor de Supabase,
  solo borra filas marcadas como prueba, y se ensaya en el módulo 1.9 y se usa en el 1.10, antes de la carga real.

---

## 4. Modelo de datos y relaciones

### 4.1 Principios
- Pesos y dólares en centavos enteros (A7).
- UUID generado en el cliente en todas las operaciones; escrituras idempotentes por ese UUID.
- Tablas de operaciones solo con inserciones; anulación con `anulado_en / anulado_por / motivo_anulacion`
  y movimientos compensatorios.
- Todo con `negocio_id` (RLS), `registrado_por` (socio del usuario logueado, lo pone la base) y `creado_en`.

### 4.2 Diagrama de relaciones

```mermaid
erDiagram
  negocios ||--o{ socios : tiene
  socios ||--o{ reparto_porcentajes : "porcentaje vigente"
  negocios ||--o{ clientes : tiene
  negocios ||--o{ productos : tiene
  clientes ||--o{ visitas : recibe
  clientes ||--o{ ventas : compra
  clientes ||--o{ pagos : paga
  clientes ||--o{ saldos_iniciales : "arrastra del papel"
  clientes ||--o{ precios_especiales : tiene
  productos ||--o{ precios_especiales : "precio para"
  productos ||--o{ compras : "se compra en (USD)"
  productos ||--o{ venta_items : "se vende en (ARS)"
  productos ||--o{ ajustes_stock : "se ajusta en"
  ventas ||--|{ venta_items : contiene
  compras ||--o{ movimientos_stock : "entrada y salidas"
  venta_items ||--o{ movimientos_stock : "consume (FIFO)"
  ajustes_stock ||--o{ movimientos_stock : "consume (FIFO)"
  socios ||--o{ ventas : "vendió"
  socios ||--o{ pagos : "recibió el dinero"
  importaciones ||--o{ compras : "stock inicial"
  importaciones ||--o{ saldos_iniciales : origen
```

### 4.3 Tablas (Etapa 1)

```
negocios            id · nombre · creado_en

socios              id · negocio_id · nombre · user_id NULL UNIQUE (auth.users) · orden

reparto_porcentajes id · negocio_id · socio_id · porcentaje numeric(5,2) · vigente_desde date

clientes            id · negocio_id · nombre · telefono · notas
                    intervalo_visita_dias int DEFAULT 14 CHECK > 0 · archivado_en NULL
                    registrado_por · creado_en

visitas             id · negocio_id · cliente_id · fecha · nota · registrado_por · creado_en

productos           id · negocio_id
                    categoria text DEFAULT 'vaper'     -- preparado; hoy siempre 'vaper'
                    marca text NOT NULL                -- "Elfbar"
                    modelo text NOT NULL               -- "5000" (incluye puffs)
                    precio_general bigint NULL (centavos ARS)
                    activo boolean
                    UNIQUE (negocio_id, categoria, lower(marca), lower(modelo))

precios_especiales  negocio_id · cliente_id · producto_id · precio bigint (ARS)
                    actualizado_por · actualizado_en · PK (cliente_id, producto_id)

compras             id · negocio_id · producto_id · fecha date
                    cantidad int CHECK > 0
                    costo_unitario_usd bigint CHECK >= 0           -- centavos USD
                    tipo_cambio bigint CHECK > 0                   -- centavos ARS por USD
                    tipo_cambio_estimado boolean DEFAULT false
                    costo_unitario_ars bigint GENERATED            -- round(usd × tc / 100)
                    costo_total_usd bigint GENERATED (cantidad × costo_unitario_usd)
                    costo_total_ars bigint GENERATED (cantidad × costo_unitario_ars)
                    origen text CHECK IN ('compra','inventario_inicial')
                    importacion_id NULL · nota
                    anulado_en · anulado_por · motivo_anulacion · registrado_por · creado_en

movimientos_stock   id · negocio_id · compra_id · producto_id
                    tipo CHECK IN ('compra','venta','ajuste',
                                   'anulacion_compra','anulacion_venta','anulacion_ajuste')
                    cantidad int CHECK <> 0           -- + entra, − sale
                    costo_unitario_usd · costo_unitario_ars   -- copia de la compra
                    venta_item_id NULL · ajuste_id NULL
                    fecha · registrado_por · creado_en

ventas              id · negocio_id · cliente_id · fecha · vendido_por (socio) · nota
                    anulado_en · anulado_por · motivo_anulacion · registrado_por · creado_en

venta_items         id · negocio_id · venta_id · producto_id
                    cantidad int CHECK > 0
                    precio_unitario bigint (ARS, histórico)
                    costo_total_ars bigint  -- suma FIFO de sus movimientos (lo calcula la base)
                    costo_total_usd bigint  -- ídem, para el cierre del capital en USD

pagos               id · negocio_id · cliente_id · fecha · importe bigint CHECK > 0 (ARS)
                    medio CHECK IN ('efectivo','transferencia','mercado_pago')
                    recibido_por (socio) · nota
                    anulado_en · anulado_por · motivo_anulacion · registrado_por · creado_en

ajustes_stock       id · negocio_id · producto_id · fecha · cantidad CHECK > 0
                    motivo CHECK IN ('regalo','perdida','rotura')
                    costo_total_ars · costo_total_usd   -- suma FIFO (lo calcula la base)
                    nota · anulado_* · registrado_por · creado_en

saldos_iniciales    id · negocio_id · cliente_id · tipo CHECK IN ('deuda','a_favor')
                    importe bigint CHECK > 0 (ARS) · fecha · importacion_id NULL · nota
                    anulado_* · registrado_por · creado_en

importaciones       id · negocio_id · tipo · archivo_nombre · cantidad_filas · totales jsonb
                    confirmado_por · confirmado_en
```

### 4.4 Preparado para Etapa 2 (no se crea ahora)
- `retiros` (socio, importe ARS, fecha, medio): tabla aparte, nunca mezclada con ventas, cobros ni ganancia.
- `devoluciones` / `reposiciones`: referencian `ventas`/`venta_items`; los fallados van a un stock separado
  y no vuelven al vendible. La reposición es una salida FIFO sin venta (costo USD y pesos de la compra de
  origen) que resta de la ganancia salvo que el proveedor lo reponga.

### 4.5 Funciones de escritura (atómicas e idempotentes)

| Función | Qué hace |
|---|---|
| `registrar_compra` | Compra + movimiento de entrada; la base calcula el costo en pesos. |
| `anular_compra` | Solo sin salidas. Movimiento compensatorio. |
| `registrar_venta` | Valida y bloquea stock, consume FIFO, guarda precio y costo (ARS y USD) históricos. |
| `anular_venta` | Devuelve cada unidad a su compra de origen con su costo original. |
| `registrar_ajuste` / `anular_ajuste` | Igual que venta, sin cliente ni precio. |
| `registrar_pago` / `anular_pago` | Inserta o marca anulado. |
| `marcar_visitado` | Inserta visita. |
| `configurar_reparto` | Porcentajes con vigencia; suma 100. |
| `confirmar_importacion` | Toda una planilla en una transacción. |

---

## 5. Reglas de cálculo

```
Costo unitario ARS (compra) = round(costo_unitario_usd × tipo_cambio / 100)   [en centavos]

Importe de una venta     = Σ cantidad × precio_unitario                       (ARS)
Costo de una venta       = Σ unidades consumidas × costo_unitario_ars de su compra (ARS)
                           (y en paralelo Σ unidades × costo_unitario_usd)    (USD)
Ganancia de una venta    = Importe − Costo ARS

Ganancia bruta (período) = Σ ganancia de ventas no anuladas del período
Pérdidas por ajustes     = Σ costo ARS de ajustes no anulados del período
Ganancia neta            = Ganancia bruta − Pérdidas
Parte del socio          = Ganancia neta × % vigente (centavos, sin perder centavos)

Deudas del cliente       = saldos iniciales deuda + ventas no anuladas, de la más vieja a la más nueva
Créditos del cliente     = pagos no anulados + saldos iniciales a favor
Cobrado / saldo por deuda = aplicación FIFO de los créditos
Saldo del cliente        = Σ deudas − Σ créditos  (> 0 debe; < 0 a favor)

Dinero cobrado           = Σ pagos no anulados (por período, medio y socio receptor)
Invertido                = Σ costo_total de compras no anuladas (USD y ARS)
Stock valorizado         = Σ unidades restantes de cada compra × su costo unitario (USD y ARS)

Próxima visita           = max(última venta, última visita, [alta]) + intervalo
Atrasado                 = hoy (Tucumán) > próxima visita
```

---

## 6. Ejemplos numéricos

Datos inventados. El escenario completo se convierte en una **prueba automática de referencia** (11.5).

**Productos**
- P1: "Vapex 8000" — precio general $10.000
- P2: "Nubo 5000" — precio general $8.000

**Clientes**
- Ana: sin precios especiales.
- Bruno: precio especial P1 = $10.500. Deuda del papel (saldo inicial) $20.000 al 01/09.

### 6.1 Compras en USD con distinto tipo de cambio

| Compra | Fecha | Producto | Cant. | USD/u | Tipo de cambio | $/u | Total USD | Total $ |
|---|---|---|---|---|---|---|---|---|
| C1 (inventario inicial) | 01/09 | P1 | 10 | 5,00 | $1.200 **(estimado)** | $6.000 | USD 50 | $60.000 |
| C2 | 01/10 | P1 | 20 | 5,00 | $1.400 | $7.000 | USD 100 | $140.000 |
| C3 | 02/10 | P2 | 15 | 3,00 | $1.500 | $4.500 | USD 45 | $67.500 |
| | | | | | | **Invertido** | **USD 195** | **$267.500** |

C1 y C2 cuestan lo mismo en dólares, pero en pesos C2 es más cara porque el blue subió. Al cargar C3 la app
sugiere $1.400 (último usado) y el socio lo cambia a $1.500.

### 6.2 Venta que consume dos compras con distinto tipo de cambio

**V1 — 05/10, Ana, 12 × P1** a $10.000 (general: Ana no tiene especial ni compras previas).

| Sale de | Unid. | $/u | Costo $ | USD/u | Costo USD |
|---|---|---|---|---|---|
| C1 (TC $1.200) | 10 | $6.000 | $60.000 | 5,00 | USD 50 |
| C2 (TC $1.400) | 2 | $7.000 | $14.000 | 5,00 | USD 10 |
| | **12** | | **$74.000** | | **USD 60** |

Importe **$120.000** · Costo **$74.000** · Ganancia **$46.000**. La venta no usa tipo de cambio: cada
unidad trae el costo en pesos fijado en su compra. Stock P1: C1 = 0, C2 = 18.

### 6.3 Venta con varios productos

**V2 — 06/10, Bruno.**

| Renglón | Cant. | Precio | Importe | Costo FIFO | Costo USD | Ganancia |
|---|---|---|---|---|---|---|
| P1 (especial) | 3 | $10.500 | $31.500 | C2 3 × $7.000 = $21.000 | USD 15 | $10.500 |
| P2 (general) | 2 | $8.000 | $16.000 | C3 2 × $4.500 = $9.000 | USD 6 | $7.000 |
| **Total** | | | **$47.500** | **$30.000** | **USD 21** | **$17.500** |

### 6.4 Tercera venta

**V3 — 20/10, Bruno, 3 × P1** a $10.500 (especial) = **$31.500**. Costo C2 3 × $7.000 = **$21.000**
(USD 15). Ganancia **$10.500**. Stock: C2 = 12, C3 = 13.

### 6.5 Pagos parciales aplicados a las deudas más viejas

Deudas de Bruno: saldo inicial $20.000 (01/09) · V2 $47.500 (06/10) · V3 $31.500 (20/10) = **$99.000**.

**Pago 1 — 25/10, $50.000, efectivo, recibió Papá, registró Benjamín.**

| Deuda | Importe | Cobrado | Saldo |
|---|---|---|---|
| Saldo inicial | $20.000 | $20.000 | $0 |
| V2 | $47.500 | $30.000 | $17.500 |
| V3 | $31.500 | $0 | $31.500 |
| **Bruno debe** | | | **$49.000** |

**Pago 2 — 30/10, $50.000, Mercado Pago, recibió Benjamín.** Créditos: $100.000.

| Deuda | Importe | Cobrado | Saldo |
|---|---|---|---|
| Saldo inicial | $20.000 | $20.000 | $0 |
| V2 | $47.500 | $47.500 | $0 |
| V3 | $31.500 | $31.500 | $0 |
| **Saldo a favor de Bruno** | | | **$1.000** |

**Ana — 10/10, $60.000, transferencia, recibió Benjamín.** V1: cobrado $60.000, saldo $60.000.

### 6.6 Ajuste por pérdida

**A1 — 28/10, rotura, 1 × P1.** Sale de C2 → costo **$7.000 / USD 5**. Stock C2 = 11.

### 6.7 Ganancia y reparto 50/50 (octubre)

| Concepto | Importe |
|---|---|
| V1 Ana | ganancia $46.000 |
| V2 Bruno | ganancia $17.500 |
| V3 Bruno | ganancia $10.500 |
| **Ganancia bruta** (ventas $199.000 − costo $125.000) | **$74.000** |
| − Pérdidas por ajustes (A1) | −$7.000 |
| **Ganancia neta** | **$67.000** |
| Benjamín 50% | $33.500 |
| Papá 50% | $33.500 |

Por separado:

| Concepto | Importe |
|---|---|
| Dinero cobrado | $160.000 (Ana $60.000 + Bruno $100.000) |
| — recibió Benjamín | $110.000 ($60.000 transferencia + $50.000 MP) |
| — recibió Papá | $50.000 (efectivo) |
| Nos deben | $60.000 (Ana) |
| Saldos a favor | $1.000 (Bruno) |
| Stock a costo | **USD 94 / $135.500** (C2 11 × USD 5 / $7.000 + C3 13 × USD 3 / $4.500) |

Redondeo del reparto: una ganancia de $10.000,01 se reparte $5.000,01 + $5.000,00.

> **Corrección respecto de la versión 2.** Tenían razón en revisar: la versión 2 sí tenía una tercera
> venta (V3, 2 unidades, ganancia $7.000) pero estaba escondida dentro del punto de ventas con varios
> productos, y por casualidad su ganancia era igual a la pérdida por rotura ($7.000), así que Ana + V2
> ($63.500) coincidía con la ganancia neta y parecía un error. Los números de la versión 2 cerraban
> ($70.500 − $7.000 = $63.500), pero eran confusos. En esta versión V3 tiene su propio punto (6.4) y 3
> unidades, para que ningún número coincida por casualidad.

---

## 7. Verificación: capital invertido vs. ganancia

**1. El capital cierra en las dos monedas:**

| | USD | Pesos |
|---|---|---|
| Costo de lo vendido (V1 + V2 + V3) | 60 + 21 + 15 = **96** | 74.000 + 30.000 + 21.000 = **125.000** |
| + Pérdidas (A1) | **5** | **7.000** |
| + Stock que queda | **94** | **135.500** |
| = **Invertido en compras** | **195** ✔ | **267.500** ✔ |

Esta igualdad es un control automático (11.4, I3) que se verifica en USD y en pesos después de cada operación.

**2. Ganancia ≠ plata cobrada.** Cobrado $160.000, ganancia neta $67.000. Repartir lo cobrado sería
repartir $20.000 de deuda vieja del papel y el costo de la mercadería, que es capital para reponer.

**3. Ganancia ≠ plata disponible.** Ana todavía debe $60.000 de esa ganancia.

**4. El stock inicial y las 400 nuevas son capital**: entran como compras y solo pasan a costo cuando se
venden. **5. Los retiros (Etapa 2)** serán tabla aparte; nunca tocan la ganancia.

**6. Atención con el dólar** (ver T4): la ganancia en pesos se calcula con el costo histórico. Si el blue
sube, reponer la mercadería cuesta más pesos que el costo registrado. Por eso el capital se muestra también
en USD: si repartieran toda la ganancia en pesos, el capital en USD disponible para reponer podría bajar.

---

## 8. Contradicciones y tensiones detectadas

### 8.1 Cerradas por las decisiones de esta versión
- **T1 (sabor)**: cerrada. El producto es marca + modelo. Se reabrió el 11/11/2026 y se volvió a cerrar el mismo
  día: los socios descartaron el sabor.
- **T9 (backups)**: cerrada con la sección 10, sin pagar Supabase Pro.

### 8.2 Siguen vigentes (con solución ya definida)
| # | Tensión | Resolución |
|---|---|---|
| T2 | Costo del stock inicial | El CSV exige costo USD y tipo de cambio por tanda; el tipo de cambio puede ir marcado como estimado. |
| T3 | Deudas del papel sin costo | A5: saldo inicial, sin ganancia. |
| T5 | Aplicación FIFO de pagos se reacomoda al anular | A4; pagos y ventas no cambian nunca. |
| T6 | Papá sin cuenta todavía | A1. |
| T7 | "Administrador" | Administrador de GitHub/Supabase/Vercel; en la app los dos socios tienen los mismos permisos. |
| T8 | Costo en catálogo con FIFO | A10. |
| T10 | Hosting + Next.js | Solo funciones estables. Netlify desde el 1.0; **Vercel (plan Hobby) desde el 17/11/2026**, probado con login y totales iguales a los de Netlify. |
| T11 | UUID en el cliente + FIFO en servidor | El costo lo calcula la base. |
| T12 | Etapa 1 grande | Dividida en módulos (sección 12). |
| T13 | Precio especial se pisa | Es configuración; lo histórico está en cada venta. |

### 8.3 Nuevas (por dólares y backups) — ninguna bloquea el módulo 1.0
| # | Tensión | Resolución |
|---|---|---|
| T4 | **FIFO con costo histórico y dólar en alza**: la ganancia en pesos puede verse más alta de lo que permite reponer stock. No contradice la definición que eligieron (ganancia = venta − costo de compra), pero conviene saberlo. | Se respeta la definición. Se muestra el capital en USD al lado. No agrego "costo de reposición" (no fue pedido). |
| T14 | **Tipo de cambio estimado vs "no inventar datos"**. | Lo pidieron explícitamente; queda marcado en la compra, se cuenta en la vista previa de importación y se muestra en el detalle de costo. |
| T15 | **Fecha de una tanda vieja no recordada**: define el orden FIFO. | A18: fecha obligatoria, la mejor aproximación. |
| T16 | **GitHub desactiva tareas programadas** de repositorios **públicos** tras 60 días sin actividad; además en un repo público cualquiera puede ver los logs de Actions. | El repositorio debe ser **privado** (también por los datos de negocio). Con repo privado las tareas programadas no se desactivan. |
| T17 | **Conexión a la base desde GitHub Actions**: la conexión directa del plan gratis de Supabase es solo IPv6 y los servidores de GitHub no tienen IPv6. | El backup usa el "Session pooler" de Supabase (IPv4), que permite `pg_dump`. |
| T18 | **Tiempo de retención de backups**: los artefactos de GitHub Actions se guardan como máximo 90 días. | Diarios con 90 días de retención. Además, el botón de exportar CSV permite que ustedes guarden copias propias (por ejemplo una por mes). |
| T19 | **Las cuentas de login viven en el esquema interno de Supabase (`auth`)**, que no conviene restaurar a mano en otro proyecto. | Se respalda el esquema de datos (`public`). Al restaurar se crean de nuevo las dos cuentas y se vinculan a sus socios (un paso del procedimiento). Como las operaciones guardan el **socio** (A1) y no el id de login, alcanza con actualizar `socios.user_id`. |

---

## 9. Arquitectura

```
Celular / PC Windows (navegador)
   │  Next.js (App Router) + TypeScript + Tailwind — responsive
   │  Genera UUID de cada operación. Validación con Zod.
   ▼
Vercel (hosting Next.js, plan Hobby)
   │  @supabase/ssr: sesión en cookies; todo se consulta como el usuario logueado
   │  src/dominio/: cálculos puros (cuenta corriente, ganancia, reparto, visitas, precio propuesto)
   ▼
Supabase (plan gratis)
   ├─ Auth: email + contraseña, registro público desactivado
   ├─ PostgreSQL + RLS en todas las tablas
   ├─ Funciones SQL atómicas e idempotentes (incluido FIFO y conversión USD → pesos)
   └─ Vistas de lectura (stock por compra/producto, valorizado USD y pesos)

GitHub Actions (repo privado)
   ├─ CI en cada PR: lint, tipos, Vitest + fast-check, pgTAP, build
   ├─ Backup diario cifrado (sección 10)
   └─ Ping periódico para evitar la pausa del proyecto
```

- **FIFO, stock y conversión de moneda → en la base**: necesitan el stock real, bloqueo y una sola fórmula.
- **Cuenta corriente, ganancia, reparto, visitas, precio propuesto → TypeScript puro**, probado con Vitest y
  fast-check.
- **Seguridad**: RLS (`es_socio(negocio_id)`), sin `DELETE` ni `UPDATE` directo en operaciones, solo clave
  pública en la app; `service_role` y conexión a la base solo en secretos de GitHub, nunca en el frontend.

---

## 10. Backups y continuidad (plan gratis de Supabase)

1. **Backup diario automático** (GitHub Actions, programado de madrugada):
   `pg_dump` del esquema de datos vía Session pooler → comprimido → **cifrado con `age`** usando una clave
   pública → guardado como artefacto privado del repositorio (90 días).
   - La conexión a la base (`SUPABASE_DB_URL`) es un **secreto** de GitHub; nunca aparece en el código.
   - La clave **privada** para descifrar la guardan los socios fuera de GitHub (gestor de contraseñas y una
     copia impresa). Sin ella, el archivo no se puede leer: aunque alguien lo obtenga, no ve datos de clientes.
   - El log del backup solo muestra tamaño y cantidad de filas por tabla, nunca datos.
2. **Exportar todo a CSV** desde la app: botón en Configuración que descarga un `.zip` con un CSV por tabla
   (solo para socios logueados).
3. **Evitar la pausa**: tarea programada cada 2 días que hace una consulta liviana a la API de Supabase
   (función `ping()` que devuelve la hora, sin datos). El backup diario también genera actividad.
4. **Procedimiento de restauración** documentado en `docs/restauracion.md`: descargar artefacto, descifrar,
   restaurar en un proyecto Supabase nuevo, verificar controles (cantidades por tabla y cierres de capital),
   reconfigurar variables en Vercel, recuperar contraseñas.
5. **Prueba real de restauración** sobre un proyecto Supabase de prueba con datos inventados, **antes** de
   cargar datos reales. Módulo 1.9; sin eso no se pasa al 1.10.

---

## 11. Pruebas

### 11.1 Inventario, costos y moneda (pgTAP)
1. Compra: costo en pesos = round(USD × TC); totales en USD y pesos; movimiento de entrada.
2. Redondeo de conversión (USD 4,99 × $1.237,50 = $6.175,13); tipo de cambio 0 o negativo rechazado.
3. Venta dentro de una compra; venta que cruza dos compras con distinto tipo de cambio (caso V1:
   $74.000 / USD 60).
4. Orden FIFO por fecha y orden de carga.
5. Venta multi-producto: cada renglón consume solo compras de su producto.
6. Stock insuficiente: se rechaza toda la venta.
7. Idempotencia por UUID.
8. Costo congelado: compra posterior con fecha anterior no cambia ventas pasadas.
9. Anular venta: cada unidad vuelve a su compra con su costo USD y pesos original; anular dos veces no duplica.
10. Venta posterior a una anulación consume primero lo devuelto a la compra más vieja.
11. Ajuste con costo FIFO en USD y pesos; anulación.
12. Anular compra: solo sin salidas.
13. Concurrencia: dos ventas simultáneas de la última unidad → una sola.
14. Inmutabilidad: `DELETE`/`UPDATE` directos rechazados.
15. Tipo de cambio estimado queda marcado y no cambia el cálculo.

### 11.2 Cuentas corrientes (Vitest + fast-check)
Sin pagos · pago parcial a la deuda más vieja · pago que cubre varias y sobra · saldo a favor aplicado a
venta nueva · saldo inicial deuda/a favor · anulaciones reacomodan · anular venta cobrada · independencia
del orden de carga · desempate por orden de carga · totales "nos deben" / "a favor" con archivados.

### 11.3 Ganancia y reparto (Vitest + fast-check)
Ganancia por venta multi-renglón · bruta, pérdidas y neta · anuladas no cuentan · saldos iniciales no
generan ganancia · ganancia en pesos sin tipo de cambio de venta · repartos 50/50, 60/40, 100/0 · vigencia
de porcentajes · redondeo exacto (incluye negativos) · cobrado por medio y socio · bordes de día/mes en
hora de Tucumán.

### 11.4 Controles generales (invariantes, con fast-check sobre secuencias aleatorias)
- **I1** Stock de cada compra = comprado − salidas + devoluciones ≥ 0.
- **I2** Movimientos de cada renglón: Σ cantidades = −cantidad; Σ costos = costo del renglón, **en USD y en pesos**.
- **I3** Invertido = costo vendido + pérdidas + stock valorizado, **en USD y en pesos**, al centavo.
- **I4** Σ saldos de clientes = Σ deudas − Σ créditos.
- **I5** Ventas = costo vendido (ARS) + ganancia bruta.
- **I6** Σ partes de socios = ganancia neta.
- **I7** Para cada compra: costo_unitario_ars = round(costo_unitario_usd × tipo_cambio / 100), y todas las
  salidas de esa compra usan exactamente ese costo.

### 11.5 Escenario de referencia
Toda la sección 6 cargada como prueba; se comparan todos los números de las tablas.

### 11.6 Otras
Precio propuesto y visitas (Vitest) · seguridad RLS (pgTAP) · importación CSV con USD, tipo de cambio y
marca de estimado (Vitest + pgTAP) · backup → restauración → controles I1–I7 (módulo 1.9) · punta a punta en
celular (Playwright).

---

## 12. Plan de implementación por módulos (Etapa 1)

Orden aprobado el 09/11/2026 (primero todo lo necesario para registrar ventas) y ampliado el 13/11/2026 con el
módulo de simplificación del diseño. Cada módulo: rama propia, PR, pruebas en verde, deploy preview y aprobación
de los socios. "Sesión" = una tanda de trabajo que termina en un PR.

### 12.1 Estado al 11/11/2026

| # | Módulo | Estado | PR |
|---|---|---|---|
| 1.0 | Base: login, socios, RLS, utilidades de dinero y fechas, CI, hosting (Netlify; hoy Vercel), ping anti-pausa | ✅ terminado | #1 |
| — | Migraciones automáticas al mergear a `main` (A19) + plan v3.1 | ✅ terminado | #2 |
| 1.1 | Productos, compras en USD y stock por movimientos; marcado de datos de prueba (A20) | ✅ terminado | #3 |
| 1.2 | Clientes y visitas básicas | ✅ terminado | #4 |
| 1.3 | Ventas con varios productos, FIFO, precios especiales, anulación | ✅ terminado | #5 |
| 1.4 | Pagos y cuenta corriente + filtro por mes en el historial de ventas | ✅ terminado | #6 |
| 1.5 | Resumen y ganancia 50/50 (reparto con vigencia) + prueba de humo en CI | ✅ terminado | #7 |
| 1.6 | Ajustes de stock | ✅ terminado | #9, #10 (arreglo del CI) |
| **1.7** | **Simplificación del diseño** | **🚧 en curso**: todo mergeado (incluidos "Repetir última venta" y lo de 12.6); falta la prueba del papá (12.3) | #11 a #31 |
| ~~1.8~~ | ~~Importación CSV~~ | **descartado (18/11/2026)**: los socios cargan los datos del papel a mano desde la app, después del 1.10 | — |
| 1.9 | Backups y restauración | pendiente | — |
| 1.10 | Pasaje a producción | pendiente | — |

Todos los PR son de `benjamingarma/Gestor`. Pruebas en `main` al 11/11/2026 (verificado en el log de GitHub): 356 pgTAP,
225 Vitest + fast-check, prueba de concurrencia (3 casos) y prueba de humo (29 pantallas, 32 totales contra la base,
venta, cobro y venta a cliente nuevo de punta a punta), todas en verde. No hay PRs abiertos.

### 12.2 Lo que falta

| # | Módulo | Contenido | Sesiones |
|---|---|---|---|
| 1.7 | **Simplificación del diseño** (lo que falta) | Ver 12.3: "Repetir última venta" y prueba del papá. (Sabor descartado; gráfico del mes postergado a 12.5.) | 1 a 2 |
| 1.9 | Backups y restauración | Backup diario cifrado (`age`) fuera de Supabase con GitHub Actions y el secreto `SUPABASE_DB_URL`; exportar todo a CSV desde la app; `docs/restauracion.md`; **prueba real de restauración**; **ensayo del borrado de datos de prueba** (A20). | 1 a 2 |
| 1.10 | Pasaje a producción | Con los socios: borrar datos de prueba, desactivar modo prueba, cuentas reales (vincular la cuenta del papá). Solo con 1.9 aprobado. **Después, los socios cargan a mano los datos del papel** (ver 12.4). | 1 |

Total estimado para lo que falta: 5 a 8 sesiones, más el gráfico del margen (12.5) después del 1.10.

### 12.3 Módulo 1.7 — Simplificación del diseño (pedido de los socios, 13/11/2026)

**Motivo.** Hay demasiados botones por acción. El uso diario lo hace el papá, que necesita algo más simple.

**Objetivo.**
- **Vender y cobrar en 2 o 3 toques** desde la pantalla principal.
- Sacar del flujo diario las funciones avanzadas (anulaciones, precios especiales, saldos del papel, configuración
  del reparto, compras) y dejarlas en un lugar aparte, al que se llega a propósito.

**Alcance a definir al empezar el módulo** (se propone y se aprueba antes de programar):
- Inventario de pantallas y toques actuales para vender, cobrar y marcar visita.
- Propuesta de pantalla principal y de flujo de venta y cobro reducidos.
- Dónde quedan las funciones avanzadas.
- Prueba con el papá antes de mergear.

No cambia reglas de negocio ni datos: solo pantallas (excepciones pedidas por los socios: venta a cliente nuevo y
dirección del cliente, con sus migraciones). Las pruebas de lógica y de base siguen igual; la prueba de
humo se actualiza con las rutas nuevas.

**Maquetas aprobadas el 10/11/2026:** ver `docs/maquetas/README.md` (estructura de navegación, pantallas y
decisiones). La app pasa a llamarse **McStock**.

**PRs del módulo** (cada uno con CI en verde, capturas reales al lado de la maqueta y prueba en el deploy preview):
1. Maquetas en `docs/maquetas/`, navegación (barra inferior y lateral, pantalla Más) y nuevo Inicio. ✅ #11
2. Pantalla de venta. ✅ #12
3. Pantalla de cobro. ✅ #14
4. Resto de pantallas adaptadas, animaciones y prueba de humo con las rutas nuevas. ✅ #15
5. Venta a un cliente nuevo desde "Nueva venta" (pedido del 10/11): ✅ #16 (migración `registrar_venta_cliente_nuevo`),
   ✅ #18 (migración: dirección del cliente), ✅ #17 (pantalla; "Crear cliente nuevo" siempre arriba; dirección también
   en Nuevo cliente, Editar y ficha). Decisiones en `docs/decisiones/modulo-1.7-venta-cliente-nuevo.md`.

**Pendientes (actualizado el 11/11/2026), en este orden:**
- **"Repetir última venta"** en la ficha del cliente: precios de hoy, todo editable y aviso si falta stock.
  Maqueta aprobada el 17/11/2026 (`docs/maquetas/`, pantallas 6a–6c): además, tarjeta **"Última venta"** en toda venta
  (para mirar el precio que se le hizo) y "La última vez: $ X" cuando el precio de hoy es otro. PR en curso.
- **Cierre del 1.7** con la prueba del papá cuando vuelva de viaje.

**Descartado y postergado (11/11/2026):**
- ~~Sabor opcional en productos~~: **descartado** por los socios. No hay migración ni columna en la plantilla CSV.
- **Gráfico del mes en Inicio: postergado** hasta trabajar con datos reales (ver 12.5). Se propuso una torta
  "vendido = costo + ganancia" y se descartó: no contesta la pregunta que se hacen los socios.

Después del 1.7: 1.9 Backups y restauración → 1.10 Pasaje a producción → carga a mano de los datos del papel →
(12.5) gráfico del margen. (1.8 Importación CSV: descartado el 18/11/2026.)

### 12.5 Después del 1.10: gráfico del margen real (idea acordada el 11/11/2026, sin programar)

**Cómo se manejan hoy los socios:** de lo que entra por ventas, separan **la mitad** para reponer mercadería (capital)
y el resto lo toman como ganancia. Sospechan que el costo real es más de la mitad y que el margen es menor.

**Qué tiene que contestar el gráfico** (uno solo, simple, en Inicio): el **margen real** del mes, comparado con la
regla de "la mitad para reponer". Por ejemplo: "Margen real de noviembre: 37 %. De cada $100 que venden, $63 es costo
de la mercadería y $37 es ganancia. Ustedes apartan $50: faltan $13 por cada $100". Debajo siguen Vendido, Cobrado,
Ganancia neta y el aviso "La ganancia no es plata disponible". Sale de lo que ya guarda la base (costo FIFO de cada
venta, con el tipo de cambio de la compra); sin migraciones.

**Por qué se posterga:** con datos de prueba el porcentaje no significa nada, y con uno o dos meses de datos reales
se va a ver qué pregunta sirve de verdad. Primero van 1.8, 1.9 y 1.10.

**Preguntas abiertas para cuando se retome:**
- ¿La regla es siempre "la mitad"? (si es fija, se marca el 50 % en el gráfico; si no, solo el margen real).
- ¿Separan la mitad al vender o al cobrar? (cambia el texto: "de cada $100 que venden" o "que cobran").
- ¿Quieren ver la evolución mes a mes (por ejemplo "octubre 41 % → noviembre 37 %")?

**Ideas relacionadas, para más adelante** (no pedidas): costo de reposición con el dólar de hoy (plan T4; reponer
cuesta más que el costo FIFO si el dólar subió) y margen por producto en el Resumen (para ajustar precios).

### 12.6 Pago en la venta, ganancia según lo cobrado y lenguaje (pedido de los socios, 18/11/2026)

Propuesta con ejemplos numéricos aprobada el 18/11/2026; decisiones y reglas en
`docs/decisiones/pago-en-venta-y-ganancia-cobrada.md`, glosario en `docs/glosario.md`. Se hace antes del 1.8, en este
orden de PRs:
1. **Lenguaje**: "Cobrar" → "Deudores", la acción → "Registrar pago", el historial → "Pagos recibidos", "Cuenta
   corriente" → "Saldo pendiente". Solo textos. Sin migración.
2. **Venta con pago** ("Pagó todo", "Pago parcial", "Deuda", sin preselección): **2A** migración (venta y pago en una
   sola operación, `pagos.venta_id`, Deshacer conjunto; pgTAP y concurrencia; mergeado #24), **2B-1** imputación del
   pago a su venta (cambio del 18/11) y **2B-2** pantalla.
3. **Ganancia según lo cobrado** y su desglose en Inicio y Resumen (Cobrado − deudas del papel − costo de lo cobrado −
   pérdidas = Ganancia neta). Sin migración.

- **Totales por semana (pedido de los socios, 18/11/2026):** la semana va de domingo a sábado. Inicio y Resumen abren
  en la semana actual; el mes (y en Resumen, todo el historial) queda como opción. Inicio siempre abre en semana.
  Período `sem-AAAA-MM-DD` en `src/lib/semanas.ts`; los cálculos de ganancia no cambian.

### 12.4 Notas
- **1.8 Importación CSV descartado (18/11/2026).** Los datos del papel están en papel; los socios evaluaron pasarlos a
  Google Sheets e importarlos y eligieron **cargarlos a mano desde la app**, que ya tiene todo: productos, clientes,
  stock inicial (compra con "inventario inicial", fecha pasada, USD, tipo de cambio y "estimado"), precios especiales y
  saldos del papel (ficha del cliente → Saldo pendiente). La "última visita" anterior a la app no se carga: la próxima
  visita se cuenta desde el alta del cliente (decidido no cambiar la app). Las decisiones A6, A13 y A16 sobre la
  importación quedan sin efecto en lo que respecta al CSV.
- **Los datos reales se cargan recién después del 1.10.** Mientras esté el MODO PRUEBA, todo lo cargado se marca como
  dato de prueba y se borra al pasar a producción (A20); además el plan exige backups probados (1.9) antes de cargar
  datos reales.
- **Hosting en Vercel desde el 17/11/2026** (antes Netlify, que pausó los deploys a producción por créditos del plan
  gratis). Con los deploys a producción en Vercel, **cada merge a `main` publica solo** la app. Los **deploy previews
  de Vercel** (uno por PR, link en el PR) sirven para probar los PR **sin migraciones** antes de mergear; como el
  preview usa la base real y las migraciones se aplican recién al mergear, un PR con migración se sigue haciendo en dos
  (migración primero, pantalla después). CI, prueba de humo, migraciones automáticas y anti-pausa corren en GitHub
  Actions y no dependen del hosting.
- El ping anti-pausa se adelantó al módulo 1.0.
- No hay un proyecto de producción separado: es el mismo proyecto de Supabase, limpio de datos de prueba en el
  módulo 1.10 (A20).
- Renumeración del 13/11/2026: lo que antes eran 1.7 (importación), 1.8 (backups) y 1.9 (producción) ahora son
  1.8, 1.9 y 1.10. Algunos comentarios dentro de migraciones ya aplicadas mencionan la numeración vieja; las
  migraciones aplicadas no se editan.
