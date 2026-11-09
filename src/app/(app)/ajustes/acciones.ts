"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { validarAjuste, type CamposAjuste } from "@/dominio/ajustes";
import { obtenerStockProducto } from "@/datos/inventario";
import { mensajeDeError } from "@/lib/errores";
import { hoy } from "@/lib/fechas";
import { obtenerSocioActual } from "@/lib/sesion";
import { crearClienteSupabase } from "@/lib/supabase/servidor";
import { esUuid } from "@/lib/uuid";

export type EstadoAjuste = {
  error?: string;
  errores?: Partial<Record<keyof CamposAjuste, string>>;
  valores?: CamposAjuste;
};

export async function registrarAjuste(_previo: EstadoAjuste, formulario: FormData): Promise<EstadoAjuste> {
  const socio = await obtenerSocioActual();
  const valores: CamposAjuste = {
    motivo: String(formulario.get("motivo") ?? ""),
    cantidad: String(formulario.get("cantidad") ?? ""),
    fecha: String(formulario.get("fecha") ?? ""),
    nota: String(formulario.get("nota") ?? "").slice(0, 600),
  };
  const id = String(formulario.get("id") ?? "");
  const productoId = String(formulario.get("productoId") ?? "");
  if (!esUuid(id) || !esUuid(productoId)) return { error: "Recargá la pantalla e intentá de nuevo.", valores };

  const producto = await obtenerStockProducto(socio.negocioId, productoId);
  if (!producto) return { error: "El producto no existe.", valores };

  const r = validarAjuste(valores, hoy(), producto.unidades);
  if (!r.ok) return { errores: r.errores, valores };

  const supabase = await crearClienteSupabase();
  const { error } = await supabase.rpc("registrar_ajuste", {
    p_id: id,
    p_negocio_id: socio.negocioId,
    p_producto_id: productoId,
    p_cantidad: r.ajuste.cantidad,
    p_motivo: r.ajuste.motivo,
    p_fecha: r.ajuste.fecha,
    p_nota: r.ajuste.nota,
  });
  if (error) return { error: mensajeDeError(error, "No se pudo guardar el ajuste."), valores };

  revalidatePath("/", "layout");
  redirect(`/productos/${productoId}?ok=ajuste#ajustes`);
}

export type EstadoAnulacionAjuste = { error?: string };

/** Anula un ajuste. `volverA` es la pantalla desde la que se anuló (ficha del producto o lista de ajustes). */
export async function anularAjuste(_previo: EstadoAnulacionAjuste, formulario: FormData): Promise<EstadoAnulacionAjuste> {
  await obtenerSocioActual();
  const ajusteId = String(formulario.get("ajusteId") ?? "");
  const motivo = String(formulario.get("motivo") ?? "").trim();
  const volverA = String(formulario.get("volverA") ?? "/ajustes");
  if (!esUuid(ajusteId)) return { error: "Recargá la pantalla." };
  if (!motivo) return { error: "Escribí el motivo de la anulación." };

  const supabase = await crearClienteSupabase();
  const { error } = await supabase.rpc("anular_ajuste", { p_ajuste_id: ajusteId, p_motivo: motivo.slice(0, 300) });
  if (error) return { error: mensajeDeError(error, "No se pudo anular el ajuste.") };

  revalidatePath("/", "layout");
  // Solo rutas internas de la app.
  const destino = /^\/(productos\/[0-9a-f-]{36}|ajustes)(\?mes=(\d{4}-\d{2}|todo))?$/.test(volverA) ? volverA : "/ajustes";
  redirect(`${destino}${destino.includes("?") ? "&" : "?"}ok=ajuste-anulado#ajustes`);
}
