"use client";

import { useActionState, useMemo, useState } from "react";
import { Aviso } from "@/componentes/Aviso";
import { Boton } from "@/componentes/Boton";
import { Campo } from "@/componentes/Campo";
import { costoDelAjuste, MOTIVOS, validarAjuste, type CamposAjuste } from "@/dominio/ajustes";
import type { CompraDisponible } from "@/dominio/ventas";
import { formatearDolares, formatearPesos } from "@/lib/dinero";
import { nuevoUuid } from "@/lib/uuid";
import { registrarAjuste } from "../../../ajustes/acciones";

type Props = { productoId: string; stock: number; compras: CompraDisponible[]; hoy: string };

export function FormularioAjuste({ productoId, stock, compras, hoy }: Props) {
  const [estado, enviar, enviando] = useActionState(registrarAjuste, {});
  // El identificador se genera en el celular una sola vez: si se reenvía, no se duplica.
  const [id] = useState(() => nuevoUuid());
  const [campos, setCampos] = useState<CamposAjuste>(estado.valores ?? { motivo: "", cantidad: "1", fecha: hoy, nota: "" });
  const cambiar = (campo: keyof CamposAjuste) => (e: React.ChangeEvent<HTMLInputElement>) => setCampos((c) => ({ ...c, [campo]: e.target.value }));

  // Vista previa del costo con la misma regla FIFO que usa la base al guardar.
  const vista = useMemo(() => {
    const v = validarAjuste({ ...campos, motivo: campos.motivo || "rotura" }, hoy, stock);
    return v.ok ? costoDelAjuste(compras, v.ajuste.cantidad) : null;
  }, [campos, hoy, stock, compras]);
  const errores = estado.errores ?? {};

  return (
    <form action={enviar} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="productoId" value={productoId} />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-base font-medium">¿Qué pasó?</legend>
        <div className="grid grid-cols-3 gap-2">
          {MOTIVOS.map((m) => (
            <label
              key={m.valor}
              className={`flex min-h-[64px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 px-2 text-center text-lg font-semibold ${
                campos.motivo === m.valor ? "border-acento bg-fondo" : "border-borde bg-superficie"
              }`}
            >
              <input type="radio" name="motivo" value={m.valor} checked={campos.motivo === m.valor} onChange={cambiar("motivo")} className="sr-only" />
              {m.etiqueta}
            </label>
          ))}
        </div>
        {campos.motivo && <span className="text-sm text-texto-suave">{MOTIVOS.find((m) => m.valor === campos.motivo)?.ayuda}</span>}
        {errores.motivo && <span className="text-sm text-peligro">{errores.motivo}</span>}
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <Campo
          etiqueta="Cantidad"
          name="cantidad"
          inputMode="numeric"
          autoComplete="off"
          value={campos.cantidad}
          onChange={cambiar("cantidad")}
          error={errores.cantidad}
          ayuda={`Hay ${stock} en stock`}
        />
        <Campo etiqueta="Fecha" name="fecha" type="date" max={hoy} value={campos.fecha} onChange={cambiar("fecha")} error={errores.fecha} />
      </div>

      <Campo
        etiqueta="Nota (opcional)"
        name="nota"
        autoComplete="off"
        value={campos.nota}
        onChange={cambiar("nota")}
        error={errores.nota}
        placeholder="Ej: regalo a Ana por la compra grande"
      />

      {vista && (
        <section aria-label="Costo del ajuste" className="flex flex-col gap-1 rounded-xl border border-borde bg-superficie p-4">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-texto-suave">Se resta de la ganancia</span>
            <strong className="text-xl text-peligro">−{formatearPesos(vista.costoArs)}</strong>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-texto-suave">Costo en dólares</span>
            <span className="font-semibold">{formatearDolares(vista.costoUsd)}</span>
          </div>
          <p className="text-xs text-texto-suave">
            Es el costo de compra de esas unidades (salen primero las más viejas, igual que en una venta). Queda guardado así
            aunque después cambie el dólar.
          </p>
        </section>
      )}

      {estado.error && <Aviso tipo="error">{estado.error}</Aviso>}
      <Boton type="submit" disabled={enviando || stock === 0}>
        {enviando ? "Guardando…" : "Guardar ajuste"}
      </Boton>
    </form>
  );
}
