import { formatearDolares, formatearPesos, formatearTipoDeCambio } from "@/lib/dinero";
import { formatearDia } from "@/lib/fechas";
import type { StockCompra } from "@/datos/inventario";
import { FormularioAnular } from "./FormularioAnular";

function Etiqueta({ children, color }: { children: React.ReactNode; color: "gris" | "ambar" | "rojo" }) {
  const estilos = {
    gris: "border-borde text-texto-suave",
    ambar: "border-amber-500 text-amber-700 dark:text-amber-300",
    rojo: "border-peligro text-peligro",
  }[color];
  return <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${estilos}`}>{children}</span>;
}

/** Una compra con su costo en USD, tipo de cambio, costo en pesos y lo que queda. */
export function TarjetaCompra({
  compra,
  titulo,
  permitirAnular,
}: {
  compra: StockCompra;
  titulo?: string;
  permitirAnular: boolean;
}) {
  const anulada = compra.anulado_en !== null;
  const sinSalidas = compra.disponible === compra.cantidad;
  return (
    <article className={`flex flex-col gap-2 rounded-xl border border-borde bg-superficie p-4 ${anulada ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{formatearDia(compra.fecha)}</span>
        {titulo && <span className="font-semibold">· {titulo}</span>}
        {compra.origen === "inventario_inicial" && <Etiqueta color="gris">Stock inicial</Etiqueta>}
        {compra.tipo_cambio_estimado && <Etiqueta color="ambar">TC estimado</Etiqueta>}
        {anulada && <Etiqueta color="rojo">Anulada</Etiqueta>}
      </div>
      <p className="text-base">
        {compra.cantidad} u × {formatearDolares(compra.costo_unitario_usd)} · TC {formatearTipoDeCambio(compra.tipo_cambio)}
        <br />
        <span className="font-semibold">= {formatearPesos(compra.costo_unitario_ars)} c/u</span>
      </p>
      <p className="text-sm text-texto-suave">
        Total {formatearDolares(compra.costo_total_usd)} · {formatearPesos(compra.costo_total_ars)}
      </p>
      {!anulada && (
        <p className="text-sm">
          Quedan <strong>{compra.disponible}</strong> de {compra.cantidad}
        </p>
      )}
      {compra.nota && <p className="text-sm text-texto-suave">Nota: {compra.nota}</p>}
      {anulada && compra.motivo_anulacion && (
        <p className="text-sm text-texto-suave">Motivo de anulación: {compra.motivo_anulacion}</p>
      )}
      {permitirAnular && !anulada && sinSalidas && (
        <FormularioAnular compraId={compra.compra_id} productoId={compra.producto_id} />
      )}
    </article>
  );
}
