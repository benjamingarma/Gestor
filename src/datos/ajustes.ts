import "server-only";
import type { Motivo } from "@/dominio/ajustes";
import { rangoDelMes } from "@/lib/meses";
import { crearClienteSupabase } from "@/lib/supabase/servidor";

function fallar(contexto: string, error: { message: string }): never {
  throw new Error(`${contexto}: ${error.message}`);
}

export type Ajuste = {
  ajuste_id: string;
  producto_id: string;
  marca: string;
  modelo: string;
  dia: string;
  cantidad: number;
  motivo: Motivo;
  costo_total_ars: number;
  costo_total_usd: number;
  nota: string | null;
  anulado_en: string | null;
  motivo_anulacion: string | null;
  registrado_por_nombre: string;
};

const COLUMNAS =
  "ajuste_id, producto_id, marca, modelo, dia, cantidad, motivo, costo_total_ars, costo_total_usd, nota, anulado_en, motivo_anulacion, registrado_por_nombre";

/** Ajustes de un mes (o de un producto), del más nuevo al más viejo. Incluye los anulados. */
export async function listarAjustes(negocioId: string, filtro: { mes?: string; productoId?: string; limite?: number }): Promise<Ajuste[]> {
  const supabase = await crearClienteSupabase();
  let consulta = supabase.from("v_ajustes").select(COLUMNAS).eq("negocio_id", negocioId);
  if (filtro.mes) {
    const [desde, hasta] = rangoDelMes(filtro.mes);
    consulta = consulta.gte("dia", desde).lt("dia", hasta);
  }
  if (filtro.productoId) consulta = consulta.eq("producto_id", filtro.productoId);
  const { data, error } = await consulta
    .order("dia", { ascending: false })
    .order("secuencia", { ascending: false })
    .limit(filtro.limite ?? 1000);
  if (error) fallar("No se pudieron leer los ajustes", error);
  return (data ?? []) as Ajuste[];
}

/** Día del primer ajuste (para armar el selector de meses). */
export async function primerDiaConAjustes(negocioId: string): Promise<string | null> {
  const supabase = await crearClienteSupabase();
  const { data, error } = await supabase.from("ajustes_stock").select("fecha").eq("negocio_id", negocioId).order("fecha").limit(1).maybeSingle();
  if (error) fallar("No se pudieron leer los ajustes", error);
  return (data?.fecha as string | undefined) ?? null;
}
