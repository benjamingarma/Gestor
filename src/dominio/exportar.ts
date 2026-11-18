/**
 * Exportar todo a CSV (módulo 1.9, plan sección 10): un CSV por tabla, para abrir en Excel o Google Sheets.
 * - Separador ";" y fin de línea CRLF, con BOM UTF-8: el Excel en español lo abre en columnas y con acentos.
 * - Montos (centavos en la base) en pesos/dólares con coma decimal y sin miles: 12345,50.
 * - Fechas y horas en hora de Tucumán. Sí/no para verdadero/falso. Vacío para null.
 * - Un texto que empieza con = + - @ lleva un apóstrofo adelante: si no, Excel lo ejecutaría como fórmula.
 */
import { ZONA_HORARIA } from "@/lib/fechas";

/** Columnas guardadas en centavos (pesos o dólares). */
export const COLUMNAS_DINERO = new Set([
  "importe", "precio", "precio_general", "precio_unitario",
  "costo_unitario_usd", "costo_unitario_ars", "costo_total_usd", "costo_total_ars", "tipo_cambio",
]);

/** 1234550 -> "12345,50"; -500 -> "-5,00". */
export function centavosACsv(centavos: number): string {
  if (!Number.isSafeInteger(centavos)) throw new RangeError(`Monto inválido: ${centavos}`);
  const signo = centavos < 0 ? "-" : "";
  const abs = Math.abs(centavos);
  return `${signo}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, "0")}`;
}

const formatoInstante = new Intl.DateTimeFormat("sv-SE", {
  timeZone: ZONA_HORARIA, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
});
const ES_INSTANTE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/** Valor de la base -> texto de la celda (sin comillas: eso lo hace `escapar`). */
export function celda(valor: unknown, columna: string): string {
  if (valor === null || valor === undefined) return "";
  if (typeof valor === "boolean") return valor ? "sí" : "no";
  if (COLUMNAS_DINERO.has(columna)) return centavosACsv(Number(valor));
  if (typeof valor === "number") return String(valor);
  const texto = typeof valor === "string" ? valor : JSON.stringify(valor);
  if (ES_INSTANTE.test(texto)) return formatoInstante.format(new Date(texto)); // "2026-11-18 10:15:00" en Tucumán
  return /^[=+\-@]/.test(texto) ? `'${texto}` : texto;
}

/** Comillas si hace falta (separador, comillas o salto de línea), duplicando las comillas internas. */
export function escapar(texto: string): string {
  return /[;"\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

/** Filas de una tabla -> CSV con encabezado (las columnas salen de la primera fila o de `columnas`). */
export function aCsv(filas: Record<string, unknown>[], columnas?: string[]): string {
  const cols = columnas ?? (filas[0] ? Object.keys(filas[0]) : []);
  const lineas = [cols.map(escapar).join(";"), ...filas.map((f) => cols.map((c) => escapar(celda(f[c], c))).join(";"))];
  return `﻿${lineas.join("\r\n")}\r\n`;
}
