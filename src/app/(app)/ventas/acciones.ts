"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { parsearImporte } from "@/lib/dinero";
import { mensajeDeError } from "@/lib/errores";
import { esDiaValido, hoy } from "@/lib/fechas";
import { obtenerSocioActual } from "@/lib/sesion";
import { crearClienteSupabase } from "@/lib/supabase/servidor";
import { esUuid } from "@/lib/uuid";

export type EstadoVenta = {
  error?: string;
  /** Al guardar un cliente nuevo, otro ya tenía ese nombre (lo creó otro socio mientras tanto): se ofrece usarlo. */
  duplicado?: { id: string; nombre: string; archivado: boolean };
};

const esquemaVenta = z.object({
  id: z.string().refine(esUuid),
  clienteId: z.string().refine(esUuid, "Elegí el cliente."),
  // Venta a un cliente nuevo: se crea junto con la venta, en la misma transacción (clienteId es su UUID nuevo).
  clienteNuevo: z
    .object({
      nombre: z.string().trim().min(1, "Escribí el nombre del cliente.").max(80, "El nombre puede tener hasta 80 caracteres."),
      telefono: z.string().trim().max(40, "El teléfono puede tener hasta 40 caracteres."),
      direccion: z.string().trim().max(200, "La dirección puede tener hasta 200 caracteres.").default(""),
    })
    .nullish(),
  vendidoPor: z.string().refine(esUuid),
  fecha: z.string(),
  nota: z.string().max(500),
  items: z
    .array(
      z.object({
        productoId: z.string().refine(esUuid),
        cantidad: z.number().int().min(1).max(10000),
        precio: z.string(),
      }),
    )
    .min(1, "Agregá al menos un producto.")
    .max(50),
});

export async function registrarVenta(_p: EstadoVenta, formulario: FormData): Promise<EstadoVenta> {
  const socio = await obtenerSocioActual();
  let crudo: unknown;
  try {
    crudo = JSON.parse(String(formulario.get("datos") ?? ""));
  } catch {
    return { error: "Recargá la pantalla e intentá de nuevo." };
  }
  const r = esquemaVenta.safeParse(crudo);
  if (!r.success) return { error: r.error.issues[0]?.message ?? "Revisá los datos de la venta." };
  const v = r.data;

  const dia = hoy();
  if (!esDiaValido(v.fecha)) return { error: "Elegí una fecha válida." };
  if (v.fecha > dia) return { error: "La fecha no puede ser futura." };

  const items = [];
  for (const [i, it] of v.items.entries()) {
    const precio = parsearImporte(it.precio);
    if (!precio.ok) return { error: `Producto ${i + 1}: ${precio.error}` };
    items.push({ producto_id: it.productoId, cantidad: it.cantidad, precio_unitario: precio.centavos });
  }

  const supabase = await crearClienteSupabase();
  const comunes = {
    p_negocio_id: socio.negocioId,
    p_cliente_id: v.clienteId,
    p_items: items,
    p_fecha: v.fecha,
    p_vendido_por: v.vendidoPor,
    p_nota: v.nota.trim() || null,
  };
  // Cliente nuevo: cliente y venta en una sola transacción (si la venta falla, el cliente no queda).
  const { error } = v.clienteNuevo
    ? await supabase.rpc("registrar_venta_cliente_nuevo", {
        p_venta_id: v.id,
        p_nombre: v.clienteNuevo.nombre,
        p_telefono: v.clienteNuevo.telefono || null,
        p_direccion: v.clienteNuevo.direccion || null,
        ...comunes,
      })
    : await supabase.rpc("registrar_venta", { p_id: v.id, ...comunes });
  if (error?.hint === "cliente_duplicado" && esUuid(error.details ?? "")) {
    const { data } = await supabase.from("clientes").select("id, nombre, archivado_en").eq("id", error.details).maybeSingle();
    return {
      error: error.message,
      duplicado: data ? { id: data.id, nombre: data.nombre, archivado: data.archivado_en !== null } : undefined,
    };
  }
  if (error) return { error: mensajeDeError(error, "No se pudo guardar la venta.") };

  revalidatePath("/", "layout");
  // Pantalla de confirmación (maqueta, pantalla 4), con "Deshacer" solo justo después de guardar.
  redirect(`/ventas/${v.id}/guardada`);
}

export async function anularVenta(_p: EstadoVenta, formulario: FormData): Promise<EstadoVenta> {
  await obtenerSocioActual();
  const ventaId = String(formulario.get("ventaId") ?? "");
  if (!esUuid(ventaId)) return { error: "Recargá la pantalla." };
  const motivo = String(formulario.get("motivo") ?? "").trim();
  if (!motivo) return { error: "Escribí el motivo de la anulación." };
  const supabase = await crearClienteSupabase();
  const { error } = await supabase.rpc("anular_venta", { p_venta_id: ventaId, p_motivo: motivo.slice(0, 300) });
  if (error) return { error: mensajeDeError(error, "No se pudo anular la venta.") };
  revalidatePath("/", "layout");
  redirect(`/ventas/${ventaId}?ok=anulada`);
}

export async function fijarPrecioEspecial(_p: EstadoVenta, formulario: FormData): Promise<EstadoVenta> {
  await obtenerSocioActual();
  const clienteId = String(formulario.get("clienteId") ?? "");
  const productoId = String(formulario.get("productoId") ?? "");
  const quitar = formulario.get("quitar") === "si";
  if (!esUuid(clienteId)) return { error: "Recargá la pantalla." };
  if (!esUuid(productoId)) return { error: "Elegí el producto." };

  let precio: number | null = null;
  if (!quitar) {
    const p = parsearImporte(String(formulario.get("precio") ?? ""));
    if (!p.ok) return { error: p.error };
    precio = p.centavos;
  }
  const supabase = await crearClienteSupabase();
  const { error } = await supabase.rpc("fijar_precio_especial", {
    p_cliente_id: clienteId,
    p_producto_id: productoId,
    p_precio: precio,
  });
  if (error) return { error: mensajeDeError(error, "No se pudo guardar el precio.") };
  revalidatePath(`/clientes/${clienteId}`);
  redirect(`/clientes/${clienteId}?ok=${quitar ? "precio-quitado" : "precio"}#precios`);
}
