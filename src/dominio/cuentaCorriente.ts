/**
 * Cuenta corriente de un cliente (plan, decisión 3 y A4).
 *
 * Deudas  = saldos iniciales tipo deuda + ventas no anuladas.
 * Créditos = pagos no anulados + saldos iniciales a favor.
 * Los créditos se aplican SOLOS a las deudas, de la más vieja a la más nueva (FIFO).
 * La aplicación se calcula (no se guarda): si se anula un pago o una venta, todo se
 * reacomoda, y el resultado depende solo del TOTAL de créditos, no del orden de carga.
 */
import type { Centavos } from "@/lib/dinero";
import type { Dia } from "@/lib/fechas";

export type Deuda = {
  id: string;
  tipo: "saldo_inicial" | "venta";
  dia: Dia;
  /** Desempate dentro del mismo día (orden de carga). */
  orden: number;
  importe: Centavos;
};

export type DeudaAplicada = Deuda & { cobrado: Centavos; saldo: Centavos };

export type CuentaCorriente = {
  deudas: DeudaAplicada[];
  totalDeudas: Centavos;
  totalCreditos: Centavos;
  /** > 0 nos debe; < 0 tiene saldo a favor. */
  saldo: Centavos;
  debe: Centavos;
  aFavor: Centavos;
};

/** Orden de aplicación: por día; el mismo día, el saldo inicial (del papel) antes que las ventas; después, orden de carga. */
export function compararDeudas(a: Deuda, b: Deuda): number {
  if (a.dia !== b.dia) return a.dia < b.dia ? -1 : 1;
  if (a.tipo !== b.tipo) return a.tipo === "saldo_inicial" ? -1 : 1;
  if (a.orden !== b.orden) return a.orden - b.orden;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function aplicarCreditos(deudas: Deuda[], creditos: Centavos[]): CuentaCorriente {
  for (const d of deudas) {
    if (!Number.isSafeInteger(d.importe) || d.importe < 0) throw new RangeError(`Importe de deuda inválido: ${d.importe}`);
  }
  for (const c of creditos) {
    if (!Number.isSafeInteger(c) || c <= 0) throw new RangeError(`Importe de crédito inválido: ${c}`);
  }
  const totalCreditos = creditos.reduce((s, c) => s + c, 0);
  let disponible = totalCreditos;
  const aplicadas = [...deudas].sort(compararDeudas).map((d) => {
    const cobrado = Math.min(d.importe, disponible);
    disponible -= cobrado;
    return { ...d, cobrado, saldo: d.importe - cobrado };
  });
  const totalDeudas = deudas.reduce((s, d) => s + d.importe, 0);
  const saldo = totalDeudas - totalCreditos;
  return {
    deudas: aplicadas,
    totalDeudas,
    totalCreditos,
    saldo,
    debe: Math.max(0, saldo),
    aFavor: Math.max(0, -saldo),
  };
}

/** Estado de una venta según lo cobrado. */
export function estadoCobro(d: { importe: Centavos; cobrado: Centavos }): "pagada" | "parcial" | "pendiente" {
  if (d.cobrado >= d.importe) return "pagada";
  return d.cobrado > 0 ? "parcial" : "pendiente";
}
