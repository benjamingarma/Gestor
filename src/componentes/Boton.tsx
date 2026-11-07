import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: "principal" | "secundario";
};

/** Botón grande (mínimo 52 px de alto): cómodo para tocar con el pulgar. */
export function Boton({ variante = "principal", className = "", ...props }: Props) {
  const estilos =
    variante === "principal"
      ? "bg-acento text-acento-texto hover:opacity-90"
      : "bg-superficie text-texto border border-borde hover:bg-fondo";
  return (
    <button
      {...props}
      className={`min-h-[52px] w-full rounded-xl px-5 text-lg font-semibold transition disabled:opacity-50 ${estilos} ${className}`}
    />
  );
}
