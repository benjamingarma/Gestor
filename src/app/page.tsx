import { cerrarSesion } from "@/app/acciones-sesion";
import { Boton } from "@/componentes/Boton";
import { formatearDia, hoy } from "@/lib/fechas";
import { obtenerSocioActual } from "@/lib/sesion";

// Los módulos se habilitan uno por uno, a medida que se aprueban.
const MODULOS = [
  { nombre: "Nueva venta", detalle: "Módulo 1.4" },
  { nombre: "Clientes", detalle: "Módulo 1.1" },
  { nombre: "Cobros", detalle: "Módulo 1.5" },
  { nombre: "Stock y compras", detalle: "Módulo 1.2" },
  { nombre: "Ganancia", detalle: "Módulo 1.7" },
];

export default async function PaginaInicio() {
  const socio = await obtenerSocioActual();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6">
      <header className="flex flex-col gap-1">
        <p className="text-sm text-texto-suave">
          {socio.negocioNombre} · {formatearDia(hoy())}
        </p>
        <h1 className="text-2xl font-bold">Hola, {socio.nombre}</h1>
      </header>

      <section aria-label="Módulos" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {MODULOS.map((m) => (
          <div
            key={m.nombre}
            aria-disabled="true"
            className="flex min-h-[72px] flex-col justify-center rounded-xl border border-dashed border-borde bg-superficie px-5 py-3 opacity-70"
          >
            <span className="text-lg font-semibold">{m.nombre}</span>
            <span className="text-sm text-texto-suave">Próximamente · {m.detalle}</span>
          </div>
        ))}
      </section>

      <footer className="mt-auto flex flex-col gap-2 pt-6">
        <p className="text-center text-sm text-texto-suave">Sesión iniciada como {socio.email}</p>
        <form action={cerrarSesion}>
          <Boton variante="secundario" type="submit">
            Cerrar sesión
          </Boton>
        </form>
      </footer>
    </main>
  );
}
