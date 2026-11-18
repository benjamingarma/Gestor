/**
 * Ganancia según lo cobrado (plan 12.6; decisiones en docs/decisiones/pago-en-venta-y-ganancia-cobrada.md).
 *
 * Por cliente, día por día (se calcula, no se guarda: si se anula algo, todo se reacomoda; decisión 3):
 *   1. Entran las deudas del día (ventas y saldos iniciales del papel).
 *   2. El pago registrado con una venta se aplica primero a esa venta (decisión del 18/11/2026).
 *   3. El saldo a favor que ya tenía se usa en las deudas pendientes, de la más vieja a la más nueva
 *      (la ganancia cuenta en la fecha de la venta que lo usa; decisión 4).
 *   4. El resto de lo cobrado ese día va a las deudas más viejas (A4); lo que sobra queda a favor.
 * Cada peso aplicado a una venta trae su parte de la ganancia de esa venta en ese día:
 *   parte = ganancia × cobrado acumulado ÷ total − lo ya reconocido (redondeo hacia abajo sobre lo acumulado:
 *   al terminar de pagarse, la suma de las partes es exactamente la ganancia de la venta).
 * Deudas del papel: no se sabe qué stock fue, así que su ganancia se estima en el 50 % de su importe (fijo, decisión
 * de los socios del 18/11/2026) y entra igual que la de una venta, a medida que se cobra.
 * Una venta de $ 0 reconoce su ganancia el día de la venta.
 * El resultado por venta (cobrado y saldo) es el mismo que el de `aplicarCreditos` (cuenta corriente).
 */
import type { Centavos } from "@/lib/dinero";
import type { Dia } from "@/lib/fechas";
import { compararDeudas, type Deuda } from "./cuentaCorriente";

/** Ganancia estimada de las deudas del papel: 50 % de su importe (fijo). */
export const PORCENTAJE_GANANCIA_PAPEL = 50;
export const gananciaEstimadaPapel = (importe: Centavos): Centavos => Math.floor((importe * PORCENTAJE_GANANCIA_PAPEL) / 100);

export type VentaCobro = { id: string; clienteId: string; dia: Dia; orden: number; importe: Centavos; ganancia: Centavos };
export type SaldoInicialCobro = { id: string; clienteId: string; tipo: "deuda" | "a_favor"; dia: Dia; orden: number; importe: Centavos };
export type PagoCobro = { id: string; clienteId: string; dia: Dia; importe: Centavos; ventaId: string | null };

/** Lo que pasó en un día, sumado entre todos los clientes. */
export type DiaCobrado = {
  dia: Dia;
  /** Plata que entró (pagos). */
  cobrado: Centavos;
  /** Lo aplicado a deudas del papel (informativo: su ganancia es el 50 % estimado y su costo va a costoCobrado). */
  aPapel: Centavos;
  /** De lo cobrado, lo que quedó como saldo a favor. */
  quedoAFavor: Centavos;
  /** Saldo a favor de antes (pagos o papel) que se usó en deudas ese día. */
  aFavorUsado: Centavos;
  /** Costo de la mercadería de lo cobrado (lo aplicado a deudas − su ganancia; en el papel, el 50 % estimado). */
  costoCobrado: Centavos;
  /** Ganancia de lo cobrado. */
  ganancia: Centavos;
};

export type ResultadoCobrado = {
  dias: DiaCobrado[];
  /** Por venta: cobrado y ganancia reconocida hasta hoy. */
  ventas: Map<string, { cobrado: Centavos; saldo: Centavos; gananciaCobrada: Centavos }>;
  /** Ganancia que todavía falta cobrar (ventas y el 50 % estimado de las deudas del papel). */
  gananciaPendiente: Centavos;
};

/** floor(a × b ÷ c) exacto (también con ganancia negativa). */
function proporcion(a: number, b: number, c: number): number {
  const n = BigInt(a) * BigInt(b);
  const d = BigInt(c);
  const q = n / d;
  return Number(n % d !== 0n && n < 0n !== d < 0n ? q - 1n : q);
}

function validar(nombre: string, v: number, minimo: number) {
  if (!Number.isSafeInteger(v) || v < minimo) throw new RangeError(`${nombre} inválido: ${v}`);
}

export function calcularGananciaCobrada(ventas: VentaCobro[], saldos: SaldoInicialCobro[], pagos: PagoCobro[]): ResultadoCobrado {
  for (const v of ventas) {
    validar("Importe de venta", v.importe, 0);
    validar("Ganancia de venta", v.ganancia, Number.MIN_SAFE_INTEGER);
  }
  for (const s of saldos) validar("Saldo inicial", s.importe, 0);
  for (const p of pagos) validar("Pago", p.importe, 1);

  const dias = new Map<Dia, DiaCobrado>();
  const delDia = (dia: Dia) => {
    let d = dias.get(dia);
    if (!d) dias.set(dia, (d = { dia, cobrado: 0, aPapel: 0, quedoAFavor: 0, aFavorUsado: 0, costoCobrado: 0, ganancia: 0 }));
    return d;
  };
  const resultadoVentas: ResultadoCobrado["ventas"] = new Map();
  const ventaPorId = new Map(ventas.map((v) => [v.id, v]));
  const gananciaDe = (d: Deuda) => (d.tipo === "venta" ? ventaPorId.get(d.id)!.ganancia : gananciaEstimadaPapel(d.importe));

  // Agrupar por cliente.
  type Datos = { deudas: Deuda[]; aFavor: SaldoInicialCobro[]; pagos: PagoCobro[] };
  const clientes = new Map<string, Datos>();
  const de = (c: string) => clientes.get(c) ?? (clientes.set(c, { deudas: [], aFavor: [], pagos: [] }), clientes.get(c)!);
  for (const v of ventas) de(v.clienteId).deudas.push({ id: v.id, tipo: "venta", dia: v.dia, orden: v.orden, importe: v.importe });
  for (const s of saldos) {
    if (s.tipo === "deuda") de(s.clienteId).deudas.push({ id: s.id, tipo: "saldo_inicial", dia: s.dia, orden: s.orden, importe: s.importe });
    else de(s.clienteId).aFavor.push(s);
  }
  for (const p of pagos) de(p.clienteId).pagos.push(p);

  let gananciaPendiente = 0;
  for (const c of clientes.values()) {
    const cobrado = new Map<string, number>();
    const pendientes: Deuda[] = [];
    let pool = 0; // saldo a favor disponible
    const diasCliente = [...new Set([...c.deudas.map((d) => d.dia), ...c.aFavor.map((s) => s.dia), ...c.pagos.map((p) => p.dia)])].sort();

    // Aplica `monto` a una deuda en el día `dia`; `origen` dice si es plata del día o saldo a favor de antes.
    const aplicar = (d: Deuda, monto: number, dia: Dia, origen: "cobro" | "a_favor") => {
      const antes = cobrado.get(d.id) ?? 0;
      cobrado.set(d.id, antes + monto);
      const r = delDia(dia);
      if (d.tipo === "saldo_inicial") r.aPapel += monto;
      const g = gananciaDe(d);
      const parte = proporcion(g, antes + monto, d.importe) - proporcion(g, antes, d.importe);
      if (origen === "a_favor") r.aFavorUsado += monto;
      r.ganancia += parte;
      r.costoCobrado += monto - parte;
    };
    const resta = (d: Deuda) => d.importe - (cobrado.get(d.id) ?? 0);
    // Reparte `monto` entre las pendientes, de la más vieja a la más nueva; devuelve lo que sobra.
    const fifo = (monto: number, dia: Dia, origen: "cobro" | "a_favor") => {
      for (const d of pendientes) {
        if (monto === 0) break;
        const a = Math.min(resta(d), monto);
        if (a > 0) {
          aplicar(d, a, dia, origen);
          monto -= a;
        }
      }
      return monto;
    };

    for (const dia of diasCliente) {
      // 1. Deudas del día. Una venta de $ 0 queda pagada y reconoce su ganancia hoy.
      for (const d of c.deudas.filter((x) => x.dia === dia)) {
        if (d.importe === 0) {
          // Nada que cobrar: su ganancia (−costo) cuenta hoy y el costo va al costo de lo cobrado (el desglose cierra).
          const g = gananciaDe(d);
          delDia(dia).ganancia += g;
          delDia(dia).costoCobrado -= g;
        }
        else pendientes.push(d);
      }
      pendientes.sort(compararDeudas);
      for (const s of c.aFavor.filter((x) => x.dia === dia)) pool += s.importe;

      // 2. Pagos de una venta: primero a esa venta.
      let libre = 0;
      for (const p of c.pagos.filter((x) => x.dia === dia)) {
        delDia(dia).cobrado += p.importe;
        const venta = p.ventaId ? pendientes.find((d) => d.tipo === "venta" && d.id === p.ventaId) : undefined;
        const a = venta ? Math.min(resta(venta), p.importe) : 0;
        if (venta && a > 0) aplicar(venta, a, dia, "cobro");
        libre += p.importe - a;
      }
      // 3. Saldo a favor de antes, a lo pendiente. 4. Lo cobrado hoy, a lo más viejo; lo que sobra queda a favor.
      pool = fifo(pool, dia, "a_favor");
      const sobra = fifo(libre, dia, "cobro");
      delDia(dia).quedoAFavor += sobra;
      pool += sobra;
      for (let i = pendientes.length - 1; i >= 0; i--) if (resta(pendientes[i]) === 0) pendientes.splice(i, 1);
    }

    for (const d of c.deudas) {
      const g = gananciaDe(d);
      const cob = cobrado.get(d.id) ?? 0;
      const reconocida = d.importe === 0 ? g : proporcion(g, cob, d.importe);
      gananciaPendiente += g - reconocida;
      if (d.tipo === "venta") resultadoVentas.set(d.id, { cobrado: d.importe === 0 ? 0 : cob, saldo: d.importe - cob, gananciaCobrada: reconocida });
    }
  }

  return { dias: [...dias.values()].sort((a, b) => (a.dia < b.dia ? -1 : 1)), ventas: resultadoVentas, gananciaPendiente };
}

/** Totales de un conjunto de días (por ejemplo, un mes). */
export function sumarDias(dias: DiaCobrado[]) {
  const t = { cobrado: 0, aPapel: 0, quedoAFavor: 0, aFavorUsado: 0, costoCobrado: 0, ganancia: 0 };
  for (const d of dias) for (const k of Object.keys(t) as (keyof typeof t)[]) t[k] += d[k];
  return t;
}
