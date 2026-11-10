import { estadoCobro } from "@/dominio/cuentaCorriente";
import { formatearPesos } from "@/lib/dinero";

/** Etiqueta "Pagada" / "Debe $X" de una venta. */
export function EtiquetaCobro({ importe, cobrado, saldo }: { importe: number; cobrado: number; saldo: number }) {
  const e = estadoCobro({ importe, cobrado });
  if (e === "pagada") return <span className="rounded-full bg-acento-suave px-2 py-0.5 text-[0.72rem] font-semibold text-acento">Pagada</span>;
  return (
    <span className="num rounded-full bg-peligro-suave px-2 py-0.5 text-[0.72rem] font-semibold text-peligro">
      Debe {formatearPesos(saldo)}
    </span>
  );
}
