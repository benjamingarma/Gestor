# Venta a un cliente nuevo (módulo 1.7, pedido de los socios del 10/11/2026)

## Qué se pidió
Crear el cliente desde la pantalla "Nueva venta" sin salir de ella, sin clientes huérfanos si se cancela o la
venta falla, e idempotente ante el doble toque de "Guardar".

## Decisión (aprobada por los socios el 10/11/2026)
- Los clientes **no se pueden borrar** (trigger `impedir_borrado`), y la app llama a la base de a una operación
  por vez. Crear el cliente antes de la venta, o en dos pasos al guardar, podía dejar clientes huérfanos.
- Solución: función nueva `registrar_venta_cliente_nuevo` (migración `20261115120000_venta_cliente_nuevo.sql`)
  que, **en una sola transacción**, crea el cliente y llama a la misma `registrar_venta` de siempre. Si la venta
  falla, el cliente tampoco queda.
- La pantalla no guarda nada hasta "Guardar venta" (PR B).
- Descartado: clientes "provisorios" que se borran después (cambia tabla y triggers) y crear en dos pasos
  archivando el cliente si la venta falla (deja basura).

## Permisos (sin privilegios elevados)
- `registrar_venta_cliente_nuevo` es **SECURITY INVOKER**: corre con los permisos del usuario logueado.
- El alta del cliente pasa por lo mismo que "Nuevo cliente": RLS `socios crean clientes` (solo en un negocio del
  que sos socio), permisos por columna de `clientes` y el trigger `completar_alta` (`es_prueba` según el modo del
  negocio; `registrado_por` = socio logueado).
- La única parte con privilegios es `registrar_venta`, que ya existía y controla `es_socio` antes de hacer nada.
- `revoke` a `public` y `anon`; `execute` solo para `authenticated`.

## Reglas
- Nombre repetido: se compara sin espacios de más, sin mayúsculas y sin tildes (`nombre_para_comparar`, igual que
  `normalizar()` de `src/lib/texto.ts`). No se crea otro: error `23505` con `hint = cliente_duplicado` y el id del
  existente en `detail`, para ofrecer "Usar a …". Mensaje: el mismo de "Nuevo cliente" (agregar barrio o apellido).
- Valores por defecto del cliente nuevo: visita cada 14 días, sin notas (se completan desde la ficha).
- Idempotencia: cliente y venta con UUID del celular. Reintento con los mismos datos devuelve la misma venta; dos
  llamadas simultáneas: la segunda espera a la primera (`on conflict (id) do nothing`) y recibe la misma venta.

## Pruebas
- pgTAP `supabase/tests/07_venta_cliente_nuevo.test.sql` (39): alta + venta, valores por defecto y `es_prueba`,
  reintento, nombre repetido con y sin tildes, ventas que fallan sin dejar cliente, datos inválidos, otro negocio,
  negocio en modo real (`es_prueba = false`), anónimo, y que la función es SECURITY INVOKER.
- `supabase/tests/concurrencia.sh`, tercera parte: dos "Guardar" simultáneos → un cliente y una venta.
- Se verificó que las pruebas fallan con una versión "en dos pasos" de la función y sin el `on conflict`.
