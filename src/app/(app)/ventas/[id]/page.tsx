import Link from "next/link";
import { notFound } from "next/navigation";
import { Aviso } from "@/componentes/Aviso";
import { BotonEnlace } from "@/componentes/BotonEnlace";
import { Encabezado } from "@/componentes/Encabezado";
import { obtenerVenta } from "@/datos/ventas";
import { formatearDolares, formatearPesos, formatearTipoDeCambio } from "@/lib/dinero";
import { formatearDia, formatearFechaHora } from "@/lib/fechas";
import { obtenerSocioActual } from "@/lib/sesion";
import { esUuid } from "@/lib/uuid";
import { AnularVenta } from "./AnularVenta";

export default async function PaginaVenta({ params, searchParams }: PageProps<"/ventas/[id]">) {
  const { id } = await params;
  const { ok } = await searchParams;
  if (!esUuid(id)) notFound();
  const socio = await obtenerSocioActual();
  const venta = await obtenerVenta(socio.negocioId, id);
  if (!venta) notFound();
  const anulada = venta.anulado_en !== null;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-4 py-6">
      <Encabezado titulo={`Venta a ${venta.cliente_nombre}`} volverA="/ventas" subtitulo={formatearDia(venta.dia)} />
      {ok === "venta" && <Aviso tipo="ok">Venta guardada.</Aviso>}
      {ok === "anulada" && <Aviso tipo="ok">Venta anulada. El stock volvió a sus compras.</Aviso>}
      {anulada && (
        <p className="rounded-lg border border-peligro px-4 py-3 text-peligro">
          ANULADA el {formatearFechaHora(new Date(venta.anulado_en!))} por {venta.anulado_por_nombre}. Motivo: {venta.motivo_anulacion}
        </p>
      )}

      <section className={`flex flex-col gap-1 rounded-xl border border-borde bg-superficie p-4 ${anulada ? "opacity-60" : ""}`}>
        <div className="flex items-baseline justify-between">
          <span>Total</span>
          <span className="text-3xl font-bold">{formatearPesos(venta.importe)}</span>
        </div>
        <div className="flex justify-between text-base">
          <span className="text-texto-suave">Costo (FIFO)</span>
          <span>
            {formatearPesos(venta.costo_ars)} · {formatearDolares(venta.costo_usd)}
          </span>
        </div>
        <div className="flex justify-between text-lg font-semibold">
          <span>Ganancia</span>
          <span className={venta.ganancia < 0 ? "text-peligro" : ""}>{formatearPesos(venta.ganancia)}</span>
        </div>
        <p className="mt-1 text-sm text-texto-suave">Cobrado y saldo pendiente: llegan con el módulo de cobros (1.4).</p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-bold">Productos</h2>
        {venta.renglones.map((r) => (
          <article key={r.id} className="flex flex-col gap-1 rounded-xl border border-borde bg-superficie p-4">
            <span className="text-lg font-semibold">{r.producto}</span>
            <span>
              {r.cantidad} × {formatearPesos(r.precioUnitario)} = <strong>{formatearPesos(r.cantidad * r.precioUnitario)}</strong>
            </span>
            <span className="text-sm text-texto-suave">
              Costo {formatearPesos(r.costoArs)} ({formatearDolares(r.costoUsd)}) · Ganancia{" "}
              {formatearPesos(r.cantidad * r.precioUnitario - r.costoArs)}
            </span>
            <ul className="mt-1 flex flex-col gap-0.5 border-l-2 border-borde pl-3 text-sm text-texto-suave">
              {r.consumos.map((c, i) => (
                <li key={i}>
                  {c.cantidad} u de la compra del {formatearDia(c.fechaCompra)} (TC {formatearTipoDeCambio(c.tipoCambio)}
                  {c.estimado ? ", estimado" : ""}) a {formatearPesos(c.costoUnitarioArs)} c/u
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <section className="flex flex-col gap-1 text-base">
        <span>
          Vendió: <strong>{venta.vendido_por_nombre}</strong> · Cargó: {venta.registrado_por_nombre}
        </span>
        {venta.nota && <span>Nota: {venta.nota}</span>}
        <Link href={`/clientes/${venta.cliente_id}`} className="min-h-[44px] content-center font-medium text-acento">
          Ver cliente →
        </Link>
      </section>

      {!anulada && (
        <BotonEnlace href={`/ventas/nueva?cliente=${venta.cliente_id}`} variante="secundario">
          Otra venta a {venta.cliente_nombre}
        </BotonEnlace>
      )}
      {!anulada && <AnularVenta ventaId={venta.venta_id} />}
    </main>
  );
}
