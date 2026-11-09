"use client";

import { useActionState, useState } from "react";
import { Aviso } from "@/componentes/Aviso";
import { Boton } from "@/componentes/Boton";
import { Campo } from "@/componentes/Campo";
import { nuevoUuid } from "@/lib/uuid";
import { anularPago, anularSaldoInicial, registrarSaldoInicial } from "../../../cobros/acciones";

function AnularConMotivo({
  accion,
  campos,
  texto,
  explicacion,
}: {
  accion: typeof anularPago;
  campos: Record<string, string>;
  texto: string;
  explicacion: string;
}) {
  const [estado, enviar, enviando] = useActionState(accion, {});
  const idMotivo = `motivo-${Object.values(campos)[0]}`;
  return (
    <details className="rounded-lg border border-borde px-3 py-1">
      <summary className="min-h-[44px] cursor-pointer content-center text-peligro">{texto}</summary>
      <form action={enviar} className="mt-2 flex flex-col gap-2 pb-2">
        {Object.entries(campos).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <Campo etiqueta="Motivo" name="motivo" id={idMotivo} required placeholder="Ej: lo cargué dos veces" />
        <p className="text-sm text-texto-suave">{explicacion}</p>
        {estado.error && <Aviso tipo="error">{estado.error}</Aviso>}
        <Boton type="submit" variante="secundario" disabled={enviando} className="text-peligro">
          {enviando ? "Anulando…" : "Confirmar anulación"}
        </Boton>
      </form>
    </details>
  );
}

export function AnularPago({ pagoId, clienteId }: { pagoId: string; clienteId: string }) {
  return (
    <AnularConMotivo
      accion={anularPago}
      campos={{ pagoId, clienteId }}
      texto="Anular este cobro"
      explicacion="El cobro no se borra: queda en el historial como anulado y la deuda se recalcula."
    />
  );
}

export function AnularSaldo({ saldoId, clienteId }: { saldoId: string; clienteId: string }) {
  return (
    <AnularConMotivo
      accion={anularSaldoInicial}
      campos={{ saldoId, clienteId }}
      texto="Anular este saldo"
      explicacion="El saldo no se borra: queda en el historial como anulado."
    />
  );
}

export function FormularioSaldoInicial({ clienteId, hoy }: { clienteId: string; hoy: string }) {
  const [estado, enviar, enviando] = useActionState(registrarSaldoInicial, {});
  const [id] = useState(() => nuevoUuid());
  return (
    <details className="rounded-xl border border-borde bg-superficie p-4">
      <summary className="min-h-[44px] cursor-pointer content-center font-semibold">+ Cargar saldo del papel</summary>
      <form action={enviar} className="mt-3 flex flex-col gap-3">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="clienteId" value={clienteId} />
        <p className="text-sm text-texto-suave">
          Para deudas o saldos a favor anteriores a la app. Cuentan en la cuenta corriente pero no como venta ni como
          ganancia.
        </p>
        <fieldset className="grid grid-cols-2 gap-2">
          <label className="flex min-h-[52px] items-center gap-2 rounded-xl border border-borde px-3 text-lg">
            <input type="radio" name="tipo" value="deuda" defaultChecked className="h-5 w-5" /> Nos debía
          </label>
          <label className="flex min-h-[52px] items-center gap-2 rounded-xl border border-borde px-3 text-lg">
            <input type="radio" name="tipo" value="a_favor" className="h-5 w-5" /> Tenía a favor
          </label>
        </fieldset>
        <Campo etiqueta="Importe" name="importe" inputMode="decimal" autoComplete="off" placeholder="Ej: 20.000" />
        <Campo etiqueta="Fecha (del papel)" name="fecha" type="date" defaultValue={hoy} max={hoy} />
        <Campo etiqueta="Nota (opcional)" name="nota" maxLength={500} autoComplete="off" />
        {estado.error && <Aviso tipo="error">{estado.error}</Aviso>}
        <Boton type="submit" variante="secundario" disabled={enviando}>
          {enviando ? "Guardando…" : "Guardar saldo"}
        </Boton>
      </form>
    </details>
  );
}
