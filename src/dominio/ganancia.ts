/**
 * Ganancia y reparto entre socios (plan, decisión 4, A8 y sección 7).
 *
 *   Ganancia bruta = Σ (importe − costo FIFO) de las ventas no anuladas del período.
 *   Pérdidas       = Σ costo de los ajustes de stock (regalo, pérdida, rotura) del período (módulo 1.6).
 *   Ganancia neta  = bruta − pérdidas.
 *   Parte de cada socio = ganancia neta × su porcentaje vigente en la fecha de cada operación.
 *
 * Lo que NO es ganancia y no se reparte: el capital (costo de la mercadería), las deudas del
 * papel y el dinero cobrado (que incluye la recuperación del costo).
 */
import type { Centavos } from "@/lib/dinero";
import type { Dia } from "@/lib/fechas";

export type Socio = { id: string; nombre: string; orden: number };

/** Porcentaje en centésimos de punto: 5000 = 50,00 %. */
export type Porcentaje = { socioId: string; centesimos: number };
export type Vigencia = { desde: Dia; porcentajes: Porcentaje[] };

export type Parte = { socioId: string; nombre: string; importe: Centavos };

const DIVISOR = 10_000n;

/** División entera hacia abajo (también para negativos). */
function dividirHaciaAbajo(a: bigint, b: bigint): bigint {
  const q = a / b;
  return a % b !== 0n && a < 0n !== b < 0n ? q - 1n : q;
}

/**
 * Reparte un total según porcentajes. Cada parte se redondea hacia abajo al centavo y lo que
 * sobra va al primer socio (según `orden`): la suma de las partes es SIEMPRE exactamente el total.
 */
export function repartir(total: Centavos, socios: Socio[], porcentajes: Porcentaje[]): Parte[] {
  if (!Number.isSafeInteger(total)) throw new RangeError("Total inválido.");
  const ordenados = [...socios].sort((a, b) => a.orden - b.orden);
  if (ordenados.length === 0) return [];
  const pct = new Map(porcentajes.map((p) => [p.socioId, p.centesimos]));
  const suma = ordenados.reduce((s, so) => s + (pct.get(so.id) ?? 0), 0);
  if (suma !== 10_000) throw new RangeError(`Los porcentajes deben sumar 100 % (suman ${suma / 100} %).`);

  const partes = ordenados.map((so) => ({
    socioId: so.id,
    nombre: so.nombre,
    importe: Number(dividirHaciaAbajo(BigInt(total) * BigInt(pct.get(so.id) ?? 0), DIVISOR)),
  }));
  const resto = total - partes.reduce((s, p) => s + p.importe, 0);
  partes[0].importe += resto;
  return partes;
}

/** Partes iguales (por defecto 50/50 con dos socios); el centésimo que no divide exacto va al primero. */
export function porcentajesIguales(socios: Socio[]): Porcentaje[] {
  const ordenados = [...socios].sort((a, b) => a.orden - b.orden);
  const base = Math.floor(10_000 / ordenados.length);
  return ordenados.map((s, i) => ({ socioId: s.id, centesimos: base + (i === 0 ? 10_000 - base * ordenados.length : 0) }));
}

/** Porcentajes vigentes en un día: la última vigencia con `desde` ≤ día; si no hay, partes iguales. */
export function vigenteEn(vigencias: Vigencia[], dia: Dia, socios: Socio[]): Porcentaje[] {
  const aplicable = [...vigencias].filter((v) => v.desde <= dia).sort((a, b) => (a.desde < b.desde ? 1 : -1))[0];
  return aplicable?.porcentajes ?? porcentajesIguales(socios);
}

export type OperacionGanancia = { dia: Dia; ganancia: Centavos };
export type Perdida = { dia: Dia; costo: Centavos };

export type ResultadoGanancia = {
  bruta: Centavos;
  perdidas: Centavos;
  neta: Centavos;
  partes: Parte[];
};

/**
 * Ganancia de un conjunto de operaciones (ya filtradas por período y sin anuladas).
 * Se agrupa por tramo de vigencia de porcentajes y se reparte cada tramo; la suma de las partes
 * es exactamente la ganancia neta.
 */
export function calcularGanancia(
  ventas: OperacionGanancia[],
  perdidas: Perdida[],
  socios: Socio[],
  vigencias: Vigencia[],
): ResultadoGanancia {
  const porTramo = new Map<string, { porcentajes: Porcentaje[]; neta: number }>();
  const sumar = (dia: Dia, importe: number) => {
    const porcentajes = vigenteEn(vigencias, dia, socios);
    const clave = JSON.stringify(porcentajes);
    const tramo = porTramo.get(clave) ?? { porcentajes, neta: 0 };
    tramo.neta += importe;
    porTramo.set(clave, tramo);
  };
  let bruta = 0;
  let totalPerdidas = 0;
  for (const v of ventas) {
    bruta += v.ganancia;
    sumar(v.dia, v.ganancia);
  }
  for (const p of perdidas) {
    totalPerdidas += p.costo;
    sumar(p.dia, -p.costo);
  }

  const acumulado = new Map<string, Parte>(
    [...socios].sort((a, b) => a.orden - b.orden).map((s) => [s.id, { socioId: s.id, nombre: s.nombre, importe: 0 }]),
  );
  for (const tramo of porTramo.values()) {
    for (const p of repartir(tramo.neta, socios, tramo.porcentajes)) acumulado.get(p.socioId)!.importe += p.importe;
  }
  return { bruta, perdidas: totalPerdidas, neta: bruta - totalPerdidas, partes: [...acumulado.values()] };
}
