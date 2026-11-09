"use client";

import { useActionState } from "react";
import { Aviso } from "@/componentes/Aviso";
import { Boton } from "@/componentes/Boton";
import { anularVisita, archivarCliente } from "../acciones";

export function DeshacerVisita({ visitaId, clienteId }: { visitaId: string; clienteId: string }) {
  const [estado, enviar, enviando] = useActionState(anularVisita, {});
  return (
    <form action={enviar} className="flex flex-col gap-2">
      <input type="hidden" name="visitaId" value={visitaId} />
      <input type="hidden" name="clienteId" value={clienteId} />
      <button type="submit" disabled={enviando} className="min-h-[44px] w-fit text-base font-medium text-peligro">
        {enviando ? "Deshaciendo…" : "Deshacer esta visita (la marqué por error)"}
      </button>
      {estado.error && <Aviso tipo="error">{estado.error}</Aviso>}
    </form>
  );
}

export function ArchivarCliente({ clienteId, archivado }: { clienteId: string; archivado: boolean }) {
  const [estado, enviar, enviando] = useActionState(archivarCliente, {});
  return (
    <form action={enviar} className="flex flex-col gap-2">
      <input type="hidden" name="clienteId" value={clienteId} />
      <input type="hidden" name="archivar" value={archivado ? "no" : "si"} />
      {!archivado && (
        <p className="text-sm text-texto-suave">
          Archivar lo saca de la búsqueda y de las visitas. No se pierde nada: se puede desarchivar.
        </p>
      )}
      <Boton type="submit" variante="secundario" disabled={enviando}>
        {enviando ? "Guardando…" : archivado ? "Desarchivar cliente" : "Archivar cliente"}
      </Boton>
      {estado.error && <Aviso tipo="error">{estado.error}</Aviso>}
    </form>
  );
}
