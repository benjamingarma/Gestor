#!/usr/bin/env bash
# Prueba de concurrencia (plan 11.1 #13 y A11): dos socios venden la ÚLTIMA unidad al mismo tiempo,
# y después uno la vende mientras el otro la da de baja con un ajuste (módulo 1.6).
# En cada caso debe grabarse UNA sola salida y la otra recibir "No hay stock suficiente".
# Usa dos conexiones reales a la base local (no se puede hacer dentro de pgTAP).
set -euo pipefail
DB_URL="${DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
N=99999999-0000-4000-8000-000000000001   # negocio de esta prueba
U=99999999-0000-4000-8000-0000000000a1   # usuario
S=99999999-0000-4000-8000-0000000000b1   # socio
P=99999999-0000-4000-8000-0000000000c1   # producto
C=99999999-0000-4000-8000-0000000000d1   # cliente
K=99999999-0000-4000-8000-0000000000e1   # compra
VA=99999999-0000-4000-8000-0000000000f1
VB=99999999-0000-4000-8000-0000000000f2
VC=99999999-0000-4000-8000-0000000000f3
K2=99999999-0000-4000-8000-0000000000e2  # segunda compra (para venta contra ajuste)
AJ=99999999-0000-4000-8000-000000000101  # ajuste

limpiar() {
  psql "$DB_URL" -q -v ON_ERROR_STOP=1 >/dev/null <<SQL
select * from public.borrar_datos_de_prueba('$N', 'BORRAR DATOS DE PRUEBA');
delete from public.socios where negocio_id = '$N';
delete from public.negocios where id = '$N';
delete from auth.users where id = '$U';
SQL
}
psql "$DB_URL" -q -c "select 1 from public.negocios where id = '$N'" | grep -q 1 && limpiar || true

psql "$DB_URL" -q -v ON_ERROR_STOP=1 >/dev/null <<SQL
insert into auth.users (id, email, aud, role) values ('$U', 'concurrencia@pgtap.test', 'authenticated', 'authenticated');
insert into public.negocios (id, nombre) values ('$N', 'Prueba de concurrencia');
insert into public.socios (id, negocio_id, nombre, user_id, orden) values ('$S', '$N', 'Socio', '$U', 1);
insert into public.productos (id, negocio_id, marca, modelo, registrado_por) values ('$P', '$N', 'Ultima', 'Unidad', '$S');
insert into public.clientes (id, negocio_id, nombre, registrado_por) values ('$C', '$N', 'Cliente', '$S');
insert into public.compras (id, negocio_id, producto_id, fecha, cantidad, costo_unitario_usd, tipo_cambio, registrado_por)
  values ('$K', '$N', '$P', current_date - 1, 1, 500, 140000, '$S');
insert into public.movimientos_stock (negocio_id, compra_id, producto_id, tipo, cantidad, costo_unitario_usd, costo_unitario_ars, fecha, registrado_por)
  values ('$N', '$K', '$P', 'compra', 1, 500, 700000, now(), '$S');
SQL

vender() { # $1 = id de venta. Vende 1 unidad y mantiene la transacción abierta 2 segundos.
  psql "$DB_URL" -q -v ON_ERROR_STOP=1 2>&1 <<SQL || true
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"$U","role":"authenticated"}', true);
select 'VENDIDA' from public.registrar_venta('$1', '$N', '$C', '[{"producto_id":"$P","cantidad":1,"precio_unitario":1000000}]');
select pg_sleep(2);
commit;
SQL
}

vender "$VA" > /tmp/concurrencia_a.txt &
sleep 0.5
vender "$VB" > /tmp/concurrencia_b.txt &
wait

ventas=$(psql "$DB_URL" -tAq -c "select count(*) from public.ventas where negocio_id = '$N'")
stock=$(psql "$DB_URL" -tAq -c "select coalesce(sum(cantidad),0) from public.movimientos_stock where negocio_id = '$N'")
rechazos=$(cat /tmp/concurrencia_a.txt /tmp/concurrencia_b.txt | grep -c "No hay stock suficiente" || true)

echo "ventas grabadas: $ventas · stock final: $stock · rechazadas por falta de stock: $rechazos"
if [ "$ventas" = "1" ] && [ "$stock" = "0" ] && [ "$rechazos" = "1" ]; then
  echo "OK: dos ventas simultáneas de la última unidad -> se grabó una sola"
else
  echo "FALLÓ la prueba de concurrencia"; cat /tmp/concurrencia_a.txt /tmp/concurrencia_b.txt; limpiar; exit 1
fi

# Segunda parte: venta contra ajuste de la última unidad (otra compra de 1 unidad).
psql "$DB_URL" -q -v ON_ERROR_STOP=1 >/dev/null <<SQL
insert into public.compras (id, negocio_id, producto_id, fecha, cantidad, costo_unitario_usd, tipo_cambio, registrado_por)
  values ('$K2', '$N', '$P', current_date - 1, 1, 500, 140000, '$S');
insert into public.movimientos_stock (negocio_id, compra_id, producto_id, tipo, cantidad, costo_unitario_usd, costo_unitario_ars, fecha, registrado_por)
  values ('$N', '$K2', '$P', 'compra', 1, 500, 700000, now(), '$S');
SQL

ajustar() { # $1 = id de ajuste. Da de baja 1 unidad y mantiene la transacción abierta 2 segundos.
  psql "$DB_URL" -q -v ON_ERROR_STOP=1 2>&1 <<SQL || true
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"$U","role":"authenticated"}', true);
select 'AJUSTADA' from public.registrar_ajuste('$1', '$N', '$P', 1, 'rotura');
select pg_sleep(2);
commit;
SQL
}

vender "$VC" > /tmp/concurrencia_c.txt &
sleep 0.5
ajustar "$AJ" > /tmp/concurrencia_d.txt &
wait

salidas=$(psql "$DB_URL" -tAq -c "select (select count(*) from public.ventas where negocio_id = '$N') + (select count(*) from public.ajustes_stock where negocio_id = '$N')")
stock=$(psql "$DB_URL" -tAq -c "select coalesce(sum(cantidad),0) from public.movimientos_stock where negocio_id = '$N'")
rechazos=$(cat /tmp/concurrencia_c.txt /tmp/concurrencia_d.txt | grep -c "No hay stock suficiente" || true)
limpiar

echo "venta contra ajuste · salidas grabadas en total: $salidas (esperadas 2) · stock final: $stock · rechazadas: $rechazos"
if [ "$salidas" = "2" ] && [ "$stock" = "0" ] && [ "$rechazos" = "1" ]; then
  echo "OK: venta y ajuste simultáneos de la última unidad -> se grabó uno solo"
else
  echo "FALLÓ la prueba de concurrencia (venta contra ajuste)"; cat /tmp/concurrencia_c.txt /tmp/concurrencia_d.txt; exit 1
fi
