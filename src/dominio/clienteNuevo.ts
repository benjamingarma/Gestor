/**
 * Venta a un cliente nuevo desde "Nueva venta" (docs/decisiones/modulo-1.7-venta-cliente-nuevo.md).
 * El cliente se crea recién al guardar, junto con la venta (registrar_venta_cliente_nuevo en la base).
 * Acá solo las reglas de pantalla: cuándo ofrecer "Crear…" y cuándo el nombre ya existe.
 */
import { normalizar } from "@/lib/texto";

export const MAXIMO_NOMBRE = 80;
export const MAXIMO_TELEFONO = 40;
export const MENSAJE_DUPLICADO = "Ya existe un cliente con ese nombre. Agregale algo para distinguirlo (ej: barrio o apellido).";

export type ClienteConocido = { id: string; nombre: string; archivado?: boolean };

/** Nombre limpio: sin espacios al principio, al final ni repetidos (igual que la base). */
export function limpiarNombre(nombre: string): string {
  return nombre.trim().replace(/\s+/g, " ");
}

/** Igual que nombre_para_comparar() de la base: sin espacios de más, mayúsculas ni tildes. */
export function nombreParaComparar(nombre: string): string {
  return normalizar(limpiarNombre(nombre));
}

/** El cliente que ya tiene ese nombre (incluye archivados), o null. */
export function buscarDuplicado(nombre: string, clientes: ClienteConocido[]): ClienteConocido | null {
  const buscado = nombreParaComparar(nombre);
  if (!buscado) return null;
  return clientes.find((c) => nombreParaComparar(c.nombre) === buscado) ?? null;
}

/**
 * Texto para la opción `Crear "…" como cliente nuevo` del buscador: lo escrito, limpio.
 * Se ofrece siempre que haya algo escrito (también con coincidencias parciales: puede ser otra persona).
 */
export function textoParaCrear(busqueda: string): string | null {
  const t = limpiarNombre(busqueda);
  return t ? t.slice(0, MAXIMO_NOMBRE) : null;
}

export type ProblemaClienteNuevo =
  | { tipo: "nombre"; mensaje: string }
  | { tipo: "telefono"; mensaje: string }
  | { tipo: "duplicado"; mensaje: string; existente: ClienteConocido };

/** Lo que impide confirmar el cliente nuevo (null si está todo bien). */
export function problemaClienteNuevo(datos: { nombre: string; telefono: string }, clientes: ClienteConocido[]): ProblemaClienteNuevo | null {
  const nombre = limpiarNombre(datos.nombre);
  if (!nombre) return { tipo: "nombre", mensaje: "Escribí el nombre." };
  if (nombre.length > MAXIMO_NOMBRE) return { tipo: "nombre", mensaje: `Máximo ${MAXIMO_NOMBRE} caracteres.` };
  if (datos.telefono.trim().length > MAXIMO_TELEFONO) return { tipo: "telefono", mensaje: `Máximo ${MAXIMO_TELEFONO} caracteres.` };
  const existente = buscarDuplicado(nombre, clientes);
  if (existente) return { tipo: "duplicado", mensaje: MENSAJE_DUPLICADO, existente };
  return null;
}
