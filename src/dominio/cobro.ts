/**
 * Pantalla de cobro (módulo 1.7, maqueta docs/maquetas, pantalla 3).
 * Solo cálculos de pantalla: el cobro lo guarda `registrar_pago` en la base y el saldo real sale de
 * `v_cuentas_clientes`. Acá se calcula lo que se muestra en vivo mientras se tipea el monto.
 */
import type { Centavos } from "@/lib/dinero";

export type Medio = "efectivo" | "transferencia" | "mercado_pago";

export const MEDIOS: { id: Medio; texto: string }[] = [
  { id: "efectivo", texto: "Efectivo" },
  { id: "transferencia", texto: "Transferencia" },
  { id: "mercado_pago", texto: "Mercado Pago" },
];

/** Cómo queda la cuenta del cliente después del cobro ("Le queda debiendo" en vivo). */
export type Despues = { tipo: "debe"; monto: Centavos } | { tipo: "al_dia" } | { tipo: "a_favor"; monto: Centavos };

/**
 * `saldo` > 0 nos debe, < 0 tiene a favor (igual que v_cuentas_clientes).
 * `importe` es lo que pagó (en centavos, > 0). El cobro baja el saldo exactamente en `importe`.
 */
export function despuesDelCobro(saldo: Centavos, importe: Centavos): Despues {
  if (!Number.isSafeInteger(saldo)) throw new RangeError(`Saldo inválido: ${saldo}`);
  if (!Number.isSafeInteger(importe) || importe < 0) throw new RangeError(`Importe inválido: ${importe}`);
  const queda = saldo - importe;
  if (queda > 0) return { tipo: "debe", monto: queda };
  if (queda < 0) return { tipo: "a_favor", monto: -queda };
  return { tipo: "al_dia" };
}

/** Montos fijos de los botones rápidos (los de la maqueta). */
export const ATAJOS_FIJOS: Centavos[] = [2_000_000, 5_000_000];

export type Atajo = { texto: "todo" | "fijo"; centavos: Centavos };

/**
 * Botones rápidos debajo del monto: "Todo" (lo que debe) y montos redondos menores a la deuda.
 * Si no debe (pago adelantado), solo los montos redondos.
 */
export function atajosDeCobro(saldo: Centavos): Atajo[] {
  if (saldo <= 0) return ATAJOS_FIJOS.map((c) => ({ texto: "fijo", centavos: c }));
  return [{ texto: "todo", centavos: saldo }, ...ATAJOS_FIJOS.filter((c) => c < saldo).map((c) => ({ texto: "fijo" as const, centavos: c }))];
}

export type UltimoCobro = { medio: Medio; recibido_por: string } | null;

/**
 * Medio y quién recibió preseleccionados con el último cobro que registró este socio.
 * Sin cobros anteriores: no se elige medio (no se inventa) y recibe el socio que está cargando.
 * Si el socio que recibió ya no está entre los socios del negocio, recibe el que está cargando.
 */
export function preseleccionDeCobro(ultimo: UltimoCobro, socios: { id: string }[], socioActual: string): { medio: Medio | null; recibidoPor: string } {
  const recibidoPor = ultimo && socios.some((s) => s.id === ultimo.recibido_por) ? ultimo.recibido_por : socioActual;
  return { medio: ultimo?.medio ?? null, recibidoPor };
}
