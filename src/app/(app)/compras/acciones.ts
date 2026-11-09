"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { validarCompra } from "@/dominio/compras";
import { mensajeDeError } from "@/lib/errores";
import { hoy } from "@/lib/fechas";
import { obtenerSocioActual } from "@/lib/sesion";
import { crearClienteSupabase } from "@/lib/supabase/servidor";
import { esUuid } from "@/lib/uuid";

export type CamposFormularioCompra = {
  productoId: string;
  fecha: string;
  cantidad: string;
  costoUnitarioUsd: string;
  tipoDeCambio: string;
  estimado: boolean;
  inventarioInicial: boolean;
  nota: string;
};

export type EstadoCompra = {
  error?: string;
  errores?: Partial<Record<keyof CamposFormularioCompra, string>>;
  valores?: CamposFormularioCompra;
};

export async function registrarCompra(_previo: EstadoCompra, formulario: FormData): Promise<EstadoCompra> {
  const socio = await obtenerSocioActual();
  const valores: CamposFormularioCompra = {
    productoId: String(formulario.get("productoId") ?? ""),
    fecha: String(formulario.get("fecha") ?? ""),
    cantidad: String(formulario.get("cantidad") ?? ""),
    costoUnitarioUsd: String(formulario.get("costoUnitarioUsd") ?? ""),
    tipoDeCambio: String(formulario.get("tipoDeCambio") ?? ""),
    estimado: formulario.get("estimado") === "on",
    inventarioInicial: formulario.get("inventarioInicial") === "on",
    nota: String(formulario.get("nota") ?? "").slice(0, 500),
  };

  const id = String(formulario.get("id") ?? "");
  if (!esUuid(id)) return { error: "Recargá la pantalla e intentá de nuevo.", valores };

  const resultado = validarCompra(valores, hoy());
  if (!resultado.ok) return { errores: resultado.errores, valores };
  const c = resultado.compra;

  const supabase = await crearClienteSupabase();
  const { error } = await supabase.rpc("registrar_compra", {
    p_id: id,
    p_negocio_id: socio.negocioId,
    p_producto_id: c.productoId,
    p_fecha: c.fecha,
    p_cantidad: c.cantidad,
    p_costo_unitario_usd: c.costoUnitarioUsd,
    p_tipo_cambio: c.tipoDeCambio,
    p_tipo_cambio_estimado: valores.estimado,
    p_nota: valores.nota || null,
    p_origen: valores.inventarioInicial ? "inventario_inicial" : "compra",
  });
  if (error) return { error: mensajeDeError(error, "No se pudo guardar la compra."), valores };

  revalidatePath("/productos");
  revalidatePath("/compras");
  redirect(`/productos/${c.productoId}?ok=compra`);
}

export type EstadoAnulacion = { error?: string };

export async function anularCompra(_previo: EstadoAnulacion, formulario: FormData): Promise<EstadoAnulacion> {
  await obtenerSocioActual();
  const compraId = String(formulario.get("compraId") ?? "");
  const productoId = String(formulario.get("productoId") ?? "");
  const motivo = String(formulario.get("motivo") ?? "").trim();
  if (!motivo) return { error: "Escribí el motivo de la anulación." };

  const supabase = await crearClienteSupabase();
  const { error } = await supabase.rpc("anular_compra", { p_compra_id: compraId, p_motivo: motivo.slice(0, 300) });
  if (error) return { error: mensajeDeError(error, "No se pudo anular la compra.") };

  revalidatePath("/productos");
  revalidatePath("/compras");
  redirect(`/productos/${productoId}?ok=anulada`);
}
