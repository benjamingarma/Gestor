import "server-only";
import type { FilaPerdida } from "@/dominio/ajustes";
import type { Socio, Vigencia } from "@/dominio/ganancia";
import type { Capital, DatosTablero } from "@/dominio/tablero";
import { listarSaldos } from "./cuentas";
import { crearClienteSupabase } from "@/lib/supabase/servidor";

function fallar(contexto: string, error: { message: string }): never {
  throw new Error(`${contexto}: ${error.message}`);
}

/**
 * Lee todas las filas de una consulta en páginas de 1000 (la API de Supabase devuelve como
 * máximo 1000 filas por pedido; sin esto los totales quedarían cortados sin aviso).
 */
async function leerTodo<T>(pagina: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>, contexto: string): Promise<T[]> {
  const TAM = 1000;
  const filas: T[] = [];
  for (let desde = 0; ; desde += TAM) {
    const { data, error } = await pagina(desde, desde + TAM - 1);
    if (error) fallar(contexto, error);
    filas.push(...(data ?? []));
    if (!data || data.length < TAM) return filas;
  }
}

export type GananciaDia = { dia: string; ventas: number; unidades: number; importe: number; costo_ars: number; costo_usd: number; ganancia: number };
export type CobroDia = { dia: string; medio: "efectivo" | "transferencia" | "mercado_pago"; recibido_por: string; recibido_por_nombre: string; cobros: number; total: number };
export type { Capital } from "@/dominio/tablero";

export async function leerSociosYReparto(negocioId: string): Promise<{ socios: Socio[]; vigencias: Vigencia[] }> {
  const supabase = await crearClienteSupabase();
  const [socios, reparto] = await Promise.all([
    supabase.from("socios").select("id, nombre, orden").eq("negocio_id", negocioId).order("orden"),
    supabase.from("reparto_porcentajes").select("vigente_desde, socio_id, centesimos").eq("negocio_id", negocioId).order("vigente_desde"),
  ]);
  if (socios.error) fallar("No se pudieron leer los socios", socios.error);
  if (reparto.error) fallar("No se pudo leer el reparto", reparto.error);
  const porFecha = new Map<string, Vigencia>();
  for (const r of reparto.data ?? []) {
    const v: Vigencia = porFecha.get(r.vigente_desde) ?? { desde: r.vigente_desde, porcentajes: [] };
    v.porcentajes.push({ socioId: r.socio_id, centesimos: r.centesimos });
    porFecha.set(r.vigente_desde, v);
  }
  return { socios: (socios.data ?? []) as Socio[], vigencias: [...porFecha.values()] };
}

/** Ganancia, pérdidas por ajustes y cobros por día de TODO el historial (filas chicas: una por día). */
export async function leerMovimientosDiarios(negocioId: string): Promise<{ ganancias: GananciaDia[]; perdidas: FilaPerdida[]; cobros: CobroDia[] }> {
  const supabase = await crearClienteSupabase();
  const [ganancias, perdidas, cobros] = await Promise.all([
    leerTodo<GananciaDia>(
      (d, h) => supabase.from("v_ganancia_diaria").select("dia, ventas, unidades, importe, costo_ars, costo_usd, ganancia").eq("negocio_id", negocioId).order("dia").range(d, h),
      "No se pudo leer la ganancia",
    ),
    leerTodo<FilaPerdida>(
      (d, h) => supabase.from("v_perdidas_diarias").select("dia, ajustes, unidades, costo_ars, costo_usd").eq("negocio_id", negocioId).order("dia").range(d, h),
      "No se pudieron leer las pérdidas por ajustes",
    ),
    leerTodo<CobroDia>(
      (d, h) =>
        supabase
          .from("v_cobros_diarios")
          .select("dia, medio, recibido_por, recibido_por_nombre, cobros, total")
          .eq("negocio_id", negocioId)
          .order("dia")
          .order("medio")
          .order("recibido_por")
          .range(d, h),
      "No se pudieron leer los cobros",
    ),
  ]);
  return { ganancias, perdidas, cobros };
}

export async function leerCapital(negocioId: string): Promise<Capital> {
  const supabase = await crearClienteSupabase();
  const { data, error } = await supabase.from("v_capital").select("*").eq("negocio_id", negocioId).single();
  if (error) fallar("No se pudo leer el capital", error);
  return data as Capital;
}

/** Todo lo que necesita armarTablero, leído en paralelo. */
export async function leerDatosTablero(negocioId: string): Promise<DatosTablero> {
  const [{ socios, vigencias }, { ganancias, perdidas, cobros }, capital, saldos] = await Promise.all([
    leerSociosYReparto(negocioId),
    leerMovimientosDiarios(negocioId),
    leerCapital(negocioId),
    listarSaldos(negocioId),
  ]);
  return { socios, vigencias, ganancias, perdidas, cobros, capital, saldos };
}
