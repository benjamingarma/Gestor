import Link from "next/link";
import type { ComponentProps } from "react";
import { estiloBoton } from "./Boton";

type Props = ComponentProps<typeof Link> & { variante?: "principal" | "secundario" };

/** Enlace con aspecto de botón grande. */
export function BotonEnlace({ variante = "principal", className = "", ...props }: Props) {
  return <Link {...props} className={`${estiloBoton(variante)} ${className}`} />;
}
