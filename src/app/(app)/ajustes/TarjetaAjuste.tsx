"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Aviso } from "@/componentes/Aviso";
import { Boton } from "@/componentes/Boton";
import { Campo } from "@/componentes/Campo";
import { nombreDelMotivo } from "@/dominio/ajustes";
import { formatearDolares, formatearPesos } from "@/lib/dinero";
import { formatearDia } from "@/lib/fechas";
import type { Ajuste } from "@/datos/ajustes";
import { anularAjuste } from "./acciones";

/** Un ajuste de stock, con la opción de anularlo. */
export function TarjetaAjuste({ ajuste, volverA, conProducto }: { ajuste: Ajuste; volverA: string; conProducto?: boolean }) {
  const [estado, enviar, enviando] = useActionState(anularAjuste, {});
  const anulado = ajuste.anulado_en !== null;
  return (
    <article className={`flex flex-col gap-2 rounded-[20px] border border-borde bg-superficie shadow-tarjeta p-4 ${anulado ? "opacity-70" : ""}`}>
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-[1.05rem] font-bold">
            {nombreDelMotivo(ajuste.motivo)} · {ajuste.cantidad} u
          </span>
          {conProducto && (
            <Link href={`/productos/${ajuste.producto_id}`} className="text-acento">
              {ajuste.marca} {ajuste.modelo}
            </Link>
          )}
          <span className="text-[0.82rem] text-texto-suave">
            {formatearDia(ajuste.dia)} · cargó {ajuste.registrado_por_nombre}
          </span>
        </div>
        <span className="flex shrink-0 flex-col items-end">
          <strong className={anulado ? "line-through" : "text-peligro"}>−{formatearPesos(ajuste.costo_total_ars)}</strong>
          <span className="text-[0.82rem] text-texto-suave">{formatearDolares(ajuste.costo_total_usd)}</span>
        </span>
      </div>
      {ajuste.nota && <p className="text-sm">{ajuste.nota}</p>}
      {anulado ? (
        <p className="text-sm font-semibold text-texto-suave">Anulado: {ajuste.motivo_anulacion}. No cuenta como pérdida y las unidades volvieron al stock.</p>
      ) : (
        <details className="rounded-[14px] border border-borde px-3 py-2">
          <summary className="min-h-[44px] cursor-pointer content-center font-medium text-peligro">Anular este ajuste</summary>
          <form action={enviar} className="mt-2 flex flex-col gap-3">
            <input type="hidden" name="ajusteId" value={ajuste.ajuste_id} />
            <input type="hidden" name="volverA" value={volverA} />
            <Campo etiqueta="Motivo" name="motivo" id={`motivo-${ajuste.ajuste_id}`} placeholder="Ej: lo cargué mal, apareció" required />
            <p className="text-[0.82rem] text-texto-suave">
              El ajuste no se borra: queda en el historial como anulado, deja de restar de la ganancia y cada unidad vuelve
              al stock de la compra de la que salió, con su costo original.
            </p>
            {estado.error && <Aviso tipo="error">{estado.error}</Aviso>}
            <Boton type="submit" variante="secundario" disabled={enviando} className="text-peligro">
              {enviando ? "Anulando…" : "Confirmar anulación"}
            </Boton>
          </form>
        </details>
      )}
    </article>
  );
}
