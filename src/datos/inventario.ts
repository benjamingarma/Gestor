import "server-only";
import { crearClienteSupabase } from "@/lib/supabase/servidor";

// Lecturas de productos, compras y stock. Todas pasan por RLS (usuario logueado).

export type StockProducto = {
  producto_id: string;
  marca: string;
  modelo: string;
  precio_general: number | null;
  activo: boolean;
  es_prueba: boolean;
  unidades: number;
  valor_usd: number;
  valor_ars: number;
  proximo_costo_usd: number | null;
  proximo_costo_ars: number | null;
};

export type StockCompra = {
  compra_id: string;
  producto_id: string;
  fecha: string;
  secuencia: number;
  cantidad: number;
  costo_unitario_usd: number;
  tipo_cambio: number;
  tipo_cambio_estimado: boolean;
  costo_unitario_ars: number;
  costo_total_usd: number;
  costo_total_ars: number;
  origen: "compra" | "inventario_inicial";
  nota: string | null;
  anulado_en: string | null;
  motivo_anulacion: string | null;
  es_prueba: boolean;
  creado_en: string;
  disponible: number;
  valor_usd: number;
  valor_ars: number;
};

export type ProductoOpcion = { id: string; marca: string; modelo: string };

function fallar(contexto: string, error: { message: string }): never {
  throw new Error(`${contexto}: ${error.message}`);
}

export async function listarStockProductos(negocioId: string): Promise<StockProducto[]> {
  const supabase = await crearClienteSupabase();
  const { data, error } = await supabase
    .from("v_stock_productos")
    .select("*")
    .eq("negocio_id", negocioId)
    .order("marca")
    .order("modelo");
  if (error) fallar("No se pudo leer el stock", error);
  return (data ?? []) as StockProducto[];
}

export async function obtenerStockProducto(negocioId: string, productoId: string): Promise<StockProducto | null> {
  const supabase = await crearClienteSupabase();
  const { data, error } = await supabase
    .from("v_stock_productos")
    .select("*")
    .eq("negocio_id", negocioId)
    .eq("producto_id", productoId)
    .maybeSingle();
  if (error) fallar("No se pudo leer el producto", error);
  return data as StockProducto | null;
}

/** Compras de un producto en orden FIFO (la más vieja primero). */
export async function listarComprasDeProducto(negocioId: string, productoId: string): Promise<StockCompra[]> {
  const supabase = await crearClienteSupabase();
  const { data, error } = await supabase
    .from("v_stock_compras")
    .select("*")
    .eq("negocio_id", negocioId)
    .eq("producto_id", productoId)
    .order("fecha")
    .order("secuencia");
  if (error) fallar("No se pudieron leer las compras", error);
  return (data ?? []) as StockCompra[];
}

export type CompraConProducto = StockCompra & { marca: string; modelo: string };

/** Últimas compras de todos los productos (la más reciente primero). */
export async function listarUltimasCompras(negocioId: string, limite = 100): Promise<CompraConProducto[]> {
  const supabase = await crearClienteSupabase();
  const [compras, productos] = await Promise.all([
    supabase
      .from("v_stock_compras")
      .select("*")
      .eq("negocio_id", negocioId)
      .order("fecha", { ascending: false })
      .order("secuencia", { ascending: false })
      .limit(limite),
    supabase.from("productos").select("id, marca, modelo").eq("negocio_id", negocioId),
  ]);
  if (compras.error) fallar("No se pudieron leer las compras", compras.error);
  if (productos.error) fallar("No se pudieron leer los productos", productos.error);
  const porId = new Map((productos.data ?? []).map((p) => [p.id as string, p as ProductoOpcion]));
  return ((compras.data ?? []) as StockCompra[]).map((c) => ({
    ...c,
    marca: porId.get(c.producto_id)?.marca ?? "",
    modelo: porId.get(c.producto_id)?.modelo ?? "",
  }));
}

export async function listarProductosActivos(negocioId: string): Promise<ProductoOpcion[]> {
  const supabase = await crearClienteSupabase();
  const { data, error } = await supabase
    .from("productos")
    .select("id, marca, modelo")
    .eq("negocio_id", negocioId)
    .eq("activo", true)
    .order("marca")
    .order("modelo");
  if (error) fallar("No se pudieron leer los productos", error);
  return (data ?? []) as ProductoOpcion[];
}

/** Tipo de cambio de la última compra cargada (para sugerirlo). */
export async function ultimoTipoDeCambio(
  negocioId: string,
): Promise<{ tipoDeCambio: number; fecha: string } | null> {
  const supabase = await crearClienteSupabase();
  const { data, error } = await supabase
    .from("compras")
    .select("tipo_cambio, fecha")
    .eq("negocio_id", negocioId)
    .is("anulado_en", null)
    .order("secuencia", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) fallar("No se pudo leer el último tipo de cambio", error);
  return data ? { tipoDeCambio: data.tipo_cambio as number, fecha: data.fecha as string } : null;
}
