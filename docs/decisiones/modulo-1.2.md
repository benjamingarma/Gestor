# Decisiones técnicas — Módulo 1.2 (Clientes y visitas básicas)

## 1. El nombre del cliente no se repite
- Índice único sobre `lower(trim(nombre))` (los espacios repetidos se normalizan).
- **Por qué**: el nombre es lo que se busca en la calle y lo que usa la importación CSV (plan A16: referencia por
  nombre exacto). Dos "Juan" se distinguen agregando apellido o barrio; la app lo sugiere al rechazar.
- **Descartado**: permitir duplicados (confunde al vender y rompe la importación).

## 2. Visitas como eventos, con "deshacer"
- `marcar_visitado` inserta una fila en `visitas` (plan A12): no se pisa ningún campo y deja listo el historial de
  la Etapa 2. Idempotente por UUID generado en el celular (doble toque = una visita).
- Fecha: hoy por defecto, o un día pasado ("Lo visité otro día"); nunca futura (hora de Tucumán).
- Una visita marcada por error se **anula** (no se borra): `anular_visita`. Sin esto, un toque equivocado
  correría la próxima visita 14 días sin forma de corregirlo.
- Se guarda como fecha (día), no fecha y hora: la regla de visitas es por días y así no hay problemas de zona horaria.

## 3. Cálculo de próxima visita en TypeScript puro (`src/dominio/visitas.ts`)
- Última actividad = la más reciente entre última visita, última venta (llega en el módulo 1.3) y última visita
  anterior a la app (la carga la importación del 1.7, columna `ultima_visita_inicial`).
- Sin actividad: desde la fecha de alta (plan A13). Próxima = última actividad + intervalo.
- Estados: **atrasado** (desde el día siguiente a la fecha prevista), **hoy**, **pronto** (próximos 3 días),
  **al día**, **archivado**. La lista "A visitar" muestra atrasados, hoy y pronto, el más urgente primero.
- La vista `v_clientes` (con RLS) entrega los datos; el cálculo es uno solo y está probado con Vitest + fast-check.

## 4. Archivar
- `archivar_cliente` pone o saca `archivado_en` (hora del servidor). Un archivado no aparece en "A visitar" ni en
  la búsqueda de activos, pero conserva todo; en el módulo 1.4, si debe plata, va a seguir apareciendo en
  "quién debe" (plan A14).

## 5. Teléfono y WhatsApp
- El teléfono se guarda como lo escribe el socio. Para WhatsApp se normaliza (`src/lib/telefono.ts`): se quitan
  0, 15, +54 y 9; sin característica se asume **381** (Tucumán). Resultado `https://wa.me/549XXXXXXXXXX`.
  Si el número no se reconoce, no se muestra el botón (en lugar de abrir un chat equivocado).
- "Llamar" marca el número tal cual fue escrito.

## 6. Identificador nuevo después de cada visita
- El botón "Visitado" genera su UUID al aparecer. Se vuelve a montar (con `key`) cada vez que cambia la última
  visita, así después de "Deshacer" se puede volver a marcar. Este caso se encontró y se corrigió durante la
  prueba de punta a punta.

## 7. Datos de prueba
- `clientes` y `visitas` tienen `es_prueba` y entran en `contar_datos_de_prueba` / `borrar_datos_de_prueba`
  (orden: visitas → movimientos → compras → clientes → productos).
