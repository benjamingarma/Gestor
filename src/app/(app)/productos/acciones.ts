"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { parsearImporte } from "@/lib/dinero";
import { mensajeDeError } from "@/lib/errores";
import { obtenerSocioActual } from "@/lib/sesion";
import { crearClienteSupabase } from "@/lib/supabase/servidor";
import { esUuid } from "@/lib/uuid";

export type EstadoProducto = {
  error?: string;
  errores?: { marca?: string; modelo?: string; precioGeneral?: string };
  valores?: { marca: string; modelo: string; precioGeneral: string };
};

const texto = z.string().trim().min(1, "Completá este campo.").max(60, "Máximo 60 caracteres.");

function leerProducto(formulario: FormData) {
  const valores = {
    marca: String(formulario.get("marca") ?? ""),
    modelo: String(formulario.get("modelo") ?? ""),
    precioGeneral: String(formulario.get("precioGeneral") ?? ""),
  };
  const errores: EstadoProducto["errores"] = {};
  const marca = texto.safeParse(valores.marca);
  const modelo = texto.safeParse(valores.modelo);
  if (!marca.success) errores.marca = marca.error.issues[0].message;
  if (!modelo.success) errores.modelo = modelo.error.issues[0].message;

  let precioGeneral: number | null = null;
  if (valores.precioGeneral.trim() !== "") {
    const p = parsearImporte(valores.precioGeneral);
    if (p.ok) precioGeneral = p.centavos;
    else errores.precioGeneral = p.error;
  }
  return { valores, errores, marca: marca.data, modelo: modelo.data, precioGeneral };
}

export async function crearProducto(_previo: EstadoProducto, formulario: FormData): Promise<EstadoProducto> {
  const socio = await obtenerSocioActual();
  const { valores, errores, marca, modelo, precioGeneral } = leerProducto(formulario);
  if (Object.keys(errores).length > 0 || !marca || !modelo) return { errores, valores };

  const id = String(formulario.get("id") ?? "");
  if (!esUuid(id)) return { error: "Recargá la pantalla e intentá de nuevo.", valores };

  const supabase = await crearClienteSupabase();
  const { error } = await supabase
    .from("productos")
    .insert({ id, negocio_id: socio.negocioId, marca, modelo, precio_general: precioGeneral });

  // Reintento del mismo alta (doble toque / mala señal): si ya existe con este id, seguimos.
  if (error && !(error.code === "23505" && error.message.includes("productos_pkey"))) {
    return { error: mensajeDeError(error, "No se pudo guardar el producto."), valores };
  }
  revalidatePath("/productos");
  redirect(`/productos/${id}?ok=producto`);
}

export async function editarProducto(_previo: EstadoProducto, formulario: FormData): Promise<EstadoProducto> {
  await obtenerSocioActual();
  const id = String(formulario.get("id") ?? "");
  const { valores, errores, marca, modelo, precioGeneral } = leerProducto(formulario);
  if (Object.keys(errores).length > 0 || !marca || !modelo) return { errores, valores };
  const activo = formulario.get("activo") === "on";

  const supabase = await crearClienteSupabase();
  const { error } = await supabase
    .from("productos")
    .update({ marca, modelo, precio_general: precioGeneral, activo })
    .eq("id", id);
  if (error) return { error: mensajeDeError(error, "No se pudo guardar el producto."), valores };

  revalidatePath("/productos");
  revalidatePath(`/productos/${id}`);
  redirect(`/productos/${id}?ok=editado`);
}
