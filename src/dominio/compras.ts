/**
 * Lógica pura de una compra en USD: validación de lo que escribe el socio y cálculo de costos.
 * La base de datos aplica exactamente las mismas fórmulas al guardar (columnas generadas de
 * `compras`); acá se usan para mostrar el resultado ANTES de confirmar.
 */
import { convertirDolaresAPesos, multiplicar, parsearImporte, type Centavos } from "@/lib/dinero";
import { esDiaValido, type Dia } from "@/lib/fechas";

// Mismos límites que la base (tabla compras). Con estos máximos el total de una compra
// siempre entra en un entero exacto de JavaScript (lo verifica una prueba con fast-check).
export const MAXIMA_CANTIDAD = 10_000;
export const MAXIMO_COSTO_USD = 1_000_000; // USD 10.000 por unidad, en centavos
export const MAXIMO_TIPO_DE_CAMBIO = 10_000_000; // $100.000 por dólar, en centavos

export type CostosCompra = {
  costoUnitarioArs: Centavos;
  totalUsd: Centavos;
  totalArs: Centavos;
};

/** Costos de una compra. totalArs = cantidad × costo unitario en pesos YA redondeado (plan A7). */
export function calcularCostosCompra(
  cantidad: number,
  costoUnitarioUsd: Centavos,
  tipoDeCambio: Centavos,
): CostosCompra {
  const costoUnitarioArs = convertirDolaresAPesos(costoUnitarioUsd, tipoDeCambio);
  return {
    costoUnitarioArs,
    totalUsd: multiplicar(costoUnitarioUsd, cantidad),
    totalArs: multiplicar(costoUnitarioArs, cantidad),
  };
}

export type CamposCompra = {
  productoId: string;
  fecha: string;
  cantidad: string;
  costoUnitarioUsd: string;
  tipoDeCambio: string;
};

export type CompraValidada = {
  productoId: string;
  fecha: Dia;
  cantidad: number;
  costoUnitarioUsd: Centavos;
  tipoDeCambio: Centavos;
};

export type ResultadoValidacion =
  | { ok: true; compra: CompraValidada; costos: CostosCompra }
  | { ok: false; errores: Partial<Record<keyof CamposCompra, string>> };

/** Valida los campos del formulario. `hoy` es el día actual en Tucumán. */
export function validarCompra(campos: CamposCompra, hoy: Dia): ResultadoValidacion {
  const errores: Partial<Record<keyof CamposCompra, string>> = {};

  if (!campos.productoId) errores.productoId = "Elegí el producto.";

  if (!esDiaValido(campos.fecha)) errores.fecha = "Ingresá la fecha de compra.";
  else if (campos.fecha > hoy) errores.fecha = "La fecha no puede ser futura.";
  else if (campos.fecha < "2020-01-01") errores.fecha = "La fecha es demasiado vieja.";

  const textoCantidad = campos.cantidad.trim().replace(/\./g, "");
  const cantidad = Number(textoCantidad);
  if (!/^\d+$/.test(textoCantidad) || cantidad < 1) errores.cantidad = "Ingresá una cantidad entera mayor a 0.";
  else if (cantidad > MAXIMA_CANTIDAD) errores.cantidad = "La cantidad es demasiado grande.";

  const usd = parsearImporte(campos.costoUnitarioUsd);
  if (!usd.ok) errores.costoUnitarioUsd = usd.error;
  else if (usd.centavos > MAXIMO_COSTO_USD) errores.costoUnitarioUsd = "El costo es demasiado grande.";

  const tc = parsearImporte(campos.tipoDeCambio);
  if (!tc.ok) errores.tipoDeCambio = tc.error;
  else if (tc.centavos <= 0) errores.tipoDeCambio = "El tipo de cambio debe ser mayor que cero.";
  else if (tc.centavos > MAXIMO_TIPO_DE_CAMBIO) errores.tipoDeCambio = "El tipo de cambio es demasiado grande.";

  if (Object.keys(errores).length > 0 || !usd.ok || !tc.ok) return { ok: false, errores };

  const compra: CompraValidada = {
    productoId: campos.productoId,
    fecha: campos.fecha,
    cantidad,
    costoUnitarioUsd: usd.centavos,
    tipoDeCambio: tc.centavos,
  };
  return { ok: true, compra, costos: calcularCostosCompra(cantidad, usd.centavos, tc.centavos) };
}
