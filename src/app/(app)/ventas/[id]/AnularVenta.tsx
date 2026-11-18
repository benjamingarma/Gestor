"use client";

import { useActionState } from "react";
import { Aviso } from "@/componentes/Aviso";
import { Boton } from "@/componentes/Boton";
import { Campo } from "@/componentes/Campo";
import { formatearPesos } from "@/lib/dinero";
import { anularVenta } from "../acciones";

/** `pagadoAlVender`: pagos registrados junto con la venta (decisión 5: se pregunta si se devolvió la plata). */
export function AnularVenta({ ventaId, pagadoAlVender }: { ventaId: string; pagadoAlVender: number }) {
  const [estado, enviar, enviando] = useActionState(anularVenta, {});
  return (
    <details className="rounded-[20px] border border-borde bg-superficie shadow-tarjeta p-3">
      <summary className="min-h-[44px] cursor-pointer content-center font-medium text-peligro">Anular esta venta</summary>
      <form action={enviar} className="mt-2 flex flex-col gap-3">
        <input type="hidden" name="ventaId" value={ventaId} />
        <Campo etiqueta="Motivo" name="motivo" placeholder="Ej: la cargué mal" required />
        {pagadoAlVender > 0 && (
          <label className="flex min-h-[44px] items-start gap-3 rounded-[14px] bg-superficie-2 px-3 py-2.5 text-[0.88rem] leading-snug">
            <input type="checkbox" name="devolvio" value="si" defaultChecked className="mt-0.5 h-5 w-5 shrink-0 accent-acento" />
            <input type="hidden" name="devolvio" value="no" />
            <span>
              <b>Se le devolvió la plata ({formatearPesos(pagadoAlVender)})</b>
              <br />
              <span className="text-texto-suave">Se anula también el pago que se registró con la venta. Si no se le devolvió, desmarcalo: el pago queda a cuenta del cliente.</span>
            </span>
          </label>
        )}
        <p className="text-[0.82rem] text-texto-suave">
          La venta no se borra: queda en el historial como anulada, no cuenta para la ganancia y cada unidad vuelve al
          stock de la compra de la que salió, con su costo original. Si ya estaba cobrada, lo cobrado se aplica a otras deudas del cliente o le queda a favor.
        </p>
        {estado.error && <Aviso tipo="error">{estado.error}</Aviso>}
        <Boton type="submit" variante="secundario" disabled={enviando} className="text-peligro">
          {enviando ? "Anulando…" : "Confirmar anulación"}
        </Boton>
      </form>
    </details>
  );
}
