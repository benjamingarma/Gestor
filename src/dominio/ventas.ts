/**
 * Lógica pura de ventas. La base de datos es la autoridad (calcula el costo FIFO real al
 * guardar); estas funciones sirven para mostrar lo mismo ANTES de confirmar, y están probadas
 * para dar exactamente el mismo resultado que la base en el escenario del plan.
 */
import { multiplicar, type Centavos } from "@/lib/dinero";

// ---------------------------------------------------------------------------------
// Precio propuesto (plan, decisión 8): especial -> último que pagó -> general.
// ---------------------------------------------------------------------------------
export type OrigenPrecio = "especial" | "ultimo" | "general" | "ninguno";

export function precioPropuesto(p: {
  especial: Centavos | null;
  ultimoPagado: Centavos | null;
  general: Centavos | null;
}): { precio: Centavos | null; origen: OrigenPrecio } {
  if (p.especial !== null) return { precio: p.especial, origen: "especial" };
  if (p.ultimoPagado !== null) return { precio: p.ultimoPagado, origen: "ultimo" };
  if (p.general !== null) return { precio: p.general, origen: "general" };
  return { precio: null, origen: "ninguno" };
}

// ---------------------------------------------------------------------------------
// FIFO: qué compras consume una cantidad y cuánto cuesta.
// ---------------------------------------------------------------------------------
export type CompraDisponible = {
  compraId: string;
  fecha: string; // AAAA-MM-DD
  secuencia: number;
  disponible: number;
  costoUnitarioArs: Centavos;
  costoUnitarioUsd: Centavos;
};

export type Consumo = { compraId: string; cantidad: number; costoUnitarioArs: Centavos; costoUnitarioUsd: Centavos };

export type ResultadoFifo = {
  consumos: Consumo[];
  costoArs: Centavos;
  costoUsd: Centavos;
  faltan: number; // unidades sin stock (0 si alcanza)
};

/** Consume las compras más viejas primero (fecha, y a igual fecha, orden de carga). */
export function simularFifo(compras: CompraDisponible[], cantidad: number): ResultadoFifo {
  if (!Number.isInteger(cantidad) || cantidad < 0) throw new RangeError("Cantidad inválida.");
  const ordenadas = [...compras].sort((a, b) => (a.fecha === b.fecha ? a.secuencia - b.secuencia : a.fecha < b.fecha ? -1 : 1));
  let restante = cantidad;
  let costoArs = 0;
  let costoUsd = 0;
  const consumos: Consumo[] = [];
  for (const c of ordenadas) {
    if (restante === 0) break;
    if (c.disponible <= 0) continue;
    const tomar = Math.min(restante, c.disponible);
    restante -= tomar;
    costoArs += multiplicar(c.costoUnitarioArs, tomar);
    costoUsd += multiplicar(c.costoUnitarioUsd, tomar);
    consumos.push({ compraId: c.compraId, cantidad: tomar, costoUnitarioArs: c.costoUnitarioArs, costoUnitarioUsd: c.costoUnitarioUsd });
  }
  return { consumos, costoArs, costoUsd, faltan: restante };
}

// ---------------------------------------------------------------------------------
// Totales de una venta
// ---------------------------------------------------------------------------------
export type Renglon = { cantidad: number; precioUnitario: Centavos; costoArs: Centavos; costoUsd: Centavos };

export function totalesVenta(renglones: Renglon[]) {
  let importe = 0;
  let costoArs = 0;
  let costoUsd = 0;
  let unidades = 0;
  for (const r of renglones) {
    importe += multiplicar(r.precioUnitario, r.cantidad);
    costoArs += r.costoArs;
    costoUsd += r.costoUsd;
    unidades += r.cantidad;
  }
  return { unidades, importe, costoArs, costoUsd, ganancia: importe - costoArs };
}
