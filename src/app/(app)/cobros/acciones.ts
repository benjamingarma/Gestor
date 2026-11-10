"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parsearImporte } from "@/lib/dinero";
import { mensajeDeError } from "@/lib/errores";
import { esDiaValido, hoy } from "@/lib/fechas";
import { obtenerSocioActual } from "@/lib/sesion";
import { crearClienteSupabase } from "@/lib/supabase/servidor";
import { esUuid } from "@/lib/uuid";

export type EstadoCobro = { error?: string; errores?: { importe?: string; fecha?: string; medio?: string } };

const MEDIOS = ["efectivo", "transferencia", "mercado_pago"] as const;

export async function registrarPago(_p: EstadoCobro, formulario: FormData): Promise<EstadoCobro> {
  await obtenerSocioActual();
  const id = String(formulario.get("id") ?? "");
  const clienteId = String(formulario.get("clienteId") ?? "");
  const medio = String(formulario.get("medio") ?? "");
  const fecha = String(formulario.get("fecha") ?? "") || hoy();
  const recibidoPor = String(formulario.get("recibidoPor") ?? "");
  const volverA = String(formulario.get("volverA") ?? "");
  if (!esUuid(id) || !esUuid(clienteId)) return { error: "Recargá la pantalla e intentá de nuevo." };

  const errores: EstadoCobro["errores"] = {};
  const importe = parsearImporte(String(formulario.get("importe") ?? ""));
  if (!importe.ok) errores.importe = importe.error;
  else if (importe.centavos <= 0) errores.importe = "El importe debe ser mayor que cero.";
  if (!MEDIOS.includes(medio as (typeof MEDIOS)[number])) errores.medio = "Elegí cómo pagó.";
  if (!esDiaValido(fecha)) errores.fecha = "Elegí una fecha válida.";
  else if (fecha > hoy()) errores.fecha = "La fecha no puede ser futura.";
  if (Object.keys(errores).length > 0 || !importe.ok) return { errores };

  const supabase = await crearClienteSupabase();
  const { error } = await supabase.rpc("registrar_pago", {
    p_id: id,
    p_cliente_id: clienteId,
    p_importe: importe.centavos,
    p_medio: medio,
    p_fecha: fecha,
    p_recibido_por: esUuid(recibidoPor) ? recibidoPor : null,
    p_nota: String(formulario.get("nota") ?? "").trim().slice(0, 500) || null,
  });
  if (error) return { error: mensajeDeError(error, "No se pudo guardar el cobro.") };
  revalidatePath("/", "layout");
  // Confirmación con "Deshacer (anular)" (módulo 1.7); si se cobró desde una venta, "Listo" vuelve a esa venta.
  redirect(`/cobros/${id}/guardado${esUuid(volverA) ? `?venta=${volverA}` : ""}`);
}

export type EstadoSimple = { error?: string };

export async function anularPago(_p: EstadoSimple, formulario: FormData): Promise<EstadoSimple> {
  await obtenerSocioActual();
  const pagoId = String(formulario.get("pagoId") ?? "");
  const clienteId = String(formulario.get("clienteId") ?? "");
  const motivo = String(formulario.get("motivo") ?? "").trim();
  if (!motivo) return { error: "Escribí el motivo." };
  const supabase = await crearClienteSupabase();
  const { error } = await supabase.rpc("anular_pago", { p_pago_id: pagoId, p_motivo: motivo.slice(0, 300) });
  if (error) return { error: mensajeDeError(error, "No se pudo anular el cobro.") };
  revalidatePath("/", "layout");
  // "Deshacer (anular)" desde la confirmación: se queda en la confirmación, que pasa a decir "Cobro anulado".
  if (formulario.get("desde") === "guardado" && esUuid(pagoId)) redirect(`/cobros/${pagoId}/guardado`);
  redirect(`/clientes/${clienteId}/cuenta?ok=pago-anulado`);
}

export async function registrarSaldoInicial(_p: EstadoSimple, formulario: FormData): Promise<EstadoSimple> {
  await obtenerSocioActual();
  const id = String(formulario.get("id") ?? "");
  const clienteId = String(formulario.get("clienteId") ?? "");
  const tipo = String(formulario.get("tipo") ?? "");
  const fecha = String(formulario.get("fecha") ?? "");
  if (!esUuid(id) || !esUuid(clienteId)) return { error: "Recargá la pantalla e intentá de nuevo." };
  if (tipo !== "deuda" && tipo !== "a_favor") return { error: "Elegí si nos debe o si tiene a favor." };
  const importe = parsearImporte(String(formulario.get("importe") ?? ""));
  if (!importe.ok) return { error: importe.error };
  if (importe.centavos <= 0) return { error: "El importe debe ser mayor que cero." };
  if (!esDiaValido(fecha) || fecha > hoy()) return { error: "Elegí una fecha válida (no futura)." };

  const supabase = await crearClienteSupabase();
  const { error } = await supabase.rpc("registrar_saldo_inicial", {
    p_id: id,
    p_cliente_id: clienteId,
    p_tipo: tipo,
    p_importe: importe.centavos,
    p_fecha: fecha,
    p_nota: String(formulario.get("nota") ?? "").trim().slice(0, 500) || null,
  });
  if (error) return { error: mensajeDeError(error, "No se pudo guardar el saldo.") };
  revalidatePath("/", "layout");
  redirect(`/clientes/${clienteId}/cuenta?ok=saldo`);
}

export async function anularSaldoInicial(_p: EstadoSimple, formulario: FormData): Promise<EstadoSimple> {
  await obtenerSocioActual();
  const saldoId = String(formulario.get("saldoId") ?? "");
  const clienteId = String(formulario.get("clienteId") ?? "");
  const motivo = String(formulario.get("motivo") ?? "").trim();
  if (!motivo) return { error: "Escribí el motivo." };
  const supabase = await crearClienteSupabase();
  const { error } = await supabase.rpc("anular_saldo_inicial", { p_id: saldoId, p_motivo: motivo.slice(0, 300) });
  if (error) return { error: mensajeDeError(error, "No se pudo anular el saldo.") };
  revalidatePath("/", "layout");
  redirect(`/clientes/${clienteId}/cuenta?ok=saldo-anulado`);
}
