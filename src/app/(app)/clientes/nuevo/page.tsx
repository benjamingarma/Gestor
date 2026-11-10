import { Encabezado } from "@/componentes/Encabezado";
import { crearCliente } from "../acciones";
import { FormularioCliente } from "../FormularioCliente";

export default function PaginaNuevoCliente() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-4 py-6 leading-[1.25] pantalla-entrar lg:py-7">
      <Encabezado titulo="Nuevo cliente" volverA="/clientes" />
      <FormularioCliente accion={crearCliente} textoBoton="Guardar cliente" />
    </main>
  );
}
