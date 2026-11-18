/**
 * Pago en la pantalla de venta ("Pagó todo" / "Pago parcial" / "Deuda"), plan 12.6.
 * Decisiones: docs/decisiones/pago-en-venta-y-ganancia-cobrada.md.
 *
 * Solo cálculos de pantalla (lo que se ve en vivo antes de guardar). Lo guardado lo calcula `aplicarCreditos`
 * con la misma regla: el pago de la venta se aplica primero a esa venta y lo que sobra a la deuda anterior.
 */
import type { Centavos } from "@/lib/dinero";

export type FormaDePago = "todo" | "parcial" | "deuda";

export const FORMAS_DE_PAGO: { id: FormaDePago; texto: string }[] = [
  { id: "todo", texto: "Pagó todo" },
  { id: "parcial", texto: "Pago parcial" },
  { id: "deuda", texto: "Deuda" },
];

function validar(nombre: string, v: Centavos, minimo: number) {
  if (!Number.isSafeInteger(v) || v < minimo) throw new RangeError(`${nombre} inválido: ${v}`);
}

/**
 * Cuánto registra "Pagó todo": solo la venta nueva (no la deuda anterior), menos el saldo a favor que tenga.
 * `saldo` > 0 nos debe, < 0 tiene a favor (como v_cuentas_clientes). 0 = no se registra pago (lo cubre el saldo a favor).
 */
export function importePagoTodo(saldo: Centavos, totalVenta: Centavos): Centavos {
  validar("Saldo", saldo, Number.MIN_SAFE_INTEGER);
  validar("Total", totalVenta, 0);
  return Math.max(0, totalVenta - Math.max(0, -saldo));
}

export type ComoQueda = {
  /** Lo que se registra como pago junto con la venta. */
  cobrado: Centavos;
  /** Lo que queda debiendo de ESTA venta. */
  ventaDebe: Centavos;
  /** Lo que queda de la deuda de antes (0 si no debía). */
  deudaAnterior: Centavos;
  /** Saldo a favor que le queda después. */
  aFavor: Centavos;
  /** Saldo total después (> 0 debe, < 0 a favor). */
  saldo: Centavos;
};

/** Cómo queda el cliente después de guardar la venta con este pago (`pago` = 0 para "Deuda"). */
export function comoQueda(saldoAntes: Centavos, totalVenta: Centavos, pago: Centavos): ComoQueda {
  validar("Saldo", saldoAntes, Number.MIN_SAFE_INTEGER);
  validar("Total", totalVenta, 0);
  validar("Pago", pago, 0);
  const deudaAntes = Math.max(0, saldoAntes);
  const aFavorAntes = Math.max(0, -saldoAntes);
  // 1. El pago, primero a esta venta.
  const aVenta = Math.min(totalVenta, pago);
  const sobrante = pago - aVenta;
  // 2. Lo que sobra, a la deuda anterior; el saldo a favor que tenía, a lo que falte de esta venta.
  const aViejo = Math.min(deudaAntes, sobrante);
  const usadoAFavor = Math.min(aFavorAntes, totalVenta - aVenta);
  const ventaDebe = totalVenta - aVenta - usadoAFavor;
  const deudaAnterior = deudaAntes - aViejo;
  const aFavor = aFavorAntes - usadoAFavor + (sobrante - aViejo);
  return { cobrado: pago, ventaDebe, deudaAnterior, aFavor, saldo: ventaDebe + deudaAnterior - aFavor };
}
