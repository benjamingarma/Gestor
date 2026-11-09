/**
 * Teléfonos argentinos: se guardan tal como los escribe el socio y se normalizan solo para
 * armar el enlace de WhatsApp. Si no tiene característica, se asume Tucumán (381).
 *
 *   "381 15 555-1234", "0381 155551234", "3815551234", "555-1234", "+54 9 381 555 1234"
 *   -> https://wa.me/5493815551234
 */
export const CARACTERISTICA_POR_DEFECTO = "381";

/** Número nacional de 10 dígitos (característica + número, sin 0 ni 15), o null si no se reconoce. */
export function numeroNacional(texto: string | null | undefined): string | null {
  if (!texto) return null;
  let d = texto.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("54") && d.length >= 12) {
    d = d.slice(2);
    if (d.startsWith("9")) d = d.slice(1);
  }
  if (d.startsWith("0")) d = d.slice(1);

  if (d.length === 12) {
    // Característica de 2, 3 o 4 dígitos seguida de "15" (celular marcado localmente).
    for (const largo of [2, 3, 4]) {
      if (d.slice(largo, largo + 2) === "15") {
        d = d.slice(0, largo) + d.slice(largo + 2);
        break;
      }
    }
  }
  if (d.length === 9 && d.startsWith("15")) d = d.slice(2); // "15 555-1234" sin característica
  if (d.length === 7) d = CARACTERISTICA_POR_DEFECTO + d;
  return d.length === 10 ? d : null;
}

export function enlaceWhatsApp(texto: string | null | undefined): string | null {
  const n = numeroNacional(texto);
  return n ? `https://wa.me/549${n}` : null;
}

/** Enlace para llamar: se marca tal cual lo escribió el socio (funciona igual que marcarlo a mano). */
export function enlaceLlamada(texto: string | null | undefined): string | null {
  if (!texto) return null;
  const limpio = texto.replace(/[^\d+]/g, "");
  return limpio.replace(/\D/g, "").length >= 6 ? `tel:${limpio}` : null;
}
