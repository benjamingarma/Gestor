"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Aviso } from "@/componentes/Aviso";
import { Icono } from "@/componentes/Iconos";
import { AvisoInfo, Avatar } from "@/componentes/UI";
import { atajosDeCobro, despuesDelCobro, MEDIOS, preseleccionDeCobro, type Medio, type UltimoCobro } from "@/dominio/cobro";
import { formatearPesos, parsearImporte } from "@/lib/dinero";
import { formatearDia } from "@/lib/fechas";
import { nuevoUuid } from "@/lib/uuid";
import { registrarPago } from "../../cobros/acciones";

type Props = {
  cliente: { id: string; nombre: string };
  /** > 0 debe; < 0 tiene a favor. */
  saldo: number;
  /** "3 ventas", "1 deuda"… (lo que sigue pendiente). */
  pendientes: string;
  importeInicial: string;
  socios: { id: string; nombre: string }[];
  socioActual: string;
  ultimo: UltimoCobro;
  hoy: string;
  ventaId: string;
};

const sinSigno = (centavos: number) => formatearPesos(centavos).replace("$ ", "");

/** Cobro en una sola pantalla (maqueta docs/maquetas, pantalla 3): monto grande, medio, quién recibió y cómo queda. */
export function FormularioCobro({ cliente, saldo, pendientes, importeInicial, socios, socioActual, ultimo, hoy, ventaId }: Props) {
  const [estado, enviar, enviando] = useActionState(registrarPago, {});
  const [id] = useState(() => nuevoUuid()); // un cobro = un identificador: reenviar no duplica
  const inicial = preseleccionDeCobro(ultimo, socios, socioActual);
  const [importe, setImporte] = useState(importeInicial);
  const [medio, setMedio] = useState<Medio | null>(inicial.medio);
  const [recibidoPor, setRecibidoPor] = useState(inicial.recibidoPor);
  const [opciones, setOpciones] = useState(false);
  const [fecha, setFecha] = useState(hoy);
  const [nota, setNota] = useState("");
  const e = estado.errores ?? {};

  const p = parsearImporte(importe);
  const centavos = p.ok && p.centavos > 0 ? p.centavos : null;
  const despues = despuesDelCobro(saldo, centavos ?? 0);
  const problema = importe.trim() !== "" && !p.ok ? p.error : centavos === null ? "Escribí cuánto pagó." : medio === null ? "Elegí cómo pagó." : null;
  const cerrarA = ventaId ? `/ventas/${ventaId}` : "/cobrar";

  const tarjetaCliente = (
    <div className="flex items-center justify-between gap-3 rounded-[20px] border border-borde bg-superficie px-3.5 py-3 shadow-tarjeta">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar nombre={cliente.nombre} />
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-bold">{cliente.nombre}</span>
          <span className={`text-[0.82rem] ${saldo > 0 ? "text-peligro" : "text-texto-suave"}`}>
            {saldo > 0 ? `Debe ${formatearPesos(saldo)}${pendientes ? ` · ${pendientes}` : ""}` : saldo < 0 ? `Tiene ${formatearPesos(-saldo)} a favor` : "No debe nada"}
          </span>
        </div>
      </div>
      <Link href="/cobrar" className="flex min-h-[44px] items-center px-1 text-[0.82rem] font-semibold text-acento">
        Cambiar
      </Link>
    </div>
  );

  const segmento = "grid gap-2";
  const opcion = (sel: boolean) =>
    `flex min-h-[52px] flex-col items-center justify-center rounded-[14px] px-0 text-center text-[0.88rem] leading-[1.15] font-semibold transition-colors duration-150 ${sel ? "border-2 border-acento bg-acento-suave text-acento" : "border-[1.5px] border-borde bg-superficie"}`;

  const guardar = (
    <>
      {estado.error && <Aviso tipo="error">{estado.error}</Aviso>}
      {problema && importe.trim() !== "" && <p className="text-center text-[0.82rem] text-peligro">{problema}</p>}
      <button
        type="submit"
        disabled={problema !== null || enviando}
        className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl bg-acento text-[1.1rem] font-bold text-acento-texto transition-opacity disabled:opacity-50"
      >
        {enviando && <span aria-hidden="true" className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none" />}
        {enviando ? "Guardando…" : centavos !== null ? `Guardar cobro · ${formatearPesos(centavos)}` : "Guardar cobro"}
      </button>
    </>
  );

  return (
    <form action={enviar} className="flex flex-1 flex-col" noValidate>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="clienteId" value={cliente.id} />
      <input type="hidden" name="volverA" value={ventaId} />
      <input type="hidden" name="medio" value={medio ?? ""} />
      <input type="hidden" name="recibidoPor" value={recibidoPor} />
      <input type="hidden" name="fecha" value={fecha} />
      <input type="hidden" name="nota" value={nota} />

      <header className="flex items-center justify-between px-[18px] pt-2 pb-3 lg:hidden">
        <span className="text-[1.25rem] font-extrabold">Cobrar</span>
        <Link href={cerrarA} aria-label="Cerrar sin guardar" className="grid h-11 w-11 place-items-center text-texto-suave">
          <Icono nombre="cerrar" />
        </Link>
      </header>

      <div className="flex flex-col gap-3 px-4 pb-[110px] lg:px-0 lg:pb-0">
        {tarjetaCliente}

        <div className="flex flex-col items-center gap-2 rounded-[20px] border border-borde bg-superficie px-4 py-[22px] shadow-tarjeta">
          <label htmlFor="importe" className="text-[0.82rem] text-texto-suave">
            ¿Cuánto pagó?
          </label>
          <span className="flex max-w-full items-baseline justify-center">
            <span className="num text-[2.6rem] font-extrabold tracking-[-0.03em]">$&nbsp;</span>
            <input
              id="importe"
              name="importe"
              inputMode="decimal"
              autoComplete="off"
              value={importe}
              onChange={(ev) => setImporte(ev.target.value)}
              onFocus={(ev) => ev.target.select()}
              placeholder="0"
              aria-invalid={Boolean(e.importe) || undefined}
              style={{ width: `${Math.max(importe.length, 1) + 0.5}ch` }}
              className="num max-w-[11ch] min-w-[2ch] bg-transparent text-[2.6rem] font-extrabold tracking-[-0.03em] text-texto caret-acento outline-none placeholder:text-texto-suave"
            />
          </span>
          {e.importe && <span className="text-[0.82rem] text-peligro">{e.importe}</span>}
          <div className="flex flex-wrap justify-center gap-1.5">
            {atajosDeCobro(saldo).map((a) => (
              <button
                key={a.centavos + a.texto}
                type="button"
                onClick={() => setImporte(sinSigno(a.centavos))}
                className="min-h-[36px] rounded-full bg-superficie-2 px-2.5 text-[0.85rem] font-semibold whitespace-nowrap"
              >
                {a.texto === "todo" ? `Todo · ${formatearPesos(a.centavos)}` : formatearPesos(a.centavos)}
              </button>
            ))}
          </div>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-[0.85rem] font-bold">¿Cómo pagó?</legend>
          <div className={`${segmento} grid-cols-3`}>
            {MEDIOS.map((m) => (
              <button key={m.id} type="button" aria-pressed={medio === m.id} onClick={() => setMedio(m.id)} className={opcion(medio === m.id)}>
                {m.texto}
                {ultimo?.medio === m.id && <span className="text-[0.68rem] font-medium">último usado</span>}
              </button>
            ))}
          </div>
          {e.medio && <span className="text-[0.82rem] text-peligro">{e.medio}</span>}
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-[0.85rem] font-bold">¿Quién recibió la plata?</legend>
          <div className={segmento} style={{ gridTemplateColumns: `repeat(${Math.max(socios.length, 1)}, minmax(0, 1fr))` }}>
            {socios.map((s) => (
              <button key={s.id} type="button" aria-pressed={recibidoPor === s.id} onClick={() => setRecibidoPor(s.id)} className={opcion(recibidoPor === s.id)}>
                {s.nombre}
              </button>
            ))}
          </div>
        </fieldset>

        <div aria-live="polite" className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3 rounded-[20px] border border-borde bg-superficie px-4 py-3 shadow-tarjeta">
            <span className="text-[0.82rem] text-texto-suave">{despues.tipo === "debe" ? "Le queda debiendo" : despues.tipo === "a_favor" ? "Le queda a favor" : "Le queda debiendo"}</span>
            <span className={`num font-bold ${despues.tipo === "debe" ? "text-peligro" : despues.tipo === "a_favor" ? "text-acento" : ""}`} data-queda={despues.tipo === "debe" ? despues.monto : despues.tipo === "a_favor" ? -despues.monto : 0}>
              {despues.tipo === "al_dia" ? "Nada · queda al día" : formatearPesos(despues.monto)}
            </span>
          </div>
          {despues.tipo === "a_favor" && centavos !== null && (
            <AvisoInfo titulo={`Le quedan ${formatearPesos(despues.monto)} a favor.`}>Se descuentan solos de lo próximo que compre.</AvisoInfo>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3 px-1 text-[0.82rem] text-texto-suave">
            <span>
              {fecha === hoy ? "Hoy" : formatearDia(fecha)} · {nota.trim() ? `nota: “${nota.trim()}”` : "sin nota"}
            </span>
            <button type="button" onClick={() => setOpciones((o) => !o)} className="min-h-[40px] shrink-0 font-semibold text-acento" aria-expanded={opciones}>
              {opciones ? "Listo" : "Cambiar"}
            </button>
          </div>
          {e.fecha && <span className="px-1 text-[0.82rem] text-peligro">{e.fecha}</span>}
          {opciones && (
            <div className="flex flex-col gap-3 rounded-[20px] border border-borde bg-superficie p-4">
              <label className="flex flex-col gap-1">
                <span className="text-[0.85rem] font-semibold">Fecha del cobro</span>
                <input type="date" value={fecha} max={hoy} onChange={(ev) => setFecha(ev.target.value)} className="min-h-[50px] rounded-[14px] border border-borde bg-superficie px-3" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[0.85rem] font-semibold">Nota</span>
                <input value={nota} onChange={(ev) => setNota(ev.target.value)} maxLength={500} className="min-h-[50px] rounded-[14px] border border-borde bg-superficie px-3" />
              </label>
            </div>
          )}
        </div>

        <div className="hidden flex-col gap-2 lg:flex">{guardar}</div>
      </div>

      {/* Celular: botón fijo abajo. */}
      <div className="fixed inset-x-0 bottom-0 z-20 flex flex-col gap-2 border-t border-borde bg-superficie px-4 pt-3.5 pb-[max(env(safe-area-inset-bottom),1.5rem)] lg:hidden">{guardar}</div>
    </form>
  );
}
