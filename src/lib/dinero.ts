/**
 * Dinero: todo se maneja en CENTAVOS ENTEROS, nunca con decimales de punto flotante.
 *
 *   Pesos:          $ 12.345,50      -> 1234550   (centavos de peso)
 *   Dólares:        USD 4,99         -> 499       (centavos de dólar)
 *   Tipo de cambio: $ 1.237,50 / USD -> 123750    (centavos de peso por dólar)
 *
 * Estas funciones no dependen de la base ni de la interfaz, así que se prueban solas
 * (ver dinero.test.ts).
 */

/** Un monto en centavos (entero). */
export type Centavos = number;

/** Mayor monto aceptado: 90 billones de pesos. Evita superar la precisión de los enteros de JS. */
export const MAXIMO_CENTAVOS = Number.MAX_SAFE_INTEGER;

export function esCentavosValidos(valor: unknown): valor is Centavos {
  return typeof valor === "number" && Number.isSafeInteger(valor);
}

function asegurarCentavos(valor: number, nombre: string): void {
  if (!esCentavosValidos(valor)) {
    throw new RangeError(`${nombre} debe ser un número entero de centavos (recibido: ${valor})`);
  }
}

// ---------------------------------------------------------------------------------
// Formato para mostrar
// ---------------------------------------------------------------------------------

function separarMiles(entero: string): string {
  return entero.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/**
 * Formatea centavos con el formato argentino: punto para miles, coma para decimales.
 * @param siempreDecimales si es false, omite ",00" cuando no hay centavos.
 */
function formatearCentavos(centavos: Centavos, siempreDecimales: boolean): string {
  asegurarCentavos(centavos, "El monto");
  const negativo = centavos < 0;
  const absoluto = Math.abs(centavos);
  const entero = Math.floor(absoluto / 100);
  const resto = absoluto % 100;
  let texto = separarMiles(String(entero));
  if (siempreDecimales || resto !== 0) {
    texto += "," + String(resto).padStart(2, "0");
  }
  return (negativo ? "-" : "") + texto;
}

/** $ 12.345,50 · $ 12.345 (sin ",00") · -$ 1.000 */
export function formatearPesos(centavos: Centavos): string {
  const texto = formatearCentavos(centavos, false);
  return texto.startsWith("-") ? `-$ ${texto.slice(1)}` : `$ ${texto}`;
}

/** USD 4,99 · USD 50,00 (dólares siempre con dos decimales) */
export function formatearDolares(centavos: Centavos): string {
  const texto = formatearCentavos(centavos, true);
  return texto.startsWith("-") ? `-USD ${texto.slice(1)}` : `USD ${texto}`;
}

/** Tipo de cambio en pesos por dólar: $ 1.237,50 */
export function formatearTipoDeCambio(centavosPorDolar: Centavos): string {
  return formatearPesos(centavosPorDolar);
}

// ---------------------------------------------------------------------------------
// Lectura de lo que escribe el usuario
// ---------------------------------------------------------------------------------

export type ResultadoParseo =
  | { ok: true; centavos: Centavos }
  | { ok: false; error: string };

/**
 * Lee un importe escrito en formato argentino y lo devuelve en centavos.
 *
 * Acepta: "12345", "12.345", "12345,5", "12.345,50", "$ 12.345,50", "USD 4,99".
 * Rechaza: vacío, negativos, más de 2 decimales, puntos mal ubicados
 * y el caso ambiguo "12.50" (¿doce pesos con cincuenta o mil doscientos cincuenta?).
 */
export function parsearImporte(texto: string): ResultadoParseo {
  const limpio = texto
    .trim()
    .replace(/^(US\$|USD|U\$S|\$)\s*/i, "")
    .replace(/\s+/g, "");

  if (limpio === "") return { ok: false, error: "Ingresá un importe." };
  if (limpio.startsWith("-")) return { ok: false, error: "El importe no puede ser negativo." };

  let parteEntera: string;
  let parteDecimal = "";

  if (limpio.includes(",")) {
    const partes = limpio.split(",");
    if (partes.length !== 2) return { ok: false, error: "Usá una sola coma para los centavos." };
    [parteEntera, parteDecimal] = partes;
    if (!/^\d{1,2}$/.test(parteDecimal)) {
      return { ok: false, error: "Después de la coma van como máximo 2 dígitos." };
    }
    if (parteEntera === "") parteEntera = "0";
  } else {
    parteEntera = limpio;
  }

  if (parteEntera.includes(".")) {
    // Los puntos solo pueden separar miles: 1.234 · 12.345.678
    if (!/^\d{1,3}(\.\d{3})+$/.test(parteEntera)) {
      return {
        ok: false,
        error: "Formato no reconocido. Usá punto para los miles y coma para los centavos (ej: 12.345,50).",
      };
    }
    parteEntera = parteEntera.replace(/\./g, "");
  }

  if (!/^\d+$/.test(parteEntera)) {
    return { ok: false, error: "El importe solo puede tener números, puntos y una coma." };
  }

  const centavos = BigInt(parteEntera) * 100n + BigInt(parteDecimal.padEnd(2, "0") || "0");
  if (centavos > BigInt(MAXIMO_CENTAVOS)) return { ok: false, error: "El importe es demasiado grande." };
  return { ok: true, centavos: Number(centavos) };
}

// ---------------------------------------------------------------------------------
// Conversión de dólares a pesos (costo de compra)
// ---------------------------------------------------------------------------------

/**
 * Costo unitario en pesos = costo unitario en USD × tipo de cambio de la compra,
 * redondeado al centavo (la mitad hacia arriba).
 *
 *   USD 4,99 × $ 1.237,50 = $ 6.175,125  ->  $ 6.175,13
 *
 * La base de datos aplica exactamente la misma regla al guardar cada compra; esta función
 * sirve para mostrar el resultado antes de confirmar.
 */
export function convertirDolaresAPesos(
  centavosDolar: Centavos,
  tipoDeCambioCentavos: Centavos,
): Centavos {
  asegurarCentavos(centavosDolar, "El costo en dólares");
  asegurarCentavos(tipoDeCambioCentavos, "El tipo de cambio");
  if (centavosDolar < 0) throw new RangeError("El costo en dólares no puede ser negativo.");
  if (tipoDeCambioCentavos <= 0) throw new RangeError("El tipo de cambio debe ser mayor que cero.");

  // (USD en centavos × pesos-centavos por dólar) / 100 = centavos de peso. BigInt evita desbordes.
  const producto = BigInt(centavosDolar) * BigInt(tipoDeCambioCentavos);
  const resultado = (producto + 50n) / 100n;
  if (resultado > BigInt(MAXIMO_CENTAVOS)) throw new RangeError("El costo convertido es demasiado grande.");
  return Number(resultado);
}

/** Multiplica un precio o costo unitario por una cantidad de unidades. */
export function multiplicar(unitario: Centavos, cantidad: number): Centavos {
  asegurarCentavos(unitario, "El importe unitario");
  if (!Number.isSafeInteger(cantidad)) throw new RangeError("La cantidad debe ser un número entero.");
  const total = unitario * cantidad;
  asegurarCentavos(total, "El total");
  return total;
}
