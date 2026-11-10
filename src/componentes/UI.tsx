/** Piezas visuales de las maquetas de McStock (docs/maquetas/base.css). */
import type { HTMLAttributes, ReactNode } from "react";

export function Tarjeta({ className = "", children, ...props }: HTMLAttributes<HTMLElement> & { children: ReactNode }) {
  return (
    <section {...props} className={`rounded-[20px] border border-borde bg-superficie p-4 shadow-tarjeta ${className}`}>
      {children}
    </section>
  );
}

const TONOS = {
  neutro: "bg-superficie-2 text-texto",
  acento: "bg-acento-suave text-acento",
  peligro: "bg-peligro-suave text-peligro",
  aviso: "bg-aviso-suave text-aviso",
};

/** Etiqueta redondeada. "chica" es la de estado de visita (Atrasado, Le toca hoy). */
export function Chip({ tono = "neutro", chica = false, children }: { tono?: keyof typeof TONOS; chica?: boolean; children: ReactNode }) {
  const tamano = chica ? "px-2 py-0.5 text-[0.72rem]" : "px-3 py-1.5 text-[0.85rem]";
  return <span className={`inline-flex w-fit items-center gap-1.5 rounded-full font-semibold whitespace-nowrap ${tamano} ${TONOS[tono]}`}>{children}</span>;
}

/** Aviso importante (fondo amarillo suave), por ejemplo "La ganancia no es plata disponible". */
export function AvisoInfo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <p role="note" className="flex gap-2 rounded-xl bg-aviso-suave px-3 py-2.5 text-[0.8rem] leading-snug text-texto">
      <span aria-hidden="true">ⓘ</span>
      <span>
        <b className="text-aviso">{titulo}</b> {children}
      </span>
    </p>
  );
}

export function Avatar({ nombre }: { nombre: string }) {
  return (
    <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-acento-suave font-extrabold text-acento">
      {nombre.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}
