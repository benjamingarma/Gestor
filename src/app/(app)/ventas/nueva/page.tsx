import { BotonEnlace } from "@/componentes/BotonEnlace";
import { Encabezado } from "@/componentes/Encabezado";
import { datosParaNuevaVenta } from "@/datos/ventas";
import { hoy } from "@/lib/fechas";
import { obtenerSocioActual } from "@/lib/sesion";
import { FormularioVenta } from "./FormularioVenta";

export default async function PaginaNuevaVenta({ searchParams }: PageProps<"/ventas/nueva">) {
  const { cliente } = await searchParams;
  const socio = await obtenerSocioActual();
  const datos = await datosParaNuevaVenta(socio.negocioId);
  const clienteInicial = typeof cliente === "string" && datos.clientes.some((c) => c.id === cliente) ? cliente : "";

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-4 py-6">
      <Encabezado titulo="Nueva venta" volverA={clienteInicial ? `/clientes/${clienteInicial}` : "/"} />
      {datos.clientes.length === 0 ? (
        <>
          <p>Primero cargá un cliente.</p>
          <BotonEnlace href="/clientes/nuevo">+ Nuevo cliente</BotonEnlace>
        </>
      ) : datos.productos.length === 0 ? (
        <>
          <p>No hay productos con stock. Cargá una compra primero.</p>
          <BotonEnlace href="/compras/nueva">+ Cargar compra</BotonEnlace>
        </>
      ) : (
        <FormularioVenta datos={datos} clienteInicial={clienteInicial} socioActual={socio.socioId} hoy={hoy()} />
      )}
    </main>
  );
}
