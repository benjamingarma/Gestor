import { cerrarSesion } from "@/app/acciones-sesion";
import { Boton } from "@/componentes/Boton";

export default function PaginaSinAcceso() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-10">
      <h1 className="text-2xl font-bold">Tu usuario no está habilitado</h1>
      <p className="text-texto-suave">
        Entraste bien, pero tu cuenta todavía no está vinculada a ningún socio del negocio.
        Pedile al administrador que la vincule.
      </p>
      <form action={cerrarSesion}>
        <Boton variante="secundario" type="submit">
          Cerrar sesión
        </Boton>
      </form>
    </main>
  );
}
