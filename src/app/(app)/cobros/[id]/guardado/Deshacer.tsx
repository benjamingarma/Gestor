"use client";

import { useActionState, useState } from "react";
import { Aviso } from "@/componentes/Aviso";
import { anularPago } from "../../acciones";

/** "Deshacer (anular)" de la confirmación del cobro: pide el motivo, como toda anulación. */
export function DeshacerCobro({ pagoId, clienteId }: { pagoId: string; clienteId: string }) {
  const [abierto, setAbierto] = useState(false);
  const [estado, enviar, enviando] = useActionState(anularPago, {});
  const boton = "flex min-h-[56px] w-full items-center justify-center rounded-2xl border border-borde bg-superficie text-[1.1rem] font-bold";
  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className={boton}>
        Deshacer (anular)
      </button>
    );
  }
  return (
    <form action={enviar} className="flex flex-col gap-2 rounded-[20px] border border-borde bg-superficie p-4 text-left">
      <input type="hidden" name="pagoId" value={pagoId} />
      <input type="hidden" name="clienteId" value={clienteId} />
      <input type="hidden" name="desde" value="guardado" />
      <label className="flex flex-col gap-1">
        <span className="font-semibold">¿Por qué lo anulás?</span>
        <input name="motivo" required autoFocus placeholder="Ej: lo cargué mal" className="min-h-[50px] rounded-[14px] border border-borde bg-superficie px-3" />
      </label>
      <p className="text-[0.82rem] text-texto-suave">El pago queda en el historial como anulado y la deuda vuelve a como estaba.</p>
      {estado.error && <Aviso tipo="error">{estado.error}</Aviso>}
      <button type="submit" disabled={enviando} className={`${boton} text-peligro disabled:opacity-50`}>
        {enviando ? "Anulando…" : "Confirmar anulación"}
      </button>
      <button type="button" onClick={() => setAbierto(false)} className="min-h-[44px] font-semibold text-acento">
        No anular
      </button>
    </form>
  );
}
