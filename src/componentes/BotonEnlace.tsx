import Link from "next/link";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof Link> & { variante?: "principal" | "secundario" };

/** Enlace con aspecto de botón grande. */
export function BotonEnlace({ variante = "principal", className = "", ...props }: Props) {
  const estilos =
    variante === "principal"
      ? "bg-acento text-acento-texto hover:opacity-90"
      : "bg-superficie text-texto border border-borde hover:bg-fondo";
  return (
    <Link
      {...props}
      className={`flex min-h-[52px] w-full items-center justify-center rounded-xl px-5 text-lg font-semibold transition ${estilos} ${className}`}
    />
  );
}
