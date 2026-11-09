import "server-only";
import { aplicarCreditos, type CuentaCorriente, type Deuda } from "@/dominio/cuentaCorriente";
import { crearClienteSupabase } from "@/lib/supabase/servidor";

function fallar(contexto: string, error: { message: string }): never {
  throw new Error(`${contexto}: ${error.message}`);
}

export type Pago = {
  pago_id: string;
  cliente_id: string;
  cliente_nombre: string;
  fecha: string;
  importe: number;
  medio: "efectivo" | "transferencia" | "mercado_pago";
  recibido_por_nombre: string;
  registrado_por_nombre: string;
  nota: string | null;
  anulado_en: string | null;
  motivo_anulacion: string | null;
};

export type SaldoInicial = {
  id: string;
  tipo: "deuda" | "a_favor";
  importe: number;
  fecha: string;
  nota: string | null;
  anulado_en: string | null;
  motivo_anulacion: string | null;
};

export const NOMBRE_MEDIO: Record<Pago["medio"], string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  mercado_pago: "Mercado Pago",
};

type DatosCrudos = {
  ventas: { venta_id: string; cliente_id: string; dia: string; secuencia: number; importe: number }[];
  saldos: (SaldoInicial & { cliente_id: string })[];
  pagos: Pago[];
};

async function leerCrudos(negocioId: string, clienteIds?: string[]): Promise<DatosCrudos> {
  const supabase = await crearClienteSupabase();
  let qVentas = supabase.from("v_ventas").select("venta_id, cliente_id, dia, secuencia, importe").eq("negocio_id", negocioId).is("anulado_en", null);
  let qSaldos = supabase.from("saldos_iniciales").select("id, cliente_id, tipo, importe, fecha, nota, anulado_en, motivo_anulacion").eq("negocio_id", negocioId);
  let qPagos = supabase.from("v_pagos").select("*").eq("negocio_id", negocioId);
  if (clienteIds) {
    qVentas = qVentas.in("cliente_id", clienteIds);
    qSaldos = qSaldos.in("cliente_id", clienteIds);
    qPagos = qPagos.in("cliente_id", clienteIds);
  }
  const [ventas, saldos, pagos] = await Promise.all([
    qVentas,
    qSaldos.order("fecha").order("creado_en"),
    qPagos.order("fecha", { ascending: false }).order("secuencia", { ascending: false }),
  ]);
  if (ventas.error) fallar("No se pudieron leer las ventas", ventas.error);
  if (saldos.error) fallar("No se pudieron leer los saldos iniciales", saldos.error);
  if (pagos.error) fallar("No se pudieron leer los pagos", pagos.error);
  return { ventas: ventas.data ?? [], saldos: (saldos.data ?? []) as DatosCrudos["saldos"], pagos: (pagos.data ?? []) as Pago[] };
}

function armarCuentas(d: DatosCrudos): Map<string, CuentaCorriente> {
  const deudas = new Map<string, Deuda[]>();
  const creditos = new Map<string, number[]>();
  const agregar = <T,>(m: Map<string, T[]>, k: string, v: T) => m.set(k, [...(m.get(k) ?? []), v]);
  const clientes = new Set<string>();
  for (const v of d.ventas) {
    clientes.add(v.cliente_id);
    agregar(deudas, v.cliente_id, { id: v.venta_id, tipo: "venta", dia: v.dia, orden: v.secuencia, importe: v.importe });
  }
  d.saldos.forEach((s, i) => {
    if (s.anulado_en) return;
    clientes.add(s.cliente_id);
    if (s.tipo === "deuda") agregar(deudas, s.cliente_id, { id: s.id, tipo: "saldo_inicial", dia: s.fecha, orden: i, importe: s.importe });
    else agregar(creditos, s.cliente_id, s.importe);
  });
  for (const p of d.pagos) {
    if (p.anulado_en) continue;
    clientes.add(p.cliente_id);
    agregar(creditos, p.cliente_id, p.importe);
  }
  const cuentas = new Map<string, CuentaCorriente>();
  for (const c of clientes) cuentas.set(c, aplicarCreditos(deudas.get(c) ?? [], creditos.get(c) ?? []));
  return cuentas;
}

/** Cuenta corriente completa de un cliente: deudas con su cobrado/saldo, pagos y saldos iniciales (con anulados). */
export async function cuentaDeCliente(negocioId: string, clienteId: string) {
  const d = await leerCrudos(negocioId, [clienteId]);
  const cuenta = armarCuentas(d).get(clienteId) ?? aplicarCreditos([], []);
  return { cuenta, pagos: d.pagos, saldosIniciales: d.saldos };
}

/** Cobrado y saldo de cada venta (no anulada) de los clientes indicados. */
export async function cobrosDeVentas(negocioId: string, clienteIds: string[]): Promise<Map<string, { cobrado: number; saldo: number }>> {
  const resultado = new Map<string, { cobrado: number; saldo: number }>();
  if (clienteIds.length === 0) return resultado;
  const cuentas = armarCuentas(await leerCrudos(negocioId, [...new Set(clienteIds)]));
  for (const c of cuentas.values()) for (const d of c.deudas) if (d.tipo === "venta") resultado.set(d.id, { cobrado: d.cobrado, saldo: d.saldo });
  return resultado;
}

export type CuentaResumen = { cliente_id: string; nombre: string; archivado_en: string | null; saldo: number; ultimo_pago: string | null };

/** Clientes con saldo distinto de cero (nos deben o tienen saldo a favor), incluidos los archivados. */
export async function listarSaldos(negocioId: string): Promise<CuentaResumen[]> {
  const supabase = await crearClienteSupabase();
  const { data, error } = await supabase
    .from("v_cuentas_clientes")
    .select("cliente_id, nombre, archivado_en, saldo, ultimo_pago")
    .eq("negocio_id", negocioId)
    .neq("saldo", 0)
    .order("saldo", { ascending: false });
  if (error) fallar("No se pudieron leer las cuentas", error);
  return (data ?? []) as CuentaResumen[];
}

export async function saldoDeCliente(negocioId: string, clienteId: string): Promise<number> {
  const supabase = await crearClienteSupabase();
  const { data, error } = await supabase
    .from("v_cuentas_clientes")
    .select("saldo")
    .eq("negocio_id", negocioId)
    .eq("cliente_id", clienteId)
    .maybeSingle();
  if (error) fallar("No se pudo leer el saldo", error);
  return data?.saldo ?? 0;
}

export async function listarUltimosPagos(negocioId: string, limite = 30): Promise<Pago[]> {
  const supabase = await crearClienteSupabase();
  const { data, error } = await supabase
    .from("v_pagos")
    .select("*")
    .eq("negocio_id", negocioId)
    .order("fecha", { ascending: false })
    .order("secuencia", { ascending: false })
    .limit(limite);
  if (error) fallar("No se pudieron leer los cobros", error);
  return (data ?? []) as Pago[];
}
