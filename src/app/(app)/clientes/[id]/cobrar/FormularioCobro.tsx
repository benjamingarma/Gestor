"use client";

import { useActionState, useState } from "react";
import { Aviso } from "@/componentes/Aviso";
import { Boton } from "@/componentes/Boton";
import { Campo } from "@/componentes/Campo";
import { formatearPesos, parsearImporte } from "@/lib/dinero";
import { nuevoUuid } from "@/lib/uuid";
import { registrarPago } from "../../../cobros/acciones";

const MEDIOS = [
  { id: "efectivo", texto: "Efectivo" },
  { id: "transferencia", texto: "Transferencia" },
  { id: "mercado_pago", texto: "Mercado Pago" },
] as const;

type Props = {
  clienteId: string;
  saldo: number; // > 0 debe
  importeInicial: string;
  socios: { id: string; nombre: string }[];
  socioActual: string;
  hoy: string;
  volverA: string;
};

export function FormularioCobro({ clienteId, saldo, importeInicial, socios, socioActual, hoy, volverA }: Props) {
  const [estado, enviar, enviando] = useActionState(registrarPago, {});
  const [id] = useState(() => nuevoUuid()); // un cobro = un identificador: reenviar no duplica
  const [importe, setImporte] = useState(importeInicial);
  const [medio, setMedio] = useState("");
  const e = estado.errores ?? {};

  const p = parsearImporte(importe);
  const despues = p.ok ? saldo - p.centavos : null;

  return (
    <form action={enviar} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="clienteId" value={clienteId} />
      <input type="hidden" name="volverA" value={volverA} />
      <input type="hidden" name="medio" value={medio} />

      <Campo
        etiqueta="¿Cuánto pagó?"
        name="importe"
        inputMode="decimal"
        autoComplete="off"
        value={importe}
        onChange={(ev) => setImporte(ev.target.value)}
        error={e.importe}
        placeholder="Ej: 50.000"
        className="text-2xl font-bold"
      />
      {saldo > 0 && (
        <button type="button" onClick={() => setImporte(formatearPesos(saldo).replace("$ ", ""))} className="-mt-2 min-h-[44px] w-fit font-medium text-acento">
          Pagó todo ({formatearPesos(saldo)})
        </button>
      )}

      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-base font-medium">¿Cómo pagó?</legend>
        <div className="grid grid-cols-3 gap-2">
          {MEDIOS.map((m) => (
            <button
              key={m.id}
              type="button"
              aria-pressed={medio === m.id}
              onClick={() => setMedio(m.id)}
              className={`min-h-[52px] rounded-xl border px-1 text-base font-semibold ${medio === m.id ? "border-acento bg-acento text-acento-texto" : "border-borde bg-superficie"}`}
            >
              {m.texto}
            </button>
          ))}
        </div>
        {e.medio && <span className="text-sm text-peligro">{e.medio}</span>}
      </fieldset>

      <label className="flex flex-col gap-1">
        <span className="text-base font-medium">¿Quién recibió la plata?</span>
        <select name="recibidoPor" defaultValue={socioActual} className="min-h-[52px] rounded-xl border border-borde bg-superficie px-3 text-lg">
          {socios.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nombre}
            </option>
          ))}
        </select>
      </label>

      <details className="rounded-xl border border-borde bg-superficie p-3">
        <summary className="min-h-[44px] cursor-pointer content-center font-medium">Más opciones (fecha, nota)</summary>
        <div className="mt-2 flex flex-col gap-3">
          <Campo etiqueta="Fecha del cobro" name="fecha" type="date" defaultValue={hoy} max={hoy} error={e.fecha} />
          <Campo etiqueta="Nota" name="nota" maxLength={500} autoComplete="off" />
        </div>
      </details>

      <section aria-live="polite" className="rounded-xl border border-borde bg-superficie p-4 text-base">
        <div className="flex justify-between">
          <span>{saldo >= 0 ? "Debe ahora" : "A favor ahora"}</span>
          <strong>{formatearPesos(Math.abs(saldo))}</strong>
        </div>
        {despues !== null && p.ok && p.centavos > 0 && (
          <div className="flex justify-between text-lg">
            <span>Después del cobro</span>
            <strong className={despues > 0 ? "text-peligro" : "text-acento"}>
              {despues > 0 ? `debe ${formatearPesos(despues)}` : despues < 0 ? `${formatearPesos(-despues)} a favor` : "queda al día"}
            </strong>
          </div>
        )}
        <p className="mt-1 text-xs text-texto-suave">El cobro se aplica solo a las deudas más viejas.</p>
      </section>

      {estado.error && <Aviso tipo="error">{estado.error}</Aviso>}
      <Boton type="submit" disabled={enviando}>
        {enviando ? "Guardando…" : p.ok && p.centavos > 0 ? `Registrar cobro de ${formatearPesos(p.centavos)}` : "Registrar cobro"}
      </Boton>
    </form>
  );
}
