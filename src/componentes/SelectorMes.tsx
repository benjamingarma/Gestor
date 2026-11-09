"use client";

import { useRouter } from "next/navigation";
import { nombreDelMes } from "@/lib/meses";

/** Selector de mes: cambia el parámetro ?mes= de la página. */
export function SelectorMes({
  meses,
  actual,
  ruta,
  conTodo = false,
}: {
  meses: string[];
  actual: string;
  ruta: string;
  /** Agrega la opción "Todo el historial" (valor "todo"). */
  conTodo?: boolean;
}) {
  const router = useRouter();
  const i = meses.indexOf(actual);
  const ir = (mes: string) => router.push(`${ruta}?mes=${mes}`);
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => ir(meses[i + 1])}
        disabled={i < 0 || i >= meses.length - 1}
        aria-label="Mes anterior"
        className="h-[52px] w-[52px] shrink-0 rounded-xl border border-borde bg-superficie text-xl font-bold disabled:opacity-30"
      >
        ‹
      </button>
      <select
        value={actual}
        onChange={(e) => ir(e.target.value)}
        aria-label="Mes"
        className="min-h-[52px] w-full rounded-xl border border-borde bg-superficie px-3 text-center text-lg font-semibold"
      >
        {conTodo && <option value="todo">Todo el historial</option>}
        {meses.map((m) => (
          <option key={m} value={m}>
            {nombreDelMes(m)}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => ir(meses[i - 1])}
        disabled={i <= 0}
        aria-label="Mes siguiente"
        className="h-[52px] w-[52px] shrink-0 rounded-xl border border-borde bg-superficie text-xl font-bold disabled:opacity-30"
      >
        ›
      </button>
    </div>
  );
}
