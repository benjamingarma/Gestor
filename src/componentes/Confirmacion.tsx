import type { ReactNode } from "react";
import { Icono } from "./Iconos";

/**
 * Confirmación al guardar (maqueta, pantalla 4): ✓ animado, título, monto grande y detalle.
 * La animación es solo CSS y se apaga con "reducir movimiento" (globals.css).
 */
export function Confirmacion({ titulo, monto, children, acciones }: { titulo: string; monto: string; children: ReactNode; acciones: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-10 text-center leading-[1.2]" role="status">
      <span className="confirmacion-check grid h-[88px] w-[88px] place-items-center rounded-full bg-acento text-acento-texto shadow-[0_0_0_12px_var(--acento-suave)]">
        <Icono nombre="ok" className="h-11 w-11" strokeWidth={2.6} />
      </span>
      <h1 className="confirmacion-texto text-[1.4rem] font-extrabold">{titulo}</h1>
      <span className="confirmacion-texto num text-[2.1rem] font-extrabold tracking-[-0.02em]">{monto}</span>
      <div className="confirmacion-texto text-texto-suave">{children}</div>
      <div className="mt-[18px] flex w-full max-w-md flex-col gap-2">{acciones}</div>
    </div>
  );
}
