/**
 * Carrito de la pantalla de venta (módulo 1.7, maqueta "Venta"). Lógica pura, sin pantalla:
 * qué precio se propone, cuántas unidades se pueden agregar y cuánto da el total.
 *
 * No calcula dinero nuevo: usa precioPropuesto, simularFifo y parsearImporte, ya probados.
 * La base sigue siendo la autoridad: recalcula el costo FIFO real al guardar.
 */
import { formatearPesos, parsearImporte, type Centavos } from "@/lib/dinero";
import { precioPropuesto, simularFifo, type CompraDisponible, type OrigenPrecio } from "./ventas";

export type ProductoVenta = { id: string; nombre: string; unidades: number; precioGeneral: Centavos | null; compras: CompraDisponible[] };
export type PreciosCliente = {
  /** clienteId -> productoId -> precio */
  especiales: Record<string, Record<string, Centavos>>;
  ultimos: Record<string, Record<string, Centavos>>;
};

/** Un renglón del carrito. El precio es el texto que ve y puede corregir el socio. */
export type ItemCarrito = { productoId: string; cantidad: number; precio: string; origen: OrigenPrecio };

/** Texto del origen del precio, como en la maqueta. */
export const TEXTO_ORIGEN: Record<OrigenPrecio, string> = {
  especial: "precio especial",
  ultimo: "último que pagó",
  general: "precio general",
  ninguno: "sin precio cargado",
};

const MAXIMA_CANTIDAD = 10_000;

export function centavosATexto(c: Centavos): string {
  return formatearPesos(c).replace("$ ", "");
}

/** Precio propuesto para un cliente (especial → último que pagó → general). */
export function proponerPrecio(productoId: string, clienteId: string, productos: Map<string, ProductoVenta>, precios: PreciosCliente) {
  return precioPropuesto({
    especial: precios.especiales[clienteId]?.[productoId] ?? null,
    ultimoPagado: precios.ultimos[clienteId]?.[productoId] ?? null,
    general: productos.get(productoId)?.precioGeneral ?? null,
  });
}

/**
 * Suma (o resta) unidades de un producto. Nunca pasa del stock ni baja de 0; con 0 el renglón se quita.
 * Al agregar un producto nuevo, el precio es el propuesto para el cliente.
 */
export function cambiarCantidad(
  items: ItemCarrito[],
  productoId: string,
  delta: number,
  ctx: { clienteId: string; productos: Map<string, ProductoVenta>; precios: PreciosCliente },
): ItemCarrito[] {
  const stock = Math.min(ctx.productos.get(productoId)?.unidades ?? 0, MAXIMA_CANTIDAD);
  const actual = items.find((i) => i.productoId === productoId);
  const nueva = Math.max(0, Math.min(stock, (actual?.cantidad ?? 0) + delta));
  if (nueva === 0) return items.filter((i) => i.productoId !== productoId);
  if (actual) return items.map((i) => (i.productoId === productoId ? { ...i, cantidad: nueva } : i));
  const pr = proponerPrecio(productoId, ctx.clienteId, ctx.productos, ctx.precios);
  return [...items, { productoId, cantidad: nueva, precio: pr.precio !== null ? centavosATexto(pr.precio) : "", origen: pr.origen }];
}

/** Al cambiar de cliente, cada renglón vuelve a tomar el precio propuesto para el cliente nuevo. */
export function reproponerPrecios(items: ItemCarrito[], clienteId: string, productos: Map<string, ProductoVenta>, precios: PreciosCliente): ItemCarrito[] {
  return items.map((it) => {
    const pr = proponerPrecio(it.productoId, clienteId, productos, precios);
    return { ...it, precio: pr.precio !== null ? centavosATexto(pr.precio) : "", origen: pr.origen };
  });
}

export type FilaCarrito = ItemCarrito & {
  nombre: string;
  precioCentavos: Centavos | null;
  precioError: string | null;
  subtotal: Centavos | null;
  faltan: number;
  costoArs: Centavos;
  costoUsd: Centavos;
};

export type ResumenCarrito = {
  filas: FilaCarrito[];
  productos: number;
  unidades: number;
  importe: Centavos;
  costoArs: Centavos;
  costoUsd: Centavos;
  /** Estimada: la base recalcula el costo FIFO real al guardar. */
  ganancia: Centavos;
  /** Primer problema que impide guardar (null si se puede). */
  problema: string | null;
};

export function resumirCarrito(items: ItemCarrito[], productos: Map<string, ProductoVenta>, clienteElegido: boolean): ResumenCarrito {
  const filas: FilaCarrito[] = items.map((it) => {
    const p = productos.get(it.productoId);
    const precio = parsearImporte(it.precio);
    const fifo = simularFifo(p?.compras ?? [], it.cantidad);
    return {
      ...it,
      nombre: p?.nombre ?? "",
      precioCentavos: precio.ok ? precio.centavos : null,
      precioError: precio.ok ? null : it.precio.trim() === "" ? "Poné el precio." : precio.error,
      subtotal: precio.ok ? precio.centavos * it.cantidad : null,
      faltan: fifo.faltan,
      costoArs: fifo.costoArs,
      costoUsd: fifo.costoUsd,
    };
  });
  const importe = filas.reduce((s, f) => s + (f.subtotal ?? 0), 0);
  const costoArs = filas.reduce((s, f) => s + f.costoArs, 0);
  const sinPrecio = filas.find((f) => f.precioError);
  const sinStock = filas.find((f) => f.faltan > 0);
  return {
    filas,
    productos: filas.length,
    unidades: filas.reduce((s, f) => s + f.cantidad, 0),
    importe,
    costoArs,
    costoUsd: filas.reduce((s, f) => s + f.costoUsd, 0),
    ganancia: importe - costoArs,
    problema: !clienteElegido
      ? "Elegí el cliente."
      : filas.length === 0
        ? "Agregá al menos un producto."
        : sinPrecio
          ? `${sinPrecio.nombre}: ${sinPrecio.precioError}`
          : sinStock
            ? `${sinStock.nombre}: no alcanza el stock.`
            : null,
  };
}

// ---------------------------------------------------------------------------------
// Repetir la última venta (pedido de los socios, maqueta 6). No calcula dinero nuevo:
// arma el carrito con los mismos productos y cantidades, con los precios de HOY.
// ---------------------------------------------------------------------------------

/** Un renglón de la venta anterior, tal como quedó guardado (precio histórico). */
export type RenglonAnterior = { productoId: string; nombre: string; cantidad: number; precioUnitario: Centavos };

/** Producto que no se pudo cargar entero porque no alcanza el stock de hoy. */
export type FaltanteRepeticion = { nombre: string; llevo: number; cargadas: number };

/** Junta los renglones del mismo producto (sumando cantidades), en el orden en que aparecen. */
export function juntarRenglones(renglones: RenglonAnterior[]): RenglonAnterior[] {
  const porProducto = new Map<string, RenglonAnterior>();
  for (const r of renglones) {
    const previo = porProducto.get(r.productoId);
    // Si el mismo producto vino en dos renglones, vale el precio del último renglón.
    porProducto.set(r.productoId, previo ? { ...r, cantidad: previo.cantidad + r.cantidad } : { ...r });
  }
  return [...porProducto.values()];
}

/**
 * Carrito para repetir una venta: mismos productos y cantidades, precio propuesto de hoy
 * (especial → último que pagó → general). Nunca pasa del stock disponible: si falta, carga
 * lo que hay y lo informa; si no hay nada (o el producto ya no se vende), no lo agrega.
 */
export function armarRepeticion(
  renglones: RenglonAnterior[],
  ctx: { clienteId: string; productos: Map<string, ProductoVenta>; precios: PreciosCliente },
): { items: ItemCarrito[]; faltantes: FaltanteRepeticion[] } {
  const items: ItemCarrito[] = [];
  const faltantes: FaltanteRepeticion[] = [];
  for (const r of juntarRenglones(renglones)) {
    const stock = Math.min(ctx.productos.get(r.productoId)?.unidades ?? 0, MAXIMA_CANTIDAD);
    const cargadas = Math.max(0, Math.min(r.cantidad, stock));
    if (cargadas < r.cantidad) faltantes.push({ nombre: r.nombre, llevo: r.cantidad, cargadas });
    if (cargadas === 0) continue;
    const pr = proponerPrecio(r.productoId, ctx.clienteId, ctx.productos, ctx.precios);
    items.push({ productoId: r.productoId, cantidad: cargadas, precio: pr.precio !== null ? centavosATexto(pr.precio) : "", origen: pr.origen });
  }
  return { items, faltantes };
}

/** Texto del aviso de un producto que no alcanzó (maqueta 6c). */
export function textoFaltante(f: FaltanteRepeticion): string {
  return f.cargadas === 0 ? `${f.nombre}: sin stock, no se agregó.` : `${f.nombre}: llevó ${f.llevo}, quedan ${f.cargadas} → cargamos ${f.cargadas}.`;
}

/**
 * Precio que pagó en la última venta, solo si es distinto del que se propone hoy
 * (para mostrar "La última vez: $ X"). null si no lo compró la última vez o si es el mismo.
 */
export function ultimoPrecioDistinto(renglones: RenglonAnterior[], productoId: string, propuesto: Centavos | null): Centavos | null {
  const r = juntarRenglones(renglones).find((x) => x.productoId === productoId);
  if (!r || r.precioUnitario === propuesto) return null;
  return r.precioUnitario;
}
