/**
 * Tarjeta "Última venta" de la pantalla de venta (maqueta 6b/6c): la venta anterior que se le dejó al cliente,
 * con el precio por unidad de cada producto, para mirar qué precio se le hizo y, si se quiere, repetirla.
 */
import type { ReactNode } from "react";
import type { UltimaVenta } from "@/datos/ventas";
import { juntarRenglones } from "@/dominio/carrito";
import { formatearPesos } from "@/lib/dinero";
import { diasEntre, formatearDia } from "@/lib/fechas";

export function hace(dia: string, hoy: string): string {
  const n = diasEntre(dia, hoy);
  return n <= 0 ? "hoy" : n === 1 ? "ayer" : `hace ${n} días`;
}

/** "12/10/2026 · 2 × Vapex 8000 · 1 × Nubo 5000" (debajo del botón de la ficha). */
export function resumenUltimaVenta(u: UltimaVenta): string {
  return [formatearDia(u.dia), ...juntarRenglones(u.renglones).map((r) => `${r.cantidad} × ${r.nombre}`)].join(" · ");
}

export function TarjetaUltimaVenta({ ultima, hoy, children }: { ultima: UltimaVenta; hoy: string; children?: ReactNode }) {
  return (
    <section aria-label="Última venta" data-ultima-venta={ultima.ventaId} className="flex flex-col gap-2 rounded-[20px] border border-borde bg-superficie px-3.5 py-3 shadow-tarjeta">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[0.82rem] font-bold">Última venta</h2>
        <span className="text-[0.72rem] text-texto-suave">
          {formatearDia(ultima.dia)} · {hace(ultima.dia, hoy)}
        </span>
      </div>
      <ul className="flex flex-col gap-1 text-[0.82rem]">
        {ultima.renglones.map((r, i) => (
          <li key={`${r.productoId}-${i}`} className="flex justify-between gap-3">
            <span className="min-w-0 break-words">
              {r.cantidad} × {r.nombre}
            </span>
            <span className="num shrink-0">{formatearPesos(r.precioUnitario)} c/u</span>
          </li>
        ))}
      </ul>
      <div className="flex justify-between gap-3 text-[0.82rem]">
        <span className="text-texto-suave">Total</span>
        <span className="num font-bold">{formatearPesos(ultima.importe)}</span>
      </div>
      {children}
    </section>
  );
}
