# Decisiones técnicas — Módulo 1.1 (Productos, compras en USD y stock)

## 1. Producto = marca + modelo, único sin importar mayúsculas ni espacios
- Índice único sobre `lower(trim(marca)), lower(trim(modelo))`: "Vapex 8000" y "vapex 8000 " son el mismo.
- Los productos no se borran: se **desactivan** (no aparecen para comprar; su historial queda).
- `categoria` existe (hoy solo `vaper`) para sumar otros productos más adelante sin migrar datos.

## 2. Compras en USD; el costo en pesos lo calcula la base y queda fijo
- Se guardan `costo_unitario_usd`, `tipo_cambio` (centavos de peso por dólar) y `tipo_cambio_estimado`.
- `costo_unitario_ars`, `costo_total_usd` y `costo_total_ars` son **columnas generadas**: nadie las puede
  escribir ni cambiar. Fórmula: `(usd × tc + 50) / 100` (redondeo al centavo, mitad hacia arriba), la misma de
  `src/lib/dinero.ts`. Una prueba con fast-check verifica que TypeScript y la fórmula de la base coinciden.
- `costo_total_ars = cantidad × costo unitario en pesos ya redondeado` (plan A7), así el capital cierra exacto.
- **Descartado**: guardar solo USD y convertir al mostrar (el costo cambiaría con el dólar, contra lo decidido).

## 3. Límites de cada compra
- Hasta 10.000 unidades, USD 10.000 por unidad y $100.000 por dólar.
- **Por qué**: fast-check encontró que con límites más altos el total de una compra podía superar el mayor
  entero exacto de JavaScript (9 billones de centavos) y perder precisión. Con estos límites, holgados para el
  negocio, eso no puede pasar. La base y la app usan los mismos límites.

## 4. Stock solo por movimientos
- `movimientos_stock` es la única fuente: cada compra genera una entrada; anular genera una salida
  compensatoria. Las ventas y ajustes (módulos 1.3 y 1.6) van a agregar salidas en esta misma tabla.
- Una regla en la base exige el signo correcto por tipo (entradas positivas, salidas negativas).
- Vistas `v_stock_compras` y `v_stock_productos` (con `security_invoker`, o sea respetan RLS) calculan
  disponible, valor a costo en USD y pesos, y el costo de la próxima unidad FIFO.
- Orden FIFO: fecha de compra y, a igual fecha, `secuencia` (orden de carga, la pone la base).

## 5. Escrituras de compras solo por funciones (`registrar_compra`, `anular_compra`)
- Hacen compra + movimiento en una transacción (todo o nada).
- **Idempotentes**: el formulario genera el UUID en el celular; si se reenvía (doble toque, mala señal), la
  función devuelve la compra ya guardada. Mismo UUID con otros datos: error.
- Anular solo si no salió ninguna unidad de esa compra; exige motivo; anular dos veces no duplica.
- Validan fecha no futura (hora de Tucumán) y producto activo del mismo negocio.
- Los productos sí se crean/editan directo en la tabla (es configuración, no una operación de dinero), con RLS y
  permisos por columna: el celular solo puede tocar marca, modelo, precio general y activo.

## 6. Datos que pone la base, no el celular (trigger `completar_alta`)
- `registrado_por` = socio vinculado al usuario logueado (plan A1).
- `es_prueba` = según `negocios.modo_prueba` (plan A20).
- `creado_en` = hora del servidor.
- Triggers impiden modificar estos datos y borrar filas (`impedir_borrado`).

## 7. Datos de prueba (plan A20)
- `negocios.modo_prueba` arranca en verdadero; la app muestra la franja amarilla "MODO PRUEBA".
- `contar_datos_de_prueba()` y `borrar_datos_de_prueba()` solo las puede ejecutar el administrador (SQL Editor).
  El borrado exige la frase `BORRAR DATOS DE PRUEBA`, borra en orden, conserva negocio/socios/usuarios y se niega
  si algún dato real depende de uno de prueba. Instrucciones: `supabase/admin/borrar-datos-de-prueba.sql`.
- Cada módulo que agregue tablas las suma a estas dos funciones (y a sus pruebas).

## 8. Pantallas
- `/productos`: capital en mercadería (USD y pesos), buscador, lista con unidades.
- `/productos/[id]`: stock, valor a costo, próxima unidad FIFO, compras en orden FIFO, anular, editar.
- `/compras/nueva`: formulario con vista previa del costo en pesos; tipo de cambio sugerido = el de la última compra.
- `/compras`: historial.
- Rutas de socios agrupadas en `src/app/(app)/` con un layout que muestra la franja de modo prueba.
