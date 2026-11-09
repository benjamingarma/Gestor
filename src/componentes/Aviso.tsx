import type { ReactNode } from "react";

export function Aviso({ tipo, children }: { tipo: "error" | "ok"; children: ReactNode }) {
  const estilo = tipo === "error" ? "border-peligro text-peligro" : "border-acento text-acento";
  return (
    <p role={tipo === "error" ? "alert" : "status"} className={`rounded-lg border px-4 py-3 ${estilo}`}>
      {children}
    </p>
  );
}
