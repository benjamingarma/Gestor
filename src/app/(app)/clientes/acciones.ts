"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { mensajeDeError } from "@/lib/errores";
import { esDiaValido, hoy } from "@/lib/fechas";
import { obtenerSocioActual } from "@/lib/sesion";
import { crearClienteSupabase } from "@/lib/supabase/servidor";
import { esUuid } from "@/lib/uuid";

export type CamposCliente = { nombre: string; telefono: string; direccion: string; notas: string; intervalo: string };
export type EstadoCliente = {
  error?: string;
  errores?: Partial<Record<keyof CamposCliente, string>>;
  valores?: CamposCliente;
};

const esquema = z.object({
  nombre: z.string().trim().min(1, "Escribí el nombre.").max(80, "Máximo 80 caracteres."),
  telefono: z.string().trim().max(40, "Máximo 40 caracteres."),
  direccion: z.string().trim().max(200, "Máximo 200 caracteres."),
  notas: z.string().trim().max(1000, "Máximo 1000 caracteres."),
  intervalo: z.coerce
    .number({ error: "Escribí un número de días." })
    .int("Tiene que ser un número entero de días.")
    .min(1, "Mínimo 1 día.")
    .max(365, "Máximo 365 días."),
});

function leer(formulario: FormData) {
  const valores: CamposCliente = {
    nombre: String(formulario.get("nombre") ?? ""),
    telefono: String(formulario.get("telefono") ?? ""),
    direccion: String(formulario.get("direccion") ?? ""),
    notas: String(formulario.get("notas") ?? ""),
    intervalo: String(formulario.get("intervalo") ?? "14"),
  };
  const r = esquema.safeParse(valores);
  if (r.success) return { valores, datos: r.data, errores: undefined };
  const errores: EstadoCliente["errores"] = {};
  for (const i of r.error.issues) {
    const campo = i.path[0] as keyof CamposCliente;
    errores[campo] ??= i.message;
  }
  return { valores, datos: undefined, errores };
}

function mensajeCliente(error: { code?: string; message?: string }) {
  if (error.code === "23505" && error.message?.includes("clientes_nombre_unico_idx")) {
    return "Ya existe un cliente con ese nombre. Agregale algo para distinguirlo (ej: barrio o apellido).";
  }
  return mensajeDeError(error, "No se pudo guardar el cliente.");
}

export async function crearCliente(_p: EstadoCliente, formulario: FormData): Promise<EstadoCliente> {
  const socio = await obtenerSocioActual();
  const { valores, datos, errores } = leer(formulario);
  if (!datos) return { errores, valores };
  const id = String(formulario.get("id") ?? "");
  if (!esUuid(id)) return { error: "Recargá la pantalla e intentá de nuevo.", valores };

  const supabase = await crearClienteSupabase();
  const { error } = await supabase.from("clientes").insert({
    id,
    negocio_id: socio.negocioId,
    nombre: datos.nombre,
    telefono: datos.telefono || null,
    direccion: datos.direccion || null,
    notas: datos.notas || null,
    intervalo_visita_dias: datos.intervalo,
  });
  // Reintento del mismo alta (doble toque): ya existe con este id, seguimos.
  if (error && !(error.code === "23505" && error.message.includes("clientes_pkey"))) {
    return { error: mensajeCliente(error), valores };
  }
  revalidatePath("/clientes");
  redirect(`/clientes/${id}?ok=creado`);
}

export async function editarCliente(_p: EstadoCliente, formulario: FormData): Promise<EstadoCliente> {
  await obtenerSocioActual();
  const id = String(formulario.get("id") ?? "");
  const { valores, datos, errores } = leer(formulario);
  if (!datos) return { errores, valores };

  const supabase = await crearClienteSupabase();
  const { error } = await supabase
    .from("clientes")
    .update({
      nombre: datos.nombre,
      telefono: datos.telefono || null,
      direccion: datos.direccion || null,
      notas: datos.notas || null,
      intervalo_visita_dias: datos.intervalo,
    })
    .eq("id", id);
  if (error) return { error: mensajeCliente(error), valores };
  revalidatePath("/clientes");
  revalidatePath(`/clientes/${id}`);
  redirect(`/clientes/${id}?ok=editado`);
}

export type EstadoAccion = { error?: string };

/** Marca una visita. `volverA` decide adónde vuelve (la lista o la ficha del cliente). */
export async function marcarVisitado(_p: EstadoAccion, formulario: FormData): Promise<EstadoAccion> {
  await obtenerSocioActual();
  const id = String(formulario.get("id") ?? "");
  const clienteId = String(formulario.get("clienteId") ?? "");
  const fecha = String(formulario.get("fecha") ?? "") || hoy();
  const volverA = String(formulario.get("volverA") ?? "");
  if (!esUuid(id) || !esUuid(clienteId)) return { error: "Recargá la pantalla e intentá de nuevo." };
  if (!esDiaValido(fecha)) return { error: "Elegí una fecha válida." };
  if (fecha > hoy()) return { error: "La fecha no puede ser futura." };

  const supabase = await crearClienteSupabase();
  const { error } = await supabase.rpc("marcar_visitado", {
    p_id: id,
    p_cliente_id: clienteId,
    p_fecha: fecha,
    p_nota: String(formulario.get("nota") ?? "").slice(0, 300) || null,
  });
  if (error) return { error: mensajeDeError(error, "No se pudo marcar la visita.") };
  revalidatePath("/clientes");
  revalidatePath(`/clientes/${clienteId}`);
  revalidatePath("/");
  redirect(volverA === "lista" ? "/clientes?ok=visitado" : `/clientes/${clienteId}?ok=visitado`);
}

export async function anularVisita(_p: EstadoAccion, formulario: FormData): Promise<EstadoAccion> {
  await obtenerSocioActual();
  const visitaId = String(formulario.get("visitaId") ?? "");
  const clienteId = String(formulario.get("clienteId") ?? "");
  const supabase = await crearClienteSupabase();
  const { error } = await supabase.rpc("anular_visita", { p_visita_id: visitaId });
  if (error) return { error: mensajeDeError(error, "No se pudo deshacer la visita.") };
  revalidatePath("/clientes");
  revalidatePath(`/clientes/${clienteId}`);
  revalidatePath("/");
  redirect(`/clientes/${clienteId}?ok=deshecha`);
}

export async function archivarCliente(_p: EstadoAccion, formulario: FormData): Promise<EstadoAccion> {
  await obtenerSocioActual();
  const clienteId = String(formulario.get("clienteId") ?? "");
  const archivar = formulario.get("archivar") === "si";
  const supabase = await crearClienteSupabase();
  const { error } = await supabase.rpc("archivar_cliente", { p_cliente_id: clienteId, p_archivar: archivar });
  if (error) return { error: mensajeDeError(error, "No se pudo actualizar el cliente.") };
  revalidatePath("/clientes");
  revalidatePath(`/clientes/${clienteId}`);
  revalidatePath("/");
  redirect(`/clientes/${clienteId}?ok=${archivar ? "archivado" : "desarchivado"}`);
}
