import { notFound } from "next/navigation";
import { Aviso } from "@/componentes/Aviso";
import { BotonEnlace } from "@/componentes/BotonEnlace";
import { Encabezado } from "@/componentes/Encabezado";
import { listarAjustes } from "@/datos/ajustes";
import { listarComprasDeProducto, obtenerStockProducto } from "@/datos/inventario";
import { formatearDolares, formatearPesos } from "@/lib/dinero";
import { obtenerSocioActual } from "@/lib/sesion";
import { esUuid } from "@/lib/uuid";
import { TarjetaAjuste } from "../../ajustes/TarjetaAjuste";
import { TarjetaCompra } from "../../compras/TarjetaCompra";
import { editarProducto } from "../acciones";
import { FormularioProducto } from "../FormularioProducto";

const MENSAJES: Record<string, string> = {
  producto: "Producto creado. Ahora podés cargarle una compra.",
  editado: "Cambios guardados.",
  compra: "Compra guardada.",
  anulada: "Compra anulada.",
  ajuste: "Ajuste guardado: las unidades salieron del stock y su costo se resta de la ganancia.",
  "ajuste-anulado": "Ajuste anulado: las unidades volvieron al stock.",
};

function centavosATexto(centavos: number | null): string {
  if (centavos === null) return "";
  return formatearPesos(centavos).replace("$ ", "");
}

export default async function PaginaProducto({ params, searchParams }: PageProps<"/productos/[id]">) {
  const { id } = await params;
  const { ok } = await searchParams;
  if (!esUuid(id)) notFound();

  const socio = await obtenerSocioActual();
  const [producto, compras, ajustes] = await Promise.all([
    obtenerStockProducto(socio.negocioId, id),
    listarComprasDeProducto(socio.negocioId, id),
    listarAjustes(socio.negocioId, { productoId: id, limite: 20 }),
  ]);
  if (!producto) notFound();

  const mensaje = typeof ok === "string" ? MENSAJES[ok] : undefined;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 py-6">
      <Encabezado
        titulo={`${producto.marca} ${producto.modelo}`}
        volverA="/productos"
        subtitulo={producto.activo ? undefined : "Producto desactivado"}
      />
      {mensaje && <Aviso tipo="ok">{mensaje}</Aviso>}

      <section className="grid grid-cols-2 gap-3 rounded-xl border border-borde bg-superficie p-4">
        <div className="flex flex-col">
          <span className="text-sm text-texto-suave">En stock</span>
          <span className="text-3xl font-bold">{producto.unidades}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-sm text-texto-suave">Precio general</span>
          <span className="text-xl font-bold">
            {producto.precio_general !== null ? formatearPesos(producto.precio_general) : "—"}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-sm text-texto-suave">Stock a costo</span>
          <span className="font-semibold">{formatearDolares(producto.valor_usd)}</span>
          <span className="font-semibold">{formatearPesos(producto.valor_ars)}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-sm text-texto-suave">Próxima unidad (FIFO)</span>
          {producto.proximo_costo_ars !== null && producto.proximo_costo_usd !== null ? (
            <>
              <span className="font-semibold">{formatearPesos(producto.proximo_costo_ars)}</span>
              <span className="text-sm">{formatearDolares(producto.proximo_costo_usd)}</span>
            </>
          ) : (
            <span className="font-semibold">Sin stock</span>
          )}
        </div>
      </section>

      {producto.activo && (
        <BotonEnlace href={`/compras/nueva?producto=${producto.producto_id}`}>+ Cargar compra</BotonEnlace>
      )}
      {producto.unidades > 0 && (
        <BotonEnlace href={`/productos/${producto.producto_id}/ajuste`} variante="secundario">
          − Regalo, pérdida o rotura
        </BotonEnlace>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-bold">Compras</h2>
        <p className="text-sm text-texto-suave">De la más vieja a la más nueva: al vender, sale primero la de arriba.</p>
        {compras.length === 0 && <p className="text-texto-suave">Todavía no hay compras de este producto.</p>}
        {compras.map((c) => (
          <TarjetaCompra key={c.compra_id} compra={c} permitirAnular />
        ))}
      </section>

      <section id="ajustes" className="flex flex-col gap-3">
        <h2 className="text-xl font-bold">Regalos, pérdidas y roturas</h2>
        {ajustes.length === 0 ? (
          <p className="text-texto-suave">Ninguno todavía.</p>
        ) : (
          ajustes.map((a) => <TarjetaAjuste key={a.ajuste_id} ajuste={a} volverA={`/productos/${producto.producto_id}`} />)
        )}
      </section>

      <details className="rounded-xl border border-borde bg-superficie p-4">
        <summary className="min-h-[44px] cursor-pointer content-center text-lg font-semibold">Editar producto</summary>
        <div className="mt-3">
          <FormularioProducto
            accion={editarProducto}
            textoBoton="Guardar cambios"
            inicial={{
              id: producto.producto_id,
              marca: producto.marca,
              modelo: producto.modelo,
              precioGeneral: centavosATexto(producto.precio_general),
              activo: producto.activo,
            }}
          />
        </div>
      </details>
    </main>
  );
}
