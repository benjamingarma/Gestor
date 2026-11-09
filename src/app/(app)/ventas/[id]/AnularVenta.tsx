"use client";

import { useActionState } from "react";
import { Aviso } from "@/componentes/Aviso";
import { Boton } from "@/componentes/Boton";
import { Campo } from "@/componentes/Campo";
import { anularVenta } from "../acciones";

export function AnularVenta({ ventaId }: { ventaId: string }) {
  const [estado, enviar, enviando] = useActionState(anularVenta, {});
  return (
    <details className="rounded-xl border border-borde bg-superficie p-3">
      <summary className="min-h-[44px] cursor-pointer content-center font-medium text-peligro">Anular esta venta</summary>
      <form action={enviar} className="mt-2 flex flex-col gap-3">
        <input type="hidden" name="ventaId" value={ventaId} />
        <Campo etiqueta="Motivo" name="motivo" placeholder="Ej: la cargué mal" required />
        <p className="text-sm text-texto-suave">
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
