/**
 * Ajustes de stock (plan, decisión 5 y A9): regalo, pérdida o rotura. Solo salidas.
 *
 * La base de datos es la autoridad: `registrar_ajuste` consume las compras por FIFO y guarda el
 * costo (USD y pesos) de cada unidad como copia histórica. Acá está la validación del formulario,
 * la vista previa del costo (la misma simulación FIFO que usa la venta) y la conversión de las
 * pérdidas por día al formato que usa el cálculo de la ganancia.
 */
import type { Centavos } from "@/lib/dinero";
import { esDiaValido, type Dia } from "@/lib/fechas";
import type { Perdida } from "./ganancia";
import { simularFifo, type CompraDisponible, type ResultadoFifo } from "./ventas";

export type Motivo = "regalo" | "perdida" | "rotura";

export const MOTIVOS: { valor: Motivo; etiqueta: string; ayuda: string }[] = [
  { valor: "regalo", etiqueta: "Regalo", ayuda: "Se regaló (a un cliente, una promo…)" },
  { valor: "perdida", etiqueta: "Pérdida", ayuda: "Se perdió o no aparece" },
  { valor: "rotura", etiqueta: "Rotura", ayuda: "Se rompió o vino fallado" },
];

export function nombreDelMotivo(motivo: string): string {
  return MOTIVOS.find((m) => m.valor === motivo)?.etiqueta ?? motivo;
}

export function esMotivo(texto: string): texto is Motivo {
  return MOTIVOS.some((m) => m.valor === texto);
}

/** Mismo límite que la base (tabla ajustes_stock). */
export const MAXIMA_CANTIDAD_AJUSTE = 10_000;

export type CamposAjuste = { motivo: string; cantidad: string; fecha: string; nota: string };
export type AjusteValidado = { motivo: Motivo; cantidad: number; fecha: Dia; nota: string | null };
export type ResultadoValidacionAjuste =
  | { ok: true; ajuste: AjusteValidado }
  | { ok: false; errores: Partial<Record<keyof CamposAjuste, string>> };

/** Valida el formulario. `hoy` es el día actual en Tucumán; `stock` las unidades disponibles. */
export function validarAjuste(campos: CamposAjuste, hoy: Dia, stock: number): ResultadoValidacionAjuste {
  const errores: Partial<Record<keyof CamposAjuste, string>> = {};

  if (!esMotivo(campos.motivo)) errores.motivo = "Elegí el motivo: regalo, pérdida o rotura.";

  const texto = campos.cantidad.trim().replace(/\./g, "");
  const cantidad = Number(texto);
  if (!/^\d+$/.test(texto) || cantidad < 1) errores.cantidad = "Ingresá una cantidad entera mayor a 0.";
  else if (cantidad > MAXIMA_CANTIDAD_AJUSTE) errores.cantidad = "La cantidad es demasiado grande.";
  else if (cantidad > stock) errores.cantidad = `No hay tantas: quedan ${stock} en stock.`;

  if (!esDiaValido(campos.fecha)) errores.fecha = "Ingresá la fecha.";
  else if (campos.fecha > hoy) errores.fecha = "La fecha no puede ser futura.";
  else if (campos.fecha < "2020-01-01") errores.fecha = "La fecha es demasiado vieja.";

  const nota = campos.nota.trim();
  if (nota.length > 500) errores.nota = "La nota es demasiado larga (máximo 500 letras).";

  if (Object.keys(errores).length > 0 || !esMotivo(campos.motivo)) return { ok: false, errores };
  return { ok: true, ajuste: { motivo: campos.motivo, cantidad, fecha: campos.fecha, nota: nota || null } };
}

/** Costo que va a tener el ajuste (vista previa: la base hace el mismo cálculo al guardar). */
export function costoDelAjuste(compras: CompraDisponible[], cantidad: number): ResultadoFifo {
  return simularFifo(compras, cantidad);
}

/** Fila de la vista v_perdidas_diarias (ajustes no anulados, por día). */
export type FilaPerdida = { dia: Dia; ajustes: number; unidades: number; costo_ars: Centavos; costo_usd: Centavos };

/** Pérdidas por día en el formato de `calcularGanancia` (resta el costo en pesos). */
export function perdidasParaGanancia(filas: FilaPerdida[]): Perdida[] {
  return filas.map((f) => ({ dia: f.dia, costo: f.costo_ars }));
}

export function totalesPerdidas(filas: FilaPerdida[]) {
  return filas.reduce(
    (t, f) => ({
      ajustes: t.ajustes + f.ajustes,
      unidades: t.unidades + f.unidades,
      costoArs: t.costoArs + f.costo_ars,
      costoUsd: t.costoUsd + f.costo_usd,
    }),
    { ajustes: 0, unidades: 0, costoArs: 0, costoUsd: 0 },
  );
}
