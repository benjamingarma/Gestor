"use client";

import { useActionState } from "react";
import { Aviso } from "@/componentes/Aviso";
import { Boton } from "@/componentes/Boton";
import { Campo } from "@/componentes/Campo";
import { anularCompra } from "./acciones";

export function FormularioAnular({ compraId, productoId }: { compraId: string; productoId: string }) {
  const [estado, enviar, enviando] = useActionState(anularCompra, {});
  return (
    <details className="rounded-[14px] border border-borde px-3 py-2">
      <summary className="min-h-[44px] cursor-pointer content-center font-medium text-peligro">Anular esta compra</summary>
      <form action={enviar} className="mt-2 flex flex-col gap-3">
        <input type="hidden" name="compraId" value={compraId} />
        <input type="hidden" name="productoId" value={productoId} />
        <Campo etiqueta="Motivo" name="motivo" id={`motivo-${compraId}`} placeholder="Ej: la cargué mal" required />
        <p className="text-[0.82rem] text-texto-suave">
          La compra no se borra: queda en el historial como anulada y su stock vuelve a cero.
        </p>
        {estado.error && <Aviso tipo="error">{estado.error}</Aviso>}
        <Boton type="submit" variante="secundario" disabled={enviando} className="text-peligro">
          {enviando ? "Anulando…" : "Confirmar anulación"}
        </Boton>
      </form>
    </details>
  );
}
