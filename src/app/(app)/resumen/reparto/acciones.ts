"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parsearImporte } from "@/lib/dinero";
import { mensajeDeError } from "@/lib/errores";
import { esDiaValido, hoy } from "@/lib/fechas";
import { obtenerSocioActual } from "@/lib/sesion";
import { crearClienteSupabase } from "@/lib/supabase/servidor";

export type EstadoReparto = { error?: string };

export async function configurarReparto(_p: EstadoReparto, formulario: FormData): Promise<EstadoReparto> {
  const socio = await obtenerSocioActual();
  const desde = String(formulario.get("desde") ?? "");
  if (!esDiaValido(desde) || desde < hoy()) return { error: "Elegí hoy o una fecha futura." };

  const porcentajes: { socio_id: string; centesimos: number }[] = [];
  for (const [clave, valor] of formulario.entries()) {
    if (!clave.startsWith("pct-")) continue;
    // "50", "49,5" o "33,33": parsearImporte devuelve centésimos (igual que centavos).
    const p = parsearImporte(String(valor));
    if (!p.ok) return { error: `Porcentaje inválido: ${String(valor) || "(vacío)"}` };
    porcentajes.push({ socio_id: clave.slice(4), centesimos: p.centavos });
  }
  const suma = porcentajes.reduce((s, p) => s + p.centesimos, 0);
  if (suma !== 10_000) return { error: `Los porcentajes tienen que sumar 100 (suman ${(suma / 100).toLocaleString("es-AR")}).` };

  const supabase = await crearClienteSupabase();
  const { error } = await supabase.rpc("configurar_reparto", {
    p_negocio_id: socio.negocioId,
    p_vigente_desde: desde,
    p_porcentajes: porcentajes,
  });
  if (error) return { error: mensajeDeError(error, "No se pudo guardar el reparto.") };
  revalidatePath("/resumen", "layout");
  redirect("/resumen/reparto?ok=1");
}
