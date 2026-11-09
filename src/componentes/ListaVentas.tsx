import Link from "next/link";
import type { ResumenVenta } from "@/datos/ventas";
import { EtiquetaCobro } from "./EstadoCobro";
import { formatearPesos } from "@/lib/dinero";
import { formatearDia } from "@/lib/fechas";

export function ListaVentas({
  ventas,
  mostrarCliente = true,
  cobros,
  textoVacio = "Todavía no hay ventas.",
}: {
  ventas: ResumenVenta[];
  mostrarCliente?: boolean;
  cobros?: Map<string, { cobrado: number; saldo: number }>;
  textoVacio?: string;
}) {
  if (ventas.length === 0) return <p className="text-texto-suave">{textoVacio}</p>;
  return (
    <ul className="flex flex-col gap-2">
      {ventas.map((v) => {
        const anulada = v.anulado_en !== null;
        return (
          <li key={v.venta_id}>
            <Link
              href={`/ventas/${v.venta_id}`}
              className={`flex min-h-[64px] items-center justify-between gap-3 rounded-xl border border-borde bg-superficie px-4 py-3 ${anulada ? "opacity-60" : ""}`}
            >
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-semibold">{mostrarCliente ? v.cliente_nombre : `${v.unidades} unidades`}</span>
                <span className="text-sm text-texto-suave">
                  {formatearDia(v.dia)}
                  {mostrarCliente ? ` · ${v.unidades} u` : ""} · {v.vendido_por_nombre}
                  {anulada ? " · ANULADA" : ""}
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end">
                <span className={`text-lg font-bold ${anulada ? "line-through" : ""}`}>{formatearPesos(v.importe)}</span>
                {!anulada && <span className="text-sm text-texto-suave">gan. {formatearPesos(v.ganancia)}</span>}
                {!anulada && cobros?.get(v.venta_id) && (
                  <EtiquetaCobro importe={v.importe} cobrado={cobros.get(v.venta_id)!.cobrado} saldo={cobros.get(v.venta_id)!.saldo} />
                )}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
