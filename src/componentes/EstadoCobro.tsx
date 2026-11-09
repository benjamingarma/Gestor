import { estadoCobro } from "@/dominio/cuentaCorriente";
import { formatearPesos } from "@/lib/dinero";

/** Etiqueta "Pagada" / "Debe $X" de una venta. */
export function EtiquetaCobro({ importe, cobrado, saldo }: { importe: number; cobrado: number; saldo: number }) {
  const e = estadoCobro({ importe, cobrado });
  if (e === "pagada") return <span className="rounded-full border border-acento px-2 py-0.5 text-xs font-semibold text-acento">Pagada</span>;
  return (
    <span className="rounded-full bg-peligro px-2 py-0.5 text-xs font-semibold text-white">
      Debe {formatearPesos(saldo)}
    </span>
  );
}
