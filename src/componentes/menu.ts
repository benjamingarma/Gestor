/** Estructura de navegación de McStock (docs/maquetas/README.md). Sirve al servidor y al cliente. */
import type { NombreIcono } from "./Iconos";

export type Item = { href: string; texto: string; icono: NombreIcono; activo: (ruta: string) => boolean };

const esCobroGuardado = (ruta: string) => /^\/cobros\/[^/]+\/guardado$/.test(ruta);
const empieza = (...prefijos: string[]) => (ruta: string) => prefijos.some((p) => ruta === p || ruta.startsWith(`${p}/`));

export const PRINCIPALES: Item[] = [
  { href: "/", texto: "Inicio", icono: "inicio", activo: (r) => r === "/" },
  { href: "/clientes", texto: "Clientes", icono: "clientes", activo: (r) => empieza("/clientes")(r) && !r.endsWith("/cobrar") },
  { href: "/cobrar", texto: "Deudores", icono: "cobrar", activo: (r) => empieza("/cobrar")(r) || r.endsWith("/cobrar") || esCobroGuardado(r) },
];

export const GESTION: (Item & { detalle: string; grupo: "Negocio" | "Historial y correcciones" | "Configuración" })[] = [
  { href: "/resumen", texto: "Resumen y ganancia", detalle: "Ganancia, cobrado, capital, reparto", icono: "grafico", grupo: "Negocio", activo: (r) => r === "/resumen" },
  { href: "/productos", texto: "Stock y productos", detalle: "Precios, costo, cargar compras", icono: "stock", grupo: "Negocio", activo: empieza("/productos") },
  { href: "/compras", texto: "Compras", detalle: "En dólares, con tipo de cambio", icono: "caja", grupo: "Negocio", activo: empieza("/compras") },
  { href: "/ventas", texto: "Ventas", detalle: "Ver y anular", icono: "historial", grupo: "Historial y correcciones", activo: (r) => empieza("/ventas")(r) && r !== "/ventas/nueva" && !r.endsWith("/guardada") },
  { href: "/cobros", texto: "Pagos recibidos", detalle: "Ver y anular", icono: "historial", grupo: "Historial y correcciones", activo: (r) => empieza("/cobros")(r) && !esCobroGuardado(r) },
  { href: "/ajustes", texto: "Regalos, pérdidas y roturas", detalle: "Dar de baja stock", icono: "roto", grupo: "Historial y correcciones", activo: empieza("/ajustes") },
  { href: "/resumen/reparto", texto: "Reparto entre socios", detalle: "", icono: "reparto", grupo: "Configuración", activo: empieza("/resumen/reparto") },
];

/** Orden del grupo "Gestión" en la barra lateral de PC (maqueta pc-inicio). */
const ORDEN_LATERAL = ["/productos", "/compras", "/ventas", "/cobros", "/resumen", "/ajustes", "/resumen/reparto"];
export const GESTION_LATERAL = [...GESTION]
  .sort((a, b) => ORDEN_LATERAL.indexOf(a.href) - ORDEN_LATERAL.indexOf(b.href))
  .map((g) => ({ ...g, texto: g.href === "/ventas" ? "Historial de ventas" : g.href === "/cobros" ? "Pagos recibidos" : g.texto }));

/** Pantallas que ocupan todo el celular (venta y cobro): sin barra inferior. */
export function esPantallaCompleta(ruta: string): boolean {
  return (
    ruta === "/ventas/nueva" ||
    /^\/ventas\/[^/]+\/guardada$/.test(ruta) ||
    /^\/cobrar\/[^/]+$/.test(ruta) ||
    esCobroGuardado(ruta) ||
    /^\/clientes\/[^/]+\/cobrar$/.test(ruta)
  );
}

