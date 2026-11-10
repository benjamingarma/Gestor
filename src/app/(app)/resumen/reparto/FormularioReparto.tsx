"use client";

import { useActionState, useState } from "react";
import { Aviso } from "@/componentes/Aviso";
import { Boton } from "@/componentes/Boton";
import { parsearImporte } from "@/lib/dinero";
import { configurarReparto } from "./acciones";

type Props = { socios: { id: string; nombre: string; actual: number }[]; hoy: string };

export function FormularioReparto({ socios, hoy }: Props) {
  const [estado, enviar, enviando] = useActionState(configurarReparto, {});
  const [valores, setValores] = useState(() =>
    Object.fromEntries(socios.map((s) => [s.id, (s.actual / 100).toLocaleString("es-AR", { maximumFractionDigits: 2 })])),
  );
  const suma = Object.values(valores).reduce((t, v) => {
    const p = parsearImporte(v);
    return p.ok ? t + p.centavos : NaN;
  }, 0);

  return (
    <form action={enviar} className="flex flex-col gap-4">
      {socios.map((s) => (
        <label key={s.id} className="flex items-center justify-between gap-3">
          <span className="text-lg">{s.nombre}</span>
          <span className="flex items-center gap-2">
            <input
              name={`pct-${s.id}`}
              inputMode="decimal"
              value={valores[s.id]}
              onChange={(e) => setValores((v) => ({ ...v, [s.id]: e.target.value }))}
              className="h-[50px] w-28 rounded-[14px] border border-borde bg-superficie px-3 text-right text-xl font-bold"
              aria-label={`Porcentaje de ${s.nombre}`}
            />
            <span className="text-xl">%</span>
          </span>
        </label>
      ))}
      <p className={`text-right font-semibold ${suma === 10_000 ? "text-acento" : "text-peligro"}`}>
        Suma: {Number.isNaN(suma) ? "—" : `${(suma / 100).toLocaleString("es-AR")} %`}
      </p>
      <label className="flex flex-col gap-1">
        <span className="font-medium">Rige desde</span>
        <input type="date" name="desde" defaultValue={hoy} min={hoy} className="min-h-[50px] rounded-[14px] border border-borde bg-superficie px-3.5 text-lg" />
        <span className="text-[0.82rem] text-texto-suave">
          Desde hoy o una fecha futura. Las ventas anteriores siguen con el porcentaje que tenían.
        </span>
      </label>
      {estado.error && <Aviso tipo="error">{estado.error}</Aviso>}
      <Boton type="submit" disabled={enviando || suma !== 10_000}>
        {enviando ? "Guardando…" : "Guardar reparto"}
      </Boton>
    </form>
  );
}
