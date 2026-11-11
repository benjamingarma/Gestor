"use client";

import { useActionState, useState } from "react";
import { Aviso } from "@/componentes/Aviso";
import { Boton } from "@/componentes/Boton";
import { Campo } from "@/componentes/Campo";
import { nuevoUuid } from "@/lib/uuid";
import type { CamposCliente, EstadoCliente } from "./acciones";

type Props = {
  accion: (p: EstadoCliente, f: FormData) => Promise<EstadoCliente>;
  inicial?: CamposCliente & { id: string };
  textoBoton: string;
};

export function FormularioCliente({ accion, inicial, textoBoton }: Props) {
  const [estado, enviar, enviando] = useActionState(accion, {});
  const [id] = useState(() => inicial?.id ?? nuevoUuid());
  const v = estado.valores ?? inicial;
  const e = estado.errores ?? {};

  return (
    <form action={enviar} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="id" value={id} />
      <Campo etiqueta="Nombre" name="nombre" defaultValue={v?.nombre} autoCapitalize="words" autoComplete="off" required error={e.nombre} placeholder="Ej: Ana Gómez" />
      <Campo
        etiqueta="Teléfono (opcional)"
        name="telefono"
        type="tel"
        inputMode="tel"
        autoComplete="off"
        defaultValue={v?.telefono}
        error={e.telefono}
        placeholder="Ej: 381 15 555-1234"
        ayuda="Si no ponés característica, se asume 381 para WhatsApp."
      />
      <Campo
        etiqueta="Dirección (opcional)"
        name="direccion"
        autoComplete="off"
        maxLength={210}
        defaultValue={v?.direccion}
        error={e.direccion}
        placeholder="Ej: San Martín 450, Yerba Buena"
      />
      <Campo
        etiqueta="Visitar cada (días)"
        name="intervalo"
        inputMode="numeric"
        autoComplete="off"
        defaultValue={v?.intervalo ?? "14"}
        error={e.intervalo}
      />
      <label className="flex flex-col gap-1">
        <span className="text-base font-medium">Notas (opcional)</span>
        <textarea
          name="notas"
          defaultValue={v?.notas}
          rows={3}
          maxLength={1000}
          className="rounded-[20px] border border-borde bg-superficie shadow-tarjeta px-4 py-3 text-lg"
          placeholder="Ej: horario, preferencias"
        />
        {e.notas && <span className="text-[0.82rem] text-peligro">{e.notas}</span>}
      </label>
      {estado.error && <Aviso tipo="error">{estado.error}</Aviso>}
      <Boton type="submit" disabled={enviando}>
        {enviando ? "Guardando…" : textoBoton}
      </Boton>
    </form>
  );
}
