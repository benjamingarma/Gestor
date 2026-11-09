/** Meses "AAAA-MM" para filtros por período (hora de Tucumán: los días ya vienen en hora local). */

const NOMBRES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export function esMesValido(mes: string): boolean {
  const m = /^(\d{4})-(\d{2})$/.exec(mes);
  return !!m && Number(m[2]) >= 1 && Number(m[2]) <= 12 && Number(m[1]) >= 2000;
}

/** Mes de un día "AAAA-MM-DD". */
export function mesDe(dia: string): string {
  return dia.slice(0, 7);
}

/** [primer día del mes, primer día del mes siguiente) */
export function rangoDelMes(mes: string): [string, string] {
  if (!esMesValido(mes)) throw new RangeError(`Mes inválido: ${mes}`);
  const [a, m] = mes.split("-").map(Number);
  const siguiente = m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, "0")}`;
  return [`${mes}-01`, `${siguiente}-01`];
}

/** "2026-10" -> "Octubre 2026" */
export function nombreDelMes(mes: string): string {
  const [a, m] = mes.split("-").map(Number);
  const n = NOMBRES[m - 1];
  return `${n[0].toUpperCase()}${n.slice(1)} ${a}`;
}

/** Meses desde `desde` hasta `hasta` (inclusive), del más nuevo al más viejo. */
export function mesesEntre(desde: string, hasta: string): string[] {
  if (!esMesValido(desde) || !esMesValido(hasta)) throw new RangeError("Mes inválido");
  const meses: string[] = [];
  let [a, m] = hasta.split("-").map(Number);
  const [a0, m0] = desde.split("-").map(Number);
  while (a > a0 || (a === a0 && m >= m0)) {
    meses.push(`${a}-${String(m).padStart(2, "0")}`);
    m -= 1;
    if (m === 0) {
      m = 12;
      a -= 1;
    }
  }
  return meses;
}
