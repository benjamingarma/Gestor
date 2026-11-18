-- Huella de control de los datos (módulo 1.9): cantidad de filas por tabla y sumas de dinero y stock.
-- Se calcula antes del backup y después de restaurar; tienen que dar exactamente igual.
-- Solo muestra cantidades y totales, nunca datos de clientes.
select 'filas.' || t.relname || '=' || (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from public.%I', t.relname), false, true, '')))[1]::text
from pg_class t join pg_namespace n on n.oid = t.relnamespace
where n.nspname = 'public' and t.relkind = 'r'
union all select 'secuencia.' || sequencename || '=' || coalesce(last_value, 0) from pg_sequences where schemaname = 'public'
union all select 'ventas.importe=' || coalesce(sum(importe), 0) from public.v_ventas where anulado_en is null
union all select 'ventas.ganancia=' || coalesce(sum(ganancia), 0) from public.v_ventas where anulado_en is null
union all select 'pagos.importe=' || coalesce(sum(importe), 0) from public.pagos where anulado_en is null
union all select 'saldos.total=' || coalesce(sum(saldo), 0) from public.v_cuentas_clientes
union all select 'stock.unidades=' || coalesce(sum(cantidad), 0) from public.movimientos_stock
union all select 'capital.stock_ars=' || coalesce(sum(stock_ars), 0) from public.v_capital
union all select 'capital.stock_usd=' || coalesce(sum(stock_usd), 0) from public.v_capital
order by 1;
