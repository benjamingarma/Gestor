import type { ReactNode } from "react";

/** Aviso de resultado (guardado / error). Aparece con una animación corta (globals.css). */
export function Aviso({ tipo, children }: { tipo: "error" | "ok"; children: ReactNode }) {
  const estilo = tipo === "error" ? "bg-peligro-suave text-peligro" : "bg-acento-suave text-acento";
  return (
    <p role={tipo === "error" ? "alert" : "status"} className={`aviso-aparecer rounded-[14px] px-4 py-3 font-semibold leading-snug ${estilo}`}>
      {children}
    </p>
  );
}
