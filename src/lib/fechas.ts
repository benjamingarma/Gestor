/**
 * Fechas: el negocio funciona en hora de Tucumán. Una venta a las 23:30 del 31/10 es de
 * octubre aunque en UTC ya sea 1/11.
 *
 * Los "días" se representan como texto ISO "AAAA-MM-DD" (sin hora), que se puede comparar
 * y ordenar como texto y no sufre cambios de zona horaria.
 */

export const ZONA_HORARIA = "America/Argentina/Tucuman";

/** Día calendario "AAAA-MM-DD". */
export type Dia = string;

const formatoDia = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA_HORARIA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const formatoHora = new Intl.DateTimeFormat("es-AR", {
  timeZone: ZONA_HORARIA,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const PATRON_DIA = /^(\d{4})-(\d{2})-(\d{2})$/;

export function esDiaValido(dia: string): dia is Dia {
  const m = PATRON_DIA.exec(dia);
  if (!m) return false;
  const fecha = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return fecha.toISOString().slice(0, 10) === dia;
}

function asegurarDia(dia: string): void {
  if (!esDiaValido(dia)) throw new RangeError(`Fecha inválida: ${dia}`);
}

/** Día calendario en Tucumán de un instante. */
export function diaEnTucuman(instante: Date): Dia {
  return formatoDia.format(instante);
}

/** Hoy en Tucumán. */
export function hoy(ahora: Date = new Date()): Dia {
  return diaEnTucuman(ahora);
}

export function sumarDias(dia: Dia, cantidad: number): Dia {
  asegurarDia(dia);
  if (!Number.isInteger(cantidad)) throw new RangeError("La cantidad de días debe ser entera.");
  const [a, m, d] = dia.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + cantidad)).toISOString().slice(0, 10);
}

/** Días desde `desde` hasta `hasta` (positivo si `hasta` es posterior). */
export function diasEntre(desde: Dia, hasta: Dia): number {
  asegurarDia(desde);
  asegurarDia(hasta);
  const ms = Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

/** "2026-11-06" -> "06/11/2026" */
export function formatearDia(dia: Dia): string {
  asegurarDia(dia);
  const [a, m, d] = dia.split("-");
  return `${d}/${m}/${a}`;
}

/** Instante -> "06/11/2026 20:15" en hora de Tucumán. */
export function formatearFechaHora(instante: Date): string {
  return `${formatearDia(diaEnTucuman(instante))} ${formatoHora.format(instante)}`;
}

const formatoDiaLargo = new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

/** "2026-11-09" -> "lunes 9 de noviembre" (como en el Inicio). */
export function formatearDiaLargo(dia: Dia): string {
  asegurarDia(dia);
  return formatoDiaLargo.format(new Date(`${dia}T12:00:00Z`)).replace(",", "");
}
