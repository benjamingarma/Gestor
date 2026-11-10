import { BotonEnlace } from "@/componentes/BotonEnlace";
import { Encabezado } from "@/componentes/Encabezado";
import { listarStockProductos } from "@/datos/inventario";
import { formatearDolares, formatearPesos } from "@/lib/dinero";
import { obtenerSocioActual } from "@/lib/sesion";
import { ListaProductos } from "./ListaProductos";

export default async function PaginaProductos() {
  const socio = await obtenerSocioActual();
  const stock = await listarStockProductos(socio.negocioId);

  const unidades = stock.reduce((s, p) => s + p.unidades, 0);
  const capitalUsd = stock.reduce((s, p) => s + p.valor_usd, 0);
  const capitalArs = stock.reduce((s, p) => s + p.valor_ars, 0);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 py-6">
      <Encabezado titulo="Stock y compras" volverA="/" />

      <section aria-label="Resumen del stock" className="grid grid-cols-2 gap-3 rounded-xl border border-borde bg-superficie p-4">
        <div className="flex flex-col">
          <span className="text-sm text-texto-suave">Unidades en stock</span>
          <span className="text-2xl font-bold">{unidades}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-sm text-texto-suave">Capital en mercadería</span>
          <span className="text-xl font-bold" data-dato="capital-usd" data-centavos={capitalUsd}>
            {formatearDolares(capitalUsd)}
          </span>
          <span className="text-base font-semibold" data-dato="capital-ars" data-centavos={capitalArs}>
            {formatearPesos(capitalArs)}
          </span>
        </div>
        <p className="col-span-2 text-xs text-texto-suave">
          Valuado al costo de cada compra (dólares y pesos al tipo de cambio de esa compra).
        </p>
      </section>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <BotonEnlace href="/compras/nueva">+ Cargar compra</BotonEnlace>
        <BotonEnlace href="/productos/nuevo" variante="secundario">
          + Nuevo producto
        </BotonEnlace>
        <BotonEnlace href="/compras" variante="secundario">
          Ver compras
        </BotonEnlace>
      </div>

      <ListaProductos
        productos={stock.map((p) => ({
          id: p.producto_id,
          marca: p.marca,
          modelo: p.modelo,
          activo: p.activo,
          unidades: p.unidades,
          precioGeneral: p.precio_general,
          valorUsd: p.valor_usd,
          valorArs: p.valor_ars,
        }))}
      />
    </main>
  );
}
