import { strToU8, zipSync } from "fflate";
import { leerTodo } from "@/datos/resumen";
import { aCsv } from "@/dominio/exportar";
import { hoy } from "@/lib/fechas";
import { obtenerSocioActual } from "@/lib/sesion";
import { crearClienteSupabase } from "@/lib/supabase/servidor";

/**
 * Exportar todo (módulo 1.9): un .zip con un CSV por tabla del negocio del socio logueado.
 * Lee como el usuario (RLS), solo lectura, todas las filas (de a 1000). Nunca se guarda en caché.
 */
export const dynamic = "force-dynamic";

const TABLAS: { tabla: string; orden: string[] }[] = [
  { tabla: "negocios", orden: ["id"] },
  { tabla: "socios", orden: ["orden", "id"] },
  { tabla: "reparto_porcentajes", orden: ["vigente_desde", "socio_id"] },
  { tabla: "productos", orden: ["marca", "modelo", "id"] },
  { tabla: "clientes", orden: ["nombre", "id"] },
  { tabla: "precios_especiales", orden: ["cliente_id", "producto_id"] },
  { tabla: "compras", orden: ["secuencia"] },
  { tabla: "ventas", orden: ["secuencia"] },
  { tabla: "venta_items", orden: ["venta_id", "renglon"] },
  { tabla: "pagos", orden: ["secuencia"] },
  { tabla: "saldos_iniciales", orden: ["fecha", "creado_en", "id"] },
  { tabla: "ajustes_stock", orden: ["secuencia"] },
  { tabla: "visitas", orden: ["fecha", "id"] },
  { tabla: "movimientos_stock", orden: ["creado_en", "id"] },
];

const LEAME = `Exportación de todos los datos de la app (una planilla por tabla).
- Separador: punto y coma. Se abren con Excel o Google Sheets.
- Montos (importe, precios, costos y tipo de cambio) en pesos o dólares, con coma decimal y sin separador de miles.
- Fechas y horas en hora de Tucumán. "sí"/"no" para verdadero/falso.
- Las columnas *_id son códigos que unen las tablas (por ejemplo, ventas.cliente_id = clientes.id).
- Nada se borra en la app: lo anulado figura con anulado_en y motivo_anulacion.
- Un texto que empezaba con = + - @ tiene un apóstrofo adelante (para que Excel no lo tome como fórmula).
`;

export async function GET() {
  const socio = await obtenerSocioActual();
  const supabase = await crearClienteSupabase();
  const csvs = await Promise.all(
    TABLAS.map(async ({ tabla, orden }) => {
      const filas = await leerTodo<Record<string, unknown>>((desde, hasta) => {
        let q = supabase.from(tabla).select("*").eq(tabla === "negocios" ? "id" : "negocio_id", socio.negocioId);
        for (const columna of orden) q = q.order(columna);
        return q.range(desde, hasta);
      }, `No se pudo leer ${tabla}`);
      return [`${tabla}.csv`, strToU8(aCsv(filas))] as const;
    }),
  );
  const zip = zipSync({ "LEAME.txt": strToU8(LEAME), ...Object.fromEntries(csvs) });
  return new Response(new Blob([zip as Uint8Array<ArrayBuffer>]), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="gestor-exportacion-${hoy()}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
