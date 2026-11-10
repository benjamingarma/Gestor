import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: "principal" | "secundario";
};

/** Estilos de botón de las maquetas (56 px de alto, cómodo para el pulgar). Los comparte BotonEnlace. */
export function estiloBoton(variante: "principal" | "secundario" = "principal") {
  const color = variante === "principal" ? "bg-acento text-acento-texto hover:opacity-90" : "border border-borde bg-superficie text-texto hover:bg-superficie-2";
  return `boton-toque flex min-h-[56px] w-full items-center justify-center rounded-2xl px-5 text-[1.1rem] font-bold ${color}`;
}

export function Boton({ variante = "principal", className = "", ...props }: Props) {
  return <button {...props} className={`${estiloBoton(variante)} disabled:opacity-50 ${className}`} />;
}
