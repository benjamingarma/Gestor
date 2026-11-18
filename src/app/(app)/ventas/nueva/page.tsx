import { BotonEnlace } from "@/componentes/BotonEnlace";
import { Encabezado } from "@/componentes/Encabezado";
import { ultimoCobroDe } from "@/datos/cuentas";
import { datosParaNuevaVenta, ultimaVentaDeCliente } from "@/datos/ventas";
import { hoy } from "@/lib/fechas";
import { obtenerSocioActual } from "@/lib/sesion";
import { FormularioVenta } from "./FormularioVenta";

export default async function PaginaNuevaVenta({ searchParams }: PageProps<"/ventas/nueva">) {
  const { cliente, repetir } = await searchParams;
  const socio = await obtenerSocioActual();
  const [datos, ultimoCobro] = await Promise.all([datosParaNuevaVenta(socio.negocioId), ultimoCobroDe(socio.negocioId, socio.socioId)]);
  const clienteInicial = typeof cliente === "string" && datos.clientes.some((c) => c.id === cliente) ? cliente : "";
  const volverA = clienteInicial ? `/clientes/${clienteInicial}` : "/";
  // Tarjeta "Última venta" del cliente con el que se abre (y, desde la ficha, la venta a repetir).
  const ultimaInicial = clienteInicial ? await ultimaVentaDeCliente(socio.negocioId, clienteInicial) : null;

  // Sin clientes cargados igual se puede vender: el cliente nuevo se crea desde esta pantalla.
  if (datos.productos.length === 0) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-4 py-6">
        <Encabezado titulo="Nueva venta" volverA={volverA} />
        <p>No hay productos con stock. Cargá una compra primero.</p>
        <BotonEnlace href="/compras/nueva">+ Cargar compra</BotonEnlace>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col">
      <FormularioVenta
        datos={datos}
        clienteInicial={clienteInicial}
        socioActual={socio.socioId}
        hoy={hoy()}
        volverA={volverA}
        ultimaInicial={ultimaInicial}
        repetir={repetir === "1" && ultimaInicial !== null}
        ultimoCobro={ultimoCobro}
      />
    </main>
  );
}
