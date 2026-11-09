import { Encabezado } from "@/componentes/Encabezado";
import { crearProducto } from "../acciones";
import { FormularioProducto } from "../FormularioProducto";

export default function PaginaNuevoProducto() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-6">
      <Encabezado titulo="Nuevo producto" volverA="/productos" />
      <FormularioProducto accion={crearProducto} textoBoton="Guardar producto" />
    </main>
  );
}
