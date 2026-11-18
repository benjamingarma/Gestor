/**
 * Cuenta corriente de un cliente (plan, decisión 3 y A4).
 *
 * Deudas  = saldos iniciales tipo deuda + ventas no anuladas.
 * Créditos = pagos no anulados + saldos iniciales a favor.
 * Imputación (decisión de los socios del 18/11/2026, camino B):
 *   1. El pago registrado desde la pantalla de venta (con `ventaId`) se aplica primero a ESA venta,
 *      hasta lo que la venta debe.
 *   2. Todo lo demás (lo que sobra de esos pagos, los pagos sueltos de "Registrar pago", los saldos
 *      iniciales a favor y los pagos de ventas anuladas) se aplica a las deudas de la más vieja a la
 *      más nueva (FIFO, plan A4).
 * La aplicación se calcula (no se guarda): si se anula un pago o una venta, todo se reacomoda, y el
 * resultado no depende del orden de carga (solo del total de cada venta y del total libre).
 * El saldo total del cliente (deudas − créditos) es el mismo que con FIFO puro.
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

/** Un crédito: importe solo (pago suelto o saldo a favor) o pago de una venta (`ventaId`). */
export type Credito = Centavos | { importe: Centavos; ventaId?: string | null };

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

export function aplicarCreditos(deudas: Deuda[], creditos: Credito[]): CuentaCorriente {
  for (const d of deudas) {
    if (!Number.isSafeInteger(d.importe) || d.importe < 0) throw new RangeError(`Importe de deuda inválido: ${d.importe}`);
  }
  const normalizados = creditos.map((c) => (typeof c === "number" ? { importe: c, ventaId: null } : { importe: c.importe, ventaId: c.ventaId ?? null }));
  for (const c of normalizados) {
    if (!Number.isSafeInteger(c.importe) || c.importe <= 0) throw new RangeError(`Importe de crédito inválido: ${c.importe}`);
  }
  const totalCreditos = normalizados.reduce((s, c) => s + c.importe, 0);

  // 1. Pagos de una venta: primero a su venta (si la venta no está, por ejemplo anulada, el pago queda libre).
  const ventas = new Map(deudas.filter((d) => d.tipo === "venta").map((d) => [d.id, d]));
  const cobradoPorId = new Map<string, Centavos>();
  let libre = 0;
  for (const c of normalizados) {
    const venta = c.ventaId ? ventas.get(c.ventaId) : undefined;
    if (!venta) {
      libre += c.importe;
      continue;
    }
    const ya = cobradoPorId.get(venta.id) ?? 0;
    const aplicado = Math.min(c.importe, venta.importe - ya);
    cobradoPorId.set(venta.id, ya + aplicado);
    libre += c.importe - aplicado;
  }

  // 2. Lo libre, a las deudas de la más vieja a la más nueva.
  const aplicadas = [...deudas].sort(compararDeudas).map((d) => {
    const previo = cobradoPorId.get(d.id) ?? 0;
    const extra = Math.min(d.importe - previo, libre);
    libre -= extra;
    const cobrado = previo + extra;
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

/** Día de la deuda más vieja que todavía tiene saldo (null si no debe nada). */
export function diaDeudaMasVieja(cuenta: CuentaCorriente): Dia | null {
  const pendientes = cuenta.deudas.filter((d) => d.saldo > 0).map((d) => d.dia).sort();
  return pendientes[0] ?? null;
}
