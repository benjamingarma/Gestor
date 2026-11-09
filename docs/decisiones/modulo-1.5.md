# Decisiones técnicas — Módulo 1.5 (Resumen y ganancia 50/50)

## 1. Qué se reparte (plan, decisión 4 y sección 7)
- Ganancia neta = ganancia de las ventas (precio − costo FIFO) − pérdidas por ajustes de stock (llegan con el 1.6;
  hasta entonces valen $0). Solo eso se reparte.
- No se reparten: el capital (costo de la mercadería), las deudas del papel ni el dinero cobrado. La pantalla los
  muestra por separado y aclara que la ganancia no es plata disponible.

## 2. Porcentaje con vigencia (plan A8)
- `reparto_porcentajes` guarda el porcentaje de cada socio desde una fecha, en centésimos (5000 = 50,00 %).
- Sin filas: partes iguales (50/50).
- `configurar_reparto` exige todos los socios, cada uno entre 0 y 100, suma exacta 100, y fecha **hoy o futura**: un
  cambio no reescribe la ganancia ya repartida. El mismo día se puede corregir (reemplaza).
- Cada venta usa el porcentaje vigente en su fecha. Un período con dos porcentajes reparte cada tramo con el suyo.

## 3. Redondeo
- Cada parte se calcula en centavos hacia abajo (también si la ganancia es negativa) y el centavo que sobra va al
  primer socio (`socios.orden`). La suma de las partes es siempre exactamente la ganancia neta (probado con
  fast-check, con enteros exactos).

## 4. Cálculos en TypeScript, totales agregados por la base
- `src/dominio/ganancia.ts` (reparto, vigencias, ganancia) y `src/dominio/resumen.ts` (totales de un período).
- La API de Supabase devuelve como máximo 1000 filas por consulta. Para que los totales nunca queden cortados:
  - la base agrega por día (`v_ganancia_diaria`, `v_cobros_diarios`) y el capital en una sola fila (`v_capital`);
  - `src/datos/resumen.ts` lee esas vistas en páginas de 1000 hasta el final.

## 5. Capital (control I3 a la vista)
- `v_capital`: invertido en compras = costo de lo vendido + pérdidas por ajustes + stock, en USD y en pesos.
  La pantalla muestra si cierra (✓) o no (⚠). Probado con pgTAP sobre el escenario del plan.

## 6. Pantalla de resumen (`/resumen`)
- Selector: un mes o todo el historial.
- Ganancia del período (bruta, pérdidas, neta, parte de cada socio), ventas del período, dinero cobrado (por medio y
  por quién recibió la plata), estado de hoy (nos deben, saldos a favor, capital en mercadería, ganancia acumulada),
  capital desde el inicio, a quién visitar y quién debe plata.
- `/resumen/reparto`: reparto vigente, cambios programados, historial y formulario para cambiarlo.

## 7. Error encontrado y prueba de humo
- Al agregar `reparto_porcentajes` (que apunta a socios y a negocios), la consulta del login que traía el negocio
  del socio quedó ambigua para la API ("más de una relación entre socios y negocios") y **nadie podía entrar**.
  Se corrigió nombrando la relación (`negocios!socios_negocio_id_fkey`).
- Ninguna prueba existente lo detectaba. Se agregó `scripts/humo.mjs` y un trabajo de CI que levanta la app
  completa, entra con un usuario de prueba y abre las 18 pantallas; falla si alguna da error. Se verificó que con la
  consulta rota la prueba falla.
