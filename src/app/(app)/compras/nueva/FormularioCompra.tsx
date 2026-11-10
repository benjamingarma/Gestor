"use client";

import { useActionState, useMemo, useState } from "react";
import { Aviso } from "@/componentes/Aviso";
import { Boton } from "@/componentes/Boton";
import { Campo } from "@/componentes/Campo";
import { validarCompra } from "@/dominio/compras";
import { formatearDolares, formatearPesos } from "@/lib/dinero";
import { nuevoUuid } from "@/lib/uuid";
import { registrarCompra, type CamposFormularioCompra } from "../acciones";

type Props = {
  productos: { id: string; nombre: string }[];
  productoInicial: string;
  hoy: string;
  tipoDeCambioSugerido: string;
  ayudaTipoDeCambio: string;
};

export function FormularioCompra({ productos, productoInicial, hoy, tipoDeCambioSugerido, ayudaTipoDeCambio }: Props) {
  const [estado, enviar, enviando] = useActionState(registrarCompra, {});
  // El identificador se genera en el celular una sola vez: si se reenvía, no se duplica.
  const [id] = useState(() => nuevoUuid());
  const [campos, setCampos] = useState<CamposFormularioCompra>(
    estado.valores ?? {
      productoId: productoInicial,
      fecha: hoy,
      cantidad: "",
      costoUnitarioUsd: "",
      tipoDeCambio: tipoDeCambioSugerido,
      estimado: false,
      inventarioInicial: false,
      nota: "",
    },
  );
  const cambiar = (campo: keyof CamposFormularioCompra) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const valor = e.target instanceof HTMLInputElement && e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setCampos((c) => ({ ...c, [campo]: valor }));
  };

  // Vista previa con la misma fórmula que usa la base de datos.
  const vista = useMemo(() => validarCompra(campos, hoy), [campos, hoy]);
  const errores = estado.errores ?? {};

  return (
    <form action={enviar} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="id" value={id} />

      <label className="flex flex-col gap-1">
        <span className="text-base font-medium">Producto</span>
        <select
          name="productoId"
          value={campos.productoId}
          onChange={cambiar("productoId")}
          className={`min-h-[50px] rounded-[14px] border bg-superficie px-3 text-lg ${errores.productoId ? "border-peligro" : "border-borde"}`}
        >
          <option value="">Elegí un producto…</option>
          {productos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
        {errores.productoId && <span className="text-[0.82rem] text-peligro">{errores.productoId}</span>}
      </label>

      <div className="grid grid-cols-2 gap-3">
        <Campo
          etiqueta="Cantidad"
          name="cantidad"
          inputMode="numeric"
          autoComplete="off"
          value={campos.cantidad}
          onChange={cambiar("cantidad")}
          error={errores.cantidad}
          placeholder="Ej: 20"
        />
        <Campo
          etiqueta="Fecha"
          name="fecha"
          type="date"
          max={hoy}
          value={campos.fecha}
          onChange={cambiar("fecha")}
          error={errores.fecha}
        />
      </div>

      <Campo
        etiqueta="Costo por unidad en dólares"
        name="costoUnitarioUsd"
        inputMode="decimal"
        autoComplete="off"
        value={campos.costoUnitarioUsd}
        onChange={cambiar("costoUnitarioUsd")}
        error={errores.costoUnitarioUsd}
        placeholder="Ej: 5,00"
      />

      <Campo
        etiqueta="Tipo de cambio (pesos por dólar blue)"
        name="tipoDeCambio"
        inputMode="decimal"
        autoComplete="off"
        value={campos.tipoDeCambio}
        onChange={cambiar("tipoDeCambio")}
        error={errores.tipoDeCambio}
        placeholder="Ej: 1.400"
        ayuda={ayudaTipoDeCambio}
      />

      <label className="flex min-h-[52px] items-center gap-3 text-lg">
        <input type="checkbox" name="estimado" checked={campos.estimado} onChange={cambiar("estimado")} className="h-6 w-6" />
        Tipo de cambio estimado (no recuerdo el exacto)
      </label>
      <label className="flex min-h-[52px] items-center gap-3 text-lg">
        <input
          type="checkbox"
          name="inventarioInicial"
          checked={campos.inventarioInicial}
          onChange={cambiar("inventarioInicial")}
          className="h-6 w-6"
        />
        Es stock inicial (mercadería que ya teníamos)
      </label>

      <Campo etiqueta="Nota (opcional)" name="nota" value={campos.nota} onChange={cambiar("nota")} maxLength={500} autoComplete="off" />

      <section aria-live="polite" className="rounded-[20px] border border-borde bg-superficie shadow-tarjeta p-4">
        {vista.ok ? (
          <div className="flex flex-col gap-1">
            <span className="text-[0.82rem] text-texto-suave">Costo por unidad en pesos</span>
            <span className="num text-[1.6rem] font-extrabold tracking-[-0.02em]">{formatearPesos(vista.costos.costoUnitarioArs)}</span>
            <span className="text-base">
              Total: <strong>{formatearDolares(vista.costos.totalUsd)}</strong> = <strong>{formatearPesos(vista.costos.totalArs)}</strong>
            </span>
            <span className="text-[0.72rem] text-texto-suave">
              El costo en pesos queda fijo con este tipo de cambio y no cambia aunque suba el dólar.
            </span>
          </div>
        ) : (
          <span className="text-texto-suave">Completá cantidad, costo y tipo de cambio para ver el costo en pesos.</span>
        )}
      </section>

      {estado.error && <Aviso tipo="error">{estado.error}</Aviso>}
      <Boton type="submit" disabled={enviando}>
        {enviando ? "Guardando…" : "Guardar compra"}
      </Boton>
    </form>
  );
}
