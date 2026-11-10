import { Aviso } from "@/componentes/Aviso";
import { BotonEnlace } from "@/componentes/BotonEnlace";
import { Encabezado } from "@/componentes/Encabezado";
import { listarClientes } from "@/datos/clientes";
import { hoy } from "@/lib/fechas";
import { obtenerSocioActual } from "@/lib/sesion";
import { ListaClientes } from "./ListaClientes";

export default async function PaginaClientes({ searchParams }: PageProps<"/clientes">) {
  const { ok, vista } = await searchParams;
  const socio = await obtenerSocioActual();
  const dia = hoy();
  const clientes = await listarClientes(socio.negocioId, dia);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-6 leading-[1.25] pantalla-entrar lg:py-7">
      <Encabezado titulo="Clientes" volverA="/" />
      {ok === "visitado" && <Aviso tipo="ok">Visita registrada.</Aviso>}
      <BotonEnlace href="/clientes/nuevo">+ Nuevo cliente</BotonEnlace>
      <ListaClientes
        hoy={dia}
        vistaInicial={vista === "todos" || vista === "archivados" ? vista : "visitar"}
        clientes={clientes.map((c) => ({ id: c.id, nombre: c.nombre, telefono: c.telefono, estado: c.estado }))}
      />
    </main>
  );
}
