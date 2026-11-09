import { BotonEnlace } from "@/componentes/BotonEnlace";
import { Encabezado } from "@/componentes/Encabezado";
import { listarUltimasCompras } from "@/datos/inventario";
import { obtenerSocioActual } from "@/lib/sesion";
import { TarjetaCompra } from "./TarjetaCompra";

export default async function PaginaCompras() {
  const socio = await obtenerSocioActual();
  const compras = await listarUltimasCompras(socio.negocioId);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 py-6">
      <Encabezado titulo="Compras" volverA="/productos" subtitulo="Las últimas 100, de la más nueva a la más vieja." />
      <BotonEnlace href="/compras/nueva">+ Cargar compra</BotonEnlace>
      {compras.length === 0 && <p className="text-texto-suave">Todavía no hay compras.</p>}
      {compras.map((c) => (
        <TarjetaCompra key={c.compra_id} compra={c} titulo={`${c.marca} ${c.modelo}`} permitirAnular={false} />
      ))}
    </main>
  );
}
