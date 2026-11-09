/**
 * Próxima visita y atraso de cada cliente (plan, decisión 10 y A13).
 *
 *   Última actividad = la más reciente entre: última visita, última venta (módulo 1.3)
 *                      y la última visita anterior a la app (importación).
 *   Próxima visita   = última actividad + intervalo. Si nunca hubo actividad: fecha de alta + intervalo.
 *   Atrasado         = hoy > próxima visita (desde el día SIGUIENTE a la fecha prevista).
 */
import { diasEntre, sumarDias, type Dia } from "@/lib/fechas";

export const DIAS_PRONTO = 3;

export type DatosVisitaCliente = {
  fechaAlta: Dia;
  intervaloDias: number;
  ultimaVisita: Dia | null;
  ultimaVenta: Dia | null;
  ultimaVisitaInicial: Dia | null;
  archivado: boolean;
};

export type EstadoVisita =
  | { tipo: "archivado" }
  | { tipo: "atrasado"; proxima: Dia; diasAtraso: number }
  | { tipo: "hoy"; proxima: Dia }
  | { tipo: "pronto"; proxima: Dia; diasFaltan: number }
  | { tipo: "al_dia"; proxima: Dia; diasFaltan: number };

export function ultimaActividad(d: DatosVisitaCliente): Dia | null {
  const fechas = [d.ultimaVisita, d.ultimaVenta, d.ultimaVisitaInicial].filter((f): f is Dia => f !== null);
  if (fechas.length === 0) return null;
  return fechas.reduce((max, f) => (f > max ? f : max));
}

export function proximaVisita(d: DatosVisitaCliente): Dia {
  if (!Number.isInteger(d.intervaloDias) || d.intervaloDias < 1) {
    throw new RangeError("El intervalo de visita debe ser un entero mayor a 0.");
  }
  return sumarDias(ultimaActividad(d) ?? d.fechaAlta, d.intervaloDias);
}

export function estadoVisita(d: DatosVisitaCliente, hoy: Dia): EstadoVisita {
  if (d.archivado) return { tipo: "archivado" };
  const proxima = proximaVisita(d);
  const faltan = diasEntre(hoy, proxima);
  if (faltan < 0) return { tipo: "atrasado", proxima, diasAtraso: -faltan };
  if (faltan === 0) return { tipo: "hoy", proxima };
  if (faltan <= DIAS_PRONTO) return { tipo: "pronto", proxima, diasFaltan: faltan };
  return { tipo: "al_dia", proxima, diasFaltan: faltan };
}

/** ¿Va en la lista "A visitar"? Atrasados, los de hoy y los de los próximos días. */
export function hayQueVisitar(e: EstadoVisita): boolean {
  return e.tipo === "atrasado" || e.tipo === "hoy" || e.tipo === "pronto";
}

/** Orden de la lista "A visitar": el más atrasado primero; después hoy; después el más cercano. */
export function compararParaVisitar(a: EstadoVisita, b: EstadoVisita): number {
  return urgencia(b) - urgencia(a);
}

function urgencia(e: EstadoVisita): number {
  switch (e.tipo) {
    case "atrasado":
      return 1000 + e.diasAtraso;
    case "hoy":
      return 1000;
    case "pronto":
    case "al_dia":
      return 1000 - e.diasFaltan;
    case "archivado":
      return -Infinity;
  }
}
