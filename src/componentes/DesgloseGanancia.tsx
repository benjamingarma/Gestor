import { formatearPesos } from "@/lib/dinero";
import type { Tablero } from "@/dominio/tablero";

/** Texto del aviso de la ganancia neta (decisión 6 del 18/11/2026). */
export const AVISO_GANANCIA_NETA =
  "La ganancia neta es lo que quedó de lo cobrado después de pagar el costo de la mercadería. Todavía no descuenta los retiros de cada socio ni la diferencia si reponer cuesta más (por ejemplo, si subió el dólar), que la app todavía no registra.";

function Linea({ texto, valor, signo, dato, fuerte }: { texto: string; valor: number; signo?: "−" | "+"; dato?: string; fuerte?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 ${fuerte ? "border-t border-borde pt-1.5 text-[1.05rem] font-bold" : "text-[0.85rem]"}`}>
      <span className={fuerte ? "" : "text-texto-suave"}>
        {signo ? `${signo} ` : ""}
        {texto}
      </span>
      <span className={`num shrink-0 whitespace-nowrap ${fuerte && valor < 0 ? "text-peligro" : fuerte ? "text-acento" : "font-semibold"}`} data-dato={dato} data-centavos={dato ? valor : undefined}>
        {formatearPesos(valor)}
      </span>
    </div>
  );
}

/**
 * Desglose de la ganancia neta según lo cobrado (plan 12.6):
 * Cobrado − de deudas del papel − quedó como saldo a favor + saldo a favor usado − costo de lo cobrado − pérdidas = neta.
 * Las líneas de papel y saldo a favor aparecen solo si no son cero.
 */
export function DesgloseGanancia({ t }: { t: Tablero }) {
  const d = t.desglose;
  return (
    <div className="flex flex-col gap-1" aria-label="Desglose de la ganancia neta">
      <Linea texto="Cobrado" valor={d.cobrado} dato="desglose-cobrado" />
      {d.aPapel > 0 && <Linea signo="−" texto="De deudas del papel" valor={d.aPapel} dato="desglose-papel" />}
      {d.quedoAFavor > 0 && <Linea signo="−" texto="Quedó como saldo a favor" valor={d.quedoAFavor} dato="desglose-quedo-a-favor" />}
      {d.aFavorUsado > 0 && <Linea signo="+" texto="Saldo a favor usado en ventas" valor={d.aFavorUsado} dato="desglose-a-favor-usado" />}
      <Linea signo="−" texto="Costo de la mercadería de lo cobrado" valor={d.costoCobrado} dato="desglose-costo" />
      <Linea signo="−" texto="Pérdidas por ajustes de stock" valor={t.ganancia.perdidas} dato="desglose-perdidas" />
      <Linea texto="Ganancia neta" valor={t.ganancia.neta} dato="ganancia-neta-mes" fuerte />
    </div>
  );
}
