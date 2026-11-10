"use client";

import { useActionState, useState } from "react";
import { Aviso } from "@/componentes/Aviso";
import { Boton } from "@/componentes/Boton";
import { nuevoUuid } from "@/lib/uuid";
import { marcarVisitado } from "./acciones";

/** Botón "Visitado hoy". En la ficha del cliente permite elegir otra fecha. */
export function BotonVisitado({
  clienteId,
  volverA,
  hoy,
  conFecha = false,
}: {
  clienteId: string;
  volverA: "lista" | "ficha";
  hoy: string;
  conFecha?: boolean;
}) {
  const [estado, enviar, enviando] = useActionState(marcarVisitado, {});
  // Un identificador por visita: si se toca dos veces, se guarda una sola.
  const [id] = useState(() => nuevoUuid());
  const [otraFecha, setOtraFecha] = useState(false);

  return (
    <form action={enviar} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="clienteId" value={clienteId} />
      <input type="hidden" name="volverA" value={volverA} />
      {conFecha && otraFecha && (
        <label className="flex flex-col gap-1">
          <span className="text-base font-medium">Fecha de la visita</span>
          <input type="date" name="fecha" defaultValue={hoy} max={hoy} className="min-h-[50px] rounded-[14px] border border-borde bg-superficie px-3.5 text-lg" />
        </label>
      )}
      <Boton type="submit" variante={volverA === "lista" ? "secundario" : "principal"} disabled={enviando} className={volverA === "lista" ? "min-h-[44px] text-base" : ""}>
        {enviando ? "Guardando…" : conFecha && otraFecha ? "Marcar visitado" : volverA === "lista" ? "✓ Visitado" : "✓ Visitado hoy"}
      </Boton>
      {conFecha && !otraFecha && (
        <button type="button" onClick={() => setOtraFecha(true)} className="min-h-[44px] text-base font-medium text-acento">
          Lo visité otro día
        </button>
      )}
      {estado.error && <Aviso tipo="error">{estado.error}</Aviso>}
    </form>
  );
}
