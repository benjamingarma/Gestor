import { notFound } from "next/navigation";
import { Encabezado } from "@/componentes/Encabezado";
import { listarComprasDeProducto, obtenerStockProducto } from "@/datos/inventario";
import { hoy } from "@/lib/fechas";
import { obtenerSocioActual } from "@/lib/sesion";
import { esUuid } from "@/lib/uuid";
import { FormularioAjuste } from "./FormularioAjuste";

export default async function PaginaNuevoAjuste({ params }: PageProps<"/productos/[id]/ajuste">) {
  const { id } = await params;
  if (!esUuid(id)) notFound();
  const socio = await obtenerSocioActual();
  const [producto, compras] = await Promise.all([obtenerStockProducto(socio.negocioId, id), listarComprasDeProducto(socio.negocioId, id)]);
  if (!producto) notFound();

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-6">
      <Encabezado titulo="Regalo, pérdida o rotura" subtitulo={`${producto.marca} ${producto.modelo}`} volverA={`/productos/${id}`} />
      {producto.unidades === 0 ? (
        <p>No hay stock de este producto: no hay nada para dar de baja.</p>
      ) : (
        <FormularioAjuste
          productoId={id}
          stock={producto.unidades}
          hoy={hoy()}
          compras={compras
            .filter((c) => c.anulado_en === null && c.disponible > 0)
            .map((c) => ({
              compraId: c.compra_id,
              fecha: c.fecha,
              secuencia: c.secuencia,
              disponible: c.disponible,
              costoUnitarioArs: c.costo_unitario_ars,
              costoUnitarioUsd: c.costo_unitario_usd,
            }))}
        />
      )}
    </main>
  );
}
