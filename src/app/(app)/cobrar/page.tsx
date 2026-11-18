import { hoy } from "@/lib/fechas";
import { obtenerSocioActual } from "@/lib/sesion";
import { datosQuienDebe } from "./datos";
import { ListaQuienDebe } from "./ListaQuienDebe";

/** Cobrar (maqueta 3): lista de quién debe con buscador. En PC, la lista va a la izquierda del cobro. */
export default async function PaginaCobrar() {
  const socio = await obtenerSocioActual();
  const datos = await datosQuienDebe(socio.negocioId, hoy());

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col leading-[1.2]">
      <header className="px-[18px] pt-2 pb-3 lg:px-9 lg:pt-7 lg:pb-5">
        <h1 className="text-[1.25rem] font-extrabold lg:text-[1.6rem]">Deudores</h1>
      </header>
      <div className="flex flex-col gap-3 px-4 pb-6 lg:grid lg:grid-cols-[1fr_1.25fr] lg:items-start lg:gap-5 lg:px-9 lg:pb-9">
        <ListaQuienDebe {...datos} />
        <p className="hidden rounded-[20px] border border-dashed border-borde p-6 text-center text-texto-suave lg:block">
          Elegí de la lista quién te pagó. ¿No debe pero paga por adelantado? Buscalo: se le guarda a favor.
        </p>
      </div>
    </main>
  );
}
