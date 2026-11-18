/**
 * Semanas de domingo a sábado (decisión de los socios del 18/11/2026), en días "AAAA-MM-DD" de Tucumán.
 * Una semana se identifica por su domingo. Como período de los totales se escribe "sem-AAAA-MM-DD".
 */
import { esDiaValido, sumarDias, type Dia } from "./fechas";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** 0 = domingo … 6 = sábado. */
function diaDeLaSemana(dia: Dia): number {
  return new Date(`${dia}T12:00:00Z`).getUTCDay();
}

/** Domingo de la semana de un día. */
export function inicioDeSemana(dia: Dia): Dia {
  if (!esDiaValido(dia)) throw new RangeError(`Fecha inválida: ${dia}`);
  return sumarDias(dia, -diaDeLaSemana(dia));
}

/** ¿Es un domingo válido (el inicio de una semana)? */
export function esSemanaValida(inicio: string): boolean {
  return esDiaValido(inicio) && diaDeLaSemana(inicio) === 0;
}

/** Sábado de la semana que empieza en `inicio`. */
export function finDeSemana(inicio: Dia): Dia {
  return sumarDias(inicio, 6);
}

export const PREFIJO_SEMANA = "sem-";
export const periodoDeSemana = (inicio: Dia) => `${PREFIJO_SEMANA}${inicio}`;
export const esPeriodoSemana = (periodo: string) => periodo.startsWith(PREFIJO_SEMANA);

/** ¿El día cae en la semana que empieza en `inicio`? */
export function enSemana(dia: Dia, inicio: Dia): boolean {
  return dia >= inicio && dia <= finDeSemana(inicio);
}

/** "15 al 21 de noviembre" · "29 de noviembre al 5 de diciembre" · "27 de diciembre de 2026 al 2 de enero de 2027". */
export function nombreDeSemana(inicio: Dia): string {
  const fin = finDeSemana(inicio);
  const [a1, m1, d1] = inicio.split("-").map(Number);
  const [a2, m2, d2] = fin.split("-").map(Number);
  if (a1 !== a2) return `${d1} de ${MESES[m1 - 1]} de ${a1} al ${d2} de ${MESES[m2 - 1]} de ${a2}`;
  if (m1 !== m2) return `${d1} de ${MESES[m1 - 1]} al ${d2} de ${MESES[m2 - 1]}`;
  return `${d1} al ${d2} de ${MESES[m2 - 1]}`;
}
