/**
 * Totales del negocio que se muestran en varias pantallas (Inicio, Resumen, Cobrar).
 * Todas las pantallas usan ESTA función, así nunca muestran números distintos para lo mismo.
 * No calcula dinero nuevo: junta los cálculos ya probados de ganancia, ventas, cobros y cuentas.
 */
import { perdidasParaGanancia, totalesPerdidas, type FilaPerdida } from "./ajustes";
import { calcularGanancia, type ResultadoGanancia, type Socio, type Vigencia } from "./ganancia";
import { enPeriodo, totalesCobros, totalesVentas, type FilaCobro, type FilaGanancia } from "./resumen";

export type Capital = {
  invertido_usd: number; invertido_ars: number;
  vendido_usd: number; vendido_ars: number;
  perdidas_usd: number; perdidas_ars: number;
  stock_usd: number; stock_ars: number;
};

export type DatosTablero = {
  ganancias: FilaGanancia[];
  perdidas: FilaPerdida[];
  cobros: FilaCobro[];
  /** Saldo de cada cliente con cuenta distinta de cero (> 0 debe, < 0 a favor). */
  saldos: { cliente_id: string; nombre: string; saldo: number }[];
  capital: Capital;
  socios: Socio[];
  vigencias: Vigencia[];
};

export type Tablero = {
  periodo: string;
  ventas: ReturnType<typeof totalesVentas>;
  perdidas: ReturnType<typeof totalesPerdidas>;
  ganancia: ResultadoGanancia;
  /** Ganancia neta de todo el historial. */
  acumulada: ResultadoGanancia;
  cobrado: ReturnType<typeof totalesCobros>;
  nosDeben: { total: number; clientes: number };
  aFavor: { total: number; clientes: number };
  capital: Capital;
  /** Invertido = vendido + pérdidas + stock, en USD y en pesos (control I3). */
  capitalCierra: boolean;
};

/** Totales de un período ("AAAA-MM" o "todo") y del estado de hoy. */
export function armarTablero(d: DatosTablero, periodo: string): Tablero {
  const ganDelPeriodo = d.ganancias.filter((g) => enPeriodo(g.dia, periodo));
  const perdDelPeriodo = d.perdidas.filter((p) => enPeriodo(p.dia, periodo));
  const deudores = d.saldos.filter((s) => s.saldo > 0);
  const aFavor = d.saldos.filter((s) => s.saldo < 0);
  const c = d.capital;
  return {
    periodo,
    ventas: totalesVentas(ganDelPeriodo),
    perdidas: totalesPerdidas(perdDelPeriodo),
    ganancia: calcularGanancia(ganDelPeriodo.map((g) => ({ dia: g.dia, ganancia: g.ganancia })), perdidasParaGanancia(perdDelPeriodo), d.socios, d.vigencias),
    acumulada: calcularGanancia(d.ganancias.map((g) => ({ dia: g.dia, ganancia: g.ganancia })), perdidasParaGanancia(d.perdidas), d.socios, d.vigencias),
    cobrado: totalesCobros(d.cobros.filter((x) => enPeriodo(x.dia, periodo))),
    nosDeben: { total: deudores.reduce((t, s) => t + s.saldo, 0), clientes: deudores.length },
    aFavor: { total: aFavor.reduce((t, s) => t - s.saldo, 0), clientes: aFavor.length },
    capital: c,
    capitalCierra:
      c.invertido_usd === c.vendido_usd + c.perdidas_usd + c.stock_usd && c.invertido_ars === c.vendido_ars + c.perdidas_ars + c.stock_ars,
  };
}
