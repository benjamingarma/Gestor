import "server-only";
import type { RenglonAnterior } from "@/dominio/carrito";
import type { CompraDisponible } from "@/dominio/ventas";
import { rangoDelMes } from "@/lib/meses";
import { listarSaldos } from "./cuentas";
import { crearClienteSupabase } from "@/lib/supabase/servidor";

function fallar(contexto: string, error: { message: string }): never {
  throw new Error(`${contexto}: ${error.message}`);
}

export type ResumenVenta = {
  venta_id: string;
  cliente_id: string;
  cliente_nombre: string;
  fecha: string;
  dia: string;
  vendido_por: string;
  vendido_por_nombre: string;
  nota: string | null;
  anulado_en: string | null;
  motivo_anulacion: string | null;
  unidades: number;
  importe: number;
  costo_ars: number;
  costo_usd: number;
  ganancia: number;
};

export type ProductoVendible = {
  id: string;
  nombre: string;
  unidades: number;
  precioGeneral: number | null;
  compras: CompraDisponible[];
};

export type DatosNuevaVenta = {
  clientes: { id: string; nombre: string }[];
  /** Clientes archivados: no se les vende, pero sus nombres cuentan para no repetir un cliente nuevo. */
  archivados: { id: string; nombre: string }[];
  productos: ProductoVendible[];
  socios: { id: string; nombre: string }[];
  /** clienteId -> productoId -> precio */
  especiales: Record<string, Record<string, number>>;
  ultimos: Record<string, Record<string, number>>;
  /** clienteId -> saldo de su cuenta (> 0 debe, < 0 a favor). */
  saldos: Record<string, number>;
};

export async function datosParaNuevaVenta(negocioId: string): Promise<DatosNuevaVenta> {
  const supabase = await crearClienteSupabase();
  const [clientes, productos, compras, socios, especiales, ultimos, saldos, archivados] = await Promise.all([
    supabase.from("clientes").select("id, nombre").eq("negocio_id", negocioId).is("archivado_en", null).order("nombre"),
    supabase
      .from("v_stock_productos")
      .select("producto_id, marca, modelo, unidades, precio_general")
      .eq("negocio_id", negocioId)
      .eq("activo", true)
      .gt("unidades", 0)
      .order("marca")
      .order("modelo"),
    supabase
      .from("v_stock_compras")
      .select("compra_id, producto_id, fecha, secuencia, disponible, costo_unitario_ars, costo_unitario_usd")
      .eq("negocio_id", negocioId)
      .is("anulado_en", null)
      .gt("disponible", 0),
    supabase.from("socios").select("id, nombre").eq("negocio_id", negocioId).order("orden"),
    supabase.from("precios_especiales").select("cliente_id, producto_id, precio").eq("negocio_id", negocioId),
    supabase.from("v_ultimo_precio_cliente").select("cliente_id, producto_id, precio_unitario").eq("negocio_id", negocioId),
    listarSaldos(negocioId),
    supabase.from("clientes").select("id, nombre").eq("negocio_id", negocioId).not("archivado_en", "is", null),
  ]);
  for (const r of [clientes, productos, compras, socios, especiales, ultimos, archivados]) {
    if (r.error) fallar("No se pudieron leer los datos para vender", r.error);
  }

  const comprasPorProducto = new Map<string, CompraDisponible[]>();
  for (const c of compras.data ?? []) {
    const lista = comprasPorProducto.get(c.producto_id) ?? [];
    lista.push({
      compraId: c.compra_id,
      fecha: c.fecha,
      secuencia: c.secuencia,
      disponible: c.disponible,
      costoUnitarioArs: c.costo_unitario_ars,
      costoUnitarioUsd: c.costo_unitario_usd,
    });
    comprasPorProducto.set(c.producto_id, lista);
  }
  const mapa = (filas: { cliente_id: string; producto_id: string }[], valor: (f: never) => number) => {
    const m: Record<string, Record<string, number>> = {};
    for (const f of filas) (m[f.cliente_id] ??= {})[f.producto_id] = valor(f as never);
    return m;
  };

  return {
    clientes: clientes.data ?? [],
    archivados: archivados.data ?? [],
    socios: socios.data ?? [],
    productos: (productos.data ?? []).map((p) => ({
      id: p.producto_id,
      nombre: `${p.marca} ${p.modelo}`,
      unidades: p.unidades,
      precioGeneral: p.precio_general,
      compras: comprasPorProducto.get(p.producto_id) ?? [],
    })),
    especiales: mapa(especiales.data ?? [], (f: { precio: number }) => f.precio),
    ultimos: mapa(ultimos.data ?? [], (f: { precio_unitario: number }) => f.precio_unitario),
    saldos: Object.fromEntries(saldos.map((s) => [s.cliente_id, s.saldo])),
  };
}

/**
 * Ventas, de la más nueva a la más vieja.
 * - mes ("AAAA-MM"): todas las ventas de ese mes (hora de Tucumán), sin límite.
 * - sin mes: las últimas `limite` (100 por defecto).
 */
export async function listarVentas(
  negocioId: string,
  opciones: { clienteId?: string; limite?: number; mes?: string } = {},
): Promise<ResumenVenta[]> {
  const supabase = await crearClienteSupabase();
  let consulta = supabase.from("v_ventas").select("*").eq("negocio_id", negocioId);
  if (opciones.clienteId) consulta = consulta.eq("cliente_id", opciones.clienteId);
  if (opciones.mes) {
    const [desde, hasta] = rangoDelMes(opciones.mes);
    consulta = consulta.gte("dia", desde).lt("dia", hasta);
  } else {
    consulta = consulta.limit(opciones.limite ?? 100);
  }
  const { data, error } = await consulta.order("fecha", { ascending: false }).order("secuencia", { ascending: false });
  if (error) fallar("No se pudieron leer las ventas", error);
  return (data ?? []) as ResumenVenta[];
}

/** Última venta NO anulada de un cliente, con sus renglones (precio histórico de cada uno). */
export type UltimaVenta = { ventaId: string; dia: string; importe: number; renglones: RenglonAnterior[] };

export async function ultimaVentaDeCliente(negocioId: string, clienteId: string): Promise<UltimaVenta | null> {
  const supabase = await crearClienteSupabase();
  const { data: venta, error } = await supabase
    .from("v_ventas")
    .select("venta_id, dia, importe")
    .eq("negocio_id", negocioId)
    .eq("cliente_id", clienteId)
    .is("anulado_en", null)
    .order("fecha", { ascending: false })
    .order("secuencia", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) fallar("No se pudo leer la última venta", error);
  if (!venta) return null;
  const { data: items, error: e2 } = await supabase
    .from("venta_items")
    .select("producto_id, cantidad, precio_unitario, productos ( marca, modelo )")
    .eq("venta_id", venta.venta_id)
    .order("renglon");
  if (e2) fallar("No se pudieron leer los productos de la última venta", e2);
  type Fila = { producto_id: string; cantidad: number; precio_unitario: number; productos: { marca: string; modelo: string } };
  return {
    ventaId: venta.venta_id,
    dia: venta.dia,
    importe: venta.importe,
    renglones: ((items ?? []) as unknown as Fila[]).map((i) => ({
      productoId: i.producto_id,
      nombre: `${i.productos.marca} ${i.productos.modelo}`,
      cantidad: i.cantidad,
      precioUnitario: i.precio_unitario,
    })),
  };
}

export type DetalleRenglon = {
  id: string;
  renglon: number;
  producto: string;
  cantidad: number;
  precioUnitario: number;
  costoArs: number;
  costoUsd: number;
  consumos: { cantidad: number; costoUnitarioArs: number; costoUnitarioUsd: number; fechaCompra: string; tipoCambio: number; estimado: boolean }[];
};

export type DetalleVenta = ResumenVenta & { registrado_por_nombre: string; creado_en: string; anulado_por_nombre: string | null; renglones: DetalleRenglon[] };

export async function obtenerVenta(negocioId: string, ventaId: string): Promise<DetalleVenta | null> {
  const supabase = await crearClienteSupabase();
  const { data: venta, error } = await supabase
    .from("v_ventas")
    .select("*")
    .eq("negocio_id", negocioId)
    .eq("venta_id", ventaId)
    .maybeSingle();
  if (error) fallar("No se pudo leer la venta", error);
  if (!venta) return null;

  const [extra, items, socios] = await Promise.all([
    supabase.from("ventas").select("registrado_por, anulado_por, creado_en").eq("id", ventaId).single(),
    supabase
      .from("venta_items")
      .select("id, renglon, cantidad, precio_unitario, costo_total_ars, costo_total_usd, productos ( marca, modelo ), movimientos_stock ( tipo, cantidad, costo_unitario_ars, costo_unitario_usd, compras ( fecha, tipo_cambio, tipo_cambio_estimado ) )")
      .eq("venta_id", ventaId)
      .order("renglon"),
    supabase.from("socios").select("id, nombre").eq("negocio_id", negocioId),
  ]);
  if (extra.error) fallar("No se pudo leer la venta", extra.error);
  if (items.error) fallar("No se pudieron leer los productos de la venta", items.error);
  const nombreSocio = new Map((socios.data ?? []).map((s) => [s.id, s.nombre]));

  type FilaItem = {
    id: string;
    renglon: number;
    cantidad: number;
    precio_unitario: number;
    costo_total_ars: number;
    costo_total_usd: number;
    productos: { marca: string; modelo: string };
    movimientos_stock: {
      tipo: string;
      cantidad: number;
      costo_unitario_ars: number;
      costo_unitario_usd: number;
      compras: { fecha: string; tipo_cambio: number; tipo_cambio_estimado: boolean };
    }[];
  };

  return {
    ...(venta as ResumenVenta),
    registrado_por_nombre: nombreSocio.get(extra.data.registrado_por) ?? "",
    creado_en: extra.data.creado_en as string,
    anulado_por_nombre: extra.data.anulado_por ? (nombreSocio.get(extra.data.anulado_por) ?? "") : null,
    renglones: ((items.data ?? []) as unknown as FilaItem[]).map((i) => ({
      id: i.id,
      renglon: i.renglon,
      producto: `${i.productos.marca} ${i.productos.modelo}`,
      cantidad: i.cantidad,
      precioUnitario: i.precio_unitario,
      costoArs: i.costo_total_ars,
      costoUsd: i.costo_total_usd,
      consumos: i.movimientos_stock
        .filter((m) => m.tipo === "venta")
        .map((m) => ({
          cantidad: -m.cantidad,
          costoUnitarioArs: m.costo_unitario_ars,
          costoUnitarioUsd: m.costo_unitario_usd,
          fechaCompra: m.compras.fecha,
          tipoCambio: m.compras.tipo_cambio,
          estimado: m.compras.tipo_cambio_estimado,
        }))
        .sort((a, b) => (a.fechaCompra < b.fechaCompra ? -1 : 1)),
    })),
  };
}

export async function listarPreciosEspeciales(clienteId: string): Promise<{ productoId: string; producto: string; precio: number }[]> {
  const supabase = await crearClienteSupabase();
  const { data, error } = await supabase
    .from("precios_especiales")
    .select("producto_id, precio, productos ( marca, modelo )")
    .eq("cliente_id", clienteId);
  if (error) fallar("No se pudieron leer los precios especiales", error);
  type Fila = { producto_id: string; precio: number; productos: { marca: string; modelo: string } };
  return ((data ?? []) as unknown as Fila[])
    .map((f) => ({ productoId: f.producto_id, producto: `${f.productos.marca} ${f.productos.modelo}`, precio: f.precio }))
    .sort((a, b) => a.producto.localeCompare(b.producto));
}

/** Primer día con ventas (para armar el selector de meses), o null si no hay ventas. */
export async function primerDiaConVentas(negocioId: string): Promise<string | null> {
  const supabase = await crearClienteSupabase();
  const { data, error } = await supabase
    .from("v_ventas")
    .select("dia")
    .eq("negocio_id", negocioId)
    .order("dia")
    .limit(1)
    .maybeSingle();
  if (error) fallar("No se pudieron leer las ventas", error);
  return data?.dia ?? null;
}
