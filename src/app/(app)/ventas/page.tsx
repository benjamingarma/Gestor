import { BotonEnlace } from "@/componentes/BotonEnlace";
import { Encabezado } from "@/componentes/Encabezado";
import { ListaVentas } from "@/componentes/ListaVentas";
import { listarVentas } from "@/datos/ventas";
import { obtenerSocioActual } from "@/lib/sesion";

export default async function PaginaVentas() {
  const socio = await obtenerSocioActual();
  const ventas = await listarVentas(socio.negocioId);
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-6">
      <Encabezado titulo="Ventas" volverA="/" subtitulo="Las últimas 100, de la más nueva a la más vieja." />
      <BotonEnlace href="/ventas/nueva">+ Nueva venta</BotonEnlace>
      <ListaVentas ventas={ventas} />
    </main>
  );
}
